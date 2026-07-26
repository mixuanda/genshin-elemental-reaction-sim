import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";
import {
  durinMeltPreset,
  legalTimelineDemoPreset
} from "@genshin-dps-lab/game-data/presets";

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

test("rolls back a failed burst before executing the following commands", async ({
  page
}) => {
  const config = structuredClone(legalTimelineDemoPreset);
  const character = config.characters[0]!;
  config.meta = {
    ...config.meta,
    name: "运行时能量回滚 · 浏览器验收"
  };
  config.duration = 2;
  config.cycleLength = 2;
  config.characters = [{ ...character, initialEnergy: 0 }];
  config.timeline = {
    mode: "legal-frame-v1",
    fps: 60,
    legalityMode: "strict",
    initialActiveCharacterId: character.id,
    swapFrames: 12,
    abilities: [
      {
        id: "browser-burst",
        actorId: character.id,
        name: "浏览器爆发",
        kind: "burst",
        cancelFrame: 5,
        animationEndFrame: 10,
        cooldownFrames: 120,
        energyCost: 60,
        hits: [
          {
            id: "browser-burst-hit",
            frame: 1,
            scaling: 1,
            element: "pyro"
          }
        ],
        timelineState: {
          grants: [
            {
              key: "browser-burst-succeeded",
              label: "爆发成功",
              durationFrames: 60
            }
          ]
        }
      },
      {
        id: "browser-refill",
        actorId: character.id,
        name: "浏览器固定回能",
        kind: "skill",
        cancelFrame: 1,
        animationEndFrame: 1,
        cooldownFrames: 0,
        energyGains: [
          {
            target: character.id,
            frame: 0,
            amount: 60,
            source: "browser-refill",
            internalCooldown: {
              key: "browser-refill-icd",
              durationFrames: 360
            }
          }
        ]
      }
    ],
    commands: [
      {
        type: "burst",
        actorId: character.id,
        abilityId: "browser-burst"
      },
      {
        type: "skill",
        actorId: character.id,
        abilityId: "browser-refill"
      },
      {
        type: "skill",
        actorId: character.id,
        abilityId: "browser-refill"
      },
      {
        type: "burst",
        actorId: character.id,
        abilityId: "browser-burst"
      }
    ]
  };

  await page.goto("/");
  await page.locator("#importInput").setInputFiles({
    name: "runtime-energy-rollback.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(config))
  });

  await expect(page.locator("#notice")).toContainText(
    "运行时能量回滚 · 浏览器验收"
  );
  await expect(page.locator("#legalTimelineBody tr")).toHaveCount(4);
  await expect(page.locator("#legalTimelineBody tr").first()).toContainText(
    "拒绝 · INSUFFICIENT_ENERGY"
  );
  await expect(page.locator("#legalTimelineFailures")).toContainText(
    "未施放且不占用冷却或改变行动状态"
  );
  await expect(page.locator("#energyStatus")).toContainText("跳过 1");
  await page.getByRole("button", { name: "时间轴" }).click();
  await expect(page.locator("#energyAuditSummary")).toContainText(
    "1 条被内部冷却阻止"
  );
  await expect(page.locator("#energyLogBody")).toContainText("ICD 阻止");
  await expect(page.locator("#energyLogBody")).toContainText(
    "browser-refill-icd"
  );

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    return result
      ? {
          commands: result.timelineExecution?.commandResults.map(
            ({ startFrame, status, failureCode }) => ({
              startFrame,
              status,
              failureCode: failureCode ?? null
            })
          ),
          actions: result.actionLog.map(
            (entry) => entry.timelineCommandIndex
          ),
          skipped: result.skippedActions,
          fixedEnergy: result.energyLog.map(
            ({
              applied,
              blockedReason,
              internalCooldownReadyFrame
            }) => ({
              applied,
              blockedReason,
              internalCooldownReadyFrame
            })
          ),
          hits: result.damageEvents.map((event) => ({
            frame: event.frame,
            commandIndex: event.timelineCommandIndex
          }))
        }
      : null;
  });
  expect(audit).toMatchObject({
    commands: [
      {
        startFrame: 0,
        status: "rejected",
        failureCode: "INSUFFICIENT_ENERGY"
      },
      { startFrame: 0, status: "executed", failureCode: null },
      { startFrame: 1, status: "executed", failureCode: null },
      { startFrame: 2, status: "executed", failureCode: null }
    ],
    actions: [1, 2, 3],
    skipped: [
      {
        timelineCommandIndex: 0,
        energyBefore: 0,
        energyCost: 60
      }
    ],
    fixedEnergy: [
      {
        applied: true,
        blockedReason: null,
        internalCooldownReadyFrame: 360
      },
      {
        applied: false,
        blockedReason: "INTERNAL_COOLDOWN",
        internalCooldownReadyFrame: 360
      }
    ],
    hits: [{ frame: 3, commandIndex: 3 }]
  });
});

