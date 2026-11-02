import type { DamageEvent, SimulationResult } from "@genshin-dps-lab/schemas";
import { calcAmplifyingReactionMultiplier } from "./formulas";

// Internal calculator capability, not a generic result validator. The caller
// must first parse the entire public wire and assert its trusted invariants.
// Unsupported stat providers stay fail-closed; a recorded multiplier is never
// accepted as independent evidence of its own live source inputs.
const DECLARED_FRAME_MODELS = new Set([
  "playerDamageModel", "targetClockModel", "targetTaskModel", "reactionDeliveryModel",
  "electroChargedPropagationModel", "reactionFormulaModel", "directDamageGroupModel",
  "elementalApplicationIcdModel", "reactionOwnedElementalApplicationModel",
  "reactionDamageGroupModel", "basicReactionSchedulerModel", "freezeBrokenAttackModel", "callbackBusModel",
]);
function unsupported(reason: string): never {
  throw new Error(`暂不能独立还原扩散的嵌套增幅：${reason}。请保留原模拟结果；此命中不会作为已复现结果导出。`);
}
function same(actual: number, expected: number, field: string): void {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1e-10 * Math.max(1, Math.abs(expected))) {
    throw new Error(`无法完整还原模拟命中：nestedSwirl.${field} 与已声明来源不一致（${actual} / ${expected}）。`);
  }
}

