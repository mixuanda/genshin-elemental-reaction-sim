import { z } from "zod";
import { lunarArtifactBonusSchema, lunarArtifactBonusStages } from "./lunar-artifact-bonus";
import { stellarArtifactBonusSchema, stellarArtifactBonusStages } from "./stellar-artifact-bonus";
import { moonlightArtifactBonusSchema, moonlightArtifactBonusStages } from "./moonlight-artifact-bonus";

/** Formula evidence is versioned independently from character/action readiness. */
export const SPECIAL_FORMULA_RULES = {
  lunar: {
    id: "kqm-lunar-luna-vi-20260922-v1",
    gameVersion: "Luna VI",
    source: "https://keqingmains.com/misc/lunar-reactions/",
    sourceSha256: "de1ebc4ee7767842f07ee7a5eb6ceeb7eb980b1d8b55a7eaac84e5e027097a9e",
    retrievedAt: "2026-09-22T14:30:48.108617Z",
    readiness: "conditioned-formula-only",
  },
  stellar: {
    id: "kqm-stellar-7.0-20260922-v1",
    gameVersion: "7.0",
    source: "https://keqingmains.com/misc/stellar-reaction-guide/",
    sourceSha256: "cba82bde8a037b75cc1762a3b13976c857118a917221087a756b0347f5a6330c",
    retrievedAt: "2026-09-22T14:30:49.729027Z",
    readiness: "conditioned-formula-only",
  },
} as const;

const lunar = SPECIAL_FORMULA_RULES.lunar;
const stellar = SPECIAL_FORMULA_RULES.stellar;
const imageRoot = "https://kqm-uploads.keqingmains.com/wp-content/uploads/";
export const SPECIAL_BRANCHES = {
  "lunar-charged-direct": { family: "lunar", mode: "direct", coefficient: 3, image: "2026/01/Direct-LC.webp" },
  "lunar-charged-reaction": { family: "lunar", mode: "ranked-reaction", coefficient: 3, image: "2026/05/image2-new.webp" },
  "lunar-bloom-direct": { family: "lunar", mode: "direct", coefficient: 1, image: "2026/01/Direct-LB.webp" },
  "lunar-bloom-event": { family: "lunar", mode: "non-damaging", coefficient: null, image: null },
  "lunar-crystallize-direct": { family: "lunar", mode: "direct", coefficient: 1.6, image: "2026/01/Direct-LCr.webp" },
  "lunar-crystallize-reaction": { family: "lunar", mode: "ranked-reaction", coefficient: 1.6, image: "2026/05/image5-new.webp" },
  "stellar-conduct-direct": { family: "stellar", mode: "direct", coefficient: null, image: "2026/08/Direct-Stellar-Conduct-Formula.webp" },
  "stellar-conduct-event": { family: "stellar", mode: "non-damaging", coefficient: null, image: null },
  "stellar-swirl-direct": { family: "stellar", mode: "direct", coefficient: 1, image: "2026/08/Direct-Stellar-Swirl-Formula.webp" },
  "stellar-swirl-anemo-reaction": { family: "stellar", mode: "ranked-reaction", coefficient: 0.75, image: "2026/08/Indirect-Stellar-Swirl-Formula.webp" },
  "stellar-swirl-vortex-1": { family: "stellar", mode: "ranked-reaction", coefficient: 2, image: "2026/08/Indirect-Stellar-Swirl-Formula.webp" },
  "stellar-swirl-vortex-2": { family: "stellar", mode: "ranked-reaction", coefficient: 3, image: "2026/08/Indirect-Stellar-Swirl-Formula.webp" },
} as const;
export type SpecialBranch = keyof typeof SPECIAL_BRANCHES;
export const SPECIAL_RANK_WEIGHTS = [0.6, 0.3, 0.05, 0.05] as const;
export const STELLAR_CONDUCT_APPLICATION_MULTIPLIERS = [1, 1.45, 1.5, 1.55, 1.6, 1.65, 1.7, 1.75, 1.8, 1.85, 1.9, 1.95, 2] as const;

