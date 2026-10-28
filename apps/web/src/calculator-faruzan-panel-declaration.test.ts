import { expect, it } from "vitest";
import { getCharacterDocuments } from "./character-calculations";
import { applyFaruzanEPanelExcludesOwnEffectsDeclaration, getFaruzanEPanelDeclarationHitIds } from "./calculator-faruzan-panel-declaration";
import { renderFiniteFollowupCastControls } from "./calculator-finite-followup-controls";

it("applies only an explicit selected C0 E panel declaration while preserving other input and historical state", () => {
  const document = getCharacterDocuments("character:10000076", 1)
    .find(row => row.gameContext?.skillId === "finite-followup-faruzan-skill-hurricane-c0")!;
  const [initial, arrow, collapse] = document.hits;
  if (initial?.kind !== "ordinary" || arrow?.kind !== "ordinary" || collapse?.kind !== "ordinary" || document.build.mode !== "manual-final")
    throw new Error("Expected the existing three ordinary C0 E components");
  initial.damageBonus = .27; initial.additiveBaseDamage = 17;
  document.enemy.resistance = .13;
  collapse.finalSnapshot = { stats: { ...document.build.stats }, characterLevel: 90, ascension: 6, damageBonus: .3,
    additiveBaseDamage: 25, reactionBonus: 0, source: "Explicit historical panel", sourceRefs: ["fixture:historical"] };
  document.hits.push({ ...structuredClone(initial), id: "outside-canonical" });
  document.selectedHitIds = [initial.id, collapse.id, "outside-canonical"];
  document.gameContext!.finiteFollowupCast = { faruzanFreshNoPriorEffects: true, normalTalentLevel: 8,
    hitStates: {
      [initial.id]: { includedDamageBonus: .1, includedAdditiveBase: 3, includedResistanceReduction: .2, cynoBurstEmIncludedInPanel: true },
      [arrow.id]: { includedDamageBonus: .2, includedAdditiveBase: 4, includedResistanceReduction: .3 },
      [collapse.id]: { includedDamageBonus: .3, includedAdditiveBase: 5, includedResistanceReduction: .4 },
      "outside-canonical": { includedDamageBonus: .4, includedAdditiveBase: 6, includedResistanceReduction: .5 },
    } };
  const before = structuredClone(document);
  expect(getFaruzanEPanelDeclarationHitIds(document)).toEqual([initial.id]);
  expect(renderFiniteFollowupCastControls(document)).toContain('data-action="faruzan-e-panel-excludes-own-effects"');
  expect(renderFiniteFollowupCastControls(document)).toContain("data-faruzan-e-panel-declaration");
  // Rendering a fresh-cast answer does not apply the separate panel declaration.
  expect(document).toEqual(before);
  const next = applyFaruzanEPanelExcludesOwnEffectsDeclaration(document);
  const expected = structuredClone(before);
  Object.assign(expected.gameContext!.finiteFollowupCast!.hitStates![initial.id]!, {
    includedDamageBonus: 0, includedAdditiveBase: 0, includedResistanceReduction: 0,
  });
  expect(next).toEqual(expected);
  expect(document).toEqual(before);

  const unknown = structuredClone(document);
  delete unknown.gameContext!.finiteFollowupCast;
  const declared = applyFaruzanEPanelExcludesOwnEffectsDeclaration(unknown)!;
  expect(declared.gameContext!.finiteFollowupCast).toEqual({ hitStates: {
    [initial.id]: { includedDamageBonus: 0, includedAdditiveBase: 0, includedResistanceReduction: 0 },
  } });
  expect(unknown.gameContext!.finiteFollowupCast).toBeUndefined();

  for (const change of [{ characterId: "character:10000042" }, { skillId: "finite-followup-faruzan-burst-fresh-c0" }, { constellation: 1 }]) {
    const other = structuredClone(document);
    Object.assign(other.gameContext!, change);
    const original = structuredClone(other);
    expect(applyFaruzanEPanelExcludesOwnEffectsDeclaration(other)).toBeUndefined();
    expect(renderFiniteFollowupCastControls(other)).not.toContain('data-action="faruzan-e-panel-excludes-own-effects"');
    expect(other).toEqual(original);
  }
  document.selectedHitIds = [collapse.id, "outside-canonical"];
  expect(applyFaruzanEPanelExcludesOwnEffectsDeclaration(document)).toBeUndefined();
  expect(renderFiniteFollowupCastControls(document)).not.toContain('data-action="faruzan-e-panel-excludes-own-effects"');
  document.selectedHitIds = [];
  expect(applyFaruzanEPanelExcludesOwnEffectsDeclaration(document)).toBeUndefined();
  const blocked = structuredClone(before);
  blocked.hits = [{ id: initial.id, label: initial.label, kind: "blocked", dependencies: [], sourceRefs: [], reasons: ["Explicit blocked component"] }];
  blocked.selectedHitIds = [initial.id];
  expect(applyFaruzanEPanelExcludesOwnEffectsDeclaration(blocked)).toBeUndefined();
});
