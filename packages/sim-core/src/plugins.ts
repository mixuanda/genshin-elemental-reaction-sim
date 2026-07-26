import type {
  ActionDefinition,
  CharacterProfile,
  CharacterStats,
  EnemyStateBeforeHit,
  HitDefinition,
  SimConfig
} from "@genshin-dps-lab/schemas";
import type { DamageCalculationInput } from "./formulas";

export interface DamagePluginContext {
  config: SimConfig;
  action: ActionDefinition;
  hit: HitDefinition;
  cycle: number;
  timeSeconds: number;
  sourceActor: CharacterProfile;
  scalingOwner: CharacterProfile;
  creditOwner: CharacterProfile;
  statsBeforeDamage: CharacterStats;
  enemyStateBeforeHit: EnemyStateBeforeHit;
  damageInput: Readonly<DamageCalculationInput>;
}

export interface DamageModifierPlugin {
  id: string;
  modifyDamage(
    context: DamagePluginContext
  ): Partial<DamageCalculationInput> | void;
}

