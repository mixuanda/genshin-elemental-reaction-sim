import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "@genshin-dps-lab/schemas";
import { compileRotationDsl, parseRotationDsl, serializeRotationDsl, type RotationDslInput } from "../rotation-dsl";
import { makeConfig } from "./fixtures";

const ability = (id: string, kind: AbilityDefinition["kind"], cooldownFrames = 0): AbilityDefinition => ({
  id, name: id, actorId: "a", kind, cancelFrame: 10, animationEndFrame: 10, cooldownFrames,
  hits: [{ frame: 5, scaling: 1 }]
});
const input: RotationDslInput = {
  initialActiveCharacterId: "a", characterIds: ["a"],
  abilities: [ability("e", "skill", 60), ability("q", "burst"), ability("n1", "normal"), ability("n2", "normal")],
  normalChains: { a: ["n1", "n2"] }, movementFrames: { dash: 12 }
};

describe("rotation DSL", () => {
  it("expands a normal combo into inputs, repeats and explicit movement", () => {
    const result = parseRotationDsl("# comment\nE repeat 2 { N2 D } wait 12f Q", input);
    expect(result).toHaveLength(9);
    expect(result.slice(1, 4)).toEqual([
      { type: "normal", actorId: "a", abilityId: "n1" },
      { type: "normal", actorId: "a", abilityId: "n2" },
      { type: "dash", actorId: "a", frames: 12 }
    ]);
  });
  it("does not invent N6, timing, or hit-to-action mappings", () => {
    expect(() => parseRotationDsl("N6", input)).toThrow("未定义合法");
    expect(() => parseRotationDsl("normal[2].hit[1]", input)).toThrow("逐段命中");
    expect(() => parseRotationDsl("J", input)).toThrow("占用帧数");
    expect(() => parseRotationDsl("E.hold", input)).toThrow("不支持");
  });
  it("requires explicit aliases for ambiguous skills", () => {
    const ambiguous = { ...input, abilities: [...input.abilities, ability("hold", "skill")] };
    expect(() => parseRotationDsl("E", ambiguous)).toThrow("没有唯一");
    expect(parseRotationDsl("E.hold", { ...ambiguous, aliases: { a: { "E.hold": "hold" } } })[0]).toMatchObject({ abilityId: "hold" });
  });
  it("bounds expansion and rejects malformed syntax", () => {
    expect(() => parseRotationDsl("repeat 1000 { repeat 1000 { E } }", input)).toThrow("最多 10000");
    expect(() => parseRotationDsl("repeat 1000 { repeat 1000 { } }", input)).toThrow("展开复杂度");
    expect(() => parseRotationDsl("repeat 2 { E", input)).toThrow("闭合");
    expect(() => parseRotationDsl("wait 0.5f", input)).toThrow("非负整数");
  });
  it("uses the actual timeline compiler for strict errors and auto wait", () => {
    const config = makeConfig({ timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 12, abilities: input.abilities, commands: [] } });
    expect(() => compileRotationDsl(config, "E E", input)).toThrow("冷却");
    config.timeline!.legalityMode = "wait";
    const result = compileRotationDsl(config, "E E", input);
    expect(result.execution.commandResults[1]?.startFrame).toBe(60);
    expect(result.execution.adjustments[0]?.waitedFrames).toBe(50);
  });
  it("round trips actual request frames, actors, movement and crystal pickup without changing execution", () => {
    const config = makeConfig({ timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 12, abilities: input.abilities, commands: [] } });
    const source = "at 12f E dash 4f at 80f pickup cryo wait 7f at 100f Q";
    const commands = parseRotationDsl(source, input);
    expect(parseRotationDsl(serializeRotationDsl(commands), input)).toEqual(commands);
    expect(compileRotationDsl(config, serializeRotationDsl(commands), input)).toEqual(compileRotationDsl(config, source, input));
    // Reordering a movement must not silently change its actor to the new active actor.
    const altered = { ...input, characterIds: ["a", "b"] };
    const reordered = parseRotationDsl("swap b dash 4f for a", altered);
    expect(parseRotationDsl(serializeRotationDsl(reordered), altered)).toEqual(reordered);
    expect(reordered[1]).toMatchObject({ actorId: "a" });
  });
  it("applies combo request time only to its first input and rejects ambiguous request syntax", () => {
    expect(parseRotationDsl("at 100f N2", input)).toEqual([
      { type: "normal", actorId: "a", abilityId: "n1", atFrame: 100 },
      { type: "normal", actorId: "a", abilityId: "n2" }
    ]);
    expect(() => parseRotationDsl("at 20f wait 2f", input)).toThrow("非 wait");
    expect(() => parseRotationDsl("pickup dendro", input)).toThrow("pickup");
  });
});
