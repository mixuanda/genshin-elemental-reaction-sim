import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { sourceActionReceipts } from "../src/source-action-receipts";
import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";

test("来源严格停止保留失败账本，自动等待提供真实动作实例与输入窗口", async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/source-simulation");
  const builder = page.locator("#source-team-builder");
  await builder.locator("[data-add-character]").selectOption("noelle");
  await builder.locator('[data-normal-combo="2"]').click();
  await builder.locator('[data-draft-field="durationSeconds"]').fill("4");
  await builder.locator('[data-draft-field="durationSeconds"]').press("Tab");
  await builder.locator("[data-apply-script]").click();
  const normalConfig = await page.locator("#source-host-config").inputValue();
  const status = page.locator("#source-host-status");
  await page.locator("#source-host-execution-mode").selectOption("strict");
  await page.locator("#source-host-run").click();
  await expect(status).toContainText("strict player not ready", { timeout: 45000 });
  const animationFailure = await status.textContent();
  await expect(builder.locator('[data-source-action-sequence="1"]')).toContainText("下一输入窗口");
  await expect(builder.locator('[data-source-action-sequence="2"]')).toContainText("未记录到施放");
  await expect(page.locator("#source-host-result")).toContainText("本次运行已中止");
  await expect(page.locator("#source-host-export")).toBeDisabled();

  await page.locator("#source-host-execution-mode").selectOption("auto-wait");
  await page.locator("#source-host-run").click();
  await expect(status).toContainText("本次运行完成", { timeout: 45000 });
  let download = page.waitForEvent("download");
  await page.locator("#source-host-export").click();
  const automatic = JSON.parse(await readFile((await (await download).path())!, "utf8")) as SourceHostResult;
  expect(automatic.executionMode).toBe("auto-wait");
  const actions = sourceActionReceipts(automatic.logs);
  expect(actions).toHaveLength(2);
  expect(actions.every(action => action.acceptedFrame !== undefined && action.inputWindowFrame !== undefined)).toBe(true);
  expect(actions[1]!.acceptedFrame!).toBeGreaterThan(actions[1]!.queuedFrame);
  expect(actions[0]!.inputWindowFrame).toBe(actions[1]!.queuedFrame);
  await expect(builder.locator('[data-source-action-sequence="2"]')).toContainText(`${actions[1]!.acceptedFrame! - actions[1]!.queuedFrame} 帧`);
  await expect(builder.locator("[data-source-team-logs]")).toContainText("动画内部排队门槛");
  await writeFile("docs/validation/source-action-timing-auto-20260928.result.json", JSON.stringify(automatic, null, 2));

  // A second distinct ReadyCheck branch retains the actual resource failure.
  await builder.locator("[data-startup]").selectOption("zero");
  await builder.locator('[data-action-kind="0"]').selectOption("burst");
  await builder.locator('[data-action-repeat-field="0"]').fill("1");
  await builder.locator('[data-action-repeat-field="0"]').press("Tab");
  await builder.locator("[data-apply-script]").click();
  await page.locator("#source-host-execution-mode").selectOption("strict");
  await page.locator("#source-host-run").click();
  await expect(status).toContainText("strict action not ready", { timeout: 45000 });
  await expect(builder.locator("[data-source-team-logs]")).toContainText("能量不足");
  const energyFailure = await status.textContent();

  // Explicit waits make the input legal under the other source's strict policy.
  await page.locator("#source-host-variant").selectOption("stellar");
  await expect(builder.locator("[data-add-character]")).toBeVisible();
  await page.locator("#source-host-config").fill(normalConfig.replace(/^# Source:.*$/m, "# Explicit timing scenario for selected source").replace("noelle attack:2;", "noelle attack;\nwait(120);\nnoelle attack;"));
  await page.locator("#source-host-run").click();
  await expect(status).toContainText("本次运行完成", { timeout: 45000 });
  download = page.waitForEvent("download");
  await page.locator("#source-host-export").click();
  const strict = JSON.parse(await readFile((await (await download).path())!, "utf8")) as SourceHostResult;
  expect(strict.executionMode).toBe("strict");
  expect(strict.sourceCommit).toMatch(/^a7dc4bf/);
  expect(sourceActionReceipts(strict.logs).filter(action => action.acceptedFrame !== undefined)).toHaveLength(2);
  await writeFile("docs/validation/source-action-timing-strict-20260928.result.json", JSON.stringify(strict, null, 2));
  await page.locator("#source-host-open-calculator").click();
  await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
  await writeFile("docs/validation/source-action-timing-failures-20260928.json", JSON.stringify({ animationFailure, energyFailure, pageErrors: errors }, null, 2));
  expect(errors).toEqual([]);
});
