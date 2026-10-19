import { expect, it } from "vitest";
import { resolveEquipmentBuild, type EquipmentBuildInput } from "./equipment-build";
import type { ArtifactPieceInput } from "./artifact-build";
import { calculateDocument, parseCalculatorDocument, serializeCalculatorDocument } from "../../sim-core/src/calculator";
import { loadWorkedExample } from "../../sim-core/src/worked-examples";

it("restores Golden Troupe's explicit window and executes its two/four-piece terms once for skill hits", () => {
  const artifacts: ArtifactPieceInput[] = (["flower", "plume", "sands", "goblet"] as const).map(slot => ({
    slot, setId: "artifact-set:15032", rarity: 5, level: 0,
    mainStat: slot === "flower" ? "hp" : slot === "plume" ? "atk" : "hp_",
    initialSubstats: 3, substats: [{ stat: "critRate_", rolls: [0] }, { stat: "critDMG_", rolls: [0] }, { stat: "atk_", rolls: [0] }]
  }));
  const input: EquipmentBuildInput = {
    characterId: "character:10000015", weaponId: "weapon:11101", level: 1, ascension: 0,
    weaponLevel: 1, weaponAscension: 0, refinement: 1, effectsDisabled: true,
    setEffectsEnabled: true, artifacts, effectContext: { setEffectActive: true }
  };
  const doc = loadWorkedExample("fixture-a");
  doc.build = resolveEquipmentBuild(input).build;
  const hit = doc.hits[0]!;
  if (hit.kind !== "ordinary") throw new Error("Expected ordinary worked example");
  hit.attackTag = "skill";
  hit.damageBonus = 0;
  const restored = parseCalculatorDocument(serializeCalculatorDocument(doc));
  expect(restored).toEqual(doc);
  const bonus = () => calculateDocument(doc).hits[0]?.trace.find(node => node.id === "applicableDamageBonus")?.result?.value;
  expect(bonus()).toBeCloseTo(0.2 + 0.25 + 0.25, 12);
  hit.attackTag = "burst";
  expect(bonus()).toBe(0);
  hit.attackTag = "skill";
  doc.build = resolveEquipmentBuild({ ...input, effectContext: { setEffectActive: false } }).build;
  expect(bonus()).toBeCloseTo(0.2 + 0.25, 12);
  doc.build = resolveEquipmentBuild({ ...input, effectContext: {} }).build;
  expect(calculateDocument(doc).blockers.join()).toContain("setEffectActive");
});
