import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { captureSourceHostHit, createSourceHostEditableCalculation,
  calculateSourceHostEditableCalculation, replaySourceHostHit } from "../source-host-capture";
import { resolveSourceHostRequest } from "../source-host-formula";
import { sourceHostStatProvenanceSchema } from "../source-host-stat-provenance";
import { deriveSourceHostWeaponAdditiveEdit } from "../source-host-weapon-capture";
import { resolveSourceHostWeaponAdditiveInput } from "../source-host-weapon-formula";
import { SOURCE_HOST_COMMIT, sourceHostDamageRequestSchema, sourceHostResultSchema,
  sourceHostWeaponAdditiveRequestSchema } from "../source-host-wire";

describe("source-host weapon additive formulas", () => {
  it("evaluates R1/R5, links an observed stat read to a clearly derived hit, and edits only its FlatDmg dependency", () => {
    for (const [ruleId, statValue, r1Coefficient, r5Coefficient] of [
      ["foliar", 200, 1.2, 2.4],
      ["hunterspath", 200, 1.6, 3.2],
      ["cinnabar", 600, .4, .8],
    ] as const) {
      for (const [refinement, coefficient] of [[1, r1Coefficient], [5, r5Coefficient]] as const) {
        const formula = resolveSourceHostWeaponAdditiveInput({ ruleId, refinement, statValue },
          SOURCE_HOST_COMMIT, `test.${ruleId}.${refinement}`);
        expect(formula.value).toBeCloseTo(statValue * coefficient, 12);
        expect(formula.trace.find(node => node.id === `test.${ruleId}.${refinement}.coefficient`)?.result?.value)
          .toBeCloseTo(coefficient, 12);
        const terminal = formula.trace.find(node => node.id === `test.${ruleId}.${refinement}.flatDamage`);
        expect(terminal?.result?.value).toBeCloseTo(statValue * coefficient, 12);
        expect(terminal?.sourceRefs.some(ref => ref.includes(`/internal/weapons/`))).toBe(true);
      }
    }

    // The saved file is a real Go run. Its stat read is genuine, but no weapon
    // additive request in this test is claimed to have occurred in that run.
    const observed = sourceHostResultSchema.parse(JSON.parse(readFileSync(new URL(
      "../../../../docs/validation/source-team-builder-20260927.result.json", import.meta.url), "utf8")));
    const observedHit = observed.calculations.find(row => row.request.kind === "damage"
      && row.request.snapshot.statProvenance !== undefined);
    if (observedHit?.request.kind !== "damage") throw new Error("Saved native hit with stat provenance is missing");
    const actualApplication = observed.applications.find(row => row.calculationId === observedHit.request.id);
    if (!actualApplication) throw new Error("Saved native hit application is missing");
    const provenance = sourceHostStatProvenanceSchema.parse(observedHit.request.snapshot.statProvenance);
    const actualRead = provenance.attackReads.find(row => row.frame === observedHit.request.frame
      && row.actorIndex === observedHit.request.actorIndex);
    if (!actualRead) throw new Error("Saved native stat read is missing");
    expect(actualRead.id).toBe("actor-1-read-37");
    expect(actualRead.result[25]).toBeGreaterThan(0);

    // Derived fixture only: use that observed read as a frozen numeric input,
    // then add a synthetic Cinnabar component and synthetic application.
    const componentId = 0;
    const statValue = actualRead.result[25]! * (1 + actualRead.result[1]!) + actualRead.result[2]!;
    const weaponRequest = sourceHostWeaponAdditiveRequestSchema.parse({
      protocol: observed.protocol, sourceCommit: observed.sourceCommit, id: componentId,
      kind: "weapon-additive", damageCategory: "weapon-additive",
      frame: observedHit.request.frame, actorIndex: observedHit.request.actorIndex,
      actorKey: observedHit.request.actorKey, ability: "derived-test-cinnabar",
      attackTag: observedHit.request.attackTag, attackTagName: observedHit.request.attackTagName,
      element: observedHit.request.element, sourceFrame: observedHit.request.sourceFrame,
      snapshotFrame: observedHit.request.snapshotFrame, attackId: observedHit.request.attackId,
      targetKey: observedHit.request.targetKey, componentIds: [], componentApplications: [],
      snapshot: null, snapshotStats: null, rawAttack: {},
      input: { ruleId: "cinnabar", refinement: 1, statValue },
      statRead: structuredClone(actualRead),
      weaponState: { buffExpiry: observedHit.request.frame + 120, cooldownExpiry: -1 },
    });
    const weapon = resolveSourceHostRequest(weaponRequest);
    const derivedRequest = sourceHostDamageRequestSchema.parse({
      ...structuredClone(observedHit.request),
      componentIds: [componentId],
      componentApplications: [{ id: componentId, multiplier: 1, amount: weapon.value }],
      input: { ...observedHit.request.input,
        flatDamage: observedHit.request.input.flatDamage + weapon.value },
    });
    const derivedDamage = resolveSourceHostRequest(derivedRequest,
      new Map([[componentId, { request: weaponRequest, value: weapon.value }]]));
    const derivedApplication = {
      ...actualApplication, rawDamage: derivedDamage.value, appliedDamage: derivedDamage.value,
      hpAfter: actualApplication.hpBefore - Math.min(derivedDamage.value, actualApplication.hpBefore),
    };
    const derivedRun = sourceHostResultSchema.parse({
      protocol: observed.protocol, sourceCommit: observed.sourceCommit,
      config: "synthetic test receipt derived from a saved native stat read", seed: observed.seed,
      calculations: [{ request: weaponRequest, value: weapon.value },
        { request: derivedRequest, value: derivedDamage.value }],
      applications: [derivedApplication], result: {}, logs: [], capabilities: { checkpoint: false },
      schemaVersion: observed.schemaVersion, formulaVersion: observed.formulaVersion,
      verification: "provisional", explanationStatus: "partial", explanationGaps: [],
    });
    const capture = captureSourceHostHit(derivedRun, derivedApplication.id);
    expect(capture.components.map(row => row.request.id)).toEqual([componentId]);
    expect(replaySourceHostHit(capture).difference).toBe(0);
    expect(derivedDamage.trace.some(node => node.id === `component.${componentId}.weaponAdditive.${componentId}.flatDamage`)).toBe(true);

    const document = createSourceHostEditableCalculation(capture);
    const unchangedDocument = JSON.stringify(document);
    expect(calculateSourceHostEditableCalculation(document).difference).toBe(0);
    const edit = deriveSourceHostWeaponAdditiveEdit(capture, componentId,
      { ruleId: "cinnabar", refinement: 5, statValue });
    expect(edit.status).toBe("calculated");
    if (edit.status !== "calculated") throw new Error(edit.reason);
    if (edit.editedRequest.kind !== "damage") throw new Error("Derived ordinary hit changed kind");
    expect(edit.editedValue - edit.originalValue).toBeCloseTo(statValue * .4, 12);
    expect(edit.editedRequest.input.flatDamage - derivedRequest.input.flatDamage)
      .toBeCloseTo(edit.editedValue - edit.originalValue, 12);
    expect(edit.editedRawDamage).toBeGreaterThan(edit.originalRawDamage);
    expect(JSON.stringify(document)).toBe(unchangedDocument);
    expect(replaySourceHostHit(capture).difference).toBe(0);

    const wrongAttack = sourceHostWeaponAdditiveRequestSchema.parse({
      ...weaponRequest, attackId: weaponRequest.attackId + 1,
    });
    expect(() => resolveSourceHostRequest(derivedRequest,
      new Map([[componentId, { request: wrongAttack, value: weapon.value }]]))).toThrow(/身份/);
  });
});
