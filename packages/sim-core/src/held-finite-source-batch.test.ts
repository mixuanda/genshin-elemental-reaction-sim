import { describe, expect, it } from "vitest";
import { gameDataCatalog } from "../../game-data/src/catalog";
import { heldLifecycleTemplates } from "../../game-data/src/character-mappings/held-lifecycle-mappings";
import { finiteFollowupTemplates } from "../../game-data/src/character-mappings/finite-followup-mappings";
import { getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import { parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument, type FiniteFollowupCastContext, type HeldLifecycleCastContext } from "./calculator-model";
import { compileHeldLifecycleSchedule, type HeldLifecycleCastKind } from "./held-lifecycle-schedule";
import { prepareSourceCastDocument } from "./source-cast-context";

function documentFor(slug: string, skillId: string): CalculatorDocument {
  const character = gameDataCatalog.characters.find(row => row.slug === slug)!;
  const doc = getCharacterDocuments(character.id, 1).find(row => row.gameContext?.skillId === skillId)!;
  expect(doc, skillId).toBeDefined();
  doc.scope = "one-cast";
  doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 1000, hp: 20000, def: 800, em: 200, critRate: .5, critDamage: 1 }, source: "Explicit batch teaching input" };
  doc.gameContext!.constellation = 0;
  return doc;
}

function heldContext(id: string): HeldLifecycleCastContext {
  const context: HeldLifecycleCastContext = {
    casterId: "owner", targetId: "enemy", freshCastConfirmed: true, noHitlag: true,
    noInterruption: true, noReplacement: true, fullObservedLifetime: true, observedThroughFrame: 1000,
    statsStableAcrossHits: true, sharedState: { actualElementalMasteryAtHit: 300, includedDamageBonus: 0 },
    dendro: { pyroTransformFrame: 70, pyroApplicationConfirmed: true, firstTransformationConfirmed: true },
    hydroHold: { dewdropCount: 3, travelFrames: 6, arkheReady: true, hpRatiosBeforeDewdrops: [.5, .5, .5], noHealingOrDropletPickup: true, priorA4Bonus: 0 },
    pyro: { initialNightsoulPoints: 0, noExternalPointChanges: true, initialDamagePositive: true,
      damageEvents: [25, 220, 405].map(frame => ({ id: `external-${frame}`, frame, actorId: "driver", targetId: "enemy", tag: "normal", origin: "external", damagePositive: true })) },
    noelle: { spinCount: 3, startsFromIdle: true, attackSpeedBonus: 0, initialStamina: 200, staminaCostMultiplier: 1, noExternalStaminaChanges: true, burstInactive: true, shieldInactive: true, sourceCastFrame: 10 },
  };
  // Explicit observed contacts; the independently asserted frame lists below are the source oracle.
  context.targetContacts = Object.fromEntries(compileHeldLifecycleSchedule(id as HeldLifecycleCastKind, context).candidates.map(hit => [hit.id, true]));
  if (id.includes("-hydro-burst-")) context.targetContacts["tick-2"] = false;
  return context;
}

function expectRoundtripAndConversion(doc: CalculatorDocument): void {
  const result = calculateDocument(doc);
  expect(result.blockers, doc.gameContext!.skillId).toEqual([]);
  expect(doc.gameContext!.scopeCoverage).toBe("complete-cast");
  expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(doc)))).toEqual(result);
  expect(calculateDocument(prepareSourceCastDocument(doc)).totals).toEqual(result.totals);
  const final = convertCalculatorToFinalPanel(doc);
  expect(calculateDocument(final).blockers).toEqual([]);
  expect(calculateDocument(final).totals!.expected).toBeCloseTo(result.totals!.expected, 9);
  const last = result.hits.at(-1)!;
  const single = structuredClone(doc);
  single.scope = "single-hit";
  single.selectedHitIds = [doc.hits.at(-1)!.id];
  expect(calculateDocument(single).totals!.expected).toBeCloseTo(last.expected!, 9);
}

