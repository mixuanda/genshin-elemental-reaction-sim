import { describe, expect, it } from "vitest";
import { createSpecialReactionState, transitionSpecialState, resolveSpecialConversion, resolveActorSpecialRadiance, resolveMoonsignLevel, SPECIAL_STATE_PROFILE_ID, type SpecialStateContext, type SpecialStateEvent, type ConvertibleOrdinaryReaction, type SpecialElement, type SpecialAuraSnapshot } from "./special-reaction-state";

const lunarParty = [{ actorId: "moon", characterKey: "columbina" }, { actorId: "hydro", characterKey: "barbara", moonsignBenediction: false }, { actorId: "geo", characterKey: "noelle", moonsignBenediction: false }, { actorId: "electro", characterKey: "lisa", moonsignBenediction: false }];
const stellarParty = [{ actorId: "star", characterKey: "odette" }, { actorId: "cryo", characterKey: "kaeya" }, { actorId: "anemo", characterKey: "sucrose" }, { actorId: "electro", characterKey: "lisa" }];
const aura: SpecialAuraSnapshot = { hydro: ["hydro"], electro: ["electro"], cryo: ["cryo"] };
const context = (stellar = false): SpecialStateContext => ({ profileId: SPECIAL_STATE_PROFILE_ID, spatialProfile: "single-stationary-target-in-range", targetId: "target", party: stellar ? stellarParty : lunarParty, auraAt: () => aura });
function application(at: number, reaction: ConvertibleOrdinaryReaction, actorId: string, element: SpecialElement, before = aura): Extract<SpecialStateEvent, { kind: "application" }> {
  return { kind: "application", frame: at, sourceActorId: actorId, sourceEventId: `source-${at}`, attackId: `attack-${at}`, targetId: "target", element, gaugeUnits: 1, actualIcdAllowed: true, resolutionOrigin: "aura-engine", ordinaryReaction: reaction, auraBefore: before };
}

