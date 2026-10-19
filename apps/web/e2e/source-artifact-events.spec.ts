import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { captureSourceHostHit, replaySourceHostHit } from "../../../packages/sim-core/src/source-host-capture";
import { deriveSourceHostArtifactAdditiveEdit } from "../../../packages/sim-core/src/source-host-artifact-additive-capture";
import { resolveSourceHostArtifactAdditiveInput } from "../../../packages/sim-core/src/source-host-artifact-additive-formula";
import { sourceHostStatProvenanceSchema } from "../../../packages/sim-core/src/source-host-stat-provenance";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT,
  type SourceHostCalculationRecord, type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";

// Three native set owners share two nearby enemies. Barbara Q opens Song's
// six-second healing window, Kokomi's jellyfish opens an OHC bubble, and
// Keqing's repeated normals give Echoes actual random attempts and consume
// Song's later charges. All healing remains a real character action.
const healingConfig = `options iteration=1 duration=20;
barbara char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
barbara add weapon="magicguide" refine=1 lvl=90/90;
barbara add set="songofdayspast" count=4;
barbara add stats hp=4000 cr=0.2 cd=0.4;
kokomi char lvl=90/90 cons=0 talent=1,1,1;
kokomi add weapon="magicguide" refine=1 lvl=90/90;
kokomi add set="oceanhuedclam" count=4;
kokomi add stats hp=4000 cr=0.2 cd=0.4;
keqing char lvl=90/90 cons=0 talent=1,1,1;
keqing add weapon="favoniussword" refine=1 lvl=90/90;
keqing add set="echoesofanoffering" count=4;
keqing add stats atk=200 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
target lvl=90 resist=0.1 radius=2 pos=0.6,2.4;
active kokomi;
kokomi skill;
barbara burst;
keqing attack:6;
wait(360);
keqing attack:6;
wait(120);`;

// The a7 source example establishes Odette E -> Cryo Swirl -> Odette recast
// as a real Stellar path. Kaeya refreshes Cryo before Sucrose's Swirl and
// owns Blizzard's target-conditioned direct snapshot CR modification.
const stellarConfig = `options iteration=1 duration=16;
odette char lvl=90/90 cons=0 talent=1,1,1;
odette add weapon="magicguide" refine=1 lvl=90/90;
odette add set="heartofthefurnace" count=4;
odette add stats atk=200 em=100 cr=0.2 cd=0.4;
sucrose char lvl=90/90 cons=0 talent=1,1,1;
sucrose add weapon="magicguide" refine=1 lvl=90/90;
sucrose add set="scarletproof" count=4;
sucrose add stats atk=200 em=100 cr=0.2 cd=0.4;
kaeya char lvl=90/90 cons=0 talent=1,1,1;
kaeya add weapon="favoniussword" refine=1 lvl=90/90;
kaeya add set="blizzardstrayer" count=4;
kaeya add stats atk=200 cr=0.2 cd=0.4;
fischl char lvl=90/90 cons=0 talent=1,1,1;
fischl add weapon="favoniuswarbow" refine=1 lvl=90/90;
fischl add set="disenchantmentindeepshadow" count=4;
fischl add stats atk=200 em=100 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
target lvl=90 resist=0.1 radius=2 pos=0.6,2.4;
active odette;
odette skill;
kaeya skill;
sucrose skill;
odette skill;
sucrose attack:3;
fischl skill;
odette attack:3;
wait(300);`;

