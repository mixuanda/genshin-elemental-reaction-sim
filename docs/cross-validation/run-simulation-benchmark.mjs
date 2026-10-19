/**
 * Reproduce with: node docs/cross-validation/run-simulation-benchmark.mjs
 * Timings cover simulate() only, including full trace construction/validation.
 * Vite module loading, JSON serialization, replay checks, and report I/O are
 * outside timed intervals. These fixtures contain provisional mechanic data.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../..");
// Preserve the older evidence: do not overwrite its pre-execution-options
// capability statements with a run on the newer engine.
if ((await readFile(path.join(root, "packages/schemas/src/types.ts"), "utf8")).includes("detailedTraces?")) {
  throw new Error("Historical benchmark retired for this engine. Run node docs/cross-validation/run-simulation-execution-benchmark.mjs for actual trace flags and random critical sampling.");
}
const warmupIterations = 3;
const measuredIterations = 30;
const seed = "simulation-benchmark-2026-09-22";
const sourcePaths = [
  "packages/sim-core/src/simulator.ts",
  "packages/sim-core/src/energy.ts",
  "packages/sim-core/src/formulas.ts",
  "packages/sim-core/src/calculator-formula.ts",
  "packages/sim-core/src/calculation-trace.ts",
  "packages/sim-core/src/index.ts",
  "packages/reaction-formulas/src/profile.ts",
  "packages/reaction-formulas/src/special.ts",
  "packages/reaction-formulas/src/index.ts",
  "packages/schemas/src/index.ts",
  "packages/schemas/src/types.ts",
  "packages/game-data/src/presets.ts",
  "package-lock.json"
];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const fingerprints = async () => Object.fromEntries(await Promise.all(
  sourcePaths.map(async (sourcePath) => [sourcePath, hash(await readFile(path.join(root, sourcePath)))])
));
const before = await fingerprints();
const server = await createServer({
  root,
  configFile: false,
  logLevel: "error",
  server: { middlewareMode: true, watch: null, hmr: false },
  ssr: { noExternal: [/^@genshin-dps-lab\//] }
});

function summarizeTimes(durations) {
  const sorted = [...durations].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const total = durations.reduce((sum, value) => sum + value, 0);
  return {
    rawMilliseconds: durations,
    totalMilliseconds: total,
    meanMilliseconds: total / durations.length,
    medianMilliseconds: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    p95Milliseconds: sorted[Math.ceil(0.95 * sorted.length) - 1],
    maxMilliseconds: sorted.at(-1),
    simulationsPerSecond: durations.length * 1000 / total,
    percentileMethod: "nearest-rank-p95; arithmetic-middle-pair-median",
    distributionMeaning: "Wall-clock duration distribution only; not damage spread percentiles or a confidence interval for a mean."
  };
}

function summarizeOutput(result) {
  const counts = Object.fromEntries(Object.entries(result)
    .filter(([, value]) => Array.isArray(value))
    .map(([key, value]) => [key, value.length]));
  return {
    totalDamage: result.totalDamage,
    dps: result.dps,
    reactedHits: result.reactedHits,
    arrayLengths: counts,
    particleCounts: result.particleEvents.map((event) => event.particleCount),
    energyStats: result.energyStats,
    mechanicsStatus: result.mechanicsStatus,
    resultJsonBytes: Buffer.byteLength(JSON.stringify(result)),
    resultSha256: hash(JSON.stringify(result)),
    configHash: result.runManifest.configHash,
    reproducibilityKey: result.reproducibilityKey,
    schemaVersion: result.schemaVersion,
    engineVersion: result.engineVersion,
    dataVersion: result.dataVersion,
    resolvedRuntimeOptions: result.resolvedRuntimeOptions
  };
}

try {
  const { simulate } = await server.ssrLoadModule("/packages/sim-core/src/simulator.ts");
  const { durinMeltPreset, particleEnergyDemoPreset } = await server.ssrLoadModule("/packages/game-data/src/presets.ts");
  const particleConfig = structuredClone(particleEnergyDemoPreset);
  particleConfig.duration = 120;
  particleConfig.cycleLength = 120;
  const scenarios = [
    {
      id: "deterministic-120s-durin-demo",
      config: durinMeltPreset,
      fixedSeed: true,
      workload: "120s existing durinMeltPreset, repeated legacy rotation, identical seed every sample."
    },
    {
      id: "seeded-particle-120s-energy-demo",
      config: particleConfig,
      fixedSeed: false,
      workload: "particleEnergyDemoPreset with duration=120 and cycleLength=120, matching the existing runtime-energy performance fixture. One legal command sequence in a 120s window; not a sustained 120s rotation."
    }
  ];
  const measurements = [];
  for (const scenario of scenarios) {
    const optionsAt = (index) => ({ critMode: "average", randomSeed: scenario.fixedSeed ? seed : `${seed}:iteration:${index}` });
    for (let index = 0; index < warmupIterations; index += 1) simulate(scenario.config, optionsAt(index));
    const durations = [];
    const outputs = [];
    let firstJson;
    for (let index = 0; index < measuredIterations; index += 1) {
      const started = performance.now();
      const result = simulate(scenario.config, optionsAt(index));
      durations.push(performance.now() - started);
      const json = JSON.stringify(result);
      firstJson ??= json;
      if (scenario.fixedSeed) assert.equal(json, firstJson, "Identical deterministic fixture must produce identical complete results");
      assert.equal(result.crystallizeShardLog.length, 0, "These fixtures must not sample shard positions");
      assert.equal(result.dendroCoreLog.length, 0, "These fixtures must not sample Dendro-core positions");
      assert.ok(Number.isFinite(result.totalDamage) && result.totalDamage > 0);
      assert.ok(result.damageEvents.length > 0);
      outputs.push(summarizeOutput(result));
    }
    const replayJson = JSON.stringify(simulate(scenario.config, optionsAt(0)));
    assert.equal(replayJson, firstJson, "Replay of first seed must reproduce complete result bytes");
    const uniqueParticleCounts = [...new Set(outputs.flatMap((output) => output.particleCounts))].sort((a, b) => a - b);
    if (!scenario.fixedSeed) assert.deepEqual(uniqueParticleCounts, [2, 3, 4]);
    measurements.push({
      id: scenario.id,
      workload: scenario.workload,
      simulationDurationSeconds: scenario.config.duration,
      cycleLengthSeconds: scenario.config.cycleLength,
      fixtureVerificationStatus: scenario.config.meta.verificationStatus,
      seedPolicy: scenario.fixedSeed ? "identical-base-seed-every-iteration" : "base-seed + :iteration: + zero-based-index",
      warmupIterations,
      measuredIterations,
      critMode: "average",
      traceMode: "full-generated-and-validated",
      timing: summarizeTimes(durations),
      checks: {
        sameSeedFullResultByteReplay: "passed",
        allDeterministicOutputsByteEqual: scenario.fixedSeed ? "passed" : "not-applicable-distinct-seeds",
        positiveFiniteDamageEverySample: "passed",
        noShardOrDendroCorePositionSampling: "passed",
        uniqueParticleCounts,
        uniqueDamageTotals: [...new Set(outputs.map((output) => output.totalDamage))],
        damageEventCountRange: [Math.min(...outputs.map((output) => output.arrayLengths.damageEvents)), Math.max(...outputs.map((output) => output.arrayLengths.damageEvents))]
      },
      outputs
    });
  }
  const after = await fingerprints();
  assert.deepEqual(after, before, "Measured source files changed during the benchmark; rerun for stable evidence");
  const report = {
    reportVersion: 1,
    capturedAt: new Date().toISOString(),
    command: "node docs/cross-validation/run-simulation-benchmark.mjs",
    workingDirectory: root,
    head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    sourceFingerprints: before,
    evidenceScope: "This report measures the source snapshot identified by capturedAt and sourceFingerprints only; later workspace edits require a fresh run.",
    environment: {
      node: process.version,
      v8: process.versions.v8,
      operatingSystem: `${os.type()} ${os.release()} ${os.version()}`,
      architecture: os.arch(),
      processor: os.cpus()[0]?.model,
      logicalProcessors: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
      loadAverageAtEnd: os.loadavg(),
      isolation: "Separate Node process; no CPU affinity or OS-wide isolation. Other development processes may affect wall time. Vite SSR transpilation completed before timed calls."
    },
    rng: {
      seed,
      seedHash: "FNV-1a 32-bit over JavaScript UTF-16 code units",
      generator: "Mulberry32",
      sampledByTheseFixtures: "discrete particle counts only; verified no shard or Dendro-core events",
      engineAlsoSupports: "seeded Crystallize-shard and Dendro-core positions in applicable scenarios",
      randomCriticalHits: "unsupported; critMode=average is algebraic expectation, not crit Monte Carlo"
    },
    traceDisabled: {
      status: "unsupported",
      evidence: "SimulationOptions has energyMode, critMode, compatibilityMode, randomSeed only; no trace-off runtime option.",
      benchmarkComparison: null,
      explanation: "Full result traces are always generated. Discarding/projection of traces after simulate() is not trace-disabled execution and is not reported as one."
    },
    scope: "Core simulate() throughput including full trace generation and integrity validation. Excludes module load, JSON serialization, browser rendering, worker transport, and report output. Fixture regression/performance evidence, not independent gameplay validation.",
    measurements
  };
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "simulation-benchmark.json"), `${JSON.stringify(report, null, 2)}\n`);
  const row = (value) => `| ${value.id} | ${value.timing.medianMilliseconds.toFixed(3)} | ${value.timing.p95Milliseconds.toFixed(3)} | ${value.timing.maxMilliseconds.toFixed(3)} | ${value.timing.simulationsPerSecond.toFixed(2)} | ${value.checks.damageEventCountRange.join("–")} |`;
  const markdown = `# 模拟核心性能实测\n\n采集时间：${report.capturedAt}。命令：\`node docs/cross-validation/run-simulation-benchmark.mjs\`。原始逐次耗时、输出摘要、环境和源文件 SHA-256 均见 [simulation-benchmark.json](./simulation-benchmark.json)。\n\n环境：${report.environment.operatingSystem} / ${report.environment.architecture} / ${report.environment.processor} / Node ${report.environment.node}，${report.environment.logicalProcessors} 逻辑处理器。HEAD：\`${report.head}\`；报告仅证明该采集时间及所列源文件哈希对应的被测快照，后续工作区修改须重新执行；工作区实施代码可能尚未提交。独立 Node 进程运行，未隔离全机其他开发进程，因此数值是本机观测值，不是跨设备保证。\n\n每个场景预热 ${warmupIterations} 次，计时 ${measuredIterations} 次。计时覆盖完整 \`simulate()\`（含轨迹生成和完整性校验），排除 Vite 模块加载、结果序列化、重放比对、浏览器渲染、Worker 传输及报告写盘。p95 为 nearest-rank；偶数样本中位数取中间两项均值。这里的分位数仅描述墙钟耗时分布，不是伤害分布分位数，也不是均值置信区间。\n\n| 场景 | 中位数 ms | p95 ms | 最大值 ms | 次/秒 | 伤害事件数 |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${measurements.map(row).join("\n")}\n\n- 确定性场景使用原始 120 秒 \`durinMeltPreset\`。全部 ${measuredIterations} 次完整 JSON 字节一致，并另行重放第一个种子。总伤害 ${measurements[0].outputs[0].totalDamage}，DPS ${measurements[0].outputs[0].dps}。\n- 回能场景把 \`particleEnergyDemoPreset\` 的 duration 和 cycleLength 都设置为 120，与现有性能测试一致：120 秒窗口内只有一次合法指令序列，不可宣称为持续 120 秒高密度回能压力。每轮种子为 \`${seed}:iteration:i\`（i 从 0 起）。实测粒子数量覆盖 ${measurements[1].checks.uniqueParticleCounts.join(" / ")}，每轮伤害事件数 ${measurements[1].checks.damageEventCountRange.join("–")}；完整种子重放一致。该预设不同掉球数未必改变总伤害，具体各轮输出已存档。\n- 种子经 FNV-1a 32-bit 散列后输入 Mulberry32。两个场景均确认没有结晶碎片或草原核位置采样；当前引擎在其他场景还会采样这些空间位置。暴击模式为 \`average\`，属于解析期望，不是随机暴击或暴击反馈 Monte Carlo。\n- **trace-disabled：unsupported。** 当前 SimulationOptions 没有关闭轨迹的选项，故不存在实测开/关轨迹比较。先产生完整结果再丢弃轨迹不能当作关闭轨迹。也未将 Node 核心耗时冒充浏览器 Worker 吞吐。\n- 两个预设都标注 provisional；这些数字证明特定负载的实际性能与重复性，不证明正式游戏角色数据或全部机制已验证。\n`;
  await writeFile(path.join(directory, "simulation-benchmark.md"), markdown);
  console.log(JSON.stringify({
    capturedAt: report.capturedAt,
    measurements: measurements.map(({ id, timing, checks }) => ({
      id,
      medianMilliseconds: timing.medianMilliseconds,
      p95Milliseconds: timing.p95Milliseconds,
      simulationsPerSecond: timing.simulationsPerSecond,
      sameSeedFullResultByteReplay: checks.sameSeedFullResultByteReplay
    }))
  }, null, 2));
} finally {
  await server.close();
}
