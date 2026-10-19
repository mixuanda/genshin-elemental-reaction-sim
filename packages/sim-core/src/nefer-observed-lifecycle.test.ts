import { describe, expect, it } from "vitest";
import { gameDataCatalog } from "../../game-data/src/catalog";
import { getCharacterDocuments, applyCharacterConstellationScope } from "../../../apps/web/src/character-calculations";
import { prepareNeferObservedDocument, resolveNeferObservedLifecycle } from "./nefer-observed-lifecycle";
import type { NeferObservedContext } from "./nefer-observed-context";

const characterId = gameDataCatalog.characters.find(character => character.slug === "nefer")!.id;
const base = (): NeferObservedContext => ({
  character: "nefer", casterId: characterId, constellation: 2, ascension: 6, moonsignCount: 2,
  initialFrame: 0, initialOrder: 0, initialDew: 1, initialPhantasmsUsed: 0,
  initialVeils: [], initialShadowDanceActive: false, initialC4Targets: {},
  eventsObservedThroughCutoff: true, observedOrderConfirmed: true, noHitlag: true,
  events: [
    { id: "cast1", kind: "skill-cast", frame: 1, order: 0, castId: "e1", actionReadyConfirmed: true },
    { id: "hit1", kind: "rush-hit", frame: 1, order: 1, castId: "e1", targetId: "enemy", contactConfirmed: true, snapshotFrame: 1, finalPanelConfirmedAtHit: true },
    { id: "c2-after-hit", kind: "c2-veil-grant", frame: 1, order: 2, castId: "e1", veilIds: ["veil1", "veil2"] },
    { id: "seed1", kind: "seed-absorb", frame: 2, order: 0, seedId: "seed1", veilId: "veil3", source: "charged" },
    { id: "seed2", kind: "seed-absorb", frame: 3, order: 0, seedId: "seed2", veilId: "veil4", source: "charged" },
    { id: "seed3", kind: "seed-absorb", frame: 4, order: 0, seedId: "seed3", veilId: "veil5", source: "phantasm" },
    { id: "cast2", kind: "skill-cast", frame: 5, order: 0, castId: "e2", actionReadyConfirmed: true },
    { id: "c2-before-hit", kind: "c2-veil-grant", frame: 5, order: 1, castId: "e2", veilIds: ["veil6", "veil7"], replacedVeilIds: ["veil1", "veil2"] },
    { id: "hit2", kind: "rush-hit", frame: 5, order: 2, castId: "e2", targetId: "enemy", contactConfirmed: true, snapshotFrame: 5, finalPanelConfirmedAtHit: true },
  ], hitBindings: { "nefer-skill-rush-hit": "hit2" },
});

describe("Nefer observed ordinary E lifecycle", () => {
  it("uses observed callback order, independent Veil expiry and the same sourced E request", () => {
    const context = base();
    const before = resolveNeferObservedLifecycle(context, "hit1");
    expect(before.issues).toEqual([]);
    expect(before.records.at(-1)).toMatchObject({ veilStacks: 0, fullVeilEmActive: false });
    const after = resolveNeferObservedLifecycle(context, "hit2");
    expect(after.issues).toEqual([]);
    expect(after.records.at(-1)).toMatchObject({ veilStacks: 5, fullVeilEmActive: true, emWindowExpiresAt: 485 });

    const source = getCharacterDocuments(characterId, 10).find(document => document.gameContext?.skillId === "nefer-skill-rush")!;
    source.gameContext!.constellation = 2;
    const document = applyCharacterConstellationScope(source);
    context.ascension = document.gameContext!.ascension!;
    document.gameContext!.observedNeferLifecycle = context;
    const prepared = prepareNeferObservedDocument(document);
    const hit = prepared.hits[0];
    if (hit?.kind !== "ordinary") throw new Error("Missing ordinary E hit");
    expect(prepared.dependencies.find(row => row.id === `nefer-observed:${hit.id}`)?.status).toBe("provisional");
    expect(hit.elementalMasteryAdjustment?.formula.inputs.find(input => input.key === "neferFullVeilEmBuffActive")?.value).toBe(1);
    expect(hit.additiveBaseFormula).toBeUndefined();
  });

  it("keeps C4 residual and EM expiry boundaries explicit", () => {
    const context = base();
    context.constellation = 4;
    context.initialShadowDanceActive = true;
    context.initialPhantasmsUsed = 1;
    context.initialC4Targets = { enemy: { status: "near" } };
    context.events = [
      { id: "exit", kind: "shadow-exit", frame: 1, order: 0 },
      { id: "cast", kind: "skill-cast", frame: 2, order: 0, castId: "e", actionReadyConfirmed: true },
      { id: "grant", kind: "c2-veil-grant", frame: 2, order: 1, castId: "e", veilIds: ["v1", "v2"] },
      { id: "hit", kind: "rush-hit", frame: 271, order: 0, castId: "e", targetId: "enemy", contactConfirmed: true, snapshotFrame: 2, finalPanelConfirmedAtHit: true },
    ];
    const unknown = resolveNeferObservedLifecycle(context, "hit");
    expect(unknown.issues.join("；")).toContain("C4残留到期帧");
    const hit = context.events[3];
    if (hit?.kind !== "rush-hit") throw new Error("Missing observed E hit");
    hit.c4ActiveAtExpiryBoundary = true;
    const resolved = resolveNeferObservedLifecycle(context, "hit");
    expect(resolved.issues).toEqual([]);
    expect(resolved.records.at(-1)?.c4TargetDebuffActive).toBe(true);
  });
});
