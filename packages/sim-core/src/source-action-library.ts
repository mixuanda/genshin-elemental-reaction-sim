import { claimsKukiSourceContract, getKukiSourceActionContract, validateKukiSourceActionSequence, deriveKukiSourceRotationMappings, KUKI_SKILL_CONTRACT } from "./kuki-source-action";
export { createKukiSkillScenario, createKukiSourceAbilities, KUKI_SKILL_CONTRACT, KUKI_SKILL_C2_CONTRACT } from "./kuki-source-action";
import { claimsKukiSkillBurstSourceContract, getKukiSkillBurstSourceActionContract, validateKukiSkillBurstSourceActionSequence, validateKukiSkillBurstSourceExecution, deriveKukiSkillBurstSourceRotationMappings, KUKI_SKILL_BURST_CONTRACT } from "./kuki-burst-source-action";
export { createKukiSkillBurstScenario, createKukiSkillBurstAbilities, KUKI_SKILL_BURST_CONTRACT, KUKI_SKILL_BURST_C2_CONTRACT } from "./kuki-burst-source-action";
import { claimsNoelleSourceContract, getNoelleSourceActionContract, validateNoelleSourceActionSequence, deriveNoelleSourceRotationMappings, NOELLE_BURST_NORMAL_CONTRACT } from "./noelle-source-action";
import {
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  canonicalStringify,
  sourceNormalStateScopeConflicts,
  type AbilityDefinition,
  type CharacterProfile,
  type SimConfig,
  type SimulationOptions,
  type TimelineExecution
} from "@genshin-dps-lab/schemas";
import {
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
  GCSIM_CALLBACK_BUS_POLICY_V2_ID,
  GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
  GCSIM_DAMAGE_GROUP_PROFILE_ID,
  GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID
} from "@genshin-dps-lab/icd-profiles";
import { CLASSIC_REACTION_FORMULA_PROFILE_ID } from "@genshin-dps-lab/reaction-formulas";
import type { RotationDslMappings } from "./rotation-dsl";
import { NORMAL_HIT_ENERGY_PROFILE } from "./normal-hit-energy";
import { compileSourceRuntimeAbility } from "./source-runtime-abilities";
import { sourceNormalChainDefinitions } from "./source-normal-chain";
import { updateStatus } from "../../game-data/src/update-status";

const CONTRACT_PREFIX = "source-action-library:";
const CONTRACT_ID = "amber-normal-c0-t1-b4ae769-v1";
const CONTRACT_VERSION = `${CONTRACT_PREFIX}${CONTRACT_ID}`;
const SOURCE_REVISION = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const SOURCE_ROOT = `https://github.com/genshinsim/gcsim/blob/${SOURCE_REVISION}`;
const SKILL_BURST_ID = "amber-expiry-eq-c0-t1-b4ae769-v1";
const SKILL_BURST_VERSION = `${CONTRACT_PREFIX}${SKILL_BURST_ID}`;
const SKILL_BURST_ENERGY_ID = "amber-expiry-eq-normal-energy-c0-t1-b4ae769-v2";
const SKILL_BURST_ENERGY_VERSION = `${CONTRACT_PREFIX}${SKILL_BURST_ENERGY_ID}`;

function freeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** This is a narrow source contract, not a verified complete character build. */
export const AMBER_NORMAL_CHAIN_CONTRACT = freeze({
  id: CONTRACT_ID,
  ruleVersion: CONTRACT_VERSION,
  dataVersion: CONTRACT_VERSION,
  label: "安柏 C0 · Lv1/T1 普攻 N1–N5 来源示例",
  actorId: "amber",
  status: "source-backed-provisional" as const,
  sourceRevision: SOURCE_REVISION,
  sourceUrl: `${SOURCE_ROOT}/internal/characters/amber/attack.go#L14-L68`,
  evidencePath: "docs/cross-validation/action-library/amber-normal-contract.json",
  fps: 60,
  scope: "安柏 C0、1/20 级、普攻天赋 1；猎弓 1/20 级 R1；无圣遗物、无增益、无攻速、无卡肉；仅连续物理普攻。暴击率额外 -5% 至 0，以对齐外部确定性样例。",
  limitations: [
    "不是完整安柏实现；不提供 E/Q、重击、瞄准、闪避、跳跃、切人或这些动作的普攻重置。",
    "来源在箭发射时快照，再飞行 10 帧。本地命中快照仅在固定无增益面板下数值等价；动态增益、插件与目标状态变化被拒绝。",
    "只支持本契约的固定 Lv1/C0/T1/猎弓面板；突破被动在此等级未解锁，其他被动和命座不声称覆盖。",
    "首条输入显式置于第 1 帧，与 gcsim 样例一致；改为第 0 帧是用户更改输入时点，并非静默平移。",
    "定义动画末帧保存来源 AnimationLength=N；后续普攻在 >=N 可开始，无后续动作时来源仅在 >N 的下一帧进入 Idle。末次 N5 输入 120，后续普攻可在 180，自然 Idle 为 181。",
    "每个 N 是一次输入。当前安柏 C0 每次输入有一个命中；N5 表示依次执行 N1 至 N5，不能代指第 5 个伤害数字。"
  ],
  inputs: [
    { abilityId: "amber-normal-1", input: "N1", scaling: 0.3612, snapshotFrame: 14, hitFrame: 24, nextNormalFrame: 26, animationLengthFrames: 26 },
    { abilityId: "amber-normal-2", input: "N2", scaling: 0.3612, snapshotFrame: 10, hitFrame: 20, nextNormalFrame: 22, animationLengthFrames: 22 },
    { abilityId: "amber-normal-3", input: "N3", scaling: 0.4644, snapshotFrame: 27, hitFrame: 37, nextNormalFrame: 37, animationLengthFrames: 37 },
    { abilityId: "amber-normal-4", input: "N4", scaling: 0.473, snapshotFrame: 26, hitFrame: 36, nextNormalFrame: 34, animationLengthFrames: 34 },
    { abilityId: "amber-normal-5", input: "N5", scaling: 0.5934, snapshotFrame: 26, hitFrame: 36, nextNormalFrame: 60, animationLengthFrames: 60 }
  ]
});

