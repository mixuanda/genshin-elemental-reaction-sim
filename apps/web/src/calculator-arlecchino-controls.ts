import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { arlecchinoDamageContextSchema, type ArlecchinoDamageContext } from "../../../packages/sim-core/src/arlecchino-damage-context";
import { arlecchinoContext, canInferArlecchinoBondBaseZero, isArlecchinoDamageAction, type ArlecchinoCalculatorDocument } from "../../../packages/sim-core/src/arlecchino-damage-formulas";
import type { CalculatorFieldRequirementDraft, CalculatorRequirementAdapter } from "./calculator-requirements";

const path = (key: string) => `gameContext.arlecchinoDamage.${key}`;
const number = (key: string, label: string, value: number | undefined, max?: number) => `<label>${label}<input type="number" data-field="${path(key)}" data-source-cast-number-field data-optional-number min="0"${max === undefined ? "" : ` max="${max}"`} step="any" value="${value ?? ""}" placeholder="请填写实际值"></label>`;
const passiveState = (value: boolean | undefined) => `<label>所填火伤已包含固有40%火伤<select data-source-cast-state-field="${path("passivePyroBonusIncluded")}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；请确认</option><option value="0"${value === false ? " selected" : ""}>未包含，需要补加</option><option value="1"${value === true ? " selected" : ""}>已经包含，避免重复</option></select></label>`;
const c6State = (value: boolean | undefined) => `<label>本击结算时，开E触发的C6双暴增益<select data-source-cast-state-field="${path("c6Active")}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；请确认</option><option value="0"${value === false ? " selected" : ""}>未触发或已到期</option><option value="1"${value === true ? " selected" : ""}>确实仍在生效</option></select></label>`;

export function renderArlecchinoControls(document: CalculatorDocument): string {
  if (!isArlecchinoDamageAction(document)) return "";
  const context = arlecchinoContext(document) ?? {};
  const c6 = document.gameContext?.constellation === 6;
  const showBondAccounting = !canInferArlecchinoBondBaseZero(document) || (context.includedBondBase ?? 0) !== 0;
  return `<fieldset data-source-cast-controls="arlecchino"><legend>阿蕾奇诺 · 红死之宴的这一击</legend><div class="calculator-fields">${number("bondOfLifePercent", "本击命中扣契前的生命之契（占最大生命%）", context.bondOfLifePercent, 200)}${c6 ? c6State(context.c6Active) : ""}</div>
    <details${context.passivePyroBonusIncluded === undefined || showBondAccounting && context.includedBondBase === undefined || c6 && (context.c6CritRateIncludedPercent === undefined || context.c6CritDamageIncludedPercent === undefined) ? " open" : ""}><summary>输入伤害已含份额</summary><div class="calculator-fields">${passiveState(context.passivePyroBonusIncluded)}${showBondAccounting ? number("includedBondBase", "附加基础伤害已含的红死之宴数值（未含填0）", context.includedBondBase) : ""}${c6 ? number("c6CritRateIncludedPercent", "所填暴击率已含C6增益（0–10个百分点，未含填0）", context.c6CritRateIncludedPercent, 10) + number("c6CritDamageIncludedPercent", "所填暴击伤害已含C6增益（0–70个百分点，未含填0）", context.c6CritDamageIncludedPercent, 70) : ""}</div></details>
    <p class="calculator-hint">至少30%生命之契才是红死之宴火普攻；145%请填145。使用独立有效普攻等级，C3加级已含，不再加一次。第四段两击须分别填写各自扣契前的真实比例；本页只算这一击，不推算耗契或整轮。公开展柜没有生命之契状态，导入后仍须明确填写。</p>
    <p class="calculator-hint">支持C0–C6；C1在附伤倍率上加100个百分点。不含C2回收爆发、C4回能及Q。${c6 ? "C6须确认本击增益实际生效；固定来源持续20秒并受卡肉延长影响，不会仅凭命座自动开启。双暴只补已含份额之外的差值；部分包含也须分别填写。" : ""}</p></fieldset>`;
}

/** Existing data-source-cast-* routing suffices; this optional text adapter is
 * available to hosts that do not use the generic nested context controls. */
export function updateArlecchinoDamageControl(document: CalculatorDocument, fieldPath: string, raw: string): boolean {
  if (!isArlecchinoDamageAction(document) || !fieldPath.startsWith(path(""))) return false;
  const key = fieldPath.slice(path("").length);
  if (!["bondOfLifePercent", "passivePyroBonusIncluded", "includedBondBase", "c6Active", "c6CritRateIncludedPercent", "c6CritDamageIncludedPercent"].includes(key)) return false;
  const next: Record<string, unknown> = {...arlecchinoContext(document)};
  if (raw === "" || raw === "unknown") delete next[key];
  else if (key === "passivePyroBonusIncluded" || key === "c6Active") {
    if (raw !== "0" && raw !== "1") throw new Error("实际生效或已含状态必须为是、否或未知。");
    next[key] = raw === "1";
  } else next[key] = Number(raw);
  (document as ArlecchinoCalculatorDocument).gameContext.arlecchinoDamage = arlecchinoDamageContextSchema.parse(next);
  return true;
}

export const arlecchinoRequirementAdapter: CalculatorRequirementAdapter = {
  id: "arlecchino-damage-conditions", applies: isArlecchinoDamageAction,
  collect(document) {
    const context: ArlecchinoDamageContext = arlecchinoContext(document) ?? {};
    const fields: CalculatorFieldRequirementDraft[] = [];
    const add = (key: string, label: string, explanation: string, numeric: boolean, unsatisfied = false) => fields.push({
      id: `arlecchino:${key}`, fieldPath: path(key),
      controlSelector: numeric ? `input[data-field="${path(key)}"]` : `select[data-source-cast-state-field="${path(key)}"]`,
      label, explanation, status: unsatisfied ? "condition-not-satisfied" : "input-required",
      dependencyIds: document.selectedHitIds.map(id => "arlecchino-damage:" + id), hitIds: document.selectedHitIds,
    });
    if (context.bondOfLifePercent === undefined || context.bondOfLifePercent < 30) add("bondOfLifePercent", "命中扣契前的生命之契百分比", "须为本次实际命中的扣契前比例，且至少30%；未知不默认，低契不改成物理。", true, context.bondOfLifePercent !== undefined);
    if (context.passivePyroBonusIncluded === undefined) add("passivePyroBonusIncluded", "火伤是否已含固有40%", "装备重建自动补加；导入最终火伤不能猜测已含或未含。", false);
    if (context.includedBondBase === undefined && !canInferArlecchinoBondBaseZero(document)) add("includedBondBase", "附加基伤中已含红死之宴的份额", "最终ATK面板不含这项附加基伤；附加输入非零时请确认，未含填0。", true);
    if (document.gameContext?.constellation === 6) {
      if (context.c6Active === undefined) add("c6Active", "本击C6双暴增益是否实际生效", "需已由E实际触发且本击结算时未到期；命座不等于已经触发，不根据距E时间猜测。", false);
      if (context.c6CritRateIncludedPercent === undefined) add("c6CritRateIncludedPercent", "暴击率已含C6的百分点", "只填写输入面板已经包含的C6份额，0–10个百分点；未含填0。", true);
      if (context.c6CritDamageIncludedPercent === undefined) add("c6CritDamageIncludedPercent", "暴击伤害已含C6的百分点", "只填写输入面板已经包含的C6份额，0–70个百分点；可与暴击率包含程度不同。", true);
    }
    return fields;
  },
};
