import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  calculateSourceHostEditableCalculation, captureSourceHostHit, deriveSourceHostArtifactScalarEdit, replaySourceHostHit,
  type SourceHostHitCapture,
} from "../../../packages/sim-core/src/source-host-capture";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT,
  type SourceHostCalculationRecord, type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";

// One four-member source rotation covers different native attack tags and elements.
// The four-piece effects remain in the Go runtime: Fischl's Oz can deal skill
// damage after she swaps out; Collei's skill hit precedes her physical normals;
// Barbara uses her skill before Hydro normals; Guoba supplies later Pyro hits.
const config = `# Explicit hypothetical builds; each set is executed by the pinned source.
options iteration=1 duration=24;
fischl char lvl=90/90 cons=0 talent=1,1,1;
fischl add weapon="favoniuswarbow" refine=1 lvl=90/90;
fischl add set="goldentroupe" count=4;
fischl add stats atk=200 em=100 cr=0.2 cd=0.4;
collei char lvl=90/90 cons=0 talent=1,1,1;
collei add weapon="favoniuswarbow" refine=1 lvl=90/90;
collei add set="paleflame" count=4;
collei add stats atk=200 em=100 cr=0.2 cd=0.4;
barbara char lvl=90/90 cons=0 talent=1,1,1;
barbara add weapon="magicguide" refine=1 lvl=90/90;
barbara add set="heartofdepth" count=4;
barbara add stats atk=200 em=100 cr=0.2 cd=0.4;
xiangling char lvl=90/90 cons=0 talent=1,1,1;
xiangling add weapon="favoniuslance" refine=1 lvl=90/90;
xiangling add set="crimsonwitchofflames" count=4;
xiangling add stats atk=200 em=100 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active fischl;
fischl skill;
collei skill;
collei attack:2;
barbara skill;
barbara attack:3;
xiangling skill;
barbara attack:3;
wait(600);`;

type ArtifactRecord = SourceHostCalculationRecord & {
  request: Extract<SourceHostCalculationRecord["request"], { kind: "artifact-scalar" }>;
};
type ArtifactCapture = SourceHostHitCapture & { supportingCalculations?: SourceHostCalculationRecord[] };