/** Complete listed ordinary hits under an expiry-only, stationary target context. */
export const AMBER_SKILL_BURST_LEGACY_CONTRACT = freeze({
  id: SKILL_BURST_ID, ruleVersion: SKILL_BURST_VERSION, dataVersion: SKILL_BURST_VERSION,
  label: "安柏 C0 · Lv1/T1 点按E自然到期 / Q 来源示例", actorId: "amber",
  status: "source-backed-provisional" as const, sourceRevision: SOURCE_REVISION,
  sourceUrl: `${SOURCE_ROOT}/internal/characters/amber/bunny.go#L116-L207`,
  sourceUrls: ["skill.go", "bunny.go", "burst.go"].map((path) => `${SOURCE_ROOT}/internal/characters/amber/${path}`),
  evidencePath: "docs/cross-validation/action-library/amber-skill-burst-contract.json", fps: 60,
  scope: "安柏C0、Lv1/20、N/E/Q天赋1、猎弓Lv1/20 R1、无圣遗物/增益/卡肉、额外-5%暴击至0；单个静止目标处于所有伤害范围。E只支持兔兔伯爵自然到期；Q为来源的18个箭雨命中。",
  limitations: [
    "不是完整安柏：未实现兔兔伯爵HP、受击击破、冻结/位移、C2手动/超载引爆、长按投掷、C4双兔或C6增益。",
    "兔在+45生成并快照，+529自然到期，+530爆炸；source爆炸圆心来自生成时玩家位置，不冒称采用兔当前位置。固定范围内静止目标，不模拟随机箭雨几何或范围外丢失。",
    "Q在起手快照，+59扣40能量，18个命中位于+84至+192；不是注释中误称的+72首击。E命中后100帧收到4个火元素微粒；未命中不产球。",
    "只开放普通链、点按E、Q和等待。E/Q重置普通连段；等待不重置。闪避、跳跃、切人和重击没有动作定义。",
    "新契约仅允许首次Q之前的普通攻击：此时初始40能量已满，来源普攻随机回能溢出；Q之后的普通随机回能尚无规则，故其普通输入被明确阻塞。旧纯N1–N5来源入口仍可独立使用。",
    "冷却ready使用来源延迟加时长：E为5+900=905帧，Q为56+720=776帧；当前未单独模拟冷却开始回调。",
    "固定无增益面板；普通箭的发射/命中快照数值等价边界与原N契约相同。不得给动态增益、插件或其他队友沿用此来源认证。"
  ],
  skill: { abilityId: "amber-skill-tap-expiry", input: "E.tap", scaling: 1.232, spawnFrame: 45, lifetimeFrames: 484, expiryFrame: 529, hitFrame: 530, snapshotFrame: 45, particleCount: 4, particleTravelFrames: 100 },
  burst: { abilityId: "amber-burst-fiery-rain", input: "Q", scaling: 0.2808, snapshotFrame: 0, energyCost: 40, energyCostFrame: 59,
    hitFrames: [...[24, 48, 72, 96, 120], ...[36, 72, 108], ...[12, 24, 36, 48, 60, 72, 84, 96, 108, 120]].map((frame) => frame + 72) }
});

/** v1 imports retain their original no-energy-model semantics and signatures.
 * v2 restores ordinary-hit energy with an explicitly independent RNG stream. */
export const AMBER_SKILL_BURST_CONTRACT = freeze({
  ...AMBER_SKILL_BURST_LEGACY_CONTRACT,
  id: SKILL_BURST_ENERGY_ID, ruleVersion: SKILL_BURST_ENERGY_VERSION, dataVersion: SKILL_BURST_ENERGY_VERSION,
  label: "安柏 C0 · Lv1/T1 点按E / Q / 普攻来源示例",
  scope: `${AMBER_SKILL_BURST_LEGACY_CONTRACT.scope} Q后可继续N1–N5，实际普通命中按固定来源概率模型回能；使用可复现的独立随机子流，不与gcsim同seed随机序列作等同声明。`,
  sourceUrls: [...AMBER_SKILL_BURST_LEGACY_CONTRACT.sourceUrls, NORMAL_HIT_ENERGY_PROFILE.sourceRef],
  // The retained E/Q archive is the numerical damage baseline, not a v2 RNG golden.
  normalHitEnergyProfile: NORMAL_HIT_ENERGY_PROFILE.id,
  normalHitEnergyMatchesGcsimRandomSequence: false,
  limitations: [
    ...AMBER_SKILL_BURST_LEGACY_CONTRACT.limitations.filter((limit) => !limit.startsWith("新契约仅允许首次Q之前")),
    "普攻回能使用独立带名称的种子子流；本地相同输入可复现，不能把本地抽样值当作固定gcsim同seed的随机结果。旧E/Q存档仅用于伤害与确定性时序基线。",
    "固定来源对成功后共享12帧回能间隔、换人重置概率仍有TODO假设，状态与实际能量入账均保存审计；这些机制保持provisional。",
    "旧E/Q v1仍不启用普攻回能，继续拒绝Q后普通输入；载入旧身份不会自动改成v2。"
  ]
});

