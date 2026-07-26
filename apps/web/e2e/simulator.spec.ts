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
  await expect(page.locator("#metricGrid")).toContainText(
    "aura-v1 自动判定"
  );
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

test("renders Swirl self damage, propagation, secondary reaction, Aura, and curve events", async ({
  page
}) => {
  const config = structuredClone(legalTimelineDemoPreset);
  const character = config.characters[0]!;
  config.meta = {
    ...config.meta,
    name: "扩散传播与二次反应 · 浏览器验收"
  };
  config.duration = 1;
  config.cycleLength = 1;
  config.enemy = {
    level: 90,
    resistance: 0.1,
    defReduction: 0,
    targets: [
      {
        id: "enemy-0",
        name: "火扩散源",
        position: { x: 0, y: 0 },
        initialAura: [{ element: "pyro", gaugeUnits: 1 }]
      },
      {
        id: "enemy-1",
        name: "水附着传播目标",
        position: { x: 3, y: 0 },
        initialAura: [{ element: "hydro", gaugeUnits: 1 }]
      },
      {
        id: "enemy-2",
        name: "范围外目标",
        position: { x: 5.1, y: 0 }
      }
    ]
  };
  config.characters = [
    {
      ...character,
      element: "anemo",
      stats: {
        ...character.stats,
        baseAtk: 1000,
        atkPct: 0,
        flatAtk: 0,
        em: 100,
        critRate: 0,
        critDmg: 0.5,
        dmgBonus: 0,
        reactionBonus: 0.2
      }
    }
  ];
  config.reactionEngine = { mode: "aura-v2" };
  config.rotation = [];
  config.timeline = {
    mode: "legal-frame-v1",
    fps: 60,
    legalityMode: "strict",
    initialActiveCharacterId: character.id,
    swapFrames: 12,
    abilities: [
      {
        id: "swirl-browser",
        actorId: character.id,
        name: "扩散浏览器序列",
        kind: "skill",
        cancelFrame: 1,
        animationEndFrame: 1,
        cooldownFrames: 0,
        hits: [
          {
            id: "swirl-browser-trigger",
            label: "风命中",
            frame: 0,
            scaling: 1,
            element: "anemo",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            },
            application: {
              gaugeUnits: 1,
              icdTag: "swirl-browser",
              icdGroup: "no-icd"
            }
          }
        ]
      }
    ],
    commands: [
      {
        type: "skill",
        actorId: character.id,
        abilityId: "swirl-browser"
      }
    ]
  };

  await page.goto("/");
  await page.locator("#importInput").setInputFiles({
    name: "swirl-browser-vector.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(config))
  });
  await page.getByRole("button", { name: "时间轴" }).click();

  await expect(page.locator("#damageCurveCanvas")).toBeVisible();
  await expect(page.locator("#auraTimelineCanvas")).toBeVisible();
  await expect(page.locator("#auraTimelineBody")).toContainText("火扩散");
  await page.locator("#auraTargetFilter").selectOption("enemy-1");
  await expect(page.locator("#auraTimelineBody")).toContainText(
    "反向蒸发"
  );
  await expect(page.locator("#reactionDamageSummary")).toContainText(
    "2 次转化反应触发/扩散攻击"
  );
  await expect(page.locator("#reactionDamageBody")).toContainText(
    "扩散自身伤害"
  );
  await expect(page.locator("#reactionDamageBody")).toContainText(
    "扩散范围传播"
  );
  await expect(page.locator("#reactionDamageBody")).toContainText(
    "附着 2.2U"
  );
  await expect(page.locator("#reactionDamageBody")).toContainText(
    "排除 enemy-0"
  );

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    const direct = result?.damageEvents.find(
      (event) => event.kind === "direct"
    );
    const self = result?.damageEvents.find(
      (event) =>
        event.reaction === "swirlPyro" && event.frame === 1
    );
    const propagation = result?.damageEvents.find(
      (event) =>
        event.reaction === "swirlPyro" && event.frame === 5
    );
    return {
      direct: direct && {
        id: direct.id,
        reaction: direct.reaction,
        propagatedGaugeUnits:
          direct.reactionAudit.swirlReactions[0]
            ?.propagatedGaugeUnits
      },
      self: self && {
        frame: self.frame,
        targetId: self.targetId,
        parentDamageEventId: self.parentDamageEventId
      },
      propagation: propagation && {
        frame: propagation.frame,
        targetId: propagation.targetId,
        parentDamageEventId: propagation.parentDamageEventId,
        secondaryReaction: propagation.reactionAudit.reaction,
        applicationGaugeUnits:
          propagation.reactionAudit.applicationGaugeUnits
      },
      curveEvents: result?.damageCurve.length
    };
  });
  expect(audit).toMatchObject({
    direct: {
      id: 0,
      reaction: "swirlPyro",
      propagatedGaugeUnits: 2.2
    },
    self: {
      frame: 1,
      targetId: "enemy-0",
      parentDamageEventId: 0
    },
    propagation: {
      frame: 5,
      targetId: "enemy-1",
      parentDamageEventId: 0,
      secondaryReaction: "reverseVaporize",
      applicationGaugeUnits: 2.2
    },
    curveEvents: 3
  });

  await page.locator("#reactionDamageBody tr").nth(1).click();
  await expect(page.locator("#hitDetail")).toContainText(
    "传播后的二次反应"
  );
  await expect(page.locator("#hitDetail")).toContainText(
    "扩散 ReactionA 伤害 ICD"
  );
  await expect(page.locator("#hitDetail")).toContainText(
    "反向蒸发"
  );
});

test("renders Overload as independent per-target damage with queue and formula audits", async ({
  page
}) => {
  const config = structuredClone(legalTimelineDemoPreset);
  const character = config.characters[0]!;
  config.meta = {
    ...config.meta,
    name: "超载独立伤害 · 浏览器验收"
  };
  config.duration = 1;
  config.cycleLength = 1;
  config.enemy = {
    level: 90,
    resistance: 0.1,
    defReduction: 0,
    targets: [
      {
        id: "enemy-0",
        name: "触发目标",
        position: { x: 0, y: 0 },
        initialAura: [{ element: "electro", gaugeUnits: 1 }]
      },
      {
        id: "enemy-1",
        name: "范围内免疫目标",
        position: { x: 3, y: 0 },
        resistance: 0.5
      },
      {
        id: "enemy-2",
        name: "范围外目标",
        position: { x: 3.1, y: 0 }
      },
      {
        id: "enemy-3",
        name: "未提供位置目标"
      }
    ],
    targetPhases: [
      {
        id: "enemy-1-immune",
        label: "超载免疫窗",
        targetId: "enemy-1",
        startFrame: 1,
        endFrame: 2,
        reason: "OVERLOAD_IMMUNE_WINDOW",
        effects: {
          damage: "immune",
          aura: "normal",
          hitConfirm: "normal"
        }
      }
    ]
  };
  config.characters = [
    {
      ...character,
      element: "pyro",
      stats: {
        ...character.stats,
        em: 100,
        reactionBonus: 0.2
      }
    }
  ];
  config.reactionEngine = { mode: "aura-v2" };
  config.rotation = [];
  config.timeline = {
    mode: "legal-frame-v1",
    fps: 60,
    legalityMode: "strict",
    initialActiveCharacterId: character.id,
    swapFrames: 12,
    abilities: [
      {
        id: "overload-skill",
        actorId: character.id,
        name: "超载触发战技",
        kind: "skill",
        cancelFrame: 1,
        animationEndFrame: 1,
        cooldownFrames: 0,
        hits: [
          {
            id: "overload-trigger",
            label: "火元素触发",
            frame: 0,
            scaling: 1,
            element: "pyro",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            },
            application: {
              gaugeUnits: 1,
              icdTag: "overload-skill",
              icdGroup: "no-icd"
            }
          }
        ]
      }
    ],
    commands: [
      {
        type: "skill",
        actorId: character.id,
        abilityId: "overload-skill"
      }
    ]
  };

  await page.goto("/");
  await page.locator("#importInput").setInputFiles({
    name: "overload-browser-vector.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(config))
  });

  await expect(page.locator("#metricGrid")).toContainText(
    "aura-v2 自动判定"
  );
  await expect(page.locator("#metricGrid")).toContainText("3");
  await page.getByRole("button", { name: "时间轴" }).click();
  await expect(page.locator("#auraTimelineLegend")).toContainText(
    "雷 Aura"
  );
  await expect(page.locator("#auraTimelineBody")).toContainText("超载");
  await expect(page.locator("#reactionDamageSummary")).toContainText(
    "1 次转化反应触发"
  );
  await expect(page.locator("#reactionDamageSummary")).toContainText(
    "2 段逐目标伤害事件"
  );
  await expect(page.locator("#reactionDamageBody")).toContainText("0f → 1f");
  await expect(page.locator("#reactionDamageBody")).toContainText(
    "3 / 2 / 1"
  );
  await expect(page.locator("#reactionDamageBody")).toContainText("enemy-3");
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "Aura 不适用"
  );
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "OUTSIDE_CIRCLE_GEOMETRY"
  );

  await page.locator("#reactionDamageBody tr").click();
  await expect(page.locator("#hitsPanel")).toHaveClass(/active/);
  await expect(page.locator("#hitDetail")).toContainText(
    "独立转化反应伤害"
  );
  await expect(page.locator("#hitDetail")).toContainText(
    "转化反应伤害忽略防御"
  );
  await expect(page.locator("#hitDetail")).toContainText(
    "转化反应伤害不暴击"
  );
  await expect(page.locator("#hitDetail")).toContainText(
    "等级 90 基准 1,446.8535 × 超载 2.75"
  );
});

