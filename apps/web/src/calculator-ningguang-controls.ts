import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { NINGGUANG_BURST_SOURCE_REFS } from "./ningguang-calculation-context";

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
type Context = NonNullable<NonNullable<CalculatorDocument["gameContext"]>["ningguangBurst"]>;
const fields = [
  ["stats.atk", "历史最终攻击力", "min=\"0\""], ["stats.hp", "历史最大生命", "min=\"0\""], ["stats.def", "历史最终防御", "min=\"0\""],
  ["stats.em", "历史元素精通", "min=\"0\""], ["stats.critRate", "历史暴击率（小数）", ""], ["stats.critDamage", "历史暴击伤害（小数）", "min=\"0\""],
  ["stats.energyRecharge", "历史最终充能（可留空）", "min=\"0\""], ["characterLevel", "历史角色等级", 'min="1" max="100" step="1"'], ["ascension", "历史突破阶段", 'min="0" max="6" step="1"'],
  ["damageBonus", "历史适用总增伤（小数）", ""], ["additiveBaseDamage", "历史适用固定基础加值", ""], ["reactionBonus", "历史适用反应加成（小数）", ""],
] as const;

export function renderNingguangControls(document: CalculatorDocument): string {
  const context = document.gameContext?.ningguangBurst;
  if (!context) return "";
  const toggle = (key: keyof Omit<Context, "screenSnapshot">, id: string, label: string) => `<label>${label}<select id="calc-ningguang-${id}" data-ningguang-condition="${key}"><option value="0"${context[key] ? "" : " selected"}>否</option><option value="1"${context[key] ? " selected" : ""}>是</option></select></label>`;
  return `<fieldset data-ningguang-controls><legend>天权崩玉：Q本体与璇玑屏的两份快照</legend><div class="calculator-fields">${toggle("screenAvailable", "screen-available", "施放时有可销毁璇玑屏")}${toggle("currentA4Active", "current-a4-active", "Q起手穿屏A4岩伤是否有效")}${toggle("currentA4IncludedInBonus", "current-a4-included", "当前各段增伤已含该A4")}${toggle("screenA4Active", "screen-a4-active", "历史E快照中A4是否有效")}${toggle("screenA4IncludedInBonus", "screen-a4-included", "历史总增伤已含该A4")}</div><p class="calculator-hint">本体六枚用当前Q面板；屏风六枚用此前E保存的历史进攻面板。目标防御与抗性仍取每次命中时的当前目标输入。没有历史快照时，只阻塞依赖它的屏宝石；可以先选择独立本体命中。</p><details open><summary>明确填写历史E快照${context.screenSnapshot ? "（已应用）" : "（尚未提供）"}</summary><div class="calculator-fields">${fields.map(([path, label, attributes]) => {
    let value: unknown = context.screenSnapshot;
    for (const key of path.split(".")) value = (value as Record<string, unknown> | undefined)?.[key];
    return `<label>${label}<input type="number" data-ningguang-snapshot="${path}" value="${value === undefined ? "" : esc(value)}"${attributes.includes("step=") ? "" : ' step="any"'} ${attributes}${path === "stats.energyRecharge" ? "" : " required"}></label>`;
  }).join("")}</div><label>历史数值来源或记录说明<input id="calc-ningguang-snapshot-source" required value="${esc(context.screenSnapshot?.source ?? "用户明确填写的历史E最终面板；机制引用不验证这些属性数值。")}"></label><p class="calculator-hint">填写E保存时供屏宝石实际使用的全部增伤、限定暴击和基数加值，当前装备不会再叠入这六枚。未知值留空，明确为零才填0；这里不会复制当前Q属性。来源引用说明快照机制，手填属性仍是条件输入。</p><button type="button" id="calc-ningguang-snapshot-apply" data-action="apply-ningguang-snapshot">应用明确的历史快照</button><button type="button" id="calc-ningguang-snapshot-clear" data-action="clear-ningguang-snapshot">清除历史快照</button><p data-ningguang-draft-status role="status">上方历史草稿在点击应用后参与计算。</p></details></fieldset>`;
}

export function readNingguangSnapshot(root: HTMLElement): NonNullable<Context["screenSnapshot"]> {
  const values: Record<string, number> = {};
  for (const input of root.querySelectorAll<HTMLInputElement>("[data-ningguang-snapshot]")) {
    if (!input.reportValidity()) throw new Error("历史快照尚未完整；请明确填写所有必需数值。");
    if (input.value !== "") values[input.dataset.ningguangSnapshot!] = input.valueAsNumber;
  }
  const source = root.querySelector<HTMLInputElement>("#calc-ningguang-snapshot-source")!;
  if (!source.reportValidity()) throw new Error("请填写历史数值的来源说明。");
  return { stats: { atk: values["stats.atk"]!, hp: values["stats.hp"]!, def: values["stats.def"]!, em: values["stats.em"]!, critRate: values["stats.critRate"]!, critDamage: values["stats.critDamage"]!, ...(values["stats.energyRecharge"] === undefined ? {} : { energyRecharge: values["stats.energyRecharge"] }) },
    characterLevel: values.characterLevel!, ascension: values.ascension!, damageBonus: values.damageBonus!, additiveBaseDamage: values.additiveBaseDamage!, reactionBonus: values.reactionBonus!, source: source.value,
    sourceRefs: [...NINGGUANG_BURST_SOURCE_REFS] };
}
