import type { TravelerMaleChargedHitState, TravelerMaleChargedScheduleContext } from "./traveler-male-charged-context";

export const TRAVELER_MALE_CHARGED_CAST_KINDS = [
  "male-charged-aether-anemo-c0", "male-charged-aether-geo-c0", "male-charged-aether-electro-c0",
  "male-charged-aether-dendro-c0", "male-charged-aether-hydro-c0", "male-charged-aether-pyro-c0", "male-charged-aether-cryo-c0",
] as const;
export type TravelerMaleChargedCastKind = typeof TRAVELER_MALE_CHARGED_CAST_KINDS[number];
export type TravelerMaleChargedRole = "hit-1" | "hit-2";
export interface TravelerMaleChargedHitInstance {
  id: TravelerMaleChargedRole;
  templateRole: TravelerMaleChargedRole;
  frame: number;
  snapshotFrame: number;
  snapshotId: string;
  targetId: string;
}
export interface TravelerMaleChargedCandidate extends TravelerMaleChargedHitInstance { contact: boolean | undefined }
export interface TravelerMaleChargedSchedule {
  instances: TravelerMaleChargedHitInstance[];
  candidates: TravelerMaleChargedCandidate[];
  decisions: Array<{ eventId: string; frame: number; accepted: boolean; reason: string }>;
  issues: string[];
  lifecycleEndFrame: number;
  requiredObservedThroughFrame: number;
  /** The uncancelled source animation is distinct from the complete two-hit damage tail. */
  animationEndFrame: number;
  complete: boolean;
}

export function travelerMaleChargedHitQualificationIssues(kind: string, state: TravelerMaleChargedHitState): string[] {
  const issues: string[] = [];
  if (state.externalInfusionActive !== false) issues.push("基础物理重击需要明确本击没有外部附魔。");
  if (state.trueMoonStoryBuffEnabled !== false) issues.push("基础重击需要明确 true_moon_story_buff 已关闭；不能省略特殊剧情重击输出。");
  if (kind === "male-charged-aether-cryo-c0") {
    if (state.cryoSkillActive !== false) issues.push("冰旅行者基础重击需要明确 travelercryo-e 未生效，排除额外倍率及协同冰晶。");
    if (state.cryoRadiance !== "none") issues.push("冰旅行者基础重击需要明确 radianceNone，无 Polestar Field 或恒星扩散状态。");
    if (state.cryoTrueMoonStacks !== 0) issues.push("冰旅行者基础重击需要明确特殊重击层数为 0。");
  }
  return issues;
}

/** These are opportunities; explicit contact records decide which attacks actually occur. */
export function compileTravelerMaleChargedSchedule(kind: TravelerMaleChargedCastKind, context: TravelerMaleChargedScheduleContext): TravelerMaleChargedSchedule {
  const instances: TravelerMaleChargedHitInstance[] = [], candidates: TravelerMaleChargedCandidate[] = [];
  const decisions: TravelerMaleChargedSchedule["decisions"] = [], issues: string[] = [];
  const issue = (reason: string) => { if (!issues.includes(reason)) issues.push(reason); };
  if (!(TRAVELER_MALE_CHARGED_CAST_KINDS as readonly string[]).includes(kind)) issue("尚未核准此男性重击分支。");
  if (!context.casterId?.trim()) issue("缺少重击施放角色的标识。");
  if (!context.targetId?.trim()) issue("缺少所选敌人的标识。");
  for (const [key, reason] of [
    ["freshCastConfirmed", "请确认这是一次新的两段重击，未混入前次攻击或其他技能输出。"],
    ["noHitlag", "此固定帧数分支需要确认重击期间没有卡肉延长。"],
    ["noInterruption", "请确认两段攻击均完成发出，没有提前中断或取消。"],
    ["noReplacement", "请确认两段攻击期间没有死亡、替换或状态重置。"],
    ["fullObservedLifetime", "请确认已观察本次两段重击的全部命中或落空。"],
    ["precedingNormalAttackConfirmed", "请确认已实际完成合法前置普攻；两段重击不包含这次前置普攻。"],
    ["actionReadyConfirmed", "请确认前置动作允许进入重击，且本次重击处于合法可施放状态。"],
  ] as const) if (context[key] !== true) issue(reason);
  if (!Number.isInteger(context.normalCounterBeforeCast) || context.normalCounterBeforeCast! < 1 || context.normalCounterBeforeCast! > 4) {
    issue("施放前普攻计数须为 1–4；静止或第五段归零后的状态不能直接进入此重击。");
  }
  if (context.staminaCostMultiplier !== 1) issue("此基础分支需要明确重击体力消耗倍率为 1。");
  if (typeof context.initialStamina !== "number" || !Number.isFinite(context.initialStamina) || context.initialStamina < 20) issue("本次重击开始时须明确至少有 20 点体力。");
  for (const [role, frame] of [["hit-1", 9], ["hit-2", 20]] as const) {
    const event: TravelerMaleChargedHitInstance = { id: role, templateRole: role, frame, snapshotFrame: frame, snapshotId: `sample:${frame}`, targetId: context.targetId ?? "" };
    const contact = context.targetContacts?.[role];
    candidates.push({ ...event, contact });
    const state = { ...context.sharedState, ...context.hitStates?.[`${kind}-${role}`], ...context.hitStates?.[`${kind}:${role}`] };
    travelerMaleChargedHitQualificationIssues(kind, state).forEach(reason => issue(`${role}：${reason}`));
    if (contact === undefined) issue(`请明确第 ${frame} 帧 ${role} 是否实际命中所选敌人。`);
    else {
      decisions.push({ eventId: role, frame, accepted: contact, reason: contact ? "已明确实际命中所选目标。" : "已明确落空，不计入伤害。" });
      if (contact) instances.push(event);
    }
  }
  if (!Number.isInteger(context.observedThroughFrame) || context.observedThroughFrame! < 20) issue("完整伤害观察至少须覆盖第 20 帧的第二段命中或落空。");
  return { instances, candidates, decisions, issues, lifecycleEndFrame: 20, requiredObservedThroughFrame: 20, animationEndFrame: 55, complete: issues.length === 0 };
}
