import type { ActionDefinition, ActiveStatusSnapshot, CharacterStats, SimulationResult, CrystallizeShieldCalculation } from "@genshin-dps-lab/schemas";
import type { DendroCoreCapturedState, DendroCoreReservation } from "./dendro-core";
import type { OrdinaryAuraCapturedState } from "./ordinary-aura-checkpoint";

interface ReactionSource {
  generation: number; actorId: string; action: ActionDefinition; triggerHitId: string; triggerHitGroupId: string;
  triggerDamageEventId: number; triggerFrame: number; stats: CharacterStats; elementalMastery: number;
  reactionBonus: number; sourceBuffStatuses: ActiveStatusSnapshot[]; snapshot: string; cycle: number;
}
interface BurningSource extends ReactionSource {
  triggerElement: "pyro" | "dendro"; fuelSourceActorId: string | null; fuelDecayPerFrame: number; fuelExpiresAtFrame: number | null;
}
interface CoreSource { reservation: DendroCoreReservation; action: ActionDefinition; triggerHitId: string; triggerHitGroupId: string; reactionBonusDelta: number; cycle: number }
interface Shard {
  id: number; reaction: string; element: string; sourceActorId: string; sourceTargetId: string; triggerDamageEventId: number;
  triggerFrame: number; spawnedAtFrame: number; earliestPickupFrame: number; expiresAtFrame: number;
  position: { x: number; y: number } | null; spawnRadius: number; spawnAngleDegrees: number; sourceCharacterLevel: number; sourceElementalMastery: number;
}
interface Shield {
  id: number; shardId: number; element: string; sourceActorId: string; pickedUpByActorId: string;
  sourceCharacterLevel: number; sourceElementalMastery: number; calculation: CrystallizeShieldCalculation;
  currentBaseHp: number; expiresAtFrame: number;
}
export interface PeriodicReactionHostState {
  periodicSources: ReadonlyMap<string, ReactionSource>;
  burningSources: ReadonlyMap<string, BurningSource>;
  periodicExpiryKeys: ReadonlySet<string>;
  burningExpiryKeys: ReadonlySet<string>;
  /** These rows are live lookup storage: EC cleanup reads their status later. */
  cleanupTasks: readonly SimulationResult["reactionTaskLog"][number][];
  periodicHistory: readonly SimulationResult["periodicReactionLog"][number][];
  dendroCore: DendroCoreCapturedState;
  dendroSources: ReadonlyMap<number, CoreSource>;
  shards: ReadonlyMap<number, Shard>;
  shield: Shield | null;
  nextShardId: number;
  nextShieldId: number;
  inlineBurningDeliveries: number;
}
interface PendingEvent { type: string; frame: number; payload: unknown }
const object = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;

/** Normalizes actual retained reaction objects and queue references, not their
 * output logs. Absolute audit IDs are removed only after the same references
 * have been resolved to a retained source, generation or entity identity. */
