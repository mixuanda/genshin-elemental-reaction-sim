import { WEAPON_PROC_LIFECYCLE, type WeaponProcLifecycleId } from "./weapon-proc-lifecycle";
/** Fixed source definitions shared by the standalone calculator and the event runtime. */
export type WeaponProcId = "halberd" | "ashgravendrinkinghorn" | "sequenceofsolitude" | "filletblade" | "prototypearchaic" | "snowtombedstarsilver" | "dragonspinespear" | "frostbearer" | "messenger" | "swordofnarzissenkreuz" | "eyeofperception" | "theviridescenthunt" | WeaponProcLifecycleId;
export interface WeaponProcDefinition {
  weaponId: WeaponProcId;
  catalogWeaponId: string;
  weaponName: string;
  weaponClass: "sword" | "claymore" | "polearm" | "catalyst" | "bow";
  scalingStat: "atk" | "hp";
  lifecycleKind?: WeaponProcLifecycleId;
  sourceNotes?: readonly string[];
  /** True requires a real weak-point hit on the triggering attack, not its critical result. */
  requiresWeakPoint?: true;
  /** The proc itself has source HitWeakPoint=true; preserve the character's input critical rate. */
  forcedCrit?: true;
  /** A single actual hit remains calculable; the team model must reject automatic triggering. */
  automaticTriggerBlockedReason?: string;
  coefficients: readonly number[];
  /** Selected once from the original triggering enemy's Cryo/Frozen state at its damage callback. */
  cryoOrFrozenCoefficients?: readonly number[];
  /** When present, nominalCooldownFrames is the R1 value; callers use the refinement getter. */
  cooldownFramesByRefinement?: readonly number[];
  randomTrigger?: {
    probabilities: readonly number[];
    successComparison: "<" | "<=";
    zeroDamageGate: "none" | "after-roll";
  };
  nominalCooldownFrames: number;
  damageDelayFrames: number;
  /** Complete fixed-source deliveries relative to one successful callback. */
  damageOffsetsFrames?: readonly number[];
  /** Delayed character task samples stats and geometry at execution. */
  snapshotTiming?: "delivery";
  requiresOnField: boolean;
  /** Null means this source callback does not filter the host attack category. */
  triggerAttackTags: readonly ("normal" | "charged" | "plunge")[] | null;
  targetMode: "single" | "circle";
  radius: .6 | 2.5 | 3 | 4 | null;
  sourceRef: string;
  sourceRefs: string[];
}
export type EyeOfPerceptionProfile = "gcsim-implementation-v1";
/** The independent calculator retains the catalog coefficient. Automatic
 * lifecycle uses only the complete, conflicting archived gcsim implementation. */
