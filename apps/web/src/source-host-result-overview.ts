import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';
import './source-host-result-overview.css';

type Row = Record<string, unknown>;
type ActorLabel = (actorKey: string) => string | undefined;
type ActorDamage = { actorKey?: string; damage: number; hits: number };
type Rejection = { actor: string; action: string; reason: string; attempts: number; firstFrame?: number; lastFrame?: number };

const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>\"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' })[char]!);
const asRecord = (value: unknown): Row | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : undefined;
const asNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const format = (value: number): string => value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
const actionLabels: Record<string, string> = { skill: 'E 技能', burst: 'Q 爆发', attack: 'A 普攻', charge: '重击', aim: '瞄准', dash: '冲刺', jump: '跳跃', low_plunge: '低空下落', high_plunge: '高空下落', swap: '切人' };
const reasonLabels: Record<string, string> = { insufficient_energy: '能量不足', cooldown: '冷却尚未就绪', skill_cd: 'E 冷却尚未就绪', burst_cd: 'Q 冷却尚未就绪', insufficient_stamina: '体力不足' };

function damageByActor(result: SourceHostResult): ActorDamage[] {
  const actorByCalculation = new Map<number, string>();
  for (const calculation of result.calculations) actorByCalculation.set(calculation.request.id, calculation.request.actorKey);
  const grouped = new Map<string, ActorDamage>();
  for (const application of result.applications) {
    const actorKey = actorByCalculation.get(application.calculationId);
    const key = actorKey ?? '';
    const row = grouped.get(key) ?? { ...(actorKey ? { actorKey } : {}), damage: 0, hits: 0 };
    row.damage += application.appliedDamage;
    row.hits++;
    grouped.set(key, row);
  }
  if (Array.isArray(result.logs)) for (const raw of result.logs) {
    const log = asRecord(raw);
    if (log?.event !== 'character') continue;
    const key = asRecord(asRecord(log.logs)?.char_base)?.key;
    if (typeof key === 'string' && !grouped.has(key)) grouped.set(key, { actorKey: key, damage: 0, hits: 0 });
  }
  return [...grouped.values()].sort((left, right) => right.damage - left.damage || (left.actorKey ?? '').localeCompare(right.actorKey ?? ''));
}

function actionRejections(result: SourceHostResult, actorLabel: ActorLabel): { hasActionLog: boolean; rows: Rejection[] } {
  const logs = Array.isArray(result.logs) ? result.logs.map(asRecord).filter((row): row is Row => row !== undefined) : [];
  const keyByIndex = new Map<number, string>();
  for (const row of logs) {
    if (row.event !== 'character' || typeof row.char_index !== 'number') continue;
    const key = asRecord(asRecord(row.logs)?.char_base)?.key;
    if (typeof key === 'string') keyByIndex.set(row.char_index, key);
  }
  const grouped = new Map<string, Rejection>();
  for (const row of logs) {
    if (row.event !== 'action' || row.msg !== 'source-host action rejected') continue;
    const details = asRecord(row.logs) ?? {};
    const actorKey = typeof row.char_index === 'number' ? keyByIndex.get(row.char_index) : undefined;
    const actor = actorKey ? actorLabel(actorKey) ?? actorKey : '角色归属未记录';
    const rawAction = typeof details.action === 'string' ? details.action : undefined;
    const action = rawAction ? actionLabels[rawAction] ?? rawAction : '动作未记录';
    const rawReason = typeof details.reason === 'string' ? details.reason : undefined;
    const reason = rawReason ? reasonLabels[rawReason] ?? rawReason : '来源未记录具体原因';
    const actorIdentity = actorKey ?? (typeof row.char_index === 'number' ? `index:${row.char_index}` : 'unknown');
    const key = JSON.stringify([actorIdentity, rawAction ?? '', rawReason ?? '']);
    const summary = grouped.get(key) ?? { actor, action, reason, attempts: 0 };
    summary.attempts++;
    const frame = asNumber(row.frame);
    if (frame !== undefined) {
      summary.firstFrame = summary.firstFrame === undefined ? frame : Math.min(summary.firstFrame, frame);
      summary.lastFrame = summary.lastFrame === undefined ? frame : Math.max(summary.lastFrame, frame);
    }
    grouped.set(key, summary);
  }
  const hasActionLog = logs.some(row => row.event === 'action' && (row.msg === 'source-host action queued' || row.msg === 'source-host action accepted'));
  return { hasActionLog, rows: [...grouped.values()].sort((left, right) => right.attempts - left.attempts || left.actor.localeCompare(right.actor)) };
}

