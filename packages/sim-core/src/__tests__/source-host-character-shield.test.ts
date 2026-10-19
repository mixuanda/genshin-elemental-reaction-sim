import { describe, expect, it } from "vitest";
import { resolveSourceHostRequest } from "../source-host-formula";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_PROTOCOL, sourceHostCharacterShieldRequestSchema,
  sourceHostPlayerShieldRequestSchema, type SourceHostCalculationRecord,
} from "../source-host-wire";

// These are synthetic receipts with the same shape as the native Go getters.
// Expected values below come from the fixed source assignments and level-1
// tables, not from the descriptor expression under test.
const stats = (slots: Record<number, number>): number[] => {
  const values = Array(26).fill(0) as number[];
  for (const [slot, value] of Object.entries(slots)) values[Number(slot)] = value;
  return values;
};
const read = (id: string, frame: number, actorIndex: number, kind: "stats" | "stat" | "select-stat",
  selector: number[], result: number[]) => ({
  id, kind, frame, actorIndex, selector, nonExtra: false,
  base: result, steps: [], result,
});
const base = (id: number, frame: number, actorKey: string) => ({
  protocol: SOURCE_HOST_PROTOCOL, sourceCommit: SOURCE_HOST_COMMIT, id, frame,
  actorIndex: 0, actorKey, ability: "shield fixture", attackTag: 0, attackTagName: "AttackTagNone",
  element: "physical", sourceFrame: frame, snapshotFrame: 0, attackId: 0, targetKey: 0,
  componentIds: [] as number[], componentApplications: [], rawAttack: {},
});
const shield = (id: number, frame: number, actorKey: string, ruleId: string,
  state: Record<string, number>, extra: Record<string, unknown> = {}) =>
  sourceHostCharacterShieldRequestSchema.parse({
    ...base(id, frame, actorKey), kind: "character-shield", damageCategory: "character-shield",
    snapshot: null, snapshotStats: null, input: { ruleId, sourceHolderIndex: 0, state }, ...extra,
  });
const save = (records: Map<number, SourceHostCalculationRecord>,
  request: ReturnType<typeof shield>): SourceHostCalculationRecord => {
  const row = { request, value: resolveSourceHostRequest(request, records).value };
  records.set(request.id, row);
  return row;
};