const finite = z.number().finite();
const nonnegative = finite.nonnegative();
const text = z.string().trim().min(1).max(1000);
const sourceRefs = z.array(text).min(1).max(50);
const baseSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("direct-stat-talent"), scalingStat: z.enum(["atk", "hp", "def", "em"]), statValue: nonnegative, talentCoefficient: nonnegative, sourceRefs }),
  z.strictObject({ kind: z.literal("level-base"), characterLevel: z.number().int().min(1).max(200), value: finite.positive(), evidence: z.enum(["synthetic", "provisional", "source-verified"]), sourceRefs }),
]);
const contributorSchema = z.strictObject({
  id: text, base: baseSchema, elementalMastery: nonnegative,
  specialBaseBonus: nonnegative, reactionBonus: nonnegative, specialAdditive: nonnegative,
  elevationMultiplier: finite.positive(), critRate: finite, critDamage: nonnegative,
  modifierSourceRefs: sourceRefs,
  artifactBonus: lunarArtifactBonusSchema.optional(),
  stellarArtifactBonus: stellarArtifactBonusSchema.optional(),
  moonlightArtifactBonus: moonlightArtifactBonusSchema.optional(),
  specialBaseBonusRules: z.array(z.strictObject({ kind: z.literal("columbina-moonsign-hp-v1"), providerId: text, maxHp: nonnegative })).max(1).optional(),
});
const sourceAbilityExecutionSchema = z.strictObject({
  abilityKey: z.literal("columbina-moondew-cleanse-idle-v1"), characterKey: z.literal("columbina"),
  effectiveTalentLevel: z.number().int().min(1).max(15), ascension: z.number().int().min(0).max(6), constellation: z.literal(0),
  fromState: z.literal("idle"), castFrame: z.number().int().nonnegative(), hitIndex: z.number().int().min(0).max(2),
  resourceReceipt: z.strictObject({ sourceEventId: text, frame: z.number().int().nonnegative(), resource: z.literal("verdant-dew"), consumed: z.literal(1) }),
});
const criticalExecutionSchema = z.strictObject({
  mode: z.literal("sampled-contributors-v1"), seed: z.string(),
  rngStream: z.literal("special-contributor-critical-v1"),
  rngAlgorithm: z.literal("fnv1a32-mulberry32-v1"),
  comparison: z.literal("<="),
  eventId: text, frame: z.number().int().nonnegative(),
  draws: z.array(z.strictObject({
    contributorId: text, drawIndex: z.number().int().nonnegative(),
    roll: finite.min(0).lt(1), critical: z.boolean(),
  })).max(4),
});
export const conditionedSpecialCalculationSchema = z.strictObject({
  branch: z.enum(Object.keys(SPECIAL_BRANCHES) as [SpecialBranch, ...SpecialBranch[]]),
  ruleVersion: z.enum([lunar.id, stellar.id]),
  context: z.discriminatedUnion("mode", [
    z.strictObject({ mode: z.literal("conditioned"), enablement: z.enum(["assumed-enabled", "disabled", "unknown"]), contributorEligibility: z.literal("assumed"), assumptions: z.array(text).min(1).max(50) }),
    z.strictObject({ mode: z.literal("state-resolved"), enablement: z.literal("resolved-enabled"), contributorEligibility: z.literal("resolved"), assumptions: z.array(text).min(1).max(50), stateProfileId: z.literal("special-state-reference-60fps-no-hitlag-v1"), sourceEventId: text, snapshotFrame: z.number().int().nonnegative(), deliveryFrame: z.number().int().nonnegative(), targetId: text, ownerId: text, contributorPolicy: z.enum(["live-positive-aura", "captured-since-last-volley", "trigger-aura", "captured-vortex-lifetime", "direct-ability-owner"]), stateSourceRefs: sourceRefs, auraAndDeliveryIntegration: z.literal("applied"), sourceAbilityExecution: sourceAbilityExecutionSchema.optional() }),
  ]),
  contributors: z.array(contributorSchema).max(4),
  effectiveResistance: finite,
  polestarApplicationCount: z.number().int().min(0).max(12).optional(),
  criticalExecution: criticalExecutionSchema.optional(),
}).superRefine((input, ctx) => {
  const definition = SPECIAL_BRANCHES[input.branch];
  if (input.ruleVersion !== SPECIAL_FORMULA_RULES[definition.family].id) ctx.addIssue({ code: "custom", message: "Branch and pinned rule version do not match" });
  if (definition.family !== "lunar" && input.contributors.some(c => c.specialBaseBonusRules?.length)) ctx.addIssue({ code: "custom", message: "Columbina Moonsign base bonus applies only to sourced Lunar formulas" });
  if (input.contributors.some(c => c.stellarArtifactBonus !== undefined) && !input.branch.startsWith("stellar-swirl-")) ctx.addIssue({ code: "custom", message: "Fixed-a7 Stellar artifact snapshots require a Stellar-Swirl reaction branch" });
  if (input.contributors.some(c => c.stellarArtifactBonus !== undefined && c.artifactBonus !== undefined)) ctx.addIssue({ code: "custom", message: "A contributor cannot use Lunar and Stellar artifact snapshots together" });
  if (input.contributors.some(c => c.moonlightArtifactBonus !== undefined) && !input.branch.startsWith("lunar-")) ctx.addIssue({ code: "custom", message: "Moonlight artifact snapshot requires a Lunar branch" });
  for (const [index, contributor] of input.contributors.entries()) if (contributor.moonlightArtifactBonus !== undefined && (input.context.mode !== "state-resolved" || contributor.moonlightArtifactBonus.snapshotFrame !== input.context.snapshotFrame)) ctx.addIssue({ code: "custom", path: ["contributors", index, "moonlightArtifactBonus", "snapshotFrame"], message: "Moonlight artifact snapshot must match the executed contributor snapshot frame" });
  for (const [index, contributor] of input.contributors.entries()) if (contributor.stellarArtifactBonus !== undefined && (input.context.mode !== "state-resolved" || contributor.stellarArtifactBonus.snapshotFrame !== input.context.snapshotFrame)) ctx.addIssue({ code: "custom", path: ["contributors", index, "stellarArtifactBonus", "snapshotFrame"], message: "Fixed-a7 Stellar artifact snapshot must match the executed contributor snapshot frame" });
  if (new Set(input.contributors.map(c => c.id)).size !== input.contributors.length) ctx.addIssue({ code: "custom", message: "Contributors must be unique; repeated applications do not create extra contributors" });
  if (definition.mode === "non-damaging" && input.contributors.length !== 0) ctx.addIssue({ code: "custom", message: "Non-damaging reaction events do not accept damage contributors" });
  if (definition.mode === "direct" && input.contributors.length !== 1) ctx.addIssue({ code: "custom", message: "Direct ability damage requires exactly one damage owner" });
  if (definition.mode === "ranked-reaction" && input.contributors.length === 0) ctx.addIssue({ code: "custom", message: "Reaction damage requires at least one explicitly eligible contributor" });
  if (input.contributors.some(c => definition.mode === "direct" ? c.base.kind !== "direct-stat-talent" : c.base.kind !== "level-base")) ctx.addIssue({ code: "custom", message: "Direct ability damage uses stat × talent; ranked reaction damage requires an explicit exact level base" });
  if (input.branch === "stellar-conduct-direct" && input.polestarApplicationCount === undefined) ctx.addIssue({ code: "custom", message: "Stellar-Conduct direct damage requires conditioned Polestar application count 0–12" });
  if (input.branch !== "stellar-conduct-direct" && input.polestarApplicationCount !== undefined) ctx.addIssue({ code: "custom", message: "Polestar count does not belong to this formula branch" });
  if (input.context.mode === "state-resolved" && input.context.deliveryFrame < input.context.snapshotFrame) ctx.addIssue({ code: "custom", message: "A resolved hit cannot be delivered before its snapshot" });
  if (input.criticalExecution !== undefined) {
    const { draws } = input.criticalExecution;
    if (definition.mode === "non-damaging") ctx.addIssue({ code: "custom", path: ["criticalExecution"], message: "Non-damaging events cannot contain contributor critical draws" });
    if (input.context.mode === "state-resolved" && input.criticalExecution.frame !== input.context.snapshotFrame) ctx.addIssue({ code: "custom", path: ["criticalExecution", "frame"], message: "Actual critical draws must use the contributor snapshot frame" });
    if (draws.length !== input.contributors.length) ctx.addIssue({ code: "custom", path: ["criticalExecution", "draws"], message: "Critical draws must correspond to every contributor in input order" });
    for (const [index, draw] of draws.entries()) {
      const contributor = input.contributors[index];
      if (draw.contributorId !== contributor?.id) ctx.addIssue({ code: "custom", path: ["criticalExecution", "draws", index, "contributorId"], message: "Critical draw contributor must match input order" });
      if (draw.drawIndex !== draws[0]!.drawIndex + index) ctx.addIssue({ code: "custom", path: ["criticalExecution", "draws", index, "drawIndex"], message: "Critical draw indices must be consecutive within an event" });
      if (contributor !== undefined && draw.critical !== (draw.roll <= contributor.critRate)) ctx.addIssue({ code: "custom", path: ["criticalExecution", "draws", index, "critical"], message: "Critical outcome must equal roll <= original critical rate" });
    }
  }
});
export type ConditionedSpecialCalculation = z.infer<typeof conditionedSpecialCalculationSchema>;
export type SpecialCalculationContext = ConditionedSpecialCalculation;
export type SpecialContributor = ConditionedSpecialCalculation["contributors"][number];

