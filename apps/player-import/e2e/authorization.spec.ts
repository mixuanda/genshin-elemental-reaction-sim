import { expect, test } from "@playwright/test";

test("account import states the exact unavailable route without account traffic or storage", async ({ page }, testInfo) => {
  const externalRequests: string[] = [], errors: string[] = [];
  page.on("request", request => { if (new URL(request.url()).origin !== "http://127.0.0.1:5184") externalRequests.push(new URL(request.url()).origin); });
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://**", route => route.abort());
  await page.goto("/");
  await expect(page.locator("[data-authorization-availability]")).toHaveText("真实登录暂不可用");
  await expect(page.locator("[data-official-community]")).toHaveAttribute("href", "https://www.miyoushe.com/ys/");
  await expect(page.locator("[data-official-community]")).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.locator("[data-official-community]")).toHaveAttribute("referrerpolicy", "no-referrer");
  await page.locator("[data-check-equipment-access]").click();
  await expect(page.locator("[data-authorization-status]")).toContainText("当前不能登录或读取真实账号");
  await page.locator("[data-equipment-provider]").selectOption("hoyolab");
  await expect(page.locator("[data-official-community]")).toHaveAttribute("href", "https://www.hoyolab.com/");
  await page.locator("[data-check-equipment-access]").click();
  await expect(page.locator("[data-authorization-status]")).toContainText("尚未配置获授权的账号读取宿主");
  await page.getByText("读取范围、断开含义与当前缺口", { exact: true }).click();
  await expect(page.locator("[data-authorization-scope]")).toContainText("当前装备");
  await expect(page.locator("[data-authorization-exclusions]")).toContainText("未装备背包物品");
  await expect(page.locator("[data-authorization-gaps]")).toContainText("官方明确允许第三方接入");
  await page.locator("[data-clear-equipment-access]").click();
  await expect(page.locator("[data-authorization-status]")).toContainText("没有执行官方账号登出或撤权");
  await expect(page.locator("[data-authorization-availability]")).toHaveText("真实登录暂不可用");
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("account-import-unavailable.png"), fullPage: true });
});

test("checking or clearing account state preserves an explicitly applied local import", async ({ page }) => {
  await page.goto("/");
  await page.locator("#good-demo").click();
  await page.locator("#apply").click();
  const applied = await page.locator("#current").textContent();
  await page.locator("[data-check-equipment-access]").click();
  await expect(page.locator("[data-authorization-status]")).toContainText("当前不能登录");
  await page.locator("[data-clear-equipment-access]").click();
  await expect(page.locator("#current")).toHaveText(applied!);
  await page.getByText("查看合成授权适配器演示", { exact: true }).click();
  await page.locator("#authorized-demo").click();
  await expect(page.locator("#preview-content")).toContainText("未连接米游社/HoYoLAB");
  await expect(page.locator("#normalized")).toContainText('"fixture": true');
  await expect(page.locator("[data-authorization-availability]")).toHaveText("真实登录暂不可用");
});
