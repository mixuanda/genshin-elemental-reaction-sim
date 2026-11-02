import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";
import { beforeAll, expect, it } from "vitest";
import { createSourceHostFormulaResolver } from "../../sim-core/src/source-host-formula";
import { resolveSourceNoelleBurstParameters } from "../../sim-core/src/source-noelle-burst-policy";

const host = process.env.GIDPS_HOST_PUBLIC ?? fileURLToPath(new URL("../../../apps/web/public/source-host", import.meta.url));
const evidence = process.env.GIDPS_EVIDENCE_DIR;
let revision: string;
let wasmSha256: string;

beforeAll(async () => {
  const manifest = JSON.parse(readFileSync(resolve(host, "manifest.json"), "utf8"));
  revision = manifest.source.revision;
  const bytes = readFileSync(resolve(host, "source-host.wasm"));
  wasmSha256 = createHash("sha256").update(bytes).digest("hex");
  expect((manifest.artifacts ?? manifest.files).find((file: { path: string }) => file.path === "source-host.wasm")?.sha256).toBe(wasmSha256);
  runInThisContext(readFileSync(resolve(host, "wasm_exec.js"), "utf8"));
  const go = new (globalThis as any).Go();
  const instance = await WebAssembly.instantiate(bytes, go.importObject);
  void go.run(instance.instance);
});

// Independently read pinned catalog values, not a product formula/derived panel.
const baseAtk = 16.0272 * 8.349 + 57.34638 + 23.245;
const nonExtraDef = (66.95325 * 8.349 + 239.5575) * 1.3;
const burstAtk = baseAtk + nonExtraDef * (0.85 + 0.5); // Q10 + C5 = Q13; C6 DEF conversion.
const physicalN1 = baseAtk * 1.564 * 0.5 * 0.9;
const geoN1 = burstAtk * 1.564 * 0.5 * 0.9;

function run(label: string, { extend, wait = 1000, continuous = false }: { extend?: number; wait?: number; continuous?: boolean }) {
  const config = `options iteration=1 duration=${continuous ? 120 : 24};
noelle char lvl=90/90 cons=6 talent=10,10,10;
noelle add weapon="wastergreatsword" refine=1 lvl=1/20;
noelle add stats cr=-0.05;
target lvl=90 resist=0.1 radius=2 pos=0,2.4 hp=1000000000;
active noelle;
noelle burst${extend === undefined ? "" : `[extend=${extend}]`};
${continuous ? "while 1 { noelle attack:4; }" : `wait(${wait});\nnoelle attack;\nwait(1000);`}
`;
  const resolver = createSourceHostFormulaResolver();
  const native = JSON.parse((globalThis as any).gidpsSourceHostRun(JSON.stringify({ protocol: "gidps-source-host-v1", config, seed: "20261023", initialEnergy: { mode: "full" }, executionMode: "auto-wait", stopAtDuration: true }), resolver.resolve));
  if (evidence) writeFileSync(resolve(evidence, `${revision.slice(0, 7)}-${label}.native.json`), JSON.stringify(native));
  expect(native.error).toBeUndefined();
  expect(native.sourceCommit).toBe(revision);
  expect(native.applications.length).toBeGreaterThan(2);
  expect(native.applications.every((application: any) => application.hpAfter > 0)).toBe(true);
  expect(native.logs.some((row: any) => row.msg === "character swap")).toBe(false);
  const damage = native.calculations.filter((row: any) => row.request.kind === "damage");
  const normal = damage.filter((row: any) => row.request.ability.startsWith("Normal "));
  return { native, damage, normal };
}

function defaultExtension() {
  return resolveSourceNoelleBurstParameters({ sourceRevision: revision, characterKey: "noelle", constellation: 6, actionKind: "burst" }).parameters.extend!;
}

