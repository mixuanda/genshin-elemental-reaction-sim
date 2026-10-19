import {
  calculateSourceHostEditableCalculation, createSourceHostEditableCalculation,
  sourceHostEditableCalculationSchema, replaySourceHostHit,
  deriveSourceHostArtifactScalarEdit,
  type SourceHostEditableCalculation, type SourceHostHitCapture,
} from "../../../packages/sim-core/src/source-host-capture";
import { renderTraceHtml } from "./calculator-trace-view";
import { renderSourceHostWeaponControls } from "./source-host-weapon-controls";
import { renderSourceHostCharacterControls } from "./source-host-character-controls";
import { sourceHostArtifactRuleTitle } from "../../../packages/sim-core/src/source-host-artifact-formula";
import { isSourceHostArtifactDynamicRuleId, sourceHostArtifactDynamicRuleDescriptor, sourceHostArtifactDynamicRuleTitle } from "../../../packages/sim-core/src/source-host-artifact-dynamic-formula";
import { deriveSourceHostArtifactAdditiveEdit } from "../../../packages/sim-core/src/source-host-artifact-additive-capture";
import { renderSourceHostBasePanelProvenance } from "./source-host-base-panel-provenance";

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function downloadSourceHostJson(value: unknown, filename: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fields = {
  scalingValue: "本击实际缩放属性（最终数值）", scaling: "天赋倍率（1 = 100%）",
  baseDamageBonus: "缩放项基础加成", flatDamage: "附加基伤（含已捕获组件）", damageBonus: "适用伤害加成",
  characterLevel: "角色等级", enemyLevel: "敌人等级", effectiveResistance: "实际抗性",
  defenseAdjustment: "防御调整（减防为负）", defenseIgnore: "防御忽略",
  critRate: "暴击率", critDamage: "暴击伤害", elementalMastery: "本击元素精通",
  reactionBonus: "增幅反应加成", amplifyingMultiplier: "已发生增幅的基础倍率",
  groupMultiplier: "伤害组倍率", elevation: "独立提升乘区",
} as const;
const directLunarFields = new Set<keyof typeof fields>(["scalingValue", "scaling", "baseDamageBonus", "flatDamage", "effectiveResistance", "critRate", "critDamage", "elementalMastery", "reactionBonus", "groupMultiplier", "elevation"]);
const lunarDeliveryFields = new Set<keyof typeof fields>(["effectiveResistance", "groupMultiplier", "elevation"]);
const contributorFields = {
  characterLevel: "贡献者等级", elementalMastery: "贡献者元素精通", baseDamageBonus: "月曜基础加成",
  reactionBonus: "月曜反应加成", flatDamage: "月曜附加基数", elevation: "独立提升乘区", critRate: "暴击率", critDamage: "暴击伤害",
} as const;

/** Standalone numeric editing uses the same resolver as the live WASM callback. */
export function renderSourceHostCalculator(root: HTMLElement, input: SourceHostHitCapture | SourceHostEditableCalculation, onChange?: (document: SourceHostEditableCalculation | null) => void): void {
  let current = input.schemaVersion === "source-host-calculator-v1"
    ? sourceHostEditableCalculationSchema.parse(input) : createSourceHostEditableCalculation(input);
  const restored = replaySourceHostHit(current.originalCapture);
  const artifactSupport = (current.originalCapture.supportingCalculations ?? []).filter(row => row.request.kind === "artifact-scalar");
  const artifactAdditiveRecords = current.originalCapture.components.filter(row => row.request.kind === "artifact-additive");
  const artifactControls = artifactSupport.map(row => {
    if (row.request.kind !== "artifact-scalar") return "";
    const state = current.artifactExperiments?.find(item => item.calculationId === row.request.id)?.input ?? row.request.input;
    const control = "stacks" in state ? `<label>有效层数<input type="number" min="0" max="${state.ruleId.startsWith("pf-") ? 2 : 3}" step="1" required data-source-host-artifact-state="stacks" value="${state.stacks}"></label>`
      : "tier" in state ? `<label>场上状态<select data-source-host-artifact-state="tier"><option value="1" ${state.tier === 1 ? "selected" : ""}>场上基础档 · 25%</option><option value="2" ${state.tier === 2 ? "selected" : ""}>后台或入场宽限期 · 50%</option></select></label>`
      : "branch" in state ? `<label>反应分支<select data-source-host-artifact-state="branch"><option value="none" ${state.branch === "none" ? "selected" : ""}>其他 · 0%</option><option value="amplifying" ${state.branch === "amplifying" ? "selected" : ""}>增幅 · 15%</option><option value="transformative" ${state.branch === "transformative" ? "selected" : ""}>超载 / 燃烧 / 烈绽放 · 40%</option></select></label>`
      : isSourceHostArtifactDynamicRuleId(state.ruleId) ? (() => {
        const dynamicState = (state as typeof state & { state: Record<string, number> }).state;
        const descriptor = sourceHostArtifactDynamicRuleDescriptor(state.ruleId);
        const inputs = Object.entries(descriptor.inputs);
        if (!inputs.length) return "<p>此动态公式没有可编辑状态；实验使用捕获值。</p>";
        return '<div class="calculator-fields">' + inputs.map(([key, meta]) => {
          const value = dynamicState[key];
          const label = esc(meta.label) + (meta.unit ? `（${esc(meta.unit)}）` : "");
          if (meta.choices?.length) return `<label>${label}<select required data-source-host-artifact-state-key="${esc(key)}">${meta.choices.map(choice => `<option value="${choice.value}" ${value === choice.value ? "selected" : ""}>${esc(choice.label)}</option>`).join("")}</select></label>`;
          return `<label>${label}<input type="number" ${meta.minimum === undefined ? "" : `min="${meta.minimum}"`} ${meta.maximum === undefined ? "" : `max="${meta.maximum}"`} step="${meta.integer ? "1" : "any"}" required data-source-host-artifact-state-key="${esc(key)}" value="${value}"></label>`;
        }).join("") + "</div>";
      })() : "<p>此项为固定常量，没有可编辑的状态变量。</p>";
    const title = isSourceHostArtifactDynamicRuleId(state.ruleId) ? sourceHostArtifactDynamicRuleTitle(state.ruleId) : sourceHostArtifactRuleTitle(state.ruleId);
    return `<fieldset data-source-host-artifact-id="${row.request.id}"><legend>${esc(title)} · 计算 #${row.request.id}</legend><details><summary>公式标识</summary><code>${esc(state.ruleId)}</code></details>${control}<div data-source-host-artifact-result></div></fieldset>`;
  }).join("");
  const additiveSourceLabels = {
    echoes: { title: "来歆余响四件：幽谷祝祀附加伤害", label: "来源本次实际总攻击力", unit: "ATK" },
    songofdayspast: { title: "昔时之歌四件：往日之歌附加伤害", label: "来源六秒疗愈快照", unit: "治疗值" },
    oceanhuedclam: { title: "海染砗磲四件：海染泡沫伤害基数", label: "来源三秒泡沫累积治疗量", unit: "治疗值" },
  } as const;
  const artifactAdditiveControls = artifactAdditiveRecords.length ? `<section data-source-host-artifact-additive-support><h3>圣遗物附加伤害 · 数值实验</h3><p>下方只编辑共享公式读取的快照数值。真实 Go 触发、随机数、窗口、次数及排队状态保持原样只读；实验值不会写回原命中捕获。</p>${artifactAdditiveRecords.map(row => {
    if (row.request.kind !== "artifact-additive") return "";
    const state = current.artifactAdditiveExperiments?.find(item => item.calculationId === row.request.id)?.input ?? row.request.input;
    const source = additiveSourceLabels[state.ruleId];
    const scope = row.request.componentScope === "queued-attack" ? "排队伤害" : "本次命中";
    const artifactState = row.request.artifactState;
    const snapshotNote = state.ruleId === "echoes" ? "" : '<p class="calculator-hint">疗愈快照或泡沫治疗累计量沿用来源记录；此处只重算装备读取的数值，不展开治疗计算式。</p>';
    let summary: string;
    if (artifactState.ruleId === "echoes") {
      summary = artifactState.path === "active-window" ? "实际来源：命中时处于余响强化窗口" : "实际来源：本次命中通过来源随机判定";
      summary += `；概率 ${artifactState.probabilityBefore} → ${artifactState.probabilityAfter}，随机值 ${artifactState.roll ?? "此窗口分支未抽样"}；强化到期帧 ${artifactState.procExpiryBefore} → ${artifactState.procExpiryAfter}，冷却到期帧 ${artifactState.cooldownBefore} → ${artifactState.cooldownAfter}。`;
    } else if (artifactState.ruleId === "songofdayspast") {
      summary = `实际来源：持有角色索引 ${artifactState.sourceHolderIndex}；剩余次数 ${artifactState.remainingBefore} → ${artifactState.remainingAfter}；伤害加成窗口剩余 ${artifactState.windowRemainingFrames} 帧，疗愈快照 ${artifactState.healSnap}。`;
    } else {
      summary = `实际来源：海染泡沫治疗累积状态 ${artifactState.bubbleHealStacks}；泡沫到期帧 ${artifactState.bubbleExpiry}，冷却到期帧 ${artifactState.cooldownExpiry}；排队延迟 ${artifactState.queueDelayFrames} 帧。`;
    }
    const rawEvidence = JSON.stringify({ componentScope: row.request.componentScope, artifactState }, null, 2);
    return `<fieldset data-source-host-artifact-additive-id="${row.request.id}"><legend>${esc(source.title)} · ${scope} · 计算 #${row.request.id}</legend><p>${esc(summary)}</p>${snapshotNote}<details data-source-host-artifact-window><summary>查看原始只读 Go 回执</summary><pre>${esc(rawEvidence)}</pre></details><label>${esc(source.label)}（${esc(source.unit)}）<input type="number" step="any" required data-source-host-artifact-additive-state="sourceValue" value="${state.sourceValue}"></label><div data-source-host-artifact-additive-result role="status"></div></fieldset>`;
  }).join("")}</section>` : "";
  const visibleFields = Object.entries(fields).filter(([key]) => current.request.kind === "damage" || (current.request.kind === "lunar-direct" || current.request.kind === "stellar-direct" ? directLunarFields : lunarDeliveryFields).has(key as keyof typeof fields));
  const contributors = current.components.map(row => {
    if (row.request.kind !== "lunar-contributor" && row.request.kind !== "stellar-contributor") return "";
    const request = row.request;
    return `<fieldset><legend>实际贡献者 ${esc(request.actorKey)} · 第 ${request.snapshotFrame} 帧</legend><p>保存的暴击随机数 ${request.input.critRoll}；编辑后使用同一抽样，并重新排序与分配贡献权重。</p><div class="calculator-fields">${Object.entries(contributorFields).map(([key, label]) => `<label>${label}<input type="number" step="any" required data-source-host-component="${request.id}" data-source-host-component-field="${key}" value="${request.input[key as keyof typeof contributorFields]}"></label>`).join("")}</div></fieldset>`;
  }).join("");
  const classicReactionComponents = current.components.map(row => {
    if (row.request.kind !== "transformative-base" && row.request.kind !== "additive-base") return "";
    const request = row.request;
    const kindLabel = request.kind === "transformative-base" ? "剧变反应基数" : "增伤反应基数";
    const read = request.statRead;
    const originalRead = read
      ? `<p data-source-host-reaction-stat-read>原始 EM getter：${read.result[8]}（第 ${read.frame} 帧）。</p>`
      : `<p data-source-host-reaction-stat-read>此组件没有保存原始 EM getter 回执。</p>`;
    const editableFields = [
      { key: "characterLevel", label: "反应生成时角色等级", value: request.input.characterLevel, min: 1, max: 100, step: 1 },
      { key: "elementalMastery", label: "反应生成时元素精通", value: request.input.elementalMastery, min: 0, step: "any" },
      { key: "reactionBonus", label: "反应伤害加成", value: request.input.reactionBonus, min: 0, step: "any" },
    ];
    return `<fieldset data-source-host-classic-reaction-kind="${request.kind}"><legend>${kindLabel} · ${esc(request.actorKey)} · ${esc(request.ability)} · 第 ${request.frame} 帧</legend>
      <p>同一个反应组件可能被多个 tick 复用；这里仅重算当前捕获命中，原 getter 与触发历史保持不变。主命中 EM 不会替代反应生成时的 EM。</p>${originalRead}
      <div class="calculator-fields">${editableFields.map(field => `<label>${field.label}<input type="number" min="${field.min}"${field.max === undefined ? "" : ` max="${field.max}"`} step="${field.step}" required data-source-host-component="${request.id}" data-source-host-component-field="${field.key}" value="${field.value}"></label>`).join("")}</div></fieldset>`;
  }).join("");
  root.innerHTML = `<article class="card"><h2>来源模拟命中 · 独立计算</h2><p>${esc(current.label)}</p>
    <p>共享伤害公式按保存的本击输入独立重放；前置属性的算式与说明缺口见基础面板回执及共享轨迹。</p>
    <p>固定来源机制仍属暂定；此处只编辑单次捕获命中，不支持从任意帧恢复队伍状态。</p>
    <p>原命中：原始公式伤害 <strong>${restored.originalRawDamage}</strong>；来源记账伤害 <strong>${restored.originalDamage}</strong>。完整上下文重放：原始公式伤害 <strong>${restored.reproducedRawDamage}</strong>；来源记账伤害 <strong>${restored.reproducedDamage}</strong>；记账差值 ${restored.difference}。免伤等门控下，原始公式伤害可以大于零而来源记账伤害为零。</p>
    ${renderSourceHostBasePanelProvenance(current.request.snapshot?.statProvenance?.snapshotRead)}
    <p>执行器 SHA-256：<code>${esc(current.originalCapture.executionArtifact?.wasmSha256 ?? "旧记录未保存产物身份")}</code></p>
    <p>原始终端暴击随机数：${esc(current.request.input.critRoll ?? "弱点保证，无随机抽样")}。${(current.request.kind === "lunar-delivery" || current.request.kind === "stellar-delivery") ? "特殊反应伤害使用下面各贡献者的真实抽样；终端暴击标记用于来源记账。" : "编辑后沿用这一随机数。"}反应触发资格、时刻与历史资源事件保持冻结。</p>
    ${artifactControls ? `<section data-source-host-artifact-support><h3>上游圣遗物公式实验</h3><p>这里列出本击实际消费的装备公式。可编辑项都通过同一个共享核心计算；每项实验独立使用原命中上下文，不与其他实验或下方最终面板合并。只有可证明的属性传递路径才会显示联动伤害。导出的 JSON 会保留这些实验。</p>${artifactControls}</section>` : ""}
    ${artifactAdditiveControls}
    <div class="calculator-fields" data-source-host-hit-fields>${visibleFields.map(([key, label]) => `<label>${current.request.kind !== "damage" && key === "reactionBonus" ? current.request.kind.startsWith("stellar") ? "星辉反应加成" : "月曜反应加成" : label}<input type="number" step="any" required data-source-host-input="${key}" value="${current.request.input[key as keyof typeof fields]}"></label>`).join("")}</div>${contributors}${classicReactionComponents}${current.request.kind === "stellar-direct" && current.request.input.branch === "stellar-conduct-direct" ? `<label>极星领域实际附着计数<input type="number" min="0" max="12" step="1" required data-source-host-polestar value="${current.request.input.polestarApplicationCount}"></label>` : ""}
    <div class="editor-actions"><button type="button" data-source-host-reset>恢复捕获值</button><button type="button" data-source-host-export>导出独立计算 JSON</button></div>
    <div data-source-host-calculation-result role="status"></div><details><summary>原命中的完整重放步骤与实际扣血</summary>${renderTraceHtml(restored.trace)}</details></article>`;
  const output = root.querySelector<HTMLElement>("[data-source-host-calculation-result]")!;
  const weaponControls = window.document.createElement("section");
  weaponControls.dataset.sourceHostWeaponSupport = "";
  root.querySelector("[data-source-host-hit-fields]")!.before(weaponControls);
  const validateWeaponExperiments = renderSourceHostWeaponControls(weaponControls, current);
  const characterControls = window.document.createElement("section");
  characterControls.dataset.sourceHostCharacterSupport = "";
  weaponControls.after(characterControls);
  const validateCharacterExperiments = renderSourceHostCharacterControls(characterControls, current);
  const calculateArtifact = (id: number): void => {
    const card = root.querySelector<HTMLElement>(`[data-source-host-artifact-id="${id}"]`)!;
    const resultHost = card.querySelector<HTMLElement>("[data-source-host-artifact-result]")!;
    try {
      const invalid = [...card.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-source-host-artifact-state], [data-source-host-artifact-state-key]")]
        .some(field => !field.value.trim() || !field.checkValidity());
      if (invalid) throw new Error("请填写此规则支持的有效装备状态。");
      const row = artifactSupport.find(item => item.request.id === id)!;
      const state = current.artifactExperiments?.find(item => item.calculationId === id)?.input ?? row.request.input;
      const result = deriveSourceHostArtifactScalarEdit(current.originalCapture, id, state);
      resultHost.innerHTML = `<p>捕获值 ${result.originalValue}；实验值 <strong>${result.editedValue}</strong>。</p>${result.status === "calculated" ? `<p>此项实验的公式伤害 <strong>${result.editedRawDamage}</strong>；相对原命中差值 ${result.editedRawDamage - result.originalRawDamage}。触发历史与暴击抽样保持不变。</p>` : `<p>已重算本项公式，完整命中暂不能联动：${esc(result.reason)}</p>`}${renderTraceHtml(result.formulaTrace)}${result.status === "calculated" && result.editedValue !== result.originalValue ? `<details><summary>这项实验的联动伤害步骤</summary>${renderTraceHtml(result.calculation.trace)}</details>` : ""}`;
    } catch (error) { resultHost.textContent = error instanceof Error ? error.message : String(error); }
  };
  const calculateArtifactAdditive = (id: number): void => {
    const card = root.querySelector<HTMLElement>(`[data-source-host-artifact-additive-id="${id}"]`)!;
    const resultHost = card.querySelector<HTMLElement>("[data-source-host-artifact-additive-result]")!;
    try {
      const field = card.querySelector<HTMLInputElement>("[data-source-host-artifact-additive-state='sourceValue']");
      if (!field || !field.value.trim() || !field.checkValidity()) throw new Error("请输入有效的公式快照值。");
      const row = artifactAdditiveRecords.find(item => item.request.id === id)!;
      if (row.request.kind !== "artifact-additive") throw new Error("捕获中不存在该圣遗物附加值记录。");
      const state = current.artifactAdditiveExperiments?.find(item => item.calculationId === id)?.input ?? row.request.input;
      const result = deriveSourceHostArtifactAdditiveEdit(current.originalCapture, id, state);
      resultHost.innerHTML = `<p>原来源附加值 ${result.originalValue}；实验公式值 <strong>${result.editedValue}</strong>。</p>${result.status === "calculated" ? `<p>在原命中输入上替换这一项后的公式伤害 <strong>${result.editedRawDamage}</strong>；相对原命中差值 ${result.editedRawDamage - result.originalRawDamage}。真实 Go 触发窗口与排队回执仍是捕获时状态。</p>` : `<p>已重算本项公式；完整命中暂不能联动：${esc(result.reason)}</p>`}${renderTraceHtml(result.formulaTrace)}${result.status === "calculated" && result.editedValue !== result.originalValue ? `<details><summary>本项实验的联动伤害步骤</summary>${renderTraceHtml(result.calculation.trace)}</details>` : ""}`;
    } catch (error) { resultHost.textContent = error instanceof Error ? error.message : String(error); }
  };
  const calculate = (): void => {
    try {
      if ([...root.querySelectorAll<HTMLInputElement>("[data-source-host-input], [data-source-host-component-field], [data-source-host-polestar]")].some(field => !field.value.trim() || !field.checkValidity())) throw new Error("请填写有效数值；留空不能当作零。");
      const result = calculateSourceHostEditableCalculation(current);
      onChange?.(current);
      output.innerHTML = `<h3>${result.edited ? "编辑后" : "捕获时"}原始公式伤害：${result.value}</h3><p>相对原始公式差值：${result.difference}。这里不将编辑后的公式伤害记入原队伍，也不重新推定目标生命。</p>${result.applicationValue === undefined ? "" : `<p data-source-host-phase-application>固定本击捕获的目标阶段策略与命中前 HP，${result.edited ? "假设" : "按捕获条件重算"}来源记账伤害：<strong>${result.applicationValue}</strong>；相对原命中来源记账伤害差值 ${result.applicationDifference}。这是本击的条件数值试算：不重跑目标事件序列、附着或回调历史，也不更新后续命中的 HP 状态。</p>`}<ul>${result.warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul>${renderTraceHtml(result.trace)}`;
    } catch (error) { onChange?.(null); output.textContent = error instanceof Error ? error.message : String(error); }
  };
  root.oninput = event => {
    const field = event.target as HTMLInputElement, key = field.dataset.sourceHostInput as keyof typeof fields | undefined;
    if (field.dataset.sourceHostArtifactAdditiveState === "sourceValue") {
      const id = Number(field.closest<HTMLElement>("[data-source-host-artifact-additive-id]")!.dataset.sourceHostArtifactAdditiveId);
      const row = artifactAdditiveRecords.find(item => item.request.id === id)!;
      if (row.request.kind === "artifact-additive" && field.value.trim() && field.checkValidity()) {
        const state = { ...(current.artifactAdditiveExperiments?.find(item => item.calculationId === id)?.input ?? row.request.input), sourceValue: Number(field.value) };
        current.artifactAdditiveExperiments = [...(current.artifactAdditiveExperiments ?? []).filter(item => item.calculationId !== id), { calculationId: id, input: state }];
      }
      calculateArtifactAdditive(id);
      return;
    }
    const artifactState = field.dataset.sourceHostArtifactState;
    const artifactStateKey = field.dataset.sourceHostArtifactStateKey;
    if (artifactState || artifactStateKey !== undefined) {
      const id = Number(field.closest<HTMLElement>("[data-source-host-artifact-id]")!.dataset.sourceHostArtifactId);
      const row = artifactSupport.find(item => item.request.id === id)!;
      if (row.request.kind !== "artifact-scalar") return;
      if (field.value.trim() && field.checkValidity()) {
        const state = { ...(current.artifactExperiments?.find(item => item.calculationId === id)?.input ?? row.request.input) };
        if (artifactState === "stacks" && "stacks" in state) state.stacks = Number(field.value);
        if (artifactState === "tier" && "tier" in state) state.tier = Number(field.value) as 1 | 2;
        if (artifactState === "branch" && "branch" in state) state.branch = field.value as typeof state.branch;
        if (artifactStateKey !== undefined && isSourceHostArtifactDynamicRuleId(state.ruleId)) {
          const dynamic = state as typeof state & { state: Record<string, number> };
          dynamic.state = { ...dynamic.state, [artifactStateKey]: Number(field.value) };
        }
        current.artifactExperiments = [...(current.artifactExperiments ?? []).filter(item => item.calculationId !== id), { calculationId: id, input: state }];
      }
      calculateArtifact(id);
      return;
    }
    const componentKey = field.dataset.sourceHostComponentField as keyof typeof contributorFields | undefined;
    const polestar = field.hasAttribute("data-source-host-polestar");
    if (!key && !componentKey && !polestar) return;
    if (field.value.trim() && field.checkValidity()) {
      if (polestar && current.request.kind === "stellar-direct") current.request.input.polestarApplicationCount = field.valueAsNumber;
      if (key) current.request.input[key] = field.valueAsNumber;
      if (componentKey) {
        const row = current.components.find(record => record.request.id === Number(field.dataset.sourceHostComponent));
        if (row?.request.kind === "lunar-contributor" || row?.request.kind === "stellar-contributor") row.request.input[componentKey] = field.valueAsNumber;
        else if (row?.request.kind === "transformative-base" || row?.request.kind === "additive-base") {
          if (componentKey === "characterLevel") row.request.input.characterLevel = field.valueAsNumber;
          else if (componentKey === "elementalMastery") row.request.input.elementalMastery = field.valueAsNumber;
          else if (componentKey === "reactionBonus") row.request.input.reactionBonus = field.valueAsNumber;
        }
      }
    }
    calculate();
  };
  root.onclick = event => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-source-host-reset]")) { current = createSourceHostEditableCalculation(current.originalCapture); renderSourceHostCalculator(root, current, onChange); }
    if (target.closest("[data-source-host-export]")) {
      try {
        if ([...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-source-host-artifact-state], [data-source-host-artifact-state-key]")].some(field => !field.value.trim() || !field.checkValidity())) throw new Error("请先填写有效的装备实验状态。");
        if ([...root.querySelectorAll<HTMLInputElement>("[data-source-host-artifact-additive-state]")].some(field => !field.value.trim() || !field.checkValidity())) throw new Error("请先填写有效的圣遗物公式快照值。");
        for (const experiment of current.artifactExperiments ?? []) deriveSourceHostArtifactScalarEdit(current.originalCapture, experiment.calculationId, experiment.input);
        for (const experiment of current.artifactAdditiveExperiments ?? []) deriveSourceHostArtifactAdditiveEdit(current.originalCapture, experiment.calculationId, experiment.input);
        validateWeaponExperiments();
        validateCharacterExperiments();
        calculateSourceHostEditableCalculation(current); downloadSourceHostJson(current, "source-host-calculation.json");
      }
      catch (error) { output.textContent = String(error); }
    }
  };
  calculate();
  for (const row of artifactSupport) calculateArtifact(row.request.id);
  for (const row of artifactAdditiveRecords) calculateArtifactAdditive(row.request.id);
}
