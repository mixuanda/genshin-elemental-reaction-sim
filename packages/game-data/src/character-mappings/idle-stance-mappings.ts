import type { SourceHitMapping } from "./types";
import manifest from "../../sources/idle-stance-casts/manifest.json";
import definitions from "../../sources/idle-stance-casts/definitions.json";

export const idleStanceSourceEvidence = manifest;

export interface IdleStanceTerm {
  stat: SourceHitMapping["scalingStat"];
  /** Exact catalog/source coefficients; a fixed passive repeats its value across levels. */
  values: number[];
  parameterKey?: string;
  sourceField: string;
  sourcePath: string;
  minimumAscension?: number;
}

export interface IdleStanceRole {
  mappingId: string;
  label: string;
  element: SourceHitMapping["element"];
  attackTag: "skill" | "burst";
  abilityKey: "combat2" | "combat3";
  parameterKey: string;
  terms: IdleStanceTerm[];
  sourceRefs: string[];
}

export interface IdleStanceTemplate {
  skillId: string;
  characterSlug: string;
  sourceSlug: string;
  talentSetId: string;
  abilityKey: "combat2" | "combat3";
  label: string;
  protocol: "explicit-idle-stance-v1";
  scheduleKind: "razor" | "zhongli" | "tartaglia" | "yanfei" | "ayato" | "nilou" | "wanderer" | "alhaitham" | "mika" | "kaveh" | "gaming" | "chiori";
  roles: Record<string, IdleStanceRole>;
  assumptions: string[];
}

/** Shared coefficient definitions; complete actions additionally require the core lifecycle compiler. */
export const idleStanceTemplates = definitions.templates as IdleStanceTemplate[];

const assumptions = [
  "C0；使用显式完整状态窗口协议 explicit-idle-stance-v1。每行只是一个伤害角色的倍率模板，instanceCount=1 不是完整施放命中总数。",
  "明确新鲜施放、后续输入列表及观察终点；由核心证明完整状态窗口与自主实体寿命都已结束，不能只把原有初击改标完整。",
  "每次候选伤害的实际接触、资格和对应取样面板明确提供；无卡肉、未声明中断、重复施放、实体替换或外部事件。",
  "有效天赋等级显式提供，18个采用的天赋向量在全部15级与固定源码完全一致；固定被动按突破门槛处理，已计入增益不能重复添加。",
];
const exclusions = [
  "只计算所选限制分支的完整自身直接伤害；不自动生成普通攻击、附着/ICD、移动碰撞、治疗、能量、粒子或团队轮转。",
  "不包含高命座、魔导、旧实体、未知触发资格或未声明的反应伤害；无后续输入的分支不能冒充完整连招。",
  "固定来源一致性属于 provisional 证据，不等于当前游戏版本实测认证。",
];

function mapping(cast: IdleStanceTemplate, role: IdleStanceRole): SourceHitMapping {
  const [primary, ...extra] = role.terms;
  const additionalTerms = extra.filter(term => term.parameterKey !== undefined).map(term => ({
    scalingStat: term.stat,
    parameterKey: term.parameterKey!,
    sourceCoefficientValues: term.values,
    coefficientTolerance: 0,
  }));
  const fixedTerms = extra.filter(term => term.parameterKey === undefined).map(term => ({
    scalingStat: term.stat,
    coefficient: term.values[0]!,
    sourceField: `${term.sourcePath}:${term.sourceField}`,
    ...(term.minimumAscension === undefined ? {} : { minimumAscension: term.minimumAscension }),
  }));
  return {
    id: role.mappingId,
    characterSlug: cast.characterSlug,
    talentSetId: cast.talentSetId,
    abilityKey: role.abilityKey,
    parameterKey: role.parameterKey,
    skillId: cast.skillId,
    skillLabel: cast.label,
    hitLabel: role.label,
    element: role.element,
    attackTag: role.attackTag,
    scalingStat: primary!.stat,
    sourceCoefficientValues: primary!.values,
    coefficientTolerance: 0,
    instanceCount: 1,
    ...(additionalTerms.length ? { additionalTerms } : {}),
    ...(fixedTerms.length ? { fixedTerms } : {}),
    sourceRepository: "genshinsim/gcsim",
    sourceCommit: manifest.revision,
    sourcePaths: role.sourceRefs,
    assumptions: [...assumptions, ...cast.assumptions],
    exclusions,
    completeAction: true,
  };
}

/** Representative coefficients only; a complete cast must be compiled and fully observed. */
export const idleStanceMappings: SourceHitMapping[] = idleStanceTemplates.flatMap(cast => Object.values(cast.roles).map(role => mapping(cast, role)));

export const replacedIdleStancePartialMappingIds = new Set([
  "razor-burst-burstdmg-hit",
  "zhongli-skill-skillhold-hit",
  "tartaglia-skill-hit",
  "yanfei-burst-burst-hit",
  "ayato-skill-hit",
  "nilou-skill-hit",
  "wanderer-skill-hit",
  // Independently selected ATK+EM / ATK+DEF contacts remain available.
  "mika-skill-skillhold-hit",
  "kaveh-burst-burst-hit",
  "gaming-burst-burst-hit",

]);
