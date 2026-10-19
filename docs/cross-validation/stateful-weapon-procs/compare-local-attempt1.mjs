// One local combat after production owners freeze. Never invokes the external CLI.
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';

if (process.env.STATEFUL_EXTERNAL_LOCAL_READY !== '1') throw new Error('Await runtime/schema/calculator freeze.');
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../../..');
const stem = 'diona-endoftheline-reference';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const save = async (suffix, value) => writeFile(join(here, `${stem}.${suffix}.json`), `${JSON.stringify(value, null, 2)}\n`);
if (await access(join(here, `${stem}.local-config.json`)).then(() => true, () => false)) throw new Error('Preserve the existing local attempt; do not silently repeat it.');
const referenceBytes = await readFile(join(here, `${stem}.reference.json`));
const reference = JSON.parse(referenceBytes);
const sourceHashes = async () => {
  const hashes = {};
  for (const name of ['sim-core', 'schemas', 'reaction-formulas']) {
    const walk = async directory => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.name === '__tests__') continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await walk(path);
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) hashes[relative(root, path)] = hash(await readFile(path));
      }
    };
    await walk(join(root, 'packages', name, 'src'));
  }
  const fixture = 'packages/sim-core/src/__tests__/fixtures.ts';
  hashes[fixture] = hash(await readFile(join(root, fixture)));
  return hashes;
};
const before = await sourceHashes(), startedAt = new Date().toISOString(), start = performance.now();
const server = await createServer({ root, configFile: false, logLevel: 'error', server: { middlewareMode: true, watch: null, hmr: false }, ssr: { noExternal: [/^@genshin-dps-lab\//] } });
let simulationInvocations = 0;
try {
  const { makeConfig, neutralStats } = await server.ssrLoadModule('/packages/sim-core/src/__tests__/fixtures.ts');
  const { simulate } = await server.ssrLoadModule('/packages/sim-core/src/simulator.ts');
  const { simulationResultSchema } = await server.ssrLoadModule('/packages/schemas/src/index.ts');
  const { captureSimulationHit, serializeSimulationHit, parseSimulationHit, replaySimulationHit } = await server.ssrLoadModule('/packages/sim-core/src/calculator-bridge.ts');
  const { createWeaponProcCalculatorDocument } = await server.ssrLoadModule('/packages/sim-core/src/weapon-proc-calculator.ts');
  const { calculateDocument, serializeCalculatorDocument, parseCalculatorDocument } = await server.ssrLoadModule('/packages/sim-core/src/calculator.ts');
  const host = reference.numericSnapshots[0];
  const skill = reference.numericSnapshots.find(row => row.kind === 'host-skill');
  const normalRows = ['Normal 0', 'Normal 1'].map(name => reference.numericSnapshots.find(row => row.sourceAbility === name));
  const skillId = 'source-diona-tap-e';
  const normalIds = ['source-diona-n1', 'source-diona-n2'];
  const config = makeConfig({
    dataVersion: `external-gcsim-${reference.revision}-diona-endoftheline-context`,
    randomSeed: 'local-endoftheline-controlled-context',
    meta: { name: '竭泽两轮三次追击：固定来源实测面板与显式帧', version: '1', verificationStatus: 'provisional',
      note: '真实 legal skill 事件自行激活追击；宿主动作/命中帧为外部观测输入。静态面板；不认证完整迪奥娜、箭矢快照时钟、随机产球或同源 RNG。' },
    duration: 20, cycleLength: 20, rotation: [],
    characters: [{ id: 'diona', name: '迪奥娜 C0/A0/Lv1/T1', element: 'cryo', color: '#8eb6d8', level: 1, energyMax: 80, initialEnergy: 0,
      stats: { ...neutralStats, baseAtk: host.baseAtk, atkPct: host.atkPercent, flatAtk: host.flatAtk,
        baseHp: host.baseHp, hpPct: 0, flatHp: 0, baseDef: host.baseDef, defPct: 0, flatDef: 0,
        em: host.em, critRate: host.critRate, critDmg: host.critDamage, dmgBonus: host.universalDamageBonus, energyRecharge: host.energyRecharge } }],
    enemy: { level: 90, resistance: 0.1, defReduction: 0,
      targets: reference.targetDetails.map((target, index) => ({ id: `enemy-${index}`, name: `外部固定目标 ${index + 1}`,
        position: { x: target.position.x ?? 0, y: target.position.y ?? 0 }, hitboxRadius: target.position.r })) },
    weaponProcModel: { mode: 'fixed-source-no-character-hitlag-v1', actors: [{ actorId: 'diona', weaponId: 'endoftheline', refinement: 5, physicalDamageBonus: 0 }] },
    timeline: { mode: 'legal-frame-v1', fps: 60, legalityMode: 'strict', initialActiveCharacterId: 'diona', swapFrames: 1,
      abilities: [{ id: skillId, actorId: 'diona', name: 'Icy Paws (Press)', kind: 'skill', cancelFrame: 11,
        cancelFrames: { normal: 33, skill: 34, burst: 33, dash: 11, jump: 11, swap: 16 },
        animationEndFrame: 34, cooldownFrames: 360, cooldownStartFrame: 5,
        maxCharges: 1, chargeRecoveryFrames: 360, actionPhase: 'after-frame-tasks-v1',
        hits: [10, 11].map((frame, index) => ({ id: `diona-paw-${index}`, frame, scaling: skill.talentMultiplier,
          scalingStat: 'atk', element: 'cryo', attackTag: 'skill', snapshot: 'action',
          geometry: { kind: 'circle', coordinateSpace: 'world', origin: { x: 0, y: 2 }, radius: 0.5 },
          application: { gaugeUnits: 1, icd: { mode: 'fixed-gcsim-application-v1', icdTag: 'elemental-art', groupId: 'default' } } })),
      }, ...normalRows.map((row, index) => ({ id: normalIds[index], actorId: 'diona', name: row.sourceAbility, kind: 'normal',
        cancelFrame: [19, 11][index], animationEndFrame: [30, 21][index], cooldownFrames: 0, actionPhase: 'after-frame-tasks-v1',
        hits: [{ id: `diona-normal-${index}`, frame: row.frame - row.sourceFrame, scaling: row.talentMultiplier,
          scalingStat: 'atk', element: 'physical', attackTag: 'normal', snapshot: 'hit' }] }))],
      commands: reference.actionLogs.filter(row => row.logs.action === 'skill' || row.logs.action === 'attack').map(row => ({
        type: row.logs.action === 'skill' ? 'skill' : 'normal', actorId: 'diona', atFrame: row.frame,
        abilityId: row.logs.action === 'skill' ? skillId : normalIds[normalRows.findIndex(normal => reference.numericSnapshots.some(
          hit => hit.sourceFrame === row.frame && hit.sourceAbility === normal.sourceAbility))] })) },
    reactionEngine: { mode: 'aura-v3', initialAura: [], icdProfiles: {} },
  });
  await save('local-config', config);
  simulationInvocations += 1;
  const result = simulate(config, { critMode: 'noCrit', execution: { detailedTraces: true } });
  await save('local-result', result);
  const errors = [];
  const compare = (actual, expected, description) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push({ description, actual, expected });
  };
  let resultSchemaValid = false;
  try { simulationResultSchema.parse(JSON.parse(JSON.stringify(result))); resultSchemaValid = true; }
  catch (error) { errors.push({ description: 'complete result JSON integrity', error: String(error?.stack ?? error) }); }
  compare(result.damageEvents.length, reference.numericSnapshots.length, 'six paws / four normal / six actual proc hits');
  const comparisons = [];
  for (const [index, expected] of reference.numericSnapshots.entries()) {
    const proc = expected.kind === 'weapon-proc';
    const actual = result.damageEvents.find(row => row.frame === expected.frame && (row.weaponProcLogId !== undefined) === proc);
    if (!actual) { errors.push({ description: `missing actual hit ${index}` }); continue; }
    const row = { index, kind: expected.kind, externalFrame: expected.frame, localFrame: actual.frame,
      externalDamage: expected.damage, localDamage: actual.finalDamage, absoluteDamageResidual: Math.abs(actual.finalDamage - expected.damage),
      externalHostSnapshotFrame: expected.snapshotFrame };
    compare(actual.finalDamage, expected.damage, `hit ${index} exact external damage`);
    compare(actual.statsBeforeDamage.baseAtk, expected.baseAtk, `hit ${index} actual base ATK`);
    try {
      const serialized = serializeSimulationHit(captureSimulationHit(result, actual.id));
      await writeFile(join(here, `${stem}.hit-${index}.capture.json`), serialized);
      const replay = replaySimulationHit(parseSimulationHit(serialized));
      await save(`hit-${index}.replay`, replay);
      row.replay = { reproducedDamage: replay.reproducedDamage, difference: replay.difference,
        absoluteExternalResidual: Math.abs(replay.reproducedDamage - expected.damage) };
      compare(replay.difference, 0, `hit ${index} capture JSON damage residual`);
      compare(replay.reproducedDamage, expected.damage, `hit ${index} capture JSON external damage`);
      if (proc) {
        const log = result.weaponProcLog?.find(entry => entry.id === actual.weaponProcLogId);
        row.localProcLog = log;
        compare(log?.frame, expected.sourceFrame, `proc ${index} trigger snapshot frame`);
        compare(log?.coefficient, expected.talentMultiplier, `proc ${index} source coefficient`);
        const document = createWeaponProcCalculatorDocument({ weaponId: 'endoftheline', refinement: 5, characterLevel: 1,
          build: { mode: 'manual-final', stats: { atk: expected.finalAtk, hp: expected.baseHp, def: expected.baseDef, em: expected.em,
            critRate: expected.critRate, critDamage: expected.critDamage, energyRecharge: expected.energyRecharge },
            source: '原始未舍入竭泽触发快照；本独立输入只计算已经触发的一段，不预设激活／冷却状态。' },
          enemy: { level: expected.enemyLevel, resistance: expected.resistance, defenseAdjustment: 0, defenseIgnore: 0 }, damageBonus: 0 });
        const calculated = calculateDocument(document);
        const restored = calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(document)));
        await save(`hit-${index}.calculator`, document);
        await save(`hit-${index}.calculator-result`, calculated);
        row.standalone = { status: calculated.status, nonCritical: calculated.totals?.nonCritical,
          absoluteExternalResidual: Math.abs(calculated.totals?.nonCritical - expected.damage),
          jsonTotalsEqual: JSON.stringify(restored.totals) === JSON.stringify(calculated.totals) };
        compare(calculated.status, 'calculated', `proc ${index} standalone status`);
        compare(calculated.totals?.nonCritical, expected.damage, `proc ${index} standalone external damage`);
        compare(restored.totals, calculated.totals, `proc ${index} standalone JSON totals`);
      }
    } catch (error) { row.error = String(error?.stack ?? error); errors.push({ description: `hit ${index} capture/standalone`, error: row.error }); }
    comparisons.push(row);
  }
  const triggers = result.weaponProcLog?.filter(row => row.outcome === 'triggered') ?? [];
  compare(triggers.map(row => row.frame), reference.observed.procTriggerFrames, 'six real trigger callbacks');
  compare(triggers.map(row => row.damageFrame), reference.observed.procDamageFrames, 'six queued next-frame hits');
  compare(triggers.map(row => row.stateAfter?.procCount), reference.observed.procCountSequence, 'source proc counter after each trigger');
  compare(triggers.filter(row => row.stateAfter?.effectExpiresFrame === null).map(row => row.frame),
    reference.observed.effectEndedFrames, 'third trigger actually removes the effect before its queued hit');
  compare(triggers.map(row => row.stateAfter?.hitCooldownExpiresFrame), [131, 309, 309, 930, 1109, 1109],
    'third trigger retains the stale previous ICD and does not write a new one');
  const lifecycle = result.weaponProcLifecycleLog?.filter(row => row.kind === 'skill') ?? [];
  compare(lifecycle.map(row => ({ frame: row.frame, outcome: row.outcome })), [
    { frame: 1, outcome: 'window-activated' }, { frame: 400, outcome: 'activation-cooldown-blocked' },
    { frame: 800, outcome: 'window-activated' }], 'accepted legal skill events and true activation ICD');
  compare(result.totalDamage, reference.externalSampleTotal, 'total external damage');
  const after = await sourceHashes();
  compare(after, before, 'frozen production source unchanged');
  const metrics = { status: errors.length ? 'failed' : 'passed', startedAt, elapsedSeconds: (performance.now() - start) / 1000,
    command: 'STATEFUL_EXTERNAL_LOCAL_READY=1 node docs/cross-validation/stateful-weapon-procs/compare-local.mjs', nodeVersion: process.version,
    localSimulationInvocations: simulationInvocations, externalInvocations: 0, resultSchemaValid,
    externalReferenceSha256: hash(referenceBytes), scriptSha256: hash(await readFile(fileURLToPath(import.meta.url))),
    sourceHashesBefore: before, sourceHashesAfter: after, sourceUnchanged: JSON.stringify(before) === JSON.stringify(after),
    scope: 'Actual legal skill activation and stateful weapon runtime; explicit externally observed host action/hit frames, static exact panel. No whole-character animation compiler certification, source normal delayed-snapshot clock (local hit snapshot is numerically equal only because panel is static), shield behavior, particles/normal energy or RNG alignment.',
    comparisons, weaponProcLog: result.weaponProcLog, weaponProcLifecycleLog: result.weaponProcLifecycleLog,
    localTotalDamage: result.totalDamage, externalTotalDamage: reference.externalSampleTotal,
    totalAbsoluteResidual: Math.abs(result.totalDamage - reference.externalSampleTotal), errors };
  await save('local-metrics', metrics);
  console.log(JSON.stringify({ status: metrics.status, elapsedSeconds: metrics.elapsedSeconds, resultSchemaValid,
    hitCount: comparisons.length, maximumHitResidual: Math.max(...comparisons.map(row => row.absoluteDamageResidual)),
    triggers: triggers.map(({ frame, damageFrame, stateBefore, stateAfter }) => ({ frame, damageFrame, stateBefore, stateAfter })),
    lifecycle, totalAbsoluteResidual: metrics.totalAbsoluteResidual, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
} catch (error) {
  await save('local-error', { startedAt, elapsedSeconds: (performance.now() - start) / 1000,
    localSimulationInvocations: simulationInvocations, error: String(error?.stack ?? error),
    sourceHashesBefore: before, sourceHashesAfter: await sourceHashes() });
  throw error;
} finally { await server.close(); }
