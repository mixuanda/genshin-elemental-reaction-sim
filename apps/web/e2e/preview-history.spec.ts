import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const oldSnapshot = "snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc";
const newSnapshot = "snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217";
const selectionPath = resolve("packages/game-data/manifests/runtime/current.ts");

interface PreviewChange {
  path: string;
  kind: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
  numericDelta?: number;
}
interface PreviewComparison {
  from: { metadata: { snapshotId: string; gameVersion: string; contentSha256: string }; sources: unknown[] };
  to: { metadata: { snapshotId: string; gameVersion: string; contentSha256: string }; sources: unknown[] };
  changes: PreviewChange[];
}

test("historical preview comparison and calculator snapshot selection stay isolated", async ({ page }) => {
  test.setTimeout(120000);
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const pointerBefore = await readFile(selectionPath, "utf8");
  const pointerSha256 = createHash("sha256").update(pointerBefore).digest("hex");

  await page.goto("/updates");
  const loadChoice = page.locator("[data-preview-load-choice]");
  await expect(loadChoice.locator(`option[value="${oldSnapshot}"]`)).toHaveCount(1);
  await expect(loadChoice.locator(`option[value="${newSnapshot}"]`)).toHaveCount(1);
  await loadChoice.selectOption(oldSnapshot);
  await page.locator("[data-open-preview]").click();
  await expect(page.locator("[data-preview-metadata]")).toContainText(oldSnapshot);
  await expect(page.locator("[data-preview-metadata]")).toContainText("7.1.50");
  await expect(page.locator("[data-preview-content]")).toContainText("当前通道：隔离预览");
  await expect(page.locator("[data-preview-content]")).toContainText(oldSnapshot);
  await expect(page.locator("[data-preview-content] a[href*='/calculator?workspace=preview']"))
    .toHaveAttribute("href", `/calculator?workspace=preview&snapshot=${oldSnapshot}`);

  await page.locator("[data-preview-compare-from]").selectOption(oldSnapshot);
  await page.locator("[data-preview-compare-to]").selectOption(newSnapshot);
  await page.locator("[data-compare-previews]").click();
  const comparisonPanel = page.locator("[data-preview-comparison]");
  await expect(comparisonPanel).toContainText(oldSnapshot);
  await expect(comparisonPanel).toContainText(newSnapshot);
  await expect(comparisonPanel.locator("[data-export-preview-comparison]")).toBeVisible();
  const pending = page.waitForEvent("download");
  await comparisonPanel.locator("[data-export-preview-comparison]").click();
  const comparisonRaw = await readFile((await (await pending).path())!, "utf8");
  await writeFile(resolve("docs/validation/preview-history-comparison-20260928.result.json"), comparisonRaw);
  const comparison = JSON.parse(comparisonRaw) as PreviewComparison;
  expect(comparison.from.metadata.snapshotId).toBe(oldSnapshot);
  expect(comparison.to.metadata.snapshotId).toBe(newSnapshot);
  expect(comparison.from.metadata.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(comparison.to.metadata.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(comparison.from.metadata.contentSha256).not.toBe(comparison.to.metadata.contentSha256);
  expect(comparison.changes.length).toBeGreaterThan(0);
  expect(comparison.changes.some(change => change.path.includes("sourceCombatMetadata") && change.kind === "added")).toBe(true);
  await expect(comparisonPanel).toContainText(`发现 ${comparison.changes.length} 个字段变化`);
  const numericChanges = comparison.changes.filter(change => change.numericDelta !== undefined);
  for (const change of numericChanges) {
    expect(change.kind).toBe("changed");
    expect(typeof change.before).toBe("number");
    expect(typeof change.after).toBe("number");
    expect(change.numericDelta).toBe((change.after as number) - (change.before as number));
  }
  // The compare panel displays at most 200 rows, while its exported JSON
  // must retain the entire field-level diff.
  await expect(comparisonPanel.locator("tbody tr")).toHaveCount(Math.min(200, comparison.changes.length));
  await expect(page.locator("[data-preview-metadata]")).toContainText(oldSnapshot);
  await expect(page.locator("[data-preview-content]")).toContainText(oldSnapshot);

  await page.goto(`/calculator?workspace=preview&snapshot=${oldSnapshot}`);
  const workspace = page.locator("#calc-workspace");
  const selectedSnapshot = page.locator("#calc-preview-snapshot");
  await expect(workspace).toHaveValue("preview");
  await expect(page.locator("#calc-preview-snapshot-control")).toBeVisible();
  await expect(selectedSnapshot).toHaveValue(oldSnapshot);
  await expect(page.locator("#calc-workspace-status")).toContainText(oldSnapshot);
  await page.locator("#calc-character").selectOption("character:10000136");
  await expect(page.locator("#calc-character-status")).toContainText("尚未核实");
  await expect(page.getByTestId("calc-expected")).toHaveCount(0);
  await expect(page.locator("#calc-results .value")).toHaveCount(0);

  await selectedSnapshot.selectOption(newSnapshot);
  await expect(selectedSnapshot).toHaveValue(newSnapshot);
  await expect(page.locator("#calc-workspace-status")).toContainText(newSnapshot);
  await expect(page).toHaveURL(new RegExp(`snapshot=${newSnapshot}$`));
  await selectedSnapshot.selectOption(oldSnapshot);
  await expect(selectedSnapshot).toHaveValue(oldSnapshot);
  await expect(page.locator("#calc-workspace-status")).toContainText(oldSnapshot);
  await expect(page).toHaveURL(new RegExp(`snapshot=${oldSnapshot}$`));
  await page.reload();
  await expect(workspace).toHaveValue("preview");
  await expect(selectedSnapshot).toHaveValue(oldSnapshot);
  await expect(page.locator("#calc-workspace-status")).toContainText(oldSnapshot);

  const previewCharacters = await page.locator("#calc-character option").evaluateAll(options =>
    options.map(option => (option as HTMLOptionElement).value));
  await workspace.selectOption("released");
  await expect(workspace).toHaveValue("released");
  await expect(page.locator("#calc-preview-snapshot-control")).toBeHidden();
  await expect(page.locator("#calc-workspace-status")).toContainText("已发布目录");
  await expect(page).not.toHaveURL(/workspace=preview|snapshot=/);
  const releasedCharacters = await page.locator("#calc-character option").evaluateAll(options =>
    options.map(option => (option as HTMLOptionElement).value));
  expect(previewCharacters).toEqual(["", "character:10000136", "character:10000137"]);
  expect(releasedCharacters.length).toBeGreaterThan(previewCharacters.length);
  expect(releasedCharacters).not.toEqual(previewCharacters);

  const pointerAfter = await readFile(selectionPath, "utf8");
  expect(pointerAfter).toBe(pointerBefore);
  expect(pageErrors).toEqual([]);
  const report = {
    schemaVersion: "preview-history-validation-v1",
    snapshots: { from: comparison.from.metadata, to: comparison.to.metadata },
    comparison: {
      totalChanges: comparison.changes.length,
      displayedChanges: Math.min(200, comparison.changes.length),
      numericChangeCount: numericChanges.length,
      numericChanges,
      keyChanges: comparison.changes.filter(change => change.path.includes("sourceCombatMetadata")).slice(0, 20),
      fullExport: "docs/validation/preview-history-comparison-20260928.result.json",
    },
    calculator: { deepLinkedSnapshot: oldSnapshot, switchedTo: newSnapshot, switchedBack: oldSnapshot,
      reloadedSnapshot: oldSnapshot, previewCharacters, releasedCharacterCount: releasedCharacters.length,
      previewDamageDisplayed: false },
    pointers: { sourceFile: "packages/game-data/manifests/runtime/current.ts", beforeSha256: pointerSha256,
      afterSha256: createHash("sha256").update(pointerAfter).digest("hex"), unchanged: true },
    pageErrors,
  };
  await writeFile(resolve("docs/validation/preview-history-20260928.result.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
});
