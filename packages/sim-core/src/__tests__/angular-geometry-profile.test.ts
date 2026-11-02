import { describe, expect, it } from "vitest";
import { ANGULAR_GEOMETRY_SEMANTICS, resolveAngularGeometry } from "@genshin-dps-lab/reaction-formulas";
import { currentResolvedSimulationRuntimeOptionsSchema, resolvedSimulationRuntimeOptionsSchema, simulationResultSchema, type AbilityDefinition } from "@genshin-dps-lab/schemas";
import { captureSpecialSimulation, parseSpecialSimulation, runSpecialSimulation, serializeSpecialSimulation, type SpecialSimulationRequest } from "../special-result-capture";
import { simulate } from "../simulator";
import { lunarBloomConfig, lunarBloomDeclaration, lunarBloomParty } from "./special-profile-fixtures";
import { makeConfig } from "./fixtures";

function request(portable = false): SpecialSimulationRequest {
  return { profile: "lunar-bloom", config: lunarBloomConfig(),
    options: portable ? { angularGeometrySemantics: ANGULAR_GEOMETRY_SEMANTICS } : {},
    party: lunarBloomParty, abilities: [lunarBloomDeclaration] };
}

function nextFloat(value: number): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + 1n);
  return view.getFloat64(0);
}

describe("versioned angular geometry and strict replay", () => {
  it("keeps absent-selector legacy requests and captures unchanged", () => {
    const input = request();
    const before = JSON.stringify(input);
    const result = runSpecialSimulation(input);
    expect(resolveAngularGeometry().sin(2.382987774834482)).toBe(Math.sin(2.382987774834482));
    expect(result.baseResult.resolvedRuntimeOptions).not.toHaveProperty("angularGeometrySemantics");
    expect(result.baseResult.runManifest.resolvedRuntimeOptions).not.toHaveProperty("angularGeometrySemantics");
    const wire = serializeSpecialSimulation(captureSpecialSimulation(input, result));
    expect(serializeSpecialSimulation(parseSpecialSimulation(wire))).toBe(wire);
    expect(JSON.stringify(input)).toBe(before);
    expect(parseSpecialSimulation(wire).request.options).toEqual({});
  });

  it("binds the selected algorithm to the run key without changing RNG, event order or damage", () => {
    const legacy = runSpecialSimulation(request());
    const input = request(true);
    const result = runSpecialSimulation(input);
    expect(result.baseResult.resolvedRuntimeOptions.angularGeometrySemantics).toBe(ANGULAR_GEOMETRY_SEMANTICS);
    expect(result.baseResult.runManifest.resolvedRuntimeOptions).toEqual(result.baseResult.resolvedRuntimeOptions);
    expect(result.baseResult.reproducibilityKey).not.toBe(legacy.baseResult.reproducibilityKey);
    expect(result.baseResult.config).toEqual(legacy.baseResult.config);
    expect(result.baseResult.actionLog).toEqual(legacy.baseResult.actionLog);
    expect(result.baseResult.energyLog).toEqual(legacy.baseResult.energyLog);
    expect(result.baseResult.particleEvents).toEqual(legacy.baseResult.particleEvents);
    expect(result.baseResult.damageEvents).toEqual(legacy.baseResult.damageEvents);
    expect(result.totalDamage).toBe(legacy.totalDamage);
    const rolls = (value: typeof result) => value.baseResult.dendroCoreLog.filter(row => row.operation === "spawn").map(row =>
      ({ frame: row.frame, coreId: row.coreId, rngStream: row.rngStream, roll: row.positionRandomRoll, angle: row.spawnAngleDegrees }));
    expect(rolls(result)).not.toHaveLength(0);
    expect(rolls(result)).toEqual(rolls(legacy));
    const wire = captureSpecialSimulation(input, result);
    expect(parseSpecialSimulation(serializeSpecialSimulation(wire))).toStrictEqual(wire);
    expect(currentResolvedSimulationRuntimeOptionsSchema.safeParse(result.baseResult.resolvedRuntimeOptions).success).toBe(true);
    expect(resolvedSimulationRuntimeOptionsSchema.safeParse(result.baseResult.resolvedRuntimeOptions).success).toBe(false);
  });

  it.each([null, "native-js-v1", "fdlibm-angular-v2", true])("rejects unknown or malformed selector %s without falling back", invalid => {
    const input = request();
    input.options = { angularGeometrySemantics: invalid } as unknown as SpecialSimulationRequest["options"];
    expect(() => runSpecialSimulation(input)).toThrow(/angular geometry/);
    expect(currentResolvedSimulationRuntimeOptionsSchema.safeParse({ energyMode: "configured", critMode: "average", compatibilityMode: "legal-frame-v1", randomSeed: "test", angularGeometrySemantics: invalid }).success).toBe(false);
  });

  it("rejects selector removal, mismatches and one-ULP result tampering without rewriting the file", () => {
    const input = request(true);
    const wire = captureSpecialSimulation(input, runSpecialSimulation(input));
    const before = JSON.stringify(wire);
    const variants = [structuredClone(wire), structuredClone(wire), structuredClone(wire), structuredClone(wire)];
    delete variants[0]!.request.options.angularGeometrySemantics;
    delete variants[1]!.result.baseResult.resolvedRuntimeOptions.angularGeometrySemantics;
    delete variants[2]!.result.baseResult.runManifest.resolvedRuntimeOptions.angularGeometrySemantics;
    const spawn = variants[3]!.result.baseResult.dendroCoreLog.find(row => row.operation === "spawn")!;
    if (spawn.operation !== "spawn") throw new Error("Expected an actual core spawn");
    spawn.position.y = nextFloat(spawn.position.y);
    for (const tampered of variants) expect(() => parseSpecialSimulation(JSON.stringify(tampered))).toThrow(/differs from same-engine re-execution/);
    expect(JSON.stringify(wire)).toBe(before);
    const legacy = request();
    const oldWire = captureSpecialSimulation(legacy, runSpecialSimulation(legacy));
    oldWire.request.options.angularGeometrySemantics = ANGULAR_GEOMETRY_SEMANTICS;
    expect(() => parseSpecialSimulation(JSON.stringify(oldWire))).toThrow(/differs from same-engine re-execution/);
  });

  it("uses the same selected angular math for all actor-local shapes and schema-side geometry replay", () => {
    const ability: AbilityDefinition = { id: "angular-shapes", actorId: "a", name: "Synthetic spatial contract", kind: "skill", cancelFrame: 0, animationEndFrame: 3, cooldownFrames: 0, hits: [
      { id: "circle", frame: 0, scaling: 1, geometry: { kind: "circle", coordinateSpace: "actor-local", origin: { x: 1, y: 0 }, radius: 2 } },
      { id: "rectangle", frame: 1, scaling: 1, geometry: { kind: "rectangle", coordinateSpace: "actor-local", origin: { x: 0, y: 0 }, halfWidth: 2, halfHeight: 0.2, rotationDegrees: 37 } },
      { id: "capsule", frame: 2, scaling: 1, geometry: { kind: "capsule", coordinateSpace: "actor-local", start: { x: 0, y: 0 }, end: { x: 2, y: 0 }, radius: 0.2 } },
      { id: "sector", frame: 3, scaling: 1, geometry: { kind: "sector", coordinateSpace: "actor-local", origin: { x: 0, y: 0 }, radius: 2, directionDegrees: -170, angleDegrees: 137 } }
    ] };
    const config = makeConfig({ duration: 1, cycleLength: 1,
      actorPoses: [{ actorId: "a", position: { x: 10, y: 20 }, facingDegrees: 136.53514212928712 }],
      enemy: { level: 90, resistance: 0.1, defReduction: 0, targets: [{ id: "enemy-0", name: "Synthetic geometry target", position: { x: 10.25, y: 20.5 }, hitboxRadius: 0.1 }] }, rotation: [],
      timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1, abilities: [ability], commands: [{ type: "skill", actorId: "a", abilityId: ability.id, atFrame: 0 }] }
    });
    const result = simulate(config, { angularGeometrySemantics: ANGULAR_GEOMETRY_SEMANTICS });
    expect(result.hitResolutionLog.map(row => row.geometryKind)).toEqual(["circle", "rectangle", "capsule", "sector"]);
    expect(simulationResultSchema.parse(result).hitResolutionLog).toEqual(result.hitResolutionLog);
  });
});
