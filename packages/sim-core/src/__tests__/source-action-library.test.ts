import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createVersionedContentHash } from "@genshin-dps-lab/schemas";
import {
  AMBER_NORMAL_CHAIN_CONTRACT,
  createAmberNormalChainScenario,
  deriveSourceBackedRotationMappings,
  validateSourceBackedNormalSequence
} from "../source-action-library";
import { parseRotationDsl } from "../rotation-dsl";
import { simulate } from "../simulator";
import { applyExecutionProfile, PRACTICAL_EXECUTION_PROFILE } from "../execution-profiles";
import { defineDamageModifierPlugin } from "../plugins";

const reference = JSON.parse(readFileSync(new URL("../../../../docs/cross-validation/action-library/amber-normal-contract.json", import.meta.url), "utf8")) as {
  actions: { observedExternalDamage: number; nextNormalCancelFrame: number; snapshotDelayFrames: number }[];
  externalValidation: { inputFrames: number[]; hitFrames: number[]; totalDamage: number };
};

describe("fixed-source Amber normal input chain", () => {
  it("matches separately executed gcsim N5 inputs, all projectile hits and damage", () => {
    const config = createAmberNormalChainScenario();
    const result = simulate(JSON.parse(JSON.stringify(config)), { execution: { captureHits: true } });
    expect(result.timelineExecution!.commandResults.map((command) => command.startFrame)).toEqual(reference.externalValidation.inputFrames);
    expect(result.damageEvents.map((hit) => hit.frame)).toEqual(reference.externalValidation.hitFrames);
    expect(result.damageEvents.map((hit) => hit.finalDamage)).toEqual(reference.actions.map((action) => action.observedExternalDamage));
    expect(result.totalDamage).toBe(reference.externalValidation.totalDamage);
    expect(result.damageEvents[3]!.frame).toBeGreaterThan(result.timelineExecution!.commandResults[4]!.startFrame!);
    expect(result.timelineExecution!.commandResults[4]!.animationEndFrame).toBe(180);
    expect(result.executionAudit!.hits).toHaveLength(5);
  });

  it("expands N5 to five input definitions, then wraps the next chain to N1 at +60", () => {
    const config = createAmberNormalChainScenario();
    const mapping = deriveSourceBackedRotationMappings(config)!;
    config.duration = 6;
    config.timeline!.commands = parseRotationDsl("repeat 2 { N5 }", {
      ...mapping, initialActiveCharacterId: "amber", characterIds: ["amber"], abilities: config.timeline!.abilities
    });
    config.timeline!.commands[0] = { type: "normal", actorId: "amber", abilityId: "amber-normal-1", atFrame: 1 };
    const result = simulate(config);
    expect(result.timelineExecution!.commandResults.map((command) => command.startFrame)).toEqual([1, 27, 49, 86, 120, 180, 206, 228, 265, 299]);
    expect(result.damageEvents.map((hit) => hit.frame)).toEqual([25, 47, 86, 122, 156, 204, 226, 265, 301, 335]);
    expect(config.timeline!.commands.slice(0, 5)).not.toEqual(Array(5).fill(config.timeline!.commands[0]));
    expect(result.damageEvents.slice(5).map((hit) => hit.finalDamage)).toEqual(reference.actions.map((action) => action.observedExternalDamage));
  });

  it("rejects invalid chain inputs through public simulate after JSON import", () => {
    for (const source of ["N1 N1", "N3 N2", "N1 dash 12f N1", "N1 wait 100f N1"]) {
      const config = createAmberNormalChainScenario();
      config.timeline!.commands = parseRotationDsl(source, {
        ...deriveSourceBackedRotationMappings(config)!, initialActiveCharacterId: "amber", characterIds: ["amber"], abilities: config.timeline!.abilities
      });
      expect(validateSourceBackedNormalSequence(config).status).toBe("invalid");
      expect(() => simulate(JSON.parse(JSON.stringify(config)))).toThrow("来源动作契约校验失败");
    }
    const skipped = createAmberNormalChainScenario();
    skipped.timeline!.commands.shift();
    expect(() => simulate(skipped)).toThrow("amber-normal-1");
  });

  it("uses next-normal windows, retains source offsets when human inputs are delayed", () => {
    const config = createAmberNormalChainScenario();
    const input = config.timeline!.commands[1]!;
    config.timeline!.commands[1] = { ...input, atFrame: 15 } as typeof input;
    expect(() => simulate(config)).toThrow("ACTION_OVERLAP"); // N1 early E/Q cancel is not N2 timing.
    const original = createAmberNormalChainScenario();
    const delayed = applyExecutionProfile(original, PRACTICAL_EXECUTION_PROFILE);
    expect(delayed.config.timeline!.abilities).toEqual(original.timeline!.abilities);
    expect(deriveSourceBackedRotationMappings(delayed.config)).not.toBeNull();
    const result = simulate(delayed.config);
    expect(result.timelineExecution!.commandResults.map((command) => command.startFrame)).toEqual([3, 31, 55, 94, 130]);
    expect(result.damageEvents.map((hit) => hit.frame)).toEqual([27, 51, 92, 130, 166]);
    expect(result.totalDamage).toBe(reference.externalValidation.totalDamage);
  });

  it("does not reuse the shorthand or certify edited abilities, build, or dynamic contexts", () => {
    const changedHit = createAmberNormalChainScenario();
    changedHit.timeline!.abilities[0]!.hits![0]!.scaling += 0.1;
    expect(deriveSourceBackedRotationMappings(changedHit)).toBeNull();
    expect(() => simulate(changedHit)).toThrow("来源签名");
    const buff = createAmberNormalChainScenario();
    buff.timeline!.abilities[0]!.buffs = [{ stat: "atkPct", value: 1, durationFrames: 60 }];
    expect(() => simulate(buff)).toThrow("来源签名");
    const build = createAmberNormalChainScenario();
    build.characters[0]!.stats.atkPct = 1;
    expect(() => simulate(build)).toThrow("固定 Lv1/C0/T1");
    const target = createAmberNormalChainScenario();
    target.enemy.targets = [{ id: "enemy-0", name: "Default target" }, { id: "second", name: "Additional target" }];
    expect(() => simulate(target)).toThrow("单个静止目标");
    const unknown = createAmberNormalChainScenario();
    unknown.meta.version += "-edited";
    expect(deriveSourceBackedRotationMappings(unknown)).toBeNull();
    expect(() => simulate(unknown)).toThrow("标识未知或不一致");
  });

  it("rejects plugins before execution and leaves unrelated custom scenarios unclaimed", () => {
    let called = false;
    const plugin = defineDamageModifierPlugin({ id: "test-dynamic", version: "1", kind: "code", contentHash: createVersionedContentHash("test-dynamic") }, () => ({
      modifyDamage: () => { called = true; return { scalingValue: 99 }; }
    }));
    expect(() => simulate(createAmberNormalChainScenario(), { plugins: [plugin] })).toThrow("运行时插件");
    expect(called).toBe(false);
    const custom = createAmberNormalChainScenario();
    custom.dataVersion = "manual-test";
    custom.meta.version = "manual-test";
    custom.meta.verificationStatus = "user-supplied";
    expect(validateSourceBackedNormalSequence(custom).status).toBe("not-applicable");
    expect(deriveSourceBackedRotationMappings(custom)).toBeNull();
    expect(Object.isFrozen(AMBER_NORMAL_CHAIN_CONTRACT.inputs[0])).toBe(true);
  });
});