function isSkillBurstContract(id: string | undefined): boolean {
  return id === SKILL_BURST_ID || id === SKILL_BURST_ENERGY_ID;
}

function createAbilities(normalHitEnergy = false): AbilityDefinition[] {
  return AMBER_NORMAL_CHAIN_CONTRACT.inputs.map((input) => ({
    id: input.abilityId,
    actorId: AMBER_NORMAL_CHAIN_CONTRACT.actorId,
    name: `安柏 ${input.input}`,
    kind: "normal",
    // The normal-followup interval is NOT the earlier CanQueueAfter frame.
    cancelFrame: input.nextNormalFrame,
    cancelFrames: {
      normal: input.nextNormalFrame,
      skill: input.snapshotFrame,
      burst: input.snapshotFrame,
      dash: input.snapshotFrame,
      jump: input.snapshotFrame,
      swap: input.snapshotFrame
    },
    // This is upstream AnimationLength; unreplaced source state becomes idle
    // only on > AnimationLength. A next normal is legal at >= its cancel frame.
    animationEndFrame: input.animationLengthFrames,
    cooldownFrames: 0,
    hits: [{
      id: `${input.abilityId}-hit`,
      label: `${input.input} 物理箭`,
      frame: input.hitFrame,
      scaling: input.scaling,
      scalingStat: "atk",
      element: "physical",
      snapshot: "hit",
      critEligible: true,
      ...(normalHitEnergy ? { normalHitEnergyTag: "normal" as const } : {}),
      directDamageGroup: { icdTag: "none", icdGroup: "amber" }
    }]
  }));
}

function createCharacter(): CharacterProfile {
  return {
    id: "amber", name: "安柏 C0 / Lv1 / T1", element: "pyro", color: "#ef735b",
    level: 1, energyMax: 40, initialEnergy: 40,
    stats: {
      baseAtk: 18.6984 + 23.245, atkPct: 0, flatAtk: 0,
      baseHp: 793.2582, hpPct: 0, flatHp: 0,
      baseDef: 50.358, defPct: 0, flatDef: 0,
      em: 0, critRate: 0, critDmg: 0.5, dmgBonus: 0,
      defIgnore: 0, reactionBonus: 0, energyRecharge: 1
    }
  };
}

function createSkillBurstAbilities(normalHitEnergy = false): AbilityDefinition[] {
  const skill = AMBER_SKILL_BURST_CONTRACT.skill, burst = AMBER_SKILL_BURST_CONTRACT.burst;
  const hitId = `${skill.abilityId}-hit`;
  return [...createAbilities(normalHitEnergy), {
    id: skill.abilityId, actorId: "amber", name: "兔兔伯爵 · 点按自然到期", kind: "skill",
    cancelFrame: 33, cancelFrames: { normal: 32, skill: 33, burst: 32, dash: 8, jump: 8, swap: 23 },
    animationEndFrame: 33, cooldownFrames: 905,
    summons: [{ id: "amber-baron-bunny-expiry", label: "兔兔伯爵（仅自然到期）", spawnFrame: skill.spawnFrame, lifetimeFrames: skill.lifetimeFrames, expiryAttackDelayFrames: 1, hitIds: [hitId] }],
    hits: [{ id: hitId, label: "兔兔伯爵自然爆炸", frame: skill.hitFrame, scaling: skill.scaling, scalingStat: "atk", element: "pyro", strikeType: "blunt", poiseDamage: 260, snapshot: "action", critEligible: true,
      application: { gaugeUnits: 2, icd: { mode: "no-icd-v1" } }, directDamageGroup: { icdTag: "none", icdGroup: "default" } }],
    particles: [{ id: "amber-bunny-particles", source: "兔兔伯爵命中", element: "pyro", count: skill.particleCount, travelFrames: skill.particleTravelFrames, trigger: { kind: "hit-confirm", hitIds: [hitId] } }]
  }, {
    id: burst.abilityId, actorId: "amber", name: "箭雨 · 全18个来源命中", kind: "burst",
    cancelFrame: 111, cancelFrames: { normal: 111, skill: 111, burst: 111, dash: 57, jump: 58, swap: 60 },
    animationEndFrame: 111, cooldownFrames: 776, energyCost: burst.energyCost, energyCostFrame: burst.energyCostFrame,
    hits: burst.hitFrames.map((frame, index) => ({ id: `${burst.abilityId}-hit-${index + 1}`, label: `箭雨源队列第${index + 1}段`, frame, scaling: burst.scaling, scalingStat: "atk", element: "pyro", snapshot: "action", critEligible: true,
      application: { gaugeUnits: 1, icd: { mode: "fixed-gcsim-application-v1", icdTag: "amber-elemental-burst", groupId: "amber" } }, directDamageGroup: { icdTag: "amber-elemental-burst", icdGroup: "amber" } }))
  }];
}

