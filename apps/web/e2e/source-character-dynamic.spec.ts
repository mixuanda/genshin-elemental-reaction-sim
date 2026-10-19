import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { captureSourceHostHit, replaySourceHostHit } from "../../../packages/sim-core/src/source-host-capture";
import { captureSourceHostPlayerIncoming, replaySourceHostPlayerIncoming } from "../../../packages/sim-core/src/source-host-incoming-capture";
import { sourceHostArtifactSupportIds, sourceHostArtifactSupportRefs } from "../../../packages/sim-core/src/source-host-artifact-support";
import { sourceHostCharacterModifierDynamicRuleDescriptor,
  type SourceHostCharacterModifierDynamicInput } from "../../../packages/sim-core/src/source-host-character-modifier-dynamic-formula";
import { resolveSourceHostCharacterModifierInput } from "../../../packages/sim-core/src/source-host-character-modifier-formula";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT,
  type SourceHostCalculationRecord, type SourceHostCharacterModifierRequest, type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";

type Lane = "classic" | "stellar";
type DynamicRecord = SourceHostCalculationRecord & {
  request: SourceHostCharacterModifierRequest & {
    input: SourceHostCharacterModifierDynamicInput;
  };
};
const rules = {
  bennett: "char-dyn-bennett-burst-atk",
  yoimiyaRead: "char-dyn-yoimiya-a1",
  yoimiyaCreate: "char-dyn-yoimiya-a4",
  itto: "char-dyn-itto-burst-atk",
  raiden: "char-dyn-raiden-a4-electrop",
} as const;

// Bennett's field ticks create an ATK snapshot. Yoimiya builds native A1
// stacks before her Q freezes a team ATK% value. Itto's Q then snapshots
// Husk's actual DEF% getter, and several later hits consume that same ID.
const config = `options iteration=1 duration=20;
bennett char lvl=90/90 cons=1 talent=1,1,1 +params=[start_energy=100];
bennett add weapon="favoniussword" refine=1 lvl=90/90;
bennett add stats atk=200 cr=0.2 cd=0.4;
yoimiya char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
yoimiya add weapon="favoniuswarbow" refine=1 lvl=90/90;
yoimiya add stats atk=200 cr=0.2 cd=0.4;
itto char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
itto add weapon="whiteblind" refine=1 lvl=90/90;
itto add set="huskofopulentdreams" count=2;
itto add stats def=200 cr=0.2 cd=0.4;
raiden char lvl=90/90 cons=0 talent=1,1,1;
raiden add weapon="favoniuslance" refine=1 lvl=90/90;
raiden add stats atk=200 er=0.5 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
target lvl=90 resist=0.1 radius=2 pos=0.6,2.4;
active bennett;
bennett burst;
yoimiya skill;
yoimiya attack:3;
yoimiya burst;
itto burst;
itto attack:3;
wait(120);`;

function dynamicRecords(result: SourceHostResult): DynamicRecord[] {
  return result.calculations.filter((row): row is DynamicRecord =>
    row.request.kind === "character-modifier" && "phase" in row.request.input);
}

