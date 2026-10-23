import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { faruzanBurstInitialContextSchema } from "../../../packages/sim-core/src/faruzan-burst-initial-context";
import { FARUZAN_BURST_INITIAL_PREFIX, faruzanBurstInitialContext, isFaruzanBurstInitialAction,
  type FaruzanBurstInitialDocument } from "../../../packages/sim-core/src/faruzan-burst-initial-formulas";
import type { CalculatorFieldRequirementDraft, CalculatorRequirementAdapter } from "./calculator-requirements";

const path = (key: string) => `gameContext.faruzanBurstInitial.${key}`;
const labels = { freshBurstNoPriorEffects: "这是一次没有旧Q增益或旧减抗残留的新Q",
  insideBurstArea: "本人取得祈风赐福后，直到初击仍在本次Q范围内",
  noOtherAnemoBeforeInitial: "初击前没有其他风伤消耗A4，天赋仍可触发",
  baseAttack: "角色与武器的基础攻击力之和（白字）", includedBurstDamageBonus: "风伤加成输入已计入的本次Q份额（未计入填0）",
  includedA4BaseDamage: "附加基伤输入已计入的A4数值（未计入填0）",
  includedResistanceReduction: "抗性输入已计入的自身减抗（未计入填0）",
  c6CritDamageIncludedInPanel: "输入暴伤已包含C6增加的40个百分点" };
type Field = keyof typeof labels;
const numeric = new Set<Field>(["baseAttack", "includedBurstDamageBonus", "includedA4BaseDamage", "includedResistanceReduction"]);
const ascension = (doc: CalculatorDocument) => {
  const hit = doc.hits.find(h => h.kind === "ordinary");
  return (hit?.kind === "ordinary" ? hit.finalSnapshot?.ascension : undefined)
    ?? (doc.build.mode === "equipment-derived" ? doc.build.equipment?.ascension : doc.build.ascension) ?? doc.gameContext?.ascension;
};
const field = (key: Field, value: number | boolean | undefined, readonly = false) => numeric.has(key)
  ? `<label>${labels[key]}<input type="number" data-field="${path(key)}" data-source-cast-number-field data-optional-number min="0" step="any" value="${value ?? ""}"${readonly ? ' readonly aria-readonly="true"' : ""}></label>`
  : `<label>${labels[key]}<select data-source-cast-state-field="${path(key)}"><option value="unknown"${value === undefined ? " selected" : ""}>请选择</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
export function renderFaruzanBurstInitialControls(doc: CalculatorDocument): string {
  if (!isFaruzanBurstInitialAction(doc) || doc.scope !== "single-hit" || !faruzanBurstInitialContext(doc)) return "";
  const state = faruzanBurstInitialContext(doc)!, a4 = ascension(doc) === undefined || ascension(doc)! >= 4;
  const equipmentWhite = doc.build.mode === "equipment-derived" && !doc.hits.some(h => h.kind === "ordinary" && h.finalSnapshot)
    ? doc.build.characterBaseAtk + doc.build.weaponBaseAtk : undefined;
  return `<fieldset data-source-cast-controls="faruzan-burst-initial"><legend>珐露珊 · 抟风秘道初击</legend><div class="calculator-fields">