export function replayDeclaredSwirlAmplification(result: SimulationResult, event: DamageEvent) {
  const reaction = event.reactionAudit.reaction;
  if (reaction !== "melt" && reaction !== "reverseMelt" && reaction !== "vaporize" && reaction !== "reverseVaporize") {
    same(event.damageFactors.amplifyingReactionMultiplier, 1, "nonAmplifyingMultiplier");
    return null;
  }
  const config = result.config;
  if (result.compatibilityMode !== "legal-frame-v1" || config.timeline?.mode !== "legal-frame-v1" || config.rotation.length !== 0) unsupported("需要明确的逐帧时间轴来源");
  if (result.pluginManifest.length || config.sourceAbilityBindings?.length) unsupported("插件或编译角色来源尚无此项独立增幅输入证明");
  const unknownModel = Object.keys(config).find((key) => key.endsWith("Model") && !DECLARED_FRAME_MODELS.has(key));
  if (unknownModel) unsupported(`动态模型 ${unknownModel} 的精通或反应加成来源未纳入本次重放`);
  if (result.sourceSnapshotLog !== undefined || result.executionAudit !== undefined) unsupported("显式属性取样或执行覆盖尚未纳入本次重放");
  const abilities = config.timeline.abilities;
  if (abilities.some((ability) => ability.actionPhase !== undefined || ability.conditionalHitGroups?.length || ability.periodicEntities?.length || ability.summons?.length || ability.statConversions?.length || ability.hits?.some((hit) => hit.snapshotFrame !== undefined || hit.snapshot === "action" || hit.infusion !== undefined || hit.scalingOwnerId !== undefined && hit.scalingOwnerId !== ability.actorId))) {
    unsupported("延后阶段、条件命中、周期实体、召唤或显式属性取样尚未纳入本次重放");
  }
  if (event.additiveReactionFactors !== null) unsupported("同时包含附加反应伤害的传播不属于此增幅重放能力");
  const deliveries = result.reactionDamageLog.filter((row) => row.damageEventIds.includes(event.id));
  const delivery = deliveries[0];
  if (deliveries.length !== 1 || !delivery || delivery.scheduleKind !== "swirl-propagation" || !["swirlPyro", "swirlHydro", "swirlCryo", "swirlElectro"].includes(delivery.reaction) || delivery.triggerDamageEventId === null) unsupported("缺少唯一的扩散传播来源");
  const trigger = result.damageEvents[delivery.triggerDamageEventId];
  if (!trigger || trigger.id !== delivery.triggerDamageEventId || trigger.kind !== "direct" || trigger.sourceActorId !== event.sourceActorId || trigger.frame !== delivery.triggerFrame || trigger.eventPriority !== 3 || event.eventPriority !== 5) unsupported("需要普通阶段直接命中触发的扩散传播");
  if (trigger.snapshot !== "hit" || trigger.sourceSnapshotLogId !== undefined || trigger.scalingOwnerId !== trigger.sourceActorId) unsupported("需要无外部属性所有者的隐式命中时刻取样");
  const actions = result.actionLog.filter((row) => row.actionId === trigger.actionId && row.actorId === trigger.sourceActorId && row.cycle === trigger.cycle);
  const action = actions[0];
  if (actions.length !== 1 || !action || action.sourceAbilityId === undefined) unsupported("缺少唯一的实际已接受施放");
  const ability = abilities.find((row) => row.id === action.sourceAbilityId && row.actorId === action.actorId);
  const hits = ability?.hits?.filter((hit) => hit.id === trigger.hitId) ?? [];
  const hit = hits[0];
  if (hits.length !== 1 || !hit || hit.frame + action.frame !== trigger.frame || hit.element !== "anemo") unsupported("直接命中与声明的风元素命中不一致");
  const source = config.characters.find((actor) => actor.id === event.sourceActorId);
  if (!source) unsupported("缺少反应属性所属角色");

  // All accepted actions are used, including other actors' team/targeted buffs.
  // Buffs are ordinary P1 tasks: before P3 trigger/P5 propagation on the same
  // frame. Same-frame insertion follows accepted action order then buff order.
  // Replacement keys are shared across stats, matching addBuff (not additive
  // per-stat maps); an expired replacement never revives an earlier value.
  const applications: Array<{ frame: number; end: number; actionOrder: number; buffOrder: number; key: string; stat: string; value: number }> = [];
  for (const [actionOrder, accepted] of result.actionLog.entries()) {
    const owner = abilities.find((row) => row.id === accepted.sourceAbilityId && row.actorId === accepted.actorId);
    if (!owner) {
      // compileLegalTimeline emits this one empty, zero-frame activation when
      // the declared initial actor is not the first configured character. It
      // cannot apply buffs; unknown synthetic actions are not skipped.
      if (accepted.actionId === "__timeline-initial-active" && accepted.sourceAbilityId === undefined
        && accepted.timelineCommandIndex === undefined && accepted.frame === 0 && accepted.cycle === 0
        && accepted.actorId === config.timeline.initialActiveCharacterId
        && accepted.actorId !== config.characters[0]?.id) continue;
      unsupported("已接受施放缺少明确的逐帧技能声明");
    }
    for (const [buffOrder, buff] of (owner.buffs ?? []).entries()) {
      const targets = buff.target === "team" ? config.characters.map((actor) => actor.id)
        : buff.target === undefined || buff.target === "self" ? [accepted.actorId]
        : Array.isArray(buff.target) ? buff.target : [buff.target];
      if (!targets.includes(source.id)) continue;
      const frame = accepted.frame + (buff.startFrame ?? 0);
      applications.push({ frame, end: frame + buff.durationFrames, actionOrder, buffOrder,
        key: `${buff.key ?? buff.stat}:${source.id}`, stat: buff.stat, value: buff.value });
    }
  }
  applications.sort((a, b) => a.frame - b.frame || a.actionOrder - b.actionOrder || a.buffOrder - b.buffOrder);
  const statsAt = (frame: number) => {
    const latest = new Map<string, (typeof applications)[number]>();
    for (const application of applications) if (application.frame <= frame) latest.set(application.key, application);
    let em = source.stats.em;
    let reactionBonus = source.stats.reactionBonus;
    for (const application of latest.values()) if (frame < application.end) {
      if (application.stat === "em") em += application.value;
      if (application.stat === "reactionBonus") reactionBonus += application.value;
    }
    return { em, reactionBonus };
  };
  const sampled = statsAt(trigger.frame);
  const live = statsAt(event.frame);
  const localBonus = hit.reactionBonus ?? 0;
  const factors = event.transformativeReactionFactors;
  if (!factors) unsupported("缺少扩散剧变伤害输入");
  same(factors.elementalMastery, sampled.em, "triggerElementalMastery");
  same(factors.reactionBonus, Math.max(0, sampled.reactionBonus + localBonus), "triggerReactionBonus");
  const calculation = calcAmplifyingReactionMultiplier({ reaction, elementalMastery: sampled.em, reactionBonus: live.reactionBonus + localBonus });
  same(event.damageFactors.amplifyingReactionMultiplier, calculation.total, "amplifyingMultiplier");
  return { ...calculation, reaction, elementalMastery: Math.max(0, sampled.em), sourceActorId: source.id, triggerFrame: trigger.frame, landingFrame: event.frame };
}
