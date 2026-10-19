import {
  calculateSourceHostPlayerIncomingEditable, createSourceHostPlayerIncomingEditable,
  replaySourceHostPlayerIncoming, sourceHostPlayerIncomingEditableSchema,
  type SourceHostPlayerIncomingCapture, type SourceHostPlayerIncomingEditable,
} from "../../../packages/sim-core/src/source-host-incoming-capture";
import { renderTraceHtml } from "./calculator-trace-view";
import { downloadSourceHostJson } from "./source-host-calculator";

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fields = {
  scalingValue: "本次最终缩放属性", scaling: "攻击倍率（1 = 100%）", flatDamage: "附加基伤",
  damageBonus: "适用伤害加成", playerDefense: "玩家实际防御", defenseIgnore: "来源忽防比例",
  playerResistance: "玩家抗性", attackerLevel: "攻击方等级", critRate: "暴击率",
  critDamage: "暴击伤害", elementalMastery: "攻击方元素精通",
  amplifyingMultiplier: "已发生增幅的基础倍率", reactionBonus: "增幅反应加成",
  groupMultiplier: "伤害组倍率",
} as const;

export function renderSourceHostPlayerIncomingCalculator(root: HTMLElement, input: SourceHostPlayerIncomingCapture | SourceHostPlayerIncomingEditable): void {
  if (input.schemaVersion === "source-host-player-incoming-v1") {
    const replay = replaySourceHostPlayerIncoming(input);
    if (replay.calculation.request.kind === "player-manual-incoming") {
      const capture = replay.captured;
      const observed = capture.application;
      const sourceRows = capture.components.filter(row => row.request.kind === "character-drain" || row.request.kind === "player-manual-incoming");
      root.innerHTML = `<article class="card" data-source-host-manual-incoming><h2>来源手工自伤 · 只读受击回执</h2>
        <p>第 ${observed.frame} 帧 · ${esc(replay.calculation.request.actorKey)} · ${esc(replay.calculation.request.ability)}。执行器 SHA-256：<code>${esc(capture.executionArtifact?.wasmSha256 ?? "旧记录未保存产物身份")}</code></p>
        <p>手工入盾伤害 ${replay.originalRawDamage}；同输入共享公式重放 ${replay.reproducedRawDamage}；差值 ${replay.difference}。护盾吸收 ${observed.shieldAbsorbed}，护盾后 ${observed.damageAfterShield}，Drain 尝试扣除 ${observed.drainAttempted}。</p>
        <p>这条来源手工自伤没有普通受击的防御、抗性与暴击输入。下面保留真实来源、护盾和扣血步骤；若要编辑扣血金额，请从来源结果页打开对应的 Drain 应用。</p>
        <div class="editor-actions"><button type="button" data-source-host-manual-incoming-export>导出只读受击捕获 JSON</button></div>
        <details open><summary>本次来源与状态公式</summary>${renderTraceHtml(replay.calculation.trace)}${sourceRows.map(row => `<p>前置来源 #${row.request.id} · ${esc(row.request.kind)} · ${row.value}</p>`).join("")}${replay.stateCalculations.map(step => `<h3>${esc(step.request.kind)} #${step.request.id} = ${esc(step.value)}</h3>${renderTraceHtml(step.trace)}`).join("")}</details>
      </article>`;
      root.querySelector<HTMLButtonElement>("[data-source-host-manual-incoming-export]")!.onclick = () =>
        downloadSourceHostJson(capture, "source-host-manual-incoming-capture.json");
      return;
    }
  }
  let current = input.schemaVersion === "source-host-player-incoming-calculator-v1"
    ? sourceHostPlayerIncomingEditableSchema.parse(input) : createSourceHostPlayerIncomingEditable(input);
  const restored = replaySourceHostPlayerIncoming(current.originalCapture);
  const observed = current.originalCapture.application;
  root.innerHTML = `<article class="card"><h2>来源玩家受击 · 独立计算</h2><p>${esc(current.label)}</p>
    <p>来源宿主这次实际受击进入护盾前的伤害：<strong>${restored.originalRawDamage}</strong>；保存上下文重放：<strong>${restored.reproducedRawDamage}</strong>；差值 ${restored.difference}。</p>
    <p>第 ${observed.frame} 帧；实际受击角色索引 ${observed.activeActorIndex}；执行器 SHA-256：<code>${esc(current.originalCapture.executionArtifact?.wasmSha256 ?? "旧记录未保存产物身份")}</code>。</p>
    <p>原运行护盾吸收 <strong>${observed.shieldAbsorbed}</strong>，护盾后伤害 <strong>${observed.damageAfterShield}</strong>，Drain 返回的尝试扣血量 <strong>${observed.drainAttempted}</strong>。${restored.stateArithmeticProvenance === "shared" ? "下方保存每面盾和玩家生命比例的实际共享公式。" : "这份旧记录没有保存护盾与玩家生命的共享公式上下文；这些数值仅为历史回执，不能作为已复现的盾或扣血结论。"}编辑后的数值只重算护盾前伤害。</p>
    <p>原始暴击随机数：${esc(current.request.input.critRoll ?? "弱点必暴，未抽样")}；编辑暴击率时沿用同一抽样。反应触发资格和运行时状态保持原记录。</p>
    <div class="calculator-fields">${Object.entries(fields).map(([key, label]) => `<label>${label}<input type="number" step="any" required data-source-host-incoming-input="${key}" value="${current.request.input[key as keyof typeof fields]}"></label>`).join("")}</div>
    <div class="editor-actions"><button type="button" data-source-host-incoming-reset>恢复捕获值</button><button type="button" data-source-host-incoming-export>导出独立计算 JSON</button></div>
    <div data-source-host-incoming-result role="status"></div>
    <details><summary>原始受击、护盾与生命的完整公式步骤</summary>${renderTraceHtml(restored.calculation.trace)}${restored.stateCalculations.map(step => `<h3>${esc(step.request.kind)} #${step.request.id} = ${esc(step.value)}</h3>${renderTraceHtml(step.trace)}`).join("")}<pre>${esc(JSON.stringify(observed, null, 2))}</pre></details>
  </article>`;
  const output = root.querySelector<HTMLElement>("[data-source-host-incoming-result]")!;
  const calculate = (): void => {
    try {
      if ([...root.querySelectorAll<HTMLInputElement>("[data-source-host-incoming-input]")].some(field => !field.value.trim() || !field.checkValidity())) throw new Error("请填写有效数值；留空不能当作零。");
      const result = calculateSourceHostPlayerIncomingEditable(current);
      output.innerHTML = `<h3>${result.edited ? "编辑后" : "捕获时"}护盾前公式伤害：${result.value}</h3><p>相对原公式差值：${result.difference}。原运行的护盾吸收、Drain 返回量和队伍结果保持历史记录。</p><ul>${result.warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul>${renderTraceHtml(result.calculation.trace)}`;
    } catch (error) { output.textContent = error instanceof Error ? error.message : String(error); }
  };
  root.oninput = event => {
    const field = event.target as HTMLInputElement;
    const key = field.dataset.sourceHostIncomingInput as keyof typeof fields | undefined;
    if (!key) return;
    if (field.value.trim() && field.checkValidity()) current.request.input[key] = field.valueAsNumber;
    calculate();
  };
  root.onclick = event => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-source-host-incoming-reset]")) {
      current = createSourceHostPlayerIncomingEditable(current.originalCapture);
      renderSourceHostPlayerIncomingCalculator(root, current);
    }
    if (target.closest("[data-source-host-incoming-export]")) {
      try { calculateSourceHostPlayerIncomingEditable(current); downloadSourceHostJson(current, "source-host-player-incoming-calculation.json"); }
      catch (error) { output.textContent = error instanceof Error ? error.message : String(error); }
    }
  };
  calculate();
}