/** Fresh editable copy; one source N5 chain, matching the external 4 s fixture. */
export function createAmberNormalChainScenario(): SimConfig {
  const abilities = createAbilities();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    engineVersion: CURRENT_ENGINE_VERSION,
    dataVersion: CONTRACT_VERSION,
    randomSeed: "amber-normal-chain-reference-v1",
    meta: {
      name: AMBER_NORMAL_CHAIN_CONTRACT.label,
      version: CONTRACT_VERSION,
      verificationStatus: "provisional",
      note: `${AMBER_NORMAL_CHAIN_CONTRACT.scope} ${AMBER_NORMAL_CHAIN_CONTRACT.limitations.join(" ")}`
    },
    duration: 4,
    cycleLength: 4,
    enemy: { level: 90, resistance: 0.1, defReduction: 0 },
    characters: [createCharacter()],
    rotation: [],
    timeline: {
      mode: "legal-frame-v1", fps: 60, legalityMode: "strict",
      initialActiveCharacterId: "amber",
      // Schema-required sentinel. No swap is permitted by this contract, so
      // this value is never executed and makes no claim about Amber swap time.
      swapFrames: 1,
      abilities,
      commands: abilities.map((ability, index) => ({
        type: "normal", actorId: "amber", abilityId: ability.id,
        ...(index === 0 ? { atFrame: 1 } : {})
      }))
    },
    playerDamageModel: { mode: "disabled" },
    targetClockModel: { mode: "disabled" },
    targetTaskModel: { mode: "legacy-event-heap-v1" },
    reactionDeliveryModel: { mode: "deferred-event-heap-v1" },
    electroChargedPropagationModel: { mode: "single-target-v1" },
    reactionFormulaModel: { mode: "classic-formula-profile-v1", profileId: CLASSIC_REACTION_FORMULA_PROFILE_ID },
    directDamageGroupModel: { mode: "fixed-gcsim-direct-damage-group-v1", profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID },
    elementalApplicationIcdModel: { mode: "fixed-gcsim-elemental-application-v1", profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID },
    reactionOwnedElementalApplicationModel: { mode: "fixed-gcsim-reaction-owned-application-v2", policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID },
    reactionDamageGroupModel: { mode: "fixed-gcsim-reaction-damage-task-order-v2", policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID },
    basicReactionSchedulerModel: { mode: "fixed-gcsim-basic-reaction-scheduler-v2", policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID },
    freezeBrokenAttackModel: { mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE, policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID },
    callbackBusModel: { mode: GCSIM_CALLBACK_BUS_POLICY_V2_MODE, policyId: GCSIM_CALLBACK_BUS_POLICY_V2_ID }
  };
}

export function createAmberSkillBurstScenario(version: "current" | "legacy-v1" = "current"): SimConfig {
  const normalHitEnergy = version === "current";
  const contract = normalHitEnergy ? AMBER_SKILL_BURST_CONTRACT : AMBER_SKILL_BURST_LEGACY_CONTRACT;
  const config = createAmberNormalChainScenario();
  config.dataVersion = contract.dataVersion;
  config.meta = { name: contract.label, version: contract.ruleVersion, verificationStatus: "provisional", note: `${contract.scope} ${contract.limitations.join(" ")}` };
  config.randomSeed = normalHitEnergy ? "amber-expiry-eq-normal-energy-reference-v2" : "amber-expiry-eq-reference-v1";
  config.duration = 12; config.cycleLength = 12;
  config.timeline!.abilities = createSkillBurstAbilities(normalHitEnergy);
  config.timeline!.commands = [
    { type: "skill", actorId: "amber", abilityId: AMBER_SKILL_BURST_CONTRACT.skill.abilityId, atFrame: 1 },
    { type: "burst", actorId: "amber", abilityId: AMBER_SKILL_BURST_CONTRACT.burst.abilityId }
  ];
  config.reactionEngine = { mode: "aura-v1", initialAura: [], icdProfiles: {} };
  if (normalHitEnergy) config.normalHitEnergyModel = { mode: "fixed-source-independent-stream-v1", actors: [{ actorId: "amber", weaponType: "bow" }] };
  return config;
}

const expectedAbilities = createAbilities();
const expectedAbilitySignatures = new Map(expectedAbilities.map((ability) => [ability.id, canonicalStringify(ability)]));
const expectedSkillBurstAbilities = createSkillBurstAbilities();
const expectedSkillBurstSignatures = new Map(expectedSkillBurstAbilities.map((ability) => [ability.id, canonicalStringify(ability)]));
const expectedSkillBurstEnergyAbilities = createSkillBurstAbilities(true);
const expectedSkillBurstEnergySignatures = new Map(expectedSkillBurstEnergyAbilities.map((ability) => [ability.id, canonicalStringify(ability)]));

/** Identity lookup for UI disclosure; validation still checks all source signatures. */
export function getSourceActionContract(config: SimConfig): typeof AMBER_NORMAL_CHAIN_CONTRACT | typeof AMBER_SKILL_BURST_CONTRACT | typeof AMBER_SKILL_BURST_LEGACY_CONTRACT | typeof NOELLE_BURST_NORMAL_CONTRACT | typeof KUKI_SKILL_CONTRACT | typeof KUKI_SKILL_BURST_CONTRACT | null {
  if (claimsKukiSkillBurstSourceContract(config)) return getKukiSkillBurstSourceActionContract(config);
  if (claimsKukiSourceContract(config)) return getKukiSourceActionContract(config);
  if (claimsNoelleSourceContract(config)) return getNoelleSourceActionContract(config);
  if (config.dataVersion !== config.meta.version) return null;
  if (config.dataVersion === CONTRACT_VERSION) return AMBER_NORMAL_CHAIN_CONTRACT;
  if (config.dataVersion === SKILL_BURST_VERSION) return AMBER_SKILL_BURST_LEGACY_CONTRACT;
  if (config.dataVersion === SKILL_BURST_ENERGY_VERSION) return AMBER_SKILL_BURST_CONTRACT;
  return null;
}

