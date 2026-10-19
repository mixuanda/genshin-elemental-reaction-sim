import type {
  TravelerCryoRadiance, TravelerCryoStateEvent, TravelerCryoStateScheduleContext, TravelerCryoTriggerCallback,
} from "./traveler-cryo-state-context";

export type TravelerCryoStateCastKind = "skill" | "burst";
export type TravelerCryoStateRole = TravelerCryoStateEvent["templateRole"];
export interface TravelerCryoStateHitInstance extends Omit<TravelerCryoStateEvent, "candidateId"> { id: string }
export interface TravelerCryoStateCandidate extends TravelerCryoStateHitInstance { contact: boolean | undefined }
export interface TravelerCryoStateSchedule {
  candidates: TravelerCryoStateCandidate[];
  instances: TravelerCryoStateHitInstance[];
  decisions: Array<{ eventId: string; frame: number; accepted: boolean; reason: string }>;
  issues: string[];
  lifecycleEndFrame: number;
  requiredObservedThroughFrame: number;
  complete: boolean;
}

const tickerFrames = [178, 354, 530, 706] as const;
const burstOffsets = [0, 33, 38, 35, 42] as const;
const skillExpiry = 739;
const burstRole = (radiance: TravelerCryoRadiance): TravelerCryoStateRole => radiance === "stellar-conduct"
  ? "burst-conduct" : radiance === "stellar-swirl" ? "burst-swirl" : "burst-ordinary";
const travel = (kind: TravelerCryoStateCastKind, context: TravelerCryoStateScheduleContext) => context.travelFrames ?? (kind === "skill" ? 9 : 6);

function callbackIssues(callback: TravelerCryoTriggerCallback, context: TravelerCryoStateScheduleContext, gender: "aether" | "lumine"): string[] {
  const issues: string[] = [];
  if (!context.casterId || callback.actorId !== context.casterId) issues.push("协同来源必须是本次冰旅行者本人实际命中的回调。");
  if (!callback.evidence.reference.trim() || callback.evidence.legalActionConfirmed !== true || callback.evidence.actualEnemyHitConfirmed !== true) {
    issues.push("协同来源需要可追溯的实际敌人命中记录，并明确其来源动作合法；不能从候选帧推定已经发生。");
  }
  if (callback.attackTag === "plunge" && callback.evidence.kind === "pinned-gcsim-execution") {
    if (gender === "aether") issues.push("固定 gcsim 尚未实现空的下落动作，不能用该执行器认证男性下落触发；需独立实际观察或外部执行证据。");
    else if (callback.airborneState !== "xianyun") issues.push("固定 gcsim 的荧下落只实现闲云腾空分支，执行证据必须明确该腾空状态。");
  }
  return issues;
}

/** Checks only this already observed hit and its own trigger. It deliberately
 * does not demand a complete future lifetime or other hits' contact records. */
