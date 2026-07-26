export const CURRENT_SCHEMA_VERSION = "1.21.0" as const;
export const CURRENT_ENGINE_VERSION = "1.21.0-actor-pose" as const;
export const SECTOR_GEOMETRY_SCHEMA_VERSION = "1.20.0" as const;
export const CAPSULE_GEOMETRY_SCHEMA_VERSION = "1.19.0" as const;
export const ORIENTED_RECTANGLE_SCHEMA_VERSION = "1.18.0" as const;
export const TARGET_MOTION_SCHEMA_VERSION = "1.17.0" as const;
export const CIRCLE_GEOMETRY_SCHEMA_VERSION = "1.16.0" as const;
export const AOE_FANOUT_SCHEMA_VERSION = "1.15.0" as const;
export const MULTI_TARGET_REGISTRY_SCHEMA_VERSION = "1.14.0" as const;
export const TARGET_PHASE_TIMELINE_SCHEMA_VERSION = "1.13.0" as const;
export const TARGET_EFFECT_POLICY_SCHEMA_VERSION = "1.12.0" as const;
export const TARGET_HIT_RESOLUTION_SCHEMA_VERSION = "1.11.0" as const;
export const TIMELINE_STATE_CLEAR_SCHEMA_VERSION = "1.10.0" as const;
export const MOVEMENT_COMMAND_SCHEMA_VERSION = "1.9.0" as const;
export const HIT_PARTICLE_TRIGGER_SCHEMA_VERSION = "1.8.0" as const;
export const FIXED_ENERGY_ICD_SCHEMA_VERSION = "1.7.0" as const;
export const RUNTIME_ENERGY_SCHEMA_VERSION = "1.6.0" as const;
export const FOLLOWUP_CANCEL_SCHEMA_VERSION = "1.5.0" as const;
export const ACTION_STATE_SCHEMA_VERSION = "1.4.0" as const;
export const ICD_PROFILE_SCHEMA_VERSION = "1.3.0" as const;
export const PARTICLE_SCHEMA_VERSION = "1.2.0" as const;
export const PREVIOUS_SCHEMA_VERSION = "1.1.0" as const;
export const INITIAL_TYPED_SCHEMA_VERSION = "1.0.0" as const;
export const LEGACY_SCHEMA_VERSION = "0.1.0" as const;

export type Element =
  | "pyro"
  | "cryo"
  | "hydro"
  | "electro"
  | "anemo"
  | "geo"
  | "dendro"
  | "physical";

export type AmplifyingReaction =
  | "none"
  | "melt"
  | "reverseMelt"
  | "vaporize"
  | "reverseVaporize";

export type ScalingStat = "atk" | "hp" | "def" | "em";
export type SnapshotMode = "action" | "hit";
export type CritMode = "average" | "allCrit" | "noCrit";
export type EnergyMode = "configured" | "zero" | "full";
export type CompatibilityMode = "legacy-v0.1" | "legal-frame-v1";
export type VerificationStatus = "verified" | "provisional" | "user-supplied";
export type TimelineLegalityMode = "strict" | "wait";
export type AbilityKind = "skill" | "burst" | "normal" | "charge";
export type AbilityFollowupKind =
  | AbilityKind
  | "dash"
  | "jump"
  | "swap";
export type AuraElement = Extract<Element, "pyro" | "cryo" | "hydro">;
export type IcdGroup = string;
export type ParticleElement = Exclude<Element, "physical"> | "neutral";
export type ParticleKind = "particle" | "orb";
export type TargetId = string;
export type TargetHitOutcome = "landed" | "miss";
export type TargetDamagePolicy = "normal" | "immune";
export type TargetAuraPolicy = "normal" | "blocked";
export type TargetHitConfirmPolicy = "normal" | "blocked";

export interface TargetEffectPolicy {
  damage: TargetDamagePolicy;
  aura: TargetAuraPolicy;
  hitConfirm: TargetHitConfirmPolicy;
}

