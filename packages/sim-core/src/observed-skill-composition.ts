/** One observed damage window whose contacts retain independent calculator documents. */
import { z } from "zod";
import { calculateDocument } from "./calculator";
import { calculatorDocumentSchema, type CalculatorAggregation, type CalculatorDocument, type CalculatorResult } from "./calculator-model";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import type { CalculatorTrustContext } from "./calculator-trust";
import { linneaObservedContextSchema } from "./linnea-observed-context";
import { sandroneObservedLifecycleSchema } from "./sandrone-observed-context";
import { analyzeLinneaComposition, bindLinneaCompositionComponent } from "./linnea-observed-composition";
import { analyzeSandroneComposition, bindSandroneCompositionComponent } from "./sandrone-observed-composition";

export const OBSERVED_SKILL_COMPOSITION_VERSION = "observed-skill-composition-v1" as const;
const identity = z.string().trim().min(1);
const componentSchema = z.strictObject({
  id: identity, eventId: identity, document: calculatorDocumentSchema,
});
const unmappedOpportunitySchema = z.strictObject({
  id: identity, frame: z.number().int().nonnegative(), label: identity, contact: z.boolean(),
});
const shared = {
  schemaVersion: z.literal(OBSERVED_SKILL_COMPOSITION_VERSION),
  id: identity, label: identity, targetId: identity,
  originEventId: identity, endEventId: identity.optional(),
  allOpportunitiesRecorded: z.boolean(), damageWindowClosed: z.boolean(),
  dataIdentity: calculatorDocumentSchema.shape.dataIdentity,
  components: z.array(componentSchema),
  unmappedOpportunities: z.array(unmappedOpportunitySchema),
  assumptions: z.array(identity),
};
export const observedSkillCompositionSchema = z.discriminatedUnion("profile", [
  z.strictObject({ ...shared, profile: z.literal("linnea-lumi"), context: linneaObservedContextSchema }),
  z.strictObject({ ...shared, profile: z.literal("sandrone-fagio-window"), context: sandroneObservedLifecycleSchema }),
]);
export type ObservedSkillCompositionDocument = z.infer<typeof observedSkillCompositionSchema>;

export interface ObservedCompositionOpportunity {
  eventId: string;
  frame: number;
  label: string;
  contact: boolean;
  sourceSkillId: string;
  sourceHitId?: string;
  sourceRefs: string[];
}

export interface ObservedCompositionAnalysis {
  opportunities: ObservedCompositionOpportunity[];
  issues: string[];
  warnings: string[];
  closed: boolean;
  completeCastEligible: boolean;
  attributionPolicy: string;
  nonDamageNotes: string[];
}

export interface ObservedSkillCompositionComponent {
  id: string;
  eventId: string;
  label: string;
  status: "calculated" | "non-damaging" | "blocked";
  document?: CalculatorDocument;
  result?: CalculatorResult;
  knownSubtotal?: { nonCritical: number; critical: number; expected: number };
  trace: CalculationTraceNode[];
  blockers: string[];
}

export interface ObservedSkillCompositionResult {
  status: "calculated" | "blocked";
  coverage: "complete-cast" | "complete-observed-window" | "partial";
  aggregation: CalculatorAggregation;
  components: ObservedSkillCompositionComponent[];
  trace: CalculationTraceNode[];
  totals?: { nonCritical: number; critical: number; expected: number };
  blockers: string[];
  warnings: string[];
}

export function parseObservedSkillComposition(json: string): ObservedSkillCompositionDocument {
  return observedSkillCompositionSchema.parse(JSON.parse(json));
}

export function serializeObservedSkillComposition(document: ObservedSkillCompositionDocument): string {
  return JSON.stringify(observedSkillCompositionSchema.parse(document), null, 2);
}

function prefixedTrace(nodes: readonly CalculationTraceNode[], prefix: string): CalculationTraceNode[] {
  return nodes.map(node => ({ ...node, id: `${prefix}.${node.id}`,
    childIds: node.childIds.map(id => `${prefix}.${id}`),
    ...(node.parentId === undefined ? {} : { parentId: `${prefix}.${node.parentId}` }) }));
}

