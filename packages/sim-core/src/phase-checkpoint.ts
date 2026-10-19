import { weaponHitStackCapturedStateSchema, weaponHitStackEventSchema, getWeaponHitStackRule, WEAPON_HIT_STACK_PROFILE_ID, type WeaponHitStackCapturedState } from "./weapon-hit-stack-model";
import type {
  ActionDefinition,
  ActiveStatusSnapshot,
  ActionConditionLogEntry,
  ActionLogEntry,
  ActorPoseDefinition,
  CharacterStats,
  LegalTimelineConfig,
  ParticleEventLog,
  PlayerShieldState,
  SimConfig,
  SourceSnapshotLogEntry,
  StatConversionLogEntry,
  SummonDefinition,
  TimelineExecution,
} from "@genshin-dps-lab/schemas";
import { ARTIFACT_EVENT_SOURCE_PROFILE, artifactBuffCapturedStateSchema, artifactBuffDelayedApplicationSchema, getRuntimeSkillCooldownActors } from "@genshin-dps-lab/schemas";
import { ARTIFACT_BUFF_SOURCE, serialSkillCooldownWorker, type ArtifactBuffCapturedState, type ArtifactBuffEffectId, type SerialSkillCooldownState } from "@genshin-dps-lab/reaction-formulas";
import { actionPendingHorizonTicks } from "./action-pending-horizon";
import type { LivePeriodicEntity, PeriodicEntityCheckpointState } from "./periodic-entity";
import type { StaminaCheckpointSnapshot } from "./stamina";
import type { PhaseCheckpoint } from "./simulation-analysis";
import type { DirectDamageGroupCapturedState } from "./direct-damage-group";
import { normalizeOrdinaryReactionCheckpoint, ordinaryAuraDomainBlockers, ordinaryReactionFeatures, type OrdinaryAuraCapturedState, type AuraObservationCapturedState } from "./ordinary-aura-checkpoint";
import { normalizeTargetPhaseV2Checkpoint, type TargetPhaseV2CheckpointState } from "./target-phase-checkpoint";
import type { PendingWeaponProcContext, WeaponProcCheckpointState } from "./weapon-proc";
import { hasRandomWeaponProc } from "./weapon-proc";
import type { ThrillingTalesCapturedState } from "./thrilling-tales";
import type { ArtifactEventCapturedState, NightsoulBurstCapturedState } from "./artifact-runtime";
import type { SourceNormalChainState } from "../../schemas/src/source-normal-chain";
import { sourceNormalChainDefinitions } from "./source-normal-chain";
import type { ArtifactDamageCapturedState } from "./artifact-damage-runtime";
import { normalizeRandomCheckpoint, type RandomExecutionCapturedState } from "./random-checkpoint";
import { normalizeNonPeriodicReactionHost, normalizeReactionResetTask, reactionLifecycleGeneration, type NonPeriodicReactionHostState } from "./nonperiodic-reaction-checkpoint";
import type { ReactionDamageGroupResetTask } from "./reaction-damage-group";
import { normalizePeriodicReactionHost, type PeriodicReactionHostState } from "./periodic-reaction-checkpoint";

/** This producer deliberately covers only state it can actually serialize. */
export const PHASE_CHECKPOINT_PRODUCER = "nonreactive-phase-state-v2";

export interface PhaseCheckpointCapabilities {
  auraEnginePresent?: boolean;
  targetClockPresent?: boolean;
  pluginsPresent?: boolean;
  privateReactionOrEntityStatePresent?: boolean;
  privateTriggerStatePresent?: boolean;
  delayedEnergyStateAvailable?: boolean;
  timedSummonStateAvailable?: boolean;
  statConversionStateAvailable?: boolean;
  staminaStateAvailable?: boolean;
  healthActionStateAvailable?: boolean;
  periodicEntityStateAvailable?: boolean;
  actionConditionStateAvailable?: boolean;
  ordinaryAuraStateAvailable?: boolean;
  nonPeriodicReactionStateAvailable?: boolean;
  periodicReactionStateAvailable?: boolean;
  sourceNormalChainStateAvailable?: boolean;
  directDamageGroupStateAvailable?: boolean;
  targetPhaseV2StateAvailable?: boolean;
  weaponProcStateAvailable?: boolean;
  thrillingTalesStateAvailable?: boolean;
  skillCooldownStateAvailable?: boolean;
  artifactEventStateAvailable?: boolean;
  artifactDamageStateAvailable?: boolean;
  weaponHitStackStateAvailable?: boolean;
  artifactBuffStateAvailable?: boolean;
  playerShieldStateAvailable?: boolean;
  nightsoulBurstStateAvailable?: boolean;
  randomState?: RandomExecutionCapturedState;
}

/** Presence checks are intentionally different from empty-state placeholders. */
export function phaseCheckpointBlockers(
  config: SimConfig,
  capabilities: PhaseCheckpointCapabilities = {},
): string[] {
  const reasons: string[] = [];
  if (sourceNormalChainDefinitions(config.sourceAbilityBindings).length && !capabilities.sourceNormalChainStateAvailable) reasons.push("来源普攻连段缺少真实下一段计数和换人重置任务捕获。");
  if (config.playerShieldModel !== undefined && !capabilities.playerShieldStateAvailable) reasons.push("玩家护盾、强效修饰及待执行声明缺少实际捕获。");
  if (config.enemyShieldModel !== undefined) reasons.push("敌盾的真实生成／移除阶段与有限盾量状态尚未纳入可续周期检查点；不能据此认定稳态。");
  if (config.targetHealthModel !== undefined) reasons.push("声明敌人生命、死亡与一次性掉落的完整状态尚未纳入周期检查点；不能将耗尽敌人的有限战斗认定为可重复稳态。");
  if ((config.reactionEngine !== undefined || capabilities.auraEnginePresent) && !capabilities.ordinaryAuraStateAvailable) {
    reasons.push("附着引擎含未导出的生命周期、反应和 ICD 私有状态。");
  }
  if (capabilities.ordinaryAuraStateAvailable) reasons.push(...ordinaryAuraDomainBlockers(config, config.timeline, capabilities.nonPeriodicReactionStateAvailable, capabilities.periodicReactionStateAvailable));
  const reactionFeatures = ordinaryReactionFeatures(config);
  if (capabilities.periodicReactionStateAvailable && reactionFeatures.dendroCore && capabilities.randomState?.dendroCorePosition === undefined) reasons.push("草原核位置具名随机流缺少真实捕获。");
  if (capabilities.periodicReactionStateAvailable && reactionFeatures.crystallize && capabilities.randomState?.crystallizePosition === undefined) reasons.push("结晶位置具名随机流缺少真实捕获。");
  if (config.targetClockModel.mode !== "disabled" || capabilities.targetClockPresent ||
      (config.targetTaskModel.mode !== "legacy-event-heap-v1" &&
        !(config.targetTaskModel.mode === "target-phase-v2" && capabilities.targetPhaseV2StateAvailable))) {
    reasons.push("目标时钟或目标阶段调度的私有状态尚未完整导出。");
  }
  if (capabilities.pluginsPresent) reasons.push("插件可持有未导出的私有状态，不能验证周期稳态。");
  if (capabilities.privateReactionOrEntityStatePresent) reasons.push("存在未导出的反应、草原核或结晶实体状态。");
  if (capabilities.privateTriggerStatePresent) reasons.push("存在未导出的触发历史或伤害组状态。");
  if (config.enemy.targetMotions?.length || config.enemy.targetPhases?.length) {
    reasons.push("目标移动或阶段输入尚未转换为可验证的周期状态。");
  }
  if (config.normalHitEnergyModel !== undefined && capabilities.randomState?.normalHitEnergy === undefined) {
    reasons.push("随机普攻回能的概率、共享间隔与随机数状态尚未纳入完整周期检查点。");
  }
  if (config.favoniusModel !== undefined && capabilities.randomState?.favonius === undefined) reasons.push("西风武器随机数流及角色触发冷却缺少实际捕获。");
  if (config.sacrificialModel !== undefined && capabilities.randomState?.sacrificial === undefined) reasons.push("祭礼独立随机流及冷却缺少实际捕获。");
  if (getRuntimeSkillCooldownActors(config).size > 0 && !capabilities.skillCooldownStateAvailable) reasons.push("技能共享串行充能缺少真实充能队列和待执行冷却任务，不能据此证明稳态。");
  if (config.weaponProcModel !== undefined && !capabilities.weaponProcStateAvailable) reasons.push("独立武器追击缺少真实角色冷却与待执行快照捕获，不能据此证明稳态。");
  if (config.weaponProcModel?.actors.some(actor => actor.weaponId === "eyeofperception")) reasons.push("昭心弹射目标标记、完整法球快照与待续跳链尚未纳入周期检查点，不能据此证明稳态。");
  if (hasRandomWeaponProc(config.weaponProcModel) && capabilities.randomState?.weaponProc === undefined) reasons.push("随机武器追击缺少实际独立随机流状态。");
  if (config.thrillingTalesModel !== undefined && !capabilities.thrillingTalesStateAvailable) reasons.push("讨龙切人冷却与接收者真实属性状态存在性尚未导出，不能据此证明稳态。");
  if (config.artifactEventModel !== undefined && !capabilities.artifactEventStateAvailable) reasons.push("圣遗物事件的真实冷却、流放者接收者状态及待执行回能任务尚未完整捕获，不能据此证明稳态。");
  if (config.artifactDamageModel !== undefined && !capabilities.artifactDamageStateAvailable) reasons.push("余响与昔时之歌的实际概率、伤害窗口、共享治疗池、浪潮次数和转换任务尚未完整捕获，不能据此证明稳态。");
  if (config.weaponHitStackModel !== undefined && !capabilities.weaponHitStackStateAvailable) reasons.push("武器命中叠层的实际私有层数、到期读取状态与冷却尚未完整捕获。");
  if (config.artifactBuffModel !== undefined && !capabilities.artifactBuffStateAvailable) reasons.push("圣遗物增益的真实层数、到期读取状态、冷却与延迟应用任务尚未完整捕获，不能据此证明稳态。");
  if (config.artifactDamageModel?.actors.some(actor => actor.effectId === "echoes-4pc") && capabilities.randomState?.artifactDamage === undefined) reasons.push("余响缺少实际具名随机流状态，不能用触发次数或平均概率代替。");
  if (config.nightsoulBurstModel !== undefined && !capabilities.nightsoulBurstStateAvailable) reasons.push("夜魂迸发的全队共享冷却与待执行伤害回调尚未完整捕获，不能据此证明稳态。");
  if (config.staminaModel !== undefined && !capabilities.staminaStateAvailable) reasons.push("共享体力、恢复冷却与待扣除任务尚未纳入完整周期检查点，不能据此证明稳态。");
  const sources = [...config.rotation, ...(config.timeline?.abilities ?? [])];
  if (!capabilities.actionConditionStateAvailable && sources.some(source => source.actionPhase !== undefined || source.conditionalHitGroups?.length)) reasons.push("来源动作相位及已锁定生命条件命中组尚未完整导出到检查点，不能据此证明稳态。");
  if (!capabilities.periodicEntityStateAvailable && sources.some(source => source.periodicEntities?.length)) reasons.push("周期实体代次、治疗状态和后续任务尚未完整导出到检查点，不能据此证明稳态。");
  if (capabilities.randomState?.particleTrigger === undefined && sources.some(source => source.particles?.some(particle => particle.trigger?.probability !== undefined))) reasons.push("命中产球概率的随机子流缺少实际捕获。");
  if (!capabilities.healthActionStateAvailable && sources.some(source => source.healthChanges?.length)) reasons.push("动作治疗和生命消耗缺少完整已接受动作及待执行队列，不能据此证明稳态。");
  if (!capabilities.delayedEnergyStateAvailable && sources.some((source) => source.energyCostFrame !== undefined && source.energyCostFrame > 0)) {
    reasons.push("配置含延迟扣能，能量预留及待扣除状态尚未完整导出到周期检查点。");
  }
  if (!capabilities.timedSummonStateAvailable && sources.some((source) => source.summons !== undefined && source.summons.length > 0)) {
    reasons.push("配置含召唤实体，其生命周期、快照及待执行任务尚未完整导出到周期检查点。");
  }
  if (!capabilities.statConversionStateAvailable && sources.some((source) => source.statConversions !== undefined && source.statConversions.length > 0)) {
    reasons.push("配置含属性转换，其快照与转换状态尚未完整导出到周期检查点。");
  }
  if (!capabilities.directDamageGroupStateAvailable && sources.some((source) => source.hits?.some((hit) => hit.directDamageGroup !== undefined))) {
    reasons.push("直接伤害组计数器尚未导出到周期检查点。");
  }
  if (capabilities.randomState?.particleCount === undefined && sources.some((source) => source.particles?.some((particle) => typeof particle.count !== "number"))) {
    reasons.push("随机粒子数量使用未导出的随机数状态，不能按确定性状态证明稳态。");
  }
  return reasons;
}