function claimsSourceContract(config: SimConfig): boolean {
  return config.dataVersion.startsWith(CONTRACT_PREFIX) || config.meta.version.startsWith(CONTRACT_PREFIX);
}

/** Pure metadata/data check; no simulator import or character-name dispatch. */
function contractIssues(config: SimConfig): string[] {
  const issues: string[] = [];
  if (config.targetHealthModel !== undefined) issues.push("固定来源动作未覆盖有限敌人生命与声明掉落；请移除来源场景身份后作为自定义场景使用。");
  if (config.enemyShieldModel !== undefined) issues.push("此固定来源场景不覆盖敌方元素盾；请移除整场来源身份后作为自定义场景使用。");
  if (config.artifactEventModel !== undefined || config.nightsoulBurstModel !== undefined) issues.push("固定来源动作未覆盖自定义圣遗物事件与夜魂迸发事件；请先改为自定义场景。");
  const contract = getSourceActionContract(config);
  if (!contract) {
    return ["来源动作契约标识未知或不一致；dataVersion 与 meta.version 必须匹配已注册契约。"];
  }
  const skillBurst = isSkillBurstContract(contract.id);
  const normalHitEnergy = contract.id === SKILL_BURST_ENERGY_ID;
  const abilities = normalHitEnergy ? expectedSkillBurstEnergyAbilities : skillBurst ? expectedSkillBurstAbilities : expectedAbilities;
  const signatures = normalHitEnergy ? expectedSkillBurstEnergySignatures : skillBurst ? expectedSkillBurstSignatures : expectedAbilitySignatures;
  if (config.staminaModel !== undefined) issues.push("当前安柏固定来源动作尚未声明完整耐力时序，不能添加耐力模型后保留原契约身份。");
  if (config.favoniusModel !== undefined) issues.push("当前安柏来源契约固定使用猎弓，不可添加西风被动后继续沿用该来源身份。");
  if (config.weaponProcModel !== undefined) issues.push("当前安柏来源契约固定使用猎弓，不可添加独立武器追击后继续沿用该来源身份。");
  if (config.thrillingTalesModel !== undefined) issues.push("当前安柏来源契约固定使用猎弓，不可添加讨龙持有者后继续沿用该来源身份。");
  if (config.sacrificialModel !== undefined) issues.push("当前安柏来源契约固定使用猎弓，不可添加祭礼冷却重置后继续沿用该来源身份。");
  if (config.meta.verificationStatus !== "provisional") issues.push("固定 gcsim 参考契约只可标注 provisional，不能提升为完整已验证角色。");
  const timeline = config.timeline;
  if (!timeline || timeline.mode !== "legal-frame-v1" || timeline.fps !== 60 || timeline.initialActiveCharacterId !== AMBER_NORMAL_CHAIN_CONTRACT.actorId) {
    return [...issues, "来源动作必须使用 60 FPS 合法时间线和契约指定的初始角色。"];
  }
  if (timeline.abilities.length !== abilities.length || timeline.abilities.some((ability) => signatures.get(ability.id) !== canonicalStringify(ability)) || new Set(timeline.abilities.map((ability) => ability.id)).size !== abilities.length) {
    issues.push("能力定义与来源签名不符；不能更改倍率、命中、快照、召唤寿命、能量或取消帧后保留来源标记。");
  }
  const actor = config.characters[0];
  if (skillBurst && actor?.initialEnergy !== 40) issues.push("此E/Q契约要求初始40能量；不能静默忽略普攻随机回能或改写资源上下文。");
  if (normalHitEnergy) {
    const expectedModel = { mode: "fixed-source-independent-stream-v1", actors: [{ actorId: "amber", weaponType: "bow" }] };
    if (canonicalStringify(config.normalHitEnergyModel) !== canonicalStringify(expectedModel)) issues.push("安柏E/Q/普攻v2必须使用固定来源弓角色的独立随机回能子流，不能修改角色或武器概率身份。");
  } else if (config.normalHitEnergyModel !== undefined) issues.push("旧安柏来源契约不包含普攻随机回能模型；如需此规则必须显式选择v2来源身份。");
  const expected = createCharacter();
  if (config.characters.length !== 1 || !actor || actor.id !== expected.id || actor.element !== expected.element || actor.level !== expected.level || actor.energyMax !== expected.energyMax || canonicalStringify(actor.stats) !== canonicalStringify(expected.stats)) {
    issues.push("此来源契约限固定 Lv1/C0/T1/猎弓无增益面板（额外 -5% 暴击率）；其他配装和队友未覆盖。");
  }
  if (config.rotation.length !== 0) issues.push("来源动作仅从合法时间线执行，不接受附加旧式 rotation 事件。");
  const reactionMismatch = skillBurst ? canonicalStringify(config.reactionEngine) !== canonicalStringify({ mode: "aura-v1", initialAura: [], icdProfiles: {} }) : config.reactionEngine !== undefined;
  if (reactionMismatch || (config.actorPoses?.length ?? 0) > 0 || config.enemy.targets !== undefined || config.enemy.targetPhases !== undefined || config.enemy.targetMotions !== undefined) {
    issues.push("此来源样例仅覆盖单个静止目标，无光环、目标阶段、几何或移动模型。");
  }
  if (skillBurst && (config.elementalApplicationIcdModel.mode !== "fixed-gcsim-elemental-application-v1" || config.elementalApplicationIcdModel.profileId !== GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID)) issues.push("E/Q必须使用固定来源的无ICD/Amber数值附着序列。");
  if (config.playerDamageModel.mode !== "disabled" || config.targetClockModel.mode !== "disabled" || config.targetTaskModel.mode !== "legacy-event-heap-v1") {
    issues.push("此来源契约未覆盖自伤、卡肉或目标任务模型。");
  }
  if (config.directDamageGroupModel.mode !== "fixed-gcsim-direct-damage-group-v1" || config.directDamageGroupModel.profileId !== GCSIM_DAMAGE_GROUP_PROFILE_ID) {
    issues.push("Amber 伤害序列必须使用已固定的 gcsim 组倍率配置。");
  }
  return issues;
}

