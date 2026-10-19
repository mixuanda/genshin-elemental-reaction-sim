import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  calculateSourceHostHealingEditable, captureSourceHostHealing, createSourceHostHealingEditable,
  replaySourceHostHealing,
} from "../../../packages/sim-core/src/source-host-healing-capture";
import {
  captureSourceHostCooldown, replaySourceHostCooldown,
} from "../../../packages/sim-core/src/source-host-cooldown-capture";
import { resolveSourceHostHealingInput } from "../../../packages/sim-core/src/source-host-healing-formula";
import { resolveSourceHostCooldownInput } from "../../../packages/sim-core/src/source-host-cooldown-formula";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT,
  type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";

type Lane = "classic" | "stellar";
type Scene = "healing" | "cooldown";
const laneFilter = process.env.GIDPS_OVERRIDE_LANE;
const sceneFilter = process.env.GIDPS_OVERRIDE_SCENE;
if (laneFilter !== undefined && laneFilter !== "classic" && laneFilter !== "stellar")
  throw new Error(`GIDPS_OVERRIDE_LANE must be classic or stellar: ${laneFilter}`);
if (sceneFilter !== undefined && sceneFilter !== "healing" && sceneFilter !== "cooldown")
  throw new Error(`GIDPS_OVERRIDE_SCENE must be healing or cooldown: ${sceneFilter}`);

// Kokomi E heals at each native jellyfish tick. Arlecchino is active for the
// next tick, rejects that outside heal, then Q invokes her named own heal.
// Clorinde enters E state while the jellyfish remains active; the next outside
// heal becomes Bond of Life, so a second E can perform Impale's named own heal.
const healingConfig = `options iteration=1 duration=20;
kokomi char lvl=90/90 cons=0 talent=1,1,1;
kokomi add weapon="magicguide" refine=1 lvl=90/90;
kokomi add stats hp=5000;
arlecchino char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
arlecchino add weapon="favoniuslance" refine=1 lvl=90/90;
clorinde char lvl=90/90 cons=0 talent=1,1,1;
clorinde add weapon="favoniussword" refine=1 lvl=90/90;
noelle char lvl=90/90 cons=0 talent=1,1,1;
noelle add weapon="favoniusgreatsword" refine=1 lvl=90/90;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active kokomi;
kokomi skill;
arlecchino attack;
wait(100);
arlecchino burst;
clorinde skill;
wait(140);
clorinde skill;
wait(150);`;

// Kokomi's first E hit applies Hydro. Cyno E installs its cooldown at frame 17
// and hits at frame 21, while Cyno remains active; this reaches TF's native
// Electro-Charged gate with an in-progress skill queue. Both lanes route the
// same 60 frames to skill and low_plunge through Cyno's native override.
const cooldownConfig = `options iteration=1 duration=10;
kokomi char lvl=90/90 cons=0 talent=1,1,1;
kokomi add weapon="magicguide" refine=1 lvl=90/90;
cyno char lvl=90/90 cons=0 talent=1,1,1;
cyno add weapon="favoniuslance" refine=1 lvl=90/90;
cyno add set="thunderingfury" count=4;
noelle char lvl=90/90 cons=0 talent=1,1,1;
noelle add weapon="favoniusgreatsword" refine=1 lvl=90/90;
barbara char lvl=90/90 cons=0 talent=1,1,1;
barbara add weapon="magicguide" refine=1 lvl=90/90;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active kokomi;
kokomi skill;
cyno skill;
wait(120);`;
const scenes: Array<{ lane: Lane; scene: Scene; config: string }> =
  (["classic", "stellar"] as const).flatMap(lane => [
    { lane, scene: "healing" as const, config: healingConfig },
    { lane, scene: "cooldown" as const, config: cooldownConfig },
  ]).filter(row => (laneFilter === undefined || row.lane === laneFilter) &&
    (sceneFilter === undefined || row.scene === sceneFilter));

function operations(capture: ReturnType<typeof captureSourceHostHealing>) {
  return [...capture.components, capture.calculation].map(row => row.request.input);
}

