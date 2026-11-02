import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SOURCE_HOST_COMMIT, SOURCE_HOST_FORMULA_VERSION, SOURCE_HOST_PROTOCOL, SOURCE_HOST_RESULT_VERSION,
  SOURCE_HOST_STELLAR_COMMIT, sourceHostDamageRequestSchema, sourceHostResultSchema,
  type SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";
import { compileSourceSingleSkill, type SourceSingleSkillDraft } from "./source-single-skill";
import { openSourceSingleSkillResultArchive } from "./source-single-skill-result-archive";
import type { SourceTeamInventory } from "./source-team-builder";

// Opening an archive must not even import the client that can start a Worker.
vi.mock("./source-host-worker-client", () => { throw new Error("Archive import loaded the Worker client"); });

const worker = vi.fn(() => { throw new Error("Archive import started a Worker"); });
const fetch = vi.fn(() => { throw new Error("Archive import requested a runtime"); });
beforeEach(() => { worker.mockClear(); fetch.mockClear(); vi.stubGlobal("Worker", worker); vi.stubGlobal("fetch", fetch); });
afterEach(() => { vi.unstubAllGlobals(); });

const inventory: SourceTeamInventory = {
  repository: "https://github.com/genshinsim/gcsim", hostVariant: "classic", revision: SOURCE_HOST_COMMIT,
  characters: [{ kind: "character", key: "neuvillette", name: "那维莱特", sourceGameId: 10000087,
    packagePath: "internal/characters/neuvillette", weaponClass: "catalyst", actionCapabilities: {
      schemaVersion: 1, actions: [{ kind: "burst", status: "implemented", method: "Burst", parameters: [] }],
      normalChain: { length: 3 },
    } }],
  weapons: [{ kind: "weapon", key: "pocketgrimoire", name: "口袋魔导书", weaponClass: "catalyst",
    packagePath: "internal/weapons/pocketgrimoire", maximumLevel: 90 }],
  artifacts: [],
};

type SavedResult = SourceHostResult & {
  result: { duration: number; retainedNativeField: string };
  logs: unknown[];
  observationWindow: NonNullable<SourceHostResult["observationWindow"]>;
  targetScene: NonNullable<SourceHostResult["targetScene"]>;
  retainedUnknownReceipt: { ordered: number[]; comment: string };
};

// Synthetic protocol records only: these are not captured native observations,
// and successful local validation must not grant a new native-verification claim.
function fixture(startup: SourceSingleSkillDraft["startup"] = "zero") {
  const input: SourceSingleSkillDraft & { retainedInputNote: string } = {
    schemaVersion: 1, source: { hostVariant: "classic", revision: SOURCE_HOST_COMMIT },
    member: { id: "neuv", characterKey: "neuvillette", level: 90, levelCap: 90, constellation: 0,
      talents: { auto: 1, skill: 1, burst: 1 },
      weapon: { key: "pocketgrimoire", level: 1, levelCap: 20, refinement: 1 },
      artifactSets: [], artifactStats: { "hp%": 0.466 }, initialEnergy: startup === "custom" ? 17 : 0 },
    action: { kind: "burst" }, durationSeconds: 2.2,
    target: { level: 90, resistance: 0.1, hp: 100_000, geometry: { x: 0, y: 2.4, radius: 2 } },
    startup, seed: "12021", retainedInputNote: "原输入注释：不填补能量或动作。",
  };
  const request = compileSourceSingleSkill(input, inventory);
  const result = sourceHostResultSchema.parse({
    protocol: SOURCE_HOST_PROTOCOL, sourceCommit: SOURCE_HOST_COMMIT, config: request.config, seed: input.seed,
    schemaVersion: SOURCE_HOST_RESULT_VERSION, formulaVersion: SOURCE_HOST_FORMULA_VERSION,
    verification: "provisional", explanationStatus: "partial", explanationGaps: ["历史缺口原文；不得改写为本次原生验证。"],
    calculations: [], applications: [], logs: [], result: { duration: 132, retainedNativeField: "原始输出" },
    capabilities: { checkpoint: false, retainedCapability: "unknown capability" },
    observationWindow: { policy: "duration-or-native", configuredEndFrame: 132, actualEndFrame: 132, endReason: "duration" },
    targetScene: { damageMode: true, primaryTargetIndex: 0, initialDefaultTargetKey: 1, targets: [{
      declarationIndex: 0, targetKey: 1, profile: { level: 90, hp: 100_000,
        resist: { electro: 0.1, pyro: 0.1, cryo: 0.1, hydro: 0.1, anemo: 0.1, dendro: 0.1, geo: 0.1, physical: 0.1 } },
      position: { x: 0, y: 2.4, radius: 2 }, initialHP: 100_000, initialMaxHP: 100_000,
    }] },
    retainedUnknownReceipt: { ordered: [3, 1, 2], comment: "不得排序、删除或重新生成的历史说明。" },
  }) as SavedResult;
  return { schemaVersion: "source-single-skill-result-v1" as const, input, result, retainedWrapperNote: "原包装说明" };
}
type Fixture = ReturnType<typeof fixture>;
const open = (value: Fixture) => openSourceSingleSkillResultArchive(JSON.stringify(value), inventory);

