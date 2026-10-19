import { expect, test } from '@playwright/test';

test('clear a starter action sequence and build an E/Q/normal-attack order with the action buttons', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/source-simulation');
  const builder = page.locator('#source-team-builder');
  await expect(builder.locator('[data-template] option[value="vaporize-hydro-pyro"]')).toHaveCount(1);
  await builder.locator('[data-template]').selectOption('vaporize-hydro-pyro');
  await builder.locator('[data-template-load="vaporize-hydro-pyro"]').click();
  const actions = builder.locator('.source-team-builder__actions > li');
  expect(await actions.count()).toBeGreaterThan(0);
  await expect(builder.locator('[data-clear-actions]')).toBeEnabled();
  await builder.locator('[data-clear-actions]').click();
  await expect(actions).toHaveCount(0);
  await expect(builder.locator('[data-clear-actions]')).toBeDisabled();

  for (const kind of ['skill', 'burst', 'attack']) await builder.locator(`[data-quick-action="${kind}"]`).click();
  await expect(actions).toHaveCount(3);
  const order = await actions.locator('[data-action-kind]').evaluateAll(selects => selects.map(select => (select as HTMLSelectElement).value));
  expect(order).toEqual(['skill', 'burst', 'attack']);
  expect(pageErrors).toEqual([]);
});