/** First-view summary from actual source applications and action rejection records. */
export function renderSourceHostResultOverview(result: SourceHostResult, actorLabel: ActorLabel = () => undefined): string {
  const totalDamage = result.applications.reduce((sum, application) => sum + application.appliedDamage, 0);
  const native = asRecord(result.result);
  const endFrame = result.observationWindow?.actualEndFrame ?? asNumber(native?.duration);
  const seconds = endFrame === undefined ? undefined : endFrame / 60;
  const dps = seconds !== undefined && seconds > 0 ? totalDamage / seconds : undefined;
  const rows = damageByActor(result).map(row => {
    const label = row.actorKey ? actorLabel(row.actorKey) ?? row.actorKey : '角色归属未知（未关联到来源伤害记录）';
    const share = totalDamage > 0 ? format(row.damage / totalDamage * 100) + '%' : '—';
    return `<tr data-source-host-actor-damage${row.actorKey ? ` data-actor-key=\"${escapeHtml(row.actorKey)}\"` : ''}><th scope=\"row\">${escapeHtml(label)}</th><td>${format(row.damage)}</td><td>${share}</td><td>${row.hits}</td></tr>`;
  }).join('');
  const rejectionSummary = actionRejections(result, actorLabel);
  const rejectionRows = rejectionSummary.rows.map(row => `<li data-source-host-action-rejection><strong>${escapeHtml(row.actor)} · ${escapeHtml(row.action)}</strong>：${escapeHtml(row.reason)} · ${row.attempts} 次未就绪重试${row.firstFrame === undefined ? '' : `（模拟第 ${row.firstFrame}${row.lastFrame === row.firstFrame ? '' : `–${row.lastFrame}`} 帧）`}</li>`).join('');
  const rejectionBody = rejectionRows
    ? `<ul>${rejectionRows}</ul><p class=\"source-host-result-overview__note\">每条表示该帧未执行动作；自动等待模式可能在之后重试成功。</p>`
    : rejectionSummary.hasActionLog
      ? '<p data-source-host-action-rejection-state=\"none\">本次来源动作日志未记录未就绪重试。</p>'
      : '<p data-source-host-action-rejection-state=\"unknown\">此结果没有可读的动作拒绝日志，等待原因未知。</p>';
  const endReason = result.observationWindow?.endReason;
  const endReasonLabel = endReason === 'targets-dead' ? '目标全部死亡，本次模拟提前结束。'
    : endReason === 'actions-exhausted' ? '来源动作流已结束，本次模拟提前结束。'
      : endReason === 'duration' ? '本次模拟运行到设定时长。' : '时长来自来源实际运行回执。';
  const hitLabel = result.applications.length ? result.applications.length + ' 次已结算命中' : '本次没有已结算命中记录';
  return `<section class=\"source-host-result-overview\" data-source-host-result-overview aria-label=\"本次模拟结果概览\">
    <div class=\"source-host-result-overview__metrics\">
      <div><span>模拟时长</span><strong data-source-host-overview-duration>${seconds === undefined ? '未知（来源未记录时长）' : format(seconds) + ' 秒'}</strong></div>
      <div><span>来源总伤害</span><strong data-source-host-overview-total data-value=${totalDamage}>${format(totalDamage)}</strong></div>
      <div><span>本次 DPS</span><strong data-source-host-overview-dps>${dps === undefined ? '未知（没有有效时长）' : format(dps)}</strong></div>
      <div><span>已结算命中</span><strong>${hitLabel}</strong></div>
    </div>
    <p class=\"source-host-result-overview__note\">总伤害按来源实际结算命中求和；DPS = 总伤害 ÷ 本次实际模拟时长。${endReasonLabel}这不是稳态 DPS。</p>
    <section aria-label=\"各角色伤害贡献\"><h4>各角色伤害贡献</h4><p class=\"source-host-result-overview__note\">按每条实际伤害记录对应的来源角色归属；无法关联的记录单列为未知，合计仍包含在总伤害中。</p>
      ${rows ? `<div class=\"source-host-result-overview__table-wrap\"><table data-source-host-character-contributions><thead><tr><th>角色</th><th>伤害</th><th>占总伤害</th><th>命中</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p>本次没有已结算伤害记录。</p>'}
    </section>
    <section aria-label=\"动作等待原因\"><h4>动作未就绪重试原因</h4><p class=\"source-host-result-overview__note\">这里只列来源引擎实际记录的冷却、能量等原因。</p>${rejectionBody}</section>
  </section>`;
}