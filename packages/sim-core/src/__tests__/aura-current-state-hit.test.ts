import { describe, expect, it } from "vitest";
import { AuraEngine } from "../aura";
import { TargetLocalClock } from "../target-clock";

function noIcd(gaugeUnits = 1) {
  return {
    gaugeUnits,
    icd: {
      mode: "no-icd-v1" as const
    }
  };
}

function makeExpiringHydroDendroTarget() {
  const engine = new AuraEngine({
    mode: "aura-v9",
    reactableTickModel: "cached-boundary-v2",
    initialAura: [
      { element: "hydro", gaugeUnits: 0.01 },
      { element: "dendro", gaugeUnits: 0.01 }
    ]
  });
  const initial = engine.getAuraStateAt(0);
  const frame = initial.find(
    (entry) => entry.element === "hydro"
  )?.expiresAtFrame;
  expect(frame).toBeTypeOf("number");
  expect(
    initial.find((entry) => entry.element === "dendro")
      ?.expiresAtFrame
  ).toBe(frame);
  engine.getAuraStateAt(frame! - 1);
  return { engine, frame: frame! };
}

function resolvePreTickFreeze() {
  const { engine, frame } = makeExpiringHydroDendroTarget();
  const audit = engine.processHitAtCurrentTargetState({
    frame,
    sourceActorId: "cryo-callback",
    element: "cryo",
    application: noIcd(1)
  });
  const frameAfterHit = engine.getCurrentFrame();
  const frozenBeforeTick = audit.auraAfter?.find(
    (entry) => entry.element === "frozen"
  )?.gaugeUnits;
  const stateAfterTick = engine.getAuraStateAt(frame);

  return {
    frame,
    audit,
    frameAfterHit,
    frozenBeforeTick,
    stateAfterTick
  };
}