${field("freshBurstNoPriorEffects", state.freshBurstNoPriorEffects)}${field("insideBurstArea", state.insideBurstArea)}
${a4 ? field("noOtherAnemoBeforeInitial", state.noOtherAnemoBeforeInitial) + field("baseAttack", equipmentWhite ?? state.baseAttack, equipmentWhite !== undefined) : ""}
</div><details><summary>高级：输入已计入的自身增益</summary><div class="calculator-fields">
${field("includedBurstDamageBonus", state.includedBurstDamageBonus)}${field("includedA4BaseDamage", state.includedA4BaseDamage)}
${doc.hits.some(h => h.kind === "ordinary" && h.effectiveResistance === undefined) ? field("includedResistanceReduction", state.includedResistanceReduction) : ""}
${doc.gameContext?.constellation === 6 || state.c6CritDamageIncludedInPanel ? field("c6CritDamageIncludedInPanel", state.c6CritDamageIncludedInPanel) : ""}
</div><p class="calculator-hint">增伤和减抗使用小数；0.3表示30%。留空表示未知。装备构筑的白字由来源推导；最终攻击力不能反推白字。</p></details>
<p class="calculator-hint">本级Q风伤在第43帧先于54帧初击生效，C6的40%风伤暴伤据此自动计入；无需重复选择C6是否触发。本次Q减抗在初击之后施加。这里只算初击，不计C6后续风压坍陷或西风产球，不代表完整Q。</p></fieldset>`;
}
export function updateFaruzanBurstInitialControl(doc: CalculatorDocument, fieldPath: string, raw: string): boolean {
  if (!isFaruzanBurstInitialAction(doc) || !faruzanBurstInitialContext(doc) || !fieldPath.startsWith(path(""))) return false;
  const key = fieldPath.slice(path("").length) as Field;
  if (!Object.hasOwn(labels, key)) return false;
  const next = { ...faruzanBurstInitialContext(doc) };
  if (raw === "" || raw === "unknown") delete next[key];
  else if (numeric.has(key)) (next as Record<string, unknown>)[key] = Number(raw);
  else if (raw === "0" || raw === "1") (next as Record<string, unknown>)[key] = raw === "1";
  else throw new Error("珐露珊条件请选择是、否或未知。");
  (doc as FaruzanBurstInitialDocument).gameContext.faruzanBurstInitial = faruzanBurstInitialContextSchema.parse(next);
  return true;
}
export const faruzanBurstInitialRequirementAdapter: CalculatorRequirementAdapter = {
  id: "faruzan-burst-initial-conditions", applies: doc => isFaruzanBurstInitialAction(doc) && doc.scope === "single-hit" && faruzanBurstInitialContext(doc) !== undefined,
  collect(doc) {
    const state = faruzanBurstInitialContext(doc); if (!state || doc.scope !== "single-hit") return [];
    const rows: CalculatorFieldRequirementDraft[] = [];
    const add = (key: Field, bad = false) => rows.push({ id: FARUZAN_BURST_INITIAL_PREFIX + key, fieldPath: path(key), label: labels[key],
      explanation: "仅说明本次Q初击的实际状态；未计入填0，不能把未知当作否或零。Q风伤、A4与C6各自只计算一次。",
      controlSelector: `${numeric.has(key) ? "input[data-field" : "select[data-source-cast-state-field"}="${path(key)}"]`,
      status: bad ? "condition-not-satisfied" : "input-required", dependencyIds: [FARUZAN_BURST_INITIAL_PREFIX + "conditions"], hitIds: doc.selectedHitIds });
    for (const key of ["freshBurstNoPriorEffects", "insideBurstArea"] as const) if (state[key] !== true) add(key, state[key] === false);
    if (ascension(doc) !== undefined && ascension(doc)! >= 4) {
      if (state.noOtherAnemoBeforeInitial !== true) add("noOtherAnemoBeforeInitial", state.noOtherAnemoBeforeInitial === false);
      if (doc.build.mode !== "equipment-derived" && state.baseAttack === undefined) add("baseAttack");
    }
    for (const key of ["includedBurstDamageBonus", "includedA4BaseDamage"] as const) if (state[key] === undefined) add(key);
    if (doc.hits.some(h => h.kind === "ordinary" && h.effectiveResistance === undefined) && state.includedResistanceReduction === undefined) add("includedResistanceReduction");
    if (doc.gameContext?.constellation === 6 && state.c6CritDamageIncludedInPanel === undefined) add("c6CritDamageIncludedInPanel");
    return rows;
  },
};
