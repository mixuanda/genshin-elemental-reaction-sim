import { describe, expect, it } from "vitest";
import { getCharacterDocuments, applyCharacterConstellationScope } from "./character-calculations";
import { calculateDocument, resolveCalculatorStats } from "../../../packages/sim-core/src/calculator";
import { resolveEquipmentBuild, type EquipmentBuildInput } from "../../../packages/game-data/src/equipment-build";
import { prepareNicoleSkillInitialEquipmentInput } from "../../../packages/sim-core/src/nicole-skill-initial-weapon-refresh";
import { prepareSourceCastDocument, resetSourceCastPanelAccounting } from "../../../packages/sim-core/src/source-cast-context";
import { parseCalculatorDocument, serializeCalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { collectCalculatorRequirements } from "./calculator-requirements";
import { renderSourceCastControls } from "./calculator-source-cast-controls";

const fresh = () => {
  const doc = getCharacterDocuments("character:10000131", 10).find(row => row.gameContext?.skillId === "nicole-skill")!;
  expect(doc.gameContext?.nicoleSkillInitial).toBeDefined();
  doc.gameContext!.constellation = 2;
  doc.build = { mode: "manual-final", stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "explicit independent fixture, not an imported player" };
  doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  Object.assign(doc.gameContext!.nicoleSkillInitial!, { noOtherEventsBeforeInitial: true, noDisplacementBeforeInitial: true,
    skillGrantNonExtraAttack: 2000, grantAttackSource: "observed", includedSkillAttack: 0,
    c2AttackIncludedInPanel: false, a1AttackIncludedInPanel: false, includedC2ResistanceReduction: 0 });
  return applyCharacterConstellationScope(doc);
};

describe("registered Nicole C2 initial E calculator", () => {
  it("uses the effective E10 once, pre-hit ATK and same-hit dynamic C2 resistance through JSON", () => {
    const doc = fresh(), reopened = parseCalculatorDocument(serializeCalculatorDocument(doc));
    const result = calculateDocument(reopened);
    expect(result.status, result.blockers.join("\n")).toBe("calculated");
    // E8 grants min(2000*.15,300)+C2 300; A1 has not entered E9's snapshot.
    // OnEnemyHit C2 shred does enter dynamic RES: .1-.25=-.15 => 1.075.
    expect(result.totals!.nonCritical).toBeCloseTo(2600 * 2.4912 * .5 * 1.075, 9);
    expect(result.totals!.expected).toBeCloseTo(5222.178, 8);
    expect(calculateDocument(doc).totals).toEqual(result.totals);
    expect(reopened.gameContext!.nicoleSkillInitial).toEqual(doc.gameContext!.nicoleSkillInitial);
  });
  it("subtracts already-in-panel ATK and resistance without duplicating E, C2 or new A1", () => {
    const doc = fresh(); if (doc.build.mode !== "manual-final") throw new Error("fixture");
    doc.build.stats.atk = 2600; doc.enemy.resistance = -.15;
    Object.assign(doc.gameContext!.nicoleSkillInitial!, { includedSkillAttack: 300, c2AttackIncludedInPanel: true, includedC2ResistanceReduction: .25 });
    expect(calculateDocument(doc).totals!.expected).toBeCloseTo(5222.178, 8);
  });
  it("links an unknown actual sample, refuses contradictory conditions and preserves an old context-free file", () => {
    const doc = fresh(); delete doc.gameContext!.nicoleSkillInitial!.skillGrantNonExtraAttack;
    delete doc.gameContext!.nicoleSkillInitial!.grantAttackSource;
    expect(calculateDocument(doc).status).toBe("blocked");
    expect(collectCalculatorRequirements(doc).fields).toEqual(expect.arrayContaining([expect.objectContaining({ fieldPath: "gameContext.nicoleSkillInitial.skillGrantNonExtraAttack", adapterId: "nicole-skill-initial-conditions" })]));
    expect(renderSourceCastControls(doc)).toContain('data-field="gameContext.nicoleSkillInitial.skillGrantNonExtraAttack"');
    Object.assign(doc.gameContext!.nicoleSkillInitial!, { skillGrantNonExtraAttack: 2000, grantAttackSource: "observed", targetInC2AreaAtInitial: false });
    expect(calculateDocument(doc).status).toBe("blocked");
    delete doc.gameContext!.nicoleSkillInitial;
    const original = serializeCalculatorDocument(doc), opened = parseCalculatorDocument(original);
    expect(opened.gameContext!.nicoleSkillInitial).toBeUndefined(); expect(serializeCalculatorDocument(opened)).toBe(original);
  });
  it("refreshes the proved R1 clause through the public calculator without losing editable panel deltas", () => {
    const doc = fresh();
    doc.build = resolveEquipmentBuild({ characterId: "character:10000131", weaponId: "weapon:14523",
      level: 90, ascension: 6, weaponLevel: 90, weaponAscension: 6, refinement: 1,
      effectsDisabled: true, weaponEffectsEnabled: true, setEffectsEnabled: false,
      effectContext: { weaponEffectActive: false } }).build;
    doc.build.flatAtk += 2000 - resolveCalculatorStats(doc.build).atk;
    doc.build.critRate = .5; doc.build.critDamage = 1;
    const flat = doc.build.flatAtk;
    resetSourceCastPanelAccounting(doc, "fresh-equipment");
    const prepared = prepareSourceCastDocument(doc);
    expect(prepared.gameContext!.nicoleSkillInitial).toMatchObject({ skillGrantNonExtraAttack: 2000, grantAttackSource: "equipment-current" });
    if (prepared.build.mode !== "equipment-derived") throw new Error("equipment");
    expect(prepared.build.flatAtk).toBe(flat);
    const result = calculateDocument(doc);
    // Independent Decimal baseline, not a player build: 2600*2.4912*.5*1.075*1.2*1.5.
    expect(result.status, result.blockers.join("\n")).toBe("calculated");
    expect(result.totals!.expected).toBeCloseTo(6266.6136, 8);
    const reopened = parseCalculatorDocument(serializeCalculatorDocument(doc));
    expect(calculateDocument(reopened).totals).toEqual(result.totals);
    doc.build.equipment!.dynamicHitBonuses![0]!.sourceRefs = ["fixture:forged-source"];
    const blocked = calculateDocument(doc);
    expect(blocked.status).toBe("blocked");
    expect(blocked.blockers.join("\n")).toContain("尘光");
    expect(doc.build.equipment!.dynamicHitBonuses![0]!.sourceRefs).toEqual(["fixture:forged-source"]);
  });
  it("prepares a new signature build from its own source stats and blocks unknown E timing before apply", () => {
    const doc = fresh(), input: EquipmentBuildInput = { characterId: "character:10000131", weaponId: "weapon:14523",
      level: 90, ascension: 6, weaponLevel: 90, weaponAscension: 6, refinement: 1,
      effectsDisabled: true, weaponEffectsEnabled: true, setEffectsEnabled: false, effectContext: {} };
    const prepared = prepareNicoleSkillInitialEquipmentInput(doc, input);
    expect(prepared.status).toBe("prepared");
    expect(input.effectContext).toEqual({});
    const resolved = resolveEquipmentBuild(prepared.input);
    expect(prepared.input.effectContext!.catalystSnapshotAtk).toBe(resolveCalculatorStats(resolved.build).atk);
    expect(prepared.input.effectContext!.catalystSnapshotAtk).not.toBe(2000);
    doc.build = resolved.build; resetSourceCastPanelAccounting(doc, "fresh-equipment");
    expect(calculateDocument(doc).status).toBe("calculated");
    doc.gameContext!.nicoleSkillInitial!.noOtherEventsBeforeInitial = undefined;
    expect(prepareNicoleSkillInitialEquipmentInput(doc, input)).toMatchObject({ status: "blocked", blocked: true, input });
  });
});
