import { ENEMY_SHIELD_FORMULA_PROFILE, STANDARD_HOST_FORCE_SHIELD_REACTION_COEFFICIENTS } from "@genshin-dps-lab/reaction-formulas";
import { TraceBuilder, expr, traceInput, type CalculationTraceNode } from "./calculation-trace";

const detailed = "https://docs.google.com/document/d/1SUc9A7O5C7CX0qYHmCqB44uhpHYY-Txgv6rdibM8Jw4/edit";
export const ENEMY_SHIELD_PROFILE = {
  id: "kqm-enemy-shield-gauge-20260925-v1", status: "provisional", sourceRefs: [...ENEMY_SHIELD_FORMULA_PROFILE.sourceRefs],
  assumptions: [
    "盾量以 GU 计量；总消耗为实际反应消耗、无增幅伤害转换和实际削韧转换之和。",
    "模型只处理已实际发生的生成、命中、反应 tick 和移除；不推测敌人 AI、生成时刻、朝向、自然衰减或再生。",
    "标准元素盾的直接反应系数仅覆盖下表已有来源项；感电只按实际 tick 消耗，不把一次元素应用展开为猜测的 tick 数。",
    "护甲允许生命伤害穿透且伤害削盾项为零；具体敌人的额外抗性由场景明确提供，不能泛化为所有护甲加 100% 抗性。",
    "击破一击的生命伤害转移须有独立明确依据；未提供时返回未解析，不捏造零溢出或按 GU 比例转换生命。",
  ],
} as const;

export type EnemyShieldElement = "pyro" | "hydro" | "electro" | "frozen" | "geo";
export type EnemyShieldDamageElement = "physical" | "pyro" | "hydro" | "electro" | "cryo" | "dendro" | "anemo" | "geo";
export type EnemyShieldKind = "elemental-force" | "elemental-armor";

/** Exact non-periodic entries supported by the archived tables. Omitted is unknown, not zero. */
export const STANDARD_FORCE_SHIELD_REACTION_COEFFICIENTS: Readonly<Record<EnemyShieldElement, Partial<Record<EnemyShieldDamageElement, number>>>> = {
  pyro: STANDARD_HOST_FORCE_SHIELD_REACTION_COEFFICIENTS.pyro,
  frozen: STANDARD_HOST_FORCE_SHIELD_REACTION_COEFFICIENTS.frozen,
  hydro: { physical: 0, pyro: 0.5, hydro: 0, cryo: 1, anemo: 0.5, geo: 0.5 },
  electro: { physical: 0, pyro: 1, electro: 0, cryo: 1, anemo: 0.5, geo: 0.5 },
  geo: { physical: 0, geo: 0 },
};

export interface EnemyShieldDefinition {
  id: string;
  targetId: string;
  kind: EnemyShieldKind;
  element: EnemyShieldElement;
  /** Effective maximum GU including explicitly known scenario modifiers. */
  maxGaugeUnits: number;
  /** Actual target maximum HP; never the current HP or a guessed level table. */
  targetMaxHp: number;
  /** Required for force shields; ordinary common values .2 and 1 are not universal defaults. */
  damageConversionRatio: number;
  shieldHpRatio: number;
  /** Explicit phase identity only. Phase stat/resistance application belongs to the target host. */
  activePhaseId: string;
  brokenPhaseId: string;
  /** Optional known armor resistance change; the host applies this BEFORE computing damage. */
  armorResistanceBonus?: Partial<Record<EnemyShieldDamageElement, number>>;
  sourceRefs: string[];
}

export interface EnemyShieldEventPoint {
  frame: number;
  eventPriority: number;
  eventSequence: number;
  intraEventSequence: number;
  sourceEventId: string;
}
export interface EnemyShieldState {
  definitionId: string;
  targetId: string;
  generation: number;
  active: boolean;
  gaugeUnits: number;
  createdFrame: number;
  removedFrame: number | null;
  phaseId: string;
}
export type EnemyShieldReactionInput =
  | { kind: "none"; reason: "icd-blocked" | "no-elemental-application" | "no-shield-reaction" }
  | { kind: "standard-force-application"; element: EnemyShieldDamageElement; gaugeUnitsReachingShield: number; applicationEventId: string }
  | { kind: "electro-charged-tick"; reactionEventId: string }
  /** For armor, Geo crystallize or other supported external resolvers: preserve actual coefficient and provenance. */
  | { kind: "resolved-reaction"; reaction: string; gaugeUnitsReachingShield: number; coefficient: number; reactionEventId: string; sourceRefs: string[] };
