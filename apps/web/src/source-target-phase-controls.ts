import type { SourceHostTargetPhaseRequest } from "../../../packages/sim-core/src/source-host-target-phase";

export type SourceTargetPhaseEffectMode = "normal" | "blocked";
export type SourceTargetPhaseDamageMode = "normal" | "immune";

export type SourceTargetPhaseDraft = Omit<SourceHostTargetPhaseRequest["phases"][number], "targetIndex">;

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]!);

const damageOptions = (value: SourceTargetPhaseDamageMode): string => `
  <option value="normal"${value === "normal" ? " selected" : ""}>正常伤害</option>
  <option value="immune"${value === "immune" ? " selected" : ""}>免伤</option>`;
const blockedOptions = (value: SourceTargetPhaseEffectMode, normalLabel: string, blockedLabel: string): string => `
  <option value="normal"${value === "normal" ? " selected" : ""}>${normalLabel}</option>
  <option value="blocked"${value === "blocked" ? " selected" : ""}>${blockedLabel}</option>`;

const renderRow = (phase: SourceTargetPhaseDraft, index: number): string => `
  <fieldset data-target-phase-row="${index}" data-target-phase-id="${esc(phase.id)}">
    <legend>阶段 ${index + 1}</legend>
    <div class="workspace-fields">
      <label>阶段名称<input type="text" data-target-phase-field="label" value="${esc(phase.label)}"></label>
      <label>起始帧（含）<input type="number" step="1" min="0" data-target-phase-field="startFrame" value="${esc(phase.startFrame)}"></label>
      <label>结束帧（不含）<input type="number" step="1" min="1" data-target-phase-field="endFrame" value="${esc(phase.endFrame)}"></label>
      <label>情景说明<input type="text" data-target-phase-field="reason" value="${esc(phase.reason)}"></label>
      <label>伤害<select data-target-phase-field="damage">${damageOptions(phase.effects.damage)}</select></label>
      <label>元素附着 / 反应<select data-target-phase-field="aura">${blockedOptions(phase.effects.aura, "正常", "禁止附着与反应")}</select></label>
      <label>命中触发<select data-target-phase-field="hitConfirm">${blockedOptions(phase.effects.hitConfirm, "正常", "禁止命中触发")}</select></label>
    </div>
    <button type="button" data-target-phase-action="remove" data-target-phase-index="${index}">删除此阶段</button>
  </fieldset>`;

/** Renders user-declared target phase scenarios; effects remain explicit per phase. */
export function renderSourceTargetPhaseControls(phases: readonly SourceTargetPhaseDraft[] = []): string {
  return `<section data-source-target-phase-controls>
    <h4>目标阶段情景</h4>
    <p>帧按 60 帧/秒计；起始帧包含，结束帧不包含。未被阶段覆盖的时间按正常行为处理。以下是用户设定情景，不表示已核实敌人机制。</p>
    <details><summary>各项效果说明</summary><ul>
      <li>免伤：本阶段伤害为零，但仍可命中并正常附着元素、触发反应。</li>
      <li>禁止附着与反应：跳过本次元素附着与反应，不消耗附着计数；已有元素附着仍继续自然衰减。</li>
      <li>禁止命中触发：不触发依赖命中的效果；伤害与统计仍保留，几何接触和双方停帧也照常发生。</li>
    </ul><p>这三项是彼此独立的条件，可按情景组合。</p></details>
    <div data-target-phase-rows>${phases.map(renderRow).join("")}</div>
    <button type="button" data-target-phase-action="add">添加 60 帧阶段</button>
  </section>`;
}

const controlsFor = (root: HTMLElement): HTMLElement | null => {
  if (root.matches("[data-source-target-phase-controls]")) return root;
  return root.closest<HTMLElement>("[data-source-target-phase-controls]")
    ?? root.querySelector<HTMLElement>("[data-source-target-phase-controls]");
};

/** Reads only this phase-control region and validates integer half-open frame ranges. */
export function readSourceTargetPhaseControls(root: HTMLElement): SourceTargetPhaseDraft[] {
  const controls = controlsFor(root);
  if (!controls) throw new Error("缺少目标阶段编辑区域。");
  const rows = [...controls.querySelectorAll<HTMLElement>("[data-target-phase-row]")];
  return rows.map((row, index) => {
    const readText = (field: "label" | "reason"): string => {
      const input = row.querySelector<HTMLInputElement>(`[data-target-phase-field="${field}"]`);
      if (!input) throw new Error(`阶段 ${index + 1} 缺少${field === "label" ? "名称" : "情景说明"}输入。`);
      return input.value;
    };
    const readFrame = (field: "startFrame" | "endFrame"): number => {
      const input = row.querySelector<HTMLInputElement>(`[data-target-phase-field="${field}"]`);
      if (!input || input.value.trim() === "" || !input.checkValidity() || !Number.isInteger(input.valueAsNumber))
        throw new Error(`阶段 ${index + 1} 的帧数须为非负整数。`);
      return input.valueAsNumber;
    };
    const readSelect = <T extends string>(field: "damage" | "aura" | "hitConfirm", allowed: readonly T[]): T => {
      const select = row.querySelector<HTMLSelectElement>(`[data-target-phase-field="${field}"]`);
      if (!select || !allowed.includes(select.value as T)) throw new Error(`阶段 ${index + 1} 的${field}选项无效。`);
      return select.value as T;
    };
    const startFrame = readFrame("startFrame");
    const endFrame = readFrame("endFrame");
    if (endFrame <= startFrame) throw new Error(`阶段 ${index + 1} 的结束帧须大于起始帧。`);
    const id = row.dataset.targetPhaseId;
    if (!id) throw new Error(`阶段 ${index + 1} 缺少稳定标识。`);
    return {
      id,
      label: readText("label"),
      startFrame,
      endFrame,
      reason: readText("reason"),
      effects: {
        damage: readSelect("damage", ["normal", "immune"] as const),
        aura: readSelect("aura", ["normal", "blocked"] as const),
        hitConfirm: readSelect("hitConfirm", ["normal", "blocked"] as const),
      },
    };
  });
}

/** Creates or removes an immutable phase draft without mutating existing rows. */
export function sourceTargetPhaseControlAction(
  phases: readonly SourceTargetPhaseDraft[],
  action: "add" | "remove",
  index?: number,
): SourceTargetPhaseDraft[] {
  const next = structuredClone(phases) as SourceTargetPhaseDraft[];
  if (action === "remove") {
    if (!Number.isInteger(index) || index! < 0 || index! >= next.length) throw new Error("请选择有效的目标阶段。");
    next.splice(index!, 1);
    return next;
  }
  const last = next.at(-1);
  const startFrame = last?.endFrame ?? 0;
  const ids = new Set(next.map(phase => phase.id));
  let suffix = 1;
  while (ids.has(`phase-${suffix}`)) suffix++;
  next.push({
    id: `phase-${suffix}`,
    label: `阶段 ${next.length + 1}`,
    startFrame,
    endFrame: startFrame + 60,
    reason: "用户声明情景",
    effects: { damage: "normal", aura: "normal", hitConfirm: "normal" },
  });
  return next;
}
