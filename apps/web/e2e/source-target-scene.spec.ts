import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { captureSourceHostHit, replaySourceHostHit, sourceHostHitCaptureSchema } from '../../../packages/sim-core/src/source-host-capture';
import { summarizeSourceHostTargets } from '../../../packages/sim-core/src/source-host-target-summary';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';
import type { SourceSingleSkillDraft } from '../src/source-single-skill';
import type { SourceTeamDraft } from '../src/source-team-builder';

type RunExport = { schemaVersion: 'source-single-skill-result-v1'; input: SourceSingleSkillDraft; result: SourceHostResult };

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

function evidence(result: SourceHostResult) {
  const scene = result.targetScene;
  expect(scene).toBeDefined();
  expect(scene!.targets).toHaveLength(3);
  expect(scene!.targets.map(target => target.declarationIndex)).toEqual([0, 1, 2]);
  expect(scene!.targets.map(target => target.position)).toEqual([
    { x: 0, y: 2.4, radius: 2 }, { x: 0.5, y: 2.4, radius: 2 }, { x: 50, y: 2.4, radius: 2 },
  ]);
  const summary = summarizeSourceHostTargets(result);
  expect(summary.scope).toBe('all-applications');
  expect(summary.targets).toHaveLength(3);
  expect(summary.unmapped.hitCount).toBe(0);
  expect(summary.total.hitCount).toBe(result.applications.length);
  expect(summary.total.rawDamage).toBeCloseTo(summary.targets.reduce((sum, target) => sum + target.rawDamage, 0), 9);
  expect(summary.total.appliedDamage).toBeCloseTo(summary.targets.reduce((sum, target) => sum + target.appliedDamage, 0), 9);
  const far = summary.targets.find(target => target.declarationIndex === 2)!;
  expect(far.hitCount).toBe(0);
  expect(far.rawDamage).toBe(0);
  expect(far.appliedDamage).toBe(0);
  expect(far.applicationIds).toEqual([]);
  expect(far.trace.some(node => node.result?.value === 0)).toBe(true);
  const replayDifferences = result.applications.map(application => {
    const capture = captureSourceHostHit(result, application.id);
    const restored = sourceHostHitCaptureSchema.parse(JSON.parse(JSON.stringify(capture)));
    expect(restored.targetScene).toEqual(scene);
    expect(restored.observationWindow).toEqual(result.observationWindow);
    const difference = replaySourceHostHit(restored).difference;
    expect(difference).toBe(0);
    return difference;
  });
  return { scene: scene!, summary, replayDifferences };
}