test("renders Superconduct damage and target-scoped physical resistance windows", async ({
  page
}) => {
  const config = structuredClone(legalTimelineDemoPreset);
  const character = config.characters[0]!;
  config.meta = {
    ...config.meta,
    name: "超导目标状态 · 浏览器验收"
  };
  config.duration = 1;
  config.cycleLength = 1;
  config.enemy = {
    level: 90,
    resistance: 0.1,
    defReduction: 0,
    targets: [
      {
        id: "enemy-0",
        name: "超导触发目标",
        position: { x: 0, y: 0 },
        initialAura: [{ element: "cryo", gaugeUnits: 1 }]
      },
      {
        id: "enemy-1",
        name: "范围外目标",
        position: { x: 3.1, y: 0 }
      }
    ]
  };
  config.characters = [
    {
      ...character,
      element: "electro",
      stats: {
        ...character.stats,
        baseAtk: 1000,
        atkPct: 0,
        flatAtk: 0,
        em: 100,
        critRate: 0,
        critDmg: 0.5,
        dmgBonus: 0,
        reactionBonus: 0.2
      }
    }
  ];
  config.reactionEngine = { mode: "aura-v2" };
  config.rotation = [];
  config.timeline = {
    mode: "legal-frame-v1",
    fps: 60,
    legalityMode: "strict",
    initialActiveCharacterId: character.id,
    swapFrames: 12,
    abilities: [
      {
        id: "superconduct-browser",
        actorId: character.id,
        name: "超导浏览器序列",
        kind: "skill",
        cancelFrame: 2,
        animationEndFrame: 2,
        cooldownFrames: 0,
        hits: [
          {
            id: "superconduct-trigger-browser",
            label: "雷触发超导",
            frame: 0,
            scaling: 1,
            element: "electro",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            },
            application: {
              gaugeUnits: 1,
              icdTag: "superconduct-browser",
              icdGroup: "no-icd"
            }
          },
          {
            id: "physical-same-frame-browser",
            label: "同帧物理",
            frame: 1,
            scaling: 1,
            element: "physical",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            }
          },
          {
            id: "physical-after-browser",
            label: "状态后物理",
            frame: 2,
            scaling: 1,
            element: "physical",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            }
          }
        ]
      }
    ],
    commands: [
      {
        type: "skill",
        actorId: character.id,
        abilityId: "superconduct-browser"
      }
    ]
  };

  await page.goto("/");
  await page.locator("#importInput").setInputFiles({
    name: "superconduct-browser-vector.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(config))
  });
  await page.getByRole("button", { name: "时间轴" }).click();

  await expect(page.locator("#auraTimelineBody")).toContainText("超导");
  await expect(page.locator("#reactionDamageBody")).toContainText("超导");
  await expect(page.locator("#reactionStatusSummary")).toContainText(
    "1 条目标级反应状态区间"
  );
  await expect(page.locator("#reactionStatusBody")).toContainText(
    "超导物理抗性降低"
  );
  await expect(page.locator("#reactionStatusBody")).toContainText(
    "1f → 721f"
  );
  await expect(page.locator("#reactionStatusBody")).toContainText(
    "物理抗性 -40%"
  );

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    const sameFrame = result?.damageEvents.find(
      (event) => event.hitId === "physical-same-frame-browser"
    );
    const after = result?.damageEvents.find(
      (event) => event.hitId === "physical-after-browser"
    );
    return {
      sameFrameResistance: sameFrame?.effectiveRes,
      afterResistance: after?.effectiveRes,
      afterDebuffs: after?.debuffs,
      statusLog: result?.reactionStatusLog
    };
  });
  expect(audit).toMatchObject({
    sameFrameResistance: 0.1,
    afterResistance: -0.30000000000000004,
    afterDebuffs: ["超导物理抗性降低"],
    statusLog: [
      {
        targetId: "enemy-0",
        startFrame: 1,
        endFrame: 721,
        supersededAtFrame: null
      }
    ]
  });

  await page.locator("#reactionDamageBody tr").click();
  await expect(page.locator("#hitDetail")).toContainText(
    "等级 90 基准 1,446.8535 × 超导 1.5"
  );
  await expect(page.locator("#hitDetail")).toContainText(
    "反应目标状态"
  );
  await expect(page.locator("#hitDetail")).toContainText(
    "物理抗性 -40%"
  );
});

test("renders every Electro-Charged tick, ownership refresh, Aura wane, and curve state", async ({
  page
}) => {
  const config = structuredClone(legalTimelineDemoPreset);
  const electro = config.characters[0]!;
  const hydro = config.characters[1]!;
  config.meta = {
    ...config.meta,
    name: "感电周期流 · 浏览器验收"
  };
  config.duration = 3;
  config.cycleLength = 3;
  config.enemy = {
    level: 90,
    resistance: 0.1,
    defReduction: 0,
    targets: [
      {
        id: "enemy-0",
        name: "感电浏览器目标",
        position: { x: 0, y: 0 },
        initialAura: [{ element: "hydro", gaugeUnits: 1 }]
      }
    ]
  };
  config.characters = [
    {
      ...electro,
      element: "electro",
      stats: {
        ...electro.stats,
        baseAtk: 1000,
        atkPct: 0,
        flatAtk: 0,
        em: 100,
        critRate: 0,
        critDmg: 0.5,
        dmgBonus: 0,
        reactionBonus: 0.2
      }
    },
    {
      ...hydro,
      element: "hydro",
      stats: {
        ...hydro.stats,
        baseAtk: 1000,
        atkPct: 0,
        flatAtk: 0,
        em: 300,
        critRate: 0,
        critDmg: 0.5,
        dmgBonus: 0,
        reactionBonus: 0.1
      }
    }
  ];
  config.reactionEngine = { mode: "aura-v2" };
  config.rotation = [];
  config.timeline = {
    mode: "legal-frame-v1",
    fps: 60,
    legalityMode: "strict",
    initialActiveCharacterId: electro.id,
    swapFrames: 12,
    abilities: [
      {
        id: "ec-browser-start",
        actorId: electro.id,
        name: "感电启动",
        kind: "skill",
        cancelFrame: 1,
        animationEndFrame: 1,
        cooldownFrames: 0,
        hits: [
          {
            id: "ec-browser-start-hit",
            label: "雷触发",
            frame: 0,
            scaling: 1,
            element: "electro",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            },
            application: {
              gaugeUnits: 1,
              icdTag: "ec-browser-start",
              icdGroup: "no-icd"
            }
          }
        ]
      },
      {
        id: "ec-browser-refresh",
        actorId: hydro.id,
        name: "感电刷新",
        kind: "skill",
        cancelFrame: 1,
        animationEndFrame: 1,
        cooldownFrames: 0,
        hits: [
          {
            id: "ec-browser-refresh-hit",
            label: "水刷新",
            frame: 0,
            scaling: 1,
            element: "hydro",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            },
            application: {
              gaugeUnits: 1,
              icdTag: "ec-browser-refresh",
              icdGroup: "no-icd"
            }
          }
        ]
      }
    ],
    commands: [
      {
        type: "skill",
        actorId: electro.id,
        abilityId: "ec-browser-start"
      },
      { type: "wait", frames: 7 },
      { type: "swap", characterId: hydro.id },
      {
        type: "skill",
        actorId: hydro.id,
        abilityId: "ec-browser-refresh"
      }
    ]
  };

  await page.goto("/");
  await page.locator("#importInput").setInputFiles({
    name: "electro-charged-browser-vector.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(config))
  });
  await page.getByRole("button", { name: "时间轴" }).click();

  await expect(page.locator("#auraTimelineCanvas")).toBeVisible();
  await expect(page.locator("#auraTimelineBody")).toContainText("感电");
  await expect(page.locator("#reactionDamageBody tr")).toHaveCount(2);
  await expect(page.locator("#reactionDamageBody")).toContainText(
    "周期 Tick"
  );
  await expect(page.locator("#reactionDamageBody")).toContainText(
    "单目标"
  );
  await expect(page.locator("#periodicReactionSummary")).toContainText(
    "6 条周期状态记录"
  );
  await expect(page.locator("#periodicReactionBody tr")).toHaveCount(6);
  await expect(page.locator("#periodicReactionBody")).toContainText(
    "削减 Aura"
  );
  await expect(page.locator("#periodicReactionBody")).toContainText(
    "AURA_DEPLETED_BY_WANE"
  );

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    return {
      ticks: result?.damageEvents
        .filter(
          (event) =>
            event.kind === "transformative-reaction" &&
            event.reaction === "electroCharged"
        )
        .map((event) => ({
          frame: event.frame,
          actorId: event.sourceActorId,
          targetId: event.targetId,
          displayDamage: event.displayDamage
        })),
      operations: result?.periodicReactionLog.map(
        (entry) => `${entry.operation}@${entry.frame}`
      )
    };
  });
  expect(audit).toMatchObject({
    ticks: [
      {
        frame: 10,
        actorId: electro.id,
        targetId: "enemy-0",
        displayDamage: expect.any(Number)
      },
      {
        frame: 70,
        actorId: hydro.id,
        targetId: "enemy-0",
        displayDamage: expect.any(Number)
      }
    ],
    operations: [
      "start@0",
      "tick@10",
      "wane@16",
      "refresh@20",
      "tick@70",
      "wane@76"
    ]
  });

  await page.locator("#reactionDamageBody tr").first().click();
  await expect(page.locator("#hitDetail")).toContainText(
    "等级 90 基准 1,446.8535 × 感电 2"
  );
  await expect(page.locator("#hitDetail")).toContainText(
    "独立转化反应伤害"
  );
});

