import {
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  type SimConfig
} from "@genshin-dps-lab/schemas";

export const durinBlackSkillAuditDisclosure = {
  mappingVersion: "durin-gcsim-b4ae769d7c1c.1",
  simulationStatus: "partial",
  blueprintIds: [
    "durin-enter-essential-transformation",
    "durin-denial-of-darkness"
  ],
  evidence: [
    {
      label: "genshin-db 5.2.12 倍率",
      path: "src/min/data.min.json",
      url: "https://github.com/theBowja/genshin-db/blob/1bab2cdba4d218fd5caa46b5f54e7884ee8359a2/src/min/data.min.json"
    },
    {
      label: "gcsim 杜林技能行为",
      path: "internal/characters/durin/skill.go",
      url: "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/durin/skill.go"
    },
    {
      label: "gcsim ICD Profile",
      path: "pkg/core/attacks/icd_groups.dm.go",
      url: "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/attacks/icd_groups.dm.go"
    },
    {
      label: "gcsim 默认粒子飞行帧",
      path: "pkg/core/player/character/character.go",
      url: "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/character.go"
    }
  ],
  unresolvedMechanics: [
    "精质转变的 6 秒状态窗口尚未由状态机强制执行",
    "不同后续动作对应不同取消帧；本向量只映射接普攻的第 16 帧",
    "命中停顿、队列窗口与输入缓冲尚未建模",
    "精质转变前置状态与黑度之否 30 秒后续状态尚未由状态机强制执行",
    "固定回能的 6 秒内部冷却尚未跨动作建模",
    "产球应只在首次成功命中可受击敌人时触发；当前向量按第 1 段必命中建模",
    "多目标、范围判定、命中停顿、逐后续动作取消帧与输入缓冲尚未建模"
  ]
} as const;

/**
 * Compact runtime projection of the source-audited blueprint.
 *
 * The compiler tests require this payload to remain byte-for-value equivalent
 * to the catalog-resolved blueprint. Keeping it separate prevents the 1.9 MB
 * authoring catalog from entering the browser bundle.
 */
export const durinBlackSkillAuditPreset: SimConfig = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  engineVersion: CURRENT_ENGINE_VERSION,
  dataVersion:
    "gi-6.7-zh-CN.genshin-db-5.2.12.enka-2b9d23b.1+durin-gcsim-b4ae769d7c1c.1",
  randomSeed: "durin-black-e-audit-v1",
  meta: {
    name: "杜林黑 E · 部分机制审计向量",
    version: "1.0.0",
    verificationStatus: "provisional",
    note:
      "只覆盖黑 E 的三段倍率、命中帧、自定义 ICD、单次回能与单次产球；不是完整角色预设，也不是官方验证数据。"
  },
  duration: 3,
  cycleLength: 3,
  enemy: {
    level: 110,
    resistance: 0.1,
    defReduction: 0
  },
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
        baseAtk: 1000,
        atkPct: 0,
        flatAtk: 1000,
        baseHp: 10000,
        hpPct: 0,
        flatHp: 0,
        baseDef: 700,
        defPct: 0,
        flatDef: 0,
        em: 0,
        critRate: 0,
        critDmg: 0.5,
        dmgBonus: 0,
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
    legalityMode: "strict",
    initialActiveCharacterId: "durin",
    swapFrames: 12,
    abilities: [
      {
        id: "durin-enter-essential-transformation",
        actorId: "durin",
        name: "杜林 E：进入精质转变（黑分支审计入口）",
        kind: "skill",
        cancelFrame: 16,
        animationEndFrame: 49,
        cooldownFrames: 720,
        hits: [],
        energyGains: [],
        particles: []
      },
      {
        id: "durin-denial-of-darkness",
        actorId: "durin",
        name: "转变·黑度之否",
        kind: "normal",
        cancelFrame: 41,
        animationEndFrame: 67,
        cooldownFrames: 0,
        hits: [
          {
            id: "durin-black-e-1",
            label: "黑 E 第 1 段",
            frame: 32,
            scaling: 1.30032,
            scalingStat: "atk",
            element: "pyro",
            application: {
              gaugeUnits: 1,
              icdTag: "durin-elemental-art",
              icdGroup: "durin-skill"
            },
            snapshot: "hit"
          },
          {
            id: "durin-black-e-2",
            label: "黑 E 第 2 段",
            frame: 37,
            scaling: 0.9576,
            scalingStat: "atk",
            element: "pyro",
            application: {
              gaugeUnits: 1,
              icdTag: "durin-elemental-art",
              icdGroup: "durin-skill"
            },
            snapshot: "hit"
          },
          {
            id: "durin-black-e-3",
            label: "黑 E 第 3 段",
            frame: 42,
            scaling: 1.16352,
            scalingStat: "atk",
            element: "pyro",
            application: {
              gaugeUnits: 1,
              icdTag: "durin-elemental-art",
              icdGroup: "durin-skill"
            },
            snapshot: "hit"
          }
        ],
        energyGains: [
          {
            target: "durin",
            frame: 0,
            amount: 33,
            source: "durin-skill-state-entry"
          }
        ],
        particles: [
          {
            id: "durin-black-e-particles",
            source: "durin-black-e-first-target-hit",
            element: "pyro",
            kind: "particle",
            count: 4,
            spawnFrame: 32,
            travelFrames: 100
          }
        ]
      }
    ],
    commands: [
      {
        type: "skill",
        actorId: "durin",
        abilityId: "durin-enter-essential-transformation"
      },
      {
        type: "normal",
        actorId: "durin",
        abilityId: "durin-denial-of-darkness"
      }
    ]
  },
  reactionEngine: {
    mode: "aura-v1",
    initialAura: [{ element: "cryo", gaugeUnits: 1 }],
    icdProfiles: {
      "durin-skill": {
        resetFrames: 18,
        applicationSequence: [true, false, false]
      }
    }
  }
};
