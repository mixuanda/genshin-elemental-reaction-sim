import { describe, expect, it } from "vitest";
import { replaySourceHostPlayerIncoming } from "../source-host-incoming-capture";
import { resolveSourceHostRequest } from "../source-host-formula";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT, SOURCE_HOST_FORMULA_VERSION, SOURCE_HOST_PROTOCOL,
  sourceHostPlayerDrainRequestSchema, sourceHostPlayerIncomingRequestSchema, sourceHostPlayerShieldRequestSchema,
  sourceHostPlayerShieldMinimumRequestSchema,
  type SourceHostCalculationRecord,
} from "../source-host-wire";

const common = { protocol: SOURCE_HOST_PROTOCOL, frame: 25, actorIndex: 0, actorKey: "noelle",
  ability: "test hit", attackTag: 0, attackTagName: "AttackTagNone", element: "physical",
  sourceFrame: 25, snapshotFrame: 25, attackId: 1, targetKey: 0,
  componentIds: [], componentApplications: [], rawAttack: {}, sourceCommit: SOURCE_HOST_COMMIT };
const stateCommon = { ...common, snapshotStats: null, snapshot: null };

describe("pinned source-host shield and player Drain", () => {
  it("uses Tmpl.OnDamage's incoming-Geo branch, independent shields, and actual Drain ratio in a portable capture", () => {
    const incoming = sourceHostPlayerIncomingRequestSchema.parse({ ...common, id: 1, kind: "player-incoming",
      damageCategory: "player-incoming", snapshotStats: [], snapshot: {
        charLevel: 90, baseAtk: 100, atkPct: 0, flatAtk: 0, baseHp: 1000, hpPct: 0,
        flatHp: 0, baseDef: 1000, defPct: 0, flatDef: 0, em: 0, critRate: 0, critDamage: 0,
      }, input: {
        scalingStat: "atk", scalingValue: 100, scaling: 1, flatDamage: 0, damageBonus: 0,
        playerDefense: 0, defenseIgnore: 0, playerResistance: 0, attackerLevel: 90,
        critRate: 0, critDamage: 0, isCrit: false, critRoll: 0.8, hitWeakPoint: false,
        elementalMastery: 0, amped: false, amplifyingMultiplier: 1, reactionBonus: 0, groupMultiplier: 1,
      },
    });
    const incomingRecord: SourceHostCalculationRecord = { request: incoming, value: resolveSourceHostRequest(incoming).value };
    expect(incomingRecord.value).toBe(100);
    const records = new Map<number, SourceHostCalculationRecord>([[1, incomingRecord]]);
    const shield = (id: number, shieldElement: string, hpBefore: number, output: "hpAfter" | "damageAfter", predecessor?: number) => {
      const request = sourceHostPlayerShieldRequestSchema.parse({ ...stateCommon, id, kind: "player-shield",
        damageCategory: "player-shield", componentIds: predecessor === undefined ? [] : [predecessor],
        input: { hpBefore, incomingDamage: 100, shieldElement, incomingElement: "physical", bonus: 0,
          shieldType: predecessor ?? id, output },
      });
      const record: SourceHostCalculationRecord = { request, value: resolveSourceHostRequest(request, records).value };
      records.set(id, record);
      return record;
    };
    const minimum = (id: number, currentMinimum: number, damageAfter: number, predecessor: number) => {
      const request = sourceHostPlayerShieldMinimumRequestSchema.parse({ ...stateCommon, id,
        kind: "player-shield-min", damageCategory: "player-shield-min", componentIds: [predecessor],
        input: { currentMinimum, damageAfter } });
      const record: SourceHostCalculationRecord = { request, value: resolveSourceHostRequest(request, records).value };
      records.set(id, record);
      return record;
    };
    const geoHP = shield(2, "geo", 20, "hpAfter");
    const geoTaken = shield(3, "geo", 20, "damageAfter", 2);
    const geoMin = minimum(4, 100, geoTaken.value, 3);
    const cryoHP = shield(5, "cryo", 40, "hpAfter");
    const cryoTaken = shield(6, "cryo", 40, "damageAfter", 5);
    const cryoMin = minimum(7, geoMin.value, cryoTaken.value, 6);
    expect([geoHP.value, geoTaken.value, geoMin.value, cryoHP.value, cryoTaken.value, cryoMin.value]).toEqual([0, 80, 80, 0, 60, 60]);
    const drainRequest = sourceHostPlayerDrainRequestSchema.parse({ ...stateCommon, id: 8,
      kind: "player-drain", damageCategory: "player-drain", input: { hpBefore: 800, maxHp: 1000, amount: 60 } });
    const drain: SourceHostCalculationRecord = { request: drainRequest, value: resolveSourceHostRequest(drainRequest, records).value };
    expect(drain.value).toBe(0.74);
    const application = { id: 9, calculationId: 1, attackId: 1, frame: 25, targetKey: 0,
      activeActorIndex: 0, rawDamage: 100, damageAfterShield: 60, shieldAbsorbed: 40,
      drainAttempted: 60, isCrit: false, shieldCalculationIds: [2, 3, 4, 5, 6, 7], drainCalculationId: 8 };
    const capture = { schemaVersion: "source-host-player-incoming-v1", formulaVersion: SOURCE_HOST_FORMULA_VERSION,
      sourceCommit: SOURCE_HOST_COMMIT, sourceConfig: "test", seed: "1", application,
      calculation: incomingRecord, components: [], stateCalculations: [geoHP, geoTaken, geoMin, cryoHP, cryoTaken, cryoMin, drain] };
    const replayed = replaySourceHostPlayerIncoming(capture);
    expect(replayed.stateCalculations.at(-1)?.trace.at(-1)?.result?.value).toBe(0.74);
    expect(replayed.stateArithmeticProvenance).toBe("shared");
    expect(replayed.reproducedRawDamage).toBe(100);
    expect(() => replaySourceHostPlayerIncoming({ ...capture, application: { ...application, damageAfterShield: 80, shieldAbsorbed: 20 } })).toThrow(/damage after shields/);
    const { shieldCalculationIds: _shieldIds, drainCalculationId: _drainId, ...oldApplication } = application;
    const { stateCalculations: _state, ...oldCapture } = capture;
    const legacy = replaySourceHostPlayerIncoming({ ...oldCapture, application: oldApplication });
    expect(legacy.stateArithmeticProvenance).toBe("unavailable");
    expect(legacy.stateCalculations).toEqual([]);
  });

  it("preserves the source Geo override when the incoming damage is Geo", () => {
    const request = sourceHostPlayerShieldRequestSchema.parse({ ...stateCommon, id: 2, kind: "player-shield",
      damageCategory: "player-shield", element: "geo", input: { hpBefore: 20, incomingDamage: 100,
        shieldElement: "cryo", incomingElement: "geo", bonus: 0, shieldType: 1, output: "damageAfter" },
      componentIds: [1],
    });
    const prior = sourceHostPlayerShieldRequestSchema.parse({ ...request, id: 1, componentIds: [], input: { ...request.input, output: "hpAfter" } });
    const priorRecord = { request: prior, value: resolveSourceHostRequest(prior).value };
    const result = resolveSourceHostRequest(request, new Map([[1, priorRecord]]));
    expect(result.trace.find(node => node.id === "shieldElementFactor")?.result?.value).toBe(1.5);
    expect(result.value).toBe(70);
  });

  it("tracks the a7 source identity through the same shield formula", () => {
    const request = sourceHostPlayerShieldRequestSchema.parse({ ...stateCommon, sourceCommit: SOURCE_HOST_STELLAR_COMMIT,
      id: 1, kind: "player-shield", damageCategory: "player-shield",
      input: { hpBefore: 20, incomingDamage: 100, shieldElement: "cryo", incomingElement: "geo",
        bonus: 0, shieldType: 1, output: "hpAfter" },
    });
    const result = resolveSourceHostRequest(request);
    expect(result.value).toBe(0);
    expect(result.trace[0]?.sourceRefs[0]).toContain(SOURCE_HOST_STELLAR_COMMIT);
  });

  it("uses a7's changed resistance equality branch for incoming damage", () => {
    const incoming = sourceHostPlayerIncomingRequestSchema.parse({ ...common, sourceCommit: SOURCE_HOST_STELLAR_COMMIT,
      id: 1, kind: "player-incoming", damageCategory: "player-incoming", snapshotStats: [], snapshot: {
        charLevel: 90, baseAtk: 100, atkPct: 0, flatAtk: 0, baseHp: 1000, hpPct: 0,
        flatHp: 0, baseDef: 1000, defPct: 0, flatDef: 0, em: 0, critRate: 0, critDamage: 0,
      }, input: {
        scalingStat: "atk", scalingValue: 100, scaling: 1, flatDamage: 0, damageBonus: 0,
        playerDefense: 0, defenseIgnore: 0, playerResistance: 0.75, attackerLevel: 90,
        critRate: 0, critDamage: 0, isCrit: false, critRoll: 0.8, hitWeakPoint: false,
        elementalMastery: 0, amped: false, amplifyingMultiplier: 1, reactionBonus: 0, groupMultiplier: 1,
      },
    });
    expect(resolveSourceHostRequest(incoming).value).toBe(25);
    expect(resolveSourceHostRequest({ ...incoming, sourceCommit: SOURCE_HOST_COMMIT }).value).toBe(62.5);
  });
});