/** Only matching explicit contracts receive shorthand; IDs/names alone do not. */
export function deriveSourceBackedRotationMappings(config: SimConfig): RotationDslMappings | null {
  if (config.sourceAbilityBindings?.length) return deriveComposableSourceRotationMappings(config);
  if (claimsKukiSkillBurstSourceContract(config)) return deriveKukiSkillBurstSourceRotationMappings(config);
  if (claimsKukiSourceContract(config)) return deriveKukiSourceRotationMappings(config);
  if (claimsNoelleSourceContract(config)) return deriveNoelleSourceRotationMappings(config);
  if (!claimsSourceContract(config) || contractIssues(config).length > 0) return null;
  return { normalChains: { [AMBER_NORMAL_CHAIN_CONTRACT.actorId]: AMBER_NORMAL_CHAIN_CONTRACT.inputs.map((input) => input.abilityId) },
    ...(isSkillBurstContract(getSourceActionContract(config)?.id) ? { aliases: { amber: { E: AMBER_SKILL_BURST_CONTRACT.skill.abilityId, "E.tap": AMBER_SKILL_BURST_CONTRACT.skill.abilityId, Q: AMBER_SKILL_BURST_CONTRACT.burst.abilityId } } } : {}) };
}

export interface SourceActionValidation {
  status: "not-applicable" | "valid" | "invalid";
  contractId: string | null;
  issues: string[];
}

/** Display labels may change; source execution fields remain bound per ability.
 * Character panels, other party members and unrelated abilities are not part
 * of this signature. Legacy fixed-scenario contracts retain their own checks. */
function sourceAbilityExecutionSignature(ability: AbilityDefinition): string {
  const copy = structuredClone(ability);
  delete (copy as Partial<AbilityDefinition>).name;
  for (const hit of copy.hits ?? []) delete hit.label;
  for (const buff of copy.buffs ?? []) delete buff.label;
  return canonicalStringify(copy);
}

