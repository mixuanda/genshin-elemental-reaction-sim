import type { LegalTimelineConfig, SimConfig } from "@genshin-dps-lab/schemas";
import type { AuraEngine } from "./aura";
import type { DirectDamageGroupCapturedState } from "./direct-damage-group";
import type { TargetStateTimelineRecorder } from "./target-state-timeline";

export type OrdinaryAuraCapturedState = ReturnType<AuraEngine["captureOrdinaryState"]>;
export type AuraObservationCapturedState = ReturnType<TargetStateTimelineRecorder["captureObservationState"]>;

/** Inspect the entire declared driver, including branches and dormant infusions. */
export function ordinaryReactionFeatures(config: SimConfig, timeline = config.timeline) {
  const elements = new Set<string>();
  const add = (element: string | undefined) => { if (element !== undefined && element !== "physical") elements.add(element); };
  const targets = config.enemy.targets ?? [{ initialAura: config.reactionEngine?.initialAura }];
  for (const target of targets) for (const initial of target.initialAura ?? config.reactionEngine?.initialAura ?? []) add(initial.element);
  const characters = new Map(config.characters.map(character => [character.id, character]));
  const sources = [...config.rotation, ...(timeline?.abilities ?? [])];
  for (const source of sources) for (const hit of source.hits ?? []) {
    add(hit.element ?? characters.get(hit.scalingOwnerId ?? source.actorId)?.element);
    add(hit.infusion?.element);
  }
  const enabled = config.reactionEngine !== undefined;
  return { elements, electroCharged: enabled && elements.has("hydro") && elements.has("electro"), burning: enabled && elements.has("pyro") && elements.has("dendro"), dendroCore: enabled && elements.has("hydro") && elements.has("dendro"), crystallize: enabled && elements.has("geo") && ["pyro", "hydro", "cryo", "electro"].some(element => elements.has(element)) };
}

export function ordinaryAuraDomainBlockers(config: SimConfig, timeline = config.timeline, nonPeriodicStateAvailable = false, periodicStateAvailable = false): string[] {
  if (config.reactionEngine === undefined) return [];
  const { elements } = ordinaryReactionFeatures(config, timeline);
  const sources = [...config.rotation, ...(timeline?.abilities ?? [])];
  const values = [...elements];
  const ordinary = ["pyro", "hydro", "cryo", "electro", "dendro"];
  const simpleDomain = values.every(element => ordinary.includes(element)) && (
    values.length <= 1 || values.every(element => element === "pyro" || element === "hydro") ||
    values.every(element => element === "pyro" || element === "cryo"));
  // The whole future driver must exclude reactions whose periodic sources or
  // entities the host has not yet exported; current empty Aura is insufficient.
  const hasPair = (left: string, right: string) => elements.has(left) && elements.has(right);
  const closedDomain = (periodicStateAvailable && nonPeriodicStateAvailable && values.every(element => [...ordinary, "anemo", "geo"].includes(element))) || simpleDomain || (nonPeriodicStateAvailable &&
    values.every(element => [...ordinary, "anemo"].includes(element)) &&
    !hasPair("hydro", "electro") && !hasPair("pyro", "dendro") && !hasPair("hydro", "dendro"));
  const reasons: string[] = [];
  if (!closedDomain) reasons.push(`完整未来元素输入域 ${values.sort().join("/")} 可能产生尚未导出的${nonPeriodicStateAvailable ? "感电、燃烧、草原核或结晶实体" : "感电、冻结、激化、燃烧、扩散或反应实体"}状态。`);
  if (config.reactionEngine.debugAllowReactionOverride || sources.some(source => source.hits?.some(hit => hit.reactionOverride !== undefined))) reasons.push("调试反应覆盖不属于已验证的普通附着/增幅检查点域。");
  return reasons;
}

/**
 * Normalize only at an event-before boundary. Expired direct windows are dead:
 * their next consumption resets at frame >= resetAtFrame. Reaction-owned
 * Burning has a different equality rule and retains its equality boundary.
 */