test("native dynamic character modifiers retain creation provenance, read state, and isolated preview identity", async ({ page }) => {
  test.setTimeout(300000);
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  // A previously saved player hit checks the new state-step support closure
  // without another WASM execution or a synthetic shield receipt.
  const incomingRaw = await readFile(resolve("docs/validation/source-auxiliary-formulas-classic-shield-healing-20260928.result.json"), "utf8");
  const incomingResult = JSON.parse(incomingRaw) as SourceHostResult;
  const shieldHit = incomingResult.playerApplications?.find(row => row.shieldAbsorbed > 0 && row.shieldCalculationIds?.length);
  expect(shieldHit).toBeDefined();
  const incomingCapture = captureSourceHostPlayerIncoming(incomingResult, shieldHit!.id);
  const incomingReplay = replaySourceHostPlayerIncoming(incomingCapture);
  expect(incomingReplay.difference).toBe(0);
  expect(incomingReplay.stateArithmeticProvenance).toBe("shared");
  expect(incomingCapture.stateCalculations?.map(row => row.request.id)).toEqual(expect.arrayContaining(shieldHit!.shieldCalculationIds!));
  const shieldSupport = incomingCapture.supportingCalculations ?? [];
  expect(shieldSupport.map(row => row.request.kind === "artifact-scalar" ? row.request.input.ruleId : ""))
    .toEqual(expect.arrayContaining(["bolide-2pc-shield", "tenacity-4pc-shield"]));
  for (const state of incomingCapture.stateCalculations ?? []) {
    for (const id of sourceHostArtifactSupportIds(state.request)) {
      expect(shieldSupport.some(row => row.request.id === id)).toBe(true);
    }
  }

  const runs: Array<{ variant: Lane; sourceCommit: string; wasmSha256?: string | undefined;
    observedRules: Record<string, number>; observedA1Stacks: number[];
    bennett: { id: number; value: number; baseAtk: number };
    yoimiyaA4: { id: number; value: number; stacks: number };
    ittoQ: { id: number; value: number; multiplier: number; defense: number; huskSupportIds: number[] };
    raidenA4: { count: number; id: number; frame: number; value: number; nonExtraER: number; readId: string };
    reuse: Array<{ frame: number; applicationId: number }>;
    selected: { applicationId: number; rawDamage: number; replayDifference: number; supportingIds: number[] };
  }> = [];

  for (const variant of ["classic", "stellar"] as const) {
    await page.goto("/source-simulation");
    await page.locator("#source-host-variant").selectOption(variant);
    await page.locator("#source-host-config").fill(config);
    await page.locator("#source-host-seed").fill("20260928");
    await page.locator("#source-host-run").click();
    await expect(page.locator("#source-host-status")).toContainText(/本次运行完成|运行停止|执行器错误/, { timeout: 90000 });
    await expect(page.locator("#source-host-status")).toContainText("本次运行完成");
    const pending = page.waitForEvent("download");
    await page.locator("#source-host-export").click();
    const raw = await readFile((await (await pending).path())!, "utf8");
    // Preserve the native receipt before any detailed assertion can fail.
    await writeFile(resolve(`docs/validation/source-character-dynamic-${variant}-20260928.result.json`), raw);
    const result = JSON.parse(raw) as SourceHostResult;
    expect(result.sourceCommit).toBe(variant === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT);
    expect(result.config).toBe(config);
    expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
    const byId = new Map(result.calculations.map(row => [row.request.id, row]));
    const rows = dynamicRecords(result);
    const observedRules = Object.fromEntries([...new Set(rows.map(row => row.request.input.ruleId))]
      .map(ruleId => [ruleId, rows.filter(row => row.request.input.ruleId === ruleId).length]));
    for (const row of rows) {
      const descriptor = sourceHostCharacterModifierDynamicRuleDescriptor(row.request.input.ruleId);
      expect(row.request.input.phase).toBe(descriptor.phase);
      expect(row.request.input.modifierKey).toBe(descriptor.modifierKey);
      expect(resolveSourceHostCharacterModifierInput(row.request.input, result.sourceCommit).value).toBeCloseTo(row.value, 9);
    }
    const ofRule = (ruleId: string): DynamicRecord[] => rows.filter(row => row.request.input.ruleId === ruleId);
    const bennett = ofRule(rules.bennett)[0];
    const yoimiyaA1 = ofRule(rules.yoimiyaRead);
    const yoimiyaA4 = ofRule(rules.yoimiyaCreate)[0];
    const ittoQ = ofRule(rules.itto)[0];
    const raidenA4 = ofRule(rules.raiden);
    expect(bennett, `${variant}: Bennett field creation`).toBeDefined();
    expect(yoimiyaA1.length, `${variant}: Yoimiya A1 read after native normals`).toBeGreaterThan(0);
    expect(yoimiyaA4, `${variant}: Yoimiya A4 creation`).toBeDefined();
    expect(ittoQ, `${variant}: Itto Q creation`).toBeDefined();
    expect(raidenA4.length, `${variant}: Raiden A4 periodic creation`).toBeGreaterThan(0);
    expect(bennett!.request.input.phase).toBe("creation");
    expect(yoimiyaA4!.request.input.phase).toBe("creation");
    expect(ittoQ!.request.input.phase).toBe("creation");
    expect(bennett!.request.input.state.baseAtk).toBeGreaterThan(0);
    expect(bennett!.request.statRead).toBeDefined();
    expect(yoimiyaA1.some(row => row.request.input.state.stacks! > 0)).toBe(true);
    expect(new Set(yoimiyaA1.map(row => row.request.input.state.stacks)).size,
      `${variant}: native normal hits should expose at least two A1 stack states`).toBeGreaterThan(1);
    for (const row of yoimiyaA1) expect(row.value).toBeCloseTo(0.02 * row.request.input.state.stacks!, 9);
    expect(yoimiyaA4!.value).toBeCloseTo(0.1 + 0.01 * yoimiyaA4!.request.input.state.stacks!, 9);
    expect(ittoQ!.value).toBeCloseTo(ittoQ!.request.input.state.multiplier! * ittoQ!.request.input.state.nonExtraDefense!, 9);
    expect(ittoQ!.request.statRead).toBeDefined();
    expect(sourceHostCharacterModifierDynamicRuleDescriptor(rules.raiden)).toMatchObject({
      phase: "creation", modifierKey: "raiden-a4", statIndex: 15,
      statLeaf: { stateKey: "nonExtraER", getter: "non-extra-stat", statIndex: 7, actor: "holder" },
    });
    for (const row of raidenA4) {
      const read = row.request.statRead;
      expect(row.request.input.phase).toBe("creation");
      expect(row.request.input.sourceHolderIndex).toBe(3);
      expect(read).toMatchObject({ kind: "non-extra-stat", actorIndex: 3, selector: [7], nonExtra: true });
      expect(read!.result[7]).toBeCloseTo(row.request.input.state.nonExtraER!, 9);
      expect(row.value).toBeCloseTo(Math.max(row.request.input.state.nonExtraER! - 1, 0) * 0.4, 9);
    }
    const huskSupportIds = sourceHostArtifactSupportIds(ittoQ!.request).filter(id => {
      const row = byId.get(id);
      return row?.request.kind === "artifact-scalar" && row.request.input.ruleId === "dynamic-huskofopulentdreams-2pc-defp";
    });
    expect(huskSupportIds.length, `${variant}: Husk 2pc must feed Itto's real creation getter`).toBeGreaterThan(0);
    expect(sourceHostArtifactSupportRefs(ittoQ!.request).some(ref => huskSupportIds.some(id => ref.ids.includes(id)))).toBe(true);
    const bennettIds = new Set(ofRule(rules.bennett).map(row => row.request.id));
    const bennettConsumer = result.applications.map(application => byId.get(application.calculationId))
      .find(row => row?.request.kind === "damage" && row.request.actorKey !== "bennett"
        && sourceHostArtifactSupportRefs(row.request).some(ref => ref.creationIds?.some(id => bennettIds.has(id))));
    expect(bennettConsumer, `${variant}: a later actor must consume a Bennett field creation ID`).toBeDefined();

    const ittoHits = result.applications.flatMap((application, index) => {
      const calculation = byId.get(application.calculationId);
      if (calculation?.request.kind !== "damage" || calculation.request.actorKey !== "aratakiitto") return [];
      const refs = sourceHostArtifactSupportRefs(calculation.request);
      if (!refs.some(ref => ref.creationIds?.includes(ittoQ!.request.id))) return [];
      return [{ application, index, calculation, refs }];
    });
    expect(new Set(ittoHits.map(hit => hit.application.frame)).size,
      `${variant}: one Itto Q creation value must be consumed in different frames`).toBeGreaterThan(1);
    const selected = ittoHits.find(hit => hit.refs.some(ref => ref.creationIds?.includes(yoimiyaA4!.request.id)));
    expect(selected, `${variant}: Itto must consume Yoimiya's team snapshot with his own Q snapshot`).toBeDefined();
    const capture = captureSourceHostHit(result, selected!.application.id);
    const replay = replaySourceHostHit(capture);
    expect(replay.difference).toBe(0);
    const ittoFormulaInput = replay.trace.find(node => node.id === `characterModifier.${ittoQ!.request.id}.${rules.itto}`)
      ?.inputs.find(input => input.key === "nonExtraDefense");
    expect(ittoFormulaInput?.origin).toMatchObject({ kind: "source-host-stat-provenance",
      reference: `sourceStats.characterModifier.${ittoQ!.request.id}.state.nonExtraDefense` });
    const supportingIds = capture.supportingCalculations?.map(row => row.request.id) ?? [];
    expect(supportingIds).toEqual(expect.arrayContaining([ittoQ!.request.id, yoimiyaA4!.request.id, ...huskSupportIds]));
    const measure: (typeof runs)[number] = {
      variant, sourceCommit: result.sourceCommit, wasmSha256: result.executionArtifact?.wasmSha256,
      observedRules, observedA1Stacks: [...new Set(yoimiyaA1.map(row => row.request.input.state.stacks!))],
      bennett: { id: bennett!.request.id, value: bennett!.value, baseAtk: bennett!.request.input.state.baseAtk! },
      yoimiyaA4: { id: yoimiyaA4!.request.id, value: yoimiyaA4!.value, stacks: yoimiyaA4!.request.input.state.stacks! },
      ittoQ: { id: ittoQ!.request.id, value: ittoQ!.value, multiplier: ittoQ!.request.input.state.multiplier!,
        defense: ittoQ!.request.input.state.nonExtraDefense!, huskSupportIds },
      raidenA4: { count: raidenA4.length, id: raidenA4[0]!.request.id,
        frame: raidenA4[0]!.request.frame, value: raidenA4[0]!.value,
        nonExtraER: raidenA4[0]!.request.input.state.nonExtraER!, readId: raidenA4[0]!.request.statRead!.id },
      reuse: ittoHits.map(hit => ({ frame: hit.application.frame, applicationId: hit.application.id })),
      selected: { applicationId: selected!.application.id, rawDamage: selected!.application.rawDamage,
        replayDifference: replay.difference, supportingIds },
    };
    runs.push(measure);

    if (variant === "classic") {
      await page.locator("#source-host-import").setInputFiles({ name: "dynamic-source-native.json",
        mimeType: "application/json", buffer: Buffer.from(raw) });
      await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
      await page.locator("#source-host-hit-index").fill(String(selected!.index));
      await expect(page.locator("#source-host-hit")).toContainText("差值 0");
      await page.locator("#source-host-open-calculator").click();
      await expect(page).toHaveURL(/\/calculator$/);
      await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
      const pendingEditable = page.waitForEvent("download");
      await page.locator("[data-source-host-export]").click();
      const editableRaw = await readFile((await (await pendingEditable).path())!, "utf8");
      await writeFile(resolve("docs/validation/source-character-dynamic-calculator-20260928.result.json"), editableRaw);
      expect((JSON.parse(editableRaw) as { originalCapture: typeof capture }).originalCapture).toEqual(capture);
      await page.locator("#calc-source-host-close").click();
      await page.locator("#calc-import").setInputFiles({ name: "dynamic-source-calculator.json",
        mimeType: "application/json", buffer: Buffer.from(editableRaw) });
      await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
    }
  }

  const pointers = JSON.parse(await readFile(resolve("packages/game-data/manifests/pointers.json"), "utf8")) as {
    activeCatalogSnapshotId: string; activeVerifiedSnapshotId: string | null;
    previewWorkspaceSnapshotId: string; archivedSnapshotIds: string[];
  };
  const status = JSON.parse(await readFile(resolve("packages/game-data/src/generated/update-status.json"), "utf8")) as {
    previewSnapshots: Array<{ snapshotId: string; gameVersion: string }>;
  };
  const newPreview = "snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217";
  const priorPreview = "snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc";
  expect(pointers.previewWorkspaceSnapshotId).toBe(newPreview);
  expect(pointers.archivedSnapshotIds).toContain(priorPreview);
  expect(status.previewSnapshots).toEqual(expect.arrayContaining([
    expect.objectContaining({ snapshotId: newPreview, gameVersion: "7.1.50.2" }),
    expect.objectContaining({ snapshotId: priorPreview }),
  ]));
  expect(pointers.activeVerifiedSnapshotId).toBeNull();
  await page.goto("/calculator");
  await expect(page.locator("#calc-workspace-status")).toContainText(pointers.activeCatalogSnapshotId);
  await page.locator("#calc-workspace").selectOption("preview");
  await expect(page.locator("#calc-workspace-status")).toContainText(newPreview);
  await expect(page.locator("#calc-workspace-status")).toContainText("隔离预览");
  await page.locator("#calc-workspace").selectOption("released");
  await expect(page.locator("#calc-workspace-status")).toContainText(pointers.activeCatalogSnapshotId);
  expect(pageErrors).toEqual([]);

  const evidence = { schemaVersion: "source-character-dynamic-validation-v1", config,
    incomingSaved: { applicationId: shieldHit!.id, shieldAbsorbed: shieldHit!.shieldAbsorbed,
      stateCalculationIds: incomingCapture.stateCalculations?.map(row => row.request.id),
      supportRuleIds: shieldSupport.map(row => row.request.kind === "artifact-scalar" || row.request.kind === "character-modifier"
        ? row.request.input.ruleId : ""),
      replayDifference: incomingReplay.difference },
    runs, preview: { newPreview, priorPreview, released: pointers.activeCatalogSnapshotId }, pageErrors };
  await writeFile(resolve("docs/validation/source-character-dynamic-20260928.result.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ runs: runs.map(row => ({ variant: row.variant, observedRules: row.observedRules,
    stacks: row.observedA1Stacks, raidenA4: row.raidenA4, reuse: row.reuse.length, selected: row.selected })),
    incoming: evidence.incomingSaved, preview: evidence.preview, pageErrors }));
});
