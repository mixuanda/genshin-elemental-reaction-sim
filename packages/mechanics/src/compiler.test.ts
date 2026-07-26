import { gameDataCatalog } from "@genshin-dps-lab/game-data/catalog";
import {
  abilityBlueprintSchema,
  CURRENT_MECHANICS_SCHEMA_VERSION,
  migrateAbilityBlueprint
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import {
  compileAbilityBlueprint,
  MechanicsCompilationError
} from "./compiler";
import {
  durinDenialOfDarknessBlueprint,
  durinEnterTransformationBlueprint
} from "./characters/durin";

describe("ability blueprint compiler gates", () => {
  it("requires an explicit opt-in before compiling partial mechanics", () => {
    expect(() =>
      compileAbilityBlueprint(durinDenialOfDarknessBlueprint, {
        catalog: gameDataCatalog
      })
    ).toThrowError(
      'simulationStatus: partial ability "durin-denial-of-darkness" requires allowPartial: true'
    );
  });

  it("resolves every referenced talent parameter from the pinned catalog", () => {
    const compiled = compileAbilityBlueprint(
      durinDenialOfDarknessBlueprint,
      {
        catalog: gameDataCatalog,
        allowPartial: true
      }
    );

    expect(compiled.ability.hits?.map((hit) => hit.scaling)).toEqual([
      1.30032, 0.9576, 1.16352
    ]);
    expect(compiled.ability.energyGains?.[0]?.amount).toBe(33);
    expect(
      compiled.resolvedParameters.map(({ path, value }) => ({ path, value }))
    ).toEqual([
      { path: "hits[0].scalingRef", value: 1.30032 },
      { path: "hits[1].scalingRef", value: 0.9576 },
      { path: "hits[2].scalingRef", value: 1.16352 },
      { path: "energyGains[0].amountRef", value: 33 }
    ]);
  });

  it("fails loudly with the exact broken source path", () => {
    const invalid = structuredClone(durinDenialOfDarknessBlueprint);
    invalid.hits[1]!.scalingRef.parameterKey = "missing";

    expect(() =>
      compileAbilityBlueprint(invalid, {
        catalog: gameDataCatalog,
        allowPartial: true
      })
    ).toThrowError(MechanicsCompilationError);
    expect(() =>
      compileAbilityBlueprint(invalid, {
        catalog: gameDataCatalog,
        allowPartial: true
      })
    ).toThrow(
      'hits[1].scalingRef.parameterKey: unknown parameter "missing"'
    );
  });

  it("enforces honest partial versus mechanics-mapped labels", () => {
    const falselyComplete = {
      ...durinDenialOfDarknessBlueprint,
      simulationStatus: "mechanics-mapped" as const
    };
    const emptyPartial = {
      ...durinEnterTransformationBlueprint,
      unresolvedMechanics: []
    };

    expect(() => abilityBlueprintSchema.parse(falselyComplete)).toThrow(
      /mechanics-mapped abilities cannot retain unresolved mechanics/
    );
    expect(() => abilityBlueprintSchema.parse(emptyPartial)).toThrow(
      /partial abilities must state what remains unresolved/
    );
  });

  it("rejects an impossible follow-up cancel with a field path", () => {
    const invalid = structuredClone(durinEnterTransformationBlueprint);
    invalid.cancelFrames = {
      ...invalid.cancelFrames,
      swap: invalid.animationEndFrame + 1
    };

    const parsed = abilityBlueprintSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("expected Blueprint validation failure");
    expect(parsed.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["cancelFrames", "swap"],
        message: "must not exceed animationEndFrame"
      })
    );
  });

  it("compiles energy-gated state transitions for runtime rollback", () => {
    const blueprint = {
      ...durinEnterTransformationBlueprint,
      energyCost: 60
    };
    const compiled = compileAbilityBlueprint(blueprint, {
      catalog: gameDataCatalog,
      allowPartial: true
    });

    expect(compiled.ability).toMatchObject({
      energyCost: 60,
      timelineState: durinEnterTransformationBlueprint.timelineState
    });
  });

  it.each(["1.0.0", "1.1.0", "1.2.0", "1.3.0", "1.4.0"])(
    "migrates mechanics schema %s before compiling",
    (schemaVersion) => {
      const previous = {
        ...durinEnterTransformationBlueprint,
        schemaVersion
      };

      expect(migrateAbilityBlueprint(previous).schemaVersion).toBe(
        CURRENT_MECHANICS_SCHEMA_VERSION
      );
      expect(
        compileAbilityBlueprint(previous, {
          catalog: gameDataCatalog,
          allowPartial: true
        }).ability.id
      ).toBe(durinEnterTransformationBlueprint.id);
    }
  );
});
