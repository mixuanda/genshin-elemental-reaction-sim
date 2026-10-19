import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';
import { calculateSourceHostActionCollection, captureSourceHostActionCollection, type SourceHostActionCollection } from '../../../packages/sim-core/src/source-host-action-collection';
import { sourceActionReceipts } from '../../../packages/sim-core/src/source-host-action-origin';

const script = `options iteration=1 duration=12;
xingqiu char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
xingqiu add weapon="favoniussword" refine=1 lvl=90/90;
xingqiu add stats atk=200 er=0.2 cr=0.2 cd=0.4;
fischl char lvl=90/90 cons=0 talent=1,1,1;
fischl add weapon="favoniuswarbow" refine=1 lvl=90/90;
fischl add stats atk=200 em=100 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active xingqiu;
xingqiu burst;
xingqiu skill;
fischl skill;
xingqiu attack:3;
wait(300);
`;
async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}
function withoutOrigin(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutOrigin);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'origin' && key !== 'SourceHostOrigin').map(([key, field]) => [key, withoutOrigin(field)]));
  return value;
}
function gameplayResult(value: SourceHostResult['result']): unknown {
  const result = structuredClone(value) as { enemies: { reaction_status: { start: number; end: number; type: string }[] }[] };
  // The source appends still-active aura intervals from a Go map in stats/status.
  // Their report order is unspecified; all actual event arrays keep exact order.
  for (const enemy of result.enemies) enemy.reaction_status.sort((a, b) => a.start - b.start || a.end - b.end || a.type.localeCompare(b.type));
  return withoutOrigin(result);
}

