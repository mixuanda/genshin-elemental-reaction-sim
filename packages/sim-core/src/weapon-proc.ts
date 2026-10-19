import { getWeaponProcDefinition, getWeaponProcCoefficient, getWeaponProcCooldownFrames, getWeaponProcTriggerProbability, resolveEyeOfPerceptionDefinition, createWeaponProcLifecycleState, stepWeaponProcLifecycle, type WeaponProcLifecycleState } from "@genshin-dps-lab/reaction-formulas";
import type { ActiveStatusSnapshot, HitAttackTag, WeaponProcLogEntry, WeaponProcLifecycleLogEntry, WeaponProcModel } from "@genshin-dps-lab/schemas";
import { SeededRandom, type SeededRandomState } from "./energy";

export const INDEPENDENT_WEAPON_PROC_PROFILE = {
  id: "gcsim-independent-weapon-proc-v1",
  sourceRevision: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
  evidence: "fixed-source-assumed",
  cooldownClock: "global-frame-assumes-no-character-hitlag",
  cooldownBoundary: "expiry-frame-inclusive",
  callbackScope: "ordinary-damage-including-weapon-procs",
  assumptions: [
    "钺矛只由持有者普通攻击回调触发；固定源码没有额外前台或非零伤害限制。",
    "苍纹角杯与冷寂迸音要求持有者本人在场并对敌人造成伤害回调；不另筛攻击标签或零伤害，范围包括普通独立追击回调。",
    "钺矛名义冷却为 600 帧，两把生命值追击为 900 帧；到期帧仍处于冷却，下一帧才可再次触发。",
    "源码冷却受角色卡肉延长；本配置使用全局帧并明确假设无角色卡肉，不覆盖卡肉延长后的边界。",
    "实际触发时由宿主保存独立追击快照并排程到回调后 1 帧；生命值追击取触发时最大生命值，不取当前生命值。",
    "本接口只覆盖实际普通伤害回调，包括武器追击；没有接入反应伤害回调，不声明全部伤害来源的被动触发已完成。",
    "倍率与触发条件来自固定源码，未经当前游戏实测；追击独立结算暴击、防御和物理抗性。",
  ],
} as const;

export const WEAPON_PROC_RANDOM_PROFILE = {
  id: "gcsim-random-weapon-proc-v1",
  sourceRevision: INDEPENDENT_WEAPON_PROC_PROFILE.sourceRevision,
  evidence: "fixed-source-assumed",
  rngStream: "independent-weapon-proc-v1",
  rngAlgorithm: "fnv1a32-mulberry32-v1",
  matchesGcsimRandomSequence: false,
  cooldownClock: INDEPENDENT_WEAPON_PROC_PROFILE.cooldownClock,
  callbackScope: "ordinary-damage-deferred-same-phase-fifo",
  assumptions: [
    "随机武器在普通伤害回调的同帧、同相位 FIFO 队列尾部实际检查前台、冷却、攻击类型和概率；不从动作名称推断标签。",
    "吃虎鱼刀先抽样（roll ≤ 0.5），抽中后才检查非零伤害；试作古华和霜葬没有零伤害门槛，使用严格小于概率比较。",
    "霜葬在成功回调时读取原触发目标当前的独立冰光环或冻结状态，整次范围追击共用这一倍率；精炼 5 仍消耗随机抽样。",
    "成功回调即刻保存独立物理伤害快照；范围追击以原触发目标当时位置为圆心、半径 3。苍翠猎弓在该回调内固定九段快照与圆心，分别在 +1、+31、…、+241 帧交付；其他随机武器延后 1 帧。",
    "独立命名随机流仅保证本地复现，不等同 gcsim 的共享随机序列；角色卡肉延长、反应伤害回调和特殊月曜／星辉宿主不在本接口范围。",
  ],
} as const;

export function hasRandomWeaponProc(model?: WeaponProcModel): boolean {
  return model?.actors.some(actor => getWeaponProcDefinition(actor.weaponId)?.randomTrigger !== undefined) ?? false;
}

