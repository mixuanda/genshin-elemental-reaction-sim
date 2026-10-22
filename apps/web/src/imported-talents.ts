import type { CatalogResolvedShowcaseCharacter, CatalogResolvedSkill } from '@genshin-dps-lab/schemas';

/** A plausible sum is not evidence when its base or bonus is absent/invalid. */
export function hasKnownImportedTalent(skill: CatalogResolvedSkill): skill is CatalogResolvedSkill & { bonusLevel: number; effectiveLevel: number } {
  return skill.abilityId !== null && skill.matchStatus === 'matched'
    && Number.isInteger(skill.baseLevel) && skill.baseLevel >= 1 && skill.baseLevel <= 15
    && skill.bonusLevel !== null && Number.isInteger(skill.bonusLevel) && skill.bonusLevel >= 0
    && skill.effectiveLevel !== null && Number.isInteger(skill.effectiveLevel) && skill.effectiveLevel >= 1 && skill.effectiveLevel <= 15
    && skill.effectiveLevel === skill.baseLevel + skill.bonusLevel;
}

export function requireImportedTalentLevel(character: CatalogResolvedShowcaseCharacter, abilityId: string): number {
  const skill = character.resolvedSkills.find(row => row.abilityId === abilityId);
  if (!skill || !hasKnownImportedTalent(skill)) throw new Error('导入缺少或存在无效的基础／额外／有效天赋等级证据；请补齐后重新导入，不能把额外等级默认为0。');
  return skill.effectiveLevel;
}
