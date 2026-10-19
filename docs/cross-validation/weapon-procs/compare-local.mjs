import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const prefix = 'three-procs-reference';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const save = async (suffix, value) => writeFile(join(here, `${prefix}.${suffix}.json`), `${JSON.stringify(value, null, 2)}\n`);
const externalBytes = await readFile(join(here, `${prefix}.reference.json`));
const reference = JSON.parse(externalBytes);
const procReferences = reference.hits.filter(hit => hit.isWeaponProc);
const actorWeapons = Object.fromEntries(reference.characterDetails.map(actor => [actor.name, actor.weapon.name]));
const sourceHashes = async () => {
  const result = {};
  for (const packageName of ['sim-core', 'schemas', 'reaction-formulas']) {
    const walk = async directory => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.name === '__tests__') continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await walk(path);
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) result[relative(root, path)] = hash(await readFile(path));
      }
    };
    await walk(join(root, 'packages', packageName, 'src'));
  }
  result['packages/sim-core/src/__tests__/fixtures.ts'] = hash(await readFile(join(root, 'packages/sim-core/src/__tests__/fixtures.ts')));
  return result;
};
const before = await sourceHashes();
const startedAt = new Date().toISOString();
const start = performance.now();
const server = await createServer({ root, configFile: false, logLevel: 'error', server: { middlewareMode: true, watch: null, hmr: false }, ssr: { noExternal: [/^@genshin-dps-lab\//] } });
const errors = [];
try {
  const { makeConfig, neutralStats } = await server.ssrLoadModule('/packages/sim-core/src/__tests__/fixtures.ts');
  const { simulate } = await server.ssrLoadModule('/packages/sim-core/src/simulator.ts');
  const { captureSimulationHit, serializeSimulationHit, parseSimulationHit, replaySimulationHit } = await server.ssrLoadModule('/packages/sim-core/src/calculator-bridge.ts');
  const { createWeaponProcCalculatorDocument } = await server.ssrLoadModule('/packages/sim-core/src/weapon-proc-calculator.ts');
  const { calculateDocument, serializeCalculatorDocument, parseCalculatorDocument } = await server.ssrLoadModule('/packages/sim-core/src/calculator.ts');
  const elements = { zhongli: 'geo', barbara: 'hydro', amber: 'pyro' };
  const characters = procReferences.map(hit => {
    const s = hit.numericSnapshot;
    return { id: hit.actorId, name: hit.actorId, element: elements[hit.actorId], color: '#555555', level: s.characterLevel, energyMax: 40, initialEnergy: 0,
      stats: { ...neutralStats, baseAtk: s.atk, baseHp: s.hp, baseDef: s.def, em: s.em, critRate: s.critRate, critDmg: s.critDamage, dmgBonus: s.generalDamageBonus } };
  });
  const config = makeConfig({
    dataVersion: `external-gcsim-${reference.sourceRevision}-resolved-proc-context`,
    randomSeed: 'local-weapon-proc-comparison-independent-seed',
    meta: { name: '三武器追击外部面板和已观测宿主命中条件对照', version: '1', verificationStatus: 'user-supplied' },
    duration: 12, cycleLength: 12,
    characters,
    enemy: { level: 90, resistance: 0.1, defReduction: 0, targets: [{ id: 'enemy-0', name: '外部固定静止单目标', position: { x: 0, y: 2 }, hitboxRadius: 2 }] },
    weaponProcModel: { mode: 'fixed-source-no-character-hitlag-v1', actors: procReferences.map(hit => ({ actorId: hit.actorId, weaponId: actorWeapons[hit.actorId], refinement: 1, physicalDamageBonus: hit.numericSnapshot.elementDamageBonus })) },
    rotation: reference.hits.filter(hit => !hit.isWeaponProc).map(hit => ({
      id: `conditioned-host-${hit.id}`, actorId: hit.actorId, name: `已观测宿主 ${hit.sourceAbil} @${hit.frame}`, at: hit.frame / 60,
      hits: [{ id: `host-${hit.id}`, offset: 0, scaling: hit.numericSnapshot.talentCoefficient, element: hit.element, attackTag: 'normal', targeting: { targetId: 'enemy-0', outcome: 'landed' } }],
    })),
  });
  await save('local-config', config);
  // Exactly one local simulation. Host callbacks are explicit observed inputs;
  // this does not claim to reproduce the external action/energy scheduler.
  const result = simulate(config, { execution: { criticalSampling: 'seeded-random-v1', detailedTraces: true } });
  await save('local-result', result);
  const actualProcs = result.damageEvents.filter(hit => hit.weaponProcLogId !== undefined);
  const comparisons = [];
  for (const expected of procReferences) {
    const actual = actualProcs.find(hit => hit.sourceActorId === expected.actorId);
    if (!actual) { errors.push(`Missing proc for ${expected.actorId}`); continue; }
    const log = result.weaponProcLog[actual.weaponProcLogId];
    const row = { weaponId: actorWeapons[expected.actorId], sourceAbil: expected.sourceAbil,
      externalFrame: expected.frame, localFrame: actual.frame,
      externalTriggerFrame: expected.sourceFrame, localTriggerFrame: log.frame,
      externalCooldownExpiryFrame: expected.cooldownStatus.logs.expiry, localCooldownExpiryFrame: log.cooldownExpiresFrameAfter,
      externalDamage: expected.damage, localDamage: actual.finalDamage,
      absoluteDamageResidual: Math.abs(expected.damage - actual.finalDamage),
      parentDamageEventId: actual.parentDamageEventId, localProcLog: log,
    };
    try {
      const captured = captureSimulationHit(result, actual.id);
      const serialized = serializeSimulationHit(captured);
      await writeFile(join(here, `${prefix}.${row.weaponId}.capture.json`), serialized);
      const replay = replaySimulationHit(parseSimulationHit(serialized));
      await save(`${row.weaponId}.replay`, replay);
      row.replay = { reproducedDamage: replay.reproducedDamage, difference: replay.difference, absoluteExternalResidual: Math.abs(replay.reproducedDamage - expected.damage) };
      const s = expected.numericSnapshot;
      const document = createWeaponProcCalculatorDocument({ weaponId: row.weaponId, refinement: 1, characterLevel: s.characterLevel,
        build: { mode: 'manual-final', stats: { atk: s.atk, hp: s.hp, def: s.def, em: s.em, critRate: s.critRate, critDamage: s.critDamage, energyRecharge: 1 }, source: `外部 gcsim ${reference.sourceRevision} 未舍入追击 calc 面板，无重复武器属性` },
        enemy: { level: s.enemyLevel, resistance: s.enemyResistance, defenseAdjustment: s.defenseAdjustment, defenseIgnore: s.defenseIgnore },
        damageBonus: s.generalDamageBonus + s.elementDamageBonus,
      });
      const calculator = calculateDocument(document);
      const restored = calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(document)));
      await save(`${row.weaponId}.calculator`, document);
      await save(`${row.weaponId}.calculator-result`, calculator);
      row.standalone = { status: calculator.status, nonCritical: calculator.totals?.nonCritical, expected: calculator.totals?.expected,
        absoluteExternalResidual: Math.abs(calculator.totals?.nonCritical - expected.damage),
        jsonTotalsEqual: JSON.stringify(restored.totals) === JSON.stringify(calculator.totals),
        sourceCoefficient: document.hits[0].terms[0].coefficient,
      };
      if (row.replay.difference !== 0 || row.replay.absoluteExternalResidual !== 0) errors.push(`${row.weaponId}: replay mismatch`);
      if (row.standalone.status !== 'calculated' || row.standalone.absoluteExternalResidual !== 0 || !row.standalone.jsonTotalsEqual) errors.push(`${row.weaponId}: standalone mismatch`);
    } catch (error) {
      row.error = String(error?.stack ?? error); errors.push(`${row.weaponId}: ${row.error}`);
    }
    if (row.absoluteDamageResidual !== 0 || row.externalFrame !== row.localFrame || row.externalTriggerFrame !== row.localTriggerFrame || row.externalCooldownExpiryFrame !== row.localCooldownExpiryFrame) errors.push(`${row.weaponId}: runtime external mismatch`);
    comparisons.push(row);
  }
  const blockedBoundary = result.weaponProcLog.find(row => row.actorId === 'zhongli' && row.frame === 612);
  if (actualProcs.length !== 3 || blockedBoundary?.outcome !== 'cooldown-blocked') errors.push('Proc count or Halberd inclusive boundary mismatch');
  const after = await sourceHashes();
  if (JSON.stringify(before) !== JSON.stringify(after)) errors.push('Source changed during local comparison');
  const metrics = { status: errors.length ? 'failed' : 'passed', command: 'node docs/cross-validation/weapon-procs/compare-local.mjs', startedAt,
    elapsedSeconds: (performance.now() - start) / 1000, nodeVersion: process.version,
    externalReferenceSha256: hash(externalBytes), scriptSha256: hash(await readFile(fileURLToPath(import.meta.url))),
    sourceHashes: before, sourceUnchangedDuringComparison: JSON.stringify(before) === JSON.stringify(after),
    simulationInvocations: 1, externalInvocations: 0,
    scope: 'Exact external final panels plus explicit observed host callbacks at frames 12/28/35/145/612; actual weapon runtime handles trigger/cooldown/snapshot/+1-frame damage and capture replay. No host animation, aura, particle/energy, or same-seed certification.',
    comparisons, blockedBoundary, localTotalDamage: result.totalDamage, externalTotalDamage: reference.externalSummary.totalDamage,
    totalAbsoluteResidual: Math.abs(result.totalDamage - reference.externalSummary.totalDamage), errors,
  };
  await save('local-metrics', metrics);
  console.log(JSON.stringify({ status: metrics.status, elapsedSeconds: metrics.elapsedSeconds, procCount: actualProcs.length,
    comparison: comparisons.map(row => ({ weaponId: row.weaponId, frame: row.localFrame, damage: row.localDamage, residual: row.absoluteDamageResidual, replay: row.replay, standalone: row.standalone })),
    halberdExpiryFrameOutcome: blockedBoundary?.outcome, totalAbsoluteResidual: metrics.totalAbsoluteResidual, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
} catch (error) {
  await save('local-error', { startedAt, error: String(error?.stack ?? error), sourceHashes: before });
  throw error;
} finally {
  await server.close();
}
