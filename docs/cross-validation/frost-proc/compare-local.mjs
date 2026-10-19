// One local combat after owner freeze. No external invocation or injected proc.
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';

if (process.env.FROST_EXTERNAL_LOCAL_READY !== '1') throw new Error('Await runtime/schema/calculator freeze.');
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../../..');
const stem = 'charlotte-frostbearer-reference';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const save = async (suffix, value) => writeFile(join(here, `${stem}.${suffix}.json`), `${JSON.stringify(value, null, 2)}\n`);
if (await access(join(here, `${stem}.local-config.json`)).then(() => true, () => false)) throw new Error('Preserve the existing local attempt; do not silently repeat it.');
const externalBytes = await readFile(join(here, `${stem}.reference.json`));
const reference = JSON.parse(externalBytes);
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
  const host = reference.numericSnapshots.find(row => row.kind === 'host-normal');
  const initial = reference.characterDetails[0].snapshot;
  const config = makeConfig({
    dataVersion: `external-gcsim-${reference.revision}-charlotte-frostbearer-context`,
    randomSeed: 'local-frostbearer-r5-independent-stream',
    meta: { name: '夏洛蒂 N1 上冰后的忍冬之果双目标条件对照', version: '1', verificationStatus: 'provisional',
      note: '固定 C0/A0/Lv1/T1 无卡肉 N1 来源时序和几何，仅一次实际追击；不认证完整角色或源 RNG 同序列。' },
    duration: 3, cycleLength: 3, rotation: [],
    characters: [{ id: 'charlotte', name: '夏洛蒂 C0/A0/Lv1/T1', element: 'cryo', color: '#8eb6d8', level: 1, energyMax: 80, initialEnergy: 0,
      stats: { ...neutralStats, baseAtk: host.baseAtk, atkPct: host.atkPercent, flatAtk: host.flatAtk,
        baseHp: initial[23], hpPct: 0, flatHp: initial[3] - initial[23],
        baseDef: initial[25], defPct: 0, flatDef: initial[2] - initial[25],
        em: host.em, critRate: host.critRate, critDmg: host.critDamage, dmgBonus: host.universalDamageBonus, energyRecharge: 1 } }],
    enemy: { level: 90, resistance: 0.1, defReduction: 0,
      targets: reference.targetDetails.map((target, index) => ({ id: `enemy-${index}`, name: `外部固定目标 ${index + 1}`,
        position: { x: target.position.x ?? 0, y: target.position.y ?? 0 }, hitboxRadius: target.position.r })) },
    weaponProcModel: { mode: 'fixed-source-no-character-hitlag-v1', actors: [{ actorId: 'charlotte', weaponId: 'frostbearer', refinement: 5, physicalDamageBonus: 0 }] },
    timeline: { mode: 'legal-frame-v1', fps: 60, legalityMode: 'strict', initialActiveCharacterId: 'charlotte', swapFrames: 1,
      abilities: [{ id: 'charlotte-source-n1', actorId: 'charlotte', name: 'Normal 0', kind: 'normal', cancelFrame: 5,
        cancelFrames: { normal: 23, charge: 25, skill: 5, burst: 5, dash: 5, jump: 6, swap: 12 },
        animationEndFrame: 32, cooldownFrames: 0, actionPhase: 'after-frame-tasks-v1',
        hits: [{ id: 'charlotte-source-n1-hit', frame: 13, scaling: host.talentMultiplier, scalingStat: 'atk',
          element: 'cryo', attackTag: 'normal', snapshot: 'hit',
          geometry: { kind: 'circle', coordinateSpace: 'world', origin: reference.geometry.hostOrigin, radius: reference.geometry.hostRadius },
          application: { gaugeUnits: 1, icd: { mode: 'fixed-gcsim-application-v1', icdTag: 'normal-attack', groupId: 'default' } } }],
      }], commands: [{ type: 'normal', actorId: 'charlotte', abilityId: 'charlotte-source-n1', atFrame: 1 }] },
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
  compare(result.damageEvents.length, reference.numericSnapshots.length, 'one host hit and two actual proc hits');
  const comparisons = [];
  for (const [index, expected] of reference.numericSnapshots.entries()) {
    const actual = result.damageEvents.find(row => row.frame === expected.frame && row.targetId === `enemy-${expected.target - 1}`);
    if (!actual) { errors.push({ description: `missing actual hit ${index}` }); continue; }
    const row = { index, kind: expected.kind, targetId: actual.targetId, externalFrame: expected.frame, localFrame: actual.frame,
      externalDamage: expected.damage, localDamage: actual.finalDamage,
      absoluteDamageResidual: Math.abs(actual.finalDamage - expected.damage) };
    compare(actual.finalDamage, expected.damage, `hit ${index} exact external damage`);
    compare(actual.statsBeforeDamage.baseAtk, expected.baseAtk, `hit ${index} actual base ATK`);
    compare(actual.statsBeforeDamage.atkPct, expected.atkPercent, `hit ${index} actual ATK%`);
    try {
      const serialized = serializeSimulationHit(captureSimulationHit(result, actual.id));
      await writeFile(join(here, `${stem}.hit-${index}.capture.json`), serialized);
      const replay = replaySimulationHit(parseSimulationHit(serialized));
      await save(`hit-${index}.replay`, replay);
      row.replay = { reproducedDamage: replay.reproducedDamage, difference: replay.difference,
        absoluteExternalResidual: Math.abs(replay.reproducedDamage - expected.damage) };
      compare(replay.difference, 0, `hit ${index} JSON capture difference`);
      compare(replay.reproducedDamage, expected.damage, `hit ${index} JSON capture external damage`);
      if (expected.kind === 'weapon-proc') {
        const log = result.weaponProcLog?.find(entry => entry.id === actual.weaponProcLogId);
        row.localProcLog = log;
        compare(log?.frame, 14, `proc ${index} actual trigger frame`);
        compare(log?.coefficient, 3.6, `proc ${index} shared trigger-selected coefficient`);
        compare(log?.cooldownExpiresFrameAfter, 614, `proc ${index} actual ICD`);
        compare(log?.targetId, 'enemy-0', `proc ${index} original trigger target`);
        const document = createWeaponProcCalculatorDocument({ weaponId: 'frostbearer', refinement: 5, characterLevel: 1,
          triggeringTargetCryoOrFrozen: true,
          build: { mode: 'manual-final', stats: { atk: expected.finalAtk, hp: expected.baseHp, def: expected.baseDef, em: 0,
            critRate: 0, critDamage: 0.5, energyRecharge: 1 }, source: '外部未舍入实际最终面板；原触发目标已被宿主附冰，当前受击目标可无冰。' },
          enemy: { level: 90, resistance: 0.1, defenseAdjustment: 0, defenseIgnore: 0 }, damageBonus: 0 });
        const calculated = calculateDocument(document);
        const restored = calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(document)));
        await save(`hit-${index}.calculator`, document);
        await save(`hit-${index}.calculator-result`, calculated);
        row.standalone = { status: calculated.status, nonCritical: calculated.totals?.nonCritical,
          absoluteExternalResidual: Math.abs(calculated.totals?.nonCritical - expected.damage),
          jsonTotalsEqual: JSON.stringify(restored.totals) === JSON.stringify(calculated.totals) };
        compare(calculated.status, 'calculated', `proc ${index} standalone status`);
        compare(calculated.totals?.nonCritical, expected.damage, `proc ${index} standalone exact damage`);
        compare(restored.totals, calculated.totals, `proc ${index} standalone JSON totals`);
      }
    } catch (error) { row.error = String(error?.stack ?? error); errors.push({ description: `hit ${index} capture or standalone`, error: row.error }); }
    comparisons.push(row);
  }
  compare(result.weaponProcLog?.filter(row => row.outcome === 'triggered').length, 1, 'one actual proc trigger shared across AoE');
  const trigger = result.weaponProcLog?.find(row => row.outcome === 'triggered');
  compare(trigger?.triggerAura, { cryo: true, frozen: false }, 'newly applied Cryo read from original trigger target');
  compare(trigger?.random?.probability, 1, 'R5 source probability');
  compare(trigger?.random?.drawCountBefore, 0, 'random stream before R5 proc');
  compare(trigger?.random?.drawCountAfter, 1, 'R5 still consumes an actual random draw');
  if (typeof trigger?.random?.roll !== 'number' || trigger.random.roll < 0 || trigger.random.roll >= 1) errors.push({ description: 'R5 real random draw was not retained', actual: trigger?.random });
  compare(result.totalDamage, reference.externalSampleTotal, 'total external damage');
  const after = await sourceHashes();
  compare(after, before, 'frozen production source unchanged');
  const metrics = { status: errors.length ? 'failed' : 'passed', startedAt, elapsedSeconds: (performance.now() - start) / 1000,
    command: 'FROST_EXTERNAL_LOCAL_READY=1 node docs/cross-validation/frost-proc/compare-local.mjs', nodeVersion: process.version,
    localSimulationInvocations: simulationInvocations, externalInvocations: 0, resultSchemaValid,
    externalReferenceSha256: hash(externalBytes), scriptSha256: hash(await readFile(fileURLToPath(import.meta.url))),
    sourceHashesBefore: before, sourceHashesAfter: after, sourceUnchanged: JSON.stringify(before) === JSON.stringify(after),
    scope: 'Actual normal Cryo application selects a live trigger-target frost branch; independent physical AoE +1 frame, two destinations, capture replay and explicit original-trigger context in standalone calculator. Fixed source C0/A0/Lv1 N1 inputs; no full character, death, expiry boundary, lower-refinement sampling distribution or cross-engine random-sequence certification.',
    comparisons, weaponProcLog: result.weaponProcLog, elementalApplicationIcdLog: result.elementalApplicationIcdLog,
    localTotalDamage: result.totalDamage, externalTotalDamage: reference.externalSampleTotal,
    totalAbsoluteResidual: Math.abs(result.totalDamage - reference.externalSampleTotal), errors };
  await save('local-metrics', metrics);
  console.log(JSON.stringify({ status: metrics.status, elapsedSeconds: metrics.elapsedSeconds, resultSchemaValid,
    comparisons: comparisons.map(({ localProcLog, ...row }) => row), weaponProcLog: result.weaponProcLog,
    totalAbsoluteResidual: metrics.totalAbsoluteResidual, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
} catch (error) {
  await save('local-error', { startedAt, elapsedSeconds: (performance.now() - start) / 1000,
    localSimulationInvocations: simulationInvocations, error: String(error?.stack ?? error),
    sourceHashesBefore: before, sourceHashesAfter: await sourceHashes() });
  throw error;
} finally { await server.close(); }
