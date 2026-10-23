import {arlecchinoPrimaryMappings,arlecchinoPrimarySourceEvidence} from './character-mappings/arlecchino-primary-mappings';
import {hutaoPrimaryMappings,hutaoPrimarySourceEvidence} from './character-mappings/hutao-primary-mappings';
import {kazuhaBurstMappings,kazuhaBurstSourceEvidence} from './character-mappings/kazuha-burst-mappings';
import {cynoDamageMappings,cynoDamageSourceEvidence} from './character-mappings/cyno-damage-mappings';
import {kinichDamageMappings,kinichDamageSourceEvidence} from './character-mappings/kinich-damage-mappings';
import {gamingDamageMappings,gamingDamageSourceEvidence} from './character-mappings/gaming-damage-mappings';
import { tighnariDamageMappings, tighnariDamageSourceEvidence } from './character-mappings/tighnari-damage-mappings';
import { manekinRawMappings, manekinRawSourceEvidence, getManekinSupplementalTalentSet } from "./character-mappings/manekin-raw-mappings";
import { released71RawMappings, released71RawSourceEvidence } from "./character-mappings/released-71-raw-mappings";
import { neferPhantasmMappings, neferPhantasmSourceEvidence } from "./character-mappings/nefer-phantasm-mappings";
import { optimizerSpecialComponents, optimizerSpecialComponentSourceEvidence } from "./character-mappings/optimizer-special-components";
import { travelerHydroResolvedMappings, travelerHydroResolvedSourceEvidence, replacedTravelerHydroResolvedBlockedMappingIds } from "./character-mappings/traveler-hydro-resolved-mappings";
import { iansanSwiftResolvedMappings, iansanSwiftResolvedSourceEvidence, replacedIansanSwiftBlockedMappingIds } from "./character-mappings/iansan-swift-resolved-mappings";
import { zibaiFiniteMappings, zibaiFiniteSourceEvidence, replacedZibaiFinitePartialMappingIds } from "./character-mappings/zibai-finite-mappings";
import { travelerCrossSourceMappings, travelerCrossSourceEvidence, replacedTravelerCrossSourceBlockedMappingIds } from "./character-mappings/traveler-cross-source-mappings";
import { travelerCryoStateMappings, travelerCryoStateSourceEvidence, supersededTravelerCryoStateBlockerIds } from "./character-mappings/traveler-cryo-state-mappings";
import { extendedStanceMappings, extendedStanceSourceEvidence, replacedExtendedStancePartialMappingIds } from "./character-mappings/extended-stance-mappings";
import { mixedSourceMappings, mixedSourceSourceEvidence, replacedMixedSourcePartialMappingIds } from "./character-mappings/mixed-source-mappings";
import { noellePlungeMappings, noellePlungeSourceEvidence, replacedNoellePlungePartialMappingIds } from "./character-mappings/noelle-plunge-mappings";
import { entityFollowupMappings, entityFollowupSourceEvidence, replacedEntityFollowupPartialMappingIds } from "./character-mappings/entity-followup-mappings";
import { idleStanceMappings, idleStanceSourceEvidence, replacedIdleStancePartialMappingIds } from "./character-mappings/idle-stance-mappings";
import { observedEntityMappings, observedEntitySourceEvidence, replacedObservedEntityPartialMappingIds } from "./character-mappings/observed-entity-mappings";
import { periodicOrdinaryMappings, periodicOrdinarySourceEvidence, replacedPeriodicOrdinaryPartialMappingIds } from "./character-mappings/periodic-ordinary-mappings";
import { travelerMaleChargedMappings, travelerMaleChargedSourceEvidence, replacedMaleTravelerPartialMappingIds } from "./character-mappings/traveler-male-charged-mappings";
import { resolveTravelerMaleChargedValues } from "./character-mappings/traveler-male-charged-values";
import { heldLifecycleMappings, heldLifecycleSourceEvidence, replacedHeldLifecyclePartialMappingIds } from "./character-mappings/held-lifecycle-mappings";
import { finiteFollowupMappings, finiteFollowupSourceEvidence, replacedFiniteFollowupPartialMappingIds } from "./character-mappings/finite-followup-mappings";
import { batchCompleteProjectileMappings, batchCompleteProjectileSourceEvidence, replacedBatchCompleteProjectilePartialMappingIds } from "./character-mappings/batch-complete-projectile-mappings";
import { coordinatedCastMappings, coordinatedCastSourceEvidence, replacedCoordinatedCastPartialMappingIds } from "./character-mappings/coordinated-cast-mappings";
import { batchCompletePeriodicMappings, batchCompletePeriodicSourceEvidence, replacedBatchCompletePeriodicPartialMappingIds } from "./character-mappings/batch-complete-periodic-mappings";
import { batchCompleteFiniteMappings, batchCompleteFiniteSourceEvidence, replacedBatchCompleteFinitePartialMappingIds } from "./character-mappings/batch-complete-finite-mappings";
import { travelerCryoCompleteMappings, travelerCryoCompleteSourceEvidence, replacedTravelerCryoPartialMappingIds, supersededTravelerCryoBlockerIds, travelerCryoResidualBlockers } from "./character-mappings/traveler-cryo-complete-mappings";
import type { GameDataCatalog } from "@genshin-dps-lab/schemas";
import { gameDataCatalog } from "./catalog";
import { runtimeDatasetMetadata } from "./runtime-metadata";
import type { RuntimeDatasetMetadata } from "./update-schema";
import { normalAttackMappings, normalAttackMappingExclusions } from "./character-mappings/normal-attack-mappings";
import { chargedAttackMappings, chargedAttackMappingExclusions } from "./character-mappings/charged-attack-mappings";
import { reviewedSkillMappings } from "./character-mappings/skill-mappings-reviewed";
import type { SourceHitMapping, SourceMappingBlocker } from "./character-mappings/types";
import pinnedSourceAvailability from "./character-mappings/pinned-source-availability.json";
import { travelerMappings, travelerMappingBlockers, travelerRoundingEvidence } from "./character-mappings/traveler-mappings";
import { currentSkillMappings } from "./character-mappings/current-skill-mappings";
import { currentSkillMappingBlockers } from "./character-mappings/current-skill-blockers";
import { currentNormalMappings, currentNormalMappingExclusions } from "./character-mappings/current-normal-mappings";
import currentPinnedSourceAvailability from "./character-mappings/pinned-current-source-availability.json";
import { newTravelerMappings, resolvedTravelerBlockerIds, currentTravelerMappingBlockers, currentTravelerBlockerAudit, currentTravelerRoundingEvidence } from "./character-mappings/traveler-mappings-current";
import { withDendroTravelerBonusRule } from "./character-mappings/dendro-traveler-bonus-mappings";
import { optimizerKachinaMappings, optimizerKachinaSourceEvidence } from "./character-mappings/optimizer-kachina-mappings";
import { optimizerNormalMappings, optimizerNormalMappingExclusions, optimizerNormalSourceEvidence } from "./character-mappings/optimizer-normal-mappings";
import { optimizerAdditionalMappings, optimizerAdditionalPlungeCastMappings, optimizerAdditionalMappingExclusions, optimizerAdditionalSourceEvidence } from "./character-mappings/optimizer-additional-mappings";
import optimizerPinnedSourceAvailability from "./character-mappings/pinned-optimizer-source-availability.json";
import { optimizerSkillMappings, optimizerSkillMappingExclusions, optimizerSkillSourceEvidence } from "./character-mappings/optimizer-skill-mappings";
import { optimizerResourceMappings, optimizerResourceSourceEvidence } from "./character-mappings/optimizer-resource-mappings";
import { optimizerLinneaMappings, optimizerLinneaMappingExclusions, optimizerLinneaSourceEvidence } from "./character-mappings/optimizer-linnea-mappings";
import { amberSkillBurstMappings } from "./character-mappings/amber-skill-burst-mappings";
import { noelleActionMappings, noelleSourceEvidence } from "./character-mappings/noelle-action-mappings";
import { baseStateAttackMappings, baseStateAttackSourceEvidence } from "./character-mappings/base-state-attack-mappings";
import { additionalBaseStateAttackMappings, additionalBaseStateAttackSourceEvidence } from "./character-mappings/base-state-additional-attack-mappings";
import { conditionedBasicActionMappings, conditionedBasicActionSourceEvidence } from "./character-mappings/conditioned-basic-action-mappings";
import { ittoKesagiriMappings, ittoKesagiriSourceEvidence } from "./character-mappings/itto-kesagiri-mappings";
import { conditionalSkillMappings, conditionalSkillSourceEvidence } from "./character-mappings/sourced-conditional-skill-mappings";
import { yanfeiChargedMappings, yanfeiChargedSourceEvidence } from "./character-mappings/yanfei-charged-mappings";
import { keqingXingqiuMappings, keqingXingqiuSourceEvidence, keqingConstellationSourceEvidence } from "./character-mappings/keqing-xingqiu-mappings";

