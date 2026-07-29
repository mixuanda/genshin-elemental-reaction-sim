import {
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  type SimConfig
} from "@genshin-dps-lab/schemas";

/**
 * Compatibility fixture data copied from Vanilla v0.1.
 *
 * These values are intentionally marked provisional. They exist to prove the
 * engine migration and UI behavior; they are not a verified Genshin database.
 */
export const durinMeltPreset: SimConfig = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  engineVersion: CURRENT_ENGINE_VERSION,
  dataVersion: "0.1.0-demo",
  randomSeed: "legacy-default",
  meta: {
    name: "黑杜林融化 · C6R5 / C6R1 结构示例",
    version: "0.1.0-demo",
    verificationStatus: "provisional",
    note: "仅用于兼容回归与机制/UI校准。角色、装备系数和回能含示例魔法数，不是正式已验证数据。"
  },
  duration: 120,
  cycleLength: 21.5,
  enemy: { level: 110, resistance: 0.1, defReduction: 0 },
  playerDamageModel: { mode: "disabled" },
  targetClockModel: { mode: "disabled" },
  targetTaskModel: { mode: "legacy-event-heap-v1" },
  reactionDeliveryModel: { mode: "deferred-event-heap-v1" },
  characters: [
    {
      id: "durin",
      name: "杜林",
      element: "pyro",
      color: "#ff8b72",
      level: 90,
      energyMax: 70,
      initialEnergy: 0,
      stats: {
        baseAtk: 1035,
        atkPct: 1.05,
        flatAtk: 850,
        baseHp: 13000,
        hpPct: 0,
        flatHp: 0,
        baseDef: 780,
        defPct: 0,
        flatDef: 0,
        em: 190,
        critRate: 0.82,
        critDmg: 2.55,
        dmgBonus: 1.88,
        defIgnore: 0.7,
        reactionBonus: 0.7,
        energyRecharge: 1
      }
    },
    {
      id: "nicole",
      name: "尼可",
      element: "pyro",
      color: "#ffbd80",
      level: 90,
      energyMax: 60,
      initialEnergy: 0,
      stats: {
        baseAtk: 1180,
        atkPct: 1.28,
        flatAtk: 920,
        baseHp: 12500,
        hpPct: 0,
        flatHp: 0,
        baseDef: 730,
        defPct: 0,
        flatDef: 0,
        em: 80,
        critRate: 0.7,
        critDmg: 1.85,
        dmgBonus: 1.05,
        defIgnore: 0,
        reactionBonus: 0,
        energyRecharge: 1
      }
    },
    {
      id: "lohen",
      name: "洛恩",
      element: "cryo",
      color: "#8ed8ff",
      level: 90,
      energyMax: 60,
      initialEnergy: 0,
      stats: {
        baseAtk: 1010,
        atkPct: 1.12,
        flatAtk: 780,
        baseHp: 12800,
        hpPct: 0,
        flatHp: 0,
        baseDef: 760,
        defPct: 0,
        flatDef: 0,
        em: 120,
        critRate: 0.74,
        critDmg: 2.25,
        dmgBonus: 1.42,
        defIgnore: 0,
        reactionBonus: 0,
        energyRecharge: 1
      }
    },
    {
      id: "citlali",
      name: "茜特菈莉",
      element: "cryo",
      color: "#b5cfff",
      level: 90,
      energyMax: 60,
      initialEnergy: 0,
      stats: {
        baseAtk: 670,
        atkPct: 0.35,
        flatAtk: 390,
        baseHp: 11500,
        hpPct: 0,
        flatHp: 0,
        baseDef: 720,
        defPct: 0,
        flatDef: 0,
        em: 980,
        critRate: 0.55,
        critDmg: 1.45,
        dmgBonus: 0.85,
        defIgnore: 0,
        reactionBonus: 0,
        energyRecharge: 1
      }
    }
  ],
  rotation: [
    {
      id: "passives",
      actorId: "nicole",
      name: "队伍常驻被动",
      at: 0,
      once: true,
      buffs: [
        {
          key: "nicole-c6-def-ignore",
          target: "team",
          stat: "defIgnore",
          value: 0.4,
          duration: 999,
          offset: 0
        },
        {
          key: "double-cryo",
          target: "team",
          stat: "critRate",
          value: 0.15,
          duration: 999,
          offset: 0
        }
      ]
    },
    {
      id: "nicole-e",
      actorId: "nicole",
      name: "尼可 E",
      at: 0.15,
      hits: [
        {
          offset: 0.15,
          label: "E",
          scaling: 2.2,
          scalingStat: "atk",
          element: "pyro",
          reaction: "none",
          snapshot: "hit"
        }
      ],
      buffs: [
        {
          key: "nicole-e-atk",
          target: "team",
          stat: "atkFlat",
          value: 950,
          duration: 20,
          offset: 0.13
        },
        {
          key: "nicole-c2-atk",
          target: "team",
          stat: "atkFlat",
          value: 300,
          duration: 20,
          offset: 0.13
        }
      ],
      debuffs: [
        {
          key: "nicole-c2-pyro-res",
          element: "pyro",
          resShred: 0.25,
          duration: 20,
          offset: 0.13
        }
      ],
      energyGains: [
        { target: "nicole", amount: 15, offset: 0.55 },
        { target: "durin", amount: 12, offset: 0.55 },
        { target: "citlali", amount: 4, offset: 0.55 },
        { target: "lohen", amount: 4, offset: 0.55 }
      ]
    },
    {
      id: "citlali-e",
      actorId: "citlali",
      name: "茜特菈莉 E",
      at: 1.05,
      hits: [
        {
          offset: 0.35,
          label: "E",
          scaling: 1.5,
          scalingStat: "em",
          element: "cryo",
          reaction: "none",
          snapshot: "action"
        },
        ...Array.from({ length: 8 }, (_, index) => ({
          offset: 2.2 + index * 2.25,
          label: `后台冰 ${index + 1}`,
          scaling: 0.42,
          scalingStat: "em" as const,
          element: "cryo" as const,
          reaction:
            index % 4 === 0 ? ("reverseMelt" as const) : ("none" as const),
          snapshot: "action" as const
        }))
      ],
      buffs: [
        {
          key: "scroll-set",
          target: "team",
          stat: "dmgBonus",
          value: 0.4,
          duration: 20,
          offset: 0.25
        },
        {
          key: "ttds-durin",
          target: "durin",
          stat: "atkPct",
          value: 0.48,
          duration: 10,
          offset: 0.3
        }
      ],
      debuffs: [
        {
          key: "citlali-pyro-res",
          element: "pyro",
          resShred: 0.4,
          duration: 20,
          offset: 0.25
        }
      ],
      energyGains: [
        { target: "citlali", amount: 18, offset: 0.8 },
        { target: "durin", amount: 12, offset: 0.8 },
        { target: "nicole", amount: 5, offset: 0.8 },
        { target: "lohen", amount: 5, offset: 0.8 }
      ]
    },
    {
      id: "durin-e",
      actorId: "durin",
      name: "杜林 黑 E",
      at: 2.35,
      hits: [
        {
          offset: 0.53,
          label: "黑 E·1",
          scaling: 1.15,
          scalingStat: "atk",
          element: "pyro",
          reaction: "melt",
          snapshot: "hit"
        },
        {
          offset: 0.61,
          label: "黑 E·2",
          scaling: 1.15,
          scalingStat: "atk",
          element: "pyro",
          reaction: "none",
          snapshot: "hit"
        },
        {
          offset: 0.69,
          label: "黑 E·3",
          scaling: 1.15,
          scalingStat: "atk",
          element: "pyro",
          reaction: "melt",
          snapshot: "hit"
        }
      ],
      energyGains: [
        { target: "durin", amount: 46, offset: 0.75 },
        { target: "nicole", amount: 7, offset: 0.75 },
        { target: "lohen", amount: 4, offset: 0.75 },
        { target: "citlali", amount: 4, offset: 0.75 }
      ]
    },
    {
      id: "nicole-q",
      actorId: "nicole",
      name: "尼可 Q",
      at: 3.15,
      energyCost: 60,
      hits: [
        {
          offset: 1.8,
          label: "Q 初始",
          scaling: 4.8,
          scalingStat: "atk",
          element: "pyro",
          reaction: "melt",
          snapshot: "hit"
        },
        ...[4.8, 7.8, 10.8, 13.8].map((offset, index) => ({
          offset,
          label: `投影 ${index + 1}`,
          scaling: 3.4,
          scalingStat: "atk" as const,
          element: "pyro" as const,
          reaction: "melt" as const,
          snapshot: "hit" as const,
          creditId: "durin",
          flatSources: [
            { ownerId: "nicole", stat: "atk" as const, multiplier: 0.7 }
          ]
        }))
      ]
    },
    {
      id: "durin-q",
      actorId: "durin",
      name: "杜林 黑 Q",
      at: 3.55,
      energyCost: 70,
      hits: [
        {
          offset: 1.62,
          label: "Q 初始·1",
          scaling: 1.85,
          scalingStat: "atk",
          element: "pyro",
          reaction: "melt",
          snapshot: "hit"
        },
        {
          offset: 2.02,
          label: "Q 初始·2",
          scaling: 1.85,
          scalingStat: "atk",
          element: "pyro",
          reaction: "none",
          snapshot: "hit"
        },
        {
          offset: 2.57,
          label: "Q 初始·3",
          scaling: 2.75,
          scalingStat: "atk",
          element: "pyro",
          reaction: "melt",
          snapshot: "hit"
        },
        ...Array.from({ length: 16 }, (_, index) => ({
          offset: 3.15 + index * 1.226,
          label: `黑龙持续 ${index + 1}`,
          scaling: 0.74,
          scalingStat: "atk" as const,
          element: "pyro" as const,
          reaction:
            index === 1 || index === 5 || index === 10 || index === 14
              ? ("none" as const)
              : ("melt" as const),
          snapshot: "hit" as const,
          flatSources: [
            ...(index < 10
              ? [
                  {
                    ownerId: "durin",
                    stat: "atk" as const,
                    multiplier: 1.5
                  }
                ]
              : []),
            ...(index < 8
              ? [
                  {
                    ownerId: "nicole",
                    stat: "atk" as const,
                    multiplier: 0.7
                  }
                ]
              : [])
          ]
        }))
      ]
    },
    {
      id: "lohen-field",
      actorId: "lohen",
      name: "洛恩站场输出",
      at: 6.15,
      hits: Array.from({ length: 14 }, (_, index) => ({
        offset: 0.3 + index * 0.83,
        label:
          index % 3 === 2
            ? `特殊战技 ${Math.floor(index / 3) + 1}`
            : `N1C ${index + 1}`,
        scaling: index % 3 === 2 ? 2.35 : 1.05,
        scalingStat: "atk" as const,
        element: "cryo" as const,
        reaction:
          index === 3 || index === 8 || index === 12
            ? ("reverseMelt" as const)
            : ("none" as const),
        snapshot: "hit" as const,
        flatSources:
          index < 8
            ? [
                {
                  ownerId: "citlali",
                  stat: "em" as const,
                  multiplier: 0.32
                }
              ]
            : []
      })),
      energyGains: [
        { target: "lohen", amount: 28, offset: 7.5 },
        { target: "durin", amount: 8, offset: 7.5 },
        { target: "nicole", amount: 22, offset: 7.5 },
        { target: "citlali", amount: 14, offset: 7.5 }
      ]
    }
  ]
};