export function resolveEyeOfPerceptionDefinition(definition: WeaponProcDefinition, profile?: EyeOfPerceptionProfile): WeaponProcDefinition {
  if (definition.weaponId !== "eyeofperception") return definition;
  if (profile === "gcsim-implementation-v1") return {
    ...definition, coefficients: refinements.map(r => 2.1 * r * .3),
    sourceRef: source("catalyst/perception/perception.go"),
  };
  throw new Error("昭心自动追击必须明确选择有冲突的来源配置。");
}
export const WEAPON_PROC_GCSIM_REVISION = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
export const WEAPON_PROC_OPTIMIZER_REVISION = "180a0a1015cb725c7570cd828eb086749960df98";
export const WEAPON_PROC_CATALOG_REVISION = "49a6544a6c6ae36089cb42fa591fc46f01de8bcf";
export const WEAPON_PROC_DATA_IDENTITY = {datasetId: "gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2", gameVersion: "7.1", releaseStatus: "released", evidenceStatus: "provisional"} as const;
const source = (path: string) => `https://github.com/genshinsim/gcsim/blob/${WEAPON_PROC_GCSIM_REVISION}/internal/weapons/${path}`;
function refs(slug: string, path: string, optimizer: string): string[] {
  return [source(path), `https://github.com/theBowja/genshin-db/blob/${WEAPON_PROC_CATALOG_REVISION}/src/data/ChineseSimplified/weapons/${slug}.json`, `https://github.com/frzyc/genshin-optimizer/blob/${WEAPON_PROC_OPTIMIZER_REVISION}/libs/gi/sheets/src/Weapons/${optimizer}/index.tsx`, `https://github.com/genshinsim/gcsim/blob/${WEAPON_PROC_GCSIM_REVISION}/pkg/enemy/damage.go`];
}
const hpCoefficients = [.4, .5, .6, .7, .8] as const;
const refinements = [1, 2, 3, 4, 5];
// Preserve the source expressions, including floating point rounding before strict RNG comparisons.
const frostCoefficients = refinements.map(r => .65 + r * .15);
const frostCryoCoefficients = refinements.map(r => 1.6 + r * .4);
const frostRandomTrigger: NonNullable<WeaponProcDefinition["randomTrigger"]> = {probabilities: refinements.map(r => .5 + r * .1), successComparison: "<", zeroDamageGate: "none"};
export const weaponProcDefinitions: readonly WeaponProcDefinition[] = [
  {weaponId: "halberd", catalogWeaponId: "weapon:13302", weaponName: "钺矛", weaponClass: "polearm", scalingStat: "atk", coefficients: [1.6, 2, 2.4, 2.8, 3.2], nominalCooldownFrames: 600, damageDelayFrames: 1, requiresOnField: false, triggerAttackTags: ["normal"], targetMode: "single", radius: null, sourceRef: source("spear/halberd/halberd.go"), sourceRefs: refs("halberd", "spear/halberd/halberd.go", "Polearm/Halberd")},
  {weaponId: "ashgravendrinkinghorn", catalogWeaponId: "weapon:14427", weaponName: "苍纹角杯", weaponClass: "catalyst", scalingStat: "hp", coefficients: hpCoefficients, nominalCooldownFrames: 900, damageDelayFrames: 1, requiresOnField: true, triggerAttackTags: null, targetMode: "circle", radius: 3, sourceRef: source("catalyst/ashgraven/ashgraven.go"), sourceRefs: refs("ashgravendrinkinghorn", "catalyst/ashgraven/ashgraven.go", "Catalyst/AshGravenDrinkingHorn")},
  {weaponId: "sequenceofsolitude", catalogWeaponId: "weapon:15432", weaponName: "冷寂迸音", weaponClass: "bow", scalingStat: "hp", coefficients: hpCoefficients, nominalCooldownFrames: 900, damageDelayFrames: 1, requiresOnField: true, triggerAttackTags: null, targetMode: "circle", radius: 3, sourceRef: source("bow/sequenceofsolitude/sequenceofsolitude.go"), sourceRefs: refs("sequenceofsolitude", "bow/sequenceofsolitude/sequenceofsolitude.go", "Bow/SequenceOfSolitude")},
  {weaponId: "filletblade", catalogWeaponId: "weapon:11305", weaponName: "吃虎鱼刀", weaponClass: "sword", scalingStat: "atk", coefficients: refinements.map(r => 2 + .4 * r), cooldownFramesByRefinement: refinements.map(r => 960 - 60 * r), randomTrigger: {probabilities: refinements.map(() => .5), successComparison: "<=", zeroDamageGate: "after-roll"}, nominalCooldownFrames: 900, damageDelayFrames: 1, requiresOnField: true, triggerAttackTags: null, targetMode: "single", radius: null, sourceRef: source("sword/filletblade/filletblade.go"), sourceRefs: refs("filletblade", "sword/filletblade/filletblade.go", "Sword/FilletBlade")},
  {weaponId: "prototypearchaic", catalogWeaponId: "weapon:12406", weaponName: "试作古华", weaponClass: "claymore", scalingStat: "atk", coefficients: refinements.map(r => 1.8 + r * .6), randomTrigger: {probabilities: refinements.map(() => .5), successComparison: "<", zeroDamageGate: "none"}, nominalCooldownFrames: 900, damageDelayFrames: 1, requiresOnField: true, triggerAttackTags: ["normal", "charged"], targetMode: "circle", radius: 3, sourceRef: source("claymore/prototype/prototype.go"), sourceRefs: refs("prototypearchaic", "claymore/prototype/prototype.go", "Claymore/PrototypeArchaic")},
  {weaponId: "snowtombedstarsilver", catalogWeaponId: "weapon:12411", weaponName: "雪葬的星银", weaponClass: "claymore", scalingStat: "atk", coefficients: frostCoefficients, cryoOrFrozenCoefficients: frostCryoCoefficients, randomTrigger: frostRandomTrigger, nominalCooldownFrames: 600, damageDelayFrames: 1, requiresOnField: true, triggerAttackTags: ["normal", "charged"], targetMode: "circle", radius: 3, sourceRef: source("claymore/starsilver/starsilver.go"), sourceRefs: refs("snowtombedstarsilver", "claymore/starsilver/starsilver.go", "Claymore/SnowTombedStarsilver")},
  {weaponId: "dragonspinespear", catalogWeaponId: "weapon:13409", weaponName: "龙脊长枪", weaponClass: "polearm", scalingStat: "atk", coefficients: frostCoefficients, cryoOrFrozenCoefficients: frostCryoCoefficients, randomTrigger: frostRandomTrigger, nominalCooldownFrames: 600, damageDelayFrames: 1, requiresOnField: true, triggerAttackTags: ["normal", "charged"], targetMode: "circle", radius: 3, sourceRef: source("spear/dragonspine/dragonspine.go"), sourceRefs: refs("dragonspinespear", "spear/dragonspine/dragonspine.go", "Polearm/DragonspineSpear")},
  {weaponId: "frostbearer", catalogWeaponId: "weapon:14412", weaponName: "忍冬之果", weaponClass: "catalyst", scalingStat: "atk", coefficients: frostCoefficients, cryoOrFrozenCoefficients: frostCryoCoefficients, randomTrigger: frostRandomTrigger, nominalCooldownFrames: 600, damageDelayFrames: 1, requiresOnField: true, triggerAttackTags: ["normal", "charged"], targetMode: "circle", radius: 3, sourceRef: source("catalyst/frostbearer/frostbearer.go"), sourceRefs: refs("frostbearer", "catalyst/frostbearer/frostbearer.go", "Catalyst/Frostbearer")},
  {weaponId: "flute", catalogWeaponId: "weapon:11402", weaponName: "笛剑", weaponClass: "sword", scalingStat: "atk", lifecycleKind: "flute", coefficients: refinements.map(r => .75 + .25 * r), nominalCooldownFrames: WEAPON_PROC_LIFECYCLE.flute.noteCooldownFrames, damageDelayFrames: 1, requiresOnField: true, triggerAttackTags: ["normal", "charged"], targetMode: "circle", radius: 4, sourceRef: source("sword/flute/flute.go"), sourceRefs: refs("theflute", "sword/flute/flute.go", "Sword/TheFlute"), sourceNotes: ["来源冲突：固定 Optimizer TheFlute sheet 写死 200% 且未读取精炼，R1–R4 与固定 gcsim 及目录不一致；这里明确采用后两者的 100%／125%／150%／175%／200%，不把该 sheet 当作全精炼独立验证。"]},
  {weaponId: "debateclub", catalogWeaponId: "weapon:12305", weaponName: "以理服人", weaponClass: "claymore", scalingStat: "atk", lifecycleKind: "debateclub", coefficients: refinements.map(r => .45 + r * .15), nominalCooldownFrames: WEAPON_PROC_LIFECYCLE.debateclub.hitCooldownFrames, damageDelayFrames: 1, requiresOnField: true, triggerAttackTags: ["normal", "charged"], targetMode: "circle", radius: 3, sourceRef: source("claymore/debateclub/debateclub.go"), sourceRefs: refs("debateclub", "claymore/debateclub/debateclub.go", "Claymore/DebateClub")},
  {weaponId: "crescentpike", catalogWeaponId: "weapon:13403", weaponName: "流月针", weaponClass: "polearm", scalingStat: "atk", lifecycleKind: "crescentpike", coefficients: refinements.map(r => .15 + r * .05), nominalCooldownFrames: 0, damageDelayFrames: 1, requiresOnField: false, triggerAttackTags: ["normal", "charged"], targetMode: "single", radius: null, sourceRef: source("spear/crescent/crescent.go"), sourceRefs: refs("crescentpike", "spear/crescent/crescent.go", "Polearm/CrescentPike")},
  {weaponId: "endoftheline", catalogWeaponId: "weapon:15418", weaponName: "竭泽", weaponClass: "bow", scalingStat: "atk", lifecycleKind: "endoftheline", coefficients: refinements.map(r => .60 + r * .20), nominalCooldownFrames: WEAPON_PROC_LIFECYCLE.endoftheline.hitCooldownFrames, damageDelayFrames: 1, requiresOnField: true, triggerAttackTags: null, targetMode: "circle", radius: 2.5, sourceRef: source("bow/endoftheline/endoftheline.go"), sourceRefs: refs("endoftheline", "bow/endoftheline/endoftheline.go", "Bow/EndOfTheLine")},
  {weaponId: "messenger", catalogWeaponId: "weapon:15305", weaponName: "信使", weaponClass: "bow", scalingStat: "atk", coefficients: refinements.map(r => .75 + r * .25), nominalCooldownFrames: 600, damageDelayFrames: 1, requiresOnField: true, requiresWeakPoint: true, forcedCrit: true, triggerAttackTags: null, targetMode: "single", radius: null, sourceRef: source("bow/messenger/messenger.go"), sourceRefs: refs("messenger", "bow/messenger/messenger.go", "Bow/Messenger"), sourceNotes: ["固定源码要求持有者前台且宿主命中真实 HitWeakPoint=true，不额外筛选重击标签；独立追击自身也置 HitWeakPoint=true，使用暴伤必暴且跳过本击暴击随机抽样，不改角色面板暴率。Optimizer 描述支持必暴，但该固定 sheet 未实现弱点或必暴判定。"]},
  {weaponId: "swordofnarzissenkreuz", catalogWeaponId: "weapon:11428", weaponName: "水仙十字之剑", weaponClass: "sword", scalingStat: "atk", coefficients: refinements.map(r => 1.2 + r * .4), nominalCooldownFrames: 720, damageDelayFrames: 6, snapshotTiming: "delivery", requiresOnField: true, triggerAttackTags: ["normal", "charged", "plunge"], targetMode: "circle", radius: 3, sourceRef: source("sword/swordofnarzissenkreuz/swordofnarzissenkreuz.go"), sourceRefs: refs("swordofnarzissenkreuz", "sword/swordofnarzissenkreuz/swordofnarzissenkreuz.go", "Sword/SwordOfNarzissenkreuz"), sourceNotes: ["自动入口必须明确角色是否有原生始基力；有原生始基力时不订阅回调。无原生始基力时由本人前台普通／重击／下落实际伤害触发，冷却到期帧仍阻断；无非零伤害门。源码在延迟角色任务执行时才取样并创建半径 3 圆心；本模式明确忽略角色卡肉。6 帧是来源粗估，芒／荒参数只有日志且交互未实现，不是实机认证。"]},
  {weaponId: "eyeofperception", catalogWeaponId: "weapon:14409", weaponName: "昭心", weaponClass: "catalyst", scalingStat: "atk", coefficients: [2.4, 2.7, 3, 3.3, 3.6], nominalCooldownFrames: 720, cooldownFramesByRefinement: refinements.map(r => (13 - r) * 60), damageDelayFrames: 10, requiresOnField: false, triggerAttackTags: ["normal", "charged"], targetMode: "circle", radius: .6, sourceRef: `https://github.com/theBowja/genshin-db/blob/${WEAPON_PROC_CATALOG_REVISION}/src/data/ChineseSimplified/weapons/eyeofperception.json`, sourceRefs: refs("eyeofperception", "catalyst/perception/perception.go", "Catalyst/EyeOfPerception"), automaticTriggerBlockedReason: "目录／Optimizer 倍率的自动来源配置仍被阻断：固定 gcsim 的倍率不同且缺少目录所述 50% 概率；只有明确选择冲突的 gcsim 固定实现配置时才运行完整弹射链。", sourceNotes: ["独立计算器采用固定目录与 Optimizer 一致的 240%／270%／300%／330%／360%；自动模拟明确采用固定 gcsim 的 63%／126%／189%／252%／315%，且该实现没有目录所述 50% 概率门。两种结果不可当作同一游戏机制的验证。", "自动模拟按固定 gcsim：每跳延后 10 帧，半径 .6，一次法球最多初击加四跳；半径 8 内找最近且 36 帧内未标记的敌人。当前游戏真实性尚未验证。"]},
  {weaponId: "theviridescenthunt", catalogWeaponId: "weapon:15409", weaponName: "苍翠猎弓", weaponClass: "bow", scalingStat: "atk", coefficients: refinements.map(r => .3 + r * .1), nominalCooldownFrames: 840, cooldownFramesByRefinement: refinements.map(r => 900 - r * 60), randomTrigger: {probabilities: refinements.map(() => .5), successComparison: "<=", zeroDamageGate: "none"}, damageDelayFrames: 1, damageOffsetsFrames: Array.from({length: 9}, (_, i) => 1 + 30 * i), requiresOnField: true, triggerAttackTags: ["normal", "charged"], targetMode: "circle", radius: 3, sourceRef: source("bow/viridescent/viridescent.go"), sourceRefs: refs("theviridescenthunt", "bow/viridescent/viridescent.go", "Bow/TheViridescentHunt"), sourceNotes: ["这里的 R1–R5 倍率均为每次 tick。自动入口采用固定源码的 50% 门 roll≤.5，并排程 +1、+31、…、+241 帧九段；九次快照和圆心全部在同一个成功回调内固定，后续不跟踪、不复查前台。源码没有吸引位移，九段端点计数尚未经实机认证。"]}
];
export function getWeaponProcDefinition(weaponId: WeaponProcId): WeaponProcDefinition | undefined {
  return weaponProcDefinitions.find(row => row.weaponId === weaponId);
}

