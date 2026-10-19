import { expect, it } from "vitest";
import { createSourceHostBatchJobs } from "../../../apps/web/src/source-host-batch";
import { createSourceHostStartupJobs } from "../../../apps/web/src/source-host-startup-analysis";
import { assertDistinctSourceHostStreams, assertSourceHostRandomness, sourceHostSeedIdentity, summarizeSourceHostRandomness,
  SOURCE_HOST_RNG_ALGORITHM, SOURCE_HOST_SEED_NORMALIZATION, type SourceHostRandomness } from "./source-host-randomness";

it("matches pinned Go signed-cast, modulo and zero substitution without Number precision loss", () => {
  expect(sourceHostSeedIdentity("0")).toEqual({ seed: "0", signedSeed: "0", effectiveSeed: "89482311" });
  expect(sourceHostSeedIdentity("9223372036854775808")).toEqual({ seed: "9223372036854775808", signedSeed: "-9223372036854775808", effectiveSeed: "2147483645" });
  expect(sourceHostSeedIdentity("18446744073709551615")).toEqual({ seed: "18446744073709551615", signedSeed: "-1", effectiveSeed: "2147483646" });
  expect(() => sourceHostSeedIdentity("18446744073709551616")).toThrow(/uint64/);
});

it("rejects aliased initialized streams in new jobs and imported sample summaries", () => {
  for (const seeds of [["1", "2147483648"], ["0", "89482311"], ["1", "9223372036854775807"]]) {
    expect(() => assertDistinctSourceHostStreams(seeds)).toThrow(/同一来源随机流/);
    expect(() => summarizeSourceHostRandomness(seeds.map(seed => ({ seed })))).toThrow(/独立样本/);
  }
  const request = { protocol: "gidps-source-host-v1" as const, config: "source script", seed: "1" };
  expect(() => createSourceHostBatchJobs(request, "1,2147483648", "0", "")).toThrow(/同一来源随机流/);
  expect(() => createSourceHostStartupJobs(request, "0,89482311")).toThrow(/同一来源随机流/);
  expect(createSourceHostStartupJobs(request, "1,2")).toHaveLength(4);
  expect(summarizeSourceHostRandomness([{ seed: "1" }, { seed: "2" }])).toMatchObject({ sampleCount: 2, nativeReceiptCount: 0 });
});

it("retains native policy identity and rejects a receipt whose signed/effective seed was changed", () => {
  const receipt: SourceHostRandomness = { schemaVersion: "source-host-randomness-v1", algorithm: SOURCE_HOST_RNG_ALGORITHM,
    seedNormalization: SOURCE_HOST_SEED_NORMALIZATION, ...sourceHostSeedIdentity("1"), critPolicy: "native-seeded",
    criticalTriggeredEffects: "native-sampled", otherRng: "native-sampled", goVersion: "go1.25.0" };
  expect(() => assertSourceHostRandomness(receipt, "1")).not.toThrow();
  expect(() => assertSourceHostRandomness({ ...receipt, effectiveSeed: "2" }, "1")).toThrow(/初始化规则/);
  expect(summarizeSourceHostRandomness([{ seed: "1", randomness: receipt }])).toMatchObject({ nativeReceiptCount: 1, goVersions: ["go1.25.0"] });
});
