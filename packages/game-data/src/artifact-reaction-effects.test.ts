import { expect, it } from "vitest";
import { resolveArtifactReactionEffects } from "./artifact-reaction-effects";
import { resolveEquipmentBuild } from "./equipment-build";
import type { ArtifactPieceInput } from "./artifact-build";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument, type CalculatorHit } from "../../sim-core/src/calculator";
import { loadWorkedExample } from "../../sim-core/src/worked-examples";

const vvContext = { vvPyroResActive: true, vvHydroResActive: false, vvCryoResActive: false, vvElectroResActive: false };
it.each([
  { id: "artifact-set:15002", expected: { swirlPyro: .6, swirlHydro: .6, swirlCryo: .6, swirlElectro: .6 } },
  { id: "artifact-set:15005", expected: { overload: .4, electroCharged: .4, superconduct: .4, hyperbloom: .4, aggravate: .2 } },
  { id: "artifact-set:15006", expected: { overload: .4, burning: .4, burgeon: .4, melt: .15, reverseMelt: .15, vaporize: .15, reverseVaporize: .15 } },
  { id: "artifact-set:15025", expected: {} }
])("maps only the fixed reaction/RES sources for $id", ({ id, expected }) => {
  const context = { ...vvContext, setEffectActive: true };
  const result = resolveArtifactReactionEffects({ setId: id, pieces: 4, enabled: true, context });
  expect(Object.fromEntries(result.reactionBonuses.flatMap(bonus => bonus.reactions.map(reaction => [reaction, bonus.value])))).toEqual(expected);
  expect(result.missingConditions).toEqual([]);
  expect(result.sourceRefs.some(ref => ref.includes("b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"))).toBe(true);
  const disabled = resolveArtifactReactionEffects({ setId: id, pieces: 4, enabled: false });
  expect(disabled.reactionBonuses).toEqual([]); expect(disabled.resistanceReductions).toEqual([]); expect(disabled.missingConditions).toEqual([]);
  if (id === "artifact-set:15002") {
    expect(result.resistanceReductions.map(term => [term.elements[0], term.value, term.active])).toEqual([["pyro", .4, true], ["hydro", .4, false], ["cryo", .4, false], ["electro", .4, false]]);
    expect(resolveArtifactReactionEffects({ setId: id, pieces: 4, enabled: true }).pendingResistanceEffects).toHaveLength(4);
    expect(result.effectBlockers.join()).toContain("星扩散");
  }
  if (id === "artifact-set:15025") {
    expect(result.resistanceReductions[0]).toMatchObject({ elements: ["dendro"], value: .3, active: true });
    expect(resolveArtifactReactionEffects({ setId: id, pieces: 4, enabled: true, context: { setEffectActive: false } }).resistanceReductions[0]?.active).toBe(false);
  }
  if (id === "artifact-set:15005") expect(result.effectBlockers.join()).toMatch(/月感电20%已有固定源码证据/);
  if (id === "artifact-set:15006") expect(resolveArtifactReactionEffects({ setId: id, pieces: 4, enabled: true }).reactionBonuses).toEqual(result.reactionBonuses);
});

it("executes sourced VV swirl/RES independently and preserves the exact effective context on export", () => {
  const artifacts: ArtifactPieceInput[] = (["flower", "plume", "sands", "goblet"] as const).map(slot => ({ slot, setId: "artifact-set:15002", rarity: 5, level: 0, mainStat: slot === "flower" ? "hp" : slot === "plume" ? "atk" : "hp_", initialSubstats: 3, substats: [{ stat: "critRate_", rolls: [0] }, { stat: "critDMG_", rolls: [0] }, { stat: "atk_", rolls: [0] }] }));
  const doc = loadWorkedExample("transformative");
  doc.build = resolveEquipmentBuild({ characterId: "character:10000003", weaponId: "weapon:11101", level: 90, ascension: 6, weaponLevel: 1, weaponAscension: 0, refinement: 1, effectsDisabled: true, setEffectsEnabled: true, artifacts, effectContext: vvContext }).build;
  const hit = doc.hits[0]!;
  if (hit.kind !== "transformative") throw new Error("Expected transformative example");
  hit.reaction = "swirlPyro"; hit.reactionBonus = 0;
  const restored = parseCalculatorDocument(serializeCalculatorDocument(doc));
  const result = calculateDocument(restored);
  const value = (id: string) => result.hits[0]?.trace.find(node => node.id === id)?.result?.value;
  expect(value("applicableReactionBonus")).toBe(.6);
  expect(value("effectiveResistance")).toBeCloseTo(-.3, 12);
  expect(calculateDocument(convertCalculatorToFinalPanel(restored, "imported-final")).totals).toEqual(result.totals);
  hit.reaction = "swirlHydro";
  expect(calculateDocument(doc).hits[0]?.trace.find(node => node.id === "effectiveResistance")?.result?.value).toBe(.1);
});

it.each([
  { setId: "artifact-set:15002", element: "pyro" as const, unrelated: "anemo" as const, reaction: "swirlPyro" as const, condition: "vvPyroResActive" as const },
  { setId: "artifact-set:15025", element: "dendro" as const, unrelated: "pyro" as const, reaction: "bloom" as const, condition: "setEffectActive" as const }
])("keeps unknown RES scope-specific through final-panel JSON for $setId", ({ setId, element, unrelated, reaction, condition }) => {
  const artifacts: ArtifactPieceInput[] = (["flower", "plume", "sands", "goblet"] as const).map(slot => ({ slot, setId, rarity: 5, level: 0, mainStat: slot === "flower" ? "hp" : slot === "plume" ? "atk" : "hp_", initialSubstats: 3, substats: [{ stat: "critRate_", rolls: [0] }, { stat: "critDMG_", rolls: [0] }, { stat: "atk_", rolls: [0] }] }));
  const input = { characterId: "character:10000003", weaponId: "weapon:11101", level: 90, ascension: 6, weaponLevel: 1, weaponAscension: 0, refinement: 1, effectsDisabled: true, setEffectsEnabled: true, artifacts };
  const doc = loadWorkedExample("fixture-a");
  doc.build = resolveEquipmentBuild(input).build;
  const known = doc.hits[0]!;
  if (known.kind !== "ordinary") throw Error("Expected ordinary example");
  known.element = unrelated;
  const affected = { ...structuredClone(known), id: "affected-res", element };
  const transformed: Extract<CalculatorHit, { kind: "transformative" }> = { id: "affected-transformative", label: "同元素剧变", kind: "transformative" as const, reaction, reactionBonus: 0, dependencies: [], sourceRefs: [] };
  doc.hits = [known, affected, transformed];
  expect(calculateDocument(doc).status).toBe("calculated");
  const final = parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(doc)));
  for (const hit of [affected, transformed]) {
    doc.selectedHitIds = [hit.id];
    const blocked = calculateDocument(doc);
    expect(blocked.status).toBe("blocked");
    expect(blocked.hits[0]!.blockers.join()).toContain(condition);
    expect(blocked.hits[0]!.trace[0]!.sourceRefs.length).toBeGreaterThan(0);
    final.selectedHitIds = [hit.id];
    expect(calculateDocument(final).status).toBe("blocked");
  }
  transformed.effectiveResistance = -.3;
  expect(calculateDocument(doc).status).toBe("calculated");
  delete transformed.effectiveResistance;
  doc.build = resolveEquipmentBuild({ ...input, effectContext: { [condition]: false } }).build;
  expect(calculateDocument(doc).status).toBe("calculated");
  expect(calculateDocument(doc).hits[0]!.trace.find(node => node.id === "effectiveResistance")?.result?.value).toBe(.1);
});
