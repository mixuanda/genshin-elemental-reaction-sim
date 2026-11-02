import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { captureSourceHostHit, replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

// b4 Kaeya C0/T1 skill coefficient 1.912, internal/characters/kaeya/skill.go
// and zz_kaeya.dm.go; pinned mapping kaeya-skill-hit. This is E-only, not a full team claim.
const script = `options iteration=1 duration=120;
kaeya char lvl=90/90 cons=0 talent=1,1,1;
kaeya add weapon="dullblade" refine=1 lvl=90/90;
kaeya add stats cr=0.45;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active kaeya;
${Array.from({ length: 12 }, () => 'kaeya skill;\nwait(600);').join('\n')}
wait(7200);
`;

test('pinned Kaeya executes a real 120-second E sequence and restores its last hit in the calculator', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/source-simulation');
  await page.locator('#source-host-config').evaluate(el => {
    let parent = el.closest('details');
    while (parent) { parent.open = true; parent = parent.parentElement?.closest('details') ?? null; }
  });
  await page.locator('#source-host-config').fill(script);
  await page.locator('#source-host-seed').fill('12021');
  await page.locator('#source-host-run').click();
  await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 60_000 });
  await page.locator('#source-host-export').evaluate(el => { el.closest('details')!.open = true; });
  const pending = page.waitForEvent('download');
  await page.locator('#source-host-export').click();
  const result = JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as SourceHostResult;
  await writeFile(info.outputPath('kaeya-120.capture.json'), JSON.stringify(result));
  expect(result.config).toBe(script);
  expect(result.seed).toBe('12021');
  expect(result.verification).toBe('provisional');
  expect(result.observationWindow).toMatchObject({ configuredEndFrame: 7200, actualEndFrame: 7200, endReason: 'duration' });
  const calculations = new Map(result.calculations.map(row => [row.request.id, row.request]));
  const hits = result.applications.map(application => ({ application, request: calculations.get(application.calculationId) }));
  expect(hits).toHaveLength(12);
  for (const [index, hit] of hits.entries()) {
    expect(hit.request?.kind).toBe('damage');
    if (hit.request?.kind !== 'damage') throw new Error('Expected a source damage calculation');
    expect(hit.request.actorKey).toBe('kaeya');
    expect(hit.request.input.scaling).toBe(1.912);
    expect(hit.request.input.damageBonus).toBe(0);
    // source-host-formula.ts selects reaction=none when amped=false;
    // the native unused multiplier may be zero and is not the applied damage factor.
    expect(hit.request.input.amped).toBe(false);
    // Both combatants level90: DEF=1/2, resistance=.1; native crit is consumed once.
    const manual = hit.request.input.scalingValue * 1.912 * .5 * .9 * (hit.request.input.isCrit ? 1 + hit.request.input.critDamage : 1);
    expect(hit.application.rawDamage).toBeCloseTo(manual, 8);
    const replay = replaySourceHostHit(captureSourceHostHit(result, hit.application.id));
    expect(replay.difference).toBe(0);
    expect(hit.request.frame).toBeLessThan(7200);
    if (index) expect(hit.request.frame - hits[index - 1]!.request!.frame).toBeGreaterThanOrEqual(360);
  }
  expect(result.energyApplications!.length).toBeGreaterThan(0);
  const last = hits.at(-1)!;
  await page.locator('#source-host-hit-index').fill(String(hits.length - 1));
  await page.locator('#source-host-open-calculator').click();
  await expect(page).toHaveURL(/\/calculator$/);
  await expect(page.locator('#calc-source-host-editor [data-source-base-panel]')).toBeVisible();
  expect(errors).toEqual([]);
  console.log('REAL_CHARACTER_120', JSON.stringify({ source:'b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541', character:'kaeya', constellation:0, talent:1,
    observationWindow:result.observationWindow, executionArtifact:result.executionArtifact, hits:hits.length,
    firstFrame:hits[0]!.request!.frame, lastFrame:last.request!.frame,
    totalRawDamage:hits.reduce((sum, hit)=>sum+hit.application.rawDamage,0), energyApplications:result.energyApplications!.length,
    allHitReplayDifference:0, scope:'E-only, no Q energy-loop or reaction/team certification' }));
});
