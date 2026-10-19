import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostActionCollection, captureSourceHostActionCollection, captureSourceHostFiniteSkillCollection,
  type SourceHostActionCollection,
} from '../../../packages/sim-core/src/source-host-action-collection';
import { replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';
import type { SourceSingleSkillDraft } from '../src/source-single-skill';

type RunExport = { schemaVersion: 'source-single-skill-result-v1'; input: SourceSingleSkillDraft; result: SourceHostResult };

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

async function runAmberBurst(page: Page, durationSeconds: number): Promise<RunExport> {
  await page.goto('/calculator');
  await page.locator('[data-action="source-single-skill"]').click();
  const panel = page.locator('#calc-source-single-skill [data-source-single-skill]');
  await expect(panel.locator('[data-single-import]')).toBeEnabled();

  // Start with the archived, valid single-skill draft shape, then change only the
  // character-specific fields required for Amber Q. The large target contains the
  // whole intrinsic arrow pattern; no team script or inferred action is involved.
  const archived = JSON.parse(await readFile('docs/validation/source-target-scene-single-20260929.capture.json', 'utf8')) as RunExport;
  const input = structuredClone(archived.input);
  input.member.id = 'amber';
  input.member.characterKey = 'amber';
  input.member.constellation = 0;
  input.member.weapon = { key: 'ravenbow', level: 90, levelCap: 90, refinement: 1 };
  input.action = { kind: 'burst' };
  input.durationSeconds = durationSeconds;
  input.target = { level: 90, resistance: 0.1, geometry: { radius: 10, x: 0, y: 2.4 } };
  delete input.additionalTargets;
  delete input.primaryTargetIndex;

  await panel.locator('[data-single-import]').setInputFiles({
    name: `amber-q-${durationSeconds}s.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)),
  });
  await expect(panel.locator('[data-single-status]')).toContainText('已导入单动作输入 JSON');
  await expect(panel.locator('[data-single-action]')).toHaveValue('burst');
  await expect(panel.locator('[data-single-duration]')).toHaveValue(String(durationSeconds));
  await panel.locator('[data-single-run]').click();
  await expect(panel.locator('[data-single-status]')).toContainText('运行完成', { timeout: 60_000 });
  const raw = await download(page, '#calc-source-single-skill [data-single-result-export]') as RunExport;
  return raw;
}

test('Amber Q finite-cast certificate closes only after every intrinsic root resolves', async ({ page }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  const measurements: Record<string, unknown> = {};
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    // Exactly two source executions: one long enough to close all 18 roots and
    // one actual short observation that leaves native roots pending.
    const full = await runAmberBurst(page, 6);
    const fullRawPath = '/tmp/gidps-finite-cast-amber-q-full.json';
    await writeFile(fullRawPath, JSON.stringify(full)); // Archive native output before assertions.
    measurements.full = { rawPath: fullRawPath, nativeResultArchived: true };
    expect(full.input.source.hostVariant).toBe('classic');
    expect(full.input.member.characterKey).toBe('amber');
    expect(full.input.action.kind).toBe('burst');
    expect(full.result.abilityInvocations).toHaveLength(1);
    const invocation = full.result.abilityInvocations![0]!;
    expect(invocation.characterKey).toBe('amber');
    expect(invocation.action).toBe('burst');
    expect(invocation.success).toBe(true);
    expect(invocation.queuedAttacks).toHaveLength(18);

    const collection = captureSourceHostFiniteSkillCollection(full.result, invocation.actionSequence);
    expect(collection).toBeDefined();
    const analysis = calculateSourceHostActionCollection(collection!);
    expect(analysis.completeCast).toBe(true);
    expect(analysis.finiteCast).toMatchObject({ expectedRootAttackCount: 18, completedRootAttackCount: 18, closed: true });
    expect(collection!.scope).toBe('finite-skill-cast');
    const native = full.result.result as { total_damage: number };
    expect(analysis.total).toBeCloseTo(native.total_damage, 8);
    expect(analysis.rows.length).toBeGreaterThan(0);
    const intrinsicApplications = collection!.hits.map(hit => hit.calculation.originalCapture.application);
    expect(analysis.total).toBeCloseTo(intrinsicApplications.reduce((sum, application) => sum + application.appliedDamage, 0), 8);
    for (const row of collection!.hits) expect(replaySourceHostHit(row.calculation.originalCapture).difference).toBe(0);

    const finitePanel = page.locator('[data-single-finite-cast]');
    await expect(finitePanel).toHaveAttribute('data-single-finite-cast-status', 'complete');
    await expect(finitePanel.locator('[data-single-finite-cast-expected-roots]')).toContainText('18');
    await expect(finitePanel.locator('[data-single-finite-cast-completed-roots]')).toContainText('18');
    await expect(finitePanel.locator('[data-single-open-finite-cast]')).toBeVisible();
    await finitePanel.locator('[data-single-open-finite-cast]').click();
    const certificate = page.locator('[data-source-finite-skill-certificate]');
    await expect(certificate).toBeVisible();
    await expect(certificate.locator('[data-source-finite-skill-status]')).toContainText(/完整|闭合/);
    await expect(certificate.locator('[data-source-finite-skill-expected-roots]')).toContainText('18');
    await expect(certificate.locator('[data-source-finite-skill-completed-roots]')).toContainText('18');
    const formula = page.locator('[data-source-action-collection] [data-source-host-calculation-result]').first();
    await expect(formula).toBeVisible();
    await formula.scrollIntoViewIfNeeded();
    await formula.screenshot({ path: 'docs/validation/source-finite-cast-amber-q-formula-20260929.png' });

    const exported = await download(page, '[data-source-action-collection] [data-source-action-export]') as SourceHostActionCollection;
    expect(exported.scope).toBe('finite-skill-cast');
    expect(calculateSourceHostActionCollection(exported).completeCast).toBe(true);
    const excluded = structuredClone(exported);
    const excludedHit = excluded.hits.find(hit => hit.included)!;
    excludedHit.included = false;
    const excludedAnalysis = calculateSourceHostActionCollection(excluded);
    expect(excludedAnalysis.completeCast).toBe(false);
    expect(excludedAnalysis.total).toBeLessThan(analysis.total);

    const missingCompletion = structuredClone(full.result);
    const completions = missingCompletion.attackDispatchCompletions ?? [];
    expect(completions.length).toBeGreaterThan(0);
    missingCompletion.attackDispatchCompletions = completions.slice(1);
    const incompleteCollection = captureSourceHostFiniteSkillCollection(missingCompletion, invocation.actionSequence);
    expect(incompleteCollection).toBeDefined();
    expect(calculateSourceHostActionCollection(incompleteCollection!).completeCast).toBe(false);
    const legacy = structuredClone(full.result) as SourceHostResult & { abilityInvocations?: unknown };
    delete legacy.abilityInvocations;
    expect(captureSourceHostFiniteSkillCollection(legacy, invocation.actionSequence)).toBeUndefined();
    const legacyObserved = captureSourceHostActionCollection(full.result, invocation.actionSequence, 'creation');
    expect(calculateSourceHostActionCollection(legacyObserved).completeCast).toBe(false);

    await page.locator('#calc-import').setInputFiles({
      name: 'amber-q-finite-cast.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)),
    });
    const restored = page.locator('[data-source-action-collection]');
    await expect(restored).toBeVisible();
    expect(await download(page, '[data-source-action-collection] [data-source-action-export]')).toEqual(exported);
    expect(calculateSourceHostActionCollection(exported).completeCast).toBe(true);

    const partial = await runAmberBurst(page, 2);
    const partialRawPath = '/tmp/gidps-finite-cast-amber-q-partial.json';
    await writeFile(partialRawPath, JSON.stringify(partial)); // Preserve the actual pending native result first.
    measurements.partial = { rawPath: partialRawPath, nativeResultArchived: true };
    expect(partial.result.abilityInvocations).toHaveLength(1);
    const partialInvocation = partial.result.abilityInvocations![0]!;
    expect(partialInvocation.queuedAttacks).toHaveLength(18);
    const partialCollection = captureSourceHostFiniteSkillCollection(partial.result, partialInvocation.actionSequence);
    expect(partialCollection).toBeDefined();
    const partialAnalysis = calculateSourceHostActionCollection(partialCollection!);
    expect(partialAnalysis.completeCast).toBe(false);
    expect(partialAnalysis.finiteCast?.expectedRootAttackCount).toBe(18);
    expect(partialAnalysis.finiteCast?.completedRootAttackCount).toBeLessThan(18);
    expect(partialAnalysis.finiteCast?.closed).toBe(false);
    expect(partial.result.pendingAttackStages?.length).toBeGreaterThan(0);
    expect(partialAnalysis.pendingCount).toBeGreaterThan(0);
    expect(partialAnalysis.knownSubtotal).toBeDefined();
    await expect(page.locator('[data-single-finite-cast]')).toHaveAttribute('data-single-finite-cast-status', 'pending');

    expect(pageErrors).toEqual([]);
    measurements.full = {
      rawPath: fullRawPath, expectedRoots: 18, completedRoots: analysis.finiteCast?.completedRootAttackCount,
      applications: full.result.applications.length, total: analysis.total, nativeTotalDamage: native.total_damage,
      replayDifferences: collection!.hits.map(hit => replaySourceHostHit(hit.calculation.originalCapture).difference),
      excludedHitCloses: excludedAnalysis.completeCast, missingCompletionCloses: calculateSourceHostActionCollection(incompleteCollection!).completeCast,
      legacyCaptureAvailable: false, importExportSame: true,
    };
    measurements.partial = {
      rawPath: partialRawPath, expectedRoots: 18, completedRoots: partialAnalysis.finiteCast?.completedRootAttackCount,
      pending: partialAnalysis.pendingCount, knownSubtotal: partialAnalysis.knownSubtotal, completeCast: partialAnalysis.completeCast,
    };
  } finally {
    await writeFile('docs/validation/source-finite-cast-browser-20260929.result.json', JSON.stringify({
      schemaVersion: 'source-finite-cast-browser-v1', measurements, pageErrors,
      scope: 'Two actual classic Amber Q executions (6s closed and 2s pending); one intrinsic action contract, not a universal full-skill or full-cast proof.',
    }, null, 2) + '\n');
  }
});