import { kukiSkillBurstMappings, kukiSkillBurstSourceEvidence, replacedKukiPartialMappingIds } from "./character-mappings/kuki-skill-burst-mappings";

import { ningguangScreenMappings, ningguangScreenSourceEvidence } from "./character-mappings/ningguang-screen-mappings";

import { completeFollowupSkillMappings, completeFollowupSkillSourceEvidence, replacedCompleteFollowupPartialMappingIds } from "./character-mappings/complete-followup-skill-mappings";

import { colleiCharlotteSkillMappings, colleiCharlotteSkillSourceEvidence, replacedColleiCharlottePartialMappingIds } from "./character-mappings/collei-charlotte-skill-mappings";

export const CLASSIFIED_HIT_MAPPING_VERSION = "gcsim-b4ae769+a7dc4bf+optimizer-180a0a1+raw-b061b40-reviewed-hits.30+tighnari.1+gaming.1+kinich.1+cyno.1+kazuha-q.1+hutao.1+arlecchino.1+durin.8";
export const CLASSIFIED_SOURCE_COMMIT = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
export const classifiedHitSourceRefs = [
  "https://github.com/theBowja/genshin-db/blob/1bab2cdba4d218fd5caa46b5f54e7884ee8359a2/src/min/data.min.json",
  `https://github.com/genshinsim/gcsim/blob/${CLASSIFIED_SOURCE_COMMIT}/internal/characters/durin/skill.go`
];

