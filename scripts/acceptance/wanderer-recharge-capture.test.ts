/** Explicit, single-run acceptance harness; excluded from the ordinary unit suite. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInThisContext } from "node:vm";
import { expect, it } from "vitest";
import { createSourceHostFormulaResolver } from "../../packages/sim-core/src/source-host-formula";
import { createSourceHostResult } from "../../packages/sim-core/src/source-host-capture";
import { buildSourceDamageCurve, curveSeries } from "../../apps/web/src/source-damage-curve";

const pin = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const wasmHash = "3e5fc685e2743552b4be8f14533f75794092d88b7236166e0ac38103bed5a53e";
const sha = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");

it("captures one fixed-team 7200-frame run through the real Classic formula callbacks", async () => {
  const inputPath = process.env.GIDPS_RECHARGE_REQUEST;
  const outputPath = process.env.GIDPS_RECHARGE_OUTPUT;
  if (!inputPath || !outputPath) throw Error("Set GIDPS_RECHARGE_REQUEST and a new GIDPS_RECHARGE_OUTPUT directory.");
  const out = resolve(outputPath);
  mkdirSync(out, { recursive: true });
  const write = (name: string, value: unknown) => writeFileSync(resolve(out, name), JSON.stringify(value), { flag: "wx" });
  // A prior attempt, including a failed or uncertain attempt, must be inspected first.
  write("runner-start.json", { startedAt: new Date().toISOString(), pid: process.pid, inputPath: resolve(inputPath) });
  const inputBytes = readFileSync(inputPath);
  const request = JSON.parse(inputBytes.toString());
  expect(request.protocol).toBe("gidps-source-host-v1");
  expect(request.executionMode).toBe("auto-wait");
  expect(request.stopAtDuration).toBe(true);
  expect(request.initialEnergy).toEqual({ mode: "full" });
  expect(request.config).toContain("duration=120");
  for (const line of [
    "wanderer char lvl=100/100 cons=6 talent=10,10,10;",
    'wanderer add weapon="tulaytullahsremembrance" refine=5 lvl=90/90;',
    "faruzan char lvl=90/90 cons=6 talent=10,10,10;",
    'faruzan add weapon="favoniuswarbow" refine=5 lvl=90/90;',
    "nicole char lvl=90/90 cons=2 talent=10,10,10;",
    'nicole add weapon="angelosheptades" refine=1 lvl=90/90;',
    "durin char lvl=90/90 cons=2 talent=10,10,10;",
    'durin add weapon="athameartis" refine=1 lvl=90/90;',
  ]) expect(request.config).toContain(line);
  expect(request.seed).toMatch(/^\d+$/);
  writeFileSync(resolve(out, "run.request.json"), inputBytes, { flag: "wx" });
  writeFileSync(resolve(out, "run.gcsl"), request.config, { flag: "wx" });

  const host = resolve("apps/web/public/source-host");
  const bytes = readFileSync(resolve(host, "source-host.wasm"));
  expect(sha(bytes)).toBe(wasmHash);
  const manifest = JSON.parse(readFileSync(resolve(host, "manifest.json"), "utf8"));
  expect(manifest.artifacts.find((a: { path: string }) => a.path === "source-host.wasm").sha256).toBe(wasmHash);
  runInThisContext(readFileSync(resolve(host, "wasm_exec.js"), "utf8"));
  const go = new (globalThis as unknown as { Go: new () => { importObject: WebAssembly.Imports; run(instance: WebAssembly.Instance): Promise<void> } }).Go();
  const module = await WebAssembly.instantiate(bytes, go.importObject);
  void go.run(module.instance);
  const resolver = createSourceHostFormulaResolver();
  const nativeStart = performance.now();
  const raw = JSON.parse((globalThis as unknown as { gidpsSourceHostRun(input: string, callback: (request: string) => string): string })
    .gidpsSourceHostRun(JSON.stringify(request), resolver.resolve));
  const nativeMs = performance.now() - nativeStart;
  write("run.native.json", raw);
  expect(raw.error).toBeUndefined();
  const validationStart = performance.now();
  const result = createSourceHostResult(raw, resolver.calculations);
  result.executionArtifact = { wasmSha256: wasmHash, wasmBytes: bytes.length };
  const validationMs = performance.now() - validationStart;
  expect(result.sourceCommit).toBe(pin);
  expect(result.seed).toBe(request.seed);
  expect(result.config).toBe(request.config);
  expect(result.observationWindow).toMatchObject({ configuredEndFrame: 7200, actualEndFrame: 7200, endReason: "duration" });
  expect(new Set(result.applications.map(hit => hit.id)).size).toBe(result.applications.length);
  write("run.result.json", result);
  const curve = buildSourceDamageCurve(result);
  const series = curveSeries(curve);
  const included = result.applications.filter(hit => hit.frame >= 0 && hit.frame < 7200);
  const total = included.reduce((sum, hit) => sum + hit.appliedDamage, 0);
  expect(series.total).toBe(total);
  expect(series.points).toHaveLength(120);
  expect(Math.abs(series.breakdown.actor.reduce((sum, row) => sum + row.damage, 0) - total)).toBeLessThan(1e-6);
  expect(new Set(curve.hits.map(hit => hit.actor))).toEqual(new Set(["wanderer", "faruzan", "nicole", "durin"]));
  write("run.curve.json", { model: curve, series });
  const summary = {
    seed: result.seed, sourceCommit: pin, wasmSha256: wasmHash,
    window: "[0,7200)", totalDamage: total, dps: total / 120,
    hits: included.length, calculations: result.calculations.length,
    actors: series.breakdown.actor, sources: series.breakdown.source,
    phaseFrames: result.phaseObservations?.map(phase => phase.frame),
    qDecisions: result.logs.filter(log => log.msg.startsWith("audit-q|")),
    outsideWindowHits: result.applications.length - included.length,
    explanationStatus: result.explanationStatus, explanationNoticeCount: result.explanationGaps.length,
    timing: { nativeAndSharedCallbacksMs: nativeMs, resultValidationMs: validationMs, scope: "Node acceptance harness; excludes browser UI, loading and rendering" },
  };
  write("run.summary.json", summary);
  write("run.complete.json", {
    endedAt: new Date().toISOString(), inputSha256: sha(inputBytes),
    files: ["run.request.json", "run.gcsl", "run.native.json", "run.result.json", "run.curve.json", "run.summary.json"]
      .map(name => { const data = readFileSync(resolve(out, name)); return { name, bytes: data.length, sha256: sha(data) }; }),
  });
  console.log(JSON.stringify({ out, seed: result.seed, total, dps: total / 120, hits: included.length, nativeMs, validationMs }));
}, 180_000);
