import type {
  DamageCalculationInput,
  DamageModifierPlugin,
  DamagePluginChanges,
  DamagePluginContext
} from "@genshin-dps-lab/sim-core";
import { defineDamageModifierPlugin } from "@genshin-dps-lab/sim-core";
import { createVersionedContentHash } from "@genshin-dps-lab/schemas";

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

const DECLARATIVE_DAMAGE_PLUGIN_VERSION = "1.0.0";
const DECLARATIVE_DAMAGE_COMPILER_VERSION =
  "declarative-damage-v1";

function normalizeDeclarativeEffects(
  effects: readonly DeclarativeDamageEffect[]
): DeclarativeDamageEffect[] {
  const ids = new Set<string>();
  return effects.map((effect) => {
    if (
      effect.id.trim().length === 0 ||
      effect.id !== effect.id.trim()
    ) {
      throw new Error(
        "Declarative damage effect ids must be non-blank and trimmed."
      );
    }
    if (ids.has(effect.id)) {
      throw new Error(
        `Duplicate declarative damage effect id "${effect.id}".`
      );
    }
    ids.add(effect.id);

    const add =
      effect.add === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(effect.add).map(([field, value]) => {
              if (
                typeof value !== "number" ||
                !Number.isFinite(value)
              ) {
                throw new Error(
                  `Declarative damage effect "${effect.id}" has a non-finite ${field} value.`
                );
              }
              return [field, value];
            })
          );
    if (
      effect.multiplyGroupBy !== undefined &&
      !Number.isFinite(effect.multiplyGroupBy)
    ) {
      throw new Error(
        `Declarative damage effect "${effect.id}" has a non-finite multiplyGroupBy value.`
      );
    }
    return {
      id: effect.id,
      when: { ...effect.when },
      ...(add === undefined
        ? {}
        : {
            add: add as NonNullable<
              DeclarativeDamageEffect["add"]
            >
          }),
      ...(effect.multiplyGroupBy === undefined
        ? {}
        : { multiplyGroupBy: effect.multiplyGroupBy })
    };
  });
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
  const normalizedEffects =
    normalizeDeclarativeEffects(effects);
  const contentHash = createVersionedContentHash({
    compilerVersion: DECLARATIVE_DAMAGE_COMPILER_VERSION,
    effects: normalizedEffects
  });
  return defineDamageModifierPlugin(
    {
      id: `declarative:${normalizedEffects
        .map((effect) => effect.id)
        .join(",")}`,
      version: DECLARATIVE_DAMAGE_PLUGIN_VERSION,
      kind: "declarative",
      contentHash
    },
    () => ({
      modifyDamage(context) {
        let changes: DamagePluginChanges | undefined;
        for (const effect of normalizedEffects) {
          if (!matches(effect, context)) continue;
          changes ??= {};
          for (const [field, value] of Object.entries(
            effect.add ?? {}
          )) {
            const numericValue = value as number;
            const current =
              field === "ordinaryFlatDamage"
                ? (changes.ordinaryFlatDamage ??
                  context.flatDamageComponents
                    .ordinaryFlatDamage)
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
              (changes.groupMultiplier ??
                context.damageInput.groupMultiplier) *
              effect.multiplyGroupBy;
          }
        }
        return changes;
      }
    })
  );
}