it("reproduces the omitted-parameter ten-second assumption and removes it only from ordinary compilation", () => {
  const legacy = run("omitted-legacy", {});
  const explicit = run("explicit-ten", { extend: 10 });
  const corrected = run("ordinary-zero", { extend: defaultExtension() });
  for (const [index, expiry] of [981, 994].entries()) {
    const old = structuredClone(legacy.damage[index]);
    const current = corrected.damage[index];
    const oldStep = old.request.snapshot.statProvenance.snapshotRead.steps[0];
    const currentStep = current.request.snapshot.statProvenance.snapshotRead.steps[0];
    expect(oldStep).toMatchObject({ key: "noelle-burst", expiryBefore: expiry + 10 * 60, expiryAfter: expiry + 10 * 60 });
    expect(currentStep).toMatchObject({ key: "noelle-burst", expiryBefore: expiry, expiryAfter: expiry });
    // Only the explicitly changed extension lifetime may differ; every other
    // input, snapshot component, coefficient, draw and damage remains exact.
    oldStep.expiryBefore = expiry;
    oldStep.expiryAfter = expiry;
    expect(old).toEqual(current);
  }
  expect(legacy.normal[0].request.frame).toBe(1135);
  expect(legacy.normal[0].request.element).toBe("geo");
  expect(legacy.normal[0].request.input.scalingValue).toBeCloseTo(burstAtk, 10);
  expect(legacy.normal[0].value).toBeCloseTo(geoN1, 10);
  expect(explicit.normal[0]).toEqual(legacy.normal[0]);
  expect(corrected.normal[0].request.frame).toBe(1135);
  expect(corrected.normal[0].request.element).toBe("physical");
  expect(corrected.normal[0].request.input.scalingValue).toBeCloseTo(baseAtk, 10);
  expect(corrected.normal[0].value).toBeCloseTo(physicalN1, 10);
});

it.each([{ wait: 871, frame: 1006, active: true }, { wait: 872, frame: 1007, active: false }, { wait: 873, frame: 1008, active: false }])("uses the true hitlag-extended expiry at frame $frame", ({ wait, frame, active }) => {
  const result = run(`boundary-${frame}`, { extend: defaultExtension(), wait });
  const normal = result.normal[0];
  const changes = result.native.logs.filter((row: any) => row.logs?.key === "noelle-burst" && row.frame < frame);
  // Q starts at F1: 900 + 80 frames, then two actual 13-frame hitlags.
  expect(changes.map((row: any) => row.logs.expiry)).toEqual([981, 994, 1007]);
  expect(normal.request.frame).toBe(frame);
  expect(normal.request.element).toBe(active ? "geo" : "physical");
  expect(normal.request.input.scalingValue).toBeCloseTo(active ? burstAtk : baseAtk, 10);
  expect(normal.value).toBeCloseTo(active ? geoN1 : physicalN1, 10);
});

it.skipIf(process.env.GIDPS_NOELLE_120 !== "1")("runs one legal 120-second no-kill sequence with ordinary zero extension and no energy bypass", () => {
  const { native, normal } = run("ordinary-120", { extend: defaultExtension(), continuous: true });
  expect(native.observationWindow).toMatchObject({ configuredEndFrame: 7200, actualEndFrame: 7200, endReason: "duration" });
  const drains = native.energyApplications.filter((row: any) => row.operation === "consume");
  expect(drains).toHaveLength(1);
  expect(drains[0]).toMatchObject({ energyBefore: 60, energyAfter: 0, requestedAmount: 60 });
  expect(normal.some((row: any) => row.request.element === "geo")).toBe(true);
  expect(normal.some((row: any) => row.request.element === "physical")).toBe(true);
  let expiry = 981;
  for (const row of native.logs.filter((row: any) => row.logs?.key === "noelle-burst" && row.msg === "mod extended")) {
    expect(row.frame).toBeLessThan(expiry);
    expect(row.logs.expiry).toBe(expiry + row.logs.amt);
    expiry += row.logs.amt;
  }
  for (const row of normal) {
    const active = row.request.frame < expiry;
    expect(row.request.element).toBe(active ? "geo" : "physical");
    expect(row.request.input.scalingValue).toBeCloseTo(active ? burstAtk : baseAtk, 10);
  }
  const expectedMultipliers = [1.564, 1.4501, 1.7051, 2.2423];
  let expectedTotal = 0;
  for (const row of native.calculations.filter((row: any) => row.request.kind === "damage")) {
    const request = row.request;
    const multiplier = request.ability === "Sweeping Time (Burst)" ? 1.428 : request.ability === "Sweeping Time (Skill)" ? 1.972 : expectedMultipliers[Number(request.ability.split(" ")[1])];
    const atk = request.ability.startsWith("Sweeping Time") || request.frame < expiry ? burstAtk : baseAtk;
    const expectedDamage = atk * multiplier! * 0.5 * 0.9;
    expect(row.value).toBeCloseTo(expectedDamage, 9);
    expectedTotal += expectedDamage;
  }
  const applied = native.applications.reduce((sum: number, row: any) => sum + row.rawDamage, 0);
  expect(applied).toBeCloseTo(expectedTotal, 8);
  if (evidence) writeFileSync(resolve(evidence, `${revision.slice(0, 7)}-ordinary-120-summary.json`), JSON.stringify({ sourceRevision: revision, wasmSha256, expiry, hits: native.applications.length, normalHits: normal.length, initialEnergy: native.initialEnergy, consumption: drains, expectedTotal, applied, observationWindow: native.observationWindow }, null, 2));
});
