import { describe, expect, it } from "vitest";
import { coordinatedCastTemplates } from "../../game-data/src/character-mappings/coordinated-cast-mappings";
import { gameDataCatalog } from "../../game-data/src/catalog";
import { getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import { parseCalculatorDocument, serializeCalculatorDocument, type CoordinatedCastContext } from "./calculator-model";
import { compileSchedule } from "./coordinated-cast-schedule";
import { prepareCoordinatedCastDocument } from "./coordinated-cast-formulas";

const context = (): CoordinatedCastContext => ({
  casterId: "owner", targetId: "enemy", freshCastConfirmed: true,
  fullObservedLifetime: true, observedThroughFrame: 5000, noHitlag: true,
  noReplacement: true, noInterruption: true, allGeneratedHitsConfirmed: true,
  statsStableAcrossHits: true, yoimiyaA1Inactive: true,
  noFischlA4: true, noFischlHexerei: true, noEarlySwapBeforeOz: true, fischlOzTravelFrames: 10,
  skillTalentLevel: 6,
  normalStates: [{ id: "normal", startFrame: 100, endFrame: 221, actorId: "driver", onField: true, animationStartDelayFrames: 0, firstNormalInChain: true }],
  damageEvents: [100, 130, 160, 251].map(frame => ({ id: `damage-${frame}`, frame, actorId: "driver", activeActorId: "driver", tag: "normal", damagePositive: true, targetId: "enemy", inRange: true, strikeType: "other", sourceAbility: "Normal Attack", origin: "external" })),
  sharedState: { includedDamageBonus: 0, targetHpFraction: .4, ownerOnField: false, raidenNonExtraEnergyRecharge: 2 },
  dehyaPrior: { snapshotId: "previous-field", snapshotFrame: -100, remainingLifetimeFrames: 500, remainingCooldownFrames: 0 },
  dehyaPriorSnapshot: { stats: { atk: 1700, hp: 23000, def: 700, em: 0, critRate: .6, critDamage: 1.1 }, characterLevel: 90, ascension: 6, damageBonus: .3, additiveBaseDamage: 0, reactionBonus: 0, source: "explicit prior field", sourceRefs: ["https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/dehya/skill.go"] },
});

describe("one coordinated source batch", () => {
  it("keeps all twelve source protocols canonical through independent hits, JSON and actual final-panel conversion", () => {
    const counts: Record<string, number> = { xingqiu: 7, yelan: 10, thoma: 4, travelerelectro: 5, raiden: 4, yoimiya: 3, albedo: 3, dehya: 3, fischl: 11 };
    expect(coordinatedCastTemplates).toHaveLength(12);
    for (const template of coordinatedCastTemplates) {
      const character = gameDataCatalog.characters.find(row => row.slug === template.characterSlug)!;
      const doc = getCharacterDocuments(character.id, 10).find(row => row.gameContext?.skillId === template.skillId)!;
      expect(doc, template.skillId).toBeDefined();
      doc.scope = "one-cast";
      doc.gameContext!.coordinatedCast = context();
      const prepared = prepareCoordinatedCastDocument(doc);
      expect(prepared.hits, template.skillId).toHaveLength(counts[template.sourceSlug]!);
      const result = calculateDocument(prepared);
      expect(result.blockers, template.skillId).toEqual([]);
      expect(prepared.gameContext!.scopeCoverage).toBe("complete-cast");
      expect(result.hits.every(hit => hit.trace.some(node => node.id === "coordinated.damage-frame"))).toBe(true);
      const repeated = prepareCoordinatedCastDocument(prepared);
      expect(repeated.hits.map(hit => hit.id)).toEqual(prepared.hits.map(hit => hit.id));
      expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(prepared)))).toEqual(result);
      const converted = convertCalculatorToFinalPanel(prepared);
      expect(calculateDocument(converted).blockers, template.skillId).toEqual([]);
      expect(calculateDocument(converted).totals!.expected, template.skillId).toBeCloseTo(result.totals!.expected, 9);
      if (template.sourceSlug === "xingqiu") {
        const changed = structuredClone(converted);
        changed.gameContext!.coordinatedCast!.normalStates![0]!.startFrame++;
        expect(calculateDocument(changed).blockers.some(reason => reason.includes("日程修改后"))).toBe(true);
        // Same generated event retains edits; explicit snapshot edits override the previously prepared copy.
        const edited = structuredClone(prepared), first = edited.hits[0]!;
        if (first.kind !== "ordinary") throw new Error("expected ordinary coordinated hit");
        first.damageBonus = .12;
        expect(prepareCoordinatedCastDocument(edited).hits[0]).toMatchObject({ damageBonus: .12 });
        const saved = structuredClone(context().dehyaPriorSnapshot!);
        edited.gameContext!.coordinatedCast!.snapshots = { [first.coordinatedEvent!.snapshotId]: saved };
        const snapshotted = prepareCoordinatedCastDocument(edited);
        snapshotted.gameContext!.coordinatedCast!.snapshots![first.coordinatedEvent!.snapshotId]!.stats.atk = 2100;
        expect(prepareCoordinatedCastDocument(snapshotted).hits[0]).toMatchObject({ finalSnapshot: { stats: { atk: 2100 } } });
      }
      const single = structuredClone(prepared);
      single.scope = "single-hit";
      single.selectedHitIds = [single.hits.at(-1)!.id];
      delete single.gameContext!.coordinatedCast!.fullObservedLifetime;
      delete single.gameContext!.coordinatedCast!.normalStates;
      delete single.gameContext!.coordinatedCast!.damageEvents;
      expect(calculateDocument(single).blockers, `${template.skillId} selected independent hit`).toEqual([]);
    }
  });

  it("distinguishes source cooldown entry from ticker, exact expiry, queued tails and unknown eligibility", () => {
    const c = context();
    c.normalStates = [{ id: "first", startFrame: 100, endFrame: 120, actorId: "driver", onField: true, animationStartDelayFrames: 0 }, { id: "next", startFrame: 160, endFrame: 281, actorId: "driver", onField: true, animationStartDelayFrames: 0 }];
    const sameBoundary = compileSchedule("coordinated-xingqiu-burst-c0", c);
    expect(sameBoundary.decisions.some(row => row.frame === 160 && !row.accepted)).toBe(true);
    // Once the first ticker stops at160 outside a state, later entry161 is eligible.
    c.normalStates[1]!.startFrame = 161;
    expect(compileSchedule("coordinated-xingqiu-burst-c0", c).instances.filter(row => row.templateRole === "proc").map(row => row.frame)).toEqual([120, 120, 181, 181, 181, 241, 241]);
    const oz = compileSchedule("coordinated-fischl-burst-c0", context());
    expect(oz.instances.filter(row => row.templateRole === "proc")).toHaveLength(10);
    expect(oz.requiredObservedThroughFrame).toBe(723);
    c.damageEvents = [{ id: "unknown", frame: 100, actorId: "driver", activeActorId: "driver", tag: "normal", targetId: "enemy", origin: "external" }];
    expect(compileSchedule("coordinated-raiden-skill-c0", c).complete).toBe(false);
    expect(compileSchedule("coordinated-aether-electro-burst-c0", c).complete).toBe(true);
  });
});
