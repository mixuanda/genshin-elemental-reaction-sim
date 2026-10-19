import coefficients from "../sources/composable-source-abilities/definitions.json";
import bowCoefficients from "../sources/default-bow-normal-family/coefficients.json";
import { DEFAULT_BOW_NORMAL_ABILITIES } from "./default-bow-normal-family";
import type { SourceNormalActionId, SourceNormalStateScope } from "../../schemas/src/source-normal-family";

/** A versioned ability definition, independent of the actor's editable build. */
export const COMPOSABLE_SOURCE_ABILITY_VERSION = "gcsim-b4ae769-composable-abilities-v1" as const;
export const COMPOSABLE_SOURCE_REVISION = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
export type ComposableSourceActionId = "amber-q" | "chongyun-q" | "keqing-q" | "aloy-q" | "zhongli-q"
  | SourceNormalActionId;

export interface ComposableSourceHit {
  role: string;
  label: string;
  coefficientId: string;
  frame: number;
  snapshot: "action" | "hit";
  snapshotFrame?: number;
}

export interface ComposableSourceAbility {
  id: ComposableSourceActionId;
  label: string;
  characterSlug: "amber" | "chongyun" | "keqing" | "aloy" | "zhongli" | "gorou" | "kujousara" | "diona" | "collei" | "faruzan" | "ganyu" | "tighnari" | "venti" | "fischl" | "yelan";
  characterName: string;
  element: "pyro" | "cryo" | "electro" | "geo" | "hydro" | "anemo" | "dendro";
  weaponType: "bow" | "claymore" | "sword" | "polearm";
  kind: "burst" | "normal";
  talentType: "burst" | "normal";
  availability: "executable" | "requires-normal-chain";
  evidenceStatus: "source-provisional";
  scope: string;
  sourceRefs: readonly string[];
  sourcePaths: readonly string[];
  animationEndFrame: number;
  cancelFrames: Partial<Record<"normal" | "skill" | "burst" | "charge" | "plunge" | "dash" | "jump" | "swap" | "walk", number>>;
  cooldownFrames: number;
  cooldownStartFrame: number;
  energyMax: 40 | 60 | 70 | 80;
  energyCost: number;
  energyCostFrame: number;
  gaugeUnits: number;
  applicationIcdTag: string;
  icdGroup: "amber" | "default";
  sourceStrikeType: "pierce" | "blunt" | "slash" | "default";
  poiseDamage?: number;
  normalIndex?: number;
  /** One accepted normal input selects the next segment; this is not a hit count. */
  normalChain?: { id: string; index: number; length: number; reset: "default-player-exec-v1" };
  /** Required user declaration for source states which this normal-only entry cannot infer. */
  stateScope?: SourceNormalStateScope;
  hits: readonly ComposableSourceHit[];
  limitations: readonly string[];
}

const root = `https://github.com/genshinsim/gcsim/blob/${COMPOSABLE_SOURCE_REVISION}/`;
const commonScope = "固定来源 C0、有效天赋 1–15、实际突破 0–6；面板、等级、配装和队友可编辑。单个静止目标位于本动作所有伤害范围内，无攻速修正或卡肉。";
const commonLimitations = [
  "来源实现与数表一致仍为 provisional，不代表游戏内验证或完整角色支持。",
  "仅列出的能力和其自身被动参与自动运行；未绑定的 E、重击、形态、命座和其他角色专属状态不会被猜测。",
  "本动作采用单个静止且始终在范围内的目标边界，不证明多目标、随机几何、移动追踪或卡肉行为。",
] as const;

type SourceDefinition = Omit<ComposableSourceAbility, "evidenceStatus" | "scope" | "sourceRefs" | "sourcePaths" | "limitations" | "energyMax"> & { limitations?: readonly string[] };
function define(input: SourceDefinition): ComposableSourceAbility {
  const paths = ["burst.go", "asc.go", `${input.characterSlug}.go`, `zz_${input.characterSlug}.dm.go`].map(file => `internal/characters/${input.characterSlug}/${file}`);
  paths.push("pkg/simulation/run.go", "pkg/core/player/exec.go", "pkg/core/player/player.go");
  if (input.kind === "normal") paths.push("internal/characters/amber/attack.go", "internal/frames/frames.go",
    "internal/template/character/character.go", "pkg/core/player/animation/animation.go", "pkg/core/action/action.go", "pkg/core/core.go", "pkg/core/attack.go", "pkg/core/energy.go");
  return { ...input, energyMax: 40, evidenceStatus: "source-provisional", scope: commonScope,
    sourcePaths: paths, sourceRefs: paths.map(path => `${root}${path}`), limitations: [...commonLimitations, ...(input.limitations ?? [])] };
}

