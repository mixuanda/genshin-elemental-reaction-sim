import type { SourceHitMapping } from "./types";
import manifest from "../../sources/held-lifecycle-casts/manifest.json";
import definitions from "../../sources/held-lifecycle-casts/definitions.json";

export const heldLifecycleSourceEvidence = manifest;

export interface HeldLifecycleTerm {
  stat: SourceHitMapping["scalingStat"];
  /** Canonical catalog coefficients used by the ordinary calculator. */
  values: number[];
  /** Literal pinned Go coefficients, including documented four-decimal rounding. */
  sourceValues: number[];
  parameterKey: string;
  sourceField: string;
  sourcePath: string;
  coefficientTolerance: number;
}

export interface HeldLifecycleRole {
  mappingId: string;
  label: string;
  element: SourceHitMapping["element"];
  attackTag: "skill" | "burst" | "charged";
  abilityKey: "combat1" | "combat2" | "combat3";
  parameterKey: string;
  coefficientTolerance: number;
  terms: HeldLifecycleTerm[];
  sourceRefs: string[];
}

export interface HeldLifecycleTemplate {
  skillId: string;
  characterSlug: string;
  sourceSlug: string;
  talentSetId: string;
  variantId?: string;
  variantName?: string;
  abilityKey: "combat1" | "combat2" | "combat3";
  label: string;
  protocol: "explicit-held-lifecycle-v1";
  scheduleKind: "dendro-burst-pyro" | "hydro-skill-no-suffusion" | "hydro-burst" | "pyro-skill-tap" | "pyro-skill-hold" | "noelle-charged";
  roles: Record<string, HeldLifecycleRole>;
  assumptions: string[];
}

/** Runtime scheduling and catalog validation consume the same coefficient document. */
export const heldLifecycleTemplates = definitions.templates as HeldLifecycleTemplate[];

const assumptions = [
  "C0；使用显式持有与实体生命周期协议explicit-held-lifecycle-v1。每个角色行只是倍率模板，instanceCount=1不是本次完整动作的命中总数。",
  "完整动作须由核心编译全部合法事件，日程覆盖实体结束与已发出伤害尾段，每次接触或未接触明确输入；未知资格不得当作成功。",
  "明确无卡肉、未声明中断、重复施放或实体替换；每个取样时点的实际面板与每击反应条件独立记录。",
  "有效天赋等级显式提供，所有15级来源向量已逐项记录；已有四位小数舍入仅用于声明的两个水旅行者字段，不扩展到真实冲突。",
];
const exclusions = [
  "只计算所选显式日程条件下的完整自身直接伤害；不自动生成团队轮转、附着/ICD、碰撞、能量、粒子、护盾或治疗模拟。",
  "草旅行者周期倍率的第14级冲突保持阻塞；首次周期前火转化分支不产生周期命中，不能借此声称该周期来源已修复。",
  "不包含高命座、未声明夜魂补充、充盈、诺艾尔Q转换或外部附魔；固定源码条件一致不等于当前游戏实测认证。",
];

function mapping(cast: HeldLifecycleTemplate, role: HeldLifecycleRole): SourceHitMapping {
  const [primary, ...extra] = role.terms;
  return {
    id: role.mappingId,
    characterSlug: cast.characterSlug,
    talentSetId: cast.talentSetId,
    ...(cast.variantId === undefined ? {} : { variantId: cast.variantId }),
    ...(cast.variantName === undefined ? {} : { variantName: cast.variantName }),
    abilityKey: role.abilityKey,
    parameterKey: role.parameterKey,
    skillId: cast.skillId,
    skillLabel: cast.label,
    hitLabel: role.label,
    element: role.element,
    attackTag: role.attackTag,
    scalingStat: primary!.stat,
    sourceCoefficientValues: primary!.sourceValues,
    coefficientTolerance: role.coefficientTolerance,
    instanceCount: 1,
    ...(extra.length ? { additionalTerms: extra.map(term => ({
      scalingStat: term.stat, parameterKey: term.parameterKey,
      sourceCoefficientValues: term.sourceValues, coefficientTolerance: term.coefficientTolerance,
    })) } : {}),
    sourceRepository: "genshinsim/gcsim",
    sourceCommit: manifest.revision,
    sourcePaths: role.sourceRefs,
    assumptions: [...assumptions, ...cast.assumptions],
    exclusions,
    completeAction: true,
  };
}

/** Representative coefficient rows; only compiled, fully observed lifecycles can be evaluated as complete actions. */
export const heldLifecycleMappings: SourceHitMapping[] = heldLifecycleTemplates.flatMap(cast => Object.values(cast.roles).map(role => mapping(cast, role)));

export const replacedHeldLifecyclePartialMappingIds = new Set([
  // Keep the already-observed Dendro explosion independently selectable for both Travelers.
  // Its one-hit formula does not certify the lamp lifecycle or a transformation schedule.
  "aether-hydro-skill-dewdrop-no-suffusion-skillDewdrop",
  "lumine-hydro-skill-dewdrop-no-suffusion-skillDewdrop",
  "aether-hydro-burst-tick-burstDot",
  "lumine-hydro-burst-tick-burstDot",
  "aether-pyro-skill-blazing-tick-blazingThreshold",
  "lumine-pyro-skill-blazing-tick-blazingThreshold",
  "aether-pyro-skill-hold-initial-holdDMG",
  "lumine-pyro-skill-hold-initial-holdDMG",
  "aether-pyro-skill-scorching-trigger-scorchingThreshold",
  "lumine-pyro-skill-scorching-trigger-scorchingThreshold",
  // Noelle single-hit components remain selectable alongside the observed full hold.
  // They keep completeAction=false and never infer hold duration or hit count.
]);
