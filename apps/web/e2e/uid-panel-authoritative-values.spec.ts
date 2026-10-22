import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

test('mocked UID uses authoritative level through Kaeya E13 and blocks missing level or talent evidence', async ({ page }) => {
  const evidence = process.env.GIDPS_IMPORT_EVIDENCE ?? 'test-results/uid-import';
  const raw = JSON.parse(await readFile(new URL('./fixtures/player-import/kaeya-enka-panel.json', import.meta.url), 'utf8'));
  raw.avatarInfoList[0].propMap['4001'] = { val: '90', ival: '1' };
  let missingLevel = false;
  let missingBonus = false;
  await page.route('**/api/showcase/900000003', route => {
    const data = structuredClone(raw);
    if (missingLevel) delete data.avatarInfoList[0].propMap['4001'].val;
    if (missingBonus) delete data.avatarInfoList[0].proudSkillExtraLevelMap;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      data, cache: 'hit', fetchedAt: '2026-10-22T00:00:00.000Z'
    }) });
  });
  await page.goto('/calculator');
  await page.locator('#calc-showcase-uid').fill('900000003');
  await page.locator('[data-action="showcase"]').click();
  const choice = page.locator('[data-showcase-index="0"]');
  await expect(choice).toContainText('Lv.90');
  await choice.click();
  await expect(page.locator('#calc-skill')).toBeEnabled();
  const frost = page.locator('#calc-skill option').filter({ hasText: '霜袭·命中' });
  await page.locator('#calc-skill').selectOption((await frost.getAttribute('value'))!);
  await expect(page.getByTestId('calc-expected')).toBeVisible();
  const actual = JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
  expect(actual.document.characterLevel).toBe(90);
  expect(actual.document.gameContext.effectiveTalentLevel).toBe(13);
  expect(actual.document.gameContext.constellation).toBe(3);
  expect(actual.document.build.mode).toBe('imported-final');
  expect(actual.document.build.stats.atk).toBe(1700);
  expect(actual.document.build).not.toHaveProperty('equipment');
  expect(actual.result.status).toBe('calculated');
  const expected = 1700 * 4.063 * 1.616 * 0.5 * 0.9 * (1 + 0.4 * 1);
  expect(actual.result.totals.expected).toBeCloseTo(expected, 6);
  await mkdir(evidence, { recursive: true });
  await writeFile(`${evidence}/uid-panel.json`, JSON.stringify({ fixture: 'synthetic Kaeya C3; mocked UID; no account request', levelProperty: raw.avatarInfoList[0].propMap['4001'], expected, actual }, null, 2));
  await page.locator('#calc-results').screenshot({ path: `${evidence}/uid-panel.png` });

  // The parser baseline proved that this same input previously supplied Lv1.
  // Its progression guard blocks Lv1 with ascension6; keep that guard observable.
  await page.locator('[data-field="characterLevel"]').fill('1');
  await page.locator('[data-field="characterLevel"]').blur();
  await expect(page.locator('[data-testid="calc-game-identity"]')).toContainText('角色 Lv.1');
  const oldLevelReplay = JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
  expect(oldLevelReplay.document.characterLevel).toBe(1);
  expect(oldLevelReplay.result.status).toBe('blocked');
  expect(oldLevelReplay.result.blockers.join('；')).toContain('低于突破 6 的最低等级');
  // A stale but valid Lv80 passes progression and changes actual defense damage.
  await page.locator('[data-field="characterLevel"]').fill('80');
  await page.locator('[data-field="characterLevel"]').blur();
  await expect(page.locator('[data-testid="calc-game-identity"]')).toContainText('角色 Lv.80');
  const oldValidLevelReplay = JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
  expect(oldValidLevelReplay.result.status).toBe('calculated');
  const oldExpected = expected * (180 / (180 + 190)) / 0.5;
  expect(oldValidLevelReplay.result.totals.expected).toBeCloseTo(oldExpected, 6);
  await writeFile(`${evidence}/uid-level-impact.json`, JSON.stringify({
    fixture: 'synthetic Kaeya C3; old parser Lv1 and valid stale Lv80 replays by explicit calculator input',
    oldLevelBlocked: oldLevelReplay, before: oldValidLevelReplay, after: actual,
    independent: { oldDefenseMultiplier: 180 / 370, newDefenseMultiplier: 0.5, oldExpected, newExpected: expected }
  }, null, 2));

  missingLevel = true;
  await page.locator('[data-action="showcase"]').click();
  await expect(choice).toContainText('Lv.未知');
  await choice.click();
  await expect(page.locator('#calc-results')).toContainText('角色等级');
  await expect(page.getByTestId('calc-expected')).toHaveCount(0);
  await writeFile(`${evidence}/uid-missing-val.txt`, await page.locator('#calc-results').innerText());

  missingLevel = false; missingBonus = true;
  await page.locator('[data-action="showcase"]').click();
  await expect(choice).toContainText('Lv.90');
  await choice.click();
  await expect(page.locator('#calc-results')).toContainText('额外天赋等级');
  await expect(page.getByTestId('calc-expected')).toHaveCount(0);
  await writeFile(`${evidence}/uid-missing-bonus.txt`, await page.locator('#calc-results').innerText());
});
