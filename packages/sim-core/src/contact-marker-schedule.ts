import type { ObservedEntityScheduleContext } from "./observed-entity-context";
import type { ObservedEntityCandidate, ObservedEntityDecision, ObservedEntityHitInstance, ObservedEntitySchedule } from "./observed-entity-schedule";

export const CONTACT_MARKER_CAST_KINDS = ["observed-kaeya-burst-c0", "observed-hutao-skill-c0", "observed-aloy-skill-c0"] as const;
export type ContactMarkerCastKind = typeof CONTACT_MARKER_CAST_KINDS[number];
export const isContactMarkerCastKind = (kind: string): kind is ContactMarkerCastKind => (CONTACT_MARKER_CAST_KINDS as readonly string[]).includes(kind);

/** These are finite, explicitly selected reference protocols. Kaeya's rotating
 * collision approximation and Aloy's bomblet parameter are not a game-geometry
 * model. Hu Tao's CA observations only apply/refresh the E-owned marker. */
export function compileContactMarkerSchedule(kind: ContactMarkerCastKind, context: ObservedEntityScheduleContext): ObservedEntitySchedule {
  const candidates: ObservedEntityCandidate[] = [], instances: ObservedEntityHitInstance[] = [];
  const decisions: ObservedEntityDecision[] = [], issues: string[] = [];
  const issue = (message: string) => { if (!issues.includes(message)) issues.push(message); };
  const decide = (eventId: string, frame: number, accepted: boolean, reason: string) => decisions.push({ eventId, frame, accepted, reason });
  if (!context.casterId) issue("缺少实际施放角色标识。");
  if (!context.targetId) issue("缺少此次完整观察所选敌人标识。");
  for (const [key, message] of [
    ["freshCastConfirmed", "请确认无上一施放的标记、冰凌、线圈、冰驰或其他本技能遗留状态。"],
    ["noHitlag", "请确认没有卡肉时钟延长；本来源日程明确使用全局帧。"],
    ["noInterruption", "请确认施放与所记录动作未被中断；来源允许的结束须完整记录。"],
    ["noReplacement", "请确认没有重复施放、实体替换或角色死亡造成的状态重置。"],
    ["fullObservedLifetime", "请确认完整观察当前选定来源协议的全部机会、标记期限及已发出尾段。"],
  ] as const) if (context[key] !== true) issue(message);
  let lifecycleEndFrame = 0, lastDamageFrame = 0;
  const emit = (id: string, templateRole: ObservedEntityHitInstance["templateRole"], frame: number, snapshotFrame: number,
    metadata: Partial<ObservedEntityHitInstance> = {}) => {
    const event: ObservedEntityHitInstance = { id, templateRole, frame, snapshotFrame, snapshotId: `sample:${snapshotFrame}`,
      targetId: context.targetId ?? "", ...metadata };
    const contact = context.targetContacts?.[id];
    candidates.push({ ...event, contact });
    lastDamageFrame = Math.max(lastDamageFrame, frame);
    if (contact === undefined) issue(`请明确 ${id}（第${frame}帧）是否实际命中所选目标，未知接触不能按0处理。`);
    else decide(id, frame, contact, contact ? "明确观察到所选目标接触。" : "明确观察到未接触所选目标。");
    if (contact === true) instances.push(event);
    return contact;
  };

  if (kind === "observed-kaeya-burst-c0") {
    if (context.kaeya?.fixedSourceApproximationConfirmed !== true) issue("必须明确选择固定源码13次旋转接触机会的简化协议；它不覆盖游戏中可能出现的14／15次接触。");
    lifecycleEndFrame = 534;
    for (let index = 0; index < 13; index++) emit(`icicle-${index + 1}`, "icicle", 53 + 40 * index, 0,
      { launchFrame: 53 + 40 * index, observationId: `reference-rotation-${index + 1}` });
  }

  if (kind === "observed-aloy-skill-c0") {
    const source = context.aloy;
    if (source?.fixedSourceApproximationConfirmed !== true) issue("必须明确选择固定源码的travel／bomb_delay／bomblets简化协议；没有据此认证游戏中的散落物寿命与真实碰撞。");
    if (source?.allSourceBombletsDeclared !== true) issue("请确认全部来源小弹参数已明确记录；未提供数量不是0，也不能自动采用源码默认2。");
    if (source?.travelFrames === undefined) issue("缺少主弹实际飞行帧数。");
    if (source?.bombDelayFrames === undefined) issue("缺少小弹来源额外等待帧数。");
    if (source?.bombletCount === undefined) issue("缺少该固定来源日程的小弹数量。");
    if (source?.travelFrames !== undefined && source.bombDelayFrames !== undefined && source.bombletCount !== undefined) {
      const spawn = 20 + source.travelFrames;
      emit("main", "main", spawn, 20, { launchFrame: 20, observationId: "reference-main-bomb" });
      for (let index = 1; index <= source.bombletCount; index++) {
        const frame = spawn + source.bombDelayFrames + 6 * index;
        const contact = emit(`bomblet-${index}`, "bomblet", frame, spawn,
          { launchFrame: spawn, observationId: `reference-bomblet-${index}` });
        if (contact === true) decide(`coil-callback-${index}`, frame, true,
          "该接触进入来源线圈回调；其他敌人的接触未由本目标记录推定，不反推全局线圈层数。A1／冰驰后续普通攻击不归入本E自身伤害，所有本E小弹已在此前完成进攻快照。");
      }
      lifecycleEndFrame = Math.max(spawn, spawn + source.bombDelayFrames + source.bombletCount * 6);
    }
  }

  if (kind === "observed-hutao-skill-c0") {
    const source = context.hutao;
    if (source?.allChargedAttacksRecorded !== true || source.chargedAttacks === undefined) issue("缺少完整实际重击观察列表；明确无重击须提供空列表并确认完整。");
    if (source?.noSwapUntilNaturalEnd !== true && source?.exitFrame === undefined) issue("必须明确自然结束前不切人，或提供真实切离帧。");
    if (source?.noSwapUntilNaturalEnd === true && source.exitFrame !== undefined) issue("不切人声明与切离帧不能同时存在。");
    if (source?.exitFrame !== undefined && source.exitFrame < 52) issue("此无中断参考施放不能早于E到切人的第52帧切离。");
    if (source?.skillStartCurrentHP === undefined || source.skillStartMaxHP === undefined || source.skillStartBaseATK === undefined) issue("缺少E起手实际当前生命、最大生命或基础攻击；不能用后续血梅香面板补造起手状态。");
    if (source?.skillStartCurrentHP !== undefined && source.skillStartMaxHP !== undefined && source.skillStartCurrentHP > source.skillStartMaxHP) issue("E起手当前生命不能高于起手最大生命。");
    type Task = { frame: number; phase: number; order: number; run: () => void };
    const tasks: Task[] = []; let order = 0, stanceExpires = 554, exited = false, stanceDeleted = false, generation = 0;
    let markExpires = -1, markSource = -1, markerGeneration = 0;
    const add = (frame: number, phase: number, run: () => void) => tasks.push({ frame, phase, order: order++, run });
    const active = (frame: number) => !exited && !stanceDeleted && frame <= stanceExpires;
    const tick = (frame: number, src: number, mark: number, tickIndex: number) => add(frame, 0, () => {
      if (src !== markSource || frame > markExpires) { decide(`blossom-${mark}-${tickIndex}`, frame, false, "原标记来源已替换或已到期，此检查不产生新伤害。"); return; }
      // Snapshot Stats removes a stat modifier at equality (unlike the CA's
      // preceding StatModIsActive check). No readonly audit query mutates it.
      if (frame >= stanceExpires) stanceDeleted = true;
      emit(`blossom-${mark}-${tickIndex}`, "blossom", frame, frame,
        { triggerId: `mark-${mark}`, triggerFrame: src, paramitaActiveAtSnapshot: !exited && !stanceDeleted });
      tick(frame + 240, src, mark, tickIndex + 1);
    });
    if (source?.exitFrame !== undefined) add(source.exitFrame, 1, () => { exited = true; stanceExpires = Math.min(stanceExpires, source.exitFrame!); });
    const ids = new Set<string>();
    for (const charge of source?.chargedAttacks ?? []) {
      if (ids.has(charge.id)) issue(`重击观察标识${charge.id}重复。`); ids.add(charge.id);
      if (charge.removedFrame <= charge.startFrame || charge.nextState === "burst" && charge.removedFrame < charge.startFrame + 33) { issue(`重击${charge.id}缺少来源允许的真实结束帧；接大招至少为起手后33帧。`); continue; }
      if (charge.actorId !== context.casterId) { decide(charge.id, charge.startFrame, false, "非本角色重击，不归属本次E。 "); continue; }
      add(charge.startFrame, 2, () => {
        if (!active(charge.startFrame)) { decide(charge.id, charge.startFrame, false, "已离开本次彼岸蝶舞窗口；后续普通重击不能施加或刷新本E血梅香。"); return; }
        if (charge.startFrame === stanceExpires) {
          issue(`重击${charge.id}恰在彼岸蝶舞到期帧；此记录未包含该帧此前所有Stats取样，不能判断增益是否已被删除。请以独立已发生命中明确状态，本完整日程暂不认证此边界。`);
          return;
        }
        if (charge.startFrame < 28) issue(`重击${charge.id}早于E最早可接动作窗口，不能作为完整无中断施放。`);
        stanceExpires += 108;
        add(charge.removedFrame, 1, () => { if (!exited && charge.nextState !== "burst") stanceExpires -= 108; });
        const hitFrame = charge.startFrame + 3;
        add(hitFrame, 3, () => {
          if (charge.targetId !== context.targetId) { decide(charge.id, hitFrame, false, "明确命中其他目标；不改变所选目标的标记。"); return; }
          if (charge.hitConfirmed === undefined) { issue(`缺少重击${charge.id}实际接触判定，不能假定施加或刷新标记。`); return; }
          decide(charge.id, hitFrame, charge.hitConfirmed, charge.hitConfirmed ? "本E实际重击接触施加／刷新标记；重击本体仍属于普攻，不计入E总伤。" : "明确未接触，不施加或刷新标记。");
          if (!charge.hitConfirmed) return;
          if (markExpires < hitFrame) { markSource = hitFrame; markerGeneration = ++generation; tick(hitFrame + 240, markSource, markerGeneration, 1); }
          markExpires = hitFrame + 570;
          lifecycleEndFrame = Math.max(lifecycleEndFrame, markExpires);
        });
      });
    }
    while (tasks.length) { tasks.sort((a, b) => a.frame - b.frame || a.phase - b.phase || a.order - b.order); tasks.shift()!.run(); }
    lifecycleEndFrame = Math.max(lifecycleEndFrame, exited ? source!.exitFrame! : stanceExpires);
  }
  const requiredObservedThroughFrame = Math.max(lifecycleEndFrame, lastDamageFrame);
  if (context.observedThroughFrame === undefined || context.observedThroughFrame < requiredObservedThroughFrame) issue(`完整记录至少需要覆盖第${requiredObservedThroughFrame}帧，不能在最后一次选中命中处截断。`);
  return { candidates, instances, issues, decisions, requiredObservations: [], lifecycleEndFrame,
    requiredObservedThroughFrame, complete: issues.length === 0 };
}
