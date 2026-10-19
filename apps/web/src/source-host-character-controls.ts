import { isSourceHostCharacterMultiplierRuleId, sourceHostCharacterMultiplierInputSchema, sourceHostCharacterMultiplierRuleDescriptor, type SourceHostCharacterMultiplierInput } from "../../../packages/sim-core/src/source-host-character-multiplier-formula";
import { isSourceHostCharacterFlatRuleId, sourceHostCharacterFlatInputSchema, sourceHostCharacterFlatRuleDescriptor, type SourceHostCharacterFlatInput } from "../../../packages/sim-core/src/source-host-character-flat-formula";
import type { SourceHostEditableCalculation } from "../../../packages/sim-core/src/source-host-capture";
import { deriveSourceHostCharacterFormulaEdit } from "../../../packages/sim-core/src/source-host-capture";
import {
  isSourceHostCharacterModifierDynamicRuleId,
  sourceHostCharacterModifierDynamicRuleDescriptor,
} from "../../../packages/sim-core/src/source-host-character-modifier-dynamic-formula";
import {
  sourceHostCharacterModifierInputSchema,
  sourceHostCharacterModifierRuleDescriptor,
  type SourceHostCharacterModifierInput,
} from "../../../packages/sim-core/src/source-host-character-modifier-formula";
import {
  isSourceHostCharacterAdditiveRuleId,
  sourceHostCharacterAdditiveInputSchema,
  sourceHostCharacterAdditiveRuleDescriptor,
  type SourceHostCharacterAdditiveInput,
} from "../../../packages/sim-core/src/source-host-character-additive-formula";
import {
  isSourceHostCharacterScalarRuleId,
  sourceHostCharacterScalarInputSchema,
  sourceHostCharacterScalarRuleDescriptor,
  type SourceHostCharacterScalarInput,
} from "../../../packages/sim-core/src/source-host-character-scalar-formula";
import { renderTraceHtml } from "./calculator-trace-view";

type CharacterInput = SourceHostCharacterModifierInput | SourceHostCharacterScalarInput | SourceHostCharacterAdditiveInput | SourceHostCharacterFlatInput | SourceHostCharacterMultiplierInput;
type InputDescriptor = { label: string; unit: string; minimum?: number; maximum?: number; integer?: boolean; choices?: readonly { value: number; label: string }[] };

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>\"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmt = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });

function renderInputFields(input: CharacterInput, descriptors: Readonly<Record<string, InputDescriptor>>): string {
  if (!("state" in input)) return "";
  const prior = "priorFlatDamage" in input && isSourceHostCharacterFlatRuleId(input.ruleId) && sourceHostCharacterFlatRuleDescriptor(input.ruleId).operation !== "set"
    ? `<label>操作前固定伤害（damage）<input type="number" step="any" required data-source-host-character-prior-flat value="${input.priorFlatDamage}"></label>` : "";
  const priorMultiplier = "priorMultiplier" in input && isSourceHostCharacterMultiplierRuleId(input.ruleId) && sourceHostCharacterMultiplierRuleDescriptor(input.ruleId).operation !== "set"
    ? `<label>操作前攻击倍率（ratio）<input type="number" step="any" required data-source-host-character-prior-multiplier value="${input.priorMultiplier}"></label>` : "";
  return prior + priorMultiplier + Object.entries(descriptors).map(([key, descriptor]) => {
    const value = input.state[key]!;
    const bounds = `${descriptor.minimum === undefined ? "" : ` min="${descriptor.minimum}"`}${descriptor.maximum === undefined ? "" : ` max="${descriptor.maximum}"`}`;
    const step = descriptor.integer ? "1" : "any";
    const control = descriptor.choices
      ? `<select required data-source-host-character-state-key="${esc(key)}">${descriptor.choices.map(choice => `<option value="${choice.value}"${choice.value === value ? " selected" : ""}>${esc(choice.label)}（${choice.value}）</option>`).join("")}</select>`
      : `<input type="number" step="${step}"${bounds} required data-source-host-character-state-key="${esc(key)}" value="${value}">`;
    return `<label>${esc(descriptor.label)}（${esc(descriptor.unit)}）${control}</label>`;
  }).join("");
}

