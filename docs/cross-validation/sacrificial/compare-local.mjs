// Prepared for one controlled local run after the runtime/schema freeze.
// This script never invokes gcsim and never injects a reset or cooldown log.
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';

if (process.env.SACRIFICIAL_EXTERNAL_LOCAL_READY !== '1') throw new Error('Await the explicit runtime/schema freeze before this one local run.');
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const stem = 'sucrose-charge-reference';
const seed = 'sacrificial-consumer-reference';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const save = async (suffix, value) => writeFile(join(here, `${stem}.${suffix}.json`), `${JSON.stringify(value, null, 2)}\n`);
const exists = path => access(path).then(() => true, () => false);
if (await exists(join(here, `${stem}.local-config.json`))) throw new Error('A local attempt already exists; preserve it and obtain an explicit scoped rerun decision.');
const externalBytes = await readFile(join(here, `${stem}.reference.json`));
const reference = JSON.parse(externalBytes);
const sourceHashes = async () => {
  const hashes = {};
  for (const packageName of ['sim-core', 'schemas', 'reaction-formulas']) {
    const walk = async directory => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.name === '__tests__') continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await walk(path);
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) hashes[relative(root, path)] = hash(await readFile(path));
      }
    };
    await walk(join(root, 'packages', packageName, 'src'));
  }
  const fixture = 'packages/sim-core/src/__tests__/fixtures.ts';
  hashes[fixture] = hash(await readFile(join(root, fixture)));
  return hashes;
};
const before = await sourceHashes();
const startedAt = new Date().toISOString();
const start = performance.now();
const server = await createServer({ root, configFile: false, logLevel: 'error', server: { middlewareMode: true, watch: null, hmr: false }, ssr: { noExternal: [/^@genshin-dps-lab\//] } });
let simulationInvocations = 0;
try {
  const { makeConfig, neutralStats } = await server.ssrLoadModule('/packages/sim-core/src/__tests__/fixtures.ts');
  const { simulate } = await server.ssrLoadModule('/packages/sim-core/src/simulator.ts');
  const { simulationResultSchema } = await server.ssrLoadModule('/packages/schemas/src/index.ts');
  const { captureSimulationHit, serializeSimulationHit, parseSimulationHit, replaySimulationHit } = await server.ssrLoadModule('/packages/sim-core/src/calculator-bridge.ts');
  const actor = reference.characterDetails[0];
  const panel = actor.snapshot;
  const source = reference.sourceRules;
  const abilityId = 'sucrose-source-c1-skill';
  const hitId = 'sucrose-source-e-hit';
  const config = makeConfig({
    dataVersion: `external-gcsim-${reference.revision}-sucrose-sacrificial-context`, randomSeed: seed,
    meta: { name: '砂糖 C1 祭礼：外部固定技能时序的真实充能对照', version: '1', verificationStatus: 'provisional',
      note: '只声明固定 C1/Lv1/A0/T1 无卡肉 E 的三个目标与源时序；不声明完整角色。独立本地随机流，未注入触发或恢复日志。' },
    duration: 34, cycleLength: 34,
    characters: [{ id: 'sucrose', name: '砂糖 C1/Lv1/A0/T1', element: 'anemo', color: '#71b5a3', level: actor.level,
      energyMax: 80, initialEnergy: 0,
      stats: { ...neutralStats, baseAtk: panel[24], atkPct: 0, flatAtk: panel[5] - panel[24],
        baseHp: panel[23], hpPct: 0, flatHp: panel[3] - panel[23],
        baseDef: panel[25], defPct: 0, flatDef: panel[2] - panel[25],
        em: panel[8], critRate: panel[9], critDmg: panel[10], dmgBonus: panel[21], energyRecharge: panel[7] } }],
    enemy: { level: 90, resistance: 0.1, defReduction: 0,
      targets: reference.targetDetails.map((target, index) => ({ id: `enemy-${index}`, name: `固定外部目标 ${index + 1}`,
        position: { x: target.position.x ?? 0, y: target.position.y ?? 0 }, hitboxRadius: target.position.r })) },
    rotation: [],
    sacrificialModel: { mode: 'fixed-source-no-character-hitlag-v1', actors: [{ actorId: 'sucrose', weaponId: 'sacrificialfragments', refinement: 5 }] },
    timeline: { mode: 'legal-frame-v1', fps: 60, legalityMode: 'strict', initialActiveCharacterId: 'sucrose', swapFrames: 1,
      abilities: [{ id: abilityId, actorId: 'sucrose', name: 'Astable Anemohypostasis Creation-6308', kind: 'skill',
        cancelFrame: 11, cancelFrames: { normal: 57, charge: 56, skill: 56, burst: 57, dash: 11, jump: 11, swap: 56 },
        animationEndFrame: 68, cooldownFrames: source.cooldownDurationFrames,
        cooldownStartFrame: source.cooldownSetDelayFrames, maxCharges: source.maximumCharges,
        chargeRecoveryFrames: source.cooldownDurationFrames, actionPhase: 'after-frame-tasks-v1',
        hits: [{ id: hitId, label: '风灵作成·陆叁零捌', frame: source.hitDelayFrames,
          scaling: reference.numericSnapshots[0].talentMultiplier, scalingStat: 'atk', element: 'anemo', attackTag: 'skill',
          snapshot: 'action', geometry: { kind: 'circle', coordinateSpace: 'world', origin: { x: 0, y: 5 }, radius: 6 },
          application: { gaugeUnits: 1, icd: { mode: 'no-icd-v1' } } }],
        particles: [{ id: 'sucrose-four-anemo', source: 'sucrose', element: 'anemo', count: source.particleCount,
          travelFrames: source.particleTravelFrames,
          trigger: { kind: 'hit-confirm', hitIds: [hitId], internalCooldown: { key: 'sucrose-particle-icd', durationFrames: source.particleIcdFrames } } }],
      }],
      commands: reference.actionLogs.map(row => ({ type: 'skill', actorId: 'sucrose', abilityId, atFrame: row.frame })),
    },
    reactionEngine: { mode: 'aura-v3', initialAura: [], icdProfiles: {} },
  });
  await save('local-config', config);
  // Exactly one simulation; the legal engine performs delayed consumption,
  // real damage-triggered probability checks, queue reset, recast and recovery.
  simulationInvocations += 1;
  const result = simulate(config, { randomSeed: seed, critMode: 'noCrit', execution: { detailedTraces: true } });
  await save('local-result', result);
  const errors = [];
  const compare = (actual, expected, description) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push({ description, actual, expected });
  };
  let resultSchemaValid = false;
  try { simulationResultSchema.parse(JSON.parse(JSON.stringify(result))); resultSchemaValid = true; }
  catch (error) { errors.push({ description: 'complete result JSON integrity', error: String(error?.stack ?? error) }); }
  compare(result.damageEvents.length, reference.numericSnapshots.length, 'actual damage count');
  compare(result.timelineExecution.commandResults.map(row => row.startFrame), reference.actionLogs.map(row => row.frame), 'accepted legal command frames');
  compare(result.timelineExecution.commandResults.map(row => row.status), ['executed', 'executed', 'executed'], 'legal commands executed');
  const comparisons = [];
  for (const [index, expected] of reference.numericSnapshots.entries()) {
    const actual = result.damageEvents.find(row => row.frame === expected.frame && row.targetId === `enemy-${expected.target - 1}`);
    if (!actual) { errors.push({ description: `missing hit ${index}`, frame: expected.frame, target: expected.target }); continue; }
    const row = { index, externalFrame: expected.frame, localFrame: actual.frame, targetId: actual.targetId,
      externalSnapshotFrame: expected.snapshotFrame, localSnapshotMode: actual.snapshot,
      externalDamage: expected.damage, localDamage: actual.finalDamage,
      absoluteDamageResidual: Math.abs(actual.finalDamage - expected.damage),
      externalFinalAtk: expected.finalAtk, localFinalAtk: actual.statsBeforeDamage.baseAtk * (1 + actual.statsBeforeDamage.atkPct) + actual.statsBeforeDamage.flatAtk };
    compare(actual.finalDamage, expected.damage, `hit ${index} exact external damage`);
    compare(row.localFinalAtk, expected.finalAtk, `hit ${index} actual resolved ATK`);
    compare(actual.statsBeforeDamage.critRate, expected.critRate, `hit ${index} CR`);
    try {
      const capture = captureSimulationHit(result, actual.id);
      const serialized = serializeSimulationHit(capture);
      await writeFile(join(here, `${stem}.hit-${index}.capture.json`), serialized);
      const replay = replaySimulationHit(parseSimulationHit(serialized));
      await save(`hit-${index}.replay`, replay);
      row.replay = { reproducedDamage: replay.reproducedDamage, difference: replay.difference,
        absoluteExternalResidual: Math.abs(replay.reproducedDamage - expected.damage) };
      compare(replay.difference, 0, `hit ${index} capture JSON replay difference`);
      compare(replay.reproducedDamage, expected.damage, `hit ${index} capture external damage`);
    } catch (error) { row.captureError = String(error?.stack ?? error); errors.push({ description: `hit ${index} capture`, error: row.captureError }); }
    comparisons.push(row);
  }
  const localCooldowns = (result.skillCooldownLog ?? []).filter(row => row.operation !== 'stale-worker').map(row => ({ frame: row.frame,
    operation: row.operation, availableCharges: row.stateAfter.availableCharges,
    queue: row.stateAfter.queue.map(entry => entry.recoveryFrames) }));
  const expectedCooldowns = reference.cooldownLogs.map(row => ({ frame: row.frame,
    operation: row.msg.endsWith('triggered') ? 'start' : row.msg.endsWith('reset') ? 'reset' : 'recover',
    availableCharges: row.logs.charges_remain,
    queue: row.logs.cooldown_queue === '' ? [] : row.logs.cooldown_queue.split(',').map(Number) }));
  compare(localCooldowns, expectedCooldowns, 'actual delayed consumption, one-charge reset and serial recovery');
  const localParticles = result.energyLog.filter(row => row.kind === 'particle' && row.applied).map(row => ({ frame: row.frame,
    count: row.particleCount, element: row.particleElement, energyBefore: row.energyBefore, energyAfter: row.energyAfter, gainedEnergy: row.gainedEnergy }));
  const expectedParticles = reference.particleLogs.map(row => ({ frame: row.frame, count: row.logs.count, element: row.logs.ele,
    energyBefore: row.logs.pre_recovery, energyAfter: row.logs.post_recovery, gainedEnergy: row.logs.amt }));
  compare(localParticles, expectedParticles, 'actual hit-confirmed particles including recast');
  const attempts = result.sacrificialLog ?? [];
  compare(attempts.map(row => [row.frame, row.outcome]), [
    [43, 'skill-ready'], [43, 'skill-ready'], [43, 'skill-ready'],
    [99, 'triggered'], [99, 'cooldown-blocked'], [99, 'cooldown-blocked'],
    [155, 'cooldown-blocked'], [155, 'cooldown-blocked'], [155, 'cooldown-blocked'],
  ], 'actual source-filter outcomes for all nine damage callbacks');
  compare(attempts.filter(row => row.roll !== null).length, 1, 'one actual Sacrificial random draw');
  compare(attempts.find(row => row.outcome === 'triggered')?.cooldownExpiresFrameAfter, 1059, 'actual weapon ICD expiration');
  compare(result.totalDamage, reference.debugTotalDamage, 'total external damage');
  const after = await sourceHashes();
  compare(after, before, 'frozen source unchanged during comparison');
  const metrics = { status: errors.length ? 'failed' : 'passed',
    command: 'SACRIFICIAL_EXTERNAL_LOCAL_READY=1 node docs/cross-validation/sacrificial/compare-local.mjs',
    startedAt, elapsedSeconds: (performance.now() - start) / 1000, nodeVersion: process.version,
    localSimulationInvocations: simulationInvocations, externalInvocations: 0,
    externalReferenceSha256: hash(externalBytes), scriptSha256: hash(await readFile(fileURLToPath(import.meta.url))),
    sourceHashesBefore: before, sourceHashesAfter: after, sourceUnchanged: JSON.stringify(before) === JSON.stringify(after),
    randomPolicy: { seed, stream: 'sacrificial-v1', algorithm: 'fnv1a32-mulberry32-v1', matchesExternalSequence: false,
      fixtureSelection: 'One already documented local seed whose first draw succeeds was selected before running; no sample sweep or damage fitting.',
      externalRollValue: null, localActualDraws: attempts.filter(row => row.roll !== null).map(row => ({ frame: row.frame, roll: row.roll, drawIndex: row.drawIndex, outcome: row.outcome })) },
    scope: 'Actual legal E commands at source inputs 1/57/113; source cooldown start +9, max two serial charges and genuine damage-triggered reset. Fixed source AOE geometry, nine ordinary hits and hit-confirmed particles. No all-character, current-game, hitlag, failed-roll, expiry-boundary or cross-engine same-seed certification.',
    externalWarnings: reference.warnings, resultSchemaValid, comparisons, localCooldowns, expectedCooldowns,
    localParticles, expectedParticles, sacrificialLog: attempts, skillCooldownLog: result.skillCooldownLog,
    localTotalDamage: result.totalDamage, externalTotalDamage: reference.debugTotalDamage,
    totalAbsoluteResidual: Math.abs(result.totalDamage - reference.debugTotalDamage), errors,
  };
  await save('local-metrics', metrics);
  console.log(JSON.stringify({ status: metrics.status, elapsedSeconds: metrics.elapsedSeconds,
    hitCount: comparisons.length, residuals: comparisons.map(row => row.absoluteDamageResidual),
    replayDifferences: comparisons.map(row => row.replay?.difference), localCooldowns, localParticles,
    actualDraws: metrics.randomPolicy.localActualDraws, totalAbsoluteResidual: metrics.totalAbsoluteResidual, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
} catch (error) {
  await save('local-error', { startedAt, elapsedSeconds: (performance.now() - start) / 1000, localSimulationInvocations: simulationInvocations,
    error: String(error?.stack ?? error), sourceHashesBefore: before, sourceHashesAfter: await sourceHashes() });
  throw error;
} finally { await server.close(); }
