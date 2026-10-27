import { describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import * as schemas from "./schema";
import * as versions from "./types";
import { createSimulationConfigHash } from "./reproducibility";

const boundaries = [
  [144, schemas.simConfigV144Schema, versions.BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION, versions.BURNING_CALLBACK_DELIVERY_ENGINE_VERSION, "targetTaskModel"],
  [145, schemas.simConfigV145Schema, versions.REACTION_FORMULA_ROOT_SCHEMA_VERSION, versions.REACTION_FORMULA_ROOT_ENGINE_VERSION, "reactionFormulaModel"],
  [146, schemas.simConfigV146Schema, versions.DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION, versions.DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION, "directDamageGroupModel"],
  [147, schemas.simConfigV147Schema, versions.ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION, versions.ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION, "elementalApplicationIcdModel"],
  [148, schemas.simConfigV148Schema, versions.REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION, versions.REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION, "reactionOwnedElementalApplicationModel"],
  [149, schemas.simConfigV149Schema, versions.REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION, versions.REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION, "reactionOwnedElementalApplicationModel"],
  [150, schemas.simConfigV150Schema, versions.REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION, versions.REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION, "reactionDamageGroupModel"],
  [151, schemas.simConfigV151Schema, versions.BASIC_REACTION_SCHEDULER_SCHEMA_VERSION, versions.BASIC_REACTION_SCHEDULER_ENGINE_VERSION, "basicReactionSchedulerModel"],
  [152, schemas.simConfigV152Schema, versions.FREEZE_BROKEN_ATTACK_SCHEMA_VERSION, versions.FREEZE_BROKEN_ATTACK_ENGINE_VERSION, "freezeBrokenAttackModel"],
  [153, schemas.simConfigV153Schema, versions.CALLBACK_BUS_SCHEMA_VERSION, versions.CALLBACK_BUS_ENGINE_VERSION, "callbackBusModel"]
] as const;

// Synthetic only: no player imports or persisted account data.
const current = schemas.migrateConfig({
  meta: { name: "config-validation-linearity", version: "synthetic-test" },
  duration: 1,
  cycleLength: 1,
  enemy: { level: 90, resistance: 0.1, defReduction: 0 },
  characters: [{ id: "actor", name: "Actor", element: "pyro", color: "#f00", level: 90, energyMax: 60, initialEnergy: 0, stats: {} }],
  rotation: [{ id: "action", actorId: "actor", name: "Action", at: 0, hits: [{ id: "hit", offset: 0, scaling: 1 }] }]
});

function fixture(version: number, schemaVersion: string, engineVersion: string) {
  const wire = structuredClone(current);
  const fields = wire as unknown as Record<string, unknown>;
  fields.schemaVersion = schemaVersion;
  fields.engineVersion = engineVersion;
  for (const [introduced, , , , field] of boundaries) {
    if (introduced > version && !(introduced === 149 && version === 148)) delete fields[field];
  }
  return wire;
}

function rejectionPaths(schema: z.ZodType, input: unknown) {
  const parsed = schema.safeParse(input);
  expect(parsed.success).toBe(false);
  if (parsed.success) throw new Error("Expected rejection, not transformed output");
  return parsed.error.issues.map(issue => issue.path);
}

for (const [version, schema, schemaVersion, engineVersion, ownModel] of boundaries) {
  const makeWire = () => fixture(version, schemaVersion, engineVersion);
  describe(`V${version} single-pass predecessor validation`, () => {
    it("reaches the complete V142 validator once without reparsing it", () => {
      const wire = makeWire();
      const safeParse = vi.spyOn(schemas.simConfigV142Schema, "safeParse");
      const parse = vi.spyOn(schemas.simConfigV142Schema, "parse");
      try {
        expect(schema.safeParse(wire).success).toBe(true);
        expect(safeParse).toHaveBeenCalledTimes(1);
        expect(parse).not.toHaveBeenCalled();
      } finally {
        safeParse.mockRestore();
        parse.mockRestore();
      }
    });

    it("preserves normalized fields, defaults, version identity and config hash", () => {
      const wire = makeWire();
      wire.characters[0]!.name = "  Actor  ";
      wire.characters[0]!.stats.baseAtk = 123;
      wire.meta.note = "preserved synthetic note";
      const expected = structuredClone(wire);
      expected.characters[0]!.name = "Actor";
      const parsed = schema.parse(wire);
      expect(parsed).toEqual(expected);
      expect(createSimulationConfigHash(parsed)).toBe(createSimulationConfigHash(expected));
      expect(wire.characters[0]!.name).toBe("  Actor  ");
    });

    it("keeps version-specific and predecessor issues, including their paths", () => {
      const wire = makeWire();
      const fields = wire as unknown as Record<string, unknown>;
      fields.schemaVersion = "invalid";
      fields.engineVersion = "invalid";
      wire.characters[0]!.initialEnergy = 61;
      const paths = rejectionPaths(schema, wire);
      expect(paths).toContainEqual(["schemaVersion"]);
      expect(paths).toContainEqual(["engineVersion"]);
      expect(paths).toContainEqual(["characters", 0, "initialEnergy"]);
    });

    it("does not emit output when only the current layer's model is invalid", () => {
      const wire = makeWire();
      const fields = wire as unknown as Record<string, unknown>;
      fields[ownModel] = { ...(fields[ownModel] as object), mode: "untrusted-mode" };
      expect(rejectionPaths(schema, wire).some(path => path[0] === ownModel)).toBe(true);
      delete fields[ownModel];
      expect(rejectionPaths(schema, wire).some(path => path[0] === ownModel)).toBe(true);
    });

    it("rejects unknown fields and inherited model properties", () => {
      const wire = makeWire();
      const fields = wire as unknown as Record<string, unknown>;
      fields.extraUntrustedField = true;
      expect(rejectionPaths(schema, wire)).toContainEqual([]);
      delete fields.extraUntrustedField;
      fields[ownModel] = Object.create(fields[ownModel] as object);
      expect(rejectionPaths(schema, wire).some(path => path[0] === ownModel)).toBe(true);
    });

    it("retains duplicate and dangling-reference rejection", () => {
      const duplicate = makeWire();
      duplicate.characters.push(structuredClone(duplicate.characters[0]!));
      expect(rejectionPaths(schema, duplicate)).toContainEqual(["characters", 1, "id"]);
      const dangling = makeWire();
      dangling.rotation[0]!.actorId = "missing-actor";
      expect(rejectionPaths(schema, dangling)).toContainEqual(["rotation", 0, "actorId"]);
    });

    it("rechecks both the original object and parsed output after mutation", () => {
      const wire = makeWire();
      const parsed = schema.parse(wire);
      wire.characters[0]!.initialEnergy = 61;
      expect(rejectionPaths(schema, wire)).toContainEqual(["characters", 0, "initialEnergy"]);
      parsed.characters[0]!.initialEnergy = 61;
      expect(rejectionPaths(schema, parsed)).toContainEqual(["characters", 0, "initialEnergy"]);
    });

    it("rejects malformed roots and nonfinite numeric fields", () => {
      for (const input of [null, false, 7, "untrusted", [], {}]) rejectionPaths(schema, input);
      for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
        const wire = makeWire();
        wire.characters[0]!.initialEnergy = value;
        expect(rejectionPaths(schema, wire)).toContainEqual(["characters", 0, "initialEnergy"]);
      }
    });

    it("rejects accessor and sparse wires without evaluating getters", () => {
      const accessor = makeWire();
      const getter = vi.fn(() => 0);
      Object.defineProperty(accessor.characters[0]!, "initialEnergy", { enumerable: true, get: getter });
      expect(rejectionPaths(schema, accessor)).toContainEqual(["characters", 0, "initialEnergy"]);
      expect(getter).not.toHaveBeenCalled();
      const sparse = makeWire();
      sparse.characters.length = 2;
      expect(rejectionPaths(schema, sparse)).toContainEqual(["characters"]);
    });
  });
}
