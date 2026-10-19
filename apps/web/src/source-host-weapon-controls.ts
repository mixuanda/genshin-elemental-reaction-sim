import type { SourceHostEditableCalculation } from "../../../packages/sim-core/src/source-host-capture";
import { deriveSourceHostWeaponAdditiveEdit } from "../../../packages/sim-core/src/source-host-weapon-capture";
import { renderTraceHtml } from "./calculator-trace-view";

const weaponNames = { foliar: "裁叶萃光", hunterspath: "猎人之径", cinnabar: "辰砂之纺锤" } as const;
const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Each experiment changes one additive formula against the original hit. */
export function renderSourceHostWeaponControls(root: HTMLElement, document: SourceHostEditableCalculation): () => void {
  const records = document.originalCapture.components.filter(row => row.request.kind === "weapon-additive");
  if (!records.length) { root.hidden = true; return () => {}; }
  root.innerHTML = `<h3>武器附加伤害 · 公式实验</h3><p>修改精炼或本次取样属性，查看它对这一击的影响。每项实验分别使用原命中上下文，保留当时的反应、暴击抽样与触发历史。实验之间以及下方最终面板的修改分别计算。</p>${records.map(row => {
    if (row.request.kind !== "weapon-additive") return "";
    const state = document.weaponExperiments?.find(item => item.calculationId === row.request.id)?.input ?? row.request.input;
    const lifecycle = row.request.weaponState;
    return `<fieldset data-source-host-weapon-id="${row.request.id}"><legend>${weaponNames[state.ruleId]} · 计算 #${row.request.id}</legend><p>第 ${row.request.frame} 帧，目标 ${row.request.targetKey}。${lifecycle.remainingBefore === undefined ? "本次战技命中满足来源冷却条件。" : `本次命中前剩余 ${lifecycle.remainingBefore} 次，消费后 ${lifecycle.remainingAfter} 次。`}原状态到期帧 ${lifecycle.buffExpiry}，冷却到期帧 ${lifecycle.cooldownExpiry}；0 表示来源未保存此状态。</p><div class="calculator-fields"><label>精炼等级<input type="number" min="1" max="5" step="1" required data-source-host-weapon-state="refinement" value="${state.refinement}"></label><label>${state.ruleId === "cinnabar" ? "本次取样防御力" : "本次取样元素精通"}<input type="number" min="0" step="any" required data-source-host-weapon-state="statValue" value="${state.statValue}"></label></div><div data-source-host-weapon-result role="status"></div></fieldset>`;
  }).join("")}`;

  const calculate = (id: number): void => {
    const card = root.querySelector<HTMLElement>(`[data-source-host-weapon-id="${id}"]`)!;
    const output = card.querySelector<HTMLElement>("[data-source-host-weapon-result]")!;
    try {
      if ([...card.querySelectorAll<HTMLInputElement>("input")].some(field => !field.value.trim() || !field.checkValidity())) throw new Error("请填写 1–5 的整数精炼等级及非负属性值。");
      const record = records.find(row => row.request.id === id)!;
      const state = document.weaponExperiments?.find(item => item.calculationId === id)?.input ?? record.request.input;
      const result = deriveSourceHostWeaponAdditiveEdit(document.originalCapture, id, state);
      output.innerHTML = `<p>原附加基伤 ${result.originalValue}；实验附加基伤 <strong>${result.editedValue}</strong>。</p>${result.status === "calculated" ? `<p>此项实验的公式伤害 <strong>${result.editedRawDamage}</strong>；相对原命中差值 ${result.editedRawDamage - result.originalRawDamage}。</p>` : `<p>本项公式已重算，完整命中暂不能联动：${esc(result.reason)}</p>`}${renderTraceHtml(result.formulaTrace)}${result.status === "calculated" && result.editedValue !== result.originalValue ? `<details><summary>本项实验的联动伤害步骤</summary>${renderTraceHtml(result.calculation.trace)}</details>` : ""}`;
    } catch (error) { output.textContent = error instanceof Error ? error.message : String(error); }
  };
  root.oninput = event => {
    const field = event.target as HTMLInputElement;
    const key = field.dataset.sourceHostWeaponState;
    if (key !== "refinement" && key !== "statValue") return;
    const id = Number(field.closest<HTMLElement>("[data-source-host-weapon-id]")!.dataset.sourceHostWeaponId);
    const row = records.find(item => item.request.id === id)!;
    if (row.request.kind !== "weapon-additive") return;
    if (field.value.trim() && field.checkValidity()) {
      const state = { ...(document.weaponExperiments?.find(item => item.calculationId === id)?.input ?? row.request.input), [key]: field.valueAsNumber };
      document.weaponExperiments = [...(document.weaponExperiments ?? []).filter(item => item.calculationId !== id), { calculationId: id, input: state }];
    }
    calculate(id);
  };
  for (const row of records) calculate(row.request.id);
  return () => {
    if ([...root.querySelectorAll<HTMLInputElement>("input")].some(field => !field.value.trim() || !field.checkValidity())) throw new Error("请先填写有效的武器实验输入。");
    for (const experiment of document.weaponExperiments ?? []) deriveSourceHostWeaponAdditiveEdit(document.originalCapture, experiment.calculationId, experiment.input);
  };
}
