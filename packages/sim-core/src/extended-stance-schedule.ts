import type { ExtendedStanceAction, ExtendedStanceScheduleContext } from "./extended-stance-context";
export type { ExtendedStanceScheduleContext } from "./extended-stance-context";

export const EXTENDED_STANCE_CAST_KINDS = ["extended-ifa-skill-c0", "extended-dahlia-burst-c0", "extended-varka-skill-c0", "extended-prune-skill-c0"] as const;
export type ExtendedStanceCastKind = typeof EXTENDED_STANCE_CAST_KINDS[number];
export interface ExtendedStanceHitInstance {
  id: string; templateRole: string; frame: number; snapshotFrame: number; snapshotId: string; targetId: string;
  actionId?: string | undefined; launchFrame?: number | undefined;
  element?: "physical" | "anemo" | "pyro" | "hydro" | "electro" | "cryo" | undefined;
  coefficientMultiplier?: 1 | 1.4 | 2.2 | undefined; varkaA4Stacks?: number | undefined; observationId?: string | undefined;
}
export interface ExtendedStanceCandidate extends ExtendedStanceHitInstance { contact: boolean | undefined; canceled?: boolean | undefined; }
export interface ExtendedStanceSchedule {
  candidates: ExtendedStanceCandidate[]; instances: ExtendedStanceHitInstance[]; issues: string[];
  decisions: { eventId: string; frame: number; accepted: boolean; reason: string }[];
  stateEvents: { id: string; frame: number; label: string; value?: number | undefined }[];
  lifecycleEndFrame: number; requiredObservedThroughFrame: number; complete: boolean;
}
export interface ExtendedStanceCompileOptions { ascension?: number | undefined; }
type Task = { frame: number; phase: number; order: number; run: () => void };
const adjust = (frames: number, speed: number) => frames - Math.trunc(Math.min(Math.min(speed, .6), .1 + (Math.min(speed, .6) - .1) / 2) * frames);

