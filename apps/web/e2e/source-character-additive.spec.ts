import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { captureSourceHostHit, deriveSourceHostCharacterFormulaEdit, replaySourceHostHit } from "../../../packages/sim-core/src/source-host-capture";
import { sourceHostArtifactSupportIds } from "../../../packages/sim-core/src/source-host-artifact-support";
import { resolveSourceHostCharacterAdditiveInput } from "../../../packages/sim-core/src/source-host-character-additive-formula";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT,
  type SourceHostCalculationRecord, type SourceHostCharacterAdditiveRequest, type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";

type Lane = "classic" | "stellar";
type AdditiveRecord = SourceHostCalculationRecord & { request: SourceHostCharacterAdditiveRequest };
const laneFilter = process.env.GIDPS_ADDITIVE_LANE;
if (laneFilter !== undefined && laneFilter !== "classic" && laneFilter !== "stellar")
  throw new Error(`GIDPS_ADDITIVE_LANE must be classic or stellar: ${laneFilter}`);

// Yun Jin and Kokomi add to the same real normal hit. Xianyun's burst creates
// repeated ATK snapshots; Noelle's buffed jump makes the subsequent plunge legal.
const config = `options iteration=1 duration=16;
yunjin char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
yunjin add weapon="favoniuslance" refine=1 lvl=90/90;
kokomi char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
kokomi add weapon="magicguide" refine=1 lvl=90/90;
kokomi add stats hp=5000 heal=0.2;
xianyun char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
xianyun add weapon="magicguide" refine=1 lvl=90/90;
xianyun add stats atk=300;
noelle char lvl=90/90 cons=0 talent=1,1,1;
noelle add weapon="favoniusgreatsword" refine=1 lvl=90/90;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active yunjin;
yunjin burst;
kokomi burst;
kokomi attack:3;
xianyun burst;
noelle jump;
noelle high_plunge;
wait(120);`;
const rules = {
  yunJin: "char-add-yunjin-burst",
  kokomi: "char-add-kokomi-a4",
  xianyunCreate: "char-add-xianyun-a4-atk-snapshot",
  xianyunHit: "char-add-xianyun-a4",
} as const;