export function normalizeOrdinaryReactionCheckpoint(input: {
  tick: number;
  config: SimConfig;
  timeline?: LegalTimelineConfig;
  aura?: ReadonlyMap<string, OrdinaryAuraCapturedState>;
  observations?: AuraObservationCapturedState;
  damageGroups?: ReadonlyMap<string, DirectDamageGroupCapturedState>;
  targetPhaseV2StateAvailable?: boolean;
  nonPeriodicStateAvailable?: boolean;
  periodicStateAvailable?: boolean;
}) {
  const { tick } = input;
  const cursorBeforeBoundary = (frame: number | null, initial = -1) => {
    if (frame !== null && frame !== initial && frame >= tick) throw new Error("ICD/附着游标已执行当前检查点帧，不能标为事件前状态。");
  };
  const windows = <T extends { resetAtFrame: number; windowStartFrame: number }>(values: readonly T[]) => values
    .filter(window => window.resetAtFrame > tick)
    .map(({ resetAtFrame, windowStartFrame, ...window }) => ({ ...window, resetRemainingTicks: resetAtFrame - tick, windowAgeTicks: tick - windowStartFrame }));
  const damageGroups = input.damageGroups === undefined ? undefined : [...input.damageGroups].map(([targetId, state]) => {
    cursorBeforeBoundary(state.lastConsumedFrame);
    return { targetId, profileId: state.profileId, windows: windows(state.windows) };
  });
  const targetIds = input.config.enemy.targets?.map(target => target.id) ?? ["enemy-0"];
  if (input.damageGroups !== undefined && (input.damageGroups.size !== targetIds.length || targetIds.some(id => !input.damageGroups!.has(id)))) throw new Error("伤害组检查点缺少实际目标引擎。");
  if (input.aura === undefined) return { damageGroups };
  const reasons = ordinaryAuraDomainBlockers(input.config, input.timeline, input.nonPeriodicStateAvailable, input.periodicStateAvailable);
  if (reasons.length) throw new Error(reasons.join(" "));
  if (input.aura.size !== targetIds.length || targetIds.some(id => !input.aura!.has(id)) || input.observations === undefined || targetIds.some(id => !input.observations!.some(row => row.targetId === id))) throw new Error("附着检查点缺少实际目标引擎或自然消退观察游标。");
  const aura = [...input.aura].map(([targetId, state]) => {
    if (state.blockers.length) throw new Error(state.blockers.join(" "));
    if (state.reactableTickModel === "cached-boundary-v2" &&
        (input.config.targetTaskModel.mode !== "target-phase-v2" || !input.targetPhaseV2StateAvailable)) throw new Error("目标 Tick 缓存缺少实际 target-phase-v2 状态捕获。");
    const extended = state.nonPeriodicReactions;
    if (input.nonPeriodicStateAvailable && extended === undefined) throw new Error("非周期反应缺少实际冻结、激化与反应冷却状态。");
    // A cached boundary is consumed only at its exact frame. At a frame-before
    // checkpoint every earlier frame has drained; old boundaries are dead.
    if (state.reactableLifecycleBoundaries.some(boundary => extended === undefined || boundary.result.frame >= tick)) throw new Error("存在未完成的帧内反应生命周期缓存。");
    if (state.currentFrame > tick) throw new Error("附着物化时钟越过检查点。");
    cursorBeforeBoundary(state.latestAuraHitFrame);
    const icd = state.applicationIcd;
    if (icd.activeConsumptionEntry !== null || icd.reentrantConsumptionAttempted) throw new Error("ICD 消费尚未结束。");
    cursorBeforeBoundary(icd.lastDirectAttemptFrame);
    cursorBeforeBoundary(icd.lastReactionAttemptFrame);
    if ((extended === undefined && icd.reactionFixedWindows.length) || (!input.periodicStateAvailable && icd.reactionBurningWindow !== null)) throw new Error("反应拥有的附着 ICD 尚未纳入完整检查点。");
    // Last-attempt frames only enforce monotonic input. All future queue frames
    // are >= tick, so the verified past cursor cannot alter future execution.
    return { targetId, version: state.version, mode: state.mode,
      ...(state.reactableTickModel === "cached-boundary-v2" ? {
        reactableTickModel: state.reactableTickModel,
        reactableLifecycleBoundaries: extended === undefined ? state.reactableLifecycleBoundaries : [],
      } : {}),
      materializedAgeTicks: state.auras.length ? tick - state.currentFrame : null,
      auras: state.auras,
      ...(extended === undefined ? {} : { nonPeriodicReactions: {
        frozenDecayRate: extended.frozenDecayRate,
        reactionDamageReady: extended.reactionDamageReadyFrames.filter(([, frame]) => frame > tick).map(([reaction, frame]) => ({ reaction, remainingTicks: frame - tick })),
        swirlDamageReady: extended.swirlDamageReadyFrames.filter(([, frame]) => frame > tick).map(([reaction, frame]) => ({ reaction, remainingTicks: frame - tick })),
        shatterRemainingTicks: Math.max(0, extended.shatterDamageReadyFrame - tick),
      } }),
      applicationIcd: { profileId: icd.profileId, legacyProfiles: icd.legacyProfiles,
        reactionOwnedElementalApplicationModel: icd.reactionOwnedElementalApplicationModel,
        fixedWindows: windows(icd.fixedWindows), legacyWindows: windows(icd.legacyWindows),
        burningLegacyWindows: windows(icd.burningLegacyWindow === null ? [] : [icd.burningLegacyWindow]),
        ...(extended === undefined ? {} : { reactionFixedWindows: windows(icd.reactionFixedWindows) }),
        ...(input.periodicStateAvailable && icd.reactionBurningWindow !== null ? { reactionBurningWindows: [icd.reactionBurningWindow].filter(window => window.resetAtFrame >= tick).map(({ resetAtFrame, windowStartFrame, ...window }) => ({ ...window, resetRemainingTicks: resetAtFrame - tick, windowAgeTicks: tick - windowStartFrame })) } : {}) },
    };
  });
  const observations = input.observations!.map(({ targetId, frame, aura }) => ({
    targetId, observationAgeTicks: aura.length ? tick - frame : null,
    aura: aura.map(({ expiresAtFrame, expiresAtTargetFrame, ...entry }) => ({ ...entry,
      expiryRemainingTicks: expiresAtFrame === null ? null : expiresAtFrame - tick,
      ...(expiresAtTargetFrame === undefined ? {} : { targetExpiryRemainingTicks: expiresAtTargetFrame === null ? null : expiresAtTargetFrame - tick }) })),
  }));
  return { aura, observations, damageGroups };
}
