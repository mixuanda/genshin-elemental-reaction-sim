import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";

let script: string, styles: string;
test.beforeAll(async () => {
  const built = await build({ configFile: false, publicDir: false, logLevel: "silent", build: { write: false, emptyOutDir: false, lib: { entry: fileURLToPath(new URL("../src/source-host-energy-panel.ts", import.meta.url)), name: "SourceEnergyWindowPanel", formats: ["iife"] } } });
  const output = Array.isArray(built) ? built[0] : built;
  if (!output || !("output" in output)) throw Error("Missing in-memory energy component build");
  const chunk = output.output.find(item => item.type === "chunk");
  if (!chunk) throw Error("Missing energy component script");
  script = chunk.code;
  styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
});

test("the actual saved team shows canonical 60-second damage windows without running a simulation", async ({ page }, testInfo) => {
  test.skip(!process.env.GIDPS_WANDERER_WINDOW_CAPTURE, "Requires the explicitly selected retained native team receipt, not a live account");
  const saved = JSON.parse(await readFile(process.env.GIDPS_WANDERER_WINDOW_CAPTURE!, "utf8")) as SourceHostResult;
  // A component-view projection of real receipts, not a new run or a portable
  // validated result. Formula details are tested separately by the energy audit.
  const native = saved.result as { duration: number; characters: Array<{ name: string; energy_status: number[]; failed_actions?: unknown }> };
  const view = { sourceCommit: saved.sourceCommit, seed: saved.seed, config: saved.config, executionArtifact: saved.executionArtifact,
    observationWindow: saved.observationWindow, startupState: saved.startupState,
    result: { duration: native.duration, characters: native.characters.map(actor => ({ name: actor.name, energy_status: actor.energy_status, failed_actions: actor.failed_actions })) },
    applications: saved.applications.map(hit => ({ id: hit.id, frame: hit.frame, appliedDamage: hit.appliedDamage })),
    logs: saved.logs, energyApplications: [] } as unknown as SourceHostResult;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.setContent('<!doctype html><html lang="zh-CN"><head><title>120秒能量分窗回执</title></head><body><main id="energy"></main></body></html>');
  await page.addStyleTag({ content: styles });
  await page.addScriptTag({ content: script });
  await page.evaluate(result => {
    (window as unknown as { SourceEnergyWindowPanel: { renderSourceHostEnergyPanel(root: HTMLElement, result: SourceHostResult): void } }).SourceEnergyWindowPanel.renderSourceHostEnergyPanel(document.querySelector<HTMLElement>("#energy")!, result);
  }, view);
  const panel = page.locator("[data-source-host-energy-analysis]");
  await expect(panel).toContainText("前半窗 14,456,773.6704 伤害、240,946.2278 DPS");
  await expect(panel).toContainText("后半窗 15,090,858.7646 伤害、251,514.3127 DPS");
  const rows = panel.locator("table").first().locator("tbody tr");
  await expect(rows).toHaveCount(8);
  await expect(rows.nth(0)).toContainText("[0, 3600)");
  await expect(rows.nth(4)).toContainText("[3600, 7200)");
  await page.screenshot({ path: testInfo.outputPath("wanderer-energy-window-1440.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth,
    overflowing: Array.from(document.querySelectorAll("main, section, p, details, .table-wrap, code")).filter(element => element.getBoundingClientRect().right > innerWidth).map(element => ({ tag: element.tagName, right: element.getBoundingClientRect().right, text: element.textContent?.slice(0, 80) })) }));
  expect(layout.content, JSON.stringify(layout)).toBeLessThanOrEqual(layout.width);
  await page.screenshot({ path: testInfo.outputPath("wanderer-energy-window-390.png"), fullPage: true });
  expect(errors).toEqual([]);
});
