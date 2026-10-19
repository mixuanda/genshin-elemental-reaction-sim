import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { expect, test, type Page } from '@playwright/test';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const baselinePath = 'docs/validation/source-shared-movement-state-20260930.baseline.json';
const capturePath = 'docs/validation/source-shared-movement-state-20260930.capture.json';
const resultPath = 'docs/validation/source-shared-movement-state-20260930.result.json';
const lanes = ['classic', 'stellar'] as const;
type Lane = (typeof lanes)[number];
type Archive = { schemaVersion: 'source-shared-movement-state-v1'; runs: Partial<Record<Lane, SourceHostResult>> };
type Row = Record<string, unknown>;

const movementConfig = `options iteration=1 duration=12;
barbara char lvl=90/90 cons=0 talent=1,1,1;
barbara add weapon="apprenticesnotes" refine=1 lvl=1/20;
lisa char lvl=90/90 cons=0 talent=1,1,1;
lisa add weapon="apprenticesnotes" refine=1 lvl=1/20;
target lvl=90 hp=1000000 resist=0.1 radius=0.5 pos=0,2.4;
active barbara;
phase("before movement");
barbara dash;
phase("dash input window");
barbara walk;
phase("walk input window");
barbara jump;
phase("jump input window");
lisa walk;
phase("walk after implicit swap completes");
lisa jump;
lisa attack;
wait(60);
phase("attack application after swap");`;

function objects(value: unknown): Row[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(objects);
  const row = value as Row;
  return [row, ...Object.values(row).flatMap(objects)];
}

function stateRows(result: SourceHostResult): Row[] {
  return (result.phaseObservations ?? []).flatMap(row => objects(row.normalizedState));
}

function applications(result: SourceHostResult): Row[] {
  return result.applications.map(({ frame, targetKey, rawDamage, appliedDamage, hpBefore, hpAfter, isCrit }) =>
    ({ frame, targetKey, rawDamage, appliedDamage, hpBefore, hpAfter, isCrit }));
}

function movementLogs(result: SourceHostResult): Row[] {
  const logs = (Array.isArray(result.logs) ? result.logs : []) as Row[];
  return logs.filter(row => row.event === 'action')
    .map(row => ({ frame: row.frame, ended: row.ended, characterIndex: row.char_index, message: row.msg, values: row.logs }));
}

function phasePlayerState(result: SourceHostResult): Row[] {
  return (result.phaseObservations ?? []).map(observation => {
    const player = observation.normalizedState.player as Row | undefined;
    return { frame: observation.frame, activeCharacter: player?.activeCharacter, stamina: player?.stamina,
      lastStaminaUseAgo: player?.lastStaminaUseAgo, dashCooldownRemaining: player?.dashCooldownRemaining,
      dashLockout: player?.dashLockout, swapCooldown: player?.swapCooldown, swapInterval: player?.swapInterval };
  });
}

async function exported(page: Page): Promise<SourceHostResult> {
  const pending = page.waitForEvent('download');
  await page.locator('#source-host-export').click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as SourceHostResult;
}

