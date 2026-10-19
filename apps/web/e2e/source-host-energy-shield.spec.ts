import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import type { SourceHostBatchRun } from "../src/source-host-batch";
import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";

const config = `options iteration=1 duration=6;
noelle char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=0];
noelle add weapon="favoniusgreatsword" refine=1 lvl=90/90;
noelle add stats def=200 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
hurt once interval=60 amount=12000,12000 element=physical;
active noelle;
noelle skill;
noelle burst;
wait(300);`;

for (const variant of ["classic", "stellar"] as const) test(`${variant}: two real source seeds preserve Noelle shield, Drain, energy requests and incoming standalone replay`, async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/source-simulation");
  await page.locator("#source-host-variant").selectOption(variant);
  await page.locator("#source-host-config").fill(config);
  await page.getByText("多种子与额外充能对照", { exact: true }).click();
  await page.locator("#source-batch-seeds").fill("1,2");
  await page.locator("#source-batch-actor").fill("noelle");
  await page.locator("#source-batch-er").fill(variant === "classic" ? "0,20" : "0");
  await page.locator("#source-batch-run").click();
  await expect(page.locator("#source-batch-status")).toContainText("全部运行已记录", { timeout: 90000 });
  const runCount = variant === "classic" ? 4 : 2;
  await expect(page.locator("[data-source-batch-summary]")).toContainText(`${runCount}次实际来源运行`);

  const download = page.waitForEvent("download");
  await page.locator("#source-batch-export").click();
  const batchText = await readFile((await (await download).path())!, "utf8");
  const batch = JSON.parse(batchText) as { schemaVersion: string; runs: SourceHostBatchRun[] };
  expect(batch.schemaVersion).toBe("source-host-batch-v1");
  expect(batch.runs).toHaveLength(runCount);
  expect(batch.runs.filter(run => run.addedRecharge === 0).map(run => run.result.seed).sort()).toEqual(["1", "2"]);
  await writeFile(`docs/validation/source-energy-shield-${variant}-20260928.result.json`, batchText);
  const hits = batch.runs.map(run => {
    expect(run.result.config).toBe(run.request.config);
    if (run.addedRecharge === 0) expect(run.result.config).toBe(config);
    else { expect(run.addedRecharge).toBe(0.2); expect(run.result.config).toContain("noelle add stats er=0.2;"); }
    const hit = run.result.playerApplications?.find(row => row.shieldAbsorbed > 0 && row.damageAfterShield > 0);
    expect(hit, `seed ${run.result.seed} needs a shielded player hit with Drain`).toBeDefined();
    const kinds = new Map(run.result.calculations.map(row => [row.request.id, row.request.kind]));
    expect(kinds.get(hit!.calculationId)).toBe("player-incoming");
    expect(hit!.shieldCalculationIds!.map(id => kinds.get(id))).toEqual(expect.arrayContaining(["player-shield", "player-shield-min"]));
    expect(kinds.get(hit!.drainCalculationId!)).toBe("player-drain");
    expect(hit!.rawDamage - hit!.damageAfterShield).toBe(hit!.shieldAbsorbed);
    const logs = Array.isArray(run.result.logs) ? run.result.logs as Array<{ msg?: string }> : [];
    expect(logs.some(row => row.msg === "source-host action rejected"), `seed ${run.result.seed} should record the attempted underfunded burst`).toBe(true);
    return hit!;
  });

  await page.locator('[data-source-batch-open="0"]').click();
  const opened = batch.runs[0]!.result as SourceHostResult;
  await expect(page.locator("[data-source-host-energy-analysis]")).toContainText("能量与起步诊断");
  await expect(page.locator("[data-source-host-energy-analysis] tbody").first()).toContainText("noelle");
  const hitIndex = opened.playerApplications!.findIndex(row => row.id === hits[0]!.id);
  await page.locator("#source-host-incoming-index").fill(String(hitIndex));
  await expect(page.locator("#source-host-incoming-hit")).toContainText(`护盾吸收 ${hits[0]!.shieldAbsorbed}`);
  await page.locator("#source-host-open-incoming-calculator").click();
  await expect(page).toHaveURL(/\/calculator$/);
  await expect(page.locator("[data-source-host-incoming-result] h3")).toContainText("捕获时");
  await expect(page.locator("#calc-source-host-capture")).toContainText(`原运行护盾吸收 ${hits[0]!.shieldAbsorbed}`);
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ seeds: batch.runs.map(run => run.result.seed), shieldAbsorbed: hits.map(hit => hit.shieldAbsorbed),
    drainAttempted: hits.map(hit => hit.drainAttempted), calculations: batch.runs.map(run => run.result.calculations.length),
    wasmSha256: batch.runs.map(run => run.result.executionArtifact?.wasmSha256), errors }));
});
