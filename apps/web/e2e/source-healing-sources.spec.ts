import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  calculateSourceHostHealingEditable, captureSourceHostHealing,
  createSourceHostHealingEditable, replaySourceHostHealing,
  type SourceHostHealingCapture, type SourceHostHealingEditable,
} from "../../../packages/sim-core/src/source-host-healing-capture";
import { resolveSourceHostHealingSourceInput } from "../../../packages/sim-core/src/source-host-healing-source-formula";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT, type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";

const laneFilter = process.env.GIDPS_HEALING_SOURCE_LANE;
if (laneFilter !== undefined && laneFilter !== "classic" && laneFilter !== "stellar")
  throw new Error(`GIDPS_HEALING_SOURCE_LANE must be classic or stellar: ${laneFilter}`);

// HP loss is native player damage. The four full-Q characters still consume
// energy normally; 100 is only their initial energy. Barbara's Q schedules
// later Prototype Amber party heals, and Sayu C6 reuses its Q snapshot.
const sceneOne = `options iteration=1 duration=28;
barbara char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
barbara add weapon="prototypeamber" refine=1 lvl=90/90;
barbara add stats hp=4000 cr=0.2 cd=0.4;
bennett char lvl=90/90 cons=1 talent=1,1,1 +params=[start_energy=100];
bennett add weapon="favoniussword" refine=1 lvl=90/90;
bennett add stats hp=2000 cr=0.2 cd=0.4;
sayu char lvl=90/90 cons=6 talent=1,1,1 +params=[start_energy=100];
sayu add weapon="favoniusgreatsword" refine=1 lvl=90/90;
sayu add stats atk=300 em=200 cr=0.2 cd=0.4;
kuki char lvl=90/90 cons=0 talent=1,1,1;
kuki add weapon="favoniussword" refine=1 lvl=90/90;
kuki add stats em=200 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
hurt every interval=120,121 amount=1500,1500 element=physical;
active barbara;
barbara skill;
barbara attack:2;
barbara burst;
bennett burst;
sayu burst;
kuki skill;
barbara attack:2;
wait(900);`;

// Qiqi's guaranteed-crit normals may trigger The Black Sword's own native
// healing gate. The other healing producers retain their original target,
// travel, periodic and HP conditions; the test records only actual receipts.
const sceneTwo = `options iteration=1 duration=28;
charlotte char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
charlotte add weapon="magicguide" refine=1 lvl=90/90;
charlotte add stats atk=300 cr=0.2 cd=0.4;
yaoyao char lvl=90/90 cons=0 talent=1,1,1;
yaoyao add weapon="favoniuslance" refine=1 lvl=90/90;
yaoyao add stats hp=3000 cr=0.2 cd=0.4;
qiqi char lvl=90/90 cons=6 talent=1,1,1 +params=[start_energy=100];
qiqi add weapon="theblacksword" refine=1 lvl=90/90;
qiqi add stats atk=300 cr=1 cd=0.4;
gaming char lvl=90/90 cons=1 talent=1,1,1 +params=[start_energy=100];
gaming add weapon="favoniusgreatsword" refine=1 lvl=90/90;
gaming add stats atk=300 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
hurt every interval=120,121 amount=1500,1500 element=physical;
active charlotte;
charlotte burst;
yaoyao skill;
qiqi skill;
qiqi burst;
qiqi attack:2;
gaming burst;
qiqi attack:2;
wait(900);`;

const scenarios = (["classic", "stellar"] as const).flatMap(lane => [
  { lane, key: "scene1" as const, config: sceneOne },
  { lane, key: "scene2" as const, config: sceneTwo },
]).filter(row => laneFilter === undefined || row.lane === laneFilter);

interface LinkedHealing {
  applicationIndex: number;
  capture: SourceHostHealingCapture;
  directSourceIds: number[];
}

