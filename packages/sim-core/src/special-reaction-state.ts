import { STELLAR_CONDUCT_APPLICATION_MULTIPLIERS, type SpecialBranch } from "@genshin-dps-lab/reaction-formulas";

/** A bounded, opt-in reference profile. This is not a claim of live-server parity. */
export const SPECIAL_STATE_PROFILE_ID = "special-state-reference-60fps-no-hitlag-v1" as const;
export const VERDANT_DEW_RULE_ID = "verdant-dew-fixed-core-order-v2" as const;
const lunarSource = "https://keqingmains.com/misc/lunar-reactions/";
const stellarSource = "https://keqingmains.com/misc/stellar-reaction-guide/";
const lunarCode = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/";
const stellarCode = "https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/";
export const STELLAR_SWIRL_HIGH_JUMP_SOURCE_REFS = [
  stellarCode + "pkg/reactable/stellarswirl_gadget.go",
  stellarCode + "internal/template/character/stam.go",
  stellarCode + "pkg/core/player/exec.go",
  stellarCode + "pkg/core/status/status.go"
] as const;
export const SPECIAL_STATE_REGISTRY = {
  "lunar-charged": { enablers: ["ineffa", "flins", "columbina"], ordinary: "electroCharged", sourceRefs: [lunarSource, lunarCode + "pkg/reactable/lunarcharged.go"], numericReadiness: "fixed-source-provisional", lifetimeFrames: 330, initialScanFrames: 9, scanFrames: 6, targetIntervalFrames: 120 },
  "lunar-bloom": { enablers: ["lauma", "nefer", "columbina"], ordinary: "bloom", sourceRefs: [lunarSource, lunarCode + "pkg/core/player/verdantdew.go"], numericReadiness: "fixed-source-provisional", capacity: 3, accumulationFrames: 146, generationEndOffsetFrames: 149 },
  "lunar-crystallize": { enablers: ["zibai", "columbina", "linnea"], ordinary: "crystallizeHydro", sourceRefs: [lunarSource, lunarCode + "pkg/reactable/lunarcrystallize.go"], numericReadiness: "fixed-source-provisional", constructLifetimeFrames: 540, triggerCap: 6, volleyThreshold: 3, snapshotOffsets: [13, 25, 37], travelFrames: 10 },
  "stellar-conduct": { enablers: ["sandrone", "odette", "travelercryo"], ordinary: "superconduct", sourceRefs: [stellarSource, stellarCode + "pkg/reactable/stellarconduct_gadget.go"], numericReadiness: "fixed-source-provisional", fieldLifetimeFrames: 360, recordIntervalFrames: 240, recordIcdFrames: 6, buffFrames: 241, countCap: 12 },
  "stellar-swirl": { enablers: ["sandrone", "odette", "travelercryo"], ordinary: "swirlCryo", sourceRefs: [stellarSource, stellarCode + "pkg/reactable/stellarswirl.go", stellarCode + "pkg/reactable/stellarswirl_gadget.go"], numericReadiness: "guide-profile-source-conflict", lifetimeFrames: 180, upgradeTotalTriggers: 3, detonateTotalTriggers: 6, highJumpFrames: 300 },
} as const;
export type SpecialReactionName = keyof typeof SPECIAL_STATE_REGISTRY;
export type ConvertibleOrdinaryReaction = typeof SPECIAL_STATE_REGISTRY[SpecialReactionName]["ordinary"];
export type SpecialElement = "pyro" | "hydro" | "electro" | "cryo" | "anemo" | "geo" | "dendro" | "physical";
export interface SpecialPartyMember { actorId: string; characterKey: string; moonsignBenediction?: boolean; }
export interface SpecialAuraSnapshot {
  /** Actual live aura owners, after gauge decay at the requested frame. Undefined is unknown, never an empty aura. */
  hydro?: string[]; electro?: string[]; cryo?: string[];
  frozen?: boolean;
}
export interface SpecialStateContext {
  party: SpecialPartyMember[];
  profileId: typeof SPECIAL_STATE_PROFILE_ID;
  /** Explicit benchmark geometry. General movement, radius and multi-target geometry remain unsupported. */
  spatialProfile: "single-stationary-target-in-range";
  targetId: string;
  auraAt: (frame: number, targetId: string) => SpecialAuraSnapshot | undefined;
}
export interface SpecialStateBlocker { mechanic: string; field: string; reason: string; sourceRefs: string[]; }
export interface SpecialStateLog { id: number; frame: number; type: string; ruleId: string; details: Record<string, string | number | boolean | string[]>; sourceRefs: string[]; }
export interface SpecialDamageIntent {
  id: number; branch: SpecialBranch; snapshotFrame: number; deliveryFrame: number;
  targetId: string; ownerId: string; contributorIds: string[];
  contributorPolicy: "live-positive-aura" | "captured-since-last-volley" | "trigger-aura" | "captured-vortex-lifetime" | "direct-ability-owner";
  sourceEventId: string; sourceRefs: string[]; evidence: "fixed-source-provisional" | "guide-profile-source-conflict";
  element: "electro" | "geo" | "anemo" | "cryo" | "dendro";
  /** These operations must be executed by the host aura engine at delivery, not silently ignored. */
  onDelivery: Array<{ kind: "consume-aura"; element: "hydro" | "electro"; gaugeUnits: number; scope: "each-personal-aura" } | { kind: "apply-element"; element: "cryo"; gaugeUnits: 1 }>;
  blockedMechanics: SpecialStateBlocker[];
}
export interface SpecialStateTransition {
  state: SpecialReactionState; log: SpecialStateLog[]; damageIntents: SpecialDamageIntent[];
  blockedMechanics: SpecialStateBlocker[];
  conversion?: { ordinaryReaction: ConvertibleOrdinaryReaction; specialReaction?: SpecialReactionName; normalFallback: boolean; suppressOrdinaryDamage: boolean; preserveOrdinaryCore: boolean; enablerActorIds: string[] };
  nextWakeFrame?: number;
}
type PendingTask = { id: number; frame: number; kind: "cloud-scan" | "moondrift-snapshot" | "polestar-publish" | "vortex-explode" | "dew-refresh"; generation: number; ownerId?: string; contributorIds?: string[]; sourceEventId?: string; };
export interface SpecialReactionState {
  profileId: typeof SPECIAL_STATE_PROFILE_ID; frame: number; nextId: number;
  targetId?: string; lunarChargedTargetReadyAt: number; radianceSwirlExpiresAt: Record<string, number>;
  /** Source keeps the pending record in core.Flags and actor ICD in character status, beyond field destruction. */
  polestarRecorded: number; polestarActorReadyAt: Record<string, number>;
  cloud?: { expiresAt: number; generation: number; ownerId: string; sourceEventId: string };
  moondrifts?: { expiresAt: number; present: boolean; count: number; contributors: string[]; incompleteContributors: boolean; harmonyReadyAt: number; generation: number };
  polestar?: { expiresAt: number; generation: number; createdByAttackId: string; stored: number; activeCount: number; buffExpiresAt: number; actorReadyAt: Record<string, number>; attackIds: string[]; };
  vortex?: { expiresAt: number; generation: number; createdByAttackId: string; triggers: number; contributors: string[]; incompleteContributors: boolean; ownerId: string; sourceEventId: string; };
  dew: { full: number; partialFrames: number; activeFrom: number; activeUntil: number; lastProcessedFrame: number; attackIds: string[] };
  highJump?: { expiresAt: number; available: boolean };
  /** The consumed jump buff and the resulting airborne state have separate lifetimes. */
  stellarAirborne?: { actorId: string; startedAt: number; sourceEventId: string };
  tasks: PendingTask[];
}
export type SpecialStateEvent =
  | { kind: "advance"; frame: number }
  | { kind: "consume-verdant-dew"; frame: number; amount: number; actorId: string; sourceEventId: string }
  | { kind: "consume-high-jump" | "land-stellar-swirl"; frame: number; actorId: string; sourceEventId: string; scheduler?: "host-main-heap" }
  | { kind: "application"; frame: number; sourceActorId: string; sourceEventId: string; attackId: string; targetId: string; element: SpecialElement; gaugeUnits: number; actualIcdAllowed: boolean; resolutionOrigin: "aura-engine"; ordinaryReaction?: ConvertibleOrdinaryReaction; auraBefore?: SpecialAuraSnapshot };

