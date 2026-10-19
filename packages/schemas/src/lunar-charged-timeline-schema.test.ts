import { describe, expect, expectTypeOf, it } from "vitest";
import type { RefinementCtx } from "zod";
import { makeConfig } from "../../sim-core/src/__tests__/fixtures";
import { targetStateTimelineCauseSchema, targetStateTimelineCauseV152Schema, targetStateTimelinePointSchema, targetStateTimelineSchema, targetStateTimelineV152Schema } from "./schema";
import { simulationResultV142ValueSchema, simulationResultV151ValueSchema, simulationResultV152ValueSchema, simulationResultV153ValueSchema, targetStateTimelineV150Schema } from "./result-schema";
import { validateLunarChargedConsumptionIntegrity } from "./result-integrity";
import type { AuraStateEntry, SimulationResult, TargetStateTimeline, TargetStateTimelineCauseV150, TargetStateTimelineCauseV152, TargetStateTimelinePoint } from "./types";

function point(): TargetStateTimelinePoint {
  return {
    id: 1, frame: 0, timeSeconds: 0, targetId: "enemy-0", targetName: "Enemy",
    pointKind: "mutation", cause: "lunar-charged-consumption", eventType: "hit",
    eventPriority: -1, eventSequence: 0, intraEventSequence: 0,
    reaction: "none", reactions: [], primaryDamageEventId: null, links: [], auraApplied: [],
    auraBefore: [
      { element: "hydro", gaugeUnits: 1, expiresAtFrame: 100, sourceSlots: [{ sourceActorId: "a", gaugeUnits: 1 }, { sourceActorId: "b", gaugeUnits: 0.2 }] },
      { element: "electro", gaugeUnits: 0.5, expiresAtFrame: 50, sourceSlots: [{ sourceActorId: "b", gaugeUnits: 0.5 }] }
    ],
    auraConsumed: [
      { element: "hydro", gaugeUnits: 0.4, sourceMutations: [{ sourceActorId: "a", gaugeUnitsBefore: 1, consumedGaugeUnits: 0.4, gaugeUnitsAfter: 0.6 }, { sourceActorId: "b", gaugeUnitsBefore: 0.2, consumedGaugeUnits: 0.2, gaugeUnitsAfter: 0 }] },
      { element: "electro", gaugeUnits: 0.4, sourceMutations: [{ sourceActorId: "b", gaugeUnitsBefore: 0.5, consumedGaugeUnits: 0.4, gaugeUnitsAfter: 0.1 }] }
    ],
    auraAfter: [
      { element: "hydro", gaugeUnits: 0.6, expiresAtFrame: 60, sourceSlots: [{ sourceActorId: "a", gaugeUnits: 0.6 }] },
      { element: "electro", gaugeUnits: 0.1, expiresAtFrame: 10, sourceSlots: [{ sourceActorId: "b", gaugeUnits: 0.1 }] }
    ]
  };
}

function timeline(): TargetStateTimeline {
  const mutation = point();
  const boundary = (id: number, cause: "simulation-start" | "simulation-end", aura: AuraStateEntry[]): TargetStateTimelinePoint => ({
    ...mutation, id, cause, pointKind: "boundary", eventType: null, eventPriority: null,
    eventSequence: null, intraEventSequence: null, auraBefore: structuredClone(aura), auraAfter: structuredClone(aura), auraConsumed: []
  });
  return { version: "1.0.0", points: [boundary(0, "simulation-start", mutation.auraBefore), mutation, boundary(2, "simulation-end", mutation.auraAfter)] };
}

type LunarHost = Pick<SimulationResult, "schemaVersion" | "resolvedRuntimeOptions" | "config" | "targetStateTimeline">;
function host(): LunarHost {
  const config = makeConfig();
  const result: LunarHost = { schemaVersion: config.schemaVersion, config, targetStateTimeline: timeline(), resolvedRuntimeOptions: { energyMode: "configured", critMode: "average", compatibilityMode: "legacy-v0.1", randomSeed: "test-seed" } };
  result.config.characters.push({ ...result.config.characters[0]!, id: "b", name: "B", element: "electro" });
  result.targetStateTimeline = timeline();
  result.resolvedRuntimeOptions.execution = { lunarCharged: { profileId: "lunar-charged-reference-v1", party: [{ actorId: "a", characterKey: "furina" }, { actorId: "b", characterKey: "ineffa" }] } };
  return result;
}