export const WEAPON_PROC_STATEFUL_PROFILE = {
  id: "gcsim-stateful-weapon-proc-v1",
  sourceRevision: INDEPENDENT_WEAPON_PROC_PROFILE.sourceRevision,
  evidence: "fixed-source-assumed",
  cooldownClock: INDEPENDENT_WEAPON_PROC_PROFILE.cooldownClock,
  callbackScope: "ordinary-damage-deferred-same-phase-fifo",
  assumptions: [
    "笛剑由本人前台普攻或重击累积五个音符；每次有效音符刷新 1800 帧窗口，30 帧音符间隔的到期帧仍阻塞。",
    "以理服人只由实际已接受的技能回调刷新 900 帧窗口并清除命中冷却；计划技能或被拒绝的能量请求不激活。",
    "流月针只在实际粒子或晶球分配完毕时按当前前台激活 300 帧窗口；满能量和零粒子数量的实际接收事件仍触发，固定回能不触发。",
    "流月针后续伤害回调不复查前台，要求本人普攻或重击且实际伤害非零，无额外命中冷却。",
    "竭泽实际技能激活有 720 帧冷却；900 帧窗口内三次独立追击，前两次设置 120 帧命中冷却，第三次只移除效果。",
    "四把武器保存回调时真实快照并延后 1 帧结算独立物理伤害；角色卡肉、反应伤害回调及月曜／星辉特殊宿主不在本接口范围。",
  ],
} as const;

export function hasStatefulWeaponProc(model?: WeaponProcModel): boolean {
  return model?.actors.some(actor => getWeaponProcDefinition(actor.weaponId)?.lifecycleKind !== undefined) ?? false;
}

export const MESSENGER_WEAPON_PROC_PROFILE = {
  id: "gcsim-messenger-weapon-proc-v1",
  sourceRevision: INDEPENDENT_WEAPON_PROC_PROFILE.sourceRevision,
  evidence: "fixed-source-assumed",
  cooldownClock: INDEPENDENT_WEAPON_PROC_PROFILE.cooldownClock,
  callbackScope: "ordinary-damage-deferred-same-phase-fifo",
  assumptions: [
    "信使依次检查本人、前台、实际命中弱点与 600 帧冷却；来源代码不额外筛选重击标签或非零伤害。",
    "弱点是明确命中属性，不能从暴击结果、动作名称或瞄准行为推断；到期帧仍受武器冷却阻止。",
    "成功回调立即保存独立快照，下一帧对原目标造成物理伤害；追击自身标记命中弱点，必暴且不消耗暴击随机抽样。",
    "独立追击使用持有者实际暴击伤害与物理加成，不继承宿主专属暴击覆盖；角色卡肉及反应伤害回调尚未接入。",
  ],
} as const;

export function hasMessengerWeaponProc(model?: WeaponProcModel): boolean {
  return model?.actors.some(actor => actor.weaponId === "messenger") ?? false;
}

export const DELAYED_WEAPON_PROC_PROFILE = {
  id: "gcsim-delayed-weapon-proc-v1",
  sourceRevision: INDEPENDENT_WEAPON_PROC_PROFILE.sourceRevision,
  evidence: "fixed-source-assumed",
  assumptions: [
    "水仙十字之剑必须明确持有者有无原生始基力；有原生始基力时来源不订阅伤害回调。",
    "无原生始基力时，本人前台普通／重击／下落实际伤害回调启动 720 帧冷却；零伤害可触发，到期帧仍阻断。",
    "延迟 6 帧的角色任务执行时才保存面板并读取原目标位置，立即结算半径 3 物理追击；触发后的换人不取消任务。",
    "6 帧是固定来源粗估，本模式明确忽略角色卡肉；芒／荒交互在来源中仍未实现，结果未经实机验证。",
  ],
} as const;
export const EYE_OF_PERCEPTION_WEAPON_PROC_PROFILE = {
  id: "gcsim-eye-of-perception-implementation-v1",
  sourceRevision: INDEPENDENT_WEAPON_PROC_PROFILE.sourceRevision,
  sourceRef: `https://github.com/genshinsim/gcsim/blob/${INDEPENDENT_WEAPON_PROC_PROFILE.sourceRevision}/internal/weapons/catalyst/perception/perception.go`,
  evidence: "fixed-source-assumed",
  assumptions: [
    "自动模式明确采用固定 gcsim perception.go：倍率为 2.1×精炼×0.3，普攻／重击本人伤害回调通过冷却后直接触发，没有 50% 概率门。",
    "这与目录及 Optimizer 的倍率和 50% 描述冲突；本模式只还原该固定源码，未经当前游戏实测。",
    "固定实现从玩家位置半径 8 选最近敌人，初击及至多四次续跳各延后 10 帧，半径 0.6；选中目标保持 36 帧防回跳标记。",
  ],
} as const;
export function hasDelayedWeaponProc(model?: WeaponProcModel): boolean {
  return model?.actors.some(actor => getWeaponProcDefinition(actor.weaponId)?.snapshotTiming === "delivery") ?? false;
}

