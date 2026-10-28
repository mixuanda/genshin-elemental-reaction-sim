import { expect, test } from "@playwright/test";
import good from "../../../packages/player-import/fixtures/synthetic-good.json" with { type: "json" };
import enka from "../../../packages/player-import/fixtures/synthetic-enka.json" with { type: "json" };
import { importPlayerJson } from "../../../packages/player-import/src/normalize";
import { readFileSync } from "node:fs";

test("complete synthetic GOOD file → preview → explicit memory apply → failure preserves prior data", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await page.locator("#file-input").setInputFiles({ name: "synthetic-good.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(good)) });
  await expect(page.locator("#preview-content")).toContainText("配装源字段完整");
  await expect(page.locator("#apply")).toBeEnabled();
  await expect(page.locator("#current")).toContainText("暂无已应用数据");
  await page.locator("#apply").click();
  const prior = await page.locator("#current").textContent();
  await page.locator("#json-input").fill(JSON.stringify({ ...good, artifacts: [] }));
  await expect(page.locator("#apply")).toBeDisabled();
  await page.locator("#preview").click();
  await expect(page.locator("#preview-content")).toContainText("待确认");
  await expect(page.locator("#apply")).toBeDisabled();
  expect(await page.locator("#current").textContent()).toBe(prior);
  await page.locator("#json-input").fill('{"stoken":"SYNTHETIC_SECRET_SENTINEL"}');
  await page.locator("#preview").click();
  await expect(page.locator("#status")).toContainText("已拒绝");
  await expect(page.locator("#json-input")).toHaveValue("");
  await expect(page.locator("body")).not.toContainText("SYNTHETIC_SECRET_SENTINEL");
  expect(await page.locator("#current").textContent()).toBe(prior);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  expect(errors).toEqual([]);
});

test("Enka fixture renders 10 + 3 once and authorized prototype stays visibly synthetic", async ({ page }) => {
  await page.goto("/");
  await page.locator("#enka-demo").click();
  await expect(page.locator("#status")).toContainText("合成测试示例");
  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "skill", exact: true }) });
  await expect(row.getByRole("cell")).toHaveText(["skill", "10", "3", "13"]);
  await expect(page.locator("#apply")).toBeEnabled();
  await page.locator("#authorized-demo").click();
  await expect(page.locator("#preview-content")).toContainText("未连接米游社/HoYoLAB");
  await expect(page.locator("#normalized")).toContainText('"fixture": true');
});

test("UID UI uses public endpoint, handles mocked errors, and prevents stale responses replacing new previews", async ({ page }) => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  await page.route("**/api/player-showcase/800000001", async route => {
    await pending;
    await route.fulfill({ json: importPlayerJson(JSON.stringify(enka), { fixture: true, viaUid: true, uid: "800000001" }) });
  });
  await page.goto("/");
  await page.locator("#uid").fill("800000001");
  await page.getByRole("button", { name: "获取公开展柜" }).click();
  await expect(page.locator("#status")).toContainText("正在获取");
  await page.locator("#good-demo").click();
  await expect(page.locator("#preview-content")).toContainText("good-file");
  const completed = page.waitForResponse("**/api/player-showcase/800000001");
  finish();
  await completed;
  await expect(page.locator("#preview-content")).toContainText("good-file");
  await page.route("**/api/player-showcase/800000002", route => route.fulfill({ json: { ok: false, code: "unavailable", message: "合成限流错误；旧数据保持。" } }));
  await page.locator("#uid").fill("800000002");
  await page.getByRole("button", { name: "获取公开展柜" }).click();
  await expect(page.locator("#status")).toContainText("合成限流错误");
  await expect(page.locator("#apply")).toBeDisabled();
});

test("narrow viewport stays usable and malicious unknown identity is rendered as text", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("#json-input").fill(JSON.stringify({ ...good, characters: [{ ...good.characters[0], key: '<img src=x onerror="window.xss=true">' }] }));
  await page.locator("#preview").click();
  await expect(page.locator("#preview-content")).toContainText("unknown-id");
  await expect(page.locator("#apply")).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => Object.hasOwn(window, "xss"))).toBe(false);
});

test("synthetic multi-character text file reaches preview with explicit missing ascensions and preserves applied JSON", async ({ page }) => {
  await page.goto("/");
  await page.locator("#good-demo").click();
  await page.locator("#apply").click();
  const prior = await page.locator("#current").textContent();
  const text = readFileSync(new URL("../../../packages/player-import/fixtures/synthetic-hutao-multi.txt", import.meta.url), "utf8");
  await page.locator("#file-input").setInputFiles({ name: "synthetic-hutao-multi.txt", mimeType: "text/plain", buffer: Buffer.from(text) });
  await expect(page.locator("#status")).toContainText("预览 2 个角色");
  await expect(page.locator("#preview-content article")).toHaveCount(2);
  await expect(page.locator("#preview-content")).toContainText("神里绫华");
  await expect(page.locator("#preview-content")).toContainText("刻晴");
  await expect(page.locator("#preview-content")).toContainText("未导出角色突破");
  await expect(page.locator("#preview-content")).toContainText("文本记账语义未核验");
  await expect(page.locator("#apply")).toBeDisabled();
  expect(await page.locator("#current").textContent()).toBe(prior);
  await page.locator("#json-input").fill(text + "\n// Unsupported extra line");
  await page.locator("#preview").click();
  await expect(page.locator("#status")).toContainText("不受支持");
  expect(await page.locator("#current").textContent()).toBe(prior);
});