/** Structural subset of the shared trace AST; avoids a formula→simulator dependency. */
export type SpecialExpression =
  | { kind: "constant"; value: number }
  | { kind: "variable"; key: string }
  | { kind: "add" | "multiply" | "min" | "max"; terms: SpecialExpression[] }
  | { kind: "divide" | "subtract"; left: SpecialExpression; right: SpecialExpression }
  | { kind: "condition"; operator: "lte"; left: SpecialExpression; right: SpecialExpression; whenTrue: SpecialExpression; whenFalse: SpecialExpression };
export interface SpecialArithmeticStage {
  id: string; titleKey: string; explanationKey: string;
  expression: SpecialExpression; values: Record<string, number>;
  unit: "damage" | "ratio" | "probability" | "indicator";
  dependencies: string[]; sourceRefs: string[]; result: number;
}
/** Calculator injects TraceBuilder.add here, so the displayed AST performs arithmetic. */
export type SpecialStageExecutor = (stage: Omit<SpecialArithmeticStage, "result">) => number;
const variable = (key: string): SpecialExpression => ({ kind: "variable", key });
const constant = (value: number): SpecialExpression => ({ kind: "constant", value });
const add = (...terms: SpecialExpression[]): SpecialExpression => ({ kind: "add", terms });
const mul = (...terms: SpecialExpression[]): SpecialExpression => ({ kind: "multiply", terms });
const div = (left: SpecialExpression, right: SpecialExpression): SpecialExpression => ({ kind: "divide", left, right });
const sub = (left: SpecialExpression, right: SpecialExpression): SpecialExpression => ({ kind: "subtract", left, right });
const min = (...terms: SpecialExpression[]): SpecialExpression => ({ kind: "min", terms });
const max = (...terms: SpecialExpression[]): SpecialExpression => ({ kind: "max", terms });
function evaluate(expression: SpecialExpression, values: Record<string, number>): number {
  const checked = (value: number): number => {
    if (!Number.isFinite(value)) throw new RangeError("Special formula produced a non-finite intermediate result");
    return value;
  };
  switch (expression.kind) {
    case "constant": return expression.value;
    case "variable": {
      const value = values[expression.key];
      if (value === undefined || !Number.isFinite(value)) throw new RangeError(`Missing finite input ${expression.key}`);
      return value;
    }
    case "add": return expression.terms.reduce((sum, term) => checked(sum + evaluate(term, values)), 0);
    case "multiply": return expression.terms.reduce((product, term) => checked(product * evaluate(term, values)), 1);
    case "min": return checked(Math.min(...expression.terms.map(term => evaluate(term, values))));
    case "max": return checked(Math.max(...expression.terms.map(term => evaluate(term, values))));
    case "divide": return checked(evaluate(expression.left, values) / evaluate(expression.right, values));
    case "subtract": return checked(evaluate(expression.left, values) - evaluate(expression.right, values));
    case "condition": return evaluate(evaluate(expression.left, values) <= evaluate(expression.right, values) ? expression.whenTrue : expression.whenFalse, values);
  }
}

