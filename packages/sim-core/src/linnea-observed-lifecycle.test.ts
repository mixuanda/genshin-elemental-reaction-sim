import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { sourceClassifiedMappings } from "../../game-data/src/classified-hits";
import { createLinneaA1ResistanceReductionFormula } from "../../../apps/web/src/character-source-formulas";
import { calculateDocument } from "./calculator";
import { createObservedSpecialComponentDocument } from "./observed-special-component-formulas";
import { linneaObservedTrace, prepareLinneaObservedDocument, resolveLinneaObservedLifecycle } from "./linnea-observed-lifecycle";
import { prepareObservedSpecialComponentDocument } from "./observed-special-component-formulas";
import { parseCalculatorDocument, type CalculatorDocument } from "./calculator-model";
import { prepareSourceCastDocument } from "./source-cast-context";
import type { LinneaObservedContext } from "./linnea-observed-context";

const baseContext = (): LinneaObservedContext => ({
  character: "linnea", constellation: 0, initialLumiAbsentKnown: true,
  eventsObservedThroughSelected: true, observedOrderConfirmed: true,
  events: [
    { id: "e", kind: "skill-tap", frame: 0, order: 0, summonId: "lumi-1", observedEffect: "summon", observedExpiresFrame: 1500, actionReadyConfirmed: true },
    { id: "first", kind: "attack-contact" as const, frame: 120, order: 0, summonId: "lumi-1", attackId: "pair-1a", component: "pummeler-1", pairId: "pair-1", targetId: "enemy", contactConfirmed: true, targetWithinLumiA1Range: true, nearbyMoondrift: false, moonsignLevel: 2, snapshotFrame: 120, snapshotId: "panel-120" },
    { id: "second", kind: "attack-contact" as const, frame: 122, order: 0, summonId: "lumi-1", attackId: "pair-1b", component: "pummeler-2", pairId: "pair-1", targetId: "enemy", contactConfirmed: true, targetWithinLumiA1Range: true, nearbyMoondrift: false, moonsignLevel: 2, snapshotFrame: 122, snapshotId: "panel-122" },
  ], hitBindings: {},
});

function pairDocument(): CalculatorDocument {
  const mapping = sourceClassifiedMappings.find(row => row.skillId === "linnea-lumi-pummeler-pair")!;
  const refs = mapping.sourcePaths.map(path => `https://github.com/${mapping.sourceRepository}/blob/${mapping.sourceCommit}/${path}`);
  const hit = (part: number): CalculatorDocument["hits"][number] => ({ id: `${mapping.id}-hit-${part}`, label: `${mapping.hitLabel} ${part}`, kind: "ordinary", element: "geo", attackTag: "skill",
    terms: [{ stat: "def", coefficient: mapping.sourceCoefficientValues![0]! }], additiveBaseDamage: 0, damageBonus: 0, critEligible: true,
    reaction: "none", reactionBonus: 0, groupMultiplier: 1, resistanceReductionFormula: createLinneaA1ResistanceReductionFormula(), sourceRefs: refs, dependencies: [] });
  const hits = [hit(1), hit(2)];
  return { schemaVersion: "1.0.0", ruleVersion: "ordinary-trace-v1", id: "linnea-observed-pair", label: "露米普通双击教学观察输入", scope: "one-cast", characterLevel: 90,
    build: { mode: "manual-final", stats: { atk: 1000, hp: 20000, def: 1000, em: 0, critRate: 0.5, critDamage: 1 }, ascension: 6, source: "显式教学最终面板，不代表实机测量" },
    enemy: { level: 90, resistance: 0.1, defenseAdjustment: 0, defenseIgnore: 0 },
    gameContext: { characterId: "character:linnea", characterName: "莉奈娅", abilityId: "talent:linnea:combat2", skillId: "linnea-lumi-pummeler-pair", skillName: "露米普通双击", effectiveTalentLevel: 1, ascension: 6, constellation: 0,
      scopeCoverage: "selected-components", attributionPolicy: "只计算已观察并实际接触的普通双击段" },
    hits, selectedHitIds: hits.map(row => row.id), assumptions: ["显式教学事件和面板，不称游戏实测。"], dependencies: [],
    dataIdentity: { datasetId: "synthetic-linnea-observed", gameVersion: "synthetic", releaseStatus: "synthetic", evidenceStatus: "synthetic" } };
}

