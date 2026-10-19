import { assertTrustedSimulationResult, type AuraStateEntry, type SimulationResult } from "@genshin-dps-lab/schemas";
import {
  createSpecialReactionState, transitionSpecialState, SPECIAL_STATE_PROFILE_ID,
  type ConvertibleOrdinaryReaction, type SpecialAuraSnapshot, type SpecialDamageIntent,
  type SpecialPartyMember, type SpecialReactionState, type SpecialStateBlocker,
  type SpecialStateLog, type SpecialStateTransition
} from "./special-reaction-state";

export interface SpecialSimulationAudit {
  version: "special-simulation-audit-v1";
  sourceReproducibilityKey: string;
  stateProfileId: typeof SPECIAL_STATE_PROFILE_ID;
  status: "no-enabled-conversion" | "conversion-not-applied" | "blocked";
  /** This facet is diagnostic and never contributes fabricated zeroes or extra damage. */
  formalSpecialDamage: null;
  sourceDamageUnmodified: true;
  processedApplicationEventIds: number[];
  log: SpecialStateLog[];
  damageIntents: SpecialDamageIntent[];
  blockers: SpecialStateBlocker[];
  finalState: SpecialReactionState;
}

const convertible = new Set<string>(["electroCharged", "bloom", "crystallizeHydro", "superconduct", "swirlCryo"]);

function sourceOwners(aura: readonly AuraStateEntry[]): SpecialAuraSnapshot {
  const owners = (element: "hydro" | "electro" | "cryo"): string[] | undefined => {
    const present = aura.filter((entry) => entry.element === element && entry.gaugeUnits > 0);
    if (present.some((entry) => entry.sourceSlots === undefined)) return undefined;
    return [...new Set(present.flatMap((entry) => entry.sourceSlots!.filter((slot) => slot.gaugeUnits > 0).map((slot) => slot.sourceActorId)))];
  };
  const hydro = owners("hydro"), electro = owners("electro"), cryo = owners("cryo");
  return { ...(hydro === undefined ? {} : { hydro }), ...(electro === undefined ? {} : { electro }), ...(cryo === undefined ? {} : { cryo }), frozen: aura.some((entry) => entry.element === "frozen" && entry.gaugeUnits > 0) };
}

/**
 * Connects real aura/ICD decisions to the isolated special-state model without
 * falsely claiming that the ordinary engine's consumption has been replaced.
 * Missing live frames stay unknown; ownership is never extrapolated from a
 * current panel or from the most recent triggering actor.
 */
