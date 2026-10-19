import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { replaySourceHostHit, captureSourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';
import type { SourceSingleSkillDraft } from '../src/source-single-skill';
import type { SourceTeamDraft } from '../src/source-team-builder';

type RunExport = { schemaVersion: 'source-single-skill-result-v1'; input: SourceSingleSkillDraft; result: SourceHostResult };

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

test('classic source target profile changes native resistance and HP mode, then survives team handoff', async ({ page }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  const measurements: Record<string, unknown> = {};
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    const baseline = JSON.parse(await readFile('docs/validation/source-single-skill-classic-20260929.capture.json', 'utf8')) as RunExport;
    expect(baseline.input.source.hostVariant).toBe('classic');
    expect(baseline.input.member.characterKey).toBe('kaeya');
    expect(baseline.input.action.kind).toBe('skill');
    expect(baseline.input.seed).toBe('11');
    expect(baseline.result.applications).toHaveLength(1);
    const baselineHit = baseline.result.applications[0]!;
    expect(baselineHit.damageMode).toBe(false);
    const nearInput: SourceSingleSkillDraft = {
      ...baseline.input,
      target: { ...baseline.input.target, geometry: { radius: 2, x: 0, y: 2.4 } },
    };

    await page.goto('/calculator');
    await page.locator('[data-action="source-single-skill"]').click();
    const panel = page.locator('#calc-source-single-skill [data-source-single-skill]');
    await expect(panel.locator('[data-single-import]')).toBeEnabled();
    await panel.locator('[data-single-import]').setInputFiles({
      name: 'near-kaeya-profile.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(nearInput)),
    });
    await expect(panel.locator('[data-single-status]')).toContainText('已导入单动作输入 JSON');
    const advanced = panel.locator('[data-source-target-profile-controls]');
    await advanced.locator('summary').click();
    await advanced.locator('[data-target-resistance="cryo"]').fill('0.5');
    const resistanceInput = await download(page, '#calc-source-single-skill [data-single-export-input]') as SourceSingleSkillDraft;
    expect(resistanceInput.target.resistanceByElement).toEqual({ cryo: 0.5 });
    expect({ ...resistanceInput, target: { ...resistanceInput.target, resistanceByElement: undefined } }).toEqual({
      ...nearInput, target: { ...nearInput.target, resistanceByElement: undefined },
    });
    await panel.locator('[data-single-run]').click();
    await expect(panel.locator('[data-single-status]')).toContainText('运行完成', { timeout: 60_000 });
    const resistanceRun = await download(page, '#calc-source-single-skill [data-single-result-export]') as RunExport;
    const resistancePath = '/tmp/gidps-target-profile-resistance.json';
    await writeFile(resistancePath, JSON.stringify(resistanceRun)); // Preserve actual native output before numeric assertions.
    expect(resistanceRun.input).toEqual(resistanceInput);
    expect(resistanceRun.result.config).toContain('cryo=0.5');
    expect(resistanceRun.result.config).toContain('electro=0.1');
    expect(resistanceRun.result.config).not.toMatch(/\bresist=/);
    expect(resistanceRun.result.seed).toBe(baseline.result.seed);
    expect(resistanceRun.result.applications).toHaveLength(1);
    const resisted = resistanceRun.result.applications[0]!;
    expect(resisted.damageMode).toBe(false);
    expect(resisted.frame).toBe(baselineHit.frame);
    expect(resisted.attackId).toBe(baselineHit.attackId);
    expect(resisted.isCrit).toBe(baselineHit.isCrit);
    expect(resisted.rawDamage).toBeCloseTo(baselineHit.rawDamage * (0.5 / 0.9), 9);
    expect(resisted.appliedDamage).toBeCloseTo(resisted.rawDamage, 9);
    expect(replaySourceHostHit(captureSourceHostHit(resistanceRun.result, resisted.id)).difference).toBe(0);

    await advanced.locator('[data-target-profile="hp"]').fill('100');
    const hpInput = await download(page, '#calc-source-single-skill [data-single-export-input]') as SourceSingleSkillDraft;
    expect(hpInput.target).toEqual({ ...resistanceInput.target, hp: 100 });
    await panel.locator('[data-single-run]').click();
    await expect(panel.locator('[data-single-status]')).toContainText('运行完成', { timeout: 60_000 });
    const hpRun = await download(page, '#calc-source-single-skill [data-single-result-export]') as RunExport;
    const hpPath = '/tmp/gidps-target-profile-hp.json';
    await writeFile(hpPath, JSON.stringify(hpRun));
    expect(hpRun.input).toEqual(hpInput);
    expect(hpRun.result.config).toContain('hp=100');
    expect(hpRun.result.applications).toHaveLength(1);
    const capped = hpRun.result.applications[0]!;
    expect(capped.damageMode).toBe(true);
    expect(capped.rawDamage).toBeCloseTo(resisted.rawDamage, 9);
    expect(capped.hpBefore).toBe(100);
    expect(capped.appliedDamage).toBe(100);
    expect(capped.hpAfter).toBe(0);
    expect(replaySourceHostHit(captureSourceHostHit(hpRun.result, capped.id)).difference).toBe(0);
    expect(hpRun.result.observationWindow).toMatchObject({
      policy: 'duration-or-native', configuredEndFrame: 360, endReason: 'targets-dead',
    });
    expect(hpRun.result.observationWindow!.actualEndFrame).toBeLessThan(360);
    expect((hpRun.result.result as { duration: number }).duration).toBeGreaterThan(0);
    expect((hpRun.result.result as { duration: number }).duration).toBeLessThan(360);
    await page.screenshot({ path: 'docs/validation/source-target-profile-browser-20260929.png', fullPage: true });

    await page.goto('/source-simulation');
    await page.locator('#source-host-variant').selectOption('classic');
    const builder = page.locator('#source-team-builder');
    await expect(builder.locator('[data-import-draft]')).toBeAttached();
    const profileTarget: SourceTeamDraft['target'] = {
      ...hpInput.target, freezeResistance: 0.25,
      particleDrops: { threshold: 50, count: 2, element: 'cryo' },
    };
    const teamDraft: SourceTeamDraft = {
      schemaVersion: 1, source: hpInput.source, name: 'Kaeya target profile handoff',
      members: [hpInput.member],
      actions: [{ actorId: hpInput.member.id, kind: hpInput.action.kind, repeat: 1 },
        { actorId: hpInput.member.id, kind: 'wait', frames: 360 }],
      durationSeconds: hpInput.durationSeconds, rotationLoop: { mode: 'once' }, startup: hpInput.startup,
      target: profileTarget,
    };
    await builder.locator('[data-import-draft]').setInputFiles({
      name: 'kaeya-target-profile-team.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(teamDraft)),
    });
    await expect(builder.locator('[data-member-tab]')).toHaveCount(1);
    const teamAdvanced = builder.locator('[data-source-target-profile-controls]');
    await teamAdvanced.locator('summary').click();
    await expect(teamAdvanced.locator('[data-target-resistance="cryo"]')).toHaveValue('0.5');
    await expect(teamAdvanced.locator('[data-target-profile="freezeResistance"]')).toHaveValue('0.25');
    await expect(teamAdvanced.locator('[data-target-profile="hp"]')).toHaveValue('100');
    await expect(teamAdvanced.locator('[data-target-profile="particleThreshold"]')).toHaveValue('50');
    await expect(teamAdvanced.locator('[data-target-profile="particleCount"]')).toHaveValue('2');
    await expect(teamAdvanced.locator('[data-target-profile="particleElement"]')).toHaveValue('cryo');
    const exportedDraft = await download(page, '#source-team-builder [data-export-draft]') as SourceTeamDraft;
    expect(exportedDraft.target).toEqual(profileTarget);
    expect(exportedDraft.members).toEqual(teamDraft.members);
    expect(exportedDraft.actions).toEqual(teamDraft.actions);
    await builder.locator('[data-apply-script]').click();
    await expect(page.locator('#source-host-stop-at-duration')).toBeChecked();
    const generated = await page.locator('#source-host-config').inputValue();
    const targetClause = generated.match(/^target .*;$/m)?.[0];
    expect(targetClause).toContain('cryo=0.5');
    expect(targetClause).toContain('electro=0.1');
    expect(targetClause).toContain('freeze_resist=0.25 hp=100 particle_threshold=50 particle_drop_count=2 particle_element=cryo;');

    // The same actor with zero energy cannot cast Q. A high-HP target and finite
    // observation cap must end this native run without inventing a hit or hang.
    const cappedDraft: SourceTeamDraft = {
      ...teamDraft, name: 'Kaeya Q waiting for energy', startup: 'zero',
      actions: [{ actorId: hpInput.member.id, kind: 'burst', repeat: 1 }],
      target: { ...profileTarget, hp: 1_000_000_000 },
    };
    await builder.locator('[data-import-draft]').setInputFiles({
      name: 'kaeya-zero-energy-hp-cap.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(cappedDraft)),
    });
    await expect(builder.locator('[data-current-action-check]')).toContainText('Q 爆发');
    await builder.locator('[data-apply-script]').click();
    await expect(page.locator('#source-host-stop-at-duration')).toBeChecked();
    await page.locator('#source-host-seed').fill('11');
    await page.locator('#source-host-phase-enabled').uncheck();
    await page.locator('#source-host-run').click();
    await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 60_000 });
    const teamRun = await download(page, '#source-host-export') as SourceHostResult;
    const teamPath = '/tmp/gidps-target-profile-team-cap.json';
    await writeFile(teamPath, JSON.stringify(teamRun));
    expect(teamRun.config).toContain('kaeya burst;');
    expect(teamRun.config).toContain('hp=1000000000');
    expect(teamRun.config).toContain('start_energy=0');
    expect(teamRun.applications).toHaveLength(0);
    expect(teamRun.observationWindow).toEqual({
      policy: 'duration-or-native', configuredEndFrame: 360, actualEndFrame: 360, endReason: 'duration',
    });
    expect((teamRun.result as { duration: number }).duration).toBe(360);
    expect(pageErrors).toEqual([]);

    measurements.resistance = { rawPath: resistancePath, target: resistanceInput.target,
      rawDamage: resisted.rawDamage, baselineRawDamage: baselineHit.rawDamage,
      expectedRatio: 0.5 / 0.9, observedRatio: resisted.rawDamage / baselineHit.rawDamage,
      replayDifference: 0, damageMode: resisted.damageMode };
    measurements.hp = { rawPath: hpPath, target: hpInput.target, rawDamage: capped.rawDamage,
      appliedDamage: capped.appliedDamage, hpBefore: capped.hpBefore, hpAfter: capped.hpAfter,
      actualDurationFrames: (hpRun.result.result as { duration: number }).duration, observationWindow: hpRun.result.observationWindow,
      replayDifference: 0, screenshot: 'docs/validation/source-target-profile-browser-20260929.png' };
    measurements.team = { exportedTarget: exportedDraft.target, generatedTarget: targetClause,
      capRunPath: teamPath, capObservationWindow: teamRun.observationWindow,
      capApplicationCount: teamRun.applications.length };
  } finally {
    await writeFile('docs/validation/source-target-profile-browser-20260929.result.json', JSON.stringify({
      schemaVersion: 'source-target-profile-browser-v1', measurements, pageErrors,
      scope: 'Two actual classic Kaeya E runs test absolute Cryo resistance and HP damage mode; one zero-energy Kaeya Q team run verifies the finite observation cap. No new actor matrix.',
    }, null, 2) + '\n');
  }
});
