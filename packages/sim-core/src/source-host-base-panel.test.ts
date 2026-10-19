import { describe, expect, it } from "vitest";
import { executeSourceHostBasePanel, type SourceHostBasePanel } from "./source-host-base-panel";
import { executeSourceHostNestedStatRead, type SourceHostStatReadReceipt } from "./source-host-stat-provenance";

const source = "https://example.invalid/pinned-source/";
const vector = (values: Record<number, number> = {}) => Array.from({ length: 26 }, (_, i) => values[i] ?? 0);
// Synthetic recipe isolates source set/add semantics; these are not game data.
function fixture(): SourceHostBasePanel {
  return {
    version: "base-panel-v1", actorIndex: 0, characterKey: "fixture", characterLevel: 2, characterMaxLevel: 20,
    weaponKey: "fixture", weaponLevel: 2, weaponMaxLevel: 20, weaponRefinement: 1,
    inputOrigin: "configured-stats", configuredStats: vector({ 5: 200 }), configuredLabels: { equipment: vector({ 5: 200 }) },
    characterSteps: [
      { statIndex: 24, kind: "growth", operation: "set", base: 100, curveKey: "fixture-character", curveIndex: 1, curveMultiplier: 2, value: 200 },
      { statIndex: 24, kind: "promotion", operation: "add", promotionIndex: 0, promotionMaxLevel: 20, value: 20 },
    ],
    weaponSteps: [
      { statIndex: 24, kind: "growth", operation: "set", base: 20, curveKey: "fixture-weapon", curveIndex: 1, curveMultiplier: 3, value: 60 },
      { statIndex: 24, kind: "growth", operation: "set", base: 40, curveKey: "fixture-weapon", curveIndex: 1, curveMultiplier: 2, value: 80 },
      { statIndex: 24, kind: "promotion", operation: "add", promotionIndex: 0, promotionMaxLevel: 20, value: 10 },
    ],
    characterStats: vector({ 24: 220 }), weaponStats: vector({ 24: 90 }), result: vector({ 24: 310, 5: 200 }),
  };
}

describe("source base-panel recipe", () => {
  it("executes growth and promotion in source order, preserving weapon replacement and explaining the final sum", () => {
    const panel = fixture();
    const result = executeSourceHostBasePanel(panel, "example.basePanel", source);
    expect(result.finalStats).toEqual(panel.result);
    const growth = result.trace.find(node => node.id === "example.basePanel.weapon.step.1.value")!;
    expect(growth.result?.value).toBe(80);
    expect(growth.inputs.map(input => input.meaningKey)).toEqual(["武器目录行中的原始基础值", "实际曲线 fixture-weapon 在索引 1 的乘数"]);
    expect(growth.symbolicFormula).toContain("catalogBase");
    expect(growth.substitution).toContain("40");
    expect(result.trace.find(node => node.id === result.finalNodeIds[24])?.result?.value).toBe(310);
    panel.weaponSteps[1]!.operation = "add";
    expect(() => executeSourceHostBasePanel(panel, "altered", source)).toThrow(/weapon\[24\]/);
  });

  it("connects only actual selected getter slots to the recipe and retains the legacy missing-recipe boundary", () => {
    const read: SourceHostStatReadReceipt = {
      id: "selected", kind: "select-stat", frame: 1, actorIndex: 0, selector: [24], nonExtra: false,
      base: vector({ 24: 310 }), result: vector({ 24: 310 }), steps: [], basePanel: fixture(),
    };
    const result = executeSourceHostNestedStatRead(JSON.parse(JSON.stringify(read)), "read", source);
    expect(result.finalStats).toEqual(read.result);
    expect(result.trace.find(node => node.id === "read.selected.base.24")?.childIds).toEqual(["read.basePanel.0.result.24"]);
    expect(result.trace.find(node => node.id === "read.selected.base.5")?.childIds).toEqual([]);
    expect(result.explanationGaps.some(gap => gap.includes("未保存初始基础面板"))).toBe(false);
    delete read.basePanel;
    expect(executeSourceHostNestedStatRead(read, "legacy", source).explanationGaps.some(gap => gap.includes("未保存初始基础面板"))).toBe(true);
  });
});
