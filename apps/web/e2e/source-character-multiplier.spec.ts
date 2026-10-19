import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { captureSourceHostHit, deriveSourceHostCharacterFormulaEdit, replaySourceHostHit } from "../../../packages/sim-core/src/source-host-capture";
import { resolveSourceHostCharacterMultiplierInput, sourceHostCharacterMultiplierRuleDescriptor } from "../../../packages/sim-core/src/source-host-character-multiplier-formula";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT,
  type SourceHostCalculationRecord, type SourceHostCharacterMultiplierRequest, type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";

type Lane = "classic" | "stellar";
type MultiplierRecord = SourceHostCalculationRecord & { request: SourceHostCharacterMultiplierRequest };
const laneFilter = process.env.GIDPS_MULTIPLIER_LANE;
if (laneFilter !== undefined && laneFilter !== "classic" && laneFilter !== "stellar")
  throw new Error(`GIDPS_MULTIPLIER_LANE must be classic or stellar: ${laneFilter}`);

// Heizou's hold=1 takes the native 4-stack, 180-frame charge path, producing
// a set followed by a nonzero conviction add on the same AttackInfo. Heizou
// also supplies Varka's second Anemo member, so Varka's A1 party multiplier is
// cached at initialization and consumed by his skill-state normal. Navia's E
// exercises the independent, target-counted shotgun table expression.
const config = `options iteration=1 duration=20;
heizou char lvl=90/90 cons=0 talent=1,1,1;
heizou add weapon="magicguide" refine=1 lvl=90/90;
varka char lvl=90/90 cons=0 talent=1,1,1;
varka add weapon="favoniusgreatsword" refine=1 lvl=90/90;
navia char lvl=90/90 cons=0 talent=1,1,1;
navia add weapon="favoniusgreatsword" refine=1 lvl=90/90;
noelle char lvl=90/90 cons=0 talent=1,1,1;
noelle add weapon="favoniusgreatsword" refine=1 lvl=90/90;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active heizou;
heizou skill[hold=1];
varka skill;
varka attack:2;
navia skill;
wait(180);`;
const rules = {
  heizouSet: "char-mult-heizou-skill-declension",
  heizouAdd: "char-mult-heizou-skill-conviction",
  varkaCache: "char-mult-varka-a1-cache",
  varkaNormal: "char-mult-varka-skill-normal",
  navia: "char-mult-navia-shotgun",
} as const;

function multiplierRows(result: SourceHostResult): MultiplierRecord[] {
  return result.calculations.filter((row): row is MultiplierRecord => row.request.kind === "character-multiplier");
}
function hitWith(result: SourceHostResult, ruleId: string) {
  const byId = new Map(result.calculations.map(row => [row.request.id, row]));
  return result.applications.flatMap((application, index) => {
    const damage = byId.get(application.calculationId);
    if (damage?.request.kind !== "damage") return [];
    const producerId = damage.request.multiplierCalculationId;
    const producer = producerId === undefined ? undefined : byId.get(producerId);
    return producer?.request.kind === "character-multiplier" && producer.request.input.ruleId === ruleId
      ? [{ application, index, damage, producer: producer as MultiplierRecord }] : [];
  });
}

