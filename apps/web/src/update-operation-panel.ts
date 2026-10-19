import { dataDiscoveryReviewSchema, type DataDiscoveryReview, type UpdateStatus } from "@genshin-dps-lab/game-data";

const esc = (value: unknown): string => String(value ?? "未记录").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const statuses: Record<string, string> = {
  success: "成功取得来源字节", partial: "部分来源失败", failed: "失败", "no-sources": "没有配置来源", unknown: "未记录结果",
  ready: "候选结构校验通过，待审核", blocked: "候选处理受阻", "schema-valid-candidate": "候选结构校验通过",
  "normalization-blocked": "标准化受阻", "not-started": "尚未开始", compared: "已与活动目录比较",
  "unavailable-no-active-snapshot": "没有活动目录可供比较",
};
const label = (value: string): string => esc(statuses[value] ?? value);

type OperationReview = Pick<DataDiscoveryReview, "sourceDiscovery" | "candidateReview" | "failureHistory">;
function renderReview(review: OperationReview): string {
  const discovery = review.sourceDiscovery, candidate = review.candidateReview;
  const failures = review.failureHistory;
  return `<section><h4>来源发现</h4>${discovery ? `<p>${label(discovery.status)} · 尝试于 ${esc(discovery.attemptedAt)} · 失败 ${discovery.failureCount} 项</p>
    <ul>${discovery.results.map(row => `<li><code>${esc(row.url)}</code> · HTTP ${esc(row.httpStatus)} · ${esc(row.retrievedAt)}${row.error ? `<p role="alert">${esc(row.error)}</p>` : ""}${row.contentSha256 ? `<details><summary>已归档来源指纹</summary><code>${esc(row.contentSha256)}</code> · ${esc(row.bytes)} 字节</details>` : ""}</li>`).join("")}</ul>` : "<p>本清单没有来源发现回执。</p>"}</section>
    <section><h4>隔离候选处理</h4>${candidate ? `<p>${label(candidate.status)} · ${esc(candidate.attemptedAt)} → ${esc(candidate.completedAt)} · 阶段 ${esc(candidate.stage)}</p>
      ${candidate.error ? `<p role="alert">${esc(candidate.error)}</p>` : ""}
      <p>候选 <code>${esc(candidate.candidateId)}</code><br>来源提交 <code>${esc(candidate.sourceCommit)}</code><br>内容 SHA-256 <code>${esc(candidate.sourceProjectionSha256)}</code></p>
      <p>标准化：${label(candidate.normalization.status)}${candidate.normalization.error && candidate.normalization.error !== candidate.error ? ` · ${esc(candidate.normalization.error)}` : ""}；比较：${candidate.comparison ? label(candidate.comparison.status) : "尚无结果"}。</p>
      ${candidate.comparison?.counts ? `<details><summary>候选差异计数（按原回执分类）</summary><pre>${esc(JSON.stringify(candidate.comparison.counts, null, 2))}</pre></details>` : ""}
      <p>审核文件：<code>${esc(candidate.candidateManifestPath ?? candidate.partialCapturePath)}</code>。路径属于生成回执的环境。</p>` : "<p>本清单没有候选处理回执。</p>"}</section>
    <section><h4>失败历史</h4><p>账本共 ${failures.count} 条；下方展示回执保留的最近 ${failures.recent.length} 条，后续成功不会删除旧失败。</p>
      ${failures.recent.length ? `<ul>${failures.recent.map(row => `<li>${esc(row.at)} · ${esc(row.stage)}${row.url ? ` · <code>${esc(row.url)}</code>` : ""}<p>${esc(row.error)}</p></li>`).join("")}</ul>` : "<p>此账本尚无失败记录；不据此推断远端运行成功。</p>"}</section>`;
}

export function renderUpdateOperationPanel(root: HTMLElement, status: UpdateStatus): void {
  const sourceErrors = (status.supplementalSources ?? []).filter(source => source.errors.length > 0);
  root.innerHTML = `<h2>更新运行与候选审核</h2><p>下方是此构建携带的本地回执。远端定时任务的实际运行结果，需要从该次任务产物导入；此页不会自动读取远端任务状态。</p>
    ${status.lastSyncError ? `<p role="alert">最近同步错误：${esc(status.lastSyncError)}</p>` : ""}
    ${sourceErrors.length ? `<section><h3>来源校验错误</h3>${sourceErrors.map(source => `<h4>${esc(source.id)}</h4><ul>${source.errors.map(error => `<li>${esc(error)}</li>`).join("")}</ul>`).join("")}</section>` : ""}
    <details data-local-update-review><summary>查看随构建保存的本地运行回执</summary>${renderReview({ sourceDiscovery: status.sourceDiscovery ?? null, candidateReview: status.candidateReview ?? null, failureHistory: status.failureHistory ?? { count: 0, recent: [] } })}</details>
    <label>导入更新任务的 review-receipt.json<input type="file" accept="application/json,.json" data-update-review-import></label>
    <p data-update-review-status role="status" aria-live="polite">导入仅用于阅读回执，不更改活动目录或预览选择。</p>
    <div data-imported-update-review></div>
    <details><summary>如何审阅并晋升候选</summary><ol>
      <li>检查本次来源与候选错误，核对来源提交、字节指纹及归档内容。失败或缺失的字段需先解决。</li>
      <li>审阅候选与活动目录的差异，确认版本身份、字段依据、缺失机制及对应的必要验证。结构校验通过不代表数值或机制已验证。</li>
      <li>通过项目的数据晋升流程，按所需就绪范围人工审核。预览与正式数据分别维护；保留原快照及回滚记录。</li>
    </ol><p>完整操作命令见项目的 docs/update-status.md；本页面不自动晋升候选。</p></details>`;
  const input = root.querySelector<HTMLInputElement>("[data-update-review-import]")!;
  const message = root.querySelector<HTMLElement>("[data-update-review-status]")!;
  const imported = root.querySelector<HTMLElement>("[data-imported-update-review]")!;
  let selection = 0;
  input.addEventListener("change", async () => {
    const request = ++selection, file = input.files?.[0];
    imported.replaceChildren();
    if (!file) { message.textContent = "尚未选择回执文件。"; return; }
    message.textContent = "正在读取更新任务回执…";
    try {
      const review = dataDiscoveryReviewSchema.parse(JSON.parse(await file.text()));
      if (request !== selection) return;
      message.textContent = `已导入 ${file.name}；回执生成于 ${review.generatedAt}。内容来自此文件，不是实时任务状态。`;
      imported.innerHTML = `<h3>已导入的任务回执</h3>${renderReview(review)}<p>该任务没有自动更新项目状态；当前计算数据保持不变。</p>`;
    } catch (error) {
      if (request === selection) message.textContent = `回执无法读取：${error instanceof Error ? error.message : String(error)}`;
    }
  });
}
