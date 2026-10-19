import type { PeriodicOrdinaryScheduleContext } from "./periodic-ordinary-context";

export const PERIODIC_ORDINARY_CAST_KINDS = [
  "periodic-ordinary-ineffa-skill-no-lunar-c0", "periodic-ordinary-columbina-skill-no-lunar-c0",
  "periodic-ordinary-lauma-skill-press-c0", "periodic-ordinary-chasca-burst-c0",
] as const;
export type PeriodicOrdinaryCastKind = typeof PERIODIC_ORDINARY_CAST_KINDS[number];
export interface PeriodicOrdinaryHitInstance {
  id: string; templateRole: string; frame: number; snapshotFrame: number; snapshotId: string; targetId: string;
  laumaOwnShredActive?: boolean;
}
export interface PeriodicOrdinaryCandidate extends PeriodicOrdinaryHitInstance { contact: boolean | undefined }
export interface PeriodicOrdinarySchedule {
  instances: PeriodicOrdinaryHitInstance[]; candidates: PeriodicOrdinaryCandidate[];
  decisions: Array<{ eventId: string; frame: number; accepted: boolean; reason: string }>;
  issues: string[]; lifecycleEndFrame: number; requiredObservedThroughFrame: number; complete: boolean;
}

/** Exact fixed-source schedules and observed targeting; no lifetime/interval hit-count estimate. */
export function compilePeriodicOrdinarySchedule(kind: PeriodicOrdinaryCastKind, context: PeriodicOrdinaryScheduleContext): PeriodicOrdinarySchedule {
  const instances: PeriodicOrdinaryHitInstance[] = [], candidates: PeriodicOrdinaryCandidate[] = [];
  const issues: string[] = [], decisions: PeriodicOrdinarySchedule["decisions"] = [];
  const issue = (message: string) => { if (!issues.includes(message)) issues.push(message); };
  for (const [key, label] of [["freshCastConfirmed", "全新施放且没有同名旧实体或触发记录"], ["noHitlag", "没有卡肉延长"],
    ["noInterruption", "没有打断"], ["noReplacement", "没有重施、替换、死亡或状态重置"], ["fullObservedLifetime", "观察覆盖完整实体与所有末尾命中"]] as const) {
    if (context[key] !== true) issue(`请确认${label}。`);
  }
  if (!context.casterId) issue("缺少施放角色标识。");
  if (!context.targetId) issue("缺少所选敌人标识。");
  let lifecycleEndFrame = 0, lastLaumaContact: number | undefined;
  const lauma = kind === "periodic-ordinary-lauma-skill-press-c0";
  const queue = (id: string, templateRole: string, frame: number, snapshotFrame = frame) => {
    const hit: PeriodicOrdinaryHitInstance = { id, templateRole, frame, snapshotFrame, snapshotId: `sample:${snapshotFrame}`, targetId: context.targetId ?? "",
      ...(lauma ? { laumaOwnShredActive: lastLaumaContact !== undefined && frame <= lastLaumaContact + 600 } : {}) };
    const contact = context.targetContacts?.[id];
    candidates.push({ ...hit, contact });
    if (contact === undefined) issue(`请明确第${frame}帧候选攻击 ${id} 是否命中所选敌人。`);
    else {
      decisions.push({ eventId: id, frame, accepted: contact, reason: contact ? "明确命中；本次伤害后才执行命中回调。" : "明确落空，不计伤害或所选目标的命中回调。" });
      if (contact) { instances.push(hit); if (lauma) lastLaumaContact = frame; }
    }
  };
  if (kind === "periodic-ordinary-ineffa-skill-no-lunar-c0") {
    if (context.ineffa?.noLunarChargedField !== true) issue("此普通完整分支要求全部机器人放电时均无月感电雷云，不能省略A1的直接月感电追击。");
    if (context.ineffa?.burstInactive !== true) issue("须确认没有此前或期间Q启动的A4精通转化；未知精通不能当作未生效。");
    queue("initial", "initial", 26);
    lifecycleEndFrame = 68 + 1200;
    for (let frame = 68 + 42, index = 1; frame <= lifecycleEndFrame; frame += 119, index++) queue(`discharge-${index}`, "discharge", frame);
    decisions.push({ eventId: "birgitta-expiry", frame: lifecycleEndFrame, accepted: true, reason: "68帧生成机器人，完整寿命1200帧；到期后排队的检查不再发射。" });
  } else if (kind === "periodic-ordinary-columbina-skill-no-lunar-c0") {
    if (context.columbina?.noLunarEvents !== true) issue("此普通完整分支要求全程没有月反应或月伤事件，不能跳过引力积累和直接月伤。");
    if (context.columbina?.noPriorGravityOrA1 !== true) issue("须确认没有此前引力任务或A1暴击层数残留。");
    queue("initial", "initial", 21);
    lifecycleEndFrame = 21 + 1500;
    for (let frame = 21 + 117, index = 1; frame <= lifecycleEndFrame; frame += 117, index++) queue(`ripple-${index}`, "ripple", frame);
  } else if (lauma) {
    if (context.lauma?.noPriorShred !== true) issue("本分支须明确目标没有前次菈乌玛减抗；本次每击之后才更新600帧减抗。");
    queue("initial", "initial", 16);
    for (let index = 0; index < 8; index++) queue(`sanctuary-${index + 1}`, "sanctuary", 62 + 117 * index);
    lifecycleEndFrame = 900;
  } else if (kind === "periodic-ordinary-chasca-burst-c0") {
    const state = context.chasca;
    if (state?.onlyOneEnemy !== true) issue("此分支要求只有一个合资格敌人；源码六枚追踪弹依次分配到施放时的敌人列表，不能把多目标弹算到同一人。");
    if (state?.nightsoulInactive !== true) issue("此分支须明确恰斯卡不在E夜魂飞行状态。");
    if (state?.noNightsoulBurst !== true) issue("须明确本次观察期间没有夜魂迸发，避免遗漏A4焚影追猎弹。");
    const party = state?.partyElements;
    const bullets = state?.bulletElements;
    if (!party) issue("请完整声明其余队伍成员元素；空列表仅表示明确无其他队员。");
    if (!bullets || bullets.length !== 6) issue("请记录六枚追踪弹的实际元素和顺序，不能用随机期望或任选元素代替。");
    if (party && bullets?.length === 6) {
      const phec = party.filter(element => ["pyro", "hydro", "electro", "cryo"].includes(element));
      const converted = [...phec, ...phec];
      const actual = bullets.slice(0, converted.length);
      if (actual.slice().sort().join() !== converted.sort().join() || bullets.slice(converted.length).some(element => element !== "anemo")) issue("实际子弹顺序与队伍转换规则不符：每位火水雷冰队员提供两枚对应元素弹，打乱后的转换弹在前，剩余为风弹。");
    }
    queue("initial", "initial", 96);
    if (bullets?.length === 6) [103, 139, 147, 153, 157, 160].forEach((frame, index) => queue(`bullet-${index + 1}`, bullets[index] === "anemo" ? "soulseeker" : `radiant-${bullets[index]}`, frame));
    lifecycleEndFrame = 160;
  } else issue("未知来源完整普通施放。");
  const requiredObservedThroughFrame = Math.max(lifecycleEndFrame, ...candidates.map(row => row.frame));
  if (context.observedThroughFrame === undefined || context.observedThroughFrame < requiredObservedThroughFrame) issue(`完整观察须覆盖至第${requiredObservedThroughFrame}帧。`);
  return { instances, candidates, issues, decisions, lifecycleEndFrame, requiredObservedThroughFrame, complete: issues.length === 0 };
}