function refinementValue(values: readonly number[], refinement: number): number {
  const value = values[refinement - 1];
  if (value === undefined) throw new Error("武器追击精炼必须为 R1–R5。");
  return value;
}
/** The selected coefficient belongs to the whole proc, not each target struck by its AoE. */
export function getWeaponProcCoefficient(definition: WeaponProcDefinition, refinement: number, triggeringTargetCryoOrFrozen?: boolean): number {
  if (definition.cryoOrFrozenCoefficients !== undefined && triggeringTargetCryoOrFrozen === undefined) throw new Error("需要明确原触发目标在伤害回调时是否含冰／冻结；不能将未知状态当作无冰。");
  return refinementValue(triggeringTargetCryoOrFrozen && definition.cryoOrFrozenCoefficients ? definition.cryoOrFrozenCoefficients : definition.coefficients, refinement);
}
export function getWeaponProcCooldownFrames(definition: WeaponProcDefinition, refinement: number): number {
  return definition.cooldownFramesByRefinement ? refinementValue(definition.cooldownFramesByRefinement, refinement) : definition.nominalCooldownFrames;
}
/** Null means no RNG gate; probability 1 still requires the source's random draw. */
export function getWeaponProcTriggerProbability(definition: WeaponProcDefinition, refinement: number): number | null {
  return definition.randomTrigger ? refinementValue(definition.randomTrigger.probabilities, refinement) : null;
}