const unique = (ids: string[]) => [...new Set(ids)].sort();
function frame(value: number): void { if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("Special state frame must be a nonnegative integer"); }
export function createSpecialReactionState(): SpecialReactionState {
  return { profileId: SPECIAL_STATE_PROFILE_ID, frame: 0, nextId: 1, tasks: [], lunarChargedTargetReadyAt: 0, radianceSwirlExpiresAt: {}, polestarRecorded: 0, polestarActorReadyAt: {}, dew: { full: 0, partialFrames: 0, activeFrom: 1, activeUntil: -1, lastProcessedFrame: 0, attackIds: [] } };
}
export function resolveMoonsignLevel(party: SpecialPartyMember[]): { level: 0 | 1 | 2; unknownActorIds: string[] } {
  const knownMoonsign: readonly string[] = unique([ ...SPECIAL_STATE_REGISTRY["lunar-charged"].enablers, ...SPECIAL_STATE_REGISTRY["lunar-bloom"].enablers, ...SPECIAL_STATE_REGISTRY["lunar-crystallize"].enablers ]);
  const members = party.filter(member => member.moonsignBenediction === true || knownMoonsign.includes(member.characterKey));
  return { level: Math.min(2, members.length) as 0 | 1 | 2, unknownActorIds: party.filter(member => member.moonsignBenediction === undefined && !knownMoonsign.includes(member.characterKey)).map(member => member.actorId) };
}
export function resolveSpecialConversion(party: SpecialPartyMember[], ordinaryReaction: ConvertibleOrdinaryReaction): NonNullable<SpecialStateTransition["conversion"]> {
  const specialReaction = (Object.keys(SPECIAL_STATE_REGISTRY) as SpecialReactionName[]).find(name => SPECIAL_STATE_REGISTRY[name].ordinary === ordinaryReaction)!;
  const enablers: readonly string[] = SPECIAL_STATE_REGISTRY[specialReaction].enablers;
  const enablerActorIds = party.filter(member => enablers.includes(member.characterKey)).map(member => member.actorId);
  return { ordinaryReaction, ...(enablerActorIds.length ? { specialReaction } : {}), normalFallback: !enablerActorIds.length, suppressOrdinaryDamage: enablerActorIds.length > 0 && specialReaction !== "lunar-bloom", preserveOrdinaryCore: specialReaction === "lunar-bloom", enablerActorIds };
}

