import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostActionCollection, captureSourceHostFiniteSkillCollection,
  type SourceHostActionCollection,
} from '../../../packages/sim-core/src/source-host-action-collection';
import { replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const config = `options iteration=1 duration=30 ignore_burst_energy=true;
chongyun char lvl=90/90 cons=2 talent=1,1,1;
chongyun add weapon="wastergreatsword" refine=1 lvl=1/20;
layla char lvl=90/90 cons=0 talent=1,1,1;
layla add weapon="dullblade" refine=1 lvl=1/20;
kaeya char lvl=90/90 cons=0 talent=1,1,1;
kaeya add weapon="dullblade" refine=1 lvl=1/20;
target lvl=90 hp=10000000 resist=0.1 radius=0.5 pos=0,1;
target lvl=90 hp=10000000 resist=0.1 radius=0.5 pos=0.4,1;
active chongyun;
chongyun skill;
layla skill;
layla burst;
wait(180);
kaeya skill;
wait(300);
layla skill;
wait(1000);`;

const seed = '20260930126';
const baselinePath = 'docs/validation/source-layla-ownership-20260930.baseline.json';
const capturePath = 'docs/validation/source-layla-ownership-20260930.capture.json';
const resultPath = 'docs/validation/source-layla-ownership-20260930.result.json';
const lanes = ['classic', 'stellar'] as const;
type Lane = (typeof lanes)[number];
type Archive = { schemaVersion: 'source-layla-ownership-native-v1'; runs: Partial<Record<Lane, SourceHostResult>> };
type Row = Record<string, unknown>;

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

async function runNative(page: Page, lane: Lane): Promise<SourceHostResult> {
  await page.goto('/source-simulation');
  await page.locator('#source-host-variant').selectOption(lane);
  await page.locator('#source-host-config').fill(config);
  await page.locator('#source-host-seed').fill(seed);
  await page.locator('#source-host-run').click();
  await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 120_000 });
  return await download(page, '#source-host-export') as SourceHostResult;
}

function applications(result: SourceHostResult): Row[] {
  return result.applications.map(({ frame, targetKey, rawDamage, appliedDamage, hpBefore, hpAfter, isCrit, origin }) =>
    ({ frame, targetKey, rawDamage, appliedDamage, hpBefore, hpAfter, isCrit, origin }));
}

function actionLogs(result: SourceHostResult): Row[] {
  const logs = (Array.isArray(result.logs) ? result.logs : []) as Row[];
  return logs.filter(row => row.event === 'action')
    .map(row => ({ frame: row.frame, ended: row.ended, characterIndex: row.char_index, message: row.msg, values: row.logs }));
}

function finiteCase(result: SourceHostResult, characterKey: string, action: 'skill' | 'burst', ordinal: number) {
  const matches = (result.abilityInvocations ?? []).filter(row => row.characterKey === characterKey && row.action === action);
  const invocation = matches[ordinal];
  expect(invocation, `${characterKey} ${action} invocation ${ordinal + 1}`).toBeDefined();
  expect(invocation!.success).toBe(true);
  const collection = captureSourceHostFiniteSkillCollection(result, invocation!.actionSequence);
  expect(collection, `${characterKey} ${action} finite collection`).toBeDefined();
  expect(collection!.scope).toBe('finite-skill-cast');
  const analysis = calculateSourceHostActionCollection(collection!);
  const included = collection!.hits.filter(hit => hit.included);
  const replayDifferences = included.map(hit => replaySourceHostHit(hit.calculation.originalCapture).difference);
  expect(analysis.finiteCast?.contract?.id).toBe(characterKey === 'layla' && action === 'skill' ? 'layla-skill' : 'layla-burst');
  expect(analysis.completeCast, `${characterKey} ${action}: ${JSON.stringify(analysis.finiteCast?.reasons)}`).toBe(true);
  expect(replayDifferences).toEqual(replayDifferences.map(() => 0));
  expect(analysis.finiteCast?.observedRootAttackCount).toBe(analysis.finiteCast?.expectedRootAttackCount);
  expect(analysis.total).toBeCloseTo(included.reduce((sum, hit) =>
    sum + hit.calculation.originalCapture.application.appliedDamage, 0), 8);
  return { invocation: invocation!, collection: collection!, analysis, included, replayDifferences };
}

