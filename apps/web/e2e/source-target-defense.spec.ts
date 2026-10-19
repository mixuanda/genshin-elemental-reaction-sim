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

test('one native Kaeya skill preserves each target DEF profile through formula, replay and team draft', async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const measurements: Record<string, unknown> = {};
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    const archived = JSON.parse(await readFile('docs/validation/source-target-scene-single-20260929.capture.json', 'utf8')) as RunExport;
    const firstInput = structuredClone(archived.input);
    delete firstInput.additionalTargets;
    delete firstInput.primaryTargetIndex;
    firstInput.target = { level: 90, resistance: 0.1, geometry: { radius: 2, x: 0, y: 2.4 } };
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
    const scene = panel.locator('[data-target-scene]');
    await scene.locator('[data-target-scene-action="add"]').click();
    const second = scene.locator('[data-target-scene-target="1"]');
    await second.locator('[data-source-target-profile-controls] > summary').click();
    await second.locator('[data-target-profile="defenseAdjustment"]').fill('-0.3');
    await scene.locator('[data-target-scene-action="add"]').click();
    const third = scene.locator('[data-target-scene-target="2"]');
    await third.locator('[data-source-target-profile-controls] > summary').click();
    await third.locator('[data-target-profile="defenseAdjustment"]').fill('0.2');
    await expect(panel.locator('[data-single-first-target] [data-target-profile="defenseAdjustment"]')).toHaveValue('');
    const input = await download(page, '#calc-source-single-skill [data-single-export-input]') as SourceSingleSkillDraft;
    expect(input.target.defenseAdjustment).toBeUndefined();
    expect(input.additionalTargets?.map(target => target.defenseAdjustment)).toEqual([-0.3, 0.2]);
    for (const target of [input.target, ...(input.additionalTargets ?? [])]) {
      expect(target.level).toBe(90);
      expect(target.resistance).toBe(0.1);
      expect(target.geometry).toEqual({ radius: 2, x: 0, y: 2.4 });
      expect(target.hp).toBeUndefined();
    }

    await panel.locator('[data-single-run]').click();
    await expect(panel.locator('[data-single-status]')).toContainText('运行完成', { timeout: 60_000 });
    const exported = await download(page, '#calc-source-single-skill [data-single-result-export]') as RunExport;
    const rawPath = '/tmp/gidps-target-defense.json';
    await writeFile(rawPath, JSON.stringify(exported)); // Save the complete native run before checking its numbers.
    expect(exported.input).toEqual(input);
    const result = exported.result;
    const targetLines = result.config.match(/^target .*;$/gm) ?? [];
    expect(targetLines).toHaveLength(3);
    expect(targetLines[0]).not.toContain('def_adjustment'); // Go's omitted default is zero.
    expect(targetLines[1]).toContain('def_adjustment=-0.3');
    expect(targetLines[2]).toContain('def_adjustment=0.2');
    expect(result.targetScene?.targets).toHaveLength(3);
    expect(result.applications).toHaveLength(3);

    const targetKeys = result.targetScene!.targets.map(target => target.targetKey);
    const adjustments = [0, -0.3, 0.2] as const;
    const observed = adjustments.map((adjustment, index) => {
      const applications = result.applications.filter(application => application.targetKey === targetKeys[index]);
      expect(applications).toHaveLength(1);
      const application = applications[0]!;
      const calculation = result.calculations.find(row => row.request.id === application.calculationId);
      expect(calculation?.request.kind).toBe('damage');
      if (!calculation || calculation.request.kind !== 'damage') throw new Error('Kaeya E damage request is absent');
      const request = calculation.request;
      expect(request.input.defenseAdjustment).toBeCloseTo(adjustment, 12);
      const defenseRead = request.scalarProvenance?.reads.find(read => read.kind === 'defense-adjustment');
      expect(defenseRead).toBeDefined();
      expect(defenseRead?.targetKey).toBe(application.targetKey);
      expect(defenseRead?.base).toBeCloseTo(adjustment, 12);
      expect(defenseRead?.output).toBeCloseTo(adjustment, 12);
      expect(request.input.enemyLevel).toBe(90);
      expect(request.input.characterLevel).toBe(90);
      expect(request.input.effectiveResistance).toBe(0.1);
      expect(request.input.defenseIgnore).toBe(0);
      expect(request.input.hitWeakPoint).toBe(false);
      expect(request.input.amped).toBe(false);
      const capture = captureSourceHostHit(result, application.id);
      const restored = sourceHostHitCaptureSchema.parse(JSON.parse(JSON.stringify(capture)));
      expect(restored.targetScene).toEqual(result.targetScene);
      const replay = replaySourceHostHit(restored);
      expect(replay.difference).toBe(0);
      const defenseNode = replay.trace.find(node => node.id === 'defenseMultiplier');
      expect(defenseNode?.result?.value).toBeCloseTo(1 / (2 + adjustment), 12);
      return { application, request, replayDifference: replay.difference, defenseNode,
        critMultiplier: request.input.isCrit ? 1 + request.input.critDamage : 1,
        normalizedRawDamage: application.rawDamage / (request.input.isCrit ? 1 + request.input.critDamage : 1) };
    });
    expect(observed[1]!.request.input.scalingValue).toBe(observed[0]!.request.input.scalingValue);
    expect(observed[2]!.request.input.scalingValue).toBe(observed[0]!.request.input.scalingValue);
    expect(observed[1]!.request.input.scaling).toBe(observed[0]!.request.input.scaling);
    expect(observed[2]!.request.input.scaling).toBe(observed[0]!.request.input.scaling);
    const reductionRatio = observed[1]!.normalizedRawDamage / observed[0]!.normalizedRawDamage;
    const increaseRatio = observed[2]!.normalizedRawDamage / observed[0]!.normalizedRawDamage;
    expect(reductionRatio).toBeCloseTo(2 / 1.7, 10);
    expect(increaseRatio).toBeCloseTo(2 / 2.2, 10);
    const summary = summarizeSourceHostTargets(result);
    expect(summary.targets).toHaveLength(3);
    expect(summary.targets.map(row => row.hitCount)).toEqual([1, 1, 1]);
    expect(summary.total.rawDamage).toBeCloseTo(observed.reduce((sum, row) => sum + row.application.rawDamage, 0), 9);
    await expect(panel.locator('[data-single-target-summary] [data-target-summary-row]')).toHaveCount(3);

    await panel.locator(`[data-single-open-hit="${observed[1]!.application.id}"]`).click();
    await expect(page.locator('#calc-source-host-capture')).toBeVisible();
    const detail = page.locator('[data-source-host-calculation-result] [data-detail-id="defenseMultiplier"]');
    await detail.locator(':scope > summary').click();
    await expect(detail.locator('.trace-substitution')).toContainText(observed[1]!.defenseNode!.substitution);
    await expect(detail.locator('.trace-substitution')).toContainText('-0.3');
    const intermediate = detail.locator('[data-trace-execution="defenseMultiplier"]');
    await intermediate.locator(':scope > summary').click();
    await expect(intermediate).toContainText('190');
    const screenshot = 'docs/validation/source-target-defense-formula-20260929.png';
    await detail.screenshot({ path: screenshot });

    await page.goto('/source-simulation');
    await page.locator('#source-host-variant').selectOption('classic');
    const builder = page.locator('#source-team-builder');
    const teamDraft: SourceTeamDraft = {
      schemaVersion: 1, source: input.source, name: '单角色实际动作观察',
      members: [input.member], actions: [{ actorId: input.member.id, kind: 'skill', repeat: 1 },
        { actorId: input.member.id, kind: 'wait', frames: 360 }],
      durationSeconds: input.durationSeconds, rotationLoop: { mode: 'once' },
      startup: input.startup, target: input.target, additionalTargets: input.additionalTargets!, primaryTargetIndex: 0,
    };
    await builder.locator('[data-import-draft]').setInputFiles({
      name: 'kaeya-defense-scene.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(teamDraft)),
    });
    await expect(builder.locator('[data-target-scene-target="1"] [data-target-profile="defenseAdjustment"]')).toHaveValue('-0.3');
    await expect(builder.locator('[data-target-scene-target="2"] [data-target-profile="defenseAdjustment"]')).toHaveValue('0.2');
    const exportedDraft = await download(page, '#source-team-builder [data-export-draft]') as SourceTeamDraft;
    expect(exportedDraft.additionalTargets).toEqual(input.additionalTargets);
    await builder.locator('[data-apply-script]').click();
    expect(await page.locator('#source-host-config').inputValue()).toBe(result.config);
    expect(pageErrors).toEqual([]);

    measurements.rawPath = rawPath;
    measurements.damageByTarget = observed.map((row, index) => ({ targetKey: targetKeys[index], defenseAdjustment: adjustments[index],
      rawDamage: row.application.rawDamage, critMultiplier: row.critMultiplier,
      normalizedRawDamage: row.normalizedRawDamage, replayDifference: row.replayDifference,
      defenseMultiplier: row.defenseNode?.result?.value }));
    measurements.normalizedRatios = { defenseMinusThirtyPercent: reductionRatio, defensePlusTwentyPercent: increaseRatio };
    measurements.totalRawDamage = summary.total.rawDamage;
    measurements.teamDraftPreserved = true;
    measurements.formulaScreenshot = screenshot;
  } finally {
    await writeFile('docs/validation/source-target-defense-browser-20260929.result.json', JSON.stringify({
      schemaVersion: 'source-target-defense-browser-v1', measurements, pageErrors,
      scope: 'One classic native Kaeya E with three colocated targets; DEF differences are compared after each real critical outcome is normalized. The team draft is compiled without a second native run.',
    }, null, 2) + '\n');
  }
});
