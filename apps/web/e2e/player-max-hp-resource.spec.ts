import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { SimulationRecord } from "../src/simulation-record";
import { makeConfig } from "../../../packages/sim-core/src/__tests__/fixtures";

async function settled(page: Page): Promise<void> {
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
}
async function save(page: Page): Promise<SimulationRecord> {
  const download = page.waitForEvent("download");
  await page.locator("#exportRunButton").click();
  return JSON.parse(await readFile((await (await download).path())!, "utf8")) as SimulationRecord;
}
test.use({ trace: { mode: "retain-on-failure", snapshots: false } });
test("normal dynamic max-HP control preserves ratio through buff expiry and restores the live ledger", async ({ page }) => {
  const config = makeConfig({ duration: 1, cycleLength: 1,
    meta: { name: "合成动态最大生命流程", version: "synthetic-player-max-hp-ui-v1", verificationStatus: "provisional" },
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "合成目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "hp", actorId: "a", name: "明确生命增益与治疗", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        buffs: [{ key: "max-hp", target: "self", stat: "hpPct", value: 1, startFrame: 0, durationFrames: 20 }] }],
      commands: [{ type: "skill", actorId: "a", abilityId: "hp", atFrame: 0 }] },
  });
  await page.goto("/results");
  await page.locator("#importInput").setInputFiles({ name: "dynamic-max-hp.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await settled(page);
  await page.locator('.product-nav a[href="/team"]').click();
  await page.locator("#team-health-enabled").check();
  await page.locator("#team-health-example").click();
  await page.locator("#team-max-hp-enabled").check();
  await expect(page.locator("[data-player-max-hp-controls]")).toContainText("fixed-source-assumed");
  await page.locator('[data-health-actor="a"] > summary').click();
  await page.locator('[data-health-actor="a"] [data-health-initial]').fill("0.5");
  await page.getByText("逐行动治疗、生命消耗与生命之契", { exact: true }).click();
  await page.locator('[data-health-action="0"] [data-health-add="heal"]').click();
  const heal = page.locator('[data-health-action="0"] [data-health-change]');
  await heal.locator("[data-hp-label]").fill("增益期间治疗2000");
  await heal.locator("[data-hp-frame]").fill("10");
  await heal.locator("[data-hp-amount]").fill("2000");
  await heal.locator("[data-hp-healing-bonus]").fill("0");
  await heal.locator("[data-hp-incoming-bonus]").fill("0");
  await page.locator("#team-apply").click();
  await expect(page.locator("#team-status")).toContainText("保存");
  await page.locator('.product-nav a[href="/results"]').click();
  await page.getByRole("button", { name: "运行模拟", exact: true }).click();
  await settled(page);
  const record = await save(page);
  expect(record.sourceConfig.playerMaxHpModel).toEqual({ mode: "gcsim-b4ae769-ratio-preserving-v1" });
  expect(record.result.playerMaxHpEvents!.map(event => [event.frame, event.maxHpAfter, event.hpAfter])).toEqual([[0, 20000, 10000], [20, 10000, 6000]]);
  expect(record.result.playerHpSummaries[0]).toMatchObject({ initialHp: 5000, finalHp: 6000, maxHp: 10000, finalMaxHp: 10000, totalHealing: 2000, totalMaxHpAdjustment: -1000 });
  await page.getByRole("button", { name: "时间轴", exact: true }).click();
  const expiry = page.locator('#actionStateAudit [data-player-max-hp-event="1"]');
  await expect(expiry.locator("td").nth(3)).toHaveText("12,000 → 6,000");
  await expiry.locator("summary").click();
  await expect(expiry).toContainText("保留生命比例 0.6");
  await expect(expiry).toContainText("不是治疗、生命消耗或伤害");
  await page.locator("#importInput").setInputFiles({ name: "dynamic-max-hp.saved.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(record)) });
  await settled(page);
  const restored = await save(page);
  expect(restored.result.playerMaxHpEvents).toEqual(record.result.playerMaxHpEvents);
  expect(restored.result.playerHealthEvents).toEqual(record.result.playerHealthEvents);
  expect(restored.result.playerHpSummaries).toEqual(record.result.playerHpSummaries);
  await page.locator('.product-nav a[href="/team"]').click();
  await expect(page.locator("#team-max-hp-enabled")).toBeChecked();
});