export const durinMappings: SourceHitMapping[] = [
  { id: "durin-white-e", skillId: "durin-confirmation-of-purity", skillLabel: "转变·白化之是", hitLabel: "白 E", parameterKey: "param1", sourceCoefficientValues: [1.056, 1.1352, 1.2144, 1.32, 1.3992, 1.4784, 1.584, 1.6896, 1.7952, 1.9008, 2.0064, 2.112, 2.244, 2.376, 2.508], coefficientTolerance: 0 },
  { id: "durin-black-e-1", skillId: "durin-denial-of-darkness", skillLabel: "转变·黑度之否", hitLabel: "黑 E 第 1 段", parameterKey: "param2", sourceCoefficientValues: [0.7224, 0.77658, 0.83076, 0.903, 0.95718, 1.01136, 1.0836, 1.15584, 1.22808, 1.30032, 1.37256, 1.4448, 1.5351, 1.6254, 1.7157], coefficientTolerance: 0 },
  { id: "durin-black-e-2", skillId: "durin-denial-of-darkness", skillLabel: "转变·黑度之否", hitLabel: "黑 E 第 2 段", parameterKey: "param3", sourceCoefficientValues: [0.532, 0.5719, 0.6118, 0.665, 0.7049, 0.7448, 0.798, 0.8512, 0.9044, 0.9576, 1.0108, 1.064, 1.1305, 1.197, 1.2635], coefficientTolerance: 0 },
  { id: "durin-black-e-3", skillId: "durin-denial-of-darkness", skillLabel: "转变·黑度之否", hitLabel: "黑 E 第 3 段", parameterKey: "param4", sourceCoefficientValues: [0.6464, 0.69488, 0.74336, 0.808, 0.85648, 0.90496, 0.9696, 1.03424, 1.09888, 1.16352, 1.22816, 1.2928, 1.3736, 1.4544, 1.5352], coefficientTolerance: 0 }
].map((entry) => ({
  ...entry, characterSlug: "durin", talentSetId: "talent-set:durin", abilityKey: "combat2",
  element: "pyro", scalingStat: "atk", attackTag: "skill", completeAction: true,
  assumptions: ["显式假设已进入精质转变并选择该分支；白E为再次E，黑E为转变后普攻输入，只计算该分支列出的自身命中。", "C0–C2自身E直伤已核对；C2火伤实际生效与输入已含份额由核心逐击检查，不从反应名称猜触发。"],
  exclusions: ["Q后台、其他角色伤害与团队增益不由本条件命中生成；C2蒸发/融化的黑Q反应增益尚未接入，不当作完整队伍。"],
  sourcePaths: ["internal/characters/durin/skill.go", "internal/characters/durin/attack.go", "internal/characters/durin/cons.go", "internal/characters/durin/asc.go", "internal/characters/durin/burst.go", "internal/characters/durin/durin.go", "internal/characters/durin/zz_durin.dm.go", "pkg/enemy/damage.go"]
}));

