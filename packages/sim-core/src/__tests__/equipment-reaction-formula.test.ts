import { expect, it } from "vitest";
import { calculateDocument, convertCalculatorToFinalPanel, getCalculatorHitSourceContract, parseCalculatorDocument, serializeCalculatorDocument } from "../calculator";
import { expr } from "../calculation-trace";
import { loadWorkedExample } from "../worked-examples";

it("executes sourced reaction AST steps, restores edited conditions, and blocks only matching unknown effects", () => {
  const doc = loadWorkedExample("fixture-a");
  if (doc.build.mode !== "equipment-derived") throw Error("Expected equipment fixture");
  const ordinary = structuredClone(doc.hits[0]!);
  doc.build.em = 0;
  doc.build.equipment = { characterId: "synthetic-character", weaponId: "synthetic-weapon", level: 90, ascension: 6,
    weaponLevel: 90, weaponAscension: 6, refinement: 1, sourceVersion: "synthetic-reaction-ast", sourceRefs: ["synthetic:reaction-ast"],
    derivedStats: [], secondaryContributions: [], assumptions: [], effectBlockers: [], bonusAccounting: "core-sourced-v1",
    reactionBonuses: [{ id: "synthetic-bloom-bonus", label: "合成绽放公式协议", value: 999, reactions: ["bloom", "hyperbloom", "burgeon"], sourceRefs: ["synthetic:reaction-ast"],
      formula: { expression: expr.mul(expr.input("baseBonus"), expr.add(expr.value(1), expr.mul(expr.input("perStack"), expr.input("stacks")))),
        inputs: [{ key: "baseBonus", value: .4, unit: "ratio", meaningKey: "来源基础反应奖励", origin: "source-coefficient" },
          { key: "perStack", value: .25, unit: "ratio", meaningKey: "每层对基础奖励的提升", origin: "source-coefficient" },
          { key: "stacks", value: 2, unit: "count", meaningKey: "明确生效层数", origin: "artifact-explicit-context", minimum: 0, maximum: 4, integer: true }],
        explanation: "基础奖励乘以一加每层提升乘有效层数；只用于声明的普通绽放类反应。" } }],
  };
  doc.hits = [{ id: ordinary.id, label: "普通绽放", kind: "transformative", reaction: "bloom", reactionBonus: 0, dependencies: [], sourceRefs: [] }];
  const initial = calculateDocument(doc), trace = initial.hits[0]!.trace;
  expect(trace.find(node => node.id === "equipmentReactionFormula.0.step0")?.result?.value).toBe(.5);
  expect(trace.find(node => node.id === "equipmentReactionFormula.0.step1")?.result?.value).toBe(1.5);
  expect(trace.find(node => node.id === "equipmentReactionFormula.0")?.result?.value).toBeCloseTo(.6, 12);
  expect(trace.find(node => node.id === "applicableReactionBonus")?.result?.value).toBeCloseTo(.6, 12);
  for (const node of trace.filter(node => node.id.startsWith("equipmentReactionFormula"))) {
    expect(node.symbolicFormula).toBeTruthy(); expect(node.substitution).toBeTruthy(); expect(node.explanationKey).toBeTruthy();
    expect(node.sourceRefs).toEqual(["synthetic:reaction-ast"]);
    expect(node.inputs.every(input => input.meaningKey && input.origin)).toBe(true);
  }
  const restored = parseCalculatorDocument(serializeCalculatorDocument(doc));
  if (restored.build.mode !== "equipment-derived") throw Error();
  const bonus = restored.build.equipment!.reactionBonuses![0]!;
  expect(bonus.value).toBeCloseTo(.6, 12); // Numeric compatibility field cannot override the AST.
  const contract = getCalculatorHitSourceContract(restored, ordinary.id);
  bonus.formula!.inputs.find(input => input.key === "stacks")!.value = 4;
  const edited = calculateDocument(restored);
  expect(edited.totals!.expected / initial.totals!.expected).toBeCloseTo(1.8 / 1.6, 12);
  expect(getCalculatorHitSourceContract(restored, ordinary.id)).toBe(contract);
  bonus.formula!.inputs.find(input => input.key === "baseBonus")!.value = .9;
  expect(getCalculatorHitSourceContract(restored, ordinary.id)).not.toBe(contract);

  restored.build.equipment!.reactionBonuses = [];
  restored.build.equipment!.pendingReactionEffects = [{ id: "synthetic-missing-stacks", label: "层数未知", reactions: ["bloom", "hyperbloom", "burgeon"],
    reason: "请明确0至4层，不能默认零层。", sourceRefs: ["synthetic:reaction-ast"] }];
  expect(calculateDocument(restored).status).toBe("blocked");
  expect(calculateDocument(restored).hits[0]!.trace[0]!.sourceRefs).toEqual(["synthetic:reaction-ast"]);
  const bloom = { ...structuredClone(restored.hits[0]!), id: "unselected-bloom" };
  restored.hits = [ordinary, bloom];
  expect(calculateDocument(restored).status).toBe("calculated");
  const finalPanel = convertCalculatorToFinalPanel(restored);
  finalPanel.selectedHitIds = [bloom.id];
  expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(finalPanel))).status).toBe("blocked");
});
