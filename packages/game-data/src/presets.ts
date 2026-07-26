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
        reactionBonus: 0.7
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
        reactionBonus: 0
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
        reactionBonus: 0
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
        reactionBonus: 0
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
        reactionBonus: 0
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
        reactionBonus: 0
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

export const presets = [durinMeltPreset, blankPreset] as const;

