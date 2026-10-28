import { describe, expect, it } from 'vitest';
import { gameDataRuntimeIndex, findRuntimeEnkaCharacterMapping } from '../../../packages/game-data/src/catalog-runtime';
import { parseEnkaShowcase, resolveShowcaseCatalog } from '../../../packages/game-data/src/showcase';
import { importPlayerInput } from '../../../packages/player-import/src/index';
import { preparePlayerPanel } from './player-import-handoff';

// These skill IDs and element identities are from the pinned Enka mappings.
// All progress and panel values below are synthetic, with no account request.
const travelers = [
  { avatarId: 10000005, element: 'pyro', ids: [100541, 10097, 10098] },
  { avatarId: 10000005, element: 'hydro', ids: [100542, 10087, 10088] },
  { avatarId: 10000005, element: 'anemo', ids: [100543, 10067, 10068] },
  { avatarId: 10000005, element: 'geo', ids: [100545, 10077, 10078] },
  { avatarId: 10000005, element: 'electro', ids: [100546, 10602, 10605] },
  { avatarId: 10000005, element: 'dendro', ids: [100547, 10117, 10118] },
  { avatarId: 10000007, element: 'pyro', ids: [100551, 10097, 10098] },
  { avatarId: 10000007, element: 'hydro', ids: [100552, 10087, 10088] },
  { avatarId: 10000007, element: 'anemo', ids: [100553, 10067, 10068] },
  { avatarId: 10000007, element: 'geo', ids: [100555, 10077, 10078] },
  { avatarId: 10000007, element: 'electro', ids: [100556, 10602, 10605] },
  { avatarId: 10000007, element: 'dendro', ids: [100557, 10117, 10118] }
] as const;

function response(avatarId: number, ids: readonly number[]) {
  return {
    syntheticFixture: true,
    playerInfo: {},
    avatarInfoList: [{
      avatarId,
      propMap: { '4001': { val: '90' }, '1002': { val: '6' } },
      talentIdList: [],
      skillLevelMap: Object.fromEntries(ids.map((id, index) => [String(id), [7, 8, 9][index % 3]!])),
      proudSkillExtraLevelMap: {},
      fightPropMap: {
        '2000': 18000, '2001': 1700, '2002': 800, '28': 0,
        '20': 0.4, '22': 1, '23': 1.5, '30': 0,
        '40': 0.466, '41': 0.466, '42': 0.466, '43': 0.466,
        '44': 0.466, '45': 0.466, '46': 0.466
      }
    }]
  };
}

function preview(raw: ReturnType<typeof response>) {
  const text = JSON.stringify(raw);
  const imported = importPlayerInput(text, { fixture: true });
  if (!imported.ok) throw new Error(imported.message);
  return () => preparePlayerPanel(text, imported.snapshot.builds[0]!, imported.snapshot.source);
}

const customCatalog = structuredClone(gameDataRuntimeIndex);
customCatalog.enkaCharacterMappings.reverse();
customCatalog.talentSets.reverse();

