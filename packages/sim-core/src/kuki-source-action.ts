import { CURRENT_ENGINE_VERSION, CURRENT_SCHEMA_VERSION, canonicalStringify, type AbilityDefinition, type CharacterProfile, type SimConfig } from "@genshin-dps-lab/schemas";
import { GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID, GCSIM_CALLBACK_BUS_POLICY_V2_ID, GCSIM_CALLBACK_BUS_POLICY_V2_MODE, GCSIM_DAMAGE_GROUP_PROFILE_ID, GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID, GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID, GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE, GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID, GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID } from "@genshin-dps-lab/icd-profiles";
import { CLASSIC_REACTION_FORMULA_PROFILE_ID } from "@genshin-dps-lab/reaction-formulas";
import type { RotationDslMappings } from "./rotation-dsl";
import { compileLegalTimeline } from "./legal-timeline";
import { KUKI_DAMAGE_SOURCE_REFS } from "./kuki-formulas";

const SOURCE_REVISION = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const SOURCE_ROOT = `https://github.com/genshinsim/gcsim/blob/${SOURCE_REVISION}/`;
const PREFIX = "source-kuki:";
const ABILITY_ID = "kuki-skill-sanctifying-ring";
const INITIAL_HIT_ID = "kuki-skill-initial";
const RING_HIT_ID = "kuki-ring-hit";
const SOURCE_REFS = [...KUKI_DAMAGE_SOURCE_REFS, ...["pkg/core/player/player.go", "pkg/core/player/exec.go", "pkg/gcs/parser/parser.go", "pkg/catalog/character.dm.go", "pkg/catalog/weapon.dm.go", "pkg/catalog/curve.dm.go", "pkg/core/player/character/basestat.go"].map((path) => SOURCE_ROOT + path)];

function contract(constellation: 0 | 2) {
  const id = `kuki-ring-c${constellation}-a6-t1-b4ae769-v1`, version = PREFIX + id;
  return {
    id, ruleVersion: version, dataVersion: version, actorId: "kuki", constellation,
    label: `久岐忍 C${constellation} · Lv90/A6/T1 草轮耗血／治疗／伤害来源示例`, status: "source-backed-provisional" as const,
    sourceRevision: SOURCE_REVISION, sourceUrl: SOURCE_REFS[0]!, sourceUrls: SOURCE_REFS,
    evidencePath: "docs/cross-validation/action-library/kuki-source-contract.md", fps: 60,
    scope: `久岐忍Lv90/90、突破6、C${constellation}、天赋1/1/1、钝剑Lv1/20 R1、无圣遗物；明确合成输入+200EM和-5%暴击率至0。安柏Lv1/20、C0/T1、猎弓Lv1/20 R1，只作切换与接治疗。无卡肉/动态属性/附着/外部伤害；两人共享静止位置，单目标始终处于4米草轮范围内。`,
    limitations: [
      "此契约只覆盖固定面板的真实E、合法等待和两角色切换；不认证久岐忍Q、普通/重击、C4追击、C6状态或整角色完整实现。独立伤害计算器的Q和其他命座条件入口仍然保留。",
      "A6同时解锁A1和A4。低突破E初击来源冲突仍未解决，本契约不通过固定A6条件将其宣称为已解决。",
      "E草轮源快照仍有TODO；固定ATK/EM使构造FlatDmg和延迟+2帧快照数值一致，不扩张为动态快照验证。治疗在tick时读取真实角色HP，A1取久岐忍自己的HP而非受治疗角色HP。",
      "源粒子只由草轮伤害确认触发：先锁12帧ICD，再独立45%判定，一枚雷微粒、明确飞行100帧；初击无此回调。随机流可重放，不承诺与gcsim同seed逐抽样一致。",
      "换人使用明确1帧延迟，成功换人后60帧全队换人冷却；来源校验检查真实编译后的输入时点。允许等待与合法切换，不静默无视取消窗或冷却。",
      "治疗、自损和敌人受伤分开记录。初始HP比例是明确可编辑输入，不属于固定天赋数值；不模拟敌方攻击、结晶拾取、其他反应或HP上限变化。",
    ],
    skill: { abilityId: ABILITY_ID, initialHitId: INITIAL_HIT_ID, ringHitId: RING_HIT_ID, initialHitFrame: 11, initialScaling: .75712, ringScaling: .2524, a4DamageEmCoefficient: .25, spawnFrame: 23, durationFrames: constellation === 0 ? 720 : 900, firstTickDelayFrames: 90, intervalFrames: 90, hitDelayFrames: 2, ringTickCount: constellation === 0 ? 8 : 10, cooldownReadyFrame: 907, healingHpCoefficient: .03, healingFlat: 288.8908, a4HealingEmCoefficient: .75, a1ThresholdRatio: .5, a1HealingBonus: .15, particleProbability: .45, particleIcdFrames: 12, particleTravelFrames: 100 },
    swap: { delayFrames: 1, cooldownFrames: 60 },
  };
}

