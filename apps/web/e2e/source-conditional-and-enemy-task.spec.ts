import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostActionCollection, captureSourceHostFiniteSkillCollection,
  type SourceHostActionCollection,
} from '../../../packages/sim-core/src/source-host-action-collection';
import { replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const config = `options iteration=1 duration=20 ignore_burst_energy=true;
chasca char lvl=90/90 cons=0 talent=1,1,1;
chasca add weapon="huntersbow" refine=1 lvl=90/90;
xilonen char lvl=90/90 cons=0 talent=1,1,1;
xilonen add weapon="dullblade" refine=1 lvl=1/20;
qiqi char lvl=90/90 cons=0 talent=1,1,1;
qiqi add weapon="dullblade" refine=1 lvl=1/20;
nilou char lvl=90/90 cons=0 talent=1,1,1;
nilou add weapon="dullblade" refine=1 lvl=1/20;
target lvl=90 hp=10000000 resist=0.1 radius=0.5 pos=0,1;
target lvl=90 hp=10000000 resist=0.1 radius=0.5 pos=0.4,1;
active chasca;
chasca skill;
wait(65);
chasca skill;
xilonen skill;
wait(65);
xilonen skill;
qiqi burst;
nilou burst;
wait(240);`;

const baselinePath = 'docs/validation/source-conditional-enemy-20260930.baseline.json';
const capturePath = 'docs/validation/source-conditional-enemy-20260930.capture.json';
const resultPath = 'docs/validation/source-conditional-enemy-20260930.result.json';
const lanes = ['classic', 'stellar'] as const;
type Lane = (typeof lanes)[number];
type Archive = { schemaVersion: 'source-conditional-enemy-native-v1'; runs: Partial<Record<Lane, SourceHostResult>> };
type Case = { key: string; characterKey: string; action: 'skill' | 'burst'; contractId: string; ordinal: number;
  roots?: number; entryFact?: string; factValue?: number };
const cases: Case[] = [
  { key: 'chascaE1', characterKey: 'chasca', action: 'skill', contractId: 'chasca-skill', ordinal: 0, roots: 1,
    entryFact: 'chasca.skill.blessing-at-entry', factValue: 0 },
  { key: 'chascaE2', characterKey: 'chasca', action: 'skill', contractId: 'chasca-skill', ordinal: 1, roots: 0,
    entryFact: 'chasca.skill.blessing-at-entry', factValue: 1 },
  { key: 'xilonenE1', characterKey: 'xilonen', action: 'skill', contractId: 'xilonen-skill', ordinal: 0, roots: 1,
    entryFact: 'xilonen.skill.blessing-at-entry', factValue: 0 },
  { key: 'xilonenE2', characterKey: 'xilonen', action: 'skill', contractId: 'xilonen-skill', ordinal: 1, roots: 0,
    entryFact: 'xilonen.skill.blessing-at-entry', factValue: 1 },
  { key: 'qiqiQ', characterKey: 'qiqi', action: 'burst', contractId: 'qiqi-burst', ordinal: 0 },
  { key: 'nilouQ', characterKey: 'nilou', action: 'burst', contractId: 'nilou-burst', ordinal: 0 },
];

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

async function runNative(page: Page, lane: Lane): Promise<SourceHostResult> {
  await page.goto('/source-simulation');
  await page.locator('#source-host-variant').selectOption(lane);
  await page.locator('#source-host-config').fill(config);
  await page.locator('#source-host-seed').fill('1');
  await page.locator('#source-host-run').click();
  await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 120_000 });
  return await download(page, '#source-host-export') as SourceHostResult;
}

function applicationProjection(result: SourceHostResult) {
  return result.applications.map(({ frame, targetKey, rawDamage, appliedDamage, hpBefore, hpAfter, isCrit, origin }) =>
    ({ frame, targetKey, rawDamage, appliedDamage, hpBefore, hpAfter, isCrit, origin }));
}

