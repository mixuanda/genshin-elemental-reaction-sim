import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { nicoleSkillInitialContextSchema } from "../../../packages/sim-core/src/nicole-skill-initial-context";
import { NICOLE_SKILL_INITIAL_PREFIX, isNicoleSkillInitialAction, nicoleSkillInitialContext,
  resolveNicoleSkillInitialGrantAttack, type NicoleSkillInitialDocument } from "../../../packages/sim-core/src/nicole-skill-initial-formulas";
import type { CalculatorFieldRequirementDraft, CalculatorRequirementAdapter } from "./calculator-requirements";
const path = (key: string) => `gameContext.nicoleSkillInitial.${key}`;
const labels = { noOtherEventsBeforeInitial: "本次E施放至初击前，没有其他伤害、换人或额外状态变化",
  noDisplacementBeforeInitial: "本次E施放至初击未被中断或额外位移",
  skillGrantNonExtraAttack: "本次E增攻计算采用的攻击力（装备可推导时自动填写）",
  includedSkillAttack: "攻击力输入已计入的本次E增攻（未计入填0）",
  c2AttackIncludedInPanel: "攻击力输入已包含C2增加的300点攻击",
  a1AttackIncludedInPanel: "攻击力输入已包含A1升级增加的300点攻击",
  includedC2ResistanceReduction: "抗性输入已计入的妮可C2减抗（未计入填0）",
  targetInC2AreaAtInitial: "此击目标处于C2的减抗范围内" };
type Field = keyof typeof labels;
const numeric = new Set<Field>(["skillGrantNonExtraAttack", "includedSkillAttack", "includedC2ResistanceReduction"]);
const field = (key: Field, value: number | boolean | undefined, readonly = false) => numeric.has(key)
  ? `<label>${labels[key]}<input type="number" data-field="${path(key)}" data-source-cast-number-field data-optional-number min="0" step="any" value="${value ?? ""}"${readonly ? ' readonly aria-readonly="true"' : ""}></label>`
  : `<label>${labels[key]}<select data-source-cast-state-field="${path(key)}"><option value="unknown"${value === undefined ? " selected" : ""}>请选择</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const ascension = (doc: CalculatorDocument) => {
  const hit = doc.hits.find(row => row.kind === "ordinary");
  return (hit?.kind === "ordinary" ? hit.finalSnapshot?.ascension : undefined)
    ?? (doc.build.mode === "equipment-derived" ? doc.build.equipment?.ascension : doc.build.ascension) ?? doc.gameContext?.ascension;
};
export function renderNicoleSkillInitialControls(doc: CalculatorDocument): string {
  const context = nicoleSkillInitialContext(doc);
  if (!isNicoleSkillInitialAction(doc) || !context || doc.scope !== "single-hit") return "";
  const grant = resolveNicoleSkillInitialGrantAttack(doc);
  return `<fieldset data-source-cast-controls="nicole-skill-initial"><legend>妮可 · 启示·无始之光初击</legend><div class="calculator-fields">
