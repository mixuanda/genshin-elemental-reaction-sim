import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";

type SavedSourceResult = {
  sourceCommit: string;
  config: string;
  seed: string;
  executionArtifact: { wasmSha256: string; wasmBytes: number };
  logs: Array<{ msg: string }>;
  [key: string]: unknown;
};

test("来源结果从头复跑核对完整记录并拒绝日志或执行器差异", async ({ page }) => {
  test.setTimeout(180000);
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/source-simulation");
  const importResult = async (json: string) => {
    await page.locator("#source-host-import").setInputFiles({
      name: "source-host-result.json",
      mimeType: "application/json",
      buffer: Buffer.from(json),
    });
    await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果的共享数值");
  };
  const exportCurrent = async (): Promise<SavedSourceResult> => {
    const download = page.waitForEvent("download");
    await page.locator("#source-host-export").click();
    return JSON.parse(await readFile((await (await download).path())!, "utf8")) as SavedSourceResult;
  };

  const originalText = await readFile("docs/validation/source-execution-profile-20260928.result.json", "utf8");
  const original = JSON.parse(originalText) as SavedSourceResult;
  expect(original.sourceCommit).toMatch(/^b4ae769/);
  await importResult(originalText);
  await page.locator("#source-host-config").fill("this edited script is intentionally invalid");
  await page.locator("#source-host-reexecute").click();
  await expect(page.locator("#source-host-reexecution-status")).toContainText("从头复跑核对通过", { timeout: 60000 });
  const receiptDownload = page.waitForEvent("download");
  await page.locator("#source-host-export-reexecution").click();
  const receipt = JSON.parse(await readFile((await (await receiptDownload).path())!, "utf8")) as { receipt: unknown; result: SavedSourceResult };
  expect(receipt.result.config).toBe(original.config);
  expect(receipt.result.logs).toEqual(original.logs);
  expect((receipt as { schemaVersion?: string }).schemaVersion).toBe("source-host-reexecution-record-v1");
  await writeFile("docs/validation/source-complete-reexecution-20260928.result.json", JSON.stringify(receipt, null, 2));
  expect((await exportCurrent()).config).toBe(original.config);
  await importResult(JSON.stringify(receipt));
  await expect(page.locator("#source-host-reexecution-status")).toContainText("尚未在本页面完成从头复跑核对");
  await expect(page.locator("#source-host-status")).toContainText("历史核对记录不作为本次通过证明");
  await expect(page.locator("#source-host-export-reexecution")).toBeDisabled();

  const changedLogs = structuredClone(original);
  const accepted = changedLogs.logs.find(row => row.msg === "source-host action accepted");
  expect(accepted).toBeDefined();
  accepted!.msg = "source-host action accepted (edited)";
  await importResult(JSON.stringify(changedLogs));
  await page.locator("#source-host-reexecute").click();
  await expect(page.locator("#source-host-reexecution-status")).toContainText(/复跑核对未通过.*logs\[\d+\]\.msg/, { timeout: 60000 });
  await expect(page.locator("#source-host-export-reexecution")).toBeDisabled();
  const retainedAfterLogFailure = await exportCurrent();
  expect(retainedAfterLogFailure.logs.find(row => row.msg === "source-host action accepted (edited)")).toBeDefined();

  const changedArtifact = structuredClone(original);
  changedArtifact.executionArtifact.wasmSha256 = "0".repeat(64);
  expect(changedArtifact.executionArtifact.wasmSha256).not.toBe(original.executionArtifact.wasmSha256);
  await importResult(JSON.stringify(changedArtifact));
  await page.locator("#source-host-reexecute").click();
  await expect(page.locator("#source-host-reexecution-status")).toContainText("来源执行器不匹配", { timeout: 60000 });
  await expect(page.locator("#source-host-export-reexecution")).toBeDisabled();
  expect((await exportCurrent()).executionArtifact.wasmSha256).toBe("0".repeat(64));

  await page.locator("#source-host-variant").selectOption("stellar");
  const builder = page.locator("#source-team-builder");
  await builder.locator("[data-add-character]").selectOption("noelle");
  await builder.locator('[data-quick-action="attack"]').click();
  await builder.locator('[data-draft-field="durationSeconds"]').fill("4");
  await builder.locator('[data-draft-field="durationSeconds"]').press("Tab");
  await builder.locator("[data-apply-script]").click();
  await page.locator("#source-host-run").click();
  await expect(page.locator("#source-host-status")).toContainText("本次运行完成", { timeout: 60000 });
  const stellarReceiptDownload = page.waitForEvent("download");
  await page.locator("#source-host-export").click();
  const stellarText = await readFile((await (await stellarReceiptDownload).path())!, "utf8");
  const stellarResult = JSON.parse(stellarText) as SavedSourceResult;
  expect(stellarResult.sourceCommit).toMatch(/^a7dc4bf/);
  await page.locator("#source-host-reexecute").click();
  await expect(page.locator("#source-host-reexecution-status")).toContainText("从头复跑核对通过", { timeout: 60000 });
  const stellarVerificationDownload = page.waitForEvent("download");
  await page.locator("#source-host-export-reexecution").click();
  const stellarReceipt = JSON.parse(await readFile((await (await stellarVerificationDownload).path())!, "utf8")) as { receipt: { sourceCommit: string }; result: SavedSourceResult };
  expect(stellarReceipt.receipt.sourceCommit).toMatch(/^a7dc4bf/);
  expect(stellarReceipt.result.logs).toEqual(stellarResult.logs);
  await writeFile("docs/validation/source-complete-reexecution-stellar-20260928.result.json", JSON.stringify(stellarReceipt, null, 2));
  expect(pageErrors).toEqual([]);
});
