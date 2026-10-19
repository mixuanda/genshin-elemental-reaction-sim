import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";
import { captureSourceHostCooldown, replaySourceHostCooldown, type SourceHostCooldownCapture } from "../../../packages/sim-core/src/source-host-cooldown-capture";
import { captureSourceHostHealing, replaySourceHostHealing, type SourceHostHealingCapture } from "../../../packages/sim-core/src/source-host-healing-capture";
import { sourceHostHealingSourceRuleDescriptor } from "../../../packages/sim-core/src/source-host-healing-source-formula";
import { resolveSourceHostDrainSourceInput, sourceHostDrainSourceRuleDescriptor } from "../../../packages/sim-core/src/source-host-drain-source-formula";
import { captureSourceHostCharacterShield, replaySourceHostCharacterShield, type SourceHostCharacterShieldCapture } from "../../../packages/sim-core/src/source-host-character-shield-capture";
import { sourceHostCharacterShieldRuleDescriptor } from "../../../packages/sim-core/src/source-host-character-shield-formula";
import { renderTraceHtml } from "./calculator-trace-view";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface SourceHostHelperFormulaOpeners {
  openCooldown?: (capture: SourceHostCooldownCapture) => void;
  openHealing?: (capture: SourceHostHealingCapture) => void;
  openShield?: (capture: SourceHostCharacterShieldCapture) => void;
}