test("renders Frozen creation, exact expiry, resistance, and curve state", async ({
  page
}) => {
  const config = structuredClone(legalTimelineDemoPreset);
  const hydro = config.characters[0]!;
  config.meta = {
    ...config.meta,
    name: "冻结状态 · 浏览器验收"
  };
  config.duration = 3;
  config.cycleLength = 3;
  config.enemy = {
    level: 90,
    resistance: 0.1,
    defReduction: 0,
    freezeResistance: 0,
    targets: [
      {
        id: "enemy-0",
        name: "冻结浏览器目标",
        freezeResistance: 0,
        initialAura: [{ element: "cryo", gaugeUnits: 1 }]
      }
    ]
  };
  config.characters = [
    {
      ...hydro,
      element: "hydro",
      stats: {
        ...hydro.stats,
        baseAtk: 1000,
        atkPct: 0,
        flatAtk: 0,
        critRate: 0,
        critDmg: 0.5,
        dmgBonus: 0
      }
    }
  ];
  config.reactionEngine = { mode: "aura-v2" };
  config.rotation = [];
  config.timeline = {
    mode: "legal-frame-v1",
    fps: 60,
    legalityMode: "strict",
    initialActiveCharacterId: hydro.id,
    swapFrames: 12,
    abilities: [
      {
        id: "freeze-browser",
        actorId: hydro.id,
        name: "冻结浏览器向量",
        kind: "skill",
        cancelFrame: 1,
        animationEndFrame: 1,
        cooldownFrames: 0,
        hits: [
          {
            id: "freeze-browser-hit",
            label: "水触发冻结",
            frame: 0,
            scaling: 1,
            element: "hydro",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            },
            application: {
              gaugeUnits: 1,
              icdTag: "freeze-browser",
              icdGroup: "no-icd"
            }
          }
        ]
      }
    ],
    commands: [
      {
        type: "skill",
        actorId: hydro.id,
        abilityId: "freeze-browser"
      }
    ]
  };

  await page.goto("/");
  await page.locator("#importInput").setInputFiles({
    name: "freeze-browser-vector.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(config))
  });
  await page.getByRole("button", { name: "时间轴" }).click();

  await expect(page.locator("#auraTimelineBody")).toContainText("冻结");
  await expect(page.locator("#auraTimelineLegend")).toContainText(
    "冻元素 Aura"
  );
  await expect(page.locator("#frozenStateSummary")).toContainText(
    "2 条冻结耐久记录 · 1 次自然到期"
  );
  await expect(page.locator("#frozenStateBody tr")).toHaveCount(2);
  await expect(page.locator("#frozenStateBody")).toContainText("176f");
  await expect(page.locator("#frozenStateBody")).toContainText(
    "FROZEN_DECAY_EXPIRED"
  );

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    return {
      reaction: result?.damageEvents[0]?.reaction,
      reactionBase:
        result?.damageEvents[0]?.damageFactors.reactionBase,
      frozen: result?.frozenStateLog.map((entry) => ({
        operation: entry.operation,
        frame: entry.frame,
        expiresAtFrame: entry.expiresAtFrame,
        freezeResistance: entry.freezeResistance
      }))
    };
  });
  expect(audit).toEqual({
    reaction: "freeze",
    reactionBase: 1,
    frozen: [
      {
        operation: "start",
        frame: 0,
        expiresAtFrame: 176,
        freezeResistance: 0
      },
      {
        operation: "expire",
        frame: 176,
        expiresAtFrame: null,
        freezeResistance: 0
      }
    ]
  });

  await page.locator("#frozenStateBody tr").first().click();
  await expect(page.locator("#hitDetail")).toContainText("冻结状态");
  await expect(page.locator("#hitDetail")).toContainText("1.6U");
  await expect(page.locator("#hitDetail")).toContainText("176f");
});

test("renders Shatter trigger audit, physical damage, frozen consumption, and curve", async ({
  page
}) => {
  const config = structuredClone(legalTimelineDemoPreset);
  const template = config.characters[0]!;
  config.meta = {
    ...config.meta,
    name: "碎冰反应 · 浏览器验收"
  };
  config.duration = 1;
  config.cycleLength = 1;
  config.enemy = {
    level: 90,
    resistance: 0.25,
    defReduction: 0,
    freezeResistance: 0,
    targets: [
      {
        id: "enemy-0",
        name: "碎冰浏览器目标",
        position: { x: 0, y: 0 },
        initialAura: [{ element: "cryo", gaugeUnits: 1 }]
      }
    ]
  };
  config.characters = [
    {
      ...template,
      id: "hydro-browser",
      name: "Hydro Browser",
      element: "hydro",
      stats: {
        ...template.stats,
        baseAtk: 1000,
        atkPct: 0,
        flatAtk: 0,
        critRate: 0,
        dmgBonus: 0,
        em: 0,
        reactionBonus: 0
      }
    },
    {
      ...template,
      id: "crusher-browser",
      name: "Crusher Browser",
      element: "physical",
      stats: {
        ...template.stats,
        baseAtk: 1000,
        atkPct: 0,
        flatAtk: 0,
        critRate: 0,
        dmgBonus: 0,
        em: 100,
        reactionBonus: 0.2
      }
    }
  ];
  config.reactionEngine = { mode: "aura-v2" };
  config.rotation = [];
  config.timeline = {
    mode: "legal-frame-v1",
    fps: 60,
    legalityMode: "strict",
    initialActiveCharacterId: "hydro-browser",
    swapFrames: 1,
    abilities: [
      {
        id: "freeze-before-shatter",
        actorId: "hydro-browser",
        name: "Freeze Before Shatter",
        kind: "skill",
        cancelFrame: 1,
        animationEndFrame: 1,
        cooldownFrames: 0,
        hits: [
          {
            id: "freeze-before-shatter-hit",
            label: "水触发冻结",
            frame: 0,
            scaling: 1,
            element: "hydro",
            application: {
              gaugeUnits: 1,
              icdTag: "freeze-before-shatter",
              icdGroup: "no-icd"
            }
          }
        ]
      },
      {
        id: "browser-shatter",
        actorId: "crusher-browser",
        name: "Browser Shatter",
        kind: "skill",
        cancelFrame: 1,
        animationEndFrame: 1,
        cooldownFrames: 0,
        hits: [
          {
            id: "browser-shatter-hit",
            label: "钝击碎冰",
            frame: 0,
            scaling: 1,
            element: "physical",
            strikeType: "blunt"
          }
        ]
      }
    ],
    commands: [
      {
        type: "skill",
        actorId: "hydro-browser",
        abilityId: "freeze-before-shatter"
      },
      { type: "swap", characterId: "crusher-browser" },
      {
        type: "skill",
        actorId: "crusher-browser",
        abilityId: "browser-shatter"
      }
    ]
  };

  await page.goto("/");
  await page.locator("#importInput").setInputFiles({
    name: "shatter-browser-vector.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(config))
  });
  await page.getByRole("button", { name: "时间轴" }).click();

  await expect(page.locator("#reactionDamageSummary")).toContainText(
    "1 次转化反应触发"
  );
  await expect(page.locator("#reactionDamageBody")).toContainText("碎冰");
  await expect(page.locator("#reactionDamageBody")).toContainText("单目标");
  await expect(page.locator("#frozenStateSummary")).toContainText(
    "2 条冻结耐久记录 · 0 次自然到期"
  );
  await expect(page.locator("#frozenStateSummary")).toContainText(
    "1 次碎冰消耗"
  );
  await expect(page.locator("#frozenStateBody")).toContainText("碎冰消耗");
  await expect(page.locator("#auraTimelineCanvas")).toBeVisible();

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    const trigger = result?.damageEvents.find(
      (event) =>
        event.kind === "direct" &&
        event.sourceActorId === "crusher-browser"
    );
    const shatter = result?.damageEvents.find(
      (event) => event.reaction === "shatter"
    );
    return {
      trigger: trigger
        ? {
            id: trigger.id,
            frame: trigger.frame,
            audit: trigger.reactionAudit.shatterReaction
          }
        : null,
      shatter: shatter
        ? {
            frame: shatter.frame,
            element: shatter.element,
            reaction: shatter.reaction,
            parentDamageEventId: shatter.parentDamageEventId,
            displayDamage: shatter.displayDamage
          }
        : null,
      frozen: result?.frozenStateLog.map((entry) => ({
        operation: entry.operation,
        frame: entry.frame,
        consumedGaugeUnits: entry.consumedGaugeUnits
      }))
    };
  });
  expect(audit).toMatchObject({
    trigger: {
      frame: 2,
      audit: {
        triggered: true,
        scheduled: true,
        damageFrame: 2,
        nextAvailableFrame: 14,
        baseMultiplier: 3,
        frozenGaugeAfter: 0
      }
    },
    shatter: {
      frame: 2,
      element: "physical",
      reaction: "shatter",
      parentDamageEventId: audit.trigger?.id,
      displayDamage: expect.any(Number)
    },
    frozen: [
      { operation: "start", frame: 0 },
      {
        operation: "shatter-consume",
        frame: 2,
        consumedGaugeUnits: expect.any(Number)
      }
    ]
  });

  await page.locator("#frozenStateBody tr").nth(1).click();
  await expect(page.locator("#hitDetail")).toContainText("碎冰触发检查");
  await expect(page.locator("#hitDetail")).toContainText(
    "单目标物理 · 等级基准 × 3.0"
  );
  await page.getByRole("button", { name: "时间轴" }).click();
  await page.locator("#reactionDamageBody tr").first().click();
  await expect(page.locator("#hitDetail")).toContainText(
    "等级 90 基准 1,446.8535 × 碎冰 3"
  );
  await expect(page.locator("#hitDetail")).toContainText(
    "独立转化反应伤害"
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
      { startFrame: 16, cancelFrame: 58, animationEndFrame: 83 },
      { startFrame: 58, cancelFrame: 59, animationEndFrame: 59 }
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
  await expect(page.locator("#legalTimelineBody")).toContainText("冲刺");

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

test("audits a scripted target miss before damage, Aura, and hit-confirmed particles", async ({
  page
}) => {
  await page.goto("/");
  await page
    .locator("#presetSelect")
    .selectOption({ label: "杜林黑 E · 部分机制审计向量" });
  const scriptedMissConfig = await page.evaluate(() => {
    const config = structuredClone(window.GenshinDpsLab.getConfig());
    const ability = config.timeline?.abilities.find(
      (candidate) => candidate.id === "durin-denial-of-darkness"
    );
    const firstHit = ability?.hits?.[0];
    if (!firstHit) throw new Error("expected Durin black E first hit");
    firstHit.targeting = {
      targetId: "enemy-0",
      outcome: "miss",
      reason: "SCRIPTED_OUTSIDE_HITBOX"
    };
    return JSON.stringify(config, null, 2);
  });
  await page.getByRole("button", { name: "高级配置" }).click();
  await page.locator("#jsonEditor").fill(scriptedMissConfig);
  await page.getByRole("button", { name: "应用并运行" }).click();

  await expect(page.locator("#metricGrid")).toContainText("目标判定");
  await expect(page.locator("#metricGrid")).toContainText("2 / 3");
  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    return result
      ? {
          targets: result.hitResolutionLog.map(
            ({
              frame,
              hitId,
              outcome,
              reason,
              damageEventId,
              displayDamage
            }) => ({
              frame,
              hitId,
              outcome,
              reason,
              damageEventId,
              displayDamage
            })
          ),
          damageFrames: result.damageEvents.map((event) => event.frame),
          auraFrames: result.auraTimeline.map((event) => event.frame),
          triggers: result.particleTriggerLog.map(
            ({
              frame,
              hitId,
              triggered,
              blockedReason,
              internalCooldownReadyFrame
            }) => ({
              frame,
              hitId,
              triggered,
              blockedReason,
              internalCooldownReadyFrame
            })
          ),
          particleSpawns: result.particleEvents.map(
            (event) => event.spawnFrame
          )
        }
      : null;
  });
  expect(audit).toMatchObject({
    targets: [
      {
        frame: 48,
        hitId: "durin-black-e-1",
        outcome: "miss",
        reason: "SCRIPTED_OUTSIDE_HITBOX",
        damageEventId: null,
        displayDamage: 0
      },
      {
        frame: 53,
        hitId: "durin-black-e-2",
        outcome: "landed",
        reason: null,
        damageEventId: 0
      },
      {
        frame: 58,
        hitId: "durin-black-e-3",
        outcome: "landed",
        reason: null,
        damageEventId: 1
      }
    ],
    damageFrames: [53, 58],
    auraFrames: [53, 58],
    triggers: [
      {
        frame: 48,
        hitId: "durin-black-e-1",
        triggered: false,
        blockedReason: "TARGET_MISS",
        internalCooldownReadyFrame: null
      },
      {
        frame: 53,
        hitId: "durin-black-e-2",
        triggered: true,
        blockedReason: null,
        internalCooldownReadyFrame: 71
      },
      {
        frame: 58,
        hitId: "durin-black-e-3",
        triggered: false,
        blockedReason: "INTERNAL_COOLDOWN",
        internalCooldownReadyFrame: 71
      }
    ],
    particleSpawns: [53]
  });

  await page.getByRole("button", { name: "时间轴" }).click();
  await expect(page.locator("#targetHitAuditSummary")).toContainText(
    "3 次目标检查 · 2 次命中 · 1 次 Miss"
  );
  await expect(page.locator("#targetHitAuditBody tr")).toHaveCount(3);
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "SCRIPTED_OUTSIDE_HITBOX"
  );
  await expect(page.locator("#targetHitAuditBody")).toContainText("Miss");
  await expect(page.locator("#particleEventSummary")).toContainText(
    "目标 Miss"
  );
  await expect(page.locator("#energyAuditSummary")).toContainText(
    "1 次因 Miss 未触发"
  );
  await page
    .locator("#targetHitAuditBody tr[data-target-damage-id]")
    .first()
    .click();
  await expect(page.locator("#hitsPanel")).toHaveClass(/active/);
  await expect(page.locator("#hitDetail")).toContainText(
    "敌人 0 (enemy-0) / landed (#1)"
  );
});