test("native healing overrides and TF cooldown routing retain causal scalar replay", async ({ page }) => {
  test.setTimeout(360000);
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const measurements: Array<Record<string, unknown>> = [];
  let edited = false;

  for (const { lane, scene, config } of scenes) {
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
    // Preserve the native receipt before attempting any schema or formula check.
    await writeFile(resolve(`docs/validation/source-character-overrides-${lane}-${scene}-20260928.result.json`), raw);
    const result = JSON.parse(raw) as SourceHostResult;
    expect(result.sourceCommit).toBe(lane === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT);
    expect(result.config).toBe(config);
    const manifest = JSON.parse(await readFile(resolve(lane === "classic"
      ? "packages/source-host/dist/manifest.json" : "packages/source-host/stellar-overlay/dist/manifest.json"), "utf8")) as {
      artifacts?: Array<{ path: string; sha256: string }>;
      files?: Array<{ path: string; sha256: string }>;
    };
    const wasm = (manifest.artifacts ?? manifest.files)?.find(row => row.path === "source-host.wasm");
    expect(wasm?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.executionArtifact?.wasmSha256).toBe(wasm?.sha256);
    const byId = new Map(result.calculations.map(row => [row.request.id, row]));
    const measure: Record<string, unknown> = { lane, scene, sourceCommit: result.sourceCommit,
      wasmSha256: result.executionArtifact?.wasmSha256 };

    if (scene === "healing") {
      const apps = result.healingApplications ?? [];
      const stage = (id: number | undefined) => id === undefined ? undefined : byId.get(id);
      const receiveBranch = (id: number | undefined) => {
        const row = stage(id);
        return row?.request.kind === "character-healing" && row.request.input.operation === "receive-override"
          ? row.request.input.branch : undefined;
      };
      const kokomi = apps.find(app => app.callerIndex === 0 && app.targetIndex === 0 && app.source === "Bake-Kurage");
      const arleRejected = apps.find(app => app.callerIndex === 0 && app.targetIndex === 1 &&
        receiveBranch(app.receiveCalculationId) === "arlecchino-rejected");
      const arleOwn = apps.find(app => app.callerIndex === 1 && app.targetIndex === 1 &&
        app.source === "Balemoon Rising (Heal)");
      const cloriConverted = apps.find(app => app.callerIndex === 0 && app.targetIndex === 2 &&
        receiveBranch(app.receiveCalculationId) === "clorinde-converted");
      const cloriOwn = apps.find(app => app.callerIndex === 2 && app.targetIndex === 2 &&
        app.source.startsWith("Impale the Night"));
      expect(kokomi, `${lane}: Kokomi E must produce unconditional self-healing`).toBeDefined();
      expect(arleRejected, `${lane}: Kokomi tick must be rejected by Arlecchino`).toBeDefined();
      expect(arleOwn, `${lane}: Arlecchino Q must delegate its own named heal`).toBeDefined();
      expect(cloriConverted, `${lane}: Clorinde E must convert an outside jellyfish heal`).toBeDefined();
      expect(cloriOwn, `${lane}: BOL must enable Clorinde's own Impale heal`).toBeDefined();
      expect(arleRejected!.receivedAmount).toBe(0);
      expect(cloriConverted!.receivedAmount).toBe(0);
      expect(cloriConverted!.currentHpDebt).toBeGreaterThan(cloriConverted!.previousHpDebt);
      expect(arleOwn!.frame).toBeGreaterThan(arleRejected!.frame);
      expect(cloriOwn!.frame).toBeGreaterThan(cloriConverted!.frame);
      const selected = [kokomi!, arleRejected!, arleOwn!, cloriConverted!, cloriOwn!];
      const replayed = selected.map(application => {
        const capture = captureSourceHostHealing(result, application.id);
        const replay = replaySourceHostHealing(capture);
        expect(replay.difference).toBe(0);
        expect(replay.reproducedAmount).toBe(application.finalAmount);
        expect(replay.reproducedOverheal).toBe(application.overheal);
        for (const row of [...capture.components, capture.calculation])
          expect(resolveSourceHostHealingInput(row.request.input, result.sourceCommit).value).toBe(row.value);
        return { id: application.id, frame: application.frame, source: application.source,
          targetIndex: application.targetIndex, finalAmount: application.finalAmount,
          receivedAmount: application.receivedAmount, replayDifference: replay.difference,
          operations: operations(capture).map(input => input.operation) };
      });
      const rejectedCapture = captureSourceHostHealing(result, arleRejected!.id);
      const ownCapture = captureSourceHostHealing(result, arleOwn!.id);
      const convertedCapture = captureSourceHostHealing(result, cloriConverted!.id);
      const impaleCapture = captureSourceHostHealing(result, cloriOwn!.id);
      expect(operations(rejectedCapture)).toEqual(expect.arrayContaining([
        expect.objectContaining({ operation: "receive-override", branch: "arlecchino-rejected" })]));
      expect(operations(ownCapture)).toEqual(expect.arrayContaining([
        expect.objectContaining({ operation: "receive-delegation", branch: "arlecchino-own-burst" })]));
      expect(operations(convertedCapture)).toEqual(expect.arrayContaining([
        expect.objectContaining({ operation: "receive-conversion" }),
        expect.objectContaining({ operation: "receive-override", branch: "clorinde-converted" })]));
      expect(operations(impaleCapture)).toEqual(expect.arrayContaining([
        expect.objectContaining({ operation: "receive-delegation", branch: "clorinde-own-impale" })]));
      measure.healing = replayed;

      if (!edited && lane === "classic") {
        const original = createSourceHostHealingEditable(convertedCapture);
        if (original.baseInput.operation !== "base" || original.baseInput.healType !== "absolute")
          throw new Error("Kokomi E should supply an absolute healing source amount");
        const modified = { ...original, baseInput: { ...original.baseInput,
          sourceAmount: original.baseInput.sourceAmount + 100 } };
        const experiment = calculateSourceHostHealingEditable(modified);
        expect(experiment.status).toBe("calculated");
        if (experiment.status !== "calculated") throw new Error("converted heal experiment blocked");
        expect(experiment.editedConverted).not.toBe(experiment.originalConverted);
        await page.locator("#source-host-import").setInputFiles({ name: "source-character-overrides-healing.json",
          mimeType: "application/json", buffer: Buffer.from(raw) });
        await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
        await page.locator("#source-host-healing-index").fill(String(apps.indexOf(cloriConverted!)));
        await expect(page.locator("#source-host-healing-hit")).toContainText("重放");
        await page.locator("#source-host-open-healing-calculator").click();
        await expect(page).toHaveURL(/\/calculator$/);
        const editor = page.locator("[data-source-host-healing-calculator]");
        await editor.locator('[data-source-host-healing-stage="base"][data-source-host-healing-field="sourceAmount"]')
          .fill(String(modified.baseInput.sourceAmount));
        await expect(editor.locator("[data-source-host-healing-result]")).toContainText("编辑后");
        const pendingEditable = page.waitForEvent("download");
        await editor.locator("[data-source-host-healing-export]").click();
        const editableRaw = await readFile((await (await pendingEditable).path())!, "utf8");
        await writeFile(resolve("docs/validation/source-character-overrides-healing-calculator-20260928.result.json"), editableRaw);
        const saved = JSON.parse(editableRaw) as typeof modified;
        expect(saved.originalCapture).toEqual(convertedCapture);
        expect(saved.baseInput).toEqual(modified.baseInput);
        await page.locator("#calc-source-host-close").click();
        await page.locator("#calc-import").setInputFiles({ name: "source-character-overrides-healing-edit.json",
          mimeType: "application/json", buffer: Buffer.from(editableRaw) });
        const restored = page.locator("[data-source-host-healing-calculator]");
        await expect(restored.locator('[data-source-host-healing-stage="base"][data-source-host-healing-field="sourceAmount"]'))
          .toHaveValue(String(modified.baseInput.sourceAmount));
        const restoredCalculation = calculateSourceHostHealingEditable(saved);
        if (restoredCalculation.status !== "calculated") throw new Error(restoredCalculation.reason);
        expect(restoredCalculation.editedConverted).toBeCloseTo(experiment.editedConverted!, 9);
        measure.edit = { originalConverted: experiment.originalConverted,
          editedConverted: experiment.editedConverted, originalCaptureUnchanged: true };
        edited = true;
      }
    } else {
      const rows = result.calculations.filter(row => row.request.kind === "character-cooldown");
      for (const row of rows) {
        if (row.request.kind !== "character-cooldown") continue;
        expect(resolveSourceHostCooldownInput(row.request.input, result.sourceCommit).value).toBe(row.value);
      }
      const source = rows.find(row => row.request.kind === "character-cooldown" &&
        row.request.actorKey === "cyno" && row.request.input.operation === "source" &&
        row.request.input.rule === "thundering-fury");
      expect(source, `${lane}: active Cyno Electro-Charged must trigger TF's literal 60-frame source`).toBeDefined();
      if (source?.request.kind !== "character-cooldown") throw new Error("TF source missing");
      expect(source.value).toBe(60);
      const route = rows.find(row => row.request.kind === "character-cooldown" &&
        row.request.input.operation === "route" && row.request.input.rule === "cyno" &&
        row.request.componentIds.includes(source.request.id));
      expect(route, `${lane}: Cyno must record its native two-target route`).toBeDefined();
      const terminal = rows.find(row => row.request.kind === "character-cooldown" &&
        row.request.actorKey === "cyno" && row.request.input.operation === "reduce" &&
        row.request.componentIds.includes((route ?? source).request.id));
      expect(terminal, `${lane}: TF must reach a real queued skill reduction`).toBeDefined();
      if (terminal?.request.kind !== "character-cooldown" || terminal.request.input.operation !== "reduce")
        throw new Error("TF reduction missing");
      const reductionInput = terminal.request.input;
      const remaining = rows.find(row => row.request.kind === "character-cooldown" &&
        row.request.input.operation === "remaining" && row.request.actorKey === "cyno" &&
        row.request.input.actionType === reductionInput.actionType &&
        row.request.frame === terminal.request.frame && row.request.id < terminal.request.id &&
        row.value === reductionInput.remaining);
      expect(remaining, `${lane}: the skill queue must expose the actual pre-reduction remaining frames`).toBeDefined();
      expect(reductionInput.remaining).toBeGreaterThan(60);
      expect(reductionInput.reduction).toBe(60);
      expect(replaySourceHostCooldown(captureSourceHostCooldown(result, remaining!.request.id)).difference).toBe(0);
      const capture = captureSourceHostCooldown(result, terminal.request.id);
      const replay = replaySourceHostCooldown(capture);
      expect(replay.difference).toBe(0);
      expect(capture.components?.map(row => row.request.id)).toContain(source.request.id);
      expect(capture.components?.map(row => row.request.id)).toContain(route!.request.id);
      measure.cooldown = { sourceId: source.request.id, routeId: route?.request.id,
        remainingId: remaining!.request.id, reductionId: terminal.request.id,
        remaining: reductionInput.remaining,
        reducedTo: terminal.value, replayDifference: replay.difference };
    }
    measurements.push(measure);
  }
  if (laneFilter === undefined && sceneFilter === undefined) {
    await page.goto("/examples");
    await page.locator('[data-example-id="fixture-a"]').click();
    await expect(page).toHaveURL(/\/calculator$/);
    await page.locator('[data-detail-id="hit-card:hit-a"] > summary').click();
    expect(await page.locator("[data-trace-execution]").count()).toBeGreaterThan(0);
    await page.locator("#calc-results .calculator-audit > summary").click();
    const reportDownload = page.waitForEvent("download");
    await page.locator('[data-action="export-report"]').click();
    const reportRaw = await readFile((await (await reportDownload).path())!, "utf8");
    await writeFile(resolve("docs/validation/source-character-overrides-trace-report-20260928.result.json"), reportRaw);
    const report = JSON.parse(reportRaw) as {
      result: { trace: Array<{ id: string; result?: { value: number } }> };
      executionDetails: Array<{ nodeId: string; value: number; steps: Array<{ result: number }> }>;
    };
    expect(report.executionDetails.some(row => row.steps.length > 1)).toBe(true);
    for (const row of report.executionDetails)
      expect(row.value).toBe(report.result.trace.find(node => node.id === row.nodeId)?.result?.value);
    measurements.push({ scene: "standalone-trace-report", nodes: report.executionDetails.length,
      operations: report.executionDetails.reduce((sum, row) => sum + row.steps.length, 0) });
  }
  expect(pageErrors).toEqual([]);
  const summary = laneFilter === undefined && sceneFilter === undefined
    ? "docs/validation/source-character-overrides-20260928.result.json"
    : `docs/validation/source-character-overrides-${laneFilter ?? "both"}-${sceneFilter ?? "both"}-summary-20260928.result.json`;
  await writeFile(resolve(summary), `${JSON.stringify({ schemaVersion: "source-character-overrides-validation-v1",
    laneFilter: laneFilter ?? "both", sceneFilter: sceneFilter ?? "both", measurements, pageErrors }, null, 2)}\n`);
  console.log(JSON.stringify({ runs: measurements, pageErrors }));
});
