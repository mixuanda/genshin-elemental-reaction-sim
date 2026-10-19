import { z } from "zod";
import declarations from "./source-host-producer-plans.json" with { type: "json" };
import type { SourceHostAbilityInvocation } from "./source-host-finite-cast-types";

export interface SourceHostProducerOutcome {
  attackCount?: number;
  attackCountFromProducerFact?: string;
  whenProducerFact?: { name: string; equals: number };
  children: Record<string, number>;
  minDepth?: number;
  maxDepth?: number;
}
export interface SourceHostProducerSitePlan {
  siteId: string;
  rootCount: number;
  parentSites: string[];
  parentCallbackSites?: string[];
  outcomes: SourceHostProducerOutcome[];
  maxDepth?: number;
}
export interface SourceHostFiniteCastPlan {
  directRootCount: number;
  expectedRootAttackCount?: number;
  requiresProducers: boolean;
  sites: SourceHostProducerSitePlan[];
  prohibitOverlappingInvocations?: boolean;
  allowsOnRemoved?: boolean;
  scopeNotes?: string[];
}

type ValueExpression = number
  | { op: "const"; value: number }
  | { op: "param"; name: string; default?: number }
  | { op: "fact"; name: string }
  | { op: "constellation" | "ascension" }
  | { op: "if"; test: TestExpression; then: ValueExpression; else: ValueExpression }
  | { op: "add"; left: ValueExpression; right: ValueExpression };
type TestExpression =
  | { op: "compare"; cmp: "eq" | "neq" | "lt" | "lte" | "gt" | "gte"; left: ValueExpression; right: ValueExpression }
  | { op: "and"; terms: TestExpression[] };
interface OutcomeDeclaration {
  attackCount?: ValueExpression;
  attackCountFromProducerFact?: string;
  whenProducerFact?: { name: string; equals: number };
  children?: Record<string, ValueExpression>;
  minDepth?: ValueExpression;
  maxDepth?: ValueExpression;
  when?: TestExpression;
}
interface SiteDeclaration {
  siteId: string;
  rootCount: ValueExpression;
  parentSites: string[];
  parentCallbackSites?: string[];
  outcomes: OutcomeDeclaration[];
  maxDepth?: ValueExpression;
  when?: TestExpression;
}
interface PlanDeclaration {
  when?: TestExpression;
  directRootCount: ValueExpression;
  expectedRootAttackCount?: ValueExpression;
  sites: SiteDeclaration[];
  prohibitOverlappingInvocations?: boolean;
  allowsOnRemoved?: boolean;
  scopeNotes?: string[];
}

type FactInvocation = SourceHostAbilityInvocation & { entryFacts?: Readonly<Record<string, number>> };

const valueExpressionSchema: z.ZodTypeAny = z.lazy(() => z.union([
  z.number().finite(),
  z.object({ op: z.literal("const"), value: z.number().finite() }).strict(),
  z.object({ op: z.literal("param"), name: z.string(), default: z.number().finite().optional() }).strict(),
  z.object({ op: z.literal("fact"), name: z.string() }).strict(),
  z.object({ op: z.enum(["constellation", "ascension"]) }).strict(),
  z.object({ op: z.literal("if"), test: testExpressionSchema, then: valueExpressionSchema, else: valueExpressionSchema }).strict(),
  z.object({ op: z.literal("add"), left: valueExpressionSchema, right: valueExpressionSchema }).strict(),
]));
const testExpressionSchema: z.ZodTypeAny = z.lazy(() => z.union([
  z.object({ op: z.literal("compare"), cmp: z.enum(["eq", "neq", "lt", "lte", "gt", "gte"]), left: valueExpressionSchema, right: valueExpressionSchema }).strict(),
  z.object({ op: z.literal("and"), terms: z.array(testExpressionSchema) }).strict(),
]));
const outcomeSchema = z.object({ attackCount: valueExpressionSchema.optional(),
  attackCountFromProducerFact: z.string().min(1).optional(), children: z.record(z.string(), valueExpressionSchema).optional(),
  whenProducerFact: z.object({ name: z.string().min(1), equals: z.number().finite() }).strict().optional(),
  minDepth: valueExpressionSchema.optional(), maxDepth: valueExpressionSchema.optional(), when: testExpressionSchema.optional() })
  .strict().superRefine((outcome, context) => {
    if ((outcome.attackCount === undefined) === (outcome.attackCountFromProducerFact === undefined)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "每个来源任务结果必须且只能使用固定攻击数或任务事实攻击数。" });
    }
  });
const siteSchema = z.object({ siteId: z.string(), rootCount: valueExpressionSchema, parentSites: z.array(z.string()),
  parentCallbackSites: z.array(z.string()).optional(),
  outcomes: z.array(outcomeSchema), maxDepth: valueExpressionSchema.optional(), when: testExpressionSchema.optional() }).strict();
const planSchema = z.object({ directRootCount: valueExpressionSchema, expectedRootAttackCount: valueExpressionSchema.optional(),
  when: testExpressionSchema.optional(), sites: z.array(siteSchema), prohibitOverlappingInvocations: z.boolean().optional(),
  allowsOnRemoved: z.boolean().optional(), scopeNotes: z.array(z.string()).optional() }).strict();
const producerPlanDeclarations = z.record(z.string(), planSchema).parse(declarations) as Record<string, PlanDeclaration>;