test('three native targets keep total damage separate from the selected statistics target', async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const measurements: Record<string, unknown> = {};
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    const archived = JSON.parse(await readFile('docs/validation/source-single-skill-classic-20260929.capture.json', 'utf8')) as RunExport;
    const firstInput: SourceSingleSkillDraft = {
      ...archived.input,
      target: { ...archived.input.target, resistance: 0.1, geometry: { radius: 2, x: 0, y: 2.4 } },
    };
    expect(firstInput.source.hostVariant).toBe('classic');
    expect(firstInput.member.characterKey).toBe('kaeya');
    expect(firstInput.action.kind).toBe('skill');
    expect(firstInput.durationSeconds).toBe(6);
    expect(firstInput.seed).toBe('11');

    await page.goto('/calculator');
    await page.locator('[data-action="source-single-skill"]').click();
    const panel = page.locator('#calc-source-single-skill [data-source-single-skill]');
    await expect(panel.locator('[data-single-import]')).toBeEnabled();
    await panel.locator('[data-single-import]').setInputFiles({
      name: 'kaeya-first-target.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(firstInput)),
    });
    await expect(panel.locator('[data-single-status]')).toContainText('已导入单动作输入 JSON');
    const sceneEditor = panel.locator('[data-target-scene]');
    await sceneEditor.locator('[data-target-scene-action="add"]').click();
    await expect(sceneEditor.locator('[data-target-scene-target]')).toHaveCount(1);
    const second = sceneEditor.locator('[data-target-scene-target="1"]');
    await second.locator('[data-target-scene-field="resistance"]').fill('0.5');
    await second.locator('[data-target-geometry="x"]').fill('0.5');
    await sceneEditor.locator('[data-target-scene-action="add"]').click();
    await expect(sceneEditor.locator('[data-target-scene-target]')).toHaveCount(2);
    const third = sceneEditor.locator('[data-target-scene-target="2"]');
    await third.locator('[data-target-geometry="x"]').fill('50');
    await sceneEditor.locator('[data-target-scene-primary]').selectOption('1');
    await expect(sceneEditor.locator('[data-target-scene-diagram]')).toContainText('目标 3');
    const singleInput = await download(page, '#calc-source-single-skill [data-single-export-input]') as SourceSingleSkillDraft;
    expect(singleInput.primaryTargetIndex).toBe(1);
    expect(singleInput.target).toEqual(firstInput.target);
    expect(singleInput.additionalTargets).toEqual([
      { ...firstInput.target, resistance: 0.5, geometry: { radius: 2, x: 0.5, y: 2.4 } },
      { ...firstInput.target, geometry: { radius: 2, x: 50, y: 2.4 } },
    ]);

    await panel.locator('[data-single-run]').click();
    await expect(panel.locator('[data-single-status]')).toContainText('运行完成', { timeout: 60_000 });
    const single = await download(page, '#calc-source-single-skill [data-single-result-export]') as RunExport;
    const singlePath = '/tmp/gidps-target-scene-single.json';
    await writeFile(singlePath, JSON.stringify(single)); // Keep complete native evidence before assertions.
    expect(single.input).toEqual(singleInput);
    expect(single.result.config.match(/^target .*;$/gm)).toHaveLength(3);
    expect(single.result.config).toContain('target lvl=90 resist=0.1 radius=2 pos=0,2.4;');
    expect(single.result.config).toContain('target lvl=90 resist=0.5 radius=2 pos=0.5,2.4;');
    expect(single.result.config).toContain('target lvl=90 resist=0.1 radius=2 pos=50,2.4;');
    const singleEvidence = evidence(single.result);
    expect(singleEvidence.scene.primaryTargetIndex).toBe(1);
    expect(singleEvidence.scene.initialDefaultTargetKey).toBe(singleEvidence.scene.targets[0]!.targetKey);
    expect(singleEvidence.scene.initialDefaultTargetKey).not.toBe(singleEvidence.scene.targets[1]!.targetKey);
    expect(singleEvidence.summary.primaryTargetKey).toBe(singleEvidence.scene.targets[1]!.targetKey);
    expect(single.result.applications).toHaveLength(2);
    expect(singleEvidence.summary.targets.find(target => target.declarationIndex === 0)?.hitCount).toBe(1);
    expect(singleEvidence.summary.targets.find(target => target.declarationIndex === 1)?.hitCount).toBe(1);
    expect(singleEvidence.summary.total.rawDamage).toBeGreaterThan(singleEvidence.summary.targets[0]!.rawDamage);
    const farKey = singleEvidence.scene.targets[2]!.targetKey;
    expect(single.result.attackObservations?.some(row => row.stage === 'missed' && row.targetKey === farKey)).toBe(true);
    const singleSummary = panel.locator('[data-single-target-summary] [data-source-host-target-summary]');
    await expect(singleSummary).toBeVisible();
    await expect(singleSummary.locator('[data-target-summary-scope]')).toContainText('仅统计当前关联');
    await expect(singleSummary.locator('[data-target-summary-row]')).toHaveCount(3);
    await expect(singleSummary.locator(`[data-target-summary-row="${farKey}"]`)).toContainText('0');
    await expect(singleSummary.locator('[data-target-primary]')).toContainText('统计主目标');

    await page.goto('/source-simulation');
    await page.locator('#source-host-variant').selectOption('classic');
    const builder = page.locator('#source-team-builder');
    await expect(builder.locator('[data-import-draft]')).toBeAttached();
    const teamDraft: SourceTeamDraft = {
      schemaVersion: 1, source: singleInput.source, name: '单角色实际动作观察',
      members: [singleInput.member],
      actions: [{ actorId: singleInput.member.id, kind: 'skill', repeat: 1 },
        { actorId: singleInput.member.id, kind: 'wait', frames: 360 }],
      durationSeconds: singleInput.durationSeconds, rotationLoop: { mode: 'once' },
      startup: singleInput.startup, target: singleInput.target,
      additionalTargets: singleInput.additionalTargets!, primaryTargetIndex: 2,
    };
    await builder.locator('[data-import-draft]').setInputFiles({
      name: 'kaeya-three-target-team.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(teamDraft)),
    });
    await expect(builder.locator('[data-target-scene-primary]')).toHaveValue('2');
    const exportedDraft = await download(page, '#source-team-builder [data-export-draft]') as SourceTeamDraft;
    expect(exportedDraft.additionalTargets).toEqual(singleInput.additionalTargets);
    expect(exportedDraft.primaryTargetIndex).toBe(2);
    await builder.locator('[data-apply-script]').click();
    await expect(page.locator('#source-host-primary-target')).toHaveValue('3');
    const generated = await page.locator('#source-host-config').inputValue();
    expect(generated).toBe(single.result.config);
    expect(generated.match(/^target .*;$/gm)).toHaveLength(3);
    await page.locator('#source-host-seed').fill('11');
    await page.locator('#source-host-phase-enabled').uncheck();
    await page.locator('#source-host-run').click();
    await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 60_000 });
    const team = await download(page, '#source-host-export') as SourceHostResult;
    const teamPath = '/tmp/gidps-target-scene-team.json';
    await writeFile(teamPath, JSON.stringify(team));
    expect(team.config).toBe(single.result.config);
    expect(team.seed).toBe(single.result.seed);
    expect(team.applications).toEqual(single.result.applications);
    const teamEvidence = evidence(team);
    expect(teamEvidence.scene.primaryTargetIndex).toBe(2);
    expect(teamEvidence.scene.initialDefaultTargetKey).toBe(singleEvidence.scene.initialDefaultTargetKey);
    expect(teamEvidence.summary.primaryTargetKey).toBe(farKey);
    expect(teamEvidence.summary.targets.find(target => target.isPrimary)?.rawDamage).toBe(0);
    expect(teamEvidence.summary.total.rawDamage).toBeCloseTo(singleEvidence.summary.total.rawDamage, 9);
    expect(teamEvidence.summary.total.rawDamage).toBeGreaterThan(0);
    const teamSummary = page.locator('#source-host-target-summary [data-source-host-target-summary]');
    await expect(teamSummary).toBeVisible();
    await expect(teamSummary.locator('[data-target-summary-scope]')).toContainText('汇总全部');
    await expect(teamSummary.locator('[data-target-primary]')).toContainText('来源记账伤害 0');
    await expect(teamSummary.locator('[data-target-total]')).not.toContainText('来源记账伤害 0');
    await builder.locator('[data-target-scene-diagram]').screenshot({
      path: 'docs/validation/source-target-scene-diagram-20260929.png',
    });
    await teamSummary.screenshot({
      path: 'docs/validation/source-target-scene-summary-20260929.png',
    });

    // Copy/remove changes only the editable scene; no third native run is needed.
    const teamScene = builder.locator('[data-target-scene]');
    await teamScene.locator('[data-target-scene-action="copy"][data-target-scene-index="1"]').click();
    await expect(teamScene.locator('[data-target-scene-target]')).toHaveCount(3);
    await teamScene.locator('[data-target-scene-primary]').selectOption('3');
    await teamScene.locator('[data-target-scene-action="remove"][data-target-scene-index="3"]').click();
    await expect(teamScene.locator('[data-target-scene-primary]')).toHaveValue('0');
    await teamScene.locator('[data-target-scene-primary]').selectOption('2');
    const restoredDraft = await download(page, '#source-team-builder [data-export-draft]') as SourceTeamDraft;
    expect(restoredDraft).toEqual(exportedDraft);
    expect(pageErrors).toEqual([]);

    measurements.single = { rawPath: singlePath, primaryTargetIndex: singleEvidence.scene.primaryTargetIndex,
      initialDefaultTargetKey: singleEvidence.scene.initialDefaultTargetKey,
      primaryTargetKey: singleEvidence.summary.primaryTargetKey, totalRawDamage: singleEvidence.summary.total.rawDamage,
      rows: singleEvidence.summary.targets.map(target => ({ declarationIndex: target.declarationIndex, targetKey: target.targetKey,
        rawDamage: target.rawDamage, appliedDamage: target.appliedDamage, hitCount: target.hitCount })),
      replayDifferences: singleEvidence.replayDifferences };
    measurements.team = { rawPath: teamPath, primaryTargetIndex: teamEvidence.scene.primaryTargetIndex,
      initialDefaultTargetKey: teamEvidence.scene.initialDefaultTargetKey,
      primaryTargetKey: teamEvidence.summary.primaryTargetKey, totalRawDamage: teamEvidence.summary.total.rawDamage,
      primaryRawDamage: teamEvidence.summary.targets.find(target => target.isPrimary)?.rawDamage,
      replayDifferences: teamEvidence.replayDifferences,
      sameNativeApplications: true, copiedAndRemovedDraftRestored: true,
      sceneScreenshot: 'docs/validation/source-target-scene-diagram-20260929.png',
      summaryScreenshot: 'docs/validation/source-target-scene-summary-20260929.png' };
  } finally {
    await writeFile('docs/validation/source-target-scene-browser-20260929.result.json', JSON.stringify({
      schemaVersion: 'source-target-scene-browser-v1', measurements, pageErrors,
      scope: 'Two classic Kaeya E native runs with the same three-target GCSL and seed; only the statistics target changes. Initial native default target and primary reporting remain distinct.',
    }, null, 2) + '\n');
  }
});
