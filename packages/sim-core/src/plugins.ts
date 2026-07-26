import type {
  ActionDefinition,
  AdditiveReactionFactors,
  CharacterProfile,
  CharacterStats,
  EnemyStateBeforeHit,
  HitDefinition,
  ReactionAudit,
  SimConfig
} from "@genshin-dps-lab/schemas";
import type { DamageCalculationInput } from "./formulas";

/**
 * The two flat-damage zones that are combined into
 * `DamageCalculationInput.flatDamage`.
 *
 * `ordinaryFlatDamage` contains hit.flat, hit.flatSources, and plugin-authored
 * flat damage that belongs to the direct hit. `additiveReactionFlatDamage`
 * contains only the Aggravate/Spread contribution.
 */
export interface DamageFlatComponents {
  ordinaryFlatDamage: number;
  additiveReactionFlatDamage: number;
}

/**
 * Plugin changes are absolute overrides, matching the historical
 * Partial<DamageCalculationInput> contract.
 *
 * `flatDamage` remains as a compatibility alias for plugins running on hits
 * without an additive reaction. It is intentionally rejected on
 * Aggravate/Spread hits because a total-flat override cannot say which
 * component changed.
 */
export type DamagePluginChanges = Omit<
  Partial<DamageCalculationInput>,
  "flatDamage"
> & {
  flatDamage?: number;
  ordinaryFlatDamage?: number;
  additiveReactionFlatDamage?: number;
};

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
  reactionAudit: Readonly<ReactionAudit>;
  additiveReactionFactors: Readonly<AdditiveReactionFactors> | null;
  flatDamageComponents: Readonly<DamageFlatComponents>;
  damageInput: Readonly<DamageCalculationInput>;
}

export interface DamageModifierPlugin {
  id: string;
  modifyDamage(
    context: DamagePluginContext
  ): DamagePluginChanges | void;
}