/** A source-defined action stream. No implicit attacks or resource-based maximum hit count is inserted. */
export function compileExtendedStanceSchedule(kind: ExtendedStanceCastKind, context: ExtendedStanceScheduleContext,
  options: ExtendedStanceCompileOptions = {}): ExtendedStanceSchedule {
  const candidates: ExtendedStanceCandidate[] = [], instances: ExtendedStanceHitInstance[] = [];
  const issues: string[] = [], decisions: ExtendedStanceSchedule["decisions"] = [], stateEvents: ExtendedStanceSchedule["stateEvents"] = [];
  const issue = (message: string) => { if (!issues.includes(message)) issues.push(message); };
  const state = (id: string, frame: number, label: string, value?: number) => stateEvents.push({ id, frame, label, ...(value === undefined ? {} : { value }) });
  const decide = (eventId: string, frame: number, accepted: boolean, reason: string) => decisions.push({ eventId, frame, accepted, reason });
  for (const [key, label] of [["freshCastConfirmed", "没有本次施放之前遗留的姿态、充能、触发冷却或可延续的触发增益"],
    ["noHitlag", "没有卡肉延长"], ["noInterruption", "没有未记录的打断"], ["noReplacement", "没有重复施放、死亡或状态替换"],
    ["fullObservedLifetime", "已观察完整状态寿命以及排队攻击和冷却回调尾段"]] as const) {
    if (context[key] !== true) issue(`请明确确认${label}。`);
  }
  if (!context.casterId) issue("缺少施放角色标识。");
  if (!context.targetId) issue("缺少所选敌人标识。");
  if (!context.followupActions) issue("请明确记录后续动作列表；空列表表示确实没有后续动作。");
  const actions = [...(context.followupActions ?? [])];
  const ids = new Set<string>(); let previousFrame = -1;
  for (const action of actions) {
    if (ids.has(action.id) || action.id === "initial") issue(`动作标识 ${action.id} 重复或使用保留标识。`);
    ids.add(action.id);
    if (action.frame <= previousFrame) issue("后续动作必须按严格递增的真实执行帧记录，不能同帧并行动作。");
    previousFrame = action.frame;
    if (action.kind !== "swap" && action.actorId !== context.casterId) issue(`动作 ${action.id} 的执行角色不是本次施放者。`);
  }
  let lifecycleEndFrame = 0, lastFrame = 0;
  const emit = (id: string, role: string, frame: number, extra: Partial<ExtendedStanceHitInstance> = {}, canceled = false) => {
    const hit: ExtendedStanceHitInstance = { id, templateRole: role, frame, snapshotFrame: frame, snapshotId: `sample:${frame}`, targetId: context.targetId ?? "", ...extra };
    const contact = canceled ? undefined : context.targetContacts?.[id];
    candidates.push({ ...hit, contact, ...(canceled ? { canceled: true } : {}) });
    if (canceled) {
      if (context.targetContacts?.[id] === true) issue(`${id} 已被来源取消，却同时标为命中。`);
      decide(id, frame, false, "排队发射时姿态已结束，固定来源取消此次攻击。"); return;
    }
    lastFrame = Math.max(lastFrame, frame);
    if (contact === undefined) issue(`请明确 ${id}（第${frame}帧）是否实际命中所选敌人。`);
    else { decide(id, frame, contact, contact ? "实际命中所选敌人。" : "明确落空。 "); if (contact) instances.push(hit); }
  };
  const requireTrue = (value: unknown, label: string) => { if (value !== true) issue(label); };
  const checkEventIds = (rows: { id: string; frame: number }[]) => {
    const seen = new Set<string>();
    for (const row of rows) { if (seen.has(row.id)) issue(`事件标识 ${row.id} 重复，不能确定唯一来源。`); seen.add(row.id); }
  };
  const speed = (a: ExtendedStanceAction) => { if (a.attackSpeedBonus === undefined) issue(`动作 ${a.id} 缺少实际攻击速度增量；0表示没有攻速增量。`); return a.attackSpeedBonus ?? 0; };
  const tasks: Task[] = []; let order = 0;
  const task = (frame: number, phase: number, run: () => void) => tasks.push({ frame, phase, order: order++, run });
  const run = () => { while (tasks.length) { tasks.sort((a, b) => a.frame - b.frame || a.phase - b.phase || a.order - b.order); tasks.shift()!.run(); } };

  if (kind === "extended-ifa-skill-c0") {
    requireTrue(context.ifa?.noExternalNightsoulChanges, "请确认没有外部夜魂增减、冲刺消耗或未列出的夜魂操作。");
    requireTrue(context.ifa?.noUnlistedActions, "请确认所有射击与手动结束均已列出，且没有俯冲、跳跃或其他未列出的动作。");
    let end = 598, terminated = false, previous: ExtendedStanceAction | undefined;
    state("nightsoul-start", 0, "进入夜魂加持，80点夜魂", 80);
    for (const action of actions) {
      if (action.kind === "swap") { issue("伊法夜魂分支不允许换人；结束后换人不属于本次战技伤害日程。"); continue; }
      if (terminated || action.frame >= end) { issue(`动作 ${action.id} 发生在夜魂结束后，不是本次战技的射击。`); continue; }
      const earliest = previous ? previous.frame + (action.kind === "skill" ? 0 : adjust(action.kind === "normal" ? 54 : 42, speed(previous)))
        : action.kind === "normal" ? 31 : action.kind === "charged" ? 28 : 17;
      if (action.frame < earliest) issue(`动作 ${action.id} 早于固定来源允许的第${earliest}帧。`);
      if (action.kind === "skill") { end = action.frame; terminated = true; state(action.id, end, "再次点按战技，立即结束夜魂；未自动补造俯冲"); previous = action; continue; }
      speed(action);
      if (action.travelFrames === undefined) issue(`射击 ${action.id} 缺少实际飞行帧数，不能默认零距离。`);
      const launch = action.frame + (action.kind === "normal" ? 3 : 1), impact = launch + (action.travelFrames ?? 0);
      task(launch, 0, () => emit(`${action.id}:shot`, "tonicShot", impact, { actionId: action.id, launchFrame: launch, element: "anemo",
        observationId: JSON.stringify({ action, end }) }, launch > end));
      previous = action;
    }
    // Character tasks run before the core's point drain: a launch exactly at natural frame598 still occurs.
    lifecycleEndFrame = end + (terminated ? 44 : 37);
    state("nightsoul-end", end, "夜魂清空；技能进入450帧冷却，并获得26帧可俯冲窗口");
    state("fall-end", lifecycleEndFrame, "本分支结束下落／手动结束动作尾段；未声明额外俯冲");
    run();
  } else if (kind === "extended-dahlia-burst-c0") {
    if ((options.ascension ?? -1) < 4) issue("固定来源突破4以下会访问未初始化的攻速数组；本分支要求已明确突破4或以上，不能臆造修复。");
    requireTrue(context.dahlia?.shieldUnbroken, "此封闭分支需要明确首层护盾未被击破；否则必须追踪来源尚未接入的再生回调。");
    requireTrue(context.dahlia?.noNormalHitsOrFrozen, "请确认祈礼期间没有符合条件的前台普攻命中或敌人冻结，不能省略祝福层数与再生触发。");
    requireTrue(context.dahlia?.noSwaps, "此分支要求祈礼全程不换人；固定源码仅在换人钩子安装攻速修饰。");
    if (actions.length) issue("塔利雅此封闭分支不包含后续动作；实际普攻、冻结或换人不能隐藏为一个空事件列表。");
    emit("initial", "initial", 30, { element: "hydro" });
    state("shield-start", 31, "祈礼与首层护盾建立；固定源码只更新攻速数值而未安装攻速修饰");
    state("favor-end", 751, "720帧祈礼清理回调，护盾设置为下一帧结束");
    state("shield-end", 752, "首层护盾到期；没有已排队的祝福再生");
    lifecycleEndFrame = 752;
  } else if (kind === "extended-prune-skill-c0") {
    if (context.prune?.hexerei !== false) issue("此分支需要明确未启用魔女课题联动；不能省略队友反应造成的攻击增益。");
    requireTrue(context.prune?.allInitialSwirlsRecorded, "请明确已记录初击引发的全部实际扩散及其同帧发生顺序；空数组表示确实没有扩散。");
    if (!context.prune?.initialSwirls) issue("缺少初击实际扩散列表。");
    checkEventIds(context.prune?.initialSwirls ?? []);
    emit("initial", "initial", 26, { element: "anemo" });
    let converted: ExtendedStanceHitInstance["element"];
    for (const event of context.prune?.initialSwirls ?? []) {
      if (event.targetIsEnemy === false || event.actorId !== context.casterId) { decide(event.id, event.frame, false, "不是施放者初击对敌人造成的扩散。"); continue; }
      if (event.targetIsEnemy === undefined || !event.element || event.frame !== 26 || event.triggerCandidateId !== "initial") {
        issue(`扩散 ${event.id} 缺少敌人资格、元素或初击来源；只接受第26帧初击实际触发的有序记录。`); continue;
      }
      if (event.targetId === context.targetId && context.targetContacts?.initial === false) issue("初击被标为对所选敌人落空，却同时记录对该敌人扩散。");
      if (!converted) { converted = event.element; state(event.id, 26, `首次实际扩散确定二段元素：${converted}；二段窗口至第390帧（含）`); }
      else decide(event.id, 26, false, "首个实际扩散已触发12帧冷却，本次同帧扩散不覆盖元素。");
    }
    lifecycleEndFrame = converted ? 391 : 59;
    if (actions.length > 1 || actions.some(a => a.kind !== "skill")) issue("本次战技仅支持一次来源允许的二段战技；其他伤害动作应另计。");
    const recast = actions.find(a => a.kind === "skill");
    if (recast) {
      if (!converted || recast.frame < 28 || recast.frame > 390) issue("二段战技必须有初击扩散，且实际执行帧在28至390之间（含端点）。");
      else { emit(`${recast.id}:converted`, "converted", recast.frame + 30, { actionId: recast.id, element: converted, observationId: JSON.stringify(context.prune?.initialSwirls) }); lifecycleEndFrame = recast.frame + 82; }
      if (context.prune?.recastDeclined === true) issue("已记录二段战技，不能同时声明放弃二段。");
    } else if (context.prune?.recastDeclined !== true) issue("请明确本次未使用二段战技并观察转换窗口自然结束。");
  } else if (kind === "extended-varka-skill-c0") {
    const input = context.varka;
    if ((options.ascension ?? -1) < 4) issue("固定来源A4缺少突破门槛检查；本分支限定实际突破4或以上，避免把来源缺口伪装成游戏规则。");
    requireTrue(input?.completeTeamConfirmed, "请明确完整队伍元素，转换优先级和固有天赋倍率不能从缺省队伍推断。");
    requireTrue(input?.noUnlistedActions, "请确认姿态内所有动作均已列出。");
    requireTrue(input?.noExternalCooldownChanges, "请确认没有外部冷却缩减、额外充能或未记录的状态变化。");
    requireTrue(input?.allSwirlsRecorded, "请记录完整敌人扩散事件历史；空数组表示确实没有扩散。");
    if (!input?.swirlEvents) issue("缺少完整实际扩散事件列表。");
    if (input?.hexerei === undefined || input.hexereiCount === undefined) issue("请明确魔女课题是否启用及队伍魔女数量，以确定每击30或60帧的冷却缩减。");
    const team = input?.teamElements ?? [];
    if (!team.includes("anemo")) issue("完整队伍必须包含施放者法尔伽的风元素。");
    const converted = (["pyro", "hydro", "electro", "cryo"] as const).find(e => team.includes(e)) ?? "physical";
    const twoAnemo = team.filter(e => e === "anemo").length >= 2;
    const twoPHCE = (["pyro", "hydro", "electro", "cryo"] as const).some(e => team.filter(x => x === e).length >= 2);
    const multi = twoAnemo && twoPHCE ? 2.2 : twoAnemo || twoPHCE ? 1.4 : 1;
    let modeEnd = 760, exited = false, available = 0, started = 0, cdDone = -1, reductions = 0;
    let a4Stacks = 0, a4Expiry = -1, counter = 0;
    const swirlICD = new Map<string, number>();
    const reactions = input?.swirlEvents ?? [];
    checkEventIds(reactions);
    const react = (event: typeof reactions[number]) => {
      if (event.targetIsEnemy === false) { decide(event.id, event.frame, false, "不是敌人扩散，不触发A4。"); return; }
      if (event.targetIsEnemy === undefined || !event.element) { issue(`扩散 ${event.id} 缺少敌人资格或实际元素。`); return; }
      if ((swirlICD.get(event.actorId) ?? -1) >= event.frame) { decide(event.id, event.frame, false, "触发角色的60帧来源冷却仍有效。"); return; }
      swirlICD.set(event.actorId, event.frame + 60);
      a4Stacks = a4Expiry >= event.frame ? Math.min(a4Stacks + 1, 4) : 1; a4Expiry = event.frame + 480;
      state(event.id, event.frame, "实际敌人扩散叠加A4，刷新480帧有效期", a4Stacks);
    };
    const cdTask = (src: number) => task(src, 1, () => {
      lastFrame = Math.max(lastFrame, src);
      if (cdDone !== src) return;
      available++; state(`charge:${started}`, src, "来源充能回调完成；姿态结束后充能不可使用", available);
      if (started < 2) startCD(src); else cdDone = -1;
    });
    const startCD = (frame: number) => { started++; cdDone = frame + 660; cdTask(cdDone); };
    const modeActive = (frame: number) => frame >= 40 && frame <= modeEnd && !exited;
    task(40, 0, () => { state("stance-start", 40, "姿态建立，持续720帧（到期帧仍有效）"); if (converted !== "physical") startCD(40); });
    const queueHit = (id: string, role: string, frame: number, element: ExtendedStanceHitInstance["element"], actionId?: string, normal = false) => task(frame, 1, () => {
      const triggered = reactions.filter(row => row.triggerCandidateId === id);
      for (const event of triggered) {
        if (event.targetIsEnemy === false) continue;
        if (event.frame !== frame || event.actorId !== context.casterId) issue(`扩散 ${event.id} 与其自身伤害来源帧或角色不一致。`);
        if (element !== "anemo") issue(`扩散 ${event.id} 所指的本击不是风元素，不能直接产生普通扩散。`);
        if (event.targetId === context.targetId && context.targetContacts?.[id] === false || context.enemyHits?.[id] === false) issue(`扩散 ${event.id} 与本击已声明的未命中事实冲突。`);
        if (context.targetContacts?.[id] === true && event.targetId !== context.targetId && event.beforeSelectedTarget === undefined) issue(`扩散 ${event.id} 来自同一范围攻击的其他敌人，需明确是否先于所选目标结算；不能猜测本击A4层数。`);
        if (event.targetId === context.targetId && event.beforeSelectedTarget === true) issue(`扩散 ${event.id} 不能先于对同一目标的攻击修饰取样。`);
        if (event.beforeSelectedTarget === true && event.frame === frame && event.actorId === context.casterId) react(event);
      }
      const stacks = role === "initial" ? 0 : a4Expiry >= frame ? a4Stacks : 0;
      emit(id, role, frame, { element, coefficientMultiplier: role === "initial" ? 1 : multi, varkaA4Stacks: stacks,
        ...(actionId ? { actionId } : {}), observationId: JSON.stringify({ team, reactions: reactions.filter(row => row.frame <= frame) }) });
      if (normal && modeActive(frame) && reductions < 15 && cdDone >= 0) {
        const anyHit = context.enemyHits?.[id];
        if (anyHit === undefined) issue(`普攻 ${id} 缺少是否命中任意敌人的记录；所选敌人落空不能代替这个事实。`);
        if (context.targetContacts?.[id] === true && anyHit === false) issue(`${id} 对所选敌人命中却声明未命中任何敌人。`);
        if (anyHit === true) { reductions++; cdDone = Math.max(frame, cdDone - (input?.hexerei && (input.hexereiCount ?? 0) >= 2 ? 60 : 30)); cdTask(cdDone); state(`${id}:cdr`, frame, "本击首次敌人命中缩减充能冷却", cdDone); }
      }
      for (const event of triggered) if (event.beforeSelectedTarget !== true && event.frame === frame && event.actorId === context.casterId) react(event);
    });
    queueHit("initial", "initial", 40, "anemo");
    let prior: { frame: number; kind: string; animation: number; queue: number; cancel: (kind: ExtendedStanceAction["kind"]) => number } = {
      frame: 0, kind: "skill", animation: 55, queue: 43, cancel: k => k === "normal" || k === "charged" || k === "swap" ? 49 : 44,
    };
    const hitmarks = [[19], [18, 28], [27, 43], [19, 24], [44, 45]];
    const animations = [46, 46, 60, 47, 82], nextN = [23, 29, 55, 40, 73], nextCA = [22, 30, 48, 28, 48];
    const roleNames = [["normal1"], ["normal2a", "normal2b"], ["normal3a", "normal3b"], ["normal4a", "normal4b"], ["normal5a", "normal5b"]];
    for (const action of actions) task(action.frame, 2, () => {
      const earliest = prior.frame + Math.max(prior.queue, prior.cancel(action.kind));
      if (action.frame < earliest) issue(`动作 ${action.id} 早于来源最早执行帧${earliest}。`);
      if (!modeActive(action.frame)) { issue(`动作 ${action.id} 执行时本次姿态已结束或尚未开始。`); return; }
      const idle = action.frame > prior.frame + prior.animation;
      if (action.kind === "swap") {
        if (action.actorId === context.casterId || action.swapDelayFrames === undefined) issue("换人需要明确目标角色及来源运行配置的换人延迟帧数。");
        const end = action.frame + (action.swapDelayFrames ?? 0);
        task(end, 0, () => { modeEnd = Math.min(modeEnd, end); exited = true; state(action.id, end, "实际换出，删除姿态；已经排队的攻击和充能回调继续"); });
        prior = { frame: action.frame, kind: "swap", animation: action.swapDelayFrames ?? 0, queue: action.swapDelayFrames ?? 0, cancel: () => action.swapDelayFrames ?? 0 }; counter = 0; return;
      }
      if (action.kind === "normal") {
        const n = counter, windup = idle ? 5 : 0, offsets = hitmarks[n]!, spd = speed(action);
        offsets.forEach((delay, i) => queueHit(`${action.id}:${i + 1}`, roleNames[n]![i]!, action.frame + delay + windup, (i + (n === 1 || n === 2 ? 1 : 0)) % 2 === 0 ? converted : "anemo", action.id, true));
        const last = offsets[offsets.length - 1]!;
        prior = { frame: action.frame, kind: "normal", animation: animations[n]! + windup, queue: last + windup,
          cancel: k => adjust(k === "normal" ? nextN[n]! : k === "charged" ? nextCA[n]! : last, spd) + windup };
        counter = (counter + 1) % 5;
      } else if (action.kind === "charged") {
        const azure = available > 0, windup = !idle && (prior.kind === "normal" || prior.kind === "charged") ? 0 : 14;
        if (!azure && (action.staminaBeforeAction === undefined || action.staminaBeforeAction < 50)) issue(`重击 ${action.id} 需要明确执行前实际体力至少50；不根据假定恢复速率虚构可用次数。`);
        const offsets = azure ? [40, 40, 60, 60] : [41, 41];
        offsets.forEach((delay, i) => queueHit(`${action.id}:${i + 1}`, `${azure ? "azure" : "charged"}${i % 2 ? "B" : "A"}`, action.frame + delay, i % 2 ? "anemo" : converted, action.id));
        if (azure) { available--; state(action.id, action.frame, "苍噬立即消耗一次四风充能", available); }
        prior = { frame: action.frame, kind: "charged", animation: (azure ? 75 : 67) + windup, queue: (azure ? 60 : 41) + windup,
          cancel: k => (azure ? k === "normal" ? 64 : k === "charged" ? 74 : k === "skill" ? 66 : 60 : k === "normal" ? 58 : k === "skill" ? 59 : k === "swap" ? 49 : 67) + windup };
        counter = 0;
      } else {
        if (available < 1 || converted === "physical") { issue(`特殊战技 ${action.id} 没有可用四风充能或转换元素。`); return; }
        queueHit(`${action.id}:1`, "specialA", action.frame + 34, converted, action.id);
        queueHit(`${action.id}:2`, "specialB", action.frame + 43, "anemo", action.id);
        task(action.frame + 39, 0, () => { if (modeActive(action.frame + 39)) { if (available < 1) issue("来源延迟消耗充能时已经没有可用充能。"); else available--; state(`${action.id}:consume`, action.frame + 39, "特殊战技第39帧消耗四风充能", available); } });
        prior = { frame: action.frame, kind: "skill", animation: 68, queue: 55, cancel: k => k === "normal" ? 55 : k === "charged" ? 64 : k === "skill" ? 56 : 68 }; counter = 0;
      }
    });
    for (const event of reactions.filter(row => !row.triggerCandidateId)) task(event.frame, .5, () => react(event));
    run();
    for (const event of reactions) {
      if (event.targetIsEnemy === false) continue;
      if (!event.triggerCandidateId && event.actorId === context.casterId) issue(`施放者扩散 ${event.id} 必须对应本次已声明的实际风元素命中；不能隐含另一施放或动作。`);
      if (event.triggerCandidateId && !candidates.some(hit => hit.id === event.triggerCandidateId)) issue(`扩散 ${event.id} 引用了不存在的来源命中。`);
      if (!event.triggerCandidateId && candidates.some(hit => hit.frame === event.frame)) issue(`扩散 ${event.id} 与自身命中同帧却缺少顺序依据；请明确对应实际触发命中，不能默认先于自身攻击。`);
    }
    lifecycleEndFrame = modeEnd + (exited ? 0 : 1);
    state("stance-end", lifecycleEndFrame, "姿态结束；排队攻击及来源充能回调已单独保留");
  } else issue("未知的扩展姿态来源。");
  candidates.sort((a, b) => a.frame - b.frame); instances.sort((a, b) => a.frame - b.frame); stateEvents.sort((a, b) => a.frame - b.frame);
  const requiredObservedThroughFrame = Math.max(lifecycleEndFrame, lastFrame);
  if (context.observedThroughFrame === undefined || context.observedThroughFrame < requiredObservedThroughFrame) issue(`完整观察必须至少覆盖第${requiredObservedThroughFrame}帧，包含来源状态与已排队尾段。`);
  return { candidates, instances, issues, decisions, stateEvents, lifecycleEndFrame, requiredObservedThroughFrame, complete: issues.length === 0 };
}
