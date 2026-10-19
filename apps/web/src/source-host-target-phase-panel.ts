import { summarizeSourceHostTargets } from "../../../packages/sim-core/src/source-host-target-summary";
import type { SourceHostApplication, SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>\"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" })[c]!);
const number = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
type TargetPhaseRow = NonNullable<SourceHostResult["targetPhases"]>["phases"][number];
const phaseLabel = (phase: TargetPhaseRow): string =>
  `目标 ${phase.targetIndex + 1}（声明下标 ${phase.targetIndex}，原生 key ${phase.targetKey}）· ${phase.label}`;

export interface SourceHostTargetPhasePanelOptions {
  applicationIds?: readonly number[];
}

function sameDeclaredPhase(
  application: SourceHostApplication,
  receipt: NonNullable<SourceHostResult["targetPhases"]>,
  phase: TargetPhaseRow,
): boolean {
  const match = application.targetPhase;
  return match !== undefined && match.policy === receipt.policy && match.id === phase.id
    && match.label === phase.label && match.targetIndex === phase.targetIndex && match.targetKey === phase.targetKey
    && match.startFrame === phase.startFrame && match.endFrame === phase.endFrame && match.reason === phase.reason
    && match.effects.damage === phase.effects.damage && match.effects.aura === phase.effects.aura
    && match.effects.hitConfirm === phase.effects.hitConfirm
    && application.targetKey === phase.targetKey && application.frame === match.frame
    && phase.startFrame <= match.frame && match.frame < phase.endFrame;
}

