import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { isWandererPrimaryAction, wandererPrimaryContext } from "../../../packages/sim-core/src/wanderer-primary-formulas";
import type { CalculatorRequirementAdapter, CalculatorFieldRequirementDraft } from "./calculator-requirements";

const path = (key: string) => `gameContext.wandererPrimary.${key}`;
const number = (key: string, label: string, value: number | undefined, max?: number, integer = false, min = 0, readonly = false) => `<label>${label}<input type="number" data-field="${path(key)}" data-source-cast-number-field data-optional-number min="${min}"${max === undefined ? "" : ` max="${max}"`} step="${integer ? "1" : "any"}"${readonly ? ' readonly aria-readonly="true"' : ""} value="${value ?? ""}" placeholder="请填写实际值"></label>`;
const state = (key: string, label: string, value: boolean | undefined, yes = "是", no = "否") => `<label>${label}<select data-source-cast-state-field="${path(key)}"><option value="unknown"${value === undefined ? " selected" : ""}>请选择实际状态</option><option value="1"${value === true ? " selected" : ""}>${yes}</option><option value="0"${value === false ? " selected" : ""}>${no}</option></select></label>`;
const absorptionLabels = {neither: "均未生效（水／雷增益仍可存在）", pyro: "只有火：攻击力+30%", cryo: "只有冰：暴击率+20%", "pyro-cryo": "火、冰两项均在生效"};

