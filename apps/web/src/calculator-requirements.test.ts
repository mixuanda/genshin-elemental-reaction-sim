import { describe, expect, it } from "vitest";
import { calculateDocument, type CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { applyCharacterConstellationScope, applyKeqingBurstContext, applyXingqiuSkillContext, getCharacterDocuments } from "./character-calculations";
import { renderKeqingConstellationControls } from "./calculator-keqing-controls";
import { renderPassiveSkillControls } from "./calculator-passive-controls";
import { CALCULATOR_REQUIREMENT_ADAPTERS, collectCalculatorRequirements, type CalculatorRequirementAdapter } from "./calculator-requirements";
import { renderSourceCastControls } from "./calculator-source-cast-controls";

function fixture(character: "keqing" | "xingqiu" = "keqing", constellation = 4): CalculatorDocument {
  const document = getCharacterDocuments(character === "keqing" ? "character:10000042" : "character:10000025", 1)
    .find(row => row.gameContext?.skillId === `${character}-${character === "keqing" ? "burst" : "skill"}-complete-cast`)!;
  document.gameContext!.constellation = constellation;
  document.build = { mode: "manual-final", source: "Explicit requirement-mapping test panel", ascension: 6,
    stats: { atk: 1000, hp: 10000, def: 800, em: 0, critRate: .5, critDamage: 1 } };
  document.scope = "single-hit";
  document.selectedHitIds = [document.hits[0]!.id];
  return document;
}
const applyKeqing = (document: CalculatorDocument) => applyCharacterConstellationScope(applyKeqingBurstContext(document, document.gameContext!.keqingBurst!));
const stateOf = (document: CalculatorDocument, index = 0) => document.gameContext!.keqingBurst!.hitStates[document.hits[index]!.id] ??= {};

describe("calculator missing fields to existing controls", () => {
  it("links actual C4 missing fields and resumes the existing calculator after explicit answers", () => {
    let document = applyKeqing(fixture());
    const hitId = document.selectedHitIds[0]!, prefix = `gameContext.keqingBurst.hitStates.${hitId}`;
    expect(calculateDocument(document).status).toBe("blocked");
    const before = JSON.stringify(document), requirements = collectCalculatorRequirements(document);
    expect(JSON.stringify(document)).toBe(before);
    expect(requirements.fields.map(field => field.fieldPath)).toEqual([`${prefix}.c4Active`, `${prefix}.c4IncludedInPanel`]);
    for (const field of requirements.fields) {
      expect(field.controlSelector).toBe(`select[data-keqing-state-field="${field.fieldPath}"]`);
      expect(renderKeqingConstellationControls(document)).toContain(`data-keqing-state-field="${field.fieldPath}"`);
    }
    expect(requirements.blockers).toEqual([expect.objectContaining({
      dependencyId: `keqing-burst-context:${hitId}`, status: "linked-controls", fieldPaths: [`${prefix}.c4Active`, `${prefix}.c4IncludedInPanel`],
    })]);
    Object.assign(stateOf(document), { c4Active: false, c4IncludedInPanel: false });
    document = applyKeqing(document);
    expect(collectCalculatorRequirements(document)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(document).status).toBe("calculated");
  });

  it("gates constellation fields, keeps false known, and ignores unselected-hit omissions", () => {
    const lower = fixture("keqing", 3);
    expect(collectCalculatorRequirements(lower).fields).toEqual([]);
    const document = fixture();
    Object.assign(stateOf(document), { c4Active: false, c4IncludedInPanel: false });
    expect(stateOf(document, 1)).toEqual({});
    expect(collectCalculatorRequirements(applyKeqing(document))).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(applyKeqing(document)).status).toBe("calculated");
  });

  it("asks for historical base ATK only when a manual-panel C4 difference needs it", () => {
    let document = fixture();
    Object.assign(stateOf(document), { c4Active: true, c4IncludedInPanel: false });
    document = applyKeqing(document);
    const field = collectCalculatorRequirements(document).fields[0]!;
    expect(field.fieldPath).toBe(`gameContext.keqingBurst.hitStates.${document.hits[0]!.id}.baseAttack`);
    expect(field.controlSelector).toBe(`input[data-field="${field.fieldPath}"]`);
    expect(renderKeqingConstellationControls(document)).toContain(`data-field="${field.fieldPath}"`);
    expect(calculateDocument(document).status).toBe("blocked");
    stateOf(document).baseAttack = 500;
    document = applyKeqing(document);
    expect(collectCalculatorRequirements(document).fields).toEqual([]);
    expect(calculateDocument(document).status).toBe("calculated");

    delete stateOf(document).baseAttack;
    stateOf(document).c4IncludedInPanel = true;
    expect(collectCalculatorRequirements(applyKeqing(document)).fields).toEqual([]);
    stateOf(document).c4IncludedInPanel = false;
    document.build = { mode: "equipment-derived", characterBaseAtk: 300, weaponBaseAtk: 400, atkPercent: 0, flatAtk: 0,
      baseHp: 10000, hpPercent: 0, flatHp: 0, baseDef: 800, defPercent: 0, flatDef: 0, em: 0, critRate: .5, critDamage: 1 };
    expect(collectCalculatorRequirements(document).fields).toEqual([]);
    document = applyKeqing(document);
    expect(stateOf(document).baseAttack).toBe(700);
    expect(calculateDocument(document).status).toBe("calculated");
  });

  it("links C6 actual categories and accounting while leaving the source-derived Q category automatic", () => {
    let document = fixture("keqing", 6);
    Object.assign(stateOf(document), { c4Active: false, c4IncludedInPanel: false });
    document = applyKeqing(document);
    const requirements = collectCalculatorRequirements(document);
    expect(requirements.fields.map(field => field.fieldPath.split(".").at(-1))).toEqual([
      "c6NormalActive", "c6ChargedActive", "c6SkillActive", "c6IncludedStacks",
    ]);
    expect(requirements.fields.some(field => field.fieldPath.includes("BurstActive"))).toBe(false);
    Object.assign(stateOf(document), { c6NormalActive: false, c6ChargedActive: false, c6SkillActive: false, c6IncludedStacks: 0 });
    document = applyKeqing(document);
    expect(collectCalculatorRequirements(document)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(document).status).toBe("calculated");
  });

  it("links the existing shared-panel controls without changing an actual unstable condition", () => {
    let keqing = fixture("keqing", 0);
    keqing.scope = "one-cast";
    keqing.selectedHitIds = keqing.hits.map(hit => hit.id);
    keqing.gameContext!.keqingBurst!.statsStableAcrossHits = false;
    keqing = applyKeqing(keqing);
    const keqingField = collectCalculatorRequirements(keqing).fields[0]!;
    expect(keqingField).toMatchObject({ status: "condition-not-satisfied", controlSelector: "#calc-keqing-stats-stable" });
    expect(renderPassiveSkillControls(keqing)).toContain('id="calc-keqing-stats-stable"');
    expect(keqing.gameContext!.keqingBurst!.statsStableAcrossHits).toBe(false);
    keqing.scope = "single-hit"; keqing.selectedHitIds = [keqing.hits[0]!.id]; keqing = applyKeqing(keqing);
    expect(collectCalculatorRequirements(keqing).fields).toEqual([]);
    expect(calculateDocument(keqing).status).toBe("calculated");

    let xingqiu = fixture("xingqiu", 0);
    xingqiu.gameContext!.xingqiuSkill!.statsStableAcrossHits = false;
    xingqiu = applyXingqiuSkillContext(xingqiu, xingqiu.gameContext!.xingqiuSkill!);
    expect(calculateDocument(xingqiu).status).toBe("blocked");
    expect(collectCalculatorRequirements(xingqiu).fields).toEqual([expect.objectContaining({
      fieldPath: "gameContext.xingqiuSkill.statsStableAcrossHits", controlSelector: "#calc-xingqiu-stats-stable", status: "condition-not-satisfied",
    })]);
    expect(renderPassiveSkillControls(xingqiu)).toContain('id="calc-xingqiu-stats-stable"');
    expect(xingqiu.gameContext!.xingqiuSkill!.statsStableAcrossHits).toBe(false);
    xingqiu = applyXingqiuSkillContext(xingqiu, { ...xingqiu.gameContext!.xingqiuSkill!, statsStableAcrossHits: true });
    expect(collectCalculatorRequirements(xingqiu)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(xingqiu).status).toBe("calculated");
  });

  it("reports missing rendered controls and preserves unknown dependencies precisely", () => {
    const document = applyKeqing(fixture()), unknownId = "source:unsupported-mechanic";
    document.hits[0]!.dependencies.push(unknownId, "source:missing-record");
    document.dependencies.push({ id: unknownId, status: "missing", reason: "该来源的实际触发条件尚未实现。", sourceRefs: [] });
    const report = collectCalculatorRequirements(document, { isControlAvailable: () => false });
    expect(report.fields.every(field => field.status === "missing-control")).toBe(true);
    expect(report.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "missing-control", dependencyId: `keqing-burst-context:${document.hits[0]!.id}` }),
      expect.objectContaining({ status: "unsupported", dependencyId: unknownId, reason: "该来源的实际触发条件尚未实现。", fieldPaths: [] }),
      expect.objectContaining({ status: "unsupported", dependencyId: "source:missing-record", reason: "缺少所需依赖记录：source:missing-record" }),
    ]));
  });

  it("allows another exact adapter and never matches a control from a blocker sentence", () => {
    const document = fixture();
    document.gameContext!.skillId = "future-supported-action";
    document.hits[0]!.dependencies = ["future:condition"];
    document.dependencies = [{ id: "future:condition", status: "missing", reason: "c4Active / calc-keqing-stats-stable are only text here", sourceRefs: [] }];
    expect(collectCalculatorRequirements(document)).toEqual({ fields: [], blockers: [expect.objectContaining({ status: "unsupported", fieldPaths: [] })] });
    const adapter: CalculatorRequirementAdapter = {
      id: "explicit-extension", applies: doc => doc.gameContext?.skillId === "future-supported-action",
      collect: () => [{ id: "future:field", fieldPath: "gameContext.futureCondition", controlSelector: "#existing-future-control", label: "Fixture condition",
        explanation: "Test-only adapter supplied explicitly", status: "input-required", dependencyIds: ["future:condition"], hitIds: [document.hits[0]!.id] }],
    };
    const report = collectCalculatorRequirements(document, { adapters: [...CALCULATOR_REQUIREMENT_ADAPTERS, adapter] });
    expect(report.fields[0]).toMatchObject({ adapterId: "explicit-extension", controlSelector: "#existing-future-control" });
    expect(report.blockers[0]).toMatchObject({ status: "linked-controls", reason: document.dependencies[0]!.reason });
  });
});

