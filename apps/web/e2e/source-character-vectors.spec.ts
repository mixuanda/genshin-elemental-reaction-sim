import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { captureSourceHostHit, deriveSourceHostCharacterFormulaEdit, replaySourceHostHit } from "../../../packages/sim-core/src/source-host-capture";
import { sourceHostArtifactSupportIds, sourceHostArtifactSupportRefs } from "../../../packages/sim-core/src/source-host-artifact-support";
import {
  resolveSourceHostCharacterModifierInput,
} from "../../../packages/sim-core/src/source-host-character-modifier-formula";
import {
  sourceHostCharacterModifierDynamicRuleDescriptor,
  type SourceHostCharacterModifierDynamicInput,
} from "../../../packages/sim-core/src/source-host-character-modifier-dynamic-formula";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT,
  type SourceHostCalculationRecord, type SourceHostCharacterModifierRequest, type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";

type Lane = "classic" | "stellar";
type Scene = "creation-table" | "indexed-slots";
type VectorRecord = SourceHostCalculationRecord & {
  request: SourceHostCharacterModifierRequest & { input: SourceHostCharacterModifierDynamicInput };
};
const laneFilter = process.env.GIDPS_VECTOR_LANE;
if (laneFilter !== undefined && laneFilter !== "classic" && laneFilter !== "stellar")
  throw new Error(`GIDPS_VECTOR_LANE must be classic or stellar: ${laneFilter}`);

const creationTable = `options iteration=1 duration=21;
ayato char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
ayato add weapon="favoniussword" refine=1 lvl=90/90;
hutao char lvl=90/90 cons=0 talent=1,1,1;
hutao add weapon="favoniuslance" refine=1 lvl=90/90;
hutao add stats hp=5000 cr=0.2 cd=0.4;
keqing char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
keqing add weapon="favoniussword" refine=1 lvl=90/90;
yanfei char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
yanfei add weapon="magicguide" refine=1 lvl=90/90;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active ayato;
ayato burst;
hutao skill;
hutao attack:3;
keqing burst;
keqing skill;
keqing attack:2;
yanfei burst;
yanfei charge:2;
wait(120);`;

// Two converted Pyro samplers leave Geo active. One native player hit advances
// Diluc C2's two slots before Xilonen's C2 and Nicole's team buff are read.
const indexedSlots = `options iteration=1 duration=20;
xilonen char lvl=90/90 cons=2 talent=1,1,1;
xilonen add weapon="favoniussword" refine=1 lvl=90/90;
nicole char lvl=90/90 cons=0 talent=1,1,1;
nicole add weapon="magicguide" refine=1 lvl=90/90;
diluc char lvl=90/90 cons=2 talent=1,1,1;
diluc add weapon="favoniusgreatsword" refine=1 lvl=90/90;
navia char lvl=90/90 cons=0 talent=1,1,1;
navia add weapon="favoniusgreatsword" refine=1 lvl=90/90;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
hurt once interval=70 amount=1000,1000 element=physical;
active diluc;
wait(90);
diluc attack:2;
xilonen skill;
xilonen attack:2;
nicole skill;
navia skill;
navia attack:3;
diluc attack:2;
wait(180);`;
const scenes: Array<{ lane: Lane; scene: Scene; config: string }> =
  (["classic", "stellar"] as const).flatMap(lane => [
    { lane, scene: "creation-table" as const, config: creationTable },
    { lane, scene: "indexed-slots" as const, config: indexedSlots },
  ]).filter(row => laneFilter === undefined || row.lane === laneFilter);
const ids = {
  ayato: "char-vector-ayato-burst-dmgp",
  hutao: "char-vector-hutao-paramita-atk",
  keqingCr: "char-vector-keqing-a4-cr",
  keqingEr: "char-vector-keqing-a4-er",
  yanfei: "char-vec-yanfei-burst",
  dilucAtk: "char-vector-diluc-c2-atkp",
  dilucSpeed: "char-vector-diluc-c2-atkspd",
  xilonenGeo: "char-vec-xilonen-c2-geo",
  xilonenPyro: "char-vec-xilonen-c2-pyro",
  nicole: "char-vector-nicole-skill",
  navia: "char-vector-navia-a1-dmgp",
} as const;