export interface TargetPhaseDefinition {
  id: string;
  label: string;
  targetId: TargetId;
  /** Inclusive 60 FPS boundary. */
  startFrame: number;
  /** Exclusive 60 FPS boundary. */
  endFrame: number;
  reason: string;
  effects: TargetEffectPolicy;
}

/**
 * Scenario-level, single-target hit result. Ability blueprints intentionally
 * omit this field because whether an attack lands belongs to the target
 * scenario rather than immutable character data.
 */
export interface HitTargeting {
  targetId: TargetId;
  outcome: TargetHitOutcome;
  /** Required for misses or any non-normal target effect policy. */
  reason?: string;
  /**
   * Explicit scenario policy for a landed hit. This is not inferred from a
   * generic "invulnerable" flag because real target phases can block these
   * three layers independently.
   */
  effects?: TargetEffectPolicy;
}

export interface HitTargetingGroup {
  mode: "fanout";
  targets: HitTargeting[];
}

export type HitTargetingConfig = HitTargeting | HitTargetingGroup;

export interface ElementalApplication {
  /** Nominal elemental application strength (for example 1U, 2U, or 4U). */
  gaugeUnits: number;
  /** Independent ICD stream identifier within one actor and ICD group. */
  icdTag: string;
  icdGroup: IcdGroup;
}

export interface InitialAuraApplication {
  element: AuraElement;
  /** Nominal application strength; the normal aura starts at 0.8 × this value. */
  gaugeUnits: number;
}

export interface IcdProfile {
  /** Time-based reset boundary for the sequence, in 60 FPS frames. */
  resetFrames: number;
  /** Per-hit elemental application permission sequence, repeated by index. */
  applicationSequence: boolean[];
}

export interface AuraReactionEngineConfig {
  mode: "aura-v1";
  initialAura?: InitialAuraApplication[];
  /** Character-specific ICD groups keyed by the id used on each hit. */
  icdProfiles?: Record<string, IcdProfile>;
  /**
   * Debug-only escape hatch. Formal presets must leave this false and rely on
   * Aura/ICD state rather than manually labelling reactions.
   */
  debugAllowReactionOverride?: boolean;
}

export interface CharacterStats {
  baseAtk: number;
  atkPct: number;
  flatAtk: number;
  baseHp: number;
  hpPct: number;
  flatHp: number;
  baseDef: number;
  defPct: number;
  flatDef: number;
  em: number;
  critRate: number;
  critDmg: number;
  dmgBonus: number;
  defIgnore: number;
  reactionBonus: number;
  /** 1.0 means 100% Energy Recharge. */
  energyRecharge: number;
}

export interface CharacterProfile {
  id: string;
  name: string;
  element: Element;
  color: string;
  level: number;
  energyMax: number;
  initialEnergy: number;
  stats: CharacterStats;
}

export interface EnemyProfile {
  level: number;
  resistance: number;
  defReduction: number;
  /**
   * Optional named target registry. When omitted, the engine materializes the
   * compatibility target enemy-0 from the shared enemy stats.
   */
  targets?: EnemyTargetProfile[];
  /**
   * Sorted, non-overlapping target-state windows. Per-hit targeting effects
   * override the active phase while a scripted miss bypasses all effect layers.
   */
  targetPhases?: TargetPhaseDefinition[];
  /**
   * Sorted, non-overlapping linear motion segments. A target holds its prior
   * position in gaps and reaches endPosition exactly at endFrame.
   */
  targetMotions?: TargetMotionDefinition[];
}

export interface EnemyTargetProfile {
  id: TargetId;
  name: string;
  level?: number;
  resistance?: number;
  defReduction?: number;
  /** Overrides reactionEngine.initialAura for this target. */
  initialAura?: InitialAuraApplication[];
  position?: { x: number; y: number };
  hitboxRadius?: number;
}

export interface ResolvedEnemyTargetProfile {
  id: TargetId;
  name: string;
  level: number;
  resistance: number;
  defReduction: number;
  initialAura: InitialAuraApplication[];
  position: { x: number; y: number } | null;
  hitboxRadius: number;
}