test("keeps landed target damage, Aura, and hit-confirm policies independent", async ({
  page
}) => {
  await page.goto("/");
  await page
    .locator("#presetSelect")
    .selectOption({ label: "杜林黑 E · 部分机制审计向量" });
  const targetPolicyConfig = await page.evaluate(() => {
    const config = structuredClone(window.GenshinDpsLab.getConfig());
    const ability = config.timeline?.abilities.find(
      (candidate) => candidate.id === "durin-denial-of-darkness"
    );
    const firstHit = ability?.hits?.[0];
    if (!firstHit) throw new Error("expected Durin black E first hit");
    firstHit.targeting = {
      targetId: "enemy-0",
      outcome: "landed",
      reason: "SCRIPTED_FULL_INVULNERABILITY",
      effects: {
        damage: "immune",
        aura: "blocked",
        hitConfirm: "blocked"
      }
    };
    return JSON.stringify(config, null, 2);
  });
  await page.getByRole("button", { name: "高级配置" }).click();
  await page.locator("#jsonEditor").fill(targetPolicyConfig);
  await page.getByRole("button", { name: "应用并运行" }).click();

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    return result
      ? {
          targets: result.hitResolutionLog.map(
            ({
              frame,
              damageAllowed,
              auraAllowed,
              hitConfirmAllowed,
              potentialDamage,
              finalDamage
            }) => ({
              frame,
              damageAllowed,
              auraAllowed,
              hitConfirmAllowed,
              potentialDamage,
              finalDamage
            })
          ),
          damage: result.damageEvents.map(
            ({
              frame,
              reaction,
              targetDamagePolicy,
              potentialDamage,
              finalDamage
            }) => ({
              frame,
              reaction,
              targetDamagePolicy,
              potentialDamage,
              finalDamage
            })
          ),
          triggerReasons: result.particleTriggerLog.map(
            (entry) => entry.blockedReason
          ),
          particleSpawns: result.particleEvents.map(
            (event) => event.spawnFrame
          ),
          curve: result.damageCurve.map(
            (point) => point.cumulativeDamage
          )
        }
      : null;
  });
  expect(audit).toMatchObject({
    targets: [
      {
        frame: 48,
        damageAllowed: false,
        auraAllowed: false,
        hitConfirmAllowed: false,
        potentialDamage: 1111.7736,
        finalDamage: 0
      },
      {
        frame: 53,
        damageAllowed: true,
        auraAllowed: true,
        hitConfirmAllowed: true,
        potentialDamage: 1637.496,
        finalDamage: 1637.496
      },
      {
        frame: 58,
        damageAllowed: true,
        auraAllowed: true,
        hitConfirmAllowed: true,
        potentialDamage: 994.8096,
        finalDamage: 994.8096
      }
    ],
    damage: [
      {
        frame: 48,
        reaction: "none",
        targetDamagePolicy: "immune",
        potentialDamage: 1111.7736,
        finalDamage: 0
      },
      {
        frame: 53,
        reaction: "melt",
        targetDamagePolicy: "normal"
      },
      {
        frame: 58,
        reaction: "none",
        targetDamagePolicy: "normal"
      }
    ],
    triggerReasons: [
      "TARGET_HIT_CONFIRM_BLOCKED",
      null,
      "INTERNAL_COOLDOWN"
    ],
    particleSpawns: [53],
    curve: [0, 1637.496, 2632.3056]
  });

  await page.getByRole("button", { name: "时间轴" }).click();
  await expect(page.locator("#targetHitAuditSummary")).toContainText(
    "1 次伤害免疫"
  );
  const firstTargetRow = page.locator("#targetHitAuditBody tr").first();
  await expect(firstTargetRow).toContainText(
    "伤害免疫 / Aura 阻断 / 回调阻断"
  );
  await expect(firstTargetRow).toContainText(
    "SCRIPTED_FULL_INVULNERABILITY"
  );
  await expect(firstTargetRow).toContainText("潜在 1,112");
  await expect(page.locator("#auraTimelineBody tr").first()).toContainText(
    "冰"
  );
  await expect(page.locator("#particleEventSummary")).toContainText(
    "目标策略阻止回调"
  );
  await expect(page.locator("#energyAuditSummary")).toContainText(
    "1 次被目标策略阻止"
  );
  await firstTargetRow.click();
  await expect(page.locator("#hitsPanel")).toHaveClass(/active/);
  await expect(page.locator("#hitDetail")).toContainText("目标伤害策略");
  await expect(page.locator("#hitDetail")).toContainText(
    "免疫 · 公式潜在 1,112 × 0"
  );
});

test("applies half-open enemy target phases and exposes their source per hit", async ({
  page
}) => {
  await page.goto("/");
  await page
    .locator("#presetSelect")
    .selectOption({ label: "杜林黑 E · 部分机制审计向量" });
  const targetPhaseConfig = await page.evaluate(() => {
    const config = structuredClone(window.GenshinDpsLab.getConfig());
    config.enemy.targetPhases = [
      {
        id: "full-block",
        label: "全层阻断阶段",
        targetId: "enemy-0",
        startFrame: 48,
        endFrame: 53,
        reason: "SCRIPTED_FULL_BLOCK_PHASE",
        effects: {
          damage: "immune",
          aura: "blocked",
          hitConfirm: "blocked"
        }
      },
      {
        id: "damage-only",
        label: "伤害免疫阶段",
        targetId: "enemy-0",
        startFrame: 53,
        endFrame: 58,
        reason: "SCRIPTED_DAMAGE_ONLY_PHASE",
        effects: {
          damage: "immune",
          aura: "normal",
          hitConfirm: "normal"
        }
      }
    ];
    return JSON.stringify(config, null, 2);
  });
  await page.getByRole("button", { name: "高级配置" }).click();
  await page.locator("#jsonEditor").fill(targetPhaseConfig);
  await page.getByRole("button", { name: "应用并运行" }).click();

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    return result
      ? {
          phases: result.targetPhaseTimeline.map(
            ({ id, startFrame, endFrame }) => ({
              id,
              startFrame,
              endFrame
            })
          ),
          hits: result.hitResolutionLog.map(
            ({
              frame,
              targetEffectSource,
              targetPhaseId,
              damageAllowed,
              auraAllowed,
              hitConfirmAllowed,
              finalDamage
            }) => ({
              frame,
              targetEffectSource,
              targetPhaseId,
              damageAllowed,
              auraAllowed,
              hitConfirmAllowed,
              finalDamage
            })
          ),
          reactions: result.damageEvents.map((event) => event.reaction),
          triggerReasons: result.particleTriggerLog.map(
            (entry) => entry.blockedReason
          ),
          totalDamage: result.totalDamage
        }
      : null;
  });
  expect(audit).toEqual({
    phases: [
      { id: "full-block", startFrame: 48, endFrame: 53 },
      { id: "damage-only", startFrame: 53, endFrame: 58 }
    ],
    hits: [
      {
        frame: 48,
        targetEffectSource: "target-phase",
        targetPhaseId: "full-block",
        damageAllowed: false,
        auraAllowed: false,
        hitConfirmAllowed: false,
        finalDamage: 0
      },
      {
        frame: 53,
        targetEffectSource: "target-phase",
        targetPhaseId: "damage-only",
        damageAllowed: false,
        auraAllowed: true,
        hitConfirmAllowed: true,
        finalDamage: 0
      },
      {
        frame: 58,
        targetEffectSource: "normal",
        targetPhaseId: null,
        damageAllowed: true,
        auraAllowed: true,
        hitConfirmAllowed: true,
        finalDamage: 994.8096
      }
    ],
    reactions: ["none", "melt", "none"],
    triggerReasons: [
      "TARGET_HIT_CONFIRM_BLOCKED",
      null,
      "INTERNAL_COOLDOWN"
    ],
    totalDamage: 994.8096
  });

  await page.getByRole("button", { name: "时间轴" }).click();
  await expect(page.locator("#targetPhaseAudit")).toBeVisible();
  await expect(page.locator("#targetPhaseSummary")).toContainText(
    "2 个按帧窗口"
  );
  await expect(page.locator("#targetPhaseBody tr")).toHaveCount(2);
  await expect(page.locator("#targetPhaseBody tr").first()).toContainText(
    "48f"
  );
  await expect(page.locator("#targetPhaseBody tr").first()).toContainText(
    "53f"
  );
  await expect(page.locator("#targetHitAuditBody tr").nth(0)).toContainText(
    "阶段 full-block"
  );
  await expect(page.locator("#targetHitAuditBody tr").nth(1)).toContainText(
    "阶段 damage-only"
  );
  await expect(page.locator("#targetHitAuditBody tr").nth(2)).toContainText(
    "默认"
  );
});

