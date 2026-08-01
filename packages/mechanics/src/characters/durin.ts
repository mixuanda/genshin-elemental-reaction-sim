import { gameDataCatalog } from "@genshin-dps-lab/game-data/catalog";
import {
  CLASSIC_REACTION_FORMULA_PROFILE_ID
} from "@genshin-dps-lab/reaction-formulas";
import {
  CURRENT_ENGINE_VERSION,
  CURRENT_MECHANICS_SCHEMA_VERSION,
  CURRENT_SCHEMA_VERSION,
  type AbilityBlueprint,
  type IcdProfile,
  type MechanicsEvidence,
  type SimConfig,
  type TalentParameterReference
} from "@genshin-dps-lab/schemas";
import {
  compileAbilityBlueprint,
  type CompiledAbilityBlueprint
} from "../compiler";

export const DURIN_MECHANICS_MAPPING_VERSION =
  "durin-gcsim-b4ae769d7c1c.7" as const;

export const DURIN_SKILL_ICD_GROUP = "durin-skill" as const;

export const DURIN_ICD_PROFILES: Record<string, IcdProfile> = {
  [DURIN_SKILL_ICD_GROUP]: {
    resetFrames: 18,
    applicationSequence: [true, false, false]
  }
};

const verifiedAt = "2026-07-26T00:00:00.000Z";
const gcsimCommit = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";

const genshinDbEvidence: MechanicsEvidence = {
  source: "genshin-db",
  sourceVersion: "5.2.12 / 1bab2cdba4d218fd5caa46b5f54e7884ee8359a2",
  url: "https://github.com/theBowja/genshin-db/blob/1bab2cdba4d218fd5caa46b5f54e7884ee8359a2/src/min/data.min.json",
  path: "src/min/data.min.json",
  verifiedAt,
  verificationStatus: "provisional",
  notes:
    "倍率和技能文字来自锁定版本的社区数据；未将其视为米哈游正式验证数据。"
};

const gcsimSkillEvidence: MechanicsEvidence = {
  source: "genshinsim/gcsim",
  sourceVersion: gcsimCommit,
  url: `https://github.com/genshinsim/gcsim/blob/${gcsimCommit}/internal/characters/durin/skill.go`,
  path: "internal/characters/durin/skill.go",
  verifiedAt,
  verificationStatus: "provisional",
  notes:
    "用于交叉核对命中帧、动作帧、冷却、回能和产球；重击复用 ActionAttack 取消点是本引擎的分类映射推断。这是参考实现，不代表官方数据。"
};

const gcsimIcdEvidence: MechanicsEvidence = {
  source: "genshinsim/gcsim",
  sourceVersion: gcsimCommit,
  url: `https://github.com/genshinsim/gcsim/blob/${gcsimCommit}/pkg/core/attacks/icd_groups.dm.go`,
  path: "pkg/core/attacks/icd_groups.dm.go",
  verifiedAt,
  verificationStatus: "provisional",
  notes:
    "用于交叉核对 DurinSkill 的 18 帧重置与 [应用, 不应用, 不应用] 序列。"
};

const gcsimAttackInfoEvidence: MechanicsEvidence = {
  source: "genshinsim/gcsim",
  sourceVersion: gcsimCommit,
  url: `https://github.com/genshinsim/gcsim/blob/${gcsimCommit}/pkg/core/info/combat.go`,
  path: "pkg/core/info/combat.go",
  verifiedAt,
  verificationStatus: "provisional",
  notes:
    "AttackInfo 将 Durability 0 定义为不施加附着；锁定提交的白 E 未设置 Durability，因此本向量按无附着实现，仍需官方或实测交叉验证。"
};

const gcsimParticleDelayEvidence: MechanicsEvidence = {
  source: "genshinsim/gcsim",
  sourceVersion: gcsimCommit,
  url: `https://github.com/genshinsim/gcsim/blob/${gcsimCommit}/pkg/core/player/character/character.go`,
  path: "pkg/core/player/character/character.go",
  verifiedAt,
  verificationStatus: "provisional",
  notes: "用于交叉核对未被角色覆盖时的默认 100 帧粒子飞行延迟。"
};

function durinSkillRef(
  parameterKey: string,
  talentLevel = 10
): TalentParameterReference {
  return {
    talentSetId: "talent-set:durin",
    abilityKey: "combat2",
    parameterKey,
    talentLevel
  };
}

/**
 * First E press. The fallback remains the normal-attack path used by the
 * compact audit vector; supported immediate follow-ups select their own frame.
 */
