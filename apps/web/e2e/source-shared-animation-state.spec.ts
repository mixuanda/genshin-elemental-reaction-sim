import { Buffer } from 'node:buffer';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { analyzeSourceHostPhase } from '../../../packages/sim-core/src/source-host-phase-analysis';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const frozenPath = 'docs/validation/source-shared-phase-state-browser-20260930.capture.json';
const capturePath = 'docs/validation/source-shared-animation-browser-20260930.capture.json';
const resultPath = 'docs/validation/source-shared-animation-browser-20260930.result.json';
const lanes = ['classic', 'stellar'] as const;
type Lane = (typeof lanes)[number];
type Archive = { schemaVersion: 'source-shared-animation-state-native-v1'; runs: Partial<Record<Lane, SourceHostResult>> };
type Row = Record<string, unknown>;

function objects(value: unknown): Row[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(objects);
  const row = value as Row;
  return [row, ...Object.values(row).flatMap(objects)];
}

function animationRows(observations: NonNullable<SourceHostResult['phaseObservations']>): Row[] {
  return observations.flatMap(observation => objects(observation.normalizedState))
    .filter(row => typeof row.source === 'string' && row.source !== '');
}

function animationApplications(result: SourceHostResult): Row[] {
  return result.applications.map(({ frame, targetKey, rawDamage, appliedDamage, hpBefore, hpAfter, isCrit }) =>
    ({ frame, targetKey, rawDamage, appliedDamage, hpBefore, hpAfter, isCrit }));
}

async function exported(page: Page): Promise<SourceHostResult> {
  const pending = page.waitForEvent('download');
  await page.locator('#source-host-export').click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as SourceHostResult;
}

