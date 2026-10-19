import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { getRawSourceStateContract } from "../../../packages/sim-core/src/raw-source-state";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]!);
const stateLabel = (value: boolean | undefined): string => value === undefined ? "未知" : value ? "成立" : "不成立";

function stateField(path: string, label: string, value: boolean | undefined, inherited?: { value: boolean | undefined }): string {
  const emptyLabel = inherited ? `未覆盖；沿用共同声明（${stateLabel(inherited.value)}）` : "未知；未填写";
  return `<label>${esc(label)}<select data-source-cast-state-field="${esc(path)}"><option value="unknown"${value === undefined ? " selected" : ""}>${esc(emptyLabel)}</option><option value="0"${value === false ? " selected" : ""}>不成立</option><option value="1"${value === true ? " selected" : ""}>成立</option></select></label>`;
}

/** Only selected ordinary hits need confirmation; complete-action conditions
 * appear only in complete-action mode. Missing overrides inherit shared state.
 */
export function renderRawSourceStateControls(document: CalculatorDocument): string {
  const game = document.gameContext;
  if (!game?.skillId) return "";
  const contract = getRawSourceStateContract(game.skillId);
  if (!contract) return "";

  const context = game.rawSourceState ?? {};
  const shared = context.sharedState ?? {};
  const complete = document.scope !== "single-hit";
  const actionFields = complete ? contract.completeActionRequiredTrue : [];
  const requiredKeys = [...new Set([...contract.requiredTrue, ...actionFields])];
  const selected = new Set(document.selectedHitIds);
  const hits = document.hits.filter(hit => hit.kind === "ordinary" && selected.has(hit.id));
  const fieldLabel = (key: string): string => contract.fieldLabels[key] ?? key;
  const commonFields = contract.requiredTrue.map(key => stateField(
    `gameContext.rawSourceState.sharedState.${key}`, fieldLabel(key), shared[key],
  )).join("");
  const completeFields = actionFields.map(key => stateField(
    `gameContext.rawSourceState.sharedState.${key}`, fieldLabel(key), shared[key],
  )).join("");

  const hitFields = hits.map(hit => {
    const overrides = context.hitStates?.[hit.id] ?? {};
    const effective = (key: string): boolean | undefined => overrides[key] ?? shared[key];
    const missing = requiredKeys.filter(key => effective(key) === undefined);
    const failed = requiredKeys.filter(key => effective(key) === false);
    const status = failed.length
      ? `本击有 ${failed.length} 项条件不成立${missing.length ? `，另有 ${missing.length} 项未知` : ""}`
      : missing.length ? `本击尚有 ${missing.length} 项条件未知` : "本击所需状态条件均已确认成立";
    return `<details data-raw-source-hit-state="${esc(hit.id)}" open><summary>${esc(hit.label)} · ${esc(status)}</summary><div class="calculator-fields">${requiredKeys.map(key => stateField(
      `gameContext.rawSourceState.hitStates.${hit.id}.${key}`, fieldLabel(key), overrides[key], { value: shared[key] },
    )).join("")}</div></details>`;
  }).join("");

  return `<fieldset data-source-cast-controls="raw-source-state" data-raw-source-contract="${esc(contract.id)}"><legend>${esc(contract.label)}：所选命中的实际状态</legend><p class="calculator-hint">${esc(contract.scope)}</p><details open><summary>共同状态声明</summary><p class="calculator-hint">共同值用于没有逐击覆盖的所选命中。只确认实际已知的状态；未填写保持未知，明确不符合时选择“不成立”。</p><div class="calculator-fields">${commonFields}</div>${completeFields ? `<fieldset data-raw-source-complete-state><legend>本次完整动作的条件</legend><div class="calculator-fields">${completeFields}</div></fieldset>` : ""}</details><div data-raw-source-hit-states>${hits.length ? hitFields : '<p class="calculator-hint">当前没有选中的普通伤害命中。选择命中后可逐项覆盖共同声明。</p>'}</div><p class="calculator-hint">逐击选择“成立”或“不成立”会覆盖共同值；选择“未覆盖”恢复继承。${complete ? "完整动作另外需要本分支的完整观察和附加条件成立。" : "独立单击仅要求该击已发生时的状态，不索取未来命中或完整动作观察。"}状态成立仅说明所选来源分支适用，不代表整队或轮转已完成验证。</p>${contract.sourceRefs.length ? `<details><summary>来源依据</summary><ul>${contract.sourceRefs.map(ref => `<li><code>${esc(ref)}</code></li>`).join("")}</ul></details>` : ""}</fieldset>`;
}