export const KUKI_SKILL_CONTRACT = contract(0);
export const KUKI_SKILL_C2_CONTRACT = contract(2);

export function createKukiSourceAbilities(constellation: 0 | 2 = 0): AbilityDefinition[] {
  const skill = (constellation === 0 ? KUKI_SKILL_CONTRACT : KUKI_SKILL_C2_CONTRACT).skill;
  const commonHit = {
    scalingStat: "atk" as const, element: "electro" as const, snapshot: "hit" as const, critEligible: true,
    flatSources: [{ownerId: "kuki", stat: "em" as const, multiplier: .25}],
    geometry: {kind: "circle" as const, coordinateSpace: "world" as const, origin: {x: 0, y: 0}, radius: 4},
    directDamageGroup: {icdTag: "elemental-art", icdGroup: "default" as const},
    application: {gaugeUnits: 1, icd: {mode: "fixed-gcsim-application-v1" as const, icdTag: "elemental-art", groupId: "default" as const}},
  };
  return [{
    id: ABILITY_ID, actorId: "kuki", name: "越祓雷草之轮 · 真实耗血/周期草轮", kind: "skill",
    cancelFrame: 52, cancelFrames: {normal: 50, skill: 52, burst: 52, dash: 12, jump: 11, swap: 50}, animationEndFrame: 52, cooldownFrames: skill.cooldownReadyFrame,
    healthChanges: [{id: "kuki-skill-hp-cost", label: "越祓雷草之轮消耗当前生命30%，保留最大HP的20%", frameOffset: 0, target: {kind: "self"}, source: {kind: "source", refs: SOURCE_REFS}, operation: "consume", amount: {basis: "target-current-hp", value: .3}, minimumHpRatio: .2}],
    hits: [
      {...commonHit, id: INITIAL_HIT_ID, label: "Sanctifying Ring", frame: skill.initialHitFrame, scaling: skill.initialScaling, strikeType: "blunt", poiseDamage: 30},
      {...commonHit, id: RING_HIT_ID, label: "Grass Ring of Sanctification", frame: 0, scaling: skill.ringScaling},
    ],
    periodicEntities: [{kind: "periodic-active-heal-v1", id: "kuki-ring", label: "越祓草轮", spawnFrame: skill.spawnFrame, durationFrames: skill.durationFrames, firstTickDelayFrames: skill.firstTickDelayFrames, intervalFrames: skill.intervalFrames, hitDelayFrames: skill.hitDelayFrames, hitIds: [RING_HIT_ID], healing: {ownerHpCoefficient: skill.healingHpCoefficient, flat: skill.healingFlat, ownerEmCoefficient: skill.a4HealingEmCoefficient, healingBonus: 0, incomingHealingBonus: 0, lowHpBonus: {thresholdRatio: skill.a1ThresholdRatio, bonus: skill.a1HealingBonus}}, sourceRefs: SOURCE_REFS}],
    particles: [{id: "kuki-ring-particle", source: "越祓草轮实际命中后45%一枚雷微粒", element: "electro", count: 1, travelFrames: skill.particleTravelFrames, trigger: {kind: "hit-confirm", hitIds: [RING_HIT_ID], probability: skill.particleProbability, internalCooldown: {key: "kuki-particle-icd", durationFrames: skill.particleIcdFrames}}}],
  }];
}