/**
 * Host must call at every nextWakeFrame, or provide an auraAt resolver valid for
 * every intervening frame. Inputs are successful engine applications, not UI reaction labels.
 * At equal frames, queued state tasks precede the next application. That ordering
 * is this explicit simulation profile, not a universal claim about game ordering.
 */
export function transitionSpecialState(previous: SpecialReactionState, event: SpecialStateEvent, context: SpecialStateContext): SpecialStateTransition {
  frame(event.frame);
  if (event.frame < previous.frame) throw new RangeError("Special state cannot run backwards");
  if (context.profileId !== SPECIAL_STATE_PROFILE_ID || previous.profileId !== context.profileId) throw new Error("Unsupported special state profile");
  if (previous.targetId !== undefined && previous.targetId !== context.targetId) throw new Error("Special state target scope cannot change");
  if (context.party.length < 1 || context.party.length > 4 || unique(context.party.map(p => p.actorId)).length !== context.party.length) throw new Error("Special state requires one to four unique party actors");
  const state = structuredClone(previous);
  state.targetId = context.targetId;
  const out: SpecialStateTransition = { state, log: [], damageIntents: [], blockedMechanics: [] };
  const log = (at: number, type: string, name: SpecialReactionName, details: SpecialStateLog["details"]) => out.log.push({ id: state.nextId++, frame: at, type, ruleId: name === "lunar-bloom" ? VERDANT_DEW_RULE_ID : `${SPECIAL_STATE_PROFILE_ID}:${name}`, details, sourceRefs: type === "high-jump-use" || type === "high-jump-land" ? [...STELLAR_SWIRL_HIGH_JUMP_SOURCE_REFS] : [...SPECIAL_STATE_REGISTRY[name].sourceRefs] });
  const block = (name: SpecialReactionName, field: string, reason: string): SpecialStateBlocker => {
    const b = { mechanic: name, field, reason, sourceRefs: [...SPECIAL_STATE_REGISTRY[name].sourceRefs] };
    if (!out.blockedMechanics.some(other => other.mechanic === name && other.field === field)) out.blockedMechanics.push(b);
    return b;
  };
  const schedule = (task: Omit<PendingTask, "id">) => state.tasks.push({ ...task, id: state.nextId++ });
  const contributors = (name: SpecialReactionName, aura: SpecialAuraSnapshot | undefined, elements: Array<"hydro" | "electro" | "cryo">, extras: string[] = []): { ids: string[]; blockers: SpecialStateBlocker[] } => {
    if (!aura || elements.some(element => aura[element] === undefined)) return { ids: unique(extras), blockers: [block(name, "contributorAuraOwnership", "缺少该取样时刻的逐角色有效元素量所有权；不能用最近触发者替代全部贡献者。")] };
    const ids = unique([...extras, ...elements.flatMap(element => aura[element]!)]);
    const unknown = ids.filter(id => !context.party.some(member => member.actorId === id));
    return { ids, blockers: unknown.length ? [block(name, "contributorIdentity", `元素所有者未映射到队伍：${unknown.join("、")}`)] : [] };
  };
  const damage = (name: SpecialReactionName, branch: SpecialBranch, at: number, delivery: number, ownerId: string, sourceEventId: string, ids: string[], policy: SpecialDamageIntent["contributorPolicy"], element: SpecialDamageIntent["element"], blockers: SpecialStateBlocker[], onDelivery: SpecialDamageIntent["onDelivery"] = []) => {
    out.damageIntents.push({ id: state.nextId++, branch, snapshotFrame: at, deliveryFrame: delivery, targetId: context.targetId, ownerId, sourceEventId, contributorIds: [...ids], contributorPolicy: policy, sourceRefs: [...SPECIAL_STATE_REGISTRY[name].sourceRefs], evidence: name === "stellar-swirl" ? "guide-profile-source-conflict" : "fixed-source-provisional", element, onDelivery, blockedMechanics: blockers });
    log(at, "damage-intent", name, { branch, deliveryFrame: delivery, contributorIds: ids, ownerId, blocked: blockers.length > 0 });
  };
  const processDew = (end: number) => {
    const start = Math.max(state.dew.lastProcessedFrame + 1, state.dew.activeFrom);
    const last = Math.min(end, state.dew.activeUntil);
    if (start <= last && state.dew.full < 3) {
      const available = last - start + 1;
      const untilCap = (3 - state.dew.full) * 146 - state.dew.partialFrames;
      const ticks = Math.min(available, untilCap);
      const beforePartial = state.dew.partialFrames;
      const beforeFull = state.dew.full;
      const total = beforePartial + ticks;
      const gained = Math.floor(total / 146);
      state.dew.full += gained; state.dew.partialFrames = total % 146;
      for (let i = 0; i < gained; i++) log(start + (146 - beforePartial) - 1 + i * 146, "resource-gain", "lunar-bloom", { gained: 1, total: beforeFull + i + 1, partialFrames: 0 });
    }
    state.dew.lastProcessedFrame = end;
  };
  const publishPolestar = (at: number) => {
    const field = state.polestar!;
    field.activeCount = state.polestarRecorded; state.polestarRecorded = 0; field.stored = 0; field.buffExpiresAt = at + 241; field.attackIds = [];
    log(at, "field-buffs", "stellar-conduct", { applicationCount: field.activeCount, cryoAndElectroBonus: [0.2, 0.29, 0.3, 0.31, 0.32, 0.33, 0.34, 0.35, 0.36, 0.37, 0.38, 0.39, 0.4][field.activeCount]!, physicalResistanceReduction: 0.4, specialCoefficient: STELLAR_CONDUCT_APPLICATION_MULTIPLIERS[field.activeCount]!, expiresAt: field.buffExpiresAt });
  };
  const explode = (at: number) => {
    const vortex = state.vortex!;
    const branch = vortex.triggers >= 3 ? "stellar-swirl-vortex-2" : "stellar-swirl-vortex-1";
    const blockers: SpecialStateBlocker[] = [];
    if (!vortex.contributors.length || vortex.incompleteContributors) blockers.push(block("stellar-swirl", "contributorAuraOwnership", "漩涡生命周期内至少一次触发缺少完整贡献者依据，禁止把不完整集合用于伤害。"));
    damage("stellar-swirl", branch, at, at, vortex.ownerId, vortex.sourceEventId, vortex.contributors, "captured-vortex-lifetime", "cryo", blockers, [{ kind: "apply-element", element: "cryo", gaugeUnits: 1 }]);
    state.highJump = { expiresAt: at + 300, available: true };
    log(at, "entity-explode", "stellar-swirl", { level: vortex.triggers >= 3 ? 2 : 1, triggerCount: vortex.triggers, highJumpExpiresAt: at + 300 });
    delete state.vortex;
  };
  // A main-heap action must not run a same-frame explosion which is still
  // queued at a later priority. Standalone transitions retain their old drain.
  const hostAction = (event.kind === "consume-high-jump" || event.kind === "land-stellar-swirl") && event.scheduler === "host-main-heap";
  while (!hostAction) {
    state.tasks.sort((a, b) => a.frame - b.frame || a.id - b.id);
    const task = state.tasks[0];
    if (!task || task.frame > event.frame) break;
    state.tasks.shift(); processDew(task.frame);
    if (task.kind === "dew-refresh") {
      // processDew(task.frame) above used the old expiry, exactly as the
      // Player tick that precedes this global task. New ticking starts next frame.
      state.dew.activeFrom = state.dew.activeUntil >= task.frame ? state.dew.activeFrom : task.frame + 1;
      state.dew.activeUntil = task.frame - 1 + 149;
      log(task.frame, "resource-generation-refresh", "lunar-bloom", { activeFrom: state.dew.activeFrom, activeUntil: state.dew.activeUntil, full: state.dew.full, partialFrames: state.dew.partialFrames });
    } else if (task.kind === "cloud-scan") {
      const cloud = state.cloud;
      if (!cloud || cloud.generation !== task.generation || cloud.expiresAt <= task.frame) continue;
      const aura = context.auraAt(task.frame, context.targetId);
      if (!aura || aura.hydro === undefined || aura.electro === undefined) block("lunar-charged", "liveAura", "雷云扫描需要当前水、雷元素量及所有权，缺少时不生成伤害。");
      else if (aura.hydro.length && aura.electro.length && !aura.frozen && state.lunarChargedTargetReadyAt <= task.frame) {
        const selected = contributors("lunar-charged", aura, ["hydro", "electro"]);
        damage("lunar-charged", "lunar-charged-reaction", task.frame, task.frame, cloud.ownerId, cloud.sourceEventId, selected.ids, "live-positive-aura", "electro", selected.blockers, [{ kind: "consume-aura", element: "hydro", gaugeUnits: 0.4, scope: "each-personal-aura" }, { kind: "consume-aura", element: "electro", gaugeUnits: 0.4, scope: "each-personal-aura" }]);
        state.lunarChargedTargetReadyAt = task.frame + 120;
      }
      schedule({ frame: task.frame + 6, kind: "cloud-scan", generation: cloud.generation });
    } else if (task.kind === "moondrift-snapshot") {
      damage("lunar-crystallize", "lunar-crystallize-reaction", task.frame, task.frame + 10, task.ownerId!, task.sourceEventId!, task.contributorIds!, "captured-since-last-volley", "geo", []);
    } else if (task.kind === "polestar-publish") {
      if (!state.polestar || state.polestar.generation !== task.generation || state.polestar.expiresAt <= task.frame) continue;
      publishPolestar(task.frame); schedule({ frame: task.frame + 240, kind: "polestar-publish", generation: task.generation });
    } else if (state.vortex?.generation === task.generation) explode(task.frame);
  }
  processDew(event.frame);
  if (state.cloud && state.cloud.expiresAt <= event.frame) { log(state.cloud.expiresAt, "entity-expire", "lunar-charged", {}); delete state.cloud; }
  if (state.moondrifts?.present && state.moondrifts.expiresAt <= event.frame) { log(state.moondrifts.expiresAt, "entity-expire", "lunar-crystallize", {}); state.moondrifts.present = false; }
  if (state.highJump && state.highJump.expiresAt <= event.frame) delete state.highJump;
  state.frame = event.frame;
  if (event.kind === "consume-verdant-dew") {
    if (!Number.isInteger(event.amount) || event.amount < 0) throw new RangeError("Resource consumption must be nonnegative integer");
    const consumed = Math.min(event.amount, state.dew.full); state.dew.full -= consumed;
    log(event.frame, "resource-spend", "lunar-bloom", { actorId: event.actorId, requested: event.amount, consumed, remaining: state.dew.full });
  } else if (event.kind === "consume-high-jump") {
    if (!context.party.some(member => member.actorId === event.actorId)) throw new Error("Jump actor is not in party");
    const allowed = state.highJump?.available === true && state.stellarAirborne === undefined;
    if (allowed) {
      delete state.highJump;
      state.stellarAirborne = { actorId: event.actorId, startedAt: event.frame, sourceEventId: event.sourceEventId };
    }
    log(event.frame, "high-jump-use", "stellar-swirl", { actorId: event.actorId, sourceEventId: event.sourceEventId, allowed, consumptionAction: "jump", airborne: state.stellarAirborne !== undefined });
  } else if (event.kind === "land-stellar-swirl") {
    const allowed = state.stellarAirborne?.actorId === event.actorId;
    if (allowed) delete state.stellarAirborne;
    log(event.frame, "high-jump-land", "stellar-swirl", { actorId: event.actorId, sourceEventId: event.sourceEventId, allowed, consumptionAction: "plunge", airborne: state.stellarAirborne !== undefined });
  } else if (event.kind === "application") {
    if (!context.party.some(member => member.actorId === event.sourceActorId)) throw new Error("Application actor is not in party");
    if (event.targetId !== context.targetId) {
      block("stellar-swirl", "spatialProfile", "本参考实现限定单个静止范围内目标；跨目标、移动与范围竞争未实现。" );
    } else if (event.actualIcdAllowed && event.gaugeUnits > 0) {
      const field = state.polestar;
      if (field && field.expiresAt > event.frame && (event.element === "cryo" || event.element === "electro") && event.attackId !== field.createdByAttackId && !field.attackIds.includes(event.attackId) && (state.polestarActorReadyAt[event.sourceActorId] ?? 0) <= event.frame) {
        state.polestarRecorded = Math.min(12, state.polestarRecorded + 1); field.stored = state.polestarRecorded; state.polestarActorReadyAt[event.sourceActorId] = event.frame + 6; field.actorReadyAt[event.sourceActorId] = event.frame + 6; field.attackIds.push(event.attackId);
        log(event.frame, "field-record", "stellar-conduct", { stored: field.stored, actorId: event.sourceActorId, attackId: event.attackId });
      }
      if (event.ordinaryReaction) {
        const conversion = resolveSpecialConversion(context.party, event.ordinaryReaction); out.conversion = conversion;
        const name = conversion.specialReaction;
        if (name) {
          log(event.frame, "conversion", name, { original: event.ordinaryReaction, enablerActorIds: conversion.enablerActorIds, attackId: event.attackId });
          if (name === "lunar-charged") {
            if (event.auraBefore?.frozen) block(name, "frozenInteraction", "冻结存在时不能建立本配置月感电；需要先由 Aura 引擎解决优先级。");
            else if (state.cloud) { state.cloud.expiresAt = event.frame + 330; state.cloud.ownerId = event.sourceActorId; state.cloud.sourceEventId = event.sourceEventId; }
            else { const generation = state.nextId++; state.cloud = { expiresAt: event.frame + 330, generation, ownerId: event.sourceActorId, sourceEventId: event.sourceEventId }; schedule({ kind: "cloud-scan", frame: event.frame + 9, generation }); log(event.frame, "entity-create", name, { expiresAt: event.frame + 330 }); }
          } else if (name === "lunar-bloom") {
            if (!state.dew.attackIds.includes(event.attackId)) {
              state.dew.attackIds.push(event.attackId);
              schedule({ kind: "dew-refresh", frame: event.frame + 1, generation: 0, sourceEventId: event.sourceEventId });
              log(event.frame, "resource-generation-queued", name, { assignmentFrame: event.frame + 1, activeUntil: event.frame + 149 });
            }
            log(event.frame, "ordinary-core-preserved", name, { immediateSpecialDamage: false });
          } else if (name === "lunar-crystallize") {
            const selected = contributors(name, event.auraBefore, ["hydro"], [event.sourceActorId]);
            const existed = state.moondrifts?.present === true;
            state.moondrifts ??= { expiresAt: event.frame + 540, present: true, count: 0, contributors: [], incompleteContributors: false, harmonyReadyAt: 0, generation: state.nextId++ };
            const drifts = state.moondrifts; drifts.count = Math.min(6, drifts.count + 1); drifts.contributors = unique([...drifts.contributors, ...selected.ids]); drifts.incompleteContributors ||= selected.blockers.length > 0;
            if (!existed) { drifts.present = true; drifts.expiresAt = event.frame + 540; log(event.frame, "entity-create", name, { constructCount: 3, expiresAt: drifts.expiresAt }); }
            else if (drifts.count >= 3 && drifts.harmonyReadyAt <= event.frame) {
              drifts.count -= 3; drifts.harmonyReadyAt = event.frame + 37; drifts.expiresAt = event.frame + 540;
              if (!drifts.incompleteContributors) for (const offset of [13, 25, 37]) schedule({ kind: "moondrift-snapshot", frame: event.frame + offset, generation: drifts.generation, ownerId: event.sourceActorId, contributorIds: [...drifts.contributors], sourceEventId: event.sourceEventId });
              else block(name, "contributorAuraOwnership", "本轮累计中有未解析的水附着所有权；禁止以随后完整事件掩盖早先缺失。" );
              drifts.contributors = []; drifts.incompleteContributors = false; log(event.frame, "harmony-trigger", name, { remainingCount: drifts.count, expiresAt: drifts.expiresAt });
            }
          } else if (name === "stellar-conduct") {
            if (state.polestar && state.polestar.expiresAt > event.frame) state.polestar.expiresAt = event.frame + 360;
            else { const generation = state.nextId++; state.polestar = { expiresAt: event.frame + 360, generation, createdByAttackId: event.attackId, stored: state.polestarRecorded, activeCount: 0, buffExpiresAt: event.frame + 241, actorReadyAt: { ...state.polestarActorReadyAt }, attackIds: [] }; publishPolestar(event.frame); schedule({ kind: "polestar-publish", frame: event.frame + 240, generation }); log(event.frame, "entity-create", name, { expiresAt: event.frame + 360, initialAttackExcluded: true }); }
          } else {
            const selected = contributors(name, event.auraBefore, ["cryo"], [event.sourceActorId]);
            if (event.auraBefore?.frozen) selected.blockers.push(block(name, "frozenContributorOverlap", "来源对冻结与冰附着同时存在的贡献资格尚有 TODO，不能推定。"));
            damage(name, "stellar-swirl-anemo-reaction", event.frame, event.frame + 3, event.sourceActorId, event.sourceEventId, selected.ids, "trigger-aura", "anemo", selected.blockers);
            for (const member of context.party) if ((SPECIAL_STATE_REGISTRY["stellar-swirl"].enablers as readonly string[]).includes(member.characterKey)) state.radianceSwirlExpiresAt[member.actorId] = event.frame + 480;
            if (!state.vortex) { const generation = state.nextId++; state.vortex = { expiresAt: event.frame + 180, generation, createdByAttackId: event.attackId, triggers: 1, contributors: [...selected.ids], incompleteContributors: selected.blockers.length > 0, ownerId: event.sourceActorId, sourceEventId: event.sourceEventId }; schedule({ kind: "vortex-explode", frame: event.frame + 180, generation }); log(event.frame, "entity-create", name, { level: 1, expiresAt: event.frame + 180 }); }
            else {
              state.vortex.contributors = unique([...state.vortex.contributors, ...selected.ids]); state.vortex.ownerId = event.sourceActorId; state.vortex.sourceEventId = event.sourceEventId;
              state.vortex.incompleteContributors ||= selected.blockers.length > 0;
              if (event.attackId !== state.vortex.createdByAttackId) state.vortex.triggers = Math.min(6, state.vortex.triggers + 1);
              log(event.frame, "vortex-trigger", name, { triggers: state.vortex.triggers, level: state.vortex.triggers >= 3 ? 2 : 1 });
              if (state.vortex.triggers >= 6) explode(event.frame);
            }
          }
        }
      }
    }
  }
  // Field physical presence and its last-issued buffs are separate lifetimes.
  if (state.polestar && state.polestar.expiresAt <= event.frame && state.polestar.buffExpiresAt <= event.frame) delete state.polestar;
  const wake = state.tasks.map(task => task.frame).filter(at => hostAction ? at >= event.frame : at > event.frame);
  if (state.dew.full < 3 && state.dew.activeUntil > event.frame) wake.push(Math.min(state.dew.activeUntil, Math.max(event.frame + 1, state.dew.activeFrom) + 145 - state.dew.partialFrames));
  for (const expiry of [state.cloud?.expiresAt, state.moondrifts?.expiresAt, state.polestar?.expiresAt, state.polestar?.buffExpiresAt, state.highJump?.expiresAt]) if (expiry !== undefined && expiry > event.frame) wake.push(expiry);
  if (wake.length) out.nextWakeFrame = Math.min(...wake);
  return out;
}

export function resolveSpecialRadiance(state: SpecialReactionState, frameNumber: number, eligible: { stellarConduct: boolean; stellarSwirl: boolean }, stellarSwirlExpiresAt?: number): "stellar-conduct" | "stellar-swirl" | "none" {
  if (eligible.stellarConduct && state.polestar && state.polestar.expiresAt > frameNumber) return "stellar-conduct";
  if (eligible.stellarSwirl && stellarSwirlExpiresAt !== undefined && stellarSwirlExpiresAt > frameNumber) return "stellar-swirl";
  return "none";
}

/** Only the explicitly sourced passive holders receive an automatic Radiance state. */
export function resolveActorSpecialRadiance(state: SpecialReactionState, party: SpecialPartyMember[], actorId: string, frameNumber = state.frame): "stellar-conduct" | "stellar-swirl" | "none" {
  const member = party.find(candidate => candidate.actorId === actorId);
  const eligible = member !== undefined && (SPECIAL_STATE_REGISTRY["stellar-swirl"].enablers as readonly string[]).includes(member.characterKey);
  return resolveSpecialRadiance(state, frameNumber, { stellarConduct: eligible, stellarSwirl: eligible }, state.radianceSwirlExpiresAt[actorId]);
}
