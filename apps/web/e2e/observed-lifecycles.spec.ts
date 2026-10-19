import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";

const scenes = [
  { name: "nefer", key: "observedNeferLifecycle", trace: "neferObserved", event: "rush-hit", contact: "contactConfirmed" },
  { name: "linnea", key: "observedLinneaLifecycle", trace: "linneaObserved", event: "attack-contact", contact: "contactConfirmed" },
  { name: "sandrone", key: "sandroneObservedLifecycle", trace: "sandroneObserved", event: "hit", contact: "contact" },
] as const;
const audit = async (page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> =>
  JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);

test("three optional observed ledgers bind selected hits, reject missed contact and preserve the complete context through JSON", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const measurements: Array<Record<string, unknown>> = [];
  try {
    await page.goto("/calculator");
    for (const scene of scenes) {
      const source = await readFile(`docs/validation/${scene.name}-observed-input-20260928.json`, "utf8");
      await page.locator("#calc-import").setInputFiles({ name: `${scene.name}.calculator.json`, mimeType: "application/json", buffer: Buffer.from(source) });
      await page.locator(`[data-${scene.name}-observed-controls] details`).last().locator("summary").click();
      const editor = page.locator(`[data-${scene.name}-observed-json]`);
      await expect(editor).toBeVisible();
      const original = await audit(page);
      expect(original.result.status, `${scene.name}: ${original.result.blockers.join("; ")}`).toBe("calculated");
      expect(original.result.verification).toBe(original.document.dataIdentity.evidenceStatus === "synthetic" ? "synthetic" : "provisional");
      expect(original.result.trace.some(node => node.id.startsWith(scene.trace))).toBe(true);
      const originalContext = JSON.parse(await editor.inputValue());
      const edited = structuredClone(originalContext);
      const binding = edited.selectedEventId ?? edited.hitBindings?.[original.document.selectedHitIds[0]!];
      const event = edited.events.find((row: { id: string; kind: string }) => row.id === binding && row.kind === scene.event);
      expect(event).toBeTruthy();
      event[scene.contact] = false;
      await editor.fill(JSON.stringify(edited, null, 2));
      await expect(page.locator("#calc-results")).toContainText("尚未应用");
      await page.locator(`[data-action="${scene.name}-observed-apply"]`).click();
      const missed = await audit(page);
      expect(missed.result.status).toBe("blocked");
      await editor.fill(JSON.stringify(originalContext, null, 2));
      await page.locator(`[data-action="${scene.name}-observed-apply"]`).click();
      const restoredContact = await audit(page);
      expect(restoredContact.result.totals).toEqual(original.result.totals);
      const downloading = page.waitForEvent("download");
      await page.locator('[data-action="export"]').click();
      const saved = JSON.parse(await readFile((await (await downloading).path())!, "utf8"));
      await page.locator("#calc-import").setInputFiles({ name: `${scene.name}-roundtrip.json`, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(saved)) });
      const roundtrip = await audit(page);
      expect(roundtrip.document.gameContext?.[scene.key]).toEqual(restoredContact.document.gameContext?.[scene.key]);
      expect(roundtrip.result.totals).toEqual(original.result.totals);
      measurements.push({ character: scene.name, hitIds: original.document.selectedHitIds, expected: original.result.totals?.expected, restoredExpected: roundtrip.result.totals?.expected,
        absoluteDifference: Math.abs((roundtrip.result.totals?.expected ?? 0) - (original.result.totals?.expected ?? 0)),
        observedTraceNodes: original.result.trace.filter(node => node.id.startsWith(scene.trace)).length,
        noContactStatus: missed.result.status, noContactBlockers: missed.result.blockers,
        provenance: "Explicit teaching observation and panel, not an in-game measurement." });
    }
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile("docs/validation/observed-lifecycles-measurements-20260928.result.json", JSON.stringify({ scenes: measurements, pageErrors }, null, 2) + "\n");
  }
});
