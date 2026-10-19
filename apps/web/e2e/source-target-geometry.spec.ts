import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { calculateSourceHostActionCollection, captureSourceHostActionCollection } from '../../../packages/sim-core/src/source-host-action-collection';
import { sourceActionReceipts } from '../../../packages/sim-core/src/source-host-action-origin';
import { replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';
import type { SourceSingleSkillDraft } from '../src/source-single-skill';
import type { SourceTeamDraft } from '../src/source-team-builder';

type RunExport = { schemaVersion: 'source-single-skill-result-v1'; input: SourceSingleSkillDraft; result: SourceHostResult };

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

function actionCollection(run: RunExport) {
  const accepted = sourceActionReceipts(run.result.logs).filter(row => row.acceptedFrame !== undefined && row.action !== 'wait' && row.action !== 'swap');
  expect(accepted).toHaveLength(1);
  expect(accepted[0]).toMatchObject({ characterKey: run.input.member.characterKey, action: run.input.action.kind });
  const collection = captureSourceHostActionCollection(run.result, accepted[0]!.sequence, 'creation');
  return { action: accepted[0]!, collection, analysis: calculateSourceHostActionCollection(collection) };
}

test('explicit source target geometry changes actual Kaeya contact and survives both editors', async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const measurements: Record<string, unknown> = {};
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    const archived = JSON.parse(await readFile('docs/validation/source-single-skill-classic-20260929.capture.json', 'utf8')) as RunExport;
    const oldInput = archived.input;
    expect(oldInput.source.hostVariant).toBe('classic');
    expect(oldInput.member.characterKey).toBe('kaeya');
    expect(oldInput.action.kind).toBe('skill');
    expect(oldInput.durationSeconds).toBe(6);
    expect(oldInput.seed).toBe('11');
    expect(oldInput.target.geometry).toBeUndefined();

    await page.goto('/calculator');
    await page.locator('[data-action="source-single-skill"]').click();
    const panel = page.locator('#calc-source-single-skill [data-source-single-skill]');
    await expect(panel.locator('[data-single-import]')).toBeEnabled();
    await panel.locator('[data-single-import]').setInputFiles({
      name: 'legacy-kaeya-single-skill.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(oldInput)),
    });
    await expect(panel.locator('[data-single-status]')).toContainText('已导入单动作输入 JSON');
    await expect(panel.locator('[data-target-geometry-default]')).toContainText('未提供目标几何，沿用原有应用默认值');
    await expect(panel.locator('[data-target-geometry="radius"]')).toHaveValue('2');
    await expect(panel.locator('[data-target-geometry="x"]')).toHaveValue('0');
    await expect(panel.locator('[data-target-geometry="y"]')).toHaveValue('2.4');
    await expect(panel.locator('[data-target-geometry-diagram]')).toBeVisible();

    // Make the previously implicit application defaults explicit in the exported request.
    await panel.locator('[data-target-geometry="radius"]').fill('2');
    await panel.locator('[data-target-geometry="x"]').fill('0');
    await panel.locator('[data-target-geometry="y"]').fill('2.4');
    const nearInput = await download(page, '#calc-source-single-skill [data-single-export-input]') as SourceSingleSkillDraft;
    expect(nearInput.target.geometry).toEqual({ radius: 2, x: 0, y: 2.4 });
    expect({ ...nearInput, target: { ...nearInput.target, geometry: undefined } }).toEqual({
      ...oldInput, target: { ...oldInput.target, geometry: undefined },
    });
    await panel.locator('[data-single-run]').click();
    await expect(panel.locator('[data-single-status]')).toContainText('运行完成', { timeout: 60_000 });
    const near = await download(page, '#calc-source-single-skill [data-single-result-export]') as RunExport;
    const nearPath = '/tmp/gidps-target-geometry-near.json';
    await writeFile(nearPath, JSON.stringify(near)); // Preserve actual native output before numerical assertions.
    expect(near.input).toEqual(nearInput);
    expect(near.result.config).toContain('target lvl=90 resist=0.1 radius=2 pos=0,2.4;');
    const nearObserved = actionCollection(near);
    expect(nearObserved.collection.hits.length).toBeGreaterThan(0);
    expect(nearObserved.analysis.knownSubtotal).toBeGreaterThan(0);
    expect(replaySourceHostHit(nearObserved.collection.hits[0]!.calculation.originalCapture).difference).toBe(0);
    await expect(panel.locator('[data-source-single-result] [data-single-known-subtotal]')).toContainText(String(nearObserved.analysis.knownSubtotal));

    await panel.locator('[data-target-geometry="x"]').fill('50');
    await expect(panel.locator('[data-target-geometry-diagram]')).toContainText('(50, 2.4)');
    const farInput = await download(page, '#calc-source-single-skill [data-single-export-input]') as SourceSingleSkillDraft;
    expect(farInput).toEqual({ ...nearInput, target: { ...nearInput.target, geometry: { radius: 2, x: 50, y: 2.4 } } });
    await panel.locator('[data-single-run]').click();
    await expect(panel.locator('[data-single-status]')).toContainText('运行完成', { timeout: 60_000 });
    const far = await download(page, '#calc-source-single-skill [data-single-result-export]') as RunExport;
    const farPath = '/tmp/gidps-target-geometry-far.json';
    await writeFile(farPath, JSON.stringify(far));
    expect(far.input).toEqual(farInput);
    expect(far.result.config).toContain('target lvl=90 resist=0.1 radius=2 pos=50,2.4;');
    expect(far.result.config.replace(/^target .*;$/m, '<TARGET>')).toBe(near.result.config.replace(/^target .*;$/m, '<TARGET>'));
    expect(far.result.seed).toBe(near.result.seed);
    const farObserved = actionCollection(far);
    const actualMisses = farObserved.collection.attackObservations?.filter(row => row.stage === 'missed') ?? [];
    expect(actualMisses.length, 'far Kaeya E has actual native target-contact miss evidence').toBeGreaterThan(0);
    expect(farObserved.collection.hits).toHaveLength(0);
    expect(farObserved.analysis.knownSubtotal).toBe(0);
    expect(farObserved.analysis.pendingCount).toBe(0);
    expect(farObserved.analysis.opportunities.filter(row => row.status === 'missed')).toHaveLength(actualMisses.length);
    await expect(panel.locator('[data-source-single-result] [data-single-known-subtotal]')).toContainText('已知小计：0');
    await expect(panel.locator('[data-source-single-result] [data-single-observed-hits]')).toContainText('missed');
    await page.screenshot({ path: 'docs/validation/source-target-geometry-browser-20260929.png', fullPage: true });

    await page.goto('/source-simulation');
    const builder = page.locator('#source-team-builder');
    await expect(builder.locator('[data-import-draft]')).toBeAttached();
    const teamDraft: SourceTeamDraft = {
      schemaVersion: 1, source: nearInput.source, name: 'Kaeya geometry handoff',
      members: [nearInput.member],
      actions: [{ actorId: nearInput.member.id, kind: nearInput.action.kind, repeat: 1 },
        { actorId: nearInput.member.id, kind: 'wait', frames: 360 }],
      rotationLoop: { mode: 'once' }, durationSeconds: nearInput.durationSeconds,
      target: { ...nearInput.target }, startup: nearInput.startup,
    };
    await builder.locator('[data-import-draft]').setInputFiles({
      name: 'kaeya-geometry-team.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(teamDraft)),
    });
    await expect(builder.locator('[data-member-tab]')).toHaveCount(1);
    await expect(builder.locator('[data-target-geometry="radius"]')).toHaveValue('2');
    await builder.locator('[data-target-geometry="radius"]').fill('3');
    await builder.locator('[data-target-geometry="radius"]').press('Tab');
    await builder.locator('[data-target-geometry="x"]').fill('-2');
    await builder.locator('[data-target-geometry="x"]').press('Tab');
    await builder.locator('[data-target-geometry="y"]').fill('6');
    await builder.locator('[data-target-geometry="y"]').press('Tab');
    const exportedDraft = await download(page, '#source-team-builder [data-export-draft]') as SourceTeamDraft;
    expect(exportedDraft.target.geometry).toEqual({ radius: 3, x: -2, y: 6 });
    expect(exportedDraft.members).toEqual(teamDraft.members);
    expect(exportedDraft.actions).toEqual(teamDraft.actions);
    await builder.locator('[data-apply-script]').click();
    await expect(builder.locator('[role="status"]')).toContainText('脚本已填入来源执行器');
    const generated = await page.locator('#source-host-config').inputValue();
    expect(generated).toContain('target lvl=90 resist=0.1 radius=3 pos=-2,6;');
    expect(generated).toContain('kaeya skill;');

    measurements.near = { rawPath: nearPath, target: near.input.target, actionSequence: nearObserved.action.sequence,
      applicationIds: nearObserved.collection.hits.map(hit => hit.calculation.originalCapture.application.id),
      knownSubtotal: nearObserved.analysis.knownSubtotal, firstHitReplayDifference: 0 };
    measurements.far = { rawPath: farPath, target: far.input.target, actionSequence: farObserved.action.sequence,
      nativeMissCount: actualMisses.length, applicationCount: far.result.applications.length,
      knownSubtotal: farObserved.analysis.knownSubtotal, screenshot: 'docs/validation/source-target-geometry-browser-20260929.png' };
    measurements.team = { exportedTarget: exportedDraft.target, generatedTarget: generated.match(/^target .*;$/m)?.[0],
      nativeTeamRun: false };
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile('docs/validation/source-target-geometry-browser-20260929.result.json', JSON.stringify({
      schemaVersion: 'source-target-geometry-browser-v1', measurements, pageErrors,
      scope: 'One classic Kaeya skill at two explicit source target positions, followed by one team-draft geometry export and GCSL generation; no team executor run.',
    }, null, 2) + '\n');
  }
});
