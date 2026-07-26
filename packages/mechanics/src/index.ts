import type {
  DamageCalculationInput,
  DamageModifierPlugin,
  DamagePluginChanges,
  DamagePluginContext
} from "@genshin-dps-lab/sim-core";

export * from "./compiler";
export * from "./characters/durin";

export interface DeclarativeDamageEffect {
  id: string;
  when: {
    actionId?: string;
    hitId?: string;
    sourceActorId?: string;
    scalingOwnerId?: string;
    creditOwnerId?: string;
  };
  add?: Partial<
    Pick<
      DamageCalculationInput,
      | "damageBonus"
      | "defenseReduction"
      | "defenseIgnore"
      | "reactionBonus"
    >
  > & {
    /**
     * Legacy total-flat addition. The core accepts it only on hits without
     * Aggravate/Spread.
     */
    flatDamage?: number;
    ordinaryFlatDamage?: number;
    additiveReactionFlatDamage?: number;
  };
  multiplyGroupBy?: number;
}

function matches(
  effect: DeclarativeDamageEffect,
  context: DamagePluginContext
): boolean {
  const hitId = context.hit.id;
  return (
    (effect.when.actionId === undefined ||
      effect.when.actionId === context.action.id) &&
    (effect.when.hitId === undefined || effect.when.hitId === hitId) &&
    (effect.when.sourceActorId === undefined ||
      effect.when.sourceActorId === context.sourceActor.id) &&
    (effect.when.scalingOwnerId === undefined ||
      effect.when.scalingOwnerId === context.scalingOwner.id) &&
    (effect.when.creditOwnerId === undefined ||
      effect.when.creditOwnerId === context.creditOwner.id)
  );
}

export function createDeclarativeDamagePlugin(
  effects: readonly DeclarativeDamageEffect[]
): DamageModifierPlugin {
  return {
    id: `declarative:${effects.map((effect) => effect.id).join(",")}`,
    modifyDamage(context) {
      let changes: DamagePluginChanges | undefined;
      for (const effect of effects) {
        if (!matches(effect, context)) continue;
        changes ??= {};
        for (const [field, value] of Object.entries(effect.add ?? {})) {
          const numericValue = value as number;
          const current =
            field === "ordinaryFlatDamage"
              ? (changes.ordinaryFlatDamage ??
                context.flatDamageComponents.ordinaryFlatDamage)
              : field === "additiveReactionFlatDamage"
                ? (changes.additiveReactionFlatDamage ??
                  context.flatDamageComponents
                    .additiveReactionFlatDamage)
                : (changes[
                    field as keyof DamagePluginChanges
                  ] ??
                  context.damageInput[
                    field as keyof DamageCalculationInput
                  ]);
          Object.assign(changes, {
            [field]: (current as number) + numericValue
          });
        }
        if (effect.multiplyGroupBy !== undefined) {
          changes.groupMultiplier =
            (changes.groupMultiplier ?? context.damageInput.groupMultiplier) *
            effect.multiplyGroupBy;
        }
      }
      return changes;
    }
  };
}