describe("automatic bounded special reaction state profile", () => {
  it("derives conversion from actual party enablement, preserves ordinary fallback and does not equate Moonsign to enablement", () => {
    expect(resolveSpecialConversion([{ actorId: "aino", characterKey: "aino", moonsignBenediction: true }], "electroCharged").normalFallback).toBe(true);
    expect(resolveMoonsignLevel([...lunarParty.slice(0, 1), { actorId: "aino", characterKey: "aino", moonsignBenediction: true }]).level).toBe(2);
    expect(resolveSpecialConversion(lunarParty, "bloom")).toMatchObject({ specialReaction: "lunar-bloom", preserveOrdinaryCore: true, suppressOrdinaryDamage: false });
    const event = application(0, "electroCharged", "electro", "electro");
    const disabled = transitionSpecialState(createSpecialReactionState(), { ...event, actualIcdAllowed: false }, context());
    expect(disabled.conversion).toBeUndefined(); expect(disabled.state.cloud).toBeUndefined();
  });
  it("automatically samples live LC contributors per tick, refreshes cloud and preserves target ICD across recreation", () => {
    const ctx = context(); ctx.auraAt = at => ({ hydro: at < 100 ? ["hydro"] : ["moon"], electro: ["electro"] });
    let state = transitionSpecialState(createSpecialReactionState(), application(0, "electroCharged", "electro", "electro"), ctx).state;
    const ticks = transitionSpecialState(state, { kind: "advance", frame: 330 }, ctx);
    expect(ticks.damageIntents.map(hit => hit.snapshotFrame)).toEqual([9, 129, 249]);
    expect(ticks.damageIntents.map(hit => hit.contributorIds)).toEqual([["electro", "hydro"], ["electro", "moon"], ["electro", "moon"]]);
    expect(ticks.damageIntents[0]!.onDelivery[0]).toEqual({ kind: "consume-aura", element: "hydro", gaugeUnits: 0.4, scope: "each-personal-aura" });
    state = transitionSpecialState(ticks.state, application(340, "electroCharged", "moon", "hydro"), ctx).state;
    const renewed = transitionSpecialState(state, { kind: "advance", frame: 373 }, ctx);
    expect(renewed.damageIntents.map(hit => hit.snapshotFrame)).toEqual([373]);
    expect(renewed.damageIntents[0]!.ownerId).toBe("moon");
  });
  it("captures Moondrift participants per volley while taking each damage snapshot at its source-backed hitmark", () => {
    const ctx = context(); let state = createSpecialReactionState();
    for (const at of [0, 10, 20]) state = transitionSpecialState(state, application(at, "crystallizeHydro", "geo", "geo", { hydro: [at === 0 ? "moon" : "hydro"] }), ctx).state;
    const volley = transitionSpecialState(state, { kind: "advance", frame: 60 }, ctx);
    expect(volley.damageIntents.map(hit => [hit.snapshotFrame, hit.deliveryFrame])).toEqual([[33, 43], [45, 55], [57, 67]]);
    expect(volley.damageIntents.every(hit => hit.contributorIds.join(",") === "geo,hydro,moon")).toBe(true);
    expect(volley.state.moondrifts!.contributors).toEqual([]);
    let incomplete = createSpecialReactionState();
    for (const at of [0, 10, 20]) incomplete = transitionSpecialState(incomplete, application(at, "crystallizeHydro", "geo", "geo", at === 0 ? {} : { hydro: ["hydro"] }), ctx).state;
    expect(transitionSpecialState(incomplete, { kind: "advance", frame: 70 }, ctx).damageIntents).toEqual([]);
  });
  it("fills Verdant Dew continuously under the fixed 60fps source profile and spends only generated stacks", () => {
    const ctx = context(); let state = transitionSpecialState(createSpecialReactionState(), application(0, "bloom", "hydro", "hydro"), ctx).state;
    state = transitionSpecialState(state, application(120, "bloom", "moon", "dendro"), ctx).state;
    const end = transitionSpecialState(state, { kind: "advance", frame: 300 }, ctx);
    expect(end.state.dew).toMatchObject({ full: 1, partialFrames: 122 });
    expect(end.log.find(row => row.type === "resource-gain")!.frame).toBe(147);
    const spent = transitionSpecialState(end.state, { kind: "consume-verdant-dew", frame: 300, amount: 2, actorId: "moon", sourceEventId: "skill" }, ctx);
    expect(spent.state.dew.full).toBe(0); expect(spent.log.at(-1)!.details).toMatchObject({ requested: 2, consumed: 1 });
    expect(end.damageIntents).toEqual([]);
  });
  it("ticks the old Verdant Dew deadline before assigning a same-frame refresh", () => {
    const ctx = context();
    const initial = transitionSpecialState(createSpecialReactionState(), application(0, "bloom", "hydro", "hydro"), ctx).state;
    // The refresh assignment at 149 runs after the old window's inclusive
    // deadline tick, so an unbroken window does not lose a production frame.
    const continuous = transitionSpecialState(initial, application(148, "bloom", "moon", "dendro"), ctx).state;
    const atDeadline = transitionSpecialState(continuous, { kind: "advance", frame: 149 }, ctx).state;
    expect(atDeadline.dew).toMatchObject({ full: 1, partialFrames: 2, activeUntil: 297 });
    expect(transitionSpecialState(atDeadline, { kind: "advance", frame: 150 }, ctx).state.dew.partialFrames).toBe(3);

    // A trigger at 149 assigns the next window after production at 150.
    // The expired old window cannot borrow that later assignment retroactively.
    const pending = transitionSpecialState(initial, application(149, "bloom", "moon", "dendro"), ctx).state;
    expect(pending.dew).toMatchObject({ full: 1, partialFrames: 2, activeUntil: 149 });
    const assigned = transitionSpecialState(pending, { kind: "advance", frame: 150 }, ctx).state;
    expect(assigned.dew).toMatchObject({ full: 1, partialFrames: 2, activeFrom: 151, activeUntil: 298 });
    expect(transitionSpecialState(assigned, { kind: "advance", frame: 151 }, ctx).state.dew.partialFrames).toBe(3);
  });
  it("records real ICD-allowed SSC applications, excludes creation, uses actor ICD, publishes count every240frames without resetting phase on refresh", () => {
    const ctx = context(true); let state = transitionSpecialState(createSpecialReactionState(), application(0, "superconduct", "electro", "electro"), ctx).state;
    expect(state.polestar).toMatchObject({ stored: 0, activeCount: 0 });
    for (const at of [10, 11, 16]) state = transitionSpecialState(state, application(at, "superconduct", "electro", "electro"), ctx).state;
    expect(state.polestar!.stored).toBe(2);
    const published = transitionSpecialState(state, { kind: "advance", frame: 240 }, ctx);
    expect(published.state.polestar).toMatchObject({ stored: 0, activeCount: 2, expiresAt: 376, buffExpiresAt: 481 });
    expect(published.log.find(row => row.type === "field-buffs")!.details).toMatchObject({ applicationCount: 2, cryoAndElectroBonus: 0.3, specialCoefficient: 1.5, physicalResistanceReduction: 0.4 });
    expect(published.damageIntents).toEqual([]);
  });
  it("automatically upgrades one vortex, captures contributor union, detonates at180frames and preserves eligible Radiance with SSC priority", () => {
    const ctx = context(true); let state = createSpecialReactionState();
    for (const at of [0, 20, 40]) state = transitionSpecialState(state, application(at, "swirlCryo", "anemo", "anemo", { cryo: [at === 0 ? "star" : "cryo"] }), ctx).state;
    expect(state.vortex!.triggers).toBe(3);
    expect(resolveActorSpecialRadiance(state, ctx.party, "star", 50)).toBe("stellar-swirl");
    expect(resolveActorSpecialRadiance(state, ctx.party, "anemo", 50)).toBe("none");
    state = transitionSpecialState(state, application(50, "superconduct", "electro", "electro"), ctx).state;
    expect(resolveActorSpecialRadiance(state, ctx.party, "star", 51)).toBe("stellar-conduct");
    const explosion = transitionSpecialState(state, { kind: "advance", frame: 180 }, ctx);
    expect(explosion.damageIntents[0]).toMatchObject({ branch: "stellar-swirl-vortex-2", snapshotFrame: 180, contributorIds: ["anemo", "cryo", "star"], onDelivery: [{ kind: "apply-element", element: "cryo", gaugeUnits: 1 }] });
    expect(explosion.state.highJump).toEqual({ available: true, expiresAt: 480 });
    const jumped = transitionSpecialState(explosion.state, { kind: "consume-high-jump", frame: 181, actorId: "star", sourceEventId: "jump" }, ctx);
    expect(jumped.state.highJump).toBeUndefined();
    expect(jumped.state.stellarAirborne).toMatchObject({ actorId: "star", startedAt: 181 });
  });
  it("preserves pending SSC records and character ICD across field destruction and recreation", () => {
    const ctx = context(true);
    const ordinaryApplication = (frame: number) => {
      const event = application(frame, "superconduct", "electro", "electro");
      delete event.ordinaryReaction;
      return event;
    };
    let state = transitionSpecialState(createSpecialReactionState(), application(0, "superconduct", "electro", "electro"), ctx).state;
    state = transitionSpecialState(state, ordinaryApplication(359), ctx).state;
    expect(state.polestarRecorded).toBe(1);
    state = transitionSpecialState(state, application(361, "superconduct", "electro", "electro"), ctx).state;
    expect(state.polestar).toMatchObject({ activeCount: 1, stored: 0 });
    expect(state.polestarActorReadyAt.electro).toBe(365);
    state = transitionSpecialState(state, ordinaryApplication(362), ctx).state;
    expect(state.polestarRecorded).toBe(0);
    state = transitionSpecialState(state, ordinaryApplication(365), ctx).state;
    expect(state.polestarRecorded).toBe(1);
  });
  it("detonates after six sourced triggers and keeps missing contributor evidence blocked through entity lifetime", () => {
    const ctx = context(true); let state = createSpecialReactionState(); let output;
    for (const at of [0, 10, 20, 30, 40, 50]) {
      output = transitionSpecialState(state, application(at, "swirlCryo", "anemo", "anemo", at === 0 ? {} : { cryo: ["cryo"] }), ctx); state = output.state;
    }
    expect(state.vortex).toBeUndefined();
    expect(output!.damageIntents.at(-1)).toMatchObject({ branch: "stellar-swirl-vortex-2", snapshotFrame: 50 });
    expect(output!.damageIntents.at(-1)!.blockedMechanics[0]!.field).toBe("contributorAuraOwnership");
    expect(transitionSpecialState(state, { kind: "advance", frame: 180 }, ctx).damageIntents).toEqual([]);
  });
});
