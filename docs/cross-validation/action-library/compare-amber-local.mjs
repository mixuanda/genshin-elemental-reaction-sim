/** Compare the new local source-backed action library to archived external N5.
 * Never launches or downloads gcsim. Run only after source-action-library is ready.
 * node docs/cross-validation/action-library/compare-amber-local.mjs
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../../..");
const revision = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const tolerance = 1e-12;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const sourcePaths = [
  "packages/sim-core/src/source-action-library.ts", "packages/sim-core/src/simulator.ts",
  "packages/sim-core/src/legal-timeline.ts", "packages/sim-core/src/calculator-bridge.ts",
  "packages/sim-core/src/calculator.ts", "packages/sim-core/src/calculator-model.ts",
  "packages/sim-core/src/calculator-formula.ts", "packages/sim-core/src/calculation-trace.ts",
  "packages/sim-core/src/formulas.ts", "packages/sim-core/src/energy.ts",
  "packages/sim-core/src/min-heap.ts", "packages/sim-core/src/phase-checkpoint.ts",
  "packages/schemas/src/types.ts", "packages/schemas/src/schema.ts",
  "packages/schemas/src/result-schema.ts", "packages/schemas/src/execution-audit-schema.ts",
  "packages/schemas/src/execution-audit-integrity.ts", "packages/reaction-formulas/src/profile.ts",
  "package-lock.json"
];
const fingerprints = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async (file) => [file, hash(await readFile(path.join(root, file)))])));
function close(actual, expected, label) {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected), `${label} must be finite`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} differs from ${expected}`);
}
const externalResultBytes = await readFile(path.join(directory, "amber-n5.result.json"));
const externalSampleBytes = await readFile(path.join(directory, "amber-n5.sample.json"));
const external = JSON.parse(externalResultBytes.toString());
const sample = JSON.parse(externalSampleBytes.toString());
const contract = JSON.parse(await readFile(path.join(directory, "amber-normal-contract.json"), "utf8"));
assert.equal(external.sim_version, revision);
assert.equal(external.modified, false);
const externalActions = sample.logs.filter((item) => item.event === "action" && item.msg === "executed attack");
const externalHits = sample.logs.filter((item) => item.event === "damage");
const externalCalcs = sample.logs.filter((item) => item.event === "calc");
const externalSnapshots = sample.logs.filter((item) => item.event === "snapshot" && item.msg.startsWith("Normal "));
assert.equal(externalActions.length, 5);
assert.equal(externalHits.length, 5);
assert.equal(externalCalcs.length, 5);
const before = await fingerprints();
const server = await createServer({ root, configFile: false, logLevel: "error", server: { middlewareMode: true, watch: null, hmr: false }, ssr: { noExternal: [/^@genshin-dps-lab\//] } });
try {
  const { createAmberNormalChainScenario } = await server.ssrLoadModule("/packages/sim-core/src/source-action-library.ts");
  const { simulate } = await server.ssrLoadModule("/packages/sim-core/src/simulator.ts");
  const { captureSimulationHit, serializeSimulationHit, parseSimulationHit, replaySimulationHit } = await server.ssrLoadModule("/packages/sim-core/src/calculator-bridge.ts");
  const { calculateDocument } = await server.ssrLoadModule("/packages/sim-core/src/calculator.ts");
  const factoryArguments = [];
  const config = createAmberNormalChainScenario();
  const runtimeOptions = { critMode: "noCrit", execution: { captureHits: true, detailedTraces: true } };
  const result = simulate(config, runtimeOptions);
  assert.equal(result.damageEvents.length, 5);
  assert.equal(result.executionAudit.hits.length, 5);
  assert.equal(result.reactedHits, 0);
  assert.equal(result.pluginManifest.length, 0);
  const localActions = result.actionLog;
  assert.equal(localActions.length, 5);
  assert.deepEqual(localActions.map((action) => action.frame), externalActions.map((action) => action.frame), "Local input frames must match raw external frames without translation");
  assert.deepEqual(result.damageEvents.map((hit) => hit.frame), externalHits.map((hit) => hit.frame), "Local hit frames must match raw external frames without translation");
  assert.equal(localActions[0].frame, 1);
  const comparisons = [];
  for (let index = 0; index < 5; index += 1) {
    const event = result.damageEvents[index];
    const calc = externalCalcs[index].logs;
    const expected = externalHits[index];
    assert.equal(event.kind, "direct");
    assert.equal(event.element, "physical");
    assert.equal(event.reaction, "none");
    assert.equal(event.activeStatuses.length, 0);
    close(event.damageFactors.scaling, calc.talent, `N${index + 1} coefficient`);
    close(event.damageFactors.scalingValue, calc.total_scaling, `N${index + 1} ATK`);
    close(event.damageFactors.critRate, calc.cr, `N${index + 1} crit rate`);
    close(event.finalDamage, expected.logs.damage, `N${index + 1} external damage`);
    const capture = captureSimulationHit(result, event.id);
    const wire = serializeSimulationHit(capture);
    const replay = replaySimulationHit(parseSimulationHit(wire));
    close(replay.reproducedDamage, event.finalDamage, `N${index + 1} captured replay`);
    close(replay.difference, 0, `N${index + 1} replay residual`);
    const input = replay.formulaInput;
    assert.equal(input.scalingStat, "atk");
    const calculatorDocument = {
      schemaVersion: "1.0.0", ruleVersion: "ordinary-trace-v1", id: `amber-library-n${index + 1}`, label: `安柏动作库 N${index + 1} 命中还原`, scope: "single-hit", characterLevel: input.characterLevel,
      build: { mode: "manual-final", stats: { atk: input.scalingValue, hp: event.statsBeforeDamage.baseHp, def: event.statsBeforeDamage.baseDef, em: input.elementalMastery, critRate: input.critRate, critDamage: input.critDamage }, source: "Actual captured local simulation hit; source-backed static action library" },
      enemy: { level: input.enemyLevel, resistance: input.effectiveResistance, defenseAdjustment: input.defenseReduction, defenseIgnore: input.defenseIgnore },
      hits: [{ id: "hit", label: `N${index + 1}`, kind: "ordinary", element: "physical", attackTag: "normal", terms: [{ stat: "atk", coefficient: input.scaling }], additiveBaseDamage: input.flatDamage, damageBonus: input.damageBonus, critEligible: true, reaction: input.reaction, reactionBonus: input.reactionBonus, groupMultiplier: input.groupMultiplier, sourceRefs: [`gcsim:${revision}:internal/characters/amber/attack.go`, "local:source-action-library"], dependencies: [] }],
      selectedHitIds: ["hit"], assumptions: ["Static panel and no dynamic buffs during arrow flight; one ordinary hit from an independent input action."], dependencies: [],
      dataIdentity: { datasetId: `gcsim-${revision}-amber-static`, gameVersion: "fixed-community-reference", releaseStatus: "unknown", evidenceStatus: "provisional" }
    };
    const calculator = calculateDocument(calculatorDocument);
    assert.equal(calculator.status, "calculated");
    close(calculator.totals.nonCritical, event.finalDamage, `N${index + 1} standalone calculator`);
    comparisons.push({
      action: `N${index + 1}`, eventId: event.id,
      externalInputFrame: externalActions[index].frame, localInputFrame: localActions[index].frame,
      externalSnapshotFrame: externalSnapshots[index].frame,
      sourceSnapshotDelayFrames: contract.actions[index].snapshotDelayFrames,
      externalHitFrame: expected.frame, localHitFrame: event.frame,
      externalDamage: expected.logs.damage, localDamage: event.finalDamage,
      damageResidual: event.finalDamage - expected.logs.damage,
      restoredDamage: replay.reproducedDamage, standaloneCalculatorDamage: calculator.totals.nonCritical,
      traceNodeCount: replay.trace.length, capturedInput: input,
      calculatorDocument, calculatorTrace: calculator.hits[0].trace
    });
  }
  const fourthProjectile = result.damageEvents[3];
  const fifthInput = localActions[4];
  assert.ok(fourthProjectile.frame > fifthInput.frame, "N4 projectile must remain scheduled after N5 starts");
  close(result.totalDamage, external.statistics.total_damage.mean, "N5 total damage");
  close(comparisons.reduce((total, item) => total + item.standaloneCalculatorDamage, 0), result.totalDamage, "Sum of five separate calculator hits");
  assert.deepEqual(await fingerprints(), before, "Local source changed during validation; this invocation is not stable evidence");
  const resultPath = path.join(directory, "amber-local-result.json");
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  const report = {
    status: "passed-archived-external-five-normal-comparison", capturedAt: new Date().toISOString(),
    command: "node docs/cross-validation/action-library/compare-amber-local.mjs", externalBinaryInvokedThisRun: false,
    sourceFingerprints: before, factoryArguments, runtimeOptions,
    externalEvidence: { revision, resultSha256: hash(externalResultBytes), sampleSha256: hash(externalSampleBytes), sampleSeed: sample.seed },
    frameAlignment: { offsetApplied: 0, firstExternalInputFrame: externalActions[0].frame, firstLocalInputFrame: localActions[0].frame, note: "Input frame1 is supplied to the source-backed factory. Every actual frame is compared directly; no post-hoc shift." },
    projectilePersistence: { n4LocalHitFrame: fourthProjectile.frame, n5LocalInputFrame: fifthInput.frame, laterByFrames: fourthProjectile.frame - fifthInput.frame, passed: true },
    totalDamage: { external: external.statistics.total_damage.mean, local: result.totalDamage, residual: result.totalDamage - external.statistics.total_damage.mean, absoluteTolerance: tolerance },
    snapshotScope: "External snapshots occur at projectile launch; local action/hit snapshot semantics are numerically equivalent only for this static, buff-free panel. This comparison does not certify dynamic snapshot timing, flight-time stat changes, attack speed, Hitlag, passives, or arbitrary cancel actions.",
    coverage: "Five source-backed ordinary normal input actions; each saved context passes calculator capture/export/import/replay and a separate Single Hit calculator calculation. Their sum is a chain total, not a single-cast claim.",
    comparisons, artifacts: { localResult: "amber-local-result.json", localResultSha256: hash(await readFile(resultPath)) }
  };
  await writeFile(path.join(directory, "amber-local-comparison.json"), `${JSON.stringify(report, null, 2)}\n`);
  const rows = comparisons.map((item) => `| ${item.action} | ${item.externalInputFrame} / ${item.localInputFrame} | ${item.externalHitFrame} / ${item.localHitFrame} | ${item.externalDamage} | ${item.localDamage} | ${item.damageResidual} |`).join("\n");
  await writeFile(path.join(directory, "amber-local-comparison.md"), `# 安柏来源动作库与外部 N5 对照\n\n${report.capturedAt}，命令 \`node docs/cross-validation/action-library/compare-amber-local.mjs\`，exit 0。本次只读取已存档的固定 gcsim sample/result，**未再次运行外部 binary**。实际工厂参数、运行选项、源码 SHA-256 和逐击计算器轨迹见 [机器报告](./amber-local-comparison.json)，完整模拟见 [本地结果](./amber-local-result.json)。\n\n| 动作 | 输入帧：外部 / 本地 | 命中帧：外部 / 本地 | 外部伤害 | 本地伤害 | 差值 |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${rows}\n\n本地首个输入实际配置为 **frame 1**，所有帧直接比较，未平移原始结果。N4 的箭在 N5 输入之后仍于 frame ${fourthProjectile.frame} 命中；N5 在 frame ${fifthInput.frame} 开始，重叠 ${fourthProjectile.frame - fifthInput.frame} 帧，说明上一动作投射物没有在新动作开始时被丢弃。\n\n总伤害：外部 ${report.totalDamage.external}，本地 ${report.totalDamage.local}，差值 ${report.totalDamage.residual}。每个命中均执行完整捕获、JSON 导出/导入、独立还原及 Single Hit 计算器重算；五项相加为普通攻击链总伤害，不把五次输入冒充一次技能施放。绝对容差 1e−12。\n\n**快照范围：**固定 gcsim 在箭矢发射时快照，10 帧后命中。这里只验证静态、无增益面板，使本地动作／命中快照取值数值等价；未验证动态快照时机、飞行期间属性变化、攻速、Hitlag、被动或任意取消动作。来源动作库仍属 provisional，不因此声明完整安柏支持。源码测前后哈希一致；后续核心改动须另行重验。\n`);
  console.log(JSON.stringify({ status: report.status, capturedAt: report.capturedAt, frameOffset: 0, totalDamage: report.totalDamage, projectilePersistence: report.projectilePersistence, hitCount: comparisons.length }, null, 2));
} catch (error) {
  await writeFile(path.join(directory, "amber-local-comparison.failure.json"), `${JSON.stringify({ status: "failed-no-pass-claim", capturedAt: new Date().toISOString(), error: String(error), stack: error.stack, sourceFingerprints: before }, null, 2)}\n`);
  throw error;
} finally {
  await server.close();
}
