import { stripTypeScriptTypes } from "node:module";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { ANGULAR_GEOMETRY_SEMANTICS } from "@genshin-dps-lab/reaction-formulas";
import { deterministicSin, deterministicCos, deterministicAtan2 } from "../../../packages/reaction-formulas/src/deterministic-angular";
import { captureSpecialSimulation, runSpecialSimulation, parseSpecialSimulation, simulate, captureSimulationHit, parseSimulationHit, type SpecialSimulationRequest, type CapturedSpecialSimulation } from "@genshin-dps-lab/sim-core";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import { SeededRandom } from "../../../packages/sim-core/src/energy";
import { lunarBloomConfig, lunarBloomDeclaration, lunarBloomParty } from "../../../packages/sim-core/src/__tests__/special-profile-fixtures";
import { mixedV2Config, mixedV2Declaration, mixedV2Party } from "../../../packages/sim-core/src/__tests__/lunar-mixed-v2.fixture";
import { makeConfig } from "../../../packages/sim-core/src/__tests__/fixtures";
import { revealControl } from "./release-ui-helpers";

async function downloadJson(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent("download");
  await (await revealControl(page.locator(selector))).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8"));
}

test("the actual angular module produces identical binary64 values in Node and Chromium", async ({ page }) => {
  // A blank page loads only this authored module with TypeScript syntax erased.
  // Production-worker behaviour is checked through real captures below and in
  // the original calculator release suite; no test API is added to the app.
  const source = stripTypeScriptTypes(await readFile(new URL("../../../packages/reaction-formulas/src/deterministic-angular.ts", import.meta.url), "utf8"));
  const random = new SeededRandom("portable-angular-cross-runtime");
  const angles = [0, -0, 2.382987774834482, ...Array.from({ length: 256 }, () => (random.next() * 1080 - 540) * Math.PI / 180)];
  for (const center of [-3 * Math.PI, -2 * Math.PI, -Math.PI, -Math.PI / 2, Math.PI / 2, Math.PI, 2 * Math.PI, 3 * Math.PI]) angles.push(center);
  const pairs = angles.map(angle => [angle, 3 * Math.PI - Math.abs(angle)] as [number, number]);
  pairs.push([0, 0], [-0, -0], [0, -0], [-0, 0], [Number.MIN_VALUE, Number.MAX_VALUE], [Number.MAX_VALUE, Number.MIN_VALUE], [Infinity, Infinity], [-Infinity, -Infinity], [NaN, 1]);
  const bits = (value: number): string => { const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value); return view.getBigUint64(0).toString(16); };
  const node = { angles: angles.map(angle => [bits(deterministicSin(angle)), bits(deterministicCos(angle))]), atan2: pairs.map(([y, x]) => bits(deterministicAtan2(y, x))) };
  const browser = await page.evaluate(async ({ source, angles, pairs }) => {
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    try {
      const module = await import(url);
      const bits = (value: number): string => { const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value); return view.getBigUint64(0).toString(16); };
      return { angles: angles.map(angle => [bits(module.deterministicSin(angle)), bits(module.deterministicCos(angle))]), atan2: pairs.map(([y, x]) => bits(module.deterministicAtan2(y, x))) };
    } finally { URL.revokeObjectURL(url); }
  }, { source, angles, pairs });
  expect(browser).toStrictEqual(node);
});

