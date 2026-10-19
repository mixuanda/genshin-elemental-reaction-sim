import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostActionCollection, captureSourceHostFiniteSkillCollection,
  type SourceHostActionCollection,
} from '../../../packages/sim-core/src/source-host-action-collection';
import { replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const config = `options iteration=1 duration=40 ignore_burst_energy=true;
shenhe char lvl=90/90 cons=2 talent=1,1,1;
shenhe add weapon="favoniuslance" refine=1 lvl=90/90;
chongyun char lvl=90/90 cons=0 talent=1,1,1;
chongyun add weapon="sacrificialgreatsword" refine=5 lvl=90/90;
mona char lvl=90/90 cons=0 talent=1,1,1;
mona add weapon="apprenticesnotes" refine=1 lvl=90/90;
target lvl=90 hp=10000000 resist=0.1 radius=0.5 pos=0,2.4;
target lvl=90 hp=10000000 resist=0.1 radius=0.5 pos=0.5,2.4;
active chongyun;
chongyun skill;
wait(30);
chongyun skill;
shenhe skill;
shenhe burst;
mona skill[hold=1];
wait(1400);`;

const baselinePath = 'docs/validation/source-finite-expansion-20260930.baseline.json';
const capturePath = 'docs/validation/source-finite-expansion-20260930.capture.json';
const resultPath = 'docs/validation/source-finite-expansion-20260930.result.json';
const lanes = ['classic', 'stellar'] as const;
type Lane = (typeof lanes)[number];
type Archive = { schemaVersion: 'source-finite-expansion-native-v1'; runs: Partial<Record<Lane, SourceHostResult>> };
type Case = { key: string; characterKey: string; action: 'skill' | 'burst'; contractId: string };
const cases: Case[] = [
  { key: 'chongyunE1', characterKey: 'chongyun', action: 'skill', contractId: 'chongyun-skill' },
  { key: 'chongyunE2', characterKey: 'chongyun', action: 'skill', contractId: 'chongyun-skill' },
  { key: 'shenheE', characterKey: 'shenhe', action: 'skill', contractId: 'shenhe-skill' },
  { key: 'shenheQ', characterKey: 'shenhe', action: 'burst', contractId: 'shenhe-burst' },
  { key: 'monaE', characterKey: 'mona', action: 'skill', contractId: 'mona-skill' },
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
  return result.applications.map(({ frame, targetKey, rawDamage, appliedDamage, hpBefore, hpAfter, isCrit }) =>
    ({ frame, targetKey, rawDamage, appliedDamage, hpBefore, hpAfter, isCrit }));
}

test('classic and stellar finite skill expansion captures close and replay the new contracts', async ({ page }) => {
  test.setTimeout(480_000);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const measurements: Record<string, unknown> = { config, seed: '1', baselinePath, capturePath, runs: [],
    scope: 'One classic pre-expansion baseline, then one classic and one stellar aggregate native run. Finite captures stay scoped to each selected action invocation.' };
  const runs: Record<string, unknown>[] = [];
  measurements.runs = runs;
  const save = () => writeFile(resultPath, JSON.stringify({ schemaVersion: 'source-finite-expansion-browser-v1', measurements, pageErrors }, null, 2) + '\n');
  try {
    if (process.env.GIDPS_CAPTURE_FINITE_EXPANSION_BASELINE === '1') {
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
    if (process.env.GIDPS_REUSE_FINITE_EXPANSION_CAPTURE === '1') {
      archive = JSON.parse(await readFile(capturePath, 'utf8')) as Archive;
      measurements.nativeRunsPerformed = false;
    } else {
      archive = { schemaVersion: 'source-finite-expansion-native-v1', runs: {} };
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
        const invocation = spec.key === 'chongyunE1' ? matches[0] : spec.key === 'chongyunE2' ? matches[1] : matches[0];
        expect(invocation, `${lane} ${spec.key} invocation`).toBeDefined();
        expect(invocation!.success, `${lane} ${spec.key} succeeds`).toBe(true);
        const collection = captureSourceHostFiniteSkillCollection(native, invocation!.actionSequence);
        expect(collection, `${lane} ${spec.key} finite collection`).toBeDefined();
        const analysis = calculateSourceHostActionCollection(collection!);
        const included = collection!.hits.filter(hit => hit.included);
        const replays = included.map(hit => replaySourceHostHit(hit.calculation.originalCapture).difference);
        return { spec, invocation: invocation!, collection: collection!, analysis, included, replays };
      });

      for (const item of selected) {
        expect(item.analysis.finiteCast?.contract?.id, `${lane} ${item.spec.key} contract`).toBe(item.spec.contractId);
        expect(item.analysis.completeCast, `${lane} ${item.spec.key}: ${JSON.stringify(item.analysis.finiteCast?.reasons)}`).toBe(true);
        expect(item.included.length, `${lane} ${item.spec.key} actual included hits`).toBeGreaterThan(0);
        expect(item.replays, `${lane} ${item.spec.key} replay differences`).toEqual(item.replays.map(() => 0));
        expect(item.analysis.total, `${lane} ${item.spec.key} formula subtotal equals included applied damage`)
          .toBeCloseTo(item.included.reduce((sum, hit) => sum + hit.calculation.originalCapture.application.appliedDamage, 0), 8);
      }

      const qCase = selected.find(item => item.spec.key === 'shenheQ')!;
      const dotReads = native.calculations.flatMap(record => {
        if (record.request.kind !== 'damage' || record.request.actorKey !== 'shenhe'
          || !record.request.ability.includes('(DoT)') || !record.request.talentTableRead) return [];
        return [{ request: record.request, read: record.request.talentTableRead }];
      });
      expect(dotReads.length, `${lane} Shenhe Q DoT has actual talent table reads`).toBeGreaterThan(0);
      for (const { request, read } of dotReads) {
        expect(read.actorIndex).toBe(request.actorIndex);
        expect(read.frame).toBeLessThanOrEqual(request.frame);
        expect(read.value).toBe(request.input.scaling);
      }
      const qComponentIds = new Set(qCase.included.flatMap(hit => hit.calculation.originalCapture.calculation.request.kind === 'damage'
        ? hit.calculation.originalCapture.calculation.request.componentIds : []));
      const qQuillComponents = native.calculations.flatMap(record => {
        const request = record.request;
        if (request.kind !== 'character-additive' || request.input.ruleId !== 'char-add-shenhe-quill'
          || !qComponentIds.has(request.id)) return [];
        return [{ request, value: record.value }];
      });
      expect(qQuillComponents.length, `${lane} Q-owned hits include same-hit Shenhe Quill formulas`).toBeGreaterThan(0);

      const chongyunSecond = selected.find(item => item.spec.key === 'chongyunE2')!;
      const chongyunProducerFacts = (native.abilityProducers ?? []).filter(row => row.invocationId === chongyunSecond.invocation.id
        || String(row.siteId).toLowerCase().includes('sacrificial'));
      const chongyunFirst = selected.find(item => item.spec.key === 'chongyunE1')!;
      const chongyunExpiry = (native.abilityProducers ?? []).filter(row =>
        row.siteId === 'chongyun.skill.a4-expiry'
        && (row.invocationId === chongyunFirst.invocation.id || row.invocationId === chongyunSecond.invocation.id));
      const firstExpiry = chongyunExpiry.find(row => row.invocationId === chongyunFirst.invocation.id);
      const secondExpiry = chongyunExpiry.find(row => row.invocationId === chongyunSecond.invocation.id);
      expect(chongyunFirst.invocation.entryFacts?.['chongyun.skill.replaced-field'], `${lane} first E did not replace a field`).toBe(0);
      expect(chongyunSecond.invocation.entryFacts?.['chongyun.skill.replaced-field'], `${lane} second E observed the live field`).toBe(1);
      expect(chongyunExpiry.filter(row => row.invocationId === chongyunFirst.invocation.id), `${lane} first E expiry producer`).toHaveLength(1);
      expect(chongyunExpiry.filter(row => row.invocationId === chongyunSecond.invocation.id), `${lane} second E expiry producer`).toHaveLength(1);
      expect(firstExpiry!.entryFacts?.['chongyun.skill.a4.attack-count'], `${lane} replaced first expiry queues no attack`).toBe(0);
      expect(firstExpiry!.queuedAttacks, `${lane} replaced first expiry has no queued attack`).toHaveLength(0);
      expect(secondExpiry!.entryFacts?.['chongyun.skill.a4.attack-count'], `${lane} second expiry queues one attack`).toBe(1);
      expect(secondExpiry!.queuedAttacks, `${lane} second expiry queues one attack`).toHaveLength(1);
      const qCollection = qCase.collection;
      if (lane === 'classic') {
        await page.goto('/calculator');
        await page.locator('#calc-import').setInputFiles({ name: 'shenhe-c2-q-finite-expansion.json',
          mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(qCollection)) });
        const certificate = page.locator('[data-source-finite-skill-certificate]');
        await expect(certificate).toBeVisible();
        await expect(certificate).toHaveAttribute('data-source-finite-skill-status', 'complete');
        const editor = page.locator('[data-source-action-collection]');
        const total = editor.locator('[data-source-finite-skill-total]');
        const before = await total.innerText();
        const scaling = editor.locator('[data-source-action-editor] [data-source-host-input="scaling"]').first();
        const originalScaling = Number(await scaling.inputValue());
        await scaling.fill(String(originalScaling + 0.01));
        await expect(total).not.toHaveText(before);
        const edited = await download(page, '[data-source-action-export]') as SourceHostActionCollection;
        expect(calculateSourceHostActionCollection(edited).total).not.toBe(qCase.analysis.total);
        await page.locator('#calc-import').setInputFiles({ name: 'shenhe-c2-q-finite-expansion-edited.json',
          mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(edited)) });
        expect(await download(page, '[data-source-action-collection] [data-source-action-export]')).toEqual(edited);
      }

      runs.push({ lane, sourceCommit: native.sourceCommit, executionArtifact: native.executionArtifact,
        applications: native.applications.length, abilityInvocations: selected.map(item => ({ key: item.spec.key,
          id: item.invocation.id, actionSequence: item.invocation.actionSequence, accepted: item.invocation.success,
          contractId: item.analysis.finiteCast?.contract?.id, completeCast: item.analysis.completeCast,
          hitCount: item.included.length, replayDifferences: item.replays, finiteCast: item.analysis.finiteCast })),
        shenheDoTTalentReads: dotReads.map(({ request, read }) => ({ ability: request.ability,
          siteId: read.siteId, tableId: read.tableId, indices: read.indices, value: read.value, frame: read.frame })),
        shenheQuillComponents: qQuillComponents.map(record => ({ id: record.request.id, value: record.value,
          scope: record.request.componentScope, state: record.request.input.state })),
        sacrificialProducerFacts: chongyunProducerFacts.map(row => ({ id: row.id, siteId: row.siteId, taskId: row.taskId,
          state: row.state, parentProducerId: row.parentProducerId, entryFacts: row.entryFacts, queuedAttacks: row.queuedAttacks })),
        chongyunReplacementAndExpiry: { invocations: [chongyunFirst, chongyunSecond].map(item => ({ id: item.invocation.id,
          entryFacts: item.invocation.entryFacts })), expiryProducers: chongyunExpiry.map(row => ({ id: row.id,
          invocationId: row.invocationId, taskId: row.taskId, state: row.state, entryFacts: row.entryFacts,
          queuedAttacks: row.queuedAttacks })) },
        calculatorEditExportImport: lane === 'classic' });
      await save();
    }
    measurements.calculatorEditExportImport = true;
    expect(pageErrors).toEqual([]);
  } finally { await save(); }
});
