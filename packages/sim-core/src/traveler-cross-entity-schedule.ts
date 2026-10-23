import { travelerCrossEntityCastBaseSchema, type TravelerAnemoAbsorbedElement, type TravelerCrossEntityScheduleContext } from "./traveler-cross-entity-context";
import { TRAVELER_ANEMO_ABSORPTION_CHECK_FRAMES } from "./traveler-cross-entity-anemo-source";

export const TRAVELER_CROSS_ENTITY_CAST_KINDS = [
  "traveler-cross-aether-anemo-burst-c0", "traveler-cross-lumine-anemo-burst-c0",
  "traveler-cross-aether-dendro-burst-c0", "traveler-cross-lumine-dendro-burst-c0",
] as const;
export type TravelerCrossEntityCastKind = typeof TRAVELER_CROSS_ENTITY_CAST_KINDS[number];
export interface TravelerCrossEntityHitInstance {
  id: string; templateRole: "tick" | "absorbed-tick"; frame: number; snapshotFrame: number; snapshotId: string; targetId: string;
  untransformedAtHit?: boolean;
  absorbedElement?: TravelerAnemoAbsorbedElement;
  c6ActiveBeforeHit?: boolean;
}
export interface TravelerCrossEntityCandidate extends TravelerCrossEntityHitInstance { contact: boolean | undefined }
export interface TravelerCrossEntitySchedule {
  candidates: TravelerCrossEntityCandidate[];
  instances: TravelerCrossEntityHitInstance[];
  decisions: Array<{ frame: number; reason: string }>;
  issues: string[]; complete: boolean;
  lifecycleEndFrame: number; requiredObservedThroughFrame: number; snapshotFrame: number;
}

/** Exact fixed-source opportunities, not geometric guarantees or maximum hits. */
export function travelerCrossEntitySourceSchedule(kind: TravelerCrossEntityCastKind) {
  if (!(TRAVELER_CROSS_ENTITY_CAST_KINDS as readonly string[]).includes(kind)) throw new Error("未登记的风／草旅行者完整来源分支。");
  const dendro = kind.includes("-dendro-");
  return {
    dendro, frames: Array.from({ length: dendro ? 8 : 9 }, (_, index) => dendro ? 91 + 90 * index : 94 + 30 * index),
    snapshotFrame: dendro ? 54 : 0,
    // Anemo's queue uses 94 for both genders, despite its separate status
    // duration of 336/334. The final no-op absorption callback is at 363.
    lifecycleEndFrame: dendro ? 774 : kind.includes("-aether-") ? 336 : 334,
    requiredObservedThroughFrame: dendro ? 816 : 363,
  };
}