test("renders automatic Aura, ICD, reaction audits, and the enemy aura curve", async ({
  page
}) => {
  await page.goto("/");
  await page.locator("#presetSelect").selectOption({ index: 3 });

  await expect(page.locator("#notice")).toContainText("Aura / ICD 自动反应");
  await expect(page.locator("#metricGrid")).toContainText("Aura 自动判定");
  await page.getByRole("button", { name: "时间轴" }).click();
  await expect(page.locator("#auraTimelineCard")).toBeVisible();
  await expect(page.locator("#auraTimelineCanvas")).toBeVisible();
  await expect(page.locator("#auraTimelineLegend")).toContainText("火 Aura");
  await expect(page.locator("#auraTimelineBody tr")).toHaveCount(5);
  await expect(page.locator("#auraTimelineBody")).toContainText("融化");
  await expect(page.locator("#auraTimelineBody")).toContainText("阻止");

  await page.locator("#auraTimelineBody tr").nth(1).click();
  await expect(page.locator("#hitsPanel")).toHaveClass(/active/);
  await expect(page.locator("#hitDetail")).toContainText("Aura / ICD 引擎");
  await expect(page.locator("#hitDetail")).toContainText("本段消耗 Aura");
  await expect(page.locator("#hitDetail")).toContainText(
    "m3-pyro-multihit / default"
  );
});

test("renders deterministic particle travel, receive-time field state, and energy curves", async ({
  page
}) => {
  await page.goto("/");
  await page.locator("#presetSelect").selectOption({ index: 4 });

  await expect(page.locator("#notice")).toContainText("粒子 / 回能");
  await expect(page.locator("#notice")).toContainText("不是已核验游戏数据");
  await expect(page.locator("#metricGrid")).toContainText(
    "未启用 Aura 引擎"
  );
  await expect(page.locator("#energyStatus")).toContainText("充能效率 150%");
  await expect(page.locator("#energyStatus")).toContainText("固定 45.6");
  await expect(page.locator("#energyStatus")).toContainText("粒子 14.4");
  await expect(page.locator("#energyStatus")).toContainText("溢出 5.4");

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    return result
      ? {
          randomSeed: result.randomSeed,
          particles: result.particleEvents,
          energyStats: result.energyStats,
          skipped: result.skippedActions.length
        }
      : null;
  });
  expect(audit).toMatchObject({
    randomSeed: "particle-energy-demo",
    skipped: 0,
    particles: [
      {
        particleCount: 4,
        spawnFrame: 12,
        receiveFrame: 42,
        receivedWithinSimulation: true
      }
    ],
    energyStats: {
      "energy-a": {
        particleGained: 14.4,
        fixedGained: 45.6,
        wasted: 5.4,
        final: 60
      },
      "energy-b": {
        particleGained: 8,
        fixedGained: 1,
        spent: 4,
        final: 5
      }
    }
  });

  await page.getByRole("button", { name: "时间轴" }).click();
  await expect(page.locator("#energyAuditCard")).toBeVisible();
  await expect(page.locator("#energyTimelineCanvas")).toBeVisible();
  await expect(page.locator("#energyAuditSummary")).toContainText(
    "1 次产球 · 2 条角色粒子结算 · 3 条固定回能"
  );
  await expect(page.locator("#particleEventSummary")).toContainText(
    "火微粒 × 4"
  );
  await expect(page.locator("#particleEventSummary")).toContainText(
    "12f → 42f"
  );
  await expect(page.locator("#energyLogBody tr")).toHaveCount(5);
  await expect(page.locator("#energyLogBody")).toContainText("后台 · ×0.8");
  await expect(page.locator("#energyLogBody")).toContainText("前台 · ×1");
  await expect(page.locator("#energyLogBody")).toContainText("150%");
  await expect(page.locator("#energyLogBody")).toContainText("200%");
  await expect(page.locator("#energyLogBody")).toContainText("44.6 / 5.4");
});