export const durinEnterTransformationBlueprint: AbilityBlueprint = {
  schemaVersion: CURRENT_MECHANICS_SCHEMA_VERSION,
  mappingVersion: DURIN_MECHANICS_MAPPING_VERSION,
  dataVersion: gameDataCatalog.catalogVersion,
  id: "durin-enter-essential-transformation",
  catalogCharacterId: "character:10000123",
  actorId: "durin",
  name: "杜林 E：进入精质转变（分支审计入口）",
  kind: "skill",
  verificationStatus: "provisional",
  simulationStatus: "partial",
  cancelFrame: 16,
  cancelFrames: {
    normal: 16,
    charge: 16,
    skill: 15,
    burst: 4,
    dash: 14,
    jump: 14,
    swap: 13
  },
  animationEndFrame: 49,
  cooldownFrames: 12 * 60,
  hits: [],
  energyGains: [],
  particles: [],
  timelineState: {
    grants: [
      {
        key: "durin-essential-transformation",
        label: "精质转变",
        durationFrames: 6 * 60
      }
    ]
  },
  prerequisites: [],
  unresolvedMechanics: [
    "冲刺/跳跃命令只接受显式占用帧；耐力、位移、无敌帧、落地和碰撞尚未建模",
    "命中停顿、队列窗口与输入缓冲尚未建模"
  ],
  evidence: [gcsimSkillEvidence]
};

export const durinDenialOfDarknessBlueprint: AbilityBlueprint = {
  schemaVersion: CURRENT_MECHANICS_SCHEMA_VERSION,
  mappingVersion: DURIN_MECHANICS_MAPPING_VERSION,
  dataVersion: gameDataCatalog.catalogVersion,
  id: "durin-denial-of-darkness",
  catalogCharacterId: "character:10000123",
  actorId: "durin",
  name: "转变·黑度之否",
  kind: "normal",
  verificationStatus: "provisional",
  simulationStatus: "partial",
  cancelFrame: 41,
  cancelFrames: {
    normal: 64,
    charge: 64,
    skill: 48,
    burst: 45,
    dash: 42,
    jump: 41,
    swap: 43
  },
  animationEndFrame: 67,
  cooldownFrames: 0,
  hits: [
    {
      id: "durin-black-e-1",
      label: "黑 E 第 1 段",
      frame: 32,
      scalingRef: durinSkillRef("param2"),
      scalingStat: "atk",
      element: "pyro",
      application: {
        gaugeUnits: 1,
        icdTag: "durin-elemental-art",
        icdGroup: DURIN_SKILL_ICD_GROUP
      },
      snapshot: "hit"
    },
    {
      id: "durin-black-e-2",
      label: "黑 E 第 2 段",
      frame: 37,
      scalingRef: durinSkillRef("param3"),
      scalingStat: "atk",
      element: "pyro",
      application: {
        gaugeUnits: 1,
        icdTag: "durin-elemental-art",
        icdGroup: DURIN_SKILL_ICD_GROUP
      },
      snapshot: "hit"
    },
    {
      id: "durin-black-e-3",
      label: "黑 E 第 3 段",
      frame: 42,
      scalingRef: durinSkillRef("param4"),
      scalingStat: "atk",
      element: "pyro",
      application: {
        gaugeUnits: 1,
        icdTag: "durin-elemental-art",
        icdGroup: DURIN_SKILL_ICD_GROUP
      },
      snapshot: "hit"
    }
  ],
  energyGains: [
    {
      target: "durin",
      frame: 0,
      amountRef: durinSkillRef("param5"),
      source: "durin-skill-state-entry",
      internalCooldown: {
        key: "durin-skill-energy-icd",
        durationFrames: 6 * 60
      }
    }
  ],
  particles: [
    {
      id: "durin-black-e-particles",
      source: "durin-black-e-first-target-hit",
      element: "pyro",
      kind: "particle",
      count: 4,
      travelFrames: 100,
      trigger: {
        kind: "hit-confirm",
        hitIds: [
          "durin-black-e-1",
          "durin-black-e-2",
          "durin-black-e-3"
        ],
        internalCooldown: {
          key: "durin-particle-icd",
          durationFrames: 18
        }
      }
    }
  ],
  timelineState: {
    requires: ["durin-essential-transformation"],
    consumes: ["durin-essential-transformation"],
    clears: ["durin-confirmation-of-purity-state"],
    grants: [
      {
        key: "durin-denial-of-darkness-state",
        label: "黑度之否",
        durationFrames: 30 * 60
      }
    ]
  },
  prerequisites: [
    "杜林处于精质转变状态",
    "普攻输入被替换为转变·黑度之否"
  ],
  unresolvedMechanics: [
    "仅支持通用二维形状、静态施放者局部坐标与声明式线性目标移动；杜林真实范围、角色/敌人实战移动和 Boss AI 尚未核验",
    "黑/白爆发、状态驱动被动、命座和装备效果尚未映射"
  ],
  evidence: [
    genshinDbEvidence,
    gcsimSkillEvidence,
    gcsimIcdEvidence,
    gcsimParticleDelayEvidence
  ]
};