export interface WeaponProcDamageInput {
  actorId: string;
  frame: number;
  parentDamageEventId: number;
  targetId: string;
  activeCharacterId: string | null;
  attackTag: HitAttackTag | null;
  damage: number;
  hitWeakPoint?: boolean;
}

export type WeaponProcDecision = Pick<WeaponProcLogEntry,
  | keyof WeaponProcDamageInput
  | "sourceProfileId" | "sourceRef" | "weaponId" | "refinement"
  | "scalingStat" | "coefficient" | "cooldownFrames"
  | "cooldownExpiresFrameBefore" | "cooldownExpiresFrameAfter" | "outcome"
  | "random" | "triggerAura"
  | "stateBefore" | "stateAfter"
>;

type WeaponProcLifecycleDecision = Omit<WeaponProcLifecycleLogEntry, "id" | "timeSeconds" | "eventPriority" | "eventSequence" | "actionLogIndex" | "particleEventId">;

/** The actual pending attack owns these values; audit logs do not schedule it. */
export interface PendingWeaponProcContext {
  actor: WeaponProcModel["actors"][number];
  triggerFrame: number;
  deliveryIndex?: number;
  deliveryFrame?: number;
  snapshotFrame?: number;
  triggerBuffStatuses: ActiveStatusSnapshot[];
  /** Present only for the new source-random procs, captured on their actual queued attack. */
  random?: NonNullable<WeaponProcLogEntry["random"]>;
  triggerAura?: WeaponProcLogEntry["triggerAura"];
  selectedCoefficient?: number;
  cooldownFrames?: number;
  cooldownExpiresFrameAfter?: number | null;
  stateBefore?: WeaponProcLifecycleState;
  stateAfter?: WeaponProcLifecycleState;
}

export interface WeaponProcCheckpointState {
  actors: WeaponProcModel["actors"];
  cooldownExpiresFrames: ReadonlyMap<string, number>;
  lifecycleStates?: ReadonlyMap<string, WeaponProcLifecycleState>;
  random?: SeededRandomState;
}

/** Called by the host after an actual ordinary hit, including a weapon proc. */
export class IndependentWeaponProcRuntime {
  private readonly actors: Map<string, WeaponProcModel["actors"][number]>;
  private readonly cooldownExpiresFrames = new Map<string, number>();
  private readonly random: SeededRandom | undefined;
  private drawCount = 0;
  private readonly lifecycleStates = new Map<string, WeaponProcLifecycleState>();

  constructor(model: WeaponProcModel, seed?: string) {
    this.actors = new Map(model.actors.map(actor => [actor.actorId, actor]));
    for (const actor of model.actors) if (getWeaponProcDefinition(actor.weaponId)?.lifecycleKind !== undefined) this.lifecycleStates.set(actor.actorId, createWeaponProcLifecycleState());
    if (hasRandomWeaponProc(model)) {
      if (seed === undefined) throw new Error("随机武器追击需要明确的模拟种子。");
      this.random = new SeededRandom(`${seed}\u0000${WEAPON_PROC_RANDOM_PROFILE.rngStream}`);
    }
  }

  actor(actorId: string): WeaponProcModel["actors"][number] | undefined {
    const actor = this.actors.get(actorId);
    return actor?.weaponId === "swordofnarzissenkreuz" && actor.hasInnateArkhe === true ? undefined : actor;
  }