export interface EnemyShieldHitInput extends EnemyShieldEventPoint {
  targetId: string;
  damageEventId: number | null;
  damageElement: EnemyShieldDamageElement;
  /** Actual HP damage from the common core, after pre-hit target defense/resistance. */
  finalDamage: number;
  /** Same actual crit/DEF/RES/snapshot, with ONLY amplifying multiplier removed; transformative EM is retained. */
  damageWithoutAmplifyingReaction: number;
  reaction: EnemyShieldReactionInput;
  /** Actual attack metadata; weapon class, damage number and elemental gauge do not infer poise. */
  poise: { attackType: "none" | "melee" | "ranged"; strikeType: "none" | "default" | "slash" | "pierce" | "blunt" | "spear"; initialDamage: number; sourceRef: string };
  /** Optional independently resolved transfer for the actual shield-breaking hit. */
  breakingHitTransfer?: { hpDamage: number; sourceRef: string };
}
export interface EnemyShieldHpDisposition {
  kind: "unshielded" | "shield-blocked" | "armor-passthrough" | "breaking-hit-resolved" | "breaking-hit-unresolved";
  damage: number | null;
}
export interface EnemyShieldLogEntry extends EnemyShieldEventPoint {
  id: number;
  kind: "create" | "replace" | "hit" | "remove";
  targetId: string;
  definitionId: string;
  damageEventId: number | null;
  before: EnemyShieldState | null;
  after: EnemyShieldState;
  reactionCost: number;
  damageCost: number;
  poiseCost: number;
  totalGaugeCost: number;
  effectiveGaugeCost: number;
  excessGaugeCost: number;
  broken: boolean;
  hpDisposition: EnemyShieldHpDisposition | null;
  input: EnemyShieldHitInput | null;
  sourceRefs: string[];
  trace: CalculationTraceNode[];
}
export interface EnemyShieldHitResult {
  hpDisposition: EnemyShieldHpDisposition;
  log: EnemyShieldLogEntry | null;
  phaseTransition: { from: string; to: string; reason: "shield-broken" } | null;
}

const nonnegative = (value: number, label: string): void => { if (!Number.isFinite(value) || value < 0) throw new Error(`${label}须为明确非负有限值。`); };
const positive = (value: number, label: string): void => { if (!Number.isFinite(value) || value <= 0) throw new Error(`${label}须为明确正有限值。`); };
const pointValid = (point: EnemyShieldEventPoint): void => { if (!Number.isSafeInteger(point.frame) || point.frame < 0 || !point.sourceEventId) throw new Error("敌盾事件需要实际帧与来源事件标识。"); };

/** Independent settlement primitive: no synthetic Aura engine, schedule, HP map or weapon callback bus. */
export class EnemyShieldRuntime {
  readonly log: EnemyShieldLogEntry[] = [];
  private readonly definitions = new Map<string, EnemyShieldDefinition>();
  private readonly states = new Map<string, EnemyShieldState>();
  constructor(definitions: readonly EnemyShieldDefinition[]) {
    for (const definition of definitions) {
      if (this.definitions.has(definition.id)) throw new Error(`重复敌盾定义：${definition.id}`);
      positive(definition.maxGaugeUnits, "最大盾 GU"); positive(definition.targetMaxHp, "敌人最大生命"); positive(definition.shieldHpRatio, "盾生命比例"); nonnegative(definition.damageConversionRatio, "伤害转换率");
      if (!definition.id || !definition.targetId || !definition.activePhaseId || !definition.brokenPhaseId || !definition.sourceRefs.length) throw new Error("敌盾定义须明确身份、阶段与数值来源。");
      if (definition.kind === "elemental-armor" && definition.damageConversionRatio !== 0) throw new Error("元素护甲的伤害削盾转换率必须为 0；生命伤害穿透护甲。");
      if (definition.kind !== "elemental-armor" && definition.armorResistanceBonus) throw new Error("护甲抗性修正不能套入元素力场盾定义。");
      this.definitions.set(definition.id, structuredClone(definition));
    }
  }

