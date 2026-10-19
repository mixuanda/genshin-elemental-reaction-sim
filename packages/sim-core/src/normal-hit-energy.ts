import { SeededRandom, type SeededRandomState } from "./energy";

export type NormalHitEnergyWeaponType = "sword" | "claymore" | "polearm" | "bow" | "catalyst";

export const NORMAL_HIT_ENERGY_PROFILE = {
  id: "gcsim-normal-hit-energy-reference-v1",
  sourceRevision: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
  sourceRef: "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/energy.go#L30-L89",
  evidence: "fixed-source-assumed",
  globalIcdFrames: 12,
  energyPerSuccess: 1,
  rngStream: "normal-hit-energy-v1",
  rngAlgorithm: "fnv1a32-mulberry32-v1",
  matchesGcsimRandomSequence: false,
  assumptions: [
    "锁定源码将成功后的全队共享 12 帧间隔标为未确认的假设（TODO），不宣称为当前服务器实测规则。",
    "锁定源码将切换角色时重置所有角色概率标为假设（TODO）；切换不清除共享间隔。",
    "使用带名称的独立种子子流；相同本地输入可复现，不声称与 gcsim 同一 seed 的随机序列一致。",
    "宿主仅在实际敌人 HandleAttack 的普通攻击或 Extra 标签事件调用；不按伤害大于零、满能量或命中组去重过滤。",
    "成功请求固定 1 点能量；实际增加与溢出由宿主按能量上限处理，不乘充能效率。",
  ],
} as const;

const FAILURE_INCREMENT: Record<NormalHitEnergyWeaponType, number> = {
  sword: 0.05,
  claymore: 0.10,
  polearm: 0.04,
  bow: 0.05,
  catalyst: 0.10,
};

const baseProbability = (weaponType: NormalHitEnergyWeaponType): number => weaponType === "sword" ? 0.10 : 0;

export interface NormalHitEnergyActor {
  actorId: string;
  weaponType: NormalHitEnergyWeaponType;
}

export interface NormalHitEnergyDamageInput {
  frame: number;
  actorId: string;
  attackTag: "normal" | "extra";
  damageEventId: number;
  hitGroupId?: string;
}

interface NormalHitEnergyAuditIdentity {
  sourceProfileId: typeof NORMAL_HIT_ENERGY_PROFILE.id;
  rngStream: typeof NORMAL_HIT_ENERGY_PROFILE.rngStream;
  sourceRef: typeof NORMAL_HIT_ENERGY_PROFILE.sourceRef;
}

export interface NormalHitEnergyDecision extends NormalHitEnergyAuditIdentity {
  kind: "damage";
  frame: number;
  actorId: string;
  weaponType: NormalHitEnergyWeaponType;
  attackTag: "normal" | "extra";
  damageEventId: number;
  hitGroupId: string | null;
  outcome: "gained" | "failed-roll" | "icd-blocked";
  /** Requested fixed gain. Host must still record actual gain and overflow. */
  energyRequested: 0 | 1;
  baselineProbability: number;
  failureIncrement: number;
  probabilityBefore: number;
  probabilityAfter: number;
  roll: number | null;
  /** Zero-based ordinal in this named RNG substream; blocked events do not draw. */
  drawIndex: number | null;
  drawCountBefore: number;
  drawCountAfter: number;
  icdBlocked: boolean;
  globalIcdReadyFrameBefore: number;
  globalIcdReadyFrameAfter: number;
}

export interface NormalHitEnergyProbabilityState extends NormalHitEnergyActor { probability: number }

export interface NormalHitEnergyCheckpointState {
  actors: NormalHitEnergyProbabilityState[];
  globalIcdReadyFrame: number;
  lastFrame: number;
  drawCount: number;
  random: SeededRandomState;
}

export interface NormalHitEnergySwapDecision extends NormalHitEnergyAuditIdentity {
  kind: "swap";
  frame: number;
  activeActorId: string;
  probabilitiesBefore: NormalHitEnergyProbabilityState[];
  probabilitiesAfter: NormalHitEnergyProbabilityState[];
  globalIcdReadyFrameBefore: number;
  globalIcdReadyFrameAfter: number;
  drawCountBefore: number;
  drawCountAfter: number;
}

/** Host may extend each row with its queue tuple and actual energy ledger. */
export type NormalHitEnergyAuditRow = NormalHitEnergyDecision | NormalHitEnergySwapDecision;

const auditIdentity: NormalHitEnergyAuditIdentity = {
  sourceProfileId: NORMAL_HIT_ENERGY_PROFILE.id,
  rngStream: NORMAL_HIT_ENERGY_PROFILE.rngStream,
  sourceRef: NORMAL_HIT_ENERGY_PROFILE.sourceRef,
};

/**
 * Source-shaped probability state, separate from the host's energy ledger.
 * Each onDamage call represents an actual OnEnemyDamage callback: repeated
 * hitGroupId values intentionally remain separate attempts, including zero
 * damage groups and actors whose energy is already full.
 */
export class NormalHitEnergyRuntime {
  private readonly actors: NormalHitEnergyActor[];
  private readonly actorById: Map<string, NormalHitEnergyActor>;
  private readonly probabilityByActor = new Map<string, number>();
  private readonly random: SeededRandom;
  private globalIcdReadyFrame = 0;
  private drawCount = 0;
  private lastFrame = 0;