type AdditiveRecord = SourceHostCalculationRecord & {
  request: Extract<SourceHostCalculationRecord["request"], { kind: "artifact-additive" }>;
};
type DamageRecord = SourceHostCalculationRecord & {
  request: Extract<SourceHostCalculationRecord["request"], { kind: "damage" }>;
};
type Scenario = { variant: "classic" | "stellar"; name: "healing" | "stellar"; config: string };
const scenarios: Scenario[] = [
  { variant: "classic", name: "healing", config: healingConfig },
  { variant: "stellar", name: "healing", config: healingConfig },
  { variant: "stellar", name: "stellar", config: stellarConfig },
];
const factor = { echoes: 0.7, songofdayspast: 0.08, oceanhuedclam: 0.9 } as const;
const stellarRules = [
  "dynamic-heart-of-the-furnace-2pc-atkp", "dynamic-heart-of-the-furnace-4pc-atkp",
  "dynamic-heart-of-the-furnace-4pc-stellar-react", "dynamic-scarletproof-2pc-atkp",
  "dynamic-scarletproof-4pc-cr", "dynamic-scarletproof-4pc-stellar-swirl",
] as const;

test("real source artifact healing, random damage, queued foam, and Stellar snapshot receipts restore in one calculator", async ({ page }) => {
  test.setTimeout(400000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const measurements: Array<{
    variant: Scenario["variant"]; scenario: Scenario["name"]; sourceCommit: string; wasmSha256?: string | undefined;
    calculations: number; applications: number; ruleCounts: Record<string, number>;
    additive?: Array<{ id: number; ruleId: keyof typeof factor; sourceValue: number; value: number;
      componentScope: string; frame: number; consumerIds: number[]; targetKeys: number[] }>;
    echoesPaths?: Record<string, number>; songRemaining?: number[];
    ohcQueue?: { id: number; sourceFrame: number; consumerFrames: number[]; targetKeys: number[]; queueDelayFrames: number };
    editedHit?: { applicationId: number; calculationId: number; originalValue: number; editedValue: number;
      originalDamage: number; editedDamage: number; restoredText: string };
    snapshot?: { effectSourceActorIndex: number; beneficiaryActorIndex: number; targetKey?: number | undefined;
      calculationId: number; terminalCalculationId: number; terminalApplicationId: number;
      scalarIds: number[]; statStepKeys: string[]; replayDifference: number };
    disenchantmentSnapshotCount?: number;
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
    const resultText = await readFile((await (await pending).path())!, "utf8");
    // Preserve the complete native receipt before any later browser assertion.
    await writeFile(resolve(`docs/validation/source-artifact-events-${scenario.variant}-${scenario.name}-20260928.result.json`), resultText);
    const result = JSON.parse(resultText) as SourceHostResult;
    expect(result.sourceCommit).toBe(scenario.variant === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT);
    expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.config).toBe(scenario.config);
    const byId = new Map(result.calculations.map(row => [row.request.id, row]));
    const ruleCounts: Record<string, number> = {};
    for (const row of result.calculations) {
      if (row.request.kind !== "artifact-additive" && row.request.kind !== "artifact-scalar") continue;
      ruleCounts[row.request.input.ruleId] = (ruleCounts[row.request.input.ruleId] ?? 0) + 1;
    }
    const measurement: (typeof measurements)[number] = {
      variant: scenario.variant, scenario: scenario.name, sourceCommit: result.sourceCommit,
      wasmSha256: result.executionArtifact?.wasmSha256, calculations: result.calculations.length,
      applications: result.applications.length, ruleCounts,
    };

    if (scenario.name === "healing") {
      const additives = result.calculations.filter((row): row is AdditiveRecord => row.request.kind === "artifact-additive");
      for (const ruleId of Object.keys(factor) as Array<keyof typeof factor>) {
        expect(additives.some(row => row.request.input.ruleId === ruleId), `No native ${ruleId} additive callback`).toBe(true);
      }
      const damageHits = result.applications.flatMap((application, hitIndex) => {
        const row = byId.get(application.calculationId);
        return row?.request.kind === "damage" ? [{ application, hitIndex, row: row as DamageRecord }] : [];
      });
      const additiveMeasures = additives.map(additive => {
        const request = additive.request;
        const ruleId = request.input.ruleId;
        expect(request.snapshot).toBeNull();
        expect(request.snapshotStats).toBeNull();
        expect(request.componentIds).toEqual([]);
        expect(request.componentApplications).toEqual([]);
        expect(additive.value).toBeCloseTo(request.input.sourceValue * factor[ruleId], 9);
        expect(resolveSourceHostArtifactAdditiveInput(request.input, result.sourceCommit).value).toBeCloseTo(additive.value, 9);
        const consumers = damageHits.filter(({ row }) => row.request.componentApplications.some(component => component.id === request.id));
        expect(consumers.length, `No damage used additive #${request.id}`).toBeGreaterThan(0);
        for (const { application, row } of consumers) {
          expect(row.request.componentIds).toContain(request.id);
          expect(row.request.componentApplications).toContainEqual({ id: request.id, multiplier: 1, amount: additive.value });
          expect(application.rawDamage).toBe(row.value);
          if (ruleId !== "oceanhuedclam") {
            expect(request.componentScope).toBe("same-hit");
            expect(request.frame).toBe(application.frame);
            expect(request.attackId).toBe(application.attackId);
            expect(request.targetKey).toBe(application.targetKey);
          } else {
            expect(request.componentScope).toBe("queued-attack");
            expect(application.frame).toBe(request.frame + 1);
          }
        }
        return { id: request.id, ruleId, sourceValue: request.input.sourceValue, value: additive.value,
          componentScope: request.componentScope, frame: request.frame, consumerIds: consumers.map(row => row.application.id),
          targetKeys: [...new Set(consumers.map(row => row.application.targetKey))] };
      });
      measurement.additive = additiveMeasures;
      measurement.echoesPaths = Object.fromEntries(["rolled-proc", "active-window"].map(path => [path,
        additives.filter(row => row.request.artifactState.ruleId === "echoes" && row.request.artifactState.path === path).length]));
      measurement.songRemaining = additives.flatMap(row => row.request.artifactState.ruleId === "songofdayspast"
        ? [row.request.artifactState.remainingBefore] : []);
      expect(measurement.echoesPaths!["rolled-proc"]).toBeGreaterThan(0);
      expect(measurement.songRemaining!.length).toBeGreaterThan(0);
      const foam = additives.find(row => row.request.input.ruleId === "oceanhuedclam")!;
      const foamUses = damageHits.filter(({ row }) => row.request.componentIds.includes(foam.request.id));
      expect(new Set(foamUses.map(row => row.application.targetKey)).size).toBeGreaterThanOrEqual(2);
      if (foam.request.artifactState.ruleId !== "oceanhuedclam") throw new Error("OHC native state discriminator lost");
      expect(foam.request.artifactState.queueDelayFrames).toBe(1);
      measurement.ohcQueue = { id: foam.request.id, sourceFrame: foam.request.frame,
        consumerFrames: foamUses.map(row => row.application.frame),
        targetKeys: [...new Set(foamUses.map(row => row.application.targetKey))],
        queueDelayFrames: foam.request.artifactState.queueDelayFrames };

      // One actual normal with Echoes is enough to prove independent numeric
      // editing and JSON restoration; historical random draws stay frozen.
      if (scenario.variant === "classic") {
        const selected = damageHits.find(({ row }) => row.request.componentIds.some(id =>
          byId.get(id)?.request.kind === "artifact-additive" &&
          (byId.get(id) as AdditiveRecord).request.input.ruleId === "echoes"));
        expect(selected).toBeDefined();
        const component = additives.find(row => selected!.row.request.componentIds.includes(row.request.id) && row.request.input.ruleId === "echoes")!;
        const capture = captureSourceHostHit(result, selected!.application.id);
        expect(replaySourceHostHit(capture).difference).toBe(0);
        const editedInput = { ruleId: "echoes" as const, sourceValue: component.request.input.sourceValue + 100 };
        const edit = deriveSourceHostArtifactAdditiveEdit(capture, component.request.id, editedInput);
        expect(edit.status).toBe("calculated");
        if (edit.status !== "calculated") throw new Error(edit.reason);
        expect(edit.editedValue).toBeCloseTo(component.value + 70, 9);
        expect(edit.editedRawDamage).not.toBe(edit.originalRawDamage);
        await page.locator("#source-host-import").setInputFiles({ name: "source-artifact-events-native.json",
          mimeType: "application/json", buffer: Buffer.from(resultText) });
        await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
        await page.locator("#source-host-hit-index").fill(String(selected!.hitIndex));
        await expect(page.locator("#source-host-hit")).toContainText("差值 0");
        await page.locator("#source-host-open-calculator").click();
        await expect(page).toHaveURL(/\/calculator$/);
        await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
        const card = page.locator(`[data-source-host-artifact-additive-id="${component.request.id}"]`);
        await expect(card.locator("[data-source-host-artifact-window]")).toBeVisible();
        const sourceValueInput = card.locator('[data-source-host-artifact-additive-state="sourceValue"]');
        await expect(sourceValueInput).toHaveValue(String(component.request.input.sourceValue));
        await sourceValueInput.fill(String(editedInput.sourceValue));
        await expect(card.locator("[data-source-host-artifact-additive-result]")).toContainText(`实验公式值 ${edit.editedValue}`);
        const editedText = (await card.locator("[data-source-host-artifact-additive-result]").textContent()) ?? "";
        const calcPending = page.waitForEvent("download");
        await page.locator("[data-source-host-export]").click();
        const calculatorText = await readFile((await (await calcPending).path())!, "utf8");
        const calculator = JSON.parse(calculatorText) as {
          originalCapture: typeof capture;
          artifactAdditiveExperiments?: Array<{ calculationId: number; input: typeof editedInput }>;
        };
        expect(calculator.originalCapture).toEqual(capture);
        expect(calculator.artifactAdditiveExperiments).toContainEqual({ calculationId: component.request.id, input: editedInput });
        await page.locator("#calc-source-host-close").click();
        await page.locator("#calc-import").setInputFiles({ name: "source-artifact-events-calculator.json",
          mimeType: "application/json", buffer: Buffer.from(calculatorText) });
        const restored = page.locator(`[data-source-host-artifact-additive-id="${component.request.id}"]`);
        await expect(restored.locator('[data-source-host-artifact-additive-state="sourceValue"]')).toHaveValue(String(editedInput.sourceValue));
        await expect(restored.locator("[data-source-host-artifact-additive-result]")).toHaveText(editedText);
        await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
        measurement.editedHit = { applicationId: selected!.application.id, calculationId: component.request.id,
          originalValue: edit.originalValue, editedValue: edit.editedValue,
          originalDamage: edit.originalRawDamage, editedDamage: edit.editedRawDamage, restoredText: editedText };
      }
    } else {
      for (const ruleId of stellarRules) expect(ruleCounts[ruleId], `Missing native ${ruleId}`).toBeGreaterThan(0);
      const kaeyaIndex = result.calculations.find(row => row.request.actorKey === "kaeya")?.request.actorIndex;
      expect(kaeyaIndex).toBeDefined();
      const snapshots = result.calculations.flatMap(record => {
        const request = record.request;
        if (!request || !("snapshot" in request) || !request.snapshot || typeof request.snapshot !== "object") return [];
        const parsed = sourceHostStatProvenanceSchema.safeParse((request.snapshot as Record<string, unknown>).statProvenance);
        if (!parsed.success) return [];
        return parsed.data.attackReads.filter(read => read.kind === "artifact-snapshot")
          .map(read => ({ read, record }));
      });
      const dependsOn = (parentId: number, childId: number, seen = new Set<number>()): boolean => {
        if (parentId === childId) return true;
        if (seen.has(parentId)) return false;
        seen.add(parentId);
        return byId.get(parentId)?.request.componentIds.some(id => dependsOn(id, childId, seen)) ?? false;
      };
      const terminalFor = (calculationId: number) => result.applications.find(application =>
        byId.get(application.calculationId)?.request.kind === "stellar-delivery" &&
        dependsOn(application.calculationId, calculationId));
      const blizzard = snapshots.find(row => row.read.effectSourceActorIndex === kaeyaIndex &&
        row.read.steps.some(step => step.key === "bs-4pc-lunarcharge" && step.formulaCalculationIds?.length) &&
        terminalFor(row.record.request.id));
      expect(blizzard, "No real target-conditioned Blizzard CR snapshot on a Stellar hit").toBeDefined();
      const terminal = terminalFor(blizzard!.record.request.id)!;
      expect(blizzard!.read.actorIndex).toBe(blizzard!.record.request.actorIndex);
      expect(blizzard!.read.targetKey).toBe(blizzard!.record.request.targetKey);
      expect(blizzard!.read.targetKey).toBe(terminal.targetKey);
      const scalarIds = blizzard!.read.steps.flatMap(step => step.formulaCalculationIds ?? []);
      const capture = captureSourceHostHit(result, terminal.id);
      const replay = replaySourceHostHit(capture);
      expect(replay.difference).toBe(0);
      expect(capture.components.some(row => row.request.id === blizzard!.record.request.id)).toBe(true);
      for (const id of scalarIds) expect(capture.supportingCalculations?.some(row => row.request.id === id)).toBe(true);
      measurement.snapshot = { effectSourceActorIndex: blizzard!.read.effectSourceActorIndex!,
        beneficiaryActorIndex: blizzard!.read.actorIndex, targetKey: blizzard!.read.targetKey,
        calculationId: blizzard!.record.request.id, terminalCalculationId: terminal.calculationId,
        terminalApplicationId: terminal.id, scalarIds, statStepKeys: blizzard!.read.steps.map(step => step.key),
        replayDifference: replay.difference };
      const fischlIndex = result.calculations.find(row => row.request.actorKey === "fischl")?.request.actorIndex;
      measurement.disenchantmentSnapshotCount = snapshots.filter(row =>
        row.read.effectSourceActorIndex === fischlIndex &&
        row.read.steps.some(step => step.key === "disenchantment-4pc-superconduct")).length;
    }
    measurements.push(measurement);
  }

  expect(errors).toEqual([]);
  await writeFile(resolve("docs/validation/source-artifact-events-20260928.result.json"), `${JSON.stringify({
    schemaVersion: "source-artifact-events-validation-v1", scenarios: { healingConfig, stellarConfig },
    runs: measurements, pageErrors: errors,
  }, null, 2)}\n`);
  console.log(JSON.stringify({ runs: measurements.map(({ variant, scenario, sourceCommit, wasmSha256,
    calculations, applications, ruleCounts, additive, echoesPaths, songRemaining, ohcQueue, editedHit, snapshot,
    disenchantmentSnapshotCount }) => ({
    variant, scenario, sourceCommit, wasmSha256, calculations, applications, ruleCounts,
    additive: additive?.map(row => ({ ruleId: row.ruleId, value: row.value, sourceValue: row.sourceValue,
      consumers: row.consumerIds.length, targetKeys: row.targetKeys })), echoesPaths,
    songCharges: songRemaining?.length, ohcQueue,
    editedHit: editedHit && { applicationId: editedHit.applicationId, calculationId: editedHit.calculationId,
      originalValue: editedHit.originalValue, editedValue: editedHit.editedValue,
      originalDamage: editedHit.originalDamage, editedDamage: editedHit.editedDamage },
    snapshot, disenchantmentSnapshot: disenchantmentSnapshotCount === undefined ? undefined
      : { count: disenchantmentSnapshotCount, coverage: disenchantmentSnapshotCount > 0 ? "已覆盖" : "未覆盖" },
  })), errors }));
});
