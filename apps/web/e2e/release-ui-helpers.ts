import { expect, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readSimulationRecordV2, type SimulationRecordV2 } from "../src/simulation-record";

/** Follow visible native disclosure controls, never force a hidden action or mutate DOM state. */
export async function revealControl(target: Locator): Promise<Locator> {
  await target.waitFor({ state: "attached" });
  for (let depth = 0; depth < 16; depth++) {
    const handle = await target.evaluateHandle(element => {
      let parent = element.parentElement;
      // A summary's own click is the caller's action; only reveal its outer ancestors.
      if (element.tagName === "SUMMARY" && parent?.tagName === "DETAILS") parent = parent.parentElement;
      let outer: HTMLDetailsElement | null = null;
      while (parent) {
        if (parent instanceof HTMLDetailsElement && !parent.open) outer = parent;
        parent = parent.parentElement;
      }
      return outer?.querySelector(":scope > summary") ?? null;
    });
    const summary = handle.asElement();
    if (!summary) { await handle.dispose(); return target; }
    await summary.click();
    expect(await summary.evaluate(element => (element.parentElement as HTMLDetailsElement).open)).toBe(true);
    await handle.dispose();
  }
  throw new Error("Disclosure nesting exceeds the bounded UI navigation helper");
}

/** Import is read-only. This explicit user action is only for raw/input-only scenarios. */
export async function runImportedScenario(page: Page): Promise<void> {
  await expect(page.locator("#simulationProgress")).toHaveText("已只读打开文件；未重新模拟。");
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#exportRunButton")).toBeDisabled();
  expect(await page.evaluate(() => window.GenshinDpsLab.getLastResult())).toBeNull();
  await (await revealControl(page.locator("#runButton"))).click();
}

export async function downloadSimulationRecord(page: Page) {
  await revealControl(page.locator("#exportRunButton"));
  const pending = page.waitForEvent("download");
  await page.locator("#exportRunButton").click();
  const download = await pending;
  const path = await download.path();
  expect(path).not.toBeNull();
  const wire = JSON.parse(await readFile(path!, "utf8")) as SimulationRecordV2;
  const parsed = readSimulationRecordV2(wire);
  expect(wire.format).toBe("gidps-simulation-record-v2");
  expect(wire.validation).toBe(parsed.eventStepResult ? "event-steps-v1" : "historical-reference-only");
  // Numeric assertions consume the validated result. Reimport always uses untouched wire.
  return { ...wire, ...parsed.inputs, result: parsed.result, wire };
}

export async function expectReadonlyRecord(page: Page, record: Awaited<ReturnType<typeof downloadSimulationRecord>>): Promise<void> {
  await expect(page.locator("#simulationProgress")).toHaveText("已只读打开文件；未重新模拟。");
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#exportRunButton")).toBeEnabled();
  expect(await page.evaluate(() => window.GenshinDpsLab.getLastResult())).toEqual(record.result);
  const reopened = await downloadSimulationRecord(page);
  expect(reopened.wire).toStrictEqual(record.wire);
}
