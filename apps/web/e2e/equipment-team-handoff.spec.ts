import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CapturedSimulationHit } from "@genshin-dps-lab/sim-core";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import { makeConfig } from "../../../packages/sim-core/src/__tests__/fixtures";
import type { SimulationRecord } from "../src/simulation-record";

async function downloadJson<T>(page: Page, selector: string): Promise<T> {
  const pending = page.waitForEvent("download");
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}

function localNoelleScenario(): SimConfig {
  const config = makeConfig({
    duration: 3, cycleLength: 3, randomSeed: "equipment-local-team-page",
    meta: { name: "显式本地队伍：诺艾尔两次普通命中", version: "1", verificationStatus: "user-supplied",
      note: "仅用已声明的合成普通命中验证配装与真实武器回调；不推定未声明的角色技能。" },
  });
  config.characters = [{ ...config.characters[0]!, id: "noelle", name: "诺艾尔", element: "geo" }];
  config.timeline = { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "noelle", swapFrames: 1,
    abilities: [{ id: "declared-normal", actorId: "noelle", name: "显式普通攻击", kind: "normal", cancelFrame: 1,
      animationEndFrame: 1, cooldownFrames: 0,
      hits: [{ id: "normal", frame: 0, scaling: 1, element: "geo", attackTag: "normal", snapshot: "hit" }] }],
    commands: [{ type: "normal", actorId: "noelle", abilityId: "declared-normal", atFrame: 1 },
      { type: "normal", actorId: "noelle", abilityId: "declared-normal", atFrame: 31 }],
  };
  return config;
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });
test("an editable Whiteblind build becomes an actual local-team weapon callback and replays its next hit", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const scenario = localNoelleScenario();
  const imported = { format: "simulation-record-v1", sourceConfig: scenario,
    options: { energyMode: "configured", critMode: "average", compatibilityMode: "legal-frame-v1", randomSeed: "equipment-local-team-page",
      execution: { captureHits: true, detailedTraces: false } },
    iterations: 1, executionProfile: null, benchmark: null };
  await page.goto("/results");
  await page.locator("#importInput").setInputFiles({ name: "equipment-local-team.record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(imported)) });
  await page.locator('.product-nav a[href="/builds"]').click();
  await page.locator("#build-character").selectOption("character:10000034");
  await page.locator('[data-equipment="weapon"]').selectOption("weapon:12407");
  await page.locator('[data-equipment="refinement"]').selectOption("1");
  await page.locator('[data-equipment="effectsDisabled"]').check();
  await page.locator("#build-local-team-actor").selectOption("noelle");
  await page.locator("#build-apply-local-team").click();
  await expect(page).toHaveURL(/\/team$/);
  const handoff = page.locator("#team-equipment-handoff");
  await expect(handoff).toContainText("真实命中与读取时的武器叠层");
  const enabled = await handoff.locator("ul").first().locator("li").allTextContents();
  const unmapped = await handoff.locator("ul").nth(1).locator("li").allTextContents();
  const teamConfig = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(teamConfig.timeline).toEqual(scenario.timeline);
  expect(teamConfig.characters[0]!.id).toBe("noelle");
  expect(teamConfig.characters[0]!.stats.baseAtk).not.toBe(scenario.characters[0]!.stats.baseAtk);
  expect(teamConfig.weaponHitStackModel).toEqual({ mode: "fixed-source-no-character-hitlag-v1", baselineUnbuffed: true,
    actors: [{ actorId: "noelle", weaponId: "weapon:12407", refinement: 1 }] });

  await page.locator('.product-nav a[href="/results"]').click();
  await page.locator("#runButton").click();
  await expect(page.locator("#exportRunButton")).toBeEnabled();
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  const record = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  expect(record.sourceConfig).toEqual(teamConfig);
  const callbacks = record.result.weaponHitStackLog ?? [];
  expect(callbacks.some(row => row.actor.actorId === "noelle" && row.outcome === "stack-gained" && row.frame === 1)).toBe(true);
  const hits = record.result.damageEvents.filter(event => event.sourceActorId === "noelle" && event.hitId === "normal");
  expect(hits.map(event => event.frame)).toEqual([1, 31]);
  expect(hits[1]!.finalDamage).toBeGreaterThan(hits[0]!.finalDamage);

  await page.getByRole("button", { name: "逐段伤害", exact: true }).click();
  await page.locator(`#hitTableBody tr[data-hit-id="${hits[1]!.id}"]`).click();
  await expect(page.locator("#sharedHitTrace")).toContainText("差值 0");
  await page.locator("#openHitCalculator").click();
  await expect(page).toHaveURL(/\/calculator$/);
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  const hitCapture = await downloadJson<CapturedSimulationHit>(page, '[data-action="export"]');
  expect(hitCapture.eventId).toBe(hits[1]!.id);
  expect(hitCapture.sourceResult).toEqual(record.result);
  const calculatorAudit = JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
  const fullPrecision = await page.locator('#calc-results [data-detail-id="targetDamagePolicy"] > .trace-detail-content > p.calculator-hint').textContent();
  const reproducedDamage = Number(fullPrecision!.match(/完整精度 ([^；]+)/)![1]);
  const originalDamage = calculatorAudit.event.finalDamage as number;
  const delta = reproducedDamage - originalDamage;
  expect(originalDamage).toBe(hits[1]!.finalDamage);
  expect(Math.abs(delta)).toBeLessThanOrEqual(1e-8);
  await writeFile("docs/validation/equipment-team-handoff-20260928.result.json", JSON.stringify({
    handoff: { enabled, unmapped }, teamConfig, record, hitCapture,
    independentCalculator: { originalDamage, reproducedDamage, delta, audit: calculatorAudit },
  }, null, 2) + "\n");
  expect(pageErrors).toEqual([]);
});
