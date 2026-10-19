import type { StochasticDistribution, StochasticStartupCellId, StochasticStartupResult } from "../../../packages/sim-core/src/stochastic-startup";
import { renderActionStateLedger } from "./action-state-ledger";
import { renderSacrificialLedger } from "./sacrificial-ledger";
import { renderArtifactEventLedger } from "./artifact-event-ledger";
import { renderArtifactDamageLedger } from "./artifact-damage-panel";
import { renderArtifactBuffLedger } from "./artifact-buff-panel";
import { renderPlayerShieldLedger } from "./player-shield-panel";
import { renderWeaponProcLedger } from "./weapon-proc-ledger";

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
const cellNames: Record<StochasticStartupCellId, string> = { "zero-w": "零能量起步 · W", "zero-2w": "零能量起步 · 2W", "full-w": "满能量起步 · W", "full-2w": "满能量起步 · 2W" };

function interval(distribution: StochasticDistribution | null): string {
  const ci = distribution?.meanConfidenceInterval;
  return ci ? `[${num(ci.low)}, ${num(ci.high)}]` : "样本不足，未估计";
}

function distributionDetails(label: string, distribution: StochasticDistribution | null): string {
  if (!distribution) return `<p>${esc(label)}：没有适用样本。</p>`;
  const ci = distribution.meanConfidenceInterval;
  return `<details><summary>${esc(label)} · 均值 ${num(distribution.mean)} · n=${distribution.count}</summary><p>样本标准差 ${distribution.sampleStandardDeviation === null ? "未估计" : num(distribution.sampleStandardDeviation)}；单次观测分布 P05/P50/P95：${num(distribution.spreadPercentiles.p05)} / ${num(distribution.spreadPercentiles.p50)} / ${num(distribution.spreadPercentiles.p95)}。</p>${ci ? `<p>均值95%区间：均值 ± t × 样本标准差 / √样本数 = ${num(distribution.mean)} ± ${num(ci.criticalValue)} × ${num(distribution.sampleStandardDeviation!)} / √${distribution.count} = ${interval(distribution)}。自由度 ${ci.degreesOfFreedom}；这是均值区间，不是单次模拟的伤害范围。</p>` : "<p>样本不足，不能估计均值区间。</p>"}</details>`;
}

