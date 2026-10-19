import type { SourceHitMapping } from "./types";
import manifest from "./noelle-source-manifest.json";

export const noelleSourceEvidence = manifest;
const coefficients = manifest.coefficients;
type CoefficientKey = keyof typeof coefficients;
const sharedPaths = ["internal/characters/noelle/zz_noelle.dm.go", "internal/characters/noelle/noelle.go", "internal/characters/noelle/asc.go", "internal/characters/noelle/cons.go", "pkg/enemy/damage.go"];

/** These are separately selected damage components, never a guessed full hold. */
const baseActions = [
  { id: "noelle-normal-1", coefficient: "attack1", label: "基础普攻第 1 下", tag: "normal", source: "attack.go", complete: true },
  { id: "noelle-normal-2", coefficient: "attack2", label: "基础普攻第 2 下", tag: "normal", source: "attack.go", complete: true },
  { id: "noelle-normal-3", coefficient: "attack3", label: "基础普攻第 3 下", tag: "normal", source: "attack.go", complete: true },
  { id: "noelle-normal-4", coefficient: "attack4", label: "基础普攻第 4 下", tag: "normal", source: "attack.go", complete: true },
  { id: "noelle-charged-cycle", coefficient: "charge", label: "重击·单次旋转命中", tag: "charged", source: "charge.go", complete: false },
  { id: "noelle-charged-finisher", coefficient: "chargeFinal", label: "重击·终结命中", tag: "charged", source: "charge.go", complete: false },
  { id: "noelle-plunge-collision", coefficient: "collision", label: "下落·单次路径碰撞", tag: "plunge", source: "plunge.go", complete: false },
  { id: "noelle-plunge-low", coefficient: "lowPlunge", label: "低空下落·落地冲击（无碰撞）", tag: "plunge", source: "plunge.go", complete: true },
  { id: "noelle-plunge-high", coefficient: "highPlunge", label: "高空下落·落地冲击（无碰撞）", tag: "plunge", source: "plunge.go", complete: true }
] as const satisfies ReadonlyArray<{ id: string; coefficient: CoefficientKey; label: string; tag: NonNullable<SourceHitMapping["attackTag"]>; source: string; complete: boolean }>;

export const noelleBaseMappings: SourceHitMapping[] = baseActions.map((action) => ({
  id: `${action.id}-hit`, skillId: action.id, skillLabel: action.label, hitLabel: action.label,
  characterSlug: "noelle", talentSetId: "talent-set:noelle", abilityKey: "combat1",
  variantId: "noelle-burst-inactive", variantName: "Q 未激活·无附魔",
  parameterKey: coefficients[action.coefficient].parameterKey, sourceCoefficientValues: coefficients[action.coefficient].values,
  scalingStat: "atk", element: "physical", attackTag: action.tag, coefficientTolerance: 0,
  sourceRepository: "genshinsim/gcsim", sourceCommit: manifest.commit,
  sourcePaths: [`internal/characters/noelle/${action.source}`, ...sharedPaths],
  completeAction: action.complete,
  assumptions: [
    "C0、Q大扫除未激活且无外部附魔；所选本体以实际最终ATK缩放，不额外加入DEF。",
    ...(action.tag === "normal" ? ["只计算所选一次普通输入的自身命中，不将N1–N4合并为一次输入；治疗和A4减冷却不是额外伤害。"] : []),
    ...(action.tag === "charged" ? ["只计算所选的一次旋转或终结命中；不由两个参数推断实际旋转次数、完整5秒持有、体力或取消时机。固定源AttackTagExtra在此动作明确表示重击。"] : []),
    ...(action.tag === "plunge" ? ["以合法下落已经发生为条件；固定源动作入口要求AirborneXianyun，本独立计算不重建空中资格。路径碰撞独立选择，低/高空落地动作明确假设collision=0。"] : [])
  ],
  exclusions: ["Q的DEF转ATK、不可覆盖岩附魔、C2重击增伤、C4护盾爆炸、治疗、体力和实际轮转状态不由本基础组件推导；相关状态须用其独立条件动作。"]
}));

/** Both source labels are ElementalBurst attacks; 'Skill' is only the second label. */
export const noelleBurstCastMappings: SourceHitMapping[] = ([
  { id: "initial", coefficient: "burst", label: "大扫除·起手爆发伤害（源+24帧）" },
  { id: "slash", coefficient: "burstskill", label: "大扫除·第二段挥砍（源+65帧）" }
] as const).map((action) => ({
  id: `noelle-burst-cast-${action.id}-hit`, skillId: "noelle-burst-cast", skillLabel: "大扫除·起手两段", hitLabel: action.label,
  characterSlug: "noelle", talentSetId: "talent-set:noelle", abilityKey: "combat3",
  variantId: "noelle-burst-cast", variantName: "大扫除·起手两段",
  parameterKey: coefficients[action.coefficient].parameterKey, sourceCoefficientValues: coefficients[action.coefficient].values,
  formulaParameters: [{ key: "noelleBurstDefConversion", parameterKey: coefficients.defconv.parameterKey, sourceCoefficientValues: coefficients.defconv.values, coefficientTolerance: 0 }],
  scalingStat: "atk", element: "geo", attackTag: "burst", coefficientTolerance: 0,
  sourceRepository: "genshinsim/gcsim", sourceCommit: manifest.commit,
  sourcePaths: ["internal/characters/noelle/burst.go", ...sharedPaths, "pkg/core/attack.go", "pkg/core/player/character/stats.go"],
  completeAction: true,
  assumptions: [
    "C0；本次Q输入仅归属起手两次岩元素爆发伤害，不包含随后另外输入的普通、重击或下落。第二段源码名称含Skill，但实际攻击类型仍是burst。",
    "固定源先在Q起手记录非Extra DEF快照并按本次有效Q等级转换为Extra ATK，再结算两段。必须明确输入ATK是否已包含这笔转换，不能在已含最终ATK上再加一次。",
    "只有用于转换的非Extra DEF锁在起手；Q两段各自读取命中时完整伤害快照，不能把所有面板一律当作起手快照。",
    "源+24/+65为可受卡肉推迟的角色任务；源注释对精确DEF快照和增益开始时点仍有TODO，本映射只验证固定来源的条件数值，不冒称当前实战时序已核验。"
  ],
  exclusions: ["不自动推断Q能量、卡肉、起手DEF的Extra排除来源、状态持续时间或后续普攻次数；C6转换额外0.5及持续延长不属于此C0映射。"]
}));

export const noelleActionMappings: SourceHitMapping[] = [...noelleBaseMappings, ...noelleBurstCastMappings];
