import type { ObservedEntityScheduleContext } from "./observed-entity-context";
import { compileContactMarkerSchedule, isContactMarkerCastKind } from "./contact-marker-schedule";
export type { ObservedEntityScheduleContext } from "./observed-entity-context";

export const OBSERVED_ENTITY_CAST_KINDS = [
  "observed-klee-burst-c0", "observed-kamisatoayato-burst-c0", "observed-layla-skill-c0",
  "observed-yaoyao-burst-c0", "observed-furina-skill-ousia-c0", "observed-emilie-skill-c0", "observed-emilie-burst-c0",
  "observed-kaeya-burst-c0", "observed-hutao-skill-c0", "observed-aloy-skill-c0",
] as const;
export type ObservedEntityCastKind = typeof OBSERVED_ENTITY_CAST_KINDS[number];
export type ObservedEntityTemplateRole = "pulse" | "droplet" | "initial" | "star" | "burstRadish" | "skillRadish"
  | "chevalmarin" | "usher" | "crabaletta" | "arkhe" | "level1" | "level2" | "a1" | "burst" | "icicle" | "blossom" | "main" | "bomblet";
export interface ObservedEntityHitInstance {
  id: string; templateRole: ObservedEntityTemplateRole; frame: number; snapshotFrame: number; snapshotId: string; targetId: string;
  launchFrame?: number | undefined; scalingFrame?: number | undefined; scalingId?: string | undefined;
  triggerId?: string | undefined; triggerFrame?: number | undefined;
  furinaPartyMembersAboveHalf?: number | undefined; a4RefreshFrame?: number | undefined;
  /** Source observations that determine this event, preserved independently of numerical panel inputs. */
  observationId?: string | undefined;
  paramitaActiveAtSnapshot?: boolean | undefined;
}
export interface ObservedEntityCandidate extends ObservedEntityHitInstance { contact: boolean | undefined; canceled?: boolean | undefined; }
export interface ObservedEntityDecision { eventId: string; frame: number; accepted: boolean; reason: string; }
export interface ObservedEntityRequiredObservation {
  key: string; frame: number;
  kind: "ayato-selection" | "layla-target" | "yaoyao-throw" | "furina-party" | "emilie-selection" | "emilie-burning";
  label: string;
}
export interface ObservedEntitySchedule {
  candidates: ObservedEntityCandidate[]; instances: ObservedEntityHitInstance[]; issues: string[]; decisions: ObservedEntityDecision[];
  requiredObservations: ObservedEntityRequiredObservation[]; lifecycleEndFrame: number; requiredObservedThroughFrame: number; complete: boolean;
}
export interface ObservedEntityCompileOptions { ascension?: number | undefined; }
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const named = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
type Selection = NonNullable<NonNullable<ObservedEntityScheduleContext["ayato"]>["selections"]>[string];
type Task = { frame: number; phase: number; order: number; run: () => void };

