import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { captureSourceHostHit, deriveSourceHostCharacterFormulaEdit, replaySourceHostHit } from "../../../packages/sim-core/src/source-host-capture";
import { resolveSourceHostCharacterFlatInput, sourceHostCharacterFlatRuleDescriptor } from "../../../packages/sim-core/src/source-host-character-flat-formula";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT,
  type SourceHostCalculationRecord, type SourceHostCharacterFlatRequest, type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";

type Lane = "classic" | "stellar";
type Scene = "chiori-kokomi" | "nicole-ayato-mualani";
type FlatRecord = SourceHostCalculationRecord & { request: SourceHostCharacterFlatRequest };
const laneFilter = process.env.GIDPS_FLAT_LANE;
const sceneFilter = process.env.GIDPS_FLAT_SCENE;
if (laneFilter !== undefined && laneFilter !== "classic" && laneFilter !== "stellar")
  throw new Error(`GIDPS_FLAT_LANE must be classic or stellar: ${laneFilter}`);
if (sceneFilter !== undefined && sceneFilter !== "chiori-kokomi" && sceneFilter !== "nicole-ayato-mualani")
  throw new Error(`GIDPS_FLAT_SCENE must be chiori-kokomi or nicole-ayato-mualani: ${sceneFilter}`);

// Kokomi Q starts the garment before E creates its saved skill FlatDmg. E permits
// swapping before frame 100, so the next jellyfish tick consumes that saved ID.
// Chiori E's upward sweep independently sets snapshot DEF, then multiplies it.
const chioriKokomi = `options iteration=1 duration=18;
kokomi char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
kokomi add weapon="magicguide" refine=1 lvl=90/90;
kokomi add stats hp=5000;
chiori char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
chiori add weapon="favoniussword" refine=1 lvl=90/90;
noelle char lvl=90/90 cons=0 talent=1,1,1;
noelle add weapon="favoniusgreatsword" refine=1 lvl=90/90;
barbara char lvl=90/90 cons=0 talent=1,1,1;
barbara add weapon="magicguide" refine=1 lvl=90/90;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active kokomi;
kokomi burst;
kokomi skill;
chiori skill;
chiori burst;
wait(240);`;

// Nicole's burst status starts one frame after her initial hit. Razor is a
// native Hexerei actor, so his subsequent skill can trigger Nicole's delayed
// projection with actor != holder. Ayato's infused normals add Namisen. Mualani
// Q separately writes its base set and A4 add in the delayed task.
const nicoleAyatoMualani = `options iteration=1 duration=27;
nicole char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
nicole add weapon="magicguide" refine=1 lvl=90/90;
razor char lvl=90/90 cons=0 talent=1,1,1;
razor add weapon="favoniusgreatsword" refine=1 lvl=90/90;
ayato char lvl=90/90 cons=0 talent=1,1,1;
ayato add weapon="favoniussword" refine=1 lvl=90/90;
ayato add stats hp=5000;
mualani char lvl=90/90 cons=1 talent=1,1,1 +params=[start_energy=100];
mualani add weapon="magicguide" refine=1 lvl=90/90;
mualani add stats hp=5000;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active nicole;
nicole burst;
razor skill;
ayato skill;
ayato attack:3;
mualani burst;
wait(240);`;
const scenes: Array<{ lane: Lane; scene: Scene; config: string }> =
  (["classic", "stellar"] as const).flatMap(lane => [
    { lane, scene: "chiori-kokomi" as const, config: chioriKokomi },
    { lane, scene: "nicole-ayato-mualani" as const, config: nicoleAyatoMualani },
  ]).filter(row => (laneFilter === undefined || row.lane === laneFilter) &&
    (sceneFilter === undefined || row.scene === sceneFilter));
const rules = {
  chioriSet: "char-flat-chiori-skill-upward-def-set",
  chioriMultiply: "char-flat-chiori-skill-upward-scale",
  kokomiProducer: "char-flat-kokomi-bonus-skill",
  kokomiTick: "char-flat-kokomi-skill-tick-active",
  nicole: "char-flat-nicole-burst-projection",
  ayato: "char-flat-ayato-namisen",
  mualaniSet: "char-flat-mualani-burst",
  mualaniAdd: "char-flat-mualani-a4",
} as const;