test('Layla E shield ownership and Q slug contributions close in both source lanes', async ({ page }) => {
  test.setTimeout(480_000);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const measurements: Row = { config, seed, baselinePath, capturePath, runs: [],
    scope: 'One combined C2 Chongyun cooldown-field, Layla E/Q/E refresh, and Kaeya E scene per lane. Source receipts establish native ownership and closure; this is not game verification.' };
  const runs: Row[] = [];
  measurements.runs = runs;
  const save = () => writeFile(resultPath, JSON.stringify({ schemaVersion: 'source-layla-ownership-browser-v1', measurements, pageErrors }, null, 2) + '\n');
  try {
    if (process.env.GIDPS_CAPTURE_LAYLA_BASELINE === '1') {
      const baseline: Archive = { schemaVersion: 'source-layla-ownership-native-v1', runs: {} };
      for (const lane of lanes) {
        baseline.runs[lane] = await runNative(page, lane);
        await writeFile(baselinePath, JSON.stringify(baseline, null, 2) + '\n');
      }
      measurements.mode = 'both-lane-pre-integration-baseline';
      measurements.baseline = Object.fromEntries(lanes.map(lane => {
        const native = baseline.runs[lane]!;
        return [lane, { sourceCommit: native.sourceCommit, executionArtifact: native.executionArtifact,
          applicationCount: native.applications.length }];
      }));
      await save();
      for (const lane of lanes) {
        expect(baseline.runs[lane]!.config).toBe(config);
        expect(baseline.runs[lane]!.seed).toBe(seed);
      }
      expect(pageErrors).toEqual([]);
      return;
    }

    let archive: Archive;
    if (process.env.GIDPS_REUSE_LAYLA_CAPTURE === '1') {
      archive = JSON.parse(await readFile(capturePath, 'utf8')) as Archive;
      measurements.nativeRunsPerformed = false;
    } else {
      archive = { schemaVersion: 'source-layla-ownership-native-v1', runs: {} };
      for (const lane of lanes) {
        archive.runs[lane] = await runNative(page, lane);
        await writeFile(capturePath, JSON.stringify(archive, null, 2) + '\n');
      }
      measurements.nativeRunsPerformed = true;
    }
    const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as Archive;

    for (const lane of lanes) {
      const native = archive.runs[lane]!;
      expect(native.config).toBe(config);
      expect(native.seed).toBe(seed);
      const before = baseline.runs[lane]!;
      expect(actionLogs(native).length, `${lane} native action log projection is nonempty`).toBeGreaterThan(0);
      expect(actionLogs(before).length, `${lane} archived action log projection is nonempty`).toBeGreaterThan(0);
      expect(applications(native), `${lane} damage applications and source origins match the pre-integration baseline`)
        .toEqual(applications(before));
      expect(actionLogs(native), `${lane} action logs match the pre-integration baseline`).toEqual(actionLogs(before));

      const e1 = finiteCase(native, 'layla', 'skill', 0);
      const q = finiteCase(native, 'layla', 'burst', 0);
      const e2 = finiteCase(native, 'layla', 'skill', 1);
      const chongyun = (native.abilityInvocations ?? []).find(row => row.characterKey === 'chongyun' && row.action === 'skill');
      const kaeya = (native.abilityInvocations ?? []).find(row => row.characterKey === 'kaeya' && row.action === 'skill');
      expect(chongyun?.success).toBe(true);
      expect(kaeya?.success).toBe(true);

      const shieldId = e1.analysis.finiteCast!.shieldInstanceIds[0];
      const shield = (native.shieldInstances ?? []).find(row => row.id === shieldId);
      expect(shield, `${lane} Layla E1 owns the actual born shield`).toBeDefined();
      expect((native.shieldInstances ?? []).filter(row => row.invocationId === e1.invocation.id
        && row.creationSiteId === 'layla.skill.shield')).toHaveLength(1);
      expect(shield!.invocationId).toBe(e1.invocation.id);
      expect(shield!.terminalReason).toBe('expired');
      expect(e1.analysis.finiteCast?.shieldCount).toBe(1);
      expect(e1.analysis.finiteCast?.endedShieldCount).toBe(1);
      expect(e2.analysis.finiteCast?.shieldCount).toBe(0);
      expect(e2.analysis.finiteCast?.shieldRelatedExcludedInstanceIds).toContain(shieldId);

      const refreshProducer = (native.abilityProducers ?? []).find(row => row.invocationId === e2.invocation.id
        && row.siteId === 'layla.skill.shield-update');
      expect(refreshProducer?.entryFacts?.['layla.skill.refresh']).toBe(1);
      expect(refreshProducer?.entryFacts?.['layla.skill.shield-instance']).toBe(shieldId);
      const refreshHook = (native.shieldHooks ?? []).find(row => row.abilityProducerId === refreshProducer?.id
        && row.instanceId === shieldId && row.siteId === 'layla.skill.shield-refresh');
      expect(refreshHook?.cause).toBe('refresh');
      expect(refreshHook?.entryFacts?.['layla.refresh.expiry-after']).toBe(shield!.terminalFrame);

      const kaeyaAttackIds = new Set(kaeya!.queuedAttacks.flatMap(attack => attack.attackId === undefined ? [] : [attack.attackId]));
      const skillCalls = (native.eventListenerCalls ?? []).filter(call => call.key === 'stars-skill'
        && call.siteId === 'layla.shield.on-skill' && call.entryFacts?.['layla.shield.instance'] === shieldId);
      const skillContribution = skillCalls.map(call => {
        const emission = (native.eventEmissions ?? []).find(row => row.id === call.emissionId);
        const hook = (native.shieldHooks ?? []).find(row => row.eventListenerCallId === call.id
          && row.instanceId === shieldId && row.siteId === 'layla.shield.skill-stars');
        return { call, emission, hook };
      }).find(row => row.emission?.frame === kaeya!.startedFrame && row.hook !== undefined);
      expect(kaeyaAttackIds.size, `${lane} Kaeya skill has its actual root hit`).toBeGreaterThan(0);
      expect(skillContribution, `${lane} Kaeya E contributes through the registered Layla skill listener to E1's shield`).toBeDefined();
      expect(skillContribution!.hook!.cause).toBe('trigger');
      expect(skillContribution!.hook!.entryFacts?.['layla.stars.count']).toBe(2);

      const qProducers = (native.abilityProducers ?? []).filter(row => row.invocationId === q.invocation.id
        && row.siteId === 'layla.burst.slug');
      expect(qProducers.length).toBeGreaterThan(0);
      expect(qProducers.every(row => row.state === 'completed' && row.taskId !== undefined)).toBe(true);
      const qQueuedAttacks = qProducers.flatMap(producer => producer.queuedAttacks.map(attack => ({ producer, attack })));
      expect(qQueuedAttacks.length).toBeGreaterThan(0);
      const qHitCallbacks = (native.hitCallbacks ?? []).filter(callback => callback.siteId === 'layla.burst.night-star-hit');
      const qCallbackLinks = qHitCallbacks.map(callback => {
        const batch = (native.hitCallbackBatches ?? []).find(row => row.id === callback.batchId);
        const qRoot = qQueuedAttacks.find(({ attack }) => attack.queueId === batch?.parentQueueId
          && attack.attackId === batch?.parentAttackId);
        const hook = (native.shieldHooks ?? []).find(row => row.hitCallbackId === callback.id
          && row.instanceId === shieldId && row.siteId === 'layla.shield.burst-star');
        return { callback, batch, qRoot, hook };
      }).filter(row => row.batch?.state === 'completed');
      expect(qCallbackLinks.some(row => row.qRoot !== undefined), `${lane} Q hit callback links to an actual Q-owned slug`).toBe(true);
      expect(qCallbackLinks.some(row => row.hook !== undefined), `${lane} a Q hit contributes one star to E1's actual shield`).toBe(true);
      for (const link of qCallbackLinks.filter(row => row.hook)) {
        expect(link.callback.entryFacts?.['layla.burst.callback.first']).toBe(1);
        expect(link.callback.entryFacts?.['layla.burst.callback.shield-instance']).toBe(shieldId);
        expect(link.hook!.hitCallbackId).toBe(link.callback.id);
      }

      const eShieldProducers = (native.shieldProducers ?? []).filter(row => row.ownerInstanceId === shieldId);
      expect(eShieldProducers.length).toBeGreaterThan(0);
      expect(eShieldProducers.every(row => row.taskId !== undefined
        && (native.taskLifecycle?.tasks ?? []).some(task => task.id === row.taskId))).toBe(true);
      const eOwnedAttackIds = new Set([
        ...e1.invocation.queuedAttacks.flatMap(attack => attack.attackId === undefined ? [] : [attack.attackId]),
        ...eShieldProducers.flatMap(producer => producer.queuedAttacks.flatMap(attack => attack.attackId === undefined ? [] : [attack.attackId])),
      ]);
      const eIncludedAttackIds = new Set(e1.included.map(hit => hit.calculation.originalCapture.application.attackId));
      expect(eIncludedAttackIds.size).toBeGreaterThan(0);
      expect([...eIncludedAttackIds].every(id => eOwnedAttackIds.has(id)),
        `${lane} E collection applications link to E roots or this E-born shield's producers`).toBe(true);
      const eShootProducers = eShieldProducers.filter(row => row.siteId === 'layla.shield.shoot');
      const emittedStars = eShootProducers.flatMap(producer => producer.queuedAttacks.map(attack => ({ producer, attack })));
      expect(emittedStars.length).toBeGreaterThan(0);
      expect(emittedStars.every(({ attack }) => attack.emitSiteId === 'layla.shield.shooting-star')).toBe(true);
      expect(e1.included.some(hit => emittedStars.some(({ attack }) =>
        attack.attackId === hit.calculation.originalCapture.application.attackId)),
      `${lane} E collection contains actual shield-owned Shooting Star applications`).toBe(true);
      const qOwnedAttackIds = new Set(qQueuedAttacks.flatMap(({ attack }) => attack.attackId === undefined ? [] : [attack.attackId]));
      const qIncludedAttackIds = new Set(q.included.map(hit => hit.calculation.originalCapture.application.attackId));
      expect(qIncludedAttackIds.size).toBeGreaterThan(0);
      expect([...qIncludedAttackIds].every(id => qOwnedAttackIds.has(id)), `${lane} Q applications link to Q-owned slug roots`).toBe(true);
      expect([...qIncludedAttackIds].every(id => !eIncludedAttackIds.has(id)), `${lane} E and Q collections do not double-claim attacks`).toBe(true);

      if (lane === 'classic') {
        await page.goto('/calculator');
        await page.locator('#calc-import').setInputFiles({ name: 'layla-e1-shield-ownership.json', mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(e1.collection)) });
        await expect(page.locator('[data-source-finite-skill-certificate]')).toHaveAttribute('data-source-finite-skill-status', 'complete');
      }

      runs.push({ lane, sourceCommit: native.sourceCommit, executionArtifact: native.executionArtifact,
        applications: native.applications.length, baselineComparison: {
          damageAndOriginsEqual: true, actionLogsEqual: true },
        laylaInvocations: [e1, q, e2].map(item => ({ id: item.invocation.id,
          actionSequence: item.invocation.actionSequence, action: item.invocation.action,
          contractId: item.analysis.finiteCast?.contract?.id, expectedRootAttackCount: item.analysis.finiteCast?.expectedRootAttackCount,
          observedRootAttackCount: item.analysis.finiteCast?.observedRootAttackCount,
          completeCast: item.analysis.completeCast, includedHitCount: item.included.length,
          replayDifferences: item.replayDifferences, report: item.analysis.finiteCast })),
        shield: { id: shieldId, creationSiteId: shield!.creationSiteId, birthInvocationId: shield!.invocationId,
          terminalFrame: shield!.terminalFrame, terminalReason: shield!.terminalReason,
          refreshProducer, refreshHook },
        externalSkillContribution: { kaeyaInvocationId: kaeya!.id, kaeyaStartedFrame: kaeya!.startedFrame,
          listenerCall: skillContribution!.call, emission: skillContribution!.emission, hook: skillContribution!.hook },
        qSlugProducerCount: qProducers.length, qQueuedAttackCount: qQueuedAttacks.length,
        qCallbackLinks, shieldProducerCount: eShieldProducers.length, shootingStarAttackCount: emittedStars.length,
        calculatorImportedCompleteE: lane === 'classic' });
      await save();
    }
    expect(pageErrors).toEqual([]);
  } finally { await save(); }
});
