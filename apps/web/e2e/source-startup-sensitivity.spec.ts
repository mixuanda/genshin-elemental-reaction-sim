import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import type { SourceHostStartupRun, SourceHostStartupSummary } from "../src/source-host-startup-analysis";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT,
  type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";

// The saved script starts halfway to Q. Each native override must replace that
// parameter before character initialization, while the exported config stays exact.
const config = `options iteration=1 duration=5;
noelle char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=30];
noelle add weapon="favoniusgreatsword" refine=1 lvl=90/90;
noelle add stats def=200 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active noelle;
noelle burst;
noelle attack;
wait(240);`;

type StartupExport = {
  schemaVersion: "source-host-startup-v1";
  observationPolicy: { warmupFrames: number; windowFrames: number };
  runs: SourceHostStartupRun[];
};
type SourceLog = { event?: string; msg?: string; logs?: { action?: string; reason?: string; pre_drain?: number; post_drain?: number } };

function actualWindowDamage(result: SourceHostResult, windowIndex: number, policy: StartupExport["observationPolicy"]): number {
  const start = 1 + policy.warmupFrames + windowIndex * policy.windowFrames;
  const end = start + policy.windowFrames;
  return result.applications.filter(row => row.frame >= start && row.frame < end)
    .reduce((sum, row) => sum + row.appliedDamage, 0);
}