export interface SpecialRankedContribution {
  contributorId: string; critical: boolean; contribution: number; rank: number; weight: number; weightedDamage: number;
}
export interface SpecialOutcome {
  id: string; probability: number; damage: number; rankedContributions: SpecialRankedContribution[];
  displayedCritical: "critical" | "non-critical" | "ambiguous-tie";
}
export interface ConditionedSpecialResult {
  status: "calculated" | "blocked" | "non-damaging";
  branch: SpecialBranch; ruleVersion: string; sourceRefs: string[];
  nonCritical?: number; critical?: number; expected?: number;
  sampled?: SpecialOutcome;
  outcomes: SpecialOutcome[]; stages: SpecialArithmeticStage[];
  blockers: string[]; warnings: string[]; nonDamageReason?: string;
  readiness: "conditioned-formula-only" | "reference-state-resolved-formula";
}

/** An external mechanics host has already sampled these outcomes. No RNG runs here. */
export interface RecordedSpecialCriticalExecution {
  source: string;
  /** Runtime delivery needs its actual realization, not all 16 teaching outcomes. */
  onlyRecorded?: boolean;
  draws: { contributorId: string; roll: number | null; critical: boolean; guaranteed: boolean }[];
}

/**
 * No aura, party, entity, resource, application-window or conversion simulation is
 * implied. All those inputs are assumptions. Independent critical outcomes are
 * analytically enumerated; an optional actual draw set is evaluated separately.
 * Critical-triggered state feedback is out of scope.
 */