export interface CircleHitGeometry {
  kind: "circle";
  coordinateSpace?: GeometryCoordinateSpace;
  origin: { x: number; y: number };
  radius: number;
}

export interface RectangleHitGeometry {
  kind: "rectangle";
  coordinateSpace?: GeometryCoordinateSpace;
  origin: { x: number; y: number };
  halfWidth: number;
  halfHeight: number;
  rotationDegrees: number;
}

export interface CapsuleHitGeometry {
  kind: "capsule";
  coordinateSpace?: GeometryCoordinateSpace;
  start: { x: number; y: number };
  end: { x: number; y: number };
  radius: number;
}

export interface SectorHitGeometry {
  kind: "sector";
  coordinateSpace?: GeometryCoordinateSpace;
  origin: { x: number; y: number };
  radius: number;
  directionDegrees: number;
  angleDegrees: number;
}

export type HitGeometry =
  | CircleHitGeometry
  | RectangleHitGeometry
  | CapsuleHitGeometry
  | SectorHitGeometry;

export type GeometryCoordinateSpace = "world" | "actor-local";

export interface ActorPoseDefinition {
  actorId: string;
  position: { x: number; y: number };
  facingDegrees: number;
}

export interface TargetMotionDefinition {
  id: string;
  label: string;
  targetId: TargetId;
  startFrame: number;
  endFrame: number;
  endPosition: { x: number; y: number };
}

export interface FlatDamageSource {
  ownerId?: string;
  stat?: ScalingStat;
  multiplier: number;
}

export interface HitDefinition {
  id?: string;
  offset: number;
  label?: string;
  scaling: number;
  scalingStat?: ScalingStat;
  element?: Element;
  targeting?: HitTargetingConfig;
  geometry?: HitGeometry;
  application?: ElementalApplication;
  reaction?: AmplifyingReaction;
  reactionOverride?: AmplifyingReaction;
  snapshot?: SnapshotMode;
  scalingOwnerId?: string;
  creditId?: string;
  flat?: number;
  flatSources?: FlatDamageSource[];
  dmgBonus?: number;
  defIgnore?: number;
  defReduction?: number;
  resShred?: number;
  critRate?: number;
  critDmg?: number;
  reactionBonus?: number;
  ampBase?: number;
  groupMultiplier?: number;
}

export type BuffStat =
  | "atkFlat"
  | "atkPct"
  | "hpFlat"
  | "hpPct"
  | "defFlat"
  | "defPct"
  | "dmgBonus"
  | "critRate"
  | "critDmg"
  | "em"
  | "defIgnore"
  | "reactionBonus"
  | "energyRecharge";

export type StatusTarget = "team" | "self" | string | string[];

export interface BuffDefinition {
  kind?: "buff";
  key?: string;
  label?: string;
  target?: StatusTarget;
  stat: BuffStat;
  value: number;
  duration: number;
  offset?: number;
}

export interface DebuffDefinition {
  kind?: "debuff";
  key?: string;
  label?: string;
  element?: Element | "all";
  resShred?: number;
  defReduction?: number;
  duration: number;
  offset?: number;
}

export type StatusDefinition = BuffDefinition | DebuffDefinition;

export interface EnergyEvent {
  target?: "team" | string | string[];
  amount: number;
  offset?: number;
  source?: string;
  internalCooldown?: {
    key: string;
    duration: number;
  };
}

export interface ParticleCountRange {
  min: number;
  max: number;
  /** Discrete inclusive roll step. Defaults to 1. */
  step?: number;
}

export type ParticleCount = number | ParticleCountRange;

export interface ParticleDefinition {
  id?: string;
  source?: string;
  kind?: ParticleKind;
  element: ParticleElement;
  count: ParticleCount;
  spawnOffset?: number;
  travelTime: number;
  trigger?: {
    kind: "hit-confirm";
    hitIds: string[];
    internalCooldown?: {
      key: string;
      duration: number;
    };
  };
}

