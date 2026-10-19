import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostActionCollection, captureSourceHostActionCollection,
  type SourceHostActionCollection,
} from '../../../packages/sim-core/src/source-host-action-collection';
import { sourceActionReceipts } from '../../../packages/sim-core/src/source-host-action-origin';
import { replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import {
  selectSourceHostTaskLifecycle, sourceHostTaskLifecycleSchema,
  summarizeSourceHostTaskLifecycle,
} from '../../../packages/sim-core/src/source-host-task-lifecycle';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const script = [
  'options iteration=1 duration=12;',
  'xingqiu char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];',
  'xingqiu add weapon="favoniussword" refine=1 lvl=90/90;',
  'xingqiu add stats atk=200 er=0.2 cr=0.2 cd=0.4;',
  'fischl char lvl=90/90 cons=0 talent=1,1,1;',
  'fischl add weapon="favoniuswarbow" refine=1 lvl=90/90;',
  'fischl add stats atk=200 em=100 cr=0.2 cd=0.4;',
  'target lvl=90 resist=0.1 radius=2 pos=0,2.4;',
  'active xingqiu;',
  'xingqiu burst;',
  'xingqiu skill;',
  'fischl skill;',
  'xingqiu attack:3;',
  'wait(300);',
  '',
].join('\n');

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

function comparableGameplay(value: SourceHostResult['result']): SourceHostResult['result'] {
  const result = structuredClone(value) as SourceHostResult['result'] & {
    enemies: { reaction_status?: { start: number; end: number; type: string }[] | null }[];
  };
  for (const enemy of result.enemies)
    enemy.reaction_status?.sort((a, b) => a.start - b.start || a.end - b.end || a.type.localeCompare(b.type));
  return result;
}

test('both native lanes preserve gameplay while exposing queue-local task lifecycles and action context', async ({ page }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  const measurements: Array<Record<string, unknown>> = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    for (const lane of ['classic', 'stellar'] as const) {
      await page.goto('/source-simulation');
      await page.locator('#source-host-variant').selectOption(lane);
      await page.locator('#source-host-config').fill(script);
      await page.locator('#source-host-seed').fill('11');
      await page.locator('#source-host-phase-enabled').uncheck();
      await page.locator('#source-host-run').click();
      await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 60_000 });
      const result = await download(page, '#source-host-export') as SourceHostResult;
      const rawPath = '/tmp/gidps-task-lifecycle-' + lane + '.json';
      await writeFile(rawPath, JSON.stringify(result)); // Preserve the full native record before assertions.
      const baselinePath = 'docs/validation/talent-range-' + lane + '-20260929.capture.json';
      const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as SourceHostResult;
      expect(result.config).toBe(script);
      expect(result.seed).toBe('11');
      const currentFields = Object.keys(result).filter(key => key !== 'taskLifecycle').sort();
      expect(currentFields).toEqual(Object.keys(baseline).sort());
      const current = result as unknown as Record<string, unknown>;
      const old = baseline as unknown as Record<string, unknown>;
      for (const key of Object.keys(old)) {
        if (key === 'executionArtifact' || key === 'result') continue;
        expect(current[key], lane + ': unchanged ' + key).toEqual(old[key]);
      }
      expect(comparableGameplay(result.result), lane + ': unchanged gameplay')
        .toEqual(comparableGameplay(baseline.result));
      expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);

      const lifecycle = sourceHostTaskLifecycleSchema.parse(result.taskLifecycle);
      expect(lifecycle.observationFrame).toBe(result.lifecycleObservationFrame);
      expect(lifecycle.queues.length).toBeGreaterThan(0);
      expect(lifecycle.tasks.length).toBeGreaterThan(0);
      const queueById = new Map(lifecycle.queues.map(queue => [queue.id, queue]));
      const taskById = new Map(lifecycle.tasks.map(task => [task.id, task]));
      expect(queueById.size).toBe(lifecycle.queues.length);
      expect(taskById.size).toBe(lifecycle.tasks.length);
      const completed = lifecycle.tasks.filter(task => task.state === 'completed');
      const pending = lifecycle.tasks.filter(task => task.state === 'pending');
      const withParent = lifecycle.tasks.filter(task => task.parentTaskId !== undefined);
      expect(completed.length).toBeGreaterThan(0);
      for (const task of lifecycle.tasks) {
        expect(queueById.has(task.queueId)).toBe(true);
        const ancestry = new Set<number>([task.id]);
        let parentId = task.parentTaskId;
        while (parentId !== undefined) {
          expect(ancestry.has(parentId), lane + ': task parent cycle').toBe(false);
          ancestry.add(parentId);
          const parent = taskById.get(parentId);
          expect(parent, lane + ': missing parent task').toBeDefined();
          parentId = parent!.parentTaskId;
        }
        if (task.state === 'completed') {
          expect(task.runFrame).toBeDefined();
          expect(task.completedFrame).toBeDefined();
          expect(task.completedFrame).toBeLessThanOrEqual(lifecycle.observationFrame);
        } else {
          expect(task.runFrame).toBeUndefined();
          expect(task.completedFrame).toBeUndefined();
        }
      }

      const resultLedger = page.locator('[data-source-host-task-lifecycle]');
      await expect(resultLedger).toBeVisible();
      await expect(resultLedger.locator('[data-source-host-task-total]')).toContainText(String(lifecycle.tasks.length));
      await expect(resultLedger.locator('[data-source-host-task-completed]')).toContainText(String(completed.length));
      await expect(resultLedger.locator('[data-source-host-task-pending]')).toContainText(String(pending.length));
      await resultLedger.locator(':scope > details > summary').click();
      await expect(resultLedger.locator('tr[data-source-host-task-row="' + lifecycle.tasks[0]!.id + '"]')).toBeVisible();

      const action = sourceActionReceipts(result.logs).find(row =>
        row.characterKey === 'xingqiu' && row.action === 'skill' && row.acceptedFrame !== undefined);
      expect(action, lane + ': accepted Xingqiu E').toBeDefined();
      const collection = captureSourceHostActionCollection(result, action!.sequence, 'creation');
      const selectedLifecycle = selectSourceHostTaskLifecycle(lifecycle, action!.sequence, 'creation');
      const summary = summarizeSourceHostTaskLifecycle(selectedLifecycle, action!.sequence, 'creation');
      const calculated = calculateSourceHostActionCollection(collection);
      expect(collection.taskLifecycle).toEqual(selectedLifecycle);
      expect(calculated.taskSummary).toEqual(summary);
      expect(summary.recorded).toBe(true);
      expect(summary.associatedTaskIds.length).toBeGreaterThan(0);
      expect(summary.associatedTaskIds.length + summary.contextTaskIds.length).toBe(selectedLifecycle.tasks.length);
      expect(calculated.completeCast).toBe(false);
      expect(collection.hits.length).toBeGreaterThan(0);
      expect(replaySourceHostHit(collection.hits[0]!.calculation.originalCapture).difference).toBe(0);
      for (const item of summary.pending) {
        const queue = queueById.get(item.queueId)!;
        expect(item.queueClock).toBe(queue.clock);
        expect(item.remainingLocalClock).toBe(item.dueClock - queue.clock);
      }

      await page.locator('[data-origin-action="' + action!.sequence + '"] [data-origin-kind="creation"]').click();
      await expect(page).toHaveURL(/\/calculator$/);
      const editor = page.locator('[data-source-action-collection]');
      await expect(editor).toBeVisible();
      const collectionLedger = editor.locator('[data-source-host-task-lifecycle]');
      await expect(collectionLedger).toBeVisible();
      await expect(collectionLedger.locator('[data-source-host-task-total]'))
        .toContainText(String(selectedLifecycle.tasks.length));
      const saved = await download(page, '[data-source-action-collection] [data-source-action-export]') as SourceHostActionCollection;
      expect(saved).toEqual(collection);
      expect(saved.taskLifecycle).toEqual(selectedLifecycle);
      await page.locator('#calc-import').setInputFiles({
        name: 'task-lifecycle-' + lane + '.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(saved)),
      });
      await expect(page.locator('[data-source-action-collection] [data-source-host-task-lifecycle]')).toBeVisible();
      const restored = await download(page, '[data-source-action-collection] [data-source-action-export]') as SourceHostActionCollection;
      expect(restored).toEqual(saved);
      expect(calculateSourceHostActionCollection(restored).taskSummary).toEqual(summary);

      measurements.push({
        lane, rawPath, baselinePath, executionArtifact: result.executionArtifact,
        observationFrame: lifecycle.observationFrame,
        queueCount: lifecycle.queues.length, queueClocks: lifecycle.queues.map(queue => ({
          id: queue.id, kind: queue.kind, actorIndex: queue.actorIndex, targetKey: queue.targetKey, clock: queue.clock,
        })),
        taskCount: lifecycle.tasks.length, completedCount: completed.length,
        pendingCount: pending.length, parentLinkedCount: withParent.length,
        parentOrPendingAbsent: withParent.length === 0 || pending.length === 0,
        actionSequence: action!.sequence, associatedTaskIds: summary.associatedTaskIds,
        contextTaskIds: summary.contextTaskIds, pendingLocalClocks: summary.pending,
        selectedHitCount: collection.hits.length, completeCast: calculated.completeCast,
        gameplayUnchanged: true, captureRoundtrip: true,
      });
    }
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile('docs/validation/task-lifecycle-browser-20260929.result.json', JSON.stringify({
      schemaVersion: 'source-task-lifecycle-browser-v1', seed: '11', script, measurements, pageErrors,
      scope: 'Native queue-local task clocks, observed pending/completed states and selected action context; no global-frame due time inference or complete-cast claim.',
    }, null, 2) + '\n');
  }
});
