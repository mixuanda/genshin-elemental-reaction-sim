/**
 * Current execution-options benchmark. Keeps the older simulation-benchmark.*
 * report as historical evidence; this command does not run that older workload.
 * node docs/cross-validation/run-simulation-execution-benchmark.mjs
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../..");
const measuredIterations = 12;
const warmupIterations = 2;
const seed = "simulation-execution-benchmark-2026-09-23";
const sourcePaths = [
  "packages/sim-core/src/simulator.ts", "packages/sim-core/src/energy.ts",
  "packages/sim-core/src/formulas.ts", "packages/sim-core/src/calculator-formula.ts",
  "packages/sim-core/src/calculation-trace.ts", "packages/sim-core/src/calculator-bridge.ts",
  "packages/sim-core/src/phase-checkpoint.ts", "packages/sim-core/src/min-heap.ts",
  "packages/sim-core/src/simulation-analysis.ts", "packages/sim-core/src/index.ts",
  "packages/schemas/src/types.ts", "packages/schemas/src/schema.ts",
  "packages/schemas/src/result-schema.ts", "packages/schemas/src/index.ts",
  "packages/schemas/src/execution-audit-schema.ts", "packages/schemas/src/execution-audit-integrity.ts",
  "packages/game-data/src/presets.ts", "packages/reaction-formulas/src/profile.ts",
  "packages/reaction-formulas/src/index.ts", "package-lock.json"
];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const fingerprints = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async (p) => [p, hash(await readFile(path.join(root, p)))])));
function times(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const totalMilliseconds = values.reduce((sum, value) => sum + value, 0);
  return {
    rawMilliseconds: values, totalMilliseconds,
    meanMilliseconds: totalMilliseconds / values.length,
    medianMilliseconds: (sorted[values.length / 2 - 1] + sorted[values.length / 2]) / 2,
    p95Milliseconds: sorted[Math.ceil(0.95 * values.length) - 1],
    maxMilliseconds: sorted.at(-1), simulationsPerSecond: values.length * 1000 / totalMilliseconds,
    percentileMethod: "Nearest-rank p95 equals sample maximum for n=12; median averages the middle pair.",
    distributionMeaning: "Wall-clock duration distribution; not damage spread percentiles or a confidence interval for a mean."
  };
}
function summarize(result) {
  const audit = result.executionAudit;
  assert.ok(audit);
  assert.equal(audit.hits.length, result.damageEvents.length);
  const json = JSON.stringify(result);
  return {
    totalDamage: result.totalDamage, dps: result.dps, damageEventCount: result.damageEvents.length,
    capturedHitCount: audit.hits.length,
    traceRecordCount: audit.hits.filter((hit) => hit.trace !== undefined).length,
    traceNodeCount: audit.hits.reduce((sum, hit) => sum + (hit.trace?.length ?? 0), 0),
    ordinaryEligibleCount: audit.hits.filter((hit) => hit.inputKind === "ordinary" && hit.critical.eligible).length,
    ineligibleCount: audit.hits.filter((hit) => !hit.critical.eligible).length,
    sampledCriticalCount: audit.hits.filter((hit) => hit.critical.mode === "seeded-random-v1" && hit.critical.outcome === "critical").length,
    sampledNoncriticalCount: audit.hits.filter((hit) => hit.critical.mode === "seeded-random-v1" && hit.critical.outcome === "noncritical").length,
    randomDecisionCount: audit.criticalSampling?.drawCount ?? 0,
    criticalStream: audit.criticalSampling,
    criticalDecisions: audit.hits.map((hit) => ({ eventId: hit.eventId, inputKind: hit.inputKind, critRate: hit.inputKind === "ordinary" ? hit.input.critRate : null, ...hit.critical })),
    resultJsonBytes: Buffer.byteLength(json), resultSha256: hash(json),
    damageEventsSha256: hash(JSON.stringify(result.damageEvents)),
    coreAuditArrayLengths: Object.fromEntries(Object.entries(result).filter(([key, value]) => Array.isArray(value) && key !== "damageEvents" && key !== "hitEvents").map(([key, value]) => [key, value.length])),
    checkpointCount: audit.phaseCheckpoints.length,
    checkpointCoverage: audit.checkpointCoverage,
    reproducibilityKey: result.reproducibilityKey,
    resolvedRuntimeOptions: result.resolvedRuntimeOptions
  };
}
const before = await fingerprints();
const server = await createServer({ root, configFile: false, logLevel: "error", server: { middlewareMode: true, watch: null, hmr: false }, ssr: { noExternal: [/^@genshin-dps-lab\//] } });
try {
  const { simulate } = await server.ssrLoadModule("/packages/sim-core/src/simulator.ts");
  const { durinMeltPreset } = await server.ssrLoadModule("/packages/game-data/src/presets.ts");
  const config = structuredClone(durinMeltPreset);
  const eligibilityAction = config.rotation.find((action) => action.hits?.length);
  assert.ok(eligibilityAction);
  const eligibilityHit = eligibilityAction.hits[0];
  eligibilityHit.critEligible = false;
  const scenarios = [
    { id: "average-traces-off", sampling: false, execution: { captureHits: true, detailedTraces: false } },
    { id: "average-traces-on", sampling: false, execution: { captureHits: true, detailedTraces: true } },
    { id: "random-crit-traces-off", sampling: true, execution: { captureHits: true, detailedTraces: false, criticalSampling: "seeded-random-v1" } }
  ];
  const measurements = [];
  let referenceDamageEventsHash;
  let referenceTotal;
  let referenceAuditArrays;
  for (const scenario of scenarios) {
    const optionsAt = (index) => ({ critMode: "average", randomSeed: scenario.sampling ? `${seed}:iteration:${index}` : seed, execution: scenario.execution });
    for (let index = 0; index < warmupIterations; index += 1) simulate(config, optionsAt(index));
    const durations = [];
    const outputs = [];
    for (let index = 0; index < measuredIterations; index += 1) {
      const started = performance.now();
      const result = simulate(config, optionsAt(index));
      durations.push(performance.now() - started);
      const summary = summarize(result);
      assert.ok(summary.ineligibleCount > 0);
      assert.ok(summary.ordinaryEligibleCount > 0);
      if (scenario.execution.detailedTraces) {
        assert.equal(summary.traceRecordCount, summary.capturedHitCount);
        assert.ok(summary.traceNodeCount > 0);
      } else {
        assert.equal(summary.traceRecordCount, 0);
        assert.equal(summary.traceNodeCount, 0);
      }
      if (!scenario.sampling) {
        referenceDamageEventsHash ??= summary.damageEventsSha256;
        referenceTotal ??= summary.totalDamage;
        referenceAuditArrays ??= summary.coreAuditArrayLengths;
        assert.equal(summary.damageEventsSha256, referenceDamageEventsHash, "Trace modes must preserve exact damage-event output");
        assert.equal(summary.totalDamage, referenceTotal);
        assert.deepEqual(summary.coreAuditArrayLengths, referenceAuditArrays, "Core audit structures remain present in both trace modes");
        if (outputs.length) assert.equal(summary.resultSha256, outputs[0].resultSha256, "Same options and seed must reproduce complete output bytes");
      } else {
        assert.equal(summary.randomDecisionCount, summary.ordinaryEligibleCount);
        assert.equal(summary.criticalStream.algorithm, "mulberry32-v1");
        assert.equal(summary.criticalStream.seed, `${optionsAt(index).randomSeed}:critical-hit-v1`);
        let nextDraw = 0;
        for (const decision of summary.criticalDecisions) {
          if (!decision.eligible) {
            assert.equal(decision.outcome, "ineligible");
            assert.equal(decision.roll, null);
            assert.equal(decision.drawIndex, null);
            continue;
          }
          assert.equal(decision.mode, "seeded-random-v1");
          assert.equal(decision.drawIndex, nextDraw++);
          assert.ok(decision.roll >= 0 && decision.roll < 1);
          assert.equal(decision.outcome, decision.roll < Math.min(1, Math.max(0, decision.critRate)) ? "critical" : "noncritical");
        }
        assert.ok(summary.sampledCriticalCount > 0 && summary.sampledNoncriticalCount > 0);
      }
      outputs.push(summary);
    }
    const replay = summarize(simulate(config, optionsAt(0)));
    assert.equal(replay.resultSha256, outputs[0].resultSha256, "First seed full-result replay must be byte-identical");
    const uniqueTotals = [...new Set(outputs.map((out) => out.totalDamage))];
    if (scenario.sampling) assert.ok(uniqueTotals.length > 1, "Distinct critical seeds must vary damage on this 0<CR<1 workload");
    measurements.push({ id: scenario.id, runtimeOptions: optionsAt(0), warmupIterations, measuredIterations, timing: times(durations), checks: { firstSeedFullResultReplay: "passed", criticalEligibilityPreserved: "passed", traceCreationFlagHonored: "passed", identicalDeterministicDamageEventsAcrossTraceModes: scenario.sampling ? "not-applicable" : "passed", distinctDamageTotals: uniqueTotals.length }, damageSampleRange: { min: Math.min(...uniqueTotals), max: Math.max(...uniqueTotals) }, outputs });
  }
  assert.deepEqual(await fingerprints(), before, "Measured sources changed during this invocation; do not accept partial timings");
  const report = {
    reportVersion: 1, capturedAt: new Date().toISOString(), command: "node docs/cross-validation/run-simulation-execution-benchmark.mjs", status: "passed", sourceFingerprints: before,
    head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    environment: { node: process.version, v8: process.versions.v8, os: `${os.type()} ${os.release()} ${os.version()}`, architecture: os.arch(), processor: os.cpus()[0]?.model, logicalProcessors: os.cpus().length, loadAverageAtEnd: os.loadavg(), isolation: "One Node process; no CPU affinity or machine-wide load isolation. Vite SSR loading occurs before timing." },
    scenario: { base: "durinMeltPreset", durationSeconds: config.duration, fixtureVerification: config.meta.verificationStatus, change: { reason: "Explicit eligibility probe shared by all three workloads", actionId: eligibilityAction.id, hitIndex: 0, hitLabel: eligibilityHit.label, critEligible: false }, configHash: hash(JSON.stringify(config)), config },
    historicalReport: { path: "docs/cross-validation/simulation-benchmark.json", meaning: "Older snapshot measured before execution.detailedTraces and random critical sampling existed. Its unsupported statements are historical, not current capability claims. This new run does not overwrite or rerun it." },
    timingScope: "simulate() including input migration, computation, hit capture and schema/integrity audits; excludes module load, summary/checks, JSON serialization, I/O, browser and Worker transport.",
    detailedTraceComparison: { actualFlag: "execution.detailedTraces", captureHits: true, creationDisabled: true, retainedCosts: "Only per-hit explanation nodes are disabled. Damage events, snapshots, reaction/callback/aura/target/energy audit arrays, exact hit inputs and schema/integrity checks remain; this is not a fully log-free simulator.", damageEventsAndTotalsIdentical: true, checkpointsRequested: false },
    rng: { baseSeed: seed, streamSeed: "effective randomSeed + :critical-hit-v1", hash: "FNV-1a 32-bit over JavaScript UTF-16 code units", generator: "Mulberry32", drawPolicy: "One stream draw per eligible ordinary hit, in execution order. No draws for explicit ineligible hits or transformative reactions; explicit plugin critical-mode override is not used by this fixture.", decision: "roll < clamp(critRate, 0, 1)", independentStreams: "Critical stream is separate from particle counts, Crystallize shard positions and Dendro core positions.", limitations: "This measures real random critical damage decisions, not crit-trigger feedback, Favonius procs or downstream equipment/character state. No confidence interval is estimated from these 12 samples." },
    measurements
  };
  await writeFile(path.join(directory, "simulation-execution-benchmark.json"), `${JSON.stringify(report, null, 2)}\n`);
  const row = (item) => { const first = item.outputs[0]; return `| ${item.id} | ${item.timing.medianMilliseconds.toFixed(3)} | ${item.timing.p95Milliseconds.toFixed(3)} | ${item.timing.simulationsPerSecond.toFixed(2)} | ${first.damageEventCount} | ${first.traceRecordCount} / ${first.traceNodeCount} | ${first.resultJsonBytes} |`; };
  const sampled = measurements[2];
  const markdown = `# 当前执行选项性能实测\n\n采集：${report.capturedAt}。命令：\`node docs/cross-validation/run-simulation-execution-benchmark.mjs\`（exit 0）。每场景预热 ${warmupIterations} 次、实测 ${measuredIterations} 次，再作一次未计时的首种子完整结果重放。机器信息、逐次耗时、逐击随机结果和实际源码哈希见 [JSON](./simulation-execution-benchmark.json)。\n\n本报告追加当前证据；[旧报告](./simulation-benchmark.md)仍保存原先没有 execution 选项时的历史结果，旧报告中的“不支持关闭轨迹/随机暴击”不是当前能力描述。本次未运行旧 30 轮 benchmark。\n\n环境：${report.environment.processor} / ${report.environment.architecture} / Node ${report.environment.node}。没有隔离全机其他负载。三个场景共享同一 120 秒 provisional 杜林样例；为检验暴击资格，统一将 \`${eligibilityAction.id}\` 的第 0 个命中定义设为 \`critEligible:false\`，其余输入不变。此改动会影响跨周期重复命中，不能与未改动旧基准的总伤害直接比较。\n\n| 场景 | 中位数 ms | p95 ms | 次/秒 | 伤害事件 | trace记录 / 节点 | 首轮结果 JSON bytes |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${measurements.map(row).join("\n")}\n\np95 为 nearest-rank；12 个样本时等于最大值。这里是墙钟耗时分布，不是伤害分位数或均值置信区间。计时含完整 \`simulate()\` 的计算、capture 和完整性验证，排除序列化、结果核对、I/O、浏览器和 Worker 传输。\n\n**真实 detailedTraces 开/关：**两者均 \`captureHits:true\`。关闭模式的逐击 trace 记录及节点确实为 0；开启模式每击均有 trace。所有确定性轮次以及两种模式之间的总伤害、完整 damageEvents 字节一致，总伤害为 ${referenceTotal}。关闭逐击解释仍保留完整事件、快照、反应/回调/Aura/目标/能量审计、精确命中输入和 schema 校验，因此耗时不代表“全日志关闭”。本次未请求阶段检查点，也不验证稳态覆盖。\n\n**实际随机暴击：**使用 \`criticalSampling:'seeded-random-v1'\`，每次以 \`${seed}:iteration:i\` 为种子；独立暴击流追加 \`:critical-hit-v1\`，经 FNV-1a32 后执行 Mulberry32。命中按 \`roll < clamp(CR,0,1)\` 取结果。每轮实测 ${sampled.outputs[0].randomDecisionCount} 次抽样，${sampled.outputs[0].ineligibleCount} 个不具资格命中不抽样；每轮均观察到暴击和未暴击，${sampled.checks.distinctDamageTotals} 个种子得到不同总伤害，范围 ${sampled.damageSampleRange.min}–${sampled.damageSampleRange.max}。首种子完整结果重放字节一致；所有逐击 roll、drawIndex、资格和结果均存入 JSON 并检查。\n\n该随机验证只覆盖伤害是否暴击，不涵盖暴击触发被动、祭礼/西风等装备反馈、能量和角色后续状态。未将 12 次吞吐样本冒充收敛的伤害分布或均值置信区间。该报告只证明记录哈希对应源码快照的本机观测。\n`;
  await writeFile(path.join(directory, "simulation-execution-benchmark.md"), markdown);
  console.log(JSON.stringify({ status: report.status, capturedAt: report.capturedAt, measurements: measurements.map((item) => ({ id: item.id, medianMilliseconds: item.timing.medianMilliseconds, p95Milliseconds: item.timing.p95Milliseconds, simulationsPerSecond: item.timing.simulationsPerSecond, traceRecords: item.outputs[0].traceRecordCount, traceNodes: item.outputs[0].traceNodeCount, bytes: item.outputs[0].resultJsonBytes, distinctTotals: item.checks.distinctDamageTotals })) }, null, 2));
} catch (error) {
  await writeFile(path.join(directory, "simulation-execution-benchmark.failure.json"), `${JSON.stringify({ capturedAt: new Date().toISOString(), status: "failed-no-success-claim", message: String(error), stack: error.stack, sourceFingerprints: before }, null, 2)}\n`);
  throw error;
} finally {
  await server.close();
}
