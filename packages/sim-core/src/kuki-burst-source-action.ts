import { canonicalStringify, type AbilityDefinition, type SimConfig, type TimelineExecution } from "@genshin-dps-lab/schemas";
import type { RotationDslMappings } from "./rotation-dsl";
import { createKukiSkillScenario, createKukiSourceAbilities, KUKI_SKILL_CONTRACT, KUKI_SKILL_C2_CONTRACT } from "./kuki-source-action";

const PREFIX = "source-kuki-eq:";
const BURST_ID = "kuki-burst-gyoei-narukami";
const SOURCE_ROOT = `https://github.com/genshinsim/gcsim/blob/${KUKI_SKILL_CONTRACT.sourceRevision}/`;
const SOURCE_REFS = ["internal/characters/kuki/burst.go", "pkg/simulation/run.go", "pkg/core/core.go", "pkg/core/player/character/energy.go"].map((path) => SOURCE_ROOT + path);

function contract(constellation: 0 | 2) {
  const skillContract = constellation === 0 ? KUKI_SKILL_CONTRACT : KUKI_SKILL_C2_CONTRACT;
  const id = `kuki-eq-c${constellation}-a6-t1-b4ae769-v1`, version = PREFIX + id;
  return {
    ...skillContract, id, ruleVersion: version, dataVersion: version,
    label: `久岐忍 C${constellation} · E治疗后真实起手HP决定Q的7／12击`,
    sourceUrl: SOURCE_REFS[0]!, sourceUrls: [...skillContract.sourceUrls, ...SOURCE_REFS],
    evidencePath: "docs/cross-validation/action-library/kuki-burst-source-contract.md",
    scope: `${skillContract.scope} E/Q在同帧既有任务完成后执行；Q以真实起手HP锁定7或12击，一次起手快照，+4帧消耗60能量。初始能量与初始HP是明确可编辑输入。`,
    limitations: [
      "此契约限固定面板的E、Q、合法等待和两角色切换；不认证普通/重击、C4追击、C6状态或整角色完整实现。旧E-only来源身份仍按原规则执行，不自动升级。",
      ...skillContract.limitations.slice(1),
      "Q以主目标的固定位置(0,2)为圆心，C0半径4，C2包含C1半径6；来源假定目标足够接近，未覆盖远距离中心选择或移动目标。",
      "Q起手HP≤50%时12击，否则7击；来源count注释写11而可执行代码明确12。命中间隔是Go整数除法120/7=17帧，不采用显示总倍率的独立舍入值。",
      "默认E@1、切安柏@51、切回久岐忍@300、Q@564；该帧既有草轮先治疗，使久岐忍HP从低于50%升到高于50%，随后Q选择7击。改为Q@563则读取治疗前实际HP，选择12击。",
    ],
    burst: {abilityId: BURST_ID, conditionId: "kuki-burst-low-hp", scaling: .036048, thresholdRatio: .5, highHpHits: 7, lowHpHits: 12, hitFrames: Array.from({length: 12}, (_, index) => 50 + 17 * index), snapshotFrame: 0, energyCost: 60, energyCostFrame: 4, cooldownReadyFrame: 900, radius: constellation === 0 ? 4 : 6},
  };
}

export const KUKI_SKILL_BURST_CONTRACT = contract(0);
export const KUKI_SKILL_BURST_C2_CONTRACT = contract(2);

