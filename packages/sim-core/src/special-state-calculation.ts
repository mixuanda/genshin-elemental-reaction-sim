import { SPECIAL_BRANCHES, SPECIAL_FORMULA_RULES, conditionedSpecialCalculationSchema, type SpecialCalculationContext, type SpecialContributor } from "@genshin-dps-lab/reaction-formulas";
import { SPECIAL_STATE_PROFILE_ID, type SpecialDamageIntent } from "./special-reaction-state";

/** This proof is supplied only by the engine integration, never by a UI reaction label. */
export interface SpecialIntegrationProof {
  ordinaryReactionReplacementApplied: true;
  deliveryOperationsScheduled: true;
}

/**
 * Bind a state-generated hit to exact numerical snapshots supplied by the host.
 * This adapter neither invents level bases nor converts incomplete state into damage.
 */
export function specialDamageIntentToCalculationContext(intent: SpecialDamageIntent, contributors: SpecialContributor[], effectiveResistance: number, integration: SpecialIntegrationProof): SpecialCalculationContext {
  if (intent.blockedMechanics.length) throw new Error(`Special hit is blocked: ${intent.blockedMechanics.map(b => `${b.mechanic}.${b.field}: ${b.reason}`).join("; ")}`);
  if (!integration.ordinaryReactionReplacementApplied || !integration.deliveryOperationsScheduled) throw new Error("Ordinary reaction replacement and special delivery operations must be applied before publishing automatic damage");
  const expectedIds = [...intent.contributorIds].sort();
  const actualIds = contributors.map(contributor => contributor.id).sort();
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) throw new Error("Special numerical snapshots must match the state-derived contributors exactly");
  if (!contributors.length) throw new Error("Automatic damage cannot omit all contribution snapshots");
  const rule = SPECIAL_FORMULA_RULES[SPECIAL_BRANCHES[intent.branch].family];
  return conditionedSpecialCalculationSchema.parse({
    branch: intent.branch, ruleVersion: rule.id, contributors, effectiveResistance,
    context: {
      mode: "state-resolved", enablement: "resolved-enabled", contributorEligibility: "resolved",
      stateProfileId: SPECIAL_STATE_PROFILE_ID, sourceEventId: intent.sourceEventId,
      snapshotFrame: intent.snapshotFrame, deliveryFrame: intent.deliveryFrame, targetId: intent.targetId,
      ownerId: intent.ownerId, contributorPolicy: intent.contributorPolicy, stateSourceRefs: intent.sourceRefs,
      auraAndDeliveryIntegration: "applied",
      assumptions: ["自动状态参考配置：60FPS、无卡肉、单个静止且位于范围内的目标。", `状态证据：${intent.evidence}；公式源版本：${rule.gameVersion}。`, "普通反应已被实际替换，附着与命中后元素操作已交给 Aura 引擎；各贡献者数值来自指定快照帧。", "独立暴击期望不包含暴击触发状态反馈。"],
    },
  });
}