  captureState(): WeaponProcCheckpointState {
    return { actors: structuredClone([...this.actors.values()]), cooldownExpiresFrames: new Map(this.cooldownExpiresFrames),
      lifecycleStates: new Map([...this.lifecycleStates].map(([actorId, state]) => [actorId, structuredClone(state)])),
      ...(this.random === undefined ? {} : { random: this.random.captureState() }) };
  }

  onLifecycle(kind: "skill" | "particle-received", frame: number, activeCharacterId: string | null): WeaponProcLifecycleDecision[] {
    const decisions: WeaponProcLifecycleDecision[] = [];
    for (const actor of this.actors.values()) {
      const definition = getWeaponProcDefinition(actor.weaponId)!;
      const weaponId = definition.lifecycleKind;
      if (weaponId === undefined || (kind === "skill" ? weaponId !== "debateclub" && weaponId !== "endoftheline" : weaponId !== "crescentpike")) continue;
      const stateBefore = this.lifecycleStates.get(actor.actorId)!;
      const transition = stepWeaponProcLifecycle(weaponId, stateBefore, { kind, frame, holderOnField: activeCharacterId === actor.actorId });
      this.lifecycleStates.set(actor.actorId, transition.state);
      decisions.push({ sourceProfileId: WEAPON_PROC_STATEFUL_PROFILE.id, sourceRef: definition.sourceRef, actorId: actor.actorId,
        weaponId, refinement: actor.refinement, kind, frame, activeCharacterId,
        outcome: transition.outcome as WeaponProcLifecycleDecision["outcome"], stateBefore: structuredClone(stateBefore), stateAfter: structuredClone(transition.state) });
    }
    return decisions;
  }