export interface ActionDefinition {
  id: string;
  actorId: string;
  name: string;
  at: number;
  once?: boolean;
  cycles?: number[];
  everyNCycles?: number;
  cycleRemainder?: number;
  energyCost?: number;
  hits?: HitDefinition[];
  buffs?: BuffDefinition[];
  debuffs?: DebuffDefinition[];
  energyGains?: EnergyEvent[];
  particles?: ParticleDefinition[];
  /** Compiler metadata for legal-frame-v1 actions. */
  timelineCommandIndex?: number;
  sourceAbilityId?: string;
  startFrame?: number;
  cancelFrame?: number;
  animationEndFrame?: number;
}

export type RotationCommand = ActionDefinition;

export type FrameHitDefinition = Omit<HitDefinition, "offset"> & {
  frame: number;
};

export type FrameBuffDefinition = Omit<
  BuffDefinition,
  "duration" | "offset"
> & {
  startFrame?: number;
  durationFrames: number;
};

export type FrameDebuffDefinition = Omit<
  DebuffDefinition,
  "duration" | "offset"
> & {
  startFrame?: number;
  durationFrames: number;
};

export type FrameEnergyEvent = Omit<
  EnergyEvent,
  "offset" | "internalCooldown"
> & {
  frame?: number;
  internalCooldown?: {
    key: string;
    durationFrames: number;
  };
};

export type FrameParticleDefinition = Omit<
  ParticleDefinition,
  "spawnOffset" | "travelTime" | "trigger"
> & {
  spawnFrame?: number;
  travelFrames: number;
  trigger?: {
    kind: "hit-confirm";
    hitIds: string[];
    internalCooldown?: {
      key: string;
      durationFrames: number;
    };
  };
};

export interface TimelineStateGrant {
  key: string;
  label: string;
  durationFrames: number;
}

/**
 * Action-legality state owned by the ability actor. This is intentionally
 * separate from combat-stat buffs/debuffs.
 */
export interface AbilityTimelineState {
  requires?: string[];
  consumes?: string[];
  /** Removes any matching actor-owned state without requiring it to exist. */
  clears?: string[];
  grants?: TimelineStateGrant[];
}

export interface AbilityDefinition {
  id: string;
  actorId: string;
  name: string;
  kind: AbilityKind;
  cancelFrame: number;
  /** Optional action-specific cancel offsets selected from the next command. */
  cancelFrames?: Partial<Record<AbilityFollowupKind, number>>;
  animationEndFrame: number;
  cooldownFrames: number;
  maxCharges?: number;
  chargeRecoveryFrames?: number;
  energyCost?: number;
  hits?: FrameHitDefinition[];
  buffs?: FrameBuffDefinition[];
  debuffs?: FrameDebuffDefinition[];
  energyGains?: FrameEnergyEvent[];
  particles?: FrameParticleDefinition[];
  timelineState?: AbilityTimelineState;
}

export interface TimelineWaitCommand {
  type: "wait";
  frames: number;
}

export interface TimelineSwapCommand {
  type: "swap";
  characterId: string;
  atFrame?: number;
}

export interface TimelineMovementCommand {
  type: "dash" | "jump";
  actorId: string;
  /** Explicit provisional action occupancy; stamina and movement physics are not inferred. */
  frames: number;
  atFrame?: number;
}

export interface TimelineAbilityCommand {
  type: AbilityKind;
  actorId: string;
  abilityId: string;
  atFrame?: number;
}

export type LegalTimelineCommand =
  | TimelineWaitCommand
  | TimelineSwapCommand
  | TimelineMovementCommand
  | TimelineAbilityCommand;

export interface LegalTimelineConfig {
  mode: "legal-frame-v1";
  fps: 60;
  legalityMode: TimelineLegalityMode;
  initialActiveCharacterId: string;
  swapFrames: number;
  abilities: AbilityDefinition[];
  commands: LegalTimelineCommand[];
}

export interface ConfigMeta {
  name: string;
  version: string;
  note?: string;
  verificationStatus: VerificationStatus;
}

