import { describe, expect, it } from "vitest";
import {
  calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument,
  serializeCalculatorDocument, type CalculatorDocument,
} from "@genshin-dps-lab/sim-core";
import { applyCharacterConstellationScope, getCharacterDocuments } from "./character-calculations";
import { iansanSwiftRequirementAdapter } from "./calculator-iansan-requirements";
import { collectCalculatorRequirements, type CalculatorRequirementOptions } from "./calculator-requirements";
import { applySourceCastControl } from "./calculator-source-cast-controls";
import { renderIansanSwiftResolvedControls } from "./calculator-hydro-resolved-controls";

const SKILL = "iansan-swift-resolved-c0";
const HIT = `${SKILL}-swift`;
const ROOT = "gameContext.iansanSwiftResolvedCast";
const field = (key: string) => `${ROOT}.sharedState.${key}`;

function fixture(talent = 10): CalculatorDocument {
  const document = getCharacterDocuments("character:10000110", talent)
    .find(candidate => candidate.gameContext?.skillId === SKILL)!;
  return applyCharacterConstellationScope(document);
}
const requirements = (document: CalculatorDocument, options: CalculatorRequirementOptions = {}) =>
  collectCalculatorRequirements(document, options);

function answer(document: CalculatorDocument, key: string, value: string, numeric = false): CalculatorDocument {
  applySourceCastControl(document, {
    dataset: numeric ? { field: key, sourceCastNumberField: "" } : { sourceCastStateField: key }, value,
  } as unknown as HTMLSelectElement);
  return applyCharacterConstellationScope(document);
}

function panel(document = fixture()): CalculatorDocument {
  document.characterLevel = 90;
  document.build = { mode: "manual-final", source: "Explicit synthetic Swift panel, not a native or UID result", ascension: 6,
    stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: 0, critDamage: .5 } };
  document.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  return applyCharacterConstellationScope(document);
}

function qualified(document = panel()): CalculatorDocument {
  return answer(answer(answer(answer(document, field("swiftQualifiedAtCast"), "1"),
    field("burstInactiveAtSnapshot"), "1"), field("a1ActiveAtSnapshot"), "0"), field("includedA1Attack"), "0", true);
}

