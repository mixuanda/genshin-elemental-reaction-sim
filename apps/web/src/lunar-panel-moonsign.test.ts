import { describe, expect, it } from "vitest";
import { resolveSpecialConversion, createSpecialReactionState, transitionSpecialState, SPECIAL_STATE_PROFILE_ID } from "../../../packages/sim-core/src/special-reaction-state";
import { capturedLunarPanelMoonsign, deriveLunarPanelMoonsign } from "./lunar-panel-moonsign";

describe("new-run Moonsign derived from actual party identity", () => {
  it("recognizes the specified Wanderer party's sourced zero grants without treating Hexerei as Moonsign", () => {
    const party = ["wanderer", "faruzan", "nicole", "durin"].map(characterKey => ({ actorId: characterKey, characterKey }));
    const resolved = deriveLunarPanelMoonsign(party);
    expect(resolved).toMatchObject({ origin: "party", level: 0, unknownActorIds: [] });
    for (const key of ["wanderer", "faruzan", "nicole", "durin"])
      expect(resolved.sourceRefs).toContain(`https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/internal/characters/${key}/${key}.go`);
    expect(resolveSpecialConversion(party, "electroCharged")).toMatchObject({ normalFallback: true, enablerActorIds: [] });
  });

  it("does not turn one known contributor and three sourced zero grants into an unknown or two-level party", () => {
    const resolved = deriveLunarPanelMoonsign([
      { actorId: "i", characterKey: "ineffa" }, { actorId: "w", characterKey: "wanderer" },
      { actorId: "n", characterKey: "nicole" }, { actorId: "d", characterKey: "durin" },
    ]);
    expect(resolved).toMatchObject({ level: 1, unknownActorIds: [] });
  });

  it("derives 0/1/2 from bounded positive and negative facts without any user eligibility choice", () => {
    expect(deriveLunarPanelMoonsign([{ actorId: "f", characterKey: "fischl" }, { actorId: "n", characterKey: "nahida" }])).toMatchObject({ level: 0, unknownActorIds: [] });
    expect(deriveLunarPanelMoonsign([{ actorId: "a", characterKey: "aino" }, { actorId: "n", characterKey: "nahida" }])).toMatchObject({ level: 1, unknownActorIds: [] });
    expect(deriveLunarPanelMoonsign([{ actorId: "a", characterKey: "aino" }, { actorId: "j", characterKey: "jahoda" }])).toMatchObject({ level: 2, unknownActorIds: [] });
    expect(deriveLunarPanelMoonsign([{ actorId: "c", characterKey: "columbina" }, { actorId: "f", characterKey: "fischl" }, { actorId: "z", characterKey: "zibai" }])).toMatchObject({ level: 2, unknownActorIds: [] });
    expect(deriveLunarPanelMoonsign([{ actorId: "i", characterKey: "ineffa" }, { actorId: "f", characterKey: "flins" }, { actorId: "a", characterKey: "aino" }]).level).toBe(2);
  });

  it("keeps unknown identity evidence unknown and never substitutes a regional label", () => {
    const party = [{ actorId: "future", characterKey: "unreviewed-nod-krai-character", region: "Nod-Krai" }];
    expect(deriveLunarPanelMoonsign(party)).toMatchObject({ level: undefined, unknownActorIds: ["future"] });
    expect(deriveLunarPanelMoonsign([{ actorId: "n", characterKey: "nahida" }, { actorId: "missing", characterKey: "" }])).toMatchObject({ level: undefined, unknownActorIds: ["missing"] });
    expect(deriveLunarPanelMoonsign([{ actorId: "a", characterKey: "aino" }, { actorId: "unknown", characterKey: "unknown" }]).level).toBeUndefined();
    expect(deriveLunarPanelMoonsign([{ actorId: "a", characterKey: "aino" }, { actorId: "j", characterKey: "jahoda" }, ...party])).toMatchObject({ level: 2, unknownActorIds: ["future"] });
    expect(deriveLunarPanelMoonsign([]).level).toBeUndefined();
    expect(deriveLunarPanelMoonsign([{ actorId: "same", characterKey: "aino" }, { actorId: "same", characterKey: "jahoda" }]).level).toBeUndefined();
  });

  it("never turns Moonsign membership or reaction eligibility into an actual per-hit trigger", () => {
    const aino = [{ actorId: "a", characterKey: "aino" }];
    expect(deriveLunarPanelMoonsign(aino).level).toBe(1);
    expect(resolveSpecialConversion(aino, "electroCharged")).toMatchObject({ normalFallback: true, enablerActorIds: [] });
    const eligible = [{ actorId: "c", characterKey: "columbina" }, { actorId: "e", characterKey: "lisa" }];
    expect(resolveSpecialConversion(eligible, "electroCharged")).toMatchObject({ specialReaction: "lunar-charged" });
    const state = createSpecialReactionState();
    const output = transitionSpecialState(state, { kind: "application", frame: 0, sourceActorId: "e", sourceEventId: "e-hit", attackId: "e-hit",
      targetId: "target", element: "electro", gaugeUnits: 1, actualIcdAllowed: false, resolutionOrigin: "aura-engine", ordinaryReaction: "electroCharged" },
    { profileId: SPECIAL_STATE_PROFILE_ID, targetId: "target", spatialProfile: "single-stationary-target-in-range", party: eligible,
      auraAt: () => ({ hydro: ["c"], electro: ["e"] }) });
    expect(output.conversion).toBeUndefined();
    expect(output.state.cloud).toBeUndefined();
    expect(output.damageIntents).toEqual([]);
  });

  it("preserves historical levels and captures while deriving a later new-run input", () => {
    const capture = { request: { party: [{ actorId: "c", characterKey: "columbina" }, { actorId: "z", characterKey: "zibai" }], moonsignLevel: 1 as const }, result: { moonsignLevel: 1 } };
    const before = JSON.stringify(capture), historical = capturedLunarPanelMoonsign(capture.request.moonsignLevel);
    expect(historical).toMatchObject({ origin: "capture", level: 1 });
    expect(deriveLunarPanelMoonsign(capture.request.party)).toMatchObject({ origin: "party", level: 2 });
    expect(capturedLunarPanelMoonsign(undefined).level).toBeUndefined();
    expect(historical.level).toBe(1);
    expect(JSON.stringify(capture)).toBe(before);
  });
});
