import { CURRENT_ENGINE_VERSION, CURRENT_SCHEMA_VERSION, canonicalStringify, type AbilityDefinition, type SimConfig } from "@genshin-dps-lab/schemas";
import { GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID, GCSIM_CALLBACK_BUS_POLICY_V2_ID, GCSIM_CALLBACK_BUS_POLICY_V2_MODE, GCSIM_DAMAGE_GROUP_PROFILE_ID, GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID, GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID, GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE, GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID, GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID } from "@genshin-dps-lab/icd-profiles";
import { CLASSIC_REACTION_FORMULA_PROFILE_ID } from "@genshin-dps-lab/reaction-formulas";
import type { RotationDslMappings } from "./rotation-dsl";
import { NOELLE_BURST_SOURCE_REFS, NOELLE_SOURCE_COMMIT } from "./noelle-formulas";

const VERSION = "source-noelle:burst-normal-c0-t1-b4ae769-v1";
const CONVERSION_KEY = "noelle-burst";
const NORMALS = [
  { scaling: 0.7912, hitFrame: 27, nextNormalFrame: 38, animationLengthFrames: 54 },
  { scaling: 0.73358, hitFrame: 24, nextNormalFrame: 46, animationLengthFrames: 66 },
  { scaling: 0.86258, hitFrame: 19, nextNormalFrame: 31, animationLengthFrames: 72 },
  { scaling: 1.13434, hitFrame: 41, nextNormalFrame: 106, animationLengthFrames: 112 }
] as const;

export const NOELLE_BURST_NORMAL_CONTRACT = {
  id: "noelle-burst-normal-c0-t1-b4ae769-v1", ruleVersion: VERSION, dataVersion: VERSION,
  label: "诺艾尔 C0 · Q→N1–N4 来源示例", actorId: "noelle", status: "fixed-source-assumed" as const,
  sourceRevision: NOELLE_SOURCE_COMMIT, sourceUrl: NOELLE_BURST_SOURCE_REFS[0]!, sourceUrls: NOELLE_BURST_SOURCE_REFS,
  evidencePath: "docs/research/noelle-source-evidence.md", fps: 60,
  scope: "Lv1/20、C0、N/E/Q有效天赋1，Lv1/20 R1训练大剑；无圣遗物、无外部增益、无卡肉，单个静止目标在普通与Q全部攻击范围内。起手Q后连续N1–N4；普攻回能使用明示的独立种子子流。",
  limitations: [
    "fixed-source-assumed：固定源码仍把起手DEF快照与980帧持续时间列为TODO假定，不能标为官方或游戏实测已验证。",
    "Q实际起手读取非Extra DEF并锁定转换值；Q两段在+24/+65读取当前攻击力，均为burst伤害标签。+8真实扣60能量。",
    "转换攻击加成与最终岩附魔均在起手+980帧失效；来源先前的命中范围/ICD判断存在调用次序细节，本样例目标始终在两套范围内，未实现广域几何与卡肉。",
    "普通攻击随机回能实现固定来源概率/失败递增/成功+1/全队12帧间隔；12帧与切人清概率同样是源码TODO假定。独立随机流不宣称与gcsim相同seed逐抽样一致。",
    "仅一次Q、顺序N1→N2→N3→N4→N1及等待；未覆盖E、护盾、治疗、重击、跳跃/冲刺/切人取消、C6延长或被动触发。Lv1未解锁突破被动。"
  ],
  inputs: NORMALS.map((normal, index) => ({ ...normal, abilityId: `noelle-normal-${index + 1}`, input: `N${index + 1}` })),
  burst: { abilityId: "noelle-burst", input: "Q", hitFrames: [24, 65], scaling: [0.672, 0.928], conversionCoefficient: 0.4, durationFrames: 980, energyCost: 60, energyCostFrame: 8 }
};

