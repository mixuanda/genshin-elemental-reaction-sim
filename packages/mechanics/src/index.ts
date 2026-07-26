import type {
  DamageCalculationInput,
  DamageModifierPlugin,
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
      | "flatDamage"
      | "damageBonus"
      | "defenseReduction"
      | "defenseIgnore"
      | "reactionBonus"
    >
  >;
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
      let changes: Partial<DamageCalculationInput> | undefined;
      for (const effect of effects) {
        if (!matches(effect, context)) continue;
        changes ??= {};
        for (const [field, value] of Object.entries(effect.add ?? {})) {
          const key = field as keyof DamageCalculationInput;
          const numericValue = value as number;
          const current = (changes[key] ??
            context.damageInput[key]) as number;
          Object.assign(changes, { [key]: current + numericValue });
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
