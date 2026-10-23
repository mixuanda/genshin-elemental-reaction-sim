import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { isKinichDamageAction, kinichContext } from "../../../packages/sim-core/src/kinich-damage-formulas";
import type { CalculatorFieldRequirementDraft, CalculatorRequirementAdapter } from "./calculator-requirements";

const path = (key: string) => `gameContext.kinichDamage.${key}`;
const state = (key: string, label: string, value: boolean | undefined) => `<label>${label}<select data-source-cast-state-field="${path(key)}"><option value="unknown"${value === undefined ? " selected" : ""}>请选择实际状态</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const number = (key: string, label: string, value: number | undefined, max?: number, integer = false) => `<label>${label}<input type="number" data-field="${path(key)}" data-source-cast-number-field data-optional-number min="0"${max === undefined ? "" : ` max="${max}"`} step="${integer ? "1" : "any"}" value="${value ?? ""}" placeholder="请填实际值；未含填0"></label>`;
export function renderKinichControls(document: CalculatorDocument): string {
  if (!isKinichDamageAction(document)) return "";
  const game = document.gameContext!, context = kinichContext(document) ?? {}, cannon = game.skillId === "kinich-scalespiker-cannon";
  const pair = game.skillId === "kinich-loop-shot-pair" && document.selectedHitIds.length > 1;
  const ascension = (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? game.ascension;
  const a4 = cannon && (ascension === undefined || ascension >= 4);
  return `<fieldset data-source-cast-controls="kinich"><legend>基尼奇 · 本次E命中的条件</legend><div class="calculator-fields">${state("nightsoulBlessingActive", "命中时实际处于夜魂加持", context.nightsoulBlessingActive)}${cannon ? number("cannonPointsBeforeUse", "请求释放本炮前的夜魂值（须20）", context.cannonPointsBeforeUse, 20, true) : ""}${a4 ? number("a4Stacks", "本炮实际消耗的有效猎人心得（0–2层）", context.a4Stacks, 2, true) : ""}${a4 && (context.a4Stacks ?? 0) > 0 ? number("a4CreationAttack", "本炮动作创建瞬间的攻击力", context.a4CreationAttack) : ""}${pair ? state("bothLoopHitsConnected", "本次环绕两击均命中同一目标", context.bothLoopHitsConnected) + state("statsStableAcrossHits", "两次取样间面板、装备与目标状态相同", context.statsStableAcrossHits) : ""}</div>
    ${cannon || context.c1CritDamageIncluded === true ? `<details><summary>面板已含增益（避免重复计算）</summary><div class="calculator-fields">${cannon ? number("includedA4BaseDamage", "附加基数输入已含的A4伤害量（未含填0）", context.includedA4BaseDamage) : ""}${cannon && game.constellation >= 1 || context.c1CritDamageIncluded === true ? state("c1CritDamageIncluded", "输入暴伤已含C1炮专属100%", context.c1CritDamageIncluded) : ""}</div></details>` : ""}
    <p class="calculator-hint">${cannon ? "C1自动按炮专属100%暴伤补差；零层心得无需填写起手攻击力。心得是夜魂迸发所得的有效层数，不能由燃烧或展示柜推断。" : "每次环绕输入有两次E伤害；单击只算所选一次，双击合计要求两次实际接触与共同面板。"} 仅覆盖C0/C1的所选E命中；Q与C2以上尚未覆盖。</p></fieldset>`;
}
export const kinichRequirementAdapter: CalculatorRequirementAdapter = {
  id: "kinich-damage-conditions", applies: isKinichDamageAction,
  collect(document) {
    const game = document.gameContext!, context = kinichContext(document) ?? {}, cannon = game.skillId === "kinich-scalespiker-cannon";
    const ascension = (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? game.ascension;
    const fields: CalculatorFieldRequirementDraft[] = [];
    const add = (key: string, label: string, explanation: string, numeric = false, unsatisfied = false) => fields.push({
      id: `kinich:${key}`, fieldPath: path(key), controlSelector: numeric ? `input[data-field="${path(key)}"]` : `select[data-source-cast-state-field="${path(key)}"]`,
      label, explanation, status: unsatisfied ? "condition-not-satisfied" : "input-required", dependencyIds: ["kinich-damage:conditions", ...document.selectedHitIds.map(id => "kinich-damage:" + id)], hitIds: document.selectedHitIds,
    });
    if (context.nightsoulBlessingActive !== true) add("nightsoulBlessingActive", "实际夜魂加持", "该E状态命中要求夜魂加持正在生效；展示柜不能证明。", false, context.nightsoulBlessingActive === false);
    if (cannon && context.cannonPointsBeforeUse !== 20) add("cannonPointsBeforeUse", "本炮释放前20点夜魂", "不足20点无法请求释放贯鳞炮；零点是明确不足，未知也不能当作满点。", true, context.cannonPointsBeforeUse !== undefined);
    if (cannon && (ascension === undefined || ascension >= 4) && context.a4Stacks === undefined) add("a4Stacks", "实际有效猎人心得层数", "填写本炮创建时实际消耗的未过期层数；0表示明确没有。", true);
    if (cannon && (context.a4Stacks ?? 0) > 0 && context.a4CreationAttack === undefined) add("a4CreationAttack", "炮动作创建时攻击力", "固定源在创建炮时读取TotalAtk，早于耗点后的释放快照，必须提供当时数值。", true);
    if (cannon && context.includedA4BaseDamage === undefined) add("includedA4BaseDamage", "附加基数已含A4份额", "明确未含请填0；不能把附加基数解释成攻击力或通用增伤。", true);
    if (cannon && game.constellation === 1 && context.c1CritDamageIncluded === undefined) add("c1CritDamageIncluded", "暴伤是否已含C1", "确认100%炮专属暴伤是否已经计入输入；公式只补差。你可在折叠记账中填写。");
    if (game.skillId === "kinich-loop-shot-pair" && document.selectedHitIds.length > 1) {
      if (context.bothLoopHitsConnected !== true) add("bothLoopHitsConnected", "环绕两击均接触同一目标", "仅实际接触的命中能够进入双击合计；可切换单击入口。", false, context.bothLoopHitsConnected === false);
      if (context.statsStableAcrossHits !== true) add("statsStableAcrossHits", "双击间面板与目标状态相同", "两击独立取样，只有实际状态一致时才可共用本面板。", false, context.statsStableAcrossHits === false);
    }
    return fields;
  },
};