for (const profile of ["lunar-bloom", "lunar-mixed-v2", "lunar-mixed"] as const) {
  test(`Node ${profile} capture replays exactly in Chromium and failed imports preserve it`, async ({ page }) => {
    let request: SpecialSimulationRequest;
    const options = { angularGeometrySemantics: ANGULAR_GEOMETRY_SEMANTICS, compatibilityMode: "legal-frame-v1" as const };
    if (profile === "lunar-bloom") request = { profile, config: lunarBloomConfig(), options, party: lunarBloomParty, abilities: [lunarBloomDeclaration] };
    else if (profile === "lunar-mixed-v2") request = { profile, config: mixedV2Config(), options, party: mixedV2Party, abilities: [mixedV2Declaration] };
    else {
      const config = JSON.parse(await readFile(new URL("../../../docs/fixtures/lunar-mixed-reference.synthetic.json", import.meta.url), "utf8"));
      const expected = JSON.parse(await readFile(new URL("../../../docs/fixtures/lunar-mixed-reference.synthetic.expected.json", import.meta.url), "utf8"));
      request = { profile, config, options, party: expected.options.party };
    }
    const wire = captureSpecialSimulation(request, runSpecialSimulation(request));
    expect(wire.result.baseResult.resolvedRuntimeOptions.angularGeometrySemantics).toBe(ANGULAR_GEOMETRY_SEMANTICS);
    if (profile === "lunar-mixed") expect(wire.result.baseResult.crystallizeShardLog.some(row => row.operation === "spawn")).toBe(true);
    else expect(wire.result.baseResult.dendroCoreLog.some(row => row.operation === "spawn")).toBe(true);
    await page.goto("/results");
    await (await revealControl(page.locator('.tab[data-tab="special"]'))).click();
    const upload = async (value: CapturedSpecialSimulation) => (await revealControl(page.locator("[data-lunar-import]"))).setInputFiles({ name: "authored-portable-geometry.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(value)) });
    await upload(wire);
    await expect(page.locator("[data-lunar-status]")).toContainText("已导入并在相同引擎完整重执行，结果一致");
    const exported = await downloadJson(page, '[data-lunar-action="export"]');
    expect(exported).toStrictEqual(wire);
    expect(parseSpecialSimulation(JSON.stringify(exported))).toStrictEqual(wire);
    // Import must not apply fresh-run defaults to make a different request pass.
    const changed = structuredClone(wire);
    delete changed.request.options.angularGeometrySemantics;
    await upload(changed);
    await expect(page.locator("[data-lunar-status]")).toContainText("导入结果未通过完整重放");
    expect(await downloadJson(page, '[data-lunar-action="export"]')).toStrictEqual(wire);
  });
}

test("actor-local shape capture preserves the angular policy through browser validation and export", async ({ page }) => {
  const config: SimConfig = makeConfig({ duration: 1, cycleLength: 1, rotation: [],
    actorPoses: [{ actorId: "a", position: { x: 10, y: 20 }, facingDegrees: 136.53514212928712 }],
    enemy: { level: 90, resistance: 0.1, defReduction: 0, targets: [{ id: "enemy-0", name: "Synthetic geometry target", position: { x: 10.25, y: 20.5 }, hitboxRadius: 0.1 }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1, abilities: [{ id: "shapes", actorId: "a", name: "Synthetic shape actions", kind: "skill", cancelFrame: 0, animationEndFrame: 3, cooldownFrames: 0, hits: [
      { id: "circle", frame: 0, scaling: 1, geometry: { kind: "circle", coordinateSpace: "actor-local", origin: { x: 1, y: 0 }, radius: 2 } },
      { id: "rectangle", frame: 1, scaling: 1, geometry: { kind: "rectangle", coordinateSpace: "actor-local", origin: { x: 0, y: 0 }, halfWidth: 2, halfHeight: 0.2, rotationDegrees: 37 } },
      { id: "capsule", frame: 2, scaling: 1, geometry: { kind: "capsule", coordinateSpace: "actor-local", start: { x: 0, y: 0 }, end: { x: 2, y: 0 }, radius: 0.2 } },
      { id: "sector", frame: 3, scaling: 1, geometry: { kind: "sector", coordinateSpace: "actor-local", origin: { x: 0, y: 0 }, radius: 2, directionDegrees: -170, angleDegrees: 137 } }
    ] }], commands: [{ type: "skill", actorId: "a", abilityId: "shapes", atFrame: 0 }] }
  });
  const result = simulate(config, { angularGeometrySemantics: ANGULAR_GEOMETRY_SEMANTICS, execution: { captureHits: true } });
  expect(result.hitResolutionLog.map(row => row.geometryKind)).toEqual(["circle", "rectangle", "capsule", "sector"]);
  const wire = captureSimulationHit(result, result.damageEvents[0]!.id);
  await page.goto("/calculator");
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({ name: "authored-angular-shapes.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(wire)) });
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  const exported = await downloadJson(page, '[data-action="export"]');
  expect(exported).toStrictEqual(wire);
  expect(parseSimulationHit(JSON.stringify(exported)).sourceResult.hitResolutionLog).toEqual(result.hitResolutionLog);
});
