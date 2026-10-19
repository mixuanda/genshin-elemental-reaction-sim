import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  calculateSourceHostActionCollection, captureSourceHostActionCollection,
  sourceHostActionHasEvidence, type SourceHostActionCollection,
} from '../../../packages/sim-core/src/source-host-action-collection';
import { sourceActionReceipts } from '../../../packages/sim-core/src/source-host-action-origin';
import {
  calculateSourceHostEditableCalculation, replaySourceHostHit,
} from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';
import type { SourceSingleSkillDraft } from '../src/source-single-skill';

type RunExport = { schemaVersion: 'source-single-skill-result-v1'; input: SourceSingleSkillDraft; result: SourceHostResult };

// The single Kaeya build from the existing synthetic GOOD import scenario.
// It has no artifact stats, so the source executor must provide character and weapon bases once.
const kaeyaGood = {
  format: 'GOOD', version: 3, source: 'synthetic-imported-team-library-e2e; not a real account',
  characters: [{ key: 'Kaeya', level: 90, ascension: 6, constellation: 0,
    talent: { auto: 8, skill: 8, burst: 8 } }],
  weapons: [{ key: 'CoolSteel', location: 'Kaeya', level: 90, ascension: 6, refinement: 1 }],
  artifacts: [],
};

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

test('single-character native skill runs from calculator and keeps its observed collection editable', async ({ page }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  const measurements: Array<Record<string, unknown>> = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    for (const lane of (['classic', 'stellar'] as const).filter(lane => !process.env.GIDPS_SINGLE_SKILL_LANE || process.env.GIDPS_SINGLE_SKILL_LANE === lane)) {
      await page.goto('/calculator');
      await page.locator('[data-action="source-single-skill"]').click();
      const panel = page.locator('#calc-source-single-skill [data-source-single-skill]');
      await expect(panel).toBeVisible();
      await expect(page.locator('#calc-artifact-utility')).toBeHidden();
      await expect(panel.locator('textarea')).toHaveCount(0);
      await panel.locator('[data-single-source]').selectOption(lane);
      await expect(panel.locator('[data-single-character] option[value="kaeya"]')).toBeAttached();
      await panel.locator('[data-single-character]').selectOption('kaeya');
      await panel.locator('[data-single-tier]').selectOption('starter');
      await expect(panel.locator('[data-single-status]')).toContainText('参考构筑');
      await expect(panel.locator('[data-single-weapon]')).toBeVisible();
      await expect(panel.locator('[data-single-weapon-field="refinement"]')).toBeVisible();
      await expect(panel.locator('[data-single-member="constellation"]')).toBeVisible();
      await expect(panel.locator('[data-single-talent="skill"]')).toBeVisible();

      if (lane === 'classic') {
        await panel.locator('[data-single-import]').setInputFiles({
          name: 'synthetic-kaeya.good.json', mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(kaeyaGood)),
        });
        await expect(panel.locator('[data-single-status]')).toContainText('配装候选');
        await expect(panel.locator('[data-single-candidate]')).toBeVisible();
        await panel.locator('[data-single-apply-candidate]').click();
        await expect(panel.locator('[data-single-status]')).toContainText('已应用配装候选');
        await expect(panel.locator('[data-single-weapon]')).toHaveValue('coolsteel');
        await expect(panel.locator('[data-single-stat]')).toHaveCount(0);
      }

      await panel.locator('[data-single-action]').selectOption('skill');
      await panel.locator('[data-single-weapon-field="refinement"]').fill('2');
      await panel.locator('[data-single-member="constellation"]').fill('1');
      await panel.locator('[data-single-talent="skill"]').fill('8');
      await panel.locator('[data-single-duration]').fill('6');
      await panel.locator('[data-single-target="level"]').fill('90');
      await panel.locator('[data-single-target="resistance"]').fill('0.1');
      await panel.locator('[data-single-seed]').fill('11');
      const input = await download(page, '#calc-source-single-skill [data-single-export-input]') as SourceSingleSkillDraft;
      expect(input.source.hostVariant).toBe(lane);
      expect(input.member.characterKey).toBe('kaeya');
      expect(input.action.kind).toBe('skill');
      expect(input.member.weapon.refinement).toBe(2);
      expect(input.member.constellation).toBe(1);
      expect(input.member.talents.skill).toBe(8);
      expect(input.durationSeconds).toBe(6);
      expect(input.target).toEqual({ level: 90, resistance: 0.1, geometry: { radius: 2, x: 0, y: 2.4 } });
      expect(input.seed).toBe('11');
      if (lane === 'classic') {
        expect(input.member.weapon.key).toBe('coolsteel');
        expect(input.member.artifactSets).toEqual([]);
        expect(input.member.artifactStats).toEqual({});
      }

      await panel.locator('[data-single-run]').click();
      await expect(panel.locator('[data-single-status]')).toContainText('运行完成', { timeout: 60_000 });
      const resultCard = panel.locator('[data-source-single-result]');
      await expect(resultCard).toBeVisible();
      await expect(resultCard.locator('[data-single-observed-hit]').first()).toContainText('kaeya · Frostgnaw');
      await expect(resultCard).toContainText('有限观察窗');
      await expect(resultCard).toContainText('完整施放状态：未证明');
      await expect(resultCard.locator('[data-single-association]')).toHaveValue('creation');
      if (lane === 'classic')
        await page.screenshot({ path: 'docs/validation/source-single-skill-browser-20260929.png', fullPage: true });
      const exported = await download(page, '#calc-source-single-skill [data-single-result-export]') as RunExport;
      const rawPath = '/tmp/gidps-single-skill-' + lane + '.json';
      await writeFile(rawPath, JSON.stringify(exported)); // Keep actual native result before numerical assertions.
      expect(exported.schemaVersion).toBe('source-single-skill-result-v1');
      expect(exported.input).toEqual(input);
      expect(exported.result.config.match(/^kaeya char /gm)).toHaveLength(1);
      expect(exported.result.config.match(/^kaeya skill;$/gm)).toHaveLength(1);
      expect(exported.result.config.match(/^wait\(\d+\);$/gm)).toHaveLength(1);
      if (lane === 'classic') expect(exported.result.config).not.toMatch(/^kaeya add stats /m);
      expect(exported.result.applications.length).toBeGreaterThan(0);

      const accepted = sourceActionReceipts(exported.result.logs).filter(row =>
        row.acceptedFrame !== undefined && row.action !== 'wait' && row.action !== 'swap');
      expect(accepted).toHaveLength(1);
      const action = accepted[0]!;
      expect(action.characterKey).toBe('kaeya');
      expect(action.action).toBe('skill');
      expect(sourceHostActionHasEvidence(exported.result, action.sequence, 'creation')).toBe(true);
      const collection = captureSourceHostActionCollection(exported.result, action.sequence, 'creation');
      const analysis = calculateSourceHostActionCollection(collection);
      expect(collection.association).toBe('creation');
      expect(analysis.completeCast).toBe(false);
      expect(collection.hits.length).toBeGreaterThan(0);
      const first = collection.hits[0]!.calculation;
      expect(replaySourceHostHit(first.originalCapture).difference).toBe(0);
      expect(resultCard.locator('[data-single-known-subtotal]')).toContainText(String(analysis.knownSubtotal));

      // A different explicit association must remain selected; the panel must not pick
      // whichever association happens to contain more observed hits.
      await resultCard.locator('[data-single-association]').selectOption('status-owner');
      await expect(resultCard.locator('[data-single-association]')).toHaveValue('status-owner');
      const ownerAnalysis = sourceHostActionHasEvidence(exported.result, action.sequence, 'status-owner')
        ? calculateSourceHostActionCollection(captureSourceHostActionCollection(exported.result, action.sequence, 'status-owner'))
        : undefined;
      const ownerText = !ownerAnalysis ? '伤害未知'
        : ownerAnalysis.knownSubtotal === undefined ? '尚无可记账'
        : String(ownerAnalysis.knownSubtotal);
      await expect(resultCard.locator('[data-single-known-subtotal]')).toContainText(ownerText);
      await resultCard.locator('[data-single-association]').selectOption('creation');
      await expect(resultCard.locator('[data-single-association]')).toHaveValue('creation');

      await resultCard.locator('[data-single-open-collection]').click();
      const collectionEditor = page.locator('[data-source-action-collection]');
      await expect(collectionEditor).toBeVisible();
      const scalingControl = collectionEditor.locator('[data-source-action-editor] [data-source-host-input="scaling"]');
      const originalScaling = Number(await scalingControl.inputValue());
      const editedFirst = structuredClone(first);
      if (editedFirst.request.kind !== 'damage') throw new Error('Kaeya E capture is not ordinary damage');
      editedFirst.request.input.scaling = originalScaling + 0.1;
      const expected = calculateSourceHostEditableCalculation(editedFirst);
      expect(expected.difference).not.toBe(0);
      await scalingControl.fill(String(originalScaling + 0.1));
      const saved = await download(page, '[data-source-action-collection] [data-source-action-export]') as SourceHostActionCollection;
      const savedFirst = saved.hits[0]?.calculation;
      expect(savedFirst?.originalCapture).toEqual(first.originalCapture);
      if (!savedFirst || savedFirst.request.kind !== 'damage') throw new Error('Edited hit changed kind');
      expect(savedFirst.request.input.scaling).toBe(originalScaling + 0.1);
      expect(calculateSourceHostActionCollection(saved).total).not.toBe(analysis.total);
      await page.locator('#calc-import').setInputFiles({
        name: 'single-skill-' + lane + '.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(saved)),
      });
      await expect(page.locator('[data-source-action-collection]')).toBeVisible();
      expect(await download(page, '[data-source-action-collection] [data-source-action-export]')).toEqual(saved);

      await page.locator('[data-action="source-single-skill"]').click();
      await expect(panel.locator('[data-source-single-result]')).toBeVisible();
      await panel.locator('[data-single-member="constellation"]').fill('2');
      await expect(panel.locator('[data-single-status]')).toContainText('输入已修改');
      await expect(panel.locator('[data-source-single-result]')).toContainText('运行输入快照');
      expect(await download(page, '#calc-source-single-skill [data-single-result-export]')).toEqual(exported);
      measurements.push({
        lane, rawPath, executionArtifact: exported.result.executionArtifact,
        sourceMember: exported.input.member.characterKey,
        importedSyntheticGood: lane === 'classic', artifactOnlyStats: exported.input.member.artifactStats,
        weapon: exported.input.member.weapon, constellation: exported.input.member.constellation,
        talentSkill: exported.input.member.talents.skill, durationSeconds: exported.input.durationSeconds,
        acceptedActionSequence: action.sequence, observedHitCount: collection.hits.length,
        selectedAssociation: collection.association, knownSubtotal: analysis.knownSubtotal ?? null,
        completeCast: analysis.completeCast, firstHitReplayDifference: 0,
        editedScaling: savedFirst.request.input.scaling,
        editedHitDifference: expected.difference, collectionRoundtrip: true,
        oldResultRetainedAfterInputChange: true,
      });
    }
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile('docs/validation/source-single-skill-browser-20260929.result.json', JSON.stringify({
      schemaVersion: 'source-single-skill-browser-v1', measurements, pageErrors,
      scope: 'One actual Kaeya skill per pinned source from the independent calculator; finite observed collection, no team script entry or complete-cast inference.',
    }, null, 2) + '\n');
  }
});