/** Show the user's declared target-phase inputs alongside only matching native applications. */
export function renderSourceHostTargetPhasePanel(
  root: HTMLElement,
  result: SourceHostResult,
  options: SourceHostTargetPhasePanelOptions = {},
): void {
  const allowedIds = options.applicationIds === undefined ? undefined : new Set(options.applicationIds);
  const allApplications = result.applications.filter(application => allowedIds === undefined || allowedIds.has(application.id));
  const receipt = result.targetPhases;
  const phaseApplications = receipt ? receipt.phases.map(phase => ({
    phase,
    applications: allApplications.filter(application => sameDeclaredPhase(application, receipt, phase)),
  })) : [];
  const matchedIds = new Set(phaseApplications.flatMap(row => row.applications.map(application => application.id)));
  const unphasedApplications = allApplications.filter(application => !matchedIds.has(application.id));
  const displayLogs: Array<{ phase: TargetPhaseRow | undefined; application: SourceHostApplication }> = [
    ...phaseApplications.flatMap(row => row.applications.map(application => ({ phase: row.phase, application }))),
    ...unphasedApplications.map(application => ({ phase: undefined, application })),
  ].sort((a, b) => a.application.frame - b.application.frame || a.application.id - b.application.id);
  const visibleLogs = displayLogs.slice(0, 100);
  const associatedIds = options.applicationIds;
  const scopeSummary = summarizeSourceHostTargets(result, {
    ...(associatedIds === undefined ? {} : { applicationIds: associatedIds }),
    showRates: false,
  });

  const policyText = (phase: TargetPhaseRow): string => {
    const damage = phase.effects.damage === "immune"
      ? "伤害：免伤（不等同 Miss；原始公式伤害仍可能大于 0）"
      : "伤害：正常";
    const aura = phase.effects.aura === "blocked"
      ? "附着：阻止；本次不消耗配置的附着 ICD，已有附着仍按正常规则衰减"
      : "附着：正常";
    const hitConfirm = phase.effects.hitConfirm === "blocked"
      ? "命中确认：禁止本次命中触发的玩法效果；保留伤害统计与接触停帧，其他事件仍按各自规则执行"
      : "命中确认：正常";
    return `${damage}；${aura}；${hitConfirm}`;
  };

  const phasesHtml = phaseApplications.map(({ phase, applications }) => {
    const summary = summarizeSourceHostTargets(result, {
      applicationIds: applications.map(application => application.id),
      showRates: false,
    });
    const idsAndFrames = applications.length
      ? applications.slice(0, 100).map(application => `#${application.id}（${number(application.frame)} 帧）`).join("、")
      : "无实际应用记录";
    const clipped = applications.length > 100
      ? `<p>适用应用编号与帧仅展示前 100 条；此已配置窗口没有命中时显示“无实际应用记录”，与未配置阶段不同。完整记录保留在 JSON。</p>` : "";
    return `<section data-target-phase-row="${esc(phase.id)}">
      <h4>${esc(phaseLabel(phase))}</h4>
      <p>用户声明半开帧窗 [${phase.startFrame}, ${phase.endFrame})；条件：${esc(phase.reason)}。</p>
      <p>${esc(policyText(phase))}。</p>
      <p>实际命中应用（${applications.length}）：${idsAndFrames}。</p>${clipped}
      <p>该窗口实际应用汇总：原始公式伤害 ${number(summary.total.rawDamage)}；来源记账伤害 ${number(summary.total.appliedDamage)}；目标 HP 损失 ${number(summary.total.hpLoss)}；已结算命中 ${summary.total.hitCount}。</p>
    </section>`;
  }).join("");

  const logRows = visibleLogs.map(({ phase, application }) => `<tr data-target-phase-application="${application.id}">
    <td>${phase ? esc(phaseLabel(phase)) : "未匹配到已声明阶段"}</td>
    <td>#${application.id}</td><td>${number(application.frame)}</td><td>${application.targetKey}</td>
    <td>${number(application.rawDamage)}</td><td>${number(application.appliedDamage)}</td>
    <td>${number(application.hpBefore - application.hpAfter)}</td>
    <td>${application.applicationCalculationId === undefined ? "未记录" : `#${application.applicationCalculationId}`}</td>
  </tr>`).join("");
  const targetScene = result.targetScene;
  const unconfigured = receipt
    ? targetScene?.targets.filter(target => !receipt.phases.some(phase => phase.targetKey === target.targetKey)) ?? []
    : [];
  const undeclaredIntervals = targetScene?.targets.flatMap(target => {
    const rows = (receipt?.phases ?? []).filter(phase => phase.targetKey === target.targetKey)
      .sort((a, b) => a.startFrame - b.startFrame);
    return rows.slice(1).flatMap((phase, index) => {
      const previous = rows[index]!;
      return previous.endFrame < phase.startFrame
        ? [{ target, startFrame: previous.endFrame, endFrame: phase.startFrame }]
        : [];
    });
  }) ?? [];
  const unconfiguredNote = unconfigured.length
    ? `<p data-target-phase-unconfigured>未配置阶段的目标：${unconfigured.map(target => `目标 ${target.declarationIndex + 1}（声明下标 ${target.declarationIndex}，key ${target.targetKey}）`).map(esc).join("、")}。这表示没有用户声明的阶段窗口，不表示目标在这些时段没有命中。</p>`
    : "";
  const undeclaredIntervalNote = undeclaredIntervals.length
    ? `<p data-target-phase-unconfigured>同一目标相邻声明窗之间未配置阶段：${undeclaredIntervals.map(row => `目标 ${row.target.declarationIndex + 1} [${row.startFrame}, ${row.endFrame})`).map(esc).join("；")}。这表示未声明窗口，不代表该区间内没有实际命中。</p>`
    : "";
  const noReceipt = !receipt
    ? `<p data-target-phase-unconfigured>本结果没有保存目标阶段声明；这是“未配置阶段”。它与某个已配置窗口内没有实际应用记录不同。</p>`
    : "";
  const scopeNote = allowedIds === undefined
    ? "本面板按全部实际来源应用统计。"
    : `本面板只查看当前关联的应用编号：${[...allowedIds].map(id => `#${esc(id)}`).join("、") || "无"}；未关联的应用不纳入逐阶段统计。`;
  const completeEvidence = {
    scopeApplicationIds: associatedIds ?? null,
    targetPhases: receipt ?? null,
    phaseApplications: phaseApplications.map(({ phase, applications }) => ({ phase, applications })),
    unphasedApplications,
    visibleApplicationLogRange: displayLogs.length ? [1, Math.min(100, displayLogs.length)] : [],
    displayedApplicationLogs: visibleLogs.map(({ phase, application }) => ({ phase: phase ?? null, application })),
    scopeSummary,
  };

  root.innerHTML = `<section class="card" data-source-host-target-phase-summary>
    <h3>目标阶段与实际命中</h3>
    <p>${scopeNote}策略是用户声明的目标情景，不是已验证的游戏敌人机制。三个效果轴分别记录，互不替代；本面板不推导完整施放数、DPS 或验证结论。</p>
    ${noReceipt}${unconfiguredNote}${undeclaredIntervalNote}
    ${phasesHtml || (!receipt ? "" : "<p>本结果有目标阶段策略，但没有声明窗口。</p>")}
    ${unphasedApplications.length ? `<section data-target-phase-unmatched><h4>未匹配到已声明阶段的实际应用</h4><p>这些是确有记录的应用，但其回执未匹配本结果保存的阶段声明和半开帧窗；不把它们改写成阶段命中。</p><p>${unphasedApplications.slice(0, 100).map(application => `#${application.id}（${number(application.frame)} 帧，目标 key ${application.targetKey}）`).join("、")}${unphasedApplications.length > 100 ? `；仅展示前 100 条，共 ${unphasedApplications.length} 条。` : ""}</p></section>` : ""}
    <details data-target-phase-application-log><summary>逐击应用记录（${Math.min(100, displayLogs.length)} / ${displayLogs.length} 条）</summary>
      <p>表格显示按帧排序后的前 ${Math.min(100, displayLogs.length)} 条（共 ${displayLogs.length} 条）；每阶段完整应用记录保留在下方 JSON。</p>
      <div class="table-wrap"><table><thead><tr><th>阶段</th><th>应用 ID</th><th>实际帧</th><th>目标 key</th><th>原始公式伤害</th><th>来源记账伤害</th><th>目标 HP 损失</th><th>目标应用计算 ID</th></tr></thead><tbody>${logRows || "<tr><td colspan=\"8\">没有实际应用记录。</td></tr>"}</tbody></table></div>
    </details>
    <details data-target-phase-json><summary>完整目标阶段与逐击应用 JSON</summary><pre>${esc(JSON.stringify(completeEvidence, null, 2))}</pre></details>
  </section>`;
}
