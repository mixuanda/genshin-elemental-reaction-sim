import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { ObservedSkillCompositionDocument, ObservedSkillCompositionResult } from "../../../packages/sim-core/src/observed-skill-composition";

const audit = async (page: Page): Promise<{ document: ObservedSkillCompositionDocument; result: ObservedSkillCompositionResult }> =>
  JSON.parse((await page.locator('[data-composition-audit] pre').textContent())!);

test('observed compositions keep independent editable hits, honest scope, misses and complete JSON context', async ({ page }) => {
  const pageErrors: string[] = [], scenes: Array<Record<string, unknown>> = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    await page.goto('/calculator');
    await page.locator('[data-action="observed-composition"]').click();
    for (const [index, coverage, stat] of [[0, 'complete-cast', 'def'], [1, 'complete-observed-window', 'atk']] as const) {
      await page.locator(`[data-composition-example="${index}"]`).click();
      const original = await audit(page);
      expect(original.result.blockers).toEqual([]);
      expect(original.result.coverage).toBe(coverage);
      expect(original.result.totals?.expected).toBeGreaterThan(0);
      await expect(page.locator('[data-composition-sum-trace] [data-trace-node="total.expected"]')).toBeVisible();
      const miss = original.result.components.find(row => row.status === 'non-damaging')!;
      await page.locator(`[data-composition-component="${miss.id}"] > summary`).click();
      await expect(page.locator(`[data-composition-component="${miss.id}"] [data-trace-node="miss"]`)).toBeVisible();
      const first = original.result.components.find(row => row.status === 'calculated')!;
      await page.locator(`[data-composition-component="${first.id}"] > summary`).click();
      await page.locator(`[data-composition-edit="${first.id}"]`).click();
      const input = page.locator(`[data-field="build.stats.${stat}"]`);
      const value = Number(await input.inputValue());
      await input.fill(String(value + 100));
      await input.blur();
      const bound = JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
      expect(bound.result.status).toBe('calculated');
      // The observed-state trace must be visible, not merely retained in audit JSON.
      await expect(page.locator(`#calc-results [data-trace-node^="${index === 0 ? 'linneaObserved.' : 'sandroneObserved.'}"]`).first()).toBeVisible();
      await page.locator('[data-action="composition-save-component"]').click();
      const edited = await audit(page);
      expect(edited.result.coverage).toBe(coverage);
      expect(edited.result.totals?.expected).toBeGreaterThan(original.result.totals!.expected);
      expect(edited.document.components.slice(1)).toEqual(original.document.components.slice(1));
      const downloading = page.waitForEvent('download');
      await page.locator('[data-composition-export]').click();
      const saved = await readFile((await (await downloading).path())!, 'utf8');
      await page.locator('#calc-import').setInputFiles({ name: 'composition.json', mimeType: 'application/json', buffer: Buffer.from(saved) });
      const restored = await audit(page);
      expect(restored.document).toEqual(edited.document);
      expect(restored.result.totals).toEqual(edited.result.totals);
      const json = page.locator('[data-composition-json]');
      await json.locator('..').locator('summary').click();
      const missing = structuredClone(restored.document);
      missing.components.splice(0, 1);
      await json.fill(JSON.stringify(missing));
      await expect(page.locator('[data-composition-result]')).toContainText('尚未应用');
      await expect(page.locator('[data-composition-export]')).toBeDisabled();
      await page.locator('[data-composition-apply]').click();
      const partial = await audit(page);
      expect(partial.result.coverage).toBe('partial');
      expect(partial.result.status).toBe('blocked');
      expect(partial.result.totals).toBeUndefined();
      expect(partial.result.aggregation.knownSubtotal?.expected).toBeGreaterThan(0);
      await page.locator('[data-composition-attach]').setInputFiles({ name: 'child.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(restored.document.components[0]!.document)) });
      const reattached = await audit(page);
      expect(reattached.result.totals).toEqual(restored.result.totals);
      scenes.push({ profile: original.document.profile, coverage, originalExpected: original.result.totals!.expected,
        editedExpected: edited.result.totals!.expected, exportedRestoredExpected: restored.result.totals!.expected,
        absoluteRoundtripDifference: Math.abs(restored.result.totals!.expected - edited.result.totals!.expected),
        missingComponentStatus: partial.result.status, missingComponentKnownSubtotal: partial.result.aggregation.knownSubtotal,
        reattachedExpected: reattached.result.totals!.expected, missTraceVisible: true, observedTraceVisible: true,
        provenance: 'Catalog-source formulas with explicit editable teaching panels and observations; not in-game verification.' });
    }
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile('docs/validation/observed-composition-browser-20260928.result.json', JSON.stringify({ scenes, pageErrors }, null, 2) + '\n');
  }
});
