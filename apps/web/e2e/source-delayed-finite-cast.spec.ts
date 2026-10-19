import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostActionCollection, captureSourceHostFiniteSkillCollection,
  type SourceHostActionCollection,
} from '../../../packages/sim-core/src/source-host-action-collection';
import { replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';
import type { SourceSingleSkillDraft } from '../src/source-single-skill';

type RunExport = { schemaVersion: 'source-single-skill-result-v1'; input: SourceSingleSkillDraft; result: SourceHostResult };
type Character = 'diona' | 'kaeya';

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

async function runBurst(page: Page, character: Character, durationSeconds: number, rawPath: string): Promise<RunExport> {
  await page.goto('/calculator');
  await page.locator('[data-action="source-single-skill"]').click();
  const panel = page.locator('#calc-source-single-skill [data-source-single-skill]');
  await expect(panel.locator('[data-single-import]')).toBeEnabled();
  const archived = JSON.parse(await readFile('docs/validation/source-target-scene-single-20260929.capture.json', 'utf8')) as RunExport;
  const input = structuredClone(archived.input);
  input.member.id = character;
  input.member.characterKey = character;
  input.member.constellation = 0;
  const weaponLevel = character === 'diona' ? 90 : 70;
  input.member.weapon = { key: character === 'diona' ? 'ravenbow' : 'dullblade', level: weaponLevel, levelCap: weaponLevel, refinement: 1 };
  input.member.artifactSets = [];
  input.member.artifactStats = {};
  input.action = { kind: 'burst' };
  input.durationSeconds = durationSeconds;
  input.target = { level: 90, resistance: 0.1, geometry: { radius: 10, x: 0, y: 2.4 } };
  input.startup = 'full';
  delete input.additionalTargets;
  delete input.primaryTargetIndex;
  await panel.locator('[data-single-import]').setInputFiles({
    name: `${character}-q-${durationSeconds}s.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)),
  });
  await expect(panel.locator('[data-single-status]')).toContainText('已导入单动作输入 JSON');
  await panel.locator('[data-single-run]').click();
  await expect(panel.locator('[data-single-status]')).toContainText('运行完成', { timeout: 90_000 });
  const raw = await download(page, '#calc-source-single-skill [data-single-result-export]') as RunExport;
  await writeFile(rawPath, JSON.stringify(raw)); // Persist the full native receipt before inspecting it.
  return raw;
}

function inspectRun(raw: RunExport, character: Character) {
  expect(raw.input.source.hostVariant).toBe('classic');
  expect(raw.input.member.characterKey).toBe(character);
  expect(raw.input.action.kind).toBe('burst');
  expect(raw.result.abilityInvocations).toHaveLength(1);
  const invocation = raw.result.abilityInvocations![0]!;
  expect(invocation.characterKey).toBe(character);
  expect(invocation.action).toBe('burst');
  expect(invocation.success).toBe(true);
  expect(raw.result.abilityProducers).toBeDefined();
  const collection = captureSourceHostFiniteSkillCollection(raw.result, invocation.actionSequence);
  expect(collection).toBeDefined();
  const analysis = calculateSourceHostActionCollection(collection!);
  const nativeDamage = (raw.result.result as { total_damage: number }).total_damage;
  const applications = collection!.hits.map(hit => hit.calculation.originalCapture.application);
  expect(analysis.total).toBeCloseTo(nativeDamage, 8);
  expect(analysis.total).toBeCloseTo(applications.reduce((sum, application) => sum + application.appliedDamage, 0), 8);
  for (const hit of collection!.hits) expect(replaySourceHostHit(hit.calculation.originalCapture).difference).toBe(0);
  return { invocation, collection: collection!, analysis, nativeDamage, replayedHits: applications.length };
}

test('audited delayed Diona and recursive Kaeya bursts close only when their native producers finish', async ({ page }) => {
  test.setTimeout(360_000);
  const pageErrors: string[] = [];
  const measurements: Record<string, unknown> = {};
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    const dionaPath = '/tmp/gidps-delayed-finite-diona-full.json';
    const diona = await runBurst(page, 'diona', 15, dionaPath);
    measurements.dionaFull = { rawPath: dionaPath, nativeResultArchived: true };
    const dionaRun = inspectRun(diona, 'diona');
    const dionaFinite = dionaRun.analysis.finiteCast!;
    expect(dionaRun.analysis.completeCast).toBe(true);
    expect(dionaFinite).toMatchObject({ rootCountKind: 'fixed', expectedRootAttackCount: 7,
      observedRootAttackCount: 7, completedRootAttackCount: 7, producerCount: 7,
      completedProducerCount: 7, pendingProducerCount: 0, closed: true });
    expect(diona.result.abilityProducers).toHaveLength(7); // One parent and six delayed children.
    await expect(page.locator('[data-single-finite-cast]')).toHaveAttribute('data-single-finite-cast-status', 'complete');
    await page.locator('[data-single-open-finite-cast]').click();
    const certificate = page.locator('[data-source-finite-skill-certificate]');
    await expect(certificate).toBeVisible();
    await expect(certificate.locator('[data-source-finite-skill-status]')).toContainText(/完整|闭合/);
    const exported = await download(page, '[data-source-action-collection] [data-source-action-export]') as SourceHostActionCollection;
    expect(exported.scope).toBe('finite-skill-cast');
    expect(calculateSourceHostActionCollection(exported).completeCast).toBe(true);
    await page.locator('#calc-import').setInputFiles({
      name: 'diona-q-delayed-finite.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)),
    });
    await expect(page.locator('[data-source-action-collection]')).toBeVisible();
    expect(await download(page, '[data-source-action-collection] [data-source-action-export]')).toEqual(exported);

    const missingProducer = structuredClone(diona.result);
    missingProducer.abilityProducers = missingProducer.abilityProducers!.slice(1);
    const missingCollection = captureSourceHostFiniteSkillCollection(missingProducer, dionaRun.invocation.actionSequence);
    expect(missingCollection).toBeDefined();
    expect(calculateSourceHostActionCollection(missingCollection!).completeCast).toBe(false);
    const legacy = structuredClone(diona.result);
    delete legacy.abilityProducers;
    expect(captureSourceHostFiniteSkillCollection(legacy, dionaRun.invocation.actionSequence)).toBeUndefined();

    const kaeyaFullPath = '/tmp/gidps-delayed-finite-kaeya-full.json';
    const kaeyaFull = await runBurst(page, 'kaeya', 12, kaeyaFullPath);
    measurements.kaeyaFull = { rawPath: kaeyaFullPath, nativeResultArchived: true };
    const kaeyaFullRun = inspectRun(kaeyaFull, 'kaeya');
    const kaeyaFullFinite = kaeyaFullRun.analysis.finiteCast!;
    expect(kaeyaFullRun.analysis.completeCast).toBe(true);
    expect(kaeyaFullFinite.rootCountKind).toBe('runtime');
    expect(kaeyaFullFinite.expectedRootAttackCount).toBe(kaeyaFullFinite.observedRootAttackCount);
    expect(kaeyaFullFinite.observedRootAttackCount).toBeGreaterThan(0);
    expect(kaeyaFullFinite.completedRootAttackCount).toBe(kaeyaFullFinite.observedRootAttackCount);
    expect(kaeyaFullFinite.pendingProducerCount).toBe(0);
    expect(kaeyaFullFinite.completedProducerCount).toBe(kaeyaFullFinite.producerCount);
    expect(kaeyaFullFinite.closed).toBe(true);

    const kaeyaPartialPath = '/tmp/gidps-delayed-finite-kaeya-partial.json';
    const kaeyaPartial = await runBurst(page, 'kaeya', 2, kaeyaPartialPath);
    measurements.kaeyaPartial = { rawPath: kaeyaPartialPath, nativeResultArchived: true };
    const kaeyaPartialRun = inspectRun(kaeyaPartial, 'kaeya');
    const kaeyaPartialFinite = kaeyaPartialRun.analysis.finiteCast!;
    expect(kaeyaPartialRun.analysis.completeCast).toBe(false);
    expect(kaeyaPartialFinite.rootCountKind).toBe('runtime');
    expect(kaeyaPartialFinite.expectedRootAttackCount).toBeUndefined();
    expect(kaeyaPartialFinite.pendingProducerCount).toBeGreaterThan(0);
    expect(kaeyaPartialFinite.closed).toBe(false);
    expect(kaeyaPartialRun.analysis.knownSubtotal).toBeDefined();
    expect(kaeyaPartialRun.analysis.knownSubtotal).toBe(kaeyaPartialRun.analysis.total);
    await expect(page.locator('[data-single-finite-cast]')).toHaveAttribute('data-single-finite-cast-status', 'pending');
    expect(pageErrors).toEqual([]);

    measurements.dionaFull = { rawPath: dionaPath, nativeResultArchived: true, producers: dionaFinite.producerCount,
      completedProducers: dionaFinite.completedProducerCount, observedRoots: dionaFinite.observedRootAttackCount,
      replayedHits: dionaRun.replayedHits, sharedTotal: dionaRun.analysis.total, nativeTotal: dionaRun.nativeDamage,
      missingProducerCloses: false, legacyCaptureAvailable: false, certificateImportExportSame: true };
    measurements.kaeyaFull = { rawPath: kaeyaFullPath, nativeResultArchived: true, producers: kaeyaFullFinite.producerCount,
      completedProducers: kaeyaFullFinite.completedProducerCount, observedRoots: kaeyaFullFinite.observedRootAttackCount,
      replayedHits: kaeyaFullRun.replayedHits, sharedTotal: kaeyaFullRun.analysis.total, nativeTotal: kaeyaFullRun.nativeDamage,
      closed: kaeyaFullFinite.closed };
    measurements.kaeyaPartial = { rawPath: kaeyaPartialPath, nativeResultArchived: true,
      producers: kaeyaPartialFinite.producerCount, pendingProducers: kaeyaPartialFinite.pendingProducerCount,
      observedRoots: kaeyaPartialFinite.observedRootAttackCount, replayedHits: kaeyaPartialRun.replayedHits,
      knownSubtotal: kaeyaPartialRun.analysis.knownSubtotal, nativeTotal: kaeyaPartialRun.nativeDamage,
      closed: kaeyaPartialFinite.closed };
  } finally {
    await writeFile('docs/validation/source-delayed-finite-browser-20260929.result.json', JSON.stringify({
      schemaVersion: 'source-delayed-finite-browser-v1', measurements, pageErrors,
      scope: 'Three actual classic runs: Diona Q 15s, Kaeya Q 12s, Kaeya Q 2s. Completeness is limited to audited intrinsic attacks and native producer/dispatch receipts.',
    }, null, 2) + '\n');
  }
});