/** Public creation path for an importable selected Linnea document. */
export function makeLinneaObservedHammerFixture(includeFutureInvalidEvent = false): CalculatorDocument {
  const base = pairDocument();
  const document = createObservedSpecialComponentDocument(base, "linnea-lumi-heavy-overdrive-hammer-component");
  document.build = { mode: "manual-final", stats: { atk: 1000, hp: 20000, def: 1000, em: 0, critRate: 0.5, critDamage: 1 }, ascension: 6, source: "明确的观察式示例最终面板" };
  document.enemy.resistance = 0.1;
  document.gameContext!.ascension = 6;
  document.gameContext!.observedSpecialComponent = {
    casterId: "linnea", targetId: "enemy",
    sharedState: { intrinsicStatMatchesSnapshot: true, specialBaseBonus: 0, includedIntrinsicBaseBonus: 0,
      reactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1, linneaA4AppliesToSelf: true,
      a4PreConversionStat: 1000, includedCharacterEm: 0, includedResistanceReduction: 0 },
  };
  document.gameContext!.observedLinneaLifecycle = {
    character: "linnea", constellation: 0, initialLumiAbsentKnown: true, eventsObservedThroughSelected: true, observedOrderConfirmed: true,
    events: [
      { id: "skill", kind: "skill-tap", frame: 0, order: 0, summonId: "lumi", observedEffect: "summon", observedExpiresFrame: 1400, actionReadyConfirmed: true },
      { id: "hammer", kind: "attack-contact" as const, frame: 120, order: 0, summonId: "lumi", attackId: "hammer-120", component: "hammer", targetId: "enemy", contactConfirmed: true, targetWithinLumiA1Range: true, nearbyMoondrift: true, moonsignLevel: 2, snapshotFrame: 120, snapshotId: "panel-120" },
      ...(includeFutureInvalidEvent ? [{ id: "later-invalid", kind: "attack-contact" as const, frame: 1600, order: 0, summonId: "lumi", attackId: "late", component: "hammer" as const, targetId: "enemy", contactConfirmed: true, targetWithinLumiA1Range: true, nearbyMoondrift: true, moonsignLevel: 2, snapshotFrame: 1600, snapshotId: "late" }] : []),
    ], selectedEventId: "hammer",
  };
  document.assumptions.push("此文档中的帧、事件、面板均为教学用显式观察输入，不是游戏实测记录。");
  return document;
}

it("binds only the selected Pummeler segment and preserves unknown supply", () => {
  const document = pairDocument();
  expect(document.hits).toHaveLength(2);
  document.selectedHitIds = [document.hits[0]!.id];
  const context = baseContext(); context.hitBindings = { [document.hits[0]!.id]: "first" };
  context.events.push({ id: "future-bad", kind: "attack-contact" as const, frame: 1600, order: 0, summonId: "lumi-1", attackId: "future", component: "hammer", targetId: "enemy", contactConfirmed: true, targetWithinLumiA1Range: true, nearbyMoondrift: false, moonsignLevel: 2, snapshotFrame: 1600, snapshotId: "future" });
  document.gameContext!.observedLinneaLifecycle = context;
  const bound = prepareLinneaObservedDocument(document);
  expect(bound.dependencies.find(dep => dep.id === `linnea-observed:${document.hits[0]!.id}`)?.status).toBe("provisional");
  expect(bound.dependencies.some(dep => dep.id === `linnea-observed:${document.hits[1]!.id}`)).toBe(false);
  expect(resolveLinneaObservedLifecycle(context, "first").records.at(-1)?.supply).toBeNull();
  expect(linneaObservedTrace(bound).some(node => node.id.endsWith(":supply"))).toBe(false);
  const both = structuredClone(document); both.selectedHitIds = both.hits.map(hit => hit.id);
  both.gameContext!.observedLinneaLifecycle!.hitBindings![both.hits[1]!.id] = "second";
  const second = both.gameContext!.observedLinneaLifecycle!.events[2]!;
  if (second.kind !== "attack-contact") throw new Error("Expected second Pummeler contact");
  second.pairId = "different-pair";
  expect(prepareLinneaObservedDocument(both).dependencies.filter(dep => dep.id.startsWith("linnea-observed:")).every(dep => dep.status === "missing")).toBe(true);
});

it("binds a real Hammer contact into the existing special formula without future-event leakage", () => {
  const document = makeLinneaObservedHammerFixture(true);
  const prepared = prepareLinneaObservedDocument(prepareObservedSpecialComponentDocument(document));
  const bound = prepared.dependencies.find(dep => dep.id.startsWith("linnea-observed:"));
  expect(bound?.status).toBe("provisional");
  const result = calculateDocument(prepared);
  expect(result.blockers).toEqual([]);
  expect(result.hits).toHaveLength(1);
  expect(prepared.gameContext!.observedSpecialComponent?.independentEvent?.candidateId).toBe("hammer-120");
});

it("imports a complete teaching document and computes its selected Hammer through the shared cast path", () => {
  const fixture = makeLinneaObservedHammerFixture();
  const imported = parseCalculatorDocument(JSON.stringify(fixture));
  const prepared = prepareSourceCastDocument(imported);
  const result = calculateDocument(prepared);
  expect(result.blockers).toEqual([]);
  expect(result.hits).toHaveLength(1);
  expect(result.hits[0]!.expected).toBeGreaterThan(0);
  expect(calculateDocument(prepareSourceCastDocument(parseCalculatorDocument(JSON.stringify(prepared)))).blockers).toEqual([]);
  if (process.env.GIDPS_WRITE_LINNEA_FIXTURE === "1") {
    writeFileSync("docs/validation/linnea-observed-input-20260928.json", `${JSON.stringify(prepared, null, 2)}\n`);
  }
});
