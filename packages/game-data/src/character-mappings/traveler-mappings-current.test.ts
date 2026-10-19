import { describe, expect, it } from "vitest";
import { findTalentSetById, gameDataCatalog } from "../catalog";
import { travelerMappingBlockers, travelerMappings } from "./traveler-mappings";
import {
  currentTravelerBlockerAudit,
  currentTravelerMappingBlockers,
  currentTravelerRoundingEvidence,
  currentTravelerSourceEvidence,
  newTravelerMappings,
  resolvedTravelerBlockerIds
} from "./traveler-mappings-current";

const commit = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd";

describe("current pinned traveler blocker recheck", () => {
  it("accounts for all fifteen original blockers and retires only the three obsolete identities", () => {
    expect(currentTravelerBlockerAudit.map((entry) => entry.previousBlockerId).sort())
      .toEqual(travelerMappingBlockers.map((entry) => entry.id).sort());
    expect(resolvedTravelerBlockerIds).toEqual([
      "lumine-pyro-charged-base-blocked",
      "aether-cryo-unverified-actions-blocked",
      "lumine-cryo-unverified-actions-blocked"
    ]);
    const stillBlocked = currentTravelerBlockerAudit.filter((entry) => entry.status === "still-blocked");
    expect(stillBlocked).toHaveLength(12);
    for (const entry of stillBlocked) {
      const blocker = currentTravelerMappingBlockers.find((candidate) => candidate.id === entry.previousBlockerId);
      expect(blocker?.sourceCommit, entry.previousBlockerId).toBe(commit);
      expect(resolvedTravelerBlockerIds, entry.previousBlockerId).not.toContain(entry.previousBlockerId);
    }
  });

  it("validates every coefficient against the active catalog with only the documented N1 rounding", () => {
    for (const mapping of newTravelerMappings) {
      const character = gameDataCatalog.characters.find((entry) => entry.slug === mapping.characterSlug);
      expect(character?.talentSetIds, mapping.id).toContain(mapping.talentSetId);
      const values = findTalentSetById(mapping.talentSetId)?.abilities.find((ability) => ability.key === mapping.abilityKey)?.parameters[mapping.parameterKey];
      expect(values, mapping.id).toHaveLength(15);
      expect(mapping.sourceCoefficientValues, mapping.id).toHaveLength(15);
      expect(mapping.sourceCommit, mapping.id).toBe(commit);
      if (mapping.coefficientTolerance === 0) {
        expect(values, mapping.id).toEqual(mapping.sourceCoefficientValues);
      } else {
        expect(mapping.coefficientTolerance, mapping.id).toBe(0.00005);
        expect(mapping.skillId, mapping.id).toMatch(/-cryo-normal-1-base$/);
        const evidence = currentTravelerRoundingEvidence[0];
        expect(values, mapping.id).toEqual(evidence.catalogValues);
        expect(mapping.sourceCoefficientValues, mapping.id).toEqual(evidence.sourceValues);
        values!.forEach((value, i) => {
          expect(Math.round(value * 10_000) / 10_000, `${mapping.id} level ${i + 1}`).toBe(mapping.sourceCoefficientValues![i]);
          expect(Math.abs(value - mapping.sourceCoefficientValues![i]!)).toBeLessThanOrEqual(0.00005);
        });
      }
    }
    expect(newTravelerMappings).toHaveLength(11);
    expect(new Set(newTravelerMappings.map((mapping) => mapping.skillId)).size).toBe(9);
  });

  it("replaces only the old Lumine Pyro first row and completes the exact two-hit charged action", () => {
    const charged = newTravelerMappings.filter((entry) => entry.skillId === "lumine-pyro-charged-base");
    expect(charged.map((entry) => entry.parameterKey)).toEqual(["param6", "param7"]);
    expect(charged.every((entry) => entry.completeAction && entry.element === "physical" && entry.attackTag === "charged")).toBe(true);
    const replaced = newTravelerMappings.filter((entry) => travelerMappings.some((old) => old.id === entry.id));
    expect(replaced.map((entry) => entry.id)).toEqual(["lumine-pyro-charged-base-hit-1"]);
    expect(travelerMappings.find((entry) => entry.id === replaced[0]!.id)?.completeAction).toBe(false);
    expect(charged[1]!.sourceCoefficientValues).toEqual([0.7224, 0.7812, 0.84, 0.924, 0.9828, 1.05, 1.1424, 1.2348, 1.3272, 1.428, 1.5288, 1.6296, 1.7304, 1.8312, 1.932]);
  });

  it("preserves physical base context and the actual male charged discrepancy", () => {
    for (const gender of ["aether", "lumine"]) {
      const normal = newTravelerMappings.find((entry) => entry.skillId === `${gender}-cryo-normal-1-base`)!;
      expect(normal).toMatchObject({ instanceCount: 1, attackTag: "normal", element: "physical", completeAction: true });
      expect(normal.assumptions.join(" ")).toContain("true_moon_story_buff=0");
      expect(normal.assumptions.join(" ")).toContain("没有生效的 travelercryo-e");
      const charged = newTravelerMappings.filter((entry) => entry.skillId === `${gender}-cryo-charged-base`);
      expect(charged).toHaveLength(gender === "aether" ? 1 : 2);
      expect(charged.every((entry) => entry.completeAction === (gender === "lumine"))).toBe(true);
    }
    const blocker = currentTravelerMappingBlockers.find((entry) => entry.id === "aether-cryo-charged-base-blocked")!;
    expect(blocker.evidence.maxDifference).toBeCloseTo(0.3082, 12);
    expect(blocker.evidence.sourceValues).not.toEqual(blocker.evidence.catalogValues);
  });

  it("keeps Cryo initial skill partial and permits exactly the conditioned three-hit ordinary burst", () => {
    for (const gender of ["aether", "lumine"]) {
      expect(newTravelerMappings.find((entry) => entry.skillId === `${gender}-cryo-skill-initial`))
        .toMatchObject({ completeAction: false, instanceCount: 1, abilityKey: "combat2", parameterKey: "param1", element: "cryo" });
      const burst = newTravelerMappings.find((entry) => entry.skillId === `${gender}-cryo-burst-no-radiance-zero-frostglow`)!;
      expect(burst).toMatchObject({ completeAction: true, instanceCount: 3, abilityKey: "combat3", parameterKey: "param1", element: "cryo", attackTag: "burst" });
      expect(burst.assumptions.join(" ")).toContain("frostglowStacks=0");
      expect(burst.assumptions.join(" ")).toContain("Radiance=radianceNone");
      expect(currentTravelerMappingBlockers.find((entry) => entry.id === `${gender}-cryo-burst-conditional-blocked`)?.evidence)
        .toMatchObject({ fullStackHitCount: 5, stellarDirectIgnoreDefPercent: 1 });
      expect(currentTravelerMappingBlockers.find((entry) => entry.id === `${gender}-cryo-skill-full-blocked`)?.evidence.initialDamageSupported).toBe(true);
    }
    expect(currentTravelerMappingBlockers.some((entry) => "missingSourceDirectory" in entry.evidence)).toBe(false);
  });

  it("does not use the revision to erase actual numerical and HP-drain conflicts", () => {
    for (const gender of ["aether", "lumine"]) {
      const anemo = currentTravelerMappingBlockers.find((entry) => entry.id === `${gender}-anemo-burst-blocked`)!;
      expect(anemo.evidence.maxDifference).toBe(1.026);
      const dendro = currentTravelerMappingBlockers.find((entry) => entry.id === `${gender}-dendro-burst-lamp-tick-blocked`)!;
      expect((dendro.evidence.sourceValues as number[])[13]).toBe(1.80036);
      expect((dendro.evidence.catalogValues as number[])[13]).toBe(1.8036);
      const hydro = currentTravelerMappingBlockers.find((entry) => entry.id === `${gender}-hydro-skill-hold-full-blocked`)!;
      expect(hydro.evidence.sourceExpression).toBe("drainHP := 0.04 * c.CurrentHP()");
      expect(hydro.evidence.catalogExpression).toBe("param5: 4% MaxHP");
    }
    const malePyro = currentTravelerMappingBlockers.find((entry) => entry.id === "aether-pyro-charged-base-blocked")!;
    expect((malePyro.evidence.sourceValues as number[])[0]).toBe(0.6072);
    expect((malePyro.evidence.catalogValues as number[])[0]).toBe(0.7224);
  });

  it("pins the inspected archive, active snapshot and all used source files", () => {
    expect(currentTravelerSourceEvidence.commit).toBe(commit);
    expect(currentTravelerSourceEvidence.sha256).toBe("c0484e23afda76d7b38bb4fb49c2592b4b7bdccc8d549eaf8a4848e37aa55165");
    expect(currentTravelerSourceEvidence.bytes).toBe(64_166_679);
    expect(currentTravelerSourceEvidence.catalogSnapshotId).toContain("953ea16b6f72");
    const hashes = currentTravelerSourceEvidence.sourceSha256;
    expect(Object.keys(hashes)).toHaveLength(38);
    for (const entry of [...newTravelerMappings, ...currentTravelerMappingBlockers]) {
      for (const path of entry.sourcePaths) expect(hashes[path as keyof typeof hashes], `${entry.id}: ${path}`).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