export const blankPreset: SimConfig = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  engineVersion: CURRENT_ENGINE_VERSION,
  dataVersion: "1.0.0-template",
  randomSeed: "blank-template",
  meta: {
    name: "空白四人队模板",
    version: "1.0.0-template",
    verificationStatus: "user-supplied",
    note: "用于从零编写角色与循环；示例面板不代表正式数据。"
  },
  duration: 120,
  cycleLength: 20,
  enemy: { level: 110, resistance: 0.1, defReduction: 0 },
  playerDamageModel: { mode: "disabled" },
  targetClockModel: { mode: "disabled" },
  targetTaskModel: { mode: "legacy-event-heap-v1" },
  reactionDeliveryModel: { mode: "deferred-event-heap-v1" },
  characters: [
    {
      id: "a",
      name: "角色 A",
      element: "pyro",
      color: "#ff8b72",
      level: 90,
      energyMax: 60,
      initialEnergy: 0,
      stats: {
        baseAtk: 900,
        atkPct: 1,
        flatAtk: 700,
        baseHp: 12000,
        hpPct: 0,
        flatHp: 0,
        baseDef: 700,
        defPct: 0,
        flatDef: 0,
        em: 100,
        critRate: 0.75,
        critDmg: 1.8,
        dmgBonus: 1,
        defIgnore: 0,
        reactionBonus: 0,
        energyRecharge: 1
      }
    },
    {
      id: "b",
      name: "角色 B",
      element: "cryo",
      color: "#8ed8ff",
      level: 90,
      energyMax: 60,
      initialEnergy: 0,
      stats: {
        baseAtk: 850,
        atkPct: 0.8,
        flatAtk: 600,
        baseHp: 12000,
        hpPct: 0,
        flatHp: 0,
        baseDef: 700,
        defPct: 0,
        flatDef: 0,
        em: 100,
        critRate: 0.65,
        critDmg: 1.5,
        dmgBonus: 0.8,
        defIgnore: 0,
        reactionBonus: 0,
        energyRecharge: 1
      }
    }
  ],
  rotation: [
    {
      id: "a-hit",
      actorId: "a",
      name: "角色 A 技能",
      at: 1,
      hits: [
        {
          offset: 0.5,
          label: "命中 1",
          scaling: 3,
          scalingStat: "atk",
          element: "pyro",
          reaction: "melt",
          snapshot: "hit"
        }
      ]
    }
  ]
};

