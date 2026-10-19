import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findTalentSetById, gameDataCatalog } from "../catalog";
import { resolveClassifiedCharacterHits } from "../classified-hits";
import { noelleActionMappings, noelleBaseMappings, noelleBurstCastMappings, noelleSourceEvidence } from "./noelle-action-mappings";

describe("fixed-source Noelle ordinary components and two-hit Q cast", () => {
  it("resolves every full source vector with the exact attack scope and independently retained source bytes", () => {
    const character = gameDataCatalog.characters.find((entry) => entry.slug === "noelle");
    if (!character) throw Error("Active Noelle identity is required");
    expect(noelleBaseMappings).toHaveLength(9);
    expect(noelleBurstCastMappings).toHaveLength(2);
    expect(new Set(noelleActionMappings.map((mapping) => mapping.id)).size).toBe(11);
    let positions = 0;
    for (const vector of Object.values(noelleSourceEvidence.coefficients)) {
      const ability = findTalentSetById("talent-set:noelle")?.abilities.find((entry) => entry.key === vector.abilityKey);
      expect(vector.values).toHaveLength(15);
      expect(ability?.parameters[vector.parameterKey]).toEqual(vector.values);
      positions += vector.values.length;
    }
    expect(positions).toBe(180);
    for (let level = 1; level <= 15; level++) {
      const actual = resolveClassifiedCharacterHits(character.id, level);
      expect(actual.blockers).toEqual([]);
      for (const mapping of noelleActionMappings) {
        const hit = actual.hits.find((entry) => entry.id === mapping.id);
        if (!hit) throw Error(`Missing classified ${mapping.id} at effective talent ${level}`);
        expect(hit.coefficient).toBe(mapping.sourceCoefficientValues![level - 1]);
        expect(hit.terms).toHaveLength(1);
        expect(hit.terms[0]?.stat).toBe("atk");
        expect(hit.attackTag).toBe(mapping.attackTag);
        expect(hit.talentLevel).toBe(level);
        expect(hit.resultStatus).toBe("provisional-conditioned");
        if (mapping.abilityKey === "combat3") {
          expect(hit.formulaInputs).toEqual([{ key: "noelleBurstDefConversion", value: noelleSourceEvidence.coefficients.defconv.values[level - 1], coefficientField: `talent-set:noelle.combat3.parameters.param3[${level - 1}]` }]);
          expect(hit.element).toBe("geo");
          expect(hit.attackTag).toBe("burst"); // Second source label is 'Skill', but its tag is still burst.
        } else expect(hit.element).toBe("physical");
      }
    }
    expect(noelleBaseMappings.filter((mapping) => !mapping.completeAction).map((mapping) => mapping.skillId))
      .toEqual(["noelle-charged-cycle", "noelle-charged-finisher", "noelle-plunge-collision"]);
    expect(noelleBaseMappings.every((mapping) => mapping.variantId === "noelle-burst-inactive")).toBe(true);
    expect(noelleBurstCastMappings.map((mapping) => mapping.skillId)).toEqual(["noelle-burst-cast", "noelle-burst-cast"]);
    for (const mapping of noelleActionMappings) {
      expect(mapping.coefficientTolerance).toBe(0);
      expect(mapping.assumptions.join(" ")).toContain("C0");
      for (const path of mapping.sourcePaths) expect(noelleSourceEvidence.sourceFiles.some((source) => source.path === path)).toBe(true);
    }
    for (const source of noelleSourceEvidence.sourceFiles) {
      const bytes = readFileSync(new URL(`../../../../${source.archivePath}`, import.meta.url));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256);
      expect(source.url).toBe(`https://raw.githubusercontent.com/genshinsim/gcsim/${noelleSourceEvidence.commit}/${source.path}`);
    }
    expect(noelleSourceEvidence.qSnapshotSemantics).toContain("each +24/+65 hit snapshots its then-current damage context independently");
  });
});
