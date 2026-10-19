import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostActionCollection, captureSourceHostFiniteSkillCollection,
  type SourceHostActionCollection,
} from '../../../packages/sim-core/src/source-host-action-collection';
import type {
  SourceHostOwnedEntity, SourceHostOwnedEntityProducer, SourceHostOwnedEntityTrigger,
} from '../../../packages/sim-core/src/source-host-owned-entity-types';
import { replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const config = `options iteration=1 duration=50 ignore_burst_energy=true;
albedo char lvl=90/90 cons=0 talent=1,1,1;
albedo add weapon="dullblade" refine=1 lvl=1/20;
zhongli char lvl=90/90 cons=1 talent=1,1,1;
zhongli add weapon="blacktassel" refine=1 lvl=1/20;
kaeya char lvl=90/90 cons=0 talent=1,1,1;
kaeya add weapon="dullblade" refine=1 lvl=1/20;
target lvl=90 hp=10000000 resist=0.1 radius=0.5 pos=0,1;
active albedo;
albedo skill;
wait(30);
zhongli skill;
wait(240);
zhongli skill;
albedo skill;
kaeya attack;
wait(2200);`;

const seed = '20260930127';
const baselinePath = 'docs/validation/source-construct-ownership-20260930.baseline.json';
const capturePath = 'docs/validation/source-construct-ownership-20260930.capture.json';
const resultPath = 'docs/validation/source-construct-ownership-20260930.result.json';
const lanes = ['classic', 'stellar'] as const;
type Lane = (typeof lanes)[number];
type Archive = { schemaVersion: 'source-construct-ownership-native-v1'; runs: Partial<Record<Lane, SourceHostResult>> };
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

function finiteCase(result: SourceHostResult, characterKey: string, ordinal: number, contractId: string) {
  const matches = (result.abilityInvocations ?? []).filter(row => row.characterKey === characterKey && row.action === 'skill');
  const invocation = matches[ordinal];
  expect(invocation, `${characterKey} E invocation ${ordinal + 1}`).toBeDefined();
  expect(invocation!.success, `${characterKey} E invocation succeeds`).toBe(true);
  const collection = captureSourceHostFiniteSkillCollection(result, invocation!.actionSequence);
  expect(collection, `${characterKey} E finite collection`).toBeDefined();
  expect(collection!.scope).toBe('finite-skill-cast');
  const analysis = calculateSourceHostActionCollection(collection!);
  const included = collection!.hits.filter(hit => hit.included);
  const replays = included.map(hit => replaySourceHostHit(hit.calculation.originalCapture).difference);
  expect(analysis.finiteCast?.contract?.id, `${characterKey} E contract`).toBe(contractId);
  expect(analysis.completeCast, `${characterKey} E closure: ${JSON.stringify(analysis.finiteCast?.reasons)}`).toBe(true);
  expect(analysis.finiteCast?.closed, `${characterKey} E owned-construct closure`).toBe(true);
  expect(included.length, `${characterKey} E includes a real captured hit`).toBeGreaterThan(0);
  expect(replays, `${characterKey} E replay deltas`).toEqual(replays.map(() => 0));
  expect(analysis.total, `${characterKey} E subtotal equals included applications`).toBeCloseTo(included.reduce((sum, hit) =>
    sum + hit.calculation.originalCapture.application.appliedDamage, 0), 8);
  return { invocation: invocation!, collection: collection!, analysis, included, replays };
}

test('Albedo and Zhongli construct ownership closes across replacement, resonance, and natural expiry', async ({ page }) => {
  test.setTimeout(540_000);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const measurements: Row = { config, seed, baselinePath, capturePath, runs: [],
    scope: 'One combined Albedo E / Zhongli C1 two-stele / Kaeya trigger scene per pinned source lane; a pre-127 baseline is archived separately. Counts and hit totals are measured from native receipts.' };
  const runs: Row[] = [];
  measurements.runs = runs;
  const save = () => writeFile(resultPath, JSON.stringify({ schemaVersion: 'source-construct-ownership-browser-v1', measurements, pageErrors }, null, 2) + '\n');

  try {
    if (process.env.GIDPS_CAPTURE_CONSTRUCT_BASELINE === '1') {
      const baseline: Archive = { schemaVersion: 'source-construct-ownership-native-v1', runs: {} };
      for (const lane of lanes) {
        baseline.runs[lane] = await runNative(page, lane);
        await writeFile(baselinePath, JSON.stringify(baseline, null, 2) + '\n');
      }
      measurements.mode = 'both-lane-pre-127-baseline';
      measurements.baseline = Object.fromEntries(lanes.map(lane => {
        const native = baseline.runs[lane]!;
        return [lane, { sourceCommit: native.sourceCommit, executionArtifact: native.executionArtifact,
          applicationCount: native.applications.length, actionLogCount: actionLogs(native).length }];
      }));
      await save();
      for (const lane of lanes) {
        expect(baseline.runs[lane]!.config).toBe(config);
        expect(baseline.runs[lane]!.seed).toBe(seed);
        expect(actionLogs(baseline.runs[lane]!), `${lane} baseline contains source action logs`).not.toHaveLength(0);
      }
      expect(pageErrors).toEqual([]);
      return;
    }

    let archive: Archive;
    if (process.env.GIDPS_REUSE_CONSTRUCT_CAPTURE === '1') {
      archive = JSON.parse(await readFile(capturePath, 'utf8')) as Archive;
      measurements.nativeRunsPerformed = false;
    } else {
      archive = { schemaVersion: 'source-construct-ownership-native-v1', runs: {} };
      for (const lane of lanes) {
        archive.runs[lane] = await runNative(page, lane);
        // Archive each full lane result before any acceptance assertion so a repair can reuse it.
        await writeFile(capturePath, JSON.stringify(archive, null, 2) + '\n');
      }
      measurements.nativeRunsPerformed = true;
    }
    const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as Archive;

    for (const lane of lanes) {
      const native = archive.runs[lane]!;
      expect(native.config).toBe(config);
      expect(native.seed).toBe(seed);
      expect(actionLogs(native), `${lane} native action log projection is nonempty`).not.toHaveLength(0);
      expect(actionLogs(baseline.runs[lane]!), `${lane} baseline action log projection is nonempty`).not.toHaveLength(0);
      expect(applications(native), `${lane} damage applications and origins match pre-instrumentation baseline`)
        .toEqual(applications(baseline.runs[lane]!));
      expect(actionLogs(native), `${lane} source action logs match pre-instrumentation baseline`)
        .toEqual(actionLogs(baseline.runs[lane]!));

      const albedo1 = finiteCase(native, 'albedo', 0, 'albedo-skill');
      const zhongli1 = finiteCase(native, 'zhongli', 0, 'zhongli-skill');
      const zhongli2 = finiteCase(native, 'zhongli', 1, 'zhongli-skill');
      const albedo2 = finiteCase(native, 'albedo', 1, 'albedo-skill');
      const selected = { albedo1, zhongli1, zhongli2, albedo2 };
      const candidateEntities: SourceHostOwnedEntity[] = native.ownedEntities ?? [];
      const candidateEntityTriggers: SourceHostOwnedEntityTrigger[] = native.ownedEntityTriggers ?? [];
      const candidateEntityProducers: SourceHostOwnedEntityProducer[] = native.ownedEntityProducers ?? [];
      const candidateProducers = native.abilityProducers ?? [];
      const diagnostics = {
        invocations: (native.abilityInvocations ?? []).filter(row => ['albedo', 'zhongli'].includes(row.characterKey)
          && row.action === 'skill').map(row => ({ id: row.id, characterKey: row.characterKey,
          actionSequence: row.actionSequence, startedFrame: row.startedFrame, returnedFrame: row.returnedFrame,
          entryFacts: row.entryFacts, queuedAttacks: row.queuedAttacks })),
        entities: candidateEntities.filter(row => row.invocationId !== undefined).map(row => ({ id: row.id,
          invocationId: row.invocationId, siteId: row.siteId, construct: row.construct, createdFrame: row.createdFrame,
          endedFrame: row.endedFrame, endReason: row.endReason })),
        triggers: candidateEntityTriggers.map(row => ({ id: row.id, entityId: row.entityId, siteId: row.siteId,
          eventCallId: row.eventCallId, startedFrame: row.startedFrame, queuedAttacks: row.queuedAttacks })),
        entityProducers: candidateEntityProducers.map(row => ({ id: row.id, entityId: row.entityId, siteId: row.siteId,
          parentProducerId: row.parentProducerId, queuedFrame: row.queuedFrame, startedFrame: row.startedFrame,
          completedFrame: row.completedFrame, state: row.state, constructKeyPresent: row.constructKeyPresent,
          snapshotEntityId: row.snapshotEntityId, constructSelections: row.constructSelections, queuedAttacks: row.queuedAttacks })),
      };

      const entitiesOf = (item: typeof albedo1) => candidateEntities.filter(row => row.invocationId === item.invocation.id);
      const albedo1Entity = entitiesOf(albedo1)[0];
      const albedo2Entity = entitiesOf(albedo2)[0];
      const zhongli1Entity = entitiesOf(zhongli1)[0];
      const zhongli2Entity = entitiesOf(zhongli2)[0];
      expect(albedo1Entity, `${lane} Albedo E1 has its spawned Isotoma; candidates=${JSON.stringify(diagnostics)}`).toBeDefined();
      expect(albedo2Entity, `${lane} Albedo E2 has its spawned Isotoma; candidates=${JSON.stringify(diagnostics)}`).toBeDefined();
      expect(zhongli1Entity, `${lane} Zhongli C1 E1 has its spawned stele; candidates=${JSON.stringify(diagnostics)}`).toBeDefined();
      expect(zhongli2Entity, `${lane} Zhongli C1 E2 has its spawned stele; candidates=${JSON.stringify(diagnostics)}`).toBeDefined();
      expect(new Set([albedo1Entity!.id, albedo2Entity!.id, zhongli1Entity!.id, zhongli2Entity!.id]).size,
        `${lane} four selected casts own distinct native construct identities`).toBe(4);
      expect(albedo1Entity!.endReason, `${lane} first Isotoma ends on the later E replacement`).toBe('replaced');
      expect(albedo2Entity!.endReason, `${lane} replacement Isotoma reaches its natural expiry`).toBe('expired');
      expect(zhongli1Entity!.endReason, `${lane} first C1 stele reaches its natural expiry`).toBe('expired');
      expect(zhongli2Entity!.endReason, `${lane} second C1 stele reaches its natural expiry`).toBe('expired');

      const zhongliEntryFacts = [zhongli1.invocation.entryFacts?.['zhongli.skill.spawn-count'],
        zhongli2.invocation.entryFacts?.['zhongli.skill.spawn-count']];
      expect(zhongliEntryFacts, `${lane} each measured Zhongli press records its actual C1 spawn branch`).toEqual([1, 1]);
      const albedo1ProducerAttackIds = new Set(candidateProducers.filter(row => row.invocationId === zhongli1.invocation.id
        && row.siteId === 'zhongli.skill.spawn-stele').flatMap(row => row.queuedAttacks
        .flatMap(attack => attack.attackId === undefined ? [] : [attack.attackId])));
      const externalBloom = candidateEntityTriggers.filter(row => row.entityId === albedo1Entity!.id
        && row.eventCallId !== undefined).map(trigger => {
        const call = (native.eventListenerCalls ?? []).find(row => row.id === trigger.eventCallId);
        const emission = call === undefined ? undefined : (native.eventEmissions ?? []).find(row => row.id === call.emissionId);
        return { trigger, call, emission };
      }).find(row => row.call?.siteId === 'albedo.skill.enemy-damage'
        && row.emission?.parentAttackId !== undefined && albedo1ProducerAttackIds.has(row.emission.parentAttackId)
        && row.trigger.queuedAttacks.some(attack => attack.emitSiteId === 'albedo.skill.isotoma.bloom'));
      expect(albedo1ProducerAttackIds.size, `${lane} Zhongli E1 emitted an actual native stele birth hit`).toBeGreaterThan(0);
      expect(externalBloom, `${lane} Zhongli's real E hit triggered the already-live Albedo E1 bloom`).toBeDefined();

      const zhongliProducers = candidateEntityProducers.filter(row =>
        row.entityId === zhongli1Entity!.id || row.entityId === zhongli2Entity!.id);
      const sharedSnapshot = zhongliProducers.find(row => row.entityId === zhongli1Entity!.id
        && row.startedFrame !== undefined && row.startedFrame >= zhongli2Entity!.createdFrame
        && row.snapshotEntityId === zhongli2Entity!.id);
      expect(sharedSnapshot, `${lane} older Zhongli task records the later C1 stele as the shared snapshot source`).toBeDefined();
      const crossConstructResonance = zhongliProducers.find(row => row.entityId === zhongli1Entity!.id
        && (row.constructSelections ?? []).some(selection =>
        selection.resonanceEntityIds.includes(albedo2Entity!.id))
        && row.queuedAttacks.some(attack => attack.emitSiteId === 'zhongli.skill.stele.resonance'
          && attack.emitterEntityId === albedo2Entity!.id));
      expect(crossConstructResonance, `${lane} a Zhongli-owned resonance task emits from the replacement Albedo construct`).toBeDefined();

      if (lane === 'classic') {
        await page.goto('/calculator');
        await page.locator('#calc-import').setInputFiles({ name: 'albedo-e2-owned-construct.json', mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(albedo2.collection)) });
        await expect(page.locator('[data-source-finite-skill-certificate]'))
          .toHaveAttribute('data-source-finite-skill-status', 'complete');
        const constructDetails = page.locator('[data-source-finite-skill-constructs] details');
        await expect(constructDetails).toHaveCount(1);
        await constructDetails.locator('summary').click();
        const ownedConstructRow = page.locator(`[data-source-finite-skill-construct="${albedo2Entity!.id}"]`);
        await expect(ownedConstructRow).toHaveAttribute('data-construct-ownership', 'owned');
        await expect(ownedConstructRow).toHaveAttribute('data-construct-end-reason', 'expired');
        const exported = await download(page, '[data-source-action-collection] [data-source-action-export]') as SourceHostActionCollection;
        expect(exported).toEqual(albedo2.collection);
        await page.locator('#calc-import').setInputFiles({ name: 'albedo-e2-owned-construct-roundtrip.json', mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(exported)) });
        expect(await download(page, '[data-source-action-collection] [data-source-action-export]')).toEqual(exported);

        await page.locator('#calc-import').setInputFiles({ name: 'zhongli-e1-owned-construct.json', mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(zhongli1.collection)) });
        await expect(page.locator('[data-source-finite-skill-certificate]'))
          .toHaveAttribute('data-source-finite-skill-status', 'complete');
        const zhongliConstructDetails = page.locator('[data-source-finite-skill-constructs] details');
        await expect(zhongliConstructDetails).toHaveCount(1);
        await zhongliConstructDetails.locator('summary').click();
        const sharedSnapshotRow = page.locator(`[data-source-finite-skill-construct-producer][data-construct-owner-entity-id="${zhongli1Entity!.id}"][data-construct-snapshot-entity-id="${zhongli2Entity!.id}"]`);
        await expect(sharedSnapshotRow, 'Zhongli E1 UI evidence shows an old-stele task reading the later stele snapshot').not.toHaveCount(0);
        const referencedAlbedoRow = page.locator(`[data-source-finite-skill-construct="${albedo2Entity!.id}"]`);
        await expect(referencedAlbedoRow, 'the Albedo construct appears only as referenced resonance context in Zhongli E1').toHaveAttribute('data-construct-ownership', 'referenced');
      }

      runs.push({ lane, sourceCommit: native.sourceCommit, executionArtifact: native.executionArtifact,
        applicationCount: native.applications.length, baselineDamageAndOriginsEqual: true, baselineActionLogsEqual: true,
        selectedCasts: Object.entries(selected).map(([key, item]) => ({ key, invocationId: item.invocation.id,
          actionSequence: item.invocation.actionSequence, contractId: item.analysis.finiteCast?.contract?.id,
          completeCast: item.analysis.completeCast, expectedRootAttackCount: item.analysis.finiteCast?.expectedRootAttackCount,
          observedRootAttackCount: item.analysis.finiteCast?.observedRootAttackCount, includedHitCount: item.included.length,
          replayDifferences: item.replays, subtotal: item.analysis.total,
          entityCount: item.analysis.finiteCast?.entityCount, endedEntityCount: item.analysis.finiteCast?.endedEntityCount,
          openEntityCount: item.analysis.finiteCast?.openEntityCount,
          entityProducerCount: item.analysis.finiteCast?.entityProducerCount,
          completedEntityProducerCount: item.analysis.finiteCast?.completedEntityProducerCount,
          pendingEntityProducerCount: item.analysis.finiteCast?.pendingEntityProducerCount,
          reasons: item.analysis.finiteCast?.reasons })),
        constructLifecycle: [albedo1Entity, zhongli1Entity, zhongli2Entity, albedo2Entity].map(entity => ({ id: entity!.id,
          invocationId: entity!.invocationId, siteId: entity!.siteId, construct: entity!.construct,
          createdFrame: entity!.createdFrame, endedFrame: entity!.endedFrame, endReason: entity!.endReason })),
        albedoCrossActorBloom: { eventCallId: externalBloom!.call!.id, triggerId: externalBloom!.trigger.id,
          parentAttackId: externalBloom!.emission!.parentAttackId, queuedAttackCount: externalBloom!.trigger.queuedAttacks.length },
        zhongliSharedSnapshot: { ownerEntityId: sharedSnapshot!.entityId, producerId: sharedSnapshot!.id,
          snapshotEntityId: sharedSnapshot!.snapshotEntityId, startedFrame: sharedSnapshot!.startedFrame },
        crossConstructResonance: { ownerEntityId: crossConstructResonance!.entityId, producerId: crossConstructResonance!.id,
          emitterEntityId: albedo2Entity!.id, selections: crossConstructResonance!.constructSelections },
        calculatorRoundTrip: lane === 'classic',
      });
      await save();
    }
    measurements.calculatorRoundTrip = true;
    expect(pageErrors).toEqual([]);
  } finally { await save(); }
});
