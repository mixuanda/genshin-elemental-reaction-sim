import { describe, expect, it } from "vitest";
import {
  calculateSourceHostEditableCalculation, captureSourceHostHit, createSourceHostEditableCalculation,
  createSourceHostResult, deriveSourceHostCharacterFormulaEdit, replaySourceHostHit,
} from "./source-host-capture";
import { verifySourceHostArtifactSupport } from "./source-host-artifact-support";
import { resolveSourceHostCharacterModifierInput } from "./source-host-character-modifier-formula";
import { resolveSourceHostRequest } from "./source-host-formula";
import { openSourceHostResultArchive } from "./source-host-result-archive";
import { isSourceHostWandererC2ScopeError } from "./source-host-wanderer-c2-scope";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT, SOURCE_HOST_PROTOCOL,
  sourceHostCharacterModifierRequestSchema, sourceHostDamageRequestSchema,
  type SourceHostCalculationRecord, type SourceHostDamageRequest,
} from "./source-host-wire";

const input = (currentPoints = 50) => ({ ruleId: "char-dyn-wanderer-c2" as const,
  modifierKey: "wanderer-c2-burstbonus", sourceHolderIndex: 0, phase: "creation" as const,
  state: { maxPoints: 100, currentPoints } });

/** Synthetic protocol receipts isolate the TS consumer; they are not native
 * observations. The real source keeps five delayed Q snapshots at +55 frames.
 */
function scenario(sourceCommit: typeof SOURCE_HOST_COMMIT | typeof SOURCE_HOST_STELLAR_COMMIT) {
  const base = Array<number>(26).fill(0); base[24] = 1000;
  const returned = Array<number>(26).fill(0); returned[21] = 2;
  const after = base.map((value, index) => value + returned[index]!);
  const support = { request: sourceHostCharacterModifierRequestSchema.parse({
    protocol: SOURCE_HOST_PROTOCOL, sourceCommit, id: 1, kind: "character-modifier",
    frame: 0, actorIndex: 0, actorKey: "wanderer", ability: "character modifier creation",
    attackTag: 0, attackTagName: "AttackTagNone", element: "none", sourceFrame: 0, snapshotFrame: 0,
    attackId: 0, targetKey: 0, componentIds: [], componentApplications: [], damageCategory: "character-modifier",
    snapshot: null, snapshotStats: null, rawAttack: {}, input: input(),
  }), value: 2 };
  const request = sourceHostDamageRequestSchema.parse({
    protocol: SOURCE_HOST_PROTOCOL, sourceCommit, id: 2, kind: "damage",
    frame: 55, actorIndex: 0, actorKey: "wanderer", ability: "Kyougen: Five Ceremonial Plays (Windfavored)",
    attackTag: 6, attackTagName: sourceCommit === SOURCE_HOST_COMMIT ? "AttackTagElementalBurst" : "AttackTag(6)",
    element: "anemo", sourceFrame: 0, snapshotFrame: 55, attackId: 1, targetKey: 1,
    componentIds: [], componentApplications: [], damageCategory: "ordinary", rawAttack: {},
    snapshotStats: after, snapshot: { charLevel: 90, baseAtk: 1000, atkPct: 0, flatAtk: 0,
      baseHp: 10000, hpPct: 0, flatHp: 0, baseDef: 100, defPct: 0, flatDef: 0,
      em: 0, critRate: 0, critDamage: 0,
      statProvenance: { version: "stat-provenance-v1", snapshotRead: {
        id: "actor-0-read-q", kind: "stats", frame: 55, actorIndex: 0, selector: [], nonExtra: false,
        base, steps: [{ index: 0, key: "wanderer-c2-burstbonus", expiryBefore: 145, expiryAfter: 145,
          affectedStat: 0, extra: false, affectedByHitlag: true, outcome: "applied",
          before: base, afterAmount: base, returned, after, attackChanges: [], dependencies: [],
          formulaCalculationIds: [1], creationFormulaCalculationIds: [1] }], result: after,
      }, attackReads: [], finalStats: after },
    },
    input: { scalingStat: "atk", scalingValue: 1000, scaling: 1, baseDamageBonus: 0, flatDamage: 0,
      damageBonus: 2, characterLevel: 90, enemyLevel: 90, defenseAdjustment: 0, defenseIgnore: 0,
      effectiveResistance: 0, critRate: 0, critDamage: 0, isCrit: false, critRoll: 0.5,
      hitWeakPoint: false, elementalMastery: 0, amped: false, amplifyingMultiplier: 1,
      amplifyingReaction: "none", reactionBonus: 0, groupMultiplier: 1, elevation: 0 },
  });
  const records = new Map<number, SourceHostCalculationRecord>([[1, support]]);
  const raw = { protocol: SOURCE_HOST_PROTOCOL, sourceCommit, config: "synthetic C2 consumer only", seed: "1",
    calculations: [support, { request, value: 1500 }],
    applications: [{ id: 1, calculationId: 2, attackId: 1, frame: 55, targetKey: 1,
      damageMode: false, rawDamage: 1500, appliedDamage: 1500, hpBefore: 10000, hpAfter: 8500, isCrit: false }],
    result: {}, logs: [], capabilities: { checkpoint: false } };
  return { support, request, records, raw };
}

