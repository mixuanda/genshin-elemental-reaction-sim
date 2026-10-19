import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { captureSourceHostHit, replaySourceHostHit, sourceHostHitCaptureSchema } from '../../../packages/sim-core/src/source-host-capture';
import { sourceHostTargetPhaseRequestSchema } from '../../../packages/sim-core/src/source-host-target-phase';
import { summarizeSourceHostTargets } from '../../../packages/sim-core/src/source-host-target-summary';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';
import type { SourceTargetPhaseDraft } from '../src/source-target-phase-controls';
import type { SourceSingleSkillDraft } from '../src/source-single-skill';
import type { SourceTeamDraft } from '../src/source-team-builder';

type RunExport = { schemaVersion: 'source-single-skill-result-v1'; input: SourceSingleSkillDraft; result: SourceHostResult };

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

const normal = { damage: 'normal', aura: 'normal', hitConfirm: 'normal' } as const;
function phase(id: string, startFrame: number, endFrame: number, effects: SourceTargetPhaseDraft['effects']): SourceTargetPhaseDraft {
  return { id, label: id, startFrame, endFrame, reason: '合成教学阶段；只检验来源执行门控', effects };
}

function elementalApplications(result: SourceHostResult): Array<{ target: number; element: string }> {
  const logs: unknown[] = Array.isArray(result.logs) ? result.logs : [];
  return logs.flatMap(raw => {
    if (!raw || typeof raw !== 'object') return [];
    const event = raw as { event?: unknown; msg?: unknown; logs?: unknown };
    if (event.event !== 'element' || event.msg !== 'application' || !event.logs || typeof event.logs !== 'object') return [];
    const details = event.logs as { target?: unknown; applied_ele?: unknown };
    return typeof details.target === 'number' && typeof details.applied_ele === 'string'
      ? [{ target: details.target, element: details.applied_ele }] : [];
  });
}