export const durinConfirmationOfPurityBlueprint: AbilityBlueprint = {
  schemaVersion: CURRENT_MECHANICS_SCHEMA_VERSION,
  mappingVersion: DURIN_MECHANICS_MAPPING_VERSION,
  dataVersion: gameDataCatalog.catalogVersion,
  id: "durin-confirmation-of-purity",
  catalogCharacterId: "character:10000123",
  actorId: "durin",
  name: "转变·白化之是",
  kind: "skill",
  verificationStatus: "provisional",
  simulationStatus: "partial",
  cancelFrame: 46,
  cancelFrames: {
    normal: 62,
    charge: 62,
    skill: 53,
    burst: 50,
    dash: 46,
    jump: 47,
    swap: 48
  },
  animationEndFrame: 83,
  cooldownFrames: 0,
  hits: [
    {
      id: "durin-white-e",
      label: "白 E",
      frame: 35,
      scalingRef: durinSkillRef("param1"),
      scalingStat: "atk",
      element: "pyro",
      snapshot: "hit"
    }
  ],
  energyGains: [
    {
      target: "durin",
      frame: 0,
      amountRef: durinSkillRef("param5"),
      source: "durin-skill-state-entry",
      internalCooldown: {
        key: "durin-skill-energy-icd",
        durationFrames: 6 * 60
      }
    }
  ],
  particles: [
    {
      id: "durin-white-e-particles",
      source: "durin-white-e-first-target-hit",
      element: "pyro",
      kind: "particle",
      count: 4,
      travelFrames: 100,
      trigger: {
        kind: "hit-confirm",
        hitIds: ["durin-white-e"],
        internalCooldown: {
          key: "durin-particle-icd",
          durationFrames: 18
        }
      }
    }
  ],
  timelineState: {
    requires: ["durin-essential-transformation"],
    consumes: ["durin-essential-transformation"],
    clears: ["durin-denial-of-darkness-state"],
    grants: [
      {
        key: "durin-confirmation-of-purity-state",
        label: "白化之是",
        durationFrames: 30 * 60
      }
    ]
  },
  prerequisites: [
    "杜林处于精质转变状态",
    "元素战技输入被替换为转变·白化之是"
  ],
  unresolvedMechanics: [
    "锁定 gcsim 中白 E 的 Durability 为 0，本向量按无附着实现；该行为尚需官方或实测交叉验证",
    "仅支持通用二维形状、静态施放者局部坐标与声明式线性目标移动；杜林真实范围、角色/敌人实战移动和 Boss AI 尚未核验",
    "黑/白爆发、状态驱动被动、命座和装备效果尚未映射"
  ],
  evidence: [
    genshinDbEvidence,
    gcsimSkillEvidence,
    gcsimAttackInfoEvidence,
    gcsimParticleDelayEvidence
  ]
};

export function compileDurinBlackSkillAuditAbilities(): {
  enterTransformation: CompiledAbilityBlueprint;
  denialOfDarkness: CompiledAbilityBlueprint;
} {
  return {
    enterTransformation: compileAbilityBlueprint(
      durinEnterTransformationBlueprint,
      { catalog: gameDataCatalog, allowPartial: true }
    ),
    denialOfDarkness: compileAbilityBlueprint(
      durinDenialOfDarknessBlueprint,
      { catalog: gameDataCatalog, allowPartial: true }
    )
  };
}

export function compileDurinWhiteSkillAuditAbilities(): {
  enterTransformation: CompiledAbilityBlueprint;
  confirmationOfPurity: CompiledAbilityBlueprint;
} {
  return {
    enterTransformation: compileAbilityBlueprint(
      durinEnterTransformationBlueprint,
      { catalog: gameDataCatalog, allowPartial: true }
    ),
    confirmationOfPurity: compileAbilityBlueprint(
      durinConfirmationOfPurityBlueprint,
      { catalog: gameDataCatalog, allowPartial: true }
    )
  };
}

export interface DurinBlackSkillAuditConfigOptions {
  damageBonus?: number;
  initialCryoAura?: boolean;
}

