/**
 * External executable comparison, pinned to the project's gcsim reference.
 *   node docs/cross-validation/run-gcsim-comparison.mjs [verified-binary-path]
 * Without a path, downloads the official macOS arm64 asset to a temp folder.
 * A supplied binary must match the same pinned SHA-256. No global install.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, "../..");
const revision = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const release = "v2.44.1";
const binaryUrl = `https://github.com/genshinsim/gcsim/releases/download/${release}/gcsim_darwin_arm64`;
const binarySha256 = "2332566a3c06ab1b50003024b1838ee3565d2969bd4a004a35a60f482cbc8449";
const licenseUrl = `https://github.com/genshinsim/gcsim/releases/download/${release}/LICENSE`;
const licenseSha256 = "a100d2f2a4f04058c3986861bcb1b27d1a920e9e7b810714fffc3f66c188f6d4";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const relative = (file) => path.relative(root, file);
const downloaded = async (url, digest) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(hash(bytes), digest, `Pinned download SHA-256 mismatch: ${url}`);
  return bytes;
};
const invoke = (binary, args, cwd) => {
  const result = spawnSync(binary, args, { cwd, encoding: "utf8", timeout: 30000, maxBuffer: 10000000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`gcsim failed (${result.status}): ${result.stderr}`);
  return { executable: binary, args, workingDirectory: cwd, exitCode: result.status, stdout: result.stdout, stderr: result.stderr };
};
const sourcePaths = [
  "packages/sim-core/src/simulator.ts",
  "packages/sim-core/src/formulas.ts",
  "packages/sim-core/src/calculator-formula.ts",
  "packages/sim-core/src/calculation-trace.ts",
  "packages/sim-core/src/calculator-bridge.ts",
  "packages/sim-core/src/calculator.ts",
  "packages/sim-core/src/calculator-model.ts",
  "packages/schemas/src/types.ts",
  "packages/game-data/src/presets.ts",
  "packages/reaction-formulas/src/profile.ts",
  "package-lock.json"
];
const fingerprints = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async (p) => [p, hash(await readFile(path.join(root, p)))])));
const config = `options iteration=1 duration=2 workers=1 hitlag=false;
amber char lvl=1/20 cons=0 talent=1,1,1;
amber add weapon="huntersbow" refine=1 lvl=1/20;
amber add stats cr=-0.05;
target lvl=90 resist=0.1 pos=0,2 radius=2;
active amber;
amber attack;
wait(120);
`;

if (process.platform !== "darwin" || process.arch !== "arm64") {
  throw new Error("This pinned runner currently packages the upstream macOS arm64 asset only. Select and verify a platform-specific asset before porting.");
}
await mkdir(output, { recursive: true });
const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "gidps-gcsim-comparison-"));
const binary = process.argv[2] ? path.resolve(process.argv[2]) : path.join(tempDirectory, "gcsim_darwin_arm64");
if (!process.argv[2]) {
  await writeFile(binary, await downloaded(binaryUrl, binarySha256));
  await chmod(binary, 0o755);
}
assert.equal(hash(await readFile(binary)), binarySha256, "Supplied executable is not the pinned official release asset");
const versionInvocation = invoke(binary, ["-version"], tempDirectory);
assert.equal(versionInvocation.stdout.trim(), revision);
await writeFile(path.join(output, "gcsim-LICENSE-MIT.txt"), await downloaded(licenseUrl, licenseSha256));
const configFile = path.join(output, "gcsim-ordinary.gcsl");
const resultFile = path.join(output, "gcsim-ordinary.result.json");
const sampleFile = path.join(output, "gcsim-ordinary.sample.json");
await writeFile(configFile, config);
const externalInvocation = invoke(binary, ["-c", configFile, "-out", resultFile, "-sample", sampleFile], tempDirectory);
const external = JSON.parse(await readFile(resultFile, "utf8"));
const sample = JSON.parse(await readFile(sampleFile, "utf8"));
assert.equal(external.sim_version, revision);
assert.equal(external.modified, false);
assert.equal(external.statistics.iterations, 1);
assert.equal(external.statistics.duration.mean, 2);
const damageLogs = sample.logs.filter((entry) => entry.event === "damage");
const calcLogs = sample.logs.filter((entry) => entry.event === "calc");
assert.equal(damageLogs.length, 1);
assert.equal(calcLogs.length, 1);
const calculation = calcLogs[0].logs;
const damageLog = damageLogs[0];
// Fixed controlled input alignment: fail instead of fitting local stats to the
// external damage. The full runtime calculation record is preserved as evidence.
const expectedContext = {
  abil: "Normal 0", base_atk: 41.9434, total_scaling: 41.9434,
  talent: 0.3612, char_lvl: 1, target_lvl: 90, res: 0.1,
  flat_atk: 0, atk_per: 0, flat_dmg: 0, bonus_dmg: 0, ele_per: 0,
  ignore_def: 0, def_adj: 0, cr: 0, cd: 0.5, damage_grp_mult: 1,
  melt_vape: false, catalyzed: false, reaction_type: "", is_crit: false
};
for (const [key, value] of Object.entries(expectedContext)) assert.equal(calculation[key], value, `Unaligned external context: ${key}`);
assert.equal(damageLog.frame, 25);
assert.equal(damageLog.logs.ele, "physical");
assert.deepEqual(damageLog.logs.pre_damage_mods, []);
assert.equal(external.statistics.source_damage_instances[0].sources["Normal 0"].mean, 1);
assert.deepEqual(external.statistics.source_reactions, [{}]);
assert.equal(external.statistics.total_damage.mean, damageLog.logs.damage);

const before = await fingerprints();
const server = await createServer({ root, configFile: false, logLevel: "error", server: { middlewareMode: true, watch: null, hmr: false }, ssr: { noExternal: [/^@genshin-dps-lab\//] } });
try {
  const { simulate } = await server.ssrLoadModule("/packages/sim-core/src/simulator.ts");
  const { blankPreset } = await server.ssrLoadModule("/packages/game-data/src/presets.ts");
  const { calcDamage } = await server.ssrLoadModule("/packages/sim-core/src/formulas.ts");
  const { calculateDamageTrace } = await server.ssrLoadModule("/packages/sim-core/src/calculator-formula.ts");
  const { captureSimulationHit, replaySimulationHit } = await server.ssrLoadModule("/packages/sim-core/src/calculator-bridge.ts");
  const { calculateDocument } = await server.ssrLoadModule("/packages/sim-core/src/calculator.ts");
  const formulaInput = {
    scaling: 0.3612, scalingStat: "atk", scalingValue: 41.9434, flatDamage: 0,
    damageBonus: 0, characterLevel: 1, enemyLevel: 90, defenseReduction: 0,
    defenseIgnore: 0, effectiveResistance: 0.1, critRate: 0, critDamage: 0.5,
    critMode: "noCrit", reaction: "none", elementalMastery: 0,
    reactionBonus: 0, groupMultiplier: 1
  };
  const localConfig = structuredClone(blankPreset);
  localConfig.meta = { name: "外部 gcsim 单普攻对照", version: "gcsim-v2.44.1-one-normal", verificationStatus: "provisional", note: "One controlled ordinary hit only; not a complete Amber or weapon implementation validation." };
  localConfig.dataVersion = "external-gcsim-v2.44.1-resolved-context";
  localConfig.duration = 2;
  localConfig.cycleLength = 2;
  localConfig.randomSeed = "gcsim-controlled-physical-no-crit";
  localConfig.enemy = { level: 90, resistance: 0.1, defReduction: 0 };
  localConfig.characters = [{
    id: "amber", name: "安柏（外部已解析面板）", element: "pyro", color: "#ff8b72", level: 1,
    energyMax: 40, initialEnergy: 40,
    stats: { baseAtk: 41.9434, atkPct: 0, flatAtk: 0, baseHp: 793.2582, hpPct: 0, flatHp: 0, baseDef: 50.358, defPct: 0, flatDef: 0, em: 0, critRate: 0, critDmg: 0.5, dmgBonus: 0, defIgnore: 0, reactionBonus: 0, energyRecharge: 1 }
  }];
  localConfig.rotation = [{ id: "amber-n1", actorId: "amber", name: "Normal 0", at: 1 / 60, once: true, hits: [{ id: "amber-n1-hit", offset: 24 / 60, label: "Normal 0", scaling: 0.3612, scalingStat: "atk", element: "physical", snapshot: "hit" }] }];
  const local = simulate(localConfig, { critMode: "noCrit" });
  assert.equal(local.damageEvents.length, 1);
  assert.equal(local.reactedHits, 0);
  const hit = local.damageEvents[0];
  const formula = calcDamage(formulaInput);
  const explained = calculateDamageTrace(formulaInput);
  const capture = captureSimulationHit(local, hit.id);
  const replay = replaySimulationHit(capture);
  const calculatorDocument = {
    schemaVersion: "1.0.0", ruleVersion: "ordinary-trace-v1", id: "external-gcsim-amber-normal", label: "gcsim 安柏一级普攻对照", scope: "single-hit", characterLevel: 1,
    build: { mode: "manual-final", stats: { atk: 41.9434, hp: 793.2582, def: 50.358, em: 0, critRate: 0, critDamage: 0.5 }, source: "gcsim v2.44.1 runtime calc record; final resolved context" },
    enemy: { level: 90, resistance: 0.1, defenseAdjustment: 0, defenseIgnore: 0 },
    hits: [{ id: "n1", label: "Normal 0", kind: "ordinary", element: "physical", terms: [{ stat: "atk", coefficient: 0.3612 }], additiveBaseDamage: 0, damageBonus: 0, critEligible: true, reaction: "none", reactionBonus: 0, groupMultiplier: 1, sourceRefs: [`gcsim:${revision}:sample-calc`], dependencies: [] }],
    selectedHitIds: ["n1"], assumptions: ["One ordinary physical hit; no reactions, crit rolls, passives, artifacts, buffs or Hitlag."], dependencies: [],
    dataIdentity: { datasetId: "external-gcsim-v2.44.1-resolved-context", gameVersion: "unspecified-controlled-reference", releaseStatus: "unknown", evidenceStatus: "provisional" }
  };
  const calculator = calculateDocument(calculatorDocument);
  assert.equal(calculator.status, "calculated");
  const residuals = Object.fromEntries(Object.entries({
    localSimulation: local.totalDamage,
    ordinaryFormula: formula.finalDamage,
    structuredTrace: explained.finalDamage,
    capturedHitReplay: replay.reproducedDamage,
    standaloneCalculator: calculator.totals.nonCritical,
    expectedCalculator: calculator.totals.expected
  }).map(([key, value]) => [key, { value, absoluteResidual: Math.abs(value - calculation.damage), relativeResidual: Math.abs(value - calculation.damage) / Math.abs(calculation.damage) }]));
  for (const value of Object.values(residuals)) assert.ok(value.absoluteResidual <= 1e-12, "External ordinary-damage comparison exceeds the declared absolute tolerance");
  assert.deepEqual(await fingerprints(), before, "Measured local source changed while comparing; rerun for a stable snapshot");
  const localFile = path.join(output, "gcsim-ordinary.local-result.json");
  const calculatorFile = path.join(output, "gcsim-ordinary.calculator.json");
  await writeFile(localFile, `${JSON.stringify(local, null, 2)}\n`);
  await writeFile(calculatorFile, `${JSON.stringify(calculatorDocument, null, 2)}\n`);
  const report = {
    reportVersion: 1, capturedAt: new Date().toISOString(), status: "passed-single-controlled-ordinary-hit", command: "node docs/cross-validation/run-gcsim-comparison.mjs [verified-binary-path]",
    environment: { node: process.version, platform: os.platform(), release: os.release(), architecture: os.arch(), processor: os.cpus()[0]?.model },
    provenance: { repository: "https://github.com/genshinsim/gcsim", release, revision, tagVerificationUrl: `https://api.github.com/repos/genshinsim/gcsim/commits/${release}`, binaryUrl, binarySha256, binaryBytes: (await readFile(binary)).length, versionInvocation, license: { type: "MIT at pinned v2.44.1", url: licenseUrl, sha256: licenseSha256, savedPath: relative(path.join(output, "gcsim-LICENSE-MIT.txt")) } },
    scope: "Independent official gcsim executable vs local simulator, shared formula, trace and standalone calculator for one physical normal hit. Not a source-table substitution for running the external program. Not proof of complete Amber/weapon/passive implementation, rotations, reactions, RNG, energy, or full database coverage.",
    sourceFingerprints: before,
    initialDiagnostic: { status: "corrected-before-final-run", problem: "Initial probe used hitlag=0; pinned gcsim parser expects a boolean and exited 1 with expecting 32, got token 0. Correct config uses hitlag=false." },
    externalInvocation,
    alignment: { durationSeconds: 2, character: "amber", level: "1/20", constellation: 0, talents: [1, 1, 1], weapon: "huntersbow", weaponLevel: "1/20", refinement: 1, artifactSets: [], statsOverride: "cr=-0.05 offsets native 5% CR to 0%", enemyLevel: 90, resistance: 0.1, targetCount: 1, actionCount: 1, hitCount: 1, hitFrame: 25, hitlag: false, reaction: "none", resolvedContext: expectedContext, localBuildPolicy: "Explicit resolved stats; do not reapply character/weapon/ascension additions." },
    externalExecution: { aggregateIterations: 1, separateSampleIterations: 1, sampleSeed: sample.seed, aggregateSeed: external.statistics.min_seed, seedScope: "Upstream CLI selected seeds are preserved verbatim as strings. This controlled outcome is seed-independent because CR=0 and there are no sampled particle counts, entities, effects or reactions; external metadata is not asserted byte-identical across reruns.", sampleDamage: calculation.damage, aggregateMeanDamage: external.statistics.total_damage.mean, standardDeviation: external.statistics.total_damage.sd, sampleCalculationRecord: calculation },
    comparison: { absoluteTolerance: 1e-12, tolerancePurpose: "IEEE-754 arithmetic alignment tolerance; not uncertainty about game mechanics", equation: "41.9434 × 0.3612 × 1 × (101 / 291) × 0.9 × 1 × 1 × 1", intermediateResults: { scalingValue: 41.9434, talentDamage: 15.149956079999999, damageBonusMultiplier: 1, defenseMultiplier: 101 / 291, resistanceMultiplier: 0.9, critMultiplier: 1, reactionMultiplier: 1, groupMultiplier: 1 }, residuals, replayDifference: replay.difference },
    artifacts: await Promise.all([configFile, resultFile, sampleFile, localFile, calculatorFile].map(async (file) => ({ path: relative(file), sha256: hash(await readFile(file)) }))),
    primarySources: [
      `https://github.com/genshinsim/gcsim/releases/tag/${release}`,
      `https://github.com/genshinsim/gcsim/blob/${revision}/cmd/gcsim/main.go`,
      `https://github.com/genshinsim/gcsim/blob/${revision}/ui/packages/docs/docs/reference/config.md`,
      `https://github.com/genshinsim/gcsim/blob/${revision}/internal/characters/amber/attack.go`
    ]
  };
  await writeFile(path.join(output, "gcsim-comparison.json"), `${JSON.stringify(report, null, 2)}\n`);
  const rows = Object.entries(residuals).map(([name, values]) => `| ${name} | ${values.value} | ${values.absoluteResidual} |`).join("\n");
  await writeFile(path.join(output, "gcsim-comparison.md"), `# 外部 gcsim 可执行程序交叉验证\n\n结果：**一项受控普通伤害案例通过**。采集：${report.capturedAt}。上游 [gcsim ${release}](https://github.com/genshinsim/gcsim/releases/tag/${release}) 的标签、二进制 \`-version\` 与输出 sim_version 均锁定 \`${revision}\`。实际运行官方 macOS arm64 二进制，SHA-256 为 \`${binarySha256}\`；没有用读取上游公式源码代替外部执行。固定版本的 [MIT 许可](./gcsim-LICENSE-MIT.txt) 随证据保存。\n\n复现：\`node docs/cross-validation/run-gcsim-comparison.mjs\`。脚本下载到临时目录并校验哈希，不安装全局工具；也可传入相同哈希的已有二进制路径。当前封装仅支持 macOS arm64。\n\n[输入配置](./gcsim-ordinary.gcsl)：一级 C0 安柏、一级 R1 猎弓、1/1/1 天赋、无圣遗物套装或额外属性（仅添加 CR −5% 抵消角色初始 5%），对等级 90、物理抗性 10% 的单个敌人，2 秒内只执行一次物理普攻。Hitlag 关闭，无反应、增益、产球或武器被动。本地显式输入解析后的 ATK 41.9434、倍率 0.3612；没有再次叠加武器/角色属性。帧 25 只有一次伤害；外部 sample 明确无暴击、无反应、无 pre_damage_mods。\n\n\`41.9434 × 0.3612 × 1 × (101 / 291) × 0.9 × 1 × 1 × 1 = ${calculation.damage}\`\n\n外部实际伤害：**${calculation.damage}**。同时检查 aggregate 的单次总伤害与 sample 一致。比较绝对容差为 1e−12，只用于 IEEE-754 数值对齐。\n\n| 本地路径 | 伤害 | 对外部绝对残差 |\n| --- | ---: | ---: |\n${rows}\n\n[原始外部汇总](./gcsim-ordinary.result.json)、[原始逐帧 sample](./gcsim-ordinary.sample.json)、[本地完整模拟](./gcsim-ordinary.local-result.json)、[独立计算器输入](./gcsim-ordinary.calculator.json) 和 [机器报告](./gcsim-comparison.json) 均保存。外部执行是 1 次汇总迭代加单独 1 次 sample；CLI 自选的种子以字符串原样存档。本案例关闭所有影响结果的随机来源，因此每次伤害应一致，不能要求时间/种子等元数据字节一致，也不能把此案例称为 Monte Carlo 分布验证。\n\n初次参数探测使用 \`hitlag=0\` 导致上游解析失败（exit 1，expecting 32, got token 0）；改为文法要求的 \`hitlag=false\` 后正式命令 exit 0。实际 stdout、参数、环境、源文件和输出哈希见机器报告。\n\n此结果只覆盖该已对齐上下文的一个普通物理命中及其本地独立计算器还原。未验证安柏或武器的完整实现、反应、轮转、能量、随机反馈和全量数据覆盖；它也不是官方游戏真值。后续本地核心改动后须重新运行，当前结论仅属于已记录源码哈希的快照。\n`);
  console.log(JSON.stringify({ status: report.status, capturedAt: report.capturedAt, externalDamage: calculation.damage, residuals }, null, 2));
} finally {
  await server.close();
}