function characters(constellation: 0 | 2): CharacterProfile[] {
  return [
    {id: "kuki", name: `久岐忍 C${constellation}/Lv90/A6/T1`, element: "electro", color: "#ab83df", level: 90, energyMax: 60, initialEnergy: 0,
      stats: {baseAtk: 212.397192 + 23.245, atkPct: 0, flatAtk: 0, baseHp: 12288.654441100001, hpPct: .24, flatHp: 0, baseDef: 750.7736775, defPct: 0, flatDef: 0, em: 200, critRate: 0, critDmg: .5, dmgBonus: 0, defIgnore: 0, reactionBonus: 0, energyRecharge: 1}},
    {id: "amber", name: "安柏 C0/Lv1/T1（仅切换接治疗）", element: "pyro", color: "#ef735b", level: 1, energyMax: 40, initialEnergy: 0,
      stats: {baseAtk: 18.6984 + 23.245, atkPct: 0, flatAtk: 0, baseHp: 793.2582, hpPct: 0, flatHp: 0, baseDef: 50.358, defPct: 0, flatDef: 0, em: 0, critRate: .05, critDmg: .5, dmgBonus: 0, defIgnore: 0, reactionBonus: 0, energyRecharge: 1}},
  ];
}

/** Fixed source teaching input. Initial HP is explicit and editable, never inferred from a damage panel. */
export function createKukiSkillScenario(constellation: 0 | 2 = 0): SimConfig {
  const selected = constellation === 0 ? KUKI_SKILL_CONTRACT : KUKI_SKILL_C2_CONTRACT;
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION, engineVersion: CURRENT_ENGINE_VERSION, dataVersion: selected.dataVersion, randomSeed: `kuki-ring-c${constellation}-source-reference-v1`,
    meta: {name: selected.label, version: selected.ruleVersion, verificationStatus: "provisional", note: [selected.scope, ...selected.limitations].join(" ")},
    duration: 16, cycleLength: 16, characters: characters(constellation), rotation: [],
    enemy: {level: 90, resistance: .1, defReduction: 0, targets: [{id: "enemy-0", name: "静止范围内目标", position: {x: 0, y: 2}, hitboxRadius: 2}]},
    timeline: {mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "kuki", swapFrames: 1, abilities: createKukiSourceAbilities(constellation), commands: [
      {type: "skill", actorId: "kuki", abilityId: ABILITY_ID, atFrame: 1},
      {type: "swap", characterId: "amber", atFrame: 51},
      {type: "swap", characterId: "kuki", atFrame: 300},
    ]},
    playerDamageModel: {mode: "reaction-self-v1", position: {x: 0, y: 0}, hitboxRadius: .5, shieldMode: "crystallize-v1", zeroHpPolicy: "clamp-and-continue", characters: ["kuki", "amber"].map((actorId) => ({actorId, initialHpRatio: .5, resistances: {pyro: 0, hydro: 0, electro: 0, cryo: 0, dendro: 0, anemo: 0, geo: 0, physical: 0}}))},
    reactionEngine: {mode: "aura-v3", initialAura: [], icdProfiles: {}},
    targetClockModel: {mode: "disabled"}, targetTaskModel: {mode: "legacy-event-heap-v1"}, reactionDeliveryModel: {mode: "deferred-event-heap-v1"}, electroChargedPropagationModel: {mode: "single-target-v1"},
    reactionFormulaModel: {mode: "classic-formula-profile-v1", profileId: CLASSIC_REACTION_FORMULA_PROFILE_ID}, directDamageGroupModel: {mode: "fixed-gcsim-direct-damage-group-v1", profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID}, elementalApplicationIcdModel: {mode: "fixed-gcsim-elemental-application-v1", profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID}, reactionOwnedElementalApplicationModel: {mode: "fixed-gcsim-reaction-owned-application-v2", policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID}, reactionDamageGroupModel: {mode: "fixed-gcsim-reaction-damage-task-order-v2", policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID}, basicReactionSchedulerModel: {mode: "fixed-gcsim-basic-reaction-scheduler-v2", policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID}, freezeBrokenAttackModel: {mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE, policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID}, callbackBusModel: {mode: GCSIM_CALLBACK_BUS_POLICY_V2_MODE, policyId: GCSIM_CALLBACK_BUS_POLICY_V2_ID},
  };
}

export const claimsKukiSourceContract = (config: SimConfig): boolean => config.dataVersion.startsWith(PREFIX) || config.meta.version.startsWith(PREFIX);
export function getKukiSourceActionContract(config: SimConfig) {
  return [KUKI_SKILL_CONTRACT, KUKI_SKILL_C2_CONTRACT].find((row) => config.dataVersion === row.dataVersion && config.meta.version === row.ruleVersion) ?? null;
}

