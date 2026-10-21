import { expect, it } from "vitest";
import { batchPartitions, batchSeed, batchStatistics } from "./batch-statistics";
it("retains sample dispersion and distinguishes quantiles from mean uncertainty", () => {
  const stats = batchStatistics([1, 2, 3, 4, 5]);
  expect(stats.meanDamage).toBe(3);
  expect(stats.sampleStandardDeviation).toBe(Math.sqrt(2.5));
  expect(stats.spreadPercentiles).toEqual({ p05: 1.2, p50: 3, p95: 4.8 });
  expect(stats.meanConfidenceInterval).toBeNull();
  expect(batchStatistics(Array(1000).fill(7)).meanConfidenceInterval).toMatchObject({ low: 7, high: 7 });
  expect(() => batchStatistics([NaN])).toThrow();
});
it.each([1, 2, 4])("partitions 10000 independent indexed seeds with %s workers", threads => {
  const partitions = batchPartitions(10000, threads);
  const seeds = partitions.flatMap(part => Array.from({ length: part.count }, (_, i) => batchSeed("audit", part.start + i, 10000)));
  expect(seeds).toEqual(Array.from({ length: 10000 }, (_, i) => `audit:iteration:${i}`));
  expect(new Set(seeds).size).toBe(10000);
  expect(batchSeed("audit", 0, 1)).toBe("audit");
});
it("caps resources and rejects invalid requests", () => {
  for (const threads of [0, 5, 1.5]) expect(() => batchPartitions(1000, threads)).toThrow();
  for (const count of [0, 10001, 1.5]) expect(() => batchPartitions(count, 1)).toThrow();
});