test('native status lifecycle and actual pending attack stages preserve observed damage and calculator context', async ({ page }) => {
  test.setTimeout(120_000);
  const baselineMode = process.env.GIDPS_ORIGIN_BASELINE === '1';
  const receipts: unknown[] = [], pageErrors: string[] = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  let lastSequence = 0;
  let collectionRoundtrip = false, editedTotal: number | null = null;
  await page.goto('/source-simulation');
  await page.locator('#source-host-config').fill(script);
  await page.locator('#source-host-seed').fill('11');
  await page.locator('#source-host-phase-enabled').uncheck();
  try {
    for (const lane of ['classic', 'stellar'] as const) {
      await page.locator('#source-host-variant').selectOption(lane);
      await page.locator('#source-host-run').click();
      await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 60_000 });
      const result = await download(page, '#source-host-export') as SourceHostResult;
      expect(result.applications.length).toBeGreaterThan(5);
      const path = `docs/validation/action-origin-baseline-${lane}-20260929.capture.json`;
      if (baselineMode) {
        await writeFile(path, JSON.stringify(result));
        receipts.push({ lane, artifact: result.executionArtifact, applications: result.applications.length, path });
        continue;
      }
      await writeFile(`/tmp/gidps-action-origin-current-${lane}.json`, JSON.stringify(result));
      const baseline = JSON.parse(await readFile(path, 'utf8')) as SourceHostResult;
      for (const field of ['calculations', 'applications', 'energyApplications', 'healingApplications', 'playerApplications', 'drainApplications'] as const)
        expect(withoutOrigin(result[field]), `${lane} preserves ${field}`).toEqual(withoutOrigin(baseline[field]));
      expect(gameplayResult(result.result), `${lane} preserves result`).toEqual(gameplayResult(baseline.result));
      const byId = new Map(result.calculations.map(row => [row.request.id, row.request]));
      const skillAction = sourceActionReceipts(result.logs).find(row => row.characterKey === 'xingqiu' && row.action === 'skill' && row.acceptedFrame !== undefined);
      expect(skillAction).toBeTruthy();
      const sequence = skillAction!.sequence;
      lastSequence = sequence;
      const collection = captureSourceHostActionCollection(result, sequence, 'creation');
      expect(collection.hits.length).toBeGreaterThanOrEqual(2);
      const calculation = calculateSourceHostActionCollection(collection);
      expect(calculation.total).toBe(calculation.originalRawTotal);
      const rainswords = result.applications.filter(row => byId.get(row.calculationId)?.actorKey === 'xingqiu' && byId.get(row.calculationId)?.ability === 'Guhua Sword: Raincutter');
      expect(rainswords.length).toBeGreaterThan(0);
      for (const row of rainswords) expect(row.origin?.creationActionSequence).toBeUndefined();
      expect(rainswords.some(row => row.origin?.triggerActionSequence)).toBe(true);
      const burst = sourceActionReceipts(result.logs).find(row => row.characterKey === 'xingqiu' && row.action === 'burst' && row.acceptedFrame !== undefined)!;
      for (const row of rainswords) {
        expect(row.origin?.statusOwner?.creationActionSequence).toBe(burst.sequence);
        expect(row.origin?.statusOwner?.instanceId).toBeGreaterThan(0);
      }
      const ownedCollection = captureSourceHostActionCollection(result, burst.sequence, 'status-owner');
      const ownedCalculation = calculateSourceHostActionCollection(ownedCollection);
      expect(ownedCollection.hits.length).toBeGreaterThanOrEqual(rainswords.length);
      expect(ownedCalculation.total).toBe(ownedCalculation.originalRawTotal);
      expect(result.lifecycleObservationFrame).toBe((result.result as { duration: number }).duration);
      expect(result.statusInstances!.length).toBeGreaterThan(0);
      for (const hit of rainswords) {
        const instance = result.statusInstances!.find(row => row.instanceId === hit.origin!.statusOwner!.instanceId)!;
        expect(instance.creationActionSequence).toBe(burst.sequence);
        expect(instance.endState).toBe('active-at-end');
        expect(ownedCollection.statusInstances).toContainEqual(instance);
      }
      expect(ownedCollection.pendingAttackStages).toEqual(result.pendingAttackStages!.filter(row => row.origin.statusOwner?.creationActionSequence === burst.sequence));
      lastSequence = burst.sequence;
      receipts.push({ lane, artifact: result.executionArtifact, applications: result.applications.length, creationSequence: sequence,
        collectionHits: collection.hits.length, originalRawTotal: calculation.originalRawTotal, replayDifference: calculation.total - calculation.originalRawTotal,
        statusOwnerSequence: burst.sequence, statusOwnerHits: ownedCollection.hits.length, statusOwnerTotal: ownedCalculation.total,
        statusOwnerReplayDifference: ownedCalculation.total - ownedCalculation.originalRawTotal,
        statusInstances: [...new Set(rainswords.map(row => row.origin!.statusOwner!.instanceId))],
        lifecycleObservationFrame: result.lifecycleObservationFrame,
        statusEndStates: result.statusInstances!.reduce((counts, row) => ({ ...counts, [row.endState]: (counts[row.endState] ?? 0) + 1 }), {} as Record<string, number>),
        pendingStages: result.pendingAttackStages!.length,
        rainswordCreationUnknown: true, rainswordTriggerKnown: true, gameplayUnchanged: true });
    }
    if (!baselineMode) {
      await expect(page.locator('[data-source-host-attack-observations]')).toBeVisible();
      await page.locator(`[data-origin-action="${lastSequence}"] [data-origin-kind="status-owner"]`).click();
      await expect(page.locator('[data-source-action-collection]')).toBeVisible();
      await expect(page.locator('[data-source-action-collection]')).toContainText('主动状态关联');
      await expect(page.locator('[data-source-action-collection] [data-source-host-lifecycle]')).toBeVisible();
      const input = page.locator('[data-source-action-editor] [data-source-host-input="scalingValue"]');
      const prior = Number(await input.inputValue());
      await input.fill('');
      await expect(page.locator('[data-source-action-summary]')).toContainText('请修正');
      await input.fill(String(prior + 100));
      await page.locator('[data-source-action-included]').last().uncheck();
      const saved = await download(page, '[data-source-action-export]') as SourceHostActionCollection;
      editedTotal = calculateSourceHostActionCollection(saved).total;
      expect(saved.hits.at(-1)!.included).toBe(false);
      expect(saved.hits[0]!.calculation.request.input).toMatchObject({ scalingValue: prior + 100 });
      await page.locator('#calc-import').setInputFiles({ name: 'action-hits.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
      await expect(page.locator('[data-source-action-collection]')).toBeVisible();
      const restored = await download(page, '[data-source-action-export]');
      expect(restored).toEqual(saved);
      expect(calculateSourceHostActionCollection(restored).total).toBe(editedTotal);
      collectionRoundtrip = true;
      // Source Venti press E schedules an actual core application task at +51f.
      // The 30-frame window must retain the task without counting its damage.
      await page.goto('/source-simulation');
      await page.locator('#source-host-config').fill(`options iteration=1 duration=0.5;
venti char lvl=90/90 cons=0 talent=1,1,1;
venti add weapon="favoniuswarbow" refine=1 lvl=90/90;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active venti;
venti skill;
wait(120);
`);
      await page.locator('#source-host-phase-enabled').uncheck();
      for (const lane of ['classic', 'stellar'] as const) {
        await page.locator('#source-host-variant').selectOption(lane);
        await page.locator('#source-host-run').click();
        await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 60_000 });
        const result = await download(page, '#source-host-export') as SourceHostResult;
        const pending = result.pendingAttackStages!;
        expect(result.applications).toHaveLength(0);
        expect(pending).toHaveLength(1);
        expect(pending[0]!.stage).toBe('application');
        expect(pending[0]!.dueFrame).toBeGreaterThan(result.lifecycleObservationFrame!);
        expect(pending[0]!.origin.creationActionSequence).toBeGreaterThan(0);
        await expect(page.locator('[data-source-host-lifecycle]')).toContainText('待处理攻击任务（1 条');
        receipts.push({ lane, scenario: 'truncated-core-attack', lifecycleObservationFrame: result.lifecycleObservationFrame, applications: 0, pending });
      }
    }
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile(`docs/validation/${baselineMode ? 'action-origin-baseline' : 'lifecycle-browser'}-20260929.result.json`, JSON.stringify({ receipts, pageErrors, collectionRoundtrip, editedTotal }, null, 2) + '\n');
  }
});