  /** Call only when the actual enemy phase creates a shield; construction alone creates no shield. */
  create(definitionId: string, point: EnemyShieldEventPoint, initialGaugeUnits?: number): EnemyShieldLogEntry {
    pointValid(point);
    const definition = this.definitions.get(definitionId); if (!definition) throw new Error(`未知敌盾定义：${definitionId}`);
    const gauge = initialGaugeUnits ?? definition.maxGaugeUnits; positive(gauge, "实际生成盾 GU");
    if (gauge > definition.maxGaugeUnits) throw new Error("实际生成盾 GU 不得超过明确的最大盾量。");
    const old = this.states.get(definition.targetId), before = old ? structuredClone(old) : null;
    const b = new TraceBuilder([...ENEMY_SHIELD_PROFILE.sourceRefs, ...definition.sourceRefs]);
    const gaugeUnits = b.add("enemyShield.created", "实际生成的元素盾量", expr.input("actualInitialGauge"), [traceInput("actualInitialGauge", gauge, "GU", point.sourceEventId, "真实生成事件明确的初始盾量")], { unit: "GU", status: "assumed", explanationKey: "只在实际生成事件建立盾；配置定义本身不产生护盾。" });
    const after: EnemyShieldState = { definitionId, targetId: definition.targetId, generation: (old?.generation ?? 0) + 1, active: true, gaugeUnits, createdFrame: point.frame, removedFrame: null, phaseId: definition.activePhaseId };
    this.states.set(definition.targetId, after);
    return this.record({ ...point, kind: old?.active ? "replace" : "create", targetId: definition.targetId, definitionId, damageEventId: null, before, after: structuredClone(after), reactionCost: 0, damageCost: 0, poiseCost: 0, totalGaugeCost: 0, effectiveGaugeCost: 0, excessGaugeCost: 0, broken: false, hpDisposition: null, input: null, sourceRefs: [...ENEMY_SHIELD_PROFILE.sourceRefs, ...definition.sourceRefs], trace: b.nodes });
  }

  /** Read before the common damage calculation; armor bonuses are not applied a second time here. */
  targetPolicy(targetId: string): { kind: EnemyShieldKind; element: EnemyShieldElement; phaseId: string; armorResistanceBonus: Partial<Record<EnemyShieldDamageElement, number>> } | null {
    const state = this.states.get(targetId); if (!state?.active) return null;
    const definition = this.definitions.get(state.definitionId)!;
    return { kind: definition.kind, element: definition.element, phaseId: state.phaseId, armorResistanceBonus: { ...definition.armorResistanceBonus } };
  }