function acceptedLogs(characterKey = "neuvillette", sequence = 1) {
  return [
    { event: "action", frame: 0, msg: "source-host action queued", logs: { sequence, characterKey, action: "burst" } },
    { event: "action", frame: 0, msg: "source-host action accepted", logs: { sequence, characterKey, action: "burst" } },
  ];
}

function withSyntheticHit() {
  const value = fixture();
  const stats = Array<number>(26).fill(0); stats[24] = 100;
  const request = sourceHostDamageRequestSchema.parse({
    protocol: SOURCE_HOST_PROTOCOL, sourceCommit: SOURCE_HOST_COMMIT, id: 1, kind: "damage",
    frame: 10, actorIndex: 0, actorKey: "neuvillette", ability: "synthetic archive consumer only",
    attackTag: 6, attackTagName: "AttackTagElementalBurst", element: "hydro", sourceFrame: 0, snapshotFrame: 10,
    attackId: 1, targetKey: 1, componentIds: [], componentApplications: [], damageCategory: "ordinary", rawAttack: {},
    snapshotStats: stats, snapshot: { charLevel: 90, baseAtk: 100, atkPct: 0, flatAtk: 0,
      baseHp: 1000, hpPct: 0, flatHp: 0, baseDef: 100, defPct: 0, flatDef: 0, em: 0, critRate: 0, critDamage: 0 },
    input: { scalingStat: "atk", scalingValue: 100, scaling: 1, baseDamageBonus: 0, flatDamage: 0, damageBonus: 0,
      characterLevel: 90, enemyLevel: 90, defenseAdjustment: 0, defenseIgnore: 0, effectiveResistance: 0.1,
      critRate: 0, critDamage: 0, isCrit: false, critRoll: 0.5, hitWeakPoint: false, elementalMastery: 0,
      amped: false, amplifyingMultiplier: 1, amplifyingReaction: "none", reactionBonus: 0, groupMultiplier: 1, elevation: 0 },
  });
  value.result.calculations = [{ request, value: 45 }];
  value.result.applications = [{ id: 1, calculationId: 1, attackId: 1, frame: 10, targetKey: 1,
    damageMode: true, rawDamage: 45, appliedDamage: 45, hpBefore: 100_000, hpAfter: 99_955, isCrit: false }];
  value.result.logs = acceptedLogs();
  return value;
}