export function normalizePeriodicReactionHost(input: {
  state: PeriodicReactionHostState; aura: ReadonlyMap<string, OrdinaryAuraCapturedState>; tick: number;
  pendingEvents: readonly PendingEvent[];
  normalizeSource: (source: { action: ActionDefinition; cycle: number; triggerHitId: string; triggerHitGroupId: string }) => unknown;
  normalizeStatuses: (statuses: readonly ActiveStatusSnapshot[]) => unknown;
}) {
  const { state, aura, tick, pendingEvents, normalizeSource, normalizeStatuses } = input;
  if (state.inlineBurningDeliveries !== 0) throw new Error("燃烧内联交付尚未结束，不能标记完整帧前检查点。");
  const remaining = (frame: number | null) => frame === null || frame < 0 ? null : frame - tick;
  const periodic = (targetId: string) => {
    const value = aura.get(targetId)?.periodicReactions;
    if (!value) throw new Error(`目标 ${targetId} 缺少实际周期反应私有状态。`);
    return value;
  };
  const generation = (targetId: string, kind: "electroCharged" | "burning", value: number) => value - periodic(targetId)[kind].generation;
  // Only the ninth Burning callback is special. Once it has passed, the
  // absolute counter is an audit ordinal; retain relative token comparisons.
  const burningIndex = (targetId: string, value: number) => value - Math.max(0, periodic(targetId).burning.nextTickIndex - 10);
  const source = (targetId: string, kind: "electroCharged" | "burning", value: ReactionSource | BurningSource) => {
    const burning = kind === "burning" ? value as BurningSource : undefined;
    return { ...object(normalizeSource(value)), relativeGeneration: generation(targetId, kind, value.generation),
      actorId: value.actorId, triggerAgeTicks: tick - value.triggerFrame,
      stats: value.stats, elementalMastery: value.elementalMastery, reactionBonus: value.reactionBonus,
      sourceBuffStatuses: normalizeStatuses(value.sourceBuffStatuses), snapshot: value.snapshot,
      ...(burning === undefined ? {} : { triggerElement: burning.triggerElement, fuelSourceActorId: burning.fuelSourceActorId,
        fuelDecayPerFrame: burning.fuelDecayPerFrame, fuelExpiryRemainingTicks: remaining(burning.fuelExpiresAtFrame) }) };
  };
  const hasTask = (type: string, frame: number, predicate: (payload: Record<string, unknown>) => boolean) => pendingEvents.some(event => event.type === type && event.frame === frame && predicate(object(event.payload)));
  const expiryKeys = (keys: ReadonlySet<string>, kind: "electroCharged" | "burning", type: string) => [...keys].map(key => {
    const [targetId, generationText, frameText] = key.split("\u0000"), token = Number(generationText), frame = Number(frameText);
    if (targetId === undefined || frame < tick || !hasTask(type, frame, payload => payload.targetId === targetId && payload.generation === token && payload.expectedExpiryFrame === frame)) throw new Error("周期反应到期去重记录缺少实际未来任务，观察尾段不完整。");
    return { targetId, relativeGeneration: generation(targetId, kind, token), remainingTicks: frame - tick };
  }).sort((a, b) => a.remainingTicks - b.remainingTicks || a.targetId.localeCompare(b.targetId) || a.relativeGeneration - b.relativeGeneration);
  const cleanupIds = new Set<number>();
  for (const event of pendingEvents) if (event.type === "electroChargedCleanup") cleanupIds.add(object(event.payload).reactionTaskLogId as number);
  for (const engine of aura.values()) for (const cleanup of engine.periodicReactions?.electroCharged.pendingCleanups ?? []) if (cleanup.originReactionTaskId !== null) cleanupIds.add(cleanup.originReactionTaskId);
  const cleanupRows = [...cleanupIds].map(id => {
    const task = state.cleanupTasks[id], cleanup = task?.electroChargedCleanup;
    if (!task || !cleanup) throw new Error("感电清理任务缺少其实际可变存储记录。");
    return { id, task, cleanup };
  }).sort((a, b) => a.task.frame - b.task.frame || a.id - b.id);
  const cleanupIdentity = new Map(cleanupRows.map((row, index) => [row.id, index]));
  const cleanupRef = (id: number | null) => {
    if (id === null) return null;
    const identity = cleanupIdentity.get(id); if (identity === undefined) throw new Error("感电私有清理指针没有对应的实际存储对象。"); return identity;
  };
  const cadence = (value: { status: string; nextTickFrame: number | null; waneListenerActive: boolean; lastCallbackFrame: number | null }) => ({
    status: value.status, nextTickRemainingTicks: remaining(value.nextTickFrame), waneListenerActive: value.waneListenerActive,
    lastCallbackAgeTicks: value.lastCallbackFrame === null ? null : tick - value.lastCallbackFrame,
  });
  const auraStates = [...aura].map(([targetId, engine]) => {
    const value = periodic(targetId), ec = value.electroCharged, burning = value.burning;
    if (ec.cleanupResults.length) throw new Error("感电清理结果尚未被主队列接收，不能伪装完整事件边界。");
    if (burning.lastStop !== null && burning.lastStop.frame >= tick || burning.legacyPreDecayTaskFrame !== null && burning.legacyPreDecayTaskFrame >= tick) throw new Error("燃烧已执行检查点当前帧，不能标为帧前状态。");
    const referencedGenerations = new Set(ec.active ? [ec.generation] : []);
    for (const event of pendingEvents) {
      const payload = object(event.payload);
      if (payload.targetId === targetId && ["periodicReactionTick", "periodicReactionWane", "periodicReactionExpiry", "electroChargedCleanup"].includes(event.type)) referencedGenerations.add(payload.generation as number);
      if (event.type === "reactionDamage" && payload.sourceTargetId === targetId && payload.periodicContext) referencedGenerations.add(object(payload.periodicContext).generation as number);
    }
    for (const cleanup of ec.pendingCleanups) {
      referencedGenerations.add(cleanup.generation);
      if (!hasTask("electroChargedCleanup", cleanup.deadlineTargetFrame, payload => payload.targetId === targetId && payload.reactionTaskLogId === cleanup.originReactionTaskId)) throw new Error("感电清理期限缺少真实队列，观察尾段被截断。");
    }
    if (ec.active && ec.nextTickFrame >= tick && !hasTask("periodicReactionTick", ec.nextTickFrame, payload => payload.targetId === targetId && payload.generation === ec.generation) && !(engine.mode !== "aura-v9" && pendingEvents.some(event => event.type === "periodicReactionTick" && object(event.payload).targetId === targetId && object(event.payload).generation === ec.generation && object(event.payload).firstTick === true))) throw new Error("感电下一次回调未保留在真实队列中。");
    const burningActive = engine.auras.some(entry => entry.element === "burning");
    if (burningActive && burning.nextTickTargetFrame >= tick && !hasTask("burningTick", burning.nextTickTargetFrame, payload => payload.targetId === targetId && payload.generation === burning.generation && payload.tickIndex === burning.nextTickIndex)) throw new Error("燃烧下一次回调未保留在真实队列中。");
    return { targetId,
      electroCharged: { active: ec.active, cadenceStatus: ec.cadenceStatus, waneListenerActive: ec.waneListenerActive,
        nextTickRemainingTicks: remaining(ec.nextTickFrame), lastCallbackAgeTicks: ec.active && ec.lastCallbackFrame !== null ? tick - ec.lastCallbackFrame : null,
        cadenceByGeneration: ec.cadenceByGeneration.filter(row => referencedGenerations.has(row.generation)).map(row => ({ relativeGeneration: generation(targetId, "electroCharged", row.generation), ...cadence(row) })),
        endedBeforeCleanup: ec.endedBeforeCleanup !== null && ec.pendingCleanups.some(row => row.generation === ec.endedBeforeCleanup!.generation)
          ? { relativeGeneration: generation(targetId, "electroCharged", ec.endedBeforeCleanup.generation), ageTicks: tick - ec.endedBeforeCleanup.frame } : null,
        pendingCleanups: ec.pendingCleanups.map(row => ({ relativeGeneration: generation(targetId, "electroCharged", row.generation), armedAgeTicks: tick - row.armedAtFrame,
          armedTargetAgeTicks: tick - row.armedAtTargetFrame, deadlineRemainingTicks: row.deadlineTargetFrame - tick, cleanup: cleanupRef(row.originReactionTaskId) })) },
      burning: { damageSourceActorId: burning.damageSourceActorId, fuelSourceActorId: burning.fuelSourceActorId,
        fuelAttachedAgeTicks: burning.fuelAttachedFrame < 0 ? null : tick - burning.fuelAttachedFrame,
        fuelDepletedAgeTicks: burning.fuelDepletedFrame === null ? null : tick - burning.fuelDepletedFrame,
        fuelDepletedDecayPerFrame: burning.fuelDepletedDecayPerFrame, nextTickRemainingTicks: remaining(burning.nextTickTargetFrame),
        nextTickIndex: burningIndex(targetId, burning.nextTickIndex) },
      crystallizeCooldownRemainingTicks: Math.max(0, value.crystallizeReadyFrame - tick) };
  });
  const coreId = (id: number) => id - state.dendroCore.nextCoreId;
  const shardId = (id: number) => id - state.nextShardId;
  const shieldId = (id: number) => id - state.nextShieldId;
  const reservation = (value: DendroCoreReservation) => ({ relativeCoreId: coreId(value.coreId), sourceActorId: value.sourceActorId, sourceTargetId: value.sourceTargetId,
    triggerAgeTicks: tick - value.triggerFrame, bloomReactionIndex: value.bloomReactionIndex, spawnRemainingTicks: value.spawnFrame - tick });
  const coreSources = [...state.dendroSources].sort(([a], [b]) => a - b).map(([id, value]) => ({ relativeCoreId: coreId(id), reservation: reservation(value.reservation),
    source: normalizeSource(value), reactionBonusDelta: value.reactionBonusDelta }));
  for (const core of state.dendroCore.active) if (!hasTask("dendroCoreExpiry", core.expiresAtFrame, payload => payload.coreId === core.coreId && payload.expectedExpiryFrame === core.expiresAtFrame)) throw new Error("存活草原核缺少真实到期任务，观察尾段不完整。");
  for (const [, value] of state.dendroSources) if (value.reservation.spawnFrame >= tick && !hasTask("dendroCoreSpawn", value.reservation.spawnFrame, payload => object(payload.reservation).coreId === value.reservation.coreId)) throw new Error("已预留草原核缺少真实生成任务。");
  for (const shard of state.shards.values()) if (!hasTask("crystallizeShardExpiry", shard.expiresAtFrame, payload => payload.shardId === shard.id && payload.expectedExpiryFrame === shard.expiresAtFrame)) throw new Error("存活结晶晶片缺少真实到期任务，观察尾段不完整。");
  if (state.shield !== null && !hasTask("crystallizeShieldExpiry", state.shield.expiresAtFrame, payload => payload.shieldId === state.shield!.id && payload.expectedExpiryFrame === state.shield!.expiresAtFrame)) throw new Error("实际结晶护盾缺少真实到期任务。");
  const normalizeTask = (type: string, payload: Record<string, unknown>): unknown => {
    const targetId = payload.targetId as string;
    if (type === "periodicReactionTick") return { targetId, relativeGeneration: generation(targetId, "electroCharged", payload.generation as number), firstTick: payload.firstTick,
      ...(payload.pinnedSource === undefined ? {} : { pinnedSource: source(targetId, "electroCharged", payload.pinnedSource as ReactionSource) }) };
    if (type === "periodicReactionWane") return { targetId, relativeGeneration: generation(targetId, "electroCharged", payload.generation as number), sourceActorId: payload.sourceActorId, damageApplied: payload.damageApplied };
    if (type === "periodicReactionExpiry" || type === "burningFuelExpiry") return { targetId, relativeGeneration: generation(targetId, type === "periodicReactionExpiry" ? "electroCharged" : "burning", payload.generation as number), expectedExpiryRemainingTicks: Number(payload.expectedExpiryFrame) - tick };
    if (type === "burningTick") return { targetId, relativeGeneration: generation(targetId, "burning", payload.generation as number), tickIndex: burningIndex(targetId, payload.tickIndex as number) };
    if (type === "electroChargedCleanup") return { targetId, relativeGeneration: generation(targetId, "electroCharged", payload.generation as number), cleanup: cleanupRef(payload.reactionTaskLogId as number), deadlineRemainingTicks: Number(payload.deadlineTargetFrame) - tick };
    if (type === "dendroCoreSpawn") return { reservation: reservation(payload.reservation as DendroCoreReservation) };
    if (type === "dendroCoreExpiry") return { relativeCoreId: coreId(payload.coreId as number), expectedExpiryRemainingTicks: Number(payload.expectedExpiryFrame) - tick };
    if (type === "crystallizeShardExpiry") return { relativeShardId: shardId(payload.shardId as number), expectedExpiryRemainingTicks: Number(payload.expectedExpiryFrame) - tick };
    if (type === "crystallizeShieldExpiry") return { relativeShieldId: shieldId(payload.shieldId as number), expectedExpiryRemainingTicks: Number(payload.expectedExpiryFrame) - tick };
    if (type === "crystallizeShardSpawn") {
      const audit = object(payload.audit);
      return { actorId: payload.actorId, sourceTargetId: payload.sourceTargetId, triggerAgeTicks: tick - Number(payload.triggerFrame),
        reaction: audit.reaction, crystallizedElement: audit.crystallizedElement, earliestPickupRemainingTicks: Number(audit.earliestPickupFrame) - tick, shardExpiryRemainingTicks: Number(audit.shardExpiresAtFrame) - tick };
    }
    throw new Error(`未定义周期反应任务 ${type} 的归一化。`);
  };
  const normalizeDamageContexts = (payload: Record<string, unknown>) => {
    const targetId = payload.sourceTargetId as string;
    const ec = payload.periodicContext === undefined ? undefined : object(payload.periodicContext);
    const burning = payload.burningContext === undefined ? undefined : object(payload.burningContext);
    const core = payload.dendroCoreContext === undefined ? undefined : object(payload.dendroCoreContext);
    return { ...(ec === undefined ? {} : { periodicContext: { relativeGeneration: generation(targetId, "electroCharged", ec.generation as number), waneEligible: ec.waneEligible } }),
      ...(burning === undefined ? {} : { burningContext: { relativeGeneration: generation(targetId, "burning", burning.generation as number), tickIndex: burningIndex(targetId, burning.tickIndex as number) } }),
      ...(core === undefined ? {} : { dendroCoreContext: { relativeCoreId: coreId(core.coreId as number), reaction: core.reaction, reactionBonusDelta: core.reactionBonusDelta, selectionRadius: core.selectionRadius } }) };
  };
  const normalized = {
    targets: auraStates,
    sources: [...state.periodicSources].map(([targetId, value]) => ({ targetId, source: source(targetId, "electroCharged", value) })).sort((a, b) => a.targetId.localeCompare(b.targetId)),
    burningSources: [...state.burningSources].map(([targetId, value]) => ({ targetId, source: source(targetId, "burning", value) })).sort((a, b) => a.targetId.localeCompare(b.targetId)),
    periodicExpiry: expiryKeys(state.periodicExpiryKeys, "electroCharged", "periodicReactionExpiry"), burningExpiry: expiryKeys(state.burningExpiryKeys, "burning", "burningFuelExpiry"),
    cleanups: cleanupRows.map(({ task, cleanup }) => ({ targetId: task.targetId, relativeGeneration: generation(task.targetId, "electroCharged", cleanup.generation), outcome: cleanup.outcome,
      requestedAgeTicks: tick - cleanup.requestedTargetFrame, deadlineRemainingTicks: cleanup.deadlineTargetFrame - tick,
      terminal: state.periodicHistory.filter(row => row.targetId === task.targetId && row.generation === cleanup.generation && row.frame < tick && row.nextTickFrame === null && (row.operation === "wane" || row.operation === "stop")).slice(-1).map(row => ({ operation: row.operation, ageTicks: tick - row.frame, reason: row.reason, cleanupLink: row.reactionTaskLogId === undefined ? "unassigned" : row.reactionTaskLogId === task.id ? "this" : "other" })) })),
    dendroCore: { active: state.dendroCore.active.map(({ coreId: id, originDamageEventId: _origin, triggerFrame, spawnedAtFrame, expiresAtFrame, ...core }) => ({ ...core, relativeCoreId: coreId(id), triggerAgeTicks: tick - triggerFrame, spawnAgeTicks: tick - spawnedAtFrame, expiryRemainingTicks: expiresAtFrame - tick })),
      // Only a retained spawn token can query this set again; past monotonically
      // allocated IDs are never reused by reserve().
      usedPendingReservations: pendingEvents.filter(event => event.type === "dendroCoreSpawn").map(event => object(object(event.payload).reservation).coreId as number).filter(id => state.dendroCore.usedReservationIds.includes(id)).map(coreId), sources: coreSources },
    crystallize: { shards: [...state.shards.values()].sort((a, b) => a.id - b.id).map(({ id, triggerDamageEventId: _damage, triggerFrame, spawnedAtFrame, earliestPickupFrame, expiresAtFrame, ...shard }) => ({ ...shard, relativeShardId: shardId(id), triggerAgeTicks: tick - triggerFrame, spawnAgeTicks: tick - spawnedAtFrame, earliestPickupRemainingTicks: earliestPickupFrame - tick, expiryRemainingTicks: expiresAtFrame - tick })),
      shield: state.shield === null ? null : { ...state.shield, id: shieldId(state.shield.id), shardId: shardId(state.shield.shardId), expiresAtFrame: state.shield.expiresAtFrame - tick } },
  };
  return { state: normalized, normalizeTask, normalizeDamageContexts };
}
