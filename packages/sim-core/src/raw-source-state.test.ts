import { describe, expect, it } from "vitest";
import { getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import { manekinRawTemplates } from "../../game-data/src/character-mappings/manekin-raw-mappings";
import { released71RawTemplates } from "../../game-data/src/character-mappings/released-71-raw-mappings";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import { parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument } from "./calculator-model";
import { prepareRawSourceStateDocument } from "./raw-source-state";

// Explicit hypothetical observations, not automatically satisfied production
// requirements or claims about actual gameplay. Keep these literals independent
// of getRawSourceStateContract so newly required conditions fail this suite.
const profiles = {
  "manekin-uninfused-base": {
    actualHitConfirmed: true, talentLevelObserved: true, wholeActionObserved: true,
    infusionInactive: true, burstInactive: true, noExternalInfusion: true,
    noAdditionalCharacterDamage: true,
  },
  "manekin-elemental-skill": {
    actualHitConfirmed: true, talentLevelObserved: true, wholeActionObserved: true,
    actualElementConfirmed: true, burstInactive: true, noAdditionalCharacterDamage: true,
  },
  "vodyanitsa-base-c0": {
    actualHitConfirmed: true, talentLevelObserved: true, wholeActionObserved: true,
    songInactive: true, concertoAndChorusInactive: true, noOwnStellarVortex: true,
    noAdditionalCharacterDamage: true,
  },
  "vesna-base-c0": {
    actualHitConfirmed: true, talentLevelObserved: true, wholeActionObserved: true,
    armedForActionInactive: true, radianceInactive: true, noExternalInfusion: true,
    noAdditionalCharacterDamage: true,
  },
} satisfies Record<string, Record<string, boolean>>;

type Profile = keyof typeof profiles;
interface ActionCase {
  characterId: string; skillId: string; profile: Profile;
  coefficients: readonly [number, number]; hitCount: number; plunge: boolean;
}
const cases: ActionCase[] = [];
// Reviewed level-1/10 sums from fixed b061b403 ProudSkillGroup 11731/11732,
// 14031 and 14331. Multihit sums are written explicitly; no calculator output or
// runtime mapping coefficients are used to produce the arithmetic oracle.
// These retain the source's provisional/single-extraction-lineage limitations.
const littleIdol = [
  ["normal-1", .517995, 1.023944, 1], ["normal-2", .497114, .982668, 1],
  ["normal-3", .67393, 1.332188, 2], ["normal-4", .809337, 1.599853, 1],
  ["charged", 1.11714, 2.2083, 2], ["plunge-low", 1.278377, 2.527025, 1],
  ["plunge-high", 1.596762, 3.15639, 1],
] as const;
for (const [slug, characterId] of [["manekin", "character:10000117"], ["manekina", "character:10000118"]] as const) {
  for (const [action, first, tenth, hitCount] of littleIdol) cases.push({
    characterId, skillId: `${slug}-${action}-raw-base`, profile: "manekin-uninfused-base",
    coefficients: [first, tenth], hitCount, plunge: action.startsWith("plunge"),
  });
  for (const element of ["pyro", "hydro", "electro", "cryo", "anemo", "geo", "dendro"]) cases.push({
    characterId, skillId: `${slug}-skill-${element}-raw`, profile: "manekin-elemental-skill",
    coefficients: [1.344, 2.4192], hitCount: 1, plunge: false,
  });
}
for (const [slug, characterId, actions] of [
  ["vodyanitsa", "character:10000140", [
    ["normal-1", .433848, .780926, 1], ["normal-2", .40232, .724176, 1],
    ["normal-3", .493016, .887429, 1], ["normal-4", .655632, 1.180138, 1],
    ["charged", 1.2376, 2.22768, 1], ["plunge-low", 1.136335, 2.246244, 1],
    ["plunge-high", 1.419344, 2.80568, 1],
  ]],
  ["vesna", "character:10000143", [
    ["normal-1", .4042, .799, 1], ["normal-2", .48676, .9622, 1],
    ["normal-3", .56158, 1.1101, 2], ["normal-4", .59168, 1.1696, 1],
    ["normal-5", .62436, 1.2342, 1], ["normal-6", .7224, 1.428, 1],
    ["charged", 1.33042, 2.6299, 1], ["plunge-low", 1.278377, 2.527025, 1],
    ["plunge-high", 1.596762, 3.15639, 1],
  ]],
] as const) for (const [action, first, tenth, hitCount] of actions) cases.push({
  characterId, skillId: `${slug}-${action}-base-c0`, profile: `${slug}-base-c0`,
  coefficients: [first, tenth], hitCount, plunge: action.startsWith("plunge"),
});

function fixture(row: ActionCase, level = 10): CalculatorDocument {
  const document = getCharacterDocuments(row.characterId, level).find(doc => doc.gameContext?.skillId === row.skillId)!;
  expect(document, row.skillId).toBeDefined();
  document.scope = "one-cast";
  document.characterLevel = 90;
  document.build = { mode: "manual-final", ascension: 6,
    stats: { atk: 1000, hp: 10000, def: 700, em: 0, critRate: .2, critDamage: 1.5 },
    source: "Explicit hypothetical base-state panel; not measured gameplay" };
  document.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  document.gameContext!.constellation = 0;
  document.gameContext!.rawSourceState = { sharedState: {
    ...profiles[row.profile], ...(row.plunge ? { zeroCollisionConfirmed: true } : {}),
  } };
  for (const hit of document.hits) {
    if (hit.kind !== "ordinary") throw new Error(`Unexpected raw action hit kind: ${row.skillId}`);
    hit.damageBonus = 0; hit.additiveBaseDamage = 0; hit.reaction = "none";
    hit.reactionBonus = 0; hit.groupMultiplier = 1;
  }
  document.selectedHitIds = document.hits.map(hit => hit.id);
  return document;
}

function expectBlocked(document: CalculatorDocument): void {
  const result = calculateDocument(document);
  expect(result.status).toBe("blocked");
  expect(result.totals).toBeUndefined();
  expect(result.blockers.length).toBeGreaterThan(0);
  expect(result.blockers.every(reason => reason.startsWith("raw-source-state:"))).toBe(true);
}

describe("explicit raw-source base-state action contracts", () => {
  it("covers all 44 current source action identities exactly once", () => {
    const expected = [...manekinRawTemplates, ...released71RawTemplates].map(row => row.skillId).sort();
    expect(cases).toHaveLength(44);
    expect(new Set(cases.map(row => row.skillId)).size).toBe(44);
    expect(cases.map(row => row.skillId).sort()).toEqual(expected);
  });

  it.each(cases)("keeps $skillId default-blocked and calculates explicit level-1/10 inputs", row => {
    for (const [index, level] of [1, 10].entries()) {
      const original = getCharacterDocuments(row.characterId, level).find(doc => doc.gameContext?.skillId === row.skillId)!;
      expectBlocked(original);
      expect(original.gameContext!.rawSourceState).toBeUndefined();
      const document = fixture(row, level), prepared = prepareRawSourceStateDocument(document);
      const result = calculateDocument(prepared), coefficient = row.coefficients[index]!;
      expect(prepared.gameContext!.scopeCoverage).toBe("complete-cast");
      expect(result.status).toBe("calculated");
      expect(result.verification).toBe("provisional");
      expect(result.blockers).toEqual([]);
      expect(result.hits).toHaveLength(row.hitCount);
      // ATK 1000 × source sum × equal-level DEF .5 × RES .9.
      expect(result.totals!.nonCritical).toBeCloseTo(450 * coefficient, 8);
      expect(result.totals!.critical).toBeCloseTo(1125 * coefficient, 8);
      expect(result.totals!.expected).toBeCloseTo(585 * coefficient, 8);
      expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(document))).totals).toEqual(result.totals);
      expect(calculateDocument(convertCalculatorToFinalPanel(document)).totals).toEqual(result.totals);
    }
  });

  it.each(Object.keys(profiles) as Profile[])("requires each explicit %s state and rejects C1", profile => {
    const row = cases.find(candidate => candidate.profile === profile && !candidate.plunge)!;
    for (const field of Object.keys(profiles[profile])) for (const answer of [undefined, false]) {
      const document = fixture(row), state = document.gameContext!.rawSourceState!.sharedState!;
      if (answer === undefined) delete state[field]; else state[field] = answer;
      expectBlocked(document);
    }
    const incompatible = fixture(row); incompatible.gameContext!.constellation = 1;
    expectBlocked(incompatible);
  });

  it("requires actual zero-collision confirmation for every complete plunge", () => {
    const plunges = cases.filter(row => row.plunge);
    expect(plunges).toHaveLength(8);
    for (const row of plunges) for (const answer of [undefined, false]) {
      const document = fixture(row), state = document.gameContext!.rawSourceState!.sharedState!;
      if (answer === undefined) delete state.zeroCollisionConfirmed; else state.zeroCollisionConfirmed = answer;
      expectBlocked(document);
    }
  });
});
