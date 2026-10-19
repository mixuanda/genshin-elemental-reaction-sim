import { expect, it } from "vitest";
import {
  assertSourceHostTargetPhases, sourceHostTargetPhaseAt, sourceHostTargetPhaseIdentity,
  sourceHostTargetPhaseRequestSchema, sourceHostTargetPhaseReceiptSchema,
} from "./source-host-target-phase";

const effects = { damage: "immune", aura: "blocked", hitConfirm: "normal" } as const;
const first = { id: "guard", label: "Guard", targetIndex: 0, startFrame: 10, endFrame: 20, reason: "observed source phase", effects };
const second = { id: "open", label: "Open", targetIndex: 0, startFrame: 20, endFrame: 30, reason: "observed source phase", effects: { damage: "normal", aura: "normal", hitConfirm: "blocked" } as const };

it("accepts half-open adjacent windows and an empty declared phase set", () => {
  expect(sourceHostTargetPhaseRequestSchema.parse({ policy: "declared-target-phases-v1", phases: [] }).phases).toEqual([]);
  expect(sourceHostTargetPhaseRequestSchema.parse({ policy: "declared-target-phases-v1", phases: [first, second] }).phases).toHaveLength(2);
  expect(() => sourceHostTargetPhaseRequestSchema.parse({ policy: "declared-target-phases-v1",
    phases: [first, { ...second, startFrame: 19 }] })).toThrow(/重叠/);
  expect(() => sourceHostTargetPhaseRequestSchema.parse({ policy: "declared-target-phases-v1",
    phases: [first, { ...second, id: first.id }] })).toThrow(/唯一/);
});

it("normalizes declaration order but verifies actual target-key mapping", () => {
  const request = { policy: "declared-target-phases-v1", phases: [first, second] };
  const receipt = sourceHostTargetPhaseReceiptSchema.parse({ policy: "declared-target-phases-v1",
    phases: [{ ...second, targetKey: 7 }, { ...first, targetKey: 7 }] });
  expect(() => assertSourceHostTargetPhases(request, receipt, { targets: [{ declarationIndex: 0, targetKey: 7 }] })).not.toThrow();
  expect(sourceHostTargetPhaseIdentity(request)).toBe(sourceHostTargetPhaseIdentity(receipt));
  expect(() => assertSourceHostTargetPhases(request, receipt, { targets: [{ declarationIndex: 0, targetKey: 8 }] })).toThrow(/目标键/);
});

it("matches only the recorded target and native frame within the half-open window", () => {
  const receipt = sourceHostTargetPhaseReceiptSchema.parse({ policy: "declared-target-phases-v1",
    phases: [{ ...first, targetKey: 7 }] });
  expect(sourceHostTargetPhaseAt(receipt, 7, 10)?.id).toBe("guard");
  expect(sourceHostTargetPhaseAt(receipt, 7, 20)).toBeUndefined();
  expect(sourceHostTargetPhaseAt(receipt, 8, 15)).toBeUndefined();
});