function isCount(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function evaluateValue(expression: ValueExpression, invocation: FactInvocation): number | undefined {
  if (typeof expression === "number") return expression;
  switch (expression.op) {
    case "const": return expression.value;
    case "param": return invocation.params[expression.name] ?? expression.default ?? 0;
    case "fact": {
      const value = invocation.entryFacts?.[expression.name];
      return value !== undefined && Number.isFinite(value) ? value : undefined;
    }
    case "constellation": return invocation.constellation;
    case "ascension": return invocation.ascension;
    case "add": {
      const left = evaluateValue(expression.left, invocation), right = evaluateValue(expression.right, invocation);
      return left === undefined || right === undefined ? undefined : left + right;
    }
    case "if": {
      const condition = evaluateTest(expression.test, invocation);
      return condition === undefined ? undefined
        : condition ? evaluateValue(expression.then, invocation) : evaluateValue(expression.else, invocation);
    }
  }
}

function evaluateTest(test: TestExpression, invocation: FactInvocation): boolean | undefined {
  if (test.op === "and") {
    let unknown = false;
    for (const term of test.terms) {
      const result = evaluateTest(term, invocation);
      if (result === false) return false;
      if (result === undefined) unknown = true;
    }
    return unknown ? undefined : true;
  }
  const left = evaluateValue(test.left, invocation), right = evaluateValue(test.right, invocation);
  if (left === undefined || right === undefined) return undefined;
  switch (test.cmp) {
    case "eq": return left === right;
    case "neq": return left !== right;
    case "lt": return left < right;
    case "lte": return left <= right;
    case "gt": return left > right;
    case "gte": return left >= right;
  }
}

function evaluatePlan(declaration: PlanDeclaration, rawInvocation: SourceHostAbilityInvocation): SourceHostFiniteCastPlan | undefined {
  const invocation = rawInvocation as FactInvocation;
  if (declaration.when !== undefined) {
    const enabled = evaluateTest(declaration.when, invocation);
    if (enabled !== true) return undefined;
  }
  const sites: SourceHostProducerSitePlan[] = [];
  for (const site of declaration.sites) {
    if (site.when !== undefined) {
      const enabled = evaluateTest(site.when, invocation);
      if (enabled === undefined) return undefined;
      if (!enabled) continue;
    }
    const rootCount = evaluateValue(site.rootCount, invocation);
    if (!isCount(rootCount)) return undefined;
    const outcomes: SourceHostProducerOutcome[] = [];
    for (const outcome of site.outcomes) {
      if (outcome.when !== undefined) {
        const enabled = evaluateTest(outcome.when, invocation);
        if (enabled === undefined) return undefined;
        if (!enabled) continue;
      }
      const attackCount = outcome.attackCount === undefined ? undefined : evaluateValue(outcome.attackCount, invocation);
      if (outcome.attackCount !== undefined && !isCount(attackCount)) return undefined;
      const children: Record<string, number> = {};
      for (const [siteId, expression] of Object.entries(outcome.children ?? {})) {
        const count = evaluateValue(expression, invocation);
        if (!isCount(count)) return undefined;
        children[siteId] = count;
      }
      const minDepth = outcome.minDepth === undefined ? undefined : evaluateValue(outcome.minDepth, invocation);
      const maxDepth = outcome.maxDepth === undefined ? undefined : evaluateValue(outcome.maxDepth, invocation);
      if (outcome.minDepth !== undefined && !isCount(minDepth) || outcome.maxDepth !== undefined && !isCount(maxDepth)) return undefined;
      outcomes.push({ ...(attackCount === undefined ? {} : { attackCount }),
        ...(outcome.attackCountFromProducerFact === undefined ? {} : { attackCountFromProducerFact: outcome.attackCountFromProducerFact }),
        ...(outcome.whenProducerFact === undefined ? {} : { whenProducerFact: outcome.whenProducerFact }),
        children,
        ...(minDepth === undefined ? {} : { minDepth }), ...(maxDepth === undefined ? {} : { maxDepth }) });
    }
    const maxDepth = site.maxDepth === undefined ? undefined : evaluateValue(site.maxDepth, invocation);
    if (site.maxDepth !== undefined && !isCount(maxDepth)) return undefined;
    sites.push({ siteId: site.siteId, rootCount, parentSites: site.parentSites, outcomes,
      ...(site.parentCallbackSites === undefined ? {} : { parentCallbackSites: site.parentCallbackSites }),
      ...(maxDepth === undefined ? {} : { maxDepth }) });
  }
  const directRootCount = evaluateValue(declaration.directRootCount, invocation);
  const expectedRootAttackCount = declaration.expectedRootAttackCount === undefined
    ? undefined : evaluateValue(declaration.expectedRootAttackCount, invocation);
  if (!isCount(directRootCount) || declaration.expectedRootAttackCount !== undefined && !isCount(expectedRootAttackCount)) return undefined;
  return {
    directRootCount,
    ...(expectedRootAttackCount === undefined ? {} : { expectedRootAttackCount }),
    requiresProducers: sites.length > 0,
    sites,
    ...(declaration.prohibitOverlappingInvocations === undefined ? {} : { prohibitOverlappingInvocations: declaration.prohibitOverlappingInvocations }),
    ...(declaration.allowsOnRemoved === undefined ? {} : { allowsOnRemoved: declaration.allowsOnRemoved }),
    ...(declaration.scopeNotes === undefined ? {} : { scopeNotes: declaration.scopeNotes }),
  };
}

/** Exact pinned-source branches are data declarations, not a growing character switch. */
export function sourceHostProducerPlan(id: string, invocation: SourceHostAbilityInvocation): SourceHostFiniteCastPlan | undefined {
  const declaration = producerPlanDeclarations[id];
  return declaration === undefined ? undefined : evaluatePlan(declaration, invocation);
}
