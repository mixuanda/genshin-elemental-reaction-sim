import { describe, expect, it } from "vitest";
import { prepareAlyoshaObservedDocument, resolveAlyoshaObservedLifecycle } from "./alyosha-observed-lifecycle";
import type { AlyoshaObservedContext } from "./alyosha-observed-context";
import { getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import { gameDataCatalog } from "../../game-data/src/catalog";

const context = (): AlyoshaObservedContext => ({
  character: "alyosha", casterId: "alyosha", constellation: 0, ascension: 1, skillTalentLevel: 1,
  initialFrame: 0, initialOrder: 0, initialMarksKnownClear: true, initialPrecisionKnownClear: true, initialBurstKnownClear: true,
  initialActiveActorId: "alyosha", eventsObservedThroughCutoff: true, observedOrderConfirmed: true, noHitlag: true,
  events: [
    { id: "burst", kind: "burst-cast", frame: 1, order: 0, burstId: "q1", actionReadyConfirmed: true },
    { id: "mark1", kind: "mark-apply", frame: 2, order: 0, source: "skill-press", targetId: "enemy", contactConfirmed: true },
    { id: "mark2", kind: "mark-apply", frame: 3, order: 0, source: "skill-hold", targetId: "enemy", contactConfirmed: true, nearbyRecipientIds: ["alyosha", "ally"] },
    { id: "front", kind: "field-change", frame: 4, order: 0, activeActorId: "ally" },
    { id: "precision", kind: "precision-check", frame: 5, order: 0, recipientId: "ally", radianceStellarConductActiveConfirmed: true },
    { id: "mark3", kind: "mark-apply", frame: 6, order: 0, source: "normal-fourth", targetId: "enemy", contactConfirmed: true },
    { id: "bite", kind: "tugarin-attack", frame: 120, order: 0, burstId: "q1", attackId: "bite-1", targetId: "enemy", approachedTargetConfirmed: true, contactConfirmed: true, nearbyRecipientIds: ["alyosha", "ally"], healRecipientId: "ally", healResolvedConfirmed: true, alyoshaAttackAtHeal: 2000 },
  ], hitBindings: {},
});

describe("Alyosha observed C0 lifecycle", () => {
  it("activates and removes a mark in callback order, applies precision to the actual frontline, and heals on an observed bite", () => {
    const result = resolveAlyoshaObservedLifecycle(context());
    expect(result.issues).toEqual([]);
    expect(result.records.find(row => row.eventId === "mark2")?.activatedMark).toBe(true);
    expect(result.records.find(row => row.eventId === "precision")?.attackBonusRatio).toBe(.1166);
    expect(result.records.find(row => row.eventId === "bite")?.activatedMark).toBe(true);
    expect(result.records.find(row => row.eventId === "bite")?.healing).toEqual({ recipientId: "ally", baseHealing: 2400 });
    expect(result.records.filter(row => row.kind === "tugarin-attack")).toHaveLength(1);
    expect(result.marks.enemy).toBeUndefined();
  });

  it("does not infer missing Q attacks and rejects an observed cadence shorter than two seconds", () => {
    const observed = context();
    observed.events.push({ id: "early-bite", kind: "tugarin-attack", frame: 200, order: 0, burstId: "q1", attackId: "bite-2", targetId: "enemy", approachedTargetConfirmed: true, contactConfirmed: true, healRecipientId: "ally", healResolvedConfirmed: true, alyoshaAttackAtHeal: 2000 });
    const result = resolveAlyoshaObservedLifecycle(observed);
    expect(result.records.filter(row => row.kind === "tugarin-attack")).toHaveLength(2);
    expect(result.issues.some(issue => issue.includes("不足2秒"))).toBe(true);
  });

  it("accepts the real catalog character ID when binding a sourced E hit", () => {
    const characterId = gameDataCatalog.characters.find(character => character.slug === "alyosha")!.id;
    expect(characterId).toBe("character:10000148");
    const document = getCharacterDocuments(characterId, 1).find(doc => doc.gameContext?.skillId === "alyosha-skill-press")!;
    const observed = context();
    observed.ascension = document.gameContext!.ascension!;
    observed.casterId = characterId;
    observed.hitBindings = { [document.hits[0]!.id]: "mark1" };
    document.gameContext!.observedAlyoshaLifecycle = observed;
    const prepared = prepareAlyoshaObservedDocument(document);
    expect(prepared.dependencies.find(dep => dep.id === `alyosha-observed:${document.hits[0]!.id}`)?.status).toBe("provisional");
  });
});
