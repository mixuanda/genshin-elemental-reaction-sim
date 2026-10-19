import { describe, expect, it } from "vitest";
import { migrateConfig, simulationResultSchema, type StaminaCost } from "@genshin-dps-lab/schemas";
import { simulate } from "../simulator";
import { StaminaRuntime, staminaTraceBefore } from "../stamina";
import { makeConfig } from "./fixtures";

const cost = (amount: number, consumeFrame = 0): StaminaCost => ({ amount, consumeFrame,
  source: { kind: "custom", note: "测试中显式声明的合成行动费用" } });
const model = (initialStamina: number) => ({ mode: "shared-stamina-v1" as const,
  profileId: "gcsim-b4ae769-stamina-v1" as const, initialStamina });
function fixture(legalityMode: "strict" | "wait", initialStamina = 0) {
  return makeConfig({ duration: 3, cycleLength: 3, rotation: [], staminaModel: model(initialStamina),
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode, initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "ca", actorId: "a", name: "显式十体力合成重击", kind: "charge", cancelFrame: 1,
        animationEndFrame: 1, cooldownFrames: 0, staminaCost: cost(10),
        hits: [{ id: "ca-hit", frame: 0, scaling: 1, element: "pyro" }] },
        { id: "free", actorId: "a", name: "显式无消耗动作", kind: "skill", cancelFrame: 1,
          animationEndFrame: 1, cooldownFrames: 0, staminaCost: cost(0),
          hits: [{ id: "free-hit", frame: 0, scaling: 1, element: "pyro" }] }],
      commands: [{ type: "charge", actorId: "a", abilityId: "ca" }, { type: "skill", actorId: "a", abilityId: "free" }] } });
}

describe("explicit shared stamina runtime", () => {
  it("rejects only the strict resource command and waits through the exact recovery boundary in wait mode", () => {
    const strict = simulate(fixture("strict"));
    expect(strict.timelineExecution!.commandResults.map(row => [row.status, row.startFrame, row.failureCode])).toEqual([
      ["rejected", null, "INSUFFICIENT_STAMINA"], ["executed", 0, undefined],
    ]);
    expect(strict.skippedActions).toEqual([]);
    expect(strict.damageEvents).toHaveLength(1);
    expect(strict.stamina!.logs).toMatchObject([{ operation: "recover", startFrame: 91, frame: 180, after: 37.5 }]);
    const before120 = staminaTraceBefore(strict.stamina!, 120);
    expect(before120.finalStamina).toBe(29 * 25 / 60);
    expect(before120.logs).toMatchObject([{ startFrame: 91, frame: 119, before: 0, after: 29 * 25 / 60 }]);
    expect(before120.logs[0]!.substitution).toContain("29 × 25 / 60");
    expect(strict.stamina!.logs[0]!.frame).toBe(180);
    const waited = simulate(fixture("wait"), { execution: { checkpointFrames: [0, 120] } });
    expect(waited.timelineExecution!.commandResults.map(row => row.startFrame)).toEqual([114, 115]);
    expect(waited.stamina!.logs).toMatchObject([
      { operation: "recover", startFrame: 91, frame: 114, before: 0, after: 10 },
      { operation: "spend", frame: 114, before: 10, amount: 10, after: 0 },
    ]);
    expect(waited.damageEvents.map(row => row.frame)).toEqual([114, 115]);
    expect(waited.stamina!.finalStamina).toBe(0);
    expect(waited.executionAudit!.checkpointCoverage.complete).toBe(false);
    expect(waited.executionAudit!.checkpointCoverage.reasons.join(" ")).toContain("不足一个完整输入周期");
    expect(simulationResultSchema.safeParse(JSON.parse(JSON.stringify(strict))).success).toBe(true);
    expect(simulationResultSchema.safeParse(JSON.parse(JSON.stringify(waited))).success).toBe(true);
    const expired = fixture("wait");
    expired.timeline!.abilities.push({ ...expired.timeline!.abilities[1]!, id: "gate", hits: [],
      timelineState: { grants: [{ key: "stance", label: "合成限时行动状态", durationFrames: 100 }] } });
    expired.timeline!.abilities[0]!.timelineState = { requires: ["stance"] };
    expired.timeline!.commands.unshift({ type: "skill", actorId: "a", abilityId: "gate" });
    const expiredResult = simulate(expired);
    expect(expiredResult.timelineExecution!.commandResults.map(row => [row.startFrame, row.failureCode])).toEqual([
      [0, undefined], [null, "MISSING_REQUIRED_STATE"], [114, undefined],
    ]);
    expect(expiredResult.stamina!.finalStamina).toBe(37.5);

  });

  it("uses one shared pool, defers debit without reservation, clamps it and recovers before later inputs", () => {
    const config = fixture("strict", 18);
    config.duration = config.cycleLength = 111 / 60;
    config.characters.push({ ...structuredClone(config.characters[0]!), id: "b", name: "第二名角色" });
    config.timeline!.abilities[0]!.actorId = "b";
    config.timeline!.abilities[0]!.staminaCost = cost(18);
    config.timeline!.abilities[1]!.actorId = "b";
    config.timeline!.commands = [
      { type: "dash", actorId: "a", frames: 1, staminaCost: cost(18, 20) },
      { type: "swap", characterId: "b" },
      { type: "charge", actorId: "b", abilityId: "ca" },
      { type: "skill", actorId: "b", abilityId: "free", atFrame: 50 },
    ];
    const result = simulate(config);
    expect(result.stamina!.logs).toMatchObject([
      { operation: "spend", actorId: "b", frame: 2, before: 18, amount: 18, after: 0 },
      { operation: "spend", actorId: "a", frame: 20, before: 0, amount: 0, after: 0 },
      { operation: "recover", startFrame: 111, frame: 111, amount: 25 / 60, after: 25 / 60 },
    ]);
    expect(result.stamina!.finalStamina).toBe(25 / 60);
    expect(simulationResultSchema.safeParse(JSON.parse(JSON.stringify(result))).success).toBe(true);
    const reset = new StaminaRuntime(model(0));
    reset.accept({ ...cost(0), consumeWhenZero: true }, 50, "a", 0);
    expect(reset.finish(140).finalStamina).toBe(0);
    expect(reset.finish(141).finalStamina).toBe(25 / 60);
  });

  it("preserves absent-model behavior and validates explicit costs, exported numbers and older wire boundaries", () => {
    const config = fixture("wait");
    const result = simulate(config);
    const exported = JSON.parse(JSON.stringify(result));
    exported.stamina.finalStamina = 1;
    expect(simulationResultSchema.safeParse(exported).success).toBe(false);
    const undeclared = structuredClone(config);
    delete undeclared.timeline!.abilities[0]!.staminaCost;
    expect(() => migrateConfig(undeclared)).toThrow(/staminaCost/);
    const absent = structuredClone(config);
    delete absent.staminaModel;
    for (const ability of absent.timeline!.abilities) delete ability.staminaCost;
    const baseline = simulate(absent);
    expect(baseline.stamina).toBeUndefined();
    expect(baseline.damageEvents.map(row => row.frame)).toEqual([0, 1]);
    expect(baseline.totalDamage).toBe(result.totalDamage);
    expect(simulationResultSchema.safeParse(JSON.parse(JSON.stringify(baseline))).success).toBe(true);
    const historical = { ...absent, schemaVersion: "1.52.0", staminaModel: model(0) };
    expect(() => migrateConfig(historical)).toThrow(/staminaModel/);
  });
});