function missingTrace(reason: string): CalculationTraceNode[] {
  return [{ id: "missing", ruleId: "observed-skill-missing", titleKey: "实际伤害组成缺少独立计算文档",
    explanationKey: "实际伤害机会未被当作零", status: "blocked", expression: expr.value(0),
    symbolicFormula: "未计算", substitution: "缺少实际组成", inputs: [], childIds: [], sourceRefs: [],
    warnings: [], applicabilityReason: reason }];
}

function missTrace(label: string, sourceRefs: string[]): CalculationTraceNode[] {
  const builder = new TraceBuilder(sourceRefs);
  builder.add("miss", "实际落空", expr.value(0), [], {
    unit: "damage", status: "not-applicable", explanationKey: `${label}未接触所选目标；确认没有本次伤害。`,
  });
  return builder.nodes;
}

/** The outer document never evaluates character damage itself: each contact uses calculateDocument. */
export function calculateObservedSkillComposition(
  input: ObservedSkillCompositionDocument, trust: CalculatorTrustContext = {},
): ObservedSkillCompositionResult {
  const doc = observedSkillCompositionSchema.parse(input);
  const analysis = doc.profile === "linnea-lumi" ? analyzeLinneaComposition(doc) : analyzeSandroneComposition(doc);
  const blockers = [...analysis.issues], warnings = [...analysis.warnings, ...analysis.nonDamageNotes];
  const components: ObservedSkillCompositionComponent[] = [];
  const aggregateComponents: CalculatorAggregation["components"] = [];
  const trace: CalculationTraceNode[] = [];
  const savedByEvent = new Map(doc.components.map(component => [component.eventId, component]));
  const seenComponentIds = new Set<string>(), seenEventIds = new Set<string>();
  for (const component of doc.components) {
    if (seenComponentIds.has(component.id) || seenEventIds.has(component.eventId))
      blockers.push(`组成 ${component.id} 的身份或观察事件重复，不能重复计数。`);
    seenComponentIds.add(component.id); seenEventIds.add(component.eventId);
  }
  const opportunityIds = new Set<string>();
  for (const opportunity of analysis.opportunities) {
    if (opportunityIds.has(opportunity.eventId)) {
      blockers.push(`观察事件 ${opportunity.eventId} 重复列为伤害机会，不能重复计数。`);
      continue;
    }
    opportunityIds.add(opportunity.eventId);
    const saved = savedByEvent.get(opportunity.eventId);
    const id = saved?.id ?? opportunity.eventId;
    const reasons: string[] = [];
    let document: CalculatorDocument | undefined = saved?.document;
    let result: CalculatorResult | undefined;
    let countableResult = false;
    let componentTrace: CalculationTraceNode[];
    if (!opportunity.contact) {
      if (saved) reasons.push(`观察事件 ${opportunity.eventId} 未接触所选目标，不能绑定伤害文档。`);
      componentTrace = reasons.length ? missingTrace(reasons.join("；")) : missTrace(opportunity.label, opportunity.sourceRefs);
    } else if (!saved) {
      reasons.push(`实际命中 ${opportunity.eventId} 缺少独立 CalculatorDocument。`);
      componentTrace = missingTrace(reasons[0]!);
    } else {
      if (JSON.stringify(saved.document.dataIdentity) !== JSON.stringify(doc.dataIdentity))
        reasons.push(`组成 ${id} 的数据身份与观察窗口不一致。`);
      if (saved.document.gameContext?.characterId !== (doc.profile === "linnea-lumi" ? "character:10000130" : "character:10000133"))
        reasons.push(`组成 ${id} 的角色身份与观察窗口不一致。`);
      if (saved.document.gameContext?.skillId !== opportunity.sourceSkillId ||
        opportunity.sourceHitId !== undefined && saved.document.selectedHitIds[0] !== opportunity.sourceHitId)
        reasons.push(`组成 ${id} 与实际事件 ${opportunity.eventId} 的来源技能或命中身份不一致。`);
      if (saved.document.scope !== "single-hit" || saved.document.selectedHitIds.length !== 1)
        reasons.push(`组成 ${id} 必须仅选择一个实际命中。`);
      if (!reasons.length) {
        try {
          document = doc.profile === "linnea-lumi"
            ? bindLinneaCompositionComponent(saved.document, doc.context, opportunity.eventId)
            : bindSandroneCompositionComponent(saved.document, doc.context, opportunity.eventId);
          result = calculateDocument(document, trust);
          countableResult = result.includedHitIds.length === 1;
          if (!countableResult) reasons.push(`${id}：准备后的独立文档未保持恰好一个实际命中。`);
          if (result.status === "calculated" && result.aggregation.knownSubtotal === undefined)
            reasons.push(`${id}：实际接触没有得到可计算的伤害值。`);
          if (result.status === "blocked") reasons.push(...(result.blockers.length
            ? result.blockers.map(reason => `${id}：${reason}`) : [`${id}：独立命中尚未得到有效伤害结果。`]));
          warnings.push(...result.warnings.map(warning => `${id}：${warning}`));
        } catch (error) {
          reasons.push(`${id}：${error instanceof Error ? error.message : String(error)}`);
        }
      }
      componentTrace = result?.trace ?? missingTrace(reasons.join("；"));
    }
    blockers.push(...reasons);
    const status = reasons.length ? "blocked" : opportunity.contact ? "calculated" : "non-damaging";
    const subtotal = countableResult ? result?.aggregation.knownSubtotal : undefined;
    const component: ObservedSkillCompositionComponent = { id, eventId: opportunity.eventId,
      label: opportunity.label, status, trace: componentTrace, blockers: reasons,
      ...(document ? { document } : {}), ...(result ? { result } : {}),
      ...(subtotal ? { knownSubtotal: subtotal } : {}) };
    components.push(component);
    trace.push(...prefixedTrace(componentTrace, `component.${id}`));
    const resultRefs = result?.aggregation.components.flatMap(row => row.sourceRefs) ?? [];
    aggregateComponents.push({ id, label: opportunity.label, selected: true,
      kind: document?.hits.find(hit => document?.selectedHitIds.includes(hit.id))?.kind ?? (opportunity.contact ? "blocked" : "non-damaging"),
      status, sourceRefs: [...new Set([...opportunity.sourceRefs, ...resultRefs])],
      blockers: reasons, ...(subtotal ? { damage: subtotal } : {}) });
  }
  for (const saved of doc.components) if (!opportunityIds.has(saved.eventId)) {
    const reason = `组成 ${saved.id} 绑定的 ${saved.eventId} 不在本次观察窗口的实际伤害机会中。`;
    blockers.push(reason);
    const componentTrace = missingTrace(reason);
    components.push({ id: saved.id, eventId: saved.eventId, label: saved.document.label,
      document: saved.document, status: "blocked", trace: componentTrace, blockers: [reason] });
    trace.push(...prefixedTrace(componentTrace, `component.${saved.id}`));
    aggregateComponents.push({ id: saved.id, label: saved.document.label, selected: true, kind: "blocked",
      status: "blocked", sourceRefs: [], blockers: [reason] });
  }
  for (const unknown of doc.unmappedOpportunities) {
    const reason = `${unknown.label}（帧 ${unknown.frame}）尚未对应已审阅的伤害组成。`;
    if (unknown.contact) blockers.push(reason);
    else warnings.push(`${unknown.label}（帧 ${unknown.frame}）未接触目标，仍保留为未分类观察机会。`);
    const componentTrace = unknown.contact ? missingTrace(reason) : missTrace(unknown.label, []);
    const status = unknown.contact ? "blocked" : "non-damaging";
    components.push({ id: unknown.id, eventId: unknown.id, label: unknown.label, status,
      trace: componentTrace, blockers: unknown.contact ? [reason] : [] });
    trace.push(...prefixedTrace(componentTrace, `component.${unknown.id}`));
    aggregateComponents.push({ id: unknown.id, label: unknown.label, selected: true,
      kind: unknown.contact ? "blocked" : "non-damaging", status, sourceRefs: [],
      blockers: unknown.contact ? [reason] : [] });
  }
  const closed = doc.damageWindowClosed && doc.endEventId !== undefined && analysis.closed;
  if (doc.damageWindowClosed && !closed) blockers.push("声明伤害窗口闭合，但缺少可核对的实际终点事件。 ");
  const complete = closed && doc.allOpportunitiesRecorded && !doc.unmappedOpportunities.length &&
    !blockers.length && components.every(component => component.status !== "blocked");
  const coverage: ObservedSkillCompositionResult["coverage"] = !complete ? "partial"
    : doc.profile === "linnea-lumi" && analysis.completeCastEligible ? "complete-cast" : "complete-observed-window";
  const counted = components.filter(component => component.knownSubtotal !== undefined || component.status === "non-damaging");
  const showSubtotal = counted.length > 0 || complete;
  let knownSubtotal: CalculatorAggregation["knownSubtotal"];
  if (showSubtotal) {
    const builder = new TraceBuilder([...new Set(aggregateComponents.flatMap(component => component.sourceRefs))]);
    const fields = ["nonCritical", "critical", "expected"] as const;
    const values = {} as Record<(typeof fields)[number], number>;
    for (const field of fields) {
      const inputs = counted.map((component, index) => traceInput(`component${index + 1}`,
        component.knownSubtotal?.[field] ?? 0, "damage",
        { kind: component.status === "non-damaging" ? "observed-contact-miss" : "observed-component-subtotal", reference: component.id }, component.label));
      values[field] = builder.add(`${coverage === "partial" ? "subtotal" : "total"}.${field}`,
        `${coverage === "partial" ? "已知" : "完整已观察"}组成${field}合计`,
        expr.add(...inputs.map(input => expr.input(input.key))), inputs, { unit: "damage",
          explanationKey: "逐个实际接触的独立计算结果求和；落空为已确认零，未知组成没有代入零。" });
    }
    knownSubtotal = values;
    trace.push(...builder.nodes.map(node => ({ ...node, childIds: counted.flatMap(component => {
      const child = component.status === "non-damaging" ? "miss"
        : component.trace.find(row => row.id === `total.${node.id.split(".").at(-1)}` || row.id === `subtotal.${node.id.split(".").at(-1)}`)?.id;
      return child ? [`component.${component.id}.${child}`] : [];
    }) })));
  }
  const status: ObservedSkillCompositionResult["status"] = blockers.length ? "blocked" : "calculated";
  const completenessReasons = [
    ...(!doc.allOpportunitiesRecorded ? ["未确认本窗口所有攻击机会都已记录。"] : []),
    ...(!closed ? ["伤害窗口未以实际终点事件闭合。"] : []),
    ...(doc.unmappedOpportunities.length ? [`有 ${doc.unmappedOpportunities.length} 个未分类观察机会。`] : []),
    ...(blockers.length ? ["有实际伤害机会缺少可计算组成或被阻塞；已知小计不代表完整结果。"] : []),
    ...(coverage === "complete-observed-window" ? ["仅完整覆盖这段已观察伤害窗口，不推断通用完整施放。"] : []),
  ];
  const aggregation: CalculatorAggregation = {
    version: "calculator-aggregation-v1", scope: coverage === "complete-cast" ? "complete-cast" : "selected-components",
    status, attributionPolicy: analysis.attributionPolicy, components: aggregateComponents,
    ...(knownSubtotal ? { knownSubtotal } : {}),
    omittedHitIds: aggregateComponents.filter(component => component.status === "blocked").map(component => component.id),
    completenessReasons,
  };
  return { status, coverage, aggregation, components, trace,
    ...(complete && knownSubtotal ? { totals: knownSubtotal } : {}), blockers, warnings };
}
