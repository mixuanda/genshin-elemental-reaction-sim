import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  calculateSourceHostEditableCalculation, captureSourceHostHit, deriveSourceHostArtifactScalarEdit, replaySourceHostHit,
} from "../../../packages/sim-core/src/source-host-capture";
import { sourceHostArtifactSupportIds } from "../../../packages/sim-core/src/source-host-artifact-support";
import { sourceHostArtifactConstantRules } from "../../../packages/sim-core/src/source-host-artifact-constant-formula";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT,
  type SourceHostCalculationRecord, type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";

// Kaeya leaves Cryo on the target for Blizzard's conditional AttackMod. Oz's
// first Electro hit then triggers Instructor while Fischl is active. Bennett Q
// and Barbara E/normal read the two team buffs and Ocean's healing vector.
const config = `options iteration=1 duration=12;
kaeya char lvl=90/90 cons=0 talent=1,1,1;
kaeya add weapon="favoniussword" refine=1 lvl=90/90;
kaeya add set="blizzardstrayer" count=4;
kaeya add stats atk=200 cr=0.2 cd=0.4;
fischl char lvl=90/90 cons=0 talent=1,1,1;
fischl add weapon="favoniuswarbow" refine=1 lvl=90/90;
fischl add set="instructor" count=4;
fischl add stats atk=200 em=100 cr=0.2 cd=0.4;
bennett char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
bennett add weapon="favoniussword" refine=1 lvl=90/90;
bennett add set="noblesseoblige" count=4;
bennett add stats atk=200 cr=0.2 cd=0.4;
barbara char lvl=90/90 cons=0 talent=1,1,1;
barbara add weapon="magicguide" refine=1 lvl=90/90;
barbara add set="oceanhuedclam" count=2;
barbara add stats atk=200 hp=200 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active kaeya;
kaeya skill;
kaeya attack;
fischl skill;
bennett burst;
barbara skill;
barbara attack:3;
wait(300);`;

type ArtifactRecord = SourceHostCalculationRecord & {
  request: Extract<SourceHostCalculationRecord["request"], { kind: "artifact-scalar" }>;
};

function rule(set: string, piece: "2pc" | "4pc", statIndex: number, value: number): string {
  const matches = Object.entries(sourceHostArtifactConstantRules).filter(([id, descriptor]) =>
    descriptor.set === set && id.includes(`-${piece}-`) && descriptor.statIndex === statIndex && descriptor.value === value,
  );
  if (matches.length !== 1) throw new Error(`Expected one registry rule for ${set}/${piece}/stat${statIndex}/${value}; found ${matches.length}`);
  return matches[0]![0];
}

