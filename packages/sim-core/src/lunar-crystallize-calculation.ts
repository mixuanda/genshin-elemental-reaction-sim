import { CLASSIC_REACTION_FORMULA_PROFILE_ID, CLASSIC_REACTION_FORMULA_SOURCE_REVISION, LUNAR_ARTIFACT_BONUS_RULES, resolveReactionLevelBase, type SpecialCalculationContext, type SpecialContributor } from "@genshin-dps-lab/reaction-formulas";
import type { CritMode } from "@genshin-dps-lab/schemas";
import type { CalculationTraceNode } from "./calculation-trace";
import type { LunarChargedContributorSnapshot } from "./lunar-charged-calculation";
import { calculateSpecialCalculatorHit } from "./special-calculator";
import type { SpecialDamageIntent } from "./special-reaction-state";
import { specialDamageIntentToCalculationContext } from "./special-state-calculation";
import { specialExecutionDamage, type SpecialCriticalExecution, type SpecialRuntimeCriticalOutcome } from "./special-random";

export type LunarCrystallizeContributorSnapshot = LunarChargedContributorSnapshot;

/**
 * Capture these character inputs at the intent's snapshotFrame; call this with
 * enemy Geo resistance resolved at deliveryFrame. Fixed source snapshots each
 * volley hit at +13/+25/+37 and sends it through QueueAttackWithSnap with +10f
 * travel. The target's HandleAttack resolves enemy resistance on actual delivery.
 */
export function calculateLunarCrystallizeIntent(
  intent: SpecialDamageIntent,
  snapshots: LunarCrystallizeContributorSnapshot[],
  effectiveResistance: number,
  critMode: CritMode,
  criticalExecution?: SpecialCriticalExecution,
): { context: SpecialCalculationContext; trace: CalculationTraceNode[]; damage: number } & SpecialRuntimeCriticalOutcome {
  if (intent.branch !== "lunar-crystallize-reaction" || intent.contributorPolicy !== "captured-since-last-volley") throw new Error("Automatic Lunar-Crystallize calculation requires its captured-volley reaction intent");
  if (intent.deliveryFrame !== intent.snapshotFrame + 10) throw new Error("The fixed Lunar-Crystallize profile requires ten-frame travel after each character snapshot");
  if (!["average", "allCrit", "noCrit"].includes(critMode)) throw new Error("Unsupported automatic Lunar-Crystallize critical mode");
  const root = `https://github.com/genshinsim/gcsim/blob/${CLASSIC_REACTION_FORMULA_SOURCE_REVISION}/`;
  const contributors: SpecialContributor[] = snapshots.map(snapshot => ({
    id: snapshot.actorId,
    base: { kind: "level-base", characterLevel: snapshot.level, value: resolveReactionLevelBase(snapshot.level), evidence: "provisional", sourceRefs: [root + "pkg/core/combat/reaction.go", root + "pkg/core/combat/reaction.dm.go", CLASSIC_REACTION_FORMULA_PROFILE_ID] },
    elementalMastery: snapshot.elementalMastery,
    critRate: snapshot.critRate,
    critDamage: snapshot.critDamage,
    specialBaseBonus: 0, reactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1,
    ...(snapshot.artifactBonus === undefined ? {} : { artifactBonus: snapshot.artifactBonus }),
    ...(snapshot.moonlightArtifactBonus === undefined ? {} : { moonlightArtifactBonus: snapshot.moonlightArtifactBonus }),
    modifierSourceRefs: [
      "reference-profile:explicitly-disabled-special-base-bonus-manual-reaction-bonus-additive-elevation",
      ...(snapshot.artifactBonus === undefined ? [] : [LUNAR_ARTIFACT_BONUS_RULES[snapshot.artifactBonus.kind].source]),
    ],
  }));
  const context = specialDamageIntentToCalculationContext(intent, contributors, effectiveResistance, { ordinaryReactionReplacementApplied: true, deliveryOperationsScheduled: true });
  context.context.assumptions.push(
    "本自动月结晶参考配置按本次取样的已选圣遗物状态执行对应月曜反应加成条款；其余手填反应加成明确为零，专属基础提升、专属加算、擢升与额外攻击仍关闭；仅数值、参与者和所述状态规则可执行，不代表角色完整机制。",
    "每轮贡献者身份在谐律触发时捕获；每段分别在 +13/+25/+37 帧拍人物属性，敌人岩抗在再过 10 帧的实际投递时读取，不把敌人抗性锁进人物快照。",
    "等级基数来自同固定 gcsim Lunar 共用的 reactionLvlBase 精确表，仅接受 1 至 100 级，不插值、不外推。",
  );
  if (context.context.mode === "state-resolved") context.context.stateSourceRefs.push(root + "pkg/reactable/lunarcrystallize.go", root + "pkg/core/attack.go", root + "pkg/enemy/damage.go", root + "pkg/enemy/mods.go");
  if (criticalExecution !== undefined) context.criticalExecution = criticalExecution;
  const hit = calculateSpecialCalculatorHit(context, `lunar-crystallize-${intent.id}`, "自动月结晶反应伤害");
  const damage = specialExecutionDamage(hit, critMode);
  if (hit.status !== "calculated" || damage === undefined || !Number.isFinite(damage)) throw new Error(`Automatic Lunar-Crystallize formula failed: ${hit.blockers.join("; ")}`);
  return { context, trace: hit.trace, damage, ...(hit.sampled === undefined ? {} : { criticalOutcome: hit.sampled }) };
}
