import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSourceHostResult } from "./source-host-capture";
import { resolveSourceHostRequest } from "./source-host-formula";
import { verifySourceHostArtifactSupport } from "./source-host-artifact-support";
import { executeSourceHostScalarProvenance } from "./source-host-scalar-provenance";
import { executeSourceHostStatProvenance } from "./source-host-stat-provenance";
import type { SourceHostResult } from "./source-host-wire";

const classic = JSON.parse(readFileSync(new URL("../../../docs/validation/action-opportunities-classic-xingqiu-20260929.capture.json", import.meta.url), "utf8")) as SourceHostResult;
const stellar = JSON.parse(readFileSync(new URL("../../../docs/validation/action-opportunities-stellar-xingqiu-20260929.capture.json", import.meta.url), "utf8")) as SourceHostResult;
const captures = [classic, stellar];
const lifecycleGap = "触发资格、目标选择、排队和状态生命周期沿用固定版本的原生执行；数值公式回放不等于独立核验全部游戏机制。";
const classicSource = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/";

describe("source-host shared formula links", () => {
  it("replays both archived Xingqiu runs and links the A4 read to its actual formula call", () => {
    const measurements: Array<Record<string, unknown>> = [];
    for (const [lane, capture] of captures.entries()) {
      const replayed = createSourceHostResult(capture);
      expect(replayed.calculations.map(row => row.value)).toEqual(capture.calculations.map(row => row.value));
      expect(replayed.explanationGaps).toContain(lifecycleGap);
      expect(replayed.explanationGaps.some(gap => gap.includes("闭包内部转换、跨角色读取"))).toBe(false);

      const records = new Map(capture.calculations.map(row => [row.request.id, row]));
      const damage = capture.calculations.find(row => row.request.kind === "damage" && row.request.id === 10)!;
      const read = damage.request.snapshot!.statProvenance!.snapshotRead!;
      expect(read.id).toBe("actor-0-read-94");
      expect(read.steps[0]!.formulaCalculationIds).toEqual([9]);
      const links = verifySourceHostArtifactSupport(damage.request, records);
      const resolved = resolveSourceHostRequest(damage.request, records);
      const statTrace = resolved.trace.find(node => node.id === `sourceStats.10.${read.id}.modifier.0.add.13.13`);
      expect(statTrace).toBeDefined();
      const formulaReference = links.get(`${read.id}/0/13`)!;
      const delta = statTrace!.inputs.find(input => input.key === "delta")!;
      expect(delta.origin).toMatchObject({ reference: formulaReference });
      expect(statTrace!.childIds).toContain(formulaReference);
      const nodes = new Map(resolved.trace.map(node => [node.id, node]));
      for (const node of resolved.trace) for (const childId of node.childIds) expect(nodes.has(childId), `${node.id} -> ${childId}`).toBe(true);
      const origin = (nodeId: string, key: string) => nodes.get(nodeId)?.inputs.find(input => input.key === key)?.origin;
      expect(origin("damageBonusMultiplier", "damageBonus")).toMatchObject({ reference: "sourceNativeDamageBonus" });
      expect(nodes.get("sourceNativeDamageBonus")?.result?.value).toBe(0.2);
      expect(origin("sourceCritOutcome", "critRate")).toMatchObject({ reference: "sourceNativeCritRate" });
      expect(origin("critDamage", "critDamage")).toMatchObject({ kind: "source-host-stat-provenance" });
      expect(origin("sourceTalentBase", "scalingValue")).toMatchObject({ reference: "sourceScalingStat" });
      expect(origin("talentDamage", "scalingValue")).toMatchObject({ reference: "sourceTalentBase" });
      const edited = resolveSourceHostRequest(damage.request, records, { explicitFinalScaling: true });
      expect(edited.trace.find(node => node.id === "damageBonusMultiplier")?.inputs.find(input => input.key === "damageBonus")?.origin)
        .not.toMatchObject({ reference: "sourceNativeDamageBonus" });
      expect(edited.value).toBe(resolved.value);
      measurements.push({ lane: lane === 0 ? "classic" : "stellar", calculations: capture.calculations.length,
        applications: capture.applications.length, allCalculationValuesExact: true, selectedCalculation: damage.request.id,
        originalValue: damage.value, reproducedValue: resolved.value, difference: resolved.value - damage.value,
        linkedDeltaNode: statTrace!.id, formulaReference, allSelectedChildLinksPresent: true,
        sourceCritRate: nodes.get("sourceNativeCritRate")?.result?.value,
        sourceDamageBonus: nodes.get("sourceNativeDamageBonus")?.result?.value,
        selectedTraceNodes: resolved.trace.length, selectedExplanationGaps: resolved.explanationGaps,
        aggregateExplanationGaps: replayed.explanationGaps, editedHistoricalStatLinksDetached: true });
    }
    writeFileSync(new URL("../../../docs/validation/formula-links-replay-20260929.result.json", import.meta.url),
      JSON.stringify({ schemaVersion: "source-formula-links-replay-v1", input: "archived action-opportunities captures; no new native simulation", measurements }, null, 2) + "\n");
  });

  it("keeps missing-slot and opaque-boundary evidence local to the affected stat read", () => {
    const damage = classic.calculations.find(row => row.request.kind === "damage" && row.request.id === 10)!;
    const receipt = structuredClone(damage.request.snapshot!.statProvenance!);
    const read = receipt.snapshotRead!;
    const records = new Map(classic.calculations.map(row => [row.request.id, row]));
    const noLinks = executeSourceHostStatProvenance(receipt, undefined, "slot", false, classicSource, new Map());
    expect(noLinks.explanationGaps.some(gap => gap.includes("actor-0-read-94/0/xingqiu-a4/") && gap.includes("[13]") && gap.includes("缺少已验证公式节点链接"))).toBe(true);
    expect(read.steps[0]!.formulaCalculationIds).toEqual([9]);

    const callerVerified = verifySourceHostArtifactSupport(damage.request, records);
    const linked = executeSourceHostStatProvenance(receipt, undefined, "slot", false, classicSource, callerVerified);
    expect(linked.explanationGaps.some(gap => gap.includes("actor-0-read-94/0/xingqiu-a4/") && gap.includes("[13]") && gap.includes("缺少已验证公式节点链接"))).toBe(false);

    const changedBoundary = structuredClone(receipt);
    changedBoundary.finalStats[0]! += 1;
    const opaque = executeSourceHostStatProvenance(changedBoundary, undefined, "boundary", false, classicSource, callerVerified);
    expect(opaque.explanationGaps.some(gap => gap.includes("实际导出快照") && gap.includes("不代表已验证的独立机制表达式"))).toBe(true);
  });

  it("requires a caller-verified link for a nonzero opaque scalar return even when its ID is present", () => {
    const receipt = { version: "scalar-provenance-v1", reads: [{
      id: "scalar-read-1", kind: "reaction-bonus", frame: 10, actorIndex: 0, element: "hydro",
      base: 0, sum: 0.2, output: 0.2, transforms: [], steps: [{
        index: 0, key: "opaque-reaction", expiryBefore: 50, expiryAfter: 50, affectedByHitlag: false,
        element: "", closureOpaque: true, outcome: "applied", before: 0, delta: 0.2, after: 0.2,
        dependencies: [], formulaCalculationIds: [77],
      }],
    }] };
    const missing = executeSourceHostScalarProvenance(receipt, { "reaction-bonus": 0.2 });
    expect(missing.explanationGaps.some(gap => gap.includes("scalar-read-1/0/opaque-reaction/scalar") && gap.includes("缺少已验证公式节点链接"))).toBe(true);
    const linked = executeSourceHostScalarProvenance(receipt, { "reaction-bonus": 0.2 }, "sourceScalar", classicSource,
      new Map([["scalar-read-1/0/scalar", "characterModifier.77.verified"]]));
    expect(linked.explanationGaps.some(gap => gap.includes("scalar-read-1/0/opaque-reaction/scalar") && gap.includes("缺少已验证公式节点链接"))).toBe(false);
    const ref = "characterModifier.77.verified";
    const contribution = linked.trace.find(node => node.id === "sourceScalar.scalar-read-1.modifier.0")!;
    expect(contribution.inputs.find(input => input.key === "delta")?.origin).toMatchObject({ reference: ref });
    expect(contribution.childIds).toContain(ref);
  });
});