  settle(input: EnemyShieldHitInput): EnemyShieldHitResult {
    pointValid(input); nonnegative(input.finalDamage, "实际伤害"); nonnegative(input.damageWithoutAmplifyingReaction, "无增幅伤害"); nonnegative(input.poise.initialDamage, "实际初始削韧");
    const state = this.states.get(input.targetId);
    if (!state?.active) return { hpDisposition: { kind: "unshielded", damage: input.finalDamage }, log: null, phaseTransition: null };
    const definition = this.definitions.get(state.definitionId)!, before = structuredClone(state);
    const sources = [...ENEMY_SHIELD_PROFILE.sourceRefs, ...definition.sourceRefs, input.poise.sourceRef, ...(input.reaction.kind === "resolved-reaction" ? input.reaction.sourceRefs : []), ...(input.breakingHitTransfer ? [input.breakingHitTransfer.sourceRef] : [])];
    const b = new TraceBuilder(sources);
    let coefficient = 0, appliedGauge = 0;
    if (input.reaction.kind === "standard-force-application") {
      if (definition.kind !== "elemental-force") throw new Error("不能把标准元素力场盾系数套用到护甲；需真实护甲反应解析结果。");
      const known = STANDARD_FORCE_SHIELD_REACTION_COEFFICIENTS[definition.element][input.reaction.element];
      if (known === undefined) throw new Error(`来源未闭合 ${input.reaction.element}→${definition.element} 的直接盾量消耗；不能按 0 或普通 Aura 系数猜测。`);
      coefficient = known; appliedGauge = input.reaction.gaugeUnitsReachingShield;
    } else if (input.reaction.kind === "electro-charged-tick") {
      if (definition.kind !== "elemental-force" || (definition.element !== "hydro" && definition.element !== "electro")) throw new Error("0.4 GU 感电 tick 分支只适用于当前范围的水／雷元素力场盾。");
      coefficient = 1; appliedGauge = 0.4;
    } else if (input.reaction.kind === "resolved-reaction") {
      if (!input.reaction.sourceRefs.length || !input.reaction.reactionEventId) throw new Error("已解析削盾反应须保存真实反应事件和系数来源。");
      coefficient = input.reaction.coefficient; appliedGauge = input.reaction.gaugeUnitsReachingShield;
    }
    nonnegative(coefficient, "实际削盾反应系数"); nonnegative(appliedGauge, "实际到达护盾的元素量");
    const v = (key: string, value: number, unit: string, meaning: string) => traceInput(key, value, unit, input.sourceEventId, meaning);
    const reactionCost = b.add("enemyShield.reaction", "实际反应消耗盾量", expr.mul(expr.input("reactionCoefficient"), expr.input("gaugeReachingShield")), [v("reactionCoefficient", coefficient, "ratio", "当前盾类型和实际反应对应系数"), v("gaugeReachingShield", appliedGauge, "GU", "已通过实际 ICD 和外来 Aura 消耗后的盾反应输入；感电只取本次真实 tick")], { unit: "GU", explanationKey: "不从伤害数字、攻击次数或技能名称推断元素附着。未发生反应时本项为 0。" });
    const matchesElement = input.damageElement === (definition.element === "frozen" ? "cryo" : definition.element) && definition.element !== "geo";
    const damageBasis = b.add("enemyShield.damageBasis", "元素匹配后的无增幅伤害", expr.condition("equal", expr.input("immuneSameElement"), expr.value(1), expr.value(0), expr.input("unamplifiedDamage")), [v("immuneSameElement", matchesElement ? 1 : 0, "boolean", "同元素盾伤害项免疫；岩盾除外"), v("unamplifiedDamage", input.damageWithoutAmplifyingReaction, "damage", "共享核心保留实际暴击、DEF、RES、增伤；排除蒸发融化增幅，保留剧变精通")], { unit: "damage", explanationKey: "伤害削盾不使用蒸发或融化放大后的数字；剧变伤害仍包含实际精通倍率。" });
    const damageCost = b.add("enemyShield.damage", "伤害转换为盾 GU", expr.div(expr.mul(expr.input("damageConversionRatio"), expr.input("damageBasis"), expr.input("maxShieldGauge")), expr.mul(expr.input("shieldHpRatio"), expr.input("targetMaxHp"))), [v("damageConversionRatio", definition.damageConversionRatio, "ratio", "该盾明确的伤害转换率；护甲为 0"), v("damageBasis", damageBasis, "damage", "上一节点给出的实际无增幅伤害"), v("maxShieldGauge", definition.maxGaugeUnits, "GU", "包含明确场景倍率的最大盾量；不是剩余盾量"), v("shieldHpRatio", definition.shieldHpRatio, "ratio", "该盾明确的生命比例"), v("targetMaxHp", definition.targetMaxHp, "HP", "该目标实际最大生命")], { unit: "GU", childIds: ["enemyShield.damageBasis"], explanationKey: "将普通或剧变伤害转换成盾量；敌人当前生命不改变此分母。" });
    const poiseRatio = definition.element === "geo" ? (input.poise.strikeType === "blunt" ? 0.014 : input.poise.attackType === "melee" ? 0.002 : 0) : definition.element === "frozen" && input.poise.strikeType === "blunt" ? 0.006 : 0;
    const poiseCost = b.add("enemyShield.poise", "实际削韧转换为盾 GU", expr.mul(expr.input("initialPoise"), expr.input("poiseConversionRatio")), [v("initialPoise", input.poise.initialDamage, "poise", "该实际攻击来源的初始削韧，不由天赋等级或武器类型猜测"), v("poiseConversionRatio", poiseRatio, "GU/poise", "岩盾 Blunt 0.014、其他 Melee 0.002；Frozen 盾 Blunt 0.006；其余不适用")], { unit: "GU", explanationKey: "Blunt 优先采用其转换率，不再重复累加 Melee；元素削盾仍独立计算。" });
    const totalGaugeCost = b.add("enemyShield.total", "本次总削盾量", expr.add(expr.input("reactionCost"), expr.input("damageCost"), expr.input("poiseCost")), [v("reactionCost", reactionCost, "GU", "实际反应消耗"), v("damageCost", damageCost, "GU", "伤害转换消耗"), v("poiseCost", poiseCost, "GU", "削韧转换消耗")], { unit: "GU", childIds: ["enemyShield.reaction", "enemyShield.damage", "enemyShield.poise"], explanationKey: "三个来源项相加；不另建普通伤害引擎。" });
    const effectiveGaugeCost = b.add("enemyShield.effective", "实际扣除盾量", expr.min(expr.input("before"), expr.input("total")), [v("before", state.gaugeUnits, "GU", "事件前真实剩余盾量"), v("total", totalGaugeCost, "GU", "本次三个来源项总计")], { unit: "GU", childIds: ["enemyShield.total"], explanationKey: "实际扣除不超过当前盾量。" });
    const afterGauge = b.add("enemyShield.remaining", "事件后剩余盾量", expr.sub(expr.input("before"), expr.input("effective")), [v("before", state.gaugeUnits, "GU", "事件前盾量"), v("effective", effectiveGaugeCost, "GU", "实际扣除盾量")], { unit: "GU", childIds: ["enemyShield.effective"], explanationKey: "此实际计算结果直接写入共享盾状态。" });
    const excessGaugeCost = b.add("enemyShield.excess", "超出当前盾量的 GU", expr.sub(expr.input("total"), expr.input("effective")), [v("total", totalGaugeCost, "GU", "完整理论削盾量"), v("effective", effectiveGaugeCost, "GU", "实际扣除盾量")], { unit: "GU", explanationKey: "额外 GU 不能自行转换成敌人生命伤害。" });
    const broken = b.add("enemyShield.broken", "本次是否击破", expr.condition("equal", expr.input("remaining"), expr.value(0), expr.value(1), expr.value(0)), [v("remaining", afterGauge, "GU", "事件后真实盾量")], { unit: "boolean", childIds: ["enemyShield.remaining"], explanationKey: "只对事件前实际存在的盾结算；盾量归零立即移除并返回明确阶段转换。" }) === 1;
    if (input.breakingHitTransfer) { nonnegative(input.breakingHitTransfer.hpDamage, "真实击破一击生命转移"); if (input.breakingHitTransfer.hpDamage > input.finalDamage || !input.breakingHitTransfer.sourceRef) throw new Error("击破一击生命转移须有来源且不超过已计算伤害。"); }
    const hpDisposition: EnemyShieldHpDisposition = definition.kind === "elemental-armor" ? { kind: "armor-passthrough", damage: input.finalDamage } : !broken ? { kind: "shield-blocked", damage: 0 } : input.breakingHitTransfer ? { kind: "breaking-hit-resolved", damage: input.breakingHitTransfer.hpDamage } : { kind: "breaking-hit-unresolved", damage: null };
    state.gaugeUnits = afterGauge;
    if (broken) { state.active = false; state.removedFrame = input.frame; state.phaseId = definition.brokenPhaseId; }
    const entry = this.record({ frame: input.frame, eventPriority: input.eventPriority, eventSequence: input.eventSequence, intraEventSequence: input.intraEventSequence, sourceEventId: input.sourceEventId, kind: "hit", targetId: input.targetId, definitionId: definition.id, damageEventId: input.damageEventId, before, after: structuredClone(state), reactionCost, damageCost, poiseCost, totalGaugeCost, effectiveGaugeCost, excessGaugeCost, broken, hpDisposition, input: structuredClone(input), sourceRefs: sources, trace: b.nodes });
    return { hpDisposition, log: entry, phaseTransition: broken ? { from: before.phaseId, to: state.phaseId, reason: "shield-broken" } : null };
  }

