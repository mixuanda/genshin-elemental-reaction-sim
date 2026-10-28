import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";
import type { CalculatorRequirementAdapter, CalculatorFieldRequirementDraft } from "./calculator-requirements";
import { travelerAnemoConstellationScope } from "../../../packages/sim-core/src/traveler-cross-entity-formulas";
import { compileTravelerCrossEntitySchedule, type TravelerCrossEntityCastKind } from "../../../packages/sim-core/src/traveler-cross-entity-schedule";
import { TRAVELER_ANEMO_ABSORPTION_CHECK_FRAMES } from "../../../packages/sim-core/src/traveler-cross-entity-anemo-source";

const applies = (document: CalculatorDocument): boolean => travelerAnemoConstellationScope(document) !== undefined;
const prefix = "gameContext.travelerCrossEntityCast.";
const selector = (key: string, type: "state" | "enum" | "number" | "text") => {
  const value = `${prefix}${key}`.replace(/["\\]/g, char => `\\${char}`);
  return type === "number" ? `input[data-field="${value}"]` : `${type === "text" ? "input" : "select"}[data-source-cast-${type}-field="${value}"]`;
};

/** Links existing actual-state inputs. Never supplies contacts, an absorption
 * frame, target state or a historical snapshot on the player's behalf. */
export const travelerCrossRequirementAdapter: CalculatorRequirementAdapter = {
  id: "traveler-cross-anemo-single-hit-conditions", applies,
  collect(document) {
    if (!travelerAnemoConstellationScope(document)?.allowed) return [];
    const game = document.gameContext!, context = game.travelerCrossEntityCast ?? {}, complete = document.scope !== "single-hit";
    const hits = document.hits.filter(hit => hit.kind === "ordinary" && document.selectedHitIds.includes(hit.id));
    if (!hits.length) return [];
    const fields: CalculatorFieldRequirementDraft[] = [], scheduleDependency = "traveler-cross-entity:schedule";
    const add = (key: string, label: string, type: "state" | "enum" | "number" | "text", value: unknown,
      explanation: string, dependencyIds = [scheduleDependency], hitIds = hits.map(hit => hit.id)) => fields.push({
      id: `traveler-cross:${key}`, fieldPath: `${prefix}${key}`, controlSelector: selector(key, type), label, explanation,
      status: value === undefined || value === null || value === "" ? "input-required" : "condition-not-satisfied", dependencyIds, hitIds,
    });
    if (context.trueMoonStoryBuffInactive !== true) add("trueMoonStoryBuffInactive", "本击没有「真月」剧情限定增益", "state", context.trueMoonStoryBuffInactive,
      "只按这次实际命中的状态确认；若当时有该剧情增益，本入口继续阻塞。不会从地区、剧情进度或当前面板推断，也不要求未来命中记录。");
    const anemo = context.anemo;
    let plannedAbsorbed = false;
    if (complete) {
      for (const [key, label] of [["freshCastConfirmed", "本次为新施放，未混入前次伤害"], ["noHitlag", "完整过程没有卡肉延长"],
        ["noInterruption", "本次施放及已排队伤害没有中断"], ["noReplacement", "没有重施、实体替换或状态重置"],
        ["fullObservedLifetime", "全部来源机会、落空与尾段均已实际观察"]] as const) {
        if (context[key] !== true) add(key, label, "state", context[key], "只确认实际已观察的完整过程；不能为了得到总伤而推测。也可以切换为已发生的单击。");
      }
      for (const [key, label] of [["casterId", "本次施放者标识"], ["targetId", "本次所选敌人标识"]] as const) {
        if (!context[key]) add(key, label, "text", context[key], "施放者与实际所选目标必须明确，不从当前站场角色或索敌推测。");
      }
      if (anemo?.noAbsorption === undefined) add("anemo.noAbsorption", "本次 Q 全程没有吸收元素", "state", undefined, "请选择真实的无吸收或发生吸收分支；未知不会默认无吸收。");
      const schedule = compileTravelerCrossEntitySchedule(game.skillId as TravelerCrossEntityCastKind, context, game.constellation);
      plannedAbsorbed = schedule.candidates.some(hit => hit.templateRole === "absorbed-tick");
      if (context.observedThroughFrame === undefined || context.observedThroughFrame < schedule.requiredObservedThroughFrame) add("observedThroughFrame", "实际观察到的末帧", "number", context.observedThroughFrame,
        `本分支至少观察到第${schedule.requiredObservedThroughFrame}帧；首次成功吸收后不再要求无吸收的363帧尾递归。`);
      if (context.statsStableAcrossHits !== true && schedule.candidates.some(hit => !context.snapshots?.[hit.snapshotId])) add("statsStableAcrossHits", "共同面板确实代表 Q 起手时的进攻快照", "state", context.statsStableAcrossHits,
        "明确共同面板适用于对应元素的起手快照，或在历史快照中提供真实数值；不能拿吸收时或命中时面板倒填起手。");
      for (const candidate of schedule.candidates) if (context.targetContacts?.[candidate.id] === undefined) add(`targetContacts.${candidate.id}`, `${candidate.templateRole === "absorbed-tick" ? "吸收附加" : "风伤"} · 第${candidate.frame}帧是否实际命中`, "state", undefined,
        "候选不是命中保证。落空不会产生伤害或六命减抗；风伤和吸收附加范围不同，分别填写实际接触。");
      if (game.constellation >= 6 && anemo?.c6InitiallyInactive !== true) add("anemo.c6InitiallyInactive", "Q 起手时，敌人还没有本命座的风／吸收元素减抗", "state", anemo?.c6InitiallyInactive,
        "完整C6当前只证明这个明确初始分支；已有或未知旧减抗请计算实际单击，不推测剩余时间。");
    }
    const selectedAbsorbed = !complete && (anemo?.singleHitRole === "absorbed-tick" || hits.some(hit => hit.kind === "ordinary" &&
      (hit.travelerCrossEntityEvent?.templateRole === "absorbed-tick" || hit.id.endsWith(":absorbed-single"))));
    if (selectedAbsorbed && anemo?.noAbsorption !== false) add("anemo.noAbsorption", "计算吸收附加：本次 Q 全程未吸收请选择否", "state", anemo?.noAbsorption,
      "这次已经发生的附加伤害必须属于真实吸收分支；不能与无吸收或未知状态混用。");
    const needsElement = anemo?.noAbsorption === false && (complete || selectedAbsorbed);
    if (needsElement && !anemo.absorptionElement && !context.independentEvent?.absorbedElement) add("anemo.absorptionElement", "本次 Q 实际吸收的元素", "enum", undefined,
      "只能使用实际锁定的火、水、冰或雷，不从当前附着猜测元素。");
    const start = anemo?.absorptionStartFrame;
    if (needsElement && complete && start === undefined || start !== undefined && !TRAVELER_ANEMO_ABSORPTION_CHECK_FRAMES.includes(start)) add("anemo.absorptionStartFrame", "首次实际成功吸收帧", "number", start,
      "必须对应39+18n（n=0至17）的实际来源检查；晚吸收不补造先前附加命中。独立已发生单击不要求未知的完整吸收历史。");
    if (anemo?.noAbsorption === true) {
      if (anemo.absorptionElement !== undefined) add("anemo.absorptionElement", "无吸收分支：清除旧吸收元素", "enum", anemo.absorptionElement, "无吸收与吸收元素记录不能同时成立。");
      if (start !== undefined) add("anemo.absorptionStartFrame", "无吸收分支：清除旧吸收时点", "number", start, "未知或无吸收不能沿用另一分支的时点。");
    }
    const element = anemo?.absorptionElement ?? context.independentEvent?.absorbedElement;
    if (element && (plannedAbsorbed || selectedAbsorbed) && document.build.mode !== "equipment-derived" && !context.finalizedHitEvents &&
      !hits.some(hit => hit.kind === "ordinary" && hit.element === element && hit.finalSnapshot)) {
      const bonus = anemo?.elementDamageBonuses?.[element] ?? (document.build.mode === "imported-final" ? game.importedPanelDamageBonuses?.[element] : undefined);
      if (bonus === undefined || bonus === null) add(`anemo.elementDamageBonuses.${element}`, "Q 起手时吸收元素的最终伤害加成", "number", bonus,
        "明确的零可以填写0；公开面板未知不能取0或套用风伤。装备构筑会按实际元素过滤，真实历史快照使用自身数值。",
        hits.map(hit => `traveler-cross-entity:${hit.id}`));
    }
    if (game.constellation >= 6) for (const hit of hits) if (hit.kind === "ordinary") {
      const state = {...context.sharedState, ...context.hitStates?.[hit.id]}, dependency = [`traveler-cross-entity:${hit.id}`];
      if (!complete && hit.travelerCrossEntityEvent?.c6ActiveBeforeHit === undefined && state.c6ActiveBeforeHit === undefined) add("sharedState.c6ActiveBeforeHit", "本击之前已有对应元素的六命减抗", "state", undefined,
        "只填伤害结算前的实际状态；本击随后挂上的减抗不提前计入。", dependency, [hit.id]);
      if (state.includedC6ResistanceReduction === undefined) add("sharedState.includedC6ResistanceReduction", "所填敌人抗性已含的六命减抗", "number", undefined,
        "未含填0，已扣除20%填0.2；核心补差而不重复扣除。", dependency, [hit.id]);
    }
    const unique = new Map<string, CalculatorFieldRequirementDraft>();
    for (const field of fields) {
      const previous = unique.get(field.fieldPath);
      if (previous) { previous.dependencyIds = [...new Set([...previous.dependencyIds, ...field.dependencyIds])]; previous.hitIds = [...new Set([...previous.hitIds, ...field.hitIds])]; }
      else unique.set(field.fieldPath, field);
    }
    return [...unique.values()];
  },
};
