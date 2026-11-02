import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

type RunLog = {
  event?: string;
  frame?: number;
  msg?: string;
  char_index?: number;
  logs?: Record<string, unknown>;
};

test('real source cooldown and effect countdowns follow the frame cursor; local team plans survive reload', async ({ page }) => {
  test.setTimeout(90_000); // Real WASM run plus five playback rates and persistence reloads.
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/source-simulation');
  const builder = page.locator('#source-team-builder');
  await expect(builder.locator('h2')).toContainText('来源队伍构筑');
  await builder.locator('[data-template]').selectOption('vaporize-hydro-pyro');
  await builder.locator('[data-template-load="vaporize-hydro-pyro"]').click();
  await expect(builder.locator('[data-member-tab]')).toHaveCount(4);
  await builder.locator('[data-member-tab="3"]').click();
  const seededActions = builder.locator('.source-team-builder__actions > li');
  for (let index = await seededActions.count() - 1; index >= 0; index--) {
    await builder.locator(`[data-action-delete="${index}"]`).click();
  }
  await builder.locator('[data-quick-action="skill"]').click();
  await expect(builder.locator('.source-team-builder__actions > li')).toHaveCount(1);
  await builder.locator('[data-action-params-details]').locator('summary').click();
  await builder.locator('[data-action-params="0"]').fill('hold=1');
  await builder.locator('[data-run-direct]').click();
  await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 45_000 });
  await expect(page.locator('[data-source-host-result-overview]')).toBeVisible();
  await expect(page.locator('[data-source-host-result-details]')).not.toHaveAttribute('open');
  await expect(page.locator('#source-host-target-summary')).toBeHidden();
  await expect(page.locator('[data-runtime-details]')).not.toHaveAttribute('open');
  await expect(page.locator('[data-source-record-details]')).not.toHaveAttribute('open');
  await page.locator('[data-source-host-result-details] > summary').click();
  await expect(page.locator('#source-host-target-summary')).toBeVisible();
  await expect(page.locator('[data-source-host-incoming-ledger]')).toBeVisible();
  await page.locator('[data-source-host-result-details] > summary').click();

  await page.locator('#source-host-export').evaluate(button => { button.closest('details')!.open = true; });
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#source-host-export').click();
  const download = await downloadPromise;
  const filePath = await download.path();
  if (!filePath) throw new Error('来源运行结果没有可读取的下载文件。');
  const result = JSON.parse(await readFile(filePath, 'utf8')) as SourceHostResult;
  await page.locator('[data-source-curve] > summary').click();
  await expect(page.locator('[data-curve-svg]')).toBeVisible();
  const total = Number(await page.locator('[data-source-host-overview-total]').getAttribute('data-value'));
  for (const dimension of ['actor', 'source', 'element', 'reaction']) {
    const sum = await page.locator(`[data-curve-table="${dimension}"] tbody tr`).evaluateAll(rows => rows.reduce((sum, row) => sum + Number((row as HTMLElement).dataset.damage), 0));
    expect(sum).toBeCloseTo(total, 6);
  }
  const logs = result.logs as unknown as RunLog[];
  const zhongliIndex = logs.find(row => {
    if (row.event !== 'character') return false;
    const base = row.logs?.char_base as Record<string, unknown> | undefined;
    return base?.key === 'zhongli';
  })?.char_index;
  expect(zhongliIndex).toEqual(expect.any(Number));
  const accepted = logs.find(row => row.event === 'action' && row.msg === 'source-host action accepted'
    && row.logs?.characterKey === 'zhongli' && row.logs?.action === 'skill');
  const sequence = accepted?.logs?.sequence;
  expect(sequence).toEqual(expect.any(Number));
  const skillCooldownEvents = logs.filter(row => row.event === 'cooldown' && row.char_index === zhongliIndex
    && row.logs?.type === 'skill');
  const trigger = skillCooldownEvents.find(row => (row.msg ?? '').includes(' cooldown triggered'));
  expect(trigger).toBeDefined();
  const ready = skillCooldownEvents.find(row => (row.msg ?? '').includes(' cooldown ready') && row.frame! > trigger!.frame!);
  const cursor = Math.min(result.observationWindow?.actualEndFrame ?? result.lifecycleObservationFrame ?? 0,
    (trigger!.frame ?? 0) + 1);
  const slider = builder.locator('[data-sim-time-cursor]');
  const moveCursor = (frame: number) => slider.evaluate((input, value) => {
    const range = input as HTMLInputElement;
    range.value = String(value);
    range.dispatchEvent(new Event('input', { bubbles: true }));
  }, frame);
  await moveCursor(cursor);
  await expect(builder.locator('[data-sim-time-readout]')).toContainText(`第 ${cursor} 帧`);
  const quickSkillSummary = builder.locator('[data-quick-action="skill"] [data-runtime-action-summary]');
  const actionRowSummary = builder.locator('.source-team-builder__actions > li [data-runtime-action-summary]');
  if (ready?.frame !== undefined && ready.frame > cursor) {
    await expect(quickSkillSummary).toContainText(`剩余 ${ready.frame - cursor} 帧`);
    await expect(actionRowSummary).toContainText(`剩余 ${ready.frame - cursor} 帧`);
    await moveCursor(ready.frame);
    await expect(quickSkillSummary).toContainText('已就绪');
  } else {
    await expect(quickSkillSummary).toContainText('未知（本次观察未记录就绪帧）');
  }

  const linkedStatus = result.statusInstances?.find(row => row.creationActionSequence === sequence);
  expect(linkedStatus, 'held E should produce a source-observed status linked to the accepted action').toBeDefined();
  const statusCursor = linkedStatus!.createdFrame + 1;
  await moveCursor(statusCursor);
  const statusLedger = builder.locator('[data-runtime-effects]');
  await builder.locator('[data-runtime-details] > summary').click();
  await expect(statusLedger).toContainText(linkedStatus!.statusKey);
  await expect(statusLedger).toContainText('剩余');
  await expect(actionRowSummary).toContainText(linkedStatus!.statusKey);

  // Playback consumes the stored result only; speed never starts another simulation.
  for (const speed of ['1', '2', '4', '8', '16']) {
    await builder.locator('[data-playback-speed]').selectOption(speed);
    await moveCursor(0);
    await builder.locator('[data-playback-toggle]').click();
    await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(0);
    await builder.locator('[data-playback-end]').click();
    expect(Number(await slider.inputValue())).toBe(Number(await slider.getAttribute('max')));
    await expect(builder.locator('[data-playback-toggle]')).toHaveText('播放回放');
  }
  const secondDownload = page.waitForEvent('download');
  await page.locator('#source-host-export').click();
  const secondFile = await (await secondDownload).path();
  expect(JSON.parse(await readFile(secondFile!, 'utf8'))).toEqual(result);

  await page.goto('/team');
  const planName = `Codex 本机保存刷新验收 ${Date.now()}`;
  await page.locator('#team-plan-name').fill(planName);
  await page.locator('#team-plan-save').click();
  await expect(page.locator('#team-plan-status')).toContainText('已保存本机方案');
  await page.reload();
  const planSelect = page.locator('#team-plan-select');
  await expect(planSelect.locator('option').filter({ hasText: planName })).toHaveCount(1);
  await planSelect.selectOption({ label: planName });
  await page.locator('#team-plan-load').click();
  await expect(page.locator('#team-plan-status')).toContainText(`已载入本机方案“${planName}”`);
  await page.locator('#team-plan-delete').click();
  await expect(planSelect.locator('option').filter({ hasText: planName })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