describe('traveler Enka variant identity and final-panel handoff', () => {
  it.each(travelers)('uses the actual $avatarId / $element variant in runtime and custom catalogs', ({ avatarId, element, ids }) => {
    const raw = response(avatarId, ids);
    const before = structuredClone(raw);
    const parsed = parseEnkaShowcase(raw, { uid: '900000003' });
    expect(findRuntimeEnkaCharacterMapping(avatarId, ids.map(String)))
      .toMatchObject({ avatarId, element, skillOrder: [...ids] });
    for (const catalog of [gameDataRuntimeIndex, customCatalog]) {
      const character = resolveShowcaseCatalog(parsed, catalog).characters[0]!;
      expect(character.catalog).toMatchObject({ characterId: `character:${avatarId}`, element, simulationStatus: 'metadata-only' });
      expect(character.resolvedSkills).toHaveLength(3);
      ids.forEach((id, index) => expect(character.resolvedSkills.find(skill => skill.skillId === String(id))).toMatchObject({
        skillId: String(id), abilityId: `talent:traveler${element}:combat${index + 1}`,
        baseLevel: [7, 8, 9][index], bonusLevel: 0, effectiveLevel: [7, 8, 9][index], matchStatus: 'matched'
      }));
    }
    expect(raw).toEqual(before);
  });

  it.each(travelers)('previews the complete $avatarId / $element final panel with independent equipment gating', ({ avatarId, element, ids }) => {
    const raw = response(avatarId, ids);
    const before = structuredClone(raw);
    const prepared = preview(raw)();
    expect(prepared.character.catalog).toMatchObject({ characterId: `character:${avatarId}`, element });
    expect(prepared.character).toMatchObject({ level: 90, ascension: 6, constellation: 0, weapon: null });
    expect(prepared.character.stats.attack).toBe(1700);
    expect(ids.map(id => prepared.character.resolvedSkills.find(skill => skill.skillId === String(id))?.effectiveLevel)).toEqual([7, 8, 9]);
    expect(prepared.source).toContain('合成测试数据');
    expect(raw).toEqual(before);
  });

  for (const avatarId of [10000005, 10000007]) {
    const pyroAuto = avatarId === 10000005 ? 100541 : 100551;
    const hydroAuto = avatarId === 10000005 ? 100542 : 100552;
    const foreignAuto = avatarId === 10000005 ? 100551 : 100541;
    it.each([
      { name: 'no skill IDs', ids: [] },
      { name: 'zero matches', ids: [999999] },
      { name: 'tied elements', ids: [pyroAuto, hydroAuto] },
      { name: 'shared anemo skills without a unique variant', ids: [10067, 10068] },
      { name: 'mixed element variants', ids: [pyroAuto, 10097, 10098, hydroAuto] },
      { name: 'foreign gender auto with shared E/Q', ids: [foreignAuto, 10097, 10098] }
    ])(`keeps ${avatarId} unknown and blocks $name`, ({ ids }) => {
      const raw = response(avatarId, ids);
      expect(findRuntimeEnkaCharacterMapping(avatarId, ids.map(String))).toBeNull();
      for (const catalog of [gameDataRuntimeIndex, customCatalog]) {
        const character = resolveShowcaseCatalog(parseEnkaShowcase(raw, { uid: '900000003' }), catalog).characters[0]!;
        expect(character.catalog.element).toBe('unknown');
        expect(character.resolvedSkills.every(skill => skill.abilityId === null && skill.matchStatus === 'unmatched')).toBe(true);
      }
      expect(preview(raw)).toThrow('元素映射不可用');
    });
  }

  it('does not choose a duplicate highest-scoring variant from a custom catalog', () => {
    const catalog = structuredClone(customCatalog);
    const mapping = catalog.enkaCharacterMappings.find(entry => entry.avatarId === 10000005 && entry.element === 'pyro')!;
    catalog.enkaCharacterMappings.push({ ...structuredClone(mapping), variantKey: 'synthetic-duplicate' });
    const character = resolveShowcaseCatalog(parseEnkaShowcase(response(10000005, [100541, 10097, 10098]), { uid: '900000003' }), catalog).characters[0]!;
    expect(character.catalog.element).toBe('unknown');
    expect(character.resolvedSkills.every(skill => skill.abilityId === null)).toBe(true);
  });

  it('preserves known single-element identity without inferring unknown skills', () => {
    expect(findRuntimeEnkaCharacterMapping(10000015)).toMatchObject({ avatarId: 10000015, element: 'cryo' });
    for (const catalog of [gameDataRuntimeIndex, customCatalog]) {
      const character = resolveShowcaseCatalog(parseEnkaShowcase(response(10000015, [999999]), { uid: '900000003' }), catalog).characters[0]!;
      expect(character.catalog.element).toBe('cryo');
      expect(character.resolvedSkills[0]).toMatchObject({ abilityId: null, matchStatus: 'unmatched', bonusLevel: null, effectiveLevel: null });
    }
  });
});
