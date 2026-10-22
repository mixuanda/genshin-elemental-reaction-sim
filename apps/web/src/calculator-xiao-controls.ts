import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { isXiaoDamageAction, xiaoContext } from "../../../packages/sim-core/src/xiao-damage-formulas";
import type { CalculatorRequirementAdapter, CalculatorFieldRequirementDraft } from "./calculator-requirements";

const path = (field: string) => `gameContext.xiaoDamage.${field}`;
const number = (key: string, label: string, value: number | undefined, max?: number, integer = false, min = 0) => `<label>${label}<input type="number" data-field="${path(key)}" data-source-cast-number-field data-optional-number min="${min}"${max === undefined ? "" : ` max="${max}"`} step="${integer ? "1" : "any"}" value="${value ?? ""}" placeholder="请填写实际值"></label>`;

export function renderXiaoControls(document: CalculatorDocument): string {
  if (!isXiaoDamageAction(document)) return "";
  const context = xiaoContext(document) ?? {}, game = document.gameContext!;
  const skill = document.hits.some(hit => hit.kind === "ordinary" && hit.attackTag === "skill");
  const state = `<label>这一击时Q是否仍在生效<select data-source-cast-state-field="${path("burstActive")}"><option value="unknown"${context.burstActive === undefined ? " selected" : ""}>请选择</option><option value="0"${context.burstActive === false ? " selected" : ""}>未开启／已结束</option><option value="1"${context.burstActive === true ? " selected" : ""}>仍在生效</option></select></label>`;
  const ascension = (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? game.ascension;
  return `<fieldset data-source-cast-controls="xiao"><legend>魈 · 这一击的实际状态</legend><div class="calculator-fields">${state}${context.burstActive ?
    (!skill ? number("burstTalentLevel", "有效Q天赋等级（独立于普攻等级）", context.burstTalentLevel, 15, true, 1) : "") +
    (ascension === undefined || ascension >= 1 ? number("burstElapsedSeconds", skill ? "按下本次E时，距开启Q已过时间（秒）" : "这一击取样时，距开启Q已过时间（秒）", context.burstElapsedSeconds) : "") : ""}
    ${skill && (ascension === undefined || ascension >= 4) ? number("skillA4Stacks", "本次E之前仍有效的连用层数", context.skillA4Stacks, 3, true) : ""}</div>
    <details${context.includedDamageBonus === undefined ? " open" : ""}><summary>已含增伤记账</summary><div class="calculator-fields">${number("includedDamageBonus", "本击增伤输入已含的魈Q／天赋份额（未含填0；1=100%）", context.includedDamageBonus, 1.8795)}</div></details>
    <p class="calculator-hint">${skill ? "连用层数只算本击前尚未过期的层数；首次E填0，本次E不会立即增加自己的伤害。" : "Q只改变这一击的元素与增伤；落地伤害不含途中碰撞。请选择实际命中的单段。"}</p></fieldset>`;
}

export const xiaoRequirementAdapter: CalculatorRequirementAdapter = {
  id: "xiao-damage-conditions", applies: isXiaoDamageAction,
  collect(document) {
    const context = xiaoContext(document) ?? {}, game = document.gameContext!;
    const hits = document.hits.filter(hit => hit.kind === "ordinary" && document.selectedHitIds.includes(hit.id));
    const skill = hits.some(hit => hit.kind === "ordinary" && hit.attackTag === "skill");
    const ascension = (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? game.ascension;
    const fields: CalculatorFieldRequirementDraft[] = [];
    const add = (key: string, label: string, explanation: string, state = false) => fields.push({
      id: `xiao:${key}`, fieldPath: path(key), controlSelector: state ? `select[data-source-cast-state-field="${path(key)}"]` : `input[data-field="${path(key)}"]`,
      label, explanation, status: "input-required", dependencyIds: hits.map(hit => `xiao-damage:${hit.id}`), hitIds: hits.map(hit => hit.id),
    });
    if (context.burstActive === undefined) add("burstActive", "本击Q状态", "明确Q是否仍在生效。", true);
    if (context.burstActive && !skill && context.burstTalentLevel === undefined) add("burstTalentLevel", "有效Q天赋等级", "Q增伤使用独立Q等级，不能借用普攻等级。");
    if (context.burstActive && (ascension === undefined || ascension >= 1) && context.burstElapsedSeconds === undefined) add("burstElapsedSeconds", skill ? "按E时距开启Q的秒数" : "本击取样时距开启Q的秒数", "降魔平妖每3秒增长，从Q施放开始计时；E在施放时取样，不能改用4帧后命中时刻。");
    if (skill && (ascension === undefined || ascension >= 4) && context.skillA4Stacks === undefined) add("skillA4Stacks", "本次E前有效的连用层数", "本次E在命中后才加层，首次E填0。");
    if (context.includedDamageBonus === undefined) add("includedDamageBonus", "输入已含的魈自身增伤", "明确未含填0；已含则填份额，防止重复加算。");
    return fields;
  },
};