export function validateTravelerCryoStateEvent(kind: TravelerCryoStateCastKind, event: TravelerCryoStateEvent,
  context: TravelerCryoStateScheduleContext, gender: "aether" | "lumine" = "aether"): string[] {
  const issues: string[] = [];
  if (context.trueMoonStoryBuffEnabled !== false) issues.push("需明确 true_moon_story_buff 关闭，不能把未知剧情增益当作关闭。");
  if (context.noHitlag !== true) issues.push("本击固定帧协议需要明确相关取样与飞行没有卡肉延长。");
  if (!context.casterId || !context.targetId || event.targetId !== context.targetId) issues.push("本击需要明确施放者及与事件一致的所选敌人。");
  if (kind === "burst") {
    const match = /^burst-([1-5])$/.exec(event.candidateId);
    const ordinal = match === null ? -1 : Number(match[1]) - 1;
    if (ordinal < 0 || event.snapshotFrame !== 36 || event.frame !== 36 + travel(kind, context) + (burstOffsets[ordinal] ?? 0)) {
      issues.push("Q事件必须属于第36帧构造的五个来源队列位置之一，包含本次实际飞行帧。");
    }
    if (event.radiance === undefined || event.templateRole !== burstRole(event.radiance)) issues.push("Q本击类型必须匹配第36帧实际锁定的辉映。");
    if (event.frostglowStacks === undefined || ordinal >= 3 && event.frostglowStacks !== 8) issues.push("Q本击须记录第36帧实际消耗寒辉；第4、5个队列位置必须为8层。");
  } else if (event.templateRole === "initial") {
    if (event.candidateId !== "initial" || event.frame !== 19 || event.snapshotFrame !== 19) issues.push("E初击固定在第19帧取样及命中。");
  } else if (event.templateRole === "crystal") {
    const periodic = /^periodic-([1-4])-([1-2])$/.exec(event.candidateId);
    if (periodic !== null) {
      const ticker = tickerFrames[Number(periodic[1]) - 1]!;
      const snapshot = ticker + (Number(periodic[2]) - 1) * 13;
      if (event.triggerFrame !== ticker || event.snapshotFrame !== snapshot || event.frame !== snapshot + travel(kind, context)) issues.push("定时冰晶须来自178/354/530/706帧检查及该次+0/+13帧取样，再加实际飞行时间。");
      if (event.radiance === undefined || event.radiance === "stellar-conduct") issues.push("定时冰晶须明确发出该对冰晶时不处于星超导辉映；后来切换不取消已排队尾段。");
    } else if (event.candidateId.startsWith("coordinated:")) {
      const callback = event.triggerEvidence ?? context.triggerCallbacks?.find(row => row.id === event.triggerId);
      if (callback === undefined) issues.push("协同冰晶缺少本次已发生的合法本人N/CA/P敌人回调证据。");
      else {
        issues.push(...callbackIssues(callback, context, gender));
        if (event.triggerId !== callback.id || event.candidateId !== `coordinated:${callback.id}` || event.triggerFrame !== callback.frame) issues.push("协同冰晶身份与实际触发回调不一致。");
      }
      if (event.triggerFrame === undefined || event.triggerFrame > skillExpiry || event.snapshotFrame !== event.triggerFrame + 3 || event.frame !== event.snapshotFrame + travel(kind, context)) issues.push("协同冰晶须在有效E状态内触发，延迟3帧取样后再飞行命中。");
      if (event.radiance !== "stellar-conduct" || event.skillActiveAtTrigger !== true || event.triggerIcdReady !== true) issues.push("协同冰晶需本次触发时的星超导辉映、有效E与实际ICD就绪；12帧等号仍被阻塞。");
    } else issues.push("冰晶事件不是已核准的定时或协同来源身份。");
  } else issues.push("E事件只能是初击或寒星冰晶。");
  return [...new Set(issues)];
}

/** Fixed a7dc4bf source, observed execution only. Evidence is provisional: this
 * compiler neither schedules N/CA/P actions nor authenticates gameplay records. */