describe("one held and finite followup source batch", () => {
  it("expands eleven finite lifetimes with actual contacts and preserves independent hit accounting", () => {
    expect(heldLifecycleTemplates).toHaveLength(11);
    for (const cast of heldLifecycleTemplates) {
      const doc = documentFor(cast.characterSlug, cast.skillId);
      doc.gameContext!.heldLifecycleCast = heldContext(cast.skillId);
      const prepared = prepareSourceCastDocument(doc);
      const expectedFrames = cast.skillId.includes("-dendro-") ? [130]
        : cast.skillId.includes("-hydro-skill-") ? [61, 76, 87, 91, 133]
          : cast.skillId.includes("-hydro-burst-") ? (cast.skillId.includes("-aether-") ? [34, 94, 124, 154, 184, 214, 244] : [36, 96, 126, 156, 186, 216, 246])
            : cast.skillId.includes("-pyro-skill-tap-") ? [24, 90, 156, 222, 288, 354]
              : cast.skillId.includes("-pyro-skill-hold-") ? [37, 50, 232, 417]
                : [79, 102, 125, 164];
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.heldLifecycleEvent?.frame : undefined), cast.skillId).toEqual(expectedFrames);
      expectRoundtripAndConversion(prepared);
      if (cast.skillId.includes("-dendro-")) {
        const hit = calculateDocument(prepared).hits[0]!;
        expect(hit.trace.find(node => node.id === "customDamageBonus")!.result!.value).toBe(.3);
        const conflict = structuredClone(prepared);
        conflict.gameContext!.heldLifecycleCast!.dendro!.pyroTransformFrame = 100;
        expect(calculateDocument(conflict).blockers.some(reason => reason.includes("14") || reason.includes("周期"))).toBe(true);
      }
    }
    const id = "held-aether-hydro-burst-c0", context = heldContext(id);
    context.targetContacts = {};
    expect(compileHeldLifecycleSchedule(id, context).complete).toBe(false);
    context.targetContacts = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`tick-${index + 1}`, false]));
    const noHit = documentFor("aether", id);
    noHit.gameContext!.heldLifecycleCast = context;
    expect(prepareSourceCastDocument(noHit).hits[0]!.kind).toBe("non-damaging");
    expect(calculateDocument(noHit).hits[0]!.status).toBe("non-damaging");
    expect(calculateDocument(noHit).blockers).toEqual([]);
  });

  it("restores seven complete followups with separately levelled arrows, shield lifetime and per-hit passive shares", () => {
    expect(finiteFollowupTemplates).toHaveLength(7);
    for (const cast of finiteFollowupTemplates) {
      const doc = documentFor(cast.characterSlug, cast.skillId);
      const context: FiniteFollowupCastContext = {
        completeCastConfirmed: true, statsStableAcrossHits: true, noHitlag: true, noReplacement: true, noInterruption: true,
        keqingFreshStiletto: true, keqingPriorQInactive: true, keqingFollowupFrame: 60,
        faruzanFreshNoPriorEffects: true, faruzanInsideBurstArea: true, faruzanNoOtherAnemoBeforeInitial: true,
        faruzanHurricaneStartFrame: 40, normalTalentLevel: 6, faruzanBaseAtk: 500,
        xinyanInitialOpponentCount: 2, xinyanShieldUnbroken: true,
        cynoBurstActive: true, cynoEndseerActive: cast.skillId.endsWith("-skill-endseer-c0"), cynoBurstEmIncludedInPanel: false, cynoCastEm: 300,
        hitStates: Object.fromEntries(cast.hits.map(hit => [hit.id, { includedDamageBonus: 0, includedAdditiveBase: 0, includedResistanceReduction: 0 }])),
      };
      doc.gameContext!.finiteFollowupCast = context;
      const prepared = prepareSourceCastDocument(doc);
      expect(prepared.hits).toHaveLength(cast.hits.length);
      expectRoundtripAndConversion(prepared);
      if (cast.skillId.endsWith("-cyno-skill-endseer-c0")) {
        const result = calculateDocument(prepared);
        expect(result.hits.map(hit => hit.trace.find(node => node.id === "customDamageBonus")!.result!.value)).toEqual([.35, 0, 0, 0]);
        expect(result.hits.map(hit => hit.trace.find(node => node.id === "customAdditiveBase")!.result!.value)).toEqual([0, 750, 750, 750]);
      }
      if (cast.skillId.includes("-keqing-")) {
        const changed = convertCalculatorToFinalPanel(prepared);
        changed.gameContext!.finiteFollowupCast!.keqingFollowupFrame = 61;
        expect(calculateDocument(changed).blockers.some(reason => reason.includes("时点已改变"))).toBe(true);
      }
    }
  });
});
