import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { analyzeSourceHostPhase } from '../../../packages/sim-core/src/source-host-phase-analysis';
import { sourceHostReexecutionRequest } from '../../../packages/sim-core/src/source-host-reexecution';
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
test('native phase markers observe actual state in both hosts, preserve mechanics and keep opaque state unestablished', async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [], runs: Array<Record<string, unknown>> = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const config = await readFile('packages/source-host/phase-example.gcsl','utf8');
  try {
    await page.goto('/source-simulation');
    for (const lane of ['classic','stellar'] as const) {
      await page.locator('#source-host-variant').selectOption(lane);
      await page.locator('#source-host-phase-example').click();
      await page.locator('#source-host-phase-repeats').fill('2');
      const result = await execute(page);
      const observations = result.phaseObservations!;
      expect(observations.length).toBeGreaterThanOrEqual(4);
      expect(observations[0]!.inputPhase.verifiedRepeat).toBe(false);
      expect(observations.slice(1).some(row => row.inputPhase.verifiedRepeat)).toBe(true);
      expect(observations.every(row => row.coverage.providers.length === 10)).toBe(true);
      expect(observations.every(row => !row.coverage.complete && row.coverage.gaps.length > 0)).toBe(true);
      const rng = observations[0]!.normalizedState.rng as { vector: string[] };
      expect(rng.vector).toHaveLength(607);
      const analysis = analyzeSourceHostPhase(observations,result.phaseObservation!);
      expect(analysis.status).toBe('not-established');
      expect(analysis.steadyStateDps).toBeNull();
      await expect(page.locator('[data-source-host-phase-status]')).toContainText('尚未建立');
      expect(sourceHostReexecutionRequest(result).phaseObservation).toEqual(result.phaseObservation);
      await page.locator('#source-host-import').setInputFiles({ name:'phase-result.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(result)) });
      await expect(page.locator('#source-host-status')).toContainText('已导入');
      const restored=await exported(page);
      expect(restored.phaseObservations).toEqual(observations);
      expect(restored.phaseObservation).toEqual(result.phaseObservation);
      let markerNeutral: boolean | null=null;
      if (lane==='classic') {
        await page.locator('#source-host-config').fill(config.replace('  phase("rotation");\n',''));
        await page.locator('#source-host-phase-enabled').uncheck();
        const baseline=await execute(page);
        expect(baseline.calculations).toEqual(result.calculations);
        expect(baseline.applications).toEqual(result.applications);
        expect(baseline.energyApplications).toEqual(result.energyApplications);
        expect(baseline.result).toEqual(result.result);
        markerNeutral=true;
      }
      runs.push({lane,executionArtifact:result.executionArtifact,observations:observations.length,
        frames:observations.map(row=>row.frame),verifiedInputPhases:observations.filter(row=>row.inputPhase.verifiedRepeat).length,
        snapshotProviders:observations[0]!.coverage.providers,rngVectorLength:rng.vector.length,
        coverageComplete:observations.every(row=>row.coverage.complete),coverageGaps:observations.at(-1)!.coverage.gaps,
        calculations:result.calculations.length,applications:result.applications.length,analysis,
        roundtripEqual:true,markerNeutral});
    }
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile('docs/validation/native-phase-browser-20260928.result.json',JSON.stringify({runs,pageErrors},null,2)+'\n');
  }
});
