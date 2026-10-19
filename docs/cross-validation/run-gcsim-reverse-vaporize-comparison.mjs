/** One controlled two-character external executable comparison; no core edits.
 * node docs/cross-validation/run-gcsim-reverse-vaporize-comparison.mjs <pinned-binary> [pinned-source-tree]
 * With no binary, reuses the path recorded by run-gcsim-comparison.mjs.
 * With no source tree, retrieves and verifies the immutable raw source URLs.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, writeFile, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, '../..');
const stem = path.join(output, 'gcsim-reverse-vaporize');
const revision = 'b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541';
const binarySha256 = '2332566a3c06ab1b50003024b1838ee3565d2969bd4a004a35a60f482cbc8449';
const digest = (value) => createHash('sha256').update(value).digest('hex');
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const save = async (suffix, value) => writeFile(stem + suffix, JSON.stringify(value, null, 2) + '\n');
const tolerance = 1e-12;
const near = (actual, expected, label, limit = tolerance) => assert.ok(Math.abs(actual - expected) <= limit, `${label}: ${actual} vs ${expected}; tolerance ${limit}`);
const invoke = (binary, args, cwd) => {
  const result = spawnSync(binary, args, { cwd, encoding: 'utf8', timeout: 30000, maxBuffer: 10000000 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return { executable: binary, args, workingDirectory: cwd, exitCode: result.status, stdout: result.stdout, stderr: result.stderr };
};
// Fingerprint production source transitively available to Vite. Inputs are fixed
// fixtures, not generated from the measured damage or mutable live game data.
const sourcePaths = ['package-lock.json'];
for (const directory of ['packages/sim-core/src', 'packages/schemas/src', 'packages/reaction-formulas/src']) {
  for (const file of await readdir(path.join(root, directory), { recursive: true })) {
    if (file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.includes('__tests__')) sourcePaths.push(`${directory}/${file}`);
  }
}
sourcePaths.sort();
const fingerprints = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async (file) => [file, digest(await readFile(path.join(root, file)))])));

assert.equal(process.platform, 'darwin', 'Pinned executable is macOS arm64');
assert.equal(process.arch, 'arm64', 'Pinned executable is macOS arm64');
const previous = process.argv[2] ? null : await json(path.join(output, 'gcsim-comparison.json'));
const binary = path.resolve(process.argv[2] ?? previous.provenance.versionInvocation.executable);
const binaryBytes = await readFile(binary);
assert.equal(digest(binaryBytes), binarySha256, 'Wrong external executable');
const temp = await mkdtemp(path.join(os.tmpdir(), 'gidps-gcsim-vape-'));
const versionInvocation = invoke(binary, ['-version'], temp);
assert.equal(versionInvocation.stdout.trim(), revision);
const upstreamSources = await json(stem + '.upstream-sources.json');
const sourceVerifications = await Promise.all(upstreamSources.map(async (source) => {
  let bytes;
  if (process.argv[3]) bytes = await readFile(path.join(path.resolve(process.argv[3]), source.path));
  else {
    const response = await fetch(source.url);
    assert.ok(response.ok, `${response.status}: ${source.url}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  assert.equal(digest(bytes), source.sha256, `Upstream source changed: ${source.path}`);
  assert.equal(bytes.length, source.bytes);
  return { ...source, verifiedAt: new Date().toISOString(), method: process.argv[3] ? 'pinned-extracted-tree' : 'immutable-url-fetch' };
}));
const externalInvocation = invoke(binary, ['-c', stem + '.gcsl', '-out', stem + '.result.json', '-sample', stem + '.sample.json'], temp);
const external = await json(stem + '.result.json');
const sample = await json(stem + '.sample.json');
assert.equal(external.sim_version, revision);
assert.equal(external.modified, false);
assert.equal(external.statistics.iterations, 1);
assert.equal(external.statistics.duration.mean, 8);
const damage = sample.logs.filter((entry) => entry.event === 'damage');
const calcs = sample.logs.filter((entry) => entry.event === 'calc');
const elements = sample.logs.filter((entry) => entry.event === 'element' && entry.msg === 'application');
const icd = sample.logs.filter((entry) => entry.event === 'icd' && entry.msg === 'ele app reset timer set');
assert.deepEqual(damage.map((entry) => entry.frame), [7, 164, 260]);
assert.deepEqual(calcs.map((entry) => entry.frame), [7, 164, 260]);
assert.deepEqual(damage.map((entry) => entry.logs.ele), ['hydro', 'pyro', 'pyro']);
assert.deepEqual(damage.map((entry) => entry.logs.amp), ['', 'vaporize', '']);
assert.deepEqual(elements.map((entry) => entry.logs.dur), [25, 50, 50]);
assert.deepEqual(icd.map((entry) => entry.logs.reset), [156, 223, 319]);
assert.deepEqual(sample.logs.filter((entry) => entry.event === 'action' && ['attack', 'aim'].includes(entry.logs.action)).map((entry) => entry.frame), [1, 68, 164]);
assert.equal(sample.logs.find((entry) => entry.msg === 'executed swap').frame, 68);
assert.deepEqual(sample.logs.filter((entry) => entry.msg === 'executed wait').map((entry) => [entry.frame, entry.logs.f]), [[7, 60], [250, 480]]);
assert.deepEqual(external.statistics.total_source_energy, [{}, {}]);
assert.equal(external.statistics.source_reactions[1].sources.vaporize.mean, 1);
assert.equal(external.statistics.source_reactions[0].sources, undefined);
for (const failures of external.statistics.failed_actions) for (const failure of Object.values(failures)) assert.equal(failure.mean, 0);
for (const stats of external.statistics.end_stats) assert.equal(stats.ending_energy.mean, 0);
for (const entry of damage) assert.deepEqual(entry.logs.pre_damage_mods, []);

const localConfig = await json(stem + '.local-config.json');
assert.equal(localConfig.reactionEngine.mode, 'aura-v3');
assert.equal(localConfig.duration, 8);
assert.equal(localConfig.timeline.legalityMode, 'strict');
// Verify resolved stats against exact upstream arrays, not rounded display logs.
const initialStats = sample.logs.filter((entry) => entry.event === 'character' && entry.logs.char_base);
const characterAlignment = initialStats.map((entry, index) => {
  const character = localConfig.characters[index];
  const stats = entry.logs.final_stats;
  assert.deepEqual(entry.logs.char_base, { ascension: 0, cons: 0, element: character.element, key: character.id, level: 1, max_level: 20, rarity: 4 });
  assert.equal(entry.logs.weap_base.key, index === 0 ? 'apprenticesnotes' : 'huntersbow');
  assert.equal(entry.logs.weap_base.level, 1);
  assert.equal(entry.logs.weap_base.max_level, 20);
  assert.equal(entry.logs.weap_base.refine, 1);
  for (const [field, statIndex] of Object.entries({ energyRecharge: 7, em: 8, critRate: 9, critDmg: 10, baseHp: 23, baseAtk: 24, baseDef: 25 })) assert.equal(character.stats[field], stats[statIndex], `Panel mismatch: ${character.id}.${field}`);
  assert.equal(character.initialEnergy, 0);
  return { character: character.id, base: entry.logs.char_base, weapon: entry.logs.weap_base, exactResolvedStats: character.stats, initialEnergy: 0, endEnergy: 0 };
});
const alignedShared = { char_lvl: 1, target_lvl: 90, res: 0.1, flat_atk: 0, atk_per: 0, flat_dmg: 0, bonus_dmg: 0, ele_per: 0, ignore_def: 0, def_adj: 0, cr: 0, cd: 0.5, damage_grp_mult: 1, is_crit: false, catalyzed: false };
for (const [index, entry] of calcs.entries()) {
  for (const [field, value] of Object.entries(alignedShared)) assert.equal(entry.logs[field], value, `External hit ${index}: ${field}`);
  assert.equal(entry.logs.base_atk, index === 0 ? 36.601 : 41.9434);
  assert.equal(entry.logs.talent, index === 0 ? 0.3784 : 1.24);
  assert.equal(entry.logs.em, index === 0 ? 0 : 100);
  assert.equal(entry.logs.melt_vape, index === 1);
}
assert.equal(calcs[1].logs.react_mult, 1.5);
assert.equal(calcs[1].logs.amp_mult_total, 1.778);

const before = await fingerprints();
const server = await createServer({ root, configFile: false, logLevel: 'error', server: { middlewareMode: true, watch: null, hmr: false }, ssr: { noExternal: [/^@genshin-dps-lab\//] } });
try {
  const { simulate } = await server.ssrLoadModule('/packages/sim-core/src/simulator.ts');
  const { captureSimulationHit, replaySimulationHit } = await server.ssrLoadModule('/packages/sim-core/src/calculator-bridge.ts');
  const { calculateDocument } = await server.ssrLoadModule('/packages/sim-core/src/calculator.ts');
  const local = simulate(localConfig, { critMode: 'noCrit' });
  assert.deepEqual(local.timelineExecution.failures, []);
  assert.deepEqual(local.timelineExecution.adjustments, []);
  assert.deepEqual(local.damageEvents.map((event) => event.frame), damage.map((entry) => entry.frame));
  assert.deepEqual(local.damageEvents.map((event) => event.actionStartFrame), [1, 68, 164]);
  assert.deepEqual(local.damageEvents.map((event) => event.reaction), ['none', 'reverseVaporize', 'none']);
  assert.equal(local.reactedHits, 1);
  assert.deepEqual(local.elementalApplicationIcdLog.map((entry) => entry.decision.resetAtFrame), icd.map((entry) => entry.logs.reset));
  assert.equal(local.timelineExecution.commandResults[3].endFrame, 68);
  assert.equal(local.timelineExecution.commandResults[6].startFrame, 250);
  assert.equal(local.timelineExecution.totalFrames, 730); // final wait is clipped by 480-frame observation window
  for (const energy of Object.values(local.energyStats)) assert.deepEqual(energy, { initial: 0, gained: 0, fixedGained: 0, particleGained: 0, wasted: 0, spent: 0, skipped: 0, final: 0 });
  assert.equal(local.particleEvents.length, 0);
  const comparison = local.damageEvents.map((event, index) => {
    near(event.finalDamage, damage[index].logs.damage, `Hit ${index}`);
    const capture = captureSimulationHit(local, event.id);
    const replay = replaySimulationHit(capture);
    near(replay.reproducedDamage, damage[index].logs.damage, `Replay ${index}`);
    return { frame: event.frame, source: event.sourceActorId, action: event.actionName, reaction: event.reaction, externalDamage: damage[index].logs.damage, localDamage: event.finalDamage, absoluteResidual: Math.abs(event.finalDamage - damage[index].logs.damage), replayDamage: replay.reproducedDamage, replayDifference: replay.difference, formulaInput: replay.formulaInput, trace: replay.trace };
  });
  near(local.totalDamage, external.statistics.total_damage.mean, 'Total damage');
  near(local.dps, external.statistics.dps.mean, 'DPS');
  near(damage.reduce((total, entry) => total + entry.logs.damage, 0), external.statistics.total_damage.mean, 'Sample vs aggregate');
  const aura = local.damageEvents.map((event, index) => {
    const parse = (rows) => (rows ?? []).map((row) => { const [element, amount] = row.split(': '); return { element, durability: Number(amount) }; });
    const externalBefore = parse(elements[index].logs.existing);
    const externalAfter = parse(elements[index].logs.after);
    const compare = (actual, expected, phase) => {
      assert.deepEqual(actual.map((entry) => entry.element), expected.map((entry) => entry.element));
      return actual.map((entry, i) => {
        const durability = entry.gaugeUnits * 25;
        // Upstream logs display only 3 decimals: comparison cannot claim exact
        // internal-state equality beyond that independent observation precision.
        near(durability, expected[i].durability, `Aura ${index} ${phase}`, 0.000500000001);
        return { element: entry.element, localGaugeUnits: entry.gaugeUnits, localDurability: durability, externalPrintedDurability: expected[i].durability, absoluteDurabilityResidual: Math.abs(durability - expected[i].durability) };
      });
    };
    return { frame: event.frame, before: compare(event.reactionAudit.auraBefore, externalBefore, 'before'), after: compare(event.reactionAudit.auraAfter, externalAfter, 'after') };
  });
  const capture = captureSimulationHit(local, local.damageEvents[1].id);
  const calculatorDocument = {
    schemaVersion: '1.0.0', ruleVersion: 'ordinary-trace-v1', id: 'gcsim-two-character-vaporized-arrow', label: '双角色轮转中已触发反向蒸发的安柏满蓄力', scope: 'single-hit', characterLevel: 1,
    build: { mode: 'manual-final', stats: { atk: 41.9434, hp: 793.2582, def: 50.358, em: 100, critRate: 0, critDamage: 0.5 }, source: `Fixed gcsim ${revision} exact resolved panel; local automatic aura event 1` },
    enemy: { level: 90, resistance: 0.1, defenseAdjustment: 0, defenseIgnore: 0 },
    hits: [{ id: 'vaporized-arrow', label: 'Fully-Charged Aimed Shot', kind: 'ordinary', element: 'pyro', terms: [{ stat: 'atk', coefficient: 1.24 }], additiveBaseDamage: 0, damageBonus: 0, critEligible: true, reaction: local.damageEvents[1].reaction, reactionBonus: 0, groupMultiplier: 1, sourceRefs: [`gcsim:${revision}:amber/aimed.go`], dependencies: [] }],
    selectedHitIds: ['vaporized-arrow'], assumptions: ['Reaction was decided automatically in the saved two-character simulation; this single-hit document conditions on that recorded reaction.', 'Resolved final panel: do not add character or weapon ATK again.'], dependencies: [],
    dataIdentity: { datasetId: 'external-gcsim-v2.44.1-resolved-context', gameVersion: 'unspecified-controlled-reference', releaseStatus: 'unknown', evidenceStatus: 'provisional' }
  };
  const calculator = calculateDocument(calculatorDocument);
  assert.equal(calculator.status, 'calculated');
  near(calculator.totals.nonCritical, damage[1].logs.damage, 'Standalone calculator');
  assert.deepEqual(await fingerprints(), before, 'Local source changed during comparison; rerun for stable snapshot');
  await save('.local-result.json', local);
  await save('.captured-hit.json', capture);
  await save('.calculator.json', calculatorDocument);
  await save('.calculator-result.json', calculator);
  const artifactSuffixes = ['.gcsl', '.local-config.json', '.upstream-sources.json', '.result.json', '.sample.json', '.local-result.json', '.captured-hit.json', '.calculator.json', '.calculator-result.json'];
  const report = {
    reportVersion: 1, capturedAt: new Date().toISOString(), status: 'passed-controlled-two-character-reverse-vaporize',
    command: 'node docs/cross-validation/run-gcsim-reverse-vaporize-comparison.mjs <pinned-binary> [pinned-source-tree]',
    environment: { node: process.version, platform: os.platform(), release: os.release(), architecture: os.arch() },
    provenance: { release: 'v2.44.1', revision, binaryUrl: 'https://github.com/genshinsim/gcsim/releases/download/v2.44.1/gcsim_darwin_arm64', binarySha256, binaryBytes: binaryBytes.length, versionInvocation, upstreamSources: sourceVerifications, license: 'gcsim-LICENSE-MIT.txt' },
    externalInvocation, sourceFingerprints: before,
    alignment: { characters: characterAlignment, durationSeconds: 8, observationFrames: [0, 480], fps: 60, target: { level: 90, resistance: 0.1, count: 1, position: [0, 2], radius: 2 }, hitlag: false, swapFrames: 1, actionStarts: [1, 68, 164], hitFrames: [7, 164, 260], frameOrigin: 'External actions begin at frame 1; local explicit wait(1) aligns origin.', snapshotLimit: 'External Amber snapshots at frames 154 and 250; local at impact 164 and 260. Stats do not change, so numerical context is identical here. This does not validate changing-buff snapshot timing.', overrideScope: 'CR -0.05 cancels native 5%; Amber EM +100 is an explicit controlled stat modifier, not a claim of an equipped artifact build. Level 1/20 C0, talents 1/1/1, weapon 1/20 R1, no sets/passives.', localAuraProfile: 'aura-v3', finalWait: 'Both issue wait(480) at frame 250; observation ends at frame 480, no extra damage. Local compiled timeline ends at frame 730.' },
    comparison: { absoluteDamageTolerance: tolerance, perHit: comparison, externalTotal: external.statistics.total_damage.mean, localTotal: local.totalDamage, totalResidual: Math.abs(local.totalDamage - external.statistics.total_damage.mean), externalDps: external.statistics.dps.mean, localDps: local.dps, dpsResidual: Math.abs(local.dps - external.statistics.dps.mean), auraPrecision: 'External textual durability printed to 3 decimals; tolerance 0.0005 durability = 0.00002 U.', aura, icdResetFrames: [156, 223, 319], standaloneCalculatorDamage: calculator.totals.nonCritical, standaloneCalculatorResidual: Math.abs(calculator.totals.nonCritical - damage[1].logs.damage), localEnergy: local.energyStats, externalEndEnergy: external.statistics.end_stats, failedActions: 0 },
    initialDiagnostic: { status: 'configuration-corrected-before-final-run', problem: 'Initial local probe accidentally selected historical aura-v1, retaining legacy 6 frames/U decay; source-pinned gcsim uses 6*durability+420 with 25 durability/U. Correct existing aura-v3 profile uses 150 frames/U. Damage happened to match even with wrong decay profile; state did not. No core or expected damage values were changed.' },
    execution: { aggregateIterations: 1, separateSampleIterations: 1, aggregateSeed: external.statistics.min_seed, sampleSeed: sample.seed, scope: 'Deterministic controlled outcome with zero crit rate, no particles or changing buffs. Not Monte Carlo validation.' },
    limitations: ['Controlled real character actions mapped manually from a pinned executable implementation; does not validate automatic character-data adapters.', 'Not an official game ground truth, current 7.1 coverage, complete character kit, full weapon/passive implementation, or Lunar/Stellar validation.', 'Energy starts and ends at zero with no energy-producing action; does not validate particle accounting, ER sufficiency or burst feasibility.', 'Single target; no geometry, hitlag, changing buff snapshots or stochastic mechanics validated.'],
    artifacts: await Promise.all(artifactSuffixes.map(async (suffix) => ({ path: path.relative(root, stem + suffix), sha256: digest(await readFile(stem + suffix)) })))
  };
  await save('.comparison.json', report);
  const rows = comparison.map((row) => `| ${row.frame} | ${row.source} | ${row.reaction} | ${row.externalDamage} | ${row.localDamage} | ${row.absoluteResidual} |`).join('\n');
  await writeFile(stem + '.comparison.md', `# 双角色反向蒸发：固定外部可执行程序对照\n\n**通过一个受控双角色案例。** 采集 ${report.capturedAt}。实际执行官方 [gcsim v2.44.1](https://github.com/genshinsim/gcsim/releases/tag/v2.44.1) macOS arm64 二进制，版本输出与结果均为 \`${revision}\`，SHA-256 \`${binarySha256}\`。本次只新增复现脚本、固定输入和报告，没有修改主核心。源码验证清单含固定 URL、字节数及 SHA-256，见 [来源清单](./gcsim-reverse-vaporize.upstream-sources.json)。\n\n复现：\`node docs/cross-validation/run-gcsim-reverse-vaporize-comparison.mjs <已校验二进制路径> [固定源码树路径]\`。省略二进制会读取旧单命中报告中的已执行路径；省略源码树会下载固定提交的源文件并校验哈希。仅支持此已固定的 macOS arm64 二进制，失配即停止。\n\n[外部输入](./gcsim-reverse-vaporize.gcsl) 为芭芭拉 N1，等待 60 帧，换安柏，连续两次满蓄力瞄准。两人一级 C0、1/1/1 天赋，武器分别为一级 R1 学徒笔记、猎弓；无圣遗物、增益或已解锁突破被动。CR −5% 抵消原生暴击；安柏额外 EM 100 是明确的受控属性输入，用来检验精通放大区，并非宣称存在对应装备面板。两人 CR 0、CD 50%、ER 100%、初始能量 0；敌人等级 90、抗性 10%、单目标，关闭 hitlag，换人耗时 1 帧。\n\n| 角色 | 角色基础 ATK | 武器基础 ATK | 解析后 ATK | HP | DEF | EM |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n| 芭芭拉 | 13.356 | 23.245 | 36.601 | 820.6119 | 56.0805 | 0 |\n| 安柏 | 18.6984 | 23.245 | 41.9434 | 793.2582 | 50.358 | 100 |\n\n上述解析后面板逐项与外部未舍入的 stat 数组断言相等；本地没有再次添加角色或武器 ATK。[本地固定输入](./gcsim-reverse-vaporize.local-config.json) 使用严格帧轮转、\`aura-v3\` 与固定 gcsim 应用 ICD。仅设置命中元素与附着量，蒸发由附着状态自动决定。芭芭拉 N1 为 1U；安柏满蓄力为 **2U**，不可误写成 1U。\n\n| 命中帧 | 来源 | 本地自动反应 | 外部伤害 | 本地伤害 | 绝对残差 |\n| ---: | --- | --- | ---: | ---: | ---: |\n${rows}\n\n总伤害两端 **${local.totalDamage}**，残差 ${report.comparison.totalResidual}。8 秒完整观察窗包含空闲时间：外部 DPS ${report.comparison.externalDps}，本地 DPS ${local.dps}，残差 ${report.comparison.dpsResidual}，属于 IEEE-754 运算舍入；绝对比较容差为 1e−12。三次命中的独立捕获重放残差均为零；蒸发箭的 [独立计算器输入](./gcsim-reverse-vaporize.calculator.json) 实际执行得到 ${calculator.totals.nonCritical}，对外部残差 ${report.comparison.standaloneCalculatorResidual}。[完整捕获](./gcsim-reverse-vaporize.captured-hit.json) 保留上下文，[计算器结果](./gcsim-reverse-vaporize.calculator-result.json) 保留公式步骤。\n\n三击共享防御乘区 \`(1+100)/((1+100)+(90+100))=101/291=0.3470790378006873\`、抗性乘区 \`1−0.1=0.9\`、非暴击乘区 1、增伤与额外乘区 1。芭芭拉基础伤害 \`36.601×0.3784=13.8498184\`，最终 \`13.8498184×101/291×0.9=4.326283479587628\`。安柏基础伤害 \`41.9434×1.24=52.009815999999994\`，无反应伤害 \`52.009815999999994×101/291×0.9=16.24636520412371\`。反向蒸发精通加成为 \`2.78×100/(1400+100)=0.18533333333333332\`，反应乘区 \`1.5×(1+0.18533333333333332)=1.778\`，首箭 \`16.24636520412371×1.778=28.886037332931956\`；第二箭没有水附着，保留无反应伤害。\n\n两端动作起始帧为 1、68、164，命中帧为 7、164、260，换人 67→68。外部帧从 1 开始，本地显式等待 1 帧对齐原点。安柏 86 帧出箭加 10 帧飞行，连续瞄准动作间隔 96 帧；最后等待从 250 帧开始。两端最后均等待 480 帧，编译动作尾端到 730 帧，但伤害观察窗固定到 480 帧。严格模式没有自动延后、失败动作或跳过动作。\n\n应用 ICD 重置帧两端均为 156、223、319。水初始附着 0.8U，其寿命为 \`420+6×25=570\` 帧；164 帧前衰减 \`0.8−(164−7)×0.8/570=0.579649122807…U\`。本地此值换算为 14.491228070175 durability；外部日志只打印 14.491（3 位小数），差值约 0.00022807，处于 0.0005 durability 的显示舍入容差内。因此只能声称与外部打印精度一致，不能宣称观察到了外部未舍入的内部状态。第一发 2U 火消耗全部剩余水，命中后双方无附着；第二发命中后均为 1.6U 火。\n\n初次探测误选历史兼容 \`aura-v1\`（保留每 U 6 帧旧换算），伤害虽一致，水衰减状态却不一致。核对固定源码和现有版本说明后改用 \`aura-v3\`（每 U 150 帧），没有调整倍率、面板或 expected 伤害来迎合结果，也没有修改核心。\n\n[原始外部汇总](./gcsim-reverse-vaporize.result.json)、[原始 sample](./gcsim-reverse-vaporize.sample.json)、[本地完整结果](./gcsim-reverse-vaporize.local-result.json) 和 [机器报告](./gcsim-reverse-vaporize.comparison.json) 均保存，报告包含实际命令、stdout、退出码、环境、完整源码及产物哈希。本次执行 1 次汇总迭代和独立 1 次 sample；种子原样保存。CR 为零且没有其他随机结果，不把它当作 Monte Carlo 验证。\n\n边界：此例证明固定规则上下文中的三击、一次自动反向蒸发、附着打印状态、应用 ICD、换人和捕获重放一致；角色动作由固定源手工映射，不验证完整数据库适配。外部安柏在 154/250 帧快照，本地在 164/260 帧命中时读取；本例面板恒定，数值上下文相同，不能据此验证变动增益的快照时机。两人起止能量均为 0、无产球，仅证明没有凭空增能，不证明能量循环或 ER 需求。没有覆盖完整角色/武器/被动、命中几何、hitlag、多目标、月/星反应、当前版本全量数据，亦非官方游戏真值。结论属于报告中的源码哈希快照。\n`);
  console.log(JSON.stringify({ status: report.status, capturedAt: report.capturedAt, frames: damage.map((entry) => entry.frame), totalDamage: local.totalDamage, totalResidual: report.comparison.totalResidual, dpsResidual: report.comparison.dpsResidual, standaloneCalculatorDamage: calculator.totals.nonCritical, sourceFiles: sourcePaths.length }, null, 2));
} finally {
  await server.close();
}
