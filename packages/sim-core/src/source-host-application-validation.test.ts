import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createSourceHostApplicationValidationLookup } from "./source-host-application-validation";
import { createSourceHostValidationLookup, resolveSourceHostRequest } from "./source-host-formula";
import { verifySourceHostEnergyApplication } from "./source-host-energy-capture";
import { verifySourceHostHealingApplication } from "./source-host-healing-capture";
import type { SourceHostResult } from "./source-host-wire";

const read = (name: string): SourceHostResult => JSON.parse(readFileSync(new URL(`../../../docs/validation/${name}`, import.meta.url), "utf8"));
const fixtures = [
  "action-opportunities-classic-xingqiu-20260929.capture.json",
  "action-opportunities-stellar-xingqiu-20260929.capture.json",
  "source-character-overrides-classic-healing-20260928.result.json",
  "source-character-overrides-stellar-healing-20260928.result.json",
  "source-healing-sources-stellar-scene2-20260928.result.json",
];

for (const name of fixtures) it(`retains exact energy/healing values and complete explanations for ${name}`, () => {
  const result = read(name), records = new Map(result.calculations.map(row => [row.request.id, row]));
  const full = createSourceHostValidationLookup(records);
  const focused = createSourceHostApplicationValidationLookup(records, result.energyApplications ?? [], result.healingApplications ?? []);
  expect(focused.size).toBeLessThan(full.size);
  for (const app of result.energyApplications ?? []) {
    verifySourceHostEnergyApplication(app, full);
    verifySourceHostEnergyApplication(app, focused);
  }
  for (const app of result.healingApplications ?? []) {
    verifySourceHostHealingApplication(app, full);
    verifySourceHostHealingApplication(app, focused);
  }
  // A separate all-record snapshot is the reference. The new index may only
  // remove unused rows, never change a used value, dependency or trace node.
  for (const [id, row] of focused) {
    expect(row).toEqual(full.get(id));
    expect(resolveSourceHostRequest(row.request, focused)).toEqual(resolveSourceHostRequest(full.get(id)!.request, full));
  }
});

it("rejects a missing dependency and mismatched particle ownership, order and amount", () => {
  const result = read(fixtures[0]!);
  const app = result.energyApplications!.find(app => app.amountCalculationId !== undefined)!;
  const missing = new Map(result.calculations.map(row => [row.request.id, row]));
  missing.delete(app.amountCalculationId!);
  expect(() => createSourceHostApplicationValidationLookup(missing, [app], [])).toThrow(/缺少公式/);
  for (const change of ["owner", "order", "amount"]) {
    const records = new Map(structuredClone(result.calculations).map(row => [row.request.id, row]));
    const row = records.get(app.amountCalculationId!)!;
    if (change === "owner") row.request.actorKey += "-other";
    if (change === "order") row.request.frame++;
    if (change === "amount") row.value++;
    const focused = createSourceHostApplicationValidationLookup(records, [app], []);
    expect(() => verifySourceHostEnergyApplication(app, focused)).toThrow();
  }
});

it("isolates nested passthrough metadata and does not freeze or memoize a mutable caller record", () => {
  const result = read(fixtures[0]!), records = new Map(result.calculations.map(row => [row.request.id, row]));
  const app = result.energyApplications![0]!, raw = records.get(app.calculationId)!;
  const metadata = { state: { value: 1 }, ordered: [1, 2] };
  Object.assign(raw.request, { captureMetadata: metadata });
  const focused = createSourceHostApplicationValidationLookup(records, [app], []);
  const owned = focused.get(app.calculationId)!;
  const expected = resolveSourceHostRequest(owned.request, focused);
  metadata.state.value = 2; metadata.ordered.reverse();
  expect((owned.request as typeof owned.request & { captureMetadata: unknown }).captureMetadata).toEqual({ state: { value: 1 }, ordered: [1, 2] });
  expect(Object.isFrozen(metadata)).toBe(false);
  expect(resolveSourceHostRequest(owned.request, focused)).toBe(expected);
  expect(() => verifySourceHostEnergyApplication({ ...app, frame: app.frame + 1 }, focused)).toThrow();
});