export interface SimConfig {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  engineVersion: typeof CURRENT_ENGINE_VERSION;
  dataVersion: string;
  randomSeed: string;
  meta: ConfigMeta;
  duration: number;
  cycleLength: number;
  enemy: EnemyProfile;
  characters: CharacterProfile[];
  /** Static scenario pose. Actor movement is not inferred in this version. */
  actorPoses?: ActorPoseDefinition[];
  rotation: RotationCommand[];
  timeline?: LegalTimelineConfig;
  reactionEngine?: AuraReactionEngineConfig;
}

export interface SimulationOptions {
  energyMode?: EnergyMode;
  critMode?: CritMode;
  compatibilityMode?: CompatibilityMode;
  randomSeed?: string;
}

export type SimulationEventType =
  | "action"
  | "buff"
  | "debuff"
  | "energy"
  | "particleSpawn"
  | "particleReceive"
  | "hit";

export interface SimulationEvent<TPayload = unknown> {
  type: SimulationEventType;
  timeSeconds: number;
  frame: number;
  priority: number;
  sequence: number;
  payload: TPayload;
}

export interface ActiveStatusSnapshot {
  key: string;
  kind: "buff" | "debuff";
  sourceActorId?: string;
  targetId?: string;
  stat?: BuffStat;
  element?: Element | "all";
  value?: number;
  resShred?: number;
  defReduction?: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
  label: string;
}

export interface EnemyStateBeforeHit {
  level: number;
  baseResistance: number;
  resistanceShred: number;
  effectiveResistance: number;
  baseDefenseReduction: number;
  effectiveDefenseReduction: number;
}

export interface AuraStateEntry {
  element: AuraElement;
  gaugeUnits: number;
  expiresAtFrame: number | null;
}

export interface AuraGaugeEntry {
  element: AuraElement;
  gaugeUnits: number;
}

export interface ReactionAudit {
  model: "none" | "manual-override" | "aura-engine";
  triggered: boolean;
  reaction: AmplifyingReaction;
  icdAllowed: boolean | null;
  icdTag: string | null;
  icdGroup: IcdGroup | null;
  applicationGaugeUnits: number | null;
  auraBefore: AuraStateEntry[] | null;
  /** Nominal attack application that passed ICD. */
  auraApplied: AuraGaugeEntry[] | null;
  /** Actual remaining aura durability removed by this hit. */
  auraConsumed: AuraGaugeEntry[] | null;
  auraAfter: AuraStateEntry[] | null;
  note?: string;
}

export interface FlatDamageDetail {
  ownerId: string;
  stat: ScalingStat;
  multiplier: number;
  sourceValue: number;
  amount: number;
}

export interface DamageFactors {
  scaling: number;
  scalingStat: ScalingStat;
  scalingValue: number;
  flatDamage: number;
  baseDamage: number;
  damageBonus: number;
  damageBonusMultiplier: number;
  defenseIgnore: number;
  defenseReduction: number;
  defenseMultiplier: number;
  effectiveResistance: number;
  resistanceMultiplier: number;
  critRate: number;
  critDamage: number;
  critMultiplier: number;
  reactionBase: number;
  elementalMasteryBonus: number;
  reactionBonus: number;
  amplifyingReactionMultiplier: number;
  groupMultiplier: number;
}

export interface DamageEvent {
  id: number;
  sourceActorId: string;
  scalingOwnerId: string;
  creditOwnerId: string;
  actionId: string;
  hitId: string;
  hitGroupId: string;
  targetIndex: number;
  targetCount: number;
  targetResolutionId: number;
  targetId: TargetId;
  targetName: string;
  targetDamagePolicy: TargetDamagePolicy;
  targetDamageMultiplier: 0 | 1;
  /** Formula result before the target-level damage policy. */
  potentialDamage: number;
  frame: number;
  timeSeconds: number;
  activeCharacterId: string | null;
  statsBeforeDamage: CharacterStats;
  activeStatuses: ActiveStatusSnapshot[];
  enemyStateBeforeHit: EnemyStateBeforeHit;
  reactionAudit: ReactionAudit;
  damageFactors: DamageFactors;
  /** Raw deterministic result retained for aggregation and Golden fixtures. */
  finalDamage: number;
  /** Nearest-integer display value, matching gcsim Sample presentation. */
  displayDamage: number;
  sourceActorName: string;
  scalingOwnerName: string;
  creditOwnerName: string;
  actionName: string;
  hitLabel: string;
  element: Element;
  reaction: AmplifyingReaction;
  snapshot: SnapshotMode;
  cycle: number;
  flatDetails: FlatDamageDetail[];
  timelineCommandIndex?: number;
  sourceAbilityId?: string;
  actionStartFrame?: number;
  actionCancelFrame?: number;
  actionAnimationEndFrame?: number;

