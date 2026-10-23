import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createSourceHostFormulaResolver } from "./source-host-formula";
import type { SourceHostResult } from "./source-host-wire";

it("opt-in phase timing retains every formula value and complete explanation", () => {
  const capture = JSON.parse(readFileSync(new URL("../../../docs/validation/action-opportunities-classic-xingqiu-20260929.capture.json", import.meta.url), "utf8")) as SourceHostResult;
  const ordinary = createSourceHostFormulaResolver(), profiled = createSourceHostFormulaResolver({ profile: true });
  let chars = 0;
  for (const row of capture.calculations) {
    const text = JSON.stringify(row.request); chars += text.length;
    expect(profiled.resolve(text)).toBe(ordinary.resolve(text));
  }
  expect(profiled.calculations).toEqual(ordinary.calculations);
  expect(ordinary.profile).toBeUndefined();
  expect(profiled.profile!.calls).toBe(capture.calculations.length);
  expect(profiled.profile!.requestChars).toBe(chars);
  expect(profiled.profile!.traceNodeReferences).toBe(profiled.calculations.reduce((sum, row) => sum + row.trace.length, 0));
  expect(Object.values(profiled.profile!.byKind).reduce((sum, row) => sum + row.calls, 0)).toBe(capture.calculations.length);
  for (const key of ["parseMs", "calculateMs", "captureMs", "responseMs", "totalMs"] as const)
    expect(Number.isFinite(profiled.profile![key]) && profiled.profile![key] >= 0).toBe(true);
  expect(JSON.parse(profiled.resolve("not json")).error).toBeTruthy();
  expect(profiled.profile!.byKind.error!.calls).toBe(1);
});