export const legalTimelineDemoPreset: SimConfig = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  engineVersion: CURRENT_ENGINE_VERSION,
  dataVersion: "m2-frame-demo-1",
  randomSeed: "legal-frame-demo",
  meta: {
    name: "合法帧时间线 · 双角色结构示例",
    version: "m2-frame-demo-1",
    verificationStatus: "provisional",
    note:
      "用于验证 60 FPS 整数帧、切人、取消帧、冷却等待与逐击追踪；行动帧和倍率不是已核验游戏数据。"
  },
  duration: 10,
  cycleLength: 10,
  enemy: { level: 110, resistance: 0.1, defReduction: 0 },
  playerDamageModel: { mode: "disabled" },
  targetClockModel: { mode: "disabled" },
  targetTaskModel: { mode: "legacy-event-heap-v1" },
  reactionDeliveryModel: { mode: "deferred-event-heap-v1" },
  characters: [
    {
      id: "frame-a",
      name: "帧测试 A",
      element: "pyro",
      color: "#ff8b72",
      level: 90,
      energyMax: 60,
      initialEnergy: 60,
      stats: {
        baseAtk: 900,
        atkPct: 0.8,
        flatAtk: 600,
        baseHp: 12000,
        hpPct: 0,
        flatHp: 0,
        baseDef: 700,
        defPct: 0,
        flatDef: 0,
        em: 100,
        critRate: 0.65,
        critDmg: 1.5,
        dmgBonus: 0.8,
        defIgnore: 0,
        reactionBonus: 0,
        energyRecharge: 1
      }
    },
    {
      id: "frame-b",
      name: "帧测试 B",
      element: "cryo",
      color: "#8ed8ff",
      level: 90,
      energyMax: 60,
      initialEnergy: 60,
      stats: {
        baseAtk: 850,
        atkPct: 0.75,
        flatAtk: 550,
        baseHp: 12500,
        hpPct: 0,
        flatHp: 0,
        baseDef: 760,
        defPct: 0,
        flatDef: 0,
        em: 120,
        critRate: 0.6,
        critDmg: 1.4,
        dmgBonus: 0.7,
        defIgnore: 0,
        reactionBonus: 0,
        energyRecharge: 1
      }
    }
  ],
  rotation: [],
  timeline: {
    mode: "legal-frame-v1",
    fps: 60,
    legalityMode: "wait",
    initialActiveCharacterId: "frame-a",
    swapFrames: 12,
    abilities: [
      {
        id: "frame-a-skill",
        actorId: "frame-a",
        name: "A 元素战技",
        kind: "skill",
        cancelFrame: 24,
        animationEndFrame: 42,
        cooldownFrames: 180,
        hits: [
          {
            id: "frame-a-skill-hit",
            frame: 12,
            label: "战技命中",
            scaling: 2.4,
            scalingStat: "atk",
            element: "pyro",
            snapshot: "hit"
          }
        ]
      },
      {
        id: "frame-a-normal",
        actorId: "frame-a",
        name: "A 普通攻击",
        kind: "normal",
        cancelFrame: 20,
        animationEndFrame: 28,
        cooldownFrames: 0,
        hits: [
          {
            id: "frame-a-normal-hit",
            frame: 8,
            label: "普攻命中",
            scaling: 1.1,
            scalingStat: "atk",
            element: "pyro",
            snapshot: "hit"
          }
        ]
      },
      {
        id: "frame-b-skill",
        actorId: "frame-b",
        name: "B 元素战技",
        kind: "skill",
        cancelFrame: 30,
        animationEndFrame: 48,
        cooldownFrames: 120,
        hits: [
          {
            id: "frame-b-skill-hit",
            frame: 18,
            label: "战技命中",
            scaling: 2,
            scalingStat: "atk",
            element: "cryo",
            snapshot: "hit"
          }
        ]
      }
    ],
    commands: [
      {
        type: "skill",
        actorId: "frame-a",
        abilityId: "frame-a-skill"
      },
      {
        type: "normal",
        actorId: "frame-a",
        abilityId: "frame-a-normal"
      },
      { type: "swap", characterId: "frame-b" },
      {
        type: "skill",
        actorId: "frame-b",
        abilityId: "frame-b-skill"
      },
      { type: "wait", frames: 60 },
      {
        type: "skill",
        actorId: "frame-b",
        abilityId: "frame-b-skill"
      },
      { type: "swap", characterId: "frame-a" },
      {
        type: "skill",
        actorId: "frame-a",
        abilityId: "frame-a-skill"
      }
    ]
  }
};