test("source artifact callbacks feed selected hits, their independent AST, and a zero-delta imported capture", async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const evidence: Array<{
    variant: "classic" | "stellar";
    result: SourceHostResult;
    observedRuleIds: string[];
    appliedAttackTagValues: number[];
    appliedAttackTags: string[];
    appliedElements: string[];
    actualArtifactCalls: Array<{ id: number; ruleId: string; value: number }>;
    selectedHitIndex: number;
    selectedApplicationId: number;
    selectedSupportIds: number[];
    selectedAst: Array<{ id: string; ruleId: string; sourceRefs: string[] }>;
    artifactExperiment: {
      calculationId: number; originalTier: 1 | 2; editedTier: 1 | 2;
      originalValue: number; editedValue: number; status: "calculated" | "blocked";
      originalRawDamage: number; editedRawDamage?: number; reason?: string;
      formulaTrace: Array<{ id: string; sourceRefs: string[] }>;
      uiResultText: string;
    };
    calculator: unknown;
    calculatorDifference: number;
  }> = [];

  for (const variant of ["classic", "stellar"] as const) {
    await page.goto("/source-simulation");
    await page.locator("#source-host-variant").selectOption(variant);
    await page.locator("#source-host-config").fill(config);
    await page.locator("#source-host-seed").fill("20260928");
    await page.locator("#source-host-run").click();
    await expect(page.locator("#source-host-status")).toContainText(/本次运行完成|运行停止|执行器错误/, { timeout: 90000 });
    await expect(page.locator("#source-host-status")).toContainText("本次运行完成");

    const resultDownload = page.waitForEvent("download");
    await page.locator("#source-host-export").click();
    const resultText = await readFile((await (await resultDownload).path())!, "utf8");
    // Preserve each actual native run before any diagnostic assertion can stop
    // this spec; selector/assertion edits must not require another Go run.
    await writeFile(resolve(`docs/validation/source-host-artifact-formulas-20260928.${variant}.intermediate.json`), resultText);
    const result = JSON.parse(resultText) as SourceHostResult;
    expect(result.sourceCommit).toBe(variant === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT);
    expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
    const byCalculationId = new Map(result.calculations.map(row => [row.request.id, row]));
    const applied = result.applications.map(row => byCalculationId.get(row.calculationId)!.request);
    const appliedAttackTagValues = [...new Set(applied.map(row => row.attackTag))];
    const appliedAttackTags = [...new Set(applied.map(row => row.attackTagName))];
    const appliedElements = [...new Set(applied.map(row => row.element))];
    // Both pinned attack.go enums start with None=0, Normal=1, Extra=2,
    // Plunge=3, ElementalArt=4; the a7 bridge displays most names as AttackTag(n).
    expect(appliedAttackTagValues).toEqual(expect.arrayContaining([1, 4]));
    expect(appliedElements).toEqual(expect.arrayContaining(["physical", "hydro", "pyro"]));
    const artifactCalls = result.calculations.filter(
      (row): row is ArtifactRecord => row.request.kind === "artifact-scalar",
    );
    const observedRuleIds = [...new Set(artifactCalls.map(row => row.request.input.ruleId))];
    expect(observedRuleIds).toEqual(expect.arrayContaining([
      "gt-2pc", "gt-4pc", "hod-2pc", "hod-4pc", "pf-2pc", "pf-4pc-atk", "cw-2pc", "cw-4pc-pyro",
    ]));
    expect(artifactCalls.filter(row => row.request.input.ruleId === "gt-4pc").map(row => row.value)).toEqual(
      expect.arrayContaining([0.25, 0.5]),
    );

    // A scalar request by itself is not a damage hit. Select an actual applied
    // hit whose snapshot/modifier receipt cites its upstream scalar response.
    const captures = result.applications.map(row => captureSourceHostHit(result, row.id) as ArtifactCapture);
    const selectedHitIndex = captures.findIndex(capture => capture.supportingCalculations?.some(
      row => row.request.kind === "artifact-scalar" && row.request.input.ruleId === "gt-4pc",
    ));
    expect(selectedHitIndex, `no applied ${variant} hit consumed Golden Troupe four-piece scalar`).toBeGreaterThanOrEqual(0);
    const selectedCapture = captures[selectedHitIndex]!;
    const support = selectedCapture.supportingCalculations!.filter(
      (row): row is ArtifactRecord => row.request.kind === "artifact-scalar",
    );
    expect(support.length).toBeGreaterThan(0);
    const golden = support.find(row => row.request.input.ruleId === "gt-4pc");
    expect(golden).toBeDefined();
    if (!golden || golden.request.input.ruleId !== "gt-4pc") throw new Error("Selected hit lacks the native Golden Troupe tier");
    const originalTier = golden.request.input.tier;
    const editedTier: 1 | 2 = originalTier === 1 ? 2 : 1;
    const editedInput = { ruleId: "gt-4pc" as const, tier: editedTier };
    const experiment = deriveSourceHostArtifactScalarEdit(selectedCapture, golden.request.id, editedInput);
    expect(experiment.editedValue).not.toBe(experiment.originalValue);
    const experimentEvidence = {
      calculationId: golden.request.id, originalTier, editedTier,
      originalValue: experiment.originalValue, editedValue: experiment.editedValue,
      status: experiment.status, originalRawDamage: experiment.originalRawDamage,
      ...(experiment.status === "calculated" ? { editedRawDamage: experiment.editedRawDamage } : { reason: experiment.reason }),
      formulaTrace: experiment.formulaTrace.map(node => ({ id: node.id, sourceRefs: node.sourceRefs })),
    };
    const replay = replaySourceHostHit(selectedCapture);
    expect(replay.difference).toBe(0);
    const selectedAst = support.map(row => {
      const id = `artifactScalar.${row.request.id}.${row.request.input.ruleId}`;
      const node = replay.trace.find(candidate => candidate.id === id);
      expect(node, `${variant} hit omitted upstream AST node ${id}`).toBeDefined();
      expect(node!.sourceRefs.length, `${id} has no pinned formula source`).toBeGreaterThan(0);
      return { id, ruleId: row.request.input.ruleId, sourceRefs: node!.sourceRefs };
    });

    await page.locator("#source-host-import").setInputFiles({
      name: `source-host-${variant}-artifact-result.json`, mimeType: "application/json", buffer: Buffer.from(resultText),
    });
    await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
    await page.locator("#source-host-hit-index").fill(String(selectedHitIndex));
    await expect(page.locator("#source-host-hit")).toContainText("差值 0");
    await page.locator("#source-host-open-calculator").click();
    await expect(page).toHaveURL(/\/calculator$/);
    await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
    for (const node of selectedAst) await expect(page.locator(`[data-trace-node="${node.id}"]`).first()).toBeVisible();
    await expect(page.locator("[data-source-host-artifact-support]")).toBeVisible();
    const goldenCard = page.locator(`[data-source-host-artifact-id="${golden.request.id}"]`);
    const tierControl = goldenCard.locator('[data-source-host-artifact-state="tier"]');
    await expect(tierControl).toHaveValue(String(originalTier));
    await tierControl.selectOption(String(editedTier));
    const experimentResult = goldenCard.locator("[data-source-host-artifact-result]");
    await expect(experimentResult).toContainText(`实验值 ${experiment.editedValue}`);
    if (experiment.status === "calculated") {
      await expect(experimentResult).toContainText(`公式伤害 ${experiment.editedRawDamage}`);
    } else {
      await expect(experimentResult).toContainText(experiment.reason);
    }
    const uiResultText = (await experimentResult.textContent()) ?? "";
    await expect(page.locator("[data-source-host-calculation-result]")).toContainText("相对原公式差值：0");

    const calculatorDownload = page.waitForEvent("download");
    await page.locator("[data-source-host-export]").click();
    const calculatorText = await readFile((await (await calculatorDownload).path())!, "utf8");
    const calculator = JSON.parse(calculatorText) as {
      originalCapture: ArtifactCapture;
      artifactExperiments?: Array<{ calculationId: number; input: { ruleId: string; tier?: number } }>;
    };
    expect(calculator.originalCapture.application.id).toBe(selectedCapture.application.id);
    expect(calculator.originalCapture.supportingCalculations?.map(row => row.request.id)).toEqual(
      selectedCapture.supportingCalculations?.map(row => row.request.id),
    );
    expect(calculator.artifactExperiments).toEqual([{ calculationId: golden.request.id, input: editedInput }]);
    const calculatorDifference = calculateSourceHostEditableCalculation(calculator).difference;
    expect(calculatorDifference).toBe(0);
    await page.locator("#calc-source-host-close").click();
    await page.locator("#calc-import").setInputFiles({
      name: `source-host-${variant}-artifact-calculation.json`, mimeType: "application/json", buffer: Buffer.from(calculatorText),
    });
    await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
    for (const node of selectedAst) await expect(page.locator(`[data-trace-node="${node.id}"]`).first()).toBeVisible();
    const restoredGoldenCard = page.locator(`[data-source-host-artifact-id="${golden.request.id}"]`);
    await expect(restoredGoldenCard.locator('[data-source-host-artifact-state="tier"]')).toHaveValue(String(editedTier));
    await expect(restoredGoldenCard.locator("[data-source-host-artifact-result]")).toHaveText(uiResultText);
    await expect(page.locator("[data-source-host-calculation-result]")).toContainText("相对原公式差值：0");

    evidence.push({
      variant, result, observedRuleIds, appliedAttackTagValues, appliedAttackTags, appliedElements,
      actualArtifactCalls: artifactCalls.map(row => ({ id: row.request.id, ruleId: row.request.input.ruleId, value: row.value })),
      selectedHitIndex, selectedApplicationId: selectedCapture.application.id,
      selectedSupportIds: support.map(row => row.request.id), selectedAst,
      artifactExperiment: { ...experimentEvidence, uiResultText }, calculator, calculatorDifference,
    });
  }

  expect(errors).toEqual([]);
  await writeFile(resolve("docs/validation/source-host-artifact-formulas-20260928.result.json"), `${JSON.stringify({
    scenario: "four-sets-two-pinned-source-runs", sourceConfig: config, runs: evidence, pageErrors: errors,
  }, null, 2)}\n`);
});