/** Display captured healing, cooldown, and shield arithmetic with standalone editors. */
export function renderSourceHostHelperFormulaPanel(root: HTMLElement, result: SourceHostResult, openers: SourceHostHelperFormulaOpeners = {}): void {
  const healingApplications = result.healingApplications ?? [];
  const visibleHealingApplications = healingApplications.slice(0, 120);
  const healingRows = visibleHealingApplications.map((application, index) => `<tr data-source-host-healing-row="${index}"><td>${index}</td><td>${application.frame}</td><td>${esc(application.actorKey)}</td><td>${esc(application.source)}</td><td>${application.finalAmount}</td><td>${application.receivedAmount}</td><td>${application.overheal}</td></tr>`).join("");
  const healingHtml = healingApplications.length ? `<section class="card" data-source-host-healing-ledger><h3>实际治疗与共享公式（显示 ${visibleHealingApplications.length} / ${healingApplications.length} 条）</h3><p>单次治疗账本包含已捕获的 HealInfo.Src／Bonus 来源公式、基础量、治疗加成、原始治疗、可用的 ReceiveHeal 抵扣和过量治疗；旧记录可能没有来源公式。固定来源的同次治疗与生命之契时序仍带 TODO；这里重放来源回执，不代表游戏规则已验证。HP/债务修改及角色覆写仍由固定来源执行器处理。</p>
    <label>选择实际治疗事件<input type="number" id="source-host-healing-index" min="0" max="${healingApplications.length - 1}" step="1" value="0"></label><button type="button" id="source-host-open-healing-calculator" ${openers.openHealing ? "" : "disabled"}>送到独立治疗计算器</button><div id="source-host-healing-hit" role="status"></div>
    <div class="table-wrap"><table><thead><tr><th>编号</th><th>帧</th><th>受疗角色</th><th>来源</th><th>原始治疗</th><th>收到</th><th>过量治疗</th></tr></thead><tbody>${healingRows}</tbody></table></div>
  </section>` : "";
  const cooldownRows = result.calculations.filter(row => row.request.kind === "character-cooldown");
  const visibleCooldownRows = cooldownRows.slice(0, 120);
  const cooldownHtml = cooldownRows.length ? `<section class="card" data-source-host-cooldown-ledger><h3>实际冷却公式操作（显示 ${visibleCooldownRows.length} / ${cooldownRows.length} 条）</h3><p>这里展示来源实际经过共享公式的冷却数值步骤。角色覆写、冷却队列和动作安排仍由固定来源执行器处理；独立编辑只重算所选单步数值，不改变原生策略。</p>
    <label>选择冷却操作<input type="number" id="source-host-cooldown-index" min="0" max="${cooldownRows.length - 1}" step="1" value="0"></label><button type="button" id="source-host-open-cooldown-calculator" ${openers.openCooldown ? "" : "disabled"}>送到独立冷却计算器</button><div id="source-host-cooldown-hit" role="status"></div>
    <div class="table-wrap"><table><thead><tr><th>编号</th><th>帧</th><th>角色</th><th>动作</th><th>操作</th><th>数值</th></tr></thead><tbody>${visibleCooldownRows.map((row, index) => row.request.kind !== "character-cooldown" ? "" : `<tr data-source-host-cooldown-row="${index}"><td>${index}</td><td>${row.request.frame}</td><td>${esc(row.request.actorKey)}</td><td>${esc(row.request.input.action)} (${row.request.input.actionType})</td><td>${esc(row.request.input.operation)}</td><td>${row.value}</td></tr>`).join("")}</tbody></table></div>
  </section>` : "";
  const shieldRows = result.calculations.filter(row => row.request.kind === "character-shield");
  const visibleShieldRows = shieldRows.slice(0, 120);
  const shieldHtml = shieldRows.length ? `<section class="card" data-source-host-character-shield-ledger><h3>实际角色护盾生成与刷新公式（显示 ${visibleShieldRows.length} / ${shieldRows.length} 条）</h3><p>记录包含最终护盾 HP 写入和其真实前置 DEF／比例计算；每条均来自原生计算点。下方可恢复当次共享算式与原始状态输入；护盾替换、到期、受击消耗和后续轮转仍按固定来源执行。来源规则与游戏规则的一致性尚未验证。</p>
    <label>选择护盾公式<input type="number" id="source-host-character-shield-index" min="0" max="${shieldRows.length - 1}" step="1" value="0"></label><button type="button" id="source-host-open-character-shield-calculator" ${openers.openShield ? "" : "disabled"}>送到独立护盾计算器</button><div id="source-host-character-shield-hit" role="status"></div>
    <div class="table-wrap"><table><thead><tr><th>编号</th><th>帧</th><th>来源角色</th><th>规则</th><th>计算值</th></tr></thead><tbody>${visibleShieldRows.map((row, index) => row.request.kind !== "character-shield" ? "" : `<tr data-source-host-character-shield-row="${index}"><td>${index}</td><td>${row.request.frame}</td><td>${esc(row.request.actorKey)}</td><td>${esc(sourceHostCharacterShieldRuleDescriptor(row.request.input.ruleId).title)}</td><td>${row.value} ${esc(sourceHostCharacterShieldRuleDescriptor(row.request.input.ruleId).resultUnit ?? "HP")}</td></tr>`).join("")}</tbody></table></div>
  </section>` : `<p class="calculator-hint" data-source-host-character-shield-gap>本次结果没有共享角色护盾生成／刷新公式记录；旧来源的护盾 HP 计算可能未捕获，不能据此断定没有护盾。</p>`;
  const drainSourceRows = result.calculations.filter(row => row.request.kind === "character-drain");
  const visibleDrainSources = drainSourceRows.slice(0, 120);
  const drainSourceHtml = drainSourceRows.length ? `<section class="card" data-source-host-drain-source-ledger><h3>本次扣血来源公式（显示 ${visibleDrainSources.length} / ${drainSourceRows.length} 条）</h3><p>这些数值在原生角色回调中成为 DrainInfo.Amount；其中零值事件只保留来源事件身份，不表示 HP 损失。实际 HP 比例写回和角色门槛见上方扣血应用账本。</p><label>选择来源公式<input type="number" id="source-host-drain-source-index" min="0" max="${drainSourceRows.length - 1}" step="1" value="0"></label><div id="source-host-drain-source-hit" role="status"></div><div class="table-wrap"><table><thead><tr><th>编号</th><th>帧</th><th>角色</th><th>来源规则</th><th>请求 HP</th></tr></thead><tbody>${visibleDrainSources.map((row, index) => row.request.kind !== "character-drain" ? "" : `<tr data-source-host-drain-source-row="${index}"><td>${index}</td><td>${row.request.frame}</td><td>${esc(row.request.actorKey)}</td><td>${esc(sourceHostDrainSourceRuleDescriptor(row.request.input.ruleId).title)}</td><td>${row.value}</td></tr>`).join("")}</tbody></table></div></section>` : "";
  root.innerHTML = healingHtml + cooldownHtml + shieldHtml + drainSourceHtml;
  if (healingApplications.length) {
    const index = root.querySelector<HTMLInputElement>("#source-host-healing-index")!;
    const detail = root.querySelector<HTMLElement>("#source-host-healing-hit")!;
    const selected = () => healingApplications[index.valueAsNumber];
    const showHealing = () => {
      try {
        const application = selected();
        if (!application) { detail.textContent = "当前没有该治疗事件。"; return; }
        const replay = replaySourceHostHealing(captureSourceHostHealing(result, application.id));
        const sources = replay.captured.sources ?? [];
        const sourceSummary = sources.length
          ? `<p>本次捕获 ${sources.length} 条真实 HealInfo 来源金额／加成公式：</p><ul>${sources.map(row => row.request.input.operation !== "source" ? "" : `<li>#${row.request.id} · ${esc(sourceHostHealingSourceRuleDescriptor(row.request.input.ruleId).title)}：${row.value} ${esc(sourceHostHealingSourceRuleDescriptor(row.request.input.ruleId).resultUnit)}</li>`).join("")}</ul>`
          : `<p>此记录没有来源金额公式；仍按原始基础量与加成回执重放，不能推断此前未捕获的 Src／Bonus 生产过程。</p>`;
        detail.innerHTML = `<h4>${esc(application.actorKey)} · ${esc(application.source)} · 第 ${application.frame} 帧</h4><p>原始治疗 ${replay.originalAmount}；重放 ${replay.reproducedAmount}；接收治疗 ${replay.originalReceived}；过量治疗 ${replay.originalOverheal}。</p>${sourceSummary}<p>治疗前后 HP/债务是来源状态回执；独立计算只核对共享数值链，不重新执行角色覆写或状态事件。</p>${renderTraceHtml(replay.trace)}`;
      } catch (error) { detail.textContent = error instanceof Error ? error.message : String(error); }
    };
    index.oninput = showHealing;
    root.querySelector<HTMLButtonElement>("#source-host-open-healing-calculator")!.onclick = () => {
      const application = selected();
      if (application && openers.openHealing) openers.openHealing(captureSourceHostHealing(result, application.id));
    };
    showHealing();
  }
  if (cooldownRows.length) {
    const index = root.querySelector<HTMLInputElement>("#source-host-cooldown-index")!;
    const detail = root.querySelector<HTMLElement>("#source-host-cooldown-hit")!;
    const selected = () => cooldownRows[index.valueAsNumber];
    const show = () => {
    try {
      const row = selected();
      if (!row || row.request.kind !== "character-cooldown") { detail.textContent = "当前没有该冷却公式记录。"; return; }
      const replay = replaySourceHostCooldown(captureSourceHostCooldown(result, row.request.id));
      detail.innerHTML = `<h4>${esc(row.request.actorKey)} · ${esc(row.request.ability)} · 第 ${row.request.frame} 帧</h4><p>来源公式值 ${replay.originalValue} 帧；共享公式重放 ${replay.reproducedValue} 帧；差值 ${replay.difference} 帧。</p><p>冷却队列和动作安排、角色覆写和版本分支保持来源历史状态。</p><ul>${replay.warnings.map(warning => `<li>${esc(warning)}</li>`).join("")}</ul>${renderTraceHtml(replay.trace)}`;
    } catch (error) { detail.textContent = error instanceof Error ? error.message : String(error); }
    };
    index.oninput = show;
    root.querySelector<HTMLButtonElement>("#source-host-open-cooldown-calculator")!.onclick = () => {
      const row = selected();
      if (row && row.request.kind === "character-cooldown" && openers.openCooldown) openers.openCooldown(captureSourceHostCooldown(result, row.request.id));
    };
    show();
  }
  if (shieldRows.length) {
    const index = root.querySelector<HTMLInputElement>("#source-host-character-shield-index")!;
    const detail = root.querySelector<HTMLElement>("#source-host-character-shield-hit")!;
    const selected = () => shieldRows[index.valueAsNumber];
    const show = () => {
      try {
        const row = selected();
        if (!row || row.request.kind !== "character-shield") { detail.textContent = "当前没有该护盾公式记录。"; return; }
        const replay = replaySourceHostCharacterShield(captureSourceHostCharacterShield(result, row.request.id));
        const descriptor = sourceHostCharacterShieldRuleDescriptor(row.request.input.ruleId);
        const unit = descriptor.resultUnit ?? "HP";
        detail.innerHTML = `<h4>${esc(descriptor.title)} · ${esc(row.request.actorKey)} · 第 ${row.request.frame} 帧</h4><p>来源${unit === "HP" ? "写入" : "前置计算"} ${replay.originalValue} ${esc(unit)}；共享公式重放 ${replay.reproducedValue} ${esc(unit)}。来源持有者索引 ${row.request.input.sourceHolderIndex}；本次计算编号 ${row.request.id}。</p><p>独立编辑仅重算这一算式，不重放护盾创建、刷新、消耗、到期或后续命中。</p><ul>${replay.warnings.map(warning => `<li>${esc(warning)}</li>`).join("")}</ul>${renderTraceHtml(replay.trace)}`;
      } catch (error) { detail.textContent = error instanceof Error ? error.message : String(error); }
    };
    index.oninput = show;
    root.querySelector<HTMLButtonElement>("#source-host-open-character-shield-calculator")!.onclick = () => {
      const row = selected();
      if (row && row.request.kind === "character-shield" && openers.openShield) openers.openShield(captureSourceHostCharacterShield(result, row.request.id));
    };
    show();
  }
  if (drainSourceRows.length) {
    const index = root.querySelector<HTMLInputElement>("#source-host-drain-source-index")!;
    const detail = root.querySelector<HTMLElement>("#source-host-drain-source-hit")!;
    const show = () => {
      try {
        const row = drainSourceRows[index.valueAsNumber];
        if (!row || row.request.kind !== "character-drain") { detail.textContent = "当前没有该扣血来源公式。"; return; }
        const descriptor = sourceHostDrainSourceRuleDescriptor(row.request.input.ruleId);
        const calculated = resolveSourceHostDrainSourceInput(row.request.input, result.sourceCommit);
        detail.innerHTML = `<h4>${esc(descriptor.title)} · ${esc(row.request.actorKey)} · 第 ${row.request.frame} 帧</h4><p>来源金额 ${row.value} HP；同输入公式值 ${calculated.value} HP；来源持有者索引 ${row.request.input.sourceHolderIndex}。实际生命状态由原生 Drain 调用更新。</p>${renderTraceHtml(calculated.trace)}`;
      } catch (error) { detail.textContent = error instanceof Error ? error.message : String(error); }
    };
    index.oninput = show;
    show();
  }
}