export interface CheckpointQueueEvent {
  type: string;
  frame: number;
  timeSeconds: number;
  priority: number;
  sequence: number;
  queueOrderSequence?: number;
  targetLocalDeadline?: unknown;
  payload: unknown;
}

interface TimedStatus {
  key: string;
  actorId: string;
  start: number;
  end: number;
  label: string;
}
interface CheckpointBuff extends TimedStatus { targetId: string; stat: string; value: number }
interface CheckpointDebuff extends TimedStatus { element: string; resShred: number; defReduction: number }
interface CheckpointPlayerHp { actorId: string; maxHp: number; currentHp: number; zeroHpReached: boolean; currentBondOfLife?: number }

/** Runtime entities, before removing their absolute scheduling/audit identities. */
export interface CheckpointTimedSummon {
  action: ActionDefinition;
  cycle: number;
  summon: SummonDefinition;
  actionTimeSeconds: number;
  instanceId: string;
  spawnFrame: number;
  expiresAtFrame: number;
  attackFrame: number;
  snapshots: Record<string, CharacterStats | undefined>;
  actorPose: ActorPoseDefinition | undefined;
  thrillingTalesSnapshotStatuses?: Record<string, ActiveStatusSnapshot[]>;
}

export interface CapturePhaseCheckpointInput {
  /** Capture before ANY event at this frame, after every earlier frame drained. */
  tick: number;
  cumulativeDamage: number;
  /** The compiled configuration whose action events populate the queue. */
  config: SimConfig;
  /** The uncompiled ability definitions, paired with the final legal execution. */
  timelineConfig?: LegalTimelineConfig;
  timelineExecution?: TimelineExecution;
  energies: ReadonlyMap<string, number>;
  /** Required when the corresponding declared feature is present, even if empty. */
  reservedEnergy?: ReadonlyMap<string, number>;
  activeTimedSummons?: ReadonlyMap<string, CheckpointTimedSummon>;
  periodicEntityState?: PeriodicEntityCheckpointState;
  actionConditionLog?: readonly ActionConditionLogEntry[];
  ordinaryAuraState?: ReadonlyMap<string, OrdinaryAuraCapturedState>;
  nonPeriodicReactionState?: NonPeriodicReactionHostState;
  periodicReactionState?: PeriodicReactionHostState;
  sourceNormalChainState?: SourceNormalChainState;
  auraObservationState?: AuraObservationCapturedState;
  directDamageGroupState?: ReadonlyMap<string, DirectDamageGroupCapturedState>;
  targetPhaseV2State?: TargetPhaseV2CheckpointState;
  weaponProcState?: WeaponProcCheckpointState;
  thrillingTalesState?: ThrillingTalesCapturedState;
  skillCooldownState?: ReadonlyMap<string, SerialSkillCooldownState>;
  artifactEventState?: ArtifactEventCapturedState;
  artifactDamageState?: ArtifactDamageCapturedState;
  weaponHitStackState?: WeaponHitStackCapturedState;
  artifactBuffState?: ArtifactBuffCapturedState;
  playerShieldState?: PlayerShieldState;
  nightsoulBurstState?: NightsoulBurstCapturedState;
  randomState?: RandomExecutionCapturedState;
  liveConversions?: ReadonlyMap<string, StatConversionLogEntry>;
  actionLog?: readonly ActionLogEntry[];
  sourceSnapshotLog?: readonly SourceSnapshotLogEntry[];
  staminaState?: StaminaCheckpointSnapshot;
  fixedEnergyCooldownReadyFrames: ReadonlyMap<string, number>;
  particleCooldownReadyFrames: ReadonlyMap<string, number>;
  activeBuffs: readonly CheckpointBuff[];
  activeDebuffs: readonly CheckpointDebuff[];
  activeTargetDebuffs: readonly (CheckpointDebuff & { targetId: string; startFrame: number; endFrame: number; reaction: string; reactionDamageEventId: number; reactionStatusLogId: number })[];
  activeCharacterId: string | null;
  /** Complete queue snapshot, including future static actions and in-flight work. */
  pendingEvents: readonly CheckpointQueueEvent[];
  particleEvents: readonly ParticleEventLog[];
  playerHpStateByActorId: ReadonlyMap<string, CheckpointPlayerHp>;
  unsupportedState?: readonly string[];
}

export interface CapturePhaseCheckpointResult {
  checkpoint: PhaseCheckpoint | null;
  blockers: string[];
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("待执行事件缺少结构化载荷。");
  }
  return value as Record<string, unknown>;
}

/** Strip audit identity only; preserve every numeric value used by execution. */
function jsonValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("检查点含非有限数。");
    return value;
  }
  if (Array.isArray(value)) return value.map(jsonValue);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, jsonValue(item)]));
  }
  throw new Error("检查点含不可序列化的私有状态。");
}

function stable(value: unknown): string { return JSON.stringify(jsonValue(value)); }

/**
 * Full state for the bounded non-reactive core and captured ordinary Aura
 * domain. Other reaction / target-phase state remains independently blocked.
 * Future static inputs must repeat with a bounded period (1..16 cycles) through
 * the remaining complete horizon, containing at least two whole periods. We
 * serialize that period from the current phase, and ALL in-flight events.
 * This is a finite-horizon proof; it makes no claim about unprovided inputs.
 */