test("remaining native character vectors preserve creation, indexed slot and editable formula receipts", async ({ page }) => {
  test.setTimeout(420000);
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const evidence: Array<{ lane: Lane; scene: Scene; sourceCommit: string; wasmSha256?: string | undefined;
    calculations: number; applications: number; vectorRules: Record<string, number>;
    selections: Record<string, { applicationId: number; frame: number; scalarIds: number[]; replayDifference: number }>;
    edit?: { calculationId: number; originalValue: number; editedValue: number; stateKey: string;
      originalCaptureUnchanged: boolean; restoredValue: number };
  }> = [];

  for (const scenario of scenes) {
    await page.goto("/source-simulation");
    await page.locator("#source-host-variant").selectOption(scenario.lane);
    await page.locator("#source-host-config").fill(scenario.config);
    await page.locator("#source-host-seed").fill("20260928");
    await page.locator("#source-host-run").click();
    await expect(page.locator("#source-host-status")).toContainText(/本次运行完成|运行停止|执行器错误/, { timeout: 90000 });
    await expect(page.locator("#source-host-status")).toContainText("本次运行完成");
    const pending = page.waitForEvent("download");
    await page.locator("#source-host-export").click();
    const raw = await readFile((await (await pending).path())!, "utf8");
    await writeFile(resolve(`docs/validation/source-character-vectors-${scenario.lane}-${scenario.scene}-20260928.result.json`), raw);
    const result = JSON.parse(raw) as SourceHostResult;
    expect(result.sourceCommit).toBe(scenario.lane === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT);
    expect(result.config).toBe(scenario.config);
    expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
    const byId = new Map(result.calculations.map(row => [row.request.id, row]));
    const vectors = result.calculations.filter((row): row is VectorRecord =>
      row.request.kind === "character-modifier" && "phase" in row.request.input
        && (row.request.input.ruleId.startsWith("char-vector-") || row.request.input.ruleId.startsWith("char-vec-")));
    const vectorRules = Object.fromEntries([...new Set(vectors.map(row => row.request.input.ruleId))]
      .map(ruleId => [ruleId, vectors.filter(row => row.request.input.ruleId === ruleId).length]));
    const selections: (typeof evidence)[number]["selections"] = {};
    const measurement: (typeof evidence)[number] = { lane: scenario.lane, scene: scenario.scene,
      sourceCommit: result.sourceCommit, wasmSha256: result.executionArtifact?.wasmSha256,
      calculations: result.calculations.length, applications: result.applications.length, vectorRules, selections };
    evidence.push(measurement);
    for (const row of vectors) {
      const descriptor = sourceHostCharacterModifierDynamicRuleDescriptor(row.request.input.ruleId);
      expect(row.request.input.modifierKey).toBe(descriptor.modifierKey);
      expect(row.request.input.phase).toBe(descriptor.phase);
      expect(resolveSourceHostCharacterModifierInput(row.request.input, result.sourceCommit).value)
        .toBeCloseTo(row.value, 10);
    }
    const ruleRows = (ruleId: string) => vectors.filter(row => row.request.input.ruleId === ruleId);
    const hitsWith = (...ruleIds: string[]) => result.applications.flatMap((application, index) => {
      const calculation = byId.get(application.calculationId);
      if (!calculation || calculation.request.kind !== "damage") return [];
      const support = sourceHostArtifactSupportIds(calculation.request);
      const selectedIds = ruleIds.map(ruleId => ruleRows(ruleId).find(row => support.includes(row.request.id))?.request.id);
      return selectedIds.every(id => id !== undefined)
        ? [{ application, index, calculation, scalarIds: selectedIds as number[] }] : [];
    });
    const saveHit = (key: string, hit: ReturnType<typeof hitsWith>[number]) => {
      const capture = captureSourceHostHit(result, hit.application.id);
      const replay = replaySourceHostHit(capture);
      expect(replay.difference).toBe(0);
      expect(capture.supportingCalculations?.map(row => row.request.id)).toEqual(expect.arrayContaining(hit.scalarIds));
      selections[key] = { applicationId: hit.application.id, frame: hit.application.frame,
        scalarIds: hit.scalarIds, replayDifference: replay.difference };
      return capture;
    };

    if (scenario.scene === "creation-table") {
      const ayato = ruleRows(ids.ayato)[0];
      const hutao = ruleRows(ids.hutao)[0];
      const keqingCr = ruleRows(ids.keqingCr)[0];
      const keqingEr = ruleRows(ids.keqingEr)[0];
      const yanfei = ruleRows(ids.yanfei)[0];
      for (const [name, row] of [["Ayato Q", ayato], ["Hu Tao E", hutao], ["Keqing CR", keqingCr],
        ["Keqing ER", keqingEr], ["Yanfei Q", yanfei]] as const)
        expect(row, `${scenario.lane} native ${name} creation`).toBeDefined();
      expect(hutao!.request.input.phase).toBe("creation");
      expect(hutao!.request.statReads).toHaveLength(2);
      expect(hutao!.request.input.state.maxHp).toBeGreaterThan(0);
      expect(hutao!.request.input.state.baseAtk).toBeGreaterThan(0);
      expect(hutao!.value).toBeGreaterThan(0);
      expect(hutao!.value).toBeLessThanOrEqual(4 * hutao!.request.input.state.baseAtk!);
      expect(keqingCr!.value).toBeCloseTo(0.15, 10);
      expect(keqingEr!.value).toBeCloseTo(0.15, 10);
      const huTaoHits = hitsWith(ids.ayato, ids.hutao).filter(hit => hit.calculation.request.actorKey === "hutao");
      expect(new Set(huTaoHits.map(hit => hit.application.frame)).size,
        `${scenario.lane} must reuse Hu Tao E and Ayato Q creation across native normal hits`).toBeGreaterThan(1);
      const hit = huTaoHits[0]!;
      const capture = saveHit("hutao-ayato", hit);
      const huTaoRefs = sourceHostArtifactSupportRefs(hit.calculation.request);
      for (const created of [hutao!, ayato!]) {
        expect(huTaoRefs.some(ref => ref.creationIds?.includes(created.request.id)
          && ref.actorIndex === 1)).toBe(true);
        expect(created.request.input.sourceHolderIndex).toBe(created.request.actorIndex);
      }
      const keqingHit = hitsWith(ids.keqingCr, ids.keqingEr)
        .find(row => row.calculation.request.actorKey === "keqing");
      expect(keqingHit, `${scenario.lane} Keqing A4 must preserve both CR and ER slots`).toBeDefined();
      saveHit("keqing-two-slots", keqingHit!);
      const yanfeiHit = hitsWith(ids.yanfei).find(row => row.calculation.request.actorKey === "yanfei");
      expect(yanfeiHit, `${scenario.lane} Yanfei charged hit must consume Q talent snapshot`).toBeDefined();
      saveHit("yanfei-talent", yanfeiHit!);

      if (scenario.lane === "classic") {
        const editId = ayato!.request.id;
        const originalInput = ayato!.request.input;
        const editedInput = { ...originalInput,
          state: { ...originalInput.state, talent: originalInput.state.talent! + 1 } };
        const coreEdit = deriveSourceHostCharacterFormulaEdit(capture, editId, editedInput);
        expect(coreEdit.editedValue).not.toBe(coreEdit.originalValue);
        expect(coreEdit.changed).toBe(true);
        expect(coreEdit.formulaTrace.some(node => node.inputs.some(input =>
          input.origin === "user-edited-character-experiment"))).toBe(true);
        await page.locator("#source-host-import").setInputFiles({ name: "source-character-vectors-native.json",
          mimeType: "application/json", buffer: Buffer.from(raw) });
        await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
        await page.locator("#source-host-hit-index").fill(String(hit.index));
        await expect(page.locator("#source-host-hit")).toContainText("差值 0");
        await page.locator("#source-host-open-calculator").click();
        await expect(page).toHaveURL(/\/calculator$/);
        await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
        const card = page.locator(`[data-source-host-character-id="${editId}"]`);
        await card.locator('[data-source-host-character-state-key="talent"]').fill(String(editedInput.state.talent));
        await expect(card.locator("[data-source-host-character-result]")).toContainText("输入已修改");
        const pendingEditable = page.waitForEvent("download");
        await page.locator("[data-source-host-export]").click();
        const editableText = await readFile((await (await pendingEditable).path())!, "utf8");
        await writeFile(resolve("docs/validation/source-character-vectors-calculator-20260928.result.json"), editableText);
        const document = JSON.parse(editableText) as { originalCapture: typeof capture;
          characterExperiments?: Array<{ calculationId: number; input: typeof editedInput }> };
        expect(document.originalCapture).toEqual(capture);
        expect(document.characterExperiments?.find(row => row.calculationId === editId)?.input).toEqual(editedInput);
        await page.locator("#calc-source-host-close").click();
        await page.locator("#calc-import").setInputFiles({ name: "source-character-vectors-calculator.json",
          mimeType: "application/json", buffer: Buffer.from(editableText) });
        const restored = page.locator(`[data-source-host-character-id="${editId}"]`);
        await expect(restored.locator('[data-source-host-character-state-key="talent"]'))
          .toHaveValue(String(editedInput.state.talent));
        await expect(restored.locator("[data-source-host-character-result]")).toContainText("输入已修改");
        await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
        measurement.edit = { calculationId: editId, originalValue: coreEdit.originalValue,
          editedValue: coreEdit.editedValue, stateKey: "talent", originalCaptureUnchanged: true,
          restoredValue: deriveSourceHostCharacterFormulaEdit(document.originalCapture, editId,
            document.characterExperiments!.find(row => row.calculationId === editId)!.input).editedValue };
      }
    } else {
      const dilucAtk = ruleRows(ids.dilucAtk);
      const dilucSpeed = ruleRows(ids.dilucSpeed);
      const nicole = ruleRows(ids.nicole)[0];
      expect(dilucAtk.length, `${scenario.lane} native hurt must create Diluc C2 ATK stacks`).toBeGreaterThan(0);
      expect(dilucSpeed.length, `${scenario.lane} native hurt must create Diluc C2 speed stacks`).toBeGreaterThan(0);
      expect(nicole, `${scenario.lane} Nicole E must snapshot team ATK`).toBeDefined();
      expect(nicole!.request.statRead).toBeDefined();
      expect(dilucAtk[0]!.request.input.state.stacks).toBe(dilucSpeed[0]!.request.input.state.stacks);
      expect(dilucAtk[0]!.value).toBeCloseTo(0.1 * dilucAtk[0]!.request.input.state.stacks!, 10);
      expect(dilucSpeed[0]!.value).toBeCloseTo(0.05 * dilucSpeed[0]!.request.input.state.stacks!, 10);
      const dilucHit = hitsWith(ids.dilucAtk, ids.dilucSpeed)
        .find(hit => hit.calculation.request.actorKey === "diluc");
      expect(dilucHit, `${scenario.lane} Diluc hit must read both updated C2 slots`).toBeDefined();
      saveHit("diluc-two-slots", dilucHit!);
      const naviaHit = hitsWith(ids.xilonenGeo, ids.nicole, ids.navia)
        .find(hit => hit.calculation.request.actorKey === "navia");
      expect(naviaHit, `${scenario.lane} Navia must consume Geo indexed C2, Nicole team ATK and A1`).toBeDefined();
      saveHit("navia-indexed-team", naviaHit!);
      const geo = byId.get(naviaHit!.scalarIds[0]!);
      expect(geo?.request.kind).toBe("character-modifier");
      if (geo?.request.kind !== "character-modifier") throw new Error("Xilonen Geo formula missing");
      expect(geo.request.input.sourceHolderIndex).toBe(0);
      expect(geo.request.actorIndex).toBe(3);
      expect(geo.value).toBeCloseTo(0.5, 10);
      expect(byId.get(naviaHit!.scalarIds[2]!)?.value).toBeCloseTo(0.4, 10);
      expect(sourceHostArtifactSupportRefs(naviaHit!.calculation.request).some(ref =>
        ref.creationIds?.includes(nicole!.request.id) && ref.actorIndex === 3)).toBe(true);
      const pyroHit = hitsWith(ids.xilonenPyro)
        .find(hit => hit.calculation.request.actorKey === "diluc");
      expect(pyroHit, `${scenario.lane} Xilonen sampler must give actual Pyro recipient ATK`).toBeDefined();
      saveHit("diluc-pyro-index", pyroHit!);
      const pyro = byId.get(pyroHit!.scalarIds[0]!);
      expect(pyro?.request.kind).toBe("character-modifier");
      if (pyro?.request.kind !== "character-modifier") throw new Error("Xilonen Pyro formula missing");
      expect(pyro.request.input.sourceHolderIndex).toBe(0);
      expect(pyro.request.actorIndex).toBe(2);
      expect(pyro.value).toBeCloseTo(0.45, 10);
      expect(naviaHit!.scalarIds[0]).not.toBe(pyroHit!.scalarIds[0]);
    }
  }

  expect(pageErrors).toEqual([]);
  const aggregatePath = laneFilter === undefined
    ? "docs/validation/source-character-vectors-20260928.result.json"
    : `docs/validation/source-character-vectors-${laneFilter}-20260928.result.json`;
  await writeFile(resolve(aggregatePath), `${JSON.stringify({ schemaVersion: "source-character-vectors-validation-v1",
    laneFilter: laneFilter ?? "both", evidence, pageErrors }, null, 2)}\n`);
  console.log(JSON.stringify({ runs: evidence.map(({ lane, scene, vectorRules, selections, edit }) => ({
    lane, scene, vectorRules, selections, edit })), pageErrors }));
});
