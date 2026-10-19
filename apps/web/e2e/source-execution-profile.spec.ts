import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { sourceActionReceipts } from "../src/source-action-receipts";
import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";

test("来源难度预设通过草稿导出导入并影响实际输入延迟", async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/source-simulation");
  const builder = page.locator("#source-team-builder");
  await builder.locator("[data-add-character]").selectOption("noelle");
  await builder.locator('[data-normal-combo="1"]').click();
  await builder.locator("[data-execution-profile]").selectOption("practical");
  await builder.locator("[data-execution-profile]").selectOption("custom");
  await builder.locator('[data-delay-field="attack"]').fill("12");
  await builder.locator('[data-delay-field="attack"]').press("Tab");

  const draftDownload = page.waitForEvent("download");
  await builder.locator("[data-export-draft]").click();
  const draftText = await readFile((await (await draftDownload).path())!, "utf8");
  const draft = JSON.parse(draftText) as { executionProfile: { mode: string; delays: Record<string, number> } };
  expect(draft.executionProfile.mode).toBe("custom");
  expect(draft.executionProfile.delays.attack).toBe(12);

  await builder.locator("[data-execution-profile]").selectOption("ideal");
  await builder.locator('[data-import-draft]').setInputFiles({ name: "source-team-draft.json", mimeType: "application/json", buffer: Buffer.from(draftText) });
  await expect(builder.locator("[data-execution-profile]")).toHaveValue("custom");
  await expect(builder.locator('[data-delay-field="attack"]')).toHaveValue("12");
  await builder.locator('[data-draft-field="durationSeconds"]').fill("6");
  await builder.locator('[data-draft-field="durationSeconds"]').press("Tab");
  await builder.locator("[data-apply-script]").click();
  const config = await page.locator("#source-host-config").inputValue();
  expect(config).toContain("# Execution profile: source-action-delay-v1 mode=custom");
  expect(config).toContain("options iteration=1 duration=6 swap_delay=8 attack_delay=12 charge_delay=5 skill_delay=5 burst_delay=5 jump_delay=5 dash_delay=5 aim_delay=5;");

  await page.locator("#source-host-run").click();
  await expect(page.locator("#source-host-status")).toContainText("本次运行完成", { timeout: 45000 });
  const resultDownload = page.waitForEvent("download");
  await page.locator("#source-host-export").click();
  const result = JSON.parse(await readFile((await (await resultDownload).path())!, "utf8")) as SourceHostResult;
  const attack = sourceActionReceipts(result.logs).find(receipt => receipt.action === "attack");
  expect(attack?.acceptedFrame).toBeDefined();
  expect(attack!.acceptedFrame! - attack!.queuedFrame).toBe(12);
  await expect(builder.locator("[data-source-team-logs]")).toContainText("本次配置 12 帧");
  const delay = (result.logs as Array<{ msg: string; logs: Record<string, unknown> }>).find(row => row.msg === "source-host execution delay configured");
  expect(delay?.logs.profileDelay).toBe(12);
  expect(delay?.logs.totalPreActionDelay).toBe(12);
  await writeFile("docs/validation/source-execution-profile-20260928.result.json", JSON.stringify(result, null, 2) + "\n");
  await writeFile("docs/validation/source-execution-profile-20260928.draft.json", draftText);
  expect(errors).toEqual([]);
});
