import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { captureSourceHostHit, replaySourceHostHit } from "../../../packages/sim-core/src/source-host-capture";
import { deriveSourceHostWeaponAdditiveEdit } from "../../../packages/sim-core/src/source-host-weapon-capture";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT,
  type SourceHostCalculationRecord, type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";

// Each weapon is equipped by its real owner. Close targets exercise the Go
// OnEnemyHit callback per target; the first Foliar/Hunter callback opens its
// window but does not yet add FlatDmg or spend a count.
const config = `options iteration=1 duration=16;
alhaitham char lvl=90/90 cons=0 talent=1,1,1;
alhaitham add weapon="lightoffoliarincision" refine=1 lvl=90/90;
alhaitham add stats atk=200 em=200 cr=0.2 cd=0.4;
tighnari char lvl=90/90 cons=0 talent=1,1,1;
tighnari add weapon="hunterspath" refine=1 lvl=90/90;
tighnari add stats atk=200 em=200 cr=0.2 cd=0.4;
albedo char lvl=90/90 cons=0 talent=1,1,1;
albedo add weapon="cinnabarspindle" refine=1 lvl=90/90;
albedo add stats atk=200 def=200 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
target lvl=90 resist=0.1 radius=2 pos=0.6,2.4;
active alhaitham;
alhaitham skill;
alhaitham attack:3;
tighnari aim:2;
albedo skill;
wait(120);`;

type WeaponRecord = SourceHostCalculationRecord & {
  request: Extract<SourceHostCalculationRecord["request"], { kind: "weapon-additive" }>;
};
type RuleId = WeaponRecord["request"]["input"]["ruleId"];
const ruleIds = ["foliar", "hunterspath", "cinnabar"] as const satisfies readonly RuleId[];

function numericScalar(text: string, label: string): number {
  const match = text.match(new RegExp(`${label}\\s*([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?)`, "i"));
  if (!match) throw new Error(`Missing ${label} numeric scalar in weapon card: ${text}`);
  const value = Number(match[1]);
  if (!Number.isFinite(value)) throw new Error(`Invalid ${label} scalar in weapon card: ${text}`);
  return value;
}

