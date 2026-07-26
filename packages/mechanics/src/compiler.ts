import {
  abilityBlueprintSchema,
  type AbilityBlueprint,
  type AbilityDefinition,
  type GameDataCatalog,
  type TalentParameterReference
} from "@genshin-dps-lab/schemas";

export interface ResolvedTalentParameter {
  path: string;
  reference: TalentParameterReference;
  value: number;
}

export interface CompiledAbilityBlueprint {
  blueprint: AbilityBlueprint;
  ability: AbilityDefinition;
  resolvedParameters: ResolvedTalentParameter[];
}

export interface CompileAbilityBlueprintOptions {
  catalog: GameDataCatalog;
  /**
   * Partial blueprints are audit vectors, not production-ready mechanics.
   * Callers must opt in explicitly so an incomplete character cannot silently
   * enter a normal simulation preset.
   */
  allowPartial?: boolean;
}

export class MechanicsCompilationError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "MechanicsCompilationError";
    this.path = path;
  }
}

export function resolveTalentParameter(
  reference: TalentParameterReference,
  catalog: GameDataCatalog,
  path = "parameter"
): number {
  const talentSet = catalog.talentSets.find(
    (entry) => entry.id === reference.talentSetId
  );
  if (!talentSet) {
    throw new MechanicsCompilationError(
      `${path}.talentSetId`,
      `unknown talent set "${reference.talentSetId}"`
    );
  }

  const ability = talentSet.abilities.find(
    (entry) => entry.key === reference.abilityKey
  );
  if (!ability) {
    throw new MechanicsCompilationError(
      `${path}.abilityKey`,
      `unknown ability "${reference.abilityKey}" in "${talentSet.id}"`
    );
  }

  const values = ability.parameters[reference.parameterKey];
  if (!values) {
    throw new MechanicsCompilationError(
      `${path}.parameterKey`,
      `unknown parameter "${reference.parameterKey}" in "${ability.id}"`
    );
  }

  const value = values[reference.talentLevel - 1];
  if (value === undefined || !Number.isFinite(value)) {
    throw new MechanicsCompilationError(
      `${path}.talentLevel`,
      `level ${reference.talentLevel} is not present in "${ability.id}.${reference.parameterKey}"`
    );
  }
  return value;
}

export function compileAbilityBlueprint(
  input: unknown,
  options: CompileAbilityBlueprintOptions
): CompiledAbilityBlueprint {
  const blueprint = abilityBlueprintSchema.parse(input);
  if (
    blueprint.simulationStatus === "partial" &&
    options.allowPartial !== true
  ) {
    throw new MechanicsCompilationError(
      "simulationStatus",
      `partial ability "${blueprint.id}" requires allowPartial: true`
    );
  }

  const resolvedParameters: ResolvedTalentParameter[] = [];
  const resolve = (
    reference: TalentParameterReference,
    path: string
  ): number => {
    const value = resolveTalentParameter(reference, options.catalog, path);
    resolvedParameters.push({ path, reference, value });
    return value;
  };

  const ability: AbilityDefinition = {
    id: blueprint.id,
    actorId: blueprint.actorId,
    name: blueprint.name,
    kind: blueprint.kind,
    cancelFrame: blueprint.cancelFrame,
    animationEndFrame: blueprint.animationEndFrame,
    cooldownFrames: blueprint.cooldownFrames,
    hits: blueprint.hits.map((hit, index) => ({
      id: hit.id,
      label: hit.label,
      frame: hit.frame,
      scaling: resolve(hit.scalingRef, `hits[${index}].scalingRef`),
      scalingStat: hit.scalingStat,
      element: hit.element,
      ...(hit.application
        ? {
            application: {
              gaugeUnits: hit.application.gaugeUnits,
              icdTag: hit.application.icdTag,
              icdGroup: hit.application.icdGroup
            }
          }
        : {}),
      snapshot: hit.snapshot
    })),
    energyGains: blueprint.energyGains.map((gain, index) => ({
      target: gain.target,
      frame: gain.frame,
      amount: resolve(gain.amountRef, `energyGains[${index}].amountRef`),
      source: gain.source
    })),
    particles: blueprint.particles.map((particle) => ({
      id: particle.id,
      source: particle.source,
      element: particle.element,
      kind: particle.kind,
      count: particle.count,
      spawnFrame: particle.spawnFrame,
      travelFrames: particle.travelFrames
    }))
  };

  if (blueprint.maxCharges !== undefined) {
    ability.maxCharges = blueprint.maxCharges;
  }
  if (blueprint.chargeRecoveryFrames !== undefined) {
    ability.chargeRecoveryFrames = blueprint.chargeRecoveryFrames;
  }
  if (blueprint.energyCost !== undefined) {
    ability.energyCost = blueprint.energyCost;
  }

  return { blueprint, ability, resolvedParameters };
}
