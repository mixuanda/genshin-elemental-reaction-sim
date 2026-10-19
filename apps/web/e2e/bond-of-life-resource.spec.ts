import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { SimulationRecord } from "../src/simulation-record";
import { makeConfig } from "../../../packages/sim-core/src/__tests__/fixtures";

async function waitForSimulation(page: Page): Promise<void> {
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
}
async function downloadRecord(page: Page): Promise<SimulationRecord> {
  const pending = page.waitForEvent("download");
  await page.locator("#exportRunButton").click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as SimulationRecord;
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });
test("Team Bond of Life controls produce the actual absorbed-heal ledger and restore its JSON inputs", async ({ page }) => {
  const config = makeConfig({
    dataVersion: "synthetic-bond-of-life-ui-v1",
    meta: { name: "合成机制验证：显式生命之契资源", version: "synthetic-bond-of-life-ui-v1", verificationStatus: "provisional", note: "合成面板与空白动作；初始生命之契和治疗由正常队伍控件填写，不认证人物治疗覆写。" },
    duration: 1, cycleLength: 1,
    enemy: { level: 90, resistance: 0.1, defReduction: 0, targets: [{ id: "enemy-0", name: "合成目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "health", actorId: "a", name: "合成生命动作", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0 }],
      commands: [{ type: "skill", actorId: "a", abilityId: "health", atFrame: 0 }] },
  });
  await page.goto("/results");
  await page.locator("#importInput").setInputFiles({ name: "bond-of-life.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  await page.locator('.product-nav a[href="/team"]').click();
  await expect(page.locator("#team-bond-enabled")).not.toBeChecked();
  await page.locator("#team-health-enabled").check();
  await page.locator("#team-health-example").click();
  await page.locator("#team-bond-enabled").check();
  await expect(page.locator("[data-bond-of-life-controls]")).toContainText("TODO");
  await expect(page.locator("[data-bond-of-life-controls]")).toContainText("fixed-source-assumed");
  const actor = page.locator('[data-health-actor="a"]');
  await actor.locator(":scope > summary").click();
  await actor.locator("[data-health-initial]").fill("0.5");
  await actor.locator("[data-bond-initial]").fill("0.2");
  await page.getByText("逐行动治疗、生命消耗与生命之契", { exact: true }).click();
  const action = page.locator('[data-health-action="0"]');
  await action.locator('[data-health-add="heal"]').click();
  const heal = action.locator("[data-health-change]");
  await heal.locator("[data-hp-label]").fill("3000治疗先抵2000生命之契");
  await heal.locator("[data-hp-frame]").fill("1");
  await heal.locator("[data-hp-amount]").fill("3000");
  await heal.locator("[data-hp-healing-bonus]").fill("0");
  await heal.locator("[data-hp-incoming-bonus]").fill("0");
  await page.locator("#team-apply").click();
  await expect(page.locator("#team-status")).toContainText("保存");
  const saved = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(saved.bondOfLifeModel).toEqual({ mode: "gcsim-b4ae769-same-heal-remainder-v1", characters: [{ actorId: "a", initialRatio: 0.2 }] });
  await page.locator('.product-nav a[href="/results"]').click();
  await page.getByRole("button", { name: "运行模拟", exact: true }).click();
  await waitForSimulation(page);
  const record = await downloadRecord(page);
  expect(record.sourceConfig).toEqual(saved);
  expect(record.result.playerHealthEvents).toHaveLength(1);
  expect(record.result.playerHealthEvents![0]).toMatchObject({ frame: 1, operation: "heal", hpBefore: 5000, hpAfter: 6000, requestedAmount: 3000, actualChange: 1000, overheal: 0,
    bondOfLife: { debtBefore: 2000, debtAfter: 0, absorbedHealing: 2000, healingAfterDebt: 1000 } });
  await page.getByRole("button", { name: "时间轴", exact: true }).click();
  const row = page.locator('#actionStateAudit [data-player-health-event="0"]');
  await expect(row.locator("td").nth(3)).toHaveText("5,000 → 6,000");
  await row.locator('[data-player-health-detail="0"] > summary').click();
  await expect(row).toContainText("治疗抵债 2,000，抵债后可用治疗 1,000");
  await expect(page.locator('#actionStateAudit [data-player-health-summary="a"] td').nth(4)).toHaveText("2,000 → 0");

  await page.locator("#importInput").setInputFiles({ name: "bond-of-life-complete-record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(record)) });
  await waitForSimulation(page);
  const restored = await downloadRecord(page);
  expect(restored.sourceConfig).toEqual(saved);
  expect(restored.result.playerHealthEvents).toEqual(record.result.playerHealthEvents);
  expect(restored.result.playerHpSummaries).toEqual(record.result.playerHpSummaries);
  await page.locator('.product-nav a[href="/team"]').click();
  await expect(page.locator("#team-bond-enabled")).toBeChecked();
  await expect(actor.locator("[data-bond-initial]")).toHaveValue("0.2");
  await expect(page.locator('[data-health-action="0"] [data-hp-amount]')).toHaveValue("3000");
});
