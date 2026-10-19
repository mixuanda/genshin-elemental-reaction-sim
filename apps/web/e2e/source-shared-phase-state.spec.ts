import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { analyzeSourceHostPhase } from '../../../packages/sim-core/src/source-host-phase-analysis';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const config = `options iteration=1 duration=24 ignore_burst_energy=true;
barbara char lvl=90/90 cons=0 talent=1,1,1;
barbara add weapon="magicguide" refine=1 lvl=1/20;
lisa char lvl=90/90 cons=0 talent=1,1,1;
lisa add weapon="magicguide" refine=1 lvl=1/20;
collei char lvl=90/90 cons=0 talent=1,1,1;
collei add weapon="huntersbow" refine=1 lvl=1/20;
xiangling char lvl=90/90 cons=0 talent=1,1,1;
xiangling add weapon="whitetassel" refine=1 lvl=1/20;
target lvl=90 hp=1000000 resist=0.1 radius=0.5 pos=0,2.4;
active barbara;
barbara attack;
phase("hydro queued");
lisa skill;
wait(2); phase("ec started");
wait(10); phase("ec immediate damage");
wait(6); phase("ec wane and next tick pending");
wait(54); phase("ec first periodic tick");
wait(6); phase("ec wane");
wait(54); phase("ec second periodic tick");
wait(6); phase("ec wane");
wait(54); phase("ec third periodic tick");
wait(6); phase("ec ended");
collei skill;
phase("collei second hit queued");
xiangling burst;
phase("burning with pending tick");
wait(13); phase("burning next tick pending");
wait(1); phase("burning tick boundary");`;
const capturePath = 'docs/validation/source-shared-phase-state-browser-20260930.capture.json';
const resultPath = 'docs/validation/source-shared-phase-state-browser-20260930.result.json';
const lanes = ['classic', 'stellar'] as const;
type Lane = (typeof lanes)[number];
type Archive = { schemaVersion: 'source-shared-phase-state-native-v1'; runs: Partial<Record<Lane, SourceHostResult>> };
type Row = Record<string, unknown>;
function objects(value: unknown): Row[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(objects);
  const row = value as Row;
  return [row, ...Object.values(row).flatMap(objects)];
}
async function exported(page: Page): Promise<SourceHostResult> {
  const pending = page.waitForEvent('download');
  await page.locator('#source-host-export').click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as SourceHostResult;
}

test('shared native phase captures retain reaction tasks, attack state and unknown coverage', async ({ page }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const summaries: Row[] = [];
  const measurements: Row = { summaries, capturePath,
    scope: 'Two finite source-state probes, not a periodic or energy benchmark. Different marker positions cannot establish a repeated input phase. Unknown provider gaps remain independently asserted.' };
  const save = () => writeFile(resultPath, JSON.stringify({ measurements, pageErrors }, null, 2) + '\n');
  try {
    let archive: Archive;
    if (process.env.GIDPS_REUSE_SHARED_PHASE_CAPTURE === '1') {
      archive = JSON.parse(await readFile(capturePath, 'utf8')) as Archive;
      measurements.nativeRunsPerformed = false;
    } else {
      archive = { schemaVersion: 'source-shared-phase-state-native-v1', runs: {} };
      measurements.nativeRunsPerformed = true;
      for (const lane of lanes) {
        await page.goto('/source-simulation');
        await page.locator('#source-host-variant').selectOption(lane);
        await page.locator('#source-host-config').fill(config);
        await page.locator('#source-host-seed').fill('20260930119');
        await page.locator('#source-host-phase-enabled').check();
        await page.locator('#source-host-phase-limit').fill('64');
        await page.locator('#source-host-phase-warmup').fill('0');
        await page.locator('#source-host-run').click();
        await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 90_000 });
        archive.runs[lane] = await exported(page);
        await writeFile(capturePath, JSON.stringify(archive, null, 2) + '\n');
      }
    }
    for (const lane of lanes) {
      const native = archive.runs[lane]!;
      const observations = native.phaseObservations!;
      const rows = observations.flatMap(row => objects(row.normalizedState));
      const sources = rows.filter(row => typeof row.source === 'string' && row.source !== '');
      const matching = (source: string) => sources.filter(row => row.source === source);
      const gaps = [...new Set(observations.flatMap(row => row.coverage.gaps))];
      const reactionTick = matching('pkg/reactable/electrocharged.go:nextECTick');
      const reactionWane = matching('pkg/reactable/electrocharged.go:TryAddEC:wane-task');
      const reactionEvent = matching('pkg/reactable/electrocharged.go:TryAddEC:wane-event');
      const burning = matching('pkg/reactable/burning.go:nextBurningTick');
      const attacks = sources.filter(row => String(row.source).startsWith('pkg/core/attack.go:'));
      const analysis = analyzeSourceHostPhase(observations, native.phaseObservation!);
      summaries.push({ lane, executionArtifact: native.executionArtifact, observations: observations.length,
        frames: observations.map(row => row.frame), applications: native.applications.length,
        ecTickCaptures: reactionTick, ecWaneCaptures: reactionWane, ecEventCaptures: reactionEvent,
        burningCaptures: burning, attackCaptures: attacks, gaps,
        completeBoundaries: observations.filter(row => row.coverage.complete).length, analysis });
      await save();
      expect(native.config).toBe(config);
      expect(reactionTick.length, `${lane} actual EC tick capture`).toBeGreaterThan(0);
      expect(reactionWane.length, `${lane} actual EC wane capture`).toBeGreaterThan(0);
      expect(reactionEvent.length, `${lane} actual EC event capture`).toBeGreaterThan(0);
      expect(burning.length, `${lane} actual burning task capture`).toBeGreaterThan(0);
      expect(attacks.length, `${lane} actual pending attack capture`).toBeGreaterThan(0);
      expect(attacks.some(row => typeof row.captureReference === 'number')).toBe(true);
      expect(gaps.some(gap => gap.includes('electrocharged-task-and-event-captured-state') || gap.includes('burning-task-captured-counter-and-generation'))).toBe(false);
      expect(gaps.length, 'unknown source state must remain visible').toBeGreaterThan(0);
      expect(observations.some(row => !row.coverage.complete)).toBe(true);
      expect(analysis.status).toBe('not-established');
      expect(analysis.steadyStateDps).toBeNull();
    }
    await page.goto('/source-simulation');
    const native = archive.runs.stellar!;
    await page.locator('#source-host-import').setInputFiles({ name: 'shared-phase.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(native)) });
    await expect(page.locator('#source-host-status')).toContainText('已导入');
    const restored = await exported(page);
    expect(restored.phaseObservations).toEqual(native.phaseObservations);
    expect(restored.phaseObservation).toEqual(native.phaseObservation);
    measurements.phaseJsonRoundtripEqual = true;
    expect(pageErrors).toEqual([]);
  } finally { await save(); }
});