  /** Explicit enemy phase removal; never inferred from a planned attack or an expired observation. */
  remove(targetId: string, nextPhaseId: string, point: EnemyShieldEventPoint): EnemyShieldLogEntry | null {
    pointValid(point); const state = this.states.get(targetId); if (!state?.active) return null;
    if (!nextPhaseId) throw new Error("实际移除事件须明确后续阶段身份。");
    const before = structuredClone(state), definition = this.definitions.get(state.definitionId)!;
    state.active = false; state.removedFrame = point.frame; state.phaseId = nextPhaseId;
    return this.record({ ...point, kind: "remove", targetId, definitionId: definition.id, damageEventId: null, before, after: structuredClone(state), reactionCost: 0, damageCost: 0, poiseCost: 0, totalGaugeCost: 0, effectiveGaugeCost: 0, excessGaugeCost: 0, broken: false, hpDisposition: null, input: null, sourceRefs: [...ENEMY_SHIELD_PROFILE.sourceRefs, ...definition.sourceRefs], trace: [] });
  }
  captureState(): EnemyShieldState[] { return [...this.states.values()].map(state => structuredClone(state)); }
  private record(entry: Omit<EnemyShieldLogEntry, "id">): EnemyShieldLogEntry { const recorded = { id: this.log.length, ...entry }; this.log.push(recorded); return recorded; }
}