/** A reviewed allowlist, never damage-like label parsing. */
const currentTravelerHitIds = new Set(newTravelerMappings.map((mapping) => mapping.id));
const activeTravelerBlockers = [...new Map<string, SourceMappingBlocker>([...travelerMappingBlockers, ...currentTravelerMappingBlockers].map((blocker) => [blocker.id, blocker])).values()].filter((blocker) => !resolvedTravelerBlockerIds.includes(blocker.id) && !supersededTravelerCryoStateBlockerIds.has(blocker.id) && !replacedTravelerHydroResolvedBlockedMappingIds.has(blocker.id) && !replacedIansanSwiftBlockedMappingIds.has(blocker.id) && !replacedTravelerCrossSourceBlockedMappingIds.has(blocker.id) && !supersededTravelerCryoBlockerIds.has(blocker.id) && !replacedMaleTravelerPartialMappingIds.has(blocker.id));
export const sourceClassifiedMappings: readonly SourceHitMapping[] = [...arlecchinoPrimaryMappings,...hutaoPrimaryMappings,...kazuhaBurstMappings,...cynoDamageMappings,...kinichDamageMappings,...gamingDamageMappings,...tighnariDamageMappings,...manekinRawMappings, ...released71RawMappings, ...neferPhantasmMappings, ...travelerHydroResolvedMappings, ...iansanSwiftResolvedMappings, ...zibaiFiniteMappings, ...travelerCrossSourceMappings, ...travelerCryoStateMappings, ...entityFollowupMappings, ...noellePlungeMappings, ...mixedSourceMappings, ...extendedStanceMappings, ...durinMappings, ...normalAttackMappings, ...reviewedSkillMappings.filter((mapping) => !replacedKukiPartialMappingIds.has(mapping.id)), ...chargedAttackMappings, ...travelerMappings.filter((mapping) => !currentTravelerHitIds.has(mapping.id)), ...currentSkillMappings, ...currentNormalMappings, ...newTravelerMappings, ...optimizerKachinaMappings, ...optimizerNormalMappings, ...optimizerAdditionalMappings, ...optimizerAdditionalPlungeCastMappings, ...optimizerSkillMappings, ...optimizerResourceMappings, ...optimizerLinneaMappings, ...amberSkillBurstMappings, ...noelleActionMappings, ...baseStateAttackMappings, ...additionalBaseStateAttackMappings, ...conditionedBasicActionMappings, ...ittoKesagiriMappings, ...conditionalSkillMappings, ...yanfeiChargedMappings, ...keqingXingqiuMappings, ...ningguangScreenMappings, ...kukiSkillBurstMappings, ...completeFollowupSkillMappings, ...colleiCharlotteSkillMappings, ...batchCompleteProjectileMappings, ...batchCompletePeriodicMappings, ...batchCompleteFiniteMappings, ...travelerCryoCompleteMappings, ...coordinatedCastMappings, ...heldLifecycleMappings, ...finiteFollowupMappings, ...idleStanceMappings, ...observedEntityMappings, ...periodicOrdinaryMappings, ...travelerMaleChargedMappings].filter(mapping => !replacedZibaiFinitePartialMappingIds.has(mapping.id) && !replacedTravelerCrossSourceBlockedMappingIds.has(mapping.id) && !supersededTravelerCryoStateBlockerIds.has(mapping.id) && !replacedExtendedStancePartialMappingIds.has(mapping.id) && !replacedMixedSourcePartialMappingIds.has(mapping.id) && !replacedNoellePlungePartialMappingIds.has(mapping.id) && !replacedEntityFollowupPartialMappingIds.has(mapping.id) && !replacedIdleStancePartialMappingIds.has(mapping.id) && !replacedObservedEntityPartialMappingIds.has(mapping.id) && !replacedPeriodicOrdinaryPartialMappingIds.has(mapping.id) && !replacedMaleTravelerPartialMappingIds.has(mapping.id) && !replacedHeldLifecyclePartialMappingIds.has(mapping.id) && !replacedFiniteFollowupPartialMappingIds.has(mapping.id) && !replacedCoordinatedCastPartialMappingIds.has(mapping.id) && !replacedBatchCompleteProjectilePartialMappingIds.has(mapping.id) && !replacedBatchCompletePeriodicPartialMappingIds.has(mapping.id) && !replacedBatchCompleteFinitePartialMappingIds.has(mapping.id) && !replacedTravelerCryoPartialMappingIds.has(mapping.id) && !replacedCompleteFollowupPartialMappingIds.has(mapping.id) && !replacedColleiCharlottePartialMappingIds.has(mapping.id)).map(withDendroTravelerBonusRule);
const explicitSourceBlockers: SourceMappingBlocker[] = [...activeTravelerBlockers, ...currentSkillMappingBlockers.filter(blocker => !supersededTravelerCryoBlockerIds.has(blocker.id)), ...travelerCryoResidualBlockers].filter(blocker => !supersededTravelerCryoStateBlockerIds.has(blocker.id) && !replacedTravelerHydroResolvedBlockedMappingIds.has(blocker.id) && !replacedIansanSwiftBlockedMappingIds.has(blocker.id) && !replacedTravelerCrossSourceBlockedMappingIds.has(blocker.id) &&!replacedMaleTravelerPartialMappingIds.has(blocker.id));

export interface ClassifiedCharacterHit {
  id: string; characterId: string; characterName: string; talentSetId: string; abilityId: string; abilityKey: "combat1" | "combat2" | "combat3";
  variantId?: string; variantName?: string;
  skillId: string; skillName: string; label: string;
  element: SourceHitMapping["element"]; scalingStat: SourceHitMapping["scalingStat"];
  attackTag: NonNullable<SourceHitMapping["attackTag"]>;
  coefficient: number; talentLevel: number; availableTalentLevels: number[]; coefficientField: string;
  terms: Array<{ stat: SourceHitMapping["scalingStat"]; coefficient: number; coefficientField: string; minimumAscension?: number }>;
  additiveFormulaId?: SourceHitMapping["additiveFormulaId"];
  elementalMasteryAdjustmentFormulaId?: SourceHitMapping["elementalMasteryAdjustmentFormulaId"];
  damageBonusFormulaId?: SourceHitMapping["damageBonusFormulaId"];
  resistanceReductionFormulaId?: SourceHitMapping["resistanceReductionFormulaId"];
  critRateFormulaId?: SourceHitMapping["critRateFormulaId"];
  formulaInputs: Array<{ key: string; value: number; coefficientField: string }>;
  completeAction: boolean; dataVersion: string; mappingVersion: string;
  releaseStatus: "released" | "official-next" | "preview" | "unknown";
  processingStatus: "classified"; numericEvidenceStatus: NonNullable<SourceHitMapping["numericEvidenceStatus"]>; mechanicEvidenceStatus: "partial"; resultStatus: "provisional-conditioned";
  sourceRefs: string[]; requiredAssumptions: string[]; unrelatedBlockers: string[];
}
export interface ClassifiedHitBlocker {
  id: string; characterId: string; characterName: string; skillId: string; skillName: string;
  variantId?: string; variantName?: string;
  talentSetId: string; abilityId: string; abilityKey: "combat1" | "combat2" | "combat3"; label: string;
  reasons: string[]; sourceRefs: string[]; completeAction: boolean;
}

