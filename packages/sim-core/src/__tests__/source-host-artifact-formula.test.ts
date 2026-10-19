import { describe, expect, it } from "vitest";
import { resolveSourceHostArtifactScalarInput } from "../source-host-artifact-formula";
import { resolveSourceHostRequest } from "../source-host-formula";
import { captureSourceHostHit, deriveSourceHostArtifactScalarEdit, replaySourceHostHit } from "../source-host-capture";
import { SOURCE_HOST_COMMIT, SOURCE_HOST_FORMULA_VERSION, SOURCE_HOST_PROTOCOL, SOURCE_HOST_RESULT_VERSION,
  sourceHostArtifactScalarRequestSchema, sourceHostDamageRequestSchema } from "../source-host-wire";

const cases = [
  [{ ruleId: "mh-2pc" }, .15], [{ ruleId: "mh-4pc", stacks: 3 }, .36],
  [{ ruleId: "gt-2pc" }, .2], [{ ruleId: "gt-4pc", tier: 2 }, .5],
  [{ ruleId: "hod-2pc" }, .15], [{ ruleId: "hod-4pc" }, .3],
  [{ ruleId: "nd-2pc" }, .15], [{ ruleId: "nd-4pc-atk", stacks: 3 }, .25],
  [{ ruleId: "nd-4pc-hydro", stacks: 2 }, .09],
  [{ ruleId: "pf-2pc" }, .25], [{ ruleId: "pf-4pc-atk", stacks: 2 }, .18],
  [{ ruleId: "pf-4pc-physical", stacks: 2 }, .25],
  [{ ruleId: "cw-2pc" }, .15], [{ ruleId: "cw-4pc-pyro", stacks: 3 }, .225],
  [{ ruleId: "cw-4pc-reaction", branch: "transformative" }, .4],
  [{ ruleId: "vg-2pc" }, .2], [{ ruleId: "vg-4pc-base" }, .1], [{ ruleId: "vg-4pc-stack" }, .08],
] as const;

describe("source-owned artifact arithmetic", () => {
  it("executes seven sets through the same AST, then captures an actual support reference separately from damage components", () => {
    for (const [input, expected] of cases) {
      const calculated = resolveSourceHostArtifactScalarInput(input, SOURCE_HOST_COMMIT);
      expect(calculated.value).toBeCloseTo(expected, 12);
      expect(calculated.trace.at(-1)?.result?.value).toBe(calculated.value);
    }
    const base = Array(26).fill(0) as number[];
    base[24] = 100;
    const after = [...base];
    after[21] = .2;
    const supportRequest = sourceHostArtifactScalarRequestSchema.parse({
      protocol: SOURCE_HOST_PROTOCOL, sourceCommit: SOURCE_HOST_COMMIT, id: 1, kind: "artifact-scalar",
      frame: 0, actorIndex: 0, actorKey: "test", ability: "set", attackTag: 0, attackTagName: "none",
      element: "physical", sourceFrame: 0, snapshotFrame: 0, attackId: 0, targetKey: 1,
      componentIds: [], componentApplications: [], damageCategory: "artifact-scalar",
      snapshot: null, snapshotStats: null, rawAttack: {}, input: { ruleId: "gt-2pc" },
    });
    const request = sourceHostDamageRequestSchema.parse({
      protocol: SOURCE_HOST_PROTOCOL, sourceCommit: SOURCE_HOST_COMMIT, id: 2, kind: "damage",
      frame: 0, actorIndex: 0, actorKey: "test", ability: "skill", attackTag: 0, attackTagName: "skill",
      element: "physical", sourceFrame: 0, snapshotFrame: 0, attackId: 1, targetKey: 1,
      componentIds: [], componentApplications: [], damageCategory: "ordinary", rawAttack: {},
      snapshotStats: after, snapshot: {
        charLevel: 90, baseAtk: 100, atkPct: 0, flatAtk: 0, baseHp: 1000, hpPct: 0, flatHp: 0,
        baseDef: 100, defPct: 0, flatDef: 0, em: 0, critRate: 0, critDamage: 0,
        statProvenance: { version: "stat-provenance-v1", snapshotRead: null, attackReads: [{
          id: "actor-0-read-1", kind: "attack-mods", frame: 0, actorIndex: 0, selector: [], nonExtra: false,
          base, steps: [{ index: 0, key: "troupe-2pc", expiryBefore: -1, expiryAfter: -1,
            affectedStat: 0, extra: false, affectedByHitlag: false, outcome: "applied",
            before: base, afterAmount: base, returned: after.map((value, i) => value - base[i]!), after,
            attackChanges: [], dependencies: [], formulaCalculationIds: [1] }], result: after,
        }], finalStats: after },
      },
      input: { scalingStat: "atk", scalingValue: 100, scaling: 1, baseDamageBonus: 0,
        flatDamage: 0, damageBonus: .2, characterLevel: 90, enemyLevel: 90,
        defenseAdjustment: 0, defenseIgnore: 0, effectiveResistance: 0,
        critRate: 0, critDamage: 0, isCrit: false, critRoll: .5, hitWeakPoint: false,
        elementalMastery: 0, amped: false, amplifyingMultiplier: 1,
        amplifyingReaction: "none", reactionBonus: 0, groupMultiplier: 1, elevation: 0 },
    });
    const support = { request: supportRequest, value: .2 };
    const original = resolveSourceHostRequest(request, new Map([[1, support]]));
    const native = { protocol: SOURCE_HOST_PROTOCOL, sourceCommit: SOURCE_HOST_COMMIT, config: "test", seed: "1",
      calculations: [support, { request, value: original.value }],
      applications: [{ id: 1, calculationId: 2, attackId: 1, frame: 0, targetKey: 1,
        damageMode: false, rawDamage: original.value, appliedDamage: original.value,
        hpBefore: 1000, hpAfter: 1000 - original.value, isCrit: false }],
      result: {}, logs: [], capabilities: { checkpoint: false },
      schemaVersion: SOURCE_HOST_RESULT_VERSION, formulaVersion: SOURCE_HOST_FORMULA_VERSION,
      verification: "provisional", explanationStatus: "partial", explanationGaps: [],
    };
    const capture = captureSourceHostHit(native, 1);
    expect(capture.components).toHaveLength(0);
    expect(capture.supportingCalculations?.map(row => row.request.id)).toEqual([1]);
    expect(replaySourceHostHit(capture).difference).toBe(0);
    const edited = deriveSourceHostArtifactScalarEdit(capture, 1, { ruleId: "gt-2pc" });
    expect(edited.status).toBe("calculated");
    const tampered = structuredClone(capture);
    tampered.supportingCalculations![0]!.value = .25;
    expect(() => replaySourceHostHit(tampered)).toThrow();
  });
});
