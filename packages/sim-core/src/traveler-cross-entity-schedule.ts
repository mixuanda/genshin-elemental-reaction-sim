import { travelerCrossEntityCastBaseSchema, type TravelerCrossEntityScheduleContext } from "./traveler-cross-entity-context";

export const TRAVELER_CROSS_ENTITY_CAST_KINDS = [
  "traveler-cross-aether-anemo-burst-c0", "traveler-cross-lumine-anemo-burst-c0",
  "traveler-cross-aether-dendro-burst-c0", "traveler-cross-lumine-dendro-burst-c0",
] as const;
export type TravelerCrossEntityCastKind = typeof TRAVELER_CROSS_ENTITY_CAST_KINDS[number];
export interface TravelerCrossEntityHitInstance {
  id: string; templateRole: "tick"; frame: number; snapshotFrame: number; snapshotId: string; targetId: string;
  untransformedAtHit?: boolean;
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

export function compileTravelerCrossEntitySchedule(kind: TravelerCrossEntityCastKind, raw: TravelerCrossEntityScheduleContext): TravelerCrossEntitySchedule {
  // Full calculator contexts additionally contain snapshots. They are validated
  // by the shared calculator schema and do not alter source event scheduling.
  const context = travelerCrossEntityCastBaseSchema.parse(Object.fromEntries(Object.entries(raw).filter(([key]) => key !== "snapshots")));
  const source = travelerCrossEntitySourceSchedule(kind), issues: string[] = [];
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
  } else if (context.anemo?.noAbsorption !== true) issues.push("此完整风Q分支需要明确全部吸收检查期间均未吸收元素。");
  if (context.observedThroughFrame === undefined || context.observedThroughFrame < source.requiredObservedThroughFrame) {
    issues.push(`完整观察须至少覆盖第${source.requiredObservedThroughFrame}帧的全部来源尾段。`);
  }
  const candidates: TravelerCrossEntityCandidate[] = [], instances: TravelerCrossEntityHitInstance[] = [];
  const decisions: TravelerCrossEntitySchedule["decisions"] = [];
  source.frames.forEach((frame, index) => {
    const id = `tick-${index + 1}`;
    const event: TravelerCrossEntityHitInstance = { id, templateRole: "tick", frame, snapshotFrame: source.snapshotFrame,
      snapshotId: `snapshot-${source.snapshotFrame}`, targetId: context.targetId ?? "unknown-target",
      ...(source.dendro && context.dendro?.noTransformation === true ? { untransformedAtHit: true } : {}) };
    const contact = context.targetContacts?.[id];
    candidates.push({ ...event, contact });
    if (contact === undefined) issues.push(`请明确第${frame}帧的${id}是否实际命中所选目标。`);
    else {
      if (contact) instances.push(event);
      decisions.push({ frame, reason: contact ? `${id}实际命中目标，按来源快照生成本击。` : `${id}明确未命中所选目标，不补造伤害。` });
    }
  });
  decisions.push(...(source.dendro ? [
    { frame: 54, reason: "生成草灯并冻结进攻面板；随后同帧的自身A1不追溯进入该快照。" },
    { frame: 774, reason: "固定核心先执行实体Tick，草灯12秒寿命耗尽；此后不再生成攻击。" },
    { frame: 816, reason: "最后可能的A1刷新在756帧，60帧窗口于816帧失效；实际命中时EM单独输入。" },
  ] : [
    { frame: 0, reason: "风Q起手冻结进攻面板；两性伤害队列均从94帧开始。" },
    { frame: 363, reason: "无吸收分支的最后递归检查任务返回，观察包含伤害结束后的检查尾段。" },
  ]));
  return { candidates, instances, decisions: decisions.sort((a, b) => a.frame - b.frame), issues,
    complete: issues.length === 0, lifecycleEndFrame: source.lifecycleEndFrame,
    requiredObservedThroughFrame: source.requiredObservedThroughFrame, snapshotFrame: source.snapshotFrame };
}