/** Displays only core-produced summaries and samples; arithmetic stays in the core. */
export function renderStochasticStartup(root: HTMLElement, result: StochasticStartupResult): void {
  const actorName = (id: string) => result.config.characters.find(actor => actor.id === id)?.name ?? id;
  const firstWindow = (id: StochasticStartupCellId) => result.runs.flatMap(run => run.windows).find(window => window.cellId === id)!;
  const weaponProcPolicy = result.randomness.weaponProcPolicy;
  const weaponProcRandomness = weaponProcPolicy ? `<p data-stochastic-weapon-proc-policy>武器随机追击：${esc(weaponProcPolicy.rngStream)}；算法 ${esc(weaponProcPolicy.rngAlgorithm)}；固定来源规则 ${esc(weaponProcPolicy.id)}。普通伤害实际回调按各武器的来源顺序处理门禁及抽样；触发结果、抽样值与序号、冷却及霜葬倍率取实际运行记录。独立随机流只保证本地复现，与 gcsim 相同种子不代表相同抽样序列；当前完整检查点不认证这条随机流的稳态。</p>` : "";
  root.innerHTML = `<section data-stochastic-result><h3>有限预热与起步敏感性诊断已完成</h3><p>${result.policy.sampleCount} 组种子，每组零能量与满能量各连续运行一次，共 ${result.runs.length} 次。W=${result.policy.warmupCycles} 周期（${num(result.policy.warmupTicks / 60)} 秒）；每个观察窗口 ${num(result.policy.observationTicks / 60)} 秒。所有状态连续进入窗口，能量不在边界重置。</p><p>这份诊断比较实际伤害、能量及行动拒绝；不证明完整状态分布已经收敛。区间包含零不能当作“没有起步差异”或“已建立随机稳态”。</p>
    <div class="table-wrap"><table><thead><tr><th>起步／预热</th><th>观察区间（帧）</th><th>平均伤害</th><th>平均DPS</th><th>DPS分布 P05/P50/P95</th><th>平均DPS的95%区间</th></tr></thead><tbody>${result.cells.map(cell => {
      const window = firstWindow(cell.id), dps = cell.metrics.dps;
      return `<tr data-stochastic-cell="${cell.id}"><td>${cellNames[cell.id]}</td><td>[${window.startTick}, ${window.endTick})</td><td>${num(cell.metrics.damage.mean)}</td><td>${num(dps.mean)}</td><td>${num(dps.spreadPercentiles.p05)} / ${num(dps.spreadPercentiles.p50)} / ${num(dps.spreadPercentiles.p95)}</td><td>${interval(dps)}</td></tr>`;
    }).join("")}</tbody></table></div>
    <h3>同种子的配对差值</h3><p>先逐种子相减，再对差值求均值和区间。W与2W窗口可以重叠，不当作独立样本；零／满能量起步可能改变行动和抽样次数，同一抽样序号不保证对应同一命中。</p><div class="table-wrap"><table><thead><tr><th>相减方向</th><th>平均伤害差</th><th>平均DPS差</th><th>平均DPS差的95%区间</th></tr></thead><tbody>${result.contrasts.map(contrast => `<tr data-stochastic-contrast="${contrast.id}"><td>${cellNames[contrast.minuend]} − ${cellNames[contrast.subtrahend]}</td><td>${num(contrast.metrics.damage.mean)}</td><td>${num(contrast.metrics.dps.mean)}</td><td>${interval(contrast.metrics.dps)}</td></tr>`).join("")}</tbody></table></div>
    <details><summary>各角色的实际能量与耗能请求</summary><p>均值按种子统计；失败数包括实际能量不足及其他合法性拒绝，并单列能量不足。没有正耗能请求时失败率为“不适用”，不是0%失败。</p><div class="table-wrap"><table><thead><tr><th>情景／角色</th><th>窗口前能量均值</th><th>窗口后能量均值</th><th>耗能请求均值</th><th>拒绝均值</th><th>能量不足均值</th><th>失败率均值／样本数</th></tr></thead><tbody>${result.cells.flatMap(cell => Object.entries(cell.metrics.actors).map(([id, actor]) => `<tr><td>${cellNames[cell.id]} · ${esc(actorName(id))}</td><td>${num(actor.startEnergy.mean)}</td><td>${num(actor.endEnergy.mean)}</td><td>${num(actor.energyCostAttempts.mean)}</td><td>${num(actor.energyCostFailures.mean)}</td><td>${num(actor.insufficientEnergyFailures.mean)}</td><td>${actor.energyCostFailureRate ? `${num(actor.energyCostFailureRate.mean * 100)}% / ${actor.energyCostFailureRate.count}` : "无耗能请求，不适用"}</td></tr>`)).join("")}</tbody></table></div></details>
    <details><summary>统计公式、分布与原始配对样本</summary><p>均值为Σx/n，样本标准差为√[Σ(x−均值)²/(n−1)]。区间采用有限样本的Student-t近似；小样本、偏斜和离散分布的限制见下方说明，不能作为精确游戏可靠性保证。百分位由排序样本线性插值。</p>${result.cells.map(cell => `<h4>${cellNames[cell.id]}</h4>${distributionDetails("伤害", cell.metrics.damage)}${distributionDetails("DPS", cell.metrics.dps)}${Object.entries(cell.metrics.actors).map(([id, actor]) => `<details><summary>${esc(actorName(id))} · 能量与请求分布</summary>${distributionDetails("观察开始前能量", actor.startEnergy)}${distributionDetails("观察结束前能量", actor.endEnergy)}${distributionDetails("耗能请求", actor.energyCostAttempts)}${distributionDetails("请求拒绝", actor.energyCostFailures)}${distributionDetails("能量不足", actor.insufficientEnergyFailures)}${distributionDetails("失败率（0–1）", actor.energyCostFailureRate)}</details>`).join("")}`).join("")}${result.contrasts.map(contrast => `<details><summary>${cellNames[contrast.minuend]} − ${cellNames[contrast.subtrahend]}</summary>${distributionDetails("DPS配对差", contrast.metrics.dps)}<pre>${esc(JSON.stringify(contrast.pairedSamples, null, 2))}</pre></details>`).join("")}</details>
    <details><summary>实际随机政策与诊断边界</summary><p>基础种子：${esc(result.randomness.baseSeed)}；暴击政策：${esc(result.randomness.criticalPolicy)}；普通命中回能：${result.randomness.normalHitEnergyPolicy ? esc(result.randomness.normalHitEnergyPolicy.rngStream) : "未启用"}；西风暴击产球：${result.randomness.favoniusPolicy ? esc(result.randomness.favoniusPolicy.rngStream) + "（无角色卡肉的来源参考时钟）" : "未启用"}；祭礼充能重置：${result.randomness.sacrificialPolicy ? esc(result.randomness.sacrificialPolicy.rngStream) + "（无角色卡肉的来源参考时钟）" : "未启用"}。</p>${weaponProcRandomness}<p data-stochastic-request-template>固定请求模板：${esc(result.randomness.requestTemplate.mode)}；参考种子：${result.randomness.requestTemplate.referenceSeed === null ? "结构模板，无随机参考种子" : esc(result.randomness.requestTemplate.referenceSeed)}；重复输入哈希：${esc(result.randomness.requestTemplate.repeatedConfigHash)}。${result.randomness.requestTemplate.mode === "runtime-cooldown-v1" ? "模板按一次参考运行的实际冷却生成；各样本沿用这份请求表，再执行自己的祭礼抽样与充能队列，不按样本结果改写请求。" : "沿用结构编译的请求模板。"}</p>${result.randomness.requestTemplate.requestedRuntimeOptions ? `<details><summary>模板参考运行选项</summary><pre>${esc(JSON.stringify(result.randomness.requestTemplate.requestedRuntimeOptions, null, 2))}</pre></details>` : ""}<ul>${result.limitations.map(reason => `<li>${esc(reason)}</li>`).join("")}</ul></details>
    <details><summary>首组种子、零能量起步的完整代表轨迹</summary><p>下列为一次真实运行的行动状态，未平均或拼接其他种子的事件。全部输入、每次运行身份、四窗口样本及本条完整结果均随“导出本次分析”保存。</p><div data-stochastic-representative-ledger></div><section data-stochastic-sacrificial-ledger></section><section data-stochastic-weapon-proc-ledger></section><section data-stochastic-artifact-event-ledger></section><section data-stochastic-artifact-damage-ledger></section><section data-stochastic-player-shield-ledger></section><section data-stochastic-artifact-buff-ledger></section></details>
  </section>`;
  renderActionStateLedger(root.querySelector<HTMLElement>("[data-stochastic-representative-ledger]")!, result.representativeResult);
  renderSacrificialLedger(root.querySelector<HTMLElement>("[data-stochastic-sacrificial-ledger]")!, result.representativeResult);
  renderWeaponProcLedger(root.querySelector<HTMLElement>("[data-stochastic-weapon-proc-ledger]")!, result.representativeResult);
  renderArtifactEventLedger(root.querySelector<HTMLElement>("[data-stochastic-artifact-event-ledger]")!, result.representativeResult);
  renderArtifactDamageLedger(root.querySelector<HTMLElement>("[data-stochastic-artifact-damage-ledger]")!, result.representativeResult);
  renderPlayerShieldLedger(root.querySelector<HTMLElement>("[data-stochastic-player-shield-ledger]")!, result.representativeResult);
  renderArtifactBuffLedger(root.querySelector<HTMLElement>("[data-stochastic-artifact-buff-ledger]")!, result.representativeResult);
}
