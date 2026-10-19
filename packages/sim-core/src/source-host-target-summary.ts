import { expr, TraceBuilder, traceInput, type CalculationTraceNode, type TraceInput } from "./calculation-trace";
import type { SourceHostApplication, SourceHostNativeResult, SourceHostTargetScene } from "./source-host-wire";

export interface SourceHostTargetSummaryMetrics {
  rawDamage: number;
  appliedDamage: number;
  hpLoss: number;
  hitCount: number;
  applicationIds: number[];
  rawDamageRate?: number;
  appliedDamageRate?: number;
}

export interface SourceHostTargetSummaryRow extends SourceHostTargetSummaryMetrics {
  targetKey: number;
  declarationIndex?: number;
  profile?: Record<string, unknown>;
  position?: { x: number; y: number; radius: number };
  initialHP?: number;
  initialMaxHP?: number;
  isPrimary?: boolean;
  isInitialDefault?: boolean;
  trace: CalculationTraceNode[];
}

export interface SourceHostTargetSummary {
  scope: "all-applications" | "selected-applications";
  showRates: boolean;
  applicationIds: number[];
  damageMode?: boolean;
  primaryTargetIndex?: number;
  primaryTargetKey?: number;
  initialDefaultTargetKey?: number;
  observationWindow?: SourceHostNativeResult["observationWindow"];
  actualDurationFrames?: number;
  actualDurationSeconds?: number;
  fullConfiguredWindow?: boolean;
  targets: SourceHostTargetSummaryRow[];
  unmapped: SourceHostTargetSummaryMetrics;
  total: SourceHostTargetSummaryMetrics;
  trace: CalculationTraceNode[];
}

export interface SourceHostTargetSummaryOptions {
  /** Exact native application IDs associated with a selected action; never inferred from attack opportunities. */
  applicationIds?: readonly number[];
  showRates?: boolean;
}

type TargetReceipt = SourceHostTargetScene["targets"][number];
type Metric = "rawDamage" | "appliedDamage" | "hpLoss";

const record = (value: unknown): Record<string, unknown> | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

function appInput(key: string, value: number, application: SourceHostApplication, unit: string, meaning: string): TraceInput {
  return {
    ...traceInput(key, value, unit, { kind: "source-host-application", reference: `application#${application.id}` }, meaning),
    context: { applicationId: application.id, targetKey: application.targetKey, frame: application.frame },
  };
}

function zeroTraceMetric(builder: TraceBuilder, id: string, title: string, unit: string): { value: number; id: string } {
  return { value: builder.add(id, title, expr.value(0), [], { unit,
    explanationKey: "该目标在本次已保存的来源应用范围内没有命中记录；0 仅表示已观察应用小计，不证明完整技能没有其他命中。" }), id };
}

function summedMetric(
  builder: TraceBuilder,
  scopeId: string,
  title: string,
  metric: Metric,
  applications: readonly SourceHostApplication[],
  appMetricNodes: ReadonlyMap<number, Record<Metric, { id: string; value: number }>>,
): { value: number; id: string } {
  const childMetrics = applications.map(application => appMetricNodes.get(application.id)![metric]);
  const values = childMetrics.map(item => item.value);
  const id = `${scopeId}.${metric}`;
  if (!applications.length) return zeroTraceMetric(builder, id, title, "damage");
  const childIds = childMetrics.map(item => item.id);
  const inputs = applications.map((application, index) => appInput(`application-${application.id}`, values[index]!, application, "damage", `来源实际应用 #${application.id}，目标键 ${application.targetKey}`));
  const value = builder.add(id, title, expr.add(...values.map((_, index) => expr.input(`application-${applications[index]!.id}`))), inputs, {
    unit: "damage", childIds, explanationKey: "按实际结算的来源命中应用逐条求和；同一应用只计一次。",
  });
  return { value, id };
}