export function createKukiSkillBurstAbilities(constellation: 0 | 2 = 0): AbilityDefinition[] {
  const burst = (constellation === 0 ? KUKI_SKILL_BURST_CONTRACT : KUKI_SKILL_BURST_C2_CONTRACT).burst;
  return [...createKukiSourceAbilities(constellation).map((ability) => ({...ability, actionPhase: "after-frame-tasks-v1" as const})), {
    id: burst.abilityId, actorId: "kuki", name: "御咏鸣神刈山祭 · 真实起手HP分支", kind: "burst",
    actionPhase: "after-frame-tasks-v1", cancelFrame: 63, cancelFrames: {normal: 62, skill: 62, burst: 63, dash: 63, jump: 63, swap: 62}, animationEndFrame: 63,
    cooldownFrames: burst.cooldownReadyFrame, energyCost: burst.energyCost, energyCostFrame: burst.energyCostFrame,
    conditionalHitGroups: [{id: burst.conditionId, kind: "owner-hp-at-action-v1", comparison: "lte", thresholdRatio: burst.thresholdRatio, hitIds: burst.hitFrames.slice(7).map((_, index) => `${burst.abilityId}-hit-${index + 8}`), sourceRefs: SOURCE_REFS}],
    hits: burst.hitFrames.map((frame, index) => ({
      id: `${burst.abilityId}-hit-${index + 1}`, label: `御咏鸣神刈山祭 第${index + 1}击`, frame, scaling: burst.scaling, scalingStat: "hp", element: "electro", snapshot: "action", critEligible: true,
      geometry: {kind: "circle", coordinateSpace: "world", origin: {x: 0, y: 2}, radius: burst.radius},
      directDamageGroup: {icdTag: "elemental-burst", icdGroup: "default"},
      application: {gaugeUnits: 1, icd: {mode: "fixed-gcsim-application-v1", icdTag: "elemental-burst", groupId: "default"}},
    })),
  }];
}

/** Fresh source scenario: runtime HP at the accepted Q input selects its hits. */
export function createKukiSkillBurstScenario(constellation: 0 | 2 = 0): SimConfig {
  const selected = constellation === 0 ? KUKI_SKILL_BURST_CONTRACT : KUKI_SKILL_BURST_C2_CONTRACT;
  const config = createKukiSkillScenario(constellation);
  config.dataVersion = selected.dataVersion;
  config.meta = {name: selected.label, version: selected.ruleVersion, verificationStatus: "provisional", note: [selected.scope, ...selected.limitations].join(" ")};
  config.randomSeed = `kuki-eq-c${constellation}-source-reference-v1`;
  config.characters[0]!.initialEnergy = 60;
  config.timeline!.abilities = createKukiSkillBurstAbilities(constellation);
  config.timeline!.commands.push({type: "burst", actorId: "kuki", abilityId: BURST_ID, atFrame: 564});
  return config;
}

export const claimsKukiSkillBurstSourceContract = (config: SimConfig): boolean => config.dataVersion.startsWith(PREFIX) || config.meta.version.startsWith(PREFIX);
export function getKukiSkillBurstSourceActionContract(config: SimConfig) {
  return [KUKI_SKILL_BURST_CONTRACT, KUKI_SKILL_BURST_C2_CONTRACT].find((row) => config.dataVersion === row.dataVersion && config.meta.version === row.ruleVersion) ?? null;
}

