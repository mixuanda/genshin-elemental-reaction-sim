import { sourceActionReceipts } from "../../../packages/sim-core/src/source-host-action-origin";
export { sourceActionReceipts, type SourceActionReceipt } from "../../../packages/sim-core/src/source-host-action-origin";

const esc = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const frameLabel = (frame: number) => `${frame} 帧 · ${(frame / 60).toFixed(3)} 秒`;

export function renderSourceActionReceipts(logs: unknown, name: (key: string) => string, label: (action: string) => string): string {
  const receipts = sourceActionReceipts(logs);
  if (!receipts.length) return '<p data-source-action-receipts>此记录没有动作实例与输入窗口回执；下方仅展示已有事件，不按相邻帧猜测排队等待。</p>';
  return `<section data-source-action-receipts><h4>每一步实际何时轮到你</h4>
    <p>共 ${receipts.length} 个来源动作实例，含自动切人。排队、施放和下一输入窗口由同一实例编号关联；下方显示前 80 个。它们对应本次实际脚本，编辑草稿后需重新运行。</p>
    <ol class="source-action-receipts">${receipts.slice(0, 80).map(receipt => `<li data-source-action-sequence="${receipt.sequence}">
      <strong>${receipt.sequence}. ${esc(name(receipt.characterKey))} · ${esc(label(receipt.action))}${receipt.noOp ? "（无操作）" : ""}</strong>
      <dl><div><dt>进入动作队列</dt><dd>${frameLabel(receipt.queuedFrame)}</dd></div>
      <div><dt>实际施放</dt><dd>${receipt.acceptedFrame === undefined ? "未记录到施放" : frameLabel(receipt.acceptedFrame)}</dd></div>
      <div><dt>排队后经过</dt><dd>${receipt.acceptedFrame === undefined ? "尚未完成" : `${receipt.acceptedFrame - receipt.queuedFrame} 帧`}</dd></div>
      <div><dt>下一输入窗口</dt><dd>${receipt.inputWindowFrame === undefined ? "此记录未到达或未提供" : frameLabel(receipt.inputWindowFrame)}</dd></div></dl></li>`).join("")}</ol>
    <p class="source-team-builder__note">“排队后经过”包含实际就绪等待与显式动作前延迟；原因见事件账本。下一输入窗口表示可以读取下一条脚本指令，下一动作仍须通过自身检查。秒数按 60 帧参考时钟换算；不是游戏客户端帧率承诺。</p></section>`;
}