export function validateComposableSourceAbilities(config: SimConfig): SourceActionValidation {
  const bindings = config.sourceAbilityBindings;
  if (!bindings?.length) return { status: "not-applicable", contractId: null, issues: [] };
  const issues: string[] = [], timeline = config.timeline;
  const actorSources = new Map<string, { characterSlug: string; ascension: number; constellation: number }>();
  const normalTalentLevels = new Map<string, number>();
  const boundIds = new Set<string>(), actorActions = new Set<string>();
  if (config.meta.verificationStatus === "verified") issues.push("本批来源能力仍为provisional，不能将带有这些绑定的场景标为verified。");
  const selectedUnreleased = [...updateStatus.previewSnapshots, ...updateStatus.candidateSnapshots, ...updateStatus.archivedSnapshots]
    .find(snapshot => (snapshot.releaseStatus === "preview" || snapshot.releaseStatus === "official-next") &&
      (config.dataVersion === snapshot.snapshotId || config.dataVersion === snapshot.label));
  if (selectedUnreleased) issues.push(`来源能力固定使用已发布目录核对的数值，不能与明确选择的${selectedUnreleased.releaseStatus}快照${selectedUnreleased.snapshotId}混用。`);
  if (!timeline || timeline.mode !== "legal-frame-v1" || timeline.fps !== 60) issues.push("可组合来源能力必须使用60 FPS合法时间线。");
  if (config.reactionEngine?.mode !== "aura-v3") issues.push("本批可组合来源能力需要aura-v3实际执行所声明的附着与普通反应；请明确采用来源所需规则，不能把缺失Aura当无反应。");
  if (config.reactionEngine?.debugAllowReactionOverride === true) issues.push("可组合来源能力不能用调试反应覆盖替代实际光环状态；请明确关闭debugAllowReactionOverride。");
  if (claimsSourceContract(config) || claimsNoelleSourceContract(config) || claimsKukiSourceContract(config) || claimsKukiSkillBurstSourceContract(config)) {
    issues.push("可组合来源绑定不能沿用旧整场固定来源场景身份；请明确建立可编辑场景，旧契约不会静默迁移。");
  }
  for (const [index, binding] of bindings.entries()) {
    const path = `sourceAbilityBindings.${index}`;
    if (boundIds.has(binding.abilityId)) issues.push(`${path}：同一abilityId只能绑定一次来源。`);
    boundIds.add(binding.abilityId);
    const actorAction = `${binding.actorId}:${binding.sourceActionId}`;
    if (actorActions.has(actorAction)) issues.push(`${path}：同一角色不能用不同abilityId重复绑定同一来源动作，从而绕过其冷却。`);
    actorActions.add(actorAction);
    let compiled: ReturnType<typeof compileSourceRuntimeAbility>;
    try { compiled = compileSourceRuntimeAbility(binding); }
    catch (error) { issues.push(`${path}：${error instanceof Error ? error.message : String(error)}`); continue; }
    if (binding.registryVersion !== compiled.binding.registryVersion) issues.push(`${path}：来源注册版本不匹配，不能借新定义执行旧绑定。`);
    const actor = config.characters.find(row => row.id === binding.actorId), requirement = compiled.requirements;
    if (!actor) issues.push(`${path}：绑定角色不存在。`);
    else {
      if (actor.element !== requirement.element) issues.push(`${path}：角色元素应为${requirement.element}，不能把其他角色仅改名称充当来源角色。`);
      if (actor.energyMax !== requirement.energyMax) issues.push(`${path}：来源角色能量上限为${requirement.energyMax}；初始能量仍由用户明确设置。`);
    }
    const previous = actorSources.get(binding.actorId);
    if (previous && (previous.characterSlug !== requirement.characterSlug || previous.ascension !== binding.ascension || previous.constellation !== binding.constellation)) {
      issues.push(`${path}：同一角色的来源身份、突破阶段和命座必须一致；不同能力天赋等级可以分别设置。`);
    }
    actorSources.set(binding.actorId, { characterSlug: requirement.characterSlug, ascension: binding.ascension, constellation: binding.constellation });
    const actual = timeline?.abilities.find(row => row.id === binding.abilityId);
    if (!actual || sourceAbilityExecutionSignature(actual) !== sourceAbilityExecutionSignature(compiled.ability)) {
      issues.push(`${path}：所选能力的倍率、命中、实际取样、能量、冷却、附着或取消帧已偏离来源定义；可编辑名称，或解除绑定后作为自定义能力。`);
    }
    if (requirement.targetScope === "single-stationary-in-range" && ((config.enemy.targets?.length ?? 1) !== 1 || (config.enemy.targetMotions?.length ?? 0) > 0)) {
      issues.push(`${path}：当前来源能力限定单个静止且在范围内的目标；未把来源简化接触推广为多目标或运动几何。`);
    }
    if (requirement.hitlag === "disabled" && config.targetClockModel.mode !== "disabled") issues.push(`${path}：当前来源能力未认证卡肉／暂停目标时钟，需要明确禁用该时钟。`);
    if (requirement.capabilities.includes("fixed-source-elemental-application-v1") &&
        (config.elementalApplicationIcdModel.mode !== "fixed-gcsim-elemental-application-v1" || config.elementalApplicationIcdModel.profileId !== GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID)) {
      issues.push(`${path}：需要固定来源元素附着ICD模型，不能静默使用另一附着规则。`);
    }
    if (requirement.capabilities.includes("fixed-source-direct-damage-group-v1") &&
        (config.directDamageGroupModel.mode !== "fixed-gcsim-direct-damage-group-v1" || config.directDamageGroupModel.profileId !== GCSIM_DAMAGE_GROUP_PROFILE_ID)) {
      issues.push(`${path}：需要固定来源直接伤害组倍率模型。`);
    }
    if (requirement.capabilities.includes("source-normal-chain-v1")) {
      const previousTalent = normalTalentLevels.get(binding.actorId);
      if (previousTalent !== undefined && previousTalent !== binding.talentLevel) issues.push(`${path}：同一来源普攻连段的有效普攻天赋必须一致。`);
      normalTalentLevels.set(binding.actorId, binding.talentLevel);
      if (config.normalHitEnergyModel?.mode !== "fixed-source-independent-stream-v1" ||
          !config.normalHitEnergyModel.actors.some(actor => actor.actorId === binding.actorId && actor.weaponType === requirement.weaponType)) {
        issues.push(`${path}：来源普攻需要显式固定来源普攻随机回能及正确武器类型，不能把未配置随机回能当作零。`);
      }
    }
  }
  try { sourceNormalChainDefinitions(bindings); }
  catch (error) { issues.push(error instanceof Error ? error.message : String(error)); }
  for (const conflict of sourceNormalStateScopeConflicts(config)) issues.push(`timeline.commands.${conflict.commandIndex}：${conflict.actorId} 的${conflict.scope === "fischl-no-oz-v1" ? "整场无奥兹范围不接受E/Q输入" : "整场无玄掷玲珑范围不接受Q输入"}；请解除限定来源绑定后明确实现该状态，不能忽略它。`);
  return { status: issues.length ? "invalid" : "valid", contractId: "composable-source-abilities", issues };
}

/** Shared public-execution and captured-hit restore gate, without a whole-team
 * panel signature or a new scheduler. */
export function assertComposableSourceAbilities(config: SimConfig, options: SimulationOptions & { plugins?: readonly unknown[] } = {}): void {
  const validation = validateComposableSourceAbilities(config);
  if (validation.status === "not-applicable") return;
  const issues = [...validation.issues];
  if (options.compatibilityMode === "legacy-v0.1") issues.push("可组合来源能力需要legal-frame-v1真实帧与取样顺序。");
  if (options.plugins?.length) issues.push("来源能力的执行字段绑定尚未覆盖运行时插件修改；请解除绑定后运行插件场景。");
  if (issues.length) throw new Error(`可组合来源能力校验失败：${issues.join(" ")}`);
}

