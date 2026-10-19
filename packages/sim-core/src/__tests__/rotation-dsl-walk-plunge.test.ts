import { describe, expect, it } from "vitest";
import { simConfigSchema, simulationResultSchema, type AbilityDefinition, type LegalTimelineCommand, type StaminaCost } from "@genshin-dps-lab/schemas";
import { simulate } from "../simulator";
import {
  compileRotationDsl,
  parseRotationDsl,
  RotationDslError,
  serializeRotationDsl,
  type RotationDslInput
} from "../rotation-dsl";
import { makeConfig } from "./fixtures";

const declaredAbility = (
  id: string,
  kind: AbilityDefinition["kind"],
  actorId = "a"
): AbilityDefinition => ({
  id, name: id, actorId, kind,
  cancelFrame: 10, animationEndFrame: 10, cooldownFrames: 0,
  hits: [{ frame: 5, scaling: 1 }]
});

describe("walk and declared plunge rotation DSL", () => {
  it("preserves explicit inputs and movement while requiring a real airborne grant for a plunge", () => {
    const normals = Array.from({ length: 6 }, (_, index) => declaredAbility(`n${index + 1}`, "normal"));
    normals[1]!.hits = [{ frame: 3, scaling: 0.5 }, { frame: 5, scaling: 0.5 }];
    const lift: AbilityDefinition = {
      ...declaredAbility("lift", "skill"),
      cancelFrame: 5,
      cancelFrames: { walk: 1, plunge: 2 },
      hits: [],
      timelineState: {
        grants: [{ key: "airborne", label: "显式合成腾空状态", durationFrames: 60 }]
      }
    };
    const plunge: AbilityDefinition = {
      ...declaredAbility("a-plunge", "plunge"),
      timelineState: { requires: ["airborne"], consumes: ["airborne"] }
    };
    const input: RotationDslInput = {
      initialActiveCharacterId: "a", characterIds: ["a", "b"],
      abilities: [...normals, lift, plunge, { ...plunge, id: "b-plunge", actorId: "b" }],
      normalChains: { a: normals.map(ability => ability.id) },
      movementFrames: { walk: 6, dash: 12, jump: 4 }
    };

    // N5 means five input actions, even when an input contains multiple hits.
    expect(parseRotationDsl("at 100f N5", input)).toEqual([
      { type: "normal", actorId: "a", abilityId: "n1", atFrame: 100 },
      { type: "normal", actorId: "a", abilityId: "n2" },
      { type: "normal", actorId: "a", abilityId: "n3" },
      { type: "normal", actorId: "a", abilityId: "n4" },
      { type: "normal", actorId: "a", abilityId: "n5" }
    ]);
    const movementBlock = [
      { type: "walk", actorId: "a", frames: 3 },
      { type: "walk", actorId: "a", frames: 6 },
      { type: "dash", actorId: "a", frames: 12 },
      { type: "jump", actorId: "a", frames: 4 }
    ];
    const expanded = parseRotationDsl(`
      repeat 2 { walk 3f for a W D J }
      wait 5f swap b at 120f plunge b-plunge for b pickup cryo
      dash 5f for b jump 4f for a
    `, input);
    expect(expanded).toEqual([
      ...movementBlock, ...movementBlock,
      { type: "wait", frames: 5 },
      { type: "swap", characterId: "b" },
      { type: "plunge", actorId: "b", abilityId: "b-plunge", atFrame: 120 },
      { type: "pickUpCrystallize", element: "cryo" },
      { type: "dash", actorId: "b", frames: 5 },
      { type: "jump", actorId: "a", frames: 4 }
    ]);
    expect(parseRotationDsl(serializeRotationDsl(expanded), input)).toEqual(expanded);
    expect(parseRotationDsl("swap b at 20f walk 3f for a", input)[1]).toEqual({
      type: "walk", actorId: "a", frames: 3, atFrame: 20
    });
    expect(() => parseRotationDsl("W", {
      ...input, movementFrames: { dash: 12, jump: 4 }, aliases: { a: { W: "lift" } }
    })).toThrow(RotationDslError);

    expect(parseRotationDsl("P", input)).toEqual([
      { type: "plunge", actorId: "a", abilityId: "a-plunge" }
    ]);
    const ambiguous = { ...input, abilities: [...input.abilities, { ...plunge, id: "alternate-plunge" }] };
    expect(() => parseRotationDsl("P", ambiguous)).toThrow(RotationDslError);
    expect(parseRotationDsl("P", { ...ambiguous, aliases: { a: { P: "alternate-plunge" } } })).toEqual([
      { type: "plunge", actorId: "a", abilityId: "alternate-plunge" }
    ]);
    const misleading = {
      ...input,
      abilities: [{ ...normals[0]!, name: "下落攻击 plunge", hits: [{ frame: 5, scaling: 1, attackTag: "plunge" as const }] }]
    };
    expect(() => parseRotationDsl("P", misleading)).toThrow(RotationDslError);
    expect(() => parseRotationDsl("P", { ...input, aliases: { a: { P: "n1" } } })).toThrow(RotationDslError);
    expect(() => parseRotationDsl("plunge n1", input)).toThrow(RotationDslError);

    // Encoded movement metadata retains notes, source fragments and explicit false.
    const customCost: StaminaCost = {
      amount: 0, consumeFrame: 2, consumeWhenZero: false,
      source: { kind: "custom", note: "合成费用说明 with spaces # 保留整段" }
    };
    const sourcedCost: StaminaCost = {
      amount: 18, consumeFrame: 0, consumeWhenZero: true,
      source: { kind: "source", refs: ["https://example.invalid/movement#explicit-cost"] }
    };
    const staminaCommands: LegalTimelineCommand[] = [
      { type: "walk", actorId: "a", frames: 4, atFrame: 25, staminaCost: customCost },
      { type: "dash", actorId: "b", frames: 12, staminaCost: sourcedCost },
      { type: "jump", actorId: "a", frames: 4, staminaCost: customCost }
    ];
    const encodedCustomCost = encodeURIComponent(JSON.stringify(customCost));
    const encodedSourcedCost = encodeURIComponent(JSON.stringify(sourcedCost));
    const costSource = serializeRotationDsl(staminaCommands);
    expect(costSource).toBe([
      `at 25f walk 4f for a stamina ${encodedCustomCost}`,
      `dash 12f for b stamina ${encodedSourcedCost}`,
      `jump 4f for a stamina ${encodedCustomCost}`
    ].join("\n"));
    expect(parseRotationDsl(costSource, input)).toEqual(staminaCommands);
    expect(parseRotationDsl(`W stamina ${encodedCustomCost} D stamina ${encodedSourcedCost} J stamina ${encodedCustomCost}`, input)).toEqual([
      { type: "walk", actorId: "a", frames: 6, staminaCost: customCost },
      { type: "dash", actorId: "a", frames: 12, staminaCost: sourcedCost },
      { type: "jump", actorId: "a", frames: 4, staminaCost: customCost }
    ]);
    expect(() => parseRotationDsl(`P stamina ${encodedCustomCost}`, input)).toThrow(RotationDslError);
    expect(() => parseRotationDsl(`action lift stamina ${encodedCustomCost}`, input)).toThrow(RotationDslError);

    const config = makeConfig({
      timeline: {
        mode: "legal-frame-v1", fps: 60, legalityMode: "strict",
        initialActiveCharacterId: "a", swapFrames: 12,
        abilities: input.abilities.filter(ability => ability.actorId === "a"), commands: []
      }
    });
    const legalSource = "walk 4f action lift P";
    const fullInput = simConfigSchema.parse({ ...config, timeline: { ...config.timeline!, commands: parseRotationDsl(legalSource, input) } });
    expect(fullInput.timeline!.abilities.find(ability => ability.id === "a-plunge")!.kind).toBe("plunge");
    const compiled = compileRotationDsl(config, legalSource, input);
    expect(compiled.execution.commandResults.map(row => [row.commandType, row.startFrame, row.endFrame])).toEqual([
      ["walk", 0, 4], ["skill", 4, 6], ["plunge", 6, 16]
    ]);
    expect(compiled.execution.failures).toEqual([]);
    const executed = simulate(fullInput, { critMode: "noCrit" });
    const restored = simulationResultSchema.parse(JSON.parse(JSON.stringify(executed)));
    expect(restored.timelineExecution!.commandResults).toEqual(compiled.execution.commandResults);
    expect(compiled.execution.stateLog.map(row => [row.operation, row.statusKey, row.frame])).toEqual([
      ["grant", "airborne", 4], ["consume", "airborne", 6]
    ]);
    expect(compileRotationDsl(config, serializeRotationDsl(parseRotationDsl(legalSource, input)), input)).toEqual(compiled);
    expect(() => compileRotationDsl(config, "J P", input)).toThrow(/MISSING_REQUIRED_STATE/);
    expect(() => compileRotationDsl(config, `${legalSource} P`, input)).toThrow(/MISSING_REQUIRED_STATE/);
  });
});
