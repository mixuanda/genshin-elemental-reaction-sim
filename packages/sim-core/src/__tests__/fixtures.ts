import {
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  type CharacterStats,
  type SimConfig
} from "@genshin-dps-lab/schemas";
import {
  CLASSIC_REACTION_FORMULA_PROFILE_ID
} from "@genshin-dps-lab/reaction-formulas";
import {
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
  GCSIM_DAMAGE_GROUP_PROFILE_ID,
  GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID
} from "@genshin-dps-lab/icd-profiles";

export const neutralStats: CharacterStats = {
  baseAtk: 1000,
  atkPct: 0,
  flatAtk: 0,
  baseHp: 10000,
  hpPct: 0,
  flatHp: 0,
  baseDef: 700,
  defPct: 0,
  flatDef: 0,
  em: 0,
  critRate: 0,
  critDmg: 0.5,
  dmgBonus: 0,
  defIgnore: 0,
  reactionBonus: 0,
  energyRecharge: 1
};

export function makeConfig(
  overrides: Partial<SimConfig> = {}
): SimConfig {
  const playerDamageModel = overrides.playerDamageModel ?? {
    mode: "disabled" as const
  };
  const targetClockModel = overrides.targetClockModel ?? {
    mode: "disabled" as const
  };
  const targetTaskModel = overrides.targetTaskModel ?? {
    mode: "legacy-event-heap-v1" as const
  };
  const reactionDeliveryModel = overrides.reactionDeliveryModel ?? {
    mode: "deferred-event-heap-v1" as const
  };
  const electroChargedPropagationModel =
    overrides.electroChargedPropagationModel ?? {
      mode: "single-target-v1" as const
    };
  const reactionFormulaModel =
    overrides.reactionFormulaModel ?? {
      mode: "classic-formula-profile-v1" as const,
      profileId: CLASSIC_REACTION_FORMULA_PROFILE_ID
    };
  const directDamageGroupModel =
    overrides.directDamageGroupModel ?? {
      mode: "fixed-gcsim-direct-damage-group-v1" as const,
      profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID
    };
  const elementalApplicationIcdModel =
    overrides.elementalApplicationIcdModel ?? {
      mode: "fixed-gcsim-elemental-application-v1" as const,
      profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID
    };
  const reactionOwnedElementalApplicationModel =
    overrides.reactionOwnedElementalApplicationModel ?? {
      mode: "fixed-gcsim-reaction-owned-application-v2" as const,
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID
    };
  const reactionDamageGroupModel =
    overrides.reactionDamageGroupModel ?? {
      mode: "fixed-gcsim-reaction-damage-task-order-v2" as const,
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID
    };
  const basicReactionSchedulerModel =
    overrides.basicReactionSchedulerModel ?? {
      mode: "fixed-gcsim-basic-reaction-scheduler-v2" as const,
      policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID
    };

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    engineVersion: CURRENT_ENGINE_VERSION,
    dataVersion: "test-vector-1",
    randomSeed: "test-seed",
    meta: {
      name: "测试向量",
      version: "1",
      verificationStatus: "verified"
    },
    duration: 10,
    cycleLength: 10,
    enemy: {
      level: 110,
      resistance: 0.1,
      defReduction: 0
    },
    characters: [
      {
        id: "a",
        name: "A",
        element: "pyro",
        color: "#ff0000",
        level: 90,
        energyMax: 60,
        initialEnergy: 0,
        stats: { ...neutralStats }
      }
    ],
    rotation: [],
    ...overrides,
    playerDamageModel,
    targetClockModel,
    targetTaskModel,
    reactionDeliveryModel,
    electroChargedPropagationModel,
    reactionFormulaModel,
    directDamageGroupModel,
    elementalApplicationIcdModel,
    reactionOwnedElementalApplicationModel,
    reactionDamageGroupModel,
    basicReactionSchedulerModel
  };
}
