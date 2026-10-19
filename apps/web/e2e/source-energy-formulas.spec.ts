import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sourceHostArtifactSupportIds } from "../../../packages/sim-core/src/source-host-artifact-support";
import {
  calculateSourceHostEnergyEditable, captureSourceHostEnergy,
  createSourceHostEnergyEditable, replaySourceHostEnergy,
} from "../../../packages/sim-core/src/source-host-energy-capture";
import { resolveSourceHostEnergyInput } from "../../../packages/sim-core/src/source-host-energy-formula";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT,
  type SourceHostCalculationRecord, type SourceHostEnergyApplication, type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";

// Fixed b4 and a7 source inventories have Xilonen, not Kachina. A Natlan
// member lets the original setupNightsoulBurst observe elemental damage;
// Scroll then grants its real +6 to its wearer. Exile ticks after Barbara Q,
// Sucrose stays active for her skill particles, and Shimenawa taxes Keqing E.
const config = `options iteration=1 duration=20;
barbara char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
barbara add weapon="magicguide" refine=1 lvl=90/90;
barbara add set="theexile" count=4;
barbara add stats hp=200 cr=0.2 cd=0.4;
sucrose char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=0];
sucrose add weapon="magicguide" refine=1 lvl=90/90;
sucrose add set="scholar" count=4;
sucrose add stats atk=200 em=100 cr=0.2 cd=0.4;
xilonen char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=0];
xilonen add weapon="favoniussword" refine=1 lvl=90/90;
xilonen add set="scrolloftheheroofcindercity" count=4;
xilonen add stats def=200 cr=0.2 cd=0.4;
keqing char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=30];
keqing add weapon="favoniussword" refine=1 lvl=90/90;
keqing add set="shimenawasreminiscence" count=4;
keqing add stats atk=200 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active barbara;
barbara burst;
sucrose skill;
wait(180);
xilonen skill;
keqing skill;
keqing attack:2;
wait(480);`;

type EnergyRecord = SourceHostCalculationRecord & {
  request: Extract<SourceHostCalculationRecord["request"], { kind: "character-energy" }>;
};
type SourceLog = { event?: string; frame?: number; char_index?: number; msg?: string;
  logs?: Record<string, unknown> };
type ArtifactRule = "exile" | "scholar" | "scroll" | "reminiscence";
const artifactRules: ArtifactRule[] = ["exile", "scholar", "scroll", "reminiscence"];

function logMatches(application: SourceHostEnergyApplication, logs: SourceLog[]): boolean {
  const message = application.operation === "consume" ? "draining energy"
    : application.operation === "particle-apply" ? "particle" : "adding energy";
  const beforeKey = application.operation === "consume" ? "pre_drain" : "pre_recovery";
  const afterKey = application.operation === "consume" ? "post_drain" : "post_recovery";
  const amountKey = application.operation === "consume" ? null
    : application.operation === "particle-apply" ? "amt" : "rec'd";
  return logs.some(log => log.event === "energy" && log.frame === application.frame &&
    log.char_index === application.actorIndex && log.msg === message &&
    log.logs?.source === application.source &&
    log.logs[beforeKey] === application.energyBefore && log.logs[afterKey] === application.energyAfter &&
    (amountKey === null || log.logs[amountKey] === application.requestedAmount));
}

