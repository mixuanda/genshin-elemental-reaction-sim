import { describe, expect, it } from "vitest";

import {
  abilityBlueprintSchema,
  CURRENT_MECHANICS_SCHEMA_VERSION,
  DIRECT_DAMAGE_GROUP_MECHANICS_SCHEMA_VERSION,
  migrateAbilityBlueprint
} from "./mechanics";

const HISTORICAL_MECHANICS_SCHEMA_VERSIONS = [
  "1.0.0",
  "1.1.0",
  "1.2.0",
  "1.3.0",
  "1.4.0",
  "1.5.0",
  "1.6.0",
  "1.7.0"
] as const;

function createBlueprint() {
  return {
    schemaVersion: CURRENT_MECHANICS_SCHEMA_VERSION,
    mappingVersion: "test-mapping-v1",
    dataVersion: "test-data-v1",
    id: "test-ability",
    catalogCharacterId: "test-character",
    actorId: "test-actor",
    name: "Test Ability",
    kind: "skill" as const,
    verificationStatus: "provisional" as const,
    simulationStatus: "partial" as const,
    cancelFrame: 10,
    animationEndFrame: 20,
    cooldownFrames: 60,
    hits: [
      {
        id: "test-hit",
        label: "Test Hit",
        frame: 10,
        scalingRef: {
          talentSetId: "test-talent-set",
          abilityKey: "skill",
          parameterKey: "hit",
          talentLevel: 10
        },
        scalingStat: "atk" as const,
        element: "pyro" as const,
        snapshot: "hit" as const
      }
    ],
    energyGains: [],
    particles: [],
    prerequisites: [],
    unresolvedMechanics: ["test-only-unresolved-mechanic"],
    evidence: [
      {
        source: "test-source",
        sourceVersion: "test-source-v1",
        url: "https://example.com/source",
        path: "test/path",
        verifiedAt: "2026-08-01T00:00:00.000Z",
        verificationStatus: "provisional" as const,
        notes: "Schema test fixture; not verified game data."
      }
    ]
  };
}

function withDirectDamageGroup(
  directDamageGroup: unknown
): ReturnType<typeof createBlueprint> {
  const blueprint = createBlueprint();
  Object.assign(blueprint.hits[0]!, { directDamageGroup });
  return blueprint;
}