  /** Compatibility aliases consumed by the v0.1-shaped UI. */
  time: number;
  second: number;
  actorId: string;
  creditId: string;
  actorName: string;
  activeId: string | null;
  scaling: number;
  scalingStat: ScalingStat;
  scalingValue: number;
  flat: number;
  baseDamage: number;
  dmgBonus: number;
  bonusFactor: number;
  defIgnore: number;
  defReduction: number;
  defenseFactor: number;
  effectiveRes: number;
  resFactor: number;
  critRate: number;
  critDmg: number;
  critFactor: number;
  em: number;
  reactionBase: number;
  emBonus: number;
  reactionBonus: number;
  reactionFactor: number;
  groupMultiplier: number;
  buffs: string[];
  debuffs: string[];
}

export interface SkippedAction {
  time: number;
  frame: number;
  actorId: string;
  actionId: string;
  action: string;
  reason: string;
  reasonCode: "INSUFFICIENT_ENERGY";
  energyBefore: number;
  energyCost: number;
  cycle: number;
  timelineCommandIndex?: number;
  sourceAbilityId?: string;
}

export interface ActionLogEntry {
  time: number;
  frame: number;
  actorId: string;
  actionId: string;
  action: string;
  cycle: number;
  energyBefore: number;
  energyAfter: number;
  timelineCommandIndex?: number;
  sourceAbilityId?: string;
  cancelFrame?: number;
  animationEndFrame?: number;
}

export interface EnergySummary {
  initial: number;
  gained: number;
  fixedGained: number;
  particleGained: number;
  wasted: number;
  spent: number;
  skipped: number;
  final: number;
}

export interface ParticleEventLog {
  id: number;
  sourceActorId: string;
  sourceActionId: string;
  source: string;
  particleId: string;
  spawnFrame: number;
  receiveFrame: number;
  spawnTimeSeconds: number;
  receiveTimeSeconds: number;
  particleElement: ParticleElement;
  particleKind: ParticleKind;
  particleCount: number;
  receivedWithinSimulation: boolean;
  cycle: number;
  triggerLogId: number | null;
  triggerHitId: string | null;
}

export interface ParticleTriggerLogEntry {
  id: number;
  frame: number;
  timeSeconds: number;
  cycle: number;
  sourceActorId: string;
  sourceActionId: string;
  source: string;
  particleId: string;
  hitId: string;
  hitGroupId: string;
  checkedTargetIds: TargetId[];
  confirmedTargetIds: TargetId[];
  triggered: boolean;
  blockedReason:
    | "INTERNAL_COOLDOWN"
    | "TARGET_MISS"
    | "TARGET_HIT_CONFIRM_BLOCKED"
    | null;
  internalCooldownKey: string | null;
  internalCooldownDurationFrames: number | null;
  internalCooldownReadyFrame: number | null;
}

