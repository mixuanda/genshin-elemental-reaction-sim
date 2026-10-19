import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostEditableCalculation, captureSourceHostHit,
  createSourceHostEditableCalculation, replaySourceHostHit,
  type SourceHostEditableCalculation,
} from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostBasePanel } from '../../../packages/sim-core/src/source-host-base-panel';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';
import type { SourceHostStatReadReceipt } from '../../../packages/sim-core/src/source-host-stat-provenance';

// The same source script and seed as the immutable action-origin captures.
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

function withoutNewProvenance(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNewProvenance);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'origin' && key !== 'SourceHostOrigin' && key !== 'basePanel')
    .map(([key, field]) => [key, withoutNewProvenance(field)]));
  return value;
}

function gameplayResult(value: SourceHostResult['result']): unknown {
  const result = structuredClone(value) as { enemies: { reaction_status: { start: number; end: number; type: string }[] }[] };
  // The source appends live aura intervals from a Go map; their report order is unspecified.
  for (const enemy of result.enemies) enemy.reaction_status.sort((a, b) => a.start - b.start || a.end - b.end || a.type.localeCompare(b.type));
  return withoutNewProvenance(result);
}

function readsFrom(read: SourceHostStatReadReceipt): SourceHostStatReadReceipt[] {
  return [read, ...read.steps.flatMap(step => step.dependencies.flatMap(readsFrom))];
}

test('both native lanes expose an actual base-panel getter without changing gameplay or standalone hit replay', async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const measurements: Array<Record<string, unknown>> = [];
  page.on('pageerror', error => pageErrors.push(error.message));
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
      const rawPath = `/tmp/gidps-base-panel-current-${lane}.json`;
      await writeFile(rawPath, JSON.stringify(result)); // Keep the native result before any assertion.
      const baseline = JSON.parse(await readFile(`docs/validation/action-origin-baseline-${lane}-20260929.capture.json`, 'utf8')) as SourceHostResult;
      expect(result.config).toBe(script);
      expect(result.seed).toBe('11');
      for (const field of ['calculations', 'applications', 'energyApplications', 'healingApplications', 'playerApplications', 'drainApplications'] as const)
        expect(withoutNewProvenance(result[field]), `${lane} preserves ${field}`).toEqual(withoutNewProvenance(baseline[field]));
      expect(gameplayResult(result.result), `${lane} preserves native gameplay result`).toEqual(gameplayResult(baseline.result));

      const byId = new Map(result.calculations.map(row => [row.request.id, row.request]));
      const candidates = result.applications.flatMap((application, index) => {
        const request = byId.get(application.calculationId);
        if (!request || request.kind !== 'damage' || application.rawDamage <= 0) return [];
        const provenance = request.snapshot?.statProvenance;
        const getter = provenance?.snapshotRead;
        return getter?.basePanel ? [{ application, index, request, getter }] : [];
      });
      expect(candidates.length, `${lane} has a positive ordinary hit with an actual Stats getter`).toBeGreaterThan(0);
      const actors = new Set(candidates.map(row => row.request.actorKey));
      expect([...actors]).toContain('xingqiu');
      expect([...actors]).toContain('fischl');
      const selected = candidates.find(row => row.request.actorKey === 'xingqiu')!;
      const panel: SourceHostBasePanel = selected.getter.basePanel!;
      expect(panel.version).toBe('base-panel-v1');
      expect(panel.actorIndex).toBe(selected.request.actorIndex);
      expect(panel.characterKey).toBe(selected.request.actorKey);
      expect(panel.inputOrigin).toBe('configured-stats');
      expect(panel.characterLevel).toBe(90);
      expect(panel.weaponLevel).toBe(90);
      expect(panel.weaponRefinement).toBe(1);
      for (const vector of [panel.configuredStats, panel.characterStats, panel.weaponStats, panel.result])
        expect(vector).toHaveLength(26);
      expect(panel.result).toEqual(selected.getter.base);
      expect(panel.characterSteps.length).toBeGreaterThan(0);
      expect(panel.weaponSteps.length).toBeGreaterThan(0);
      for (const read of readsFrom(selected.getter)) {
        if (!read.basePanel) continue;
        expect(read.basePanel.actorIndex).toBe(read.actorIndex);
      }

      const capture = captureSourceHostHit(result, selected.application.id);
      const replay = replaySourceHostHit(capture);
      expect(replay.difference).toBe(0);
      expect(replay.reproducedRawDamage).toBe(selected.application.rawDamage);
      const baseNodes = replay.trace.filter(node => node.id.includes('.basePanel.'));
      expect(baseNodes.length, `${lane} exposes the base-panel AST in the actual hit`).toBeGreaterThan(0);
      expect(baseNodes.some(node => node.titleKey.includes('基础面板'))).toBe(true);
      expect(baseNodes.some(node => node.symbolicFormula.length > 0 && node.substitution.length > 0)).toBe(true);
      const originalEditable = createSourceHostEditableCalculation(capture);
      expect(calculateSourceHostEditableCalculation(originalEditable).difference).toBe(0);

      await page.locator('#source-host-hit-index').fill(String(selected.index));
      await expect(page.locator('#source-host-hit [data-source-base-panel]')).toBeVisible();
      await page.locator('#source-host-open-calculator').click();
      await expect(page).toHaveURL(/\/calculator$/);
      await expect(page.locator('#calc-source-host-editor [data-source-base-panel]')).toBeVisible();
      await expect(page.locator('#calc-source-host-editor [data-source-base-panel]')).toContainText('基础面板');
      const saved = await download(page, '[data-source-host-export]') as SourceHostEditableCalculation;
      expect(saved.originalCapture).toEqual(capture);
      expect(calculateSourceHostEditableCalculation(saved).difference).toBe(0);
      await page.locator('#calc-import').setInputFiles({ name: `base-panel-${lane}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
      await expect(page.locator('#calc-source-host-editor [data-source-base-panel]')).toBeVisible();
      expect(await download(page, '[data-source-host-export]')).toEqual(saved);

      measurements.push({ lane, rawPath, baselinePath: `docs/validation/action-origin-baseline-${lane}-20260929.capture.json`,
        executionArtifact: result.executionArtifact, applicationId: selected.application.id,
        actorKey: selected.request.actorKey, frame: selected.request.frame,
        basePanel: { version: panel.version, actorIndex: panel.actorIndex, characterKey: panel.characterKey,
          weaponKey: panel.weaponKey, inputOrigin: panel.inputOrigin, characterSteps: panel.characterSteps.length,
          weaponSteps: panel.weaponSteps.length, result: panel.result },
        replayDifference: replay.difference, traceNodeIds: baseNodes.map(node => node.id),
        nativeGameplayUnchanged: true, standaloneRoundtrip: true });
      if (lane === 'classic') {
        await page.goto('/source-simulation');
        await page.locator('#source-host-config').fill(script);
        await page.locator('#source-host-seed').fill('11');
        await page.locator('#source-host-phase-enabled').uncheck();
      }
    }
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile('docs/validation/base-panel-browser-20260929.result.json', JSON.stringify({
      schemaVersion: 'source-base-panel-browser-v1', script, seed: '11', measurements, pageErrors,
    }, null, 2) + '\n');
  }
});
