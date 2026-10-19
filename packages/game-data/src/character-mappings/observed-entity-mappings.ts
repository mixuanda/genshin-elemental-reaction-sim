import type { SourceHitMapping } from "./types";
import manifest from "../../sources/observed-entity-casts/manifest.json";
import definitions from "../../sources/observed-entity-casts/definitions.json";

export const observedEntitySourceEvidence = manifest;

export interface ObservedEntityTerm {
  stat: SourceHitMapping["scalingStat"];
  /** Canonical catalog coefficients, or the single literal fixed coefficient. */
  values: number[];
  /** Literal pinned Go coefficients; never silently replaced by catalog values. */
  sourceValues: number[];
  /** Absent for a fixed passive coefficient that has no catalog talent parameter. */
  parameterKey?: string;
  sourceField: string;
  sourcePath: string;
  coefficientTolerance: number;
  minimumAscension?: number;
}

export interface ObservedEntityRole {
  mappingId: string;
  label: string;
  element: SourceHitMapping["element"];
  attackTag: "skill" | "burst" | "proc";
  abilityKey: "combat2" | "combat3";
  parameterKey?: string;
  fixedOnly?: boolean;
  coefficientTolerance: number;
  terms: ObservedEntityTerm[];
  sourceRefs: string[];
}

export interface ObservedEntityTemplate {
  skillId: string;
  characterSlug: string;
  sourceSlug: string;
  talentSetId: string;
  abilityKey: "combat2" | "combat3";
  label: string;
  protocol: "explicit-observed-entity-v1";
  scheduleKind: "klee-burst" | "ayato-burst" | "layla-skill" | "yaoyao-burst" | "furina-ousia-skill" | "emilie-skill" | "emilie-burst" | "kaeya-burst" | "hutao-skill" | "aloy-skill";
  roles: Record<string, ObservedEntityRole>;
  assumptions: string[];
}

/** The compiler and catalog adapter consume this same coefficient document. */
export const observedEntityTemplates = definitions.templates as ObservedEntityTemplate[];

const assumptions = [
  "C0；使用显式实体观察协议explicit-observed-entity-v1。角色行仅是倍率模板，instanceCount=1不是完整动作的总命中数。",
  "完整动作须由核心编译覆盖实体生命周期、取消与已发出伤害尾段的全部事件；随机分支、目标选择、接触与未接触均明确记录，不能把未知条件当作成功。",
  "逐击提供固定源码所需的实际面板、取样时点、反应与被动条件；输入已含的被动份额须明确扣除，避免重复计算。",
  "各伤害角色分别使用对应的有效E或Q天赋等级；固定被动系数不伪装成目录天赋参数。所有15级倍率向量和固定系数均保留原始来源。",
];
const exclusions = [
  "只计算指定完整观察日程下的自身直接伤害；不自动推测随机结果、目标接触、队伍轮转、附着/ICD、移动、能量、粒子、护盾或治疗。",
  "不包含高命座、未声明的重复施放、旧实体并存或外部伤害动作；明确排除卡肉及未声明的时间修正。",
  "固定源码仍含可莉近似波次、神里绫人快照疑问、芙宁娜到期投射物取消及艾梅莉埃重复香韵收集回调等未实测条款；源码一致不等于当前游戏实测认证。",
  "凯亚旋转13机会及埃洛伊显式冰弹参数属于固定源码简化协议，不认证游戏内最大命中数或全部空间实体寿命；胡桃只将本次E所属血梅香归入战技，施加标记的重击本体另计。",
];

function mapping(cast: ObservedEntityTemplate, role: ObservedEntityRole): SourceHitMapping {
  const catalogTerms = role.terms.filter(term => term.parameterKey !== undefined);
  const [primary, ...extra] = catalogTerms;
  const fixedTerms = role.terms.filter(term => term.parameterKey === undefined).map(term => ({
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
    // The fixed-only adapter skips this sentinel; it is not a catalog parameter.
    parameterKey: role.parameterKey ?? "",
    ...(role.fixedOnly ? { fixedOnly: true } : {}),
    skillId: cast.skillId,
    skillLabel: cast.label,
    hitLabel: role.label,
    element: role.element,
    attackTag: role.attackTag,
    scalingStat: (primary ?? role.terms[0])!.stat,
    ...(primary ? { sourceCoefficientValues: primary.sourceValues } : {}),
    coefficientTolerance: role.coefficientTolerance,
    instanceCount: 1,
    ...(extra.length ? { additionalTerms: extra.map(term => ({
      scalingStat: term.stat,
      parameterKey: term.parameterKey!,
      sourceCoefficientValues: term.sourceValues,
      coefficientTolerance: term.coefficientTolerance,
    })) } : {}),
    ...(fixedTerms.length ? { fixedTerms } : {}),
    sourceRepository: "genshinsim/gcsim",
    sourceCommit: manifest.revision,
    sourcePaths: role.sourceRefs,
    assumptions: [...assumptions, ...cast.assumptions],
    exclusions,
    completeAction: true,
  };
}

/** Representative rows are complete only after the core compiles the full observed lifecycle. */
export const observedEntityMappings: SourceHitMapping[] = observedEntityTemplates.flatMap(cast => Object.values(cast.roles).map(role => mapping(cast, role)));

export const replacedObservedEntityPartialMappingIds = new Set([
  "klee-burst-burst-hit",
  "ayato-burst-burst-hit",
  "layla-skill-hit",
  "yaoyao-burst-burstdmg-hit",
  "furina-skill-skillousiabubble-hit",
  "emilie-skill-skilldmg-hit",
  "emilie-skill-skillarke-hit",
  "emilie-burst-burstdmg-hit",
  "kaeya-burst-burst-hit",
  "hutao-skill-bb-hit",
  "aloy-skill-skillmain-hit",
  "aloy-skill-skillbomblets-hit",
]);
