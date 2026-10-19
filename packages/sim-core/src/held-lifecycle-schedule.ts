import type { CoordinatedDamageEvent } from "./coordinated-cast-schedule";

/** Fixed source: gcsim b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541. */
export const HELD_LIFECYCLE_CAST_KINDS = [
  "held-aether-dendro-burst-pyro-c0", "held-lumine-dendro-burst-pyro-c0",
  "held-aether-hydro-skill-no-suffusion-c0", "held-lumine-hydro-skill-no-suffusion-c0",
  "held-aether-hydro-burst-c0", "held-lumine-hydro-burst-c0",
  "held-aether-pyro-skill-tap-c0", "held-lumine-pyro-skill-tap-c0",
  "held-aether-pyro-skill-hold-c0", "held-lumine-pyro-skill-hold-c0",
  "held-noelle-charged-c0",
] as const;
export type HeldLifecycleCastKind = typeof HELD_LIFECYCLE_CAST_KINDS[number];
export type HeldLifecycleTemplateRole = "periodic" | "explosion" | "dewdrop" | "torrent" | "arkhe"
  | "bubble" | "blazing" | "initial" | "scorching" | "spin" | "finisher";

export interface HeldDendroContext {
  pyroTransformFrame?: number | undefined;
  pyroApplicationConfirmed?: boolean | undefined;
  firstTransformationConfirmed?: boolean | undefined;
}
export interface HeldHydroContext {
  dewdropCount?: number | undefined;
  travelFrames?: number | undefined;
  arkheReady?: boolean | undefined;
  hpRatiosBeforeDewdrops?: number[] | undefined;
  noHealingOrDropletPickup?: boolean | undefined;
  priorA4Bonus?: number | undefined;
}
export interface HeldPyroContext {
  initialNightsoulPoints?: number | undefined;
  noExternalPointChanges?: boolean | undefined;
  damageEvents?: CoordinatedDamageEvent[] | undefined;
  /** Whether the initial attack dealt nonzero damage to any enemy, not only the selected target. */
  initialDamagePositive?: boolean | undefined;
}
export interface HeldNoelleContext {
  spinCount?: number | undefined;
  startsFromIdle?: boolean | undefined;
  attackSpeedBonus?: number | undefined;
  initialStamina?: number | undefined;
  staminaCostMultiplier?: number | undefined;
  noExternalStaminaChanges?: boolean | undefined;
  burstInactive?: boolean | undefined;
  shieldInactive?: boolean | undefined;
  /** Source uses absolute frame zero as an unset charge-state sentinel. */
  sourceCastFrame?: number | undefined;
}
export interface HeldLifecycleScheduleContext {
  casterId?: string | undefined;
  targetId?: string | undefined;
  freshCastConfirmed?: boolean | undefined;
  noHitlag?: boolean | undefined;
  noInterruption?: boolean | undefined;
  noReplacement?: boolean | undefined;
  fullObservedLifetime?: boolean | undefined;
  observedThroughFrame?: number | undefined;
  /** Every queued opportunity needs an explicit true (hit) or false (miss). */
  targetContacts?: Record<string, boolean> | undefined;
  dendro?: HeldDendroContext | undefined;
  hydroHold?: HeldHydroContext | undefined;
  pyro?: HeldPyroContext | undefined;
  noelle?: HeldNoelleContext | undefined;
}
export interface HeldLifecycleHitInstance {
  id: string;
  templateRole: HeldLifecycleTemplateRole;
  frame: number;
  snapshotFrame: number;
  snapshotId: string;
  targetId: string;
  triggerId?: string | undefined;
  triggerFrame?: number | undefined;
}
export interface HeldLifecycleCandidate extends HeldLifecycleHitInstance {
  contact: boolean | undefined;
}
export interface HeldLifecycleDecision {
  eventId: string;
  frame: number;
  accepted: boolean;
  reason: string;
}
export interface HeldLifecycleSchedule {
  instances: HeldLifecycleHitInstance[];
  candidates: HeldLifecycleCandidate[];
  issues: string[];
  decisions: HeldLifecycleDecision[];
  lifecycleEndFrame: number;
  requiredObservedThroughFrame: number;
  complete: boolean;
}

const nonnegative = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const positive = (value: unknown): value is number => nonnegative(value) && value > 0;
const named = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

