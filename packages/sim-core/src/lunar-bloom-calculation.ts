import { LUNAR_ARTIFACT_BONUS_RULES, SPECIAL_FORMULA_RULES, conditionedSpecialCalculationSchema, type LunarArtifactBonus, type MoonlightArtifactBonusSnapshot, type SpecialCalculationContext } from "@genshin-dps-lab/reaction-formulas";
import type { CritMode } from "@genshin-dps-lab/schemas";
import type { CalculationTraceNode } from "./calculation-trace";
import { calculateSpecialCalculatorHit } from "./special-calculator";
import { SPECIAL_STATE_PROFILE_ID } from "./special-reaction-state";
import { specialExecutionDamage, type SpecialCriticalExecution, type SpecialRuntimeCriticalOutcome } from "./special-random";

const sourceRoot = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/";
export const MOONDEW_CLEANSE = {
  key: "columbina-moondew-cleanse-idle-v1", characterKey: "columbina", fromState: "idle",
  consumeOffsetFrames: 55, hitOffsetsFrames: [62, 70, 92], animationFrames: 124, dewCost: 1,
  talentCoefficients: [0.015112, 0.016245, 0.017379, 0.01889, 0.020023, 0.021157, 0.022668, 0.024179, 0.02569, 0.027202, 0.028713, 0.030224, 0.032113, 0.034002, 0.035891],
  sourceRefs: [sourceRoot + "internal/characters/columbina/charge.go", sourceRoot + "internal/characters/columbina/zz_columbina.dm.go", sourceRoot + "internal/characters/columbina/asc.go", sourceRoot + "pkg/core/player/verdantdew.go"],
} as const;

export interface MoondewCleanseHit {
  actorId: string; targetId: string; sourceEventId: string; frame: number;
  talentLevel: number; ascension: number; constellation: 0; hitIndex: 0 | 1 | 2;
  /** Supplied by the executing runtime after actual generated Dew was consumed. */
  resourceConsumption: { sourceEventId: string; frame: number; consumed: 1 };
}
export interface LunarBloomSnapshot { hp: number; elementalMastery: number; critRate: number; critDamage: number; artifactBonus?: LunarArtifactBonus; moonlightArtifactBonus?: MoonlightArtifactBonusSnapshot; }

/** One real Moondew Cleanse hit, with fresh character inputs and live enemy RES. */
export function calculateMoondewCleanseHit(hit: MoondewCleanseHit, snapshot: LunarBloomSnapshot, effectiveResistance: number, critMode: CritMode, criticalExecution?: SpecialCriticalExecution): { context: SpecialCalculationContext; trace: CalculationTraceNode[]; damage: number } & SpecialRuntimeCriticalOutcome {
  const coefficient = MOONDEW_CLEANSE.talentCoefficients[hit.talentLevel - 1];
  if (!Number.isInteger(hit.talentLevel) || coefficient === undefined) throw new Error("Moondew Cleanse requires a sourced talent level from 1 to 15");
  const offset = MOONDEW_CLEANSE.hitOffsetsFrames[hit.hitIndex];
  if (offset === undefined || hit.resourceConsumption.consumed !== 1 || hit.resourceConsumption.sourceEventId !== hit.sourceEventId || hit.frame - hit.resourceConsumption.frame !== offset - MOONDEW_CLEANSE.consumeOffsetFrames) throw new Error("Moondew Cleanse hit must follow its actual one-Dew consumption and sourced hit timing");
  if (!["average", "allCrit", "noCrit"].includes(critMode)) throw new Error("Unsupported Lunar-Bloom critical mode");
  const context = conditionedSpecialCalculationSchema.parse({
    branch: "lunar-bloom-direct", ruleVersion: SPECIAL_FORMULA_RULES.lunar.id, effectiveResistance,
    contributors: [{ id: hit.actorId, base: { kind: "direct-stat-talent", scalingStat: "hp", statValue: snapshot.hp, talentCoefficient: coefficient, sourceRefs: [...MOONDEW_CLEANSE.sourceRefs] }, elementalMastery: snapshot.elementalMastery, critRate: snapshot.critRate, critDamage: snapshot.critDamage, specialBaseBonus: 0, specialBaseBonusRules: [{ kind: "columbina-moonsign-hp-v1", providerId: hit.actorId, maxHp: snapshot.hp }], reactionBonus: 0, ...(snapshot.artifactBonus === undefined ? {} : { artifactBonus: snapshot.artifactBonus }), ...(snapshot.moonlightArtifactBonus === undefined ? {} : { moonlightArtifactBonus: snapshot.moonlightArtifactBonus }), specialAdditive: 0, elevationMultiplier: 1, modifierSourceRefs: [sourceRoot + "internal/characters/columbina/asc.go", "reference-profile:manual-reaction-bonus-additive-elevation-explicitly-disabled", ...(snapshot.artifactBonus === undefined ? [] : [LUNAR_ARTIFACT_BONUS_RULES[snapshot.artifactBonus.kind].source])] }],
    context: { mode: "state-resolved", enablement: "resolved-enabled", contributorEligibility: "resolved", stateProfileId: SPECIAL_STATE_PROFILE_ID, sourceEventId: hit.sourceEventId, snapshotFrame: hit.frame, deliveryFrame: hit.frame, targetId: hit.targetId, ownerId: hit.actorId, contributorPolicy: "direct-ability-owner", stateSourceRefs: [...MOONDEW_CLEANSE.sourceRefs], auraAndDeliveryIntegration: "applied", sourceAbilityExecution: { abilityKey: MOONDEW_CLEANSE.key, characterKey: "columbina", effectiveTalentLevel: hit.talentLevel, ascension: hit.ascension, constellation: hit.constellation, fromState: "idle", castFrame: hit.frame - offset, hitIndex: hit.hitIndex, resourceReceipt: { ...hit.resourceConsumption, resource: "verdant-dew" } }, assumptions: [
      "真实普通绽放保留草原核；草露采用 verdant-dew-fixed-core-order-v2 的先玩家生产、后 +1 全局刷新规则。此直接伤害来自显式 Moondew Cleanse，已在对应 +55 帧消费实际生成的 1 草露。",
      "从闲置状态开始、60 FPS、无卡肉、单个静止且位于命中范围内的目标；本段使用当前 HP、EM、CR、CD 与敌人草抗。",
      "固有月兆基础提升已按来源执行；已选圣遗物按本击实际取样状态执行对应月曜反应加成条款，其余手填反应加成明确为零。本参考配置关闭领域、月岭露、Gravity、命座、额外命中修改器与其余专属加成。",
      "突破等级与 C0 由能力声明明确给出，有效天赋等级直接来自声明；不从角色等级推测突破或天赋加级。固有月兆初始化无突破门槛。",
      "无元素附着；不套用普通防御、普通增伤、普通加算。独立暴击模式无暴击反馈。固定社区源码与数据表一致，未声明当前游戏实测。",
    ] },
  });
  if (criticalExecution !== undefined) context.criticalExecution = criticalExecution;
  const calculation = calculateSpecialCalculatorHit(context, `moondew-${hit.sourceEventId}-${hit.hitIndex}`, `月露涤荡 · 第 ${hit.hitIndex + 1} 段`);
  const damage = specialExecutionDamage(calculation, critMode);
  if (calculation.status !== "calculated" || damage === undefined || !Number.isFinite(damage)) throw new Error(`Moondew Cleanse calculation failed: ${calculation.blockers.join("; ")}`);
  return { context, trace: calculation.trace, damage, ...(calculation.sampled === undefined ? {} : { criticalOutcome: calculation.sampled }) };
}