describe("mechanics direct-damage-group blueprint schema", () => {
  it("makes 1.8.0 the exact current mechanics identity", () => {
    expect(DIRECT_DAMAGE_GROUP_MECHANICS_SCHEMA_VERSION).toBe("1.8.0");
    expect(CURRENT_MECHANICS_SCHEMA_VERSION).toBe("1.8.0");

    const parsed = abilityBlueprintSchema.parse(
      withDirectDamageGroup({
        icdTag: "test-ordinary-hit",
        icdGroup: "pole-extra-attack"
      })
    );
    expect(parsed.schemaVersion).toBe("1.8.0");
    expect(parsed.hits[0]?.directDamageGroup).toEqual({
      icdTag: "test-ordinary-hit",
      icdGroup: "pole-extra-attack"
    });

    expect(() =>
      abilityBlueprintSchema.parse({
        ...createBlueprint(),
        schemaVersion: "1.7.0"
      })
    ).toThrow();
  });

  it.each(HISTORICAL_MECHANICS_SCHEMA_VERSIONS)(
    "migrates mechanics schema %s by identity only",
    (schemaVersion) => {
      const historical = {
        ...createBlueprint(),
        schemaVersion
      };
      const migrated = migrateAbilityBlueprint(historical);

      expect(migrated).toEqual({
        ...historical,
        schemaVersion: CURRENT_MECHANICS_SCHEMA_VERSION
      });
      expect(
        Object.hasOwn(migrated.hits[0]!, "directDamageGroup")
      ).toBe(false);
    }
  );

  it("rejects unknown direct-damage-group ids", () => {
    expect(() =>
      abilityBlueprintSchema.parse(
        withDirectDamageGroup({
          icdTag: "test-ordinary-hit",
          icdGroup: "not-a-fixed-group"
        })
      )
    ).toThrow();
  });

  it.each(["reaction-a", "reaction-b", "burning"])(
    "rejects reserved internal group %s",
    (icdGroup) => {
      expect(() =>
        abilityBlueprintSchema.parse(
          withDirectDamageGroup({
            icdTag: "test-ordinary-hit",
            icdGroup
          })
        )
      ).toThrow(
        /reserved for internal reaction delivery/
      );
    }
  );

  it.each(["", "x".repeat(129), "bad\0tag", "bad\ntag"])(
    "rejects an invalid direct-damage-group tag",
    (icdTag) => {
      expect(() =>
        abilityBlueprintSchema.parse(
          withDirectDamageGroup({ icdTag, icdGroup: "default" })
        )
      ).toThrow();
    }
  );

  it("rejects inherited or non-plain direct-damage-group descriptors", () => {
    const inheritedDescriptor = Object.create({
      icdTag: "inherited-tag",
      icdGroup: "default"
    });
    expect(() =>
      abilityBlueprintSchema.parse(
        withDirectDamageGroup(inheritedDescriptor)
      )
    ).toThrow(/plain JSON objects|explicit own wire properties/);

    const inheritedHit = Object.assign(
      Object.create({
        directDamageGroup: {
          icdTag: "inherited-hit-tag",
          icdGroup: "default"
        }
      }),
      createBlueprint().hits[0]
    );
    const blueprint = createBlueprint();
    blueprint.hits[0] = inheritedHit;
    expect(() => abilityBlueprintSchema.parse(blueprint)).toThrow(
      /plain JSON objects|explicit own wire properties/
    );
  });

  it("rejects inherited top-level blueprint properties", () => {
    const { schemaVersion: _schemaVersion, ...ownFields } =
      createBlueprint();
    const inheritedBlueprint = Object.assign(
      Object.create({
        schemaVersion: CURRENT_MECHANICS_SCHEMA_VERSION
      }),
      ownFields
    );

    expect(() =>
      abilityBlueprintSchema.parse(inheritedBlueprint)
    ).toThrow(/plain JSON objects|explicit own wire properties/);
    expect(() => migrateAbilityBlueprint(inheritedBlueprint)).toThrow(
      /plain JSON objects|explicit own wire properties/
    );
  });

  it("never executes a schemaVersion getter during migration", () => {
    const blueprint = createBlueprint();
    let getterCalls = 0;
    Object.defineProperty(blueprint, "schemaVersion", {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return "1.7.0";
      }
    });

    expect(() => migrateAbilityBlueprint(blueprint)).toThrow(
      /data properties without getters or setters/
    );
    expect(getterCalls).toBe(0);
  });

  it("never executes nested getters and rejects cyclic wires", () => {
    const getterBlueprint = createBlueprint();
    let getterCalls = 0;
    Object.defineProperty(getterBlueprint.evidence[0]!, "notes", {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return "must never be read";
      }
    });

    expect(() => migrateAbilityBlueprint(getterBlueprint)).toThrow(
      /data properties without getters or setters/
    );
    expect(getterCalls).toBe(0);

    const cyclicBlueprint = createBlueprint() as ReturnType<
      typeof createBlueprint
    > & { cycle?: unknown };
    cyclicBlueprint.cycle = cyclicBlueprint;
    expect(() => migrateAbilityBlueprint(cyclicBlueprint)).toThrow(
      /acyclic plain JSON wire/
    );
  });

  it("rejects non-finite numbers at the complete wire boundary", () => {
    const blueprint = createBlueprint();
    blueprint.cooldownFrames = Number.POSITIVE_INFINITY;

    expect(() => migrateAbilityBlueprint(blueprint)).toThrow(
      /finite JSON numbers/
    );
  });
});