/**
 * A deliberately tiny, executable source-audit vector. It is not a complete
 * Durin preset and must stay labelled provisional until every prerequisite and
 * unresolved mechanic above is implemented.
 */
export function createDurinBlackSkillAuditConfig(
  options: DurinBlackSkillAuditConfigOptions = {}
): SimConfig {
  const compiled = compileDurinBlackSkillAuditAbilities();
  const initialCryoAura = options.initialCryoAura ?? true;
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    engineVersion: CURRENT_ENGINE_VERSION,
    reactionFormulaModel: {
      mode: "classic-formula-profile-v1",
      profileId: CLASSIC_REACTION_FORMULA_PROFILE_ID
    },
    dataVersion: `${gameDataCatalog.catalogVersion}+${DURIN_MECHANICS_MAPPING_VERSION}`,
    randomSeed: "durin-black-e-audit-v1",
    meta: {
      name: "杜林黑 E · 部分机制审计向量",
      version: "1.0.0",
      verificationStatus: "provisional",
      note:
        "只覆盖精质转变前置/状态转换、黑 E 三段倍率、命中帧、自定义附着 ICD、带 6 秒共享冷却的固定回能与单次产球；不是完整角色预设，也不是官方验证数据。"
    },
    duration: 3,
    cycleLength: 3,
    enemy: {
      level: 110,
      resistance: 0.1,
      defReduction: 0
    },
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
          dmgBonus: options.damageBonus ?? 0,
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
        compiled.enterTransformation.ability,
        compiled.denialOfDarkness.ability
      ],
      commands: [
        {
          type: "skill",
          actorId: "durin",
          abilityId: compiled.enterTransformation.ability.id
        },
        {
          type: "normal",
          actorId: "durin",
          abilityId: compiled.denialOfDarkness.ability.id
        },
        {
          type: "dash",
          actorId: "durin",
          frames: 1
        }
      ]
    },
    electroChargedPropagationModel: {
      mode: "single-target-v1"
    },
    reactionEngine: {
      mode: "aura-v1",
      ...(initialCryoAura
        ? {
            initialAura: [{ element: "cryo" as const, gaugeUnits: 1 }]
          }
        : {}),
      icdProfiles: DURIN_ICD_PROFILES
    }
  };
}

export interface DurinWhiteSkillAuditConfigOptions {
  damageBonus?: number;
  initialCryoAura?: boolean;
}

/**
 * Source-audit vector for the white recast branch only. It intentionally
 * excludes burst, passives, constellations, weapons, and artifact effects.
 */
export function createDurinWhiteSkillAuditConfig(
  options: DurinWhiteSkillAuditConfigOptions = {}
): SimConfig {
  const compiled = compileDurinWhiteSkillAuditAbilities();
  const initialCryoAura = options.initialCryoAura ?? true;
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    engineVersion: CURRENT_ENGINE_VERSION,
    reactionFormulaModel: {
      mode: "classic-formula-profile-v1",
      profileId: CLASSIC_REACTION_FORMULA_PROFILE_ID
    },
    dataVersion: `${gameDataCatalog.catalogVersion}+${DURIN_MECHANICS_MAPPING_VERSION}`,
    randomSeed: "durin-white-e-audit-v1",
    meta: {
      name: "杜林白 E · 部分机制审计向量",
      version: "1.0.0",
      verificationStatus: "provisional",
      note:
        "只覆盖精质转变前置/状态转换、白 E 单段倍率、命中帧、锁定 gcsim 的无附着口径、带 6 秒共享冷却的固定回能与命中产球；不是完整角色预设，也不是官方验证数据。"
    },
    duration: 3,
    cycleLength: 3,
    enemy: {
      level: 110,
      resistance: 0.1,
      defReduction: 0
    },
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
          dmgBonus: options.damageBonus ?? 0,
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
        compiled.enterTransformation.ability,
        compiled.confirmationOfPurity.ability
      ],
      commands: [
        {
          type: "skill",
          actorId: "durin",
          abilityId: compiled.enterTransformation.ability.id
        },
        {
          type: "skill",
          actorId: "durin",
          abilityId: compiled.confirmationOfPurity.ability.id
        },
        {
          type: "dash",
          actorId: "durin",
          frames: 1
        }
      ]
    },
    electroChargedPropagationModel: {
      mode: "single-target-v1"
    },
    reactionEngine: {
      mode: "aura-v1",
      ...(initialCryoAura
        ? {
            initialAura: [{ element: "cryo" as const, gaugeUnits: 1 }]
          }
        : {})
    }
  };
}