  onDamage(input: WeaponProcDamageInput, readTriggerAura?: () => { cryo: boolean; frozen: boolean }): WeaponProcDecision {
    const actor = this.actors.get(input.actorId)!;
    const definition = resolveEyeOfPerceptionDefinition(getWeaponProcDefinition(actor.weaponId)!, actor.eyeOfPerceptionProfile);
    const cooldownFrames = getWeaponProcCooldownFrames(definition, actor.refinement);
    if (definition.lifecycleKind !== undefined) {
      const stateBefore = this.lifecycleStates.get(input.actorId)!;
      const transition = stepWeaponProcLifecycle(definition.lifecycleKind, stateBefore, { kind: "damage", frame: input.frame,
        holderOnField: input.activeCharacterId === input.actorId, isHolderDamage: true, attackTag: input.attackTag, damage: input.damage });
      this.lifecycleStates.set(input.actorId, transition.state);
      return { ...input, sourceProfileId: WEAPON_PROC_STATEFUL_PROFILE.id, sourceRef: definition.sourceRef,
        weaponId: actor.weaponId, refinement: actor.refinement, scalingStat: definition.scalingStat,
        coefficient: getWeaponProcCoefficient(definition, actor.refinement), cooldownFrames,
        cooldownExpiresFrameBefore: stateBefore.hitCooldownExpiresFrame, cooldownExpiresFrameAfter: transition.state.hitCooldownExpiresFrame,
        outcome: transition.outcome as WeaponProcDecision["outcome"], stateBefore: structuredClone(stateBefore), stateAfter: structuredClone(transition.state) };
    }
    const cooldownExpiresFrameBefore = this.cooldownExpiresFrames.get(input.actorId) ?? null;
    if (definition.requiresWeakPoint) {
      const outcome: WeaponProcDecision["outcome"] = input.activeCharacterId !== input.actorId ? "off-field"
        : input.hitWeakPoint !== true ? "not-weak-point"
        : cooldownExpiresFrameBefore !== null && input.frame <= cooldownExpiresFrameBefore ? "cooldown-blocked" : "triggered";
      if (outcome === "triggered") this.cooldownExpiresFrames.set(input.actorId, input.frame + cooldownFrames);
      return { ...input, sourceProfileId: MESSENGER_WEAPON_PROC_PROFILE.id, sourceRef: definition.sourceRef,
        weaponId: actor.weaponId, refinement: actor.refinement, scalingStat: definition.scalingStat,
        coefficient: getWeaponProcCoefficient(definition, actor.refinement), cooldownFrames, hitWeakPoint: input.hitWeakPoint === true,
        cooldownExpiresFrameBefore, cooldownExpiresFrameAfter: this.cooldownExpiresFrames.get(input.actorId) ?? null, outcome };
    }
    let outcome: WeaponProcDecision["outcome"];
    let random: WeaponProcLogEntry["random"];
    let triggerAura: WeaponProcLogEntry["triggerAura"] = null;

    if (definition.randomTrigger !== undefined) {
      const probability = getWeaponProcTriggerProbability(definition, actor.refinement)!;
      random = { rngStream: WEAPON_PROC_RANDOM_PROFILE.rngStream, probability, successComparison: definition.randomTrigger.successComparison,
        roll: null, drawIndex: null, drawCountBefore: this.drawCount, drawCountAfter: this.drawCount };
      if (input.activeCharacterId !== input.actorId) outcome = "off-field";
      else if (actor.weaponId === "theviridescenthunt" && !definition.triggerAttackTags!.some(tag => tag === input.attackTag)) outcome = "wrong-attack-tag";
      else if (cooldownExpiresFrameBefore !== null && input.frame <= cooldownExpiresFrameBefore) outcome = "cooldown-blocked";
      else if (definition.triggerAttackTags !== null && !definition.triggerAttackTags.some(tag => tag === input.attackTag)) outcome = "wrong-attack-tag";
      else {
        random.drawIndex = this.drawCount++;
        random.roll = this.random!.next();
        random.drawCountAfter = this.drawCount;
        const won = random.successComparison === "<=" ? random.roll <= probability : random.roll < probability;
        if (!won) outcome = "failed-roll";
        else if (definition.randomTrigger.zeroDamageGate === "after-roll" && input.damage === 0) outcome = "zero-damage";
        else {
          outcome = "triggered";
          this.cooldownExpiresFrames.set(input.actorId, input.frame + cooldownFrames);
          if (definition.cryoOrFrozenCoefficients !== undefined) {
            if (readTriggerAura === undefined) throw new Error("霜葬追击缺少实际回调目标附着读取。");
            triggerAura = readTriggerAura();
          }
        }
      }
    } else if (definition.snapshotTiming === "delivery" && input.activeCharacterId !== input.actorId) {
      outcome = "off-field";
    } else if (definition.triggerAttackTags !== null && !definition.triggerAttackTags.some(tag => tag === input.attackTag)) {
      outcome = "wrong-attack-tag";
    } else if (definition.requiresOnField && input.activeCharacterId !== input.actorId) {
      outcome = "off-field";
    } else if (cooldownExpiresFrameBefore !== null && input.frame <= cooldownExpiresFrameBefore) {
      outcome = "cooldown-blocked";
    } else {
      outcome = "triggered";
      this.cooldownExpiresFrames.set(input.actorId, input.frame + cooldownFrames);
    }

    return {
      ...input,
      sourceProfileId: actor.weaponId === "eyeofperception" ? EYE_OF_PERCEPTION_WEAPON_PROC_PROFILE.id : definition.snapshotTiming === "delivery" ? DELAYED_WEAPON_PROC_PROFILE.id : random === undefined ? INDEPENDENT_WEAPON_PROC_PROFILE.id : WEAPON_PROC_RANDOM_PROFILE.id,
      sourceRef: definition.sourceRef,
      weaponId: actor.weaponId,
      refinement: actor.refinement,
      scalingStat: definition.scalingStat,
      coefficient: triggerAura === null ? definition.coefficients[actor.refinement - 1]!
        : getWeaponProcCoefficient(definition, actor.refinement, triggerAura.cryo || triggerAura.frozen),
      cooldownFrames,
      cooldownExpiresFrameBefore,
      cooldownExpiresFrameAfter: this.cooldownExpiresFrames.get(input.actorId) ?? null,
      outcome,
      ...(random === undefined ? {} : { random }),
      ...(definition.cryoOrFrozenCoefficients === undefined ? {} : { triggerAura }),
    };
  }
}