export function capturePhaseCheckpoint(input: CapturePhaseCheckpointInput): CapturePhaseCheckpointResult {
  const sourceConfig = input.timelineConfig === undefined ? input.config : { ...input.config, timeline: input.timelineConfig };
  const artifactRandom = input.artifactDamageState?.random;
  const randomState = artifactRandom === undefined ? input.randomState : { ...input.randomState, artifactDamage: artifactRandom };
  const skillCooldownActors = getRuntimeSkillCooldownActors(sourceConfig);
  const blockers = [...phaseCheckpointBlockers(sourceConfig, {
    delayedEnergyStateAvailable: input.reservedEnergy !== undefined && input.actionLog !== undefined,
    timedSummonStateAvailable: input.activeTimedSummons !== undefined,
    statConversionStateAvailable: input.liveConversions !== undefined && input.actionLog !== undefined,
    staminaStateAvailable: input.staminaState !== undefined && input.actionLog !== undefined,
    healthActionStateAvailable: input.actionLog !== undefined,
    periodicEntityStateAvailable: input.periodicEntityState !== undefined && input.actionLog !== undefined,
    actionConditionStateAvailable: input.actionConditionLog !== undefined && input.actionLog !== undefined,
    ordinaryAuraStateAvailable: input.ordinaryAuraState !== undefined && input.auraObservationState !== undefined,
    nonPeriodicReactionStateAvailable: input.nonPeriodicReactionState !== undefined,
    periodicReactionStateAvailable: input.periodicReactionState !== undefined,
    sourceNormalChainStateAvailable: input.sourceNormalChainState !== undefined,
    directDamageGroupStateAvailable: input.directDamageGroupState !== undefined,
    targetPhaseV2StateAvailable: input.targetPhaseV2State !== undefined,
    weaponProcStateAvailable: input.weaponProcState !== undefined,
    thrillingTalesStateAvailable: input.thrillingTalesState !== undefined,
    skillCooldownStateAvailable: input.skillCooldownState !== undefined,
    artifactEventStateAvailable: input.artifactEventState !== undefined,
    artifactDamageStateAvailable: input.artifactDamageState !== undefined,
    weaponHitStackStateAvailable: input.weaponHitStackState !== undefined,
    artifactBuffStateAvailable: input.artifactBuffState !== undefined,
    playerShieldStateAvailable: input.playerShieldState !== undefined,
    nightsoulBurstStateAvailable: input.nightsoulBurstState !== undefined,
    ...(randomState === undefined ? {} : { randomState }),
  }), ...(input.unsupportedState ?? [])];
  const fail = (reason: string): CapturePhaseCheckpointResult => ({ checkpoint: null, blockers: [...new Set([...blockers, reason])] });
  if (blockers.length) return { checkpoint: null, blockers: [...new Set(blockers)] };
  const { tick, config } = input;
  const cycleTicks = Math.round(config.cycleLength * 60);
  const durationTicks = Math.round(config.duration * 60);
  if (!Number.isInteger(tick) || tick < 0 || !Number.isFinite(input.cumulativeDamage) || input.cumulativeDamage < 0 ||
      cycleTicks <= 0 || Math.abs(config.cycleLength * 60 - cycleTicks) > 1e-8) {
    return fail("检查点边界、周期长度或累计伤害无效。");
  }
  if (tick + cycleTicks > durationTicks) return fail("检查点之后不足一个完整输入周期，不能使用截断队列证明稳态。");
  const maximumPendingDelayTicks = Math.max(0, ...config.rotation.map(action => actionPendingHorizonTicks(action, config.weaponProcModel)));
  if (tick + maximumPendingDelayTicks > durationTicks) {
    return fail("模拟末尾可能裁掉已施放动作的延迟任务，当前检查点没有完整在途状态。");
  }
  if (input.activeTargetDebuffs.length && input.nonPeriodicReactionState === undefined) return fail("反应生成的目标减益尚未完整纳入检查点。");
  if ((input.timelineExecution === undefined) !== (input.timelineConfig === undefined)) {
    return fail("合法轮转检查点必须同时具有技能定义和最终执行结果。");
  }
  const readyFrames = (frames: ReadonlyMap<string, number>) => [...frames]
    .filter(([, ready]) => ready > tick)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, ready]) => ({ key, remainingTicks: ready - tick }));
  try {
    if (artifactRandom !== undefined && input.randomState?.artifactDamage !== undefined &&
        stable(artifactRandom) !== stable(input.randomState.artifactDamage)) {
      throw new Error("余响运行状态与具名随机流捕获不是同一个事件前边界。");
    }
    const randomExecution = normalizeRandomCheckpoint(randomState, tick);
    const reactionState = normalizeOrdinaryReactionCheckpoint({ tick, config,
      ...(input.timelineConfig === undefined ? {} : { timeline: input.timelineConfig }),
      ...(input.ordinaryAuraState === undefined ? {} : { aura: input.ordinaryAuraState }),
      ...(input.auraObservationState === undefined ? {} : { observations: input.auraObservationState }),
      ...(input.directDamageGroupState === undefined ? {} : { damageGroups: input.directDamageGroupState }),
      targetPhaseV2StateAvailable: input.targetPhaseV2State !== undefined,
      nonPeriodicStateAvailable: input.nonPeriodicReactionState !== undefined,
      periodicStateAvailable: input.periodicReactionState !== undefined,
    });
    const nonPeriodicReactions = input.nonPeriodicReactionState === undefined ? undefined : normalizeNonPeriodicReactionHost({
      state: input.nonPeriodicReactionState, aura: input.ordinaryAuraState, tick, pendingEvents: input.pendingEvents,
    });
    const targetPhaseState = input.targetPhaseV2State === undefined ? undefined : normalizeTargetPhaseV2Checkpoint({
      state: input.targetPhaseV2State, tick, durationTicks, pendingEvents: input.pendingEvents,
      retainedReactionTail: input.periodicReactionState !== undefined,
    });
    const weaponProcActors = new Map(input.weaponProcState?.actors.map(actor => [actor.actorId, actor]) ?? []);
    if (config.weaponProcModel !== undefined && stable(input.weaponProcState!.actors) !== stable(config.weaponProcModel.actors)) {
      throw new Error("武器追击检查点缺少与实际配置一致的持有者状态。");
    }
    const weaponProcs = input.weaponProcState === undefined ? undefined : {
      mode: config.weaponProcModel!.mode,
      actors: [...weaponProcActors.values()].sort((a, b) => a.actorId.localeCompare(b.actorId)).map(actor => {
        const lifecycle = input.weaponProcState!.lifecycleStates?.get(actor.actorId);
        if (["flute", "debateclub", "crescentpike", "endoftheline"].includes(actor.weaponId) && lifecycle === undefined) {
          throw new Error("状态武器追击检查点缺少实际谐音、效果、激活间隔或消耗次数。");
        }
        const remaining = (expiry: number | null | undefined) => expiry !== undefined && expiry !== null && expiry >= tick ? expiry - tick : null;
        const expiry = lifecycle === undefined ? input.weaponProcState!.cooldownExpiresFrames.get(actor.actorId) : lifecycle.hitCooldownExpiresFrame;
        // The fixed source considers expiry === frame active. Expired and
        // never-triggered cooldowns differ only in future audit output.
        return { ...actor, remainingCooldownTicks: remaining(expiry),
          ...(lifecycle === undefined ? {} : { lifecycle: {
            effectRemainingTicks: remaining(lifecycle.effectExpiresFrame),
            activationCooldownRemainingTicks: remaining(lifecycle.activationCooldownExpiresFrame),
            // Flute resets expired notes before its next increment. End of
            // the Line cannot consume a proc until an active effect exists;
            // the next successful skill activation resets its count.
            notes: remaining(lifecycle.effectExpiresFrame) === null ? 0 : lifecycle.notes,
            procCount: remaining(lifecycle.effectExpiresFrame) === null ? 0 : lifecycle.procCount,
          } }),
        };
      }),
    };
    if (config.thrillingTalesModel !== undefined && stable(input.thrillingTalesState!.actors) !== stable(config.thrillingTalesModel.actors)) {
      throw new Error("讨龙检查点缺少实际持有者声明。");
    }
    const thrillingTales = input.thrillingTalesState === undefined ? undefined : {
      mode: config.thrillingTalesModel!.mode,
      actors: input.thrillingTalesState.actors.map(actor => {
        const expiry = input.thrillingTalesState!.ownerExpiry.get(actor.actorId);
        return { ...actor, remainingCooldownTicks: expiry !== undefined && expiry >= tick ? expiry - tick : null };
      }),
      recipients: [...input.thrillingTalesState.recipientExpiry].filter(([, expiry]) => expiry >= tick)
        .sort(([a], [b]) => a.localeCompare(b)).map(([actorId, expiry]) => ({ actorId, remainingPresenceTicks: expiry - tick })),
    };
    const artifactEvents = input.artifactEventState === undefined ? undefined : {
      cooldowns: [...input.artifactEventState.cooldowns].filter(([, expiry]) => expiry >= tick)
        .sort(([a], [b]) => a.localeCompare(b)).map(([key, expiry]) => ({ key, remainingTicks: expiry - tick })),
      exileRecipients: [...input.artifactEventState.exileRecipientExpires].filter(([, expiry]) => expiry >= tick)
        .sort(([a], [b]) => a.localeCompare(b)).map(([actorId, expiry]) => ({ actorId, remainingTicks: expiry - tick })),
    };
    const artifactDamageActors = config.artifactDamageModel?.actors ?? [];
    const artifactDamageCaptured = input.artifactDamageState?.state;
    if (artifactDamageCaptured !== undefined) {
      if (config.artifactDamageModel === undefined) throw new Error("圣遗物伤害状态缺少对应的实际运行模型。");
      const expectedEchoes = artifactDamageActors.filter(actor => actor.effectId === "echoes-4pc").map(actor => actor.actorId).sort();
      const actualEchoes = artifactDamageCaptured.echoes.map(actor => actor.actorId).sort();
      if (stable(expectedEchoes) !== stable(actualEchoes)) throw new Error("余响检查点未完整捕获实际装备者各自的概率与时间窗口。");
    }
    // Both sets use exclusive global deadlines. Echoes is ready at equality;
    // Song reads global Status.Duration, unlike inclusive character statuses.
    const artifactDamageRemaining = (expiry: number) => Math.max(0, expiry - tick);
    const artifactDamage = artifactDamageCaptured === undefined ? undefined : {
      mode: config.artifactDamageModel!.mode,
      // Preserve subscriber registration order for the shared Song consumer.
      actors: artifactDamageActors,
      echoes: [...artifactDamageCaptured.echoes].sort((a, b) => a.actorId.localeCompare(b.actorId)).map(actor => ({
        actorId: actor.actorId, probability: actor.probability,
        cooldownRemainingTicks: artifactDamageRemaining(actor.cooldownExpiresFrame),
        riteRemainingTicks: artifactDamageRemaining(actor.riteExpiresFrame),
      })),
      song: {
        healingPool: artifactDamageCaptured.song.healingPool,
        yearningRemainingTicks: artifactDamageRemaining(artifactDamageCaptured.song.yearningExpiresFrame),
        waveHealing: artifactDamageCaptured.song.waveHealing,
        wavesRemainingTicks: artifactDamageRemaining(artifactDamageCaptured.song.wavesExpiresFrame),
        charges: artifactDamageCaptured.song.charges,
      },
    };
    const weaponHitStackCaptured = input.weaponHitStackState;
    if (weaponHitStackCaptured !== undefined) {
      if (config.weaponHitStackModel === undefined || !weaponHitStackCapturedStateSchema.safeParse(weaponHitStackCaptured).success ||
          stable(weaponHitStackCaptured.actors.map(({state:_state,...actor})=>actor)) !== stable(config.weaponHitStackModel.actors)) throw new Error("武器叠层检查点必须属于同一实际武器持有者、精炼与订阅顺序。");
      for (const actor of weaponHitStackCaptured.actors) {
        const rule=getWeaponHitStackRule(actor.weaponId);
        if(actor.state.stacks>rule.cap || rule.family==="royal"&&actor.state.effectExpiresFrame!==null) throw new Error("武器叠层检查点超出对应来源层数或窗口。");
      }
    }
    const weaponStackExpiry=(expiry:number|null,readClears:boolean)=>expiry===null?null:expiry>=tick?{remainingTicks:expiry-tick}:readClears?{expiredUnread:true}:{expiredStored:true};
    const weaponHitStacks=weaponHitStackCaptured===undefined?undefined:{mode:config.weaponHitStackModel!.mode,sourceProfileId:WEAPON_HIT_STACK_PROFILE_ID,
      actors:weaponHitStackCaptured.actors.map(({state,...actor})=>({...actor,state:{stacks:state.stacks,effectExpiry:weaponStackExpiry(state.effectExpiresFrame,true),cooldownExpiry:weaponStackExpiry(state.cooldownExpiresFrame,false)}}))};
    const artifactBuffKeys: Record<ArtifactBuffEffectId, string> = {
      "noblesse-4pc": ARTIFACT_BUFF_SOURCE.noblesse.key,
      "instructor-4pc": ARTIFACT_BUFF_SOURCE.instructor.key,
      "gilded-4pc": ARTIFACT_BUFF_SOURCE.gilded.key,
      "fragment-4pc": ARTIFACT_BUFF_SOURCE.fragment.key,
      "paradise-4pc": ARTIFACT_BUFF_SOURCE.paradise.key,
      "vermillion-4pc": ARTIFACT_BUFF_SOURCE.vermillion.key,
    };
    const artifactBuffCaptured = input.artifactBuffState;
    if (artifactBuffCaptured !== undefined) {
      if (config.artifactBuffModel === undefined || !artifactBuffCapturedStateSchema.safeParse(artifactBuffCaptured).success) {
        throw new Error("圣遗物增益检查点缺少对应实际模型或完整合法私有状态。");
      }
      const expectedActors = [...config.artifactBuffModel.actors].sort((a, b) =>
        config.characters.findIndex(actor => actor.id === a.actorId) - config.characters.findIndex(actor => actor.id === b.actorId));
      const capturedActors = artifactBuffCaptured.actors.map(({ state: _state, sameElementCount: _same, differentElementCount: _different, ...actor }) => actor);
      if (stable(expectedActors) !== stable(capturedActors)) throw new Error("圣遗物增益检查点的实际持有者或队伍订阅顺序与配置不一致。");
      for (const actor of artifactBuffCaptured.actors) {
        const owner = config.characters.find(member => member.id === actor.actorId);
        if (owner === undefined) throw new Error("圣遗物增益持有者不在实际队伍中。");
        const same = actor.effectId === "gilded-4pc" ? Math.min(ARTIFACT_BUFF_SOURCE.gilded.countCap,
          config.characters.filter(member => member.id !== actor.actorId && member.element === owner.element).length) : 0;
        const different = actor.effectId === "gilded-4pc" ? Math.min(ARTIFACT_BUFF_SOURCE.gilded.countCap,
          config.characters.filter(member => member.id !== actor.actorId && member.element !== owner.element).length) : 0;
        if (actor.sameElementCount !== same || actor.differentElementCount !== different) throw new Error("饰金初始化元素人数与实际队伍不一致，不能使用重建的假定人数代替捕获值。");
      }
    }
    // Presence queries include the expiry frame. Full Stats/ReactBonus reads
    // delete expired effects separately; null and an unread expired modifier
    // therefore must remain distinct. Old absolute deadlines have no further
    // mechanical effect once expired, but retained stacks still do.
    const artifactBuffExpiry = (expiry: number | null, readClears: boolean) => expiry === null ? null
      : expiry >= tick ? { remainingTicks: expiry - tick }
        : readClears ? { expiredUnread: true } : { expiredStored: true };
    const artifactBuffs = artifactBuffCaptured === undefined ? undefined : {
      mode: config.artifactBuffModel!.mode, sourceProfileId: ARTIFACT_BUFF_SOURCE.id,
      actors: artifactBuffCaptured.actors.map(({ state, ...actor }) => ({ ...actor, state: {
        stacks: state.stacks,
        effectExpiry: artifactBuffExpiry(state.effectExpiresFrame, true),
        cooldownExpiry: artifactBuffExpiry(state.cooldownExpiresFrame, false),
      } })),
      // The host can retain an expired modifier until its next cleanup. Keep
      // those actual rows as well as the private lifecycle; an update operation
      // reads the existing key/stat pair, rather than rebuilding it from stacks.
      modifiers: input.activeBuffs.flatMap(({ start, end, ...buff }) => {
        const owner = artifactBuffCaptured.actors.find(actor => actor.actorId === buff.actorId &&
          buff.key === `${artifactBuffKeys[actor.effectId]}:${buff.targetId}`);
        if (owner === undefined) return [];
        const startFrame = Math.round(start * 60), expiryFrame = Math.round(end * 60);
        if (!config.characters.some(actor => actor.id === buff.targetId) ||
            Math.abs(start * 60 - startFrame) > 1e-8 || Math.abs(end * 60 - expiryFrame) > 1e-8 ||
            startFrame >= tick || expiryFrame < startFrame) throw new Error("圣遗物实际属性行缺少合法接收者或事件前整帧期限。");
        return [{ ...buff, effectId: owner.effectId,
          // A past window cannot become effective again through a value-only
          // update, so its exact old start/end no longer distinguishes futures.
          ...(expiryFrame < tick ? {} : { ageTicks: tick - startFrame }),
          expiry: artifactBuffExpiry(expiryFrame, false) }];
      }),
    };
    const nightsoulBurst = input.nightsoulBurstState === undefined ? undefined : {
      // Nightsoul's global timer is ready at equality; artifact status timers
      // above deliberately remain active at their expiry frame.
      cooldownRemainingTicks: input.nightsoulBurstState.cooldownExpiresFrame !== null && input.nightsoulBurstState.cooldownExpiresFrame > tick
        ? input.nightsoulBurstState.cooldownExpiresFrame - tick : null,
    };
    const snapshotStatusRows = (rows: readonly ActiveStatusSnapshot[]) => rows.map(({ startTimeSeconds, endTimeSeconds, ...status }) => ({
      ...status, startAgeTicks: tick - startTimeSeconds * 60, endRemainingTicks: endTimeSeconds * 60 - tick,
    }));
    const snapshotStatuses = (statuses: Record<string, ActiveStatusSnapshot[]>) => Object.fromEntries(Object.entries(statuses)
      .map(([actorId, rows]) => [actorId, snapshotStatusRows(rows)]));
    const castFrame = (seconds: number) => {
      const frame = Math.round(seconds * 60);
      if (Math.abs(seconds * 60 - frame) > 1e-8) throw new Error("在途状态的施放时间不在整帧边界。");
      return frame;
    };
    const actionById = new Map(config.rotation.map((action) => [action.id, action]));
    const actionKey = (action: ActionDefinition): string => action.sourceAbilityId ??
      (action.timelineCommandIndex !== undefined ? action.id.replace(/#\d+$/, "") : action.id);
    const canonicalActionId = (value: unknown): unknown => typeof value === "string" && actionById.has(value)
      ? actionKey(actionById.get(value)!) : value;
    const historicalProcLifecycle = (state: NonNullable<PendingWeaponProcContext["stateBefore"]>) => ({
      notes: state.notes, procCount: state.procCount,
      effectRemainingTicks: state.effectExpiresFrame === null ? null : state.effectExpiresFrame - tick,
      hitCooldownRemainingTicks: state.hitCooldownExpiresFrame === null ? null : state.hitCooldownExpiresFrame - tick,
      activationCooldownRemainingTicks: state.activationCooldownExpiresFrame === null ? null : state.activationCooldownExpiresFrame - tick,
    });
    const actionDefinition = (action: ActionDefinition): unknown => {
      const { at, once, cycles, everyNCycles, cycleRemainder, timelineCommandIndex,
        startFrame, cancelFrame, animationEndFrame, id, ...definition } = action;
      const command = timelineCommandIndex === undefined ? undefined : input.timelineConfig?.commands[timelineCommandIndex];
      return jsonValue({ ...definition, id: actionKey(action),
        ...(command?.type === "normal" && command.sourceNormalChain !== undefined ? { sourceNormalChain: command.sourceNormalChain } : {}),
        ...(startFrame === undefined ? {} : {
          cancelOffsetTicks: cancelFrame === undefined ? null : cancelFrame - startFrame,
          animationOffsetTicks: animationEndFrame === undefined ? null : animationEndFrame - startFrame,
        }),
      });
    };
    const relevantAcceptedActions = new Set<number>();
    const acceptedAction = (index: unknown) => {
      const entry = typeof index === "number" ? input.actionLog?.[index] : undefined;
      if (!entry) throw new Error("运行状态缺少其实际接受动作记录。");
      relevantAcceptedActions.add(index as number);
      castFrame(entry.time);
      const action = actionById.get(entry.actionId);
      if (!action) throw new Error("运行状态的来源动作不在实际编译轮转中。");
      return { entry, action };
    };
    const markAcceptedAction = (source: ActionDefinition, cycle: unknown): void => {
      const index = input.actionLog?.findIndex(entry => entry.actionId === source.id && entry.cycle === cycle);
      if (index !== undefined && index >= 0) acceptedAction(index);
    };
    const reactionFeatures = ordinaryReactionFeatures(sourceConfig);
    const capturesPeriodic = reactionFeatures.electroCharged || reactionFeatures.burning || reactionFeatures.dendroCore || reactionFeatures.crystallize;
    const periodicReactions = input.periodicReactionState === undefined || !capturesPeriodic ? undefined : normalizePeriodicReactionHost({
      state: input.periodicReactionState, aura: input.ordinaryAuraState!, tick, pendingEvents: input.pendingEvents,
      normalizeStatuses: snapshotStatusRows,
      normalizeSource: source => {
        markAcceptedAction(source.action, source.cycle);
        return { action: actionDefinition(source.action),
          triggerHitId: source.triggerHitId.startsWith(`${source.action.id}:`) ? `${actionKey(source.action)}${source.triggerHitId.slice(source.action.id.length)}` : source.triggerHitId };
      },
    });
    const sourceSnapshotRows = new Map((input.sourceSnapshotLog ?? []).map(row => [row.id, row]));
    if (sourceSnapshotRows.size !== (input.sourceSnapshotLog?.length ?? 0)) throw new Error("来源取样记录包含重复身份，不能解析待执行命中的真实样本。");
    const sourceSnapshot = (id: unknown) => {
      const row = typeof id === "number" ? sourceSnapshotRows.get(id) : undefined;
      if (!row) throw new Error("在途来源取样缺少实际样本记录，不能由当前面板重建。");
      const { entry, action: source } = acceptedAction(row.actionLogIndex);
      const expectedPriority = source.actionPhase === "after-frame-tasks-v1" && row.relativeFrame === 0 ? 12.5 : 2.5;
      if (row.actionId !== entry.actionId || row.cycle !== entry.cycle || entry.frame >= tick ||
          !Number.isSafeInteger(row.relativeFrame) || row.relativeFrame < 0 ||
          row.frame !== entry.frame + row.relativeFrame || castFrame(row.timeSeconds) !== row.frame ||
          row.eventPriority !== expectedPriority) {
        throw new Error("来源取样记录与实际接受动作、相对时刻或主队列阶段不一致。");
      }
      if (row.status === "pending") {
        if (row.frame < tick || row.stats !== null || row.eventSequence !== null || row.activeBuffs.length !== 0) {
          throw new Error("待执行来源取样含提前取得的面板或已经越过事件前边界。");
        }
      } else if (row.status !== "sampled" || row.frame >= tick || row.stats === null || row.eventSequence === null) {
        throw new Error("已取样来源面板缺少边界之前的真实取样结果。");
      }
      return { row, normalized: {
        sourceActionId: actionKey(source), sourceActorId: row.sourceActorId, ownerId: row.ownerId,
        actionAgeTicks: tick - entry.frame, relativeFrame: row.relativeFrame,
        sampleRemainingTicks: row.frame - tick, eventPriority: row.eventPriority,
        status: row.status, stats: row.stats, activeBuffs: snapshotStatusRows(row.activeBuffs),
      } };
    };
    const sourceSnapshotReferences = (value: unknown, action: ActionDefinition, cycle: unknown, hitFrame: number) => {
      const refs = record(value);
      const resolve = (id: unknown) => {
        const { row, normalized } = sourceSnapshot(id);
        if (row.actionId !== action.id || row.cycle !== cycle || row.frame > hitFrame) {
          throw new Error("待执行命中的来源取样引用不属于本次施放，或晚于伤害时刻。");
        }
        return normalized;
      };
      return {
        ...(refs.main === undefined ? {} : { main: resolve(refs.main) }),
        ...(refs.reaction === undefined ? {} : { reaction: resolve(refs.reaction) }),
        ...(refs.flatSources === undefined ? {} : { flatSources: Object.fromEntries(Object.entries(record(refs.flatSources))
          .map(([termIndex, id]) => [termIndex, resolve(id)])) }),
      };
    };
    const summons = [...(input.activeTimedSummons?.values() ?? [])];
    const summonIdentity = new Map(summons.map((summon, index) => [summon.instanceId, index]));
    const timedSummons = summons.map((summon, index) => ({
      instance: index,
      action: actionDefinition(summon.action),
      summon: summon.summon,
      actionAgeTicks: tick - castFrame(summon.actionTimeSeconds),
      spawnAgeTicks: tick - summon.spawnFrame,
      expiryRemainingTicks: summon.expiresAtFrame - tick,
      attackRemainingTicks: summon.attackFrame - tick,
      snapshots: summon.snapshots,
      actorPose: summon.actorPose,
      ...(summon.thrillingTalesSnapshotStatuses === undefined ? {} : { thrillingTalesSnapshotStatuses: snapshotStatuses(summon.thrillingTalesSnapshotStatuses) }),
    }));
    const statConversions = [...(input.liveConversions?.values() ?? [])]
      .filter((conversion) => conversion.expiresAtFrame > tick)
      .map((conversion) => {
        const { entry, action } = acceptedAction(conversion.actionLogIndex);
        const definition = action.statConversions?.find((candidate) => candidate.key === conversion.key);
        if (!definition) throw new Error("属性转换状态缺少实际来源定义。");
        return { actorId: entry.actorId, sourceActionId: actionKey(action), definition,
          ageTicks: tick - conversion.frame, remainingTicks: conversion.expiresAtFrame - tick,
          sourceValue: conversion.sourceValue, appliedValue: conversion.appliedValue,
          snapshot: conversion.snapshot };
      }).sort((a, b) => a.actorId.localeCompare(b.actorId) || a.definition.key.localeCompare(b.definition.key));
    const events = [...input.pendingEvents].sort((a, b) => a.frame - b.frame || a.priority - b.priority ||
      (a.queueOrderSequence ?? a.sequence) - (b.queueOrderSequence ?? b.sequence));
    if (events.some((event) => event.frame < tick || Math.abs(event.timeSeconds * 60 - event.frame) > 1e-8)) {
      return fail("队列含边界之前的事件或非整帧时间，无法形成一致的事件前检查点。");
    }
    if (events.some((event) => event.targetLocalDeadline !== undefined)) return fail("待执行队列含未导出的目标局部时钟任务。");
    const songConversionTasks = events.filter(event => event.type === "artifactSongConvert");
    const yearningExpiry = artifactDamageCaptured?.song.yearningExpiresFrame;
    if (yearningExpiry !== undefined && yearningExpiry > 0 && yearningExpiry >= tick &&
        !songConversionTasks.some(event => event.frame === yearningExpiry)) {
      throw new Error("昔时之歌的实际渴盼状态缺少到期转换任务，可能被模拟尾段截断。");
    }
    const artifactTickTasks = events.filter(event => event.type === "artifactEnergyTick");
    const artifactActivations = new Map<number, number>();
    const artifactBuffActivations = new Map<number, { instance: number; source: string }>();
    for (const event of artifactTickTasks) {
      const parentId = record(event.payload).parentArtifactEventLogId as number;
      if (!artifactActivations.has(parentId)) artifactActivations.set(parentId, artifactActivations.size);
    }
    for (const [receiverId, expiry] of input.artifactEventState?.exileRecipientExpires ?? []) {
      if (expiry >= tick && !artifactTickTasks.some(event => {
        const task = record(event.payload);
        return task.receiverId === receiverId && task.tickIndex === 3 && event.frame === expiry &&
          task.sourceFrame === expiry - ARTIFACT_EVENT_SOURCE_PROFILE.exile.durationFrames;
      })) throw new Error("流放者接收者的实际状态缺少最后一次待执行回能任务，可能被模拟尾段截断。");
    }
    const skillCooldownTasks = events.filter(event => event.type === "skillCooldownStart" || event.type === "skillCooldownRecover");
    const cooldownCastIds = new Set<string>();
    for (const actorId of skillCooldownActors) {
      const state = input.skillCooldownState?.get(actorId);
      if (state === undefined) throw new Error(`技能冷却检查点缺少角色 ${actorId} 的实际共享充能状态。`);
      for (const entry of state.queue) cooldownCastIds.add(entry.castId);
      const worker = serialSkillCooldownWorker(state);
      if (worker !== null && !skillCooldownTasks.some(event => {
        const task = record(event.payload);
        return event.type === "skillCooldownRecover" && task.actorId === actorId &&
          task.workerGeneration === worker.generation && event.frame === worker.frame &&
          task.actionId === state.queue[0]!.castId;
      })) throw new Error("实际技能恢复 worker 缺少完整待执行任务，可能被模拟尾段截断。");
    }
    for (const event of skillCooldownTasks) cooldownCastIds.add(record(event.payload).actionId as string);
    const cooldownCastSource = (castId: string) => {
      const source = actionById.get(castId);
      if (source === undefined || !skillCooldownActors.has(source.actorId)) throw new Error("技能冷却任务缺少实际共享技能槽的来源施放。");
      return source;
    };
    // Preserve aliases between queue entries and pending workers. Two casts of
    // the same ability (including in one frame) remain distinct, while absolute
    // command numbering can advance between otherwise equivalent periods.
    const cooldownCastInstances = new Map([...cooldownCastIds].sort((left, right) => {
      const a = cooldownCastSource(left);
      const b = cooldownCastSource(right);
      return (a.startFrame ?? castFrame(a.at)) - (b.startFrame ?? castFrame(b.at)) ||
        (a.timelineCommandIndex ?? 0) - (b.timelineCommandIndex ?? 0) || left.localeCompare(right);
    }).map((castId, instance) => [castId, instance]));
    const cooldownCast = (castId: string) => {
      const source = cooldownCastSource(castId);
      return { castId: actionKey(source), castInstance: cooldownCastInstances.get(castId),
        inputAgeTicks: tick - (source.startFrame ?? castFrame(source.at)) };
    };
    const skillCooldowns = skillCooldownActors.size === 0 ? undefined : [...skillCooldownActors].sort().map(actorId => {
      const state = input.skillCooldownState!.get(actorId)!;
      return { actorId, maxCharges: state.maxCharges, availableCharges: state.availableCharges,
        queue: state.queue.map(entry => ({ ...cooldownCast(entry.castId), abilityId: entry.abilityId, recoveryFrames: entry.recoveryFrames })),
        workerStartAgeTicks: state.workerStartedFrame === null ? null : tick - state.workerStartedFrame,
        // Pointer generations are meaningful relative to retained worker tokens.
        // Stale tokens are serialized below instead of being discarded.
        workerGeneration: 0 };
    });
    const cooldownAbilities = new Map(sourceConfig.timeline?.abilities.map(ability => [ability.id, ability]) ?? []);
    for (const entry of input.actionLog ?? []) {
      if (entry.frame >= tick || !skillCooldownActors.has(entry.actorId)) continue;
      const source = actionById.get(entry.actionId);
      const ability = source?.sourceAbilityId === undefined ? undefined : cooldownAbilities.get(source.sourceAbilityId);
      if (ability?.kind !== "skill" || (ability.cooldownStartFrame ?? 0) === 0) continue;
      const startFrame = entry.frame + ability.cooldownStartFrame!;
      if (startFrame >= tick && !skillCooldownTasks.some(event => event.type === "skillCooldownStart" &&
          event.frame === startFrame && record(event.payload).actionId === entry.actionId)) {
        throw new Error("已接受技能的延迟冷却启动任务缺失，可能被模拟尾段截断。");
      }
    }
    const referencedPeriodicEntities = new Set<LivePeriodicEntity>(input.periodicEntityState?.active ?? []);
    for (const event of events) {
      const payload = record(event.payload);
      if (event.type === "periodicEntityTick") referencedPeriodicEntities.add(payload.entity as LivePeriodicEntity);
      if (event.type === "hit" && payload.periodicEntityContext !== undefined) referencedPeriodicEntities.add(record(payload.periodicEntityContext).entity as LivePeriodicEntity);
    }
    const periodicIdentity = new Map<LivePeriodicEntity, number>();
    const periodicInstances = [...referencedPeriodicEntities].sort((left, right) =>
      left.action.actorId.localeCompare(right.action.actorId) || left.definition.id.localeCompare(right.definition.id) || left.generation - right.generation);
    const periodicEntities = periodicInstances.map((entity, instance) => {
      const key = `${entity.action.actorId}\u0000${entity.definition.id}`;
      const latestGeneration = input.periodicEntityState?.latestGenerations.get(key);
      if (latestGeneration === undefined || latestGeneration < entity.generation) throw new Error("周期实体缺少实际代次计数，不能通过删除身份认定重复。");
      const { entry } = acceptedAction(entity.actionLogIndex);
      if (entry.actionId !== entity.action.id || entry.actorId !== entity.action.actorId || entry.cycle !== entity.cycle) throw new Error("周期实体缺少实际接受动作上下文。");
      periodicIdentity.set(entity, instance);
      return { instance, actorId: entity.action.actorId, definitionId: entity.definition.id,
        relativeGeneration: entity.generation - latestGeneration,
        live: input.periodicEntityState!.active.includes(entity),
        definition: entity.definition, action: actionDefinition(entity.action),
        actionAgeTicks: tick - entry.frame, spawnAgeTicks: tick - entity.spawnFrame,
        expiryRemainingTicks: entity.expiresAtFrame - tick };
    });
    const chainDefinitions = sourceNormalChainDefinitions(sourceConfig.sourceAbilityBindings);
    const normalChain = input.sourceNormalChainState;
    if (normalChain !== undefined && (normalChain.actors.length !== chainDefinitions.length || chainDefinitions.some(definition => !normalChain.actors.some(actor => actor.actorId === definition.actorId && actor.chainId === definition.chainId && actor.length === definition.length && Number.isInteger(actor.nextIndex) && actor.nextIndex >= 1 && actor.nextIndex <= actor.length)))) throw new Error("来源普攻连段检查点与实际绑定定义不一致。");
    const inputEvent = (event: CheckpointQueueEvent) => {
      const payload = record(event.payload);
      if (event.type === "crystallizePickup") return { crystallizePickup: { element: payload.element } };
      if (event.type === "sourceNormalChainSwapStart") {
        const command = input.timelineConfig?.commands[payload.timelineCommandIndex as number];
        const result = input.timelineExecution?.commandResults.find(row => row.commandIndex === payload.timelineCommandIndex);
        if (normalChain === undefined || event.priority !== 8 || command?.type !== "swap" || command.characterId !== payload.actorId || result?.status !== "executed" || result.startFrame !== event.frame) throw new Error("来源连段待执行换人重置缺少实际接受的换人起手。");
        const { atFrame: _at, ...declaration } = command;
        return { normalChainSwapStart: { actorId: payload.actorId, declaration } };
      }
      return { action: actionDefinition(payload.action as ActionDefinition) };
    };
    const actionEvents = events.filter((event) => event.type === "action" || event.type === "crystallizePickup" || event.type === "sourceNormalChainSwapStart");
    const scheduleAt = (start: number) => actionEvents.filter((event) => event.frame >= start && event.frame < start + cycleTicks)
      .map((event) => ({ remainingTicks: event.frame - start, priority: event.priority,
        ...inputEvent(event) }));
    const remainingCycleCount = Math.floor((durationTicks - tick) / cycleTicks);
    if (remainingCycleCount < 2 && randomExecution === undefined) {
      return fail("检查点之后不足两次完整输入周期，单个剩余周期不能证明周期输入重复。");
    }
    const futureSchedules = Array.from({ length: remainingCycleCount }, (_, index) => scheduleAt(tick + index * cycleTicks));
    const scheduleKeys = futureSchedules.map(stable);
    let periodCycles: number | null = null;
    for (let candidate = 1; candidate <= Math.min(16, Math.floor(remainingCycleCount / 2)); candidate++) {
      if (scheduleKeys.every((key, index) => key === scheduleKeys[index % candidate])) {
        periodCycles = candidate;
        break;
      }
    }
    if (periodCycles === null && randomExecution === undefined) {
      return fail("未来完整输入周期并不重复，或不足两次完整的 1 至 16 周期模式；不能折叠为已验证周期输入。");
    }
    // Stochastic boundaries describe an actual finite run, including an
    // opening input that need not repeat. Keep the entire future input queue
    // rather than dropping it to manufacture phase equality. The analysis
    // layer independently refuses deterministic convergence for these runs.
    const periodicInput = periodCycles === null
      ? { periodCycles: null, inputPolicy: "finite-declared-queue", inputHorizonRemainingTicks: durationTicks - tick,
          futureInputSchedule: actionEvents.map(event => ({ remainingTicks: event.frame - tick, priority: event.priority,
            ...inputEvent(event) })) }
      : periodCycles === 1
      ? { periodCycles, futureInputCycle: futureSchedules[0]! }
      : { periodCycles, futureInputCycles: futureSchedules.slice(0, periodCycles) };
    const particlesById = new Map(input.particleEvents.map((particle) => [particle.id, particle]));
    const particleState = (particle: ParticleEventLog) => ({
      sourceActorId: particle.sourceActorId,
      sourceActionId: canonicalActionId(particle.sourceActionId),
      // The generated particle ID contains the compiled command number. The
      // source action plus particle definition index is the semantic identity.
      particleId: particle.particleId.startsWith(`${particle.sourceActionId}:`)
        ? `${canonicalActionId(particle.sourceActionId)}${particle.particleId.slice(particle.sourceActionId.length)}`
        : particle.particleId,
      spawnAgeTicks: tick - particle.spawnFrame,
      receiveRemainingTicks: particle.receiveFrame - tick,
      particleElement: particle.particleElement,
      particleKind: particle.particleKind,
      particleCount: particle.particleCount,
      triggerHitId: particle.triggerHitId,
    });
    const dynamicEvents: unknown[] = [];
    const hitGroups = new Map<string, number>();
    const pendingCosts = new Map<string, number>();
    const pendingSummonExpiries = new Set<string>();
    const pendingPeriodicTicks = new Set<LivePeriodicEntity>();
    const pendingSourceSnapshots = new Set<number>();
    for (const event of events) {
      if (event.type === "action" || event.type === "crystallizePickup" || event.type === "sourceNormalChainSwapStart") continue;
      const payload = record(event.payload);
      const { cycle, actionId, action, hitGroupId, triggerLogId, ...other } = payload;
      let normalizedPayload: unknown;
      switch (event.type) {
        case "periodicReactionTick":
        case "periodicReactionWane":
        case "periodicReactionExpiry":
        case "electroChargedCleanup":
        case "burningTick":
        case "burningFuelExpiry":
        case "dendroCoreSpawn":
        case "dendroCoreExpiry":
        case "crystallizeShardSpawn":
        case "crystallizeShardExpiry":
        case "crystallizeShieldExpiry": {
          if (periodicReactions === undefined) throw new Error("周期反应任务缺少实际来源、实体和计时状态。");
          normalizedPayload = periodicReactions.normalizeTask(event.type, payload);
          break;
        }
        case "quickenBloomFollowup": {
          if (periodicReactions === undefined || !action) throw new Error("Quicken→Bloom后续任务缺少实际来源状态。");
          const source = action as ActionDefinition;
          markAcceptedAction(source, cycle);
          normalizedPayload = { action: actionDefinition(source), targetId: payload.targetId, sourceActorId: payload.sourceActorId,
            triggerElement: payload.triggerElement, reactionBonusDelta: payload.reactionBonusDelta,
            triggerHitId: String(payload.triggerHitId).startsWith(`${source.id}:`) ? `${actionKey(source)}${String(payload.triggerHitId).slice(source.id.length)}` : payload.triggerHitId,
            triggerEventType: payload.triggerEventType, triggerEventPriority: payload.triggerEventPriority };
          break;
        }
        case "frozenExpiry":
        case "quickenExpiry": {
          if (input.nonPeriodicReactionState === undefined) throw new Error("反应到期任务缺少实际来源状态。");
          const kind = event.type === "frozenExpiry" ? "frozen" : "quicken";
          normalizedPayload = { targetId: payload.targetId,
            relativeGeneration: reactionLifecycleGeneration(input.ordinaryAuraState, payload.targetId as string, kind, payload.generation as number),
            expectedExpiryRemainingTicks: Number(payload.expectedExpiryFrame) - tick };
          break;
        }
        case "reactionDamageGroupReset": {
          if (input.nonPeriodicReactionState === undefined) throw new Error("反应伤害组重置任务缺少实际引擎状态。");
          normalizedPayload = normalizeReactionResetTask(payload.task as ReactionDamageGroupResetTask, input.nonPeriodicReactionState, tick);
          break;
        }
        case "reactionDamage": {
          if (input.nonPeriodicReactionState === undefined || !action || (payload.periodicContext !== undefined || payload.burningContext !== undefined || payload.dendroCoreContext !== undefined) && periodicReactions === undefined) throw new Error("反应伤害任务仍依赖未捕获的周期来源或草原核。");
          const { triggerDamageEventId: _damageId, reactionDamageLogId: _logId, sourceBuffStatuses, triggerHitGroupId, triggerHitId, periodicContext: _ec, burningContext: _burning, dendroCoreContext: _core, ...reaction } = other;
          if (typeof triggerHitGroupId !== "string" || typeof triggerHitId !== "string") throw new Error("反应伤害缺少原始触发命中身份。");
          if (!hitGroups.has(triggerHitGroupId)) hitGroups.set(triggerHitGroupId, hitGroups.size);
          const source = action as ActionDefinition;
          markAcceptedAction(source, cycle);
          normalizedPayload = { ...reaction, ...periodicReactions?.normalizeDamageContexts(payload), action: actionDefinition(source),
            triggerHitId: triggerHitId.startsWith(`${source.id}:`) ? `${actionKey(source)}${triggerHitId.slice(source.id.length)}` : triggerHitId,
            triggerHitGroup: hitGroups.get(triggerHitGroupId),
            sourceBuffStatuses: snapshotStatusRows(sourceBuffStatuses as ActiveStatusSnapshot[]) };
          break;
        }
        case "playerShieldInput": {
          const declaration = record(payload.input);
          if (input.playerShieldState === undefined || declaration.frame !== event.frame || event.priority !== 2 ||
              !config.playerShieldModel?.events.some(candidate => candidate.id === declaration.id && stable(candidate) === stable(declaration))) throw new Error("玩家护盾待执行声明不属于实际配置或任务阶段。");
          const { frame: _frame, ...definition } = declaration;
          normalizedPayload = { input: definition };
          break;
        }
        case "playerShieldExpiry":
          if (input.playerShieldState === undefined || event.priority !== -0.5) throw new Error("玩家护盾到期任务缺少真实盾状态或到期阶段。");
          normalizedPayload = {};
          break;
        case "playerMaxHpExpiry":
          normalizedPayload = {};
          break;
        case "sourceSnapshot": {
          const { row, normalized } = sourceSnapshot(payload.snapshotLogId);
          if (!action || (action as ActionDefinition).id !== row.actionId || cycle !== row.cycle ||
              payload.actionLogIndex !== row.actionLogIndex || payload.ownerId !== row.ownerId ||
              payload.relativeFrame !== row.relativeFrame || row.status !== "pending" ||
              event.frame !== row.frame || event.priority !== row.eventPriority || pendingSourceSnapshots.has(row.id)) {
            throw new Error("待执行来源取样任务缺少一致的真实动作、样本身份或主队列期限。");
          }
          pendingSourceSnapshots.add(row.id);
          normalizedPayload = normalized;
          break;
        }
        case "artifactEnergyTick": {
          if (input.artifactEventState === undefined || typeof payload.sourceFrame !== "number") {
            throw new Error("待执行圣遗物回能任务缺少实际事件状态或触发时刻。");
          }
          normalizedPayload = { actorId: payload.actorId, effectId: payload.effectId,
            receiverId: payload.receiverId, amount: payload.amount, tickIndex: payload.tickIndex,
            sourceActionId: canonicalActionId(payload.sourceActionId), sourceAgeTicks: tick - payload.sourceFrame,
            activation: artifactActivations.get(payload.parentArtifactEventLogId as number) };
          break;
        }
        case "artifactSongConvert": {
          if (artifactDamageCaptured === undefined || typeof payload.sourceFrame !== "number" ||
              !Number.isSafeInteger(payload.sourceFrame) || payload.sourceFrame < 0 || payload.sourceFrame >= tick ||
              typeof payload.actorId !== "string" ||
              !artifactDamageActors.some(actor => actor.actorId === payload.actorId && actor.effectId === "song-of-days-past-4pc") ||
              event.frame !== payload.sourceFrame + 360 || event.priority !== 2) {
            throw new Error("昔时之歌转换任务缺少真实治疗来源、360帧期限或核心队列阶段。");
          }
          // A later heal can open a new yearning window before this older
          // conversion runs. Keep every queued conversion in FIFO order;
          // neither the current expiry nor an absolute log ID is its identity.
          normalizedPayload = { actorId: payload.actorId, sourceAgeTicks: tick - payload.sourceFrame };
          break;
        }
        case "artifactBuffApply": {
          const parsed = artifactBuffDelayedApplicationSchema.safeParse(payload.task);
          if (!parsed.success || artifactBuffCaptured === undefined ||
              typeof payload.parentArtifactBuffLogId !== "number" || !Number.isSafeInteger(payload.parentArtifactBuffLogId) ||
              payload.parentArtifactBuffLogId < 0 || event.priority !== 2) {
            throw new Error("圣遗物延迟应用任务缺少真实私有状态、来源记录或核心队列阶段。");
          }
          const task = parsed.data;
          const owner = artifactBuffCaptured.actors.find(actor => actor.actorId === task.actorId);
          if (owner?.effectId !== task.effectId || owner.noblesseSelfDelayFrames !== 1 ||
              task.receiverId !== task.actorId || task.sourceFrame >= tick ||
              task.applyFrame !== task.sourceFrame + 1 || event.frame !== task.applyFrame) {
            throw new Error("宗室延迟应用必须来自真实持有者的前一帧爆发，并只在一帧后应用于本人。");
          }
          const source = stable({ actorId: task.actorId, effectId: task.effectId, sourceFrame: task.sourceFrame });
          const parentId = payload.parentArtifactBuffLogId;
          const activation = artifactBuffActivations.get(parentId);
          if (activation !== undefined && activation.source !== source) throw new Error("圣遗物延迟任务复用了不一致的来源身份。");
          if (activation === undefined) artifactBuffActivations.set(parentId, { instance: artifactBuffActivations.size, source });
          // Preserve aliases and queue order, while removing the monotonically
          // growing audit number. Actor/effect/receiver and source age remain
          // mechanical identities; they are not replaced by a generic buff.
          normalizedPayload = { actorId: task.actorId, effectId: task.effectId, receiverId: task.receiverId,
            sourceAgeTicks: tick - task.sourceFrame, activation: artifactBuffActivations.get(parentId)!.instance };
          break;
        }
        case "nightsoulBurstCallback": {
          if (input.nightsoulBurstState === undefined || typeof payload.sourceActionId !== "string" ||
              typeof payload.sourceHitId !== "string" || typeof payload.parentHitFrame !== "number") {
            throw new Error("待执行夜魂迸发回调缺少实际共享状态或来源命中。");
          }
          const sourceActionId = canonicalActionId(payload.sourceActionId);
          const sourceHitId = payload.sourceHitId.startsWith(`${payload.sourceActionId}:`)
            ? `${sourceActionId}${payload.sourceHitId.slice(payload.sourceActionId.length)}` : payload.sourceHitId;
          normalizedPayload = { sourceActorId: payload.sourceActorId, sourceActionId, sourceHitId,
            targetId: payload.targetId, element: payload.element,
            parentHitAgeTicks: tick - payload.parentHitFrame, parentEventPriority: payload.parentEventPriority };
          break;
        }
        case "skillCooldownStart":
        case "skillCooldownRecover": {
          const state = input.skillCooldownState?.get(payload.actorId as string);
          if (state === undefined || typeof actionId !== "string" ||
              (event.type === "skillCooldownRecover" && typeof payload.workerGeneration !== "number")) {
            throw new Error("待执行技能冷却任务缺少真实共享充能或 worker 代次。");
          }
          normalizedPayload = { actorId: payload.actorId, ...cooldownCast(actionId),
            abilityId: payload.abilityId, recoveryFrames: payload.recoveryFrames,
            ...(event.type === "skillCooldownRecover" ? {
              relativeWorkerGeneration: (payload.workerGeneration as number) - state.workerGeneration,
            } : {}) };
          break;
        }
        case "targetDecay": {
          if (targetPhaseState === undefined) throw new Error("目标衰减任务缺少实际目标阶段检查点。");
          normalizedPayload = { targetId: payload.targetId };
          break;
        }
        case "weaponProcDelayedSnapshot": {
          const actor = weaponProcActors.get(payload.actorId as string);
          if (actor?.weaponId !== "swordofnarzissenkreuz" || actor.hasInnateArkhe !== false ||
              typeof payload.triggerFrame !== "number" || event.frame !== payload.triggerFrame + 6 ||
              payload.triggerFrame >= tick || typeof payload.sourceActionId !== "string" || typeof payload.sourceHitId !== "string") {
            throw new Error("延迟武器取样任务缺少真实来源、资格或角色任务时间。");
          }
          const sourceActionId = canonicalActionId(payload.sourceActionId);
          normalizedPayload = { actor, targetId: payload.targetId, coefficient: payload.coefficient,
            sourceActionId, sourceHitId: payload.sourceHitId.startsWith(`${payload.sourceActionId}:`)
              ? `${sourceActionId}${payload.sourceHitId.slice(payload.sourceActionId.length)}` : payload.sourceHitId,
            triggerAgeTicks: tick - payload.triggerFrame, parentEventPriority: payload.parentEventPriority };
          break;
        }
        case "weaponHitStackCallback": {
          const parsed=weaponHitStackEventSchema.safeParse(payload.input);
          if(weaponHitStackCaptured===undefined || !parsed.success || parsed.data.kind!=="enemy-damage" || parsed.data.frame!==event.frame) throw new Error("待执行武器叠层回调缺少真实父伤害或同帧来源。");
          const {parentDamageEventId:_absoluteDamageId,activeCharacterId:_priorActive,frame:_absoluteFrame,...input}=parsed.data;
          normalizedPayload={input,parentHitAgeTicks:tick-parsed.data.frame};
          break;
        }
        case "weaponProcCallback": {
          const actor = weaponProcActors.get(payload.actorId as string);
          if (actor === undefined || typeof payload.sourceActionId !== "string" || typeof payload.sourceHitId !== "string" ||
              typeof payload.parentHitFrame !== "number" || typeof payload.parentEventPriority !== "number" ||
              payload.parentHitFrame > event.frame) {
            throw new Error("待执行武器回调缺少真实父命中身份、时刻或持有者。");
          }
          const parentProc = payload.sourceActionId.startsWith(`weapon-proc:${actor.actorId}:`);
          const sourceActionId = parentProc ? `weapon-proc:${actor.actorId}:${actor.weaponId}` : canonicalActionId(payload.sourceActionId);
          const sourceHitId = parentProc ? `${sourceActionId}:hit` : payload.sourceHitId.startsWith(`${payload.sourceActionId}:`)
            ? `${sourceActionId}${payload.sourceHitId.slice(payload.sourceActionId.length)}` : payload.sourceHitId;
          // The callback has not sampled stats yet. Preserve its actual damage
          // input and source identity, plus queue order; neither its later
          // decision nor its later snapshot can be reconstructed from logs.
          normalizedPayload = { actorId: actor.actorId, targetId: payload.targetId, attackTag: payload.attackTag,
            ...(payload.hitWeakPoint === undefined ? {} : { hitWeakPoint: payload.hitWeakPoint }),
            damage: payload.damage, sourceActionId,
            sourceHitId,
            parentHitAgeTicks: tick - payload.parentHitFrame, parentEventPriority: payload.parentEventPriority };
          break;
        }
        case "hit": {
          if (!action || typeof payload.hitIndex !== "number") throw new Error("在途命中缺少动作或段数。");
          if (typeof hitGroupId !== "string") throw new Error("在途命中缺少命中组身份。");
          if (!hitGroups.has(hitGroupId)) hitGroups.set(hitGroupId, hitGroups.size);
          const { periodicEntityContext, weaponProcLogId, weaponProcContext, thrillingTalesSnapshotStatuses, sourceSnapshots, ...rawHitPayload } = other;
          const hitPayload: Record<string, unknown> = { ...rawHitPayload, ...(thrillingTalesSnapshotStatuses === undefined ? {} : {
            thrillingTalesSnapshotStatuses: snapshotStatuses(thrillingTalesSnapshotStatuses as Record<string, ActiveStatusSnapshot[]>) }),
            ...(sourceSnapshots === undefined ? {} : { sourceSnapshots: sourceSnapshotReferences(sourceSnapshots, action as ActionDefinition, cycle, event.frame) }) };
          if (weaponProcLogId !== undefined) {
            const proc = weaponProcContext as PendingWeaponProcContext | undefined;
            if (proc === undefined || stable(weaponProcActors.get(proc.actor.actorId)) !== stable(proc.actor) ||
                proc.triggerFrame >= tick || event.frame !== (proc.deliveryFrame ?? proc.triggerFrame + 1)) {
              throw new Error("待执行独立追击缺少实际触发上下文或事件前调度帧。");
            }
            const identity = `weapon-proc:${proc.actor.actorId}:${proc.actor.weaponId}${!proc.deliveryIndex ? "" : proc.actor.weaponId === "eyeofperception" ? `:bounce-${proc.deliveryIndex}` : `:tick-${proc.deliveryIndex}`}`;
            const canonicalHit = { ...record(hitPayload.hit), id: `${identity}:hit` };
            normalizedPayload = { ...hitPayload, hit: canonicalHit,
              action: actionDefinition({ ...(action as ActionDefinition), id: identity,
                hits: [{ ...(action as ActionDefinition).hits![0]!, id: `${identity}:hit` }] }),
              weaponProcContext: { actor: proc.actor, triggerAgeTicks: tick - proc.triggerFrame,
                ...(proc.deliveryIndex === undefined ? {} : { deliveryIndex: proc.deliveryIndex }),
                ...(proc.deliveryFrame === undefined ? {} : { deliveryRemainingTicks: proc.deliveryFrame - tick }),
                ...(proc.snapshotFrame === undefined ? {} : { snapshotAgeTicks: tick - proc.snapshotFrame }),
                ...(proc.selectedCoefficient === undefined ? {} : { selectedCoefficient: proc.selectedCoefficient }),
                ...(proc.random === undefined ? {} : { random: proc.random }),
                ...(proc.triggerAura === undefined ? {} : { triggerAura: proc.triggerAura }),
                ...(proc.cooldownFrames === undefined ? {} : { cooldownFrames: proc.cooldownFrames }),
                ...(proc.cooldownExpiresFrameAfter === undefined ? {} : {
                  cooldownRemainingTicksAfter: proc.cooldownExpiresFrameAfter === null ? null : proc.cooldownExpiresFrameAfter - tick }),
                ...(proc.stateBefore === undefined ? {} : { stateBefore: historicalProcLifecycle(proc.stateBefore) }),
                ...(proc.stateAfter === undefined ? {} : { stateAfter: historicalProcLifecycle(proc.stateAfter) }),
                triggerBuffStatuses: proc.triggerBuffStatuses.map(({ startTimeSeconds, endTimeSeconds, ...status }) => ({
                  ...status, startAgeTicks: tick - startTimeSeconds * 60, endRemainingTicks: endTimeSeconds * 60 - tick,
                })) },
              hitGroup: hitGroups.get(hitGroupId) };
            break;
          }
          markAcceptedAction(action as ActionDefinition, cycle);
          const periodic = periodicEntityContext === undefined ? undefined : record(periodicEntityContext);
          normalizedPayload = { ...hitPayload, action: actionDefinition(action as ActionDefinition),
            ...(periodic === undefined ? {} : { periodicEntityContext: {
              instance: periodicIdentity.get(periodic.entity as LivePeriodicEntity), tickIndex: periodic.tickIndex,
              snapshotAgeTicks: tick - Number(periodic.tickFrame) } }),
            hitGroup: hitGroups.get(hitGroupId) };
          break;
        }
        case "energy":
        case "particleSpawn":
          if (typeof actionId === "string" && actionById.has(actionId)) markAcceptedAction(actionById.get(actionId)!, cycle);
          normalizedPayload = { ...other, actionId: canonicalActionId(actionId) };
          break;
        case "energyCost": {
          const { entry, action: source } = acceptedAction(payload.actionLogIndex);
          if (entry.actorId !== payload.actorId || entry.actionId !== actionId || typeof payload.energyCost !== "number") {
            throw new Error("延迟扣能任务与其实际接受动作不一致。");
          }
          pendingCosts.set(entry.actorId, (pendingCosts.get(entry.actorId) ?? 0) + payload.energyCost);
          normalizedPayload = { actorId: entry.actorId, actionId: actionKey(source),
            actionAgeTicks: tick - entry.frame, energyCost: payload.energyCost };
          break;
        }
        case "healthChange": {
          const { entry, action: source } = acceptedAction(payload.actionLogIndex);
          const change = record(payload.change);
          const definition = source.healthChanges?.find(candidate => candidate.id === change.id);
          if (!definition || entry.actorId !== payload.sourceActorId || entry.frame >= tick || event.priority !== 2 ||
              event.frame !== entry.frame + definition.frameOffset || stable(change) !== stable(definition)) {
            throw new Error("待执行生命任务与其已接受动作、完整定义或到期帧不一致。");
          }
          normalizedPayload = { sourceActorId: entry.actorId, sourceActionId: actionKey(source),
            actionAgeTicks: tick - entry.frame, change: definition };
          break;
        }
        case "periodicEntitySpawn": {
          const { entry, action: source } = acceptedAction(payload.actionLogIndex);
          const definition = payload.definition;
          if (event.frame !== entry.frame + Number(record(definition).spawnFrame)) throw new Error("周期实体生成任务缺少实际接受动作时刻。");
          normalizedPayload = { action: actionDefinition(source), actionAgeTicks: tick - entry.frame, definition };
          break;
        }
        case "periodicEntityTick": {
          const entity = payload.entity as LivePeriodicEntity;
          const instance = periodicIdentity.get(entity);
          if (instance === undefined || typeof payload.tickIndex !== "number") throw new Error("周期任务缺少实际实体或下一次 tick 序号。");
          if (event.frame !== entity.spawnFrame + entity.definition.firstTickDelayFrames + payload.tickIndex * entity.definition.intervalFrames) throw new Error("周期任务帧与真实实体代次不一致。");
          pendingPeriodicTicks.add(entity);
          normalizedPayload = { instance, tickIndex: payload.tickIndex, willExecute: input.periodicEntityState!.active.includes(entity) };
          break;
        }
        case "summonSpawn": {
          if (!action || typeof payload.actionTimeSeconds !== "number" || !payload.summon) {
            throw new Error("待生成召唤缺少原动作、生成定义或施放时刻。");
          }
          normalizedPayload = { action: actionDefinition(action as ActionDefinition), summon: payload.summon,
            actionAgeTicks: tick - castFrame(payload.actionTimeSeconds) };
          break;
        }
        case "summonExpiry": {
          const instanceId = payload.instanceId as string;
          const instance = summonIdentity.get(instanceId);
          if (instance === undefined || summons[instance]!.expiresAtFrame !== event.frame) {
            throw new Error("召唤到期任务缺少对应的实时实体和期限。");
          }
          pendingSummonExpiries.add(instanceId);
          normalizedPayload = { instance };
          break;
        }
        case "buff":
        case "debuff":
          normalizedPayload = payload;
          break;
        case "particleReceive": {
          const particle = particlesById.get(payload.particleEventId as number);
          if (!particle) throw new Error("在途粒子缺少完整生成记录。");
          normalizedPayload = particleState(particle);
          break;
        }
        default:
          throw new Error(`待执行事件 ${event.type} 的完整状态尚未支持。`);
      }
      dynamicEvents.push({ type: event.type, remainingTicks: event.frame - tick,
        ...(periodicReactions !== undefined && event.frame > durationTicks ? { withinSimulation: false } : {}),
        priority: event.priority, payload: jsonValue(normalizedPayload) });
    }
    for (const actorId of new Set([...(input.reservedEnergy?.keys() ?? []), ...pendingCosts.keys()])) {
      if (Math.abs((input.reservedEnergy?.get(actorId) ?? 0) - (pendingCosts.get(actorId) ?? 0)) > 1e-8) {
        throw new Error("能量预留与完整待扣能队列不一致，可能被观察窗截断。");
      }
    }
    if (summons.some((summon) => !pendingSummonExpiries.has(summon.instanceId))) {
      throw new Error("实时召唤缺少主队列到期任务，可能被观察窗截断。");
    }
    if (input.periodicEntityState?.active.some(entity => !pendingPeriodicTicks.has(entity))) {
      throw new Error("实时周期实体缺少主队列中的下一次任务，可能被观察窗截断。");
    }
    if (input.sourceSnapshotLog?.some(row => row.status === "pending" && !pendingSourceSnapshots.has(row.id))) {
      throw new Error("待取样来源记录缺少主队列实际任务，可能被观察尾段截断。");
    }
    // A received particle leaves the entity set at its receive-frame event,
    // so at an event-before boundary receiveFrame === tick remains in flight.
    const inFlightParticles = input.particleEvents.filter((particle) => particle.spawnFrame < tick && particle.receiveFrame >= tick)
      .map(particleState);
    const sources = [...config.rotation, ...(input.timelineConfig?.abilities ?? [])];
    const hasDelayedCosts = sources.some((source) => (source.energyCostFrame ?? 0) > 0);
    const hasSummons = sources.some((source) => source.summons?.length);
    const hasPeriodicEntities = sources.some(source => source.periodicEntities?.length);
    const hasActionConditions = sources.some(source => source.conditionalHitGroups?.length);
    const hasConversions = sources.some((source) => source.statConversions?.length);
    const energy = config.characters.map((character) => {
      const current = input.energies.get(character.id);
      if (current === undefined) throw new Error(`缺少角色 ${character.id} 的实际能量。`);
      return { actorId: character.id, current, maximum: character.energyMax,
        ...(hasDelayedCosts ? { reserved: input.reservedEnergy!.get(character.id) ?? 0 } : {}) };
    });
    const abilityCharges = (input.timelineConfig?.abilities ?? []).filter(ability =>
      ability.kind !== "skill" || !skillCooldownActors.has(ability.actorId)).map((ability) => {
      const slots = Array<number>(ability.maxCharges ?? 1).fill(0);
      for (const command of input.timelineExecution?.commandResults ?? []) {
        if (command.abilityId !== ability.id || command.status === "rejected" || command.startFrame === null || command.startFrame >= tick) continue;
        let selected = 0;
        for (let index = 1; index < slots.length; index++) if (slots[index]! < slots[selected]!) selected = index;
        slots[selected] = command.startFrame + (ability.chargeRecoveryFrames ?? ability.cooldownFrames);
      }
      return { actorId: ability.actorId, abilityId: ability.id,
        availableCharges: slots.filter((ready) => ready <= tick).length,
        remainingRechargeTicks: slots.map((ready) => Math.max(0, ready - tick)).sort((a, b) => a - b),
      };
    });
    const timelineStates = new Map<string, unknown>();
    for (const entry of input.timelineExecution?.stateLog ?? []) {
      if (entry.frame >= tick) continue;
      const key = `${entry.actorId}\u0000${entry.statusKey}`;
      if (entry.operation === "grant" || entry.operation === "replace") {
        timelineStates.set(key, { actorId: entry.actorId, statusKey: entry.statusKey,
          abilityId: entry.abilityId, remainingTicks: entry.expiresAtFrame - tick });
      } else timelineStates.delete(key);
    }
    const statuses = <T extends TimedStatus>(values: readonly T[]) => values
      .filter((value) => value.end > tick / 60 + 1e-9)
      .map(({ start, end, ...rest }) => ({ ...rest, ageTicks: tick - start * 60, remainingTicks: end * 60 - tick }));
    const commands = (input.timelineExecution?.commandResults ?? [])
      .filter((command) => command.status !== "rejected" && command.startFrame !== null && command.startFrame < tick);
    const latest = commands.at(-1);
    const occupancy = latest !== undefined && latest.animationEndFrame !== null && latest.animationEndFrame > tick
      ? { actorId: latest.actorId, abilityId: latest.abilityId, commandType: latest.commandType,
          elapsedTicks: tick - latest.startFrame!,
          cancelRemainingTicks: Math.max(0, (latest.cancelFrame ?? latest.endFrame ?? tick) - tick),
          animationRemainingTicks: latest.animationEndFrame - tick }
      : null;
    for (const [index, entry] of (input.actionLog ?? []).entries()) {
      if (entry.frame < tick && entry.animationEndFrame !== undefined && entry.animationEndFrame > tick) relevantAcceptedActions.add(index);
    }
    const lockedConditions = [...relevantAcceptedActions].sort((left, right) => input.actionLog![left]!.frame - input.actionLog![right]!.frame || left - right)
      .flatMap(index => {
        const { entry, action } = acceptedAction(index);
        return (action.conditionalHitGroups ?? []).map(group => {
          const row = input.actionConditionLog?.find(candidate => candidate.actionLogIndex === index && candidate.groupId === group.id);
          if (row === undefined) throw new Error("在途条件动作缺少接受时锁定的真实生命分支。");
          return { actorId: entry.actorId, actionId: actionKey(action), actionAgeTicks: tick - entry.frame,
            definition: group, inputPriority: row.eventPriority, ownerCurrentHp: row.ownerCurrentHp,
            ownerMaxHp: row.ownerMaxHp, selected: row.selected, hitIds: row.hitIds };
        });
      });
    const hp = [...input.playerHpStateByActorId.values()].map((state) => ({ actorId: state.actorId,
      maxHp: state.maxHp, currentHp: state.currentHp, zeroHpReached: state.zeroHpReached,
      ...(config.bondOfLifeModel === undefined ? {} : { currentBondOfLife: state.currentBondOfLife }) }));
    if (config.bondOfLifeModel !== undefined && hp.some(state => state.currentBondOfLife === undefined)) {
      return fail("生命之契模型缺少真实债务池状态，不能以零代替。");
    }
    if (config.playerDamageModel.mode !== "disabled" && hp.length !== config.characters.length) {
      return fail("玩家生命值模型已启用，但检查点缺少角色当前生命值。");
    }
    const staminaState = input.staminaState;
    if (config.staminaModel !== undefined &&
        (staminaState?.tick !== tick || staminaState.profileId !== config.staminaModel.profileId)) {
      throw new Error("体力检查点缺少当前事件前边界的真实共享池状态。");
    }
    const pendingStamina = staminaState?.pendingSpends.map((spend, order) => {
      const entry = input.actionLog?.find(action => action.timelineCommandIndex === spend.commandIndex && action.actionId === spend.sourceActionId);
      const source = entry === undefined ? undefined : actionById.get(entry.actionId);
      if (!entry || !source || entry.frame !== spend.inputFrame || entry.actorId !== spend.actorId ||
          source.staminaCost === undefined || source.staminaCost.amount !== spend.amount ||
          source.staminaCost.consumeFrame + entry.frame !== spend.frame) {
        throw new Error("待扣体力任务缺少其实际接受动作和费用声明。");
      }
      if (spend.frame < tick || spend.frame > durationTicks) {
        throw new Error("待扣体力任务不在完整边界后观察尾段内，不能使用截断状态证明稳态。");
      }
      return { remainingTicks: spend.frame - tick, inputAgeTicks: tick - spend.inputFrame,
        amount: spend.amount, actorId: spend.actorId, order, source: spend.source,
        consumeWhenZero: spend.consumeWhenZero,
        command: { actionId: actionKey(source), definition: actionDefinition(source) } };
    });
    const staminaResources = staminaState === undefined ? undefined : {
      version: staminaState.version, profileId: staminaState.profileId, maximum: staminaState.maximum,
      current: staminaState.current, recovery: staminaState.recovery,
    };
    const playerShields = input.playerShieldState === undefined ? undefined : {
      mode: config.playerShieldModel!.mode,
      shields: input.playerShieldState.shields.map(({ instanceId: _instanceId, expiresAtFrame, ...shield }) => ({ ...shield, remainingTicks: expiresAtFrame - tick })),
      bonuses: input.playerShieldState.bonuses.map(({ expiresAtFrame, ...bonus }) => ({ ...bonus,
        remainingTicks: expiresAtFrame === null ? null : Math.max(0, expiresAtFrame - tick) })),
    };
    if (input.playerShieldState !== undefined) {
      const pendingInputs = input.pendingEvents.filter(event => event.type === "playerShieldInput");
      const expectedInputs = config.playerShieldModel!.events.filter(event => event.frame >= tick);
      if (pendingInputs.length !== expectedInputs.length || expectedInputs.some(declaration => !pendingInputs.some(event => event.frame === declaration.frame && record(record(event.payload).input).id === declaration.id))) throw new Error("玩家护盾全局待执行事件被截断。");
      const expectedExpiries = new Set(config.playerShieldModel!.events.filter(event => event.kind === "grant" && event.frame < tick && event.frame + event.durationFrames >= tick).map(event => event.frame + (event.kind === "grant" ? event.durationFrames : 0)));
      const pendingExpiries = input.pendingEvents.filter(event => event.type === "playerShieldExpiry");
      if (pendingExpiries.length !== expectedExpiries.size || pendingExpiries.some(event => !expectedExpiries.has(event.frame))) throw new Error("玩家护盾到期任务必须保留替换后的原定期限与全部未来期限。");
    }
    const state = {
      energy,
      cooldownsAndCharges: { abilities: abilityCharges,
        ...(skillCooldowns === undefined ? {} : { sharedSkills: skillCooldowns }) },
      buffsAndDebuffs: { buffs: statuses(input.activeBuffs), debuffs: statuses(input.activeDebuffs),
        ...(nonPeriodicReactions === undefined ? {} : { reactionTargetDebuffs: statuses(input.activeTargetDebuffs.map(({ startFrame: _start, endFrame: _end, reactionDamageEventId: _damageId, reactionStatusLogId: _statusId, ...status }) => status)) }),
        ...(hasConversions ? { statConversions } : {}) },
      entities: { inFlightParticles, reactionEntities: periodicReactions?.state ?? "absent-in-supported-model",
        ...(hasSummons ? { timedSummons } : {}),
        ...(hasPeriodicEntities ? { periodicEntities } : {}) },
      auras: reactionState.aura === undefined ? { model: "disabled" } : {
        model: "ordinary-aura-checkpoint-v1", targets: reactionState.aura, observations: reactionState.observations },
      resourcesAndHp: { playerHpModel: config.playerDamageModel.mode, hp,
        ...(playerShields === undefined ? {} : { playerShields }),
        ...(staminaResources === undefined ? {} : { stamina: staminaResources }),
        timelineStates: [...timelineStates.values()].filter((value) => (value as { remainingTicks: number }).remainingTicks > 0) },
      icdAndTriggerHistory: { fixedEnergy: readyFrames(input.fixedEnergyCooldownReadyFrames),
        particles: readyFrames(input.particleCooldownReadyFrames),
        ...(randomExecution === undefined ? {} : { randomExecution }),
        ...(weaponProcs === undefined ? {} : { weaponProcs }),
        ...(thrillingTales === undefined ? {} : { thrillingTales }),
        ...(artifactEvents === undefined ? {} : { artifactEvents }),
        ...(artifactDamage === undefined ? {} : { artifactDamage }),
        ...(weaponHitStacks === undefined ? {} : { weaponHitStacks }),
        ...(artifactBuffs === undefined ? {} : { artifactBuffs }),
        ...(nightsoulBurst === undefined ? {} : { nightsoulBurst }),
        ...(nonPeriodicReactions === undefined ? {} : { nonPeriodicReactions }),
        ...(reactionState.aura === undefined && reactionState.damageGroups === undefined
          ? { auraAndDamageGroupState: "absent-in-supported-model" }
          : { ...(reactionState.damageGroups === undefined ? {} : { directDamageGroups: reactionState.damageGroups }),
              ...(reactionState.aura === undefined ? {} : { applicationIcdLocation: "auras.targets.applicationIcd" }) }) },
      pendingEvents: { ...periodicInput, inFlight: dynamicEvents,
        ...(targetPhaseState === undefined ? {} : { targetPhase: targetPhaseState }),
        ...(pendingStamina === undefined ? {} : { stamina: { phase: "player-recovery-then-delayed-spends-before-inputs", spends: pendingStamina } }) },
      activeCharacterAndActionPhase: { activeCharacterId: input.activeCharacterId, occupancy,
        ...(normalChain === undefined ? {} : { sourceNormalChain: normalChain }),
        ...(hasActionConditions ? { lockedConditions } : {}) },
    };
    // Round-tripping guarantees the producer returns detached JSON state,
    // rather than references that later simulation steps can mutate.
    return { checkpoint: { tick, cumulativeDamage: input.cumulativeDamage,
      state: JSON.parse(stable(state)) as PhaseCheckpoint["state"] }, blockers: [] };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "检查点导出失败。");
  }
}
