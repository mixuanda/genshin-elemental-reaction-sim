import { test, expect } from '@playwright/test';

test('editing the duration keeps its open settings available for the next choice', async ({ page }) => {
  await page.goto('/source-simulation');
  const duration = page.locator('[data-duration-preset]');
  await page.getByText('高级：目标、观察时间与执行设置', { exact: true }).click();
  await expect(duration).toBeVisible();
  await duration.selectOption('120');
  const startup = page.locator('[data-startup]');
  await expect(startup).toBeVisible();
  await startup.selectOption('zero');
  await expect(duration).toBeVisible();
  await expect(duration).toHaveValue('120');
  await expect(startup).toHaveValue('zero');
  await page.getByText('高级：目标、观察时间与执行设置', { exact: true }).click();
  await expect(startup).toBeHidden();
  await page.getByText('高级：循环与动作输入选项', { exact: true }).click();
  await page.locator('[data-rotation-loop]').selectOption('count');
  await expect(page.locator('[data-rotation-field="count"]')).toBeVisible();
  // A different edit must not reopen the section the user explicitly closed.
  await expect(startup).toBeHidden();
});