export interface ClassifiedHitDataset {
  catalog: GameDataCatalog;
  metadata: RuntimeDatasetMetadata;
}

const activeClassifiedHitDataset: ClassifiedHitDataset = { catalog: gameDataCatalog, metadata: runtimeDatasetMetadata };

function sourceRefs(mapping: Pick<SourceHitMapping, "sourcePaths" | "sourceCommit" | "sourceRepository" | "sourceHost">, dataset: ClassifiedHitDataset): string[] {
  return [...new Set([
    ...dataset.catalog.sources.map((source) => source.url),
    ...mapping.sourcePaths.map((path) => mapping.sourceHost === "gitlab"
      ? `https://gitlab.com/${mapping.sourceRepository}/-/blob/${mapping.sourceCommit ?? CLASSIFIED_SOURCE_COMMIT}/${path}`
      : `https://github.com/${mapping.sourceRepository ?? "genshinsim/gcsim"}/blob/${mapping.sourceCommit ?? CLASSIFIED_SOURCE_COMMIT}/${path}`)
  ])];
}

/** Relevant field drift blocks just that action. Other independently valid hits survive. */
export function resolveClassifiedCharacterHits(characterId: string, talentLevel = 10, source: ClassifiedHitDataset = activeClassifiedHitDataset): { hits: ClassifiedCharacterHit[]; blockers: ClassifiedHitBlocker[] } {
  if (!Number.isInteger(talentLevel) || talentLevel < 1) throw new Error("天赋等级必须为正整数。");
  const character = source.catalog.characters.find((entry) => entry.id === characterId);
  if (!character) return { hits: [], blockers: [] };
  const talentSets = new Map(source.catalog.talentSets.map((entry) => [entry.id, entry]));
  const hits: ClassifiedCharacterHit[] = []; const blockers: ClassifiedHitBlocker[] = [];
  for (const mapping of sourceClassifiedMappings.filter((entry) => entry.characterSlug === character.slug)) {
    const supplementalTalent = source.catalog.catalogVersion === gameDataCatalog.catalogVersion && source.metadata.releaseStatus !== "preview" ? getManekinSupplementalTalentSet(characterId, mapping.talentSetId) : undefined;
    const ability = (talentSets.get(mapping.talentSetId) ?? supplementalTalent)?.abilities.find((entry) => entry.key === mapping.abilityKey);
    const skillName = mapping.skillLabel ?? `${ability?.name ?? "已分类动作"} · ${mapping.hitLabel}`;
    const refs = sourceRefs(mapping, source);
    const reasons: string[] = [];
    if (mapping.fixedOnly && (!ability || !mapping.fixedTerms?.length || talentLevel > 15)) {
      reasons.push("固定常数伤害仍需对应能力元数据、已归档固定项和有效天赋等级1至15；不能跳过缺失来源。");
    }
    const termMappings = mapping.fixedOnly ? [] : [{ scalingStat: mapping.scalingStat, parameterKey: mapping.parameterKey, sourceCoefficientValues: mapping.sourceCoefficientValues, coefficientTolerance: mapping.coefficientTolerance }, ...(mapping.additionalTerms ?? [])];
    const terms: ClassifiedCharacterHit["terms"] = termMappings.flatMap((term) => {
      const maleValues = resolveTravelerMaleChargedValues({ mapping, character, catalogVersion: source.catalog.catalogVersion, talentSetId: mapping.talentSetId, ability, parameterKey: term.parameterKey, talentLevel });
      if (maleValues?.status === "blocked") { reasons.push(maleValues.reason); return []; }
      const values = maleValues?.status === "resolved" ? maleValues.values : ability?.parameters[term.parameterKey];
      if (maleValues?.status === "resolved") refs.push(...maleValues.sourceRefs.filter(ref => !refs.includes(ref)));
      const expected = term.sourceCoefficientValues;
      if (!values || values[talentLevel - 1] === undefined || !Number.isFinite(values[talentLevel - 1])) {
        reasons.push(`缺少 ${mapping.talentSetId}.${mapping.abilityKey}.${term.parameterKey} 等级 ${talentLevel} 的已记录倍率。`); return [];
      }
      if (expected && (expected[talentLevel - 1] === undefined || expected.some((value, index) => values[index] === undefined || Math.abs(values[index]! - value) > (term.coefficientTolerance ?? 0)))) {
        reasons.push(`${mapping.talentSetId}.${mapping.abilityKey}.${term.parameterKey} 与固定来源完整倍率向量不一致，须重新核验字段语义。`); return [];
      }
      return [{ stat: term.scalingStat, coefficient: values[talentLevel - 1]! * (mapping.coefficientMultiplier ?? 1), coefficientField: maleValues?.status === "resolved" ? maleValues.coefficientField : `${mapping.talentSetId}.${mapping.abilityKey}.parameters.${term.parameterKey}[${talentLevel - 1}]` }];
    });
    for (const term of mapping.fixedTerms ?? []) terms.push({ stat: term.scalingStat, coefficient: term.coefficient, ...(term.minimumAscension === undefined ? {} : { minimumAscension: term.minimumAscension }), coefficientField: `${mapping.sourceRepository ?? "gcsim"}:${mapping.sourceCommit ?? CLASSIFIED_SOURCE_COMMIT}:${term.sourceField}` });
    const formulaInputs = (mapping.formulaParameters ?? []).flatMap((parameter) => {
      const values = ability?.parameters[parameter.parameterKey];
      if (!values || parameter.sourceCoefficientValues.some((value, index) => values[index] === undefined || Math.abs(values[index]! - value) > (parameter.coefficientTolerance ?? 0)) || values[talentLevel - 1] === undefined) {
        reasons.push(`${mapping.talentSetId}.${mapping.abilityKey}.${parameter.parameterKey} 的公式参数与固定来源完整倍率向量不一致或等级缺失。`); return [];
      }
      return [{ key: parameter.key, value: values[talentLevel - 1]!, coefficientField: `${mapping.talentSetId}.${mapping.abilityKey}.parameters.${parameter.parameterKey}[${talentLevel - 1}]` }];
    });
    if (reasons.length) {
      blockers.push({ ...(mapping.variantId === undefined ? {} : { variantId: mapping.variantId }), ...(mapping.variantName === undefined ? {} : { variantName: mapping.variantName }), id: mapping.id, characterId, characterName: character.name, skillId: mapping.skillId, skillName, talentSetId: mapping.talentSetId, abilityId: ability?.id ?? `${mapping.talentSetId}:${mapping.abilityKey}`, abilityKey: mapping.abilityKey, label: mapping.hitLabel, reasons, sourceRefs: refs, completeAction: mapping.completeAction }); continue;
    }
    const count = mapping.instanceCount ?? 1;
    const first = terms[0]!;
    for (let index = 0; index < count; index++) hits.push({
      id: count === 1 ? mapping.id : `${mapping.id}-instance-${index + 1}`,
      characterId, characterName: character.name, talentSetId: mapping.talentSetId, abilityId: ability!.id, abilityKey: mapping.abilityKey,
      ...(mapping.variantId === undefined ? {} : { variantId: mapping.variantId }), ...(mapping.variantName === undefined ? {} : { variantName: mapping.variantName }),
      skillId: mapping.skillId, skillName, label: count === 1 ? mapping.hitLabel : `${mapping.hitLabel} · 第 ${index + 1} 次命中`,
      element: mapping.element, scalingStat: mapping.scalingStat,
      attackTag: mapping.attackTag ?? (mapping.abilityKey === "combat1" ? "normal" : mapping.abilityKey === "combat2" ? "skill" : "burst"),
      ...(mapping.additiveFormulaId === undefined ? {} : { additiveFormulaId: mapping.additiveFormulaId }),
      ...(mapping.elementalMasteryAdjustmentFormulaId === undefined ? {} : { elementalMasteryAdjustmentFormulaId: mapping.elementalMasteryAdjustmentFormulaId }),
      ...(mapping.damageBonusFormulaId === undefined ? {} : { damageBonusFormulaId: mapping.damageBonusFormulaId }),
      ...(mapping.resistanceReductionFormulaId === undefined ? {} : { resistanceReductionFormulaId: mapping.resistanceReductionFormulaId }),
      ...(mapping.critRateFormulaId === undefined ? {} : { critRateFormulaId: mapping.critRateFormulaId }),
      coefficient: first.coefficient, terms, formulaInputs, coefficientField: first.coefficientField, talentLevel,
      availableTalentLevels: mapping.fixedOnly ? Array.from({ length: 15 }, (_, i) => i + 1) : (mapping.sourceCoefficientValues ?? ability!.parameters[mapping.parameterKey]!).map((_, i) => i + 1),
      completeAction: mapping.completeAction, dataVersion: source.catalog.catalogVersion, mappingVersion: CLASSIFIED_HIT_MAPPING_VERSION,
      releaseStatus: source.metadata.releaseStatus, processingStatus: "classified", numericEvidenceStatus: mapping.numericEvidenceStatus ?? "cross-checked", mechanicEvidenceStatus: "partial", resultStatus: "provisional-conditioned", sourceRefs: refs,
      requiredAssumptions: [...mapping.assumptions, "输入为命中时最终面板；不重复添加装备属性。", "反应为逐次命中的条件假设，不证明实际附着、ICD、能量或覆盖率。", "高于基础天赋上限的有效等级须由使用者另行说明合法来源；本计算不自动增加命座等级。"],
      unrelatedBlockers: [...mapping.exclusions, "完整角色被动/命座、装备触发与队伍时序未由此字段分类建立。"]
    });
  }
  for (const missing of explicitSourceBlockers.filter((entry) => entry.characterSlug === character.slug)) {
    const ability = talentSets.get(missing.talentSetId)?.abilities.find((entry) => entry.key === missing.abilityKey);
    blockers.push({
      id: missing.id, characterId, characterName: character.name,
      ...(missing.variantId === undefined ? {} : { variantId: missing.variantId }), ...(missing.variantName === undefined ? {} : { variantName: missing.variantName }),
      skillId: missing.skillId, skillName: missing.skillLabel, talentSetId: missing.talentSetId,
      abilityId: ability?.id ?? `${missing.talentSetId.replace("talent-set:", "talent:")}:${missing.abilityKey}`,
      abilityKey: missing.abilityKey, label: missing.hitLabel, reasons: [missing.reason], sourceRefs: sourceRefs(missing, source), completeAction: false
    });
  }
  return { hits, blockers };
}

