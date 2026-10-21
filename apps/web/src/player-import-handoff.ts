import { parseEnkaShowcase, resolveShowcaseCatalog } from '../../../packages/game-data/src/showcase';
import type { DamageElement } from '../../../packages/player-import/src/core-handoff';
import { createCoreHandoff, type ImportSnapshot, type PlayerBuild } from '../../../packages/player-import/src/index';
import { resolveEquipmentBuild } from '@genshin-dps-lab/game-data/equipment-build';
import type { BuildHandoffMetadata } from './build-workshop';

/** Equipment and final panel are alternative accounting routes. This bridge uses equipment only. */
export function preparePlayerEquipment(build: PlayerBuild, source: ImportSnapshot['source']) {
  const handoff = createCoreHandoff(build, source, 'physical');
  const e = handoff.equipment;
  if (e.status !== 'ready' || !e.equipmentInput) throw new Error(e.reasons.join('；') || '配装不完整。');
  if (build.identity.state !== 'known' || build.identity.value?.id !== e.equipmentInput.characterId) throw new Error('角色身份不一致。');
  const { auto, skill, burst } = e.baseTalentLevels;
  for (const n of [auto, skill, burst]) if (n === null || !Number.isInteger(n) || n < 1 || n > 10) throw new Error('缺少合法基础天赋，不能以有效等级或默认值代替。');
  if (e.constellation === null || !Number.isInteger(e.constellation) || e.constellation < 0 || e.constellation > 6) throw new Error('缺少合法命座，不能默认为 C0。');
  const input = structuredClone(e.equipmentInput);
  // The existing core checks identities, weapon compatibility and observed artifact values.
  resolveEquipmentBuild(input);
  const metadata: BuildHandoffMetadata = {
    constellation: e.constellation, baseTalentLevels: { auto: auto!, skill: skill!, burst: burst! },
    label: `${build.identity.value.name} · ${source.kind} · ${source.scope} · ${source.importedAt}${source.fixture ? ' · 合成测试数据' : ''} · 装备推导（未叠加最终面板；装备条件效果关闭）`
  };
  return { input, metadata };
}


/** Keep final-panel calculation on the existing showcase parser and calculator path. */
export function preparePlayerPanel(raw: string, build: PlayerBuild, source: ImportSnapshot['source']) {
  if (source.kind !== 'enka-json' && source.kind !== 'enka-uid') throw new Error('只有 Enka 最终面板路线可用；文本面板记账未经核验。');
  const envelope = JSON.parse(raw);
  // Enka documents val as authoritative (ival is ignored). Adapt only this
  // fresh in-memory copy to the legacy parser; never rewrite imported files.
  for (const avatar of envelope.avatarInfoList ?? []) {
    const level = avatar.propMap?.['4001'];
    if (level && Object.hasOwn(level, 'val')) level.ival = level.val;
  }
  const resolved = resolveShowcaseCatalog(parseEnkaShowcase(envelope, { uid: source.uid ?? '', fetchedAt: source.fetchedAt ?? source.importedAt }));
  const matches = resolved.characters.filter(c => c.catalog.characterId === build.identity.value?.id);
  if (build.identity.state !== 'known' || matches.length !== 1) throw new Error('角色身份未知或重复，不能选择默认角色。');
  const character = matches[0]!;
  const element = character.catalog.element;
  if (!element || !['physical','pyro','hydro','cryo','electro','anemo','geo','dendro'].includes(element)) throw new Error('元素映射不可用。');
  const panel = createCoreHandoff(build, source, element as DamageElement).panel;
  if (panel.status !== 'ready') throw new Error(panel.reasons.join('；'));
  // Do not silently reconcile disagreements between the two independently validated representations.
  if (character.level !== panel.data.level || character.constellation !== panel.data.constellation || character.ascension !== panel.data.ascension) throw new Error('原始展示柜与规范化等级/命座/突破不一致；需补齐原始字段。');
  if (!character.resolvedSkills.length || character.resolvedSkills.some(s => !s.abilityId || s.matchStatus !== 'matched' || !Number.isInteger(s.baseLevel) || s.baseLevel < 1 || s.baseLevel > 10 || !Number.isInteger(s.bonusLevel) || s.bonusLevel < 0 || s.effectiveLevel > 15)) throw new Error('技能或有效天赋映射不受支持。');
  for (const [i, name] of (['auto','skill','burst'] as const).entries()) {
    const talent = build.talents[name];
    const skill = character.resolvedSkills.find(s => s.abilityId?.endsWith(`:combat${i+1}`));
    if (!skill || talent.base.state !== 'known' || talent.bonus.state !== 'known' || talent.effective.state !== 'known' || talent.base.value !== skill.baseLevel || talent.bonus.value !== skill.bonusLevel || talent.effective.value !== skill.effectiveLevel) throw new Error('基础/额外/有效天赋证据缺失或不一致；不默认额外等级。');
  }
  return { character, source: `${source.kind} · ${source.scope} · ${source.importedAt}${source.fixture ? ' · 合成测试数据' : ''} · 最终面板（装备不再次加入；战斗条件未还原）` };
}