test("renders the source-audited Durin black E hit, ICD, aura, energy, and damage curves", async ({
  page
}) => {
  await page.goto("/");
  await page.locator("#presetSelect").selectOption({ index: 5 });

  await expect(page.locator("#notice")).toContainText(
    "杜林黑 E · 部分机制审计向量"
  );
  await expect(page.locator("#notice")).toContainText("不是完整角色预设");
  await expect(page.locator("#notice")).toContainText("provisional");
  await expect(page.locator("#notice")).toContainText("partial");
  await expect(page.locator("#notice")).toContainText("4 项待实现");
  await page.locator("#notice summary").click();
  await expect(page.locator("#notice")).toContainText(
    "gcsim 杜林技能行为"
  );
  await expect(page.locator("#metricGrid")).toContainText("4,037");
  await expect(page.locator("#metricGrid")).toContainText("3");

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    return result
      ? {
          frames: result.damageEvents.map((event) => event.frame),
          damage: result.damageEvents.map((event) => event.displayDamage),
          icd: result.damageEvents.map(
            (event) => event.reactionAudit.icdAllowed
          ),
          reactions: result.damageEvents.map((event) => event.reaction),
          energy: result.energyStats.durin,
          fixedEnergy: result.energyLog.find(
            (entry) => entry.kind === "fixed"
          ),
          particleTriggers: result.particleTriggerLog.map(
            ({
              frame,
              hitId,
              triggered,
              blockedReason,
              internalCooldownKey,
              internalCooldownReadyFrame
            }) => ({
              frame,
              hitId,
              triggered,
              blockedReason,
              internalCooldownKey,
              internalCooldownReadyFrame
            })
          ),
          particle: result.particleEvents[0],
          curve: result.damageCurve.map((point) => point.cumulativeDamage),
          commands: result.timelineExecution?.commandResults.map(
            ({ startFrame, cancelFrame, animationEndFrame }) => ({
              startFrame,
              cancelFrame,
              animationEndFrame
            })
          )
        }
      : null;
  });
  expect(audit).toMatchObject({
    frames: [48, 53, 58],
    damage: [2224, 819, 995],
    icd: [true, false, false],
    reactions: ["melt", "none", "none"],
    energy: {
      fixedGained: 33,
      particleGained: 12,
      final: 45
    },
    fixedEnergy: {
      applied: true,
      blockedReason: null,
      internalCooldownKey: "durin-skill-energy-icd",
      internalCooldownDurationFrames: 360,
      internalCooldownReadyFrame: 376
    },
    particleTriggers: [
      {
        frame: 48,
        hitId: "durin-black-e-1",
        triggered: true,
        blockedReason: null,
        internalCooldownKey: "durin-particle-icd",
        internalCooldownReadyFrame: 66
      },
      {
        frame: 53,
        hitId: "durin-black-e-2",
        triggered: false,
        blockedReason: "INTERNAL_COOLDOWN",
        internalCooldownKey: "durin-particle-icd",
        internalCooldownReadyFrame: 66
      },
      {
        frame: 58,
        hitId: "durin-black-e-3",
        triggered: false,
        blockedReason: "INTERNAL_COOLDOWN",
        internalCooldownKey: "durin-particle-icd",
        internalCooldownReadyFrame: 66
      }
    ],
    particle: {
      particleCount: 4,
      spawnFrame: 48,
      receiveFrame: 148,
      triggerLogId: 0,
      triggerHitId: "durin-black-e-1"
    },
    curve: [2223.5472, 3042.2952, 4037.1048],
    commands: [
      { startFrame: 0, cancelFrame: 16, animationEndFrame: 49 },
      { startFrame: 16, cancelFrame: 57, animationEndFrame: 83 }
    ]
  });

  await page.getByRole("button", { name: "逐段伤害" }).click();
  await expect(page.locator("#pageInfo")).toContainText("共 3 段");
  await expect(page.locator("#hitTableBody tr[data-hit-id]")).toHaveCount(3);
  await page.locator("#hitTableBody tr[data-hit-id]").first().click();
  await expect(page.locator("#hitDetail")).toContainText("黑 E 第 1 段");
  await expect(page.locator("#hitDetail")).toContainText("1.30032");
  await expect(page.locator("#hitDetail")).toContainText(
    "durin-elemental-art / durin-skill"
  );

  await page.getByRole("button", { name: "总览" }).click();
  await expect(page.locator("#timelineStateAudit")).toBeVisible();
  await expect(page.locator("#timelineStateBody tr")).toHaveCount(3);
  await expect(page.locator("#timelineStateBody")).toContainText(
    "精质转变"
  );
  await expect(page.locator("#timelineStateBody")).toContainText("黑度之否");
  await expect(page.locator("#timelineStateBody")).toContainText("消耗");

  await page.getByRole("button", { name: "时间轴" }).click();
  await expect(page.locator("#damageCurveCanvas")).toBeVisible();
  await expect(page.locator("#auraTimelineCanvas")).toBeVisible();
  await expect(page.locator("#energyTimelineCanvas")).toBeVisible();
  await expect(page.locator("#auraTimelineBody tr")).toHaveCount(3);
  await expect(page.locator("#energyLogBody tr")).toHaveCount(2);
  await expect(page.locator("#energyLogBody")).toContainText(
    "durin-skill-energy-icd"
  );
  await expect(page.locator("#energyLogBody")).toContainText("至 376f");
  await expect(page.locator("#particleEventSummary")).toContainText(
    "命中确认产球"
  );
  await expect(page.locator("#particleEventSummary")).toContainText(
    "粒子 ICD 阻止"
  );
  await expect(page.locator("#particleEventSummary")).toContainText(
    "durin-particle-icd"
  );
  await expect(page.locator("#particleEventSummary")).toContainText("66f 可用");
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
  await expect(page.locator("#catalogStatus")).toContainText(
    "120 个角色"
  );
  await expect(page.locator("#catalogStatus")).toContainText(
    "762 个技能与被动"
  );
  await expect(page.locator("#catalogStatus")).toContainText(
    "数值目录与可执行机制严格分离"
  );
  await page.getByRole("button", { name: "导入展示柜" }).click();
  await expect(page.locator("#showcaseStatus")).toContainText("导入成功");
  await expect(page.locator("#showcaseStatus")).toContainText("0 项未匹配");
  await expect(page.locator("#showcaseSummary")).toContainText("1 名角色");
  await expect(page.locator("#showcaseSummary")).toContainText(
    "目录 6.7 · provisional"
  );
  await expect(page.locator("#showcaseCharacters")).toContainText("流浪者");
  await expect(page.locator("#showcaseCharacters")).toContainText("10000075");
  await expect(page.locator("#showcaseCharacters")).toContainText("风鹰剑");
  await expect(page.locator("#showcaseCharacters")).toContainText("精5");
  await expect(page.locator("#showcaseCharacters")).toContainText("行幡鸣弦");
  await expect(page.locator("#showcaseCharacters")).toContainText(
    "羽画·风姿华歌"
  );
  await expect(page.locator("#showcaseCharacters")).toContainText(
    "狂言·式乐五番"
  );
  await expect(page.locator("#showcaseCharacters")).toContainText(
    "metadata-only"
  );
  await expect(page.locator("#showcaseCharacters")).toContainText(
    "仅数据目录，不自动进入模拟"
  );
  await page
    .getByRole("button", { name: "设为毕业站位占位" })
    .click();
  await expect(page.locator("#graduationPlaceholder")).toContainText(
    "graduation-target-placeholder"
  );
  await expect(page.locator("#graduationPlaceholder")).toContainText(
    "流浪者"
  );
  await expect(page.locator("#graduationPlaceholder")).toContainText(
    "不进入伤害模拟"
  );
});
