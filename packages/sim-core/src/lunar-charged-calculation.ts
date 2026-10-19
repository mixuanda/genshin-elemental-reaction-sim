import {
  CLASSIC_REACTION_FORMULA_PROFILE_ID,
  CLASSIC_REACTION_FORMULA_SOURCE_REVISION,
  LUNAR_ARTIFACT_BONUS_RULES,
  resolveReactionLevelBase,
  type LunarArtifactBonus,
  type MoonlightArtifactBonusSnapshot,
  type SpecialCalculationContext,
  type SpecialContributor,
} from "@genshin-dps-lab/reaction-formulas";
import type { CritMode } from "@genshin-dps-lab/schemas";
import type { CalculationTraceNode } from "./calculation-trace";
import { calculateSpecialCalculatorHit } from "./special-calculator";
import type { SpecialDamageIntent } from "./special-reaction-state";
import { specialDamageIntentToCalculationContext } from "./special-state-calculation";
import { specialExecutionDamage, type SpecialCriticalExecution, type SpecialRuntimeCriticalOutcome } from "./special-random";

export interface LunarChargedContributorSnapshot {
  actorId: string;
  level: number;
  elementalMastery: number;
  critRate: number;
  critDamage: number;
  artifactBonus?: LunarArtifactBonus;
  moonlightArtifactBonus?: MoonlightArtifactBonusSnapshot;
}

/**
 * Pinned combat/reaction.go CalcLunarReactionDmg calls CalcReactionBaseDmg,
 * which reads reactionLvlBase from reaction.dm.go. Thus this reference uses
 * the same exact level table as the existing fixed classic profile. Unlike the
 * source's clamp, unsupported levels are rejected rather than mapped to level100.
 * Selected artifact clauses use the captured runtime state; other special-only
 * bonuses are explicitly disabled in this bounded execution profile.
 */
export function calculateLunarChargedIntent(
  intent: SpecialDamageIntent,
  snapshots: LunarChargedContributorSnapshot[],
  effectiveResistance: number,
  critMode: CritMode,
  criticalExecution?: SpecialCriticalExecution,
): { context: SpecialCalculationContext; trace: CalculationTraceNode[]; damage: number } & SpecialRuntimeCriticalOutcome {
  if (intent.branch !== "lunar-charged-reaction") throw new Error("Automatic Lunar-Charged calculation requires lunar-charged-reaction intent");
  if (!["average", "allCrit", "noCrit"].includes(critMode)) throw new Error("Unsupported automatic Lunar-Charged critical mode");
  const root = `https://github.com/genshinsim/gcsim/blob/${CLASSIC_REACTION_FORMULA_SOURCE_REVISION}/pkg/core/combat/`;
  const contributors: SpecialContributor[] = snapshots.map(snapshot => ({
    id: snapshot.actorId,
    base: {
      kind: "level-base",
      characterLevel: snapshot.level,
      value: resolveReactionLevelBase(snapshot.level),
      evidence: "provisional",
      sourceRefs: [root + "reaction.go", root + "reaction.dm.go", CLASSIC_REACTION_FORMULA_PROFILE_ID],
    },
    elementalMastery: snapshot.elementalMastery,
    critRate: snapshot.critRate,
    critDamage: snapshot.critDamage,
    specialBaseBonus: 0,
    reactionBonus: 0,
    ...(snapshot.artifactBonus === undefined ? {} : { artifactBonus: snapshot.artifactBonus }),
    ...(snapshot.moonlightArtifactBonus === undefined ? {} : { moonlightArtifactBonus: snapshot.moonlightArtifactBonus }),
    specialAdditive: 0,
    elevationMultiplier: 1,
    modifierSourceRefs: [
      "reference-profile:explicitly-disabled-special-base-bonus-manual-reaction-bonus-additive-elevation",
      ...(snapshot.artifactBonus === undefined ? [] : [LUNAR_ARTIFACT_BONUS_RULES[snapshot.artifactBonus.kind].source]),
    ],
  }));
  const context = specialDamageIntentToCalculationContext(intent, contributors, effectiveResistance, {
    ordinaryReactionReplacementApplied: true,
    deliveryOperationsScheduled: true,
  });
  context.context.assumptions.push(
    "本自动月感电参考配置按本次取样的已选圣遗物状态执行对应月曜反应加成条款；其余手填反应加成明确为零，专属基础提升、专属加算、擢升与额外攻击仍关闭；不能把其缺失解释为完整角色机制。",
    "等级基数来自固定 gcsim Lunar 与 ordinary 共用的 reactionLvlBase 精确表，仅接受 1 至 100 级；不插值、不外推，不提升为当前服务器真值。",
  );
  if (criticalExecution !== undefined) context.criticalExecution = criticalExecution;
  const hit = calculateSpecialCalculatorHit(context, `lunar-charged-${intent.id}`, "自动月感电反应伤害");
  const damage = specialExecutionDamage(hit, critMode);
  if (hit.status !== "calculated" || damage === undefined || !Number.isFinite(damage)) throw new Error(`Automatic Lunar-Charged formula failed: ${hit.blockers.join("; ")}`);
  return { context, trace: hit.trace, damage, ...(hit.sampled === undefined ? {} : { criticalOutcome: hit.sampled }) };
}