function isEditableInput(input: CharacterInput): boolean {
  if (!("state" in input)) return false;
  if (isSourceHostCharacterMultiplierRuleId(input.ruleId)) return sourceHostCharacterMultiplierRuleDescriptor(input.ruleId).operation !== "set" || Object.keys(sourceHostCharacterMultiplierRuleDescriptor(input.ruleId).inputs).length > 0;
  if (isSourceHostCharacterFlatRuleId(input.ruleId)) return sourceHostCharacterFlatRuleDescriptor(input.ruleId).operation !== "set" || Object.keys(sourceHostCharacterFlatRuleDescriptor(input.ruleId).inputs).length > 0;
  if (isSourceHostCharacterAdditiveRuleId(input.ruleId)) return Object.keys(sourceHostCharacterAdditiveRuleDescriptor(input.ruleId).inputs).length > 0;
  if (isSourceHostCharacterScalarRuleId(input.ruleId)) return Object.keys(sourceHostCharacterScalarRuleDescriptor(input.ruleId).inputs).length > 0;
  if ("phase" in input && "ruleId" in input) {
    return isSourceHostCharacterModifierDynamicRuleId(input.ruleId)
      && Object.keys(sourceHostCharacterModifierDynamicRuleDescriptor(input.ruleId).inputs).length > 0;
  }
  return false;
}

function descriptorFor(input: CharacterInput): { title: string; inputs: Readonly<Record<string, InputDescriptor>> } {
  if (isSourceHostCharacterMultiplierRuleId(input.ruleId)) {
    const descriptor = sourceHostCharacterMultiplierRuleDescriptor(input.ruleId);
    return { title: descriptor.title, inputs: descriptor.inputs };
  }
  if (isSourceHostCharacterFlatRuleId(input.ruleId)) {
    const descriptor = sourceHostCharacterFlatRuleDescriptor(input.ruleId);
    return { title: descriptor.title, inputs: descriptor.inputs };
  }
  if (isSourceHostCharacterAdditiveRuleId(input.ruleId)) {
    const descriptor = sourceHostCharacterAdditiveRuleDescriptor(input.ruleId);
    return { title: descriptor.title, inputs: descriptor.inputs };
  }
  if (isSourceHostCharacterScalarRuleId(input.ruleId)) {
    const descriptor = sourceHostCharacterScalarRuleDescriptor(input.ruleId);
    return { title: descriptor.title, inputs: descriptor.inputs };
  }
  if ("phase" in input && isSourceHostCharacterModifierDynamicRuleId(input.ruleId)) {
    const descriptor = sourceHostCharacterModifierDynamicRuleDescriptor(input.ruleId);
    return { title: descriptor.title, inputs: descriptor.inputs };
  }
  const descriptor = sourceHostCharacterModifierRuleDescriptor(input.ruleId);
  return { title: descriptor.title, inputs: {} };
}

function parseCharacterInput(input: CharacterInput): CharacterInput {
  if (isSourceHostCharacterMultiplierRuleId(input.ruleId)) return sourceHostCharacterMultiplierInputSchema.parse(input);
  if (isSourceHostCharacterFlatRuleId(input.ruleId)) return sourceHostCharacterFlatInputSchema.parse(input);
  if (isSourceHostCharacterAdditiveRuleId(input.ruleId)) return sourceHostCharacterAdditiveInputSchema.parse(input);
  return isSourceHostCharacterScalarRuleId(input.ruleId)
    ? sourceHostCharacterScalarInputSchema.parse(input) : sourceHostCharacterModifierInputSchema.parse(input);
}

