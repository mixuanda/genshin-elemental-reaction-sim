import { z } from "zod";

/** Pinned Go math/rand rngSource.Seed after the source host's uint64 -> int64 cast. */
export const SOURCE_HOST_RNG_ALGORITHM = "go-math-rand-rngSource-v1" as const;
export const SOURCE_HOST_SEED_NORMALIZATION = "uint64-int64-mod2147483647-zero89482311-v1" as const;

export function sourceHostSeedIdentity(seed: string): { seed: string; signedSeed: string; effectiveSeed: string } {
  if (!/^\d+$/.test(seed) || BigInt(seed) > 18446744073709551615n) {
    throw new Error("来源随机种子须为 uint64 十进制整数。");
  }
  const signed = BigInt.asIntN(64, BigInt(seed));
  let effective = signed % 2147483647n;
  if (effective < 0n) effective += 2147483647n;
  if (effective === 0n) effective = 89482311n;
  return { seed, signedSeed: signed.toString(), effectiveSeed: effective.toString() };
}

export const sourceHostRandomnessSchema = z.object({
  schemaVersion: z.literal("source-host-randomness-v1"),
  algorithm: z.literal(SOURCE_HOST_RNG_ALGORITHM),
  seedNormalization: z.literal(SOURCE_HOST_SEED_NORMALIZATION),
  seed: z.string(), signedSeed: z.string(), effectiveSeed: z.string(),
  critPolicy: z.literal("native-seeded"),
  criticalTriggeredEffects: z.literal("native-sampled"),
  otherRng: z.literal("native-sampled"),
  goVersion: z.string().min(1),
}).strict();
export type SourceHostRandomness = z.infer<typeof sourceHostRandomnessSchema>;

export function assertSourceHostRandomness(receipt: SourceHostRandomness | undefined, seed: string): void {
  if (!receipt) return; // Old captures retain their absence of an emitted policy.
  const identity = sourceHostSeedIdentity(seed);
  if (receipt.seed !== seed || receipt.signedSeed !== identity.signedSeed || receipt.effectiveSeed !== identity.effectiveSeed) {
    throw new Error("来源 RNG 回执与实际种子或固定算法的初始化规则不一致。");
  }
}

/** Distinct integer strings can initialize the exact same rngSource stream. */
export function assertDistinctSourceHostStreams(seeds: readonly string[]): ReturnType<typeof sourceHostSeedIdentity>[] {
  const seen = new Map<string, string>();
  return seeds.map(seed => {
    const identity = sourceHostSeedIdentity(seed);
    const prior = seen.get(identity.effectiveSeed);
    if (prior !== undefined) throw new Error(`种子 ${prior} 与 ${seed} 映射到同一来源随机流（${identity.effectiveSeed}），不能作为两个独立样本。请更换种子。`);
    seen.set(identity.effectiveSeed, seed);
    return identity;
  });
}

export function summarizeSourceHostRandomness(runs: readonly { seed: string; randomness?: SourceHostRandomness | undefined }[]) {
  for (const run of runs) assertSourceHostRandomness(run.randomness, run.seed);
  return {
    algorithm: SOURCE_HOST_RNG_ALGORITHM,
    seedNormalization: SOURCE_HOST_SEED_NORMALIZATION,
    sampleCount: runs.length,
    streams: assertDistinctSourceHostStreams(runs.map(run => run.seed)),
    nativeReceiptCount: runs.filter(run => run.randomness !== undefined).length,
    goVersions: [...new Set(runs.flatMap(run => run.randomness ? [run.randomness.goVersion] : []))],
    criticalTriggeredEffects: "native-sampled" as const,
    qualification: "Distinct initialized streams, not a mathematical proof of independent outputs. Startup pairs share initialization but may consume draws differently.",
  };
}