export const auraReactionDemoPreset: SimConfig = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  engineVersion: CURRENT_ENGINE_VERSION,
  dataVersion: "m3-aura-demo-1",
  randomSeed: "aura-reaction-demo",
  meta: {
    name: "Aura / ICD 自动反应 · M3 结构示例",
    version: "m3-aura-demo-1",
    verificationStatus: "provisional",
    note:
      "用于验证冰附着、默认三击/2.5秒 ICD、自动正向融化和敌方 Aura 逐击审计；行动帧、角色面板与倍率均为结构示例，不是已核验游戏数据。"
  },
  duration: 4,
  cycleLength: 4,
  enemy: { level: 110, resistance: 0.1, defReduction: 0 },
  playerDamageModel: { mode: "disabled" },
  targetClockModel: { mode: "disabled" },
  targetTaskModel: { mode: "legacy-event-heap-v1" },
  reactionDeliveryModel: { mode: "deferred-event-heap-v1" },
  characters: legalTimelineDemoPreset.characters.map((character) => ({
    ...character,
    stats: { ...character.stats }
  })),
  rotation: [],
  reactionEngine: {
    mode: "aura-v1"
  },
  timeline: {
    mode: "legal-frame-v1",
    fps: 60,
    legalityMode: "strict",
    initialActiveCharacterId: "frame-b",
    swapFrames: 12,
    abilities: [
      {
        id: "m3-cryo-primer",
        actorId: "frame-b",
        name: "B 冰附着",
        kind: "skill",
        cancelFrame: 20,
        animationEndFrame: 30,
        cooldownFrames: 120,
        hits: [
          {
            id: "m3-cryo-primer-hit",
            frame: 10,
            label: "1U 冰附着",
            scaling: 1,
            scalingStat: "atk",
            element: "cryo",
            application: {
              gaugeUnits: 1,
              icdTag: "none",
              icdGroup: "no-icd"
            },
            snapshot: "hit"
          }
        ]
      },
      {
        id: "m3-pyro-multihit",
        actorId: "frame-a",
        name: "A 四段火伤",
        kind: "skill",
        cancelFrame: 42,
        animationEndFrame: 52,
        cooldownFrames: 180,
        hits: [8, 16, 24, 32].map((frame, index) => ({
          id: `m3-pyro-hit-${index + 1}`,
          frame,
          label: `火伤第 ${index + 1} 段`,
          scaling: 1.2,
          scalingStat: "atk" as const,
          element: "pyro" as const,
          application: {
            gaugeUnits: 1,
            icdTag: "m3-pyro-multihit",
            icdGroup: "default" as const
          },
          snapshot: "hit" as const
        }))
      }
    ],
    commands: [
      {
        type: "skill",
        actorId: "frame-b",
        abilityId: "m3-cryo-primer"
      },
      { type: "swap", characterId: "frame-a" },
      {
        type: "skill",
        actorId: "frame-a",
        abilityId: "m3-pyro-multihit"
      }
    ]
  }
};