test("native zero/full/custom startup energy preserves exact runs, paired windows, and complete replay", async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  let workerStarts = 0;
  page.on("pageerror", error => errors.push(error.message));
  page.on("worker", () => { workerStarts++; });
  const exported: Partial<Record<"classic" | "stellar", StartupExport>> = {};

  for (const variant of ["stellar", "classic"] as const) {
    await page.goto("/source-simulation");
    await page.locator("#source-host-variant").selectOption(variant);
    await page.locator("#source-host-config").fill(config);
    await page.locator("#source-startup-seeds").fill("1,2");
    await page.locator("#source-startup-warmup").fill("0");
    await page.locator("#source-startup-window").fill("2");
    if (variant === "classic") {
      await page.locator("#source-startup-include-custom").check();
      await page.locator("#source-startup-custom").fill("noelle=1000");
    }
    await page.locator("#source-startup-run").click();
    await expect(page.locator("#source-startup-status")).toContainText("分析完成", { timeout: 100000 });
    const expectedRuns = variant === "classic" ? 6 : 4;
    await expect(page.locator("[data-source-startup-summary]")).toContainText(`${expectedRuns}次实际运行`);

    const download = page.waitForEvent("download");
    await page.locator("#source-startup-export").click();
    const raw = await readFile((await (await download).path())!, "utf8");
    // Preserve each full native receipt before any later UI assertion can fail.
    await writeFile(`docs/validation/source-startup-sensitivity-${variant}-20260928.intermediate.json`, raw);
    const artifact = JSON.parse(raw) as StartupExport;
    exported[variant] = artifact;
    expect(artifact.schemaVersion).toBe("source-host-startup-v1");
    expect(artifact.observationPolicy).toEqual({ warmupFrames: 0, windowFrames: 120 });
    expect(artifact.runs).toHaveLength(expectedRuns);
    const expectedCommit = variant === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT;
    for (const run of artifact.runs) {
      expect(run.baseConfig).toBe(config);
      expect(run.request.config).toBe(config);
      expect(run.result.config).toBe(config);
      expect(run.result.seed).toBe(run.request.seed);
      expect(run.result.sourceCommit).toBe(expectedCommit);
      expect(run.result.initialEnergy?.mode).toBe(run.scenario);
      expect(run.result.startupState?.mode).toBe(run.scenario);
      expect(run.result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
      const actor = run.result.startupState?.actors.find(row => row.actorKey === "noelle");
      expect(actor).toBeDefined();
      expect(actor!.maxEnergy).toBeGreaterThan(0);
      if (run.scenario === "zero") {
        expect(actor!.requestedEnergy).toBe(0);
        expect(actor!.energy).toBe(0);
      } else if (run.scenario === "full") {
        expect(actor!.requestedEnergy).toBeNull();
        expect(actor!.energy).toBe(actor!.maxEnergy);
      } else {
        expect(variant).toBe("classic");
        expect(actor!.requestedEnergy).toBe(1000);
        expect(actor!.maxEnergy).toBeLessThan(1000);
        expect(actor!.energy).toBe(actor!.maxEnergy);
      }
      const logs = Array.isArray(run.result.logs) ? run.result.logs as SourceLog[] : [];
      if (run.scenario === "zero") {
        expect(logs.some(row => row.msg === "source-host action rejected" && row.logs?.action === "burst" && row.logs.reason === "insufficient_energy")).toBe(true);
      } else if (run.scenario === "full") {
        expect(logs.some(row => row.event === "action" && row.msg === "executed burst")).toBe(true);
        expect(logs.some(row => row.event === "energy" && row.msg === "draining energy" &&
          typeof row.logs?.pre_drain === "number" && typeof row.logs?.post_drain === "number" && row.logs.pre_drain > row.logs.post_drain)).toBe(true);
        expect(run.result.applications.length).toBeGreaterThan(0);
      }
    }
    expect(artifact.runs.filter(run => run.scenario === "zero").map(run => run.result.seed).sort()).toEqual(["1", "2"]);
    expect(artifact.runs.filter(run => run.scenario === "full").map(run => run.result.seed).sort()).toEqual(["1", "2"]);
    if (variant === "classic") expect(artifact.runs.filter(run => run.scenario === "custom").map(run => run.result.seed).sort()).toEqual(["1", "2"]);

    const summaryText = await page.locator("#source-startup-result details").last().locator("pre").textContent();
    const summary = JSON.parse(summaryText!) as SourceHostStartupSummary;
    for (const windowIndex of [0, 1] as const) {
      const contrast = summary.pairedContrasts.find(row => row.id === "full-minus-zero" && row.windowIndex === windowIndex);
      expect(contrast?.pairedSamples).toHaveLength(2);
      for (const seed of ["1", "2"]) {
        const zero = artifact.runs.find(run => run.scenario === "zero" && run.result.seed === seed)!.result;
        const full = artifact.runs.find(run => run.scenario === "full" && run.result.seed === seed)!.result;
        const zeroDamage = actualWindowDamage(zero, windowIndex, artifact.observationPolicy);
        const fullDamage = actualWindowDamage(full, windowIndex, artifact.observationPolicy);
        const sample = contrast!.pairedSamples.find(row => row.seed === seed)!;
        expect(sample.damage).toBe(fullDamage - zeroDamage);
        expect(sample.dps).toBe(fullDamage * 60 / 120 - zeroDamage * 60 / 120);
      }
    }

    const workersBeforeImport = workerStarts;
    await page.locator("#source-startup-import").setInputFiles({
      name: `source-startup-${variant}.json`, mimeType: "application/json", buffer: Buffer.from(raw),
    });
    await expect(page.locator("#source-startup-status")).toContainText("分析完成");
    await page.locator("#source-startup-warmup").fill("0.5");
    await page.locator("#source-startup-window").fill("1.5");
    await page.locator("#source-startup-reanalyze").click();
    await expect(page.locator("#source-startup-status")).toContainText("没有再次运行来源");
    expect(workerStarts).toBe(workersBeforeImport);
  }

  const classic = exported.classic!;
  const fullIndex = classic.runs.findIndex(run => run.scenario === "full" && run.result.seed === "1");
  expect(fullIndex).toBeGreaterThanOrEqual(0);
  const fullResult = classic.runs[fullIndex]!.result;
  await page.locator(`[data-source-startup-open="${fullIndex}"]`).click();
  await expect(page.locator("[data-source-host-startup-state]")).toContainText("满能");
  await page.locator("#source-host-reexecute").click();
  await expect(page.locator("#source-host-reexecution-status")).toContainText("从头复跑核对通过", { timeout: 60000 });
  const reexecutionDownload = page.waitForEvent("download");
  await page.locator("#source-host-export-reexecution").click();
  const reexecution = JSON.parse(await readFile((await (await reexecutionDownload).path())!, "utf8")) as {
    schemaVersion: string; receipt: { sourceCommit: string }; result: SourceHostResult;
  };
  expect(reexecution.schemaVersion).toBe("source-host-reexecution-record-v1");
  expect(reexecution.receipt.sourceCommit).toBe(SOURCE_HOST_COMMIT);
  expect(reexecution.result.initialEnergy).toEqual({ mode: "full" });
  expect(reexecution.result.startupState).toEqual(fullResult.startupState);

  expect(fullResult.applications.length).toBeGreaterThan(0);
  await page.locator("#source-host-hit-index").fill("0");
  await expect(page.locator("#source-host-hit")).toContainText("差值 0");
  await page.locator("#source-host-open-calculator").click();
  await expect(page).toHaveURL(/\/calculator$/);
  await expect(page.locator("[data-source-host-calculation-result] h3")).toContainText("捕获时");
  const captureDownload = page.waitForEvent("download");
  await page.locator("[data-source-host-export]").click();
  const calculation = JSON.parse(await readFile((await (await captureDownload).path())!, "utf8")) as {
    originalCapture: { initialEnergy?: unknown; startupState?: unknown; application: { id: number } };
  };
  expect(calculation.originalCapture.initialEnergy).toEqual({ mode: "full" });
  expect(calculation.originalCapture.startupState).toEqual(fullResult.startupState);
  expect(calculation.originalCapture.application.id).toBe(fullResult.applications[0]!.id);
  expect(errors).toEqual([]);

  await writeFile("docs/validation/source-startup-sensitivity-20260928.result.json", `${JSON.stringify({
    schemaVersion: "source-startup-sensitivity-validation-v1", config,
    stellar: exported.stellar, classic, reexecution, standaloneCapture: calculation.originalCapture,
  }, null, 2)}\n`);
  console.log(JSON.stringify({ runs: { stellar: exported.stellar!.runs.length, classic: classic.runs.length },
    fullApplications: fullResult.applications.length, sourceCommit: fullResult.sourceCommit,
    wasmSha256: fullResult.executionArtifact?.wasmSha256, reexecution: reexecution.receipt.sourceCommit, workers: workerStarts, errors }));
});
