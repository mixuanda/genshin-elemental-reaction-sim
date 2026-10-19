import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { CalculatorDocument, CalculatorResult } from '@genshin-dps-lab/sim-core';

const audit = async (page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> =>
  JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
async function roundtrip(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  const downloading = page.waitForEvent('download');
  await page.locator('[data-action="export"]').click();
  const text = await readFile((await (await downloading).path())!, 'utf8');
  await page.reload();
  await page.locator('#calc-import').setInputFiles({ name: 'observed-edited.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect.poll(async () => (await audit(page)).document.id).toBe((JSON.parse(text) as CalculatorDocument).id);
  return audit(page);
}

test('structured observed events and per-hit plunge snapshots edit and restore through the calculator', async ({ page }) => {
  const measurements: Record<string, unknown> = { provenance: 'Explicit teaching observations, not in-game measurements' };
  const pageErrors: string[] = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  try {
    await page.goto('/calculator');
    const input = await readFile('docs/validation/nefer-observed-input-20260928.json', 'utf8');
    await page.locator('#calc-import').setInputFiles({ name: 'nefer.json', mimeType: 'application/json', buffer: Buffer.from(input) });
    const original = await audit(page);
    expect(original.result.status).toBe('calculated');
    const editor = page.locator('[data-observed-event-editor="nefer"]');
    await expect(editor).toBeVisible();
    const rowCount = await editor.locator('[data-observed-event-row]').count();
    await editor.locator('[data-observed-row-add]').click();
    expect(await editor.locator('[data-observed-event-row]').count()).toBe(rowCount + 1);
    await expect(page.locator('#calc-results')).toContainText('尚未应用');
    await editor.locator('[data-observed-row-remove]').last().click();
    const contact = editor.locator('[data-observed-row-field="contactConfirmed"]').last();
    await contact.selectOption('false');
    await page.locator('[data-action="nefer-observed-apply"]').click();
    expect((await audit(page)).result.status).toBe('blocked');
    await contact.selectOption('true');
    await page.locator('[data-action="nefer-observed-apply"]').click();
    expect((await audit(page)).result.totals).toEqual(original.result.totals);
    const eventRestored = await roundtrip(page);
    expect(eventRestored.result.totals).toEqual(original.result.totals);
    measurements.events = { rowCount, contactBlocked: true, originalExpected: original.result.totals!.expected,
      restoredExpected: eventRestored.result.totals!.expected, difference: eventRestored.result.totals!.expected - original.result.totals!.expected };

    await page.locator('#calc-character').selectOption('character:10000129');
    const skill = await page.locator('#calc-skill option').filter({ hasText: '低空下落（逐次观察碰撞与落地）' }).getAttribute('value');
    expect(skill).toBeTruthy();
    await page.locator('#calc-skill').selectOption(skill!);
    await page.locator('#calc-scope').selectOption('one-cast');
    const context = 'gameContext.observedPlunge';
    const state = (key: string) => page.locator(`[data-source-cast-state-field="${context}.${key}"]`);
    await state('noExternalInfusion').selectOption('1');
    await page.locator(`[data-field="${context}.collisionCount"]`).fill('1');
    await page.locator(`[data-field="${context}.collisionCount"]`).press('Tab');
    await state('collisionContacts.1').selectOption('1');
    await state('landingContact').selectOption('1');
    await state('statsStableAcrossHits').selectOption('0');
    await state('targetConditionsStableAcrossHits').selectOption('1');
    expect((await audit(page)).result.status).toBe('blocked');
    const rows = page.locator('[data-observed-plunge-snapshot-row]');
    await expect(rows).toHaveCount(2);
    for (let index = 0; index < 2; index++) {
      const values: Record<string, string> = { 'stats.atk': String(1000 + index * 1000), 'stats.hp': '10000', 'stats.def': '700', 'stats.em': '0',
        'stats.critRate': '0', 'stats.critDamage': '0.5', characterLevel: '90', ascension: '6', damageBonus: '0', additiveBaseDamage: '0', reactionBonus: '0',
        source: `Synthetic observed snapshot ${index + 1}; no game measurement`, sourceRefs: `fixture:plunge-history-${index + 1}` };
      for (const [key, value] of Object.entries(values)) await rows.nth(index).locator(`[data-observed-plunge-snapshot-key="${key}"]`).fill(value);
    }
    await expect(page.locator('#calc-results')).toContainText('请应用或放弃');
    await page.locator('[data-action="observed-plunge-snapshot-apply"]').click();
    const snapshots = await audit(page);
    expect(snapshots.result.status, snapshots.result.blockers.join('; ')).toBe('calculated');
    expect(snapshots.document.gameContext!.scopeCoverage).toBe('complete-cast');
    expect(snapshots.document.hits.map(hit => hit.kind === 'ordinary' ? hit.finalSnapshot!.stats.atk : null)).toEqual([1000, 2000]);
    expect(snapshots.result.trace.some(node => node.id.includes('snapshot.atk'))).toBe(true);
    const attack = rows.first().locator('[data-observed-plunge-snapshot-key="stats.atk"]');
    await attack.fill('');
    await expect(page.locator('#calc-results')).toContainText('请应用或放弃');
    await attack.fill('1100');
    await page.locator('[data-action="observed-plunge-snapshot-apply"]').click();
    const edited = await audit(page);
    expect(edited.result.totals!.expected).toBeGreaterThan(snapshots.result.totals!.expected);
    const restored = await roundtrip(page);
    expect(restored.document.hits).toEqual(edited.document.hits);
    expect(restored.result.totals).toEqual(edited.result.totals);
    measurements.plunge = { hitIds: edited.document.selectedHitIds, originalExpected: snapshots.result.totals!.expected,
      editedExpected: edited.result.totals!.expected, restoredExpected: restored.result.totals!.expected,
      difference: restored.result.totals!.expected - edited.result.totals!.expected, missingSnapshotBlocked: true, emptyDraftHidesOldResult: true };
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile('docs/validation/observed-input-editors-20260929.result.json', JSON.stringify({ ...measurements, pageErrors }, null, 2) + '\n');
  }
});