const nonBurst = (request: SourceHostDamageRequest) => {
  request.ability = "Shugen: The Curtains’ Melancholic Sway";
  request.attackTag = 1;
  request.attackTagName = request.sourceCommit === SOURCE_HOST_COMMIT ? "AttackTagNormal" : "AttackTag(1)";
};

for (const [lane, sourceCommit] of [["classic", SOURCE_HOST_COMMIT], ["stellar", SOURCE_HOST_STELLAR_COMMIT]] as const) {
  describe(`${lane} shared Wanderer C2 snapshot consumers`, () => {
    it("keeps creation-time points, zero/one/49/50/over-cap boundaries and source identity", () => {
      for (const [points, expected] of [[100, 0], [99, 0.04], [51, 1.96], [50, 2], [49, 2], [0, 2]]) {
        const formula = resolveSourceHostCharacterModifierInput(input(points), sourceCommit);
        expect(formula.value).toBeCloseTo(expected!, 12);
        expect(formula.trace[0]!.sourceRefs[0]).toContain(sourceCommit);
      }
      const { support, request, records } = scenario(sourceCommit);
      expect(resolveSourceHostRequest(support.request).value).toBe(2);
      for (let index = 0; index < 5; index++) {
        const q = structuredClone(request); q.id += index; q.attackId += index;
        expect(resolveSourceHostRequest(q, records).value).toBe(1500); // 1000 * (1+2) * .5 DEF.
      }
    });

    it("links and replays a legitimate delayed Q through import, save/reopen and independent formula editing", () => {
      const { request, records, raw } = scenario(sourceCommit);
      expect(verifySourceHostArtifactSupport(request, records).get("actor-0-read-q/0/21"))
        .toBe("characterModifier.1.char-dyn-wanderer-c2");
      const result = createSourceHostResult(raw);
      const capture = captureSourceHostHit(JSON.parse(JSON.stringify(result)), 1);
      expect(replaySourceHostHit(JSON.parse(JSON.stringify(capture))).difference).toBe(0);
      const editable = createSourceHostEditableCalculation(capture);
      expect(calculateSourceHostEditableCalculation(JSON.parse(JSON.stringify(editable))).value).toBe(1500);
      const experiment = deriveSourceHostCharacterFormulaEdit(capture, 1, input(75));
      expect(experiment).toMatchObject({ originalValue: 2, editedValue: 1, changed: true, scope: "formula-only" });
      expect(replaySourceHostHit(capture).reproducedDamage).toBe(1500);
    });

    it("rejects Q-only C2 copied into a non-Q snapshot instead of verifying its +200% arithmetic", () => {
      for (const [ability, tag] of [["Shugen: The Curtains’ Melancholic Sway", 1],
        ["Normal 2 (Windfavored)", 1], ["Arcane Projection: Unity", 0]] as const) {
        const { request, records, raw } = scenario(sourceCommit);
        nonBurst(request);
        request.ability = ability; request.attackTag = tag;
        request.attackTagName = sourceCommit === SOURCE_HOST_COMMIT
          ? tag === 1 ? "AttackTagNormal" : "AttackTagNone" : `AttackTag(${tag})`;
        expect(() => resolveSourceHostRequest(request, records)).toThrow(/C2|二命/);
        // The same parsed object is shared by this synthetic full-result fixture.
        expect(() => createSourceHostResult(raw)).toThrow(/C2|二命/);
      }
    });

    it("rejects a matching display name with a non-burst tag and a burst name alias with a non-burst numeric tag", () => {
      const { request, records } = scenario(sourceCommit);
      request.attackTag = 1;
      expect(() => resolveSourceHostRequest(request, records)).toThrow(/C2|二命/);
      request.attackTag = 6;
      request.attackTagName = sourceCommit === SOURCE_HOST_COMMIT ? "AttackTagNormal" : "AttackTag(1)";
      expect(() => resolveSourceHostRequest(request, records)).toThrow(/C2|二命/);
    });

    it("rejects another consumer or read actor, preserves creation identity checks and never repairs a saved value", () => {
      const { request, records } = scenario(sourceCommit);
      request.actorKey = "faruzan";
      expect(() => resolveSourceHostRequest(request, records)).toThrow(/C2|二命/);
      request.actorKey = "wanderer"; request.actorIndex = 1;
      expect(() => resolveSourceHostRequest(request, records)).toThrow(/C2|二命/);
      request.actorIndex = 0; request.snapshot.statProvenance!.snapshotRead!.actorIndex = 1;
      expect(() => resolveSourceHostRequest(request, records)).toThrow(/C2|二命/);
      const valid = scenario(sourceCommit);
      valid.request.snapshot.statProvenance!.snapshotRead!.steps[0]!.creationFormulaCalculationIds = [];
      expect(() => resolveSourceHostRequest(valid.request, valid.records)).toThrow(/创建|来源持有者/);
    });

    it("rejects non-damage general Stats consumption while leaving the creation formula itself available", () => {
      const { support, request, records } = scenario(sourceCommit);
      // A creation request alone has no stat consumer. Attaching a past C2
      // contribution to a generic Stats receipt is a separate invalid claim,
      // even when its scalar, holder and earlier creation ID all match.
      expect(resolveSourceHostRequest(support.request).value).toBe(2);
      const consumer = sourceHostCharacterModifierRequestSchema.parse({ ...support.request,
        id: 3, frame: 55, sourceFrame: 55, snapshotFrame: 55,
        statRead: structuredClone(request.snapshot.statProvenance!.snapshotRead!),
      });
      expect(() => verifySourceHostArtifactSupport(consumer, records)).toThrow(/C2|二命/);
      expect(() => resolveSourceHostRequest(consumer, records)).toThrow(/C2|二命/);
    });

    it("opens and exports a known bad saved original without changing identity or claiming current replay passed", () => {
      const { raw } = scenario(sourceCommit);
      const saved = createSourceHostResult(raw);
      const captured = captureSourceHostHit(saved, 1);
      const q = saved.calculations[1]!.request;
      if (q.kind !== "damage") throw Error("Synthetic saved damage required.");
      nonBurst(q);
      if (captured.calculation.request.kind !== "damage") throw Error("Synthetic captured damage required.");
      nonBurst(captured.calculation.request);
      const originalText = ` \n${JSON.stringify(saved, null, 2)}\n`;
      const archive = openSourceHostResultArchive(originalText);
      expect(archive.mode).toBe("readonly-c2-defect");
      expect(archive.currentNumericValidation).toBe("failed");
      expect(archive.originalText).toBe(originalText);
      expect(archive.result).toEqual(saved);
      expect(archive.warning).toContain("不能作为本次验证");
      expect(() => createSourceHostResult(archive.result)).toThrow(/C2|二命/);
      expect(() => captureSourceHostHit(archive.result, 1)).toThrow(/C2|二命/);
      expect(() => replaySourceHostHit(captured)).toThrow(/C2|二命/);
      expect(() => createSourceHostEditableCalculation(captured)).toThrow(/C2|二命/);
      try { createSourceHostResult(archive.result); } catch (error) {
        expect(isSourceHostWandererC2ScopeError(error)).toBe(true);
        if (isSourceHostWandererC2ScopeError(error)) expect(error).toMatchObject({
          creationCalculationId: 1, consumerCalculationId: 2, code: "SOURCE_HOST_WANDERER_C2_SCOPE" });
      }
      const wrapped = `\n${JSON.stringify({ schemaVersion: "source-host-reexecution-record-v1", receipt: { oldClaim: true }, result: saved })}\n`;
      expect(openSourceHostResultArchive(wrapped)).toMatchObject({ originalText: wrapped,
        mode: "readonly-c2-defect", currentNumericValidation: "failed" });
    });

    it("does not turn malformed structure, another integrity failure or an unverified native response into a legacy exception", () => {
      const { raw } = scenario(sourceCommit);
      const saved = createSourceHostResult(raw);
      const good = openSourceHostResultArchive(JSON.stringify(saved));
      expect(good).toMatchObject({ mode: "replayed", currentNumericValidation: "passed", warning: null });
      const numeric = structuredClone(saved); numeric.calculations[1]!.value = 1501;
      expect(() => openSourceHostResultArchive(JSON.stringify(numeric))).toThrow(/无法精确复现/);
      const malformed = JSON.parse(JSON.stringify(saved));
      malformed.calculations[1].request.input.scalingValue = "unknown";
      expect(() => openSourceHostResultArchive(JSON.stringify(malformed))).toThrow();
      expect(() => openSourceHostResultArchive(JSON.stringify(raw))).toThrow();
      expect(isSourceHostWandererC2ScopeError(Error("a different replay error"))).toBe(false);
    });
  });
}
