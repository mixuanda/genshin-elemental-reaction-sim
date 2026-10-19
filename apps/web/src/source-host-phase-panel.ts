import { analyzeSourceHostPhase, type SourceHostPhaseObservation, type SourceHostPhaseObservationRequest } from "../../../packages/sim-core/src/source-host-phase-analysis";
import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const fmt = (value: number | null | undefined): string => value == null ? "未建立" : value.toLocaleString("zh-CN", { maximumFractionDigits: 4 });

type PhaseResult = SourceHostResult & {
  phaseObservation?: SourceHostPhaseObservationRequest;
  phaseObservations?: SourceHostPhaseObservation[];
};

/** Display phase evidence only when this run actually contains native observations. */
export function renderSourceHostPhasePanel(host: HTMLElement, result: SourceHostResult): void {
  const phaseResult = result as PhaseResult;
  const policy = phaseResult.phaseObservation;
  const observations = phaseResult.phaseObservations ?? [];
  if (!observations.length) {
    host.innerHTML = `<section class="card" data-source-host-phase>
      <h3>重复动作相位观察</h3>
      <p data-source-host-phase-status>本次来源运行没有相位观察记录。没有记录不代表已经建立周期或稳定 DPS。</p>
    </section>`;
    return;
  }
  if (!policy) {
    host.innerHTML = `<section class="card" data-source-host-phase>
      <h3>重复动作相位观察</h3>
      <p class="calculator-hint" data-source-host-phase-status>有 ${observations.length} 条观察，但旧结果没有保存对应分析政策；保留记录，不补做周期判定。</p>
      <details><summary>查看观察记录</summary><pre>${esc(JSON.stringify(observations, null, 2))}</pre></details>
    </section>`;
    return;
  }

  const analysis = analyzeSourceHostPhase(observations, policy);
  const established = analysis.status === "established-for-declared-native-state";
  const rows = observations.slice(0, 120).map(row => `<tr>
    <td>${row.frame}</td>
    <td>${esc(row.inputPhase.repeatId)} · 位置 ${row.inputPhase.position}</td>
    <td>${row.inputPhase.iteration}</td>
    <td>${row.inputPhase.verifiedRepeat ? "已确认重复" : "未确认"}</td>
    <td>${row.determinism === "deterministic" ? "确定性" : "随机"}</td>
    <td>${fmt(row.cumulativeDamage)}</td>
    <td>${row.damageSincePreviousBoundary === undefined ? "—" : fmt(row.damageSincePreviousBoundary)}</td>
    <td>${row.coverage.complete && !row.coverage.gaps.length ? "状态覆盖完整" : `未闭合：${esc(row.coverage.gaps.join("；") || "缺少完整提供者")}`}</td>
  </tr>`).join("");
  const stateDiffs = analysis.stateDifferences.length
    ? `<div class="table-wrap"><table><thead><tr><th>边界帧</th><th>状态差异路径</th></tr></thead><tbody>${analysis.stateDifferences.map(row => `<tr><td>${row.leftFrame} → ${row.rightFrame}</td><td>${row.paths.map(esc).join("、") || "状态不同"}</td></tr>`).join("")}</tbody></table></div>`
    : "";
  const intervalDiffs = analysis.intervalDifferences.length
    ? `<div class="table-wrap"><table><thead><tr><th>首个区间</th><th>后续区间</th></tr></thead><tbody>${analysis.intervalDifferences.map(row => `<tr><td>[${row.first.startFrame}, ${row.first.endFrame})：${row.first.frames} 帧，伤害 ${fmt(row.first.damage)}</td><td>[${row.later.startFrame}, ${row.later.endFrame})：${row.later.frames} 帧，伤害 ${fmt(row.later.damage)}</td></tr>`).join("")}</tbody></table></div>`
    : "";
  const covered = observations.filter(row => row.coverage.complete && row.coverage.gaps.length === 0).length;
  host.innerHTML = `<section class="card" data-source-host-phase>
    <h3>重复动作相位观察</h3>
    <p data-source-host-phase-status class="calculator-status ${established ? "provisional" : "blocked"}">${established ? "在声明的来源状态范围内建立了重复周期" : "尚未建立重复周期"} · 来源状态证据为 provisional</p>
    <p>分析政策：预热 ${policy.warmupFrames} 帧；周期上限 ${policy.maxPeriod}；要求连续 ${policy.requiredConsecutivePeriods} 个周期一致；最多观察 ${policy.maxObservations} 次。本次有 ${observations.length} 条观察，其中 ${covered} 条的状态提供者声明完整。</p>
    ${established ? `<p data-source-host-phase-period>周期 ${analysis.periodCycles} 次；每周期 ${analysis.periodFrames} 帧、伤害 ${fmt(analysis.periodDamage)}；条件 DPS ${fmt(analysis.steadyStateDps)}。</p><p>周期伤害 D 为该周期内实际命中应用伤害之和，T 为周期帧数，来源每秒执行 60 帧。DPS = D × 60 ÷ T = ${fmt(analysis.periodDamage)} × 60 ÷ ${analysis.periodFrames} = ${fmt(analysis.steadyStateDps)}。新回执逐段累加应用伤害，避免增长的累计总量相减造成浮点尾差。</p>` : ""}
    <p>结论只针对本次来源运行、已声明的原生状态和重复输入位置。周期成立要求完整原生状态（包括固定种子下 RNG 状态）重复；若随机流持续前进，就不会据此视为确定性周期。有限周期观察不是游戏验证，也不代表随机伤害分布；缺少或不透明的来源状态会阻止建立周期。</p>
    ${analysis.reasons.length ? `<ul data-source-host-phase-reasons>${analysis.reasons.map(reason => `<li>${esc(reason)}</li>`).join("")}</ul>` : ""}
    ${stateDiffs}${intervalDiffs}
    <details data-source-host-phase-observations><summary>实际相位观察（前 ${Math.min(120, observations.length)} / 共 ${observations.length} 条）</summary>
      <div class="table-wrap"><table><thead><tr><th>来源帧</th><th>动作位置</th><th>重复次数</th><th>位置确认</th><th>运行类型</th><th>累计伤害</th><th>上一边界至此的实际伤害</th><th>原生状态覆盖</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${observations.length > 120 ? `<p>表格仅显示前 120 条；完整观察保留在下方 JSON。</p>` : ""}
    </details>
    <details data-source-host-phase-json><summary>完整政策、观察和分析 JSON</summary><pre>${esc(JSON.stringify({ policy, observations, analysis }, null, 2))}</pre></details>
  </section>`;
}
