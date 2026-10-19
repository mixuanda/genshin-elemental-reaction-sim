import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { analyzeSourceHostPhase } from '../../../packages/sim-core/src/source-host-phase-analysis';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

async function exported(page: Page): Promise<SourceHostResult> {
  const event = page.waitForEvent('download');
  await page.locator('#source-host-export').click();
  return JSON.parse(await readFile((await (await event).path())!, 'utf8'));
}
async function execute(page: Page): Promise<SourceHostResult> {
  await page.locator('#source-host-run').click();
  await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 60_000 });
  return exported(page);
}

test('native phase captures distinguish periodic state, observable counters and opaque random state', async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [], runs: Array<Record<string, unknown>> = [];
  const analyses: ReturnType<typeof analyzeSourceHostPhase>[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    await page.goto('/source-simulation');
    for (const lane of ['classic', 'stellar'] as const) {
      await page.locator('#source-host-variant').selectOption(lane);
      await page.locator('#source-host-phase-deterministic-example').click();
      await page.locator('#source-host-phase-repeats').fill('2');
      const result = await execute(page);
      const observations = result.phaseObservations!;
      const analysis = analyzeSourceHostPhase(observations, result.phaseObservation!);
      analyses.push(analysis);
      await page.locator('#source-host-import').setInputFiles({ name: 'phase-captures.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(result)) });
      await expect(page.locator('#source-host-status')).toContainText('已导入');
      const restored = await exported(page);
      expect(restored.phaseObservations).toEqual(observations);
      expect(restored.phaseObservation).toEqual(result.phaseObservation);
      runs.push({ lane, scenario: 'deterministic-native-damage', executionArtifact: result.executionArtifact,
        observations: observations.length, frames: observations.map(row => row.frame),
        coverage: observations.map(row => ({ frame: row.frame, complete: row.coverage.complete, gaps: row.coverage.gaps })),
        intervalDamage: observations.map(row => row.damageSincePreviousBoundary ?? null),
        firstState: observations[0]?.normalizedState, lastState: observations.at(-1)?.normalizedState,
        applications: result.applications.length, analysis, roundtripEqual: true });
      expect(observations.at(-1)!.coverage.complete).toBe(true);
      await expect(page.locator("[data-source-host-phase-status]")).toContainText(lane === "stellar" ? "建立了重复周期" : "尚未建立");
    }
    await page.locator('#source-host-variant').selectOption('classic');
    await page.locator('#source-host-phase-example').click();
    const negative = await execute(page);
    const negativeAnalysis = analyzeSourceHostPhase(negative.phaseObservations!, negative.phaseObservation!);
    runs.push({ lane: 'classic', scenario: 'random-opaque-negative', executionArtifact: negative.executionArtifact,
      observations: negative.phaseObservations!.length, lastCoverage: negative.phaseObservations!.at(-1)!.coverage,
      applications: negative.applications.length, analysis: negativeAnalysis });
    expect(negativeAnalysis.status).toBe('not-established');
    expect(negativeAnalysis.steadyStateDps).toBeNull();
    // The classic source increments a script-readable skill_charge tag forever.
    // We retain that real state instead of hiding it to force a periodic result.
    expect(analyses[0]!.status).toBe('not-established');
    expect(analyses[0]!.stateDifferences.some(row => row.paths.includes('$.characters.actors[0].tags.skill_charge'))).toBe(true);
    expect(analyses[1]!.status).toBe('established-for-declared-native-state');
    expect(analyses[1]!.periodDamage).toBeGreaterThan(0);
    expect(analyses[1]!.periodCycles).toBe(1);
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile('docs/validation/phase-captures-browser-20260928.result.json', JSON.stringify({ runs, pageErrors }, null, 2) + '\n');
  }
});
