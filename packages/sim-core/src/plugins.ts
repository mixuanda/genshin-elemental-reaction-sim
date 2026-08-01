import type {
  ActionDefinition,
  AdditiveReactionFactors,
  CharacterProfile,
  CharacterStats,
  DamagePluginDescriptor,
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
export type LegacyDamagePluginChanges = Omit<
  Partial<DamageCalculationInput>,
  "flatDamage"
> & {
  flatDamage?: number;
  ordinaryFlatDamage?: number;
  additiveReactionFlatDamage?: number;
};

/**
 * Formula-bound damage changes accepted by the current simulation path.
 *
 * Reaction identity and its amplifying base are owned by the audited Aura
 * result and the fixed reaction-formula profile. They are intentionally not
 * plugin extension points. `LegacyDamagePluginChanges` remains available so
 * frozen result versions can be replayed without silently changing their
 * historical plugin contract.
 */
export type FormulaBoundDamagePluginChanges = Omit<
  LegacyDamagePluginChanges,
  "reaction" | "explicitReactionBase"
>;

/**
 * Historical public alias retained for source compatibility. The simulator
 * must call `assertFormulaBoundDamagePluginChanges` before applying changes on
 * the current formula-profile path.
 */
export type DamagePluginChanges = LegacyDamagePluginChanges;

export function assertFormulaBoundDamagePluginChanges(
  changes: DamagePluginChanges | void,
  pluginId: string
): asserts changes is FormulaBoundDamagePluginChanges | void {
  if (changes === undefined) return;
  for (const field of ["reaction", "explicitReactionBase"] as const) {
    if (Object.prototype.hasOwnProperty.call(changes, field)) {
      throw new Error(
        `Damage plugin "${pluginId}" cannot override formula-bound field "${field}".`
      );
    }
  }
}

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

export interface DamageModifierPluginRuntime {
  modifyDamage(
    context: DamagePluginContext
  ): DamagePluginChanges | void;
}

/**
 * A plugin definition is immutable run metadata plus a runtime factory.
 *
 * The simulator calls createRuntime once for every internal simulation,
 * including each legal-timeline prefix probe and the final run. Plugins must
 * keep mutable state inside the returned runtime, never in this definition.
 */
export interface DamageModifierPlugin {
  readonly descriptor: DamagePluginDescriptor;
  readonly createRuntime: () => DamageModifierPluginRuntime;
}

export function defineDamageModifierPlugin(
  descriptor: DamagePluginDescriptor,
  createRuntime: () => DamageModifierPluginRuntime
): DamageModifierPlugin {
  return Object.freeze({
    descriptor: Object.freeze({ ...descriptor }),
    createRuntime
  });
}