test('conditional finite skills and Nilou enemy-local task close with actual branch evidence', async ({ page }) => {
  test.setTimeout(480_000);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const measurements: Record<string, unknown> = { config, seed: '1', baselinePath, capturePath, runs: [],
    scope: 'Classic pre-expansion baseline, then one aggregate Classic and Stellar run; one run per lane.' };
  const runs: Record<string, unknown>[] = [];
  measurements.runs = runs;
  const save = () => writeFile(resultPath, JSON.stringify({ schemaVersion: 'source-conditional-enemy-browser-v1', measurements, pageErrors }, null, 2) + '\n');
  try {
    if (process.env.GIDPS_CAPTURE_CONDITIONAL_ENEMY_BASELINE === '1') {
      const native = await runNative(page, 'classic');
      await writeFile(baselinePath, JSON.stringify(native, null, 2) + '\n');
      measurements.mode = 'classic-pre-expansion-baseline';
      measurements.baselineSourceCommit = native.sourceCommit;
      measurements.baselineArtifact = native.executionArtifact;
      await save();
      expect(native.config).toBe(config);
      expect(native.seed).toBe('1');
      expect(pageErrors).toEqual([]);
      return;
    }

    let archive: Archive;
    if (process.env.GIDPS_REUSE_CONDITIONAL_ENEMY_CAPTURE === '1') {
      archive = JSON.parse(await readFile(capturePath, 'utf8')) as Archive;
      measurements.nativeRunsPerformed = false;
    } else {
      archive = { schemaVersion: 'source-conditional-enemy-native-v1', runs: {} };
      for (const lane of lanes) {
        archive.runs[lane] = await runNative(page, lane);
        await writeFile(capturePath, JSON.stringify(archive, null, 2) + '\n');
      }
      measurements.nativeRunsPerformed = true;
    }
    const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as SourceHostResult;
    for (const lane of lanes) {
      const native = archive.runs[lane]!;
      expect(native.config).toBe(config);
      expect(native.seed).toBe('1');
      if (lane === 'classic') expect(applicationProjection(native), 'classic applications unchanged across instrumentation')
        .toEqual(applicationProjection(baseline));

      const selected = cases.map(spec => {
        const matches = (native.abilityInvocations ?? []).filter(row => row.characterKey === spec.characterKey && row.action === spec.action);
        const invocation = matches[spec.ordinal];
        expect(invocation, `${lane} ${spec.key} invocation`).toBeDefined();
        expect(invocation!.success, `${lane} ${spec.key} succeeds`).toBe(true);
        const collection = captureSourceHostFiniteSkillCollection(native, invocation!.actionSequence);
        expect(collection, `${lane} ${spec.key} finite collection`).toBeDefined();
        const analysis = calculateSourceHostActionCollection(collection!);
        const included = collection!.hits.filter(hit => hit.included);
        const replays = included.map(hit => replaySourceHostHit(hit.calculation.originalCapture).difference);
        expect(analysis.finiteCast?.contract?.id, `${lane} ${spec.key} contract`).toBe(spec.contractId);
        expect(analysis.completeCast, `${lane} ${spec.key}: ${JSON.stringify(analysis.finiteCast?.reasons)}`).toBe(true);
        expect(replays, `${lane} ${spec.key} replay differences`).toEqual(replays.map(() => 0));
        expect(analysis.total, `${lane} ${spec.key} component subtotal`).toBeCloseTo(
          included.reduce((sum, hit) => sum + hit.calculation.originalCapture.application.appliedDamage, 0), 8);
        if (spec.roots !== undefined) expect(analysis.finiteCast?.expectedRootAttackCount, `${lane} ${spec.key} root branch`)
          .toBe(spec.roots);
        if (spec.entryFact !== undefined) expect(invocation!.entryFacts?.[spec.entryFact], `${lane} ${spec.key} explicit branch fact`)
          .toBe(spec.factValue);
        if (spec.roots !== undefined) expect(analysis.zeroAttackCast, `${lane} ${spec.key} zero-attack branch`)
          .toBe(spec.roots === 0);
        if (spec.roots === 0) {
          expect(analysis.total, `${lane} ${spec.key} certified zero subtotal`).toBe(0);
          const rootCount = analysis.trace.find(node => node.id === 'sourceActionRootCount');
          expect(rootCount, `${lane} ${spec.key} actual source root count trace`).toBeDefined();
          expect(rootCount!.inputs.find(input => input.key === 'registeredRoots')?.value).toBe(0);
        }
        return { spec, invocation: invocation!, collection: collection!, analysis, included, replays };
      });

      const qiqi = selected.find(item => item.spec.key === 'qiqiQ')!;
      const stellarConductAtEntry = qiqi.invocation.entryFacts?.['qiqi.burst.stellar-conduct-at-entry'];
      expect(stellarConductAtEntry, `${lane} Qiqi Q records Stellar Conduct state at entry`).toBeDefined();
      expect([0, 1]).toContain(stellarConductAtEntry);
      const expectedQiqiRoots = 2 + stellarConductAtEntry!;
      expect(qiqi.analysis.finiteCast?.expectedRootAttackCount, `${lane} Qiqi branch-specific root count`).toBe(expectedQiqiRoots);
      const qiqiRootAttackIds = qiqi.invocation.queuedAttacks.flatMap(attack => attack.attackId === undefined ? [] : [attack.attackId]);
      expect(qiqiRootAttackIds, `${lane} Qiqi Q root attacks match its entry state`).toHaveLength(expectedQiqiRoots);
      expect(new Set(qiqiRootAttackIds).size).toBe(expectedQiqiRoots);
      const qiqiRootDispatches = (native.attackDispatchCompletions ?? []).filter(row => qiqiRootAttackIds.includes(row.attackId));
      expect(new Set(qiqiRootDispatches.map(row => row.attackId)), `${lane} Qiqi mark and Q root dispatches`).toEqual(new Set(qiqiRootAttackIds));

      const nilou = selected.find(item => item.spec.key === 'nilouQ')!;
      const nilouAttackIds = new Set(nilou.invocation.queuedAttacks.flatMap(attack => attack.attackId === undefined ? [] : [attack.attackId]));
      const nilouBatches = (native.hitCallbackBatches ?? []).filter(batch => nilouAttackIds.has(batch.parentAttackId));
      const nilouCallbacks = (native.hitCallbacks ?? []).filter(callback => nilouBatches.some(batch => batch.callbackIds.includes(callback.id)));
      const nilouCallbackIds = new Set(nilouCallbacks.map(callback => callback.id));
      const nilouChildProducers = (native.abilityProducers ?? []).filter(producer => producer.parentHitCallbackId !== undefined
        && nilouCallbackIds.has(producer.parentHitCallbackId));
      const nilouTasks = (native.taskLifecycle?.tasks ?? []).filter(task => nilouChildProducers.some(producer => producer.taskId === task.id));
      expect(nilouBatches.length, `${lane} Nilou root hit creates target callback batches`).toBeGreaterThan(0);
      expect(nilouCallbacks.length, `${lane} Nilou callbacks ran`).toBeGreaterThan(0);
      expect(nilouChildProducers.length, `${lane} Nilou hit callbacks queue child producers`).toBeGreaterThan(0);
      expect(nilouTasks.length, `${lane} Nilou child producers link to actual task records`).toBeGreaterThan(0);
      expect(nilouTasks.every(task => native.taskLifecycle?.queues.find(queue => queue.id === task.queueId)?.kind === 'enemy'),
        `${lane} Nilou child tasks use target-owned enemy queues`).toBe(true);

      const missingBranchFact: Record<string, unknown> = {};
      for (const key of ['chascaE2', 'xilonenE2']) {
        const zero = selected.find(item => item.spec.key === key)!;
        const unknown = structuredClone(zero.collection);
        const factName = zero.spec.entryFact!;
        const evidenceInvocation = unknown.finiteCastEvidence!.invocation;
        const remainingFacts = { ...(evidenceInvocation.entryFacts ?? {}) };
        delete remainingFacts[factName];
        if (Object.keys(remainingFacts).length === 0) delete evidenceInvocation.entryFacts;
        else evidenceInvocation.entryFacts = remainingFacts;
        const unknownAnalysis = calculateSourceHostActionCollection(unknown);
        expect(unknownAnalysis.completeCast, `${lane} ${key} missing branch fact is incomplete`).toBe(false);
        expect(unknownAnalysis.zeroAttackCast, `${lane} ${key} missing fact is not certified zero`).toBe(false);
        expect(unknownAnalysis.knownSubtotal, `${lane} ${key} missing fact has no settled subtotal`).toBeUndefined();
        missingBranchFact[key] = { completeCast: unknownAnalysis.completeCast, zeroAttackCast: unknownAnalysis.zeroAttackCast,
          knownSubtotal: unknownAnalysis.knownSubtotal ?? null, reasons: unknownAnalysis.finiteCast?.reasons };
      }

      if (lane === 'classic') {
        const zero = selected.find(item => item.spec.key === 'chascaE2')!;
        expect(zero.included).toHaveLength(0);
        await page.goto('/calculator');
        await page.locator('#calc-import').setInputFiles({ name: 'chasca-zero-root-finite-skill.json', mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(zero.collection)) });
        await expect(page.locator('[data-source-finite-skill-certificate]')).toHaveAttribute('data-source-finite-skill-status', 'complete');
        await expect(page.locator('[data-source-finite-skill-zero-attack]')).toBeVisible();
        await expect(page.locator('[data-source-finite-skill-total]')).toContainText('0');
        const exported = await download(page, '[data-source-action-collection] [data-source-action-export]') as SourceHostActionCollection;
        expect(exported).toEqual(zero.collection);
        await page.locator('#calc-import').setInputFiles({ name: 'chasca-zero-root-roundtrip.json', mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(exported)) });
        expect(await download(page, '[data-source-action-collection] [data-source-action-export]')).toEqual(exported);
      }

      runs.push({ lane, sourceCommit: native.sourceCommit, executionArtifact: native.executionArtifact,
        applications: native.applications.length, abilityInvocations: selected.map(item => ({ key: item.spec.key,
          id: item.invocation.id, actionSequence: item.invocation.actionSequence, accepted: item.invocation.success,
          entryFacts: item.invocation.entryFacts, expectedRootAttackCount: item.analysis.finiteCast?.expectedRootAttackCount,
          contractId: item.analysis.finiteCast?.contract?.id, completeCast: item.analysis.completeCast,
          hitCount: item.included.length, replayDifferences: item.replays, finiteCast: item.analysis.finiteCast })),
        qiqiStellarConductAtEntry: stellarConductAtEntry,
        qiqiExpectedRootAttackCount: expectedQiqiRoots,
        qiqiRootDispatches: qiqiRootDispatches.map(row => ({ attackId: row.attackId, frame: row.frame,
          enemyTargetKeys: row.enemyTargetKeys, skipsEnemies: row.skipsEnemies })),
        nilouEnemyTaskEvidence: { rootAttackIds: [...nilouAttackIds], callbackBatches: nilouBatches,
          callbacks: nilouCallbacks, childProducers: nilouChildProducers, tasks: nilouTasks,
          enemyQueues: native.taskLifecycle?.queues.filter(queue => nilouTasks.some(task => task.queueId === queue.id)) },
        missingBranchFactOffline: missingBranchFact,
        zeroAttackCalculatorRoundTrip: lane === 'classic' });
      await save();
    }
    measurements.zeroAttackCalculatorRoundTrip = true;
    expect(pageErrors).toEqual([]);
  } finally { await save(); }
});
