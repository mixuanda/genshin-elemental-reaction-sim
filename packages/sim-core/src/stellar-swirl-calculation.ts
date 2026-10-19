import { resolveReactionLevelBase, type SpecialCalculationContext, type SpecialContributor, type StellarArtifactBonusSnapshot } from "@genshin-dps-lab/reaction-formulas";
import type { CritMode } from "@genshin-dps-lab/schemas";
import type { CalculationTraceNode } from "./calculation-trace";
import type { LunarChargedContributorSnapshot } from "./lunar-charged-calculation";
import { calculateSpecialCalculatorHit } from "./special-calculator";
import type { SpecialDamageIntent } from "./special-reaction-state";
import { specialDamageIntentToCalculationContext } from "./special-state-calculation";

export const STELLAR_SWIRL_SOURCE_REVISION="a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd";
export const STELLAR_SWIRL_SOURCE_ROOT=`https://github.com/genshinsim/gcsim/blob/${STELLAR_SWIRL_SOURCE_REVISION}/`;
export type StellarSwirlContributorSnapshot=LunarChargedContributorSnapshot & { reactionBonus?: number; modifierSourceRefs?: string[]; stellarArtifactBonus?: StellarArtifactBonusSnapshot };
/** Supplied by the host only after replacement and this hit's delivery operations executed. */
export interface StellarSwirlIntegrationProof {
  ordinaryReactionReplacementApplied:true;
  deliveryOperationsApplied:true;
}

export function calculateStellarSwirlIntent(
  intent:SpecialDamageIntent,
  snapshots:StellarSwirlContributorSnapshot[],
  effectiveResistance:number,
  critMode:CritMode,
  integration:StellarSwirlIntegrationProof,
):{context:SpecialCalculationContext;trace:CalculationTraceNode[];damage:number} {
  const initial=intent.branch==="stellar-swirl-anemo-reaction";
  if(!initial&&intent.branch!=="stellar-swirl-vortex-1"&&intent.branch!=="stellar-swirl-vortex-2")throw new Error("Stellar Swirl adapter accepts only its initial Anemo and vortex Cryo reaction branches");
  if(intent.evidence!=="guide-profile-source-conflict")throw new Error("Stellar Swirl reference execution must retain the guide/source conflict evidence status");
  if(intent.element!==(initial?"anemo":"cryo")||intent.deliveryFrame!==intent.snapshotFrame+(initial?3:0))throw new Error("Stellar Swirl requires initial Anemo snapshot +3f delivery or same-frame vortex Cryo delivery");
  if(integration.ordinaryReactionReplacementApplied!==true||integration.deliveryOperationsApplied!==true)throw new Error("Stellar Swirl state-resolved damage requires actual host reaction replacement and completed delivery operations");
  if(!["average","allCrit","noCrit"].includes(critMode))throw new Error("Special contributor seeded critical sampling is not implemented");
  const contributors:SpecialContributor[]=snapshots.map(snapshot=>({
    id:snapshot.actorId,
    base:{kind:"level-base",characterLevel:snapshot.level,value:resolveReactionLevelBase(snapshot.level),evidence:"provisional",sourceRefs:[STELLAR_SWIRL_SOURCE_ROOT+"pkg/core/combat/reaction.go",STELLAR_SWIRL_SOURCE_ROOT+"pkg/core/combat/reaction.dm.go"]},
    elementalMastery:snapshot.elementalMastery,critRate:snapshot.critRate,critDamage:snapshot.critDamage,
    specialBaseBonus:0,reactionBonus:snapshot.reactionBonus??0,specialAdditive:0,elevationMultiplier:1,
    modifierSourceRefs:snapshot.stellarArtifactBonus!==undefined
      ? ["reference-profile:explicitly-disabled-special-base-bonus-additive-elevation",...(snapshot.modifierSourceRefs??[])]
      : ["reference-profile:explicitly-disabled-special-base-bonus-reaction-bonus-additive-elevation"],
    ...(snapshot.stellarArtifactBonus===undefined?{}:{stellarArtifactBonus:snapshot.stellarArtifactBonus}),
  }));
  const context=specialDamageIntentToCalculationContext(intent,contributors,effectiveResistance,{ordinaryReactionReplacementApplied:true,deliveryOperationsScheduled:true});
  context.context.assumptions.push(
    "星扩散采用指南的逐次计数、三次升级、六次提前引爆及180帧寿命；固定源码存在1→3→7递增、实体类型与181帧冲突，保留guide-profile-source-conflict。",
    "人物属性在该段snapshotFrame取样；敌人风/冰抗在实际deliveryFrame读取。漩涡1U冰及归属由宿主Aura引擎实际应用后才发布此上下文。",
    snapshots.some(snapshot=>snapshot.stellarArtifactBonus!==undefined) ? "已声明的固定a7星辉圣遗物反应加成从触发者、到期帧和本段贡献者快照重新计算；失效窗口产生零加成。其他专属基础提升、加算、擢升和额外攻击关闭。" : "专属基础提升、反应加成、加算、擢升和额外攻击在本参考配置明确关闭；独立贡献者暴击期望不含状态反馈。",
    "固定a7dc4bf的CalcSpecialReactionDmg引用reactionLvlBase；其200项源表与已固定表字节一致，仅使用已支持的玩家1至100级。",
  );
  const result=calculateSpecialCalculatorHit(context,`stellar-swirl-${intent.id}`,initial?"星扩散初始风伤":"星漩涡冰伤");
  const damage=critMode==="average"?result.expected:critMode==="allCrit"?result.critical:result.nonCritical;
  if(result.status!=="calculated"||damage===undefined||!Number.isFinite(damage))throw new Error(`Stellar Swirl numerical calculation blocked: ${result.blockers.join("; ")}`);
  return {context,trace:result.trace,damage};
}