describe("Iansan existing Swift requirement links", () => {
  it("links all four real default single-hit blockers to existing controls without supplying values", () => {
    const document = fixture(), before = JSON.stringify(document), report = requirements(document);
    expect(document.scope).toBe("single-hit");
    expect(document.gameContext!.iansanSwiftResolvedCast).toEqual({});
    expect(calculateDocument(document).status).toBe("blocked");
    expect(report.fields.map(row => row.fieldPath)).toEqual([
      field("swiftQualifiedAtCast"), field("burstInactiveAtSnapshot"), field("a1ActiveAtSnapshot"), field("includedA1Attack"),
    ]);
    expect(JSON.stringify(document)).toBe(before);
    const rendered = renderIansanSwiftResolvedControls(document);
    for (const row of report.fields) {
      expect(row).toMatchObject({ adapterId: "iansan-swift-conditions", status: "input-required",
        dependencyIds: [`iansan-swift-resolved:${HIT}`], hitIds: [HIT] });
      const attribute = row.fieldPath === field("includedA1Attack") ? "data-field" : "data-source-cast-state-field";
      expect(rendered).toContain(`${attribute}="${row.fieldPath}"`);
    }
    expect(report.blockers).toHaveLength(1);
    expect(report.blockers[0]).toMatchObject({ status: "linked-controls", fieldPaths: report.fields.map(row => row.fieldPath) });
  });

  it.each(["swiftQualifiedAtCast", "burstInactiveAtSnapshot"])("keeps missing actual evidence blocked, and unknown unanswered: %s", key => {
    let document = answer(qualified(), field(key), "0");
    if (key === "swiftQualifiedAtCast") expect(requirements(document).fields).toMatchObject([{ fieldPath: field(key), status: "condition-not-satisfied" }]);
    else expect(requirements(document).fields.map(row => row.fieldPath)).toEqual([field("ownerOnFieldAtSnapshot"), field("includedBurstAttack")]);
    expect(calculateDocument(document).status).toBe("blocked");
    document = applyCharacterConstellationScope(parseCalculatorDocument(serializeCalculatorDocument(document)));
    expect(document.gameContext!.iansanSwiftResolvedCast!.sharedState![key as "swiftQualifiedAtCast" | "burstInactiveAtSnapshot"]).toBe(false);
    document = answer(document, field(key), "unknown");
    expect(requirements(document).fields).toMatchObject([{ fieldPath: field(key), status: "input-required" }]);
    expect(calculateDocument(document).status).toBe("blocked");
  });

  it("accepts A1 inactive and explicitly included zero, with an independent NA10 value", () => {
    const document = qualified(), result = calculateDocument(document);
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    expect(document.hits[0]).toMatchObject({ element: "electro", attackTag: "charged", terms: [{ stat: "atk", coefficient: 1.6643 }] });
    expect(result.status).toBe("calculated");
    // Fixed resolved auto[4] NA10=1.6643; ATK2000, 90v90, 10% resistance.
    // The newly awarded A1 happens after this damage and contributes zero.
    expect(result.totals!.nonCritical).toBeCloseTo(1497.87, 8);
    expect(result.totals!.critical).toBeCloseTo(2246.805, 8);
    expect(result.totals!.expected).toBeCloseTo(1497.87, 8);
    const reopened = applyCharacterConstellationScope(parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(document))));
    expect(reopened.gameContext!.iansanSwiftResolvedCast!.sharedState).toMatchObject({ a1ActiveAtSnapshot: false, includedA1Attack: 0 });
    expect(requirements(reopened)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(reopened).totals).toEqual(result.totals);
  });

  it("does not replace an unknown included amount by zero, and keeps fractional player input exactly", () => {
    let document = answer(qualified(), field("includedA1Attack"), "", true);
    expect(requirements(document).fields).toMatchObject([{ fieldPath: field("includedA1Attack"), status: "input-required" }]);
    expect(calculateDocument(document).status).toBe("blocked");
    document = answer(document, field("includedA1Attack"), "120.5", true);
    expect(document.gameContext!.iansanSwiftResolvedCast!.sharedState!.includedA1Attack).toBe(120.5);
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(1407.6233325, 8);
  });

  it("requires actual white base ATK for an active prior A1 and adjusts its included share once", () => {
    let document = answer(qualified(), field("a1ActiveAtSnapshot"), "1");
    expect(requirements(document).fields).toMatchObject([{ fieldPath: field("baseAttack"), status: "input-required" }]);
    expect(calculateDocument(document).status).toBe("blocked");
    document = answer(document, field("baseAttack"), "1000", true);
    const result = calculateDocument(document);
    // (2000 + .2*1000 - 0) * 1.6643 * .5 * .9, not a second post-hit A1.
    expect(result.totals!.nonCritical).toBeCloseTo(1647.657, 8);
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    if (document.build.mode !== "manual-final") throw new Error("fixture");
    document.build.stats.atk = 2200;
    document = answer(document, field("includedA1Attack"), "200", true);
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(1647.657, 8);
  });

  it("uses equipment white ATK directly instead of asking for an invented base", () => {
    let document = qualified();
    document.build = { mode: "equipment-derived", characterBaseAtk: 300, weaponBaseAtk: 700,
      atkPercent: 0, flatAtk: 1000, baseHp: 20000, hpPercent: 0, flatHp: 0,
      baseDef: 800, defPercent: 0, flatDef: 0, em: 0, critRate: 0, critDamage: .5 };
    document = answer(document, field("a1ActiveAtSnapshot"), "1");
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(1647.657, 8);
  });

  it("keeps the ordinary-attack talent binding independent of E and preserves changed NA level", () => {
    let document = qualified(panel(fixture(1)));
    expect(document.gameContext!.abilityId).toBe("talent:iansan:combat1");
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(757.746, 8);
    document.gameContext!.effectiveTalentLevel = 10;
    document = applyCharacterConstellationScope(document);
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(1497.87, 8);
    document.gameContext!.abilityId = "talent:iansan:combat2";
    document = applyCharacterConstellationScope(document);
    expect(requirements(document).fields).toEqual([]);
    expect(calculateDocument(document).status).toBe("blocked");
  });

  it("single already-occurring hit does not require future lifecycle, contacts or stamina", () => {
    let document = qualified();
    Object.assign(document.gameContext!.iansanSwiftResolvedCast!, {
      freshCastConfirmed: false, noHitlag: false, noInterruption: false, noReplacement: false,
      fullObservedLifetime: false, actionReadyConfirmed: false, groundedAtCast: false,
      statsStableAcrossHits: false, inputKind: "charged", fastSkillActiveAtCast: false,
      nightsoulBlessingAtCast: false, precedingNormalAttackConfirmed: false,
      normalCounterBeforeCast: 0, initialStamina: 0, staminaCostMultiplier: 0,
      observedThroughFrame: 0, targetContacts: { swift: false },
    });
    document = applyCharacterConstellationScope(document);
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(1497.87, 8);
    const reopened = applyCharacterConstellationScope(parseCalculatorDocument(serializeCalculatorDocument(document)));
    expect(reopened.gameContext!.iansanSwiftResolvedCast).toEqual(document.gameContext!.iansanSwiftResolvedCast);
    expect(calculateDocument(reopened).totals).toEqual(calculateDocument(document).totals);
  });

  it("links an effective false template override instead of the shadowed shared value", () => {
    let document = qualified();
    document.gameContext!.iansanSwiftResolvedCast!.hitStates = { [HIT]: { swiftQualifiedAtCast: false } };
    document = applyCharacterConstellationScope(document);
    const override = `${ROOT}.hitStates.${HIT}.swiftQualifiedAtCast`;
    expect(requirements(document).fields).toMatchObject([{ fieldPath: override, status: "condition-not-satisfied" }]);
    expect(renderIansanSwiftResolvedControls(document)).toContain(`data-source-cast-state-field="${override}"`);
    document = answer(document, override, "1");
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(1497.87, 8);
  });

  it("historical snapshots require their own included-state confirmation, never new flat additions", () => {
    let document = qualified();
    document.gameContext!.iansanSwiftResolvedCast!.snapshots = { "snapshot-25": {
      stats: { atk: 2200, hp: 20000, def: 800, em: 0, critRate: 0, critDamage: .5 },
      characterLevel: 90, ascension: 6, damageBonus: 0, additiveBaseDamage: 0, reactionBonus: 0,
      source: "Explicit historical A1-inclusive synthetic snapshot", sourceRefs: ["test:actual-25-frame-snapshot"],
    } };
    document = answer(answer(document, field("a1ActiveAtSnapshot"), "1"), field("includedA1Attack"), "", true);
    expect(requirements(document).fields).toMatchObject([{ fieldPath: field("snapshotIncludesActualA1"), status: "input-required" }]);
    expect(calculateDocument(document).status).toBe("blocked");
    document = answer(document, field("snapshotIncludesActualA1"), "1");
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(1647.657, 8);
    const reopened = applyCharacterConstellationScope(parseCalculatorDocument(serializeCalculatorDocument(document)));
    expect(calculateDocument(reopened).totals).toEqual(calculateDocument(document).totals);
  });

  it("keeps actual C6-state requirements and original blocker when a control is missing", () => {
    let document = qualified();
    document.gameContext!.constellation = 6;
    document = applyCharacterConstellationScope(document);
    expect(requirements(document).fields.map(row => row.fieldPath)).toEqual([field("c6DamageBonusActiveAtHit"), field("includedC6DamageBonus")]);
    expect(requirements(document).blockers.some(row => row.reason.includes("C6"))).toBe(true);
    expect(calculateDocument(document).status).toBe("blocked");
    const missing = requirements(fixture(), { isControlAvailable: () => false });
    expect(missing.fields.every(row => row.status === "missing-control")).toBe(true);
    expect(missing.blockers[0]).toMatchObject({ status: "missing-control", reason: expect.stringContaining("A1") });
  });

  it("does not collect controls for another action or an empty selection", () => {
    const document = fixture();
    document.gameContext!.skillId = "iansan-skill";
    expect(iansanSwiftRequirementAdapter.applies(document)).toBe(false);
    expect(iansanSwiftRequirementAdapter.collect(document)).toEqual([]);
    const empty = fixture();
    empty.selectedHitIds = [];
    expect(requirements(empty).fields).toEqual([]);
  });

  it("fills the active-Q branch through existing page controls, preserves zero/unknown and reopens the same result", () => {
    let document = answer(qualified(), field("burstInactiveAtSnapshot"), "0");
    expect(requirements(document).fields.map(row => row.fieldPath)).toEqual([field("ownerOnFieldAtSnapshot"), field("includedBurstAttack")]);
    document = answer(document, field("ownerOnFieldAtSnapshot"), "1");
    const fields = requirements(document).fields;
    expect(fields.map(row => row.fieldPath)).toEqual([
      `${ROOT}.burstTalentLevel`, field("burstUpdateNonExtraAttack"), field("burstUpdateNightsoulPoints"), field("includedBurstAttack"),
    ]);
    const rendered = renderIansanSwiftResolvedControls(document);
    for (const row of fields) expect(rendered).toContain(`data-field="${row.fieldPath}"`);
    document = answer(document, `${ROOT}.burstTalentLevel`, "10", true);
    document = answer(document, field("burstUpdateNonExtraAttack"), "2000", true);
    document = answer(document, field("burstUpdateNightsoulPoints"), "42", true);
    expect(calculateDocument(document).status).toBe("blocked"); // included is still unknown
    document = answer(document, field("includedBurstAttack"), "0", true);
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(1902.2949, 8);
    const reopened = applyCharacterConstellationScope(parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(document))));
    expect(requirements(reopened)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(reopened).totals!.nonCritical).toBeCloseTo(1902.2949, 8);
    document = answer(document, field("burstUpdateNightsoulPoints"), "0", true);
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(1497.87, 8);
    document = answer(document, field("burstUpdateNightsoulPoints"), "", true);
    expect(requirements(document).fields).toMatchObject([{ fieldPath: field("burstUpdateNightsoulPoints"), status: "input-required" }]);
    expect(calculateDocument(document).status).toBe("blocked");
  });

  it("derives the Q recipient from a closed legal schedule, but rejects a conflicting explicit background state", () => {
    let document = qualified();
    document.scope = "one-cast";
    Object.assign(document.gameContext!.iansanSwiftResolvedCast!, {
      casterId: "iansan", targetId: "enemy", freshCastConfirmed: true, noHitlag: true, noInterruption: true,
      noReplacement: true, fullObservedLifetime: true, observedThroughFrame: 25, statsStableAcrossHits: true,
      inputKind: "normal", actionReadyConfirmed: true, groundedAtCast: true, fastSkillActiveAtCast: true,
      targetContacts: { swift: true }, burstTalentLevel: 10,
    });
    Object.assign(document.gameContext!.iansanSwiftResolvedCast!.sharedState!, {
      burstInactiveAtSnapshot: false, burstUpdateNonExtraAttack: 2000, burstUpdateNightsoulPoints: 42, includedBurstAttack: 0,
    });
    document = applyCharacterConstellationScope(document);
    expect(document.gameContext!.iansanSwiftResolvedCast!.sharedState!.ownerOnFieldAtSnapshot).toBeUndefined();
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(1902.2949, 8);
    document = answer(document, field("ownerOnFieldAtSnapshot"), "0");
    expect(requirements(document).fields).toMatchObject([{ fieldPath: field("ownerOnFieldAtSnapshot"), status: "condition-not-satisfied" }]);
    expect(calculateDocument(document).status).toBe("blocked");
  });

  it("higher-constellation C6 links actual state and accounting with false/zero, active and JSON reopening", () => {
    let document = qualified();
    document.gameContext!.constellation = 6;
    document = applyCharacterConstellationScope(document);
    const fields = requirements(document).fields;
    expect(fields.map(row => row.fieldPath)).toEqual([field("c6DamageBonusActiveAtHit"), field("includedC6DamageBonus")]);
    const html = renderIansanSwiftResolvedControls(document);
    expect(html).toContain(`data-source-cast-state-field="${field("c6DamageBonusActiveAtHit")}"`);
    expect(html).toContain(`data-field="${field("includedC6DamageBonus")}"`);
    document = answer(document, field("c6DamageBonusActiveAtHit"), "0");
    expect(calculateDocument(document).status).toBe("blocked");
    document = answer(document, field("includedC6DamageBonus"), "0", true);
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(1497.87, 8);
    document = answer(document, field("c6DamageBonusActiveAtHit"), "1");
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(1872.3375, 8);
    const reopened = applyCharacterConstellationScope(parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(document))));
    expect(requirements(reopened)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(reopened).totals!.nonCritical).toBeCloseTo(1872.3375, 8);
    document = answer(document, field("includedC6DamageBonus"), "", true);
    expect(requirements(document).fields).toMatchObject([{ fieldPath: field("includedC6DamageBonus"), status: "input-required" }]);
    expect(calculateDocument(document).status).toBe("blocked");
  });

  it("higher-constellation C2 does not infer an unknown A1 from Q or add teammate30% to the owner", () => {
    let document = qualified();
    document.gameContext!.constellation = 2;
    Object.assign(document.gameContext!.iansanSwiftResolvedCast!, { burstTalentLevel: 10 });
    Object.assign(document.gameContext!.iansanSwiftResolvedCast!.sharedState!, {
      burstInactiveAtSnapshot: false, ownerOnFieldAtSnapshot: true,
      burstUpdateNonExtraAttack: 2200, burstUpdateNightsoulPoints: 42, includedBurstAttack: 0,
    });
    document = answer(document, field("a1ActiveAtSnapshot"), "unknown");
    expect(requirements(document).fields).toMatchObject([{ fieldPath: field("a1ActiveAtSnapshot"), status: "input-required" }]);
    expect(calculateDocument(document).status).toBe("blocked");
    document = answer(document, field("a1ActiveAtSnapshot"), "1");
    expect(requirements(document).fields).toMatchObject([{ fieldPath: field("baseAttack"), status: "input-required" }]);
    document = answer(document, field("baseAttack"), "1000", true);
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(2092.52439, 8);
  });
});