export function compileTravelerCryoStateSchedule(kind: TravelerCryoStateCastKind, context: TravelerCryoStateScheduleContext,
  gender: "aether" | "lumine" = "aether"): TravelerCryoStateSchedule {
  const candidates: TravelerCryoStateCandidate[] = [], instances: TravelerCryoStateHitInstance[] = [];
  const decisions: TravelerCryoStateSchedule["decisions"] = [], issues: string[] = [];
  const issue = (reason: string) => { if (!issues.includes(reason)) issues.push(reason); };
  const decide = (eventId: string, frame: number, accepted: boolean, reason: string) => decisions.push({ eventId, frame, accepted, reason });
  const add = (event: TravelerCryoStateEvent, independent = false) => {
    validateTravelerCryoStateEvent(kind, event, context, gender).forEach(issue);
    const { candidateId: id, ...details } = event;
    const hit = { id, ...details }, contact = independent ? true : context.targetContacts?.[id];
    if (independent && context.targetContacts?.[id] === false) issue("独立事件代表一次实际命中，不能同时把本击记为落空。");
    candidates.push({ ...hit, contact });
    if (contact === undefined) issue(`请明确 ${id}（第${event.frame}帧）是否实际命中所选敌人。`);
    else {
      decide(id, event.frame, contact, contact ? "已明确本击实际接触所选敌人。" : "已明确本击落空，不计入伤害。");
      if (contact) instances.push(hit);
    }
  };
  if (context.independentEvent !== undefined) {
    add(context.independentEvent, true);
    const end = context.independentEvent.frame;
    return { candidates, instances, decisions, issues, lifecycleEndFrame: end, requiredObservedThroughFrame: end, complete: issues.length === 0 };
  }
  for (const [key, message] of [
    ["freshCastConfirmed", kind === "skill" ? "请确认是一次新E，没有旧E、旧协同ICD或前次E的遗留输出。" : "请确认是一次新Q，未混入前次Q的投矛输出；本次寒辉按第36帧实际值读取。"],
    ["noHitlag", "固定角色任务帧需要明确无卡肉延长。"],
    ["noInterruption", "请确认施放及来源实体未提前中断。"],
    ["noReplacement", "请确认没有重施、替换、额外延长或状态重置。"],
    ["fullObservedLifetime", "请确认已观察实体寿命及所有已排队的命中或落空尾段。"],
  ] as const) if (context[key] !== true) issue(message);
  if (context.trueMoonStoryBuffEnabled !== false) issue("需明确 true_moon_story_buff 关闭，不能把未知剧情增益当作关闭。");
  if (!context.casterId || !context.targetId) issue("需要明确本次施放者和所选敌人的标识。");
  const baseEvent = (id: string, role: TravelerCryoStateRole, snapshotFrame: number, frame: number): TravelerCryoStateEvent => ({
    candidateId: id, templateRole: role, frame, snapshotFrame, snapshotId: `snapshot-${snapshotFrame}`, targetId: context.targetId ?? "",
  });
  let lifecycleEndFrame = 0;
  if (kind === "skill") {
    if (context.radianceHistoryComplete !== true || context.initialRadiance === undefined || context.radianceChanges === undefined) issue("完整E需要明确初始辉映、完整变化记录及完整性确认；空数组表示实际没有变化。");
    if (context.callbacksComplete !== true || context.triggerCallbacks === undefined) issue("完整E需要全部实际本人N/CA/P敌人回调及完整性确认，空数组表示没有回调。");
    const callbacks = (context.triggerCallbacks ?? []).map((row, order) => ({ row, order })).sort((a, b) => a.row.frame - b.row.frame || a.order - b.order);
    const changes = (context.radianceChanges ?? []).map((row, order) => ({ row, order })).sort((a, b) => a.row.frame - b.row.frame ||
      Number(a.row.beforeCallbacks === false) - Number(b.row.beforeCallbacks === false) || a.order - b.order);
    const changeIds = new Set<string>(), callbackIds = new Set<string>();
    for (const { row } of changes) {
      if (changeIds.has(row.id)) issue(`辉映变化ID重复：${row.id}`);
      changeIds.add(row.id);
      if (row.beforeCallbacks === undefined && (tickerFrames.includes(row.frame as typeof tickerFrames[number]) || callbacks.some(callback => callback.row.frame === row.frame))) issue(`第${row.frame}帧辉映变化与检查同帧，需明确发生在该帧全部已列检查之前或之后。`);
    }
    const radianceAt = (frame: number): TravelerCryoRadiance | undefined => {
      let radiance = context.initialRadiance;
      for (const { row } of changes) if (row.frame < frame || row.frame === frame && row.beforeCallbacks === true) radiance = row.radiance;
      return radiance;
    };
    add(baseEvent("initial", "initial", 19, 19));
    for (const [index, frame] of tickerFrames.entries()) {
      const radiance = radianceAt(frame);
      if (radiance === undefined) continue;
      decide(`ticker-${index + 1}`, frame, radiance !== "stellar-conduct", radiance === "stellar-conduct"
        ? "本次检查为星超导辉映，跳过定时双晶。" : "本次检查排入两枚冰晶，之后辉映变化不取消已排尾段。");
      if (radiance !== "stellar-conduct") for (const offset of [0, 13]) add({
        ...baseEvent(`periodic-${index + 1}-${offset === 0 ? 1 : 2}`, "crystal", frame + offset, frame + offset + travel(kind, context)),
        triggerFrame: frame, radiance,
      });
    }
    let readyAfter = -1;
    for (const { row: callback } of callbacks) {
      if (callbackIds.has(callback.id)) issue(`触发回调ID重复：${callback.id}`);
      callbackIds.add(callback.id);
      const invalid = callbackIssues(callback, context, gender);
      invalid.forEach(issue);
      if (invalid.length) { decide(callback.id, callback.frame, false, "本次回调缺少合格的实际来源证据。"); continue; }
      const radiance = radianceAt(callback.frame);
      if (radiance !== "stellar-conduct") { decide(callback.id, callback.frame, false, "本次实际回调不处于星超导辉映，不触发协同。"); continue; }
      if (callback.frame > skillExpiry) { decide(callback.id, callback.frame, false, "本次实际回调发生在E状态到期后，不触发协同。"); continue; }
      if (callback.frame <= readyAfter) { decide(callback.id, callback.frame, false, "距离上次成功触发不超过12帧（含等号），被协同ICD阻塞。"); continue; }
      readyAfter = callback.frame + 12;
      decide(callback.id, callback.frame, true, "实际合格回调排入+3帧取样的协同冰晶。");
      add({ ...baseEvent(`coordinated:${callback.id}`, "crystal", callback.frame + 3, callback.frame + 3 + travel(kind, context)),
        radiance, triggerId: callback.id, triggerFrame: callback.frame, triggerEvidence: callback,
        skillActiveAtTrigger: true, triggerIcdReady: true });
    }
    lifecycleEndFrame = skillExpiry;
    decide("skill-expiry", skillExpiry + 1, false, "739帧等号仍有效，740帧E失活；已排队冰晶继续取样和飞行。");
  } else {
    const radiance = context.radianceAtBurst, stacks = context.frostglowStacksAtBurst;
    if (radiance === undefined || stacks === undefined) issue("完整Q需要第36帧实际锁定的辉映和消耗寒辉层数。");
    if (radiance !== undefined && stacks !== undefined) {
      const count = stacks === 8 ? 5 : 3;
      for (let index = 0; index < count; index++) add({
        ...baseEvent(`burst-${index + 1}`, burstRole(radiance), 36, 36 + travel(kind, context) + burstOffsets[index]!),
        radiance, frostglowStacks: stacks,
      });
      decide("burst-snapshot", 36, true, `此帧锁定${radiance}、${stacks}层寒辉和每枚投矛的进攻快照；清空寒辉，保留源码队列顺序。`);
    }
    lifecycleEndFrame = Math.max(36, ...candidates.map(row => row.frame));
  }
  const requiredObservedThroughFrame = Math.max(kind === "skill" ? lifecycleEndFrame + 1 : lifecycleEndFrame, ...candidates.map(row => row.frame));
  if (context.observedThroughFrame === undefined || context.observedThroughFrame < requiredObservedThroughFrame) issue(`完整观察至少须覆盖第${requiredObservedThroughFrame}帧，包括已发出冰晶或投矛的全部尾段。`);
  return { candidates, instances, decisions, issues, lifecycleEndFrame, requiredObservedThroughFrame, complete: issues.length === 0 };
}
