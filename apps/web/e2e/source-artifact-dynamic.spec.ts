import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  calculateSourceHostEditableCalculation, captureSourceHostHit, deriveSourceHostArtifactScalarEdit, replaySourceHostHit,
} from "../../../packages/sim-core/src/source-host-capture";
import { sourceHostArtifactSupportIds } from "../../../packages/sim-core/src/source-host-artifact-support";
import {
  isSourceHostArtifactDynamicRuleId, sourceHostArtifactDynamicRuleDescriptor, sourceHostArtifactDynamicRuleIds,
  type SourceHostArtifactDynamicDescriptor,
} from "../../../packages/sim-core/src/source-host-artifact-dynamic-formula";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT,
  type SourceHostCalculationRecord, type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";

// Set names are from each pinned source's internal/artifacts/*/config.yml.
// Hydro -> Oz -> Swirl provides the Gilded and VV reaction gates; off-field
// Noelle gains Husk stacks before Q, then her normals trigger Xingqiu's Q.
const ordinary = `options iteration=1 duration=19;
xingqiu char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
xingqiu add weapon="favoniussword" refine=1 lvl=90/90;
xingqiu add set="emblemofseveredfate" count=4;
xingqiu add stats atk=200 er=0.2 cr=0.2 cd=0.4;
fischl char lvl=90/90 cons=0 talent=1,1,1;
fischl add weapon="favoniuswarbow" refine=1 lvl=90/90;
fischl add set="gildeddreams" count=4;
fischl add stats atk=200 em=100 cr=0.2 cd=0.4;
noelle char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
noelle add weapon="whiteblind" refine=1 lvl=90/90;
noelle add set="huskofopulentdreams" count=4;
noelle add stats def=200 cr=0.2 cd=0.4;
sucrose char lvl=90/90 cons=0 talent=1,1,1;
sucrose add weapon="magicguide" refine=1 lvl=90/90;
sucrose add set="viridescentvenerer" count=4;
sucrose add stats atk=200 em=200 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active xingqiu;
xingqiu skill;
xingqiu burst;
xingqiu attack;
fischl skill;
sucrose skill;
noelle burst;
noelle attack:3;
fischl attack:2;
wait(300);`;

// Three lunar characters supply Moonsign 2+; each set owner has a native
// elemental hit, while Lauma/Kuki supply a later bloom/electro reaction.
const lunar = `options iteration=1 duration=18;
columbina char lvl=90/90 cons=0 talent=1,1,1;
columbina add weapon="magicguide" refine=1 lvl=90/90;
columbina add set="silkenmoonsserenade" count=4;
columbina add stats hp=200 em=100 cr=0.2 cd=0.4;
ineffa char lvl=90/90 cons=0 talent=1,1,1;
ineffa add weapon="favoniuslance" refine=1 lvl=90/90;
ineffa add set="nightoftheskysunveiling" count=4;
ineffa add stats atk=200 em=100 cr=0.2 cd=0.4;
lauma char lvl=90/90 cons=0 talent=1,1,1;
lauma add weapon="magicguide" refine=1 lvl=90/90;
lauma add set="flowerofparadiselost" count=4;
lauma add stats atk=200 em=200 cr=0.2 cd=0.4;
kukishinobu char lvl=90/90 cons=0 talent=1,1,1;
kukishinobu add weapon="favoniussword" refine=1 lvl=90/90;
kukishinobu add set="thunderingfury" count=4;
kukishinobu add stats hp=200 em=200 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active columbina;
columbina skill;
ineffa skill;
lauma skill;
kukishinobu skill;
lauma attack:2;
wait(300);`;

type ArtifactRecord = SourceHostCalculationRecord & {
  request: Extract<SourceHostCalculationRecord["request"], { kind: "artifact-scalar" }>;
};
type Scenario = "ordinary" | "lunar";

function registryRule(set: string, match: (rule: SourceHostArtifactDynamicDescriptor) => boolean, sourceCommit: string): string {
  const ids = sourceHostArtifactDynamicRuleIds.filter(id => {
    const descriptor = sourceHostArtifactDynamicRuleDescriptor(id);
    return descriptor.set === set && (descriptor.sourceCommits === undefined || descriptor.sourceCommits.includes(sourceCommit)) && match(descriptor);
  });
  expect(ids, `Expected one registered dynamic rule for ${set}`).toHaveLength(1);
  return ids[0]!;
}