/** Emits actual confirmed contacts separately from all source-queued opportunities. */
export function compileHeldLifecycleSchedule(kind: HeldLifecycleCastKind, context: HeldLifecycleScheduleContext): HeldLifecycleSchedule {
  const instances: HeldLifecycleHitInstance[] = [], candidates: HeldLifecycleCandidate[] = [];
  const issues: string[] = [], decisions: HeldLifecycleDecision[] = [];
  const issue = (message: string) => { if (!issues.includes(message)) issues.push(message); };
  const decide = (eventId: string, frame: number, accepted: boolean, reason: string) => decisions.push({ eventId, frame, accepted, reason });
  if (!(HELD_LIFECYCLE_CAST_KINDS as readonly string[]).includes(kind)) issue("尚不支持此持续施放分支。");
  if (!named(context.casterId)) issue("缺少施放角色的标识。");
  if (!named(context.targetId)) issue("缺少所选敌人的标识。");
  for (const [key, message] of [
    ["freshCastConfirmed", "请确认全新施放，且没有前次实体、标记、触发冷却或遗留技能状态。"],
    ["noHitlag", "此分支需要确认全程没有卡肉延长。"],
    ["noInterruption", "请确认没有中断施放或提前取消所需攻击。"],
    ["noReplacement", "请确认没有再次施放、实体替换、角色死亡或本分支之外的状态重置。"],
    ["fullObservedLifetime", "请确认记录覆盖完整持续过程，以及最后发出攻击的实际命中或落空。"],
  ] as const) if (context[key] !== true) issue(message);
  const contact = (id: string): boolean | undefined => context.targetContacts?.[id];
  const queue = (id: string, templateRole: HeldLifecycleTemplateRole, frame: number, snapshotFrame = frame,
    snapshotId = `sample:${snapshotFrame}`, triggerId?: string, triggerFrame?: number) => {
    const hit: HeldLifecycleHitInstance = { id, templateRole, frame, snapshotFrame, snapshotId, targetId: context.targetId ?? "", triggerId, triggerFrame };
    const confirmed = contact(id);
    candidates.push({ ...hit, contact: confirmed });
    if (confirmed === undefined) issue(`请明确候选攻击 ${id}（第 ${frame} 帧）是否实际命中所选敌人。`);
    else {
      decide(id, frame, confirmed, confirmed ? "已明确实际命中所选敌人。" : "已明确落空，不计入伤害。");
      if (confirmed) instances.push(hit);
    }
  };
  const dendro = kind.includes("-dendro-"), hydroHold = kind.includes("-hydro-skill-"), hydroBurst = kind.includes("-hydro-burst-");
  const pyroTap = kind.includes("-pyro-skill-tap-"), pyroHold = kind.includes("-pyro-skill-hold-");
  const noelle = kind === "held-noelle-charged-c0";
  let lifecycleEndFrame = 0;

  if (dendro) {
    const state = context.dendro;
    if (state?.pyroApplicationConfirmed !== true) issue("请确认火元素攻击实际对草灯莲完成元素附着并触发燃烧转化；仅命中敌人不能证明草灯莲转化。");
    if (state?.firstTransformationConfirmed !== true) issue("请确认火转化是草灯莲的首次转化，此前没有水或雷转化。");
    const transform = state?.pyroTransformFrame;
    // This complete branch transforms before the first periodic attack at91.
    // Later transformations need a periodic coefficient whose pinned level14
    // vector conflicts with the catalog; this protocol does not resolve it.
    if (!positive(transform) || transform <= 54 || transform >= 774) {
      issue("火转化帧须位于草灯莲生成后、自然到期前（第 55–773 帧）；生成或到期同帧的先后顺序不在此分支内。");
      lifecycleEndFrame = 774;
    } else if (transform >= 91) {
      issue("此完整分支仅支持第 55–90 帧首次火转化，即首次周期攻击之前；较晚转化所需的周期伤害在固定源码的第 14 级倍率与目录之间仍有真实冲突，不能补造或跳过此前伤害。");
      lifecycleEndFrame = transform;
    } else {
      queue("explosion", "explosion", transform + 60, 54, "lamp:54", "pyro-transformation", transform);
      lifecycleEndFrame = transform; // The lamp is killed immediately; its explosion remains queued.
    }
  }

  if (hydroHold) {
    const state = context.hydroHold, count = state?.dewdropCount, travel = state?.travelFrames;
    if (!positive(count) || count > 22) issue("请明确本次长按发出 1–22 枚露滴；不能从已命中数量反推发射次数。");
    if (!nonnegative(travel)) issue("请填写露滴的实际飞行参数帧数（固定来源默认值为 6）。");
    if (state?.arkheReady === undefined) issue("请明确本次施放时灵息之刺是否已脱离其独立冷却。");
    if (state?.noHealingOrDropletPickup !== true) issue("无充盈分支需要确认没有治疗、源水之滴拾取或生命上限变化。");
    if (state?.priorA4Bonus !== 0) issue("无充盈分支需要明确前次施放遗留的突破 4 激流附加伤害为 0。");
    if (positive(count) && count <= 22) {
      if (state?.hpRatiosBeforeDewdrops?.length !== count) issue("每枚露滴取样前都需要对应的实际当前生命比例，不能只填写起始生命。");
      for (let i = 0; i < count; i++) {
        const hp = state?.hpRatiosBeforeDewdrops?.[i];
        if (typeof hp !== "number" || !Number.isFinite(hp) || hp < 0 || hp > .5) issue(`第 ${i + 1} 枚露滴取样前的生命比例必须明确处于 0–50%，才符合无充盈分支。`);
      }
      if (nonnegative(travel)) {
        const extension = 15 * (count - 1);
        for (let i = 0; i < count; i++) {
          const sample = 54 + travel + 15 * i;
          queue(`dewdrop-${i + 1}`, "dewdrop", sample + 1, sample);
        }
        queue("torrent", "torrent", 57 + extension);
        if (state?.arkheReady === true) queue("arkhe", "arkhe", 103 + extension);
        lifecycleEndFrame = (kind.includes("-aether-") ? 90 : 89) + extension;
      }
    }
  }

  if (hydroBurst) {
    const first = kind.includes("-aether-") ? 34 : 36;
    // Exactly eight source-queued collision attempts, not eight guaranteed hits.
    for (let i = 0; i < 8; i++) queue(`tick-${i + 1}`, "bubble", first + 30 * i, 0, "cast:0");
    lifecycleEndFrame = first + 30 * 7;
  }

  if (pyroTap || pyroHold) {
    const state = context.pyro;
    if (state?.initialNightsoulPoints !== 0) issue("此全新施放分支需要明确施放前没有遗留夜魂值。");
    if (state?.noExternalPointChanges !== true) issue("请确认持续期间没有元素爆发等额外夜魂补充、消耗或状态延长。");
    const enter = pyroTap ? 19 : 48;
    // 42 points, 0.7 consumed every 6 frames; the sixtieth task exits immediately.
    const consumptionCount = Math.ceil(420 / 7); // Integer tenths avoid floating-point ceil(42 / .7) drift.
    lifecycleEndFrame = enter + consumptionCount * 6;
    if (pyroTap) {
      for (let frame = 24, tick = 1; frame < lifecycleEndFrame; frame += 66, tick++) queue(`tick-${tick}`, "blazing", frame);
    } else {
      queue("initial", "initial", 50);
      if (!state?.damageEvents) issue("请填写完整的外部敌人受伤事件记录；没有外部伤害时填写空数组。");
      type Trigger = CoordinatedDamageEvent & { internal?: boolean };
      const ids = new Set<string>();
      const events: Trigger[] = [];
      for (const event of state?.damageEvents ?? []) {
        if (!named(event.id) || ids.has(event.id)) { issue("外部伤害事件标识不能为空或重复。"); continue; }
        ids.add(event.id);
        if (!nonnegative(event.frame)) { issue(`伤害事件 ${event.id} 的帧数须为非负整数。`); continue; }
        events.push(event);
      }
      if (state?.initialDamagePositive === undefined) issue("请明确长按初击是否对任意敌人造成非零伤害，以判定初击自身是否触发炽火之槛；对所选敌人落空不代表未命中其他敌人。");
      else events.push({ id: "initial", frame: 50, actorId: context.casterId, tag: "skill", origin: "this-cast", damagePositive: state.initialDamagePositive, internal: true });
      events.sort((a, b) => a.frame - b.frame); // User array order is explicit order for external ties.
      let ready = 0;
      for (const event of events) {
        if (event.frame >= lifecycleEndFrame) { decide(event.id, event.frame, false, "夜魂值已耗尽，炽火之槛状态已移除。"); continue; }
        if (event.frame < ready) { decide(event.id, event.frame, false, "炽火之槛触发冷却尚未结束。"); continue; }
        if (event.tag === "burning" || event.tag === "hydro-swirl" || event.damagePositive === false) {
          decide(event.id, event.frame, false, "此类反应伤害或零伤害不满足炽火之槛触发条件。"); continue;
        }
        if (!event.internal && event.origin === "this-cast") { decide(event.id, event.frame, false, "本次初击由编译器单独处理，生成的追击不会再次作为外部触发事件。"); continue; }
        if (!event.internal && event.origin !== "external") { issue(`伤害事件 ${event.id} 需要明确其外部来源。`); continue; }
        if (!named(event.actorId) || (!event.internal && !named(event.targetId)) || event.tag === undefined || event.damagePositive === undefined) {
          issue(`伤害事件 ${event.id} 缺少来源角色、敌人、攻击类型或非零伤害判定。`); continue;
        }
        if (event.frame === 50 && !event.internal && state?.initialDamagePositive !== false) {
          issue(`外部事件 ${event.id} 与本次长按初击同在第 50 帧，当前记录不足以确定两者的触发先后。`);
        }
        const id = event.internal ? "proc-initial" : `proc-external-${event.id}`;
        queue(id, "scorching", event.frame + 12, event.frame + 12, `sample:${event.frame + 12}`, event.id, event.frame);
        // AddStatus is inclusive at expiry. A trigger at +180 remains on cooldown.
        ready = event.frame + 181;
        decide(event.id, event.frame, true, event.internal ? "本次长按初击的非零伤害触发炽火之槛。" : "外部敌人受伤事件触发炽火之槛。");
      }
    }
  }

  if (noelle) {
    const state = context.noelle, count = state?.spinCount;
    if (state?.startsFromIdle !== true) issue("此诺艾尔分支从静止状态开始重击，不能沿用普攻、冲刺或下落攻击的不同起手时间。");
    if (state?.attackSpeedBonus !== 0) issue("此诺艾尔分支需要明确攻击速度加成为 0。");
    if (state?.staminaCostMultiplier !== 1) issue("此诺艾尔分支需要明确重击体力消耗倍率为 1。");
    if (state?.noExternalStaminaChanges !== true) issue("请确认重击期间没有额外体力变化。");
    if (state?.burstInactive !== true || state?.shieldInactive !== true) issue("此基础物理重击分支需要确认全程没有大扫除或护心铠状态。");
    if (!positive(count)) issue("请填写实际连续旋转攻击次数，再由来源状态机校验可执行性。");
    else {
      if (count > 1 && !positive(state?.sourceCastFrame)) issue("连续旋转需要明确大于 0 的实际施放帧，以排除固定源码把绝对第 0 帧当作未开始状态的特殊情况。");
      // Fresh idle windup=56, one spin=23. Every next charge action must start
      // immediately at the previous hitmark. The five-second task only forces
      // the NEXT action to become the finisher; an already queued spin survives.
      const spinFrames: number[] = [];
      let actionStart = 0;
      for (let i = 0; i < count; i++) {
        if (actionStart >= 300) { issue("所填旋转次数要求在 5 秒时限结束后继续开启旋转；来源此时会转为终结一击。"); break; }
        const hitmark = actionStart + (i === 0 ? 56 : 0) + 23;
        spinFrames.push(hitmark);
        actionStart = hitmark;
      }
      const last = spinFrames.at(-1)!;
      const resetFrame = last + 13;
      let staminaDrains = 0;
      // Stamina tasks begin 18 frames after the 56-frame windup, costing12 each.
      // Action reset precedes character tasks on its frame; the limit stops later tasks.
      for (let frame = 74; frame < Math.min(resetFrame, 300); frame += 18) staminaDrains++;
      const neededStamina = 12 * staminaDrains;
      if (typeof state?.initialStamina !== "number" || !Number.isFinite(state.initialStamina) || state.initialStamina < neededStamina) {
        issue(`此不因体力提前结束的重击分支至少需要 ${neededStamina} 点起始体力。`);
      }
      spinFrames.forEach((frame, i) => queue(`spin-${i + 1}`, "spin", frame));
      queue("finisher", "finisher", last + 39);
      lifecycleEndFrame = last + 39;
    }
  }

  instances.sort((a, b) => a.frame - b.frame);
  candidates.sort((a, b) => a.frame - b.frame);
  const requiredObservedThroughFrame = Math.max(lifecycleEndFrame, ...candidates.map(hit => hit.frame));
  if (!nonnegative(context.observedThroughFrame) || context.observedThroughFrame < requiredObservedThroughFrame) {
    issue(`观察记录至少需要覆盖至第 ${requiredObservedThroughFrame} 帧，包括已经排队的末次命中或落空。`);
  }
  return { instances, candidates, issues, decisions, lifecycleEndFrame, requiredObservedThroughFrame, complete: issues.length === 0 };
}
