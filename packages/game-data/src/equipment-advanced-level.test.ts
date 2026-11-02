import { describe, expect, it } from 'vitest';
import { equipmentLevelRange, resolveEquipmentBuild, type EquipmentBuildInput } from './equipment-build';
import { gameDataCatalog } from './catalog';
import { releasedRuntimeWorkspace } from './runtime-workspace';
import { calculateDocument, parseCalculatorDocument, serializeCalculatorDocument } from '../../sim-core/src/calculator';
import { loadWorkedExample } from '../../sim-core/src/worked-examples';

const input = {
  characterId: 'character:10000075', weaponId: 'weapon:14512', level: 90, ascension: 6,
  weaponLevel: 90, weaponAscension: 6, refinement: 5, effectsDisabled: true
} satisfies EquipmentBuildInput;

// Fixed-source native Classic/Stellar executions at 90/90, 95/95 and 100/100
// agree with the retained genshin-db 49a6544 curve + ordinary promotion 6.
const native = [
  { level: 95 as const, hp: 10524.918442, atk: 364.5354636, def: 628.7111115, hpCurve: 9.195, atkCurve: 10.184 },
  { level: 100 as const, hp: 10886.5222512, atk: 401.3965466, def: 650.3115364, hpCurve: 9.652, atkCurve: 11.629 }
];

describe('explicit Masterless Stella Fortuna level limits', () => {
  it.each(native)('uses fixed level $level curves and unchanged ordinary promotion 6', expected => {
    const result = resolveEquipmentBuild({ ...input, level: expected.level, characterLevelCap: expected.level });
    expect(result.characterLevel).toBe(expected.level);
    expect(result.build.characterBaseAtk).toBeCloseTo(expected.atk, 8);
    expect(result.build.baseHp).toBeCloseTo(expected.hp, 8);
    expect(result.build.baseDef).toBeCloseTo(expected.def, 8);
    expect(result.build.weaponBaseAtk).toBeCloseTo(674.334546, 8);
    expect(result.build.critRate).toBe(0.05 + 0.192);
    expect(result.build.equipment.characterLevelCap).toBe(expected.level);
    expect(result.build.equipment.derivedStats.find(row => row.id === 'characterBaseAtk')).toMatchObject({ curve: expected.atkCurve, promotion: 104.747734 });
    expect(result.build.equipment.derivedStats.find(row => row.id === 'baseHp')).toMatchObject({ curve: expected.hpCurve, promotion: 3249.3232 });
    expect(result.verification).toBe('provisional');
  });

  it('keeps the old default cap and level-90 result unchanged', () => {
    const result = resolveEquipmentBuild(input);
    expect(result.build.characterBaseAtk).toBeCloseTo(327.6743806, 8);
    expect(result.build.baseHp).toBeCloseTo(10164.1058884, 8);
    expect(result.build.baseDef).toBeCloseTo(607.1579523, 8);
    expect(result.build.equipment).not.toHaveProperty('characterLevelCap');
    expect(() => resolveEquipmentBuild({ ...input, level: 100 })).toThrow('90');
    expect(() => resolveEquipmentBuild({ ...input, level: 100, characterLevelCap: 95 })).toThrow('95');
  });

  it.each([
    { level: 95 as const, hp: 9900.5042121, atk: 221.521923, def: 649.610367 },
    { level: 100 as const, hp: 10231.8855414, atk: 246.5929158, def: 671.353578 }
  ])('uses the distinct four-star character curves at level $level', expected => {
    const result = resolveEquipmentBuild({ ...input, characterId: 'character:10000076', weaponId: 'weapon:15401', level: expected.level, characterLevelCap: expected.level });
    expect(result.build.characterBaseAtk).toBeCloseTo(expected.atk, 8);
    expect(result.build.baseHp).toBeCloseTo(expected.hp, 8);
    expect(result.build.baseDef).toBeCloseTo(expected.def, 8);
    expect(result.build.atkPercent).toBe(0.24);
    expect(result.verification).toBe('provisional');
  });

  it('exposes declared character limits without increasing weapon limits', () => {
    const character = gameDataCatalog.characters.find(row => row.id === input.characterId)!;
    const weapon = gameDataCatalog.weapons.find(row => row.id === input.weaponId)!;
    expect(equipmentLevelRange(character, 6)).toEqual({ min: 80, max: 90 });
    expect(equipmentLevelRange(character, 6, 95)).toEqual({ min: 90, max: 95 });
    expect(equipmentLevelRange(character, 6, 100)).toEqual({ min: 90, max: 100 });
    expect(equipmentLevelRange(weapon, 6)).toEqual({ min: 80, max: 90 });
    expect(() => equipmentLevelRange(weapon, 6, 100)).toThrow();
    expect(() => resolveEquipmentBuild({ ...input, level: 100, characterLevelCap: 100, weaponLevel: 100 })).toThrow('等级范围');
  });

  it('rejects unsupported unlock limits and ordinary ascension below 6', () => {
    expect(() => resolveEquipmentBuild({ ...input, level: 95, characterLevelCap: 94 as 95 })).toThrow();
    expect(() => resolveEquipmentBuild({ ...input, level: 95, ascension: 5, characterLevelCap: 95 })).toThrow();
    expect(() => resolveEquipmentBuild({ ...input, level: 101, characterLevelCap: 100 })).toThrow();
    expect(() => resolveEquipmentBuild({ ...input, level: 89, characterLevelCap: 100 })).toThrow();
  });

  it('still blocks missing exact level curves and base attributes with an explicit cap', () => {
    const missingCurve = structuredClone(releasedRuntimeWorkspace);
    delete (missingCurve.supplemental.statCurves.characters as Record<string, unknown>)['100'];
    expect(() => resolveEquipmentBuild({ ...input, level: 100, characterLevelCap: 100 }, missingCurve)).toThrow('曲线数据');
    const missingBase = structuredClone(releasedRuntimeWorkspace);
    delete missingBase.catalog.characters.find(row => row.id === input.characterId)!.stats.base.defense;
    expect(() => resolveEquipmentBuild({ ...input, level: 100, characterLevelCap: 100 }, missingBase)).toThrow('精确基础');
  });

  it('round-trips the explicit cap and uses level 100 in single-skill calculations', () => {
    const resolution = resolveEquipmentBuild({ ...input, level: 100, characterLevelCap: 100 });
    const document = loadWorkedExample('fixture-a');
    document.characterLevel = resolution.characterLevel;
    document.build = resolution.build;
    const restored = parseCalculatorDocument(serializeCalculatorDocument(document));
    expect(restored.characterLevel).toBe(100);
    expect(restored.build.mode).toBe('equipment-derived');
    if (restored.build.mode !== 'equipment-derived') throw new Error('equipment route');
    expect(restored.build.equipment?.characterLevelCap).toBe(100);
    const damage100 = calculateDocument(restored);
    const damage90 = calculateDocument({ ...restored, characterLevel: 90 });
    expect(damage100.totals?.expected).toBeGreaterThan(damage90.totals!.expected);
    expect(damage100.trace.find(row => row.id === 'build.equipment.characterBaseAtk')?.result?.value).toBe(resolution.build.characterBaseAtk);
    restored.build.equipment!.characterLevelCap = 95;
    expect(() => parseCalculatorDocument(serializeCalculatorDocument(restored))).toThrow('declared unlocked limit');
  });
});