export function compileTravelerCrossEntitySchedule(kind: TravelerCrossEntityCastKind, raw: TravelerCrossEntityScheduleContext, constellation = 0): TravelerCrossEntitySchedule {
  // Full calculator contexts additionally contain snapshots. They are validated
  // by the shared calculator schema and do not alter source event scheduling.
  const context = travelerCrossEntityCastBaseSchema.parse(Object.fromEntries(Object.entries(raw).filter(([key]) => key !== "snapshots")));
  const source = travelerCrossEntitySourceSchedule(kind), issues: string[] = [];
  const absorption = context.anemo;
  const validAbsorption = !source.dendro && absorption?.noAbsorption === false && absorption.absorptionElement !== undefined
    && absorption.absorptionStartFrame !== undefined && TRAVELER_ANEMO_ABSORPTION_CHECK_FRAMES.includes(absorption.absorptionStartFrame);
  // A successful check stops the recursive chain immediately. 363 is only the
  // no-absorption terminal task, not an observation requirement for every Q.
  const requiredObservedThroughFrame = validAbsorption
    ? Math.max(source.lifecycleEndFrame, absorption!.absorptionStartFrame!) : source.requiredObservedThroughFrame;
  for (const [key, reason] of [
    ["freshCastConfirmed", "请确认这是本次新施放，未混入前次实体或伤害。"],
    ["noHitlag", "固定来源完整帧日程要求明确没有卡肉。"],
    ["noInterruption", "请确认本次施放和已排队伤害没有被打断。"],
    ["noReplacement", "请确认没有重施、实体替换或未声明的状态重置。"],
    ["fullObservedLifetime", "请确认已观察全部来源机会及尾段，包含明确落空。"],
  ] as const) if (context[key] !== true) issues.push(reason);
  if (!context.casterId || !context.targetId) issues.push("需要明确本次施放者和所选目标身份。");
  if (context.trueMoonStoryBuffInactive !== true) issues.push("本基础分支需明确真月剧情增益关闭，不自动改变输入面板。");
  if (source.dendro) {
    if (context.dendro?.noTransformation !== true) issues.push("此完整草灯分支需要明确全程没有水、雷或火转化。");
    if (context.dendro?.noGadgetRemoval !== true) issues.push("需要确认草灯没有被提前移除，不能仅按12秒推测存活。");
  } else {
    if (absorption?.noAbsorption !== true && !validAbsorption) issues.push("完整风Q需要明确无吸收，或实际吸收元素及首次成功检查帧；不能默认从首击附加伤害。");
    if (absorption?.noAbsorption === true && (absorption.absorptionElement !== undefined || absorption.absorptionStartFrame !== undefined)) issues.push("全程未吸收与所填吸收元素或时点冲突，不能沿用另一分支的记录。");
    if (absorption?.absorptionStartFrame !== undefined && !TRAVELER_ANEMO_ABSORPTION_CHECK_FRAMES.includes(absorption.absorptionStartFrame)) issues.push("首次吸收必须是39+18n（n=0至17）的真实来源检查帧。");
    if (constellation >= 6 && absorption?.c6InitiallyInactive !== true) issues.push("完整C6当前只覆盖起手时所选敌人没有既有本命座减抗的分支；已有或未知旧减抗请单选实际命中。");
  }
  if (context.observedThroughFrame === undefined || context.observedThroughFrame < requiredObservedThroughFrame) {
    issues.push(`完整观察须至少覆盖第${requiredObservedThroughFrame}帧的全部来源尾段。`);
  }
  const candidates: TravelerCrossEntityCandidate[] = [], instances: TravelerCrossEntityHitInstance[] = [];
  const decisions: TravelerCrossEntitySchedule["decisions"] = [];
  const c6Expiry = new Map<string, number>();
  source.frames.forEach((frame, index) => {
    const pair: TravelerCrossEntityHitInstance[] = [{id: `tick-${index + 1}`, templateRole: "tick", frame, snapshotFrame: source.snapshotFrame,
      snapshotId: `snapshot-${source.snapshotFrame}`, targetId: context.targetId ?? "unknown-target",
      ...(source.dendro && context.dendro?.noTransformation === true ? {untransformedAtHit: true} : {})}];
    if (validAbsorption && frame >= absorption!.absorptionStartFrame!) pair.push({id: `absorb-${index + 1}`, templateRole: "absorbed-tick", frame,
      snapshotFrame: 0, snapshotId: `snapshot-0-absorbed-${absorption!.absorptionElement}`, targetId: context.targetId ?? "unknown-target", absorbedElement: absorption!.absorptionElement});
    const callbacks: string[] = [];
    for (const event of pair) {
      const element = event.absorbedElement ?? "anemo", contact = context.targetContacts?.[event.id];
      if (!source.dendro && constellation >= 6) event.c6ActiveBeforeHit = (c6Expiry.get(element) ?? 0) > frame;
      candidates.push({...event, contact});
      if (contact === undefined) issues.push(`请明确第${frame}帧的${event.id}是否实际命中所选目标。`);
      else {
        if (contact) {instances.push(event); if (!source.dendro && constellation >= 6) callbacks.push(element);}
        decisions.push({frame, reason: contact ? `${event.id}实际命中目标，按来源快照生成本击。` : `${event.id}明确未命中所选目标，不补造伤害或本击C6减抗。`});
      }
    }
    // Enemy.HandleAttack defers each callback via Tasks.Add(0). Both same-frame
    // damage calculations finish before either callback can mutate resistance.
    for (const element of callbacks) {
      c6Expiry.set(element, frame + 600);
      decisions.push({frame, reason: `同帧伤害结算后，实际${element}命中回调施加或刷新该元素C6减抗20%，到第${frame + 600}帧失效；不叠层。`});
    }
  });
  decisions.push(...(source.dendro ? [
    { frame: 54, reason: "生成草灯并冻结进攻面板；随后同帧的自身A1不追溯进入该快照。" },
    { frame: 774, reason: "固定核心先执行实体Tick，草灯12秒寿命耗尽；此后不再生成攻击。" },
    { frame: 816, reason: "最后可能的A1刷新在756帧，60帧窗口于816帧失效；实际命中时EM单独输入。" },
  ] : [
    { frame: 0, reason: "风Q起手冻结进攻面板；两性伤害队列均从94帧开始。" },
    ...(validAbsorption ? [{frame: absorption!.absorptionStartFrame!, reason: `首次成功吸收${absorption!.absorptionElement}，后续检查不再递归；仅此后已排队的tick机会可产生吸收附加。`}] :
      [{frame: 363, reason: "无吸收分支的最后递归检查任务返回，观察包含伤害结束后的检查尾段。"}]),
  ]));
  return { candidates, instances, decisions: decisions.sort((a, b) => a.frame - b.frame), issues,
    complete: issues.length === 0, lifecycleEndFrame: source.lifecycleEndFrame,
    requiredObservedThroughFrame, snapshotFrame: source.snapshotFrame };
}