export function deriveComposableSourceRotationMappings(config: SimConfig): RotationDslMappings | null {
  if (validateComposableSourceAbilities(config).status !== "valid") return null;
  const aliases: NonNullable<RotationDslMappings["aliases"]> = {};
  for (const binding of config.sourceAbilityBindings!) {
    const { ability } = compileSourceRuntimeAbility(binding);
    const alias = ability.kind === "burst" ? "Q" : ability.kind === "skill" ? "E" : null;
    if (alias === null) continue;
    const sameKind = config.timeline!.abilities.filter(row => row.actorId === ability.actorId && row.kind === ability.kind);
    // An unbound variant is still executable; an ambiguous shorthand must not
    // silently prefer the sourced variant over a user's explicit definition.
    if (sameKind.length === 1) (aliases[ability.actorId] ??= {})[alias] = ability.id;
  }
  const chains = sourceNormalChainDefinitions(config.sourceAbilityBindings);
  return { aliases, normalChains: Object.fromEntries(chains.map(chain => [chain.actorId, chain.abilityIds])),
    normalChainSemantics: Object.fromEntries(chains.map(chain => [chain.actorId, "accepted-input-default-reset-v1" as const])) };
}

/** Checks the true ordered input chain, never damage-hit count. Timing legality
 * is still enforced by the shared legal timeline compiler when executing. */
export function validateSourceBackedNormalSequence(config: SimConfig): SourceActionValidation {
  if (config.sourceAbilityBindings?.length) return validateComposableSourceAbilities(config);
  if (claimsKukiSkillBurstSourceContract(config)) return validateKukiSkillBurstSourceActionSequence(config);
  if (claimsKukiSourceContract(config)) return validateKukiSourceActionSequence(config);
  if (claimsNoelleSourceContract(config)) return validateNoelleSourceActionSequence(config);
  if (!claimsSourceContract(config)) return { status: "not-applicable", contractId: null, issues: [] };
  const issues = contractIssues(config);
  const contract = getSourceActionContract(config);
  const skillBurst = isSkillBurstContract(contract?.id);
  const legacySkillBurst = contract?.id === SKILL_BURST_ID;
  let nextInput = 0;
  let burstUsed = false;
  for (const [index, command] of (config.timeline?.commands ?? []).entries()) {
    if (skillBurst && command.type === "wait") continue;
    if (skillBurst && (command.type === "skill" || command.type === "burst") && command.actorId === "amber"
      && command.abilityId === (command.type === "skill" ? AMBER_SKILL_BURST_CONTRACT.skill.abilityId : AMBER_SKILL_BURST_CONTRACT.burst.abilityId)) {
      nextInput = 0;
      if (command.type === "burst") burstUsed = true;
      continue;
    }
    if (legacySkillBurst && command.type === "normal" && burstUsed) {
      issues.push(`commands.${index}：Q之后的普攻随机回能尚未映射，不能把其能量贡献默认为零；此参考契约只支持满能时的Q前普攻。`);
      break;
    }
    const expected = AMBER_NORMAL_CHAIN_CONTRACT.inputs[nextInput]!;
    if (command.type !== "normal" || command.actorId !== AMBER_NORMAL_CHAIN_CONTRACT.actorId || command.abilityId !== expected.abilityId) {
      issues.push(`commands.${index} 必须为 ${expected.abilityId}。仅支持连续 N1→N2→N3→N4→N5→N1；不猜测其他动作的重置规则。`);
      break;
    }
    nextInput = (nextInput + 1) % AMBER_NORMAL_CHAIN_CONTRACT.inputs.length;
  }
  return { status: issues.length === 0 ? "valid" : "invalid", contractId: contract?.id ?? null, issues };
}

export const validateSourceBackedActionSequence = validateSourceBackedNormalSequence;

/** Called by the public simulate entry, so imported JSON/workers cannot bypass
 * scope or combo validation. Plugins are rejected without importing simulator. */
export function assertSourceActionContract(
  config: SimConfig,
  options: SimulationOptions & { plugins?: readonly unknown[] } = {}
): void {
  assertComposableSourceAbilities(config, options);
  if (config.sourceAbilityBindings?.length) return;
  const validation = validateSourceBackedNormalSequence(config);
  if (validation.status === "not-applicable") return;
  const issues = [...validation.issues];
  if ((options.plugins?.length ?? 0) > 0) issues.push("来源动作的静态面板等价性不覆盖运行时插件。");
  if (options.compatibilityMode === "legacy-v0.1") issues.push("来源动作必须使用 legal-frame-v1 执行语义。");
  if (options.execution?.lunarCharged || options.execution?.lunarCrystallize || options.execution?.lunarBloom || options.execution?.stellarConduct || options.execution?.stellarSwirl) issues.push("此来源动作契约不覆盖特殊反应执行配置。");
  if (issues.length > 0) throw new Error(`来源动作契约校验失败：${issues.join(" ")}`);
}

/** Source-specific timing consumes the shared compiler's actual accepted/rejected actions. */
export function assertSourceActionExecution(config: SimConfig, execution: TimelineExecution): void {
  const validation = validateKukiSkillBurstSourceExecution(config, execution);
  if (validation.status === "invalid") throw new Error(`来源动作执行校验失败：${validation.issues.join(" ")}`);
}
