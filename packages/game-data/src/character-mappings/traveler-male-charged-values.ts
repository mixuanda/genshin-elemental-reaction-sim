import comparison from "../../sources/traveler-male-charged-resolution/comparison.json";
import projection from "../../sources/traveler-male-charged-resolution/catalog-projection.json";
import type { SourceHitMapping } from "./types";

export const TRAVELER_MALE_CHARGED_ELEMENTS = ["anemo", "geo", "electro", "dendro", "hydro", "pyro", "cryo"] as const;
export type TravelerMaleChargedElement = typeof TRAVELER_MALE_CHARGED_ELEMENTS[number];
export type TravelerMaleChargedRole = "hit-1" | "hit-2";
export const TRAVELER_MALE_CHARGED_OPTIMIZER_REVISION = "180a0a1015cb725c7570cd828eb086749960df98";
export const TRAVELER_MALE_CHARGED_GCSIM_REVISION = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd";
const optimizerRoot = `https://github.com/frzyc/genshin-optimizer/blob/${TRAVELER_MALE_CHARGED_OPTIMIZER_REVISION}/`;

export function travelerMaleChargedParameterPath(element: TravelerMaleChargedElement): string {
  return `libs/gi/stats/Data/Characters/Traveler${element[0]!.toUpperCase()}${element.slice(1)}M/skillParam.json`;
}

/** Only the reviewed male-specific vectors are exposed; no caller-supplied override. */
export function travelerMaleChargedSourceValues(element: TravelerMaleChargedElement, role: TravelerMaleChargedRole): number[] {
  const row = comparison.elements.find(entry => entry.element === element)!;
  return row.rows.map(level => role === "hit-1" ? level.optimizerMaleHit1 : level.optimizerMaleHit2);
}

export interface TravelerMaleChargedValueInput {
  mapping: SourceHitMapping;
  character: { id: string; slug: string; avatarId?: number | undefined; talentSetIds: readonly string[] };
  catalogVersion: string;
  talentSetId: string;
  ability?: { id: string; key: string; parameters: Record<string, number[]> } | undefined;
  parameterKey: string;
  talentLevel: number;
}
export type TravelerMaleChargedValueResolution =
  | { status: "resolved"; values: number[]; coefficientField: string; sourceRefs: string[] }
  | { status: "blocked"; reason: string };
const same = (actual: readonly number[] | undefined, expected: readonly number[]): boolean => {
  if (!actual || actual.length !== expected.length) return false;
  return expected.every((value, index) => actual[index] === value);
};

/** Fourteen exact mappings only. An unrelated mapping returns null; any scoped drift blocks. */
export function resolveTravelerMaleChargedValues(input: TravelerMaleChargedValueInput): TravelerMaleChargedValueResolution | null {
  const match = TRAVELER_MALE_CHARGED_ELEMENTS.flatMap(element => (["hit-1", "hit-2"] as const).map(role => ({
    element, role, skillId: `male-charged-aether-${element}-c0`, id: `male-charged-aether-${element}-c0-${role}`,
  }))).find(row => row.id === input.mapping.id);
  if (!match) return null;
  const block = (reason: string): TravelerMaleChargedValueResolution => ({ status: "blocked", reason: `空的男性专属重击来源未通过身份／完整向量核准：${reason}` });
  const { mapping, character, ability } = input;
  const expectedCharacter = projection.characters.find(entry => entry.slug === "aether")!;
  const talentSetId = `talent-set:traveler${match.element}`;
  const expectedAbility = projection.talentSets.find(entry => entry.id === talentSetId)!.abilities[0]!;
  const parameterKey = match.role === "hit-1" ? "param6" : "param7";
  const values = travelerMaleChargedSourceValues(match.element, match.role);
  const maleSecond = travelerMaleChargedSourceValues(match.element, "hit-2");
  if (character.id !== expectedCharacter.id || character.slug !== "aether" || character.avatarId !== expectedCharacter.avatarId
    || character.talentSetIds.length !== expectedCharacter.talentSetIds.length
    || expectedCharacter.talentSetIds.some(id => !character.talentSetIds.includes(id))) return block("角色必须是固定目录中空的精确身份及七元素天赋集合，不能套用荧或其他角色。");
  if (input.catalogVersion !== projection.catalogVersion) return block("目录版本已改变，需要重新核准男性数值与字段语义。");
  if (mapping.characterSlug !== "aether" || mapping.variantId !== `aether-${match.element}` || mapping.skillId !== match.skillId
    || mapping.talentSetId !== talentSetId || input.talentSetId !== talentSetId || mapping.abilityKey !== "combat1"
    || mapping.parameterKey !== parameterKey || input.parameterKey !== parameterKey
    || mapping.element !== "physical" || mapping.attackTag !== "charged" || mapping.scalingStat !== "atk"
    || mapping.sourceRepository !== "frzyc/genshin-optimizer" || mapping.sourceCommit !== TRAVELER_MALE_CHARGED_OPTIMIZER_REVISION
    || mapping.coefficientTolerance !== 0 || (mapping.coefficientMultiplier ?? 1) !== 1 || (mapping.instanceCount ?? 1) !== 1
    || !same(mapping.sourceCoefficientValues, values) || mapping.additionalTerms?.length || mapping.fixedTerms?.length) return block("映射身份、男性来源或两段公式已漂移。");
  if (!ability || ability.id !== expectedAbility.id || ability.key !== expectedAbility.key) return block("普攻能力身份缺失或改变。");
  const expectedParameters = expectedAbility.parameters as Record<string, number[]>;
  if (Object.keys(ability.parameters).length !== Object.keys(expectedParameters).length) return block("普攻参数集合已改变。");
  for (const [key, expected] of Object.entries(expectedParameters)) {
    const accepted = same(ability.parameters[key], expected) || key === "param7" && same(ability.parameters[key], maleSecond);
    if (!accepted) return block(`${talentSetId}.combat1.${key} 不等于已归档完整向量；第二段也不是已核准的男性向量。`);
  }
  if (!Number.isInteger(input.talentLevel) || input.talentLevel < 1 || input.talentLevel > values.length) return block("有效天赋等级不在固定来源 1–15 级范围内。");
  const path = travelerMaleChargedParameterPath(match.element), parameterIndex = match.role === "hit-1" ? 5 : 6;
  return {
    status: "resolved", values,
    coefficientField: `frzyc/genshin-optimizer:${TRAVELER_MALE_CHARGED_OPTIMIZER_REVISION}:${path}.auto[${parameterIndex}][${input.talentLevel - 1}]`,
    sourceRefs: [optimizerRoot + path, optimizerRoot + "libs/gi/sheets/src/Characters/Traveler/index.tsx"],
  };
}
