import {describe, expect, it} from "vitest";
import {applyCharacterConstellationScope, getCharacterDocuments} from "../../../apps/web/src/character-calculations";
import {renderXiaoControls, xiaoRequirementAdapter} from "../../../apps/web/src/calculator-xiao-controls";
import {calculateDocument, convertCalculatorToFinalPanel} from "./calculator";
import {parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument} from "./calculator-model";
import {prepareSourceCastDocument, resetSourceCastPanelAccounting} from "./source-cast-context";
import {xiaoContext} from "./xiao-damage-formulas";

function fixture(skillId = "xiao-q-high-plunge", constellation = 1, level = 10): CalculatorDocument {
  const document = getCharacterDocuments("character:10000026", level).find(doc => doc.gameContext?.skillId === skillId)!;
  if (!document) throw new Error(`Missing actual Xiao action: ${skillId}`);
  document.gameContext!.constellation = constellation;
  document.build = {mode: "manual-final", ascension: 6, source: "Explicit synthetic per-hit panel; not a player build", stats: {atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1}};
  document.enemy = {level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0};
  const context = xiaoContext(document);
  if (context?.burstActive) { context.burstTalentLevel = 10; context.burstElapsedSeconds = 0; }
  return document;
}
const calculate = (document: CalculatorDocument) => calculateDocument(applyCharacterConstellationScope(document));