test("native character Mult set/add and cached helper multiplication replay through final damage", async ({ page }) => {
  test.setTimeout(240000);
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const measurements: Array<Record<string, unknown>> = [];
  let edited = false;

  for (const lane of (["classic", "stellar"] as const).filter(value => laneFilter === undefined || laneFilter === value)) {
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
    // Keep the unmodified native receipt even if a later replay assertion fails.
    await writeFile(resolve(`docs/validation/source-character-multiplier-${lane}-20260928.result.json`), raw);
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

    const mults = multiplierRows(result);
    const byId = new Map(result.calculations.map(row => [row.request.id, row]));
    const rows = (ruleId: string) => mults.filter(row => row.request.input.ruleId === ruleId);
    for (const row of mults)
      expect(resolveSourceHostCharacterMultiplierInput(row.request.input, result.sourceCommit).value).toBeCloseTo(row.value, 9);

    const heizou = hitWith(result, rules.heizouAdd)[0];
    expect(heizou, `${lane}: held Heizou E must hit after its full-stack conviction add`).toBeDefined();
    const finalRatio = heizou!.producer;
    const prior = byId.get(finalRatio.request.priorMultiplierCalculationId ?? -1);
    expect(prior?.request.kind).toBe("character-multiplier");
    if (prior?.request.kind !== "character-multiplier") throw new Error("Heizou base ratio producer missing");
    expect(prior.request.input.ruleId).toBe(rules.heizouSet);
    expect(finalRatio.request.componentIds).toContain(prior.request.id);
    expect(finalRatio.request.input.priorMultiplier).toBeCloseTo(prior.value, 9);
    expect(prior.request.input.state.stacks).toBe(4);
    expect(sourceHostCharacterMultiplierRuleDescriptor(finalRatio.request.input.ruleId).operation).toBe("add");
    const heizouCapture = captureSourceHostHit(result, heizou!.application.id);
    expect(replaySourceHostHit(heizouCapture).difference).toBe(0);
    expect(heizouCapture.components.map(row => row.request.id)).toEqual(expect.arrayContaining([
      prior.request.id, finalRatio.request.id]));
    expect(heizou!.damage.request.multiplierCalculationId).toBe(finalRatio.request.id);

    const varka = hitWith(result, rules.varkaNormal)[0];
    expect(varka, `${lane}: Varka's skill-state normal must consume the saved A1 factor`).toBeDefined();
    const cacheId = varka!.producer.request.valueSources?.a1Factor;
    const cache = cacheId === undefined ? undefined : byId.get(cacheId);
    expect(cache?.request.kind).toBe("character-multiplier");
    if (cache?.request.kind !== "character-multiplier") throw new Error("Varka A1 cache missing");
    expect(cache.request.input.ruleId).toBe(rules.varkaCache);
    expect(cache.request.frame).toBeLessThan(varka!.producer.request.frame);
    expect(varka!.producer.request.input.state.a1Factor).toBeCloseTo(cache.value, 9);
    expect(varka!.producer.request.componentIds).toContain(cache.request.id);
    expect(sourceHostCharacterMultiplierRuleDescriptor(varka!.producer.request.input.ruleId).operation).toBe("set");
    const varkaCapture = captureSourceHostHit(result, varka!.application.id);
    expect(replaySourceHostHit(varkaCapture).difference).toBe(0);
    expect(varkaCapture.components.map(row => row.request.id)).toEqual(expect.arrayContaining([
      cache.request.id, varka!.producer.request.id]));

    const navia = hitWith(result, rules.navia)[0];
    expect(navia, `${lane}: Navia's target-counted E must reach a damage application`).toBeDefined();
    expect(navia!.producer.request.input.state.hits).toBeGreaterThan(0);
    expect(navia!.producer.request.input.state.hits).toBeLessThanOrEqual(11);
    const naviaCapture = captureSourceHostHit(result, navia!.application.id);
    expect(replaySourceHostHit(naviaCapture).difference).toBe(0);

    const measurement: Record<string, unknown> = {
      lane, sourceCommit: result.sourceCommit, wasmSha256: result.executionArtifact?.wasmSha256,
      applications: result.applications.length, calculations: result.calculations.length,
      observedRules: Object.fromEntries([...new Set(mults.map(row => row.request.input.ruleId))]
        .map(ruleId => [ruleId, rows(ruleId).length])),
      heizou: { setId: prior.request.id, addId: finalRatio.request.id, stacks: prior.request.input.state.stacks,
        priorMultiplier: finalRatio.request.input.priorMultiplier, multiplier: finalRatio.value,
        applicationId: heizou!.application.id, replayDifference: 0 },
      varka: { cacheId: cache.request.id, consumerId: varka!.producer.request.id,
        producerFrame: cache.request.frame, consumerFrame: varka!.producer.request.frame,
        factor: cache.value, applicationId: varka!.application.id, replayDifference: 0 },
      navia: { producerId: navia!.producer.request.id, hits: navia!.producer.request.input.state.hits,
        multiplier: navia!.producer.value, applicationId: navia!.application.id, replayDifference: 0 },
    };

    if (!edited && lane === "classic") {
      const modified = { ...finalRatio.request.input,
        priorMultiplier: finalRatio.request.input.priorMultiplier + 0.1,
        state: { ...finalRatio.request.input.state, bonus: finalRatio.request.input.state.bonus! + 0.05 } };
      const experiment = deriveSourceHostCharacterFormulaEdit(heizouCapture, finalRatio.request.id, modified);
      expect(experiment.scope).toBe("formula-only");
      expect(experiment.changed).toBe(true);
      expect(experiment.editedValue).not.toBe(experiment.originalValue);
      await page.locator("#source-host-import").setInputFiles({ name: "source-character-multiplier-native.json",
        mimeType: "application/json", buffer: Buffer.from(raw) });
      await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
      await page.locator("#source-host-hit-index").fill(String(heizou!.index));
      await expect(page.locator("#source-host-hit")).toContainText("差值 0");
      await page.locator("#source-host-open-calculator").click();
      await expect(page).toHaveURL(/\/calculator$/);
      const card = page.locator(`[data-source-host-character-id="${finalRatio.request.id}"][data-source-host-character-kind="character-multiplier"]`);
      await card.locator('[data-source-host-character-state-key="bonus"]').fill(String(modified.state.bonus));
      await card.locator("[data-source-host-character-prior-multiplier]").fill(String(modified.priorMultiplier));
      await expect(card.locator("[data-source-host-character-result]")).toContainText("输入已修改");
      await expect(card.locator("[data-source-host-character-result]")).toContainText("后续命中未联动");
      const pendingEditable = page.waitForEvent("download");
      await page.locator("[data-source-host-export]").click();
      const editableRaw = await readFile((await (await pendingEditable).path())!, "utf8");
      await writeFile(resolve("docs/validation/source-character-multiplier-calculator-20260928.result.json"), editableRaw);
      const document = JSON.parse(editableRaw) as { originalCapture: typeof heizouCapture;
        characterExperiments?: Array<{ calculationId: number; input: typeof modified }> };
      expect(document.originalCapture).toEqual(heizouCapture);
      expect(document.characterExperiments?.find(row => row.calculationId === finalRatio.request.id)?.input).toEqual(modified);
      await page.locator("#calc-source-host-close").click();
      await page.locator("#calc-import").setInputFiles({ name: "source-character-multiplier-calculator.json",
        mimeType: "application/json", buffer: Buffer.from(editableRaw) });
      const restored = page.locator(`[data-source-host-character-id="${finalRatio.request.id}"]`);
      await expect(restored.locator('[data-source-host-character-state-key="bonus"]'))
        .toHaveValue(String(modified.state.bonus));
      await expect(restored.locator("[data-source-host-character-prior-multiplier]"))
        .toHaveValue(String(modified.priorMultiplier));
      expect(deriveSourceHostCharacterFormulaEdit(document.originalCapture, finalRatio.request.id,
        document.characterExperiments!.find(row => row.calculationId === finalRatio.request.id)!.input).editedValue)
        .toBeCloseTo(experiment.editedValue, 9);
      expect(replaySourceHostHit(document.originalCapture).difference).toBe(0);
      measurement.edit = { calculationId: finalRatio.request.id, scope: experiment.scope,
        originalValue: experiment.originalValue, editedValue: experiment.editedValue,
        originalCaptureUnchanged: true };
      edited = true;
    }
    measurements.push(measurement);
  }
  expect(pageErrors).toEqual([]);
  await writeFile(resolve(laneFilter === undefined
    ? "docs/validation/source-character-multiplier-20260928.result.json"
    : `docs/validation/source-character-multiplier-${laneFilter}-summary-20260928.result.json`),
  `${JSON.stringify({ schemaVersion: "source-character-multiplier-validation-v1",
    laneFilter: laneFilter ?? "both", config, measurements, pageErrors,
    exercisedRules: [rules.heizouSet, rules.heizouAdd, rules.varkaCache, rules.varkaNormal, rules.navia],
    scope: "One native scenario per fixed source lane; other character-multiplier rules are not sampled here." }, null, 2)}\n`);
  console.log(JSON.stringify({ runs: measurements, pageErrors }));
});
