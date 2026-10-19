import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const save = async (suffix, value) => writeFile(join(here, `swap-reference.${suffix}.json`), `${JSON.stringify(value, null, 2)}\n`);
const externalBytes = await readFile(join(here, 'swap-reference.reference.json'));
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
  hashes['packages/sim-core/src/__tests__/fixtures.ts'] = hash(await readFile(join(root, 'packages/sim-core/src/__tests__/fixtures.ts')));
  return hashes;
};
const before = await sourceHashes();
const startedAt = new Date().toISOString();
const start = performance.now();
const server = await createServer({ root, configFile: false, logLevel: 'error', server: { middlewareMode: true, watch: null, hmr: false }, ssr: { noExternal: [/^@genshin-dps-lab\//] } });
try {
  const { makeConfig, neutralStats } = await server.ssrLoadModule('/packages/sim-core/src/__tests__/fixtures.ts');
  const { simulate } = await server.ssrLoadModule('/packages/sim-core/src/simulator.ts');
  const { captureSimulationHit, serializeSimulationHit, parseSimulationHit, replaySimulationHit } = await server.ssrLoadModule('/packages/sim-core/src/calculator-bridge.ts');
  // CharacterDetails is the external initial, pre-TTDS resolved snapshot. It
  // retains real BaseATK at index24 and final ATK at5. Restore that base, not
  // a damage event's already-buffed ATK. Other static HP/DEF bonuses are held
  // as fixed deltas because this fixture exercises no HP/DEF scaling.
  const characters = reference.characterDetails.map(actor => {
    const s = actor.snapshot;
    return { id: actor.name, name: actor.name, element: actor.element, color: '#555555', level: actor.level,
      energyMax: actor.name === 'kaeya' ? 60 : 80, initialEnergy: 0,
      stats: { ...neutralStats, baseAtk: s[24], flatAtk: s[5] - s[24], atkPct: 0,
        baseHp: s[23], flatHp: s[3] - s[23], baseDef: s[25], flatDef: s[2] - s[25],
        em: s[8], critRate: s[9], critDmg: s[10], dmgBonus: s[21], energyRecharge: s[7] } };
  });
  const rotations = reference.actualSwaps.map((swap, index) => ({ id: `conditioned-swap-${index}`, actorId: swap.nextActorId,
    name: `外部已观测实际切换完成 @${swap.frame}`, at: swap.frame / 60, __order: index * 2 }));
  reference.hits.forEach((hit, index) => {
    const c = hit.rawCalculationFields;
    rotations.push({ id: `conditioned-host-${index}`, actorId: hit.actorId, name: `外部已观测宿主 ${hit.sourceAbil}`,
      at: hit.sourceFrame / 60, __order: 100 + index,
      hits: [{ id: `reference-hit-${index}`, offset: (hit.frame - hit.sourceFrame) / 60, scaling: c.talent,
        element: hit.rawDamage.logs.ele, attackTag: hit.sourceAbil === 'Frostgnaw' ? 'skill' : 'normal',
        snapshot: hit.snapshotFrame === hit.sourceFrame ? 'action' : 'hit',
        targeting: { targetId: 'enemy-0', outcome: 'landed' } }],
    });
  });
  rotations.sort((a, b) => a.at - b.at || a.__order - b.__order);
  const config = makeConfig({ dataVersion: `external-gcsim-${reference.sourceRevision}-ttds-context`,
    randomSeed: 'local-ttds-independent-controlled-seed',
    meta: { name: '真实外部基础面板与实际切换时刻的讨龙条件对照', version: '1', verificationStatus: 'user-supplied' },
    duration: 36, cycleLength: 36, characters,
    enemy: { level: 90, resistance: 0.1, defReduction: 0, targets: [{ id: 'enemy-0', name: '外部固定单目标', position: { x: 0, y: 2 }, hitboxRadius: 2 }] },
    thrillingTalesModel: { mode: 'fixed-source-no-character-hitlag-v1', actors: [{ actorId: 'barbara', refinement: 1 }, { actorId: 'lisa', refinement: 5 }] },
    rotation: rotations.map(({ __order, ...action }) => action),
  });
  await save('local-config', config);
  // Exactly one local simulation. Explicit completed-swap timestamps are
  // modeled by ordinary legacy actor transitions, not by an animation DSL.
  const result = simulate(config, { execution: { criticalSampling: 'seeded-random-v1', detailedTraces: true } });
  await save('local-result', result);
  const errors = [];
  const compare = (actual, expected, description) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push({ description, actual, expected });
  };
  compare(result.damageEvents.length, reference.hits.length, 'damage count');
  const comparisons = [];
  for (let index = 0; index < reference.hits.length; index++) {
    const expected = reference.hits[index];
    const actual = result.damageEvents.find(event => event.hitId === `reference-hit-${index}`);
    if (!actual) { errors.push({ description: `missing hit ${index}` }); continue; }
    const stats = actual.statsBeforeDamage;
    const row = { index, externalFrame: expected.frame, localFrame: actual.frame, externalSnapshotFrame: expected.snapshotFrame,
      snapshotMode: actual.snapshot, externalDamage: expected.damage, localDamage: actual.finalDamage,
      absoluteDamageResidual: Math.abs(expected.damage - actual.finalDamage),
      externalBaseAtk: expected.baseAtk, localBaseAtk: stats.baseAtk,
      externalAtkPercent: expected.atkPercent, localAtkPercent: stats.atkPct,
      externalResolvedAtk: expected.resolvedAtk, localResolvedAtk: stats.baseAtk * (1 + stats.atkPct) + stats.flatAtk,
    };
    compare(actual.frame, expected.frame, `hit ${index} frame`);
    compare(actual.finalDamage, expected.damage, `hit ${index} external damage`);
    compare(stats.baseAtk, expected.baseAtk, `hit ${index} base ATK`);
    compare(stats.atkPct, expected.atkPercent, `hit ${index} ATK%`);
    compare(row.localResolvedAtk, expected.resolvedAtk, `hit ${index} resolved ATK`);
    try {
      const capture = captureSimulationHit(result, actual.id);
      const serialized = serializeSimulationHit(capture);
      await writeFile(join(here, `swap-reference.hit-${index}.capture.json`), serialized);
      const replay = replaySimulationHit(parseSimulationHit(serialized));
      await save(`hit-${index}.replay`, replay);
      row.replay = { reproducedDamage: replay.reproducedDamage, difference: replay.difference,
        absoluteExternalResidual: Math.abs(replay.reproducedDamage - expected.damage), thrillingTales: replay.thrillingTales ?? [] };
      compare(replay.difference, 0, `hit ${index} capture difference`);
      compare(replay.reproducedDamage, expected.damage, `hit ${index} capture external damage`);
    } catch (error) { row.error = String(error?.stack ?? error); errors.push({ description: `hit ${index} capture error`, error: row.error }); }
    comparisons.push(row);
  }
  const localSwaps = result.actionLog.filter(row => row.actionId.startsWith('conditioned-swap-')).map(row => ({ frame: row.frame, actorId: row.actorId }));
  compare(localSwaps, reference.actualSwaps.map(row => ({ frame: row.frame, actorId: row.nextActorId })), 'explicit completed swap events');
  const expectedAttempts = reference.actualSwaps.filter(row => row.derivedOutcome).map(row => ({ frame: row.frame,
    ownerId: row.previousActorId, recipientId: row.nextActorId, refinement: row.refinement, coefficient: row.sourceCoefficient,
    outcome: row.derivedOutcome === 'recipient-already-present' ? 'recipient-already-buffed' : row.derivedOutcome,
    cooldownExpiresFrameBefore: row.ownerCooldownExpiryBefore, cooldownExpiresFrameAfter: row.ownerCooldownExpiryAfter }));
  const actualAttempts = (result.thrillingTalesLog ?? []).map(row => Object.fromEntries(Object.keys(expectedAttempts[0]).map(key => [key, row[key]])));
  compare(actualAttempts, expectedAttempts, 'source-derived TTDS attempts and owner cooldowns');
  for (const frame of [602, 1803]) {
    const row = result.thrillingTalesLog?.find(entry => entry.frame === frame);
    compare(row?.recipientExpiresFrameBefore, frame, `recipient presence before equality${frame}`);
    compare(row?.recipientExpiresFrameAfter, frame, `recipient presence after equality${frame}`);
  }
  compare(result.totalDamage, reference.externalSummary.totalDamage, 'total damage');
  const after = await sourceHashes();
  compare(after, before, 'source freeze during comparison');
  const metrics = { status: errors.length ? 'failed' : 'passed', command: 'node docs/cross-validation/ttds/compare-local.mjs',
    startedAt, elapsedSeconds: (performance.now() - start) / 1000, nodeVersion: process.version,
    externalReferenceSha256: hash(externalBytes), scriptSha256: hash(await readFile(fileURLToPath(import.meta.url))),
    sourceHashesBefore: before, sourceHashesAfter: after, sourceUnchanged: JSON.stringify(before) === JSON.stringify(after),
    localSimulationInvocations: 1, externalInvocations: 0,
    panelRestoration: 'Initial external CharacterDetails BaseATK retained, initial atkPct0 and residual static flatAtk; no TTDS-buffed resolved ATK used as input. Other static HP/DEF deltas flattened only; no HP/DEF mechanics exercised.',
    scope: 'External actual completed-swap and host action/snapshot/hit times are explicit inputs, represented by legacy actor transitions. Tests real TTDS lifecycle and independent result/capture verification; does not certify animation legality, source random energy, same-seed parity, or unobserved owner-equality/R5-grant branches.',
    comparisons, expectedAttempts, actualAttempts, localSwaps, thrillingTalesLog: result.thrillingTalesLog,
    localTotalDamage: result.totalDamage, externalTotalDamage: reference.externalSummary.totalDamage,
    totalAbsoluteResidual: Math.abs(result.totalDamage - reference.externalSummary.totalDamage), errors,
  };
  await save('local-metrics', metrics);
  console.log(JSON.stringify({ status: metrics.status, elapsedSeconds: metrics.elapsedSeconds, hits: comparisons.map(row => ({ index: row.index,
    frame: row.localFrame, damage: row.localDamage, residual: row.absoluteDamageResidual, atkPercent: row.localAtkPercent,
    replayDifference: row.replay?.difference })), actualAttempts, totalAbsoluteResidual: metrics.totalAbsoluteResidual, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
} catch (error) {
  await save('local-error', { startedAt, error: String(error?.stack ?? error), sourceHashesBefore: before });
  throw error;
} finally { await server.close(); }
