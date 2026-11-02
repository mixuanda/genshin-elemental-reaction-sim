import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { finiteFollowupTemplates } from "../../../packages/game-data/src/character-mappings/finite-followup-mappings";
import type { CalculatorFieldRequirementDraft, CalculatorRequirementAdapter } from "./calculator-requirements";

export const FARUZAN_HURRICANE_ACTION = "finite-followup-faruzan-skill-hurricane-c0";
const prefix = "gameContext.finiteFollowupCast";
const selector = (attribute: string, value: string) => `${attribute === "data-field" ? "input" : "select"}[${attribute}="${value.replace(/["\\\u0000-\u001f\u007f]/g, character => `\\${character.codePointAt(0)!.toString(16)} `)}"]`;

/** Links the existing C0 E + Hurricane Arrow model; it supplies no combat state. */
export const faruzanSkillRequirementAdapter: CalculatorRequirementAdapter = {
  id: "faruzan-hurricane-conditions",
  applies: document => document.gameContext?.characterId === "character:10000076" && document.gameContext.skillId === FARUZAN_HURRICANE_ACTION,
  collect(document) {
    if (!this.applies(document) || document.gameContext!.constellation !== 0) return [];
    const cast = finiteFollowupTemplates.find(template => template.skillId === FARUZAN_HURRICANE_ACTION)!;
    const hits = document.hits.filter(hit => hit.kind === "ordinary" && document.selectedHitIds.includes(hit.id) && cast.hits.some(definition => definition.id === hit.id));
    if (!hits.length) return [];
    const context = document.gameContext!.finiteFollowupCast ?? {}, fields: CalculatorFieldRequirementDraft[] = [];
    const allIds = hits.map(hit => hit.id), dependency = (id: string) => `finite-followup:${id}`;
    const add = (key: string, label: string, explanation: string, ids = allIds, deps = ids.map(dependency), kind: "number" | "state" | "talent" = "state", unsatisfied = false) => {
      const fieldPath = `${prefix}.${key}`;
      fields.push({ id: `faruzan-hurricane:${key}`, fieldPath,
        controlSelector: selector(kind === "number" ? "data-field" : kind === "talent" ? "data-source-cast-value-field" : "data-source-cast-state-field", fieldPath),
        label, explanation, status: unsatisfied ? "condition-not-satisfied" : "input-required", dependencyIds: deps, hitIds: ids });
    };
    const full = document.scope === "one-cast" && cast.hits.every(hit => document.selectedHitIds.includes(hit.id));
    if (hits.length > 1 && context.statsStableAcrossHits !== true)
      add("statsStableAcrossHits", "所选命中的其余面板和目标条件保持一致", "发生变化时可独立选择一击，使用该击的实际面板。", allIds, [dependency("cast")], "state", context.statsStableAcrossHits === false);
    if (full) for (const [key, label] of [
      ["completeCastConfirmed", "E初击、一次飓烈箭和一次风压坍陷均命中目标"],
      ["noHitlag", "本次动作没有卡肉延长"],
      ["noReplacement", "本次E状态和风涡没有被替换或提前消耗"],
      ["noInterruption", "本次动作和风涡没有被中断"],
    ] as const) if (context[key] !== true)
      add(key, label, "完整三击需要此条件实际成立；否则仍可选择已经发生的一击。", allIds, [dependency("cast")], "state", context[key] === false);
    if (context.faruzanFreshNoPriorEffects !== true)
      add("faruzanFreshNoPriorEffects", "没有此前E/Q效果残留，本连段期间没有开启Q", "此分支不混入旧增伤、减抗或A4冷却；有旧状态时不能当作全新E计算。", allIds, allIds.map(dependency), "state", context.faruzanFreshNoPriorEffects === false);
    const followups = hits.filter(hit => full || cast.hits.find(definition => definition.id === hit.id)!.role !== "initial");
    const start = context.faruzanHurricaneStartFrame;
    if (followups.length && (start === undefined || !Number.isInteger(start) || start < 35 || start > 1092))
      add("faruzanHurricaneStartFrame", "飓烈箭从E开始后的第几帧开始蓄力", "按现有固定来源填写35–1092帧；只算E初击时无需填写。", followups.map(hit => hit.id), followups.map(hit => dependency(hit.id)), "number", start !== undefined);
    const arrows = hits.filter(hit => cast.hits.find(definition => definition.id === hit.id)!.talent === "normal");
    if (arrows.length && context.normalTalentLevel === undefined)
      add("normalTalentLevel", "飓烈箭使用的普攻有效天赋等级", "与E等级分开；完整导入可自动读取，手动面板须明确填写。", arrows.map(hit => hit.id), arrows.map(hit => dependency(hit.id)), "talent");
    const missingAscension = hits.filter(hit => hit.kind === "ordinary" && (hit.finalSnapshot?.ascension
      ?? (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension)
      ?? document.gameContext!.ascension) === undefined);
    if (missingAscension.length) fields.push({ id: "faruzan-hurricane:ascension",
      fieldPath: document.build.mode === "equipment-derived" ? "gameContext.ascension" : "build.ascension", controlSelector: "#calc-ascension",
      label: "角色实际突破阶段", explanation: "决定飓烈箭蓄力时间；未知不能按未解锁处理。", status: "input-required",
      dependencyIds: missingAscension.map(hit => dependency(hit.id)), hitIds: missingAscension.map(hit => hit.id) });
    for (const hit of hits) {
      if (hit.kind !== "ordinary") continue;
      const state = context.hitStates?.[hit.id] ?? {};
      for (const [key, label, explanation] of [
        ["includedDamageBonus", "本击增伤已含的本人Q风伤份额", "明确未含填0；核心扣除已失效的旧份额，不重复加入。"],
        ["includedAdditiveBase", "本击加算基伤已含的本人A4份额", "明确未含填0；不要从最终攻击力反推旧A4。"],
        ["includedResistanceReduction", "目标抗性已含的本人减抗份额", "明确未含填0；本次坍陷之后才产生的减抗不追溯到自身伤害。"],
      ] as const) if (state[key] === undefined && !(key === "includedResistanceReduction" && hit.effectiveResistance !== undefined))
        add(`hitStates.${hit.id}.${key}`, `${hit.label}：${label}`, explanation, [hit.id], [dependency(hit.id)], "number");
    }
    return fields;
  },
};
