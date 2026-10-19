import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { captureSourceHostHit, replaySourceHostHit } from "../source-host-capture";
import { sourceHostArtifactScalarInputSchema, resolveSourceHostArtifactScalarInput } from "../source-host-artifact-formula";
import { verifySourceHostArtifactSupport } from "../source-host-artifact-support";
import { sourceHostStatProvenanceSchema } from "../source-host-stat-provenance";
import { SOURCE_HOST_COMMIT, sourceHostArtifactScalarRequestSchema,
  sourceHostDamageRequestSchema, sourceHostResultSchema } from "../source-host-wire";
import { resolveSourceHostRequest } from "../source-host-formula";

describe("source-host fixed artifact Amount formulas", () => {
  it("keeps EM units and recipient identity while capturing two synthetic pre-hit stat modifiers", () => {
    const eighty = resolveSourceHostArtifactScalarInput({ ruleId: "const-instructor-2pc-em" }, SOURCE_HOST_COMMIT);
    const oneTwenty = resolveSourceHostArtifactScalarInput({ ruleId: "const-instructor-4pc-em" }, SOURCE_HOST_COMMIT);
    expect([eighty.value, oneTwenty.value]).toEqual([80, 120]);
    for (const [formula, title] of [[eighty, "教官两件"], [oneTwenty, "教官四件"]] as const) {
      expect(formula.trace.at(-1)?.result?.unit).toBe("EM");
      expect(formula.trace.at(-1)?.titleKey).toContain(title);
      expect(formula.trace.at(-1)?.sourceRefs).toContain(
        `https://github.com/genshinsim/gcsim/blob/${SOURCE_HOST_COMMIT}/internal/artifacts/instructor/instructor.go`);
    }
    expect(() => sourceHostArtifactScalarInputSchema.parse({ ruleId: "const-instructor-4pc-em", stacks: 1 }))
      .toThrow();

    // The saved hit and its original read are native. The two extra modifier
    // steps below are a derived fixture, not a claim that this run equipped
    // Instructor and Exile or triggered their buffs.
    const observed = sourceHostResultSchema.parse(JSON.parse(readFileSync(new URL(
      "../../../../docs/validation/source-team-builder-20260927.result.json", import.meta.url), "utf8")));
    const nativeHit = observed.calculations.find(row => row.request.kind === "damage"
      && row.request.snapshot.statProvenance !== undefined);
    if (nativeHit?.request.kind !== "damage") throw new Error("Saved native hit with stat read is missing");
    const nativeApplication = observed.applications.find(row => row.calculationId === nativeHit.request.id);
    if (!nativeApplication) throw new Error("Saved native application is missing");
    expect([nativeHit.request.actorIndex, nativeHit.request.actorKey]).toEqual([1, "bennett"]);
    const provenance = sourceHostStatProvenanceSchema.parse(nativeHit.request.snapshot.statProvenance);
    const read = provenance.attackReads.at(-1);
    if (!read) throw new Error("Saved native attack stat read is missing");
    expect(read.id).toBe("actor-1-read-37");
    const originalSteps = read.steps.length;

    const fixture = [
      { id: 41, ruleId: "const-instructor-4pc-em", key: "instructor-4pc", slot: 8, value: 120 },
      { id: 42, ruleId: "const-exile-2pc-er", key: "exile-2pc", slot: 7, value: .2 },
    ] as const;
    const support = fixture.map(({ id, ruleId }) => {
      const request = sourceHostArtifactScalarRequestSchema.parse({
        protocol: observed.protocol, sourceCommit: observed.sourceCommit, id,
        kind: "artifact-scalar", damageCategory: "artifact-scalar",
        frame: read.frame, actorIndex: read.actorIndex,
        // A party buff receipt belongs to the actual receiving actor, Bennett.
        actorKey: nativeHit.request.actorKey, ability: `derived-test-${ruleId}`,
        attackTag: nativeHit.request.attackTag, attackTagName: nativeHit.request.attackTagName,
        element: nativeHit.request.element, sourceFrame: nativeHit.request.sourceFrame,
        snapshotFrame: nativeHit.request.snapshotFrame, attackId: nativeHit.request.attackId,
        targetKey: nativeHit.request.targetKey, componentIds: [], componentApplications: [],
        snapshot: null, snapshotStats: null, rawAttack: {}, input: { ruleId },
      });
      return { request, value: resolveSourceHostRequest(request).value };
    });
    for (const { id, key, slot, value } of fixture) {
      const before = [...read.result];
      const returned = Array(26).fill(0) as number[];
      returned[slot] = value;
      const after = [...before];
      after[slot] = after[slot]! + value;
      read.steps.push({ index: read.steps.length, key, expiryBefore: -1, expiryAfter: -1,
        affectedStat: 0, extra: false, affectedByHitlag: false, outcome: "applied",
        before, afterAmount: before, returned, after, attackChanges: [], dependencies: [],
        formulaCalculationIds: [id] });
      read.result = after;
    }
    expect(read.steps.length - originalSteps).toBe(2);
    provenance.finalStats = [...read.result];
    const request = sourceHostDamageRequestSchema.parse({
      ...structuredClone(nativeHit.request), id: 43,
      sourceCommit: observed.sourceCommit,
      snapshotStats: [...read.result],
      snapshot: { ...nativeHit.request.snapshot, em: read.result[8], statProvenance: provenance },
      input: { ...nativeHit.request.input, elementalMastery: read.result[8] },
    });
    const lookup = new Map<number, (typeof support)[number]>(support.map(row => [row.request.id, row] as const));
    const links = verifySourceHostArtifactSupport(request, lookup);
    expect(links.get(`${read.id}/${originalSteps}/8`)).toBe("artifactScalar.41.const-instructor-4pc-em");
    expect(links.get(`${read.id}/${originalSteps + 1}/7`)).toBe("artifactScalar.42.const-exile-2pc-er");
    const wrongReceiver = new Map(lookup);
    wrongReceiver.set(41, { ...support[0]!, request: { ...support[0]!.request, actorIndex: 0 } });
    expect(() => verifySourceHostArtifactSupport(request, wrongReceiver)).toThrow(/角色/);
    const calculation = resolveSourceHostRequest(request, lookup);
    expect(calculation.trace.some(node => node.id === "artifactScalar.41.const-instructor-4pc-em")).toBe(true);
    const emAddition = calculation.trace.find(node => node.id.includes(`${read.id}.modifier.${originalSteps}.add.8.`));
    expect(emAddition?.inputs.find(input => input.key === "delta")?.origin).toEqual({
      kind: "source-host-artifact-scalar", reference: "artifactScalar.41.const-instructor-4pc-em",
    });

    const application = { ...nativeApplication, calculationId: request.id,
      rawDamage: calculation.value, appliedDamage: calculation.value,
      hpAfter: nativeApplication.hpBefore - Math.min(calculation.value, nativeApplication.hpBefore) };
    const derived = sourceHostResultSchema.parse({
      protocol: observed.protocol, sourceCommit: observed.sourceCommit,
      config: "synthetic two-modifier fixture derived from saved native hit", seed: observed.seed,
      calculations: [...support, { request, value: calculation.value }], applications: [application],
      result: {}, logs: [], capabilities: { checkpoint: false },
      schemaVersion: observed.schemaVersion, formulaVersion: observed.formulaVersion,
      verification: "provisional", explanationStatus: "partial", explanationGaps: [],
    });
    const capture = captureSourceHostHit(derived, application.id);
    expect(capture.supportingCalculations?.map(row => row.request.id)).toEqual([41, 42]);
    expect(capture.components).toHaveLength(0);
    expect(replaySourceHostHit(capture).difference).toBe(0);
  });
});
