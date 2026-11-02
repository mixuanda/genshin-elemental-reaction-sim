import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gameDataRuntimeIndex, parseEnkaShowcase, resolveShowcaseCatalog } from '@genshin-dps-lab/game-data';
import { getCharacterDocuments } from './character-calculations';
import { applyImportedCalculatorPanel } from './calculator-import';
import { calculateDocument } from '../../../packages/sim-core/src/calculator';

const fixture = () => JSON.parse(readFileSync(new URL('../e2e/fixtures/player-import/kaeya-enka-panel.json', import.meta.url), 'utf8'));
const resolve = (raw: ReturnType<typeof fixture>) => resolveShowcaseCatalog(parseEnkaShowcase(raw, { uid: 'synthetic-local-only' })).characters[0]!;
const skill = (character: ReturnType<typeof resolve>) => character.resolvedSkills.find(row => row.skillId === '10074')!;
const document = (level: number) => getCharacterDocuments('character:10000015', level).find(row => row.gameContext?.skillId === 'kaeya-skill')!;

describe('imported base, bonus and effective talent evidence', () => {
  it.each([{ ids: [1, 1, 1] }, { ids: [1, 2, 3, 4, 5, 6, 7] }, { ids: [0] }, { ids: [-1] }])('rejects invalid constellation IDs instead of counting them as owned constellations: %j', ({ ids }) => {
    const raw = fixture(); raw.avatarInfoList[0].talentIdList = ids;
    expect(() => parseEnkaShowcase(raw, { uid: 'synthetic-local-only' })).toThrow();
  });

  it('keeps omitted and explicitly empty C0 evidence valid', () => {
    for (const ids of [undefined, []]) {
      const raw = fixture();
      if (ids === undefined) delete raw.avatarInfoList[0].talentIdList;
      else raw.avatarInfoList[0].talentIdList = ids;
      expect(resolve(raw).constellation).toBe(0);
    }
  });

  it('preserves absent bonus evidence as unknown and rejects the formerly accepted E10', () => {
    const raw = fixture(); delete raw.avatarInfoList[0].proudSkillExtraLevelMap;
    const character = resolve(raw);
    expect(character.skillLevelBonuses).toBeNull();
    expect(skill(character)).toMatchObject({ baseLevel: 10, bonusLevel: null, effectiveLevel: null });
    expect(() => applyImportedCalculatorPanel(document(10), character, 'missing bonus map')).toThrow('额外');
    expect(raw.avatarInfoList[0]).not.toHaveProperty('proudSkillExtraLevelMap');
  });

  it('keeps an explicitly empty bonus map and a real zero distinct from absence', () => {
    for (const map of [{}, { '1532': 0 }]) {
      const raw = fixture(); raw.avatarInfoList[0].proudSkillExtraLevelMap = map;
      const character = resolve(raw);
      expect(skill(character)).toMatchObject({ baseLevel: 10, bonusLevel: 0, effectiveLevel: 10 });
      const result = calculateDocument(applyImportedCalculatorPanel(document(10), character, 'explicit zero bonus'));
      expect(result.status).toBe('calculated');
      expect(result.totals?.expected).toBeCloseTo(1700 * 3.4416 * 1.616 * 0.5 * 0.9 * 1.4, 8);
    }
  });

  it('calculates the explicit +3 only once and leaves the input unchanged', () => {
    const raw = fixture(), before = JSON.stringify(raw), character = resolve(raw);
    expect(skill(character)).toMatchObject({ baseLevel: 10, bonusLevel: 3, effectiveLevel: 13 });
    const result = calculateDocument(applyImportedCalculatorPanel(document(13), character, 'explicit +3'));
    expect(result.status).toBe('calculated');
    expect(result.totals?.expected).toBeCloseTo(7031.980368, 8);
    expect(JSON.stringify(raw)).toBe(before);
  });

  it.each([{ base: 0, bonus: 3 }, { base: -1, bonus: 3 }, { base: 10, bonus: -3 }, { base: 14, bonus: 3 }])('does not turn invalid base/bonus into a plausible effective level: %j', ({ base, bonus }) => {
    const raw = fixture(); raw.avatarInfoList[0].skillLevelMap['10074'] = base; raw.avatarInfoList[0].proudSkillExtraLevelMap['1532'] = bonus;
    const character = resolve(raw);
    expect(skill(character).effectiveLevel).toBeNull();
    expect(() => applyImportedCalculatorPanel(document(Math.max(1, Math.min(15, base + bonus))), character, 'invalid talent evidence')).toThrow();
  });

  it('does not treat a missing proud-group identity as a proven zero bonus', () => {
    const raw = fixture(), imported = parseEnkaShowcase(raw, { uid: 'synthetic-local-only' });
    const catalog = { ...gameDataRuntimeIndex, enkaCharacterMappings: gameDataRuntimeIndex.enkaCharacterMappings.map(row => {
      if (row.avatarId !== 10000015) return row;
      const proudMap = { ...row.proudMap }; delete proudMap['10074']; return { ...row, proudMap };
    }) };
    const character = resolveShowcaseCatalog(imported, catalog).characters[0]!;
    expect(skill(character)).toMatchObject({ bonusLevel: null, effectiveLevel: null });
    expect(() => applyImportedCalculatorPanel(document(10), character, 'missing proud identity')).toThrow('额外');
  });

  it('rejects inconsistent effective-level evidence while allowing explicit manual talent selection', () => {
    const raw = fixture(), inconsistent = resolve(raw);
    skill(inconsistent).effectiveLevel = 10;
    expect(() => applyImportedCalculatorPanel(document(10), inconsistent, 'inconsistent sum')).toThrow('额外');
    delete raw.avatarInfoList[0].proudSkillExtraLevelMap;
    const manual = applyImportedCalculatorPanel(document(13), resolve(raw), 'unknown imported bonus, explicit manual E13', 'manual-effective');
    expect(manual.assumptions.join(' ')).toContain('手动来源选择');
    expect(calculateDocument(manual).totals?.expected).toBeCloseTo(7031.980368, 8);
  });
});
