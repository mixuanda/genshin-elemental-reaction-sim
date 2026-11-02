import type { CatalogResolvedShowcaseCharacter } from '@genshin-dps-lab/schemas';
import { findRuntimeCharacterByAvatarId, findRuntimeEnkaCharacterMapping, findRuntimeTalentSetForCharacter } from '../../../packages/game-data/src/catalog-runtime';
import { parseEnkaShowcase, resolveShowcaseCatalog } from '../../../packages/game-data/src/showcase';
import { createCoreHandoff, type DamageElement, type ImportSnapshot, type PlayerBuild } from '../../../packages/player-import/src/index';

export type ManualEffectiveTalents = { auto: number; skill: number; burst: number };
const names = ['auto', 'skill', 'burst'] as const;
const validInteger = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;

/** An explicit alternative for missing effective-talent evidence, never a repair of the source. */
export function preparePlayerPanelWithManualTalents(
  raw: string,
  build: PlayerBuild,
  source: ImportSnapshot['source'],
  levels: ManualEffectiveTalents,
): { character: CatalogResolvedShowcaseCharacter; source: string; manualEffectiveTalents: ManualEffectiveTalents } {
  if (source.kind !== 'enka-json' && source.kind !== 'enka-uid')
    throw new Error('只有Enka最终面板可使用手填有效天赋；不能据此补齐装备或文本记账。');
  if (!levels || typeof levels !== 'object' || Array.isArray(levels)
    || Object.keys(levels).length !== 3 || names.some(name => !Object.hasOwn(levels, name) || !validInteger(levels[name], 1, 15)))
    throw new Error('请明确填写普攻、战技、爆发三项有效天赋等级，均须为1–15的整数；未知值或数字字符串不可代替。');

  const resolved = resolveShowcaseCatalog(parseEnkaShowcase(JSON.parse(raw), {
    uid: source.uid ?? '', fetchedAt: source.fetchedAt ?? source.importedAt,
  }));
  const matches = resolved.characters.filter(character => character.catalog.characterId === build.identity.value?.id);
  if (build.identity.state !== 'known' || matches.length !== 1 || matches[0]!.catalog.matchStatus !== 'matched')
    throw new Error('角色身份未知或重复，不能选择默认角色。');
  const character = matches[0]!;
  const element = character.catalog.element;
  if (!element || !['physical', 'pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'].includes(element))
    throw new Error('元素映射不可用。');
  const panel = createCoreHandoff(build, source, element as DamageElement).panel;
  if (panel.status !== 'ready') throw new Error(panel.reasons.join('；'));
  if (!validInteger(character.level, 1, 100) || !validInteger(character.constellation, 0, 6)
    || !validInteger(character.ascension, 0, 6)
    || character.avatarId !== panel.data.avatarId || character.level !== panel.data.level
    || character.constellation !== panel.data.constellation || character.ascension !== panel.data.ascension)
    throw new Error('原始展示柜与规范化等级/命座/突破缺失或不一致；手填天赋不能补齐这些字段。');

  for (const key of ['maxHp', 'attack', 'defense', 'elementalMastery', 'critRate', 'critDamage', 'energyRecharge'] as const) {
    const amount = character.stats[key];
    if (amount === null || !Number.isFinite(amount) || amount < 0 || amount !== panel.data.stats[key])
      throw new Error(`必需面板属性${key}缺失、无效或与规范化数据不一致。`);
  }
  const bonus = character.stats.damageBonuses[element];
  if (bonus === null || bonus === undefined || !Number.isFinite(bonus) || bonus < 0
    || bonus !== panel.data.stats.damageBonuses[element as DamageElement])
    throw new Error('所选元素伤害加成缺失、无效或与规范化数据不一致。');

  const record = findRuntimeCharacterByAvatarId(character.avatarId);
  const mapping = findRuntimeEnkaCharacterMapping(character.avatarId, Object.keys(character.skillLevels));
  const talentSet = record && mapping ? findRuntimeTalentSetForCharacter(record, mapping) : null;
  if (!record || !mapping || !talentSet || character.resolvedSkills.length !== 3 || mapping.skillOrder.length !== 3)
    throw new Error('三项战斗天赋身份缺失或映射不受支持；手填等级不能替代技能身份。');
  for (const [index, name] of names.entries()) {
    const ability = talentSet.abilities.filter(entry => entry.key === `combat${index + 1}`);
    const skillId = String(mapping.skillOrder[index]);
    const skills = character.resolvedSkills.filter(entry => entry.skillId === skillId);
    const base = build.talents[name].base;
    if (ability.length !== 1 || skills.length !== 1 || skills[0]!.matchStatus !== 'matched'
      || skills[0]!.abilityId !== ability[0]!.id || !validInteger(skills[0]!.baseLevel, 1, 10)
      || base.state !== 'known' || base.value !== skills[0]!.baseLevel)
      throw new Error('三项战斗天赋身份或基础等级缺失、不一致；不以手填有效等级修补原始证据。');
  }

  return {
    character,
    source: `${source.kind} · ${source.scope} · ${source.importedAt}${source.fixture ? ' · 合成测试数据' : ''} · 最终面板（装备不再次加入；战斗条件未还原） · 有效天赋等级由用户手动输入，未由展柜验证（普攻${levels.auto}／战技${levels.skill}／爆发${levels.burst}；不再叠加命座等级）`,
    manualEffectiveTalents: { auto: levels.auto, skill: levels.skill, burst: levels.burst },
  };
}
