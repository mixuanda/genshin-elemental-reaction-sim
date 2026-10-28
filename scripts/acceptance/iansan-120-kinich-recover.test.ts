/** Offline completion of the one captured candidate after the callback-array stringify limit. */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { createSourceHostResult } from "../../packages/sim-core/src/source-host-capture";
import { resolveSourceHostRequest } from "../../packages/sim-core/src/source-host-formula";
import { iansanFileIdentity, writeIansanFormulaRecords } from "./iansan-120-kinich-records";

const nativeSha = "ccc8679e75e433bc7d9570ab94151b104a4434762b57e72508073773da6bb99e";
const requestSha = "e9a3524c097cf110faad849a444680d27a032d633299a27f07bd0faa0cbb1413";
const sha = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");

it("closes the immutable candidate native response without invoking an engine", async () => {
  const output = process.env.GIDPS_IANSAN_120_RECOVER;
  if (!output) throw Error("Set the retained GIDPS_IANSAN_120_RECOVER directory.");
  const path = (name: string) => resolve(output, name);
  const write = (name: string, value: unknown) => writeFileSync(path(name), JSON.stringify(value), { flag: "wx" });
  const original = readFileSync(path("run.native.json"));
  expect(sha(original)).toBe(nativeSha);
  expect(sha(readFileSync(path("run.request.json")))).toBe(requestSha);
  const raw = JSON.parse(original.toString());
  expect(raw.error).toBeUndefined();
  expect(raw.observationWindow).toMatchObject({ actualEndFrame: 7200, configuredEndFrame: 7200, endReason: "duration" });
  const lock = JSON.parse(readFileSync(path("run.source-lock.json"), "utf8"));
  expect(sha(readFileSync(path("run.build-manifest.json")))).toBe(lock.buildManifestSha256);
  const result = createSourceHostResult(raw); // all formulas replay, no Go/WASM call
  result.executionArtifact = { wasmSha256: lock.wasmSha256, wasmBytes: lock.wasmBytes };
  write("run.result.json", result);
  const calculations = new Map(result.calculations.map(row => [row.request.id, row]));
  const hits = result.applications.filter(hit => hit.frame >= 0 && hit.frame < 7200);
  const perActor: Record<string, number> = {};
  for (const hit of hits) {
    const actor = calculations.get(hit.calculationId)!.request.actorKey;
    perActor[actor] = (perActor[actor] ?? 0) + hit.appliedDamage;
  }
  const totalDamage = hits.reduce((sum, hit) => sum + hit.appliedDamage, 0);
  write("run.summary.json", { sourceRevision: result.sourceCommit, wasmSha256: lock.wasmSha256, seed: result.seed,
    candidateId: "iansan-kaeya-favonius-recharge-20261023", window: "[0,7200)", hits: hits.length, totalDamage,
    dps: totalDamage / 120, perActor, energyWrites: result.energyApplications?.length,
    phaseFrames: result.phaseObservations?.map(row => row.frame), qDecisions: result.logs.filter(log => log.msg.startsWith("audit-q|")),
    explanationStatus: result.explanationStatus, explanationNoticeCount: result.explanationGaps.length,
    completion: "Actual native completed once; result finalized through offline formula replay after callback-array stringify exceeded V8 string limit." });
  // Stream individual replayed records; never allocate the >V8-limit aggregate JSON array.
  function* records() {
    const previous = new Map();
    for (const row of raw.calculations) {
      const replay = resolveSourceHostRequest(row.request, previous);
      expect(replay.value).toBe(row.value);
      yield { traceOrigin: "offline-same-native-request-replay", nativeCalculationId: row.request.id, ...replay };
      previous.set(row.request.id, row);
    }
  }
  writeIansanFormulaRecords(path("run.formula-replay.ndjson"), records());
  write("run.recovery.json", { nativeExecutionCount: 1, originalNativeSha256: nativeSha,
    originalFailure: "RangeError: Invalid string length while JSON.stringify(resolver.calculations), after native was fully saved",
    originalFailureLog: "../legal-recharge-native-run.log", traceOrigin: "offline-same-native-request-replay",
    traceFormat: "NDJSON, stream one formula record at a time; do not JSON.parse the complete file",
    nativeAndCallbacksTiming: "Unavailable: original serializer failed before saving the timing record", recoveredAt: new Date().toISOString() });
  expect(sha(readFileSync(path("run.native.json")))).toBe(nativeSha);
  const names = readdirSync(output).filter(name => name !== "run.complete.json").sort();
  const files = [];
  for (const name of names) files.push({ name, ...await iansanFileIdentity(path(name)) });
  write("run.complete.json", { endedAt: new Date().toISOString(), inputSha256: requestSha, completionMode: "offline-after-saved-native", files });
  console.log(JSON.stringify({ output, totalDamage, dps: totalDamage / 120, hits: hits.length, finalizedWithoutNative: true }));
}, 180_000);