function flatRows(result: SourceHostResult): FlatRecord[] {
  return result.calculations.filter((row): row is FlatRecord => row.request.kind === "character-flat");
}
function hitWith(result: SourceHostResult, ruleId: string) {
  const byId = new Map(result.calculations.map(row => [row.request.id, row]));
  return result.applications.flatMap((application, index) => {
    const damage = byId.get(application.calculationId);
    if (damage?.request.kind !== "damage") return [];
    const id = damage.request.componentIds.find(componentId => {
      const row = byId.get(componentId);
      return row?.request.kind === "character-flat" && row.request.input.ruleId === ruleId;
    });
    return id === undefined ? [] : [{ application, index, damage, flat: byId.get(id) as FlatRecord }];
  });
}

test("native queued FlatDmg preserves set/add/multiply, saved values, recipient identity, and formula edits", async ({ page }) => {
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
    // Preserve the raw native receipt before any checks or formula experiments.
    await writeFile(resolve(`docs/validation/source-character-flat-${lane}-${scene}-20260928.result.json`), raw);
    const result = JSON.parse(raw) as SourceHostResult;
    expect(result.sourceCommit).toBe(lane === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT);
    expect(result.config).toBe(config);
    expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
    const manifest = JSON.parse(await readFile(resolve(lane === "classic"
      ? "packages/source-host/dist/manifest.json" : "packages/source-host/stellar-overlay/dist/manifest.json"), "utf8")) as { artifacts?: Array<{path: string; sha256: string}>; files?: Array<{path: string; sha256: string}> };
    expect(result.executionArtifact?.wasmSha256).toBe((manifest.artifacts ?? manifest.files)!.find(row => row.path === "source-host.wasm")!.sha256);
    const flats = flatRows(result);
    const byId = new Map(result.calculations.map(row => [row.request.id, row]));
    const rows = (id: string) => flats.filter(row => row.request.input.ruleId === id);
    for (const row of flats) {
      expect(resolveSourceHostCharacterFlatInput(row.request.input, result.sourceCommit).value)
        .toBeCloseTo(row.value, 9);
      expect(row.request.componentScope).toBe("queued-attack");
    }
    const record: Record<string, unknown> = { lane, scene, sourceCommit: result.sourceCommit,
      wasmSha256: result.executionArtifact?.wasmSha256, applications: result.applications.length, calculations: result.calculations.length,
      observedRules: Object.fromEntries([...new Set(flats.map(row => row.request.input.ruleId))]
        .map(id => [id, rows(id).length])) };

    if (scene === "chiori-kokomi") {
      const upward = hitWith(result, rules.chioriMultiply)[0];
      expect(upward, `${lane}: Chiori E must hit with its multiplied snapshot DEF`).toBeDefined();
      const scale = upward!.flat;
      const originalSet = rows(rules.chioriSet).find(row => scale.request.componentIds.includes(row.request.id));
      expect(originalSet, `${lane}: multiply must link the earlier set`).toBeDefined();
      expect(sourceHostCharacterFlatRuleDescriptor(scale.request.input.ruleId).operation).toBe("multiply");
      expect(scale.request.input.priorFlatDamage).toBeCloseTo(originalSet!.value, 9);
      expect(scale.request.priorComponents.some(component => component.id === originalSet!.request.id)).toBe(true);
      expect(scale.request.input.state.talentLevel).toBeDefined();
      expect(upward!.damage.request.componentApplications.find(component => component.id === scale.request.id))
        .toMatchObject({ id: scale.request.id, multiplier: 1, amount: scale.value });
      const upwardCapture = captureSourceHostHit(result, upward!.application.id);
      expect(replaySourceHostHit(upwardCapture).difference).toBe(0);
      expect(upwardCapture.components.map(row => row.request.id)).toEqual(expect.arrayContaining([originalSet!.request.id, scale.request.id]));

      // The first tick can evaluate its producer at the same frame. Select a
      // later tick whose saved producer was recorded in an earlier frame.
      const stored = rows(rules.kokomiTick).find(row => {
        const id = row.request.valueSources?.savedSkillFlatDmg;
        const producer = id === undefined ? undefined : byId.get(id);
        return producer?.request.kind === "character-flat" && producer.request.frame < row.request.frame;
      });
      expect(stored, `${lane}: a later jellyfish tick must consume an earlier saved producer`).toBeDefined();
      const producerId = stored!.request.valueSources!.savedSkillFlatDmg!;
      const producer = byId.get(producerId);
      expect(producer?.request.kind).toBe("character-flat");
      if (producer?.request.kind !== "character-flat") throw new Error("Kokomi saved producer missing");
      expect(producer.request.input.ruleId).toBe(rules.kokomiProducer);
      expect(producer.request.frame).toBeLessThan(stored!.request.frame);
      expect(stored!.request.input.state.savedSkillFlatDmg).toBeCloseTo(producer.value, 9);
      const tick = hitWith(result, rules.kokomiTick).find(hit => hit.flat.request.id === stored!.request.id);
      expect(tick, `${lane}: saved tick must reach an actual damage application`).toBeDefined();
      const tickCapture = captureSourceHostHit(result, tick!.application.id);
      expect(replaySourceHostHit(tickCapture).difference).toBe(0);
      expect(tickCapture.components.map(row => row.request.id)).toEqual(expect.arrayContaining([producerId, stored!.request.id]));
      record.chiori = { setId: originalSet!.request.id, multiplyId: scale.request.id,
        priorFlatDamage: scale.request.input.priorFlatDamage, value: scale.value, replayDifference: 0 };
      record.kokomi = { producerId, tickId: stored!.request.id, producerFrame: producer.request.frame,
        tickFrame: stored!.request.frame, value: stored!.value, replayDifference: 0 };

      if (!edited && lane === "classic") {
        const modified = { ...scale.request.input, priorFlatDamage: scale.request.input.priorFlatDamage + 25,
          state: { ...scale.request.input.state, talentLevel: scale.request.input.state.talentLevel! + 1 } };
        const experiment = deriveSourceHostCharacterFormulaEdit(upwardCapture, scale.request.id, modified);
        expect(experiment.scope).toBe("formula-only");
        expect(experiment.changed).toBe(true);
        expect(experiment.editedValue).not.toBe(experiment.originalValue);
        await page.locator("#source-host-import").setInputFiles({ name: "source-character-flat-native.json",
          mimeType: "application/json", buffer: Buffer.from(raw) });
        await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
        await page.locator("#source-host-hit-index").fill(String(upward!.index));
        await expect(page.locator("#source-host-hit")).toContainText("差值 0");
        await page.locator("#source-host-open-calculator").click();
        await expect(page).toHaveURL(/\/calculator$/);
        await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
        const card = page.locator(`[data-source-host-character-id="${scale.request.id}"][data-source-host-character-kind="character-flat"]`);
        await card.locator('[data-source-host-character-state-key="talentLevel"]').fill(String(modified.state.talentLevel));
        await card.locator("[data-source-host-character-prior-flat]").fill(String(modified.priorFlatDamage));
        await expect(card.locator("[data-source-host-character-result]")).toContainText("输入已修改");
        await expect(card.locator("[data-source-host-character-result]")).toContainText("后续命中未联动");
        const pendingEditable = page.waitForEvent("download");
        await page.locator("[data-source-host-export]").click();
        const editableRaw = await readFile((await (await pendingEditable).path())!, "utf8");
        await writeFile(resolve("docs/validation/source-character-flat-calculator-20260928.result.json"), editableRaw);
        const document = JSON.parse(editableRaw) as { originalCapture: typeof upwardCapture;
          characterExperiments?: Array<{ calculationId: number; input: typeof modified }> };
        expect(document.originalCapture).toEqual(upwardCapture);
        expect(document.characterExperiments?.find(row => row.calculationId === scale.request.id)?.input).toEqual(modified);
        await page.locator("#calc-source-host-close").click();
        await page.locator("#calc-import").setInputFiles({ name: "source-character-flat-calculator.json",
          mimeType: "application/json", buffer: Buffer.from(editableRaw) });
        const restored = page.locator(`[data-source-host-character-id="${scale.request.id}"]`);
        await expect(restored.locator('[data-source-host-character-state-key="talentLevel"]'))
          .toHaveValue(String(modified.state.talentLevel));
        await expect(restored.locator("[data-source-host-character-prior-flat]"))
          .toHaveValue(String(modified.priorFlatDamage));
        expect(deriveSourceHostCharacterFormulaEdit(document.originalCapture, scale.request.id,
          document.characterExperiments!.find(row => row.calculationId === scale.request.id)!.input).editedValue)
          .toBeCloseTo(experiment.editedValue, 9);
        await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
        record.edit = { calculationId: scale.request.id, scope: experiment.scope,
          originalValue: experiment.originalValue, editedValue: experiment.editedValue,
          originalCaptureUnchanged: true };
        edited = true;
      }
    } else {
      const mualani = hitWith(result, rules.mualaniAdd)[0];
      expect(mualani, `${lane}: Mualani Q must reach its A4 add`).toBeDefined();
      const base = rows(rules.mualaniSet).find(row => mualani!.flat.request.componentIds.includes(row.request.id));
      expect(base, `${lane}: A4 add must reference Q base set`).toBeDefined();
      expect(sourceHostCharacterFlatRuleDescriptor(mualani!.flat.request.input.ruleId).operation).toBe("add");
      expect(mualani!.flat.request.input.priorFlatDamage).toBeCloseTo(base!.value, 9);
      expect(mualani!.flat.request.statReads?.[0]?.id).toBe(base!.request.statReads?.[0]?.id);
      const mualaniCapture = captureSourceHostHit(result, mualani!.application.id);
      expect(replaySourceHostHit(mualaniCapture).difference).toBe(0);
      expect(mualaniCapture.components.map(row => row.request.id)).toEqual(expect.arrayContaining([base!.request.id, mualani!.flat.request.id]));
      const projection = hitWith(result, rules.nicole)
        .find(hit => hit.flat.request.actorIndex !== hit.flat.request.input.sourceHolderIndex);
      expect(projection, `${lane}: Razor hit must trigger Nicole's cross-actor projection`).toBeDefined();
      expect(projection!.flat.request.actorKey).toBe("razor");
      expect(projection!.flat.request.input.sourceHolderIndex).toBe(0);
      expect(projection!.flat.request.statReads).toHaveLength(1);
      const projectionCapture = captureSourceHostHit(result, projection!.application.id);
      expect(replaySourceHostHit(projectionCapture).difference).toBe(0);
      const ayato = hitWith(result, rules.ayato).find(hit => hit.flat.request.input.state.stacks! > 0);
      expect(ayato, `${lane}: later Ayato infused normal must add a nonzero Namisen term`).toBeDefined();
      const ayatoCapture = captureSourceHostHit(result, ayato!.application.id);
      expect(replaySourceHostHit(ayatoCapture).difference).toBe(0);
      record.mualani = { setId: base!.request.id, addId: mualani!.flat.request.id,
        priorFlatDamage: mualani!.flat.request.input.priorFlatDamage, value: mualani!.flat.value,
        replayDifference: 0 };
      record.nicole = { formulaId: projection!.flat.request.id, actorIndex: projection!.flat.request.actorIndex,
        holderIndex: projection!.flat.request.input.sourceHolderIndex, replayDifference: 0 };
      record.ayato = { formulaId: ayato!.flat.request.id, value: ayato!.flat.value, replayDifference: 0 };
    }
    measurements.push(record);
  }
  expect(pageErrors).toEqual([]);
  const summary = laneFilter === undefined && sceneFilter === undefined
    ? "docs/validation/source-character-flat-20260928.result.json"
    : `docs/validation/source-character-flat-${laneFilter ?? "both"}-${sceneFilter ?? "both"}-summary-20260928.result.json`;
  await writeFile(resolve(summary), `${JSON.stringify({ schemaVersion: "source-character-flat-validation-v1",
    laneFilter: laneFilter ?? "both", sceneFilter: sceneFilter ?? "both", measurements, pageErrors }, null, 2)}\n`);
  console.log(JSON.stringify({ runs: measurements, pageErrors }));
});