export function auditSpecialReactionIntegration(result: SimulationResult, party: readonly SpecialPartyMember[]): SpecialSimulationAudit {
  assertTrustedSimulationResult(result);
  const out: SpecialSimulationAudit = {
    version: "special-simulation-audit-v1", sourceReproducibilityKey: result.reproducibilityKey,
    stateProfileId: SPECIAL_STATE_PROFILE_ID, status: "no-enabled-conversion",
    formalSpecialDamage: null, sourceDamageUnmodified: true,
    processedApplicationEventIds: [], log: [], damageIntents: [], blockers: [], finalState: createSpecialReactionState()
  };
  const block = (field: string, reason: string, sourceRefs: string[] = []): void => {
    if (!out.blockers.some((entry) => entry.field === field && entry.reason === reason)) out.blockers.push({ mechanic: "special-simulation-integration", field, reason, sourceRefs });
  };
  if (party.length !== result.config.characters.length || new Set(party.map((member) => member.actorId)).size !== party.length ||
    party.some((member) => !result.config.characters.some((character) => character.id === member.actorId))) {
    block("partyIdentity", "队伍启用角色映射必须与实际模拟角色一一对应，不猜测内部角色名。");
  }
  if (result.enemyTargets.length !== 1 || result.config.enemy.targetMotions?.length) {
    block("spatialProfile", "特殊状态参考配置仅支持一个静止范围内目标；当前目标几何未满足。");
  }
  if (result.config.targetClockModel.mode !== "disabled") block("clientAndTargetClockProfile", "此特殊状态配置尚未接入目标停顿时钟，不能套用固定60帧调度。");
  if (result.config.reactionEngine === undefined) block("automaticAuraEngine", "输入没有自动附着引擎；手动反应标签不能建立特殊反应状态。");
  if (out.blockers.length) { out.status = "blocked"; return out; }
  const targetId = result.enemyTargets[0]!.id;
  const context = {
    party: [...party], profileId: SPECIAL_STATE_PROFILE_ID,
    spatialProfile: "single-stationary-target-in-range" as const, targetId,
    auraAt: (frame: number, selectedTarget: string): SpecialAuraSnapshot | undefined => {
      // Exactly recorded event-before state only. A missing observation is not
      // an empty aura and cannot certify special contributor eligibility.
      const point = result.targetStateTimeline.points.find((candidate) => candidate.targetId === selectedTarget && candidate.frame === frame);
      return point === undefined ? undefined : sourceOwners(point.auraBefore);
    }
  };
  let nextWakeFrame: number | undefined;
  const accept = (transition: SpecialStateTransition): void => {
    out.finalState = transition.state;
    out.log.push(...transition.log);
    out.damageIntents.push(...transition.damageIntents);
    for (const entry of transition.blockedMechanics) if (!out.blockers.some((existing) => existing.field === entry.field && existing.mechanic === entry.mechanic)) out.blockers.push(entry);
    nextWakeFrame = transition.nextWakeFrame;
    if (transition.conversion?.specialReaction) {
      out.status = "conversion-not-applied";
      block("conversion-not-applied", "当前普通附着引擎尚未替换该特殊分支的元素量消费、普通反应任务及状态效果；这些状态记录和伤害意图不进入正式总伤害。", transition.log.flatMap((entry) => entry.sourceRefs));
    }
  };
  const advanceThrough = (frame: number): void => {
    while (nextWakeFrame !== undefined && nextWakeFrame <= frame) {
      accept(transitionSpecialState(out.finalState, { kind: "advance", frame: nextWakeFrame }, context));
    }
  };
  for (const event of result.damageEvents) {
    if (event.kind !== "direct" || event.targetId !== targetId || event.reactionAudit.model !== "aura-engine") continue;
    advanceThrough(event.frame);
    const audit = event.reactionAudit;
    if (audit.mechanicsTruncation !== null) { block("sourceMechanicsTruncated", "原模拟已因不支持机制截断，后续特殊反应状态不能继续证明。"); break; }
    if (audit.icdAllowed !== true || audit.applicationGaugeUnits === null) continue;
    out.processedApplicationEventIds.push(event.id);
    const reactions = audit.reactions.filter((reaction): reaction is ConvertibleOrdinaryReaction => convertible.has(reaction));
    for (const reaction of reactions.length ? reactions : [undefined]) {
      accept(transitionSpecialState(out.finalState, {
        kind: "application", frame: event.frame, sourceActorId: event.sourceActorId,
        sourceEventId: `${result.reproducibilityKey}:damage:${event.id}`, attackId: event.hitGroupId,
        targetId, element: event.element, gaugeUnits: audit.applicationGaugeUnits,
        actualIcdAllowed: true, resolutionOrigin: "aura-engine",
        ...(reaction === undefined ? {} : { ordinaryReaction: reaction }),
        ...(audit.auraBefore === null ? {} : { auraBefore: sourceOwners(audit.auraBefore) })
      }, context));
    }
  }
  advanceThrough(Math.round(result.config.duration * 60) - 1);
  if (out.status === "no-enabled-conversion" && out.blockers.length) out.status = "blocked";
  // Even numerically sourced intents cannot be promoted while the host's
  // consumption, propagation, field buffs and delivery effects are absent.
  if (out.status === "conversion-not-applied") {
    const integrationBlocker = out.blockers.find((entry) => entry.field === "conversion-not-applied")!;
    out.damageIntents = out.damageIntents.map((intent) => ({ ...intent, blockedMechanics: [...intent.blockedMechanics, integrationBlocker] }));
  }
  return out;
}