describe("Durin C2 condition controls", () => {
  const create = (black=false) => {
    const document=getCharacterDocuments("character:10000123",10).find(row=>row.gameContext?.skillId===(black?"durin-denial-of-darkness":"durin-confirmation-of-purity"))!;
    document.gameContext!.constellation=2;
    return applyCharacterConstellationScope(document);
  };
  it("maps actual missing state to the rendered controls without choosing an answer",()=>{
    let document=create();const before=JSON.stringify(document);
    const requirements=collectCalculatorRequirements(document);
    expect(requirements.fields.map(field=>field.fieldPath.split('.').at(-1))).toEqual(["c2PyroBonusActive","c2PyroBonusIncluded"]);
    expect(JSON.stringify(document)).toBe(before);
    for(const field of requirements.fields)expect(renderSourceCastControls(document)).toContain(`data-source-cast-state-field="${field.fieldPath}"`);
    expect(requirements.blockers.every(blocker=>blocker.status==="linked-controls")).toBe(true);
    document.gameContext!.durinSkill!.hitStates={"durin-white-e":{c2PyroBonusActive:false,c2PyroBonusIncluded:false}};
    document=applyCharacterConstellationScope(document);
    expect(collectCalculatorRequirements(document)).toEqual({fields:[],blockers:[]});
    expect(calculateDocument(document).status).toBe("calculated");
  });
  it("asks for stability only across selected hits and does not borrow other hits' answers",()=>{
    const document=create(true);
    expect(collectCalculatorRequirements(document).fields).toHaveLength(7);
    document.scope="single-hit";document.selectedHitIds=[document.hits[1]!.id];
    const selected=applyCharacterConstellationScope(document);
    const fields=collectCalculatorRequirements(selected).fields;
    expect(fields).toHaveLength(2);
    expect(fields.every(field=>field.hitIds[0]===document.hits[1]!.id)).toBe(true);
    expect(fields.some(field=>field.fieldPath.endsWith("statsStableAcrossHits"))).toBe(false);
  });
});
