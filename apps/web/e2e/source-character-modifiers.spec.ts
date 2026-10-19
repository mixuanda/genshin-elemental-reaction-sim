import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { captureSourceHostHit, replaySourceHostHit } from "../../../packages/sim-core/src/source-host-capture";
import { sourceHostArtifactSupportIds, sourceHostArtifactSupportRefs } from "../../../packages/sim-core/src/source-host-artifact-support";
import {
  resolveSourceHostCharacterModifierInput, sourceHostCharacterModifierRuleDescriptor, sourceHostCharacterModifierRules,
} from "../../../packages/sim-core/src/source-host-character-modifier-formula";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT,
  type SourceHostCalculationRecord, type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";
import type { SourceHostStartupRun } from "../src/source-host-startup-analysis";

type Lane = "classic" | "stellar";
type StartupScenario = "zero" | "full" | "custom";
type StartupArtifact = { schemaVersion: "source-host-startup-v1";
  observationPolicy: { warmupFrames: number; windowFrames: number }; runs: SourceHostStartupRun[] };
type ModifierRecord = SourceHostCalculationRecord & {
  request: Extract<SourceHostCalculationRecord["request"], { kind: "character-modifier" }>;
};
const selfRule = "char-xingqiu-xingqiu-a4-hydrop-0p2";
const crossRule = "char-albedo-albedo-a4-em-125";

// Albedo's Q installs his team EM modifier. The following Xingqiu E reads
// that modifier from another actor and his own passive Hydro damage vector.
const config = `options iteration=1 duration=10;
albedo char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
albedo add weapon="favoniussword" refine=1 lvl=90/90;
albedo add stats def=200 cr=0.2 cd=0.4;
xingqiu char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
xingqiu add weapon="favoniussword" refine=1 lvl=90/90;
xingqiu add stats atk=200 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active albedo;
albedo burst;
xingqiu skill;
xingqiu burst;
xingqiu attack:2;
wait(180);`;

function windowDamage(result: SourceHostResult, index: 0 | 1, policy: StartupArtifact["observationPolicy"]): number {
  const start = 1 + policy.warmupFrames + index * policy.windowFrames;
  const end = start + policy.windowFrames;
  return result.applications.filter(row => row.frame >= start && row.frame < end)
    .reduce((sum, row) => sum + row.appliedDamage, 0);
}

