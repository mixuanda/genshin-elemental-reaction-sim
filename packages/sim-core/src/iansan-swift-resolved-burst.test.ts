import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import burstEvidence from "../../game-data/sources/iansan-swift-resolved-casts/active-burst-evidence.json";
import { iansanSwiftResolvedTemplates } from "../../game-data/src/character-mappings/iansan-swift-resolved-mappings";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import { parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument } from "./calculator-model";
import { prepareIansanSwiftResolvedCastDocument, resetIansanSwiftResolvedPanelAccounting } from "./iansan-swift-resolved-formulas";
import { iansanSwiftScheduleProvesOwnerOnField } from "./iansan-swift-resolved-schedule";
import { expr } from "./calculation-trace";

const SKILL = "iansan-swift-resolved-c0", HIT = `${SKILL}-swift`;
const role = iansanSwiftResolvedTemplates[0]!.roles.swift;
const state = (doc: CalculatorDocument) => doc.gameContext!.iansanSwiftResolvedCast!.sharedState!;
function fixture(): CalculatorDocument {
  return {
    schemaVersion: "1.0.0", ruleVersion: "ordinary-trace-v1", id: "iansan-q-test", label: "Synthetic actual Q update",
    scope: "single-hit", characterLevel: 90,
    build: { mode: "manual-final", source: "Explicit synthetic hit panel, not UID or current-game measurement", ascension: 6,
      stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: 0, critDamage: .5 } },
    enemy: { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 },
    gameContext: { characterId: "character:10000110", characterName: "Iansan", abilityId: "talent:iansan:combat1",
      skillId: SKILL, skillName: "Swift Stormflight", effectiveTalentLevel: 10, ascension: 6, constellation: 0,
      scopeCoverage: "single-hit", attributionPolicy: "Synthetic single actual Swift only",
      iansanSwiftResolvedCast: { burstTalentLevel: 10, sharedState: {
        swiftQualifiedAtCast: true, a1ActiveAtSnapshot: false, includedA1Attack: 0,
        burstInactiveAtSnapshot: false, ownerOnFieldAtSnapshot: true,
        burstUpdateNonExtraAttack: 2000, burstUpdateNightsoulPoints: 42, includedBurstAttack: 0,
      } } },
    hits: [{ id: HIT, label: "Swift", kind: "ordinary", element: "electro", attackTag: "charged",
      terms: [{ stat: "atk", coefficient: 1.6643 }], additiveBaseDamage: 0, damageBonus: 0,
      critEligible: true, reaction: "none", reactionBonus: 0, groupMultiplier: 1, dependencies: [], sourceRefs: role.sourceRefs }],
    selectedHitIds: [HIT], dependencies: [], assumptions: ["Actual update inputs are synthetic explicit observations, not an automatic timeline."],
    dataIdentity: { datasetId: "synthetic-iansan-q", gameVersion: "synthetic", releaseStatus: "synthetic", evidenceStatus: "synthetic" },
  };
}
function fullCast(): CalculatorDocument {
  const document = fixture();
  document.scope = "one-cast";
  Object.assign(document.gameContext!.iansanSwiftResolvedCast!, {
    casterId: "iansan", targetId: "enemy", freshCastConfirmed: true,
    noHitlag: true, noInterruption: true, noReplacement: true, fullObservedLifetime: true,
    observedThroughFrame: 25, statsStableAcrossHits: true, inputKind: "normal",
    actionReadyConfirmed: true, groundedAtCast: true, fastSkillActiveAtCast: true,
    targetContacts: { swift: true },
  });
  delete state(document).ownerOnFieldAtSnapshot;
  return document;
}
const value = (doc: CalculatorDocument) => {
  const result = calculateDocument(doc);
  expect(result.blockers).toEqual([]);
  expect(result.status).toBe("calculated");
  return result.totals!.nonCritical;
};

