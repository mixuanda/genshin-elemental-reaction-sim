import {
  GCSIM_DAMAGE_GROUP_PROFILE,
  GCSIM_DAMAGE_GROUP_PROFILE_ID
} from "@genshin-dps-lab/icd-profiles";
import { describe, expect, it } from "vitest";

import {
  DirectDamageGroupEngine,
  type DirectDamageGroupHitInput
} from "../direct-damage-group";

function consume(
  engine: DirectDamageGroupEngine,
  frame: number,
  icdGroup: string,
  sourceActorId = "actor",
  icdTag = "tag"
) {
  return engine.consumeLandedHit({
    frame,
    sourceActorId,
    icdTag,
    icdGroup
  });
}

describe("DirectDamageGroupEngine", () => {
  it("opens at hit zero and resets exactly at start + resetFrames - 1", () => {
    const engine = new DirectDamageGroupEngine();

    expect(consume(engine, 0, "pole-extra-attack")).toEqual({
      profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID,
      sourceActorId: "actor",
      icdTag: "tag",
      icdGroup: "pole-extra-attack",
      windowStartGroup: "pole-extra-attack",
      resetFrames: 30,
      windowStartFrame: 0,
      resetAtFrame: 29,
      hitIndex: 0,
      sequenceIndex: 0,
      sequenceMultiplier: 1
    });

    expect(consume(engine, 28, "pole-extra-attack")).toMatchObject({
      windowStartFrame: 0,
      resetAtFrame: 29,
      hitIndex: 1,
      sequenceIndex: 1,
      sequenceMultiplier: 0
    });
    expect(consume(engine, 29, "pole-extra-attack")).toMatchObject({
      windowStartFrame: 29,
      resetAtFrame: 58,
      hitIndex: 0,
      sequenceIndex: 0,
      sequenceMultiplier: 1
    });
  });

  it("isolates actor/tag tuple state without delimiter-key collisions", () => {
    const engine = new DirectDamageGroupEngine();

    const first = consume(
      engine,
      0,
      "pole-extra-attack",
      "a",
      "b\0c"
    );
    const structurallyDifferent = consume(
      engine,
      0,
      "pole-extra-attack",
      "a\0b",
      "c"
    );
    const otherTag = consume(
      engine,
      0,
      "pole-extra-attack",
      "a",
      "other"
    );
    const second = consume(
      engine,
      1,
      "pole-extra-attack",
      "a",
      "b\0c"
    );

    expect(first.hitIndex).toBe(0);
    expect(structurallyDifferent.hitIndex).toBe(0);
    expect(otherTag.hitIndex).toBe(0);
    expect(second).toMatchObject({
      hitIndex: 1,
      sequenceMultiplier: 0
    });
  });

  it("isolates identical actor/tag state between target-local instances", () => {
    const targetA = new DirectDamageGroupEngine();
    const targetB = new DirectDamageGroupEngine();

    consume(targetA, 0, "pole-extra-attack");
    expect(consume(targetA, 1, "pole-extra-attack")).toMatchObject({
      hitIndex: 1,
      sequenceMultiplier: 0
    });
    expect(consume(targetB, 1, "pole-extra-attack")).toMatchObject({
      windowStartFrame: 1,
      hitIndex: 0,
      sequenceMultiplier: 1
    });
  });

  it("shares a counter across group changes while retaining the opening timer", () => {
    const engine = new DirectDamageGroupEngine();

    expect(consume(engine, 0, "default")).toMatchObject({
      windowStartGroup: "default",
      resetFrames: 150,
      resetAtFrame: 149,
      hitIndex: 0,
      sequenceMultiplier: 1
    });
    expect(consume(engine, 1, "xiao-dash")).toMatchObject({
      icdGroup: "xiao-dash",
      windowStartGroup: "default",
      resetFrames: 150,
      resetAtFrame: 149,
      hitIndex: 1,
      sequenceIndex: 1,
      sequenceMultiplier: 0
    });
    expect(consume(engine, 6, "xiao-dash")).toMatchObject({
      windowStartGroup: "default",
      resetAtFrame: 149,
      hitIndex: 2,
      sequenceIndex: 2,
      sequenceMultiplier: 0
    });
    expect(consume(engine, 149, "xiao-dash")).toMatchObject({
      windowStartGroup: "xiao-dash",
      resetFrames: 6,
      windowStartFrame: 149,
      resetAtFrame: 154,
      hitIndex: 0,
      sequenceIndex: 0,
      sequenceMultiplier: 1
    });
  });

  it("clamps sequenceIndex and multiplier to the final sequence slot", () => {
    const engine = new DirectDamageGroupEngine();
    const decisions = Array.from({ length: 13 }, (_, hitIndex) =>
      consume(engine, hitIndex, "reaction-a")
    );

    expect(decisions[9]).toMatchObject({
      hitIndex: 9,
      sequenceIndex: 9,
      sequenceMultiplier: 0
    });
    expect(decisions[10]).toMatchObject({
      hitIndex: 10,
      sequenceIndex: 9,
      sequenceMultiplier: 0
    });
    expect(decisions[12]).toMatchObject({
      hitIndex: 12,
      sequenceIndex: 9,
      sequenceMultiplier: 0
    });
  });

  it.each([
    ["pole-extra-attack", 1],
    ["reaction-a", 2],
    ["reaction-b", 1],
    ["ayaka-extra-attack", 3],
    ["cyno-bolt", 3],
    ["xiao-dash", 1],
    ["yae-charged", 1],
    ["yelan-breakthrough", 1]
  ] as const)(
    "reaches the fixed zero slot for %s at hit %i",
    (icdGroup, firstZeroIndex) => {
      const engine = new DirectDamageGroupEngine();
      const decisions = Array.from(
        { length: firstZeroIndex + 1 },
        (_, hitIndex) => consume(engine, hitIndex, icdGroup)
      );

      expect(
        decisions.slice(0, firstZeroIndex).map((decision) =>
          decision.sequenceMultiplier
        )
      ).toEqual(Array(firstZeroIndex).fill(1));
      expect(decisions[firstZeroIndex]).toMatchObject({
        hitIndex: firstZeroIndex,
        sequenceIndex: firstZeroIndex,
        sequenceMultiplier: 0
      });
    }
  );

  it("can resolve and consume every one of the 58 fixed profile groups", () => {
    expect(GCSIM_DAMAGE_GROUP_PROFILE.groups).toHaveLength(58);

    for (const group of GCSIM_DAMAGE_GROUP_PROFILE.groups) {
      const decision = consume(
        new DirectDamageGroupEngine(),
        0,
        group.id
      );
      expect(decision).toMatchObject({
        profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID,
        icdGroup: group.id,
        windowStartGroup: group.id,
        resetFrames: group.resetFrames,
        windowStartFrame: 0,
        resetAtFrame: group.resetFrames - 1,
        hitIndex: 0,
        sequenceIndex: 0,
        sequenceMultiplier: group.damageSequence[0]
      });
    }
  });

  it("is deterministic across independent target-local engine instances", () => {
    const run = () => {
      const engine = new DirectDamageGroupEngine();
      const inputs = [
        [0, "default", "actor-a", "shared"],
        [0, "pole-extra-attack", "actor-b", "shared"],
        [1, "xiao-dash", "actor-a", "shared"],
        [2, "reaction-a", "actor-b", "shared"],
        [149, "yae-charged", "actor-a", "shared"]
      ] as const;
      return inputs.map(([frame, group, actor, tag]) =>
        consume(engine, frame, group, actor, tag)
      );
    };

    expect(run()).toEqual(run());
  });

  it("strictly rejects invalid input without consuming state", () => {
    const engine = new DirectDamageGroupEngine();

    for (const invalidInput of [null, [], "hit", 1]) {
      expect(() =>
        engine.consumeLandedHit(
          invalidInput as unknown as DirectDamageGroupHitInput
        )
      ).toThrow(/input must be an object/);
    }

    for (const invalidFrame of [
      -1,
      0.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1
    ]) {
      expect(() =>
        consume(engine, invalidFrame, "default")
      ).toThrow(/frame/);
    }
    for (const [field, value] of [
      ["sourceActorId", ""],
      ["icdTag", ""],
      ["icdGroup", ""]
    ] as const) {
      expect(() =>
        engine.consumeLandedHit({
          frame: 0,
          sourceActorId: field === "sourceActorId" ? value : "actor",
          icdTag: field === "icdTag" ? value : "tag",
          icdGroup: field === "icdGroup" ? value : "default"
        })
      ).toThrow(new RegExp(field));
    }
    for (const field of [
      "sourceActorId",
      "icdTag",
      "icdGroup"
    ] as const) {
      expect(() =>
        engine.consumeLandedHit({
          frame: 0,
          sourceActorId: field === "sourceActorId" ? 1 : "actor",
          icdTag: field === "icdTag" ? 1 : "tag",
          icdGroup: field === "icdGroup" ? 1 : "default"
        } as unknown as DirectDamageGroupHitInput)
      ).toThrow(new RegExp(`${field} must be a string`));
    }
    expect(() => consume(engine, 0, "not-a-real-group")).toThrow(
      /unknown (?:direct-)?damage group/
    );
    expect(() =>
      consume(engine, Number.MAX_SAFE_INTEGER, "default")
    ).toThrow(/resetAtFrame/);

    expect(consume(engine, 0, "pole-extra-attack")).toMatchObject({
      hitIndex: 0,
      sequenceMultiplier: 1
    });
    expect(consume(engine, 1, "pole-extra-attack")).toMatchObject({
      hitIndex: 1,
      sequenceMultiplier: 0
    });
    expect(() => consume(engine, 0, "pole-extra-attack")).toThrow(
      /non-decreasing/
    );
    expect(consume(engine, 2, "pole-extra-attack")).toMatchObject({
      hitIndex: 2,
      sequenceMultiplier: 0
    });
  });

  it("returns frozen audit decisions", () => {
    const decision = consume(
      new DirectDamageGroupEngine(),
      0,
      "default"
    );

    expect(Object.isFrozen(decision)).toBe(true);
  });
});
