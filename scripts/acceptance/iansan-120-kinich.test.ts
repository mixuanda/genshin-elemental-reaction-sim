/** One explicitly requested real run. Never included in the ordinary unit suite. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInThisContext } from "node:vm";
import { expect, it } from "vitest";
import { createSourceHostFormulaResolver } from "../../packages/sim-core/src/source-host-formula";
import { createSourceHostResult } from "../../packages/sim-core/src/source-host-capture";
import { verifyIansanRechargeCandidate } from "./iansan-120-kinich-candidate";
import { iansanFileIdentity, writeIansanFormulaRecords } from "./iansan-120-kinich-records";

const prefix = "scripts/acceptance/iansan-120-kinich";
const sha = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");

it("captures one source-locked, full-once Iansan C6 / Kaeya 7200-frame rotation", async () => {
  if (!process.env.GIDPS_IANSAN_120_OUTPUT || !process.env.GIDPS_IANSAN_120_HOST) {
    throw Error("Set an explicit host and fresh GIDPS_IANSAN_120_OUTPUT. Inspect any prior attempt before retrying.");
  }
  const output = resolve(process.env.GIDPS_IANSAN_120_OUTPUT);
  mkdirSync(output, { recursive: true });
  const write = (name: string, value: unknown) => writeFileSync(resolve(output, name), JSON.stringify(value), { flag: "wx" });
  // A failed or uncertain attempt is retained too; this is not an overwriteable cache.
  write("runner-start.json", { startedAt: new Date().toISOString(), pid: process.pid, singleNativeRun: true });
  const lockBytes = readFileSync(`${prefix}.source.json`);
  const lock = JSON.parse(lockBytes.toString());
  const baselineBytes = readFileSync(`${prefix}.request.json`);
  expect(sha(baselineBytes)).toBe(lock.requestSha256);
  const host = resolve(process.env.GIDPS_IANSAN_120_HOST);
  const candidate = process.env.GIDPS_IANSAN_120_CANDIDATE_REQUEST
    ? verifyIansanRechargeCandidate(process.env.GIDPS_IANSAN_120_CANDIDATE_REQUEST, host, baselineBytes) : undefined;
  const requestBytes = candidate?.requestBytes ?? baselineBytes;
  const request = JSON.parse(requestBytes.toString());
  expect(sha(requestBytes)).toBe(candidate?.contract.files["request.json"].sha256 ?? lock.requestSha256);
  expect(request).toMatchObject({ protocol: "gidps-source-host-v1", seed: "20261023", stopAtDuration: true,
    executionMode: "auto-wait", initialEnergy: { mode: "full" } });
  expect(request.config).toContain("options iteration=1 duration=120;");
  // The baseline's original stats/set ban remains intact. The only alternative
  // is a fixed legal five-piece export, not arbitrary externally supplied stats.
  if (!candidate) expect(request.config).not.toMatch(/add stats|add set/);
  expect(request.config).not.toMatch(/movement\s*=|movement\s*\(|ignore_burst_energy|start_energy/);
  expect(request.config.match(/ char /g)).toHaveLength(2);
  expect(request.config).toContain("iansan char lvl=90/90 cons=6 talent=10,10,10;");
  expect(request.config).toContain("kaeya char lvl=90/90 cons=0 talent=10,10,10;");
  const manifestBytes = readFileSync(resolve(host, "manifest.json"));
  const manifest = JSON.parse(manifestBytes.toString());
  const bytes = readFileSync(resolve(host, "source-host.wasm"));
  const runtime = readFileSync(resolve(host, "wasm_exec.js"));
  expect(lock.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(sha(bytes)).toBe(lock.wasmSha256);
  expect(bytes.length).toBe(lock.wasmBytes);
  expect(sha(manifestBytes)).toBe(lock.buildManifestSha256);
  expect(manifest.source.revision).toBe(lock.revision);
  expect(manifest.source.treeSnapshotSha256).toBe(lock.treeSnapshotSha256);
  for (const [path, data] of [["source-host.wasm", bytes], ["wasm_exec.js", runtime]] as const) {
    expect(manifest.files.find((file: { path: string }) => file.path === path)?.sha256).toBe(sha(data));
  }
  writeFileSync(resolve(output, "run.request.json"), requestBytes, { flag: "wx" });
  writeFileSync(resolve(output, "run.gcsl"), request.config, { flag: "wx" });
  writeFileSync(resolve(output, "run.source-lock.json"), lockBytes, { flag: "wx" });
  writeFileSync(resolve(output, "run.build-manifest.json"), manifestBytes, { flag: "wx" });
  const candidateFiles: string[] = [];
  if (candidate) {
    writeFileSync(resolve(output, "run.candidate-lock.json"), candidate.contractBytes, { flag: "wx" });
    write("run.candidate-preflight.json", candidate.preflight);
    candidateFiles.push("run.candidate-lock.json", "run.candidate-preflight.json");
    for (const file of candidate.files.filter(file => file.suffix !== "request.json")) {
      const name = `run.candidate-${file.suffix}`;
      writeFileSync(resolve(output, name), file.bytes, { flag: "wx" });
      candidateFiles.push(name);
    }
  }
  write("host.json", { host, wasmSha256: sha(bytes), wasmBytes: bytes.length, buildManifestSha256: sha(manifestBytes) });
  runInThisContext(runtime.toString());
  const go = new (globalThis as any).Go();
  const wasm = await WebAssembly.instantiate(bytes, go.importObject);
  void go.run(wasm.instance);
  const resolver = createSourceHostFormulaResolver();
  const start = performance.now();
  const raw = JSON.parse((globalThis as any).gidpsSourceHostRun(JSON.stringify(request), resolver.resolve));
  const nativeMs = performance.now() - start;
  // Write before validation so a validation bug cannot justify another expensive run.
  write("run.native.json", raw);
  writeIansanFormulaRecords(resolve(output, "run.formula-callbacks.ndjson"), resolver.calculations);
  write("run.native-timing.json", { nativeAndSharedCallbacksMs: nativeMs });
  expect(raw.error).toBeUndefined();
  const validationStart = performance.now();
  const result = createSourceHostResult(raw, resolver.calculations);
  const validationMs = performance.now() - validationStart;
  result.executionArtifact = { wasmSha256: lock.wasmSha256, wasmBytes: bytes.length };
  expect(result.sourceCommit).toBe(lock.revision);
  expect(result.seed).toBe(request.seed);
  expect(result.config).toBe(request.config);
  expect(result.observationWindow).toMatchObject({ configuredEndFrame: 7200, actualEndFrame: 7200, endReason: "duration" });
  write("run.result.json", result);
  const hits = result.applications.filter(hit => hit.frame >= 0 && hit.frame < 7200);
  const totalDamage = hits.reduce((sum, hit) => sum + hit.appliedDamage, 0);
  const perActor: Record<string, number> = {};
  const calculations = new Map(result.calculations.map(row => [row.request.id, row]));
  for (const hit of hits) {
    const actor = calculations.get(hit.calculationId)!.request.actorKey;
    perActor[actor] = (perActor[actor] ?? 0) + hit.appliedDamage;
  }
  const summary = { sourceRevision: lock.revision, wasmSha256: lock.wasmSha256, seed: request.seed,
    candidateId: candidate?.contract.candidateId,
    window: "[0,7200)", hits: hits.length, totalDamage, dps: totalDamage / 120, perActor,
    phaseFrames: result.phaseObservations?.map(phase => phase.frame),
    qDecisions: result.logs.filter(log => log.msg.startsWith("audit-q|")),
    energyWrites: result.energyApplications?.length, explanationStatus: result.explanationStatus,
    explanationNoticeCount: result.explanationGaps.length,
    timing: { nativeAndSharedCallbacksMs: nativeMs, resultValidationMs: validationMs },
    limits: candidate ? { ...lock.scenario, artifactPieces: 10, equipment: candidate.preflight,
      gameplayScope: "Declared legal Favonius/five-piece candidate; native owns all character/weapon effects." } : lock.scenario,
  };
  write("run.summary.json", summary);
  const fileNames = ["run.request.json", "run.gcsl", "run.source-lock.json", "run.build-manifest.json", "host.json",
      "run.native.json", "run.formula-callbacks.ndjson", "run.native-timing.json", "run.result.json", "run.summary.json", ...candidateFiles];
  const identities = await Promise.all(fileNames.map(async name => ({ name, ...await iansanFileIdentity(resolve(output, name)) })));
  write("run.complete.json", { endedAt: new Date().toISOString(), inputSha256: sha(requestBytes), files: identities,
  });
  console.log(JSON.stringify({ output, totalDamage, dps: totalDamage / 120, hits: hits.length, nativeMs, validationMs }));
}, 180_000);