test("dynamic artifact Amount receipts replay and edit across both fixed source lanes", async ({ page }) => {
  test.setTimeout(480000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const evidence: Array<{
    variant: "classic" | "stellar"; scenario: Scenario; sourceCommit: string; wasmSha256: string | undefined;
    calculations: number; applications: number; observedRuleCounts: Record<string, number>;
    selectedApplicationId: number; selectedHitIndex: number; selectedDamage: number;
    support: Array<{ id: number; ruleId: string; actorKey: string; value: number; state: Record<string, number>; sourceRefs: string[] }>;
    multiSlot: { gilded?: number[]; husk?: number[] } | undefined; partyRecipients: string[] | undefined;
    emblemEdit?: { calculationId: number; originalER: number; editedER: number; originalValue: number;
      editedValue: number; originalDamage: number; editedDamage: number; originalCaptureUnchanged: boolean; restoredResult: string } | undefined;
  }> = [];

  for (const variant of ["classic", "stellar"] as const) for (const scenario of ["ordinary", "lunar"] as const) {
    const config = scenario === "ordinary" ? ordinary : lunar;
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
    // Full native receipts are retained immediately, including when a later
    // UI assertion fails; a rerun is not needed to inspect the original data.
    await writeFile(resolve(`docs/validation/source-artifact-dynamic-${variant}-${scenario}-20260928.result.json`), resultText);
    const result = JSON.parse(resultText) as SourceHostResult;
    expect(result.sourceCommit).toBe(variant === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT);
    expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.config).toBe(config);
    const byId = new Map(result.calculations.map(row => [row.request.id, row]));
    const calls = result.calculations.filter((row): row is ArtifactRecord =>
      row.request.kind === "artifact-scalar" && isSourceHostArtifactDynamicRuleId(row.request.input.ruleId));
    const observedRuleCounts = Object.fromEntries([...new Set(calls.map(row => row.request.input.ruleId))]
      .map(id => [id, calls.filter(row => row.request.input.ruleId === id).length]));
    expect(calls.length).toBeGreaterThan(0);
    const rules = {
      emblemER: registryRule("emblem", rule => rule.statIndex === 7, result.sourceCommit),
      emblem: registryRule("emblem", rule => rule.statIndex === 21 && "er" in rule.inputs, result.sourceCommit),
      gildedATK: registryRule("gildeddreams", rule => rule.statIndex === 6 && "atkCount" in rule.inputs, result.sourceCommit),
      gildedEM: registryRule("gildeddreams", rule => rule.statIndex === 8 && "emCount" in rule.inputs, result.sourceCommit),
      huskDEF: registryRule("huskofopulentdreams", rule => rule.statIndex === 1 && "stacks" in rule.inputs, result.sourceCommit),
      huskGeo: registryRule("huskofopulentdreams", rule => rule.statIndex === 17 && "stacks" in rule.inputs, result.sourceCommit),
      vv: registryRule("viridescent", rule => rule.modifierKeys.includes("vv-4pc"), result.sourceCommit),
      silkenEM: registryRule("silkenmoonsserenade", rule => rule.statIndex === 8 && "moonsign" in rule.inputs, result.sourceCommit),
      nightCR: registryRule("nightoftheskysunveiling", rule => rule.statIndex === 9 && "moonsign" in rule.inputs, result.sourceCommit),
      flower: registryRule("flowerofparadiselost", rule => rule.modifierKeys.includes("flower-4pc"), result.sourceCommit),
      tf: registryRule("thunderingfury", rule => rule.modifierKeys.includes("tf-4pc"), result.sourceCommit),
    };
    if (scenario === "ordinary") {
      for (const id of [rules.emblem, rules.gildedATK, rules.gildedEM, rules.huskDEF, rules.huskGeo, rules.vv]) {
        expect(observedRuleCounts[id], `Missing actual ${id} callback`).toBeGreaterThan(0);
      }
    } else {
      for (const id of [rules.silkenEM, rules.nightCR]) expect(observedRuleCounts[id], `Missing actual ${id} callback`).toBeGreaterThan(0);
      // Reaction lifetime/branch belongs to Go. Assert a reaction rule only
      // when the source rotation actually creates its eligible reaction.
      expect((observedRuleCounts[rules.flower] ?? 0) + (observedRuleCounts[rules.tf] ?? 0)).toBeGreaterThan(0);
    }

    const rulesForHit = (application: SourceHostResult["applications"][number]): string[] => {
      const request = byId.get(application.calculationId)?.request;
      if (!request) return [];
      return sourceHostArtifactSupportIds(request).map(id => byId.get(id))
        .filter((row): row is ArtifactRecord => row?.request.kind === "artifact-scalar" && isSourceHostArtifactDynamicRuleId(row.request.input.ruleId))
        .map(row => row.request.input.ruleId);
    };
    let multiSlot: { gilded?: number[]; husk?: number[] } | undefined;
    let partyRecipients: string[] | undefined;
    if (scenario === "ordinary") {
      const gildedHit = result.applications.find(app => {
        const linked = rulesForHit(app); return linked.includes(rules.gildedATK) && linked.includes(rules.gildedEM);
      });
      const zeroATK = calls.find(row => row.request.input.ruleId === rules.gildedATK && row.value === 0);
      expect(zeroATK, "Gilded's zero-valued same-element slot must retain its scalar receipt").toBeDefined();
      const huskHit = result.applications.find(app => {
        const linked = rulesForHit(app); return linked.includes(rules.huskDEF) && linked.includes(rules.huskGeo);
      });
      expect(gildedHit, "Gilded two-slot getter was not linked to one actual hit").toBeDefined();
      expect(huskHit, "Husk DEF/Geo getter was not linked to one actual hit").toBeDefined();
      multiSlot = { gilded: sourceHostArtifactSupportIds(byId.get(gildedHit!.calculationId)!.request),
        husk: sourceHostArtifactSupportIds(byId.get(huskHit!.calculationId)!.request) };
    } else {
      partyRecipients = [...new Set(calls.filter(row => row.request.input.ruleId === rules.silkenEM).map(row => row.request.actorKey))];
      expect(partyRecipients.some(actor => actor !== "columbina"), "Silken team EM was not read by a beneficiary").toBe(true);
      expect(result.applications.some(app => {
        const request = byId.get(app.calculationId)?.request;
        return request?.actorKey !== "columbina" && rulesForHit(app).includes(rules.silkenEM);
      })).toBe(true);
    }

    const selectedHitIndex = result.applications.findIndex(app =>
      scenario === "ordinary" ? rulesForHit(app).includes(rules.emblem) : rulesForHit(app).length > 0);
    expect(selectedHitIndex).toBeGreaterThanOrEqual(0);
    const selected = result.applications[selectedHitIndex]!;
    const capture = captureSourceHostHit(result, selected.id);
    const replay = replaySourceHostHit(capture);
    expect(replay.difference).toBe(0);
    const support = (capture.supportingCalculations ?? []).filter((row): row is ArtifactRecord =>
      row.request.kind === "artifact-scalar" && isSourceHostArtifactDynamicRuleId(row.request.input.ruleId));
    expect(support.length).toBeGreaterThan(0);
    if (scenario === "ordinary") {
      expect(support.map(row => row.request.input.ruleId)).toEqual(expect.arrayContaining([rules.emblemER, rules.emblem]));
    }
    const supported = support.map(row => {
      const node = replay.trace.find(item => item.id === `artifactScalar.${row.request.id}.${row.request.input.ruleId}`);
      expect(node, `Missing actual shared AST node for ${row.request.id}`).toBeDefined();
      expect(node!.sourceRefs.some(ref => ref.includes(result.sourceCommit))).toBe(true);
      const derived = deriveSourceHostArtifactScalarEdit(capture, row.request.id, row.request.input);
      expect(derived.status).toBe("calculated");
      expect(derived.originalValue).toBe(row.value);
      expect(derived.editedValue).toBe(row.value);
      return { id: row.request.id, ruleId: row.request.input.ruleId, actorKey: row.request.actorKey,
        value: row.value, state: "state" in row.request.input ? row.request.input.state : {}, sourceRefs: node!.sourceRefs };
    });

    await page.locator("#source-host-import").setInputFiles({
      name: `source-artifact-dynamic-${variant}-${scenario}.json`, mimeType: "application/json", buffer: Buffer.from(resultText),
    });
    await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
    await page.locator("#source-host-hit-index").fill(String(selectedHitIndex));
    await expect(page.locator("#source-host-hit")).toContainText("差值 0");

    let emblemEdit: (typeof evidence)[number]["emblemEdit"];
    if (variant === "classic" && scenario === "ordinary") {
      const emblem = support.find(row => row.request.input.ruleId === rules.emblem)!;
      if (!("state" in emblem.request.input)) throw new Error("Emblem dynamic state was not captured");
      const originalER = emblem.request.input.state.er!;
      const editedER = originalER + 1;
      const editedInput = { ruleId: emblem.request.input.ruleId, state: { ...emblem.request.input.state, er: editedER } };
      const edit = deriveSourceHostArtifactScalarEdit(capture, emblem.request.id, editedInput);
      expect(edit.status).toBe("calculated");
      expect(edit.editedValue).not.toBe(edit.originalValue);
      if (edit.status !== "calculated") throw new Error(edit.reason);
      expect(edit.editedRawDamage).not.toBe(edit.originalRawDamage);
      await page.locator("#source-host-open-calculator").click();
      await expect(page).toHaveURL(/\/calculator$/);
      await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
      const card = page.locator(`[data-source-host-artifact-id="${emblem.request.id}"]`);
      const erInput = card.locator('[data-source-host-artifact-state-key="er"]');
      await expect(erInput).toHaveValue(String(originalER));
      await erInput.fill(String(editedER));
      await expect(card.locator("[data-source-host-artifact-result]")).toContainText(`实验值 ${edit.editedValue}`);
      await expect(card.locator("[data-source-host-artifact-result]")).toContainText(`公式伤害 ${edit.editedRawDamage}`);
      const editedResult = (await card.locator("[data-source-host-artifact-result]").textContent()) ?? "";
      const calculatorDownload = page.waitForEvent("download");
      await page.locator("[data-source-host-export]").click();
      const calculatorText = await readFile((await (await calculatorDownload).path())!, "utf8");
      const calculator = JSON.parse(calculatorText) as {
        originalCapture: typeof capture; artifactExperiments?: Array<{ calculationId: number; input: typeof editedInput }>;
      };
      expect(calculator.originalCapture).toEqual(capture);
      expect(calculator.artifactExperiments).toContainEqual({ calculationId: emblem.request.id, input: editedInput });
      expect(calculateSourceHostEditableCalculation(calculator).difference).toBe(0);
      await page.locator("#calc-source-host-close").click();
      await page.locator("#calc-import").setInputFiles({
        name: "source-artifact-dynamic-calculator.json", mimeType: "application/json", buffer: Buffer.from(calculatorText),
      });
      const restoredCard = page.locator(`[data-source-host-artifact-id="${emblem.request.id}"]`);
      await expect(restoredCard.locator('[data-source-host-artifact-state-key="er"]')).toHaveValue(String(editedER));
      await expect(restoredCard.locator("[data-source-host-artifact-result]")).toHaveText(editedResult);
      await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
      emblemEdit = { calculationId: emblem.request.id, originalER, editedER, originalValue: edit.originalValue,
        editedValue: edit.editedValue, originalDamage: edit.originalRawDamage, editedDamage: edit.editedRawDamage,
        originalCaptureUnchanged: true, restoredResult: editedResult };
    }
    evidence.push({ variant, scenario, sourceCommit: result.sourceCommit,
      wasmSha256: result.executionArtifact?.wasmSha256, calculations: result.calculations.length,
      applications: result.applications.length, observedRuleCounts, selectedApplicationId: selected.id,
      selectedHitIndex, selectedDamage: selected.rawDamage, support: supported, multiSlot, partyRecipients, emblemEdit });
  }

  expect(errors).toEqual([]);
  await writeFile(resolve("docs/validation/source-artifact-dynamic-20260928.result.json"), `${JSON.stringify({
    schemaVersion: "source-artifact-dynamic-validation-v1", configs: { ordinary, lunar }, runs: evidence, pageErrors: errors,
  }, null, 2)}\n`);
  console.log(JSON.stringify({ runs: evidence.map(row => ({ variant: row.variant, scenario: row.scenario,
    calculations: row.calculations, applications: row.applications, observedRuleCounts: row.observedRuleCounts,
    selectedApplicationId: row.selectedApplicationId, selectedDamage: row.selectedDamage,
    support: row.support.map(item => ({ ruleId: item.ruleId, value: item.value, state: item.state })),
    emblemEdit: row.emblemEdit })), errors }));
});