test('one native skill distinguishes damage, aura and hit-confirm target phases at half-open boundaries', async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const measurements: Record<string, unknown> = {};
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    const archived = JSON.parse(await readFile('docs/validation/source-target-scene-single-20260929.capture.json', 'utf8')) as RunExport;
    const input = structuredClone(archived.input);
    const baseline = { level: 90, resistance: 0.1, geometry: { radius: 2, x: 0, y: 2.4 } } as const;
    input.target = { ...baseline };
    input.additionalTargets = [
      { ...baseline, phases: [phase('immune-at-29', 29, 30, { ...normal, damage: 'immune' })] },
      { ...baseline, phases: [phase('aura-block-at-29', 29, 30, { ...normal, aura: 'blocked' })] },
      { ...baseline, phases: [phase('hit-confirm-block-at-29', 29, 30, { ...normal, hitConfirm: 'blocked' })] },
      { ...baseline, phases: [phase('immune-before-29', 0, 29, { ...normal, damage: 'immune' })] },
      { ...baseline },
    ];
    input.primaryTargetIndex = 0;
    expect(input.source.hostVariant).toBe('classic');
    expect(input.member.characterKey).toBe('kaeya');
    expect(input.action.kind).toBe('skill');
    expect(input.durationSeconds).toBe(6);
    expect(input.seed).toBe('11');

    await page.goto('/calculator');
    await page.locator('[data-action="source-single-skill"]').click();
    const panel = page.locator('#calc-source-single-skill [data-source-single-skill]');
    await expect(panel.locator('[data-single-import]')).toBeEnabled();
    await panel.locator('[data-single-import]').setInputFiles({
      name: 'kaeya-six-target-phase-input.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)),
    });
    await expect(panel.locator('[data-single-status]')).toContainText('已导入单动作输入 JSON');
    const sixth = panel.locator('[data-target-scene-target="5"]');
    await sixth.locator('[data-target-phase-action="add"]').click();
    const sixthPhase = panel.locator('[data-target-scene-target="5"] [data-target-phase-row="0"]');
    await sixthPhase.locator('[data-target-phase-field="label"]').fill('immune-after-29');
    await sixthPhase.locator('[data-target-phase-field="startFrame"]').fill('30');
    await sixthPhase.locator('[data-target-phase-field="endFrame"]').fill('60');
    await sixthPhase.locator('[data-target-phase-field="reason"]').fill('合成教学阶段；命中帧之后才开始');
    await sixthPhase.locator('[data-target-phase-field="damage"]').selectOption('immune');
    const editedInput = await download(page, '#calc-source-single-skill [data-single-export-input]') as SourceSingleSkillDraft;
    expect(editedInput.additionalTargets).toHaveLength(5);
    expect(editedInput.additionalTargets?.[4]?.phases).toEqual([
      { id: 'phase-1', label: 'immune-after-29', startFrame: 30, endFrame: 60,
        reason: '合成教学阶段；命中帧之后才开始', effects: { ...normal, damage: 'immune' } },
    ]);
    for (const target of [editedInput.target, ...(editedInput.additionalTargets ?? [])]) {
      expect(target.level).toBe(90);
      expect(target.resistance).toBe(0.1);
      expect(target.geometry).toEqual(baseline.geometry);
      expect(target.hp).toBeUndefined();
    }

    await panel.locator('[data-single-run]').click();
    await expect(panel.locator('[data-single-status]')).toContainText(/运行完成|运行停止|来源执行器错误/, { timeout: 60_000 });
    await expect(panel.locator('[data-single-status]')).toContainText('运行完成');
    const exported = await download(page, '#calc-source-single-skill [data-single-result-export]') as RunExport;
    const rawPath = '/tmp/gidps-target-phases.json';
    await writeFile(rawPath, JSON.stringify(exported)); // Complete native evidence precedes every result assertion.
    expect(exported.input).toEqual(editedInput);
    const result = exported.result;
    expect(result.config.match(/^target .*;$/gm)).toHaveLength(6);
    expect(result.targetScene?.targets).toHaveLength(6);
    expect(result.targetPhases?.policy).toBe('declared-target-phases-v1');
    expect(result.targetPhases?.phases).toHaveLength(5);
    expect(result.applications).toHaveLength(6);
    expect(result.applications.every(application => application.frame === 29)).toBe(true);
    const targets = result.targetScene!.targets;
    const applications = targets.map(target => {
      const hits = result.applications.filter(application => application.targetKey === target.targetKey);
      expect(hits).toHaveLength(1);
      const hit = hits[0]!;
      expect(result.attackObservations?.some(observation => observation.stage === 'resolved'
        && observation.targetKey === target.targetKey && observation.frame === 29)).toBe(true);
      return hit;
    });
    const declared = sourceHostTargetPhaseRequestSchema.parse({ policy: 'declared-target-phases-v1',
      phases: editedInput.additionalTargets!.flatMap((target, extraIndex) => (target.phases ?? []).map(row => ({ ...row, targetIndex: extraIndex + 1 }))) });
    expect(result.targetPhases?.phases.map(({ targetKey: _targetKey, ...row }) => row)).toEqual(declared.phases);
    for (const index of [1, 2, 3]) {
      const application = applications[index]!;
      expect(application.targetPhase?.targetIndex).toBe(index);
      expect(application.targetPhase?.frame).toBe(29);
      expect(application.applicationCalculationId).toBeDefined();
      const applicationCalculation = result.calculations.find(record => record.request.id === application.applicationCalculationId);
      expect(applicationCalculation?.request.kind).toBe('target-application');
      expect(applicationCalculation?.value).toBe(application.appliedDamage);
    }
    for (const index of [0, 4, 5]) {
      expect(applications[index]!.targetPhase).toBeUndefined();
      expect(applications[index]!.applicationCalculationId).toBeUndefined();
    }
    const skipped = applications[3]!.targetPhaseEffects;
    expect(skipped).toBeDefined();
    expect((skipped?.hitCallbacksSkipped ?? 0) + (skipped?.onEnemyHitGameplaySkipped ?? 0)
      + (skipped?.onEnemyDamageGameplaySkipped ?? 0)).toBeGreaterThan(0);
    expect(skipped?.onEnemyDamageObserversEmitted).toBeGreaterThan(0);
    expect(applications.every(application => application.rawDamage > 0)).toBe(true);
    expect(applications[1]!.appliedDamage).toBe(0);
    expect(applications[1]!.hpAfter).toBe(applications[1]!.hpBefore);
    for (const index of [0, 2, 3, 4, 5]) expect(applications[index]!.appliedDamage).toBeGreaterThan(0);
    const auraTargets = new Set(elementalApplications(result).filter(row => row.element === 'cryo').map(row => row.target));
    for (const index of [0, 1, 3, 4, 5]) expect(auraTargets.has(targets[index]!.targetKey)).toBe(true);
    expect(auraTargets.has(targets[2]!.targetKey)).toBe(false);

    const replays = applications.map(application => {
      const capture = captureSourceHostHit(result, application.id);
      const restored = sourceHostHitCaptureSchema.parse(JSON.parse(JSON.stringify(capture)));
      expect(restored.targetScene).toEqual(result.targetScene);
      expect(restored.targetPhases).toEqual(result.targetPhases);
      const replay = replaySourceHostHit(restored);
      expect(replay.difference).toBe(0);
      expect(replay.reproducedRawDamage).toBe(application.rawDamage);
      expect(replay.reproducedRawDamage - replay.originalRawDamage).toBe(0);
      if (application.targetPhase) {
        expect(replay.applicationDifference).toBe(0);
        expect(replay.reproducedApplicationDamage).toBe(application.appliedDamage);
        expect(replay.applicationTrace?.find(node => node.id === 'targetApplication.appliedDamage')?.result?.value)
          .toBe(application.appliedDamage);
      } else {
        expect(replay.applicationCalculation).toBeUndefined();
      }
      return { applicationId: application.id, rawDifference: replay.reproducedRawDamage - replay.originalRawDamage,
        appliedDifference: replay.difference,
        applicationDifference: replay.applicationDifference ?? null };
    });
    const summary = summarizeSourceHostTargets(result);
    expect(summary.targets).toHaveLength(6);
    expect(summary.total.rawDamage).toBeCloseTo(applications.reduce((sum, application) => sum + application.rawDamage, 0), 9);
    expect(summary.total.appliedDamage).toBeCloseTo(applications.reduce((sum, application) => sum + application.appliedDamage, 0), 9);
    const nativeResult = result.result as { total_damage: number; characters: Array<{ damage_events: Array<{ target: number; damage: number }> }> };
    expect(nativeResult.total_damage).toBeCloseTo(summary.total.appliedDamage, 9);
    expect(nativeResult.characters.flatMap(character => character.damage_events).find(event => event.target === targets[3]!.targetKey)?.damage)
      .toBe(applications[3]!.appliedDamage);
    expect(summary.targets[1]?.rawDamage).toBeGreaterThan(0);
    expect(summary.targets[1]?.appliedDamage).toBe(0);
    await expect(panel.locator('[data-single-target-summary] [data-target-summary-row]')).toHaveCount(6);
    const phasePanel = panel.locator('[data-single-target-phase-summary] [data-source-host-target-phase-summary]');
    await expect(phasePanel).toBeVisible();
    await expect(phasePanel.locator('section[data-target-phase-row]')).toHaveCount(5);
    await expect(phasePanel.locator('[data-target-phase-row="immune-at-29"]')).toContainText('免伤');
    await expect(phasePanel.locator('[data-target-phase-row="immune-before-29"]')).toContainText('无实际应用记录');
    await expect(phasePanel.locator('[data-target-phase-row="phase-1"]')).toContainText('无实际应用记录');

    await panel.locator(`[data-single-open-hit="${applications[1]!.id}"]`).click();
    await expect(page.locator('#calc-source-host-capture')).toBeVisible();
    await expect(page.locator('#calc-source-host-capture')).toContainText('原始公式伤害');
    await expect(page.locator('#calc-source-host-capture')).toContainText('来源记账伤害');
    const immuneDetail = page.locator('[data-source-host-calculation-result] [data-detail-id="targetApplication.appliedDamage"]');
    await immuneDetail.locator(':scope > summary').click();
    await expect(immuneDetail.locator('.trace-substitution')).toContainText('0');
    const screenshot = 'docs/validation/source-target-phases-immune-formula-20260929.png';
    await immuneDetail.screenshot({ path: screenshot });

    await page.goto('/source-simulation');
    await page.locator('#source-host-variant').selectOption('classic');
    const builder = page.locator('#source-team-builder');
    await expect(builder.locator('[data-import-draft]')).toBeAttached();
    const teamDraft: SourceTeamDraft = {
      schemaVersion: 1, source: editedInput.source, name: '单角色实际动作观察', members: [editedInput.member],
      actions: [{ actorId: editedInput.member.id, kind: 'skill', repeat: 1 },
        { actorId: editedInput.member.id, kind: 'wait', frames: 360 }],
      durationSeconds: editedInput.durationSeconds, rotationLoop: { mode: 'once' }, startup: editedInput.startup,
      target: editedInput.target, additionalTargets: editedInput.additionalTargets!, primaryTargetIndex: 0,
    };
    await builder.locator('[data-import-draft]').setInputFiles({
      name: 'kaeya-six-target-phase-team.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(teamDraft)),
    });
    const exportedDraft = await download(page, '#source-team-builder [data-export-draft]') as SourceTeamDraft;
    expect(exportedDraft.additionalTargets).toEqual(editedInput.additionalTargets);
    await builder.locator('[data-apply-script]').click();
    expect(await page.locator('#source-host-config').inputValue()).toBe(result.config);
    expect(sourceHostTargetPhaseRequestSchema.parse(JSON.parse(await page.locator('#source-host-target-phases').inputValue()))).toEqual(declared);
    expect(pageErrors).toEqual([]);

    measurements.rawPath = rawPath;
    measurements.actualFrame = applications[0]!.frame;
    measurements.byTarget = applications.map((application, index) => ({ targetIndex: index, targetKey: application.targetKey,
      phaseId: application.targetPhase?.id ?? null, rawDamage: application.rawDamage,
      appliedDamage: application.appliedDamage, hpLoss: application.hpBefore - application.hpAfter,
      auraApplied: auraTargets.has(application.targetKey), applicationCalculationId: application.applicationCalculationId ?? null,
      targetPhaseEffects: application.targetPhaseEffects ?? null }));
    measurements.total = { rawDamage: summary.total.rawDamage, appliedDamage: summary.total.appliedDamage };
    measurements.replays = replays;
    measurements.teamDraftPreserved = true;
    measurements.formulaScreenshot = screenshot;
  } finally {
    await writeFile('docs/validation/source-target-phases-browser-20260929.result.json', JSON.stringify({
      schemaVersion: 'source-target-phases-browser-v1', measurements, pageErrors,
      scope: 'One classic native Kaeya E at frame 29 against six colocated synthetic target-phase scenarios. Half-open windows, native aura logs, outgoing damage and target application remain separate receipts; team draft was compiled without a second native run.',
    }, null, 2) + '\n');
  }
});