function rateMetric(builder: TraceBuilder, id: string, title: string, damage: { value: number; id: string }, seconds: number, durationId: string): number {
  const rate = builder.add(id, title, expr.div(expr.input("damage"), expr.input("durationSeconds")), [
    traceInput("damage", damage.value, "damage", { kind: "shared-core-execution", reference: damage.id }, "对应目标或全部实际命中应用的伤害总和"),
    traceInput("durationSeconds", seconds, "seconds", { kind: "shared-core-execution", reference: durationId }, "来源回执记录的实际运行帧数除以 60"),
  ], { unit: "damage/second", childIds: [damage.id, durationId], explanationKey: "用实际已应用伤害除以来源报告的运行时长；不按末次命中位置缩短窗口。" });
  return rate;
}

function nativeDurationFrames(result: unknown): number | undefined {
  const duration = record(result)?.duration;
  return typeof duration === "number" && Number.isInteger(duration) && duration >= 0 ? duration : undefined;
}

/** Summarizes only actual application receipts. Formula calls and attack observations are not extra damage. */
export function summarizeSourceHostTargets(
  result: Pick<SourceHostNativeResult, "applications" | "targetScene" | "observationWindow" | "result">,
  options: SourceHostTargetSummaryOptions = {},
): SourceHostTargetSummary {
  const allApplications = result.applications;
  const seenApplicationIds = new Set<number>();
  for (const application of allApplications) {
    if (seenApplicationIds.has(application.id)) throw new Error(`来源目标汇总包含重复的应用记录 #${application.id}。`);
    seenApplicationIds.add(application.id);
  }
  const selectedIds = options.applicationIds === undefined ? undefined : new Set(options.applicationIds);
  if (selectedIds && selectedIds.size !== options.applicationIds!.length) throw new Error("来源目标汇总的应用 ID 列表包含重复项。");
  if (selectedIds) {
    const unknown = [...selectedIds].filter(id => !seenApplicationIds.has(id));
    if (unknown.length) throw new Error(`来源目标汇总引用了不存在的应用记录：${unknown.join(", " )}。`);
  }
  const applications = selectedIds ? allApplications.filter(application => selectedIds.has(application.id)) : allApplications;
  const showRates = options.showRates ?? true;
  const scene = result.targetScene;
  const receiptByKey = new Map<number, TargetReceipt>();
  const declarationIndexes = new Set<number>();
  for (const target of scene?.targets ?? []) {
    if (receiptByKey.has(target.targetKey)) throw new Error(`来源目标回执包含重复 targetKey ${target.targetKey}。`);
    if (declarationIndexes.has(target.declarationIndex)) throw new Error(`来源目标回执包含重复声明索引 ${target.declarationIndex}。`);
    receiptByKey.set(target.targetKey, target);
    declarationIndexes.add(target.declarationIndex);
  }
  if (scene && !declarationIndexes.has(scene.primaryTargetIndex)) throw new Error("来源目标回执的主目标索引没有对应声明目标。");

  const unmappedApplications = scene ? applications.filter(application => !receiptByKey.has(application.targetKey)) : [];
  const targetKeys = scene ? scene.targets.map(target => target.targetKey) : [...new Set(applications.map(application => application.targetKey))];
  const groups = targetKeys.map(targetKey => ({ target: scene?.targets.find(item => item.targetKey === targetKey), targetKey,
    applications: applications.filter(application => application.targetKey === targetKey) }));
  const builder = new TraceBuilder();
  const metricNodes = new Map<number, Record<Metric, { id: string; value: number }>>();
  for (const application of applications) {
    const ids = {} as Record<Metric, { id: string; value: number }>;
    const values: Record<Metric, number> = {
      rawDamage: application.rawDamage,
      appliedDamage: application.appliedDamage,
      hpLoss: application.hpBefore - application.hpAfter,
    };
    for (const metric of ["rawDamage", "appliedDamage", "hpLoss"] as const) {
      const id = `application-${application.id}.${metric}`;
      const title = metric === "rawDamage" ? "该次应用的来源原始伤害" : metric === "appliedDamage" ? "该次应用的来源已应用伤害" : "该次应用的目标生命损失";
      const value = builder.add(id, title, metric === "hpLoss" ? expr.sub(expr.input("hpBefore"), expr.input("hpAfter")) : expr.input("amount"), metric === "hpLoss" ? [
        appInput("hpBefore", application.hpBefore, application, "HP", "来源应用回执中的命中前目标生命"),
        appInput("hpAfter", application.hpAfter, application, "HP", "来源应用回执中的命中后目标生命"),
      ] : [appInput("amount", values[metric], application, "damage", "来源应用回执中的实际数值")], { unit: "damage", explanationKey: `来源实际应用 #${application.id}，targetKey ${application.targetKey}，frame ${application.frame}。` });
      ids[metric] = { id, value };
    }
    metricNodes.set(application.id, ids);
  }

  interface InternalGroup extends SourceHostTargetSummaryMetrics { metricNodes: Record<Metric, { value: number; id: string }> }
  const summarizeGroup = (id: string, title: string, rows: readonly SourceHostApplication[]): InternalGroup => {
    const rawDamage = summedMetric(builder, id, `${title}：原始伤害合计`, "rawDamage", rows, metricNodes);
    const appliedDamage = summedMetric(builder, id, `${title}：已应用伤害合计`, "appliedDamage", rows, metricNodes);
    const hpLoss = summedMetric(builder, id, `${title}：目标生命损失合计`, "hpLoss", rows, metricNodes);
    return { rawDamage: rawDamage.value, appliedDamage: appliedDamage.value, hpLoss: hpLoss.value, hitCount: rows.length,
      applicationIds: rows.map(application => application.id), metricNodes: { rawDamage, appliedDamage, hpLoss } };
  };

  const targetRows: SourceHostTargetSummaryRow[] = groups.map(({ target, targetKey, applications: rows }) => {
    const summary = summarizeGroup(`target-${targetKey}`, `目标 ${targetKey}`, rows);
    return {
      targetKey,
      ...(target ? { declarationIndex: target.declarationIndex, profile: target.profile, position: target.position,
        initialHP: target.initialHP, initialMaxHP: target.initialMaxHP } : {}),
      ...(scene && target ? { isPrimary: target.declarationIndex === scene.primaryTargetIndex, isInitialDefault: target.targetKey === scene.initialDefaultTargetKey } : {}),
      rawDamage: summary.rawDamage, appliedDamage: summary.appliedDamage, hpLoss: summary.hpLoss,
      hitCount: summary.hitCount, applicationIds: summary.applicationIds,
      trace: [],
    };
  });
  const unmapped = summarizeGroup("unmapped", "未映射到目标场景的应用", unmappedApplications);
  const total = summarizeGroup("total", selectedIds ? "当前关联应用合计" : "全目标实际应用合计", applications);

  const actualDurationFrames = result.observationWindow?.actualEndFrame ?? nativeDurationFrames(result.result);
  let actualDurationSeconds: number | undefined;
  let durationNodeId: string | undefined;
  if (actualDurationFrames !== undefined) {
    durationNodeId = "observation.actual-duration-seconds";
    actualDurationSeconds = builder.add(durationNodeId, "来源实际运行时长（秒）", expr.div(expr.input("actualEndFrame"), expr.value(60)), [
      traceInput("actualEndFrame", actualDurationFrames, "frames", result.observationWindow ? { kind: "source-observation-window", reference: "actualEndFrame" } : { kind: "native-result", reference: "result.duration" }, "实际执行终点帧"),
    ], { unit: "seconds", explanationKey: "按来源实际报告的运行终点帧除以 60；不是用最后一次命中帧缩短观察窗。" });
  }
  if (showRates && durationNodeId && actualDurationSeconds !== undefined && actualDurationSeconds > 0) {
    for (const row of targetRows) {
      row.rawDamageRate = rateMetric(builder, `target-${row.targetKey}.rawDamageRate`, `目标 ${row.targetKey} 原始伤害速率`, { value: row.rawDamage, id: `target-${row.targetKey}.rawDamage` }, actualDurationSeconds, durationNodeId);
      row.appliedDamageRate = rateMetric(builder, `target-${row.targetKey}.appliedDamageRate`, `目标 ${row.targetKey} 已应用伤害速率`, { value: row.appliedDamage, id: `target-${row.targetKey}.appliedDamage` }, actualDurationSeconds, durationNodeId);
    }
    total.rawDamageRate = rateMetric(builder, "total.rawDamageRate", "当前范围原始伤害速率", total.metricNodes.rawDamage, actualDurationSeconds, durationNodeId);
    total.appliedDamageRate = rateMetric(builder, "total.appliedDamageRate", "当前范围已应用伤害速率", total.metricNodes.appliedDamage, actualDurationSeconds, durationNodeId);
    unmapped.rawDamageRate = rateMetric(builder, "unmapped.rawDamageRate", "未映射应用原始伤害速率", unmapped.metricNodes.rawDamage, actualDurationSeconds, durationNodeId);
    unmapped.appliedDamageRate = rateMetric(builder, "unmapped.appliedDamageRate", "未映射应用已应用伤害速率", unmapped.metricNodes.appliedDamage, actualDurationSeconds, durationNodeId);
  }

  const primary = scene?.targets.find(target => target.declarationIndex === scene.primaryTargetIndex);
  const allTrace = builder.nodes;
  for (const row of targetRows) {
    const rowIds = new Set<string>([
      ...(durationNodeId ? [durationNodeId] : []),
      `target-${row.targetKey}.rawDamage`, `target-${row.targetKey}.appliedDamage`, `target-${row.targetKey}.hpLoss`,
      `target-${row.targetKey}.rawDamageRate`, `target-${row.targetKey}.appliedDamageRate`,
      ...row.applicationIds.flatMap(id => [`application-${id}.rawDamage`, `application-${id}.appliedDamage`, `application-${id}.hpLoss`]),
    ]);
    row.trace = allTrace.filter(node => rowIds.has(node.id));
  }
  return {
    scope: selectedIds ? "selected-applications" : "all-applications",
    showRates,
    applicationIds: applications.map(application => application.id),
    ...(scene ? { damageMode: scene.damageMode, primaryTargetIndex: scene.primaryTargetIndex, primaryTargetKey: primary!.targetKey,
      initialDefaultTargetKey: scene.initialDefaultTargetKey } : {}),
    ...(result.observationWindow ? { observationWindow: result.observationWindow } : {}),
    ...(actualDurationFrames === undefined ? {} : { actualDurationFrames }),
    ...(actualDurationSeconds === undefined ? {} : { actualDurationSeconds }),
    ...(result.observationWindow ? { fullConfiguredWindow: result.observationWindow.endReason === "duration"
      && result.observationWindow.actualEndFrame === result.observationWindow.configuredEndFrame } : {}),
    targets: targetRows,
    unmapped: { rawDamage: unmapped.rawDamage, appliedDamage: unmapped.appliedDamage, hpLoss: unmapped.hpLoss, hitCount: unmapped.hitCount, applicationIds: unmapped.applicationIds,
      ...(unmapped.rawDamageRate === undefined ? {} : { rawDamageRate: unmapped.rawDamageRate }), ...(unmapped.appliedDamageRate === undefined ? {} : { appliedDamageRate: unmapped.appliedDamageRate }) },
    total: { rawDamage: total.rawDamage, appliedDamage: total.appliedDamage, hpLoss: total.hpLoss, hitCount: total.hitCount, applicationIds: total.applicationIds,
      ...(total.rawDamageRate === undefined ? {} : { rawDamageRate: total.rawDamageRate }), ...(total.appliedDamageRate === undefined ? {} : { appliedDamageRate: total.appliedDamageRate }) },
    trace: allTrace,
  };
}