test("three finite weapon FlatDmg callbacks retain native target state and editable standalone receipts in both pinned lanes", async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const evidence: Array<{
    variant: "classic" | "stellar"; result: SourceHostResult;
    calls: Array<{ id: number; ruleId: RuleId; value: number; targetKey: number; remainingBefore?: number | undefined; remainingAfter?: number | undefined }>;
    selectedHitIndex: number; selectedApplicationId: number; selectedWeaponId: number;
    originalValue: number; editedValue: number; originalRawDamage: number;
    editedRawDamage?: number; experimentStatus: "calculated" | "blocked"; reason?: string;
    calculator: unknown; uiResultText: string;
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
    // Keep the unmodified native receipts even if a later UI assertion fails.
    await writeFile(resolve(`docs/validation/source-finite-weapon-formulas-${variant}-20260928.intermediate.json`), resultText);
    const result = JSON.parse(resultText) as SourceHostResult;
    expect(result.sourceCommit).toBe(variant === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT);
    expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.config).toBe(config);
    const byId = new Map(result.calculations.map(row => [row.request.id, row]));
    const calls = result.calculations.filter((row): row is WeaponRecord => row.request.kind === "weapon-additive");
    expect([...new Set(calls.map(row => row.request.input.ruleId))]).toEqual(expect.arrayContaining([...ruleIds]));
    expect(new Set(result.applications.map(row => row.targetKey)).size).toBeGreaterThanOrEqual(2);

    for (const call of calls) {
      const { request } = call;
      expect(request.damageCategory).toBe("weapon-additive");
      expect(request.snapshot).toBeNull();
      expect(request.snapshotStats).toBeNull();
      expect(request.componentIds).toEqual([]);
      expect(request.componentApplications).toEqual([]);
      expect(request.statRead).toBeDefined();
      expect(Number.isInteger(request.weaponState.buffExpiry)).toBe(true);
      expect(Number.isInteger(request.weaponState.cooldownExpiry)).toBe(true);
      if (request.input.ruleId === "cinnabar") {
        expect(request.weaponState.remainingBefore).toBeUndefined();
        expect(request.weaponState.remainingAfter).toBeUndefined();
      } else {
        expect(request.weaponState.remainingBefore).toBeGreaterThan(0);
        expect(request.weaponState.remainingAfter).toBe(request.weaponState.remainingBefore! - 1);
      }
    }

    // The native callback has a real consumer: the ordinary damage request
    // cites the scalar by ID, carries multiplier 1, and retains its value.
    const consumers = result.applications.flatMap((application, hitIndex) => {
      const calculation = byId.get(application.calculationId);
      if (calculation?.request.kind !== "damage") return [];
      expect(application.rawDamage).toBe(calculation.value);
      return [{ application, hitIndex, calculation }];
    });
    for (const ruleId of ruleIds) {
      expect(consumers.some(({ calculation }) => calculation.request.componentIds.some(id =>
        byId.get(id)?.request.kind === "weapon-additive" &&
        (byId.get(id) as WeaponRecord).request.input.ruleId === ruleId,
      )), `No actual damage consumed ${ruleId}`).toBe(true);
    }
    for (const { calculation } of consumers) {
      for (const id of calculation.request.componentIds) {
        const weapon = byId.get(id);
        if (weapon?.request.kind !== "weapon-additive") continue;
        expect(calculation.request.componentApplications).toContainEqual({ id, multiplier: 1, amount: weapon.value });
        expect(weapon.request.targetKey).toBe(calculation.request.targetKey);
        expect(weapon.request.attackId).toBe(calculation.request.attackId);
      }
    }

    // Activation is per target callback, not per attackId: the first eligible
    // normal/aimed hit has no weapon scalar; a later actual hit does.
    for (const [actorKey, tag, ruleId] of [["alhaitham", 1, "foliar"], ["tighnari", 2, "hunterspath"]] as const) {
      const eligible = consumers.filter(({ calculation }) => calculation.request.actorKey === actorKey && calculation.request.attackTag === tag);
      expect(eligible.length, `${actorKey} produced no eligible damage`).toBeGreaterThan(1);
      const hasRule = (row: (typeof eligible)[number]): boolean => row.calculation.request.componentIds.some(id => {
        const record = byId.get(id);
        return record?.request.kind === "weapon-additive" && record.request.input.ruleId === ruleId;
      });
      expect(hasRule(eligible[0]!)).toBe(false);
      expect(eligible.slice(1).some(hasRule), `${ruleId} never added after activation`).toBe(true);
    }
    const multiTargetWeapon = new Set(calls.map(row => row.request.targetKey));
    expect(multiTargetWeapon.size, "weapon callbacks did not cover both actual targets").toBeGreaterThanOrEqual(2);

    const selected = consumers.find(({ calculation }) => calculation.request.componentIds.some(id => {
      const record = byId.get(id);
      return record?.request.kind === "weapon-additive" && record.request.input.ruleId === "foliar";
    }));
    expect(selected).toBeDefined();
    const selectedHitIndex = selected!.hitIndex;
    const selectedWeaponId = selected!.calculation.request.componentIds.find(id => {
      const record = byId.get(id);
      return record?.request.kind === "weapon-additive" && record.request.input.ruleId === "foliar";
    })!;
    const capture = captureSourceHostHit(result, selected!.application.id);
    expect(replaySourceHostHit(capture).difference).toBe(0);
    expect(capture.components.some(row => row.request.id === selectedWeaponId && row.request.kind === "weapon-additive")).toBe(true);
    const sourceWeapon = byId.get(selectedWeaponId) as WeaponRecord;
    const editedInput = { ...sourceWeapon.request.input, statValue: sourceWeapon.request.input.statValue + 100 };
    const experiment = deriveSourceHostWeaponAdditiveEdit(capture, selectedWeaponId, editedInput);
    expect(experiment.originalValue).toBe(sourceWeapon.value);
    expect(experiment.editedValue).not.toBe(experiment.originalValue);
    if (experiment.status !== "calculated") throw new Error(`Ordinary Foliar hit did not replay its edited FlatDmg: ${experiment.reason}`);
    expect(experiment.editedRawDamage).not.toBe(experiment.originalRawDamage);

    await page.locator("#source-host-import").setInputFiles({
      name: `source-finite-weapon-${variant}.json`, mimeType: "application/json", buffer: Buffer.from(resultText),
    });
    await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
    await page.locator("#source-host-hit-index").fill(String(selectedHitIndex));
    await expect(page.locator("#source-host-hit")).toContainText("差值 0");
    await page.locator("#source-host-open-calculator").click();
    await expect(page).toHaveURL(/\/calculator$/);
    await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
    const weaponCard = page.locator(`[data-source-host-weapon-id="${selectedWeaponId}"]`);
    const statField = weaponCard.locator('[data-source-host-weapon-state="statValue"]');
    await expect(statField).toHaveValue(String(sourceWeapon.request.input.statValue));
    const resultHost = weaponCard.locator("[data-source-host-weapon-result]");
    const originalUi = (await resultHost.textContent()) ?? "";
    expect(numericScalar(originalUi, "原附加基伤")).toBe(experiment.originalValue);
    await statField.fill(String(editedInput.statValue));
    await expect(resultHost).toContainText(String(experiment.editedValue));
    const uiResultText = (await resultHost.textContent()) ?? "";
    expect(numericScalar(uiResultText, "实验附加基伤")).toBe(experiment.editedValue);
    expect(numericScalar(uiResultText, "公式伤害")).toBe(experiment.editedRawDamage);

    const calculatorDownload = page.waitForEvent("download");
    await page.locator("[data-source-host-export]").click();
    const calculatorText = await readFile((await (await calculatorDownload).path())!, "utf8");
    const calculator = JSON.parse(calculatorText) as {
      originalCapture: typeof capture;
      weaponExperiments?: Array<{ calculationId: number; input: typeof editedInput }>;
    };
    expect(calculator.originalCapture).toEqual(capture);
    expect(calculator.originalCapture.components.find(row => row.request.id === selectedWeaponId)?.value).toBe(sourceWeapon.value);
    expect(calculator.weaponExperiments).toEqual([{ calculationId: selectedWeaponId, input: editedInput }]);
    await page.locator("#calc-source-host-close").click();
    await page.locator("#calc-import").setInputFiles({
      name: `source-finite-weapon-${variant}-calculator.json`, mimeType: "application/json", buffer: Buffer.from(calculatorText),
    });
    const restored = page.locator(`[data-source-host-weapon-id="${selectedWeaponId}"]`);
    await expect(restored.locator('[data-source-host-weapon-state="statValue"]')).toHaveValue(String(editedInput.statValue));
    await expect(restored.locator("[data-source-host-weapon-result]")).toHaveText(uiResultText);
    await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");

    evidence.push({ variant, result,
      calls: calls.map(row => ({ id: row.request.id, ruleId: row.request.input.ruleId, value: row.value,
        targetKey: row.request.targetKey, remainingBefore: row.request.weaponState.remainingBefore,
        remainingAfter: row.request.weaponState.remainingAfter })),
      selectedHitIndex, selectedApplicationId: selected!.application.id, selectedWeaponId,
      originalValue: experiment.originalValue, editedValue: experiment.editedValue,
      originalRawDamage: experiment.originalRawDamage, editedRawDamage: experiment.editedRawDamage,
      experimentStatus: experiment.status, calculator, uiResultText,
    });
  }

  expect(errors).toEqual([]);
  await writeFile(resolve("docs/validation/source-finite-weapon-formulas-20260928.result.json"), `${JSON.stringify({
    schemaVersion: "source-finite-weapon-validation-v1", config, runs: evidence, pageErrors: errors,
  }, null, 2)}\n`);
  console.log(JSON.stringify({ runs: evidence.map(row => ({ variant: row.variant,
    sourceCommit: row.result.sourceCommit, wasmSha256: row.result.executionArtifact?.wasmSha256,
    calculations: row.result.calculations.length, applications: row.result.applications.length,
    weaponCalls: Object.fromEntries(ruleIds.map(rule => [rule, row.calls.filter(call => call.ruleId === rule).length])),
    selectedApplicationId: row.selectedApplicationId, originalValue: row.originalValue,
    editedValue: row.editedValue, experimentStatus: row.experimentStatus,
  })), errors }));
});