/** Pinned b4ae769 behavior, including its documented experimental timing; not a claim of independent game verification. */
export function compileObservedEntitySchedule(kind: ObservedEntityCastKind, context: ObservedEntityScheduleContext,
  options: ObservedEntityCompileOptions = {}): ObservedEntitySchedule {
  if (isContactMarkerCastKind(kind)) return compileContactMarkerSchedule(kind, context);
  const candidates: ObservedEntityCandidate[] = [], instances: ObservedEntityHitInstance[] = [];
  const issues: string[] = [], decisions: ObservedEntityDecision[] = [], requiredObservations: ObservedEntityRequiredObservation[] = [];
  const issue = (message: string) => { if (!issues.includes(message)) issues.push(message); };
  const decide = (eventId: string, frame: number, accepted: boolean, reason: string) => decisions.push({ eventId, frame, accepted, reason });
  const need = (key: string, frame: number, observationKind: ObservedEntityRequiredObservation["kind"], label: string) => {
    if (!requiredObservations.some(row => row.key === key && row.kind === observationKind)) requiredObservations.push({ key, frame, kind: observationKind, label });
  };
  if (!(OBSERVED_ENTITY_CAST_KINDS as readonly string[]).includes(kind)) issue("尚未支持此实体施放来源。");
  if (!named(context.casterId)) issue("缺少施放角色标识。");
  if (!named(context.targetId)) issue("缺少所选敌人标识。");
  for (const [key, message] of [
    ["freshCastConfirmed", "请确认没有上次实体、标记、触发冷却或遗留的本技能状态。"],
    ["noHitlag", "请确认此次来源日程没有卡肉延长。"],
    ["noInterruption", "请确认施放动作未被中断，所有提前结束均有明确记录。"],
    ["noReplacement", "请确认没有重复施放、实体替换或角色死亡造成的状态重置。"],
    ["fullObservedLifetime", "请确认观察记录覆盖实体全寿命、已发出攻击和仍在等待目标的尾段。"],
  ] as const) if (context[key] !== true) issue(message);
  let lifecycleEndFrame = 0, lastFrame = 0;
  const emit = (id: string, templateRole: ObservedEntityTemplateRole, frame: number, snapshotFrame = frame,
    extras: Partial<ObservedEntityHitInstance> = {}, canceled = false) => {
    const hit: ObservedEntityHitInstance = { id, templateRole, frame, snapshotFrame, snapshotId: `sample:${snapshotFrame}`,
      targetId: context.targetId ?? "", ...extras };
    const contact = canceled ? undefined : context.targetContacts?.[id];
    candidates.push({ ...hit, contact, ...(canceled ? { canceled: true } : {}) });
    // Canceled projectiles are source decisions, not an unobserved future damage opportunity.
    if (canceled) {
      if (context.targetContacts?.[id] === true) issue(`${id}被记录为命中，但固定来源会在到期后取消这次在途攻击；两项事实不能同时成立。`);
      decide(id, frame, false, "来源在命中前检查到实体已结束，此在途攻击被取消。"); return;
    }
    lastFrame = Math.max(lastFrame, frame);
    if (contact === undefined) issue(`请明确 ${id}（第${frame}帧）是否实际命中所选敌人。`);
    else {
      decide(id, frame, contact, contact ? "已明确实际接触所选敌人。" : "已明确落空，不生成伤害。 ");
      if (contact) instances.push(hit);
    }
  };
  const uniqueEvents = (rows: { id: string; frame: number }[], label: string) => {
    const ids = new Set<string>();
    for (const row of rows) {
      if (!named(row.id) || ids.has(row.id)) issue(`${label}包含空白或重复事件标识。`);
      if (!integer(row.frame)) issue(`${label}包含非法帧。`);
      ids.add(row.id);
    }
  };
  const intervals = <T extends { startFrame: number; endFrame: number }>(rows: T[] | undefined, label: string): T[] => {
    const sorted = [...(rows ?? [])].sort((a, b) => a.startFrame - b.startFrame);
    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i]!;
      if (!integer(row.startFrame) || !integer(row.endFrame) || row.endFrame < row.startFrame) issue(`${label}包含非法起止帧。`);
      if (i && row.startFrame <= sorted[i - 1]!.endFrame) issue(`${label}区间重叠；同一帧只能有一个明确状态。`);
    }
    return sorted;
  };
  const select = (key: string, frame: number, row: Selection | undefined, marks: Map<string, number>, markDuration: number,
    observationKind: "ayato-selection" | "emilie-selection") => {
    need(key, frame, observationKind, "范围内完整敌人名单及本次实际选中目标；无合格目标时选空。");
    if (!row || row.completeRosterConfirmed !== true || !row.inRangeTargetIds || row.selectedTargetId === undefined) {
      issue(`${key}缺少完整范围敌人名单或实际选敌结果。`); return;
    }
    if (row.frame !== undefined && row.frame !== frame) issue(`${key}选敌记录帧与来源第${frame}帧不符。`);
    if (new Set(row.inRangeTargetIds).size !== row.inRangeTargetIds.length) issue(`${key}敌人名单包含重复标识。`);
    const eligible = row.inRangeTargetIds.filter(id => (marks.get(id) ?? -1) < frame);
    if (row.selectedTargetId === null) {
      if (eligible.length) issue(`${key}仍有未标记的范围内敌人，不能使用无人可选的随机落点分支。`);
    } else if (!eligible.includes(row.selectedTargetId)) issue(`${key}所选敌人不在范围内，或其来源标记仍未结束。`);
    else marks.set(row.selectedTargetId, frame + markDuration);
    decide(key, frame, true, row.selectedTargetId === null ? "所有范围内敌人均不合资格，来源改用随机落点；接触另行确认。" : `实际选中${row.selectedTargetId}，标记有效至第${frame + markDuration}帧（含）。`);
  };
  const tasks: Task[] = []; let taskOrder = 0;
  const task = (frame: number, phase: number, run: () => void) => tasks.push({ frame, phase, order: taskOrder++, run });
  const runTasks = () => {
    while (tasks.length) {
      tasks.sort((a, b) => a.frame - b.frame || a.phase - b.phase || a.order - b.order);
      tasks.shift()!.run();
    }
  };

  if (kind === "observed-klee-burst-c0") {
    const ctx = context.klee, waves = [186, 294, 401, 503, 610, 718];
    let end = 746;
    if (ctx?.exitFrame !== undefined) {
      if (!integer(ctx.exitFrame) || ctx.exitFrame < 101) issue("可莉实际退场早于来源可取消时点，或帧数无效。");
      end = Math.min(end, ctx.exitFrame);
      if (waves.includes(end)) issue("可莉退场恰与波次启动同帧，缺少原队列先后证据，不能推定该波是否发出。");
    } else if (ctx?.onFieldUntilEndConfirmed !== true) issue("可莉Q需要明确全程在场，或提供实际退场帧。");
    lifecycleEndFrame = end;
    waves.forEach((frame, index) => {
      const id = `wave-${index + 1}`;
      if (frame >= end) { decide(id, frame, false, "波次启动前可莉Q已结束。"); return; }
      const observed = ctx?.waves?.[index];
      if (observed?.extraAt12 === undefined || observed.extraAt24 === undefined) issue(`${id}需要明确两次随机额外弹的实际发生结果，不能使用平均命中数。`);
      const extras = { launchFrame: frame, snapshotId: "cast:100", triggerId: id, triggerFrame: frame,
        observationId: JSON.stringify(observed ?? {}) };
      emit(`${id}-1`, "pulse", frame, 100, extras);
      emit(`${id}-2`, "pulse", frame + 12, 100, extras);
      if (observed?.extraAt12 === true) emit(`${id}-2-extra`, "pulse", frame + 12, 100, extras);
      emit(`${id}-3`, "pulse", frame + 24, 100, extras);
      if (observed?.extraAt24 === true) emit(`${id}-3-extra`, "pulse", frame + 24, 100, extras);
    });
  }

  if (kind === "observed-kamisatoayato-burst-c0") {
    lifecycleEndFrame = 1181;
    const marks = new Map<string, number>();
    for (let i = 0; i < 36; i++) {
      const id = `droplet-${i + 1}`, launch = 101 + i * 30, row = context.ayato?.selections?.[id];
      select(id, launch, row, marks, 87, "ayato-selection");
      emit(id, "droplet", launch + 38, 101, { snapshotId: "cast:101", launchFrame: launch, observationId: JSON.stringify(row ?? {}) });
    }
  }

  if (kind === "observed-layla-skill-c0") {
    const ctx = context.layla, end = ctx?.shieldEndFrame;
    lifecycleEndFrame = integer(end) ? end : 739;
    if (!integer(end) || end < 19 || end > 739 || ctx?.shieldLifetimeConfirmed !== true) issue("莱依拉需要明确护盾第19帧生成后，实际破裂或自然到期的帧（19至739）。");
    if (ctx?.allStarEventsRecorded !== true || !ctx.skillEvents || !ctx.burstHitEvents) issue("请完整记录护盾期间的所有技能施放和莱依拉Q命中；无事件也须明确提供空表。");
    emit("initial", "initial", 32, 0, { launchFrame: 0 });
    const skillEvents = ctx?.skillEvents ?? [], burstEvents = ctx?.burstHitEvents ?? [];
    uniqueEvents([...skillEvents, ...burstEvents], "莱依拉产星事件");
    let stars = 0, shooting = false, skillCD = -1, burstCD = -1, starTickerSrc = 19, volley = 0;
    const shieldPresent = (frame: number) => frame >= 19 && frame < lifecycleEndFrame;
    const tick = (src: number, frame: number) => task(frame, 2, () => {
      if (src !== starTickerSrc || !shieldPresent(frame)) return;
      addStars(1, "skill", frame, `intrinsic-${src}-${frame}`);
      tick(src, frame + 90);
    });
    const checkTarget = (frame: number, v: number, check: number, lastTarget?: string, shot = 0) => task(frame, 3, () => {
      const id = `volley-${v}-check-${check}`, row = ctx?.targetChecks?.[id];
      lastFrame = Math.max(lastFrame, frame);
      need(id, frame, "layla-target", lastTarget ? "本次发射时10米内最近目标；空则继续瞄准上次目标。" : "首次搜索10米内最近目标；空则6帧后继续搜索。");
      if (!row || row.closestWithin10Confirmed !== true || row.targetId === undefined) {
        issue(`${id}（第${frame}帧）缺少明确搜索结果；待定射星可能在护盾结束后继续等待，不能声称完整。`); return;
      }
      if (!lastTarget) {
        if (row.targetId === null) { decide(id, frame, false, "首次搜索没有目标，6帧后继续；护盾结束不会取消此搜索。 "); checkTarget(frame + 6, v, check + 1); }
        else { decide(id, frame, true, "找到首次目标，30帧后开始发射。 "); checkTarget(frame + 30, v, check + 1, row.targetId); }
        return;
      }
      const target = row.targetId ?? lastTarget, idHit = `volley-${v}-star-${shot + 1}`, travel = [35, 33, 30, 28][shot]!;
      if (shot === 3) for (const hit of burstEvents) {
        if (shieldPresent(frame) && hit.frame === frame && hit.actorId === context.casterId && hit.hitConfirmed === true && hit.beforeFinalStarLaunch === undefined) issue(`Q命中${hit.id}与第${v}轮最后一颗流星发射同帧；需要明确Q回调先后，决定能否积下一轮晚星。`);
      }
      emit(idHit, "star", frame + travel, frame, { launchFrame: frame, scalingFrame: frame, scalingId: `scale:${frame}`,
        triggerId: `volley-${v}`, observationId: JSON.stringify({ selectedTargetId: target, check: row }) });
      stars--;
      if (stars > 0) checkTarget(frame + 27, v, check + 1, target, shot + 1);
      else { shooting = false; starTickerSrc = frame; if (shieldPresent(frame)) tick(frame, frame + 90); }
    });
    const addStars = (amount: number, cd: "skill" | "burst", frame: number, id: string) => {
      if (!shieldPresent(frame)) { decide(id, frame, false, "产星时护盾已不存在。 "); return; }
      if (shooting) { decide(id, frame, false, "正在搜索或发射一轮流星，来源禁止继续积星。 "); return; }
      if ((cd === "skill" ? skillCD : burstCD) >= frame) { decide(id, frame, false, "相应产星冷却在本帧仍有效。 "); return; }
      if (cd === "skill") skillCD = frame + 18; else burstCD = frame + 30;
      stars = Math.min(4, stars + amount);
      decide(id, frame, true, `来源获得${amount}颗晚星，当前${stars}颗。`);
      if (stars === 4) { shooting = true; volley++; checkTarget(frame + 6, volley, 1); }
    };
    tick(19, 109);
    for (const row of skillEvents) task(row.frame, 4, () => {
      if (!shieldPresent(row.frame)) { decide(row.id, row.frame, false, "施放技能时护盾不存在，此事件不产生晚星。"); return; }
      if (!named(row.actorId)) { issue(`技能事件${row.id}缺少实际施放角色。`); return; }
      if (row.actorId === context.casterId && row.frame > 0) { issue("记录含莱依拉再次施放E，违反本次无实体替换协议。"); return; }
      addStars(2, "skill", row.frame, row.id);
    });
    // Only a callback coincident with the fourth launch changes the shooting-lock result.
    // Source insertion order depends on the external Q history, so that boundary is explicit.
    for (const row of burstEvents) task(row.frame, row.beforeFinalStarLaunch === false ? 3.5 : 2.5, () => {
      if (!shieldPresent(row.frame)) { decide(row.id, row.frame, false, "Q回调时护盾不存在，此事件不产生晚星。"); return; }
      if (named(row.actorId) && row.actorId !== context.casterId) { decide(row.id, row.frame, false, "不是莱依拉本人的Q命中，不产生本技能晚星。"); return; }
      if (row.hitConfirmed === false) { decide(row.id, row.frame, false, "明确没有发生Q命中回调。 "); return; }
      if (row.actorId !== context.casterId || row.hitConfirmed !== true) { issue(`Q事件${row.id}需确认是莱依拉本人的实际命中回调。`); return; }
      addStars(1, "burst", row.frame, row.id);
    });
    runTasks();
  }

  if (kind === "observed-yaoyao-burst-c0") {
    const ctx = context.yaoyao;
    if (ctx?.noPreexistingYuegui !== true) issue("此新鲜Q需要确认施放前没有投掷型或跳跃型月桂；不能漏算被Q改变的旧实体。");
    let end = 360;
    if (ctx?.exitFrame !== undefined) {
      if (!integer(ctx.exitFrame) || ctx.exitFrame < 56) issue("瑶瑶实际退场帧早于来源可取消时点或无效。");
      end = Math.min(end, ctx.exitFrame);
    } else if (ctx?.onFieldUntilEndConfirmed !== true) issue("瑶瑶Q需要明确持续在场，或提供实际退场帧。");
    lifecycleEndFrame = end;
    if (options.ascension === undefined) issue("缺少瑶瑶实际突破阶段，不能确定A1移动投掷是否存在。");
    const moves = intervals(ctx?.movementStates, "瑶瑶角色阶段实际动作");
    const throwInfo = (id: string, frame: number, a1: boolean) => {
      need(id, frame, "yaoyao-throw", a1 ? "A1实际范围敌人名单及目标；没有敌人则不投掷。" : "投掷时前台实际生命比例、范围敌人名单和实际目标。");
      const row = ctx?.throws?.[id];
      if (!row || row.completeRosterConfirmed !== true || !row.inRangeTargetIds || row.selectedTargetId === undefined) {
        issue(`${id}缺少投掷时完整目标事实。`); return undefined;
      }
      if (row.frame !== undefined && row.frame !== frame) issue(`${id}观察帧与来源第${frame}帧不符。`);
      if (new Set(row.inRangeTargetIds).size !== row.inRangeTargetIds.length) issue(`${id}敌人名单重复。`);
      if (row.inRangeTargetIds.length ? row.selectedTargetId === null || !row.inRangeTargetIds.includes(row.selectedTargetId) : row.selectedTargetId !== null) issue(`${id}实际随机选敌与范围内名单不一致。`);
      if (!a1 && (row.activeHpRatio === undefined || row.activeActorId !== context.casterId)) issue(`${id}需要明确仍是瑶瑶在前台及投掷前生命比例；换人会提前移除本次Q。`);
      return row;
    };
    emit("initial", "initial", 16, 16, { launchFrame: 0 });
    [104, 162, 221].forEach((spawn, petIndex) => {
      if (spawn >= end) {
        if (spawn === end && end !== 360) issue("瑶瑶退场恰与月桂生成同帧，来源队列先后未明。");
        return;
      }
      let n = 0;
      for (let launch = spawn + 29; launch < end; launch += 60) {
        const id = `pet-${petIndex + 1}-throw-${++n}`, row = throwInfo(id, launch, false);
        emit(id, "burstRadish", launch + 13, spawn, { snapshotId: `pet-${petIndex + 1}:spawn:${spawn}`, launchFrame: launch,
          triggerId: `pet-${petIndex + 1}`, triggerFrame: spawn, observationId: JSON.stringify(row ?? {}) });
      }
      if (end !== 360 && end >= spawn + 29 && (end - spawn - 29) % 60 === 0) issue("瑶瑶退场恰与月桂投掷同帧，缺少来源阶段先后证据。");
    });
    if (options.ascension !== undefined && options.ascension >= 1) {
      for (let frame = 36; frame <= end; frame += 36) {
        if (frame === end && end !== 360) { issue("瑶瑶退场恰与A1角色队列检查同帧，未明确先后顺序。"); continue; }
        const state = moves.find(row => row.startFrame <= frame && frame <= row.endFrame);
        if (!state || state.state === undefined || state.activeActorId !== context.casterId) { issue(`缺少第${frame}帧角色队列阶段瑶瑶实际动作状态。`); continue; }
        if (state.state === "other") { decide(`a1-${frame}`, frame, false, "A1检查时不是冲刺或跳跃。 "); continue; }
        if (frame < (state.state === "dash" ? 58 : 57)) { issue("Q不可中断阶段的记录却出现冲刺或跳跃，动作历史不可能同时成立。"); continue; }
        const id = `a1-${frame}`, row = throwInfo(id, frame, true);
        if (!row || row.inRangeTargetIds!.length === 0) { decide(id, frame, false, "A1检查没有已确认的范围内敌人，不生成萝卜。 "); continue; }
        const sample = frame + 12, role = sample <= end ? "burstRadish" : "skillRadish";
        if (sample === end && end !== 360) issue("A1萝卜取样恰与提前退场同帧，系数分支需要原事件顺序证据。");
        emit(id, role, frame + 13, sample, { launchFrame: frame, triggerId: id, triggerFrame: frame, observationId: JSON.stringify(row) });
      }
    }
  }

  if (kind === "observed-furina-skill-ousia-c0") {
    const ctx = context.furina, end = 1754;
    lifecycleEndFrame = end;
    if (ctx?.ousiaThroughoutConfirmed !== true) issue("请确认全程荒性，期间没有重击切换形态或重新召唤沙龙成员。");
    emit("initial", "initial", 18, 18, { launchFrame: 0, scalingFrame: 0, scalingId: "scale:0" });
    const specs = [
      { pet: "chevalmarin" as const, initial: 72.3333, mean: 97.5858, travel: 20 },
      { pet: "usher" as const, initial: 74.5, mean: 202.138, travel: 40 },
      { pet: "crabaletta" as const, initial: 71.5926, mean: 313.859, travel: 41 },
    ];
    for (const spec of specs) {
      const rows = ctx?.salonTicks?.[spec.pet];
      if (!rows?.length) { issue(`缺少${spec.pet}的实际随机发射帧及首次越界终止记录。`); continue; }
      let ended = false;
      for (let i = 0; i < rows.length; i++) {
        const launch = rows[i]!, lo = 18 + Math.round(spec.initial + i * spec.mean - 7), hi = 18 + Math.round(spec.initial + i * spec.mean + 7);
        const id = `${spec.pet}-${i + 1}`;
        if (!integer(launch) || launch < lo || launch > hi) issue(`${id}实际发射帧必须处于固定来源第${lo}至${hi}帧的随机窗口内。`);
        if (ended) { issue(`${spec.pet}包含首次实体结束检查之后的多余发射记录。`); break; }
        if (launch > end) { ended = true; decide(id, launch, false, "此来源定时检查超过实体寿命，不再发射或继续排队。 "); continue; }
        const impact = launch + spec.travel, party = ctx?.partyAtLaunch?.[id];
        let count: number | undefined;
        if (impact <= end) {
          need(id, launch, "furina-party", "本次发射前完整队伍实际生命值与前台Q动画状态。");
          if (party?.completePartyConfirmed === true && party.members?.length && named(party.activeActorId) && party.activeInBurstAnimation !== undefined) {
            if (new Set(party.members.map(row => row.actorId)).size !== party.members.length || !party.members.some(row => row.actorId === party.activeActorId)) issue(`${id}队伍角色重复，或前台角色不在完整名单中。`);
            for (const member of party.members) if (member.currentHP > member.maxHP) issue(`${id}实际生命值超过生命上限。`);
            count = party.members.filter(member => member.currentHP > member.maxHP * .5).length;
          } else if (context.targetContacts?.[id] === true) issue(`${id}实际命中需要完整扣血前队伍生命状态；前台Q无敌角色仍计入增幅资格。`);
        }
        const phase = ctx?.a4FirstRefreshFrame;
        const refresh = phase === undefined ? undefined : phase + 30 * Math.floor((impact - phase) / 30);
        emit(id, spec.pet, impact, impact, { launchFrame: launch, scalingFrame: launch, scalingId: `scale:${launch}`,
          furinaPartyMembersAboveHalf: count, a4RefreshFrame: refresh,
          observationId: JSON.stringify({ launch, party: party ?? null }) }, impact > end);
      }
      if (!ended) issue(`${spec.pet}缺少首次越界的终止定时记录，不能确认没有漏掉后续攻击。`);
    }
  }

  if (kind === "observed-emilie-skill-c0" || kind === "observed-emilie-burst-c0") {
    const ctx = context.emilie, burst = kind === "observed-emilie-burst-c0";
    const travel = ctx?.caseTravelFrames;
    if (!integer(travel)) issue("艾梅莉埃需要明确香调实体的实际旅行帧数，不能默认为固定距离。");
    if (options.ascension === undefined) issue("缺少艾梅莉埃实际突破阶段，不能确定收香是否触发A1伤害。");
    if (ctx?.burningHistoryComplete !== true) issue("需要完整燃烧范围状态记录；不能把未知燃烧当成从未燃烧。");
    const burning = intervals(ctx?.burningWithin20, "香调20米范围燃烧状态");
    const spawn = burst ? 306 : 16, end = spawn + 1320;
    lifecycleEndFrame = end;
    let level = 1, scents = 0, scentCD = -1, scentReset = burst ? 576 : 496, a1Count = 0, attackCount = 0;
    const sampleBurning = (frame: number) => {
      need(`burning-${frame}`, frame, "emilie-burning", "此帧香调20米范围内是否存在燃烧敌人。");
      const row = burning.find(item => item.startFrame <= frame && frame <= item.endFrame);
      if (!row || row.burningPresent === undefined) { issue(`缺少第${frame}帧20米范围实际燃烧状态。`); return undefined; }
      return row.burningPresent;
    };
    const collect = (frame: number) => {
      if (frame > end) return;
      if (frame > scentReset && level > 1) { level = 1; scents = 0; decide(`reset-${frame}`, frame, true, "8秒内未再次获得香韵，来源降回一级并清空香韵。 "); }
      if (scents >= 2) {
        if (level < 2) { level++; scents -= 2; decide(`level-${frame}`, frame, true, "消耗两份香韵，香调升级为二级。 "); }
        else if (options.ascension !== undefined && options.ascension >= 1) {
          scents -= 2;
          const id = `a1-${++a1Count}`;
          emit(id, "a1", frame + 18, frame + 18, { launchFrame: frame, triggerId: `collect-${frame}`, triggerFrame: frame,
            observationId: JSON.stringify({ level, remainingScents: scents }) });
        }
      }
      // The pinned source schedules a new collector even when invoked synchronously by an attack.
      task(frame + 30, 2, () => collect(frame + 30));
    };
    const onBurning = (frame: number) => {
      if (frame > end) return;
      if (frame > scentCD) {
        const yes = sampleBurning(frame);
        if (yes === true) { scents++; scentCD = frame + 120; scentReset = frame + 480; decide(`scent-${frame}`, frame, true, "范围内燃烧产生一份香韵，并刷新120帧冷却与480帧重置计时。 "); }
      }
      task(frame + 30, 2, () => onBurning(frame + 30));
    };
    const attack = (frame: number) => {
      if (frame > end) return;
      const n = ++attackCount, role = level === 1 ? "level1" : "level2";
      if (integer(travel)) {
        emit(`case-${n}-1`, role, frame + travel, frame + travel, { launchFrame: frame, observationId: JSON.stringify({ level, scents }) });
        if (level === 2) emit(`case-${n}-2`, role, frame + 18 + travel, frame + 18 + travel, { launchFrame: frame, observationId: JSON.stringify({ level, scents }) });
      }
      collect(frame);
      task(frame + 90, 2, () => attack(frame + 90));
    };
    if (!burst) {
      emit("initial", "initial", 37, 37, { launchFrame: 0 });
      if (ctx?.arkheReady === undefined) issue("需要明确灵息之刺来源冷却是否就绪。");
      if (ctx?.arkheReady === true) emit("arkhe", "arkhe", 62, 62, { launchFrame: 0 });
      else if (ctx?.arkheReady === false) issue("此分支声明无先前技能冷却；灵息之刺不就绪与新鲜施放条件矛盾。");
    } else {
      const marks = new Map<string, number>();
      for (let i = 0; i < 9; i++) {
        const id = `burst-${i + 1}`, launch = 114 + i * 18, row = ctx?.burstSelections?.[id];
        select(id, launch, row, marks, 42, "emilie-selection");
        emit(id, "burst", launch + 12, launch + 12, { launchFrame: launch, observationId: JSON.stringify(row ?? {}) });
      }
    }
    // Character tasks are inserted in exactly the source spawn order: attack, burning, collection.
    task(spawn + 90, 2, () => attack(spawn + 90));
    task(spawn + 30, 2, () => onBurning(spawn + 30));
    task(spawn + 30, 2, () => collect(spawn + 30));
    runTasks();
  }

  const requiredObservedThroughFrame = Math.max(lifecycleEndFrame, lastFrame);
  if (!integer(context.observedThroughFrame) || context.observedThroughFrame < requiredObservedThroughFrame) issue(`记录必须至少覆盖第${requiredObservedThroughFrame}帧，包括来源保留的最后伤害尾段。`);
  candidates.sort((a, b) => a.frame - b.frame);
  instances.sort((a, b) => a.frame - b.frame);
  decisions.sort((a, b) => a.frame - b.frame);
  requiredObservations.sort((a, b) => a.frame - b.frame);
  return { candidates, instances, issues, decisions, requiredObservations, lifecycleEndFrame, requiredObservedThroughFrame, complete: issues.length === 0 };
}