test("native constant artifact modifiers link their actual recipients and target conditions to an editable restored hit", async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const rules = {
    blizzardCryo: rule("blizzard", "4pc", 9, 0.2),
    instructorTeam: rule("instructor", "4pc", 8, 120),
    noblesseTeam: rule("noblesse", "4pc", 6, 0.2),
    oceanHealing: rule("oceanhuedclam", "2pc", 11, 0.15),
  };
  const evidence: Array<{
    variant: "classic" | "stellar"; result: SourceHostResult; observedRuleCounts: Record<string, number>;
    teamRecipients: { instructor: string[]; noblesse: string[] };
    blizzard: { id: number; value: number; targetKey: number; hitId: number };
    selectedHitIndex: number; capture: ReturnType<typeof captureSourceHostHit>;
    supportedConstants: Array<{ id: number; ruleId: string; value: number; sourceRefs: string[] }>;
    calculator: unknown; originalDamage: number; editedDamage: number;
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
    // Preserve each full source receipt before any later assertion can fail.
    await writeFile(resolve(`docs/validation/source-artifact-constants-${variant}-20260928.result.json`), resultText);
    const result = JSON.parse(resultText) as SourceHostResult;
    expect(result.sourceCommit).toBe(variant === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT);
    expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.config).toBe(config);
    const byId = new Map(result.calculations.map(row => [row.request.id, row]));
    const calls = result.calculations.filter((row): row is ArtifactRecord => row.request.kind === "artifact-scalar" && row.request.input.ruleId.startsWith("const-"));
    const observedRuleCounts = Object.fromEntries([...new Set(calls.map(row => row.request.input.ruleId))]
      .map(id => [id, calls.filter(row => row.request.input.ruleId === id).length]));
    for (const id of Object.values(rules)) expect(observedRuleCounts[id], `Missing actual ${id} callback`).toBeGreaterThan(0);
    expect(calls.filter(row => row.request.input.ruleId === rules.instructorTeam && row.request.actorKey === "barbara").every(row => row.value === 120)).toBe(true);
    expect(calls.some(row => row.request.input.ruleId === rules.instructorTeam && row.request.actorKey === "barbara")).toBe(true);
    expect(calls.some(row => row.request.input.ruleId === rules.noblesseTeam && row.request.actorKey === "barbara" && row.value === 0.2)).toBe(true);
    expect(calls.some(row => row.request.input.ruleId === rules.oceanHealing && row.request.actorKey === "barbara" && row.value === 0.15)).toBe(true);
    const teamRecipients = {
      instructor: [...new Set(calls.filter(row => row.request.input.ruleId === rules.instructorTeam).map(row => row.request.actorKey))],
      noblesse: [...new Set(calls.filter(row => row.request.input.ruleId === rules.noblesseTeam).map(row => row.request.actorKey))],
    };
    expect(teamRecipients.instructor).toContain("barbara");
    expect(teamRecipients.noblesse).toContain("barbara");

    // The Cryo-only CR vector must be consumed by Kaeya's physical normal
    // against that actual target, not merely exist somewhere in the run.
    const blizzardHit = result.applications.find(application => {
      const calculation = byId.get(application.calculationId);
      return calculation?.request.kind === "damage" && calculation.request.actorKey === "kaeya" &&
        calculation.request.attackTag === 1 && sourceHostArtifactSupportIds(calculation.request)
          .some(id => byId.get(id)?.request.kind === "artifact-scalar" &&
            (byId.get(id) as ArtifactRecord).request.input.ruleId === rules.blizzardCryo);
    });
    expect(blizzardHit, "Kaeya normal did not consume the Cryo-target Blizzard vector").toBeDefined();
    const blizzardCalculation = byId.get(blizzardHit!.calculationId)!;
    const blizzardId = sourceHostArtifactSupportIds(blizzardCalculation.request).find(id =>
      byId.get(id)?.request.kind === "artifact-scalar" && (byId.get(id) as ArtifactRecord).request.input.ruleId === rules.blizzardCryo,
    )!;
    const blizzard = byId.get(blizzardId) as ArtifactRecord;
    expect(blizzard.value).toBe(0.2);
    expect(blizzard.request.targetKey).toBe(blizzardHit!.targetKey);

    // Barbara's later normal reads all three applicable constants through
    // actual recipient stat getters. Its one capture carries their receipts.
    const selectedHitIndex = result.applications.findIndex(application => {
      const calculation = byId.get(application.calculationId);
      if (calculation?.request.kind !== "damage" || calculation.request.actorKey !== "barbara" || calculation.request.attackTag !== 1) return false;
      const ids = new Set<string>(sourceHostArtifactSupportIds(calculation.request).map(id => {
        const record = byId.get(id);
        return record?.request.kind === "artifact-scalar" ? record.request.input.ruleId : "";
      }));
      return [rules.instructorTeam, rules.noblesseTeam, rules.oceanHealing].every(id => ids.has(id));
    });
    expect(selectedHitIndex, "No Barbara hit consumed team EM, team ATK, and Ocean healing vector").toBeGreaterThanOrEqual(0);
    const selected = result.applications[selectedHitIndex]!;
    const capture = captureSourceHostHit(result, selected.id);
    const replay = replaySourceHostHit(capture);
    expect(replay.difference).toBe(0);
    const support = capture.supportingCalculations?.filter((row): row is ArtifactRecord =>
      row.request.kind === "artifact-scalar" && row.request.input.ruleId.startsWith("const-")) ?? [];
    const supportedConstants = support.map(row => {
      const id = `artifactScalar.${row.request.id}.${row.request.input.ruleId}`;
      const node = replay.trace.find(item => item.id === id);
      expect(node, `Missing shared AST node ${id}`).toBeDefined();
      expect(node!.sourceRefs.some(ref => ref.includes(result.sourceCommit))).toBe(true);
      const derived = deriveSourceHostArtifactScalarEdit(capture, row.request.id, row.request.input);
      expect(derived.status).toBe("calculated");
      expect(derived.originalValue).toBe(row.value);
      expect(derived.editedValue).toBe(row.value);
      if (derived.status === "calculated") expect(derived.editedRawDamage).toBe(capture.application.rawDamage);
      return { id: row.request.id, ruleId: row.request.input.ruleId, value: row.value, sourceRefs: node!.sourceRefs };
    });
    for (const id of [rules.instructorTeam, rules.noblesseTeam, rules.oceanHealing]) {
      expect(supportedConstants.some(row => row.ruleId === id)).toBe(true);
    }

    await page.locator("#source-host-import").setInputFiles({
      name: `source-artifact-constants-${variant}.json`, mimeType: "application/json", buffer: Buffer.from(resultText),
    });
    await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
    await page.locator("#source-host-hit-index").fill(String(selectedHitIndex));
    await expect(page.locator("#source-host-hit")).toContainText("差值 0");
    await page.locator("#source-host-open-calculator").click();
    await expect(page).toHaveURL(/\/calculator$/);
    await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
    for (const row of supportedConstants) {
      const card = page.locator(`[data-source-host-artifact-id="${row.id}"]`);
      await expect(card).toContainText("此项为固定常量，没有可编辑的状态变量");
      await expect(card.locator("[data-source-host-artifact-result]")).toContainText(`实验值 ${row.value}`);
      expect(await card.locator("[data-source-host-artifact-state]").count()).toBe(0);
      await expect(page.locator(`[data-trace-node="artifactScalar.${row.id}.${row.ruleId}"]`).first()).toBeVisible();
    }

    const heading = page.locator("[data-source-host-calculation-result] h3");
    const originalDamage = Number((await heading.textContent())?.match(/公式伤害：([^\s]+)/)?.[1]);
    expect(Number.isFinite(originalDamage)).toBe(true);
    const scaling = page.locator('[data-source-host-input="scaling"]');
    const originalScaling = Number(await scaling.inputValue());
    await scaling.fill(String(originalScaling * 2));
    await expect(heading).toContainText("编辑后");
    const editedHeading = (await heading.textContent()) ?? "";
    const editedDamage = Number(editedHeading.match(/公式伤害：([^\s]+)/)?.[1]);
    expect(Number.isFinite(editedDamage)).toBe(true);
    expect(editedDamage).not.toBe(originalDamage);

    const calculatorDownload = page.waitForEvent("download");
    await page.locator("[data-source-host-export]").click();
    const calculatorText = await readFile((await (await calculatorDownload).path())!, "utf8");
    const calculator = JSON.parse(calculatorText) as {
      originalCapture: typeof capture; request: typeof capture.calculation.request; artifactExperiments?: unknown[];
    };
    expect(calculator.originalCapture).toEqual(capture);
    expect(calculator.artifactExperiments ?? []).toEqual([]);
    expect(calculator.request.input.scaling).toBe(originalScaling * 2);
    expect(calculateSourceHostEditableCalculation(calculator).value).toBe(editedDamage);
    await page.locator("#calc-source-host-close").click();
    await page.locator("#calc-import").setInputFiles({
      name: `source-artifact-constants-${variant}-calculator.json`, mimeType: "application/json", buffer: Buffer.from(calculatorText),
    });
    await expect(page.locator("[data-source-host-calculation-result] h3")).toHaveText(editedHeading);
    await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");

    evidence.push({ variant, result, observedRuleCounts, teamRecipients,
      blizzard: { id: blizzardId, value: blizzard.value, targetKey: blizzard.request.targetKey, hitId: blizzardHit!.id },
      selectedHitIndex, capture, supportedConstants, calculator, originalDamage, editedDamage,
    });
  }

  expect(errors).toEqual([]);
  await writeFile(resolve("docs/validation/source-artifact-constants-20260928.result.json"), `${JSON.stringify({
    schemaVersion: "source-artifact-constants-validation-v1", config, rules, runs: evidence, pageErrors: errors,
  }, null, 2)}\n`);
  console.log(JSON.stringify({ rules, runs: evidence.map(row => ({ variant: row.variant,
    sourceCommit: row.result.sourceCommit, wasmSha256: row.result.executionArtifact?.wasmSha256,
    calculations: row.result.calculations.length, applications: row.result.applications.length,
    observedRuleCounts: row.observedRuleCounts, teamRecipients: row.teamRecipients,
    blizzardHitId: row.blizzard.hitId, selectedHitIndex: row.selectedHitIndex,
    supportCount: row.supportedConstants.length, originalDamage: row.originalDamage, editedDamage: row.editedDamage,
  })), errors }));
});
