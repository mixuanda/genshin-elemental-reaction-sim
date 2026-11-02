import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { assertIansanCandidatePolicy, verifyIansanRechargeCandidate } from "./iansan-120-kinich-candidate";
import { iansanFileIdentity, writeIansanFormulaRecords } from "./iansan-120-kinich-records";

const baselineBytes = readFileSync("scripts/acceptance/iansan-120-kinich.request.json");
const directory = process.env.GIDPS_IANSAN_120_CANDIDATE_DIRECTORY ?? "docs/audits";
const candidatePath = resolve(directory, "iansan-kaeya-recharge-20261023.request.json");
const baseline = JSON.parse(baselineBytes.toString());
const candidate = JSON.parse(readFileSync(candidatePath, "utf8"));
const contract = JSON.parse(readFileSync("scripts/acceptance/iansan-120-kinich.recharge.json", "utf8"));

it("revalidates the exact candidate legal pieces, sourced panel and real artifact-only export without native", () => {
  const host = process.env.GIDPS_IANSAN_120_HOST;
  if (!host) throw Error("Set the pinned GIDPS_IANSAN_120_HOST for immutable inventory metadata.");
  const result = verifyIansanRechargeCandidate(candidatePath, host, baselineBytes);
  expect(result.preflight.legalBuildsResolved).toBe(2);
  expect(result.preflight.actualExportMatched).toBe(true);
});

it.each([
  ["seed", (value: any) => { value.seed = "20261024"; }],
  ["startup", (value: any) => { value.initialEnergy = { mode: "zero" }; }],
  ["action", (value: any) => { value.config = value.config.replace("iansan charge;", "iansan attack;"); }],
  ["target", (value: any) => { value.config = value.config.replace("resist=0.1", "resist=0"); }],
])("rejects a candidate changing %s instead of only equipment", (_name, mutate: any) => {
  const changed = structuredClone(candidate);
  mutate(changed);
  expect(() => assertIansanCandidatePolicy(baseline, changed, contract.nonEquipmentConfigSha256)).toThrow(/non-equipment/);
});

it("streams trace records with byte hashes and preserves the no-overwrite guard", async () => {
  const directory = mkdtempSync(resolve(tmpdir(), "iansan-trace-records-"));
  const path = resolve(directory, "trace.ndjson");
  const rows = [{ id: 1, label: "实际\n回执" }, { id: 2, value: 4186.376507110156 }];
  try {
    writeIansanFormulaRecords(path, (function* () { yield* rows; })());
    const bytes = readFileSync(path);
    expect(bytes.toString().trimEnd().split("\n").map(line => JSON.parse(line))).toEqual(rows);
    expect(await iansanFileIdentity(path)).toEqual({ bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex") });
    expect(() => writeIansanFormulaRecords(path, rows)).toThrow(/EEXIST/);
    expect(readFileSync(path)).toEqual(bytes);
  } finally { rmSync(directory, { recursive: true }); }
});