${field("noOtherEventsBeforeInitial", context.noOtherEventsBeforeInitial)}${field("noDisplacementBeforeInitial", context.noDisplacementBeforeInitial)}
${field("skillGrantNonExtraAttack", grant?.value ?? context.skillGrantNonExtraAttack, grant?.source === "equipment-current")}
${context.targetInC2AreaAtInitial === false ? field("targetInC2AreaAtInitial", false) : ""}
${ascension(doc) === undefined ? '<label>实际突破阶段<input type="number" data-field="gameContext.ascension" data-source-cast-number-field data-optional-number min="0" max="6" step="1" value=""></label>' : ""}
</div><details open><summary>攻击力与抗性输入已含的份额</summary><div class="calculator-fields">
${field("includedSkillAttack", context.includedSkillAttack)}${field("c2AttackIncludedInPanel", context.c2AttackIncludedInPanel)}
${field("a1AttackIncludedInPanel", context.a1AttackIncludedInPanel)}
${doc.hits.some(row => row.kind === "ordinary" && row.effectiveResistance === undefined) ? field("includedC2ResistanceReduction", context.includedC2ResistanceReduction) : ""}
</div><p class="calculator-hint">未计入的数值填0，已知不含请选择否；留空表示未知。减抗使用小数，0.25表示25%。</p></details>
<details><summary>取样与本击状态说明</summary><p class="calculator-hint">E先清除旧E/A1/C2攻击增益，8帧按非转换攻击力计算新的E增攻，再给C2的300点攻击。9帧初击取样之后，新A1不会倒填攻击；满突破C2的同击减抗在伤害计算前生效。未位移的5米E命中已证明目标在10米C2范围内，无需重复选范围。低突破C2的来源门控仍有分歧，此入口暂不代算。</p><p class="calculator-hint">手动取样请填写本次8帧实际数值，排除E自身等二次转换；不能从含E/C2/A1的最终攻击力倒算。精1尘光七谕的首次护盾刷新使用同一份样本，由现有装备公式结算。本页只算这记E初击，不把护盾、增益或C1协同造影当成额外E伤害。</p></details></fieldset>`;
}
export function updateNicoleSkillInitialControl(doc: CalculatorDocument, fieldPath: string, raw: string): boolean {
  if (!isNicoleSkillInitialAction(doc) || !nicoleSkillInitialContext(doc) || !fieldPath.startsWith(path(""))) return false;
  const key = fieldPath.slice(path("").length) as Field; if (!Object.hasOwn(labels, key)) return false;
  const next = { ...nicoleSkillInitialContext(doc) };
  if (raw === "" || raw === "unknown") { delete next[key]; if (key === "skillGrantNonExtraAttack") delete next.grantAttackSource; }
  else if (numeric.has(key)) { (next as Record<string, unknown>)[key] = Number(raw); if (key === "skillGrantNonExtraAttack") next.grantAttackSource = "observed"; }
  else if (raw === "0" || raw === "1") (next as Record<string, unknown>)[key] = raw === "1";
  else throw new Error("妮可条件请选择是、否或未知。");
  (doc as NicoleSkillInitialDocument).gameContext.nicoleSkillInitial = nicoleSkillInitialContextSchema.parse(next);
  return true;
}
export const nicoleSkillInitialRequirementAdapter: CalculatorRequirementAdapter = {
  id: "nicole-skill-initial-conditions", applies: doc => isNicoleSkillInitialAction(doc) && doc.scope === "single-hit" && nicoleSkillInitialContext(doc) !== undefined,
  collect(doc) {
    const context = nicoleSkillInitialContext(doc); if (!context || doc.scope !== "single-hit") return [];
    const rows: CalculatorFieldRequirementDraft[] = [];
    const add = (key: Field, bad = false) => rows.push({ id: NICOLE_SKILL_INITIAL_PREFIX + key, fieldPath: path(key), label: labels[key],
      explanation: "只记录本次E初击实际采用的数值与输入已含份额；增攻不是另一段伤害，未知不能当成零。",
      controlSelector: `${numeric.has(key) ? "input[data-field" : "select[data-source-cast-state-field"}="${path(key)}"]`,
      status: bad ? "condition-not-satisfied" : "input-required", dependencyIds: [NICOLE_SKILL_INITIAL_PREFIX + "conditions"], hitIds: doc.selectedHitIds });
    for (const key of ["noOtherEventsBeforeInitial", "noDisplacementBeforeInitial"] as const) if (context[key] !== true) add(key, context[key] === false);
    if (!resolveNicoleSkillInitialGrantAttack(doc)) add("skillGrantNonExtraAttack", context.grantAttackSource === "equipment-current");
    for (const key of ["includedSkillAttack", "c2AttackIncludedInPanel", "a1AttackIncludedInPanel"] as const) if (context[key] === undefined) add(key);
    if (doc.hits.some(row => row.kind === "ordinary" && row.effectiveResistance === undefined) && context.includedC2ResistanceReduction === undefined) add("includedC2ResistanceReduction");
    if (doc.gameContext?.constellation === 2 && context.targetInC2AreaAtInitial === false) add("targetInC2AreaAtInitial", true);
    if (ascension(doc) === undefined) rows.push({ id: NICOLE_SKILL_INITIAL_PREFIX + "ascension", fieldPath: "gameContext.ascension",
      controlSelector: 'input[data-field="gameContext.ascension"]', label: "实际突破阶段", explanation: "此C2首击需要核对实际A4解锁，不从等级推测。",
      status: "input-required", dependencyIds: [NICOLE_SKILL_INITIAL_PREFIX + "conditions"], hitIds: doc.selectedHitIds });
    return rows;
  },
};
