import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";
import { durinMeltPreset } from "@genshin-dps-lab/game-data";

test("runs, imports, explores, and exports the compatibility preset", async ({
  page
}) => {
  await page.goto("/");

  await expect(page.locator("#metricGrid")).toContainText("41,410,555");
  await expect(page.locator("#metricGrid")).toContainText("345,088 / 秒");
  await expect(page.locator("#metricGrid")).toContainText("269");
  await expect(page.locator("#metricGrid")).toContainText("跳过行动");
  await expect(page.locator("#notice")).toContainText("provisional");

  await page.locator("#presetSelect").selectOption({ index: 1 });
  await expect(page.locator("#notice")).toContainText("空白四人队模板");

  await page.locator("#importInput").setInputFiles({
    name: "durin-compatibility-preset.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(durinMeltPreset))
  });
  await expect(page.locator("#notice")).toContainText("黑杜林融化");
  await page.getByRole("button", { name: "运行模拟" }).click();
  await expect(page.locator("#metricGrid")).toContainText("41,410,555");

  await page.getByRole("button", { name: "时间轴" }).click();
  await expect(page.locator("#timelineCanvas")).toBeVisible();
  await expect(page.locator("#damageCurveCanvas")).toBeVisible();
  await expect(page.locator("#timelineLegend")).toContainText("杜林");
  await expect(page.locator("#curveLegend")).toContainText("全队累计");

  await page.getByRole("button", { name: "逐段伤害" }).click();
  await page.locator("#hitCharacterFilter").selectOption("citlali");
  await expect(page.locator("#pageInfo")).toContainText("共 51 段");
  const hitRows = page.locator("#hitTableBody tr[data-hit-id]");
  expect(await hitRows.count()).toBeGreaterThan(0);
  await hitRows.nth(0).click();
  await expect(page.locator("#hitDetail")).toContainText("实际施放者");
  await expect(page.locator("#hitDetail")).toContainText("缩放面板");
  await expect(page.locator("#hitDetail")).toContainText("伤害归属");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
});

test("shows a field path for an invalid config", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "高级配置" }).click();
  const editor = page.locator("#jsonEditor");
  const value = await editor.inputValue();
  const config = JSON.parse(value) as Record<string, unknown>;
  config.enemy = {
    ...(config.enemy as Record<string, unknown>),
    level: 999
  };
  await editor.fill(JSON.stringify(config, null, 2));
  await page.getByRole("button", { name: "应用并运行" }).click();
  await expect(page.locator("#jsonError")).toContainText("enemy.level");
});

test("renders the legal frame action queue and traces hits to commands", async ({
  page
}) => {
  await page.goto("/");
  await page.locator("#presetSelect").selectOption({ index: 2 });

  await expect(page.locator("#notice")).toContainText("legal-frame-v1");
  await expect(page.locator("#legalTimelineCard")).toBeVisible();
  await expect(page.locator("#legalTimelineSummary")).toContainText(
    "等待模式"
  );
  await expect(page.locator("#legalTimelineBody tr")).toHaveCount(8);
  await expect(page.locator("#legalTimelineFailures")).toContainText(
    "等待冷却/充能至第 176 帧"
  );
  await expect(page.locator("#metricGrid")).toContainText("时间线指令");

  await page.getByRole("button", { name: "逐段伤害" }).click();
  await expect(page.locator("#pageInfo")).toContainText("共 5 段");
  await page.locator("#hitTableBody tr[data-hit-id]").first().click();
  await expect(page.locator("#hitDetail")).toContainText("时间线指令");
  await expect(page.locator("#hitDetail")).toContainText("合法行动帧");
});

test("imports a public UID showcase and keeps graduation data as a placeholder", async ({
  page
}) => {
  await page.route("**/api/showcase/283733593", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        fetchedAt: "2026-07-26T00:00:00.000Z",
        cache: "miss",
        data: {
          ttl: 60,
          playerInfo: {
            level: 60,
            worldLevel: 9,
            showAvatarInfoList: [{ avatarId: 10000075, level: 100 }]
          },
          avatarInfoList: [
            {
              avatarId: 10000075,
              propMap: {
                "4001": { type: 4001, ival: "100" }
              },
              talentIdList: [751, 752, 753, 754, 755, 756],
              skillLevelMap: {
                "10751": 10,
                "10752": 10,
                "10755": 10
              },
              fightPropMap: {
                "20": 0.7863,
                "22": 1.8114,
                "23": 1,
                "28": 0,
                "44": 0.466,
                "2000": 17589.7,
                "2001": 2551.7,
                "2002": 752.9
              },
              equipList: [
                {
                  itemId: 11501,
                  weapon: {
                    level: 90,
                    affixMap: { "111501": 4 }
                  },
                  flat: {
                    itemType: "ITEM_WEAPON",
                    rankLevel: 5
                  }
                },
                {
                  itemId: 98544,
                  reliquary: { level: 21 },
                  flat: {
                    itemType: "ITEM_RELIQUARY",
                    equipType: "EQUIP_BRACER",
                    rankLevel: 5,
                    setId: 15024
                  }
                }
              ]
            }
          ]
        }
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "账号展示柜" }).click();
  await page.getByRole("button", { name: "导入展示柜" }).click();
  await expect(page.locator("#showcaseStatus")).toContainText("导入成功");
  await expect(page.locator("#showcaseSummary")).toContainText("1 名角色");
  await expect(page.locator("#showcaseCharacters")).toContainText("10000075");
  await expect(page.locator("#showcaseCharacters")).toContainText("精5");
  await page
    .getByRole("button", { name: "设为毕业站位占位" })
    .click();
  await expect(page.locator("#graduationPlaceholder")).toContainText(
    "graduation-target-placeholder"
  );
  await expect(page.locator("#graduationPlaceholder")).toContainText(
    "不进入伤害模拟"
  );
});
