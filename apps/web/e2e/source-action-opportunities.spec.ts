import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostActionCollection, captureSourceHostActionCollection,
  type SourceHostActionCollection,
} from '../../../packages/sim-core/src/source-host-action-collection';
import { sourceActionReceipts } from '../../../packages/sim-core/src/source-host-action-origin';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const xingqiu = `options iteration=1 duration=12;
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

const ventiHead = (duration: number) => `options iteration=1 duration=${duration};
venti char lvl=90/90 cons=0 talent=1,1,1;
venti add weapon="favoniuswarbow" refine=1 lvl=90/90;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active venti;
venti skill;
`;
// Source Venti press E fixes its circle at the target's cast-time location.
// Moving the synthetic target after the action window, before its 51f hitmark,
// creates an actual native target-contact miss, rather than inferring one from distance.
const missed = `${ventiHead(1)}set_target_pos(1,0,50);
wait(120);
`;
// The same close-target E stops at 30f with its +51f application still queued.
const pending = `${ventiHead(0.5)}wait(120);
`;

type Scenario = 'xingqiu' | 'missed' | 'pending';
const scripts: Record<Scenario, string> = { xingqiu, missed, pending };

async function download(page: Page, selector: string): Promise<unknown> {
  const request = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await request).path())!, 'utf8'));
}

function withoutNewMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNewMetadata);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'origin' && key !== 'SourceHostOrigin' && key !== 'basePanel' && key !== 'dispatchId')
    .map(([key, field]) => [key, withoutNewMetadata(field)]));
  return value;
}

function gameplayResult(value: SourceHostResult['result']): unknown {
  const result = structuredClone(value) as { enemies: { reaction_status: { start: number; end: number; type: string }[] }[] };
  // Source Go map iteration does not promise the order of still-active aura intervals.
  for (const enemy of result.enemies) enemy.reaction_status.sort((a, b) => a.start - b.start || a.end - b.end || a.type.localeCompare(b.type));
  return withoutNewMetadata(result);
}

test('actual dispatch opportunities distinguish calculated damage, observed miss, and still-pending attack', async ({ page }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  const measurements: Array<Record<string, unknown>> = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    for (const lane of ['classic', 'stellar'] as const) {
      for (const scenario of ['xingqiu', 'missed', 'pending'] as const) {
        await page.goto('/source-simulation');
        await page.locator('#source-host-variant').selectOption(lane);
        await page.locator('#source-host-config').fill(scripts[scenario]);
        await page.locator('#source-host-seed').fill('11');
        await page.locator('#source-host-phase-enabled').uncheck();
        await page.locator('#source-host-run').click();
        await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 60_000 });
        const result = await download(page, '#source-host-export') as SourceHostResult;
        const rawPath = `/tmp/gidps-opportunities-${lane}-${scenario}.json`;
        await writeFile(rawPath, JSON.stringify(result)); // Keep the complete native receipt before coverage assertions.
        expect(result.config).toBe(scripts[scenario]);
        expect(result.seed).toBe('11');
        const actor = scenario === 'xingqiu' ? 'xingqiu' : 'venti';
        const action = sourceActionReceipts(result.logs).find(row => row.characterKey === actor && row.action === 'skill' && row.acceptedFrame !== undefined);
        expect(action, `${lane}/${scenario}: accepted native E action`).toBeDefined();
        const collection = captureSourceHostActionCollection(result, action!.sequence, 'creation');
        const calculated = calculateSourceHostActionCollection(collection);
        expect(collection.sourceContext?.sourceConfig).toBe(scripts[scenario]);
        expect(collection.sourceContext?.seed).toBe('11');
        expect(calculated.completeCast).toBe(false);
        const measurement: Record<string, unknown> = {
          lane, scenario, rawPath, executionArtifact: result.executionArtifact,
          actionSequence: action!.sequence, actionAcceptedFrame: action!.acceptedFrame,
          applicationIds: collection.hits.map(row => row.calculation.originalCapture.application.id),
          attackObservations: collection.attackObservations?.length ?? 0,
          pendingStages: collection.pendingAttackStages?.length ?? 0,
          opportunities: calculated.opportunities.map(row => ({ id: row.id, stage: row.stage,
            status: row.status, attackId: row.attackId, dispatchId: row.dispatchId,
            targetKey: row.targetKey, applicationIds: row.applicationIds, value: row.value,
            traceIds: row.trace.map(node => node.id) })),
          knownSubtotal: calculated.knownSubtotal ?? null, total: calculated.total,
          completeCast: calculated.completeCast,
        };

        if (scenario === 'xingqiu') {
          const baselinePath = `docs/validation/action-origin-baseline-${lane}-20260929.capture.json`;
          const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as SourceHostResult;
          expect(result.sourceCommit).toBe(baseline.sourceCommit);
          for (const field of ['calculations', 'applications', 'energyApplications', 'healingApplications', 'playerApplications', 'drainApplications'] as const)
            expect(withoutNewMetadata(result[field]), `${lane} preserves ${field}`).toEqual(withoutNewMetadata(baseline[field]));
          expect(gameplayResult(result.result), `${lane} preserves gameplay`).toEqual(gameplayResult(baseline.result));
          expect(collection.hits.length).toBeGreaterThanOrEqual(2);
          expect(calculated.total).toBe(calculated.originalRawTotal);
          expect(calculated.knownSubtotal).toBe(calculated.total);
          const actualIds = collection.hits.map(row => row.calculation.originalCapture.application.id);
          const applied = calculated.opportunities.filter(row => row.status === 'calculated');
          const projectedIds = applied.flatMap(row => row.applicationIds);
          expect([...new Set(projectedIds)].sort((a, b) => a - b)).toEqual([...actualIds].sort((a, b) => a - b));
          expect(projectedIds).toHaveLength(actualIds.length);
          for (const row of applied) {
            expect(row.applicationIds).toHaveLength(1);
            expect(row.dispatchId).toBeGreaterThan(0);
            const resolved = collection.attackObservations?.filter(observation => observation.stage === 'resolved'
              && observation.dispatchId === row.dispatchId && observation.attackId === row.attackId
              && observation.targetKey === row.targetKey) ?? [];
            expect(resolved.length, `${lane}: application ${row.applicationIds[0]} has its own dispatch/attack/target receipt`).toBeGreaterThan(0);
          }
          measurement.baselinePath = baselinePath;
          measurement.originalRawTotal = calculated.originalRawTotal;
          measurement.gameplayUnchanged = true;
        } else {
          expect(collection.hits).toHaveLength(0);
          expect(result.applications).toHaveLength(0);
          if (scenario === 'missed') {
            const actualMisses = collection.attackObservations?.filter(row => row.stage === 'missed') ?? [];
            const misses = calculated.opportunities.filter(row => row.status === 'missed');
            expect(actualMisses.length, `${lane}: native target-contact miss`).toBeGreaterThan(0);
            expect(misses).toHaveLength(actualMisses.length);
            expect(calculated.knownSubtotal).toBe(0);
            expect(calculated.pendingCount).toBe(0);
            for (const row of misses) {
              expect(row.value).toBe(0);
              expect(row.trace.some(node => node.result?.value === 0)).toBe(true);
            }
          } else {
            expect(collection.pendingAttackStages).toHaveLength(1);
            expect(collection.pendingAttackStages?.[0]?.dueFrame).toBeGreaterThan(result.lifecycleObservationFrame!);
            expect(calculated.pendingCount).toBe(1);
            expect(calculated.knownSubtotal).toBeUndefined();
            expect(calculated.opportunities.some(row => row.status === 'missed')).toBe(false);
          }
        }

        await page.locator(`[data-origin-action="${action!.sequence}"] [data-origin-kind="creation"]`).click();
        await expect(page).toHaveURL(/\/calculator$/);
        const editor = page.locator('[data-source-action-collection]');
        await expect(editor).toBeVisible();
        const ledger = editor.locator('[data-source-action-opportunities]');
        await expect(ledger).toBeVisible();
        await expect(ledger).toContainText('已观察机会账本');
        if (scenario === 'missed') {
          await expect(ledger).toContainText('观察到未命中（0）');
          await expect(editor.locator('[data-source-action-editor]')).toBeHidden();
          await expect(editor.locator('[data-source-action-hit-select]')).toBeHidden();
        } else if (scenario === 'pending') {
          await expect(ledger).toContainText('这不等于技能伤害为零');
          await expect(ledger).toContainText('待结算');
          await expect(ledger).not.toContainText('纳入命中的公式伤害小计：0');
          await expect(editor.locator('[data-source-action-editor]')).toBeHidden();
          await expect(editor.locator('[data-source-action-hit-select]')).toBeHidden();
        }
        const saved = await download(page, '[data-source-action-collection] [data-source-action-export]') as SourceHostActionCollection;
        expect(saved).toEqual(collection);
        expect(saved.sourceContext).toEqual(collection.sourceContext);
        await page.locator('#calc-import').setInputFiles({ name: `action-opportunities-${lane}-${scenario}.json`,
          mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
        await expect(page.locator('[data-source-action-collection] [data-source-action-opportunities]')).toBeVisible();
        const restored = await download(page, '[data-source-action-collection] [data-source-action-export]') as SourceHostActionCollection;
        expect(restored).toEqual(saved);
        expect(restored.sourceContext).toEqual(saved.sourceContext);
        expect(calculateSourceHostActionCollection(restored).knownSubtotal).toBe(calculated.knownSubtotal);
        measurement.collectionRoundtrip = true;
        measurements.push(measurement);
      }
    }
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile('docs/validation/action-opportunities-browser-20260929.result.json', JSON.stringify({
      schemaVersion: 'source-action-opportunities-browser-v1', seed: '11', scripts, measurements, pageErrors,
      scope: 'Actual observed action opportunities only; no complete-cast claim or inferred zero for pending work.',
    }, null, 2) + '\n');
  }
});