test("native HealInfo producers replay their complete causal source chain and restore one edited healing calculation", async ({ page }) => {
  test.setTimeout(600000);
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const measurements: Array<Record<string, unknown>> = [];
  let editedOnce = false;
  let sawCrossTarget = false;
  let sawCrossFrame = false;

  for (const scenario of scenarios) {
    await page.goto("/source-simulation");
    await page.locator("#source-host-variant").selectOption(scenario.lane);
    await page.locator("#source-host-config").fill(scenario.config);
    await page.locator("#source-host-seed").fill("20260928");
    await page.locator("#source-host-run").click();
    await expect(page.locator("#source-host-status"))
      .toContainText(/本次运行完成|运行停止|执行器错误/, { timeout: 90000 });
    await expect(page.locator("#source-host-status")).toContainText("本次运行完成");
    const pending = page.waitForEvent("download");
    await page.locator("#source-host-export").click();
    const raw = await readFile((await (await pending).path())!, "utf8");
    const rawPath = `docs/validation/source-healing-sources-${scenario.lane}-${scenario.key}-20260928.result.json`;
    await writeFile(resolve(rawPath), raw); // Preserve the full native result before asserting coverage.
    const result = JSON.parse(raw) as SourceHostResult;
    expect(result.sourceCommit).toBe(scenario.lane === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT);
    expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.config).toBe(scenario.config);

    const linked: LinkedHealing[] = [];
    const observedRules = new Map<string, number>();
    let maximumReplayDifference = 0;
    let crossTargetInRun = false;
    let crossFrameInRun = false;
    const applications = result.healingApplications ?? [];
    const byId = new Map(result.calculations.map(row => [row.request.id, row]));
    for (const [applicationIndex, application] of applications.entries()) {
      const base = byId.get(application.baseCalculationId);
      const bonus = byId.get(application.bonusCalculationId);
      const directSourceIds = [base, bonus].flatMap(row => {
        if (!row || row.request.kind !== "character-healing") return [];
        return row.request.componentIds;
      });
      if (!directSourceIds.length) continue; // Old/uninstrumented heals are not evidence of a source closure.
      const capture = captureSourceHostHealing(result, application.id);
      expect(capture.sources?.length, `native heal #${application.id} has linked source IDs`).toBeGreaterThan(0);
      const sources = capture.sources ?? [];
      for (const id of directSourceIds) expect(sources.some(row => row.request.id === id)).toBe(true);
      const replay = replaySourceHostHealing(capture);
      expect(replay.difference).toBe(0);
      expect(replay.reproducedAmount).toBe(replay.originalAmount);
      expect(replay.reproducedOverheal).toBe(replay.originalOverheal);
      maximumReplayDifference = Math.max(maximumReplayDifference, Math.abs(replay.difference));
      for (const source of sources) {
        if (source.request.input.operation !== "source") continue;
        expect(resolveSourceHostHealingSourceInput(source.request.input, result.sourceCommit).value)
          .toBe(source.value);
        const ruleId = source.request.input.ruleId;
        observedRules.set(ruleId, (observedRules.get(ruleId) ?? 0) + 1);
        if (directSourceIds.includes(source.request.id) && source.request.input.sourceHolderIndex !== application.targetIndex
          && application.callerIndex !== application.targetIndex) crossTargetInRun = sawCrossTarget = true;
        if (directSourceIds.includes(source.request.id) && source.request.frame < application.frame)
          crossFrameInRun = sawCrossFrame = true;
      }
      linked.push({ applicationIndex, capture, directSourceIds });
    }
    expect(linked.length, `${scenario.lane}/${scenario.key}: actual HealInfo source links`).toBeGreaterThan(0);
    const measurement: Record<string, unknown> = {
      lane: scenario.lane, scene: scenario.key, rawPath,
      sourceCommit: result.sourceCommit, wasmSha256: result.executionArtifact?.wasmSha256,
      healingApplications: applications.length, linkedApplications: linked.length,
      observedSourceIds: [...new Set(linked.flatMap(row => row.capture.sources?.map(source => source.request.id) ?? []))].length,
      observedRules: Object.fromEntries(observedRules), maximumReplayDifference,
      crossTargetObserved: crossTargetInRun, crossFrameObserved: crossFrameInRun,
      pageErrors: [...pageErrors],
    };
    if (scenario.key === "scene1") {
      expect(observedRules.get("heal-source-barbara-burst") ?? 0,
        `${scenario.lane}: Barbara Q must produce a linked HealInfo.Src`).toBeGreaterThan(0);
      expect(observedRules.get("heal-source-weapon-prototype") ?? 0,
        `${scenario.lane}: Prototype Amber must produce actual party healing`).toBeGreaterThan(0);
    } else {
      expect(observedRules.get("heal-source-charlotte-burst-initial") ?? 0,
        `${scenario.lane}: Charlotte Q must produce actual healing`).toBeGreaterThan(0);
    }

    if (!editedOnce && scenario.lane === "classic" && scenario.key === "scene1") {
      const candidate = linked.map(row => {
        const source = row.capture.sources?.find(source => source.request.input.operation === "source"
          && source.request.input.ruleId === "heal-source-barbara-burst");
        if (!source || source.request.input.operation !== "source") return undefined;
        const editable = createSourceHostHealingEditable(row.capture);
        const target = editable.sourceInputs?.find(input => input.id === source.request.id);
        if (!target || target.input.operation !== "source") return undefined;
        const originalRatio = target.input.state.ratio;
        if (originalRatio === undefined) return undefined;
        const editedRatio = originalRatio + 0.2;
        target.input = { ...target.input, state: { ...target.input.state, ratio: editedRatio } };
        const expected = calculateSourceHostHealingEditable(editable);
        if (expected.status !== "calculated" || expected.editedAmount === expected.originalAmount
          || expected.editedReceived === expected.originalReceived
          || expected.editedOverheal === expected.originalOverheal) return undefined;
        return { row, sourceId: source.request.id, originalRatio, editedRatio, expected };
      }).find(Boolean);
      expect(candidate, "Barbara Q needs one actual editable heal whose amount, receipt and overflow respond").toBeDefined();
      if (!candidate) throw new Error("No linked Barbara Q healing edit candidate");
      const { row, sourceId, originalRatio, editedRatio, expected } = candidate;
      await page.locator("#source-host-healing-index").fill(String(row.applicationIndex));
      await expect(page.locator("#source-host-healing-hit")).toContainText("芭芭拉闪耀奇迹治疗");
      await page.locator("#source-host-open-healing-calculator").click();
      await expect(page).toHaveURL(/\/calculator$/);
      const editor = page.locator("[data-source-host-healing-calculator]");
      const ratio = editor.locator(`[data-source-host-healing-source-id="${sourceId}"][data-source-host-healing-source-key="ratio"]`);
      await expect(ratio).toHaveValue(String(originalRatio));
      await ratio.fill(String(editedRatio));
      await expect(editor.locator("[data-source-host-healing-result]")).toContainText("编辑后过量治疗");
      const editedText = (await editor.locator("[data-source-host-healing-result]").textContent()) ?? "";
      expect(editedText).toContain(String(expected.editedAmount.toLocaleString("zh-CN", { maximumFractionDigits: 6 })));
      const pendingEditable = page.waitForEvent("download");
      await editor.locator("[data-source-host-healing-export]").click();
      const editableRaw = await readFile((await (await pendingEditable).path())!, "utf8");
      const editablePath = "docs/validation/source-healing-sources-calculator-20260928.result.json";
      await writeFile(resolve(editablePath), editableRaw);
      const saved = JSON.parse(editableRaw) as SourceHostHealingEditable;
      expect(saved.originalCapture).toEqual(row.capture);
      const savedSource = saved.sourceInputs?.find(source => source.id === sourceId);
      expect(savedSource?.input.operation === "source" ? savedSource.input.state.ratio : undefined).toBe(editedRatio);
      const restoredArithmetic = calculateSourceHostHealingEditable(saved);
      expect(restoredArithmetic.status).toBe("calculated");
      if (restoredArithmetic.status !== "calculated") throw new Error(restoredArithmetic.reason);
      expect(restoredArithmetic.editedAmount).toBe(expected.editedAmount);
      expect(restoredArithmetic.editedReceived).toBe(expected.editedReceived);
      expect(restoredArithmetic.editedOverheal).toBe(expected.editedOverheal);
      await editor.locator("[data-source-host-healing-import]").setInputFiles({ name: "source-healing-edit.json",
        mimeType: "application/json", buffer: Buffer.from(editableRaw) });
      await expect(page.locator(`[data-source-host-healing-source-id="${sourceId}"][data-source-host-healing-source-key="ratio"]`))
        .toHaveValue(String(editedRatio));
      await expect(page.locator("[data-source-host-healing-result]")).toHaveText(editedText);
      measurement.edit = { applicationId: row.capture.application.id, sourceId, originalRatio, editedRatio,
        originalAmount: expected.originalAmount, editedAmount: expected.editedAmount,
        originalReceived: expected.originalReceived, editedReceived: expected.editedReceived,
        originalOverheal: expected.originalOverheal, editedOverheal: expected.editedOverheal,
        difference: expected.difference, originalCaptureUnchanged: true, editablePath };
      editedOnce = true;
    }
    measurements.push(measurement);
  }
  await writeFile(resolve(laneFilter === undefined
    ? "docs/validation/source-healing-sources-measurements-20260928.result.json"
    : `docs/validation/source-healing-sources-${laneFilter}-measurements-20260928.result.json`),
  `${JSON.stringify({ schemaVersion: "source-healing-sources-validation-v1", laneFilter: laneFilter ?? "both",
    configs: { scene1: sceneOne, scene2: sceneTwo }, measurements, pageErrors,
    scope: "Four short fixed-source runs (two per lane), actual linked HealInfo producers only; absent gates are not counted as coverage." }, null, 2)}\n`);
  expect(sawCrossTarget, "an actual linked healing source must cross holder/target identities").toBe(true);
  expect(sawCrossFrame, "an actual linked healing source must be reused at a later frame").toBe(true);
  if (laneFilter === undefined || laneFilter === "classic") expect(editedOnce).toBe(true);
  expect(pageErrors).toEqual([]);
});