export function validateKukiSourceActionSequence(config: SimConfig) {
  if (!claimsKukiSourceContract(config)) return {status: "not-applicable" as const, contractId: null, issues: []};
  const selected = getKukiSourceActionContract(config), issues: string[] = [];
  if (config.targetHealthModel !== undefined) issues.push("久岐忍固定来源场景不覆盖有限敌人生命与声明掉落；请先改为自定义场景。");
  if (config.enemyShieldModel !== undefined) issues.push("此固定来源场景不覆盖敌方元素盾；请移除整场来源身份后作为自定义场景使用。");
  if (config.artifactEventModel !== undefined || config.nightsoulBurstModel !== undefined) issues.push("久岐忍固定来源场景不覆盖自定义圣遗物事件与夜魂迸发事件；请先改为自定义场景。");
  if (!selected || config.meta.verificationStatus !== "provisional") return {status: "invalid" as const, contractId: selected?.id ?? null, issues: ["久岐忍来源身份必须匹配C0或C2固定面板契约；不得提升为完整verified角色。"]};
  const expected = createKukiSkillScenario(selected.constellation);
  for (const key of ["characters", "rotation", "enemy", "actorPoses", "normalHitEnergyModel", "favoniusModel", "weaponProcModel", "thrillingTalesModel", "sacrificialModel", "staminaModel", "reactionEngine", "targetClockModel", "targetTaskModel", "elementalApplicationIcdModel", "directDamageGroupModel"] as const) {
    if (canonicalStringify(config[key] ?? null) !== canonicalStringify(expected[key] ?? null)) issues.push(`久岐忍固定来源参考未覆盖修改 ${key}；需独立恢复新配装、范围或机制依据。`);
  }
  const player = config.playerDamageModel, expectedPlayer = expected.playerDamageModel;
  if (player.mode !== "reaction-self-v1" || expectedPlayer.mode !== "reaction-self-v1") issues.push("久岐忍真实耗血/治疗需要启用明确HP状态。");
  else {
    const restoredInitialHp = {...expectedPlayer, characters: expectedPlayer.characters.map((actor) => ({...actor, initialHpRatio: player.characters.find((row) => row.actorId === actor.actorId)?.initialHpRatio}))};
    if (canonicalStringify(player) !== canonicalStringify(restoredInitialHp)) issues.push("固定HP参考仅开放两名已声明角色的实际初始HP比例；位置、抗性与生命上限不可静默改变。");
  }
  const timeline = config.timeline;
  if (!timeline || timeline.mode !== "legal-frame-v1" || timeline.fps !== 60 || timeline.legalityMode !== "strict" || timeline.initialActiveCharacterId !== "kuki" || timeline.swapFrames !== 1 || canonicalStringify(timeline.abilities) !== canonicalStringify(expected.timeline!.abilities)) issues.push("久岐忍E能力、60FPS严格取消时序与1帧切换须符合固定来源。");
  for (const [index, command] of (timeline?.commands ?? []).entries()) {
    if (command.type === "wait" || (command.type === "swap" && ["kuki", "amber"].includes(command.characterId)) || (command.type === "skill" && command.actorId === "kuki" && command.abilityId === ABILITY_ID)) continue;
    issues.push(`commands.${index} 未映射到本契约的E、等待或合法切换；不猜其他动作与额外触发。`);
  }
  if (!issues.length) {
    try {
      let swapReadyFrame = 0;
      for (const command of compileLegalTimeline(config).execution.commandResults) if (command.commandType === "swap" && command.status !== "rejected") {
        if (command.startFrame! < swapReadyFrame) issues.push(`commands.${command.commandIndex} 违反固定来源成功切换后的60帧全队换人冷却。`);
        swapReadyFrame = command.endFrame! + 60;
      }
    } catch (error) { issues.push(error instanceof Error ? error.message : String(error)); }
  }
  return {status: issues.length ? "invalid" as const : "valid" as const, contractId: selected.id, issues};
}

export function deriveKukiSourceRotationMappings(config: SimConfig): RotationDslMappings | null {
  return validateKukiSourceActionSequence(config).status === "valid" ? {aliases: {kuki: {E: ABILITY_ID}}} : null;
}
