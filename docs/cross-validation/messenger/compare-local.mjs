// One local combat after production owners freeze. Never invokes the external CLI.
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';

if (process.env.MESSENGER_EXTERNAL_LOCAL_READY !== '1') throw new Error('Await runtime/schema/calculator freeze.');
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../../..');
const stem = 'amber-messenger-reference';
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
  const config = makeConfig({
    dataVersion: `external-gcsim-${reference.revision}-amber-messenger-context`,
    randomSeed: 'local-messenger-weak-point-critical-stream',
    meta: { name: '安柏物理瞄准与信使明确弱点必暴对照', version: '1', verificationStatus: 'provisional',
      note: '源weakspot显式条件，不模拟几何识别。宿主动作/命中帧从外部恢复；面板静态，不认证提前10帧的箭矢快照时钟。' },
    duration: 15, cycleLength: 15, rotation: [],
    characters: [{ id: 'amber', name: '安柏 C0/A0/Lv1/T1', element: 'pyro', color: '#f36b35', level: 1, energyMax: 40, initialEnergy: 0,
      stats: { ...neutralStats, baseAtk: host.baseAtk, atkPct: host.atkPercent, flatAtk: host.flatAtk,
        baseHp: host.baseHp, hpPct: 0, flatHp: 0, baseDef: host.baseDef, defPct: 0, flatDef: 0,
        em: host.em, critRate: host.critRate, critDmg: host.critDamage, dmgBonus: host.universalDamageBonus, energyRecharge: host.energyRecharge } }],
    enemy: { level: 90, resistance: 0.1, defReduction: 0,
      targets: reference.targetDetails.map((target, index) => ({ id: `enemy-${index}`, name: `外部固定目标 ${index + 1}`,
        position: { x: target.position.x ?? 0, y: target.position.y ?? 0 }, hitboxRadius: target.position.r })) },
    weaponProcModel: { mode: 'fixed-source-no-character-hitlag-v1', actors: [{ actorId: 'amber', weaponId: 'messenger', refinement: 5, physicalDamageBonus: 0 }] },
    timeline: { mode: 'legal-frame-v1', fps: 60, legalityMode: 'strict', initialActiveCharacterId: 'amber', swapFrames: 1,
      abilities: [false, true].map(weak => ({ id: `amber-source-aim-${weak ? 'weak' : 'ordinary'}`, actorId: 'amber',
        name: weak ? 'Aimed Shot (explicit weakspot=1)' : 'Aimed Shot (explicit weakspot=0)', kind: 'charge',
        cancelFrame: 15, cancelFrames: { charge: 25, normal: 25, skill: 25, burst: 25, swap: 25, dash: 15, jump: 15 },
        animationEndFrame: 25, cooldownFrames: 0, actionPhase: 'after-frame-tasks-v1',
        hits: [{ id: `amber-aim-${weak ? 'weak' : 'ordinary'}-hit`, frame: 25, scaling: host.talentMultiplier,
          scalingStat: 'atk', element: 'physical', attackTag: 'charged', snapshot: 'hit', hitWeakPoint: weak }] })),
      commands: reference.numericSnapshots.filter(row => row.kind === 'host-aim').map(row => ({ type: 'charge', actorId: 'amber',
        abilityId: `amber-source-aim-${row.hitWeakPoint ? 'weak' : 'ordinary'}`, atFrame: row.sourceFrame })) },
    reactionEngine: { mode: 'aura-v3', initialAura: [], icdProfiles: {} },
  });
  await save('local-config', config);
  simulationInvocations += 1;
  const result = simulate(config, { critMode: 'average', execution: { detailedTraces: true, criticalSampling: 'seeded-random-v1' } });
  await save('local-result', result);
  const errors = [];
  const compare = (actual, expected, description) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push({ description, actual, expected });
  };
  let resultSchemaValid = false;
  try { simulationResultSchema.parse(JSON.parse(JSON.stringify(result))); resultSchemaValid = true; }
  catch (error) { errors.push({ description: 'complete result JSON integrity', error: String(error?.stack ?? error) }); }
  compare(result.damageEvents.length, 6, 'four actual host shots and two proc hits');
  const comparisons = [];
  for (const [index, expected] of reference.numericSnapshots.entries()) {
    const proc = expected.kind === 'weapon-proc';
    const actual = result.damageEvents.find(row => row.frame === expected.frame && (row.weaponProcLogId !== undefined) === proc);
    if (!actual) { errors.push({ description: `missing actual hit ${index}` }); continue; }
    const critical = result.executionAudit?.hits.find(row => row.eventId === actual.id)?.critical;
    const row = { index, kind: expected.kind, externalFrame: expected.frame, localFrame: actual.frame,
      externalDamage: expected.damage, localDamage: actual.finalDamage, absoluteDamageResidual: Math.abs(actual.finalDamage - expected.damage),
      hitWeakPoint: actual.hitWeakPoint, critical, externalHostSnapshotFrame: expected.snapshotFrame };
    compare(actual.finalDamage, expected.damage, `hit ${index} exact external damage`);
    compare(actual.statsBeforeDamage.baseAtk, expected.baseAtk, `hit ${index} actual base ATK`);
    compare(actual.statsBeforeDamage.critRate, expected.critRate, `hit ${index} genuine unchanged panel CR`);
    compare(actual.statsBeforeDamage.critDmg, expected.critDamage, `hit ${index} genuine panel CD`);
    compare(actual.hitWeakPoint, expected.hitWeakPoint, `hit ${index} source weak-point condition`);
    compare(critical?.outcome, expected.actualCritical ? 'critical' : 'noncritical', `hit ${index} real critical decision`);
    if (expected.hitWeakPoint) {
      compare(critical?.roll, null, `hit ${index} weak-point skips RNG roll`);
      compare(critical?.drawIndex, null, `hit ${index} weak-point skips RNG index`);
    } else {
      compare(critical?.drawIndex, 0, 'ordinary shot consumes first critical RNG draw');
      if (typeof critical?.roll !== 'number') errors.push({ description: 'ordinary shot missing real critical RNG roll' });
    }
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
        const document = createWeaponProcCalculatorDocument({ weaponId: 'messenger', refinement: 5, characterLevel: 1,
          build: { mode: 'manual-final', stats: { atk: expected.finalAtk, hp: expected.baseHp, def: expected.baseDef, em: expected.em,
            critRate: expected.critRate, critDamage: expected.critDamage, energyRecharge: expected.energyRecharge },
            source: '外部未舍入信使触发快照；已触发追击自身来源必暴，真实面板CR仍为0。' },
          enemy: { level: expected.enemyLevel, resistance: expected.resistance, defenseAdjustment: 0, defenseIgnore: 0 }, damageBonus: 0 });
        const calculated = calculateDocument(document);
        const restored = calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(document)));
        await save(`hit-${index}.calculator`, document);
        await save(`hit-${index}.calculator-result`, calculated);
        row.standalone = { status: calculated.status, expected: calculated.totals?.expected, critical: calculated.totals?.critical,
          absoluteExternalResidual: Math.abs(calculated.totals?.expected - expected.damage),
          jsonTotalsEqual: JSON.stringify(restored.totals) === JSON.stringify(calculated.totals),
          actualCriticalProbability: calculated.hits[0]?.criticalProbability,
          panelCriticalRate: calculated.hits[0]?.effectiveCritRate, nonCriticalComparisonOnly: calculated.hits[0]?.nonCriticalComparisonOnly };
        compare(calculated.status, 'calculated', `proc ${index} standalone status`);
        compare(calculated.totals?.expected, expected.damage, `proc ${index} standalone expected equals actual guaranteed damage`);
        compare(calculated.totals?.critical, expected.damage, `proc ${index} standalone critical damage`);
        compare(calculated.hits[0]?.criticalProbability, 1, `proc ${index} guaranteed critical probability`);
        compare(calculated.hits[0]?.effectiveCritRate, 0, `proc ${index} panel CR remains zero`);
        compare(calculated.hits[0]?.nonCriticalComparisonOnly, true, `proc ${index} noncritical branch explicitly counterfactual`);
        compare(restored.totals, calculated.totals, `proc ${index} standalone JSON totals`);
      }
    } catch (error) { row.error = String(error?.stack ?? error); errors.push({ description: `hit ${index} capture/standalone`, error: row.error }); }
    comparisons.push(row);
  }
  const triggers = result.weaponProcLog?.filter(row => row.outcome === 'triggered') ?? [];
  compare(triggers.map(row => row.frame), reference.observed.procTriggerFrames, 'two real trigger callbacks');
  compare(triggers.map(row => row.damageFrame), reference.observed.procDamageFrames, 'two queued next-frame proc hits');
  compare(triggers.map(row => row.cooldownExpiresFrameAfter), reference.observed.procCooldownExpiries, 'source inclusive ICD expiries');
  compare(result.weaponProcLog?.find(row => row.frame === 725)?.outcome, 'cooldown-blocked', 'weak-point hit exactly at expiry remains blocked');
  compare(result.executionAudit?.criticalSampling?.drawCount, 1, 'only nonweak shot consumes a critical RNG draw');
  compare(result.totalDamage, reference.externalSampleTotal, 'total external damage');
  const after = await sourceHashes();
  compare(after, before, 'production source unchanged during this comparison');
  const metrics = { status: errors.length ? 'failed' : 'passed', startedAt, elapsedSeconds: (performance.now() - start) / 1000,
    command: 'MESSENGER_EXTERNAL_LOCAL_READY=1 node docs/cross-validation/messenger/compare-local.mjs', nodeVersion: process.version,
    localSimulationInvocations: simulationInvocations, externalInvocations: 0, resultSchemaValid,
    externalReferenceSha256: hash(referenceBytes), scriptSha256: hash(await readFile(fileURLToPath(import.meta.url))),
    sourceHashesBefore: before, sourceHashesAfter: after, sourceUnchanged: JSON.stringify(before) === JSON.stringify(after),
    scope: 'Fixed-source explicit weakspot input and six actual hits, independent proc critical semantics and source inclusive ICD. Static genuine panel; host hit/snapshot timing is explicit and not a whole-character dynamic projectile certification. Local critical RNG is independent; no source normal-energy random sequence equivalence.',
    comparisons, weaponProcLog: result.weaponProcLog, criticalSampling: result.executionAudit?.criticalSampling,
    localTotalDamage: result.totalDamage, externalTotalDamage: reference.externalSampleTotal,
    totalAbsoluteResidual: Math.abs(result.totalDamage - reference.externalSampleTotal), errors };
  await save('local-metrics', metrics);
  console.log(JSON.stringify({ status: metrics.status, elapsedSeconds: metrics.elapsedSeconds, resultSchemaValid,
    hitCount: comparisons.length, criticalSampling: metrics.criticalSampling,
    comparisons: comparisons.map(({ localProcLog, ...row }) => row),
    totalAbsoluteResidual: metrics.totalAbsoluteResidual, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
} catch (error) {
  await save('local-error', { startedAt, elapsedSeconds: (performance.now() - start) / 1000,
    localSimulationInvocations: simulationInvocations, error: String(error?.stack ?? error),
    sourceHashesBefore: before, sourceHashesAfter: await sourceHashes() });
  throw error;
} finally { await server.close(); }