export function getClassifiedCharacterHits(characterId: string, talentLevel = 10, source: ClassifiedHitDataset = activeClassifiedHitDataset): ClassifiedCharacterHit[] {
  const result = resolveClassifiedCharacterHits(characterId, talentLevel, source);
  if (!result.hits.length && result.blockers.length) throw new Error(result.blockers.flatMap((entry) => entry.reasons).join("；"));
  return result.hits;
}

export function getClassifiedHitCoverage() {
  const perCharacter = gameDataCatalog.characters.map((character) => {
    const { hits, blockers } = resolveClassifiedCharacterHits(character.id, 1);
    const actions = [...new Set(hits.map((hit) => hit.skillId))];
    const completeActions = actions.filter((skillId) => hits.filter((hit) => hit.skillId === skillId).every((hit) => hit.completeAction) && !blockers.some((blocker) => blocker.skillId === skillId)).length;
    return { characterId: character.id, name: character.name, slug: character.slug, releasePatch: character.releasePatch, hits: hits.length, completeActions, partialActions: actions.length - completeActions, blockedMappings: blockers.length };
  }).filter((entry) => entry.hits > 0 || entry.blockedMappings > 0);
  const uncoveredCharacterIdentities = gameDataCatalog.characters.filter((character) => !perCharacter.some((entry) => entry.characterId === character.id)).map((character) => ({
    characterId: character.id, name: character.name, slug: character.slug, releasePatch: character.releasePatch,
    missingDependency: character.talentSetIds.length === 0 ? "catalog-talent-set-and-pinned-implementation" : currentPinnedSourceAvailability.characterDirectories.includes(character.slug) ? "reviewed-implementation-to-parameter-mapping" : character.slug === "aether" || character.slug === "lumine" ? "reviewed-traveler-variant-mapping" : "pinned-character-implementation",
    sourcePath: character.slug === "aether" || character.slug === "lumine" ? "internal/characters/traveler" : `internal/characters/${character.slug}`,
    sourceCommitChecked: currentPinnedSourceAvailability.commit,
    additionalSourceChecked: { repository: optimizerPinnedSourceAvailability.repository, commit: optimizerPinnedSourceAvailability.commit, productionSheetPresent: optimizerPinnedSourceAvailability.productionSheetSlugs.includes(character.slug) },
    reason: character.talentSetIds.length === 0 ? "活动目录未提供该身份的天赋参数集合，已检查的固定 gcsim 与 Optimizer 生产角色表亦未提供该身份的实现；不能从角色属性虚构技能倍率。" : currentPinnedSourceAvailability.characterDirectories.includes(character.slug) ? "固定源码目录存在，但尚未建立该身份的可执行字段与精确参数的审阅映射。" : character.slug === "aether" || character.slug === "lumine" ? "须按实际元素与性别分别核验共同实现和倍率；不得混用形态。" : "b4ae769、a7dc4bf 固定 gcsim 归档与 180a0a1 固定 Optimizer 生产角色表均未提供该身份实现；当前 catalog 原始参数不能单独证明伤害语义、缩放、次数与元素，须取得其他可审阅行为来源。"
  }));
  return { mappingVersion: CLASSIFIED_HIT_MAPPING_VERSION, datasetId: gameDataCatalog.catalogVersion, scope: "pinned-source-provisional-conditioned-hit-fields", charactersWithHits: perCharacter.filter((entry) => entry.hits > 0).length,
    classifiedHits: perCharacter.reduce((sum, entry) => sum + entry.hits, 0), completeActions: perCharacter.reduce((sum, entry) => sum + entry.completeActions, 0), partialActions: perCharacter.reduce((sum, entry) => sum + entry.partialActions, 0), blockedMappings: perCharacter.reduce((sum, entry) => sum + entry.blockedMappings, 0),
    standaloneSpecialComponents: { count: optimizerSpecialComponents.length, scope: "actual-component/partial", components: optimizerSpecialComponents.map(component => ({ id: component.id, characterSlug: component.characterSlug, branch: component.specialBranch, supportScope: "actual-component/partial" })) },
    conditionalFiniteActions: [{ skillId: "nefer-phantasm-observed-c0", supportScope: "conditional-finite-action", ordinaryTemplates: 2, specialInstances: 3, excludes: "whole-shadow-dance-stance" }],
    independentlyVerifiedReleasedRoster: null, teamSimulationReadyFromTheseMappings: 0, perCharacter, uncoveredCharacterIdentities, pinnedSourceAvailability, currentPinnedSourceAvailability,
    deliberateNormalExclusions: normalAttackMappingExclusions,
    deliberateChargedExclusions: chargedAttackMappingExclusions.filter((entry) => !(entry.characterSlug === "zhongli" && entry.action === "charged")),
    historicalChargedExclusions: chargedAttackMappingExclusions,
    travelerRoundingEvidence: [...travelerRoundingEvidence, ...currentTravelerRoundingEvidence],
    travelerActionBlockers: activeTravelerBlockers, historicalTravelerActionBlockers: travelerMappingBlockers,
    resolvedTravelerBlockerIds: [...resolvedTravelerBlockerIds, ...replacedTravelerHydroResolvedBlockedMappingIds, ...supersededTravelerCryoStateBlockerIds, ...replacedTravelerCrossSourceBlockedMappingIds, ...currentTravelerBlockerAudit.filter(entry => replacedMaleTravelerPartialMappingIds.has(entry.previousBlockerId)).map(entry => entry.previousBlockerId)],
    currentTravelerBlockerAudit: currentTravelerBlockerAudit.map(entry => {
      if (!replacedMaleTravelerPartialMappingIds.has(entry.previousBlockerId)) return entry;
      const replacement = travelerMaleChargedMappings.find(mapping => `${mapping.variantId}-charged-base-blocked` === entry.previousBlockerId)!;
      return { previousBlockerId: entry.previousBlockerId, status: "resolved-by-conditioned-independent-source",
        replacementSkillId: replacement.skillId, sourceRepository: replacement.sourceRepository, sourceCommit: replacement.sourceCommit,
        sourcePaths: replacement.sourcePaths, catalogSnapshotId: entry.catalogSnapshotId };
    }),
    historicalTravelerBlockerAudit: currentTravelerBlockerAudit,
    currentSourceActionBlockers: explicitSourceBlockers, currentNormalMappingExclusions,
    rawExecutionSources: [manekinRawSourceEvidence, released71RawSourceEvidence],
    independentImplementationSources: [arlecchinoPrimarySourceEvidence,hutaoPrimarySourceEvidence,kazuhaBurstSourceEvidence,cynoDamageSourceEvidence,kinichDamageSourceEvidence,gamingDamageSourceEvidence,tighnariDamageSourceEvidence,neferPhantasmSourceEvidence, optimizerSpecialComponentSourceEvidence.linnea, optimizerSpecialComponentSourceEvidence.sandrone, travelerHydroResolvedSourceEvidence, iansanSwiftResolvedSourceEvidence,zibaiFiniteSourceEvidence, travelerCrossSourceEvidence, travelerCryoStateSourceEvidence, extendedStanceSourceEvidence, mixedSourceSourceEvidence, noellePlungeSourceEvidence, entityFollowupSourceEvidence, optimizerKachinaSourceEvidence, optimizerNormalSourceEvidence, optimizerAdditionalSourceEvidence, optimizerSkillSourceEvidence, optimizerResourceSourceEvidence, optimizerLinneaSourceEvidence, noelleSourceEvidence, baseStateAttackSourceEvidence, additionalBaseStateAttackSourceEvidence, conditionedBasicActionSourceEvidence, ittoKesagiriSourceEvidence, conditionalSkillSourceEvidence, yanfeiChargedSourceEvidence, keqingXingqiuSourceEvidence, keqingConstellationSourceEvidence, ningguangScreenSourceEvidence, kukiSkillBurstSourceEvidence, completeFollowupSkillSourceEvidence, colleiCharlotteSkillSourceEvidence, batchCompleteProjectileSourceEvidence, batchCompletePeriodicSourceEvidence, batchCompleteFiniteSourceEvidence, travelerCryoCompleteSourceEvidence, coordinatedCastSourceEvidence, heldLifecycleSourceEvidence, finiteFollowupSourceEvidence, idleStanceSourceEvidence, observedEntitySourceEvidence, periodicOrdinarySourceEvidence, travelerMaleChargedSourceEvidence],
    optimizerPinnedSourceAvailability, optimizerMappingExclusions: [...optimizerNormalMappingExclusions, ...optimizerAdditionalMappingExclusions, ...optimizerSkillMappingExclusions, ...optimizerLinneaMappingExclusions] };
}