/** Historical KQM standard Abyss Mage profile. Scenario multipliers and enemy HP stay explicit. */
export function createStandardAbyssMageShieldDefinition(input: {
  id: string;
  targetId: string;
  element: Exclude<EnemyShieldElement, "geo">;
  targetMaxHp: number;
  shieldGaugeMultiplier: number;
  activePhaseId: string;
  brokenPhaseId: string;
  scenarioSourceRef: string;
}): { definition: EnemyShieldDefinition; trace: CalculationTraceNode[] } {
  positive(input.targetMaxHp, "实际敌人最大生命"); positive(input.shieldGaugeMultiplier, "明确场景盾量倍率");
  if (!input.scenarioSourceRef) throw new Error("场景最大生命与盾量倍率须有明确来源，不自动推算深渊、秘境或联机倍率。");
  const b = new TraceBuilder([...ENEMY_SHIELD_PROFILE.sourceRefs, input.scenarioSourceRef]);
  const maxGaugeUnits = b.add("enemyShield.abyssMage.maximum", "标准深渊法师实际最大盾量", expr.mul(expr.input("baseShieldGauge"), expr.input("scenarioMultiplier")), [traceInput("baseShieldGauge", input.element === "electro" ? 8 : ENEMY_SHIELD_FORMULA_PROFILE.standardAbyssMage.baseGaugeUnits, "GU", detailed, "固定文档：雷盾 8 GU，火、水、Frozen 盾 12 GU"), traceInput("scenarioMultiplier", input.shieldGaugeMultiplier, "ratio", input.scenarioSourceRef, "当前场景明确的盾量倍率，与敌人生命倍率分开")], { unit: "GU", status: "assumed", explanationKey: "仅采用已固定的标准法师参数；不把未知秘境或版本中的盾量归一为普通世界。" });
  return { definition: { id: input.id, targetId: input.targetId, kind: "elemental-force", element: input.element, maxGaugeUnits, targetMaxHp: input.targetMaxHp, damageConversionRatio: ENEMY_SHIELD_FORMULA_PROFILE.standardAbyssMage.damageConversionRatio, shieldHpRatio: ENEMY_SHIELD_FORMULA_PROFILE.standardAbyssMage.shieldHpRatio, activePhaseId: input.activePhaseId, brokenPhaseId: input.brokenPhaseId, sourceRefs: [...ENEMY_SHIELD_PROFILE.sourceRefs, input.scenarioSourceRef] }, trace: b.nodes };
}