describe("Iansan C0 actual Q feedback on Swift", () => {
  it("binds every cap/ratio to the immutable archived source and verifies byte identities", () => {
    const bytes = readFileSync(new URL("../../game-data/sources/iansan-swift-resolved-casts/source.json.gz", import.meta.url));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(burstEvidence.archiveSha256);
    const archive = JSON.parse(gunzipSync(bytes).toString("utf8")).files as Record<string, string>;
    for (const file of burstEvidence.sourceFiles) expect(createHash("sha256").update(archive[file.archiveKey]!).digest("hex")).toBe(file.sha256);
    const burst = JSON.parse(archive["optimizer/libs/gi/stats/Data/Characters/Iansan/skillParam.json"]!).burst;
    expect(burstEvidence.formula.highAttackConversionByLevel).toEqual(burst[1]);
    expect(burstEvidence.formula.lowAttackConversionPerPointByLevel).toEqual(burst[2]);
    expect(burstEvidence.formula.maxAttackBonusByLevel).toEqual(burst[3]);
    expect(burst[3]).toEqual([330, 370, 410, 450, 490, 530, 570, 610, 650, 690, 730, 770, 810, 850, 890]);
    expect(archive["gcsim/internal/characters/iansan/burst.go"]).toContain("SelectStat(true, attributes.BaseATK, attributes.ATKP, attributes.ATK)");
    expect(archive["gcsim/pkg/core/player/character/stats.go"]).toContain("if nonExtra && m.Extra");
  });

  it("gives an on-field owner the actual Q bonus without a recursive final-ATK solution", () => {
    // Q=.27*2000=540, below Q10 cap690. (2000+540)*1.6643*.5*.9.
    const document = prepareIansanSwiftResolvedCastDocument(fixture());
    expect(value(document)).toBeCloseTo(1902.2949, 8);
    expect(value(prepareIansanSwiftResolvedCastDocument(document))).toBeCloseTo(1902.2949, 8);
    expect(document.hits[0]).toMatchObject({ attackAdjustment: { formula: { ruleId: "iansan-swift-resolved:prior-a1-with-q" } } });
    if (document.build.mode !== "manual-final") throw new Error("fixture");
    document.build.stats.atk = 2540;
    state(document).includedBurstAttack = 540;
    expect(value(document)).toBeCloseTo(1902.2949, 8);
  });

  it("uses low-point scaling below42, the discontinuous high branch at42 and legitimate zero inputs", () => {
    const document = fixture();
    state(document).burstUpdateNightsoulPoints = 41;
    expect(value(document)).toBeCloseTo(1804.93335, 8); // actual Q=.005*41*2000=410
    state(document).burstUpdateNightsoulPoints = 42;
    expect(value(document)).toBeCloseTo(1902.2949, 8);
    state(document).burstUpdateNightsoulPoints = 0;
    expect(value(document)).toBeCloseTo(1497.87, 8);
    state(document).burstUpdateNightsoulPoints = 54;
    state(document).burstUpdateNonExtraAttack = 0;
    expect(value(document)).toBeCloseTo(1497.87, 8);
    state(document).burstUpdateNonExtraAttack = 2000;
    state(document).burstUpdateNightsoulPoints = 41.5;
    expect(value(document)).toBeCloseTo(1808.678025, 8);
  });

  it("applies all15 independent effective Q caps once, without changing the NA10 coefficient", () => {
    const document = fixture(), caps = [330, 370, 410, 450, 490, 530, 570, 610, 650, 690, 730, 770, 810, 850, 890];
    state(document).burstUpdateNonExtraAttack = 10000;
    for (let level = 1; level <= 15; level++) {
      document.gameContext!.iansanSwiftResolvedCast!.burstTalentLevel = level;
      expect(value(document)).toBeCloseTo((2000 + caps[level - 1]!) * 1.6643 * .5 * .9, 8);
      expect(prepareIansanSwiftResolvedCastDocument(document).hits[0]).toMatchObject({ terms: [{ stat: "atk", coefficient: 1.6643 }] });
    }
    document.gameContext!.effectiveTalentLevel = 1;
    expect(value(document)).toBeCloseTo(1094.94297, 8); // (2000+890)*NA1 .84194*.45
  });

  it("keeps prior A1 at the Q refresh separate from A1 at the hit", () => {
    const document = fixture();
    state(document).a1ActiveAtSnapshot = true;
    state(document).baseAttack = 1000;
    expect(value(document)).toBeCloseTo(2052.0819, 8); // current A1=200; earlier Q refresh ATK=2000 ->540
    state(document).burstUpdateNonExtraAttack = 2200;
    expect(value(document)).toBeCloseTo(2092.52439, 8); // A1 was also present at Q refresh ->594
  });

  it("does not turn old active-Q files into witnessed refreshes or borrow NA level", () => {
    for (const key of ["ownerOnFieldAtSnapshot", "burstUpdateNonExtraAttack", "burstUpdateNightsoulPoints", "includedBurstAttack"] as const) {
      const document = fixture();
      delete state(document)[key];
      expect(calculateDocument(document).status, key).toBe("blocked");
      expect(() => convertCalculatorToFinalPanel(document)).toThrow();
    }
    const document = fixture();
    delete document.gameContext!.iansanSwiftResolvedCast!.burstTalentLevel;
    expect(calculateDocument(document).status).toBe("blocked");
    expect(parseCalculatorDocument(serializeCalculatorDocument(document)).gameContext!.iansanSwiftResolvedCast!.burstTalentLevel).toBeUndefined();
  });

  it("only independent observed off-field hits may take zero own-Q bonus without update operands", () => {
    const document = fixture();
    state(document).ownerOnFieldAtSnapshot = false;
    delete state(document).burstUpdateNonExtraAttack;
    delete state(document).burstUpdateNightsoulPoints;
    delete document.gameContext!.iansanSwiftResolvedCast!.burstTalentLevel;
    expect(value(document)).toBeCloseTo(1497.87, 8);
    const complete = fullCast();
    expect(iansanSwiftScheduleProvesOwnerOnField(complete.scope, complete.gameContext!.iansanSwiftResolvedCast!)).toBe(true);
    expect(state(complete).ownerOnFieldAtSnapshot).toBeUndefined();
    expect(value(complete)).toBeCloseTo(1902.2949, 8);
    expect(state(complete).ownerOnFieldAtSnapshot).toBeUndefined(); // proof does not invent player input
    state(complete).ownerOnFieldAtSnapshot = false;
    expect(calculateDocument(complete).status).toBe("blocked");
    expect(prepareIansanSwiftResolvedCastDocument(complete).dependencies.some(row => row.reason.includes("最早31帧"))).toBe(true);
  });

  it("does not infer the active recipient from incomplete or interrupted observations", () => {
    const document = fullCast();
    document.gameContext!.iansanSwiftResolvedCast!.noInterruption = false;
    expect(iansanSwiftScheduleProvesOwnerOnField(document.scope, document.gameContext!.iansanSwiftResolvedCast!)).toBe(false);
    expect(calculateDocument(document).status).toBe("blocked");
    document.scope = "single-hit";
    expect(iansanSwiftScheduleProvesOwnerOnField(document.scope, document.gameContext!.iansanSwiftResolvedCast!)).toBe(false);
    expect(calculateDocument(document).status).toBe("blocked");
  });

  it("requires real historical included-Q confirmation and never adds Q again", () => {
    let document = fixture();
    document.gameContext!.iansanSwiftResolvedCast!.snapshots = { "snapshot-25": {
      stats: { atk: 2540, hp: 20000, def: 800, em: 0, critRate: 0, critDamage: .5 }, characterLevel: 90, ascension: 6,
      damageBonus: 0, additiveBaseDamage: 0, reactionBonus: 0, source: "Actual synthetic Q-inclusive historical panel", sourceRefs: ["test:historical-Q-ATK"],
    } };
    state(document).snapshotIncludesActualA1 = true;
    expect(calculateDocument(document).status).toBe("blocked");
    state(document).snapshotIncludesActualBurst = false;
    expect(calculateDocument(document).status).toBe("blocked");
    state(document).snapshotIncludesActualBurst = true;
    delete state(document).includedBurstAttack;
    expect(value(document)).toBeCloseTo(1902.2949, 8);
    const boundHistory = prepareIansanSwiftResolvedCastDocument(document);
    state(boundHistory).burstUpdateNightsoulPoints = 41;
    expect(calculateDocument(boundHistory).status).toBe("blocked");
    document = prepareIansanSwiftResolvedCastDocument(parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(document))));
    expect(value(document)).toBeCloseTo(1902.2949, 8);
    document.gameContext!.iansanSwiftResolvedCast!.burstTalentLevel = 1;
    expect(calculateDocument(document).status).toBe("blocked");
  });

  it("preserves active-Q final-panel input and rejects stale materialized source changes", () => {
    const converted = convertCalculatorToFinalPanel(fixture());
    const reopened = prepareIansanSwiftResolvedCastDocument(parseCalculatorDocument(serializeCalculatorDocument(converted)));
    expect(value(reopened)).toBeCloseTo(1902.2949, 8);
    state(reopened).burstUpdateNonExtraAttack = 2200;
    expect(calculateDocument(reopened).status).toBe("blocked");
    const changedLevel = structuredClone(converted);
    changedLevel.gameContext!.iansanSwiftResolvedCast!.burstTalentLevel = 1;
    expect(calculateDocument(changedLevel).status).toBe("blocked");
  });

  it("keeps legacy inactive-Q formula/identity compatible and removes an explicitly old Q share", () => {
    const document = fixture();
    state(document).burstInactiveAtSnapshot = true;
    for (const key of ["ownerOnFieldAtSnapshot", "burstUpdateNonExtraAttack", "burstUpdateNightsoulPoints", "includedBurstAttack"] as const) delete state(document)[key];
    delete document.gameContext!.iansanSwiftResolvedCast!.burstTalentLevel;
    expect(value(document)).toBeCloseTo(1497.87, 8);
    expect(prepareIansanSwiftResolvedCastDocument(document).hits[0]).toMatchObject({ attackAdjustment: { formula: { ruleId: "iansan-swift-resolved:prior-a1" } } });
    const converted = convertCalculatorToFinalPanel(document);
    converted.gameContext!.iansanSwiftResolvedCast!.burstTalentLevel = 15; // irrelevant Q binding must not invalidate an old inactive snapshot
    expect(value(parseCalculatorDocument(serializeCalculatorDocument(converted)))).toBeCloseTo(1497.87, 8);
    state(document).includedBurstAttack = 540;
    if (document.build.mode !== "manual-final") throw new Error("fixture");
    document.build.stats.atk = 2540;
    expect(value(document)).toBeCloseTo(1497.87, 8);
  });

  it("keeps legal0 distinct from invalid source bounds and unsupported constellations", () => {
    for (const [key, invalid] of [["burstUpdateNonExtraAttack", -1], ["burstUpdateNightsoulPoints", 54.01], ["burstUpdateNightsoulPoints", -1], ["includedBurstAttack", 890.01]] as const) {
      const document = fixture();
      state(document)[key] = invalid;
      expect(() => parseCalculatorDocument(JSON.stringify(document))).toThrow();
    }
    for (const invalid of [0, 16, 1.5]) {
      const document = fixture();
      document.gameContext!.iansanSwiftResolvedCast!.burstTalentLevel = invalid;
      expect(() => parseCalculatorDocument(JSON.stringify(document))).toThrow();
    }
    const document = fixture();
    document.gameContext!.constellation = 1;
    expect(calculateDocument(document).status).toBe("blocked");
  });

  it("preserves external attack-formula evidence and refuses the occupied slot", () => {
    const document = fixture(), hit = document.hits[0];
    if (hit?.kind !== "ordinary") throw new Error("fixture");
    hit.attackAdjustment = { accounting: "add-to-panel", formula: { ruleId: "external:atk", label: "Keep original evidence",
      expression: expr.value(17), inputs: [], sourceRefs: ["test:external-formula"] } };
    const prepared = prepareIansanSwiftResolvedCastDocument(document);
    expect(prepared.hits[0]).toMatchObject({ attackAdjustment: hit.attackAdjustment });
    expect(calculateDocument(prepared).status).toBe("blocked");
  });

  it("resets both panel accounting and old Q refresh operands without fabricating imported shares", () => {
    const fresh = fixture();
    state(fresh).includedBurstAttack = 540;
    resetIansanSwiftResolvedPanelAccounting(fresh, "fresh-equipment");
    expect(state(fresh).includedBurstAttack).toBe(0);
    expect(state(fresh).burstUpdateNonExtraAttack).toBeUndefined();
    expect(state(fresh).burstUpdateNightsoulPoints).toBeUndefined();
    expect(calculateDocument(fresh).status).toBe("blocked");
    const imported = fixture();
    resetIansanSwiftResolvedPanelAccounting(imported, "imported-final");
    expect(state(imported).includedBurstAttack).toBeUndefined();
    expect(state(imported).burstUpdateNonExtraAttack).toBeUndefined();
    expect(calculateDocument(imported).status).toBe("blocked");
  });
});