test("keeps registered enemy stats, Aura, ICD, and UI filters independent", async ({
  page
}) => {
  await page.goto("/");
  await page
    .locator("#presetSelect")
    .selectOption({ label: "杜林黑 E · 部分机制审计向量" });
  const multiTargetConfig = await page.evaluate(() => {
    const config = structuredClone(window.GenshinDpsLab.getConfig());
    config.enemy.targets = [
      { id: "enemy-0", name: "主目标" },
      {
        id: "enemy-1",
        name: "副目标",
        resistance: 0.5,
        initialAura: [{ element: "hydro", gaugeUnits: 1 }]
      }
    ];
    const ability = config.timeline?.abilities.find(
      (candidate) => candidate.id === "durin-denial-of-darkness"
    );
    const secondHit = ability?.hits?.[1];
    if (!secondHit) throw new Error("expected Durin black E second hit");
    secondHit.targeting = {
      targetId: "enemy-1",
      outcome: "landed"
    };
    return JSON.stringify(config, null, 2);
  });
  await page.getByRole("button", { name: "高级配置" }).click();
  await page.locator("#jsonEditor").fill(multiTargetConfig);
  await page.getByRole("button", { name: "应用并运行" }).click();

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    return result
      ? {
          targets: result.enemyTargets,
          hits: result.damageEvents.map(
            ({
              frame,
              targetId,
              targetName,
              reaction,
              enemyStateBeforeHit,
              finalDamage
            }) => ({
              frame,
              targetId,
              targetName,
              reaction,
              resistance: enemyStateBeforeHit.baseResistance,
              finalDamage
            })
          ),
          aura: result.auraTimeline.map(
            ({ frame, targetId, reaction, icdAllowed }) => ({
              frame,
              targetId,
              reaction,
              icdAllowed
            })
          ),
          curveTargets: result.damageCurve.map((point) => point.targetId)
        }
      : null;
  });
  expect(audit).toEqual({
    targets: [
      {
        id: "enemy-0",
        name: "主目标",
        level: 110,
        resistance: 0.1,
        defReduction: 0,
        freezeResistance: 0,
        initialAura: [{ element: "cryo", gaugeUnits: 1 }],
        position: null,
        hitboxRadius: 0
      },
      {
        id: "enemy-1",
        name: "副目标",
        level: 110,
        resistance: 0.5,
        defReduction: 0,
        freezeResistance: 0,
        initialAura: [{ element: "hydro", gaugeUnits: 1 }],
        position: null,
        hitboxRadius: 0
      }
    ],
    hits: [
      {
        frame: 48,
        targetId: "enemy-0",
        targetName: "主目标",
        reaction: "melt",
        resistance: 0.1,
        finalDamage: 2223.5472
      },
      {
        frame: 53,
        targetId: "enemy-1",
        targetName: "副目标",
        reaction: "reverseVaporize",
        resistance: 0.5,
        finalDamage: 682.29
      },
      {
        frame: 58,
        targetId: "enemy-0",
        targetName: "主目标",
        reaction: "none",
        resistance: 0.1,
        finalDamage: 994.8096
      }
    ],
    aura: [
      {
        frame: 48,
        targetId: "enemy-0",
        reaction: "melt",
        icdAllowed: true
      },
      {
        frame: 53,
        targetId: "enemy-1",
        reaction: "reverseVaporize",
        icdAllowed: true
      },
      {
        frame: 58,
        targetId: "enemy-0",
        reaction: "none",
        icdAllowed: false
      }
    ],
    curveTargets: ["enemy-0", "enemy-1", "enemy-0"]
  });

  await page.getByRole("button", { name: "时间轴" }).click();
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "主目标"
  );
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "副目标"
  );
  await expect(page.locator("#targetDamageSummary")).toContainText(
    "3,218 伤害"
  );
  await expect(page.locator("#targetDamageSummary")).toContainText(
    "682 伤害"
  );
  await expect(page.locator("#auraTargetFilter option")).toHaveCount(2);
  await expect(page.locator("#auraTimelineBody tr")).toHaveCount(2);
  await page.locator("#auraTargetFilter").selectOption("enemy-1");
  await expect(page.locator("#auraTimelineBody tr")).toHaveCount(1);
  await expect(page.locator("#auraTimelineBody")).toContainText("副目标");

  await page.getByRole("button", { name: "逐段伤害" }).click();
  await expect(page.locator("#hitTargetFilter option")).toHaveCount(3);
  await page.locator("#hitTargetFilter").selectOption("enemy-1");
  await expect(page.locator("#pageInfo")).toContainText("共 1 段");
  const secondaryRow = page.locator("#hitTableBody tr[data-hit-id]");
  await expect(secondaryRow).toHaveCount(1);
  await expect(secondaryRow).toContainText("副目标");
  await secondaryRow.click();
  await expect(page.locator("#hitDetail")).toContainText(
    "副目标 (enemy-1)"
  );
});

test("fans one AoE hit across targets while producing hit-confirm particles once", async ({
  page
}) => {
  await page.goto("/");
  await page
    .locator("#presetSelect")
    .selectOption({ label: "杜林黑 E · 部分机制审计向量" });
  const aoeConfig = await page.evaluate(() => {
    const config = structuredClone(window.GenshinDpsLab.getConfig());
    config.enemy.targets = [
      { id: "enemy-0", name: "主目标" },
      { id: "enemy-1", name: "副目标" }
    ];
    const ability = config.timeline?.abilities.find(
      (candidate) => candidate.id === "durin-denial-of-darkness"
    );
    const firstHit = ability?.hits?.[0];
    if (!firstHit) throw new Error("expected Durin black E first hit");
    firstHit.targeting = {
      mode: "fanout",
      targets: [
        { targetId: "enemy-0", outcome: "landed" },
        { targetId: "enemy-1", outcome: "landed" }
      ]
    };
    return JSON.stringify(config, null, 2);
  });
  await page.getByRole("button", { name: "高级配置" }).click();
  await page.locator("#jsonEditor").fill(aoeConfig);
  await page.getByRole("button", { name: "应用并运行" }).click();

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    const firstGroup = result?.hitResolutionLog.filter(
      (entry) => entry.hitId === "durin-black-e-1"
    );
    return result
      ? {
          firstGroup: firstGroup?.map(
            ({
              targetId,
              hitGroupId,
              targetIndex,
              targetCount,
              finalDamage
            }) => ({
              targetId,
              hitGroupId,
              targetIndex,
              targetCount,
              finalDamage
            })
          ),
          firstTrigger: result.particleTriggerLog[0],
          particleSpawns: result.particleEvents.map(
            (event) => event.spawnFrame
          ),
          checks: result.hitResolutionLog.length,
          damageEvents: result.damageEvents.length
        }
      : null;
  });
  expect(audit?.firstGroup).toHaveLength(2);
  expect(audit?.firstGroup?.map((entry) => entry.targetId)).toEqual([
    "enemy-0",
    "enemy-1"
  ]);
  expect(
    new Set(audit?.firstGroup?.map((entry) => entry.hitGroupId)).size
  ).toBe(1);
  expect(audit?.firstGroup?.map((entry) => entry.targetIndex)).toEqual([
    0, 1
  ]);
  expect(audit?.firstGroup?.map((entry) => entry.targetCount)).toEqual([
    2, 2
  ]);
  expect(audit?.firstTrigger).toMatchObject({
    hitId: "durin-black-e-1",
    checkedTargetIds: ["enemy-0", "enemy-1"],
    confirmedTargetIds: ["enemy-0", "enemy-1"],
    triggered: true,
    blockedReason: null
  });
  expect(audit?.particleSpawns).toEqual([48]);
  expect(audit?.checks).toBe(4);
  expect(audit?.damageEvents).toBe(4);

  await page.getByRole("button", { name: "时间轴" }).click();
  await expect(page.locator("#targetHitAuditBody tr")).toHaveCount(4);
  await expect(page.locator("#targetHitAuditBody")).toContainText("1/2");
  await expect(page.locator("#targetHitAuditBody")).toContainText("2/2");
  await expect(page.locator("#particleEventSummary")).toContainText(
    "检查 2 目标 / 确认 2"
  );
});

