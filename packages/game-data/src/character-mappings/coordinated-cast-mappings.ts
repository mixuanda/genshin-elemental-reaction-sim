import type { SourceHitMapping } from "./types";
import manifest from "../../sources/coordinated-casts/manifest.json";
import definitions from "../../sources/coordinated-casts/definitions.json";

export const coordinatedCastSourceEvidence = manifest;

export interface CoordinatedCastTerm {
  stat: SourceHitMapping["scalingStat"];
  values: number[];
  parameterKey?: string;
  sourceField: string;
  minimumAscension?: number;
}

export interface CoordinatedCastRole {
  mappingId: string;
  label: string;
  element: SourceHitMapping["element"];
  attackTag: "skill" | "burst";
  abilityKey: "combat2" | "combat3";
  parameterKey: string;
  terms: CoordinatedCastTerm[];
  sourceRefs: string[];
}

/** The core consumes the same JSON coefficients without importing this catalog. */
export interface CoordinatedCastTemplate {
  skillId: string;
  characterSlug: string;
  sourceSlug: string;
  talentSetId: string;
  variantId?: string;
  variantName?: string;
  abilityKey: "combat2" | "combat3";
  label: string;
  protocol: "explicit-coordinated-schedule-v1";
  scheduleKind: "normal-state" | "damage-events" | "timed-entity";
  activationFrame: number;
  lifetimeFrames: number | null;
  cooldownFrames: number;
  procHitDelayFrames: number[];
  procTalent: "selected" | "skill";
  initial?: CoordinatedCastRole;
  proc: CoordinatedCastRole;
  initialHitFrame?: number;
  initialSnapshotFrame?: number | null;
  initialScalingSnapshotFrame?: number;
  initialSnapshot?: "previous-field";
  procSnapshot: "trigger" | "trigger-plus-delay" | "cast" | "entity-spawn" | "field-create";
  volleyPattern?: number[];
  expiryInclusive: boolean;
  expiryBoundaryRequiresEventOrder?: boolean;
  reposition?: boolean;
  preservedCooldownDelayFrames?: number;
  preservedLifetimeExtensionFrames?: number;
  firstProcAfterActivationFrames?: number;
  procIntervalFrames?: number;
  assumptions: string[];
}

export const coordinatedCastTemplates = definitions.templates as CoordinatedCastTemplate[];

const assumptions = [
  "C0；使用显式事件日程协议 explicit-coordinated-schedule-v1。表中初击与追击是系数模板，追击行的 instanceCount=1 不是完整寿命内的总次数。",
  "完整动作仅在观察日程覆盖实际生命周期及已发出伤害尾段、资格与冷却均明确、各击实际命中同一存活目标时成立；核心须编译每个命中，不能把两条模板行直接相加。",
  "无卡肉、额外延长、替换或未声明中断；来源角色、在场状态、伤害标签、非零伤害及目标范围按各技能自身规则读取，不把缺失条件默认为成功。",
  "每次取样的实际面板与每击反应条件明确提供；被动实际份额减去输入已含份额以免重复。有效天赋等级显式输入，菲谢尔Q后的奥兹另用E等级。",
];
const exclusions = [
  "仅认证显式日程条件完整的自身直接伤害，不自动生成团队轮转、附着/ICD、碰撞、移动、能量、粒子、护盾或治疗。",
  "不包含高命座、旧实体并存、重新施放、目标死亡转移、故事增益、魔导与未声明的额外反应追击；固定源码一致不等于当前游戏实测认证。",
];

function mapping(cast: CoordinatedCastTemplate, role: CoordinatedCastRole): SourceHitMapping {
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
    sourceField: term.sourceField,
    ...(term.minimumAscension === undefined ? {} : { minimumAscension: term.minimumAscension }),
  }));
  return {
    id: role.mappingId,
    characterSlug: cast.characterSlug,
    talentSetId: cast.talentSetId,
    ...(cast.variantId ? { variantId: cast.variantId, variantName: cast.variantName } : {}),
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
    sourcePaths: [...new Set(role.sourceRefs)],
    assumptions: [...assumptions, ...cast.assumptions],
    exclusions,
    completeAction: true,
  };
}

/** Representative coefficients only; complete-action evaluation must compile the schedule. */
export const coordinatedCastMappings: SourceHitMapping[] = coordinatedCastTemplates.flatMap(cast => [
  ...(cast.initial ? [mapping(cast, cast.initial)] : []),
  mapping(cast, cast.proc),
]);

export const replacedCoordinatedCastPartialMappingIds = new Set([
  "xingqiu-burst-burst-hit",
  "yelan-burst-burst-hit",
  "thoma-burst-burst-hit",
  "aether-electro-burst-initial-burst",
  "aether-electro-burst-coordinated-hit-burstTick",
  "lumine-electro-burst-initial-burst",
  "lumine-electro-burst-coordinated-hit-burstTick",
  "raiden-skill-hit",
  "raiden-skill-skilltick-hit",
  "yoimiya-burst-burst-hit",
  "yoimiya-burst-burstexplode-hit",
  "albedo-skill-hit",
  "dehya-skill-hit",
  "dehya-skill-skillreposition-hit",
  "dehya-skill-skilldotatk-hit",
  "fischl-skill-birdsum-hit",
  "fischl-skill-birdatk-hit",
  "fischl-burst-burst-hit",
]);