function issues(result: LunarHost): string[] {
  const messages: string[] = [];
  const context = { addIssue: (issue: { message?: string }) => { messages.push(issue.message ?? "invalid"); } } as unknown as RefinementCtx;
  validateLunarChargedConsumptionIntegrity(result, context);
  return messages;
}

describe("current-only Lunar-Charged Aura mutation timeline", () => {
  it("admits a complete personal-slot mutation while frozen vocabularies reject the new cause", () => {
    expect(targetStateTimelineCauseSchema.safeParse("lunar-charged-consumption").success).toBe(true);
    expect(targetStateTimelineCauseV152Schema.safeParse("lunar-charged-consumption").success).toBe(false);
    expectTypeOf<"lunar-charged-consumption" extends TargetStateTimelineCauseV150 ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<"lunar-charged-consumption" extends TargetStateTimelineCauseV152 ? true : false>().toEqualTypeOf<false>();
    expect(targetStateTimelinePointSchema.safeParse(point()).success).toBe(true);
    expect(targetStateTimelineSchema.safeParse(timeline()).success).toBe(true);
    expect(simulationResultV153ValueSchema.shape.targetStateTimeline.safeParse(timeline()).success).toBe(true);
  });

  it("keeps the mutation out of every frozen result timeline", () => {
    for (const schema of [targetStateTimelineV150Schema, targetStateTimelineV152Schema,
      simulationResultV142ValueSchema.shape.targetStateTimeline,
      simulationResultV151ValueSchema.shape.targetStateTimeline,
      simulationResultV152ValueSchema.shape.targetStateTimeline]) {
      expect(schema.safeParse(timeline()).success).toBe(false);
    }
  });

  it("requires explicit opt-in and known party ownership", () => {
    expect(issues(host())).toEqual([]);
    const absent = host();
    delete absent.resolvedRuntimeOptions.execution;
    expect(issues(absent).join(" ")).toContain("explicit lunar-charged-reference-v1");
    const unknown = host();
    unknown.resolvedRuntimeOptions.execution!.lunarCharged!.party.pop();
    expect(issues(unknown).join(" ")).toContain("explicit configured party");
  });

  it("preserves exact consumption amounts and Aura decay deadlines", () => {
    const wrongAmount = point();
    wrongAmount.auraConsumed[0]!.gaugeUnits = 0.3;
    expect(targetStateTimelinePointSchema.safeParse(wrongAmount).success).toBe(false);
    const wrongSlots = point();
    wrongSlots.auraConsumed[0]!.sourceMutations!.pop();
    expect(targetStateTimelinePointSchema.safeParse(wrongSlots).success).toBe(false);
    const wrongDeadline = host();
    wrongDeadline.targetStateTimeline.points[1]!.auraAfter[0]!.expiresAtFrame = 90;
    expect(issues(wrongDeadline).join(" ")).toContain("deadline");
  });

  it("does not bypass same-frame timeline continuity", () => {
    const broken = timeline();
    broken.points[2]!.auraBefore = structuredClone(broken.points[0]!.auraBefore);
    broken.points[2]!.auraAfter = structuredClone(broken.points[0]!.auraAfter);
    expect(targetStateTimelineSchema.safeParse(broken).success).toBe(false);
  });

  it("reserves negative pre-event priority narrowly for Lunar-Charged consumption", () => {
    const invalidPriority = point();
    invalidPriority.eventPriority = -2;
    expect(targetStateTimelinePointSchema.safeParse(invalidPriority).success).toBe(false);
    const classic = point();
    classic.cause = "direct-hit-application";
    expect(targetStateTimelinePointSchema.safeParse(classic).success).toBe(false);
  });

  it("rejects ordinary reaction/damage links and unrelated Aura mutation", () => {
    const linked = point();
    linked.links = [{ kind: "damage-event", id: 0 }];
    linked.primaryDamageEventId = 0;
    expect(targetStateTimelinePointSchema.safeParse(linked).success).toBe(false);
    const ordinary = point();
    ordinary.reaction = "electroCharged";
    ordinary.reactions = ["electroCharged"];
    expect(targetStateTimelinePointSchema.safeParse(ordinary).success).toBe(false);
    const unrelated = point();
    unrelated.auraAfter.push({ element: "cryo", gaugeUnits: 1, expiresAtFrame: 100 });
    expect(targetStateTimelinePointSchema.safeParse(unrelated).success).toBe(false);
  });
});