test('shared source animation state is captured without claiming full animation coverage', async ({ page }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const summaries: Row[] = [];
  const measurements: Row = { summaries, frozenPath, capturePath,
    scope: 'Replays the two archived 119 lanes with the same config, seed and phase request. Captures shared frame-table state; remaining provider gaps do not establish full animation coverage.' };
  const save = () => writeFile(resultPath, JSON.stringify({ measurements, pageErrors }, null, 2) + '\n');
  try {
    const frozen = JSON.parse(await readFile(frozenPath, 'utf8')) as { runs: Partial<Record<Lane, SourceHostResult>> };
    let archive: Archive;
    if (process.env.GIDPS_REUSE_ANIMATION_CAPTURE === '1') {
      archive = JSON.parse(await readFile(capturePath, 'utf8')) as Archive;
      measurements.nativeRunsPerformed = false;
    } else {
      archive = { schemaVersion: 'source-shared-animation-state-native-v1', runs: {} };
      measurements.nativeRunsPerformed = true;
      for (const lane of lanes) {
        const baseline = frozen.runs[lane]!;
        await page.goto('/source-simulation');
        await page.locator('#source-host-variant').selectOption(lane);
        await page.locator('#source-host-config').fill(baseline.config);
        await page.locator('#source-host-seed').fill(baseline.seed);
        await page.locator('#source-host-phase-enabled').check();
        await page.locator('#source-host-phase-period').fill(String(baseline.phaseObservation!.maxPeriod));
        await page.locator('#source-host-phase-repeats').fill(String(baseline.phaseObservation!.requiredConsecutivePeriods));
        await page.locator('#source-host-phase-limit').fill(String(baseline.phaseObservation!.maxObservations));
        await page.locator('#source-host-phase-warmup').fill(String(baseline.phaseObservation!.warmupFrames));
        await page.locator('#source-host-run').click();
        await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 90_000 });
        archive.runs[lane] = await exported(page);
        await writeFile(capturePath, JSON.stringify(archive, null, 2) + '\n');
      }
    }

    for (const lane of lanes) {
      const native = archive.runs[lane]!;
      const baseline = frozen.runs[lane]!;
      const observations = native.phaseObservations!;
      const rows = animationRows(observations);
      const matching = (fragment: string) => rows.filter(row => String(row.source).includes(fragment));
      const attacks = matching('NewAttackFunc');
      const abilities = matching('NewAbilFunc');
      const offset = matching('WithOffset');
      const pauses = matching('FramePausedOnHitlag');
      const gaps = [...new Set(observations.flatMap(row => row.coverage.gaps))];
      const phaseFrames = observations.map(row => row.frame);
      const phaseAnalysis = analyzeSourceHostPhase(observations, native.phaseObservation!);
      const attackCaptures = attacks.map(row => row.captured).filter(value => value && typeof value === 'object') as Row[];
      const abilityCaptures = abilities.map(row => row.captured).filter(value => value && typeof value === 'object') as Row[];
      const pauseCaptures = pauses.map(row => row.captured).filter(value => value && typeof value === 'object') as Row[];
      const frameTables = [...attackCaptures, ...abilityCaptures, ...offset.map(row => row.captured as Row)]
        .map(row => row?.frameTable).filter(Array.isArray) as unknown[][];
      const manifestPath = resolve(lane === 'classic'
        ? 'packages/source-host/dist/manifest.json' : 'packages/source-host/stellar-overlay/dist/manifest.json');

      const summary: Row = { lane, sourceCommit: native.sourceCommit, executionArtifact: native.executionArtifact,
        observations: observations.length, phaseFrames, normalConstructorCaptures: attacks, abilityConstructorCaptures: abilities,
        offsetCaptures: offset, defaultPauseCaptures: pauses, numericFrameTables: frameTables,
        applications: native.applications.length, unknownGaps: gaps, completeBoundaries: observations.filter(row => row.coverage.complete).length,
        phaseAnalysis, frozen119Comparisons: { framesEqual: phaseFrames.join(',') === baseline.phaseObservations!.map(row => row.frame).join(','),
          applicationsEqual: JSON.stringify(animationApplications(native)) === JSON.stringify(animationApplications(baseline)) } };
      summaries.push(summary);
      await save();

      expect(native.config).toBe(baseline.config);
      expect(native.seed).toBe(baseline.seed);
      expect(native.phaseObservation).toEqual(baseline.phaseObservation);
      expect(attacks.length, `${lane} observed normal constructor`).toBeGreaterThan(0);
      expect(abilities.length, `${lane} observed ability constructor`).toBeGreaterThan(0);
      expect(pauses.length, `${lane} observed default hitlag pause`).toBeGreaterThan(0);
      expect(pauseCaptures.some(row => row.predicate === 'character.frozenFrames > 0' && typeof row.actorIndex === 'number')).toBe(true);
      expect(attackCaptures.some(row => typeof row.normalCounter === 'number' && typeof row.attackSpeed === 'number')).toBe(true);
      expect(attackCaptures.some(row => Array.isArray(row.frameTable) && row.frameTable.length > 0 && row.frameTable.every(item => Array.isArray(item) && item.length > 0 && item.every(value => typeof value === 'number')))).toBe(true);
      expect(abilityCaptures.some(row => Array.isArray(row.frameTable) && row.frameTable.length > 0 && row.frameTable.every(item => typeof item === 'number'))).toBe(true);
      expect([...attackCaptures, ...abilityCaptures].every(row => typeof row.offset === 'number')).toBe(true);
      expect(frameTables.length).toBeGreaterThan(0);
      expect(gaps.some(gap => gap.includes('animation.Frames callback'))).toBe(false);
      expect(gaps.some(gap => gap.includes('animation.FramePausedOnHitlag callback'))).toBe(false);
      expect(gaps.length, 'other unknown source state remains visible').toBeGreaterThan(0);
      expect(observations.some(row => !row.coverage.complete)).toBe(true);
      expect(phaseAnalysis.status).toBe('not-established');
      expect(phaseAnalysis.steadyStateDps).toBeNull();
      expect(phaseFrames).toEqual(baseline.phaseObservations!.map(row => row.frame));
      expect(animationApplications(native)).toEqual(animationApplications(baseline));

      {
        const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { artifacts?: Array<{ path: string; sha256: string }>; files?: Array<{ path: string; sha256: string }> };
        const wasm = (manifest.artifacts ?? manifest.files)!.find(row => row.path === 'source-host.wasm')!;
        expect(native.executionArtifact?.wasmSha256).toBe(wasm.sha256);
        const wasmPath = resolve(dirname(manifestPath), wasm.path);
        expect(native.executionArtifact?.wasmBytes).toBe((await stat(wasmPath)).size);
      }
    }

    await page.goto('/source-simulation');
    const native = archive.runs.stellar!;
    await page.locator('#source-host-import').setInputFiles({ name: 'shared-animation.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(native)) });
    await expect(page.locator('#source-host-status')).toContainText('已导入');
    const restored = await exported(page);
    expect(restored.phaseObservations).toEqual(native.phaseObservations);
    expect(restored.phaseObservation).toEqual(native.phaseObservation);
    measurements.phaseJsonRoundtripEqual = true;
    measurements.pageText = await page.locator('body').innerText();
    expect(pageErrors).toEqual([]);
  } finally { await save(); }
});
