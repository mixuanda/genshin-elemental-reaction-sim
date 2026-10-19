import { isDeepStrictEqual } from 'node:util';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

const historicalPath = 'docs/validation/source-shared-movement-state-20260930.capture.json';
const capturePath = 'docs/validation/source-private-numeric-state-20260930.capture.json';
const resultPath = 'docs/validation/source-private-numeric-state-20260930.result.json';
const lanes = ['classic', 'stellar'] as const;
type Lane = (typeof lanes)[number];
type Archive = { schemaVersion: 'source-private-numeric-state-v1'; runs: Partial<Record<Lane, SourceHostResult>> };
type Row = Record<string, unknown>;

const config = `options iteration=1 duration=12;
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

function locatedFields(result: SourceHostResult, name: string): Array<{ path: string; value: unknown }> {
  const found: Array<{ path: string; value: unknown }> = [];
  const visit = (value: unknown, path: string) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (key === name) found.push({ path: childPath, value: child });
      visit(child, childPath);
    }
  };
  for (const phase of result.phaseObservations ?? []) visit(phase.normalizedState, '');
  return found;
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

test('shared private numeric phase state preserves semantic values and movement outputs', async ({ page }) => {
  test.setTimeout(240_000);
  expect(existsSync(historicalPath), 'the archived 122 movement capture is available').toBe(true);
  const historical = JSON.parse(await readFile(historicalPath, 'utf8')) as Archive;
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const measurements: Row = { historicalPath, capturePath, seed: '20260930122', config, lanes: [],
    scope: 'Two lane captures compared with the archived 122 movement scene. Private phase values and remaining gaps are recorded at sampled frames; this does not claim full phase coverage or convergence.' };
  const summaries: Row[] = [];
  measurements.lanes = summaries;
  const current: Archive = process.env.GIDPS_REUSE_PRIVATE_NUMERIC_CAPTURE === '1'
    ? JSON.parse(await readFile(capturePath, 'utf8')) as Archive
    : { schemaVersion: 'source-private-numeric-state-v1', runs: {} };
  const save = () => writeFile(resultPath, JSON.stringify({ measurements, summaries, pageErrors }, null, 2) + '\n');

  try {
    if (process.env.GIDPS_REUSE_PRIVATE_NUMERIC_CAPTURE !== '1') {
      for (const lane of lanes) {
        await page.goto('/source-simulation');
        await page.locator('#source-host-variant').selectOption(lane);
        await page.locator('#source-host-config').fill(config);
        await page.locator('#source-host-seed').fill('20260930122');
        await page.locator('#source-host-phase-enabled').check();
        await page.locator('#source-host-phase-warmup').fill('0');
        await page.locator('#source-host-phase-period').fill('4');
        await page.locator('#source-host-phase-repeats').fill('3');
        await page.locator('#source-host-phase-limit').fill('64');
        await page.locator('#source-host-run').click();
        await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 90_000 });
        const result = await exported(page);
        current.runs[lane] = result;
        await writeFile(capturePath, JSON.stringify(current, null, 2) + '\n');
      }

    }
    measurements.nativeRunsPerformed = process.env.GIDPS_REUSE_PRIVATE_NUMERIC_CAPTURE !== '1';
    for (const lane of lanes) {
      const result = current.runs[lane]!;
      expect(result, `${lane} saved raw capture exists`).toBeDefined();

      const comparison = historical.runs[lane];
      const observations = result.phaseObservations ?? [];
      const gaps = [...new Set(observations.flatMap(row => row.coverage.gaps))];
      const c2buff = locatedFields(result, 'c2buff').filter(row => row.path.includes('actors[0]'));
      const barbaraExtend = locatedFields(result, 'a4extendCount').filter(row => row.path.includes('actors[0]'));
      const lisaCount = locatedFields(result, 'previousDischargeCount').filter(row => row.path.includes('actors[1]'));
      const barbaraDeadline = locatedFields(result, 'c6icd').filter(row => row.path.includes('actors[0]'));
      const lisaDeadline = locatedFields(result, 'c6icd').filter(row => row.path.includes('actors[1]'));
      const privateGap = (field: string) => gaps.filter(gap => gap.includes(field) && gap.includes('private numeric clock semantics'));
      const privateNumericSummary = { barbaraC2Buff: c2buff, barbaraA4ExtendCount: barbaraExtend,
        lisaPreviousDischargeCount: lisaCount, barbaraC6Icd: barbaraDeadline, lisaC6Icd: lisaDeadline };
      const summary: Row = { lane, sourceCommit: result.sourceCommit, executionArtifact: result.executionArtifact,
        phaseFrames: observations.map(row => row.frame), applications: applications(result), actionLogs: movementLogs(result),
        phasePlayerState: phasePlayerState(result), coverageGaps: gaps, privateNumericState: privateNumericSummary,
        remainingPrivateNumericGaps: { skillInitF: gaps.filter(gap => gap.includes('skillInitF')),
          undescribedCallbacks: gaps.filter(gap => gap.includes('has an undescribed callback')) },
        historicalComparison: comparison ? { applicationsEqual: isDeepStrictEqual(applications(result), applications(comparison)),
          actionLogsEqual: isDeepStrictEqual(movementLogs(result), movementLogs(comparison)),
          phaseFramesEqual: isDeepStrictEqual(observations.map(row => row.frame), (comparison.phaseObservations ?? []).map(row => row.frame)),
          phasePlayerStateEqual: isDeepStrictEqual(phasePlayerState(result), phasePlayerState(comparison)) } : null };
      summaries.push(summary);
      await save();

      expect(result.config).toBe(config);
      expect(result.seed).toBe('20260930122');
      expect(observations.length).toBeGreaterThan(0);
      expect(applications(result).length).toBeGreaterThan(0);
      expect(comparison, `${lane} archived 122 lane exists`).toBeDefined();
      expect(applications(result)).toEqual(applications(comparison!));
      expect(movementLogs(result)).toEqual(movementLogs(comparison!));
      expect(observations.map(row => row.frame)).toEqual((comparison!.phaseObservations ?? []).map(row => row.frame));
      expect(phasePlayerState(result)).toEqual(phasePlayerState(comparison!));
      expect(observations.every(row => !row.coverage.complete), `${lane} phase sampling remains partial`).toBe(true);

      expect(c2buff.length, `${lane} Barbara c2buff samples`).toBeGreaterThan(0);
      for (const { value } of c2buff) {
        const slice = value as Row;
        expect(slice.capacity).toBe(26);
        expect(slice.items).toHaveLength(26);
        expect((slice.items as Row[]).every(item => typeof item.value === 'number' && item.type === 'float64')).toBe(true);
      }
      expect(privateGap('c2buff'), `${lane} c2buff has no private numeric unknown gap`).toHaveLength(0);
      expect(barbaraExtend.length).toBeGreaterThan(0);
      expect(barbaraExtend.every(({ value }) => typeof (value as Row).value === 'number')).toBe(true);
      expect(lisaCount.length).toBeGreaterThan(0);
      expect(lisaCount.every(({ value }) => typeof (value as Row).value === 'number')).toBe(true);
      expect(privateGap('a4extendCount'), `${lane} reviewed Barbara counter has no numeric gap`).toHaveLength(0);
      expect(privateGap('previousDischargeCount'), `${lane} reviewed Lisa historical count has no numeric gap`).toHaveLength(0);
      for (const deadlineSet of [barbaraDeadline, lisaDeadline]) {
        expect(deadlineSet.length).toBeGreaterThan(0);
        expect(deadlineSet.every(({ value }) => typeof (value as Row).remainingFrames === 'number'
          && typeof (value as Row).active === 'boolean')).toBe(true);
        expect(deadlineSet.some(({ value }) => (value as Row).active === false && (value as Row).remainingFrames === 0)).toBe(true);
      }
      expect(gaps.some(gap => gap.includes('skillInitF')), `${lane} unreviewed skillInitF remains a gap`).toBe(true);
      expect(gaps.some(gap => gap.includes('has an undescribed callback')), `${lane} unreviewed callbacks remain gaps`).toBe(true);
      expect(pageErrors).toEqual([]);
    }
  } finally { await save(); }
});
