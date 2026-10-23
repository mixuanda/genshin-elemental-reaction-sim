import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseEnkaShowcase, resolveShowcaseCatalog } from '../../../packages/game-data/src/showcase';
import { importPlayerInput, type PlayerBuild } from '../../../packages/player-import/src/index';
import { preparePlayerPanel } from './player-import-handoff';
import { preparePlayerPanelWithManualTalents, type ManualEffectiveTalents } from './player-import-manual-talents';

const fixture = JSON.parse(readFileSync(new URL('../e2e/fixtures/player-import/kaeya-enka-panel.json', import.meta.url), 'utf8'));
const levels: ManualEffectiveTalents = { auto: 10, skill: 13, burst: 10 };
function imported(mutate?: (data: typeof fixture) => void) {
  const data = structuredClone(fixture); delete data.avatarInfoList[0].proudSkillExtraLevelMap; mutate?.(data);
  const raw = JSON.stringify(data), result = importPlayerInput(raw, { fixture: true, now: '2026-10-23T00:00:00.000Z' });
  if (!result.ok) throw Error(result.message);
  return { raw, data, build: result.snapshot.builds[0]!, source: result.snapshot.source };
}

describe('explicit manual effective talents with an independently validated Enka final panel', () => {
  it('keeps absent extra/effective evidence unknown while handing off independent explicit levels', () => {
    const { raw, data, build, source } = imported();
    const before = structuredClone({ build, source, data }), manual = structuredClone(levels);
    expect(() => preparePlayerPanel(raw, build, source)).toThrow('天赋证据缺失');
    const prepared = preparePlayerPanelWithManualTalents(raw, build, source, manual);
    expect(prepared.character).toEqual(resolveShowcaseCatalog(parseEnkaShowcase(data, { uid: '' })).characters[0]);
    expect(prepared.character).toMatchObject({ level: 90, ascension: 6, constellation: 3, skillLevelBonuses: null, weapon: null });
    expect(prepared.character.resolvedSkills.map(skill => ({ ability: skill.abilityId, base: skill.baseLevel, bonus: skill.bonusLevel, effective: skill.effectiveLevel }))).toEqual([
      { ability: 'talent:kaeya:combat1', base: 10, bonus: null, effective: null },
      { ability: 'talent:kaeya:combat2', base: 10, bonus: null, effective: null },
      { ability: 'talent:kaeya:combat3', base: 10, bonus: null, effective: null },
    ]);
    expect(prepared.character.stats).toMatchObject({ attack: 1700, elementalMastery: 0, energyRecharge: 1.5 });
    expect(prepared.manualEffectiveTalents).toEqual({ auto: 10, skill: 13, burst: 10 });
    expect(prepared.manualEffectiveTalents).not.toBe(manual);
    expect(prepared.source).toContain('用户手动输入，未由展柜验证');
    expect(prepared.source).toContain('不再叠加命座等级');
    expect(prepared.source).toContain('装备不再次加入');
    expect({ build, source, data }).toEqual(before); expect(manual).toEqual(levels);
    expect(build.talents.skill.bonus).toMatchObject({ state: 'missing', value: null });
    expect(build.talents.skill.effective).toMatchObject({ state: 'missing', value: null });
    expect(() => preparePlayerPanel(raw, build, source)).toThrow();
  });

  it.each([1, 15])('accepts the explicitly entered effective level boundary %i without adding C3 again', level => {
    const { raw, build, source } = imported();
    expect(preparePlayerPanelWithManualTalents(raw, build, source, { auto: level, skill: level, burst: level }).manualEffectiveTalents)
      .toEqual({ auto: level, skill: level, burst: level });
  });

  it.each([0, 16, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '10', '', null, undefined, true])('rejects an invalid or unknown explicit level %j', value => {
    const { raw, build, source } = imported();
    for (const name of ['auto', 'skill', 'burst'])
      expect(() => preparePlayerPanelWithManualTalents(raw, build, source, { ...levels, [name]: value } as ManualEffectiveTalents)).toThrow('1–15');
  });

  it('rejects missing entries or an unrelated manual field instead of silently choosing values', () => {
    const { raw, build, source } = imported();
    for (const supplied of [null, [], {}, { auto: 10, skill: 13 }, { ...levels, bonus: 3 }])
      expect(() => preparePlayerPanelWithManualTalents(raw, build, source, supplied as ManualEffectiveTalents)).toThrow();
  });

  it.each(['2000', '2001', '2002', '28', '20', '22', '23', '46'])('still refuses missing required fight property %s', property => {
    const { raw, build, source } = imported(data => { delete data.avatarInfoList[0].fightPropMap[property]; });
    expect(() => preparePlayerPanelWithManualTalents(raw, build, source, levels)).toThrow();
  });

  it.each([
    (data: typeof fixture) => { delete data.avatarInfoList[0].propMap['4001'].val; },
    (data: typeof fixture) => { data.avatarInfoList[0].propMap['4001'].val = ''; },
    (data: typeof fixture) => { delete data.avatarInfoList[0].propMap['1002']; },
    (data: typeof fixture) => { data.avatarInfoList[0].talentIdList = [1, 1]; },
    (data: typeof fixture) => { data.avatarInfoList[0].skillLevelMap = { '999999': 10 }; },
    (data: typeof fixture) => { delete data.avatarInfoList[0].skillLevelMap['10075']; },
    (data: typeof fixture) => { data.avatarInfoList[0].skillLevelMap['999999'] = 10; },
    (data: typeof fixture) => { data.avatarInfoList[0].skillLevelMap['10074'] = 0; },
    (data: typeof fixture) => { data.avatarInfoList[0].skillLevelMap['10074'] = 11; },
    (data: typeof fixture) => { data.avatarInfoList[0].avatarId = 99999999; },
    (data: typeof fixture) => { data.avatarInfoList.push(structuredClone(data.avatarInfoList[0])); },
  ])('keeps incomplete progression, unknown skills and ambiguous identities blocked', mutate => {
    const { raw, build, source } = imported(mutate);
    expect(() => preparePlayerPanelWithManualTalents(raw, build, source, levels)).toThrow();
  });

  it.each([
    (build: PlayerBuild) => { build.level.value = 80; },
    (build: PlayerBuild) => { build.ascension.value = 5; },
    (build: PlayerBuild) => { build.constellation.value = 0; },
    (build: PlayerBuild) => { build.level.state = 'missing'; build.level.value = null; },
    (build: PlayerBuild) => { build.identity.state = 'unknown-id'; },
    (build: PlayerBuild) => { build.talents.skill.base.value = 9; },
    (build: PlayerBuild) => { build.panel.stats.find(stat => stat.key.value === 'atk')!.amount.value = 999999; },
  ])('rejects a mismatched or missing normalized representation', mutate => {
    const { raw, build, source } = imported(); mutate(build);
    expect(() => preparePlayerPanelWithManualTalents(raw, build, source, levels)).toThrow();
  });

  it('supports the UID provenance route, retains genuine zeros, and refuses non-Enka sources', () => {
    const { raw, build, source } = imported();
    const prepared = preparePlayerPanelWithManualTalents(raw, build, { ...source, kind: 'enka-uid', uid: '900000003' }, levels);
    expect(prepared.character.stats.elementalMastery).toBe(0); expect(prepared.source).toContain('enka-uid');
    for (const kind of ['good-file', 'hutao-text', 'authorized-fixture'] as const)
      expect(() => preparePlayerPanelWithManualTalents(raw, build, { ...source, kind }, levels)).toThrow('只有Enka');
  });
});