describe("AuraEngine current-state hit boundary", () => {
  it("reacts against F-1 Aura at F before leaving the F Reactable.Tick pending", () => {
    const result = resolvePreTickFreeze();

    expect(result.audit).toMatchObject({
      reaction: "freeze",
      reactions: ["freeze"],
      frozenReaction: {
        operation: "start"
      },
      auraBefore: [
        expect.objectContaining({ element: "dendro" }),
        expect.objectContaining({ element: "hydro" })
      ]
    });
    expect(result.frameAfterHit).toBe(result.frame - 1);
    expect(result.frozenBeforeTick).toBeTypeOf("number");

    expect(result.stateAfterTick).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "frozen" })
      ])
    );
    expect(result.stateAfterTick).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "dendro" })
      ])
    );
  });

  it("keeps ordinary processHit time-aware and advances before resolving", () => {
    const { engine, frame } = makeExpiringHydroDendroTarget();
    const audit = engine.processHit({
      frame,
      sourceActorId: "ordinary-cryo-hit",
      element: "cryo",
      application: noIcd(1)
    });

    expect(engine.getCurrentFrame()).toBe(frame);
    expect(audit).toMatchObject({
      reaction: "none",
      reactions: [],
      auraBefore: []
    });
    expect(audit.frozenReaction).toBeNull();
  });

  it("is deterministic across repeated pre-Tick runs", () => {
    expect(resolvePreTickFreeze()).toEqual(
      resolvePreTickFreeze()
    );
  });

  it("lazily materializes a sparse target only through F-1", () => {
    const engine = new AuraEngine({
      mode: "aura-v9",
      initialAura: [
        { element: "hydro", gaugeUnits: 1 },
        { element: "dendro", gaugeUnits: 1 }
      ]
    });

    const audit = engine.processHitAtCurrentTargetState({
      frame: 15,
      sourceActorId: "sparse-cryo-callback",
      element: "cryo",
      application: noIcd(1)
    });

    expect(engine.getCurrentFrame()).toBe(14);
    expect(audit).toMatchObject({
      reaction: "freeze",
      auraBefore: [
        expect.objectContaining({ element: "dendro" }),
        expect.objectContaining({ element: "hydro" })
      ]
    });
    engine.getAuraStateAt(15);
    expect(engine.getCurrentFrame()).toBe(15);
  });

  it("reads the current F state when another operation already materialized F", () => {
    const engine = new AuraEngine({
      mode: "aura-v9",
      initialAura: [{ element: "hydro", gaugeUnits: 1 }]
    });
    engine.getAuraStateAt(15);

    const audit = engine.processHitAtCurrentTargetState({
      frame: 15,
      sourceActorId: "same-frame-cryo-callback",
      element: "cryo",
      application: noIcd(1)
    });

    expect(engine.getCurrentFrame()).toBe(15);
    expect(audit).toMatchObject({
      reaction: "freeze",
      auraBefore: [
        expect.objectContaining({ element: "hydro" })
      ]
    });
  });

  it("materializes sparse target-clock state through F-1 and preserves the F local Tick", () => {
    const clock = new TargetLocalClock();
    const engine = new AuraEngine({
      mode: "aura-v9",
      targetClock: clock,
      initialAura: [
        { element: "hydro", gaugeUnits: 1 },
        { element: "dendro", gaugeUnits: 1 }
      ]
    });
    clock.applyHitlag({
      globalFrame: 0,
      haltFrames: 5,
      factor: 0
    });

    const audit = engine.processHitAtCurrentTargetState({
      frame: 15,
      sourceActorId: "clocked-cryo-callback",
      element: "cryo",
      application: noIcd(1)
    });
    const frozenBeforeTick = audit.auraAfter?.find(
      (entry) => entry.element === "frozen"
    )?.gaugeUnits;
    expect(frozenBeforeTick).toBeTypeOf("number");

    expect(engine.getCurrentFrame()).toBe(14);
    expect(clock.getState()).toMatchObject({
      globalFrame: 14,
      localFrame: 9,
      frozenFrames: 0
    });
    const afterTick = engine.getAuraStateAt(15);
    expect(clock.getState()).toMatchObject({
      globalFrame: 15,
      localFrame: 10
    });
    expect(
      afterTick.find((entry) => entry.element === "frozen")
        ?.gaugeUnits
    ).toBeLessThan(frozenBeforeTick!);
  });

  it("fails closed for stale, invalid, and drifted frames", () => {
    const engine = new AuraEngine({ mode: "aura-v9" });
    engine.getAuraStateAt(10);
    const input = {
      sourceActorId: "invalid-boundary",
      element: "pyro" as const,
      application: noIcd(1)
    };

    expect(() =>
      engine.processHitAtCurrentTargetState({
        ...input,
        frame: 9
      })
    ).toThrow(/cannot precede the already materialized frame 10/);
    expect(() =>
      engine.processHitAtCurrentTargetState({
        ...input,
        frame: Number.NaN
      })
    ).toThrow(/Elemental application frame must be finite/);
    expect(engine.getCurrentFrame()).toBe(10);
    expect(engine.getAuraStateAt(10)).toEqual([]);

    const clock = new TargetLocalClock();
    const drifted = new AuraEngine({
      mode: "aura-v9",
      targetClock: clock
    });
    clock.advanceTo(1);
    expect(() =>
      drifted.processHitAtCurrentTargetState({
        ...input,
        frame: 0
      })
    ).toThrow(/target-clock drift/);
    expect(drifted.getCurrentFrame()).toBe(0);
  });

  it("records a callback-frame Burning stop without advancing Aura", () => {
    const engine = new AuraEngine({
      mode: "aura-v9",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }]
    });
    const burning = engine.processHit({
      frame: 0,
      sourceActorId: "burning-owner",
      element: "pyro",
      application: noIcd(1)
    }).burningReaction;
    expect(burning?.operation).toBe("start");
    engine.getAuraStateAt(14);

    const audit = engine.processHitAtCurrentTargetState({
      frame: 15,
      sourceActorId: "hydro-callback",
      element: "hydro",
      application: noIcd(20)
    });

    expect(engine.getCurrentFrame()).toBe(14);
    expect(audit.burningReaction).toMatchObject({
      operation: "stop",
      snapshotFrame: 15,
      stopReason: "BURNING_AURA_CONSUMED"
    });
  });
});