test("derives circle hits from target positions and exposes geometric evidence", async ({
  page
}) => {
  await page.goto("/");
  await page
    .locator("#presetSelect")
    .selectOption({ label: "杜林黑 E · 部分机制审计向量" });
  const geometryConfig = await page.evaluate(() => {
    const config = structuredClone(window.GenshinDpsLab.getConfig());
    config.enemy.targets = [
      {
        id: "enemy-0",
        name: "中心目标",
        position: { x: 0, y: 0 },
        hitboxRadius: 0.5
      },
      {
        id: "enemy-1",
        name: "边界目标",
        position: { x: 1.5, y: 0 },
        hitboxRadius: 0.5
      },
      {
        id: "enemy-2",
        name: "范围外目标",
        position: { x: 1.5001, y: 0 },
        hitboxRadius: 0.5
      }
    ];
    const ability = config.timeline?.abilities.find(
      (candidate) => candidate.id === "durin-denial-of-darkness"
    );
    const firstHit = ability?.hits?.[0];
    if (!firstHit) throw new Error("expected Durin black E first hit");
    delete firstHit.targeting;
    firstHit.geometry = {
      kind: "circle",
      origin: { x: 0, y: 0 },
      radius: 1
    };
    return JSON.stringify(config, null, 2);
  });
  await page.getByRole("button", { name: "高级配置" }).click();
  await page.locator("#jsonEditor").fill(geometryConfig);
  await page.getByRole("button", { name: "应用并运行" }).click();

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    return result
      ? {
          firstGroup: result.hitResolutionLog
            .filter((entry) => entry.hitId === "durin-black-e-1")
            .map(
              ({
                targetId,
                targetingSource,
                geometryDistance,
                geometryThreshold,
                outcome,
                reason
              }) => ({
                targetId,
                targetingSource,
                geometryDistance,
                geometryThreshold,
                outcome,
                reason
              })
            ),
          firstTrigger: result.particleTriggerLog[0],
          checks: result.hitResolutionLog.length,
          damageEvents: result.damageEvents.length,
          auraTargets: result.auraTimeline.map((entry) => entry.targetId)
        }
      : null;
  });
  expect(audit?.firstGroup).toEqual([
    {
      targetId: "enemy-0",
      targetingSource: "geometry",
      geometryDistance: 0,
      geometryThreshold: 1.5,
      outcome: "landed",
      reason: null
    },
    {
      targetId: "enemy-1",
      targetingSource: "geometry",
      geometryDistance: 1.5,
      geometryThreshold: 1.5,
      outcome: "landed",
      reason: null
    },
    {
      targetId: "enemy-2",
      targetingSource: "geometry",
      geometryDistance: 1.5001,
      geometryThreshold: 1.5,
      outcome: "miss",
      reason: "OUTSIDE_CIRCLE_GEOMETRY"
    }
  ]);
  expect(audit?.firstTrigger).toMatchObject({
    hitId: "durin-black-e-1",
    checkedTargetIds: ["enemy-0", "enemy-1", "enemy-2"],
    confirmedTargetIds: ["enemy-0", "enemy-1"],
    triggered: true,
    blockedReason: null
  });
  expect(audit?.checks).toBe(5);
  expect(audit?.damageEvents).toBe(4);
  expect(audit?.auraTargets).not.toContain("enemy-2");

  await page.getByRole("button", { name: "时间轴" }).click();
  await expect(page.locator("#targetHitAuditSummary")).toContainText(
    "5 次目标检查 · 4 次命中 · 1 次 Miss"
  );
  await expect(page.locator("#targetHitAuditSummary")).toContainText(
    "3 次二维圆形几何求交"
  );
  await expect(page.locator("#targetHitAuditBody tr")).toHaveCount(5);
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "圆形 d=1.5 ≤ 1.5"
  );
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "圆形 d=1.5001 > 1.5"
  );
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "OUTSIDE_CIRCLE_GEOMETRY"
  );
  await expect(page.locator("#targetDamageSummary")).toContainText(
    "初始坐标 (1.5, 0) · 碰撞半径 0.5"
  );
  await expect(page.locator("#particleEventSummary")).toContainText(
    "检查 3 目标 / 确认 2"
  );

  await page
    .locator("#targetHitAuditBody tr[data-target-damage-id]")
    .first()
    .click();
  await expect(page.locator("#hitDetail")).toContainText("命中判定来源");
  await expect(page.locator("#hitDetail")).toContainText(
    "二维圆形几何 · 圆心 (0, 0) · 攻击半径 1 · 中心距离 0 / 总阈值 1.5"
  );
});

test("audits rotated rectangle intersections against circular target hitboxes", async ({
  page
}) => {
  await page.goto("/");
  await page
    .locator("#presetSelect")
    .selectOption({ label: "杜林黑 E · 部分机制审计向量" });
  const rectangleConfig = await page.evaluate(() => {
    const config = structuredClone(window.GenshinDpsLab.getConfig());
    config.enemy.targets = [
      {
        id: "enemy-0",
        name: "矩形内部",
        position: { x: 0, y: 1.5 },
        hitboxRadius: 0
      },
      {
        id: "enemy-1",
        name: "短边接触",
        position: { x: -0.6, y: 0 },
        hitboxRadius: 0.1
      },
      {
        id: "enemy-2",
        name: "短边范围外",
        position: { x: -0.6001, y: 0 },
        hitboxRadius: 0.1
      }
    ];
    const ability = config.timeline?.abilities.find(
      (candidate) => candidate.id === "durin-denial-of-darkness"
    );
    const firstHit = ability?.hits?.[0];
    if (!firstHit) throw new Error("expected Durin black E first hit");
    delete firstHit.targeting;
    firstHit.geometry = {
      kind: "rectangle",
      origin: { x: 0, y: 0 },
      halfWidth: 2,
      halfHeight: 0.5,
      rotationDegrees: 90
    };
    return JSON.stringify(config, null, 2);
  });
  await page.getByRole("button", { name: "高级配置" }).click();
  await page.locator("#jsonEditor").fill(rectangleConfig);
  await page.getByRole("button", { name: "应用并运行" }).click();

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    return result
      ? {
          firstGroup: result.hitResolutionLog
            .filter((entry) => entry.hitId === "durin-black-e-1")
            .map(
              ({
                targetId,
                geometryKind,
                geometryHalfWidth,
                geometryHalfHeight,
                geometryRotationDegrees,
                geometryDistance,
                geometryThreshold,
                outcome,
                reason
              }) => ({
                targetId,
                geometryKind,
                geometryHalfWidth,
                geometryHalfHeight,
                geometryRotationDegrees,
                geometryDistance:
                  geometryDistance === null
                    ? null
                    : Number(geometryDistance.toFixed(6)),
                geometryThreshold,
                outcome,
                reason
              })
            ),
          firstTrigger: result.particleTriggerLog[0],
          checks: result.hitResolutionLog.length,
          damageEvents: result.damageEvents.length
        }
      : null;
  });
  expect(audit?.firstGroup).toEqual([
    {
      targetId: "enemy-0",
      geometryKind: "rectangle",
      geometryHalfWidth: 2,
      geometryHalfHeight: 0.5,
      geometryRotationDegrees: 90,
      geometryDistance: 0,
      geometryThreshold: 0,
      outcome: "landed",
      reason: null
    },
    {
      targetId: "enemy-1",
      geometryKind: "rectangle",
      geometryHalfWidth: 2,
      geometryHalfHeight: 0.5,
      geometryRotationDegrees: 90,
      geometryDistance: 0.1,
      geometryThreshold: 0.1,
      outcome: "landed",
      reason: null
    },
    {
      targetId: "enemy-2",
      geometryKind: "rectangle",
      geometryHalfWidth: 2,
      geometryHalfHeight: 0.5,
      geometryRotationDegrees: 90,
      geometryDistance: 0.1001,
      geometryThreshold: 0.1,
      outcome: "miss",
      reason: "OUTSIDE_RECTANGLE_GEOMETRY"
    }
  ]);
  expect(audit?.firstTrigger).toMatchObject({
    hitId: "durin-black-e-1",
    checkedTargetIds: ["enemy-0", "enemy-1", "enemy-2"],
    confirmedTargetIds: ["enemy-0", "enemy-1"],
    triggered: true
  });
  expect(audit?.checks).toBe(5);
  expect(audit?.damageEvents).toBe(4);

  await page.getByRole("button", { name: "时间轴" }).click();
  await expect(page.locator("#targetHitAuditSummary")).toContainText(
    "3 次旋转矩形几何求交"
  );
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "矩形最近距离=0.1 ≤ 碰撞半径 0.1"
  );
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "矩形最近距离=0.1001 > 碰撞半径 0.1"
  );
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "OUTSIDE_RECTANGLE_GEOMETRY"
  );
  await page
    .locator("#targetHitAuditBody tr[data-target-damage-id]")
    .first()
    .click();
  await expect(page.locator("#hitDetail")).toContainText(
    "二维旋转矩形"
  );
  await expect(page.locator("#hitDetail")).toContainText(
    "半宽 2 · 半高 0.5 · 旋转 90°"
  );
});

test("audits finite capsule side and end-cap intersections", async ({
  page
}) => {
  await page.goto("/");
  await page
    .locator("#presetSelect")
    .selectOption({ label: "杜林黑 E · 部分机制审计向量" });
  const capsuleConfig = await page.evaluate(() => {
    const config = structuredClone(window.GenshinDpsLab.getConfig());
    config.enemy.targets = [
      {
        id: "enemy-0",
        name: "线段内部",
        position: { x: 0, y: 0 },
        hitboxRadius: 0
      },
      {
        id: "enemy-1",
        name: "端帽边界",
        position: { x: 2.5, y: 0 },
        hitboxRadius: 0
      },
      {
        id: "enemy-2",
        name: "端帽范围外",
        position: { x: 2.5001, y: 0 },
        hitboxRadius: 0
      }
    ];
    const ability = config.timeline?.abilities.find(
      (candidate) => candidate.id === "durin-denial-of-darkness"
    );
    const firstHit = ability?.hits?.[0];
    if (!firstHit) throw new Error("expected Durin black E first hit");
    delete firstHit.targeting;
    firstHit.geometry = {
      kind: "capsule",
      start: { x: -2, y: 0 },
      end: { x: 2, y: 0 },
      radius: 0.5
    };
    return JSON.stringify(config, null, 2);
  });
  await page.getByRole("button", { name: "高级配置" }).click();
  await page.locator("#jsonEditor").fill(capsuleConfig);
  await page.getByRole("button", { name: "应用并运行" }).click();

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    return result
      ? {
          firstGroup: result.hitResolutionLog
            .filter((entry) => entry.hitId === "durin-black-e-1")
            .map(
              ({
                targetId,
                geometryKind,
                geometryStart,
                geometryEnd,
                geometryRadius,
                geometryDistance,
                geometryThreshold,
                outcome,
                reason
              }) => ({
                targetId,
                geometryKind,
                geometryStart,
                geometryEnd,
                geometryRadius,
                geometryDistance:
                  geometryDistance === null
                    ? null
                    : Number(geometryDistance.toFixed(6)),
                geometryThreshold,
                outcome,
                reason
              })
            ),
          firstTrigger: result.particleTriggerLog[0],
          checks: result.hitResolutionLog.length,
          damageEvents: result.damageEvents.length
        }
      : null;
  });
  expect(audit?.firstGroup).toEqual([
    {
      targetId: "enemy-0",
      geometryKind: "capsule",
      geometryStart: { x: -2, y: 0 },
      geometryEnd: { x: 2, y: 0 },
      geometryRadius: 0.5,
      geometryDistance: 0,
      geometryThreshold: 0.5,
      outcome: "landed",
      reason: null
    },
    {
      targetId: "enemy-1",
      geometryKind: "capsule",
      geometryStart: { x: -2, y: 0 },
      geometryEnd: { x: 2, y: 0 },
      geometryRadius: 0.5,
      geometryDistance: 0.5,
      geometryThreshold: 0.5,
      outcome: "landed",
      reason: null
    },
    {
      targetId: "enemy-2",
      geometryKind: "capsule",
      geometryStart: { x: -2, y: 0 },
      geometryEnd: { x: 2, y: 0 },
      geometryRadius: 0.5,
      geometryDistance: 0.5001,
      geometryThreshold: 0.5,
      outcome: "miss",
      reason: "OUTSIDE_CAPSULE_GEOMETRY"
    }
  ]);
  expect(audit?.firstTrigger).toMatchObject({
    checkedTargetIds: ["enemy-0", "enemy-1", "enemy-2"],
    confirmedTargetIds: ["enemy-0", "enemy-1"],
    triggered: true
  });
  expect(audit?.checks).toBe(5);
  expect(audit?.damageEvents).toBe(4);

  await page.getByRole("button", { name: "时间轴" }).click();
  await expect(page.locator("#targetHitAuditSummary")).toContainText(
    "3 次胶囊几何求交"
  );
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "胶囊线段距离=0.5 ≤ 总阈值 0.5"
  );
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "胶囊线段距离=0.5001 > 总阈值 0.5"
  );
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "OUTSIDE_CAPSULE_GEOMETRY"
  );
  await page
    .locator("#targetHitAuditBody tr[data-target-damage-id]")
    .first()
    .click();
  await expect(page.locator("#hitDetail")).toContainText(
    "二维胶囊几何"
  );
  await expect(page.locator("#hitDetail")).toContainText(
    "起点 (-2, 0) · 终点 (2, 0) · 扫掠半径 0.5"
  );
});

