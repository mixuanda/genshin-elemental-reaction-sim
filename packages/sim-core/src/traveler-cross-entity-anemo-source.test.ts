import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vitest";
import { TRAVELER_ANEMO_ABSORPTION_EVIDENCE } from "./traveler-cross-entity-anemo-source";

it("keeps the original source archive immutable and verifies each new evidence hash and all15 actual-gender absorption multipliers", () => {
  const evidence = TRAVELER_ANEMO_ABSORPTION_EVIDENCE;
  const archive = readFileSync(new URL("../../game-data/sources/traveler-cross-source-casts/source.json.gz", import.meta.url));
  expect(createHash("sha256").update(archive).digest("hex")).toBe(evidence.archive.sha256);
  const files = (JSON.parse(gunzipSync(archive).toString()) as {files: Record<string, string>}).files;
  for (const file of evidence.files) {
    const raw = Buffer.from(files[file.archiveKey]!);
    expect(raw.length).toBe(file.bytes);
    expect(createHash("sha256").update(raw).digest("hex")).toBe(file.sha256);
    expect(createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${raw.length}\0`), raw])).digest("hex")).toBe(file.gitBlob);
  }
  const stats = JSON.parse(files["optimizer/libs/gi/stats/src/allStat_gen.json"]!).char.skillParam;
  expect(stats.TravelerAnemoM.burst[1]).toEqual(evidence.coefficients.optimizerM);
  expect(stats.TravelerAnemoF.burst[1]).toEqual(evidence.coefficients.optimizerF);
  expect(JSON.parse(files["optimizer/libs/gi/stats/Data/Characters/TravelerAnemoM/skillParam.json"]!).burst[1]).toEqual(evidence.coefficients.optimizerM);
});