export function createNoelleSourceAbilities(): AbilityDefinition[] {
  return [{ id: "noelle-burst", actorId: "noelle", name: "大扫除 · 两段Q与DEF转换", kind: "burst", cancelFrame: 121,
    cancelFrames: { normal: 83, charge: 82, skill: 82, dash: 81, jump: 81 }, animationEndFrame: 121, cooldownFrames: 900, energyCost: 60, energyCostFrame: 8,
    statConversions: [{ key: CONVERSION_KEY, label: "大扫除起手DEF→ATK", sourceStat: "def", targetStat: "flatAtk", coefficient: 0.4, durationFrames: 980, snapshotFrame: 0, evidenceStatus: "fixed-source-assumed", sourceRefs: [...NOELLE_BURST_SOURCE_REFS] }],
    hits: [0.672, 0.928].map((scaling, index) => ({ id: `noelle-burst-${index + 1}`, label: index === 0 ? "Sweeping Time (Burst)" : "Sweeping Time (Skill) · 源标签仍为burst", frame: index === 0 ? 24 : 65, scaling, scalingStat: "atk", element: "geo", snapshot: "hit", critEligible: true, strikeType: "blunt", poiseDamage: 150,
      directDamageGroup: { icdTag: "noelle-elemental-burst", icdGroup: "default" }, application: { gaugeUnits: 1, icd: { mode: "fixed-gcsim-application-v1", icdTag: "noelle-elemental-burst", groupId: "default" } } }))
  }, ...NORMALS.map((normal, index): AbilityDefinition => ({ id: `noelle-normal-${index + 1}`, actorId: "noelle", name: `诺艾尔 N${index + 1}`, kind: "normal", cancelFrame: normal.nextNormalFrame, cancelFrames: { normal: normal.nextNormalFrame }, animationEndFrame: normal.animationLengthFrames, cooldownFrames: 0,
    hits: [{ id: `noelle-normal-${index + 1}-hit`, label: `N${index + 1} · 命中时检查大扫除`, frame: normal.hitFrame, scaling: normal.scaling, scalingStat: "atk", element: "physical", snapshot: "hit", critEligible: true, strikeType: "blunt", normalHitEnergyTag: "normal",
      directDamageGroup: { icdTag: "normal-attack", icdGroup: "default" },
      infusion: { statusKey: CONVERSION_KEY, element: "geo", application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" } } } }]
  }))];
}

export function createNoelleBurstNormalScenario(): SimConfig {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION, engineVersion: CURRENT_ENGINE_VERSION, dataVersion: VERSION, randomSeed: "noelle-q-normal-reference-v1",
    meta: { name: NOELLE_BURST_NORMAL_CONTRACT.label, version: VERSION, verificationStatus: "provisional", note: [NOELLE_BURST_NORMAL_CONTRACT.scope, ...NOELLE_BURST_NORMAL_CONTRACT.limitations].join(" ") },
    duration: 6, cycleLength: 6, enemy: { level: 90, resistance: 0.1, defReduction: 0 },
    characters: [{ id: "noelle", name: "诺艾尔 C0/Lv1/T1", element: "geo", color: "#deb94b", level: 1, energyMax: 60, initialEnergy: 60,
      stats: { baseAtk: 16.0272 + 23.245, atkPct: 0, flatAtk: 0, baseHp: 1012.088, hpPct: 0, flatHp: 0, baseDef: 66.95325, defPct: 0, flatDef: 0, em: 0, critRate: 0, critDmg: 0.5, dmgBonus: 0, defIgnore: 0, reactionBonus: 0, energyRecharge: 1 } }],
    rotation: [], timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "noelle", swapFrames: 1, abilities: createNoelleSourceAbilities(), commands: [
      { type: "burst", actorId: "noelle", abilityId: "noelle-burst", atFrame: 1 },
      ...NORMALS.map((_, index) => ({ type: "normal" as const, actorId: "noelle", abilityId: `noelle-normal-${index + 1}` }))
    ] },
    normalHitEnergyModel: { mode: "fixed-source-independent-stream-v1", actors: [{ actorId: "noelle", weaponType: "claymore" }] },
    reactionEngine: { mode: "aura-v3", initialAura: [], icdProfiles: {} },
    playerDamageModel: { mode: "disabled" }, targetClockModel: { mode: "disabled" }, targetTaskModel: { mode: "legacy-event-heap-v1" }, reactionDeliveryModel: { mode: "deferred-event-heap-v1" }, electroChargedPropagationModel: { mode: "single-target-v1" },
    reactionFormulaModel: { mode: "classic-formula-profile-v1", profileId: CLASSIC_REACTION_FORMULA_PROFILE_ID }, directDamageGroupModel: { mode: "fixed-gcsim-direct-damage-group-v1", profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID }, elementalApplicationIcdModel: { mode: "fixed-gcsim-elemental-application-v1", profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID }, reactionOwnedElementalApplicationModel: { mode: "fixed-gcsim-reaction-owned-application-v2", policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID }, reactionDamageGroupModel: { mode: "fixed-gcsim-reaction-damage-task-order-v2", policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID }, basicReactionSchedulerModel: { mode: "fixed-gcsim-basic-reaction-scheduler-v2", policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID }, freezeBrokenAttackModel: { mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE, policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID }, callbackBusModel: { mode: GCSIM_CALLBACK_BUS_POLICY_V2_MODE, policyId: GCSIM_CALLBACK_BUS_POLICY_V2_ID }
  };
}
export function claimsNoelleSourceContract(config: SimConfig): boolean { return config.dataVersion.startsWith("source-noelle:") || config.meta.version.startsWith("source-noelle:"); }
export function getNoelleSourceActionContract(config: SimConfig) { return config.dataVersion === VERSION && config.meta.version === VERSION ? NOELLE_BURST_NORMAL_CONTRACT : null; }
export function validateNoelleSourceActionSequence(config: SimConfig) {
  if (!claimsNoelleSourceContract(config)) return { status: "not-applicable" as const, contractId: null, issues: [] };
  const expected = createNoelleBurstNormalScenario();
  const issues: string[] = [];
  if (config.targetHealthModel !== undefined) issues.push("诺艾尔固定来源场景不覆盖有限敌人生命与声明掉落；请先改为自定义场景。");
  if (config.enemyShieldModel !== undefined) issues.push("此固定来源场景不覆盖敌方元素盾；请移除整场来源身份后作为自定义场景使用。");
  if (config.artifactEventModel !== undefined || config.nightsoulBurstModel !== undefined) issues.push("诺艾尔固定来源场景不覆盖自定义圣遗物事件与夜魂迸发事件；请先改为自定义场景。");
  if (!getNoelleSourceActionContract(config) || config.meta.verificationStatus !== "provisional") issues.push("诺艾尔来源标识须匹配，来源TODO不能提升为verified。");
  for (const key of ["characters", "rotation", "normalHitEnergyModel", "favoniusModel", "weaponProcModel", "thrillingTalesModel", "sacrificialModel", "staminaModel", "reactionEngine", "playerDamageModel", "targetClockModel", "targetTaskModel", "elementalApplicationIcdModel", "directDamageGroupModel"] as const) {
    const actual = config[key], reference = expected[key];
    // Undefined is not a serializable identity. Compare absence explicitly;
    // null or an injected model must not become equivalent to absence.
    const equal = actual === undefined || reference === undefined
      ? actual === reference : canonicalStringify(actual) === canonicalStringify(reference);
    if (!equal) issues.push(`来源参考范围不允许更改 ${key}。`);
  }
  if (!config.timeline || config.timeline.initialActiveCharacterId !== "noelle" || canonicalStringify(config.timeline.abilities) !== canonicalStringify(expected.timeline!.abilities)) issues.push("诺艾尔Q/普攻能力定义与固定来源签名不一致。");
  if (config.actorPoses || config.enemy.targets || config.enemy.targetPhases || config.enemy.targetMotions) issues.push("来源参考只覆盖始终在全部攻击范围内的单个静止目标。");
  let next = 0, burst = false;
  for (const [index, command] of (config.timeline?.commands ?? []).entries()) {
    if (command.type === "wait") continue;
    if (!burst && command.type === "burst" && command.actorId === "noelle" && command.abilityId === "noelle-burst") { burst = true; continue; }
    if (!burst || command.type !== "normal" || command.actorId !== "noelle" || command.abilityId !== `noelle-normal-${next + 1}`) { issues.push(`commands.${index} 必须为一次Q之后的顺序N1→N2→N3→N4→N1；不猜取消与重置。`); break; }
    next = (next + 1) % 4;
  }
  if (!burst) issues.push("来源Q→N配置必须实际输入一次Q。");
  return { status: issues.length ? "invalid" as const : "valid" as const, contractId: NOELLE_BURST_NORMAL_CONTRACT.id, issues };
}
export function deriveNoelleSourceRotationMappings(config: SimConfig): RotationDslMappings | null {
  if (validateNoelleSourceActionSequence(config).status !== "valid") return null;
  return { normalChains: { noelle: NORMALS.map((_, index) => `noelle-normal-${index + 1}`) }, aliases: { noelle: { Q: "noelle-burst" } } };
}
