import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  calculateSourceHostCooldownEditable, captureSourceHostCooldown,
  createSourceHostCooldownEditable, replaySourceHostCooldown,
} from "../../../packages/sim-core/src/source-host-cooldown-capture";
import { resolveSourceHostCooldownInput } from "../../../packages/sim-core/src/source-host-cooldown-formula";
import {
  calculateSourceHostHealingEditable, captureSourceHostHealing,
  createSourceHostHealingEditable, replaySourceHostHealing,
} from "../../../packages/sim-core/src/source-host-healing-capture";
import { resolveSourceHostHealingInput } from "../../../packages/sim-core/src/source-host-healing-formula";
import { sourceHostArtifactSupportIds } from "../../../packages/sim-core/src/source-host-artifact-support";
import {
  isSourceHostArtifactAuxiliaryRuleId, resolveSourceHostArtifactAuxiliaryInput,
  sourceHostArtifactAuxiliaryRuleIds,
} from "../../../packages/sim-core/src/source-host-artifact-auxiliary-formula";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT,
  type SourceHostCalculationRecord, type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";

// Native player damage occurs after Noelle's shield and Zhongli's pillar hit.
// Barbara then heals the actual party; Collei's burst supplies later Dendro
// hits that can consume the target's Deepwood resistance modifier.
const shieldHealing = `options iteration=1 duration=18;
barbara char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
barbara add weapon="magicguide" refine=1 lvl=90/90;
barbara add set="maidenbeloved" count=4;
barbara add stats hp=4000 cr=0.2 cd=0.4;
zhongli char lvl=90/90 cons=0 talent=1,1,1;
zhongli add weapon="favoniuslance" refine=1 lvl=90/90;
zhongli add set="tenacityofthemillelith" count=4;
zhongli add stats hp=4000 cr=0.2 cd=0.4;
noelle char lvl=90/90 cons=0 talent=1,1,1;
noelle add weapon="favoniusgreatsword" refine=1 lvl=90/90;
noelle add set="retracingbolide" count=2;
noelle add stats def=400 cr=0.2 cd=0.4;
collei char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
collei add weapon="favoniuswarbow" refine=1 lvl=90/90;
collei add set="deepwoodmemories" count=4;
collei add stats atk=200 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
hurt once interval=150 amount=12000,12000 element=physical;
active noelle;
noelle skill;
zhongli skill;
wait(180);
barbara burst;
collei skill;
collei burst;
barbara attack:2;
wait(360);`;

// Hydro aura -> Sucrose Swirl exercises one real VV resistance branch. Collei
// and Keqing can subsequently trigger TF's native cooldown reduction; its
// reduce branch is reported from receipts rather than assumed from the script.
const swirlCooldown = `options iteration=1 duration=18;
barbara char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
barbara add weapon="magicguide" refine=1 lvl=90/90;
barbara add set="maidenbeloved" count=4;
barbara add stats hp=4000 cr=0.2 cd=0.4;
sucrose char lvl=90/90 cons=0 talent=1,1,1;
sucrose add weapon="magicguide" refine=1 lvl=90/90;
sucrose add set="viridescentvenerer" count=4;
sucrose add stats em=200 cr=0.2 cd=0.4;
keqing char lvl=90/90 cons=0 talent=1,1,1;
keqing add weapon="favoniussword" refine=1 lvl=90/90;
keqing add set="thunderingfury" count=4;
keqing add stats atk=200 em=100 cr=0.2 cd=0.4;
collei char lvl=90/90 cons=0 talent=1,1,1;
collei add weapon="favoniuswarbow" refine=1 lvl=90/90;
collei add set="deepwoodmemories" count=4;
collei add stats atk=200 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active barbara;
barbara attack;
sucrose skill;
barbara attack;
collei skill;
keqing skill;
wait(90);
keqing attack:2;
barbara attack;
keqing skill;
barbara burst;
wait(300);`;

type Lane = "classic" | "stellar";
type Scenario = "shield-healing" | "swirl-cooldown";
const scenarios: Array<{ variant: Lane; name: Scenario; config: string }> =
  (["classic", "stellar"] as const).flatMap(variant => [
    { variant, name: "shield-healing" as const, config: shieldHealing },
    { variant, name: "swirl-cooldown" as const, config: swirlCooldown },
  ]);
type HealingRecord = SourceHostCalculationRecord & {
  request: Extract<SourceHostCalculationRecord["request"], { kind: "character-healing" }>;
};
type CooldownRecord = SourceHostCalculationRecord & {
  request: Extract<SourceHostCalculationRecord["request"], { kind: "character-cooldown" }>;
};
type AuxiliaryRecord = SourceHostCalculationRecord & {
  request: Extract<SourceHostCalculationRecord["request"], { kind: "artifact-scalar" }>;
};

