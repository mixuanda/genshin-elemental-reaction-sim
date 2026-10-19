import { expect, it } from "vitest";
import { artifactSetCatalog } from "./supplemental";
import { resolveArtifactBuild, type ArtifactPieceInput } from "./artifact-build";
import { artifactNonDamagePieceDescriptions, resolveArtifactSetEffects } from "./equipment-effects";
import { getArtifactConditionalControls } from "./artifact-conditional-effects";
import { getConditionalEquipmentCoverage, resolveEquipmentBuild, type EquipmentBuildInput } from "./equipment-build";
import { calculateDocument, parseCalculatorDocument, serializeCalculatorDocument } from "../../sim-core/src/calculator";
import { loadWorkedExample } from "../../sim-core/src/worked-examples";

const pieces = (setId: string): ArtifactPieceInput[] => (["flower", "plume"] as const).map(slot => ({
  slot, setId, rarity: 5, level: 0, mainStat: slot === "flower" ? "hp" : "atk", initialSubstats: 3,
  substats: [{ stat: "critRate_", rolls: [0] }, { stat: "critDMG_", rolls: [0] }, { stat: "atk_", rolls: [0] }]
}));
const input: EquipmentBuildInput = {
  characterId: "character:10000015", weaponId: "weapon:11101", level: 1, ascension: 0,
  weaponLevel: 1, weaponAscension: 0, refinement: 1, effectsDisabled: true, setEffectsEnabled: true
};

it("maps the two named 7.1 ATK sets exactly once at two pieces and leaves their star-reaction four-piece clauses unmodeled", () => {
  for (const setId of ["artifact-set:15047", "artifact-set:15048"]) {
    const base = resolveEquipmentBuild({ ...input, artifacts: pieces(setId), setEffectsEnabled: false });
    const enabled = resolveEquipmentBuild({ ...input, artifacts: pieces(setId) });
    expect(enabled.build.atkPercent - base.build.atkPercent).toBeCloseTo(0.18, 12);
    expect(enabled.build.equipment.sourceRefs.some(ref => ref.includes("180a0a1015cb725c7570cd828eb086749960df98"))).toBe(true);
    expect(resolveArtifactSetEffects({ setId, pieces: 1, enabled: true }).statContributions).toEqual([]);
    expect(resolveArtifactSetEffects({ setId, pieces: 4, enabled: true }).effectBlockers.join()).toMatch(/4 件套.*星/);
  }
  expect(getConditionalEquipmentCoverage()).toMatchObject({ twoPieceArtifactDefinitions: 53, independentlyVerifiedDefinitions: 0 });
});

it("executes Obsidian's two-piece explicit Nightsoul AND frontline condition through the shared core and round trip", () => {
  const setId = "artifact-set:15038";
  expect(getArtifactConditionalControls({ [setId]: 1 })).toEqual([]);
  expect(getArtifactConditionalControls({ [setId]: 2 })).toEqual([expect.objectContaining({ key: "nightsoulFrontlineActive", kind: "boolean" })]);
  expect(getArtifactConditionalControls({ [setId]: 4 }).map(control => control.key)).toEqual(["nightsoulFrontlineActive", "setEffectActive"]);
  expect(getArtifactConditionalControls({ "artifact-set:15032": 2 })).toEqual([]);
  expect(getArtifactConditionalControls({ "artifact-set:15032": 4 })[0]?.key).toBe("setEffectActive");
  const doc = loadWorkedExample("fixture-a");
  const hit = doc.hits[0]!;
  if (hit.kind !== "ordinary") throw new Error("Expected ordinary worked example");
  hit.damageBonus = 0;
  const apply = (active: boolean) => {
    doc.build = resolveEquipmentBuild({ ...input, artifacts: pieces(setId), effectContext: { nightsoulFrontlineActive: active } }).build;
    return calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(doc))).hits[0]!;
  };
  for (const attackTag of ["normal", "skill"] as const) {
    hit.attackTag = attackTag;
    const on = apply(true), off = apply(false);
    expect(on.trace.find(node => node.id === "applicableDamageBonus")?.result?.value).toBeCloseTo(0.15, 12);
    expect(off.trace.find(node => node.id === "applicableDamageBonus")?.result?.value).toBe(0);
    expect(on.trace.some(node => node.inputs.some(variable => variable.key === "nightsoulFrontlineActive"))).toBe(true);
  }
  expect(() => resolveEquipmentBuild({ ...input, artifacts: pieces(setId) })).toThrow(/nightsoulFrontlineActive/);
  expect(resolveArtifactSetEffects({ setId, pieces: 4, enabled: true, context: { nightsoulFrontlineActive: true } }).effectBlockers.join()).toMatch(/4 件套/);
});

it("keeps legitimate tiara one-piece and five survival clauses descriptive without inventing damage or healing-output stats", () => {
  for (const [slug, description] of Object.entries(artifactNonDamagePieceDescriptions)) {
    const set = artifactSetCatalog.find(entry => entry.slug === slug)!;
    const result = resolveArtifactSetEffects({ setId: set.id, pieces: description.pieces, enabled: true });
    expect(result.statContributions).toEqual([]);
    expect(result.hitBonuses).toEqual([]);
    expect(result.assumptions.join()).toContain(`来源值=${description.value}`);
    expect(result.effectBlockers.join()).toMatch(/未计入可执行套装覆盖/);
    if (description.pieces === 1) {
      const tiara: ArtifactPieceInput = { slot: "circlet", setId: set.id, rarity: 3, level: 0, mainStat: "hp_", initialSubstats: 1, substats: [{ stat: "atk", rolls: [0] }] };
      expect(resolveArtifactBuild([tiara]).setCounts).toEqual({ [set.id]: 1 });
      expect(() => resolveArtifactBuild([{ ...tiara, slot: "flower", mainStat: "hp" }])).toThrow(/没有生之花/);
    }
  }
  const cinder = resolveArtifactSetEffects({ setId: "artifact-set:15037", pieces: 2, enabled: true });
  expect(cinder.statContributions).toEqual([]);
  expect(cinder.effectBlockers.join()).toMatch(/恢复6点能量.*夜魂迸发事件/);
});
