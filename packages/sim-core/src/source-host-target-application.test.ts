import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveSourceHostTargetApplication } from "./source-host-target-application";
import { sourceHostTargetPhaseMatchSchema } from "./source-host-target-phase";
import { captureSourceHostHit, calculateSourceHostEditableCalculation, createSourceHostEditableCalculation, replaySourceHostHit } from "./source-host-capture";
import type { SourceHostResult, SourceHostTargetApplicationRequest } from "./source-host-wire";

function phase(damage: "normal" | "immune", aura: "normal" | "blocked" = "normal", hitConfirm: "normal" | "blocked" = "normal") {
  return sourceHostTargetPhaseMatchSchema.parse({
    policy: "declared-target-phases-v1", id: "declared-window", label: "用户声明阶段",
    targetIndex: 0, targetKey: 9, startFrame: 10, endFrame: 20, frame: 10,
    reason: "测试用用户声明", effects: { damage, aura, hitConfirm },
  });
}

it("executes an immune hit as zero while retaining all three declared phase axes", () => {
  const result = resolveSourceHostTargetApplication({ rawCalculationId: 2, rawDamage: 120, hpBefore: 30, damageMode: true },
    phase("immune", "blocked", "blocked"));
  expect(result.value).toBe(0);
  expect(result.hpLoss).toBe(0);
  expect(result.trace.map(node => node.id)).toEqual([
    "targetPhase.damageAllowed", "targetPhase.aura", "targetPhase.hitConfirm",
    "targetApplication.hpLoss", "targetApplication.appliedDamage",
  ]);
  expect(result.trace.at(-1)?.result?.value).toBe(0);
  expect(result.explanationGaps[0]).toContain("用户声明");
});

it("caps a normal kill-mode application at remaining HP and preserves fixed-duration raw accounting", () => {
  const declared = phase("normal");
  const killMode = resolveSourceHostTargetApplication({ rawCalculationId: 2, rawDamage: 120, hpBefore: 30, damageMode: true }, declared);
  const durationMode = resolveSourceHostTargetApplication({ rawCalculationId: 2, rawDamage: 120, hpBefore: 30, damageMode: false }, declared);
  expect(killMode).toMatchObject({ value: 30, hpLoss: 30 });
  expect(durationMode).toMatchObject({ value: 120, hpLoss: 30 });
});

it("captures and replays a declared immune application, then reapplies it to an edited raw hit", () => {
  const archived = JSON.parse(readFileSync(new URL("../../../docs/validation/action-opportunities-classic-xingqiu-20260929.capture.json", import.meta.url), "utf8")) as SourceHostResult;
  const result = structuredClone(archived);
  const application = result.applications.find(row => row.rawDamage > 0)!;
  const raw = result.calculations.find(row => row.request.id === application.calculationId)!;
  const match = phase("immune", "blocked", "blocked");
  const receipt = { policy: "declared-target-phases-v1" as const, phases: [{
    id: "declared-window", label: "用户声明阶段", targetIndex: 0, targetKey: application.targetKey,
    startFrame: application.frame, endFrame: application.frame + 1, reason: "测试用户声明", effects: match.effects,
  }] };
  const matched = sourceHostTargetPhaseMatchSchema.parse({ ...receipt.phases[0], policy: receipt.policy, frame: application.frame });
  const id = Math.max(...result.calculations.map(row => row.request.id)) + 1;
  const request: SourceHostTargetApplicationRequest = { ...structuredClone(raw.request), id, kind: "target-application", damageCategory: "target-application",
    componentIds: [], componentApplications: [], rawCalculationId: raw.request.id, phase: matched,
    input: { rawDamage: application.rawDamage, hpBefore: application.hpBefore, damageMode: application.damageMode },
    snapshot: null, snapshotStats: null };
  const formula = resolveSourceHostTargetApplication({ rawCalculationId: raw.request.id, ...request.input }, matched);
  result.calculations.push({ request, value: formula.value });
  application.applicationCalculationId = id;
  application.targetPhase = matched;
  application.appliedDamage = formula.value;
  application.hpAfter = application.hpBefore;
  result.targetPhases = receipt;
  result.targetScene = { damageMode: false, primaryTargetIndex: 0, initialDefaultTargetKey: application.targetKey,
    targets: [{ declarationIndex: 0, targetKey: application.targetKey, profile: {},
      position: { x: 0, y: 0, radius: 0 }, initialHP: 1, initialMaxHP: 1 }] };

  const capture = captureSourceHostHit(result, application.id);
  const replay = replaySourceHostHit(JSON.parse(JSON.stringify(capture)));
  expect(replay).toMatchObject({ originalDamage: 0, reproducedDamage: 0, applicationDifference: 0, reproducedApplicationDamage: 0 });
  expect(replay.applicationTrace?.some(node => node.id === "targetApplication.appliedDamage")).toBe(true);

  const editable = createSourceHostEditableCalculation(capture);
  editable.request.input.flatDamage += 25;
  const edited = calculateSourceHostEditableCalculation(editable);
  expect(edited.value).toBeGreaterThan(edited.originalDamage);
  expect(edited.applicationValue).toBe(0);
  expect(edited.applicationTrace?.find(node => node.id === "targetApplication.appliedDamage")?.result?.value).toBe(0);
});
