import {
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  type CharacterStats,
  type SimConfig
} from "@genshin-dps-lab/schemas";

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
    electroChargedPropagationModel
  };
}
