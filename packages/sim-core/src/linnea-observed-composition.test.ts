import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { calculateObservedSkillComposition, type ObservedSkillCompositionDocument } from "./observed-skill-composition";
import { analyzeLinneaComposition } from "./linnea-observed-composition";
import type { CalculatorDocument } from "./calculator-model";

function observedSummon(): Extract<ObservedSkillCompositionDocument, { profile: "linnea-lumi" }> {
  const child = JSON.parse(readFileSync("docs/validation/linnea-observed-input-20260928.json", "utf8")) as CalculatorDocument;
  child.gameContext!.characterId = "character:10000130";
  const context = structuredClone(child.gameContext!.observedLinneaLifecycle!);
  context.events.push(
    { id: "miss-1", kind: "attack-contact", frame: 180, order: 0, summonId: "lumi", attackId: "miss-1", component: "pummeler-1", pairId: "pair-miss", targetId: "enemy", contactConfirmed: false, targetWithinLumiA1Range: false, nearbyMoondrift: false, moonsignLevel: 2 },
    { id: "miss-2", kind: "attack-contact", frame: 181, order: 0, summonId: "lumi", attackId: "miss-2", component: "pummeler-2", pairId: "pair-miss", targetId: "enemy", contactConfirmed: false, targetWithinLumiA1Range: false, nearbyMoondrift: false, moonsignLevel: 2 },
    { id: "depart", kind: "depart-observed", frame: 200, order: 0, summonId: "lumi", reason: "cancelled" },
  );
  return { schemaVersion: "observed-skill-composition-v1", profile: "linnea-lumi", id: "linnea-teaching-episode",
    label: "一次露米召唤教学观察窗口", targetId: "enemy", originEventId: "skill", endEventId: "depart",
    allOpportunitiesRecorded: true, damageWindowClosed: true, dataIdentity: child.dataIdentity,
    context, components: [{ id: "hammer-child", eventId: "hammer", document: child }],
    unmappedOpportunities: [], assumptions: ["合成教学事件；非实机测量。"] };
}

it("closes a declared E-origin summon with one contact and a complete missed Pummeler pair", () => {
  const doc = observedSummon();
  const analysis = analyzeLinneaComposition(doc);
  expect(analysis.closed).toBe(true);
  expect(analysis.completeCastEligible).toBe(true);
  expect(analysis.opportunities.map(row => [row.eventId, row.contact])).toEqual([["hammer", true], ["miss-1", false], ["miss-2", false]]);
  const result = calculateObservedSkillComposition(doc);
  expect(result.blockers).toEqual([]);
  expect(result.coverage).toBe("complete-cast");
  expect(result.components.map(row => row.status)).toEqual(["calculated", "non-damaging", "non-damaging"]);
  expect(result.totals?.expected).toBeCloseTo(3238.1853658536584, 8);
});

it("keeps Q refresh as an observed-window attribution and rejects an incomplete declared pair", () => {
  const refreshed = observedSummon();
  refreshed.context.events.splice(-1, 0, { id: "q-refresh", kind: "burst-cast", frame: 190, order: 0, summonId: "lumi", observedExpiresFrame: 300, actionReadyConfirmed: true });
  const departure = refreshed.context.events.at(-1)!;
  if (departure.kind !== "depart-observed") throw new Error("Expected departure");
  departure.frame = 300;
  expect(analyzeLinneaComposition(refreshed).completeCastEligible).toBe(false);
  expect(calculateObservedSkillComposition(refreshed).coverage).toBe("complete-observed-window");

  const incomplete = observedSummon();
  incomplete.context.events = incomplete.context.events.filter(event => event.id !== "miss-2");
  expect(analyzeLinneaComposition(incomplete).issues.some(reason => reason.includes("pair-miss"))).toBe(true);
  expect(calculateObservedSkillComposition(incomplete).coverage).toBe("partial");
});
