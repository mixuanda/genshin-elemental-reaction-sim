/** Stable iteration-order reduction; quantiles describe runs, CI describes the mean. */
export function batchStatistics(values: readonly number[]) {
  if (!values.length || values.some(value => !Number.isFinite(value))) throw new Error("批量结果必须包含有限数值。");
  const meanDamage = values.reduce((sum, value) => sum + value, 0) / values.length;
  const sampleStandardDeviation = values.length > 1
    ? Math.sqrt(values.reduce((sum, value) => sum + (value - meanDamage) ** 2, 0) / (values.length - 1)) : 0;
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => {
    const position = (sorted.length - 1) * p, low = Math.floor(position), high = Math.ceil(position);
    return sorted[low]! + (sorted[high]! - sorted[low]!) * (position - low);
  };
  const half = 1.96 * sampleStandardDeviation / Math.sqrt(values.length);
  return { meanDamage, sampleStandardDeviation,
    spreadPercentiles: { p05: percentile(.05), p50: percentile(.5), p95: percentile(.95) },
    meanConfidenceInterval: values.length >= 30
      ? { method: "normal-approximation-95" as const, low: meanDamage - half, high: meanDamage + half } : null };
}
export function batchSeed(seed: string, index: number, total: number): string {
  return total === 1 ? seed : `${seed}:iteration:${index}`;
}
export function batchPartitions(iterations: number, concurrency: number) {
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 10000) throw new RangeError("迭代次数必须是 1 至 10000 的整数。");
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new RangeError("并行线程数须为 1 至 4。");
  const count = Math.min(concurrency, iterations);
  return Array.from({ length: count }, (_, i) => {
    const start = Math.floor(i * iterations / count), end = Math.floor((i + 1) * iterations / count);
    return { start, count: end - start };
  });
}