export interface HitResolutionLogEntry {
  id: number;
  frame: number;
  timeSeconds: number;
  cycle: number;
  sourceActorId: string;
  sourceActionId: string;
  actionName: string;
  hitId: string;
  hitGroupId: string;
  targetIndex: number;
  targetCount: number;
  hitLabel: string;
  element: Element;
  targetId: TargetId;
  targetName: string;
  targetingSource: "default" | "scripted" | "geometry";
  targetPosition: { x: number; y: number } | null;
  sourceActorPosition: { x: number; y: number } | null;
  sourceActorFacingDegrees: number | null;
  geometryKind: HitGeometry["kind"] | null;
  geometryCoordinateSpace: GeometryCoordinateSpace | null;
  geometryOrigin: { x: number; y: number } | null;
  geometryStart: { x: number; y: number } | null;
  geometryEnd: { x: number; y: number } | null;
  geometryRadius: number | null;
  geometryHalfWidth: number | null;
  geometryHalfHeight: number | null;
  geometryRotationDegrees: number | null;
  geometryDirectionDegrees: number | null;
  geometryAngleDegrees: number | null;
  geometryDistance: number | null;
  geometryThreshold: number | null;
  outcome: TargetHitOutcome;
  landed: boolean;
  reason: string | null;
  targetEffectSource: "normal" | "hit" | "target-phase";
  /** Active phase even when a per-hit override or miss takes precedence. */
  targetPhaseId: string | null;
  damageAllowed: boolean;
  auraAllowed: boolean;
  hitConfirmAllowed: boolean;
  /** Null when the target was missed before combat resolution. */
  damageEventId: number | null;
  /** Formula result before target immunity; zero for a miss. */
  potentialDamage: number;
  finalDamage: number;
  displayDamage: number;
  timelineCommandIndex?: number;
  sourceAbilityId?: string;
}

export interface TargetPhaseTimelineEntry extends TargetPhaseDefinition {
  startTimeSeconds: number;
  endTimeSeconds: number;
}

export interface TargetMotionTimelineEntry extends TargetMotionDefinition {
  startPosition: { x: number; y: number };
  startTimeSeconds: number;
  endTimeSeconds: number;
}

export interface EnergyLogEntry {
  id: number;
  kind: "fixed" | "particle";
  frame: number;
  timeSeconds: number;
  sourceActorId: string;
  sourceActionId: string;
  source: string;
  receiverId: string;
  activeCharacterId: string | null;
  isOnField: boolean;
  energyBefore: number;
  /** Particle energy after element/field rules but before Energy Recharge. */
  rawEnergy: number;
  /** Requested energy after Energy Recharge and before the energy cap. */
  finalEnergy: number;
  gainedEnergy: number;
  wastedEnergy: number;
  energyAfter: number;
  spawnFrame: number | null;
  receiveFrame: number;
  particleElement: ParticleElement | null;
  particleKind: ParticleKind | null;
  particleCount: number | null;
  isSameElement: boolean | null;
  energyRecharge: number;
  fieldMultiplier: number;
  baseEnergyPerParticle: number | null;
  applied: boolean;
  blockedReason: "INTERNAL_COOLDOWN" | null;
  internalCooldownKey: string | null;
  internalCooldownDurationFrames: number | null;
  internalCooldownReadyFrame: number | null;
}

export interface EnergyCurvePoint {
  id: number;
  frame: number;
  timeSeconds: number;
  kind: "initial" | "spend" | "fixed" | "fixed-blocked" | "particle";
  receiverId: string | null;
  source: string;
  energyByCharacter: Record<string, number>;
}

export interface SkillSummary {
  creditId: string;
  actionName: string;
  damage: number;
  hits: number;
  dps: number;
  share: number;
}

export interface CharacterDamageSummary {
  characterId: string;
  damage: number;
  hits: number;
  dps: number;
  share: number;
}

export interface EnemyTargetDamageSummary {
  targetId: TargetId;
  targetName: string;
  damage: number;
  potentialDamage: number;
  damageEvents: number;
  landedChecks: number;
  missedChecks: number;
  immuneDamageEvents: number;
  dps: number;
  share: number;
}

export interface DamageCurvePoint {
  damageEventId: number;
  targetId: TargetId;
  targetName: string;
  frame: number;
  timeSeconds: number;
  sourceActorId: string;
  creditOwnerId: string;
  finalDamage: number;
  cumulativeDamage: number;
  cumulativeByCharacter: Record<string, number>;
}

export interface AuraTimelinePoint {
  damageEventId: number;
  targetId: TargetId;
  targetName: string;
  frame: number;
  timeSeconds: number;
  sourceActorId: string;
  actionId: string;
  hitId: string;
  incomingElement: Element;
  icdAllowed: boolean | null;
  reaction: AmplifyingReaction;
  auraBefore: AuraStateEntry[];
  auraApplied: AuraGaugeEntry[];
  auraConsumed: AuraGaugeEntry[];
  auraAfter: AuraStateEntry[];
}