export function calculateConditionedSpecial(raw: ConditionedSpecialCalculation, executor?: SpecialStageExecutor, recordedCritical?: RecordedSpecialCriticalExecution): ConditionedSpecialResult {
  const input = conditionedSpecialCalculationSchema.parse(raw);
  if (recordedCritical !== undefined) {
    if (input.criticalExecution !== undefined || recordedCritical.draws.length !== input.contributors.length || !recordedCritical.source) throw new Error("Recorded native critical outcomes require one unambiguous draw per contributor");
    for (const [index, draw] of recordedCritical.draws.entries()) {
      const contributor = input.contributors[index]!;
      if (draw.contributorId !== contributor.id) throw new Error("Recorded native contributor order does not match the numerical context");
      if (draw.guaranteed ? draw.roll !== null || !draw.critical : draw.roll === null || !Number.isFinite(draw.roll) || draw.roll < 0 || draw.roll >= 1 || draw.critical !== (draw.roll <= contributor.critRate)) throw new Error("Recorded native critical decision does not match its actual draw or guarantee");
    }
  }
  const definition = SPECIAL_BRANCHES[input.branch];
  const rule = SPECIAL_FORMULA_RULES[definition.family];
  const refs = [rule.source, ...(definition.image === null ? [] : [imageRoot + definition.image])];
  if (input.context.mode === "state-resolved") refs.push(...input.context.stateSourceRefs);
  if (definition.mode === "ranked-reaction") refs.push(imageRoot + (definition.family === "lunar" ? "2026/05/image6-new.webp" : "2026/08/Stellar-Swirl-Contribution.webp"));
  const result: ConditionedSpecialResult = {
    status: "blocked", branch: input.branch, ruleVersion: input.ruleVersion, sourceRefs: refs,
    outcomes: [], stages: [], blockers: [], readiness: input.context.mode === "state-resolved" ? "reference-state-resolved-formula" : "conditioned-formula-only",
    warnings: [
      input.context.mode === "conditioned" ? "仅计算来源版本的条件公式；队伍启用、元素附着、参与者时间窗口、领域和资源状态未由模拟证明。" : "队伍启用和贡献者由已记录的参考状态引擎推导；60FPS、无卡肉、单个静止范围内目标配置仍为 provisional，不代表完整当前游戏机制验证。",
      "只接受明确适用于此特殊反应的基础提升、反应加成、加算伤害和擢升倍率；普通增伤、普通加算伤害和敌人防御不进入此公式。",
      "期望值穷举独立暴击结果，不支持暴击触发后改变后续状态的反馈。",
    ],
  };
  if (input.context.enablement !== "assumed-enabled" && input.context.enablement !== "resolved-enabled") {
    result.blockers.push(input.context.enablement === "disabled"
      ? "特殊反应转换未启用；必须重新由普通反应、元素附着和事件上下文确定回退，不能套用特殊反应公式。"
      : "特殊反应启用条件未知；需要明确且有记录的条件假设。" );
    return result;
  }
  if (definition.mode === "non-damaging") {
    result.status = "non-damaging";
    result.nonDamageReason = input.branch === "lunar-bloom-event"
      ? "月绽放事件产生草原核与草露；事件本身不产生月绽放伤害。草原核爆炸与角色直接月绽放能力是独立事件。"
      : "星导反应本身建立状态；直接星导伤害来自具有对应定义的角色能力。场地、阈值及后续状态尚未在此执行。";
    return result;
  }
  const artifactRules = input.contributors.map(contributor => contributor.artifactBonus ? lunarArtifactBonusStages(contributor.artifactBonus, input.branch) : undefined);
  const stellarArtifactRules = input.contributors.map(contributor => contributor.stellarArtifactBonus ? stellarArtifactBonusStages(contributor.stellarArtifactBonus, input.branch, contributor.id) : undefined);
  const moonlightArtifactRules = input.contributors.map(contributor => contributor.moonlightArtifactBonus ? moonlightArtifactBonusStages(contributor.moonlightArtifactBonus, input.branch) : undefined);
  result.sourceRefs.push(...new Set(artifactRules.flatMap(rules => rules?.stages.flatMap(term => term.sourceRefs) ?? [])));
  result.sourceRefs.push(...new Set(stellarArtifactRules.flatMap(rules => rules?.flatMap(term => term.sourceRefs) ?? [])));
  result.sourceRefs.push(...new Set(moonlightArtifactRules.flatMap(rules => rules?.flatMap(term => term.sourceRefs) ?? [])));
  result.blockers.push(...artifactRules.flatMap((rules, index) => rules?.blockers.map(reason => `${input.contributors[index]!.id}：${reason}`) ?? []));
  if (result.blockers.length) return result;
  const coefficient = input.branch === "stellar-conduct-direct"
    ? STELLAR_CONDUCT_APPLICATION_MULTIPLIERS[input.polestarApplicationCount!]!
    : definition.coefficient!;
  const stage = (id: string, titleKey: string, expression: SpecialExpression, values: Record<string, number>, unit: SpecialArithmeticStage["unit"] = "damage", dependencies: string[] = [], sources = refs): number => {
    const record = { id, titleKey, explanationKey: `${titleKey}.explain`, expression, values, unit, dependencies, sourceRefs: sources };
    const value = executor ? executor(record) : evaluate(expression, values);
    if (!Number.isFinite(value)) throw new RangeError(`${id} produced non-finite damage; reduce inputs`);
    result.stages.push({ ...record, result: value });
    return value;
  };
  const resExpr = input.effectiveResistance < 0
    ? sub(constant(1), div(variable("RES"), constant(2)))
    : input.effectiveResistance < 0.75
      ? sub(constant(1), variable("RES"))
      : div(constant(1), add(mul(constant(4), variable("RES")), constant(1)));
  const resistance = stage("resistance", "special.resistance", resExpr, { RES: input.effectiveResistance }, "ratio");
  const beforeCrit = input.contributors.map((c, index) => {
    const prefix = `contributor.${index}`;
    const base = c.base.kind === "direct-stat-talent"
      ? stage(`${prefix}.base`, "special.directBase", mul(variable("stat"), variable("talent")), { stat: c.base.statValue, talent: c.base.talentCoefficient }, "damage", [], c.base.sourceRefs)
      : stage(`${prefix}.base`, "special.levelBase", variable("levelBase"), { levelBase: c.base.value }, "damage", [], c.base.sourceRefs);
    const em = stage(`${prefix}.em`, "special.em", div(mul(constant(6), variable("EM")), add(variable("EM"), constant(2000))), { EM: c.elementalMastery }, "ratio");
    const bonusRules = c.specialBaseBonusRules ?? [];
    const derivedBonuses = bonusRules.map((rule, i) => stage(`${prefix}.baseBonus.${i}`, "special.columbinaMoonsign", min(mul(div(variable("HP"), constant(1000)), constant(0.002)), constant(0.07)), { HP: rule.maxHp }, "ratio", [], ["https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/columbina/asc.go"]));
    const specialBaseBonus = derivedBonuses.length ? stage(`${prefix}.baseBonus.total`, "special.baseBonusTotal", add(variable("manualBonus"), ...derivedBonuses.map((_, i) => variable(`derived${i}`))), { manualBonus: c.specialBaseBonus, ...Object.fromEntries(derivedBonuses.map((value, i) => [`derived${i}`, value])) }, "ratio", derivedBonuses.map((_, i) => `${prefix}.baseBonus.${i}`)) : c.specialBaseBonus;
    const scaled = stage(`${prefix}.scaled`, "special.scaled", mul(variable("coefficient"), variable("base"), add(constant(1), variable("specialBaseBonus"))), { coefficient, base, specialBaseBonus }, "damage", [`${prefix}.base`, ...(derivedBonuses.length ? [`${prefix}.baseBonus.total`] : [])], [...refs, ...c.modifierSourceRefs]);
    const artifactPrefix = `${prefix}.artifact`, artifactValues: Record<string, number> = {};
    for (const term of artifactRules[index]?.stages ?? []) {
      const record = { id: `${artifactPrefix}.${term.suffix}`, titleKey: term.titleKey, explanationKey: term.explanationKey, expression: term.expression,
        values: { ...term.values, ...Object.fromEntries(term.dependencies.map(key => [key, artifactValues[key]!])) }, unit: term.unit,
        dependencies: term.dependencies.map(key => `${artifactPrefix}.${key}`), sourceRefs: term.sourceRefs };
      const value = executor ? executor(record) : evaluate(record.expression, record.values);
      result.stages.push({ ...record, result: value }); artifactValues[term.suffix] = value;
    }
    const stellarValues: Record<string, number> = {};
    for (const term of stellarArtifactRules[index] ?? []) {
      const record = { id: `${artifactPrefix}.${term.suffix}`, titleKey: term.titleKey, explanationKey: term.explanationKey, expression: term.expression,
        values: { ...term.values, ...Object.fromEntries(term.dependencies.map(key => [key, stellarValues[key]!])) }, unit: term.unit,
        dependencies: term.dependencies.map(key => `${artifactPrefix}.${key}`), sourceRefs: term.sourceRefs };
      const value = executor ? executor(record) : evaluate(record.expression, record.values);
      result.stages.push({ ...record, result: value }); stellarValues[term.suffix] = value;
    }
    const moonlightPrefix = `${prefix}.moonlightArtifact`, moonlightValues: Record<string, number> = {};
    for (const term of moonlightArtifactRules[index] ?? []) {
      const record = { id: `${moonlightPrefix}.${term.suffix}`, titleKey: term.titleKey, explanationKey: term.explanationKey, expression: term.expression,
        values: { ...term.values, ...Object.fromEntries(term.dependencies.map(key => [key, moonlightValues[key]!])) }, unit: term.unit,
        dependencies: term.dependencies.map(key => `${moonlightPrefix}.${key}`), sourceRefs: term.sourceRefs };
      const value = executor ? executor(record) : evaluate(record.expression, record.values);
      result.stages.push({ ...record, result: value }); moonlightValues[term.suffix] = value;
    }
    if (stellarArtifactRules[index] !== undefined && c.reactionBonus !== stellarValues.bonus) throw new Error(`Stellar artifact recorded reaction bonus differs from derived window arithmetic for ${c.id}`);
    const reactionBonus = stellarArtifactRules[index] !== undefined
      ? stage(`${prefix}.reactionBonus`, "星辉圣遗物反应加成核验", variable("derivedBonus"), { derivedBonus: stellarValues.bonus! }, "ratio", [`${artifactPrefix}.bonus`], [...c.modifierSourceRefs, ...stellarArtifactRules[index]!.flatMap(term => term.sourceRefs)])
      : moonlightArtifactRules[index] ? stage(`${prefix}.reactionBonus`, "月曜圣遗物与手填反应加成合计", add(variable("manualReactionBonus"), variable("artifactReactionBonus"), variable("moonlightReactionBonus")), { manualReactionBonus: c.reactionBonus, artifactReactionBonus: artifactValues.bonus ?? 0, moonlightReactionBonus: moonlightValues.bonus ?? 0 }, "ratio", [...(artifactRules[index] ? [`${artifactPrefix}.bonus`] : []), ...(moonlightArtifactRules[index] ? [`${moonlightPrefix}.bonus`] : [])], [...c.modifierSourceRefs, ...(artifactRules[index]?.stages.flatMap(term => term.sourceRefs) ?? []), ...(moonlightArtifactRules[index]?.flatMap(term => term.sourceRefs) ?? [])])
      : artifactRules[index] ? stage(`${prefix}.reactionBonus`, "专属反应加成合计", add(variable("manualReactionBonus"), variable("artifactReactionBonus")), { manualReactionBonus: c.reactionBonus, artifactReactionBonus: artifactValues.bonus! }, "ratio", [`${artifactPrefix}.bonus`], [...c.modifierSourceRefs, ...artifactRules[index]!.stages.flatMap(term => term.sourceRefs)]) : c.reactionBonus;
    const augmented = stage(`${prefix}.augmented`, "special.augmented", add(mul(variable("scaled"), add(constant(1), variable("EMBonus"), variable("reactionBonus"))), variable("specialAdditive")), { scaled, EMBonus: em, reactionBonus, specialAdditive: c.specialAdditive }, "damage", [`${prefix}.scaled`, `${prefix}.em`, ...((artifactRules[index] || stellarArtifactRules[index] || moonlightArtifactRules[index]) ? [`${prefix}.reactionBonus`] : [])], [...refs, ...c.modifierSourceRefs]);
    const critChance = stage(`${prefix}.probability`, "special.critChance", max(constant(0), min(constant(1), variable("CR"))), { CR: c.critRate }, "probability");
    return { c, augmented, prefix, critChance };
  });
  const runOutcome = (id: string, criticalMask: boolean[], probability: number): SpecialOutcome => {
    const contributions = beforeCrit.map(({ c, augmented, prefix }, i) => {
      const critical = criticalMask[i]!;
      const crit = stage(`${id}.${i}.crit`, "special.critical", add(constant(1), mul(variable("critical"), variable("critDamage"))), { critical: critical ? 1 : 0, critDamage: c.critDamage }, "ratio", id === "sampled" ? [`sampled.${i}.decision`] : []);
      const contribution = stage(`${id}.${i}.damage`, "special.contribution", mul(variable("augmented"), variable("critMultiplier"), variable("resistance"), variable("elevationMultiplier")), { augmented, critMultiplier: crit, resistance, elevationMultiplier: c.elevationMultiplier }, "damage", [`${prefix}.augmented`, `${id}.${i}.crit`, "resistance"], [...refs, ...c.modifierSourceRefs]);
      return { contributorId: c.id, critical, contribution, index: i };
    });
    const sorted = [...contributions].sort((a, b) => b.contribution - a.contribution || (a.contributorId < b.contributorId ? -1 : a.contributorId > b.contributorId ? 1 : 0));
    const rankedContributions = sorted.map((c, rank) => {
      const weight = definition.mode === "direct" ? 1 : SPECIAL_RANK_WEIGHTS[rank]!;
      const weightedDamage = stage(`${id}.rank.${rank}`, "special.weighted", mul(variable("contribution"), variable("weight")), { contribution: c.contribution, weight }, "damage", [`${id}.${c.index}.damage`]);
      return { contributorId: c.contributorId, critical: c.critical, contribution: c.contribution, rank: rank + 1, weight, weightedDamage };
    });
    const damage = stage(`${id}.total`, "special.outcome", add(...rankedContributions.map((_, i) => variable(`rank${i + 1}`))), Object.fromEntries(rankedContributions.map((c, i) => [`rank${i + 1}`, c.weightedDamage])), "damage", rankedContributions.map((_, i) => `${id}.rank.${i}`));
    const top = rankedContributions.filter(c => c.contribution === rankedContributions[0]!.contribution);
    const displayedCritical = top.every(c => c.critical) ? "critical" : top.every(c => !c.critical) ? "non-critical" : "ambiguous-tie";
    return { id, probability, damage, rankedContributions, displayedCritical };
  };
  if (!recordedCritical?.onlyRecorded) {
  result.nonCritical = runOutcome("nonCritical", input.contributors.map(() => false), 1).damage;
  result.critical = runOutcome("critical", input.contributors.map(() => true), 1).damage;
  for (let mask = 0; mask < 2 ** input.contributors.length; mask++) {
    const criticalMask = input.contributors.map((_, index) => (mask & (1 << index)) !== 0);
    if (beforeCrit.some((c, index) => criticalMask[index] ? c.critChance === 0 : c.critChance === 1)) continue;
    const probabilities = beforeCrit.map((c, index) => stage(`expected.${mask}.probability.${index}`, "special.probability", criticalMask[index] ? variable("critChance") : sub(constant(1), variable("critChance")), { critChance: c.critChance }, "probability", [`${c.prefix}.probability`]));
    const probability = stage(`expected.${mask}.probability`, "special.probability", mul(...probabilities.map((_, i) => variable(`p${i}`))), Object.fromEntries(probabilities.map((p, i) => [`p${i}`, p])), "probability", probabilities.map((_, i) => `expected.${mask}.probability.${i}`));
    const outcome = runOutcome(`expected.${mask}`, criticalMask, probability);
    result.outcomes.push(outcome);
    stage(`expected.${mask}.weighted`, "special.expectedTerm", mul(variable("probability"), variable("damage")), { probability, damage: outcome.damage }, "damage", [`expected.${mask}.probability`, `expected.${mask}.total`]);
  }
  result.expected = stage("expected.total", "special.expected", add(...result.outcomes.map((_, i) => variable(`outcome${i}`))), Object.fromEntries(result.outcomes.map((o, i) => [`outcome${i}`, result.stages.find(s => s.id === `${o.id}.weighted`)!.result])), "damage", result.outcomes.map(o => `${o.id}.weighted`));
  }
  if (input.criticalExecution !== undefined) {
    const criticalMask = input.criticalExecution.draws.map((draw, index) => stage(
      `sampled.${index}.decision`, "special.sampledCritical",
      { kind: "condition", operator: "lte", left: variable("roll"), right: variable("CR"), whenTrue: constant(1), whenFalse: constant(0) },
      { roll: draw.roll, CR: beforeCrit[index]!.c.critRate }, "indicator", [],
    ) === 1);
    const probabilities = beforeCrit.map((c, index) => stage(`sampled.probability.${index}`, "special.probability", criticalMask[index] ? variable("critChance") : sub(constant(1), variable("critChance")), { critChance: c.critChance }, "probability", [`${c.prefix}.probability`, `sampled.${index}.decision`]));
    const probability = stage("sampled.probability", "special.probability", mul(...probabilities.map((_, index) => variable(`p${index}`))), Object.fromEntries(probabilities.map((value, index) => [`p${index}`, value])), "probability", probabilities.map((_, index) => `sampled.probability.${index}`));
    result.sampled = runOutcome("sampled", criticalMask, probability);
    result.warnings.push("采样伤害按已记录的逐贡献者随机数与原始暴击率执行，先暴击再排序；本次组合概率仅作说明，不再乘入本次伤害。命名随机流保证本地复现，不声称与外部模拟器同种子序列一致。");
  }
  if (recordedCritical !== undefined) {
    const mask = recordedCritical.draws.map((draw, index) => stage(
      `sampled.${index}.decision`, "special.recordedNativeCritical",
      draw.guaranteed ? constant(1) : { kind: "condition", operator: "lte", left: variable("roll"), right: variable("CR"), whenTrue: constant(1), whenFalse: constant(0) },
      draw.guaranteed ? {} : { roll: draw.roll!, CR: beforeCrit[index]!.c.critRate }, "indicator", [],
    ) === 1);
    const probabilities = beforeCrit.map((c, index) => stage(`sampled.probability.${index}`, "special.probability", recordedCritical.draws[index]!.guaranteed ? constant(1) : mask[index] ? variable("critChance") : sub(constant(1), variable("critChance")), { critChance: c.critChance }, "probability", [`${c.prefix}.probability`, `sampled.${index}.decision`]));
    const probability = stage("sampled.probability", "special.probability", mul(...probabilities.map((_, index) => variable(`p${index}`))), Object.fromEntries(probabilities.map((value, index) => [`p${index}`, value])), "probability", probabilities.map((_, index) => `sampled.probability.${index}`));
    result.sampled = runOutcome("sampled", mask, probability);
    result.warnings.push(`实际暴击来自 ${recordedCritical.source} 已保存的逐贡献者抽样或明确必暴；共享公式不再生成随机数。先完成各自暴击，再按实际贡献排序。`);
  }
  result.status = "calculated";
  if (definition.mode === "ranked-reaction") result.warnings.push("反应贡献先独立判定暴击，再按实际伤害排序；权重固定为 0.6、0.3、0.05、0.05，缺席贡献者不补权重。并列仅按 ID 稳定排列用于数值归属，不声称游戏归属规则。最高贡献并列且暴击状态不同则显示标记未确定。" );
  if (input.contributors.some(c => c.base.kind === "level-base" && c.base.evidence !== "source-verified")) result.warnings.push("等级基数为明确输入的合成或暂定数据；公式有来源不代表该等级基数已对本规则版本独立验证。" );
  return result;
}