describe("saved single-action result reopening without native execution", () => {
  it("preserves exact text, script comments, unknown fields and historical explanation gaps for a zero-action result", () => {
    const value = fixture(), before = structuredClone(value), inventoryBefore = structuredClone(inventory);
    const originalText = ` \n${JSON.stringify(value, null, 4)}\n\t`;
    const reopened = openSourceSingleSkillResultArchive(originalText, inventory);
    expect(reopened.originalText).toBe(originalText);
    expect(reopened.input).toEqual(before.input);
    expect(reopened.result).toEqual(before.result);
    expect(reopened.result.config).toContain("# Startup: zero; no energy bypass or per-cycle refill.");
    expect(reopened.result.explanationGaps).toEqual(before.result.explanationGaps);
    expect(reopened.result.verification).toBe("provisional");
    expect(reopened.result.explanationStatus).toBe("partial");
    expect(reopened.request).toEqual(compileSourceSingleSkill(before.input, inventory));
    expect(reopened.result.applications).toEqual([]);
    expect(reopened.result.logs).toEqual([]);
    expect(value).toEqual(before);
    expect(inventory).toEqual(inventoryBefore);
    expect(worker).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retains custom startup encoded in the script without inventing a top-level energy override", () => {
    const reopened = open(fixture("custom"));
    expect(reopened.input.member.initialEnergy).toBe(17);
    expect(reopened.request.config).toContain("start_energy=17");
    expect(reopened.request.initialEnergy).toBeUndefined();
    expect(reopened.result.initialEnergy).toBeUndefined();
    expect(reopened.result.startupState).toBeUndefined();
  });

  it("keeps an early native stop rather than relabeling it a complete configured window", () => {
    const value = fixture();
    value.result.result.duration = 100;
    value.result.observationWindow.actualEndFrame = 100;
    value.result.observationWindow.endReason = "actions-exhausted";
    const reopened = open(value);
    expect(reopened.result.observationWindow).toEqual(value.result.observationWindow);
    expect(reopened.input.durationSeconds).toBe(2.2);
  });

  const mismatches: Array<[string, (value: Fixture) => void]> = [
    ["saved config", value => { value.result.config += "\n# changed script"; }],
    ["saved seed", value => { value.result.seed = "12022"; }],
    ["input seed", value => { value.input.seed = "12022"; }],
    ["source commit", value => { value.result.sourceCommit = SOURCE_HOST_STELLAR_COMMIT; }],
    ["input revision", value => { value.input.source.revision = SOURCE_HOST_STELLAR_COMMIT; }],
    ["input startup", value => { value.input.startup = "full"; }],
    ["unexpected top-level energy override", value => { value.result.initialEnergy = { mode: "full" }; }],
    ["execution mode", value => { value.result.executionMode = "strict"; }],
    ["configured frame", value => { value.result.observationWindow.configuredEndFrame++; }],
    ["actual native duration", value => { value.result.result.duration--; }],
    ["window policy", value => { value.result.observationWindow.policy = "native"; }],
    ["duration stop before deadline", value => { value.result.result.duration--; value.result.observationWindow.actualEndFrame--; }],
    ["primary target", value => { value.result.targetScene.primaryTargetIndex = 1; }],
    ["target geometry", value => { value.result.targetScene.targets[0]!.position.x = 1; }],
    ["target level", value => { value.result.targetScene.targets[0]!.profile.level = 91; }],
    ["accepted actor", value => { value.result.logs = acceptedLogs("furina"); }],
    ["multiple accepted actions", value => { value.result.logs = [...acceptedLogs(), ...acceptedLogs("neuvillette", 2)]; }],
  ];
  it.each(mismatches)("rejects inconsistent %s", (_name, mutate) => {
    const value = fixture(); mutate(value);
    expect(() => open(value)).toThrow();
  });

  it("rejects unknown formats, numeric overflow, malformed metadata and duplicate target declarations", () => {
    const value = fixture(), text = JSON.stringify(value);
    expect(() => openSourceSingleSkillResultArchive("{broken", inventory)).toThrow();
    expect(() => openSourceSingleSkillResultArchive(JSON.stringify(value.result), inventory)).toThrow();
    expect(() => openSourceSingleSkillResultArchive(text.replace("source-single-skill-result-v1", "unsupported-v2"), inventory)).toThrow();
    expect(() => openSourceSingleSkillResultArchive(text.replace('"durationSeconds":2.2', '"durationSeconds":1e309'), inventory)).toThrow();
    expect(() => openSourceSingleSkillResultArchive(text.replace('"actualEndFrame":132', '"actualEndFrame":-1'), inventory)).toThrow();
    expect(() => openSourceSingleSkillResultArchive(text.replace(SOURCE_HOST_FORMULA_VERSION, "unknown-formula"), inventory)).toThrow();
    value.input.seed = "18446744073709551616";
    expect(() => open(value)).toThrow();
    const duplicate = fixture();
    duplicate.input.additionalTargets = [structuredClone(duplicate.input.target)];
    duplicate.result.config = compileSourceSingleSkill(duplicate.input, inventory).config;
    duplicate.result.targetScene.targets.push(structuredClone(duplicate.result.targetScene.targets[0]!));
    expect(() => open(duplicate)).toThrow(/重复/);
  });

  it("accepts a self-consistent synthetic formula record without claiming authentic native history", () => {
    const value = withSyntheticHit();
    const reopened = open(value);
    expect(reopened.result).toEqual(value.result);
    expect(reopened.result.verification).toBe("provisional");
    expect(reopened.result.explanationGaps).toEqual(value.result.explanationGaps);
    expect(worker).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects duplicate application IDs on an otherwise valid formula record", () => {
    const value = withSyntheticHit();
    value.result.applications.push(structuredClone(value.result.applications[0]!));
    expect(() => open(value)).toThrow(/重复/);
  });

  it.each(["attackId", "targetKey", "isCrit"] as const)("rejects a changed application %s even when numeric damage is unchanged", field => {
    const value = withSyntheticHit(), application = value.result.applications[0]!;
    if (field === "isCrit") application.isCrit = true;
    else application[field] = 2;
    expect(() => open(value)).toThrow();
  });
});