export const particleEnergyDemoPreset: SimConfig = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  engineVersion: CURRENT_ENGINE_VERSION,
  dataVersion: "m4-particle-demo-1",
  randomSeed: "particle-energy-demo",
  meta: {
    name: "粒子 / 回能 · M4 结构示例",
    version: "m4-particle-demo-1",
    verificationStatus: "provisional",
    note:
      "用于验证掉球随机数、飞行时间、接球时前后台、同/异色、元素充能效率、固定回能、溢出和爆发门槛；角色面板、帧数与产球范围均为机制示例，不是已核验游戏数据。"
  },
  duration: 4,
  cycleLength: 4,
  enemy: { level: 110, resistance: 0.1, defReduction: 0 },
  playerDamageModel: { mode: "disabled" },
  targetClockModel: { mode: "disabled" },
  targetTaskModel: { mode: "legacy-event-heap-v1" },
  reactionDeliveryModel: { mode: "deferred-event-heap-v1" },
  characters: [
    {
      ...legalTimelineDemoPreset.characters[0]!,
      id: "energy-a",
      name: "回能测试 A",
      initialEnergy: 0,
      stats: {
        ...legalTimelineDemoPreset.characters[0]!.stats,
        energyRecharge: 1.5
      }
    },
    {
      ...legalTimelineDemoPreset.characters[1]!,
      id: "energy-b",
      name: "回能测试 B",
      initialEnergy: 0,
      stats: {
        ...legalTimelineDemoPreset.characters[1]!.stats,
        energyRecharge: 2
      }
    }
  ],
  rotation: [],
  timeline: {
    mode: "legal-frame-v1",
    fps: 60,
    legalityMode: "strict",
    initialActiveCharacterId: "energy-a",
    swapFrames: 12,
    abilities: [
      {
        id: "m4-energy-a-skill",
        actorId: "energy-a",
        name: "A 战技产球",
        kind: "skill",
        cancelFrame: 20,
        animationEndFrame: 32,
        cooldownFrames: 180,
        hits: [
          {
            id: "m4-energy-a-skill-hit",
            frame: 10,
            label: "战技命中",
            scaling: 1.5,
            scalingStat: "atk",
            element: "pyro",
            snapshot: "hit"
          }
        ],
        particles: [
          {
            id: "m4-pyro-particles",
            source: "A 战技示例掉球",
            element: "pyro",
            kind: "particle",
            count: { min: 2, max: 4, step: 1 },
            spawnFrame: 12,
            travelFrames: 30
          }
        ]
      },
      {
        id: "m4-energy-b-burst",
        actorId: "energy-b",
        name: "B 爆发（粒子到达后）",
        kind: "burst",
        cancelFrame: 30,
        animationEndFrame: 46,
        cooldownFrames: 180,
        energyCost: 4,
        hits: [
          {
            id: "m4-energy-b-burst-hit",
            frame: 12,
            label: "爆发命中",
            scaling: 2.2,
            scalingStat: "atk",
            element: "cryo",
            snapshot: "action"
          }
        ],
        energyGains: [
          {
            target: "team",
            amount: 1,
            frame: 5,
            source: "爆发示例固定回能"
          },
          {
            target: "energy-a",
            amount: 50,
            frame: 6,
            source: "A 能量上限溢出示例"
          }
        ]
      }
    ],
    commands: [
      {
        type: "skill",
        actorId: "energy-a",
        abilityId: "m4-energy-a-skill"
      },
      { type: "swap", characterId: "energy-b" },
      { type: "wait", frames: 15 },
      {
        type: "burst",
        actorId: "energy-b",
        abilityId: "m4-energy-b-burst"
      }
    ]
  }
};

export const presets = [
  durinMeltPreset,
  blankPreset,
  legalTimelineDemoPreset,
  auraReactionDemoPreset,
  particleEnergyDemoPreset
] as const;