export function validateKukiSkillBurstSourceActionSequence(config: SimConfig) {
  if (!claimsKukiSkillBurstSourceContract(config)) return {status: "not-applicable" as const, contractId: null, issues: []};
  const selected = getKukiSkillBurstSourceActionContract(config), issues: string[] = [];
  if (config.targetHealthModel !== undefined) issues.push("久岐忍E/Q固定来源场景不覆盖有限敌人生命与声明掉落；请先改为自定义场景。");
  if (config.enemyShieldModel !== undefined) issues.push("此固定来源场景不覆盖敌方元素盾；请移除整场来源身份后作为自定义场景使用。");
  if (config.artifactEventModel !== undefined || config.nightsoulBurstModel !== undefined) issues.push("久岐忍E/Q固定来源场景不覆盖自定义圣遗物事件与夜魂迸发事件；请先改为自定义场景。");
  if (!selected || config.meta.verificationStatus !== "provisional") return {status: "invalid" as const, contractId: selected?.id ?? null, issues: ["久岐忍E/Q来源身份必须匹配C0或C2固定面板契约；不得提升为完整verified角色。"]};
  const expected = createKukiSkillBurstScenario(selected.constellation);
  const expectedCharacters = expected.characters.map((actor) => ({...actor, initialEnergy: config.characters.find((row) => row.id === actor.id)?.initialEnergy ?? actor.initialEnergy}));
  if (canonicalStringify(config.characters) !== canonicalStringify(expectedCharacters) || config.characters.some((actor) => !Number.isFinite(actor.initialEnergy) || actor.initialEnergy < 0 || actor.initialEnergy > actor.energyMax)) issues.push("久岐忍E/Q固定角色面板只开放0至能量上限内的初始能量；角色、装备和其他属性须符合来源。");
  for (const key of ["rotation", "enemy", "actorPoses", "normalHitEnergyModel", "favoniusModel", "weaponProcModel", "thrillingTalesModel", "sacrificialModel", "staminaModel", "reactionEngine", "targetClockModel", "targetTaskModel", "elementalApplicationIcdModel", "directDamageGroupModel"] as const) {
    if (canonicalStringify(config[key] ?? null) !== canonicalStringify(expected[key] ?? null)) issues.push(`久岐忍E/Q固定来源参考未覆盖修改 ${key}；需独立恢复新配装、范围或机制依据。`);
  }
  const player = config.playerDamageModel, expectedPlayer = expected.playerDamageModel;
  if (player.mode !== "reaction-self-v1" || expectedPlayer.mode !== "reaction-self-v1") issues.push("久岐忍E/Q真实起手HP分支需要启用明确HP状态。");
  else {
    const restoredInitialHp = {...expectedPlayer, characters: expectedPlayer.characters.map((actor) => ({...actor, initialHpRatio: player.characters.find((row) => row.actorId === actor.actorId)?.initialHpRatio ?? actor.initialHpRatio}))};
    if (canonicalStringify(player) !== canonicalStringify(restoredInitialHp)) issues.push("固定HP参考仅开放两名已声明角色的实际初始HP比例；位置、抗性与生命上限不可静默改变。");
  }
  const timeline = config.timeline;
  if (!timeline || timeline.mode !== "legal-frame-v1" || timeline.fps !== 60 || timeline.legalityMode !== "strict" || timeline.initialActiveCharacterId !== "kuki" || timeline.swapFrames !== 1 || canonicalStringify(timeline.abilities) !== canonicalStringify(expected.timeline!.abilities)) issues.push("久岐忍E/Q能力、真实任务后起手相位、60FPS严格取消时序与1帧切换须符合固定来源。");
  for (const [index, command] of (timeline?.commands ?? []).entries()) {
    if (command.type === "wait" || (command.type === "swap" && ["kuki", "amber"].includes(command.characterId)) || (command.type === "skill" && command.actorId === "kuki" && command.abilityId === selected.skill.abilityId) || (command.type === "burst" && command.actorId === "kuki" && command.abilityId === BURST_ID)) continue;
    issues.push(`commands.${index} 未映射到本契约的E、Q、等待或合法切换；不猜其他动作与额外触发。`);
  }
  return {status: issues.length ? "invalid" as const : "valid" as const, contractId: selected.id, issues};
}

/** Timing is checked only after runtime energy failures have been resolved. */
export function validateKukiSkillBurstSourceExecution(config: SimConfig, execution: TimelineExecution) {
  if (!claimsKukiSkillBurstSourceContract(config)) return {status: "not-applicable" as const, contractId: null, issues: []};
  const issues: string[] = [];
  let swapReadyFrame = 0;
  for (const command of execution.commandResults) if (command.commandType === "swap" && command.status !== "rejected") {
    if (command.startFrame! < swapReadyFrame) issues.push(`commands.${command.commandIndex} 违反固定来源成功切换后的60帧全队换人冷却。`);
    swapReadyFrame = command.endFrame! + 60;
  }
  return {status: issues.length ? "invalid" as const : "valid" as const, contractId: getKukiSkillBurstSourceActionContract(config)?.id ?? null, issues};
}

export function deriveKukiSkillBurstSourceRotationMappings(config: SimConfig): RotationDslMappings | null {
  return validateKukiSkillBurstSourceActionSequence(config).status === "valid" ? {aliases: {kuki: {E: KUKI_SKILL_CONTRACT.skill.abilityId, Q: BURST_ID}}} : null;
}