describe("Xiao actual selected-hit output", () => {
  it("retains physical entries and appends Q-state outputs plus separate collision", () => {
    const documents = getCharacterDocuments("character:10000026", 10);
    expect(documents[0]!.gameContext!.skillId).toBe("xiao-skill");
    expect(documents.filter(doc => doc.gameContext!.skillId.startsWith("xiao-q-"))).toHaveLength(10);
    expect(documents.find(doc => doc.gameContext!.skillId === "xiao-normal-2-base-c0")!.hits[0]).toMatchObject({kind: "ordinary", element: "physical"});
    expect(documents.find(doc => doc.gameContext!.skillId === "xiao-q-high-plunge")!.hits).toHaveLength(1);
    expect(documents.find(doc => doc.gameContext!.skillId === "xiao-q-plunge-collision")!.hits).toHaveLength(1);
  });

  it.each([0, 1, 2, 3, 4, 5, 6])("supports C%i E with the given effective talent, not an extra +3", constellation => {
    const result = calculate(fixture("xiao-skill", constellation));
    expect(result.blockers).toEqual([]);
    expect(result.totals!.nonCritical).toBeCloseTo(2000 * 4.5504 * .5 * .9, 9);
    expect(result.totals!.expected).toBeCloseTo(2000 * 4.5504 * .5 * .9 * 1.5, 9);
  });

  it.each([[0, .05], [179 / 60, .05], [3, .1], [6, .15], [9, .2], [12, .25], [15, .25]])("uses Q-start elapsed time %s seconds for A1", (elapsed, a1) => {
    const document = fixture(); xiaoContext(document)!.burstElapsedSeconds = elapsed;
    const result = calculate(document);
    // Independent fixed tables: highPlunge[9]=4.040179; Q10=.952.
    expect(result.blockers).toEqual([]);
    expect(result.totals!.nonCritical).toBeCloseTo(2000 * 4.040179 * (1 + .952 + a1) * .5 * .9, 9);
    expect(prepareSourceCastDocument(document).hits[0]).toMatchObject({element: "anemo", attackTag: "plunge"});
  });

  it.each([["xiao-q-low-plunge", 3.234591], ["xiao-q-high-plunge", 4.040179], ["xiao-q-plunge-collision", 1.617638], ["xiao-q-charged", 2.16032]])("calculates %s as its own real coefficient", (id, coefficient) => {
    const result = calculate(fixture(id));
    expect(result.blockers).toEqual([]);
    expect(result.totals!.nonCritical).toBeCloseTo(2000 * coefficient * 2.002 * .5 * .9, 9);
  });

  it("uses independent Q13 for a C5+ normal10 and never Q-scales E", () => {
    const normal = fixture("xiao-q-normal-1", 6);
    xiaoContext(normal)!.burstTalentLevel = 13;
    expect(calculate(normal).totals!.nonCritical).toBeCloseTo(2000 * .49141 * (1 + 1.0885 + .05) * .5 * .9, 9);
    const skill = fixture("xiao-skill");
    Object.assign(xiaoContext(skill)!, {burstActive: true, burstElapsedSeconds: 6, skillA4Stacks: 2});
    delete xiaoContext(skill)!.burstTalentLevel;
    expect(calculate(skill).blockers).toEqual([]);
    expect(calculate(skill).totals!.nonCritical).toBeCloseTo(2000 * 4.5504 * (1 + .15 + .30) * .5 * .9, 9);
  });

  it.each([0, 1, 2, 3])("uses %i actually active A4 stacks before E, not one extra stack", stacks => {
    const document = fixture("xiao-skill"); xiaoContext(document)!.skillA4Stacks = stacks;
    expect(calculate(document).totals!.nonCritical).toBeCloseTo(2000 * 4.5504 * (1 + .15 * stacks) * .5 * .9, 9);
  });

  it("keeps E's cast-time A1 sample before the +4f hit crossing a three-second boundary", () => {
    const document = fixture("xiao-skill");
    Object.assign(xiaoContext(document)!, {burstActive: true, burstElapsedSeconds: 179 / 60});
    expect(calculate(document).totals!.nonCritical).toBeCloseTo(2000 * 4.5504 * 1.05 * .5 * .9, 9);
    expect(renderXiaoControls(document)).toContain("按下本次E时");
  });

  it("replaces an included own bonus once and can remove a stale Q share", () => {
    const fresh = fixture(), included = fixture();
    if (included.hits[0]!.kind !== "ordinary") throw new Error("ordinary");
    included.hits[0]!.damageBonus = 1.002; xiaoContext(included)!.includedDamageBonus = 1.002;
    expect(calculate(included).totals).toEqual(calculate(fresh).totals);
    const physical = fixture("xiao-normal-2-base-c0");
    if (physical.hits[0]!.kind !== "ordinary") throw new Error("ordinary");
    physical.hits[0]!.damageBonus = .952; xiaoContext(physical)!.includedDamageBonus = .952;
    expect(calculate(physical).totals!.nonCritical).toBeCloseTo(2000 * 1.01579 * .5 * .9, 9);
  });

  it.each(["burstActive", "burstTalentLevel", "burstElapsedSeconds", "includedDamageBonus"] as const)("blocks missing %s and exposes the actual control", key => {
    const document = fixture(); delete xiaoContext(document)![key];
    const prepared = prepareSourceCastDocument(document), result = calculate(prepared);
    expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined();
    const required = xiaoRequirementAdapter.collect(prepared).find(field => field.fieldPath.endsWith("." + key));
    expect(required).toBeDefined();
    expect(renderXiaoControls(prepared)).toContain(`gameContext.xiaoDamage.${key}`);
  });

  it("requires E A4 state, respects locked ascensions and refuses an invented multi-hit Q time", () => {
    const skill = fixture("xiao-skill"); delete xiaoContext(skill)!.skillA4Stacks;
    expect(calculate(skill).status).toBe("blocked");
    skill.gameContext!.ascension = 0; if (skill.build.mode !== "equipment-derived") skill.build.ascension = 0;
    expect(calculate(skill).status).toBe("calculated");
    xiaoContext(skill)!.skillA4Stacks = 1; expect(calculate(skill).status).toBe("blocked");
    const normal = fixture("xiao-q-normal-1"); normal.scope = "one-cast"; normal.selectedHitIds = normal.hits.map(hit => hit.id);
    expect(calculate(normal).status).toBe("blocked");
  });

  it("keeps active-Q claims, invalid domains and unrelated missing evidence fail-closed", () => {
    const inactive = fixture(); xiaoContext(inactive)!.burstActive = false;
    expect(calculate(inactive).status).toBe("blocked");
    const invalid = fixture("xiao-skill"); (xiaoContext(invalid)! as Record<string, unknown>).skillA4Stacks = 4;
    expect(() => calculate(invalid)).toThrow();
    const missing = fixture(); missing.dependencies.push({id: "unreviewed-equipment", status: "missing", reason: "Actual unresolved equipment effect", sourceRefs: []});
    missing.hits[0]!.dependencies.push("unreviewed-equipment");
    expect(calculate(missing).status).toBe("blocked");
    const extra = fixture("xiao-skill", 6);
    const copied = structuredClone(extra.hits[0]!); copied.id = "invented-c6-extra-e";
    extra.hits.push(copied); extra.selectedHitIds.push(copied.id); extra.scope = "one-cast";
    expect(calculate(extra).status).toBe("blocked");
  });

  it("keeps source-panel conversion idempotent and rejects changing the saved Q time", () => {
    const document = fixture();
    document.build = {mode: "equipment-derived", characterBaseAtk: 800, weaponBaseAtk: 200, atkPercent: 1, flatAtk: 0, baseHp: 20000, hpPercent: 0, flatHp: 0, baseDef: 800, defPercent: 0, flatDef: 0, em: 0, critRate: .5, critDamage: 1};
    const prepared = applyCharacterConstellationScope(document), before = calculateDocument(prepared);
    const final = convertCalculatorToFinalPanel(prepared);
    expect(calculate(final).totals).toEqual(before.totals);
    expect(calculate(parseCalculatorDocument(serializeCalculatorDocument(final))).totals).toEqual(before.totals);
    xiaoContext(final)!.burstElapsedSeconds = 3;
    expect(calculate(final).status).toBe("blocked");
  });

  it("fresh equipment supplies zero accounting; import does not certify it", () => {
    const document = fixture(); resetSourceCastPanelAccounting(document, "imported-final");
    expect(xiaoContext(document)!.includedDamageBonus).toBeUndefined(); expect(calculate(document).status).toBe("blocked");
    resetSourceCastPanelAccounting(document, "fresh-equipment");
    expect(xiaoContext(document)!.includedDamageBonus).toBe(0); expect(calculate(document).status).toBe("calculated");
  });

  it("reports Q activation as non-damaging, never as a fabricated hit", () => {
    const document = fixture("xiao-burst-activation");
    const result = calculate(document);
    expect(result.hits).toHaveLength(1); expect(result.hits[0]!.status).toBe("non-damaging");
    expect(document.hits[0]!.kind).toBe("non-damaging");
  });
});