export function renderWandererPrimaryControls(document: CalculatorDocument): string {
  if (!isWandererPrimaryAction(document)) return "";
  const context = wandererPrimaryContext(document) ?? {}, q = document.gameContext!.skillId === "wanderer-kyougen-five-hits", extra = document.gameContext!.skillId.includes("-c6-");
  const selected = document.hits.filter(hit => document.selectedHitIds.includes(hit.id)).length;
  const actualPyro = context.absorptionBonuses === "pyro" || context.absorptionBonuses === "pyro-cryo";
  const needBase = Number(actualPyro) * 30 !== (context.pyroAttackIncludedPercent ?? 0);
  return `<fieldset data-source-cast-controls="wanderer-primary"><legend>流浪者 · ${q ? "狂言的实际取样" : extra ? "这一次C6追加" : "这一次空居普攻"}</legend><div class="calculator-fields">
    ${!q ? number("skillTalentLevel", "有效E天赋（独立于普攻，已含C5加级）", context.skillTalentLevel, 15, true, 1) : state("burstWindfavoredAtCast", "按下Q时是否仍在空居状态", context.burstWindfavoredAtCast, "空居中施放", "已退出空居后施放")}
    <label>本击取样时的火／冰吸收增益<select data-source-cast-enum-field="${path("absorptionBonuses")}"><option value="unknown"${context.absorptionBonuses === undefined ? " selected" : ""}>请选择实际状态</option>${Object.entries(absorptionLabels).map(([value, label]) => `<option value="${value}"${context.absorptionBonuses === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
    ${extra ? state("c6ParentQualified", "原普攻命中时，仍在空居且还有空居力", context.c6ParentQualified, "已确认这枚追加的触发条件", "条件未成立／没有此追加") : ""}
    ${q && document.gameContext!.constellation >= 2 && context.burstWindfavoredAtCast ? number("burstC2ConsumedPointsUpTo50", "按Q时已消耗空居力（达到50点后统一填50）", context.burstC2ConsumedPointsUpTo50, 50, true) : ""}
    ${q && selected > 1 ? state("burstConditionsStable", "这几击的目标与装备结算条件保持一致", context.burstConditionsStable) : ""}
    ${q && selected === 5 && document.scope !== "single-hit" ? state("burstAllHitsConnected", "五击均已实际命中同一目标", context.burstAllHitsConnected) : ""}</div>
    <details${context.pyroAttackIncludedPercent === undefined || context.cryoCritRateIncludedPercent === undefined || q && context.burstC2IncludedPercent === undefined ? " open" : ""}><summary>输入面板已经包含的份额</summary><div class="calculator-fields">
    ${number("pyroAttackIncludedPercent", "攻击力已含火吸收（0–30个百分点，未含填0）", context.pyroAttackIncludedPercent, 30)}
    ${number("cryoCritRateIncludedPercent", "暴击率已含冰吸收（0–20个百分点，未含填0）", context.cryoCritRateIncludedPercent, 20)}
    ${needBase ? number("baseAttack", "角色＋武器基础攻击（来源配装自动提供）", context.baseAttack, undefined, false, 0, document.build.mode === "equipment-derived") : ""}
    ${q && document.gameContext!.constellation >= 2 ? number("burstC2IncludedPercent", "本击增伤输入已含C2（0–200%，未含填0）", context.burstC2IncludedPercent, 200) : ""}</div></details>
    <p class="calculator-hint">${q ? "本页可单选Q的一击，或在五击都命中且条件稳定时合计；五击共用来源55帧取样，C2按按下Q时的实际空居力计算，不默认满额。" : extra ? "只算这枚C6追加，不加原普攻；追加在原命中后8帧重新取样，可能与原普攻的攻击、暴击及图莱层数不同。" : "只算这一次空居普攻。NA与E等级分别取实际有效等级，第三段的两击分别选择；C6追加和A4风矢不混入本击。"}火／冰选项仅描述这两项增益，不能用队友元素推断C4随机结果。</p>
    <p class="calculator-hint">图莱R5的实际14秒窗口、是否在前台、有效增伤单位由装备条件填写，不默认满层；普攻与C6追加各用自己的实际单位。未知面板已含量仍需确认。</p></fieldset>`;
}

export const wandererPrimaryRequirementAdapter: CalculatorRequirementAdapter = {
  id: "wanderer-primary-conditions", applies: isWandererPrimaryAction,
  collect(document) {
    const c = wandererPrimaryContext(document) ?? {}, q = document.gameContext!.skillId === "wanderer-kyougen-five-hits", extra = document.gameContext!.skillId.includes("-c6-");
    const game = document.gameContext!, selected = document.hits.filter(hit => document.selectedHitIds.includes(hit.id));
    const asc = (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? game.ascension;
    const fields: CalculatorFieldRequirementDraft[] = [];
    const add = (key: string, label: string, explanation: string, kind: "number" | "state" | "enum" = "number", unsatisfied = false) => fields.push({
      id: `wanderer-primary:${key}`, fieldPath: path(key), controlSelector: kind === "number" ? `input[data-field="${path(key)}"]` : `select[data-source-cast-${kind}-field="${path(key)}"]`,
      label, explanation, status: unsatisfied ? "condition-not-satisfied" : "input-required", dependencyIds: selected.map(hit => "wanderer-primary:" + hit.id), hitIds: selected.map(hit => hit.id),
    });
    if (!q && c.skillTalentLevel === undefined) add("skillTalentLevel", "独立有效E天赋", "空居普攻使用NA×E倍率；E的C5加级已含，不再加一次。");
    if ((asc === undefined || asc >= 1) && c.absorptionBonuses === undefined) add("absorptionBonuses", "本击实际火／冰增益", "均未生效不代表没有水／雷吸收；请按实际状态选择。", "enum");
    if (c.pyroAttackIncludedPercent === undefined && (asc === undefined || asc >= 1)) add("pyroAttackIncludedPercent", "攻击输入已含的火吸收份额", "未含填0；允许部分包含，不把最终攻击再乘30%。");
    if (c.cryoCritRateIncludedPercent === undefined && (asc === undefined || asc >= 1)) add("cryoCritRateIncludedPercent", "暴击率已含的冰吸收百分点", "未含填0；最多20个百分点，暴击概率上限仍由核心处理。");
    const pyro = c.absorptionBonuses === "pyro" || c.absorptionBonuses === "pyro-cryo";
    if (Number(pyro) * 30 !== (c.pyroAttackIncludedPercent ?? 0) && c.baseAttack === undefined && document.build.mode !== "equipment-derived") add("baseAttack", "角色加武器基础攻击", "仅在补火吸收攻击差值时需要；可由来源配装或明确的导入基础攻击自动提供。");
    if (extra && c.c6ParentQualified !== true) add("c6ParentQualified", "C6追加的实际触发资格", "原普攻需命中，且回调时仍在空居、有空居力。", "state", c.c6ParentQualified === false);
    if (q) {
      if (c.burstWindfavoredAtCast === undefined) add("burstWindfavoredAtCast", "按Q时的空居状态", "C2只影响空居中施放的Q。", "state");
      if (game.constellation >= 2 && c.burstWindfavoredAtCast && c.burstC2ConsumedPointsUpTo50 === undefined) add("burstC2ConsumedPointsUpTo50", "按Q时已消耗的空居力", "每点4%增伤，50点封顶200%；未知不默认满额。");
      if (game.constellation >= 2 && c.burstC2IncludedPercent === undefined) add("burstC2IncludedPercent", "输入增伤已含的C2百分数", "最多200%；未含填0，防止重复。");
      if (selected.length > 1 && c.burstConditionsStable !== true) add("burstConditionsStable", "多击结算条件是否一致", "不一致时请单选真实的一击。", "state", c.burstConditionsStable === false);
      if (selected.length === 5 && document.scope !== "single-hit" && c.burstAllHitsConnected !== true) add("burstAllHitsConnected", "五击是否全部命中", "确认后才可称为整次Q五击合计。", "state", c.burstAllHitsConnected === false);
    }
    return fields;
  },
};