  constructor(input: { seed: string; actors: readonly NormalHitEnergyActor[] }) {
    if (typeof input.seed !== "string") throw new TypeError("Normal-hit energy seed must be a string");
    if (input.actors.length < 1 || input.actors.length > 4) throw new RangeError("Normal-hit energy requires one to four configured actors");
    this.actors = input.actors.map(actor => ({ ...actor }));
    this.actorById = new Map();
    for (const actor of this.actors) {
      if (!actor.actorId.trim() || this.actorById.has(actor.actorId)) throw new Error("Normal-hit energy actor IDs must be nonempty and unique");
      if (!Object.hasOwn(FAILURE_INCREMENT, actor.weaponType)) throw new Error(`Unsupported normal-hit energy weapon type ${actor.weaponType}`);
      this.actorById.set(actor.actorId, actor);
      this.probabilityByActor.set(actor.actorId, baseProbability(actor.weaponType));
    }
    this.random = new SeededRandom(`${input.seed}\u0000${NORMAL_HIT_ENERGY_PROFILE.rngStream}`);
  }

  private validateFrame(frame: number): void {
    if (!Number.isSafeInteger(frame) || frame < this.lastFrame) throw new RangeError("Normal-hit energy events require nondecreasing nonnegative integer frames");
  }

  private probabilities(): NormalHitEnergyProbabilityState[] {
    return this.actors.map(actor => ({ ...actor, probability: this.probabilityByActor.get(actor.actorId)! }));
  }

  captureState(): NormalHitEnergyCheckpointState {
    return { actors: this.probabilities(), globalIcdReadyFrame: this.globalIcdReadyFrame,
      lastFrame: this.lastFrame, drawCount: this.drawCount, random: this.random.captureState() };
  }

  onDamage(input: NormalHitEnergyDamageInput): NormalHitEnergyDecision {
    this.validateFrame(input.frame);
    const actor = this.actorById.get(input.actorId);
    if (!actor) throw new Error(`Unknown normal-hit energy actor ${input.actorId}`);
    if (input.attackTag !== "normal" && input.attackTag !== "extra") throw new Error("Normal-hit energy accepts only actual normal/extra damage callbacks");
    if (!Number.isSafeInteger(input.damageEventId) || input.damageEventId < 0) throw new RangeError("Normal-hit energy damageEventId must be a nonnegative integer");
    if (input.hitGroupId !== undefined && (typeof input.hitGroupId !== "string" || !input.hitGroupId.trim())) throw new TypeError("Normal-hit energy hitGroupId must be a nonempty string when supplied");
    this.lastFrame = input.frame;
    const probabilityBefore = this.probabilityByActor.get(actor.actorId)!;
    const readyBefore = this.globalIcdReadyFrame;
    const drawCountBefore = this.drawCount;
    const icdBlocked = input.frame < readyBefore;
    let roll: number | null = null;
    let drawIndex: number | null = null;
    let outcome: NormalHitEnergyDecision["outcome"] = "icd-blocked";
    if (!icdBlocked) {
      drawIndex = this.drawCount++;
      roll = this.random.next();
      if (roll <= probabilityBefore) {
        outcome = "gained";
        this.globalIcdReadyFrame = input.frame + NORMAL_HIT_ENERGY_PROFILE.globalIcdFrames;
        this.probabilityByActor.set(actor.actorId, baseProbability(actor.weaponType));
      } else {
        outcome = "failed-roll";
        // Preserve source floating-point addition, without an invented cap.
        this.probabilityByActor.set(actor.actorId, probabilityBefore + FAILURE_INCREMENT[actor.weaponType]);
      }
    }
    return {
      ...auditIdentity, kind: "damage", frame: input.frame, actorId: actor.actorId, weaponType: actor.weaponType,
      attackTag: input.attackTag, damageEventId: input.damageEventId, hitGroupId: input.hitGroupId ?? null,
      outcome, energyRequested: outcome === "gained" ? 1 : 0,
      baselineProbability: baseProbability(actor.weaponType), failureIncrement: FAILURE_INCREMENT[actor.weaponType],
      probabilityBefore, probabilityAfter: this.probabilityByActor.get(actor.actorId)!,
      roll, drawIndex, drawCountBefore, drawCountAfter: this.drawCount, icdBlocked,
      globalIcdReadyFrameBefore: readyBefore, globalIcdReadyFrameAfter: this.globalIcdReadyFrame,
    };
  }

  /** Source TODO assumption: reset every actor's chance, preserve shared ICD. */
  onSwap(frame: number, activeActorId: string): NormalHitEnergySwapDecision {
    this.validateFrame(frame);
    if (!this.actorById.has(activeActorId)) throw new Error(`Unknown normal-hit energy swap actor ${activeActorId}`);
    this.lastFrame = frame;
    const probabilitiesBefore = this.probabilities();
    for (const actor of this.actors) this.probabilityByActor.set(actor.actorId, baseProbability(actor.weaponType));
    return { ...auditIdentity, kind: "swap", frame, activeActorId, probabilitiesBefore, probabilitiesAfter: this.probabilities(),
      globalIcdReadyFrameBefore: this.globalIcdReadyFrame, globalIcdReadyFrameAfter: this.globalIcdReadyFrame,
      drawCountBefore: this.drawCount, drawCountAfter: this.drawCount };
  }
}