test("native character modifiers retain source-holder identity in actual hits and startup drift uses saved paired runs", async ({ page }) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  let workers = 0;
  page.on("pageerror", error => errors.push(error.message));
  page.on("worker", () => { workers++; });

  // Reuse the existing six native runs. Reanalysis must not start a worker.
  await page.goto("/source-simulation");
  const startupText = await readFile(resolve("docs/validation/source-startup-sensitivity-classic-20260928.intermediate.json"), "utf8");
  const startup = JSON.parse(startupText) as StartupArtifact;
  expect(startup.schemaVersion).toBe("source-host-startup-v1");
  expect(startup.runs).toHaveLength(6);
  const workersBeforeImport = workers;
  await page.locator("#source-startup-import").setInputFiles({ name: "saved-startup.json",
    mimeType: "application/json", buffer: Buffer.from(startupText) });
  await expect(page.locator("#source-startup-status")).toContainText("分析完成");
  expect(workers).toBe(workersBeforeImport);
  const projectionText = await page.locator("#source-startup-result details").last().locator("pre").textContent();
  const projection = JSON.parse(projectionText!) as {
    scenarios: Array<{ scenario: StartupScenario;
      summary: { pairedContrast: { pairedSamples: Array<{ seed: string; damage: number; dps: number }> } | null } }>;
  };
  const startupDrift: Array<{ scenario: StartupScenario; samples: Array<{ seed: string; damage: number; dps: number }> }> = [];
  for (const scenario of ["zero", "full", "custom"] as const) {
    const rows = startup.runs.filter(row => row.scenario === scenario);
    expect(rows).toHaveLength(2);
    const samples = projection.scenarios.find(row => row.scenario === scenario)?.summary.pairedContrast?.pairedSamples;
    expect(samples).toHaveLength(2);
    for (const run of rows) {
      const sample = samples!.find(row => row.seed === run.result.seed);
      const delta = windowDamage(run.result, 1, startup.observationPolicy)
        - windowDamage(run.result, 0, startup.observationPolicy);
      expect(sample?.damage).toBe(delta);
      expect(sample?.dps).toBeCloseTo(delta * 60 / startup.observationPolicy.windowFrames, 9);
    }
    await expect(page.locator(`[data-source-startup-window-drift="${scenario}"]`)).toContainText("全队 DPS");
    await expect(page.locator(`[data-source-startup-window-drift="${scenario}"]`)).toContainText("2组");
    startupDrift.push({ scenario, samples: samples! });
  }

  const runs: Array<{ variant: Lane; sourceCommit: string; wasmSha256?: string | undefined;
    calculations: number; modifierCalls: number; observedRules: Record<string, number>;
    self: { holder: number; consumer: number; id: number; value: number };
    crossActor: { holder: number; consumer: number; id: number; value: number };
    selected: { applicationId: number; rawDamage: number; replayDifference: number; modifierIds: number[] };
  }> = [];

  expect(sourceHostCharacterModifierRules[selfRule]).toMatchObject({ character: "xingqiu",
    modifierKey: "xingqiu-a4", statIndex: 13, value: 0.2 });
  expect(sourceHostCharacterModifierRules[crossRule]).toMatchObject({ character: "albedo",
    modifierKey: "albedo-a4", statIndex: 8, value: 125 });
  for (const variant of ["classic", "stellar"] as const) {
    await page.goto("/source-simulation");
    await page.locator("#source-host-variant").selectOption(variant);
    await page.locator("#source-host-config").fill(config);
    await page.locator("#source-host-seed").fill("20260928");
    await page.locator("#source-host-run").click();
    await expect(page.locator("#source-host-status")).toContainText(/本次运行完成|运行停止|执行器错误/, { timeout: 90000 });
    await expect(page.locator("#source-host-status")).toContainText("本次运行完成");
    const pending = page.waitForEvent("download");
    await page.locator("#source-host-export").click();
    const raw = await readFile((await (await pending).path())!, "utf8");
    // Each complete native result survives later browser or assertion failure.
    await writeFile(resolve(`docs/validation/source-character-modifiers-${variant}-20260928.result.json`), raw);
    const result = JSON.parse(raw) as SourceHostResult;
    expect(result.sourceCommit).toBe(variant === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT);
    expect(result.config).toBe(config);
    expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
    const byId = new Map(result.calculations.map(row => [row.request.id, row]));
    const modifiers = result.calculations.filter((row): row is ModifierRecord => row.request.kind === "character-modifier");
    const observedRules = Object.fromEntries([...new Set(modifiers.map(row => row.request.input.ruleId))]
      .map(id => [id, modifiers.filter(row => row.request.input.ruleId === id).length]));
    for (const row of modifiers) {
      const descriptor = sourceHostCharacterModifierRuleDescriptor(row.request.input.ruleId);
      expect(row.request.input.modifierKey).toBe(descriptor.modifierKey);
      expect(resolveSourceHostCharacterModifierInput(row.request.input, result.sourceCommit).value).toBe(row.value);
    }
    const selected = result.applications.flatMap((application, index) => {
      const calculation = byId.get(application.calculationId);
      if (calculation?.request.kind !== "damage" || calculation.request.actorKey !== "xingqiu") return [];
      const supportIds = sourceHostArtifactSupportIds(calculation.request);
      const self = modifiers.find(row => supportIds.includes(row.request.id) && row.request.input.ruleId === selfRule);
      const crossActor = modifiers.find(row => supportIds.includes(row.request.id) && row.request.input.ruleId === crossRule);
      return self && crossActor ? [{ application, index, calculation, supportIds, self, crossActor }] : [];
    })[0];
    expect(selected, `${variant} needs one Xingqiu hit consuming both character modifiers`).toBeDefined();
    const { application, index, calculation, supportIds, self, crossActor } = selected!;
    if (calculation.request.kind !== "damage") throw new Error("Selected modifier hit must be ordinary damage");
    expect(self.request.actorIndex).toBe(1);
    expect(self.request.input.sourceHolderIndex).toBe(1);
    expect(crossActor.request.actorIndex).toBe(1);
    expect(crossActor.request.input.sourceHolderIndex).toBe(0);
    expect(self.value).toBe(0.2);
    expect(crossActor.value).toBe(125);
    const refs = sourceHostArtifactSupportRefs(calculation.request);
    for (const [row, statIndex] of [[self, 13], [crossActor, 8]] as const) {
      const read = refs.find(ref => ref.ids.includes(row.request.id));
      expect(read?.kind).toBe("stat");
      expect(read?.key).toBe(row.request.input.modifierKey);
      expect(Array.isArray(read?.returned) ? read.returned[statIndex] : undefined)
        .toBeCloseTo(row.value, 9);
    }
    expect(calculation.request.input.elementalMastery).toBeGreaterThanOrEqual(125);
    expect(calculation.request.input.damageBonus).toBeGreaterThanOrEqual(0.2);
    expect(application.rawDamage).toBe(calculation.value);
    const capture = captureSourceHostHit(result, application.id);
    const replay = replaySourceHostHit(capture);
    expect(replay.difference).toBe(0);
    expect(capture.supportingCalculations?.map(row => row.request.id)).toEqual(expect.arrayContaining([
      self.request.id, crossActor.request.id,
    ]));
    const measure: (typeof runs)[number] = { variant, sourceCommit: result.sourceCommit,
      wasmSha256: result.executionArtifact?.wasmSha256, calculations: result.calculations.length,
      modifierCalls: modifiers.length, observedRules,
      self: { holder: self.request.input.sourceHolderIndex, consumer: self.request.actorIndex,
        id: self.request.id, value: self.value },
      crossActor: { holder: crossActor.request.input.sourceHolderIndex, consumer: crossActor.request.actorIndex,
        id: crossActor.request.id, value: crossActor.value },
      selected: { applicationId: application.id, rawDamage: application.rawDamage,
        replayDifference: replay.difference, modifierIds: supportIds.filter(id =>
          byId.get(id)?.request.kind === "character-modifier") } };
    runs.push(measure);

    if (variant === "classic") {
      await page.locator("#source-host-import").setInputFiles({ name: "source-character-modifiers-native.json",
        mimeType: "application/json", buffer: Buffer.from(raw) });
      await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
      await page.locator("#source-host-hit-index").fill(String(index));
      await expect(page.locator("#source-host-hit")).toContainText("差值 0");
      await page.locator("#source-host-open-calculator").click();
      await expect(page).toHaveURL(/\/calculator$/);
      await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
      await expect(page.locator("[data-source-host-calculation-result] h3")).toContainText("捕获时");
      const pendingEditable = page.waitForEvent("download");
      await page.locator("[data-source-host-export]").click();
      const editableText = await readFile((await (await pendingEditable).path())!, "utf8");
      await writeFile(resolve("docs/validation/source-character-modifiers-calculator-20260928.result.json"), editableText);
      const editable = JSON.parse(editableText) as { originalCapture: typeof capture };
      expect(editable.originalCapture).toEqual(capture);
      await page.locator("#calc-source-host-close").click();
      await page.locator("#calc-import").setInputFiles({ name: "source-character-modifiers-calculator.json",
        mimeType: "application/json", buffer: Buffer.from(editableText) });
      await expect(page.locator("[data-source-host-calculation-result] h3")).toContainText("捕获时");
      await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
    }
  }

  expect(errors).toEqual([]);
  await writeFile(resolve("docs/validation/source-character-modifiers-20260928.result.json"), `${JSON.stringify({
    schemaVersion: "source-character-modifiers-validation-v1", startupDrift, runs, pageErrors: errors,
  }, null, 2)}\n`);
  console.log(JSON.stringify({ startupDrift: startupDrift.map(row => ({ scenario: row.scenario, samples: row.samples })),
    runs: runs.map(({ variant, modifierCalls, observedRules, self, crossActor, selected }) => ({
      variant, modifierCalls, observedRules, self, crossActor, selected })), errors }));
});