test("native energy callbacks share particle arithmetic, artifact amounts, and editable receipts in both lanes", async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const evidence: Array<{
    variant: "classic" | "stellar"; sourceCommit: string; wasmSha256?: string | undefined;
    calculations: number; energyApplications: number; operations: Record<string, number>;
    artifactRuleCounts: Record<ArtifactRule, number>; particleBranches: Record<string, number>;
    erSupport: Array<{ actorKey: string; ruleId: string; value: number; amountId: number }>;
    selected?: { applicationId: number; amountId: number; energyBefore: number; energyMax: number;
      originalRecharge: number; editedRecharge: number; originalAmount: number; editedAmount: number;
      originalAfter: number; editedAfter: number; restoredResult: string };
  }> = [];

  for (const variant of ["classic", "stellar"] as const) {
    await page.goto("/source-simulation");
    await page.locator("#source-host-variant").selectOption(variant);
    await page.locator("#source-host-config").fill(config);
    await page.locator("#source-host-seed").fill("20260928");
    await page.locator("#source-host-run").click();
    await expect(page.locator("#source-host-status")).toContainText(/本次运行完成|运行停止|执行器错误/, { timeout: 90000 });
    await expect(page.locator("#source-host-status")).toContainText("本次运行完成");
    const download = page.waitForEvent("download");
    await page.locator("#source-host-export").click();
    const resultText = await readFile((await (await download).path())!, "utf8");
    await writeFile(resolve(`docs/validation/source-energy-formulas-${variant}-20260928.result.json`), resultText);
    const result = JSON.parse(resultText) as SourceHostResult;
    expect(result.sourceCommit).toBe(variant === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT);
    expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.config).toBe(config);
    const byId = new Map(result.calculations.map(row => [row.request.id, row]));
    const energy = result.calculations.filter((row): row is EnergyRecord => row.request.kind === "character-energy");
    const applications = result.energyApplications ?? [];
    expect(energy.length).toBeGreaterThan(0);
    expect(applications.length).toBeGreaterThan(0);
    const logs = (Array.isArray(result.logs) ? result.logs : []) as SourceLog[];
    for (const row of energy) expect(resolveSourceHostEnergyInput(row.request.input, result.sourceCommit).value)
      .toBeCloseTo(row.value, 9);
    for (const application of applications) {
      const record = byId.get(application.calculationId);
      expect(record?.request.kind).toBe("character-energy");
      if (record?.request.kind !== "character-energy") throw new Error("Energy application is missing its calculation");
      expect(record.value).toBe(application.energyAfter);
      expect(record.request.input.operation).toBe(application.operation);
      expect(record.request.actorIndex).toBe(application.actorIndex);
      expect(record.request.actorKey).toBe(application.actorKey);
      expect(record.request.frame).toBe(application.frame);
      expect(application.energyAfter).toBeGreaterThanOrEqual(0);
      expect(application.energyAfter).toBeLessThanOrEqual(application.energyMax);
      expect(logMatches(application, logs), `Missing source pre/post log for energy application #${application.id}`).toBe(true);
      if (record.request.input.operation === "particle-apply") {
        expect(application.amountCalculationId).toBeDefined();
        expect(record.request.componentIds).toContain(application.amountCalculationId);
        const amount = byId.get(application.amountCalculationId!);
        expect(amount?.request.kind).toBe("character-energy");
        expect(amount?.request.kind === "character-energy" && amount.request.input.operation).toBe("particle-amount");
        expect(application.requestedAmount).toBe(amount?.value);
      } else if (record.request.input.operation === "flat-change" || record.request.input.operation === "consume") {
        expect(application.amountCalculationId).toBeUndefined();
        expect(record.request.input.amount).toBe(application.requestedAmount);
      } else {
        throw new Error(`Particle amount #${record.request.id} is not a terminal application`);
      }
    }
    const operations = Object.fromEntries(["flat-change", "consume", "particle-amount", "particle-apply"]
      .map(operation => [operation, energy.filter(row => row.request.input.operation === operation).length]));
    for (const operation of Object.keys(operations)) expect(operations[operation]).toBeGreaterThan(0);
    const artifactRuleCounts = Object.fromEntries(artifactRules.map(rule => [rule, energy.filter(row =>
      row.request.input.operation === "flat-change" && row.request.input.artifactRule === rule).length])) as Record<ArtifactRule, number>;
    const particles = energy.filter(row => row.request.input.operation === "particle-amount");
    const noElement = variant === "classic" ? "" : "none";
    const neutral = particles.filter(row => row.request.ability.startsWith("favonius-"));
    expect(neutral.length).toBeGreaterThan(0);
    for (const row of neutral) {
      if (row.request.input.operation !== "particle-amount") throw new Error("Neutral particle operation lost");
      const input = row.request.input;
      expect(input.particleElement).toBe(noElement);
      // Both pinned Go enums select base 2 for Favonius's neutral particles;
      // their serialized labels differ, but the native coefficient does not.
      expect(row.value).toBe((2 * (input.isActive ? 1 : 1 - 0.1 * input.partyCount))
        * input.energyRecharge * input.particleCount);
    }
    const particleBranches = {
      sameElement: particles.filter(row => row.request.input.operation === "particle-amount" && row.request.input.particleElement === row.request.input.actorElement).length,
      differentElement: particles.filter(row => row.request.input.operation === "particle-amount" && row.request.input.particleElement !== row.request.input.actorElement && row.request.input.particleElement !== noElement).length,
      neutral: neutral.length,
      active: particles.filter(row => row.request.input.operation === "particle-amount" && row.request.input.isActive).length,
      offField: particles.filter(row => row.request.input.operation === "particle-amount" && !row.request.input.isActive).length,
    };
    for (const count of Object.values(particleBranches)) expect(count).toBeGreaterThan(0);
    const erSupport = particles.flatMap(row => sourceHostArtifactSupportIds(row.request).flatMap(id => {
      const support = byId.get(id);
      return support?.request.kind === "artifact-scalar" && ["const-exile-2pc-er", "const-scholar-2pc-er"].includes(support.request.input.ruleId)
        ? [{ actorKey: row.request.actorKey, ruleId: support.request.input.ruleId, value: support.value, amountId: row.request.id }] : [];
    }));
    expect(erSupport.some(row => row.ruleId === "const-scholar-2pc-er" && row.actorKey === "sucrose")).toBe(true);
    expect(erSupport.some(row => row.ruleId === "const-exile-2pc-er" && row.actorKey === "barbara")).toBe(true);

    const selected = applications.flatMap((application, index) => {
      if (application.operation !== "particle-apply" || application.actorKey !== "sucrose"
        || application.amountCalculationId === undefined || application.energyBefore >= application.energyMax) return [];
      const amount = byId.get(application.amountCalculationId);
      if (amount?.request.kind !== "character-energy" || amount.request.input.operation !== "particle-amount"
        || !amount.request.input.isActive) return [];
      return [{ application, index, amount }];
    }).find(({ application }) => application.energyAfter < application.energyMax);
    expect(selected, `No uncapped active Sucrose particle application in ${variant}`).toBeDefined();
    const capture = captureSourceHostEnergy(result, selected!.application.id);
    const replay = replaySourceHostEnergy(capture);
    expect(replay.difference).toBe(0);
    expect(replay.originalEnergy).toBe(selected!.application.energyAfter);
    expect(capture.components.map(row => row.request.id)).toEqual([selected!.amount.request.id]);
    expect(capture.supportingCalculations?.some(row => row.request.kind === "artifact-scalar"
      && row.request.input.ruleId === "const-scholar-2pc-er")).toBe(true);
    const selectedAmount = selected!.amount.request;
    if (selectedAmount.kind !== "character-energy" || selectedAmount.input.operation !== "particle-amount")
      throw new Error("Selected energy component is not a particle amount");
    const originalRecharge = selectedAmount.input.energyRecharge;
    const editedRecharge = originalRecharge + 1;
    const editable = createSourceHostEnergyEditable(capture);
    expect(editable.particleInput?.operation).toBe("particle-amount");
    if (editable.particleInput?.operation !== "particle-amount") throw new Error("Selected particle lost its source amount input");
    const edited = calculateSourceHostEnergyEditable({ ...editable,
      particleInput: { ...editable.particleInput, energyRecharge: editedRecharge } });
    const editedAmount = resolveSourceHostEnergyInput({ ...editable.particleInput,
      energyRecharge: editedRecharge }, result.sourceCommit).value;
    expect(edited.requestedAmount).toBeCloseTo(editedAmount, 9);
    expect(editedAmount).toBeGreaterThan(selected!.amount.value);
    expect(edited.value).toBeCloseTo(Math.min(selected!.application.energyBefore + editedAmount,
      selected!.application.energyMax), 9);
    expect(edited.actualChange).toBeCloseTo(edited.value - selected!.application.energyBefore, 9);
    expect(edited.overflow).toBeCloseTo(Math.max(0, editedAmount - edited.actualChange), 9);
    expect(edited.originalCapture).toEqual(capture);

    let restoredResult = "";
    if (variant === "classic") {
      await page.locator("#source-host-import").setInputFiles({ name: "source-energy-native.json",
        mimeType: "application/json", buffer: Buffer.from(resultText) });
      await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
      await page.locator("#source-host-energy-index").fill(String(selected!.index));
      await expect(page.locator("#source-host-energy-hit")).toContainText(selected!.application.source);
      await page.locator("#source-host-open-energy-calculator").click();
      await expect(page).toHaveURL(/\/calculator$/);
      const editor = page.locator("[data-source-host-energy-calculator]");
      await expect(editor).toContainText("来源能量事件 · 独立计算");
      const rechargeInput = editor.locator('[data-source-host-energy-particle-input="energyRecharge"]');
      await expect(rechargeInput).toHaveValue(String(originalRecharge));
      const originalResult = (await editor.locator("[data-source-host-energy-result]").textContent()) ?? "";
      await rechargeInput.fill(String(editedRecharge));
      const displayValue = edited.value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
      await expect(editor.locator("[data-source-host-energy-result]")).toContainText(`编辑后能量：${displayValue}`);
      const editedResult = (await editor.locator("[data-source-host-energy-result]").textContent()) ?? "";
      expect(editedResult).not.toBe(originalResult);
      const pendingCalculator = page.waitForEvent("download");
      await editor.locator("[data-source-host-energy-export]").click();
      const calculatorText = await readFile((await (await pendingCalculator).path())!, "utf8");
      await writeFile(resolve("docs/validation/source-energy-formulas-calculator-20260928.result.json"), calculatorText);
      const calculator = JSON.parse(calculatorText) as ReturnType<typeof createSourceHostEnergyEditable>;
      expect(calculator.originalCapture).toEqual(capture);
      expect(calculator.particleInput?.operation).toBe("particle-amount");
      if (calculator.particleInput?.operation !== "particle-amount") throw new Error("Exported particle input missing");
      expect(calculator.particleInput.energyRecharge).toBe(editedRecharge);
      expect(calculateSourceHostEnergyEditable(calculator).value).toBe(edited.value);
      await editor.locator("[data-source-host-energy-import]").setInputFiles({ name: "source-energy-calculator.json",
        mimeType: "application/json", buffer: Buffer.from(calculatorText) });
      const restored = page.locator("[data-source-host-energy-calculator]");
      await expect(restored.locator('[data-source-host-energy-particle-input="energyRecharge"]')).toHaveValue(String(editedRecharge));
      await expect(restored.locator("[data-source-host-energy-result]")).toHaveText(editedResult);
      restoredResult = displayValue;
    }

    evidence.push({ variant, sourceCommit: result.sourceCommit, wasmSha256: result.executionArtifact?.wasmSha256,
      calculations: result.calculations.length, energyApplications: applications.length, operations,
      artifactRuleCounts, particleBranches, erSupport,
      selected: { applicationId: selected!.application.id, amountId: selected!.amount.request.id,
        energyBefore: selected!.application.energyBefore, energyMax: selected!.application.energyMax,
        originalRecharge, editedRecharge, originalAmount: selected!.amount.value, editedAmount,
        originalAfter: selected!.application.energyAfter, editedAfter: edited.value, restoredResult } });
  }

  expect(errors).toEqual([]);
  await writeFile(resolve("docs/validation/source-energy-formulas-20260928.result.json"), `${JSON.stringify({
    schemaVersion: "source-energy-formulas-validation-v1", config, runs: evidence, pageErrors: errors,
  }, null, 2)}\n`);
  console.log(JSON.stringify({ runs: evidence.map(({ variant, sourceCommit, wasmSha256, calculations,
    energyApplications, operations, artifactRuleCounts, particleBranches, erSupport, selected }) => ({
    variant, sourceCommit, wasmSha256, calculations, energyApplications, operations,
    artifactRuleCounts, particleBranches, erSupportCount: erSupport.length, selected,
  })), errors }));
});