test("native character FlatDmg components preserve two reads, stored snapshots, and independent formula edits", async ({ page }) => {
  test.setTimeout(300000);
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const measurements: Array<{
    lane: Lane; sourceCommit: string; wasmSha256?: string | undefined;
    applications: number; calculations: number; observedRules: Record<string, number>;
    normal: { applicationId: number; frame: number; kokomiId: number; yunJinId: number;
      kokomiValue: number; yunJinValue: number; replayDifference: number };
    plunge: { applicationId: number; frame: number; hitId: number; creationId: number;
      creationFrame: number; hitValue: number; snapshotValue: number; replayDifference: number };
    edit?: { calculationId: number; originalValue: number; editedValue: number;
      originalCaptureUnchanged: boolean; restoredValue: number; scope: string };
  }> = [];

  for (const lane of ["classic", "stellar"] as const) {
    if (laneFilter !== undefined && lane !== laneFilter) continue;
    await page.goto("/source-simulation");
    await page.locator("#source-host-variant").selectOption(lane);
    await page.locator("#source-host-config").fill(config);
    await page.locator("#source-host-seed").fill("20260928");
    await page.locator("#source-host-run").click();
    await expect(page.locator("#source-host-status")).toContainText(/本次运行完成|运行停止|执行器错误/, { timeout: 90000 });
    await expect(page.locator("#source-host-status")).toContainText("本次运行完成");
    const pending = page.waitForEvent("download");
    await page.locator("#source-host-export").click();
    const raw = await readFile((await (await pending).path())!, "utf8");
    await writeFile(resolve(`docs/validation/source-character-additive-${lane}-20260928.result.json`), raw);
    const result = JSON.parse(raw) as SourceHostResult;
    expect(result.sourceCommit).toBe(lane === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT);
    expect(result.config).toBe(config);
    expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);

    const byId = new Map(result.calculations.map(row => [row.request.id, row]));
    const additives = result.calculations.filter((row): row is AdditiveRecord => row.request.kind === "character-additive");
    const observedRules = Object.fromEntries([...new Set(additives.map(row => row.request.input.ruleId))]
      .map(ruleId => [ruleId, additives.filter(row => row.request.input.ruleId === ruleId).length]));
    const ruleRows = (ruleId: string) => additives.filter(row => row.request.input.ruleId === ruleId);
    for (const row of additives) {
      expect(resolveSourceHostCharacterAdditiveInput(row.request.input, result.sourceCommit).value)
        .toBeCloseTo(row.value, 9);
    }
    const hitsWith = (...ruleIds: string[]) => result.applications.flatMap((application, index) => {
      const calculation = byId.get(application.calculationId);
      if (!calculation || calculation.request.kind !== "damage") return [];
      const componentIds = calculation.request.componentIds;
      const ids = ruleIds.map(ruleId => componentIds.find(id => {
        const record = byId.get(id);
        return record?.request.kind === "character-additive" && record.request.input.ruleId === ruleId;
      }));
      return ids.every(id => id !== undefined)
        ? [{ application, index, calculation, ids: ids as number[] }] : [];
    });

    const normal = hitsWith(rules.kokomi, rules.yunJin)
      .find(hit => hit.calculation.request.actorKey === "sangonomiyakokomi");
    expect(normal, `${lane}: Kokomi normal must carry both native same-hit additions`).toBeDefined();
    const kokomi = byId.get(normal!.ids[0]!);
    const yunJin = byId.get(normal!.ids[1]!);
    if (kokomi?.request.kind !== "character-additive" || yunJin?.request.kind !== "character-additive")
      throw new Error("Kokomi/Yun Jin additive calculation missing");
    expect(kokomi.request.input.phase).toBe("hit");
    expect(kokomi.request.statReads).toHaveLength(2);
    expect(kokomi.request.statReads?.map(read => read.kind)).toEqual(["stat", "select-stat"]);
    expect(kokomi.request.input.sourceHolderIndex).toBe(1);
    expect(kokomi.value).toBeCloseTo(kokomi.request.input.state.healBonus! * 0.15 * kokomi.request.input.state.maxHP!, 9);
    expect(yunJin.request.input.phase).toBe("hit");
    expect(yunJin.request.input.sourceHolderIndex).toBe(0);
    expect(yunJin.request.actorIndex).toBe(1);
    for (const id of normal!.ids) {
      const component = normal!.calculation.request.componentApplications.find(row => row.id === id);
      expect(component).toMatchObject({ id, multiplier: 1, amount: byId.get(id)!.value });
      expect(byId.get(id)!.request).toMatchObject({
        frame: normal!.calculation.request.frame,
        attackId: normal!.calculation.request.attackId,
        targetKey: normal!.calculation.request.targetKey,
      });
    }
    const normalCapture = captureSourceHostHit(result, normal!.application.id);
    const normalReplay = replaySourceHostHit(normalCapture);
    expect(normalReplay.difference).toBe(0);
    expect(normalCapture.components.map(row => row.request.id)).toEqual(expect.arrayContaining(normal!.ids));

    const creationRows = ruleRows(rules.xianyunCreate);
    expect(creationRows.length, `${lane}: Xianyun burst must create a real ATK snapshot`).toBeGreaterThan(0);
    const plunge = hitsWith(rules.xianyunHit).find(hit => hit.calculation.request.actorKey === "noelle");
    expect(plunge, `${lane}: Noelle high plunge must consume Xianyun's actual snapshot`).toBeDefined();
    const xianyunHit = byId.get(plunge!.ids[0]!);
    if (xianyunHit?.request.kind !== "character-additive") throw new Error("Xianyun hit formula missing");
    const creationId = xianyunHit.request.valueSources?.atkSnapshot;
    expect(creationId).toBeDefined();
    const creation = byId.get(creationId!);
    if (creation?.request.kind !== "character-additive") throw new Error("Xianyun creation formula missing");
    expect(creation.request.input.ruleId).toBe(rules.xianyunCreate);
    expect(creation.request.input.phase).toBe("creation");
    expect(creation.request.statRead).toBeDefined();
    expect(creation.request.frame).toBeLessThanOrEqual(xianyunHit.request.frame);
    expect(xianyunHit.request.input.state.atkSnapshot).toBeCloseTo(creation.value, 9);
    expect(xianyunHit.value).toBeCloseTo(Math.min(9000, 2 * creation.value), 9);
    expect(xianyunHit.request).toMatchObject({
      frame: plunge!.calculation.request.frame,
      attackId: plunge!.calculation.request.attackId,
      targetKey: plunge!.calculation.request.targetKey,
    });
    expect(sourceHostArtifactSupportIds(xianyunHit.request)).toContain(creationId);
    const plungeCapture = captureSourceHostHit(result, plunge!.application.id);
    const plungeReplay = replaySourceHostHit(plungeCapture);
    expect(plungeReplay.difference).toBe(0);
    expect(plungeCapture.components.map(row => row.request.id)).toContain(xianyunHit.request.id);
    expect(plungeCapture.supportingCalculations?.map(row => row.request.id)).toContain(creationId);

    const measure: (typeof measurements)[number] = {
      lane, sourceCommit: result.sourceCommit, wasmSha256: result.executionArtifact?.wasmSha256,
      applications: result.applications.length, calculations: result.calculations.length, observedRules,
      normal: { applicationId: normal!.application.id, frame: normal!.application.frame,
        kokomiId: kokomi.request.id, yunJinId: yunJin.request.id,
        kokomiValue: kokomi.value, yunJinValue: yunJin.value, replayDifference: normalReplay.difference },
      plunge: { applicationId: plunge!.application.id, frame: plunge!.application.frame,
        hitId: xianyunHit.request.id, creationId: creation.request.id,
        creationFrame: creation.request.frame, hitValue: xianyunHit.value,
        snapshotValue: creation.value, replayDifference: plungeReplay.difference },
    };
    measurements.push(measure);

    if (lane === "classic") {
      const editedInput = { ...kokomi.request.input,
        state: { ...kokomi.request.input.state, maxHP: kokomi.request.input.state.maxHP! + 5000 } };
      const coreEdit = deriveSourceHostCharacterFormulaEdit(normalCapture, kokomi.request.id, editedInput);
      expect(coreEdit.scope).toBe("formula-only");
      expect(coreEdit.changed).toBe(true);
      expect(coreEdit.editedValue).not.toBe(coreEdit.originalValue);
      expect(coreEdit.formulaTrace.some(node => node.inputs.some(input =>
        input.origin === "user-edited-character-experiment"))).toBe(true);
      await page.locator("#source-host-import").setInputFiles({ name: "source-character-additive-native.json",
        mimeType: "application/json", buffer: Buffer.from(raw) });
      await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
      await page.locator("#source-host-hit-index").fill(String(normal!.index));
      await expect(page.locator("#source-host-hit")).toContainText("差值 0");
      await page.locator("#source-host-open-calculator").click();
      await expect(page).toHaveURL(/\/calculator$/);
      await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
      const card = page.locator(`[data-source-host-character-id="${kokomi.request.id}"][data-source-host-character-kind="character-additive"][data-source-host-character-phase="hit"]`);
      await card.locator('[data-source-host-character-state-key="maxHP"]').fill(String(editedInput.state.maxHP));
      await expect(card.locator("[data-source-host-character-result]")).toContainText("输入已修改");
      await expect(card.locator("[data-source-host-character-result]")).toContainText("后续命中未联动");
      const pendingEditable = page.waitForEvent("download");
      await page.locator("[data-source-host-export]").click();
      const editableRaw = await readFile((await (await pendingEditable).path())!, "utf8");
      await writeFile(resolve("docs/validation/source-character-additive-calculator-20260928.result.json"), editableRaw);
      const document = JSON.parse(editableRaw) as { originalCapture: typeof normalCapture;
        characterExperiments?: Array<{ calculationId: number; input: typeof editedInput }> };
      expect(document.originalCapture).toEqual(normalCapture);
      expect(document.characterExperiments?.find(row => row.calculationId === kokomi.request.id)?.input).toEqual(editedInput);
      await page.locator("#calc-source-host-close").click();
      await page.locator("#calc-import").setInputFiles({ name: "source-character-additive-calculator.json",
        mimeType: "application/json", buffer: Buffer.from(editableRaw) });
      const restored = page.locator(`[data-source-host-character-id="${kokomi.request.id}"]`);
      await expect(restored.locator('[data-source-host-character-state-key="maxHP"]'))
        .toHaveValue(String(editedInput.state.maxHP));
      await expect(restored.locator("[data-source-host-character-result]")).toContainText("输入已修改");
      await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
      const restoredValue = deriveSourceHostCharacterFormulaEdit(document.originalCapture, kokomi.request.id,
        document.characterExperiments!.find(row => row.calculationId === kokomi.request.id)!.input).editedValue;
      expect(restoredValue).toBeCloseTo(coreEdit.editedValue, 9);
      measure.edit = { calculationId: kokomi.request.id, originalValue: coreEdit.originalValue,
        editedValue: coreEdit.editedValue, originalCaptureUnchanged: true,
        restoredValue, scope: coreEdit.scope };
    }
  }

  expect(pageErrors).toEqual([]);
  const aggregatePath = laneFilter === undefined
    ? "docs/validation/source-character-additive-20260928.result.json"
    : `docs/validation/source-character-additive-${laneFilter}-summary-20260928.result.json`;
  await writeFile(resolve(aggregatePath), `${JSON.stringify({
    schemaVersion: "source-character-additive-validation-v1", laneFilter: laneFilter ?? "both",
    measurements, pageErrors,
  }, null, 2)}\n`);
  console.log(JSON.stringify({ runs: measurements.map(({ lane, observedRules, normal, plunge, edit }) => ({
    lane, observedRules, normal, plunge, edit })), pageErrors }));
});
