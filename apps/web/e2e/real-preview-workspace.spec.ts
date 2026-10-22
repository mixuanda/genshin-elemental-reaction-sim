import { expect, test } from "@playwright/test";

test("real observed preview stays separate from the released calculator and cannot invent executable skills", async ({ page }) => {
  await page.goto("/calculator");
  await expect(page.locator("#calc-character")).toBeVisible();
  const characters = page.locator("#calc-character option");
  const released = await characters.evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
  await page.locator("[data-calculator-catalog-settings] > summary").click();
  await page.locator("#calc-workspace").selectOption("preview");
  await expect(page.locator("#calc-workspace-status")).toContainText("隔离预览");
  await expect(page.locator("#calc-workspace-status")).toContainText("7.1.50");
  await expect(characters).toHaveCount(3);
  expect(await characters.evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(["", "character:10000136", "character:10000137"]);
  await page.locator("#calc-character").selectOption("character:10000136");
  await expect(page.locator("#calc-character option:checked")).toContainText("米提亚");
  await expect(page.locator("#calc-character-status")).toContainText("尚未核实");
  await expect(page.getByTestId("calc-expected")).toHaveCount(0);
  await expect(page.locator('[data-action="load-example"]')).toBeDisabled();
  await page.locator("#calc-workspace").selectOption("released");
  await expect(page.locator("#calc-workspace-status")).toContainText("已发布目录");
  await expect(characters).toHaveCount(released.length);
  expect(await characters.evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(released);
  await page.locator("[data-calculator-example-tools] > summary").click();
  await page.locator("#calc-example-select").selectOption("fixture-a");
  await page.locator('[data-action="load-example"]').click();
  await expect(page.getByTestId("calc-expected")).toBeVisible();
});