test("audits filled sector arc, radial-edge, and out-of-range intersections", async ({
  page
}) => {
  await page.goto("/");
  await page
    .locator("#presetSelect")
    .selectOption({ label: "杜林黑 E · 部分机制审计向量" });
  const sectorConfig = await page.evaluate(() => {
    const config = structuredClone(window.GenshinDpsLab.getConfig());
    config.enemy.targets = [
      {
        id: "enemy-0",
        name: "扇形内部",
        position: { x: 1, y: 0 },
        hitboxRadius: 0
      },
      {
        id: "enemy-1",
        name: "径向边擦碰",
        position: { x: 1, y: 1.2 },
        hitboxRadius: 0.15
      },
      {
        id: "enemy-2",
        name: "圆弧范围外",
        position: { x: 2.0001, y: 0 },
        hitboxRadius: 0
      }
    ];
    const ability = config.timeline?.abilities.find(
      (candidate) => candidate.id === "durin-denial-of-darkness"
    );
    const firstHit = ability?.hits?.[0];
    if (!firstHit) throw new Error("expected Durin black E first hit");
    delete firstHit.targeting;
    firstHit.geometry = {
      kind: "sector",
      origin: { x: 0, y: 0 },
      radius: 2,
      directionDegrees: 0,
      angleDegrees: 90
    };
    return JSON.stringify(config, null, 2);
  });
  await page.getByRole("button", { name: "高级配置" }).click();
  await page.locator("#jsonEditor").fill(sectorConfig);
  await page.getByRole("button", { name: "应用并运行" }).click();

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    return result
      ? {
          firstGroup: result.hitResolutionLog
            .filter((entry) => entry.hitId === "durin-black-e-1")
            .map(
              ({
                targetId,
                geometryKind,
                geometryOrigin,
                geometryRadius,
                geometryDirectionDegrees,
                geometryAngleDegrees,
                geometryDistance,
                geometryThreshold,
                outcome,
                reason
              }) => ({
                targetId,
                geometryKind,
                geometryOrigin,
                geometryRadius,
                geometryDirectionDegrees,
                geometryAngleDegrees,
                geometryDistance:
                  geometryDistance === null
                    ? null
                    : Number(geometryDistance.toFixed(6)),
                geometryThreshold,
                outcome,
                reason
              })
            ),
          firstTrigger: result.particleTriggerLog[0],
          checks: result.hitResolutionLog.length,
          damageEvents: result.damageEvents.length
        }
      : null;
  });
  expect(audit?.firstGroup).toEqual([
    {
      targetId: "enemy-0",
      geometryKind: "sector",
      geometryOrigin: { x: 0, y: 0 },
      geometryRadius: 2,
      geometryDirectionDegrees: 0,
      geometryAngleDegrees: 90,
      geometryDistance: 0,
      geometryThreshold: 0,
      outcome: "landed",
      reason: null
    },
    {
      targetId: "enemy-1",
      geometryKind: "sector",
      geometryOrigin: { x: 0, y: 0 },
      geometryRadius: 2,
      geometryDirectionDegrees: 0,
      geometryAngleDegrees: 90,
      geometryDistance: 0.141421,
      geometryThreshold: 0.15,
      outcome: "landed",
      reason: null
    },
    {
      targetId: "enemy-2",
      geometryKind: "sector",
      geometryOrigin: { x: 0, y: 0 },
      geometryRadius: 2,
      geometryDirectionDegrees: 0,
      geometryAngleDegrees: 90,
      geometryDistance: 0.0001,
      geometryThreshold: 0,
      outcome: "miss",
      reason: "OUTSIDE_SECTOR_GEOMETRY"
    }
  ]);
  expect(audit?.firstTrigger).toMatchObject({
    checkedTargetIds: ["enemy-0", "enemy-1", "enemy-2"],
    confirmedTargetIds: ["enemy-0", "enemy-1"],
    triggered: true
  });
  expect(audit?.checks).toBe(5);
  expect(audit?.damageEvents).toBe(4);

  await page.getByRole("button", { name: "时间轴" }).click();
  await expect(page.locator("#targetHitAuditSummary")).toContainText(
    "3 次扇形几何求交"
  );
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "扇形最近距离=0.1414 ≤ 碰撞半径 0.15"
  );
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "扇形最近距离=0.0001 > 碰撞半径 0"
  );
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "OUTSIDE_SECTOR_GEOMETRY"
  );
  await page
    .locator("#targetHitAuditBody tr[data-target-damage-id]")
    .first()
    .click();
  await expect(page.locator("#hitDetail")).toContainText(
    "二维填充扇形"
  );
  await expect(page.locator("#hitDetail")).toContainText(
    "半径 2 · 方向 0° · 夹角 90°"
  );
});

test("transforms actor-local geometry from a static source pose and audits world coordinates", async ({
  page
}) => {
  await page.goto("/");
  await page
    .locator("#presetSelect")
    .selectOption({ label: "杜林黑 E · 部分机制审计向量" });
  const actorLocalConfig = await page.evaluate(() => {
    const config = structuredClone(window.GenshinDpsLab.getConfig());
    config.actorPoses = [
      {
        actorId: "durin",
        position: { x: 10, y: 20 },
        facingDegrees: 90
      }
    ];
    config.enemy.targets = [
      {
        id: "enemy-0",
        name: "施放者前方",
        position: { x: 10, y: 21 },
        hitboxRadius: 0
      },
      {
        id: "enemy-1",
        name: "世界右侧",
        position: { x: 11, y: 20 },
        hitboxRadius: 0
      }
    ];
    const ability = config.timeline?.abilities.find(
      (candidate) => candidate.id === "durin-denial-of-darkness"
    );
    const firstHit = ability?.hits?.[0];
    if (!firstHit) throw new Error("expected Durin black E first hit");
    delete firstHit.targeting;
    firstHit.geometry = {
      kind: "sector",
      coordinateSpace: "actor-local",
      origin: { x: 0, y: 0 },
      radius: 2,
      directionDegrees: 0,
      angleDegrees: 60
    };
    return JSON.stringify(config, null, 2);
  });
  await page.getByRole("button", { name: "高级配置" }).click();
  await page.locator("#jsonEditor").fill(actorLocalConfig);
  await page.getByRole("button", { name: "应用并运行" }).click();

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    return result
      ? {
          actorPoses: result.actorPoses,
          firstGroup: result.hitResolutionLog
            .filter((entry) => entry.hitId === "durin-black-e-1")
            .map(
              ({
                targetId,
                sourceActorPosition,
                sourceActorFacingDegrees,
                geometryCoordinateSpace,
                geometryOrigin,
                geometryDirectionDegrees,
                outcome,
                reason
              }) => ({
                targetId,
                sourceActorPosition,
                sourceActorFacingDegrees,
                geometryCoordinateSpace,
                geometryOrigin,
                geometryDirectionDegrees,
                outcome,
                reason
              })
            ),
          firstTrigger: result.particleTriggerLog[0],
          checks: result.hitResolutionLog.length,
          damageEvents: result.damageEvents.length
        }
      : null;
  });
  expect(audit?.actorPoses).toEqual([
    {
      actorId: "durin",
      position: { x: 10, y: 20 },
      facingDegrees: 90
    }
  ]);
  expect(audit?.firstGroup).toEqual([
    {
      targetId: "enemy-0",
      sourceActorPosition: { x: 10, y: 20 },
      sourceActorFacingDegrees: 90,
      geometryCoordinateSpace: "actor-local",
      geometryOrigin: { x: 10, y: 20 },
      geometryDirectionDegrees: 90,
      outcome: "landed",
      reason: null
    },
    {
      targetId: "enemy-1",
      sourceActorPosition: { x: 10, y: 20 },
      sourceActorFacingDegrees: 90,
      geometryCoordinateSpace: "actor-local",
      geometryOrigin: { x: 10, y: 20 },
      geometryDirectionDegrees: 90,
      outcome: "miss",
      reason: "OUTSIDE_SECTOR_GEOMETRY"
    }
  ]);
  expect(audit?.firstTrigger).toMatchObject({
    checkedTargetIds: ["enemy-0", "enemy-1"],
    confirmedTargetIds: ["enemy-0"],
    triggered: true
  });
  expect(audit?.checks).toBe(4);
  expect(audit?.damageEvents).toBe(3);

  await page.getByRole("button", { name: "时间轴" }).click();
  await expect(page.locator("#targetHitAuditSummary")).toContainText(
    "1 个静态角色姿态"
  );
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "局部→世界 扇形最近距离"
  );
  await page
    .locator("#targetHitAuditBody tr[data-target-damage-id]")
    .first()
    .click();
  await expect(page.locator("#hitDetail")).toContainText(
    "施放者静态姿态"
  );
  await expect(page.locator("#hitDetail")).toContainText(
    "(10, 20) · 朝向 90°"
  );
  await expect(page.locator("#hitDetail")).toContainText(
    "施放者局部→世界 · 二维填充扇形"
  );
  await expect(page.locator("#hitDetail")).toContainText(
    "圆心 (10, 20) · 半径 2 · 方向 90° · 夹角 60°"
  );
});