describe("fixed-source character shield HP integration", () => {
  it("replays ATK and EM level-1 tables against each original live getter", () => {
    // Nicole: skillShieldAtk[0] * TotalAtk() + skillShieldFlat[0].
    const atk = stats({ 24: 800, 6: 0.25, 5: 100 });
    const nicole = shield(1, 10, "nicole", "char-shield-nicole-skill",
      { talentRatio: 0, totalAtk: 1100, talentFlat: 0 },
      { statReads: [read("nicole-atk", 10, 0, "select-stat", [24, 6, 5], atk)] });
    const atkResult = resolveSourceHostRequest(nicole);
    expect(atkResult.value).toBeCloseTo(2.21184 * 1100 + 1386.6697, 10);
    expect(atkResult.trace.find(node => node.id === "characterShield.1.char-shield-nicole-skill")
      ?.inputs.find(input => input.key === "totalAtk")?.origin).toEqual({
      kind: "source-host-shield-state", reference: "shieldStats.1.0.state.totalAtk",
    });

    // Citlali: shieldEM[0] * Stat(EM) + shieldFlat[0].
    const em = stats({ 8: 400 });
    const citlali = shield(2, 10, "citlali", "char-shield-citlali-skill",
      { em: 400, talentRatio: 0, talentFlat: 0 },
      { statReads: [read("citlali-em", 10, 0, "stat", [8], em)] });
    expect(resolveSourceHostRequest(citlali).value).toBeCloseTo(5.76 * 400 + 1386.6759, 10);
    expect(() => resolveSourceHostRequest(shield(2, 10, "citlali", "char-shield-citlali-skill",
      { em: 400, talentRatio: 0, talentFlat: 0 },
      { statReads: [read("citlali-em", 10, 1, "stat", [8], em)] }))).toThrow(/getter身份/);
  });

  it("binds Noelle's DEF snapshot and Xinyan C2's earlier real DEF getter", () => {
    // Noelle Skill: shieldFlat + shieldDef * snap.Stats.TotalDEF().
    const def = stats({ 25: 500, 1: 0.2, 2: 100 });
    const snapshotRead = read("noelle-snapshot", 10, 0, "stats", [], def);
    const snapshot = { charLevel: 90, baseAtk: 0, atkPct: 0, flatAtk: 0,
      baseHp: 0, hpPct: 0, flatHp: 0, baseDef: 500, defPct: 0.2, flatDef: 100,
      em: 0, critRate: 0, critDamage: 0,
      statProvenance: { version: "stat-provenance-v1", snapshotRead, attackReads: [], finalStats: def } };
    const noelle = shield(1, 10, "noelle", "char-shield-noelle-skill",
      { flat: 769.7851, ratio: 1.6, totalDef: 700 },
      { snapshotFrame: 10, snapshotStats: def, snapshot });
    expect(resolveSourceHostRequest(noelle).value).toBeCloseTo(769.7851 + 1.6 * 700, 10);
    expect(() => resolveSourceHostRequest(shield(1, 10, "noelle", "char-shield-noelle-skill",
      { flat: 769.7851, ratio: 1.6, totalDef: 701 },
      { snapshotFrame: 10, snapshotStats: def, snapshot }))).toThrow(/totalDef/);

    // Xinyan Burst C2 reads TotalDef(false) at cast, then level-3 HP is written
    // by the delayed task using that saved value and the level-1 source tables.
    const records = new Map<number, SourceHostCalculationRecord>();
    const cast = shield(2, 10, "xinyan", "char-shield-xinyan-burst-def", { defFactor: 700 },
      { statReads: [read("xinyan-c2-def", 10, 0, "select-stat", [25, 1, 2], def)] });
    save(records, cast);
    const delayed = shield(3, 53, "xinyan", "char-shield-xinyan-burst-level-3",
      { flat: 692.8066, ratio: 1.44, defFactor: 700 },
      { componentIds: [2], valueSources: { defFactor: 2 } });
    const result = resolveSourceHostRequest(delayed, records);
    expect(result.value).toBeCloseTo(692.8066 + 1.44 * 700, 10);
    expect(result.trace.find(node => node.id === "characterShield.3.char-shield-xinyan-burst-level-3")
      ?.inputs.find(input => input.key === "defFactor")?.origin).toEqual({
      kind: "source-host-shield-state", reference: "shieldSource.2.characterShield.2.char-shield-xinyan-burst-def",
    });
  });

  it("uses the consumed current HP for Thoma's stack and rejects a different owner or old value", () => {
    const records = new Map<number, SourceHostCalculationRecord>();
    const hp = stats({ 23: 10000 });
    const hpRead = (id: string, frame: number) => [read(id, frame, 0, "select-stat", [23, 4, 3], hp)];
    const created = shield(1, 10, "thoma", "char-shield-thoma-skill-base",
      { ratio: 0.072, maxHp: 10000, flat: 693.33484 }, { statReads: hpRead("thoma-skill", 10) });
    const initial = save(records, created);
    expect(initial.value).toBeCloseTo(1413.33484, 10);
    const damaged = sourceHostPlayerShieldRequestSchema.parse({ ...base(2, 20, "thoma"),
      kind: "player-shield", damageCategory: "player-shield", componentIds: [1], hpBeforeCalculationId: 1,
      snapshot: null, snapshotStats: null,
      input: { hpBefore: initial.value, incomingDamage: 1000, shieldElement: "pyro",
        incomingElement: "physical", bonus: 0, shieldType: 1, output: "hpAfter" },
    });
    const afterDamage = { request: damaged, value: resolveSourceHostRequest(damaged, records).value };
    records.set(2, afterDamage);
    expect(afterDamage.value).toBeCloseTo(413.33484, 10);
    const burst = save(records, shield(3, 30, "thoma", "char-shield-thoma-burst-base",
      { ratio: 0.01144, maxHp: 10000, flat: 110.03398 }, { statReads: hpRead("thoma-burst", 30) }));
    save(records, shield(4, 30, "thoma", "char-shield-thoma-max",
      { ratio: 0.196, maxHp: 10000, flat: 1887.4199 }, { statReads: hpRead("thoma-max", 30) }));
    const stacked = shield(5, 30, "thoma", "char-shield-thoma-stack",
      { amount: burst.value, oldHP: afterDamage.value, maximum: 3847.4199 },
      { componentIds: [3, 4, 2], valueSources: { amount: 3, oldHP: 2, maximum: 4 } });
    expect(resolveSourceHostRequest(stacked, records).value).toBeCloseTo(413.33484 + 224.43398, 10);
    const wrongOwner = new Map(records);
    wrongOwner.set(2, { ...afterDamage, request: { ...damaged, actorIndex: 1 } });
    expect(() => resolveSourceHostRequest(stacked, wrongOwner)).toThrow(/身份|来源/);
    expect(() => resolveSourceHostRequest(shield(5, 30, "thoma", "char-shield-thoma-stack",
      { amount: burst.value, oldHP: initial.value, maximum: 3847.4199 },
      { componentIds: [3, 4, 2], valueSources: { amount: 3, oldHP: 2, maximum: 4 } }), records)).toThrow(/不一致/);
  });
});