export type TimelineFailureCode =
  | "ACTION_OVERLAP"
  | "ABILITY_ON_COOLDOWN"
  | "INSUFFICIENT_ENERGY"
  | "UNKNOWN_ABILITY"
  | "WRONG_ACTIVE_CHARACTER"
  | "ALREADY_ACTIVE"
  | "MISSING_REQUIRED_STATE"
  | "OUT_OF_DURATION";

export interface TimelineStateLogEntry {
  sequence: number;
  frame: number;
  timeSeconds: number;
  operation: "grant" | "replace" | "consume" | "clear" | "expire";
  actorId: string;
  statusKey: string;
  label: string;
  expiresAtFrame: number;
  commandIndex: number;
  abilityId: string;
}

export interface TimelineFailure {
  commandIndex: number;
  code: TimelineFailureCode;
  frame: number;
  message: string;
  energyBefore?: number;
  energyCost?: number;
}

export interface TimelineAdjustment {
  commandIndex: number;
  code: "ACTION_OVERLAP" | "ABILITY_ON_COOLDOWN";
  requestedFrame: number;
  executedFrame: number;
  waitedFrames: number;
  message: string;
}

export interface TimelineCommandResult {
  commandIndex: number;
  commandType: LegalTimelineCommand["type"];
  actorId: string | null;
  abilityId: string | null;
  requestedFrame: number;
  startFrame: number | null;
  cancelFrame: number | null;
  animationEndFrame: number | null;
  endFrame: number | null;
  status: "executed" | "waited" | "rejected";
  waitedFrames: number;
  failureCode?: TimelineFailureCode;
  energyBefore?: number;
  energyCost?: number;
}

export interface TimelineExecution {
  mode: "legal-frame-v1";
  fps: 60;
  legalityMode: TimelineLegalityMode;
  initialActiveCharacterId: string;
  finalActiveCharacterId: string;
  totalFrames: number;
  commandResults: TimelineCommandResult[];
  adjustments: TimelineAdjustment[];
  failures: TimelineFailure[];
  stateLog: TimelineStateLogEntry[];
}

export interface SimulationResult {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  engineVersion: string;
  dataVersion: string;
  randomSeed: string;
  reproducibilityKey: string;
  compatibilityMode: CompatibilityMode;
  config: SimConfig;
  /** Static scenario poses used to resolve actor-local attack geometry. */
  actorPoses: ActorPoseDefinition[];
  /** Effective per-target stats after applying shared enemy defaults. */
  enemyTargets: ResolvedEnemyTargetProfile[];
  damageEvents: DamageEvent[];
  hitEvents: DamageEvent[];
  /** Every scheduled target check, including misses that did no damage. */
  hitResolutionLog: HitResolutionLogEntry[];
  /** Core-resolved, half-open target phase windows consumed by the hit resolver. */
  targetPhaseTimeline: TargetPhaseTimelineEntry[];
  /** Core-resolved linear target movement segments consumed by geometry checks. */
  targetMotionTimeline: TargetMotionTimelineEntry[];
  skippedActions: SkippedAction[];
  actionLog: ActionLogEntry[];
  energyStats: Record<string, EnergySummary>;
  energyLog: EnergyLogEntry[];
  particleEvents: ParticleEventLog[];
  particleTriggerLog: ParticleTriggerLogEntry[];
  energyCurve: EnergyCurvePoint[];
  totalDamage: number;
  dps: number;
  reactedHits: number;
  byCharacter: Record<string, number>;
  characterSummaries: CharacterDamageSummary[];
  targetSummaries: EnemyTargetDamageSummary[];
  bySkill: SkillSummary[];
  perSecond: Array<Record<string, number>>;
  damageCurve: DamageCurvePoint[];
  auraTimeline: AuraTimelinePoint[];
  timelineExecution?: TimelineExecution;
}
