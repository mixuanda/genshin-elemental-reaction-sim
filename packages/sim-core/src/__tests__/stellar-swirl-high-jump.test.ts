import { describe, expect, it } from "vitest";
import { simulationResultSchema } from "@genshin-dps-lab/schemas";
import { captureSimulationHit, replaySimulationHit } from "../calculator-bridge";
import { compileLegalTimeline } from "../legal-timeline";
import { simulateStellarSwirlProfile } from "../simulator";
import { createSpecialReactionState, SPECIAL_STATE_PROFILE_ID, transitionSpecialState, type SpecialStateContext } from "../special-reaction-state";
import { stellarSwirlConfig, stellarSwirlParty as party } from "./special-profile-fixtures";

function jumpingConfig() {
  const config = stellarSwirlConfig([6]);
  config.timeline!.legalityMode = "wait";
  config.timeline!.abilities.push({ id: "p", actorId: "c", name: "Declared physical plunge", kind: "plunge",
    cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
    timelineState: { requires: ["airborne"], consumes: ["airborne"] },
    hits: [{ id: "p", frame: 0, scaling: 2, element: "physical", attackTag: "plunge" }] });
  config.timeline!.commands.push({ type: "swap", characterId: "c", atFrame: 180 },
    { type: "jump", actorId: "c", frames: 9, atFrame: 187 },
    { type: "plunge", actorId: "c", abilityId: "p", atFrame: 196 });
  return config;
}

describe("Stellar-Swirl actual jump consumption and declared plunge", () => {
  it("consumes the team buff on an executed jump and counts one ordinary plunge with JSON replay", () => {
    const result = simulateStellarSwirlProfile(jumpingConfig(), { party });
    expect(result.profile.evidence).toBe("guide-profile-source-conflict");
    expect(result.executionLog.filter(row => row.type.startsWith("high-jump-")).map(row =>
      [row.type, row.frame, row.details.actorId, row.details.allowed])).toEqual([
      ["high-jump-use", 187, "c", true], ["high-jump-land", 196, "c", true]
    ]);
    expect(result.highJump).toEqual({ available: false, expiresAt: null, consumptionImplemented: true, airborne: null });
    expect(result.baseResult.timelineExecution!.failures).toEqual([]);
    const plunge = result.baseResult.damageEvents.filter(row => row.hitId === "p");
    expect(plunge).toHaveLength(1);
    expect(plunge[0]).toMatchObject({ frame: 196, sourceActorId: "c", element: "physical" });
    expect(result.totalDamage).toBe(result.classicDamage + result.stellarSwirlDamage);
    const restored = simulationResultSchema.parse(JSON.parse(JSON.stringify(result.baseResult)));
    expect(replaySimulationHit(captureSimulationHit(restored, plunge[0]!.id)).reproducedDamage).toBe(plunge[0]!.finalDamage);
  });

  it("does not accept invented lift, non-plunge airborne actions, or a second plunge", () => {
    const config = jumpingConfig();
    const jumpIndex = config.timeline!.commands.length - 2;
    const noRuntime = compileLegalTimeline(config);
    expect(noRuntime.execution.failures.at(-1)?.code).toBe("MISSING_REQUIRED_STATE");
    config.timeline!.commands.splice(jumpIndex + 1, 0, { type: "skill", actorId: "c", abilityId: "c", atFrame: 196 });
    config.timeline!.commands.push({ type: "plunge", actorId: "c", abilityId: "p", atFrame: 198 });
    const result = simulateStellarSwirlProfile(config, { party });
    expect(result.baseResult.timelineExecution!.failures.map(row => row.code)).toEqual([
      "INVALID_AIRBORNE_ACTION", "MISSING_REQUIRED_STATE"
    ]);
    expect(result.baseResult.damageEvents.filter(row => row.hitId === "p")).toHaveLength(1);
    expect(result.executionLog.filter(row => row.type === "high-jump-land")).toHaveLength(1);
  });

  it("uses an exclusive 300-frame expiry and never pulls a later same-frame explosion into a jump", () => {
    const context: SpecialStateContext = { party, profileId: SPECIAL_STATE_PROFILE_ID,
      spatialProfile: "single-stationary-target-in-range", targetId: "enemy-0", auraAt: () => ({ cryo: ["c"] }) };
    const before = { ...createSpecialReactionState(), highJump: { available: true, expiresAt: 300 } };
    const jump = (frame: number) => ({ kind: "consume-high-jump" as const, frame, actorId: "c", sourceEventId: `jump-${frame}`, scheduler: "host-main-heap" as const });
    const accepted = transitionSpecialState(before, jump(299), context);
    expect(accepted.state.highJump).toBeUndefined();
    expect(accepted.state.stellarAirborne).toMatchObject({ actorId: "c", startedAt: 299 });
    expect(transitionSpecialState(before, jump(300), context).log.at(-1)!.details.allowed).toBe(false);
    const later = transitionSpecialState(accepted.state, { kind: "advance", frame: 600 }, context);
    expect(later.state.stellarAirborne?.actorId).toBe("c");
    const created = transitionSpecialState(createSpecialReactionState(), { kind: "application", frame: 0,
      sourceActorId: "a", sourceEventId: "hit", attackId: "hit", targetId: "enemy-0", element: "anemo",
      gaugeUnits: 1, actualIcdAllowed: true, resolutionOrigin: "aura-engine", ordinaryReaction: "swirlCryo", auraBefore: { cryo: ["c"] } }, context);
    const sameFrameJump = transitionSpecialState(created.state, jump(180), context);
    expect(sameFrameJump.damageIntents).toEqual([]);
    expect(sameFrameJump.log.at(-1)!.details.allowed).toBe(false);
    expect(sameFrameJump.nextWakeFrame).toBe(180);
    const explosion = transitionSpecialState(sameFrameJump.state, { kind: "advance", frame: 180 }, context);
    expect(explosion.state.highJump).toEqual({ available: true, expiresAt: 480 });
  });
});
