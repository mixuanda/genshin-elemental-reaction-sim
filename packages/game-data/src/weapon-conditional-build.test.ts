import { expect, it } from "vitest";
import { resolveEquipmentBuild } from "./equipment-build";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument } from "../../sim-core/src/calculator";
import { loadWorkedExample } from "../../sim-core/src/worked-examples";

it("restores Hamayumi's full-energy context and preserves distinct normal/charged source bonuses", () => {
  const input = { characterId: "character:10000021", weaponId: "weapon:15414", level: 90, ascension: 6, weaponLevel: 90, weaponAscension: 6, refinement: 1, effectsDisabled: true, weaponEffectsEnabled: true };
  const doc = loadWorkedExample("fixture-a");
  doc.build = resolveEquipmentBuild({ ...input, effectContext: { energyFull: true } }).build;
  const base = doc.hits[0]!;
  if (base.kind !== "ordinary") throw new Error("Expected ordinary example");
  base.damageBonus = 0;
  doc.scope = "one-cast";
  doc.hits = [{ ...base, id: "normal", attackTag: "normal" }, { ...base, id: "charged", attackTag: "charged" }];
  doc.selectedHitIds = ["normal", "charged"];
  const restored = parseCalculatorDocument(serializeCalculatorDocument(doc));
  expect(restored).toEqual(doc);
  const output = calculateDocument(restored);
  expect(output.hits.map(hit => hit.trace.find(node => node.id === "applicableDamageBonus")?.result?.value)).toEqual([.32, .24]);
  expect(calculateDocument(convertCalculatorToFinalPanel(restored, "imported-final")).totals).toEqual(output.totals);
  doc.build = resolveEquipmentBuild({ ...input, effectContext: { energyFull: false } }).build;
  expect(calculateDocument(doc).hits.map(hit => hit.trace.find(node => node.id === "applicableDamageBonus")?.result?.value)).toEqual([.16, .12]);
  doc.build = resolveEquipmentBuild(input).build;
  expect(calculateDocument(doc).blockers.join()).toContain("energyFull");
});
