import {
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  LEGACY_CALLBACK_BUS_POLICY_V1_ID,
  LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
} from "@genshin-dps-lab/icd-profiles";
import type { SimConfig } from "@genshin-dps-lab/schemas";

/**
 * Selects the only current policies that can faithfully project to V1.52.
 * This is test-vector scaffolding, not a migration or runtime default.
 */
export function withV152CompatibilityPolicies(config: SimConfig): SimConfig {
  return {
    ...config,
    freezeBrokenAttackModel: {
      mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
      policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
    },
    callbackBusModel: {
      mode: LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
      policyId: LEGACY_CALLBACK_BUS_POLICY_V1_ID,
    },
  };
}
