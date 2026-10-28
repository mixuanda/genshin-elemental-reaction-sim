import type { SourceHitMapping } from "./types";
import manifest from "../../sources/traveler-male-charged-resolution/manifest.json";
import {
  TRAVELER_MALE_CHARGED_ELEMENTS, TRAVELER_MALE_CHARGED_OPTIMIZER_REVISION, TRAVELER_MALE_CHARGED_GCSIM_REVISION,
  travelerMaleChargedParameterPath, travelerMaleChargedSourceValues,
  type TravelerMaleChargedElement, type TravelerMaleChargedRole,
} from "./traveler-male-charged-values";

export const travelerMaleChargedSourceEvidence = manifest;
export interface TravelerMaleChargedTemplate {
  skillId: string;
  element: TravelerMaleChargedElement;
  variantId: string;
  label: string;
  roles: Record<TravelerMaleChargedRole, { mappingId: string; label: string; values: number[] }>;
  sourceRefs: string[];
}
const names = { anemo: "风", geo: "岩", electro: "雷", dendro: "草", hydro: "水", pyro: "火", cryo: "冰" };
const optimizerRoot = `https://github.com/frzyc/genshin-optimizer/blob/${TRAVELER_MALE_CHARGED_OPTIMIZER_REVISION}/`;
const gcsimRoot = `https://github.com/genshinsim/gcsim/blob/${TRAVELER_MALE_CHARGED_GCSIM_REVISION}/`;
const paths = (element: TravelerMaleChargedElement): string[] => [
  travelerMaleChargedParameterPath(element), "libs/gi/sheets/src/Characters/Traveler/index.tsx",
  `libs/gi/sheets/src/Characters/Traveler${element[0]!.toUpperCase()}${element.slice(1)}M/index.tsx`,
];
export const travelerMaleChargedTemplates: TravelerMaleChargedTemplate[] = TRAVELER_MALE_CHARGED_ELEMENTS.map(element => {
  const skillId = `male-charged-aether-${element}-c0`;
  return {
    skillId, element, variantId: `aether-${element}`, label: `${names[element]}元素空·完整基础物理重击（合法普攻后）`,
    roles: {
      "hit-1": { mappingId: `${skillId}-hit-1`, label: "男性重击第 1 段", values: travelerMaleChargedSourceValues(element, "hit-1") },
      "hit-2": { mappingId: `${skillId}-hit-2`, label: "男性重击第 2 段", values: travelerMaleChargedSourceValues(element, "hit-2") },
    },
    sourceRefs: [
      ...paths(element).map(path => optimizerRoot + path),
      ...[`internal/characters/traveler/common/${element}/charge.go`, `internal/characters/traveler/common/${element}/stats.go`,
        `internal/characters/traveler/${element}/aether/aether.go`, "internal/template/character/character.go", "internal/template/character/stam.go", "pkg/core/attack.go",
        ...(element === "cryo" ? ["internal/characters/traveler/common/cryo/asc.go", "internal/characters/traveler/common/cryo/skill.go", "internal/characters/traveler/common/cryo/stellar.go"] : []),
      ].map(path => gcsimRoot + path),
    ],
  };
});

export const travelerMaleChargedMappings: SourceHitMapping[] = travelerMaleChargedTemplates.flatMap(cast =>
  (["hit-1", "hit-2"] as const).map((role): SourceHitMapping => ({
    id: cast.roles[role].mappingId, characterSlug: "aether", variantId: cast.variantId, variantName: `${names[cast.element]}元素旅行者（空）`,
    talentSetId: `talent-set:traveler${cast.element}`, abilityKey: "combat1", parameterKey: role === "hit-1" ? "param6" : "param7",
    skillId: cast.skillId, skillLabel: cast.label, hitLabel: cast.roles[role].label,
    element: "physical", attackTag: "charged", scalingStat: "atk", instanceCount: 1,
    sourceCoefficientValues: cast.roles[role].values, coefficientTolerance: 0,
    sourceRepository: "frzyc/genshin-optimizer", sourceCommit: TRAVELER_MALE_CHARGED_OPTIMIZER_REVISION, sourcePaths: paths(cast.element),
    assumptions: [
      `${cast.element === "anemo" ? "风形态基础物理重击C0–C6；其他元素高命座不因此开放" : "C0"}；男性专属 Optimizer 参数 auto[5]/auto[6]，由窄入口精确核对共享目录的性别差异，不覆盖荧的参数。`,
      "从合法普攻后的重击就绪状态开始；默认体力消耗20，明确两次来源机会第9/20帧的接触记录及各自命中时快照。",
      "无外部附魔与特殊剧情重击；实际剧情、装备和队友属性变化已准确恢复到每击面板且不重复加入。",
      "冰分支另需无生效E、无恒星转化状态、无特殊重击层数；完整范围由核心依据显式状态确认，映射行本身只是两段模板。",
    ],
    exclusions: [
      "前置普攻是独立动作；本动作的两段不能冒充从站立开始的N1加重击三段总伤害。",
      "不含火C6、冰附加倍率/冰晶/恒星伤害、外部附魔或独立装备/队友触发；不自动证明反应、附着、空间或团队轮转。",
    ],
    completeAction: true,
  })));

/** Seven partial first-hit rows and seven explicit missing-second-hit blockers. */
export const replacedMaleTravelerPartialMappingIds = new Set(TRAVELER_MALE_CHARGED_ELEMENTS.flatMap(element => [
  `aether-${element}-charged-base-hit-1`, `aether-${element}-charged-base-blocked`,
]));