test('shared movement state descriptors retain timing and stamina outputs in both hosts', async ({ page }) => {
  test.setTimeout(240_000);
  const captureBaseline = process.env.GIDPS_CAPTURE_MOVEMENT_BASELINE === '1';
  const compare = process.env.GIDPS_COMPARE_MOVEMENT_BASELINE === '1' || (!captureBaseline && existsSync(baselinePath));
  if (!captureBaseline && !compare) throw new Error(`Capture the 121 baseline first with GIDPS_CAPTURE_MOVEMENT_BASELINE=1 (${baselinePath}).`);
  if (!compare && existsSync(baselinePath) && process.env.GIDPS_CAPTURE_MOVEMENT_BASELINE !== '1') {
    throw new Error(`Refusing to replace ${baselinePath}; set GIDPS_CAPTURE_MOVEMENT_BASELINE=1 for the 121 baseline or GIDPS_COMPARE_MOVEMENT_BASELINE=1 for 122 comparison.`);
  }
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const measurements: Row = { lanes: [], baselinePath, capturePath, compareAgainstBaseline: compare,
    scope: 'Small classic/stellar movement scene. Markers follow action queue windows; swaps are only recorded after their completion delay, so no pending swap is claimed.' };
  const summaries: Row[] = [];
  measurements.lanes = summaries;
  const current: Archive = process.env.GIDPS_REUSE_MOVEMENT_CAPTURE === '1'
    ? JSON.parse(await readFile(capturePath, 'utf8')) as Archive
    : { schemaVersion: 'source-shared-movement-state-v1', runs: {} };
  const save = () => writeFile(resultPath, JSON.stringify({ measurements, summaries, pageErrors }, null, 2) + '\n');

  try {
    const baseline: Archive | undefined = compare ? JSON.parse(await readFile(baselinePath, 'utf8')) as Archive : undefined;
    for (const lane of lanes) {
      let result = current.runs[lane];
      if (!result) {
        await page.goto('/source-simulation');
        await page.locator('#source-host-variant').selectOption(lane);
        await page.locator('#source-host-config').fill(movementConfig);
        await page.locator('#source-host-seed').fill('20260930122');
        await page.locator('#source-host-phase-enabled').check();
        await page.locator('#source-host-phase-warmup').fill('0');
        await page.locator('#source-host-phase-period').fill('4');
        await page.locator('#source-host-phase-repeats').fill('3');
        await page.locator('#source-host-phase-limit').fill('64');
        await page.locator('#source-host-run').click();
        await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 90_000 });
        result = await exported(page);
        current.runs[lane] = result;
        await writeFile(capturePath, JSON.stringify(current, null, 2) + '\n');
        if (!compare) await writeFile(baselinePath, JSON.stringify(current, null, 2) + '\n');
      }

      const rows = stateRows(result);
      const descriptors = rows.filter(row => typeof row.source === 'string' && row.source !== '');
      const matching = (source: string) => descriptors.filter(row => row.source === source);
      const dash = matching('internal/template/character/stam.go:Dash:frames');
      const walk = matching('internal/template/character/stam.go:Walk:frames');
      const jump = descriptors.filter(row => String(row.source).startsWith('internal/template/character/stam.go:Jump:') && String(row.source).endsWith(':frames'));
      const swaps = matching('pkg/core/player/exec.go:swap:frames');
      const dashTasks = descriptors.filter(row => row.key === 'dash-stamina-consumption' || row.source === 'internal/template/character/stam.go:QueueDashStaminaConsumption');
      const gaps = [...new Set((result.phaseObservations ?? []).flatMap(row => row.coverage.gaps))];
      const walkCaptures = walk.map(row => row.captured).filter(value => value && typeof value === 'object') as Row[];
      const jumpCaptures = jump.map(row => row.captured).filter(value => value && typeof value === 'object') as Row[];
      const comparison = baseline?.runs[lane];
      const summary: Row = { lane, sourceCommit: result.sourceCommit, executionArtifact: result.executionArtifact,
        phaseFrames: (result.phaseObservations ?? []).map(row => row.frame), applications: applications(result),
        movementLogs: movementLogs(result), phasePlayerState: phasePlayerState(result), dashDescriptors: dash, walkDescriptors: walk, jumpDescriptors: jump,
        swapFrameDescriptors: swaps, dashStaminaTaskDescriptors: dashTasks, coverageGaps: gaps,
        comparison: comparison ? { applicationsEqual: isDeepStrictEqual(applications(result), applications(comparison)),
          movementLogsEqual: isDeepStrictEqual(movementLogs(result), movementLogs(comparison)),
          phasePlayerStateEqual: isDeepStrictEqual(phasePlayerState(result), phasePlayerState(comparison)),
          phaseFramesEqual: isDeepStrictEqual((result.phaseObservations ?? []).map(row => row.frame), (comparison.phaseObservations ?? []).map(row => row.frame)) } : null };
      summaries.push(summary);
      await save();

      expect(result.config).toBe(movementConfig);
      expect(result.seed).toBe('20260930122');
      expect(result.phaseObservations?.length).toBeGreaterThan(0);
      expect(applications(result).length, `${lane} actual normal-attack application`).toBeGreaterThan(0);
      expect(gaps.length, `${lane} other source coverage gaps remain visible`).toBeGreaterThan(0);

      if (compare) {
        expect(comparison).toBeDefined();
        expect(applications(result)).toEqual(applications(comparison!));
        expect(movementLogs(result)).toEqual(movementLogs(comparison!));
        expect(phasePlayerState(result)).toEqual(phasePlayerState(comparison!));
        expect((result.phaseObservations ?? []).map(row => row.frame)).toEqual((comparison!.phaseObservations ?? []).map(row => row.frame));
        expect(walk.length, `${lane} default Walk frames`).toBeGreaterThan(0);
        expect(jump.length, `${lane} default Jump frames`).toBeGreaterThan(0);
        expect(walkCaptures.some(row => typeof row.frames === 'number')).toBe(true);
        expect(jumpCaptures.some(row => Object.values(row).some(value => typeof value === 'number'))).toBe(true);
        expect(dashTasks.some(row => typeof row.remainingFrames === 'number' && row.remainingFrames > 0
          && typeof row.capture === 'object' && row.capture !== null
          && (row.capture as Row).action === 'dash')).toBe(true);
        expect(result.phaseObservations?.every(row => !row.coverage.complete)).toBe(true);
      }
      // Barbara uses her own NewAbilFunc Dash frame table; the shared delayed
      // stamina task is exercised, while default Dash frames remain source/build only.
      // A swap is followed by its configured CanQueueAfter delay before the
      // next source-script action is returned; this spec does not inspect it as pending.
    }
    expect(pageErrors).toEqual([]);
  } finally { await save(); }
});