/** Render formula-only experiments for captured character modifiers, scalar reads and additive clauses. */
export function renderSourceHostCharacterControls(root: HTMLElement, current: SourceHostEditableCalculation): () => void {
  const document = current;
  const records = [
    ...(current.originalCapture.supportingCalculations ?? []).filter(row =>
      row.request.kind === "character-modifier" || row.request.kind === "character-scalar" || row.request.kind === "character-additive"),
    ...current.originalCapture.components.filter(row => row.request.kind === "character-additive" || row.request.kind === "character-flat" || row.request.kind === "character-multiplier"),
  ];
  if (!records.length) { root.hidden = true; root.innerHTML = ""; return () => {}; }

  root.hidden = false;
  root.innerHTML = `<section data-source-host-character-controls><h3>角色共享公式 · 独立数值实验</h3><p>每项实验只重算角色修饰器、辅助标量、技能倍率或附加伤害的共享公式，不会回写来源捕获，也不会将修改传播到队伍状态。范围：本项数值公式；后续命中未联动。</p>${records.map(row => {
    if (row.request.kind !== "character-modifier" && row.request.kind !== "character-scalar" && row.request.kind !== "character-additive" && row.request.kind !== "character-flat" && row.request.kind !== "character-multiplier") return "";
    const input = document.characterExperiments?.find(item => item.calculationId === row.request.id)?.input ?? row.request.input;
    const descriptor = descriptorFor(input);
    const editable = isEditableInput(input);
    const immutable = !editable;
    const phase = row.request.kind === "character-additive" && "phase" in input ? input.phase : undefined;
    const phaseLabel = row.request.kind === "character-flat" && isSourceHostCharacterFlatRuleId(input.ruleId)
      ? ({ set: "赋值基数", add: "加算基数", multiply: "乘算基数" } as const)[sourceHostCharacterFlatRuleDescriptor(input.ruleId).operation]
      : row.request.kind === "character-multiplier" && isSourceHostCharacterMultiplierRuleId(input.ruleId)
        ? ({ set: "赋值倍率", add: "加算倍率", multiply: "乘算倍率" } as const)[sourceHostCharacterMultiplierRuleDescriptor(input.ruleId).operation]
      : phase === "creation" ? "状态创建" : phase === "hit" ? "命中公式" : "角色公式";
    const phaseAttribute = phase ? `data-source-host-character-phase="${phase}"` : "";
    return `<fieldset data-source-host-character-id="${row.request.id}" data-source-host-character-kind="${row.request.kind}" ${phaseAttribute}><legend>${esc(descriptor.title)} · ${phaseLabel} · 计算 #${row.request.id}</legend><p>原值：${fmt(row.value)}${immutable ? " · 常量公式，只读" : ""}</p>${editable ? `<div class="calculator-fields">${renderInputFields(input, descriptor.inputs)}</div>` : ""}<div data-source-host-character-result role="status"></div></fieldset>`;
  }).join("")}</section>`;

  const calculate = (id: number): void => {
    const card = root.querySelector<HTMLElement>(`[data-source-host-character-id="${id}"]`);
    if (!card) return;
    const output = card.querySelector<HTMLElement>("[data-source-host-character-result]")!;
    const record = records.find(row => row.request.id === id);
    if (!record || (record.request.kind !== "character-modifier" && record.request.kind !== "character-scalar" && record.request.kind !== "character-additive" && record.request.kind !== "character-flat" && record.request.kind !== "character-multiplier")) return;
    if ([...card.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select")].some(field => !field.value.trim() || !field.checkValidity())) {
      output.textContent = "请填写符合来源角色公式范围的输入。";
      return;
    }
    const input = document.characterExperiments?.find(item => item.calculationId === id)?.input ?? record.request.input;
    try {
      const parsed = parseCharacterInput(input);
      const result = deriveSourceHostCharacterFormulaEdit(current.originalCapture, id, parsed);
      output.innerHTML = `<p>原值 ${fmt(result.originalValue)}；实验值 <strong>${fmt(result.editedValue)}</strong>；${result.changed ? "输入已修改" : "输入与捕获值相同"}。</p><p>影响范围：本项数值公式；后续命中未联动。</p>${renderTraceHtml(result.formulaTrace)}`;
    } catch (error) { output.textContent = error instanceof Error ? error.message : String(error); }
  };

  const handleInput = (event: Event): void => {
    event.stopPropagation();
    const field = event.target as HTMLInputElement | HTMLSelectElement;
    const key = field.dataset.sourceHostCharacterStateKey;
    const editingPrior = field.hasAttribute("data-source-host-character-prior-flat");
    const editingMultiplier = field.hasAttribute("data-source-host-character-prior-multiplier");
    if (!key && !editingPrior && !editingMultiplier) return;
    const card = field.closest<HTMLElement>("[data-source-host-character-id]");
    const id = Number(card?.dataset.sourceHostCharacterId);
    const record = records.find(row => row.request.id === id);
    if (!record || (record.request.kind !== "character-modifier" && record.request.kind !== "character-scalar" && record.request.kind !== "character-additive" && record.request.kind !== "character-flat" && record.request.kind !== "character-multiplier")) return;
    const prior = document.characterExperiments?.find(item => item.calculationId === id)?.input ?? record.request.input;
    if (!("state" in prior) || (editingPrior ? !("priorFlatDamage" in prior) : editingMultiplier ? !("priorMultiplier" in prior) : !Object.prototype.hasOwnProperty.call(prior.state, key!))) return;
    const value = field instanceof HTMLSelectElement ? Number(field.value) : field.valueAsNumber;
    const updated: CharacterInput = editingPrior && "priorFlatDamage" in prior
      ? { ...prior, priorFlatDamage: value }
      : editingMultiplier && "priorMultiplier" in prior ? { ...prior, priorMultiplier: value }
      : { ...prior, state: { ...prior.state, [key!]: value } };
    try {
      parseCharacterInput(updated);
      document.characterExperiments = [...(document.characterExperiments ?? []).filter(item => item.calculationId !== id), { calculationId: id, input: updated }];
    } catch { /* Keep the last valid experiment until all fields satisfy the descriptor. */ }
    calculate(id);
  };
  root.oninput = handleInput;
  root.onchange = handleInput;
  root.onclick = event => { event.stopPropagation(); };
  for (const row of records) calculate(row.request.id);

  return () => {
    if ([...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select")].some(field => !field.value.trim() || !field.checkValidity())) {
      throw new Error("请先填写符合来源角色公式范围的实验输入。");
    }
    for (const experiment of document.characterExperiments ?? []) {
      const input = parseCharacterInput(experiment.input);
      deriveSourceHostCharacterFormulaEdit(current.originalCapture, experiment.calculationId, input);
    }
  };
}
