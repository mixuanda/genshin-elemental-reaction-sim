import type { SourceHitMapping } from "./types";
import definitions from "../../sources/released-71-raw-casts/definitions.json";
import manifest from "../../sources/released-71-raw-casts/manifest.json";

export const released71RawSourceEvidence = manifest;
export const released71RawCoefficients = definitions.coefficients;
export const released71RawStateContracts = definitions.stateContracts;
export const released71RawPendingComponents = definitions.pendingComponents;

export interface Released71RawRole {
  id: string;
  label: string;
  coefficientId: string;
  parameterKey: string;
  sourceField: string;
  sourceAbility: string;
  sourceModifier?: string;
  sourceBranch?: { key: string; value: boolean; collisionCount: number };
  scalingStat: "atk";
  element: "hydro" | "physical";
  attackTag: "normal" | "charged" | "plunge";
  instanceCount: number;
}

export interface Released71RawTemplate {
  skillId: string;
  characterSlug: "vodyanitsa" | "vesna";
  talentSetId: string;
  abilityKey: "combat1";
  label: string;
  stateContract: "vodyanitsa-base-c0" | "vesna-base-c0";
  completeAction: true;
  roles: Released71RawRole[];
  sourcePaths: string[];
  assumptions: string[];
  exclusions: string[];
}

export const released71RawTemplates = definitions.templates as Released71RawTemplate[];

const coefficients = new Map(released71RawCoefficients.map(row => [row.id, row]));
const baseStateAssumptions = {
  vodyanitsa: [
    "C0；遥久之歌、领唱和重唱均未生效，且不存在本角色引起的星扩散风旋伤害。",
    "E状态结束不代表30秒领唱/重唱池结束；这些状态须分别确认。",
  ],
  vesna: [
    "C0；巡风列装及辉映·星扩散均未生效，无外部附魔，使用默认物理攻击模式。",
    "本动作不唤出风翎或灵剑；E状态下的风元素攻击需要另外的完整状态分支。",
  ],
};

/** Damage-complete base actions under explicit state contracts. These are not
 * animation schedules or a declaration that either character is team-ready.
 * All vectors agree exactly across catalog, genshin-db and the release dump;
 * those are one extraction lineage, not independent game-mechanics validation.
 */
export const released71RawMappings: SourceHitMapping[] = released71RawTemplates.flatMap(template =>
  template.roles.map(role => {
    const coefficient = coefficients.get(role.coefficientId);
    if (!coefficient) throw new Error(`Missing released 7.1 coefficient: ${role.coefficientId}`);
    return {
      id: role.id,
      characterSlug: template.characterSlug,
      variantId: template.stateContract,
      variantName: template.characterSlug === "vodyanitsa" ? "基础水伤·自身特技状态未激活" : "基础物理·巡风列装未激活",
      talentSetId: template.talentSetId,
      abilityKey: template.abilityKey,
      parameterKey: role.parameterKey,
      skillId: template.skillId,
      skillLabel: template.label,
      hitLabel: role.label,
      element: role.element,
      attackTag: role.attackTag,
      scalingStat: role.scalingStat,
      instanceCount: role.instanceCount,
      sourceCoefficientValues: coefficient.sourceValues,
      coefficientTolerance: 0,
      sourceRepository: "Dimbreath/AnimeGameData2" as const,
      sourceHost: "gitlab" as const,
      sourceCommit: manifest.revision,
      numericEvidenceStatus: "cross-checked" as const,
      sourcePaths: template.sourcePaths,
      assumptions: [...baseStateAssumptions[template.characterSlug], ...template.assumptions],
      exclusions: template.exclusions,
      completeAction: true,
    };
  }),
);
