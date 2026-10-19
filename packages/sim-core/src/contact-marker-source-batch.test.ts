import { expect, it } from "vitest";
import { gameDataCatalog } from "../../game-data/src/catalog";
import { getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import { parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument, type ObservedEntityCastContext } from "./calculator-model";
import { compileObservedEntitySchedule } from "./observed-entity-schedule";
import { prepareSourceCastDocument } from "./source-cast-context";

const common: ObservedEntityCastContext = { casterId: "caster", targetId: "enemy", freshCastConfirmed: true,
  noHitlag: true, noInterruption: true, noReplacement: true, fullObservedLifetime: true, statsStableAcrossHits: true };
function document(slug: string, context: ObservedEntityCastContext): CalculatorDocument {
  const character = gameDataCatalog.characters.find(row => row.slug === slug)!;
  const id = `observed-${slug}-${slug === "kaeya" ? "burst" : "skill"}-c0`;
  const doc = getCharacterDocuments(character.id, 1).find(row => row.gameContext?.skillId === id)!;
  doc.scope = "one-cast"; doc.characterLevel = 90;
  doc.enemy = { ...doc.enemy, level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  doc.build = { mode: "manual-final", ascension: 6, source: "Explicit synthetic source-protocol input, not a game observation",
    stats: { atk: 1000, hp: 30000, def: 800, em: 0, critRate: .5, critDamage: 1 } };
  doc.gameContext!.constellation = 0; doc.gameContext!.ascension = 6; doc.gameContext!.observedEntityCast = context;
  doc.selectedHitIds = doc.hits.map(hit => hit.id);
  return doc;
}

/** One combined case, prepared for the root's batch; never self-run by this task. */
it("uses explicit reference contacts and E-owned marker refreshes, preserves source formulas and restores one occurred hit", () => {
  const kaeya = document("kaeya", { ...common, observedThroughFrame: 534,
    kaeya: { fixedSourceApproximationConfirmed: true }, targetContacts: Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`icicle-${i + 1}`, true])) });
  const kaeyaSchedule = compileObservedEntitySchedule("observed-kaeya-burst-c0", kaeya.gameContext!.observedEntityCast!);
  expect(kaeyaSchedule.instances.map(row => row.frame)).toEqual(Array.from({ length: 13 }, (_, i) => 53 + i * 40));
  expect(calculateDocument(kaeya).blockers).toEqual([]);

  const aloy = document("aloy", { ...common, observedThroughFrame: 122,
    aloy: { fixedSourceApproximationConfirmed: true, travelFrames: 30, bombDelayFrames: 60, bombletCount: 2, allSourceBombletsDeclared: true },
    targetContacts: { main: true, "bomblet-1": true, "bomblet-2": false } });
  const aloySchedule = compileObservedEntitySchedule("observed-aloy-skill-c0", aloy.gameContext!.observedEntityCast!);
  expect(aloySchedule.instances.map(row => [row.frame, row.snapshotFrame])).toEqual([[50, 20], [116, 50]]);
  const aloyResult = calculateDocument(aloy);
  expect(aloyResult.blockers).toEqual([]); expect(aloyResult.totals!.expected).toBeCloseTo(1468.8, 8);

  const hutao = document("hutao", { ...common, observedThroughFrame: 873,
    hutao: { allChargedAttacksRecorded: true, noSwapUntilNaturalEnd: true, skillStartCurrentHP: 15000, skillStartMaxHP: 30000,
      skillStartBaseATK: 1000, chargedAttacks: [
        { id: "ca1", startFrame: 30, removedFrame: 60, nextState: "other", actorId: "caster", targetId: "enemy", hitConfirmed: true },
        { id: "ca2", startFrame: 300, removedFrame: 340, nextState: "other", actorId: "caster", targetId: "enemy", hitConfirmed: true },
        { id: "later-normal-ca", startFrame: 700, removedFrame: 740, nextState: "other", actorId: "caster", targetId: "enemy", hitConfirmed: true },
      ] }, sharedState: { actualHPRatioAtSnapshot: .35, includedAttackBonus: 0, includedDamageBonus: 0 },
    targetContacts: { "blossom-1-1": true, "blossom-1-2": true, "blossom-1-3": true } });
  const schedule = compileObservedEntitySchedule("observed-hutao-skill-c0", hutao.gameContext!.observedEntityCast!);
  expect(schedule.complete).toBe(true);
  expect(schedule.instances.map(row => [row.frame, row.paramitaActiveAtSnapshot])).toEqual([[273, true], [513, true], [753, false]]);
  expect(schedule.lifecycleEndFrame).toBe(873);
  expect(schedule.decisions.find(row => row.eventId === "later-normal-ca")?.accepted).toBe(false);
  const prepared = prepareSourceCastDocument(hutao), result = calculateDocument(prepared);
  expect(result.blockers).toEqual([]); expect(result.totals!.expected).toBeCloseTo(3047.810976, 8);
  const final = parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(prepared)));
  expect(calculateDocument(final).totals).toEqual(result.totals);
  final.scope = "single-hit"; final.selectedHitIds = [final.hits.at(-1)!.id];
  delete final.gameContext!.observedEntityCast!.hutao;
  const single = calculateDocument(final);
  expect(single.blockers).toEqual([]); expect(single.totals!.expected).toBeCloseTo(574.56, 8);
  const unknown = structuredClone(kaeya); delete unknown.gameContext!.observedEntityCast!.targetContacts!['icicle-7'];
  expect(calculateDocument(unknown).blockers.length).toBeGreaterThan(0);
});
