/** Explicit short native capture; never part of the ordinary unit test suite. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInThisContext } from "node:vm";
import { expect, it } from "vitest";
import { createSourceHostFormulaResolver } from "../../packages/sim-core/src/source-host-formula";
import { createSourceHostResult } from "../../packages/sim-core/src/source-host-capture";
import { buildSourceDamageCurve, curveSeries } from "../../apps/web/src/source-damage-curve";

const pins = {
  classic: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
  stellar: "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
};
const sha = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");

it("captures one explicit 1440-frame fixed-team C2 scope comparison", async () => {
  const mode = process.env.GIDPS_C2_MODE;
  const expectedHash = process.env.GIDPS_C2_WASM_SHA256;
  const hostInput = process.env.GIDPS_C2_HOST_DIR;
  const outInput = process.env.GIDPS_C2_OUTPUT;
  if ((mode !== "classic" && mode !== "stellar") || !expectedHash?.match(/^[a-f0-9]{64}$/) || !hostInput || !outInput) {
    throw Error("Set explicit GIDPS_C2_MODE, GIDPS_C2_WASM_SHA256, GIDPS_C2_HOST_DIR and a new GIDPS_C2_OUTPUT directory.");
  }
  const out = resolve(outInput);
  mkdirSync(out, { recursive: true });
  const write = (name: string, value: unknown) => writeFileSync(resolve(out, name), JSON.stringify(value), { flag: "wx" });
  write("runner-start.json", { startedAt: new Date().toISOString(), pid: process.pid, mode, expectedHash, host: resolve(hostInput) });
  const config = readFileSync("scripts/fixtures/wanderer-c2-crossmode.gcsl", "utf8");
  const request = {
    protocol: "gidps-source-host-v1", config, seed: "20261022",
    executionMode: "auto-wait", stopAtDuration: true, initialEnergy: { mode: "full" },
    phaseObservation: { warmupFrames: 0, maxPeriod: 4, requiredConsecutivePeriods: 3, maxObservations: 32 },
  };
  expect(config).toContain("duration=24 ");
  write("run.request.json", request);
  writeFileSync(resolve(out, "run.gcsl"), config, { flag: "wx" });
  const host = resolve(hostInput);
  const bytes = readFileSync(resolve(host, "source-host.wasm"));
  const manifestBytes = readFileSync(resolve(host, "manifest.json"));
  const manifest = JSON.parse(manifestBytes.toString());
  const records: { path: string; sha256: string }[] = mode === "classic" ? manifest.artifacts : manifest.files;
  expect(sha(bytes)).toBe(expectedHash);
  expect(records.find(row => row.path === "source-host.wasm")?.sha256).toBe(expectedHash);
  expect(manifest.source.revision).toBe(pins[mode]);
  const runtime = readFileSync(resolve(host, "wasm_exec.js"));
  expect(sha(runtime)).toBe(records.find(row => row.path === "wasm_exec.js")?.sha256);
  writeFileSync(resolve(out, "build.manifest.json"), manifestBytes, { flag: "wx" });
  runInThisContext(runtime.toString());
  const go = new (globalThis as unknown as { Go: new () => { importObject: WebAssembly.Imports; run(instance: WebAssembly.Instance): Promise<void> } }).Go();
  const wasm = await WebAssembly.instantiate(bytes, go.importObject);
  void go.run(wasm.instance);
  const resolver = createSourceHostFormulaResolver();
  const start = performance.now();
  const raw = JSON.parse((globalThis as unknown as { gidpsSourceHostRun(input: string, callback: (input: string) => string): string })
    .gidpsSourceHostRun(JSON.stringify(request), resolver.resolve));
  const nativeMs = performance.now() - start;
  write("run.native.json", raw);
  expect(raw.error).toBeUndefined();
  const validationStart = performance.now();
  const result = createSourceHostResult(raw, resolver.calculations);
  result.executionArtifact = { wasmSha256: expectedHash, wasmBytes: bytes.length };
  const validationMs = performance.now() - validationStart;
  expect(result.sourceCommit).toBe(pins[mode]);
  expect(result.seed).toBe(request.seed);
  expect(result.config).toBe(config);
  expect(result.observationWindow).toMatchObject({ configuredEndFrame: 1440, actualEndFrame: 1440, endReason: "duration" });
  expect(result.applications.every(hit => Number.isInteger(hit.frame) && hit.frame >= 0 && hit.frame < 1440)).toBe(true);
  expect(new Set(result.applications.map(hit => hit.id)).size).toBe(result.applications.length);
  const curve = buildSourceDamageCurve(result);
  const series = curveSeries(curve);
  const total = result.applications.reduce((sum, hit) => sum + hit.appliedDamage, 0);
  expect(series.points).toHaveLength(24);
  expect(series.total).toBe(total);
  expect(Math.abs(series.breakdown.actor.reduce((sum, row) => sum + row.damage, 0) - total)).toBeLessThan(1e-6);
  expect(new Set(curve.hits.map(hit => hit.actor))).toEqual(new Set(["wanderer", "faruzan", "nicole", "durin"]));
  write("run.result.json", result);
  write("run.curve.json", { model: curve, series });
  const summary = {
    mode, sourceCommit: result.sourceCommit, wasmSha256: expectedHash,
    seed: result.seed, window: "[0,1440)", totalDamage: total,
    // This is a short regression capture, not a new 120-second team estimate.
    hits: result.applications.length, actors: series.breakdown.actor,
    timing: { nativeAndSharedCallbacksMs: nativeMs, resultValidationMs: validationMs, scope: "Node capture, not browser latency" },
  };
  write("run.summary.json", summary);
  write("run.complete.json", {
    endedAt: new Date().toISOString(),
    files: ["build.manifest.json", "run.request.json", "run.gcsl", "run.native.json", "run.result.json", "run.curve.json", "run.summary.json"]
      .map(name => { const data = readFileSync(resolve(out, name)); return { name, bytes: data.length, sha256: sha(data) }; }),
  });
  console.log(JSON.stringify({ out, ...summary }));
}, 120_000);
