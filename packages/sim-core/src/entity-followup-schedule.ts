import type { EntityFollowupEvent, EntityFollowupScheduleContext } from "./entity-followup-context";

export const ENTITY_FOLLOWUP_CAST_KINDS = ["entity-followup-jahoda-burst-c0", "entity-followup-nicole-burst-c0", "entity-followup-odette-skill-c0", "entity-followup-odette-burst-c0"] as const;
export type EntityFollowupCastKind = typeof ENTITY_FOLLOWUP_CAST_KINDS[number];
export type EntityFollowupHitInstance = Omit<EntityFollowupEvent, "candidateId"> & { id: string };
export interface EntityFollowupSchedule {
  candidates: Array<EntityFollowupHitInstance & { contact: boolean | undefined }>;
  instances: EntityFollowupHitInstance[]; issues: string[];
  decisions: Array<{ eventId: string; frame: number; accepted: boolean; reason: string }>;
  requiredObservations: Array<{ key: string; frame: number; kind: "absorption" | "selection" | "healing"; label: string }>;
  lifecycleEndFrame: number; requiredObservedThroughFrame: number; complete: boolean;
}
const elements = ["pyro", "hydro", "electro", "cryo"] as const;

/** Fixed-source full fresh entity lifetimes, with actual target contact separated from generated opportunities. */
export function compileEntityFollowupSchedule(kind: EntityFollowupCastKind, context: EntityFollowupScheduleContext,
  options: { ascension?: number | undefined } = {}): EntityFollowupSchedule {
  const result: EntityFollowupSchedule = { candidates: [], instances: [], issues: [], decisions: [], requiredObservations: [], lifecycleEndFrame: 0, requiredObservedThroughFrame: 0, complete: false };
  const issue = (message: string) => { if (!result.issues.includes(message)) result.issues.push(message); };
  const decide = (eventId: string, frame: number, accepted: boolean, reason: string) => result.decisions.push({ eventId, frame, accepted, reason });
  const requireObservation = (key: string, frame: number, observationKind: EntityFollowupSchedule["requiredObservations"][number]["kind"], label: string) => result.requiredObservations.push({ key, frame, kind: observationKind, label });
  if (!(ENTITY_FOLLOWUP_CAST_KINDS as readonly string[]).includes(kind)) issue("没有此实体完整施放来源。");
  if (!context.casterId || !context.targetId) issue("需要明确施放角色及所选敌人标识。");
  for (const [key, label] of [["freshCastConfirmed", "确认新生实体，无本能力旧状态及触发冷却"], ["noHitlag", "确认无卡肉"], ["noInterruption", "确认动作未被中断"], ["noReplacement", "确认没有替换、重复施放或死亡重置"], ["fullObservedLifetime", "确认完整观察实体生命期及已发出尾段"]] as const) {
    if (context[key] !== true) issue(label + "。");
  }
  const emit = (id: string, role: string, frame: number, snapshotFrame: number, element: EntityFollowupEvent["element"], extras: Partial<EntityFollowupHitInstance> = {}) => {
    const row: EntityFollowupHitInstance = { id, templateRole: role, frame, snapshotFrame, snapshotId: `sample:${context.casterId ?? "caster"}:${snapshotFrame}`, ownerId: context.casterId ?? "", targetId: context.targetId ?? "", element, ...extras };
    const contact = context.targetContacts?.[id];
    result.candidates.push({ ...row, contact });
    result.requiredObservedThroughFrame = Math.max(result.requiredObservedThroughFrame, frame);
    if (contact === undefined) issue(`请明确 ${id}（第${frame}帧）是否实际命中所选敌人。`);
    else { decide(id, frame, contact, contact ? "实际接触所选敌人。" : "实际落空，不加入伤害。"); if (contact) result.instances.push(row); }
  };

  if (kind === "entity-followup-jahoda-burst-c0") {
    const ctx = context.jahoda, asc = options.ascension;
    result.lifecycleEndFrame = 790;
    emit("initial", "initial", 43, 0, "anemo");
    if (ctx?.noShadowPursuit !== true) issue("雅珂达Q起手不能处于E追袭状态，请明确确认。");
    if (ctx?.moonsignLevel === undefined) issue("需要实际队伍月兆等级，不能默认出现机器人伤害。");
    if (asc === undefined) issue("需要雅珂达实际突破阶段，以决定A1机器人分支及A4。");
    let a1Element: typeof elements[number] | undefined;
    if (asc !== undefined && asc >= 1) {
      if (ctx?.completePartyConfirmed !== true || !ctx.partyElements || !ctx.partyElements.includes("anemo")) issue("A1需要完整实际队伍元素名单（含雅珂达）。");
      else {
        let highest = 0;
        for (const element of elements) { const count = ctx.partyElements.filter(value => value === element).length; if (count > highest) { highest = count; a1Element = element; } }
      }
    }
    const heals: Array<{ frame: number; owner: string; active: boolean }> = [];
    if (asc !== undefined && asc >= 4 && (ctx?.moonsignLevel ?? 0) >= 2) {
      for (let frame = 12; frame < 790; frame += 87) {
        const key = `heal:${frame}`, row = ctx?.healChecks?.[key];
        requireObservation(key, frame, "healing", "本次治疗前的场上角色和实际生命比例；只据此前置状态决定A4。");
        if (!row?.activeActorId || row.hpRatioBeforeHeal === undefined) issue(`${key}缺少治疗前场上角色或生命比例。`);
        else heals.push({ frame, owner: row.activeActorId, active: row.hpRatioBeforeHeal > .7 });
      }
    }
    if ((ctx?.moonsignLevel ?? 0) >= 2) {
      if (a1Element !== "pyro") issue("固定a7dc4bf源码未初始化非Pyro分支的a1DmgMult，机器人会错误得到0；此来源冲突尚未核准，不能宣称该分支完整。请保留实际条件，不将它自动改成Pyro或乘数1。");
      const robotCount = a1Element === "electro" ? 3 : 2, interval = a1Element === "cryo" ? 126 : 140;
      for (let robot = 1; robot <= robotCount; robot++) {
        let absorbed: typeof elements[number] | undefined, absorptionFrame = 6 + 41 * (robot - 1);
        for (; absorptionFrame <= 790; absorptionFrame += Math.trunc(interval / 3)) {
          const key = `robot-${robot}:absorb:${absorptionFrame}`, check = ctx?.absorptionChecks?.[key];
          requireObservation(key, absorptionFrame, "absorption", "固定施放位置5米范围内，全部存活敌人实际火水雷冰附着；按火水雷冰优先级吸收。");
          if (check?.allAurasInAreaConfirmed !== true || !check.elementsPresent) { issue(`${key}缺少完整实际附着观察；不能把未知当无元素。`); break; }
          absorbed = elements.find(element => check.elementsPresent!.includes(element));
          decide(key, absorptionFrame, absorbed !== undefined, absorbed ? `实际吸收${absorbed}。` : "明确无可吸收元素，稍后继续检查。");
          if (absorbed) break;
        }
        if (!absorbed) continue;
        for (let frame = absorptionFrame + 41, tick = 1; frame <= 790; frame += interval, tick++) {
          const key = `robot-${robot}:tick-${tick}`, row = ctx?.attackSelections?.[key];
          requireObservation(key, frame, "selection", "本次按距离排序后实际选中的至多3个存活敌人；每个选敌都会生成独立1.2米攻击。");
          if (row?.completeSelectionConfirmed !== true || !row.closestAliveEnemyIds) { issue(`${key}缺少最近敌人的完整实际选择。`); continue; }
          if (new Set(row.closestAliveEnemyIds).size !== row.closestAliveEnemyIds.length) issue(`${key}包含重复选敌标识。`);
          const a4Active = asc !== undefined && asc >= 4 && heals.some(heal => heal.active && heal.owner === context.casterId && heal.frame <= frame && frame < heal.frame + 360);
          row.closestAliveEnemyIds.forEach((enemy, index) => emit(`${key}:target-${index + 1}`, "robot", frame, frame, absorbed!, {
            scalingFrame: absorptionFrame, damageMultiplier: a1Element === "pyro" ? 1.3 : 0, ownA4EM: a4Active ? 100 : 0,
            observationId: JSON.stringify({ robot, selectedTargetId: enemy, selected: row.closestAliveEnemyIds, absorptionFrame, element: absorbed }),
          }));
        }
      }
    }
  }

  if (kind === "entity-followup-nicole-burst-c0") {
    const ctx = context.nicole;
    result.lifecycleEndFrame = 1309;
    emit("initial", "initial", 108, 108, "pyro");
    if (ctx?.noSkillBuffThroughout !== true) issue("此Q新生协议要求全程无尼可E增益；E/A1/A4升级日程和突破门控来源差异尚未接入。");
    if (ctx?.allEnemyHitEventsRecorded !== true || !ctx.enemyHitEvents) issue("请完整记录状态期间所有实际OnEnemyHit事件，不能默认4次造影。");
    if (ctx?.eventsInSourceOrderConfirmed !== true) issue("请确认同帧敌人命中事件按实际来源顺序记录；冷却不能任意选择同帧的触发角色。");
    if (ctx?.casterIsHexerei === undefined || ctx.partyHexereiCount === undefined) issue("需要尼可实际魔导资格及队伍魔导人数。");
    const rows = [...(ctx?.enemyHitEvents ?? [])].sort((a, b) => a.frame - b.frame);
    const ids = new Set<string>(); let lastProc = -Infinity, count = 0;
    for (const row of rows) {
      if (ids.has(row.id)) issue(`造影事件标识${row.id}重复。`); ids.add(row.id);
      if (row.frame < 109 || row.frame > 1309 || row.actorId !== row.activeActorId || count >= 4 || row.frame <= lastProc + 180) {
        decide(row.id, row.frame, false, "不在有效期、非当时场上角色、已满4次或180帧冷却（含端点）尚未结束。"); continue;
      }
      if (row.enemyHitHookFired === undefined) { issue(`${row.id}需要明确固定来源OnEnemyHit是否实际触发。`); continue; }
      if (!row.enemyHitHookFired) { decide(row.id, row.frame, false, "实际未触发OnEnemyHit。 "); continue; }
      if (row.frame === 109 && row.afterStatusActivation === undefined) { issue(`${row.id}与状态生成同帧，需要明确在角色任务激活之后还是之前。`); continue; }
      if (row.frame === 109 && row.afterStatusActivation === false) { decide(row.id, row.frame, false, "发生于同帧状态激活前。"); continue; }
      if (ctx?.casterIsHexerei && (ctx.partyHexereiCount ?? 0) >= 2 && row.actorIsHexerei === undefined) issue(`${row.id}缺少投影归属角色的实际魔导资格。`);
      count++; lastProc = row.frame;
      const hexereiBonus = ctx?.casterIsHexerei === true && (ctx.partyHexereiCount ?? 0) >= 2 && row.actorIsHexerei === true;
      decide(row.id, row.frame, true, `接受第${count}次造影，30帧后由${row.actorId}造成伤害。`);
      emit(`projection-${count}`, "projection", row.frame + 30, row.frame + 30, row.actorElement, {
        ownerId: row.actorId, snapshotId: `sample:${row.actorId}:${row.frame + 30}`, triggerId: row.id, triggerFrame: row.frame,
        hexereiBonus, observationId: JSON.stringify(row),
      });
    }
  }

  if (kind === "entity-followup-odette-skill-c0" || kind === "entity-followup-odette-burst-c0") {
    const ctx = context.odette, burst = kind === "entity-followup-odette-burst-c0", summon = burst ? 1 : 23;
    for (const [key, label] of [["noPriorDanceDouble", "无先前倒影"], ["noUpgradeThroughout", "完整生命期内无升级状态"], ["noCodaOrRefreshThroughout", "完整生命期内无破晓终奏、刷新或再次召唤"]] as const) {
      if (ctx?.[key] !== true) issue(`奥黛塔此分支需要明确${label}；其他分支不能压成初击完整。`);
    }
    result.lifecycleEndFrame = summon + 1262;
    if (burst) {
      [112, 128, 140].forEach((frame, index) => emit(`slash-${index + 1}`, "slash", frame, frame, "cryo"));
      emit("final", "final", 144, 144, "cryo");
      if (context.skillTalentLevel === undefined) issue("Q所生倒影使用E等级，需要明确有效E天赋等级。");
    } else emit("initial", "initial", 23, 23, "cryo");
    let plume = true, index = 1;
    for (let frame = summon + (burst ? 252 : 134); frame <= result.lifecycleEndFrame; index++) {
      emit(`dance-${index}`, plume ? "plume" : "wing", frame, frame, "cryo");
      frame += plume ? 109 : 125; plume = !plume;
    }
  }
  result.requiredObservedThroughFrame = Math.max(result.requiredObservedThroughFrame, result.lifecycleEndFrame + 1);
  if (context.observedThroughFrame === undefined || context.observedThroughFrame < result.requiredObservedThroughFrame) issue(`观察记录至少需要覆盖第${result.requiredObservedThroughFrame}帧。`);
  result.candidates.sort((a, b) => a.frame - b.frame);
  result.instances.sort((a, b) => a.frame - b.frame);
  result.complete = result.issues.length === 0;
  return result;
}