test("interpolates target motion at each hit frame before geometry resolution", async ({
  page
}) => {
  await page.goto("/");
  await page
    .locator("#presetSelect")
    .selectOption({ label: "杜林黑 E · 部分机制审计向量" });
  const movingTargetConfig = await page.evaluate(() => {
    const config = structuredClone(window.GenshinDpsLab.getConfig());
    config.enemy.targets = [
      {
        id: "enemy-0",
        name: "移动目标",
        position: { x: 0, y: 0 },
        hitboxRadius: 0.5
      }
    ];
    config.enemy.targetMotions = [
      {
        id: "outbound",
        label: "线性远离",
        targetId: "enemy-0",
        startFrame: 0,
        endFrame: 60,
        endPosition: { x: 1.8, y: 0 }
      }
    ];
    const ability = config.timeline?.abilities.find(
      (candidate) => candidate.id === "durin-denial-of-darkness"
    );
    if (!ability?.hits) throw new Error("expected Durin black E hits");
    for (const hit of ability.hits) {
      delete hit.targeting;
      hit.geometry = {
        kind: "circle",
        origin: { x: 0, y: 0 },
        radius: 1
      };
    }
    return JSON.stringify(config, null, 2);
  });
  await page.getByRole("button", { name: "高级配置" }).click();
  await page.locator("#jsonEditor").fill(movingTargetConfig);
  await page.getByRole("button", { name: "应用并运行" }).click();

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    return result
      ? {
          motion: result.targetMotionTimeline,
          hits: result.hitResolutionLog.map(
            ({
              frame,
              targetPosition,
              geometryDistance,
              geometryThreshold,
              outcome,
              reason
            }) => ({
              frame,
              targetPosition:
                targetPosition === null
                  ? null
                  : {
                      x: Number(targetPosition.x.toFixed(6)),
                      y: Number(targetPosition.y.toFixed(6))
                    },
              geometryDistance:
                geometryDistance === null
                  ? null
                  : Number(geometryDistance.toFixed(6)),
              geometryThreshold,
              outcome,
              reason
            })
          ),
          damageFrames: result.damageEvents.map((event) => event.frame),
          triggerReasons: result.particleTriggerLog.map(
            (entry) => entry.blockedReason
          )
        }
      : null;
  });
  expect(audit?.motion).toEqual([
    {
      id: "outbound",
      label: "线性远离",
      targetId: "enemy-0",
      startFrame: 0,
      endFrame: 60,
      endPosition: { x: 1.8, y: 0 },
      startPosition: { x: 0, y: 0 },
      startTimeSeconds: 0,
      endTimeSeconds: 1
    }
  ]);
  expect(audit?.hits).toEqual([
    {
      frame: 48,
      targetPosition: { x: 1.44, y: 0 },
      geometryDistance: 1.44,
      geometryThreshold: 1.5,
      outcome: "landed",
      reason: null
    },
    {
      frame: 53,
      targetPosition: { x: 1.59, y: 0 },
      geometryDistance: 1.59,
      geometryThreshold: 1.5,
      outcome: "miss",
      reason: "OUTSIDE_CIRCLE_GEOMETRY"
    },
    {
      frame: 58,
      targetPosition: { x: 1.74, y: 0 },
      geometryDistance: 1.74,
      geometryThreshold: 1.5,
      outcome: "miss",
      reason: "OUTSIDE_CIRCLE_GEOMETRY"
    }
  ]);
  expect(audit?.damageFrames).toEqual([48]);
  expect(audit?.triggerReasons).toEqual([
    null,
    "TARGET_MISS",
    "TARGET_MISS"
  ]);

  await page.getByRole("button", { name: "时间轴" }).click();
  await expect(page.locator("#targetMotionAudit")).toBeVisible();
  await expect(page.locator("#targetMotionSummary")).toContainText(
    "1 个线性分段"
  );
  await expect(page.locator("#targetMotionBody tr")).toHaveCount(1);
  await expect(page.locator("#targetMotionBody")).toContainText(
    "线性远离"
  );
  await expect(page.locator("#targetMotionBody")).toContainText(
    "(0, 0)"
  );
  await expect(page.locator("#targetMotionBody")).toContainText(
    "(1.8, 0)"
  );
  await expect(page.locator("#targetHitAuditSummary")).toContainText(
    "3 次目标检查 · 1 次命中 · 2 次 Miss"
  );
  await expect(page.locator("#targetHitAuditSummary")).toContainText(
    "1 个目标移动段"
  );
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "(1.44, 0)"
  );
  await expect(page.locator("#targetHitAuditBody")).toContainText(
    "(1.59, 0)"
  );

  await page
    .locator("#targetHitAuditBody tr[data-target-damage-id]")
    .first()
    .click();
  await expect(page.locator("#hitDetail")).toContainText(
    "命中时目标位置"
  );
  await expect(page.locator("#hitDetail")).toContainText("(1.44, 0)");
});

test("renders the source-audited Durin white E branch and state transition", async ({
  page
}) => {
  await page.goto("/");
  await page
    .locator("#presetSelect")
    .selectOption({ label: "杜林白 E · 部分机制审计向量" });

  await expect(page.locator("#notice")).toContainText(
    "杜林白 E · 部分机制审计向量"
  );
  await expect(page.locator("#notice")).toContainText("不是完整角色预设");
  await expect(page.locator("#notice")).toContainText("partial");
  await expect(page.locator("#notice")).toContainText("5 项待实现");
  await expect(page.locator("#metricGrid")).toContainText("1,625");
  await expect(page.locator("#metricGrid")).toContainText("1");

  const audit = await page.evaluate(() => {
    const result = window.GenshinDpsLab.getLastResult();
    return result
      ? {
          damage: result.damageEvents.map(
            ({
              frame,
              hitId,
              displayDamage,
              reaction,
              reactionAudit
            }) => ({
              frame,
              hitId,
              displayDamage,
              reaction,
              icdAllowed: reactionAudit.icdAllowed,
              icdGroup: reactionAudit.icdGroup
            })
          ),
          commands: result.timelineExecution?.commandResults.map(
            ({ commandType, startFrame, cancelFrame, animationEndFrame }) => ({
              commandType,
              startFrame,
              cancelFrame,
              animationEndFrame
            })
          ),
          states: result.timelineExecution?.stateLog.map(
            ({ frame, operation, statusKey }) => ({
              frame,
              operation,
              statusKey
            })
          ),
          energy: result.energyStats.durin,
          particle: result.particleEvents[0],
          trigger: result.particleTriggerLog[0]
        }
      : null;
  });
  expect(audit).toMatchObject({
    damage: [
      {
        frame: 50,
        hitId: "durin-white-e",
        displayDamage: 1625,
        reaction: "none",
        icdAllowed: null,
        icdGroup: null
      }
    ],
    commands: [
      {
        commandType: "skill",
        startFrame: 0,
        cancelFrame: 15,
        animationEndFrame: 49
      },
      {
        commandType: "skill",
        startFrame: 15,
        cancelFrame: 61,
        animationEndFrame: 98
      },
      {
        commandType: "dash",
        startFrame: 61,
        cancelFrame: 62,
        animationEndFrame: 62
      }
    ],
    states: [
      {
        frame: 0,
        operation: "grant",
        statusKey: "durin-essential-transformation"
      },
      {
        frame: 15,
        operation: "consume",
        statusKey: "durin-essential-transformation"
      },
      {
        frame: 15,
        operation: "grant",
        statusKey: "durin-confirmation-of-purity-state"
      }
    ],
    energy: {
      fixedGained: 33,
      particleGained: 12,
      final: 45
    },
    particle: {
      particleCount: 4,
      spawnFrame: 50,
      receiveFrame: 150,
      triggerHitId: "durin-white-e"
    },
    trigger: {
      frame: 50,
      hitId: "durin-white-e",
      triggered: true,
      internalCooldownKey: "durin-particle-icd",
      internalCooldownReadyFrame: 68
    }
  });

  await page.getByRole("button", { name: "逐段伤害" }).click();
  await expect(page.locator("#hitTableBody tr[data-hit-id]")).toHaveCount(1);
  await page.locator("#hitTableBody tr[data-hit-id]").click();
  await expect(page.locator("#hitDetail")).toContainText("白 E");
  await expect(page.locator("#hitDetail")).toContainText("1.9008");

  await page.getByRole("button", { name: "总览" }).click();
  await expect(page.locator("#timelineStateBody")).toContainText("白化之是");
  await expect(page.locator("#legalTimelineBody")).toContainText("冲刺");

  await page.getByRole("button", { name: "时间轴" }).click();
  await expect(page.locator("#damageCurveCanvas")).toBeVisible();
  await expect(page.locator("#auraTimelineCanvas")).toBeVisible();
  await expect(page.locator("#energyTimelineCanvas")).toBeVisible();
  const auraRow = page.locator("#auraTimelineBody tr").first();
  await expect(page.locator("#auraTimelineBody tr")).toHaveCount(1);
  await expect(auraRow.locator("td").nth(3)).toHaveText("—");
  await expect(auraRow.locator("td").nth(4)).toContainText("冰");
  await expect(auraRow.locator("td").nth(5)).toHaveText("无");
  await expect(auraRow.locator("td").nth(6)).toHaveText("无");
  await expect(auraRow.locator("td").nth(7)).toHaveText("—");
  await expect(auraRow.locator("td").nth(8)).toContainText("冰");
  await expect(page.locator("#particleEventSummary")).toContainText(
    "durin-white-e"
  );
  await expect(page.locator("#energyLogBody")).toContainText(
    "durin-skill-energy-icd"
  );
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
