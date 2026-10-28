import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { durinBurstContext, isDurinBurstAction } from "../../../packages/sim-core/src/durin-burst-formulas";
import type { CalculatorRequirementAdapter, CalculatorFieldRequirementDraft } from "./calculator-requirements";

const path = (key: string) => `gameContext.durinBurst.${key}`;
const state = (key: string, label: string, value: boolean | undefined) => `<label>${label}<select data-source-cast-state-field="${path(key)}"><option value="unknown"${value === undefined ? " selected" : ""}>请选择实际状态</option><option value="1"${value === true ? " selected" : ""}>是</option><option value="0"${value === false ? " selected" : ""}>否</option></select></label>`;
export function renderDurinBurstControls(document: CalculatorDocument): string {
  if (!isDurinBurstAction(document)) return "";
  const context = durinBurstContext(document) ?? {};
  return `<fieldset data-source-cast-controls="durin-burst"><legend>杜林 · 白焰之龙的这一次追击</legend><div class="calculator-fields">
    <label>本次白Q的第几次追击（1–20）<input type="number" data-field="${path("tickIndex")}" data-source-cast-number-field data-optional-number min="1" max="20" step="1" value="${context.tickIndex ?? ""}" placeholder="请选择已经发生的这一段"></label>
    ${document.gameContext!.constellation === 2 ? state("c2PyroBonusActive", "本段取样前，C2的50%火伤已经生效", context.c2PyroBonusActive) : ""}</div>
    ${document.gameContext!.constellation === 2 ? `<details${context.c2PyroBonusIncluded === undefined ? " open" : ""}><summary>已含火伤记账</summary><div class="calculator-fields">${state("c2PyroBonusIncluded", "本击输入增伤已包含C2的50%火伤", context.c2PyroBonusIncluded)}</div></details>` : ""}
    <p class="calculator-hint">当前白Q前10次追击自动使用A4强化，后10次不再使用；强化按本段生成时的实际总攻击计算，最多75%。请填写本段的实际面板及实际火抗（含此前已生效的减抗）。</p>
    <p class="calculator-hint">只算一次白焰之龙追击，不是Q初始三击或20次总和。白Q的C1附伤属于其他前台队友，不加给杜林。黑蚀R1的爆发暴伤与实际攻击窗口由装备条件独立处理；触发击攻击窗口仍保留固定来源的已知限制。</p></fieldset>`;
}
export const durinBurstRequirementAdapter: CalculatorRequirementAdapter = {
  id: "durin-burst-conditions", applies: isDurinBurstAction,
  collect(document) {
    const c = durinBurstContext(document) ?? {}, fields: CalculatorFieldRequirementDraft[] = [], game = document.gameContext!;
    const asc = (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? game.ascension;
    const add = (key: string, label: string, explanation: string, numeric = false) => fields.push({id: `durin-burst:${key}`, fieldPath: path(key),
      controlSelector: numeric ? `input[data-field="${path(key)}"]` : `select[data-source-cast-state-field="${path(key)}"]`, label, explanation,
      status: "input-required", dependencyIds: document.selectedHitIds.map(id => "durin-burst:" + id), hitIds: document.selectedHitIds});
    if ((asc === undefined || asc >= 4) && c.tickIndex === undefined) add("tickIndex", "本次白Q的追击序号", "1–10次仍有A4强化，11–20次没有；不从一张展柜面板猜测本段序号。", true);
    if (game.constellation === 2) {
      if (c.c2PyroBonusActive === undefined) add("c2PyroBonusActive", "本击之前C2火伤是否生效", "需此前合法反应已经触发且仍有效；本击新触发的增益不能倒灌。");
      if (c.c2PyroBonusIncluded === undefined) add("c2PyroBonusIncluded", "增伤输入是否已含C2火伤", "50%火伤只补差值；来源配装未含时自动记录未含，导入未知仍需确认。");
    }
    return fields;
  },
};
