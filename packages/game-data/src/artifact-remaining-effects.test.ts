import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { evaluateFormulaExpression } from "../../sim-core/src/calculation-trace";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument } from "../../sim-core/src/calculator";
import { loadWorkedExample } from "../../sim-core/src/worked-examples";
import { resolveEquipmentBuild } from "./equipment-build";
import type { ArtifactPieceInput } from "./artifact-build";
import type { ArtifactConditionalContext } from "./artifact-conditional-effects";
import { resolveArtifactRemainingEffects as resolve } from "./artifact-remaining-effects";
import type { EquipmentDynamicHitBonus } from "./equipment-formulas";
import manifest from "../sources/artifact-remaining-effects/manifest.json";

const amount = (term: Pick<EquipmentDynamicHitBonus, "expression" | "inputs">) => evaluateFormulaExpression(term.expression, Object.fromEntries(term.inputs.map(input => [input.key, input.value])));
const effect = (setId: string, context: ArtifactConditionalContext = {}) => resolve({ setId, pieces: 4, enabled: true, context });
const pieces = (setId: string): ArtifactPieceInput[] => (["flower", "plume", "sands", "goblet"] as const).map(slot => ({ slot, setId, rarity: 4, level: 0, mainStat: slot === "flower" ? "hp" : slot === "plume" ? "atk" : "atk_", initialSubstats: 2, substats: [{ stat: "critRate_", rolls: [0] }, { stat: "critDMG_", rolls: [0] }] }));
const build = (setId: string, effectContext: ArtifactConditionalContext = {}) => resolveEquipmentBuild({ characterId: "character:10000015", weaponId: "weapon:11101", level: 1, ascension: 0, weaponLevel: 1, weaponAscension: 0, refinement: 1, effectsDisabled: true, setEffectsEnabled: true, artifacts: pieces(setId), effectContext }).build;

// One prepared batch contract; execution is intentionally left to the integrated validation pass.
it("restores five sourced artifact clauses through shared hit/reaction ASTs, scoped unknowns and JSON", () => {
  for (const file of manifest.files) {
    const bytes = readFileSync(new URL(`../sources/artifact-remaining-effects/${file.file}`, import.meta.url));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(file.sha256);
  }
  const sojourner = effect("artifact-set:10001").criticalBonuses[0]!;
  expect(sojourner.attackTags).toEqual(["charged"]); expect(amount(sojourner)).toBe(.3);
  const echoes = effect("artifact-set:15024", { echoesRiteActive: true, offField: false, echoesCurrentAttack: 2310 });
  expect(amount(echoes.additiveBaseBonuses[0]!)).toBe(1617);
  expect(echoes.additiveBaseBonuses[0]!.attackTags).toEqual(["normal"]);
  expect(amount(effect("artifact-set:15024", { echoesRiteActive: true, offField: true }).additiveBaseBonuses[0]!)).toBe(0);
  expect(effect("artifact-set:15024").pendingHitEffects[0]!.attackTags).toEqual(["normal"]);
  for (const [healing, expected] of [[20000, 1200], [1234.5, 98.76]] as const) {
    const song = effect("artifact-set:15033", { songWavesActive: true, offField: false, songRemainingTriggers: 1, songRecordedHealing: healing });
    expect(amount(song.additiveBaseBonuses[0]!)).toBeCloseTo(expected, 10);
    expect(song.additiveBaseBonuses[0]!.attackTags).toEqual(["normal", "charged", "plunge", "skill", "burst"]);
  }
  expect(amount(effect("artifact-set:15033", { songWavesActive: true, offField: false, songRemainingTriggers: 0 }).additiveBaseBonuses[0]!)).toBe(0);
  expect(amount(effect("artifact-set:15046", { targetSuperconductDebuffActive: true, offField: false }).criticalBonuses[0]!)).toBe(.16);
  expect(effect("artifact-set:15046", { targetSuperconductDebuffActive: true, offField: true }).pendingHitEffects[0]!.reason).toContain("TODO");
  for (const [stacks, expected] of [[0, .4], [1, .5], [2, .6], [3, .7], [4, .8]] as const) {
    const reaction = effect("artifact-set:15028", { paradiseLostStacks: stacks }).reactionBonuses[0]!;
    expect(amount(reaction.formula!)).toBeCloseTo(expected, 12);
    expect(reaction.reactions).toEqual(["bloom", "hyperbloom", "burgeon"]);
  }
  const doc = loadWorkedExample("fixture-a"), ordinary = doc.hits[0]!;
  if (ordinary.kind !== "ordinary") throw Error("Expected ordinary teaching hit");
  doc.build = build("artifact-set:15024");
  ordinary.attackTag = "skill";
  expect(calculateDocument(doc).status).toBe("calculated");
  ordinary.attackTag = "normal";
  expect(calculateDocument(doc).status).toBe("blocked");
  doc.build = build("artifact-set:15024", { echoesRiteActive: true, offField: false, echoesCurrentAttack: 2310 });
  const before = calculateDocument(doc);
  expect(before.status).toBe("calculated");
  expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(doc))).totals).toEqual(before.totals);
  expect(calculateDocument(convertCalculatorToFinalPanel(doc)).totals).toEqual(before.totals);
  doc.build = build("artifact-set:15028");
  expect(calculateDocument(doc).status).toBe("calculated");
  doc.hits = [{ id: "bloom", label: "明确的一次普通绽放", kind: "transformative", reaction: "bloom", reactionBonus: 0, sourceRefs: [], dependencies: [] }];
  doc.selectedHitIds = ["bloom"];
  expect(calculateDocument(doc).status).toBe("blocked");
  doc.build = build("artifact-set:15028", { paradiseLostStacks: 4 });
  const bloom = calculateDocument(doc);
  expect(bloom.status).toBe("calculated");
  expect(bloom.hits[0]!.trace.some(node => node.ruleId.includes("equipmentReactionFormula") || node.id.includes("equipmentReactionFormula"))).toBe(true);
  doc.build.equipment!.reactionBonuses![0]!.value = 999;
  expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(doc))).totals).toEqual(bloom.totals);
});
