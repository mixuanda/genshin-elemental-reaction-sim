import { summarizeSourceHostTargets } from "../../../packages/sim-core/src/source-host-target-summary";
import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";
import { renderTraceHtml } from "./calculator-trace-view";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>\"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" })[c]!);
const amount = (value: number): string => Number.isFinite(value) ? value.toLocaleString("zh-CN", { maximumFractionDigits: 6 }) : "未知";

export interface SourceHostTargetSummaryPanelOptions {
  showRates?: boolean;
  applicationIds?: number[];
}

/** Show exact per-target application totals and their shared formula trace. */
export function renderSourceHostTargetSummaryPanel(
  root: HTMLElement,
  result: SourceHostResult,
  options: SourceHostTargetSummaryPanelOptions = {},
): void {
  const summary = summarizeSourceHostTargets(result, {
    ...(options.applicationIds === undefined ? {} : { applicationIds: options.applicationIds }),
    showRates: options.showRates === true && options.applicationIds === undefined,
  });
  const scoped = summary.scope === "selected-applications";
  const showRates = options.showRates === true && !scoped;
  const seconds = summary.actualDurationSeconds;
  const durationLabel = seconds === undefined ? "无原生时间分母" : `${amount(seconds)} 秒（按实际观察时间）`;
  const visibleTrace = (trace: Parameters<typeof renderTraceHtml>[0]) => !showRates
    ? trace.filter(node => node.id !== "observation.actual-duration-seconds"
      && !node.id.endsWith(".rawDamageRate") && !node.id.endsWith(".appliedDamageRate"))
    : trace;
  const scene = result.targetScene;
  const primary = summary.targets.find(target => target.isPrimary === true);
  const hasPrimaryReceipt = summary.primaryTargetIndex !== undefined && summary.primaryTargetKey !== undefined;
  const fixedWindow = summary.fullConfiguredWindow === true;
  const primaryBlock = hasPrimaryReceipt && primary
    ? `<section data-target-primary><h4>统计主目标 · 目标 ${esc(summary.primaryTargetIndex! + 1)}（声明下标 ${esc(summary.primaryTargetIndex)}）· 原生 key ${esc(summary.primaryTargetKey)}</h4>
        <p>原始公式伤害 ${amount(primary.rawDamage)}；来源记账伤害 ${amount(primary.appliedDamage)}；目标 HP 损失 ${amount(primary.hpLoss)}；已结算命中 ${primary.hitCount}。</p>
        ${showRates ? `<p>${fixedWindow ? "统计主目标固定窗DPS" : "统计主目标实际运行伤害率"}：${primary.appliedDamageRate === undefined ? "无可用时间分母" : `${amount(primary.appliedDamageRate)} / 秒`}；统计主目标原始公式伤害率 ${primary.rawDamageRate === undefined ? "无可用时间分母" : `${amount(primary.rawDamageRate)} / 秒`}。</p>` : ""}
        ${primary.isInitialDefault === undefined ? "" : `<p>初始默认锁定：${primary.isInitialDefault ? "是" : "否"}。此标记与统计主目标分别来自原生目标场景回执。</p>`}
      </section>`
    : `<section data-target-primary><h4>统计主目标</h4><p>未知：此结果没有可映射的原生统计主目标回执；不按目标键或命中顺序推断。</p></section>`;

  const ratesHeader = showRates ? `<th>原始公式伤害率</th><th>${fixedWindow ? "来源记账固定窗DPS" : "来源记账实际运行伤害率"}</th>` : "";
  const rateCells = (row: (typeof summary.targets)[number]): string => showRates
    ? `<td>${row.rawDamageRate === undefined ? "无可用时间分母" : `${amount(row.rawDamageRate)} / 秒`}</td><td>${row.appliedDamageRate === undefined ? "无可用时间分母" : `${amount(row.appliedDamageRate)} / 秒`}</td>`
    : "";
  const targetRows = summary.targets.map(target => {
    const primaryLabel = target.isPrimary === true ? "是 · 统计主目标"
      : target.isPrimary === false ? "否" : "未知（旧结果没有目标场景回执）";
    const defaultLabel = target.isInitialDefault === true ? "是 · 原生初始默认目标"
      : target.isInitialDefault === false ? "否" : "未知（旧结果没有目标场景回执）";
    const receipt = target.declarationIndex === undefined
      ? `<p>旧结果只按实际记录的目标键汇总；没有目标声明、几何或初始生命回执。未命中目标数未知。</p>`
      : `<p>原生声明序号 ${esc(target.declarationIndex)}；初始位置、半径、目标配置及初始生命如下。字段按原始回执展示，不从名称推断未记录的机制。</p>
         <pre>${esc(JSON.stringify({ position: target.position, profile: target.profile, initialHP: target.initialHP, initialMaxHP: target.initialMaxHP }, null, 2))}</pre>`;
    const targetTraceNodes = visibleTrace(target.trace);
    const targetTrace = targetTraceNodes.length
      ? `<details data-target-formula-trace><summary>展开此目标的实际命中公式（${targetTraceNodes.length} 个节点）</summary>${renderTraceHtml(targetTraceNodes)}</details>`
      : "";
    return `<tr data-target-summary-row="${esc(target.targetKey)}">
      <td>${target.declarationIndex === undefined ? "未知（旧回执）" : `目标 ${esc(target.declarationIndex + 1)}（声明下标 ${esc(target.declarationIndex)}）`}</td><td>${esc(target.targetKey)}</td><td>${esc(primaryLabel)}</td><td>${esc(defaultLabel)}</td>
      <td>${amount(target.rawDamage)}</td><td>${amount(target.appliedDamage)}</td><td>${amount(target.hpLoss)}</td><td>${target.hitCount}</td>${rateCells(target)}
      <td><details><summary>原生目标回执</summary>${receipt}${targetTrace}<p>实际应用编号：${target.applicationIds.length ? target.applicationIds.map(id => `#${esc(id)}`).join("、") : "无"}</p></details></td>
    </tr>`;
  }).join("");
  const unmappedRow = summary.unmapped.hitCount
    ? `<tr data-target-summary-unmapped><td>未知（无声明目标）</td><td>未映射目标键</td><td>未知</td><td>未知</td><td>${amount(summary.unmapped.rawDamage)}</td><td>${amount(summary.unmapped.appliedDamage)}</td><td>${amount(summary.unmapped.hpLoss)}</td><td>${summary.unmapped.hitCount}</td>${showRates ? `<td>—</td><td>—</td>` : ""}<td><details><summary>未映射应用</summary><p>保留实际目标键映射失败的应用，不猜测它属于哪个声明目标。</p><p>应用编号：${summary.unmapped.applicationIds.map(id => `#${esc(id)}`).join("、")}</p></details></td></tr>`
    : "";
  const total = summary.total;
  const totalRates = showRates
    ? `<p>实际观察时长 ${esc(durationLabel)}；全目标原始公式伤害率 ${total.rawDamageRate === undefined ? "无可用时间分母" : `${amount(total.rawDamageRate)} / 秒`}；${fixedWindow ? "全目标固定窗DPS" : "全目标实际运行伤害率"} ${total.appliedDamageRate === undefined ? "无可用时间分母" : `${amount(total.appliedDamageRate)} / 秒`}。${summary.fullConfiguredWindow === false ? "本次未覆盖完整配置时间窗，速率仅对应本次实际观察区间。" : ""}</p>`
    : "";
  const scopeNote = scoped
    ? `<p data-target-summary-scope>仅统计当前关联的 ${summary.applicationIds.length} 个实际应用编号：${summary.applicationIds.length ? summary.applicationIds.map(id => `#${esc(id)}`).join("、") : "无"}。此关联范围不显示 DPS 或伤害率。</p>`
    : `<p data-target-summary-scope>汇总${fixedWindow ? `完整观察窗 [0,${summary.observationWindow!.configuredEndFrame}) 内的` : "全部"} ${summary.applicationIds.length} 条实际应用；原始公式伤害、来源记账伤害与目标 HP 损失分别列示，不混为同一个总量。</p>`;
  const excludedIds = new Set(summary.excludedApplicationIds);
  const includedIds = new Set(summary.applicationIds);
  const rawAppliedDamage = result.applications.filter(application => includedIds.has(application.id) || excludedIds.has(application.id)).reduce((sum, application) => sum + application.appliedDamage, 0);
  const nativeWindowNote = summary.excludedApplicationIds.length
    ? `<details data-target-summary-native-window><summary>原始窗外记录（${summary.excludedApplicationIds.length} 条）</summary><p>上述统计与曲线均使用 [0,${summary.observationWindow!.configuredEndFrame})。原始应用合计 ${amount(rawAppliedDamage)}；其中窗外伤害 ${amount(summary.excludedAppliedDamage)}，应用编号 ${summary.excludedApplicationIds.map(id => `#${esc(id)}`).join("、")}。完整导出保留这些原始记录。</p></details>`
    : "";
  const sceneNote = scene
    ? `<p>目标场景回执记录 ${scene.targets.length} 个声明目标；统计主目标为目标 ${summary.primaryTargetIndex === undefined ? "未知" : summary.primaryTargetIndex + 1}（声明下标 ${esc(summary.primaryTargetIndex ?? "未知")}），按原生回执映射到 key ${esc(summary.primaryTargetKey ?? "未知")}。初始默认目标 key ${esc(summary.initialDefaultTargetKey ?? "未记录")} 单独标记。</p>`
    : `<p>此旧结果没有目标场景回执。仅显示实际应用所含的目标键；不补造未命中目标数、初始目标或几何信息。</p>`;

  root.innerHTML = `<section class="card" data-source-host-target-summary>
    <h3>多目标伤害汇总</h3>
    ${scopeNote}${sceneNote}${nativeWindowNote}
    <section data-target-total><h4>${scoped ? "当前关联范围合计" : "全应用合计"}</h4>
      <p>原始公式伤害 ${amount(total.rawDamage)}；来源记账伤害 ${amount(total.appliedDamage)}；目标 HP 损失 ${amount(total.hpLoss)}；已结算命中 ${total.hitCount}。</p>${totalRates}
    </section>
    ${primaryBlock}
    <div class="table-wrap"><table><thead><tr><th>目标编号</th><th>原生 key</th><th>统计主目标</th><th>原生初始默认目标</th><th>原始公式伤害</th><th>来源记账伤害</th><th>目标 HP 损失</th><th>命中数</th>${ratesHeader}<th>目标回执与公式</th></tr></thead>
      <tbody>${targetRows}${unmappedRow || `<tr><td colspan="${showRates ? 11 : 9}">没有无法映射的目标应用。</td></tr>`}</tbody></table></div>
    ${visibleTrace(summary.trace).length ? `<details data-target-summary-formula-trace><summary>展开本范围的汇总公式（${visibleTrace(summary.trace).length} 个节点）</summary>${renderTraceHtml(visibleTrace(summary.trace))}</details>` : "<p>此范围没有可展示的共享公式轨迹。</p>"}
  </section>`;
}