test("native healing, cooldown, shield, and resistance scalar receipts replay in both pinned lanes", async ({ page }) => {
  test.setTimeout(420000);
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const evidence: Array<{ variant: Lane; scenario: Scenario; sourceCommit: string; wasmSha256?: string | undefined;
    calculations: number; healingApplications: number; playerApplications: number;
    healingStages: Record<string, number>; cooldownOperations: Record<string, number>;
    auxiliaryRules: Record<string, number>; consumers: Record<string, number>;
    healingEdit?: { applicationId: number; originalAmount: number; editedAmount: number;
      originalOverheal: number; editedOverheal: number; restoredResult: string };
    cooldownEdit?: { calculationId: number; originalValue: number; editedValue: number; restoredResult: string };
  }> = [];

  for (const scenario of scenarios) {
    await page.goto("/source-simulation");
    await page.locator("#source-host-variant").selectOption(scenario.variant);
    await page.locator("#source-host-config").fill(scenario.config);
    await page.locator("#source-host-seed").fill("20260928");
    await page.locator("#source-host-run").click();
    await expect(page.locator("#source-host-status")).toContainText(/本次运行完成|运行停止|执行器错误/, { timeout: 90000 });
    await expect(page.locator("#source-host-status")).toContainText("本次运行完成");
    const pending = page.waitForEvent("download");
    await page.locator("#source-host-export").click();
    const raw = await readFile((await (await pending).path())!, "utf8");
    // Preserve every full native result before the first receipt assertion.
    await writeFile(resolve(`docs/validation/source-auxiliary-formulas-${scenario.variant}-${scenario.name}-20260928.result.json`), raw);
    const result = JSON.parse(raw) as SourceHostResult;
    expect(result.sourceCommit).toBe(scenario.variant === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT);
    expect(result.config).toBe(scenario.config);
    expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
    const byId = new Map(result.calculations.map(row => [row.request.id, row]));
    const healing = result.calculations.filter((row): row is HealingRecord => row.request.kind === "character-healing");
    const cooldown = result.calculations.filter((row): row is CooldownRecord => row.request.kind === "character-cooldown");
    const auxiliary = result.calculations.filter((row): row is AuxiliaryRecord => row.request.kind === "artifact-scalar"
      && isSourceHostArtifactAuxiliaryRuleId(row.request.input.ruleId));
    const healingStages = Object.fromEntries(["base", "bonus", "amount", "receive", "overheal"].map(operation =>
      [operation, healing.filter(row => row.request.input.operation === operation).length]));
    const cooldownOperations = Object.fromEntries(["duration", "remaining", "reduce"].map(operation =>
      [operation, cooldown.filter(row => row.request.input.operation === operation).length]));
    const auxiliaryRules = Object.fromEntries(sourceHostArtifactAuxiliaryRuleIds.map(id =>
      [id, auxiliary.filter(row => row.request.input.ruleId === id).length]));
    const consumers = Object.fromEntries(sourceHostArtifactAuxiliaryRuleIds.map(id => [id,
      result.calculations.filter(row => sourceHostArtifactSupportIds(row.request).some(supportId => {
        const support = byId.get(supportId);
        return support?.request.kind === "artifact-scalar" && support.request.input.ruleId === id;
      })).length]));
    const measurement: (typeof evidence)[number] = { variant: scenario.variant, scenario: scenario.name,
      sourceCommit: result.sourceCommit, wasmSha256: result.executionArtifact?.wasmSha256,
      calculations: result.calculations.length, healingApplications: result.healingApplications?.length ?? 0,
      playerApplications: result.playerApplications?.length ?? 0, healingStages, cooldownOperations,
      auxiliaryRules, consumers };
    evidence.push(measurement);

    for (const row of healing) expect(resolveSourceHostHealingInput(row.request.input, result.sourceCommit).value).toBe(row.value);
    for (const row of cooldown) expect(resolveSourceHostCooldownInput(row.request.input, result.sourceCommit).value).toBe(row.value);
    for (const row of auxiliary) expect(resolveSourceHostArtifactAuxiliaryInput(row.request.input, result.sourceCommit).value).toBe(row.value);
    for (const application of result.healingApplications ?? []) {
      const stageIds = [application.baseCalculationId, application.bonusCalculationId, application.amountCalculationId,
        ...(application.receiveCalculationId === undefined ? [] : [application.receiveCalculationId]), application.overhealCalculationId];
      expect(stageIds.every(id => byId.get(id)?.request.kind === "character-healing")).toBe(true);
      expect(stageIds).toEqual([...stageIds].sort((a, b) => a - b));
      const replay = replaySourceHostHealing(captureSourceHostHealing(result, application.id));
      expect(replay.difference).toBe(0);
      expect(replay.originalAmount).toBe(application.finalAmount);
      expect(replay.originalOverheal).toBe(application.overheal);
    }
    expect(result.healingApplications?.length ?? 0).toBeGreaterThan(0);
    // Reduce is event-gated by the native TF reaction and may be absent.

    if (scenario.name === "shield-healing") {
      for (const stage of ["base", "bonus", "amount", "receive", "overheal"])
        expect(healingStages[stage], `No native ${stage} heal stage`).toBeGreaterThan(0);
      for (const id of ["maiden-4pc-heal", "bolide-2pc-shield", "tenacity-4pc-shield", "deepwood-4pc-res"])
        expect(auxiliaryRules[id], `No native ${id} callback`).toBeGreaterThan(0);
      for (const id of ["maiden-4pc-heal", "bolide-2pc-shield", "tenacity-4pc-shield", "deepwood-4pc-res"])
        expect(consumers[id], `Native ${id} scalar was not consumed by a source request`).toBeGreaterThan(0);
      expect((result.playerApplications ?? []).some(hit => hit.shieldAbsorbed > 0)).toBe(true);
    } else {
      const vv = ["viridescent-4pc-res-hydro", "viridescent-4pc-res-electro",
        "viridescent-4pc-res-cryo", "viridescent-4pc-res-pyro"];
      expect(vv.some(id => auxiliaryRules[id]! > 0 && consumers[id]! > 0)).toBe(true);
    }

    if (scenario.variant === "classic" && scenario.name === "shield-healing") {
      const applicationIndex = (result.healingApplications ?? []).findIndex(row => row.receiveCalculationId !== undefined
        && row.finalAmount > 0);
      expect(applicationIndex, "A template ReceiveHeal is required for a linked numeric edit").toBeGreaterThanOrEqual(0);
      const application = result.healingApplications![applicationIndex]!;
      const capture = captureSourceHostHealing(result, application.id);
      expect(replaySourceHostHealing(capture).difference).toBe(0);
      const editable = createSourceHostHealingEditable(capture);
      expect(editable.bonusInput.operation).toBe("bonus");
      if (editable.bonusInput.operation !== "bonus") throw new Error("Native heal lacks bonus stage");
      const editedInfoBonus = editable.bonusInput.infoBonus + 0.1;
      const edited = calculateSourceHostHealingEditable({ ...editable,
        bonusInput: { ...editable.bonusInput, infoBonus: editedInfoBonus } });
      expect(edited.status).toBe("calculated");
      if (edited.status !== "calculated") throw new Error(edited.reason);
      expect(edited.editedAmount).toBeGreaterThan(edited.originalAmount);
      expect(edited.originalCapture).toEqual(capture);
      await page.locator("#source-host-import").setInputFiles({ name: "source-auxiliary-native.json",
        mimeType: "application/json", buffer: Buffer.from(raw) });
      await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
      await page.locator("#source-host-healing-index").fill(String(applicationIndex));
      await expect(page.locator("#source-host-healing-hit")).toContainText(application.source);
      await page.locator("#source-host-open-healing-calculator").click();
      await expect(page).toHaveURL(/\/calculator$/);
      const editor = page.locator("[data-source-host-healing-calculator]");
      const infoBonus = editor.locator('[data-source-host-healing-stage="bonus"][data-source-host-healing-field="infoBonus"]');
      await expect(infoBonus).toHaveValue(String(editable.bonusInput.infoBonus));
      await infoBonus.fill(String(editedInfoBonus));
      await expect(editor.locator("[data-source-host-healing-result]")).toContainText("编辑后过量治疗");
      const editedText = (await editor.locator("[data-source-host-healing-result]").textContent()) ?? "";
      const pendingEditable = page.waitForEvent("download");
      await editor.locator("[data-source-host-healing-export]").click();
      const editableText = await readFile((await (await pendingEditable).path())!, "utf8");
      await writeFile(resolve("docs/validation/source-auxiliary-formulas-healing-calculator-20260928.result.json"), editableText);
      const saved = JSON.parse(editableText) as ReturnType<typeof createSourceHostHealingEditable>;
      expect(saved.originalCapture).toEqual(capture);
      expect(saved.bonusInput.operation === "bonus" && saved.bonusInput.infoBonus).toBe(editedInfoBonus);
      expect(calculateSourceHostHealingEditable(saved).status).toBe("calculated");
      await editor.locator("[data-source-host-healing-import]").setInputFiles({ name: "source-healing-edit.json",
        mimeType: "application/json", buffer: Buffer.from(editableText) });
      await expect(page.locator('[data-source-host-healing-stage="bonus"][data-source-host-healing-field="infoBonus"]'))
        .toHaveValue(String(editedInfoBonus));
      await expect(page.locator("[data-source-host-healing-result]")).toHaveText(editedText);
      measurement.healingEdit = { applicationId: application.id, originalAmount: edited.originalAmount,
        editedAmount: edited.editedAmount, originalOverheal: edited.originalOverheal,
        editedOverheal: edited.editedOverheal, restoredResult: String(edited.editedOverheal) };
    }

    if (scenario.variant === "classic" && scenario.name === "swirl-cooldown") {
      const calculationIndex = cooldown.findIndex(row => row.request.input.operation === "duration");
      expect(calculationIndex).toBeGreaterThanOrEqual(0);
      const selected = cooldown[calculationIndex]!;
      const capture = captureSourceHostCooldown(result, selected.request.id);
      expect(replaySourceHostCooldown(capture).difference).toBe(0);
      const editable = createSourceHostCooldownEditable(capture);
      if (editable.input.operation !== "duration") throw new Error("Selected cooldown is not a duration step");
      const editedDuration = editable.input.originalDuration + 60;
      const edited = calculateSourceHostCooldownEditable({ ...editable,
        input: { ...editable.input, originalDuration: editedDuration } });
      expect(edited.value).not.toBe(edited.originalValue);
      expect(edited.originalCapture).toEqual(capture);
      await page.locator("#source-host-import").setInputFiles({ name: "source-auxiliary-native.json",
        mimeType: "application/json", buffer: Buffer.from(raw) });
      await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
      await page.locator("#source-host-cooldown-index").fill(String(calculationIndex));
      await expect(page.locator("#source-host-cooldown-hit")).toContainText(selected.request.ability);
      await page.locator("#source-host-open-cooldown-calculator").click();
      await expect(page).toHaveURL(/\/calculator$/);
      const editor = page.locator("[data-source-host-cooldown-calculator]");
      const duration = editor.locator('[data-source-host-cooldown-input="originalDuration"]');
      await expect(duration).toHaveValue(String(editable.input.originalDuration));
      await duration.fill(String(editedDuration));
      await expect(editor.locator("[data-source-host-cooldown-result]")).toContainText(`编辑后冷却帧数：${edited.value}`);
      const editedText = (await editor.locator("[data-source-host-cooldown-result]").textContent()) ?? "";
      const pendingEditable = page.waitForEvent("download");
      await editor.locator("[data-source-host-cooldown-export]").click();
      const editableText = await readFile((await (await pendingEditable).path())!, "utf8");
      await writeFile(resolve("docs/validation/source-auxiliary-formulas-cooldown-calculator-20260928.result.json"), editableText);
      const saved = JSON.parse(editableText) as ReturnType<typeof createSourceHostCooldownEditable>;
      expect(saved.originalCapture).toEqual(capture);
      expect(saved.input.operation === "duration" && saved.input.originalDuration).toBe(editedDuration);
      expect(calculateSourceHostCooldownEditable(saved).value).toBe(edited.value);
      await editor.locator("[data-source-host-cooldown-import]").setInputFiles({ name: "source-cooldown-edit.json",
        mimeType: "application/json", buffer: Buffer.from(editableText) });
      await expect(page.locator('[data-source-host-cooldown-input="originalDuration"]')).toHaveValue(String(editedDuration));
      await expect(page.locator("[data-source-host-cooldown-result]")).toHaveText(editedText);
      measurement.cooldownEdit = { calculationId: selected.request.id, originalValue: edited.originalValue,
        editedValue: edited.value, restoredResult: String(edited.value) };
    }
  }

  for (const variant of ["classic", "stellar"] as const) for (const operation of ["duration", "remaining"] as const)
    expect(evidence.filter(run => run.variant === variant).reduce((sum, run) => sum + (run.cooldownOperations[operation] ?? 0), 0),
      `${variant} must observe native ${operation} cooldown arithmetic`).toBeGreaterThan(0);

  expect(pageErrors).toEqual([]);
  await writeFile(resolve("docs/validation/source-auxiliary-formulas-20260928.result.json"), `${JSON.stringify({
    schemaVersion: "source-auxiliary-validation-v1", runs: evidence, pageErrors,
  }, null, 2)}\n`);
  console.log(JSON.stringify({ runs: evidence.map(({ variant, scenario, healingApplications, healingStages,
    cooldownOperations, auxiliaryRules, consumers, healingEdit, cooldownEdit }) => ({ variant, scenario,
    healingApplications, healingStages, cooldownOperations, auxiliaryRules, consumers, healingEdit, cooldownEdit })), pageErrors }));
});