const amberRainFrames = [...[24, 48, 72, 96, 120], ...[36, 72, 108], ...[12, 24, 36, 48, 60, 72, 84, 96, 108, 120]].map(frame => 72 + frame);
const amberLaunch = [14, 10, 27, 26, 26] as const;
const amberNormalEnds = [26, 22, 37, 34, 60] as const;

export const COMPOSABLE_SOURCE_ABILITIES: readonly ComposableSourceAbility[] = [
  define({ id: "amber-q", label: "安柏 · 箭雨", characterSlug: "amber", characterName: "安柏", element: "pyro", weaponType: "bow", kind: "burst", talentType: "burst", availability: "executable",
    animationEndFrame: 111, cancelFrames: { dash: 57, jump: 58, walk: 62, swap: 60 }, cooldownFrames: 720, cooldownStartFrame: 56, energyCost: 40, energyCostFrame: 59,
    gaugeUnits: 1, applicationIcdTag: "elemental-burst", icdGroup: "amber", sourceStrikeType: "pierce",
    hits: amberRainFrames.map((frame, index) => ({ role: `rain-${index + 1}`, label: `箭雨第 ${index + 1} 个来源任务`, coefficientId: "amber-q-tick", frame, snapshot: "action" })),
    limitations: ["保留来源三个循环的入队顺序，共 18 击；首击为 84f，不采用源码注释中的 72f。范围内静止主目标可被全部箭雨覆盖；不复刻周围随机落点。", "A1 在突破≥1时仅给Q增加10%暴击率；范围扩大在本始终处于范围内的目标条件下不改变接触结果。"] }),
  define({ id: "chongyun-q", label: "重云 · 灵刃·云开星落", characterSlug: "chongyun", characterName: "重云", element: "cryo", weaponType: "claymore", kind: "burst", talentType: "burst", availability: "executable",
    animationEndFrame: 79, cancelFrames: { normal: 64, skill: 64, dash: 64, jump: 66 }, cooldownFrames: 720, cooldownStartFrame: 0, energyCost: 40, energyCostFrame: 6,
    gaugeUnits: 1, applicationIcdTag: "none", icdGroup: "default", sourceStrikeType: "blunt", poiseDamage: 100,
    hits: [50, 59, 67].map((frame, index) => ({ role: `blade-${index + 1}`, label: `灵刃 ${index + 1}`, coefficientId: "chongyun-q", frame, snapshot: "hit" })),
    limitations: ["C0 三柄灵刃分别在命中帧取样；不加入C6第四刃或C4能量回调。"] }),
  define({ id: "keqing-q", label: "刻晴 · 天街巡游", characterSlug: "keqing", characterName: "刻晴", element: "electro", weaponType: "sword", kind: "burst", talentType: "burst", availability: "executable",
    animationEndFrame: 124, cancelFrames: { normal: 123, skill: 123, swap: 122 }, cooldownFrames: 720, cooldownStartFrame: 52, energyCost: 40, energyCostFrame: 55,
    gaugeUnits: 1, applicationIcdTag: "elemental-burst", icdGroup: "default", sourceStrikeType: "slash",
    hits: [{ role: "initial", label: "初始斩击", coefficientId: "keqing-q-initial", frame: 56, snapshot: "hit" },
      ...Array.from({ length: 8 }, (_, index): ComposableSourceHit => ({ role: `slash-${index + 1}`, label: `连续斩击 ${index + 1}`, coefficientId: "keqing-q-slash", frame: 82 + 11 * index, snapshot: "hit" })),
      { role: "final", label: "末段斩击", coefficientId: "keqing-q-final", frame: 197, snapshot: "hit" }],
    limitations: ["A4 在突破≥4时随真实起手刷新480f的15%暴击率与15%充能；十击仍逐击取样，不将全Q冻在起手帧。"] }),
  define({ id: "aloy-q", label: "埃洛伊 · 曙光预言", characterSlug: "aloy", characterName: "埃洛伊", element: "cryo", weaponType: "bow", kind: "burst", talentType: "burst", availability: "executable",
    animationEndFrame: 117, cancelFrames: { normal: 101, skill: 101, dash: 101, jump: 100 }, cooldownFrames: 720, cooldownStartFrame: 0, energyCost: 40, energyCostFrame: 2,
    gaugeUnits: 2, applicationIcdTag: "elemental-burst", icdGroup: "default", sourceStrikeType: "default",
    hits: [{ role: "explosion", label: "曙光预言爆炸", coefficientId: "aloy-q", frame: 100, snapshot: "action" }],
    limitations: ["Q在起手取样，100f命中；E线圈／冰驰产生的状态没有被此Q入口补造。"] }),
  define({ id: "zhongli-q", label: "钟离 · 天星", characterSlug: "zhongli", characterName: "钟离", element: "geo", weaponType: "polearm", kind: "burst", talentType: "burst", availability: "executable",
    animationEndFrame: 139, cancelFrames: { dash: 123, jump: 123, swap: 138 }, cooldownFrames: 720, cooldownStartFrame: 0, energyCost: 40, energyCostFrame: 7,
    gaugeUnits: 4, applicationIcdTag: "none", icdGroup: "default", sourceStrikeType: "blunt", poiseDamage: 500,
    hits: [{ role: "meteor", label: "天星陨落", coefficientId: "zhongli-q", frame: 101, snapshot: "hit" }],
    limitations: ["突破≥4时的33%最大生命附加值在起手构造AttackInfo时冻结，ATK及其他主面板在101f取样。C2护盾不在C0范围。", "固定来源Q没有实现石化目标行为；此入口不声明敌人动作、抗性阶段或石化控制效果。"] }),
  ...amberLaunch.map((launch, index) => define({ id: `amber-n${index + 1}` as ComposableSourceActionId, label: `安柏 · 普攻 N${index + 1}`, characterSlug: "amber", characterName: "安柏", element: "pyro", weaponType: "bow", kind: "normal", talentType: "normal", availability: "executable",
    animationEndFrame: amberNormalEnds[index]!, cancelFrames: { skill: launch, burst: launch, dash: launch, jump: launch, swap: launch }, cooldownFrames: 0, cooldownStartFrame: 0, energyCost: 0, energyCostFrame: 0,
    gaugeUnits: 0, applicationIcdTag: "none", icdGroup: "amber", sourceStrikeType: "pierce", normalIndex: index + 1,
    normalChain: { id: "amber-normal-default-v1", index: index + 1, length: 5, reset: "default-player-exec-v1" },
    hits: [{ role: "arrow", label: `N${index + 1} 物理箭`, coefficientId: `amber-n${index + 1}`, frame: launch + 10, snapshot: "hit", snapshotFrame: launch }],
    limitations: ["固定来源默认飞行10f；在发射帧冻结面板，不用命中帧代替，发射帧同帧取消不会撤销已排箭。", "须完整绑定N1至N5，由实际接受普攻立即推进；成功非普攻和真实换人重置，等待及自然动画结束不重置。固定无攻速修正，要求显式启用来源普攻随机回能；使用宿主独立随机流，不声称与gcsim同seed一致。"] })),
  ...DEFAULT_BOW_NORMAL_ABILITIES,
];

export function getComposableSourceAbility(id: string): ComposableSourceAbility | undefined {
  return COMPOSABLE_SOURCE_ABILITIES.find(ability => ability.id === id);
}

export function getComposableSourceCoefficient(id: string, talentLevel: number): number {
  if (!Number.isInteger(talentLevel) || talentLevel < 1 || talentLevel > 15) throw new Error("有效天赋等级须为 1–15 的整数。");
  const row = coefficients.coefficients.find(row => row.id === id) ?? bowCoefficients.coefficients.find(row => row.id === id);
  if (!row) throw new Error(`缺少固定来源倍率：${id}`);
  return row.values[talentLevel - 1]!;
}
