import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";
import { makeConfig, neutralStats } from "../../../packages/sim-core/src/__tests__/fixtures";
import type { SimulationRecord } from "../src/simulation-record";

async function downloadJson<T>(page: Page, selector: string): Promise<T> {
  const pending = page.waitForEvent("download");
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}

async function waitForSimulation(page: Page): Promise<void> {
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
}

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

async function numbers(page: Page, values: Record<string, number>): Promise<void> {
  for (const [field, value] of Object.entries(values)) {
    const input = page.locator(`[data-field="${field}"]`);
    await input.fill(String(value));
    await input.press("Tab");
  }
}

async function hydroDraft(row: Locator, values: Record<string, string | number>): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    await row.locator(`[data-traveler-hydro-resolved-draft-key="${key}"]`).fill(String(value));
  }
}

function editableParty(): SimConfig {
  return makeConfig({
    duration: 8, cycleLength: 8, randomSeed: "remaining-horizontal-source-ui-v1",
    dataVersion: "synthetic-horizontal-source-ui-v1",
    meta: { name: "用户面板与来源普攻链", version: "synthetic-horizontal-source-ui-v1", verificationStatus: "user-supplied",
      note: "中性合成面板与静止目标；来源身份由队伍表单绑定，不是游戏实测构筑。" },
    enemy: { level: 90, resistance: 0, defReduction: 0,
      targets: [{ id: "enemy-0", name: "明确合成静止目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    characters: [
      { id: "a", name: "用户面板 A", element: "pyro", color: "#cb6353", level: 90, energyMax: 40, initialEnergy: 7, stats: { ...neutralStats } },
      { id: "b", name: "用户面板 B", element: "geo", color: "#a88946", level: 90, energyMax: 40, initialEnergy: 11, stats: { ...neutralStats } },
    ],
  });
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("ordinary team controls preserve source normal-chain state and energy while Hydro observed hits remain independently editable and restorable", async ({ page }) => {
  const original = editableParty();
  await page.goto("/results");
  await page.locator("#critModeInput").selectOption("noCrit");
  await page.locator("#energyModeInput").selectOption("configured");
  await page.locator("#iterationInput").fill("1");
  await page.locator("#importInput").setInputFiles({ name: "editable-normal-party.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(original)) });
  await expect(page.locator("#notice")).toContainText(original.meta.name);
  await waitForSimulation(page);
  await page.locator('.product-nav a[href="/team"]').click();
  await page.locator("#source-timeline-active").selectOption("a");
  await page.locator("#source-timeline-swap").fill("1");
  await page.locator("#source-timeline-create").click();
  const actor = page.locator('[data-source-action-actor="a"]');
  await actor.locator("[data-source-character]").selectOption("amber");
  await actor.locator("[data-source-action]").selectOption("amber-n1");
  await actor.locator("[data-source-talent]").fill("1");
  await actor.locator("[data-source-ascension]").fill("6");
  await actor.locator("[data-source-constellation]").selectOption("0");
  await actor.locator("[data-source-ability-id]").fill("amber-auto");
  await actor.locator("[data-source-normal-energy]").click();
  await expect(page.locator("#team-normal-energy-enabled")).toBeChecked();
  await expect(page.locator('[data-normal-energy-weapon="a"]')).toHaveValue("bow");
  await page.locator('[data-normal-energy-weapon="b"]').selectOption("sword");
  await actor.locator("[data-source-add]").click();
  await expect(page.locator("#source-action-status")).toContainText("完整 5 段普攻链");
  await actor.locator("[data-source-action]").selectOption("amber-q");
  await actor.locator("[data-source-ability-id]").fill("amber-burst");
  await actor.locator("[data-source-add]").click();
  await page.locator("#team-apply").click();
  await expect(page.locator("#team-status")).toContainText("来源能力已保存");
  const bound = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(bound.characters).toEqual(original.characters);
  expect(bound.timeline!.abilities).toHaveLength(6);
  expect(bound.sourceAbilityBindings).toHaveLength(6);
  expect(bound.sourceAbilityBindings!.filter(binding => binding.sourceActionId.startsWith("amber-n")).map(binding => binding.abilityId)).toEqual([
    "amber-auto-n1", "amber-auto-n2", "amber-auto-n3", "amber-auto-n4", "amber-auto-n5",
  ]);
  expect(bound.normalHitEnergyModel).toEqual({ mode: "fixed-source-independent-stream-v1",
    actors: [{ actorId: "a", weaponType: "bow" }, { actorId: "b", weaponType: "sword" }] });
  await expect(page.locator('[data-actor="0"][data-key="initialEnergy"]')).toHaveValue("7");
  await expect(page.locator('[data-actor="1"][data-key="initialEnergy"]')).toHaveValue("11");

  await page.locator('.product-nav a[href="/rotation"]').click();
  await page.locator("#rotation-mode").selectOption("wait");
  await page.locator("#rotation-source-normal-actor").selectOption("a");
  const addNormals = async (count: number): Promise<void> => {
    await page.locator("#rotation-source-normal-count").fill(String(count));
    await page.locator("#rotation-source-normal-add").click();
  };
  await addNormals(3);
  await page.locator("#rotation-wait").fill("12");
  await page.locator("#rotation-add-wait").click();
  await addNormals(2);
  await addNormals(1);
  // This explicit wait puts the refused Q after the preceding N1 has finished.
  await page.locator("#rotation-add-wait").click();
  await page.locator("#rotation-action").selectOption("amber-burst");
  await page.locator("#rotation-add").click();
  await addNormals(2);
  for (const actorId of ["b", "a"]) {
    await page.locator("#rotation-swap-actor").selectOption(actorId);
    await page.locator("#rotation-add-swap").click();
  }
  await addNormals(1);
  await expect(page.locator("#rotation-list li")).toHaveCount(14);
  await page.locator("#rotation-save").click();
  await expect(page).toHaveURL(/\/results$/);
  await waitForSimulation(page);
  const run = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  expect(run.options).toMatchObject({ critMode: "noCrit", energyMode: "configured" });
  expect(run.sourceConfig.characters).toEqual(original.characters);
  expect(run.sourceConfig.normalHitEnergyModel).toEqual(bound.normalHitEnergyModel);
  const inputs = run.sourceConfig.timeline!.commands.filter(command => command.type === "normal");
  expect(inputs).toHaveLength(9);
  expect(inputs.every(command => command.type === "normal" && command.sourceNormalChain === "next-v1")).toBe(true);
  const normals = run.result.sourceNormalChainLog!.filter(row => row.kind === "normal-accepted");
  const normalIndices = [1, 2, 3, 4, 5, 1, 2, 3, 1];
  const startFrames = [0, 26, 48, 97, 131, 191, 229, 251, 280];
  const snapshotFrames = [14, 36, 75, 123, 157, 205, 239, 278, 294];
  const damageFrames = [24, 46, 85, 133, 167, 215, 249, 288, 304];
  // Fixed source launch / animation tables; N3 ends at 85f, wait preserves N4.
  // Refused Q preserves N2; the real swaps reset the next input to N1.
  expect(normals.map(row => row.normalIndex)).toEqual(normalIndices);
  expect(normals.map(row => row.frame)).toEqual(startFrames);
  expect(normals.map(row => row.sourceAbilityId)).toEqual(normalIndices.map(index => `amber-auto-n${index}`));
  expect(normals.map(row => row.stateAfter.actors.find(state => state.actorId === "a")!.nextIndex)).toEqual([2, 3, 4, 5, 1, 2, 3, 4, 2]);
  expect(run.result.sourceNormalChainLog!.filter(row => row.kind !== "normal-accepted").map(row => [row.kind, row.frame])).toEqual([
    ["swap-start-reset", 278], ["swap-complete-reset", 279], ["swap-start-reset", 279], ["swap-complete-reset", 280],
  ]);
  expect(run.result.sourceNormalChainState!.actors.find(state => state.actorId === "a")!.nextIndex).toBe(2);
  const execution = run.result.timelineExecution!;
  expect(execution.failures).toHaveLength(1);
  expect(execution.failures[0]!.code).toBe("INSUFFICIENT_ENERGY");
  expect(execution.commandResults.find(row => row.abilityId === "amber-burst")).toMatchObject({ startFrame: 229, status: "rejected" });
  expect(execution.totalFrames).toBe(306);
  expect(run.result.energyStats.a).toMatchObject({ initial: 7, spent: 0 });
  expect(run.result.energyStats.b).toMatchObject({ initial: 11, spent: 0, final: 11 });
  expect(run.result.normalHitEnergyLog!.filter(row => row.kind === "damage")).toHaveLength(9);
  expect(run.result.damageEvents.map(hit => hit.frame)).toEqual(damageFrames);
  // Hand calculation with archived Lv1 coefficients: no CRIT, equal level DEF ×.5, zero RES / extra bonuses.
  const coefficients = [0.3612, 0.3612, 0.4644, 0.473, 0.5934];
  for (const [index, hit] of run.result.damageEvents.entries()) {
    expect(hit.finalDamage).toBeCloseTo(1000 * coefficients[normalIndices[index]! - 1]! * 0.5, 9);
    expect(run.result.sourceSnapshotLog!.find(row => row.id === hit.sourceSnapshotLogId)).toMatchObject({
      ownerId: "a", frame: snapshotFrames[index], status: "sampled",
    });
  }
  expect(run.result.totalDamage).toBeCloseTo(1900.6, 9);
  await page.getByRole("button", { name: "时间轴", exact: true }).click();
  await expect(page.locator("[data-source-normal-chain-log]")).toHaveCount(13);
  await expect(page.locator('[data-source-normal-chain-kind="normal-accepted"]')).toHaveCount(9);
  const resumed = page.locator(`[data-source-normal-chain-detail="${normals[6]!.id}"]`);
  await resumed.locator(":scope > summary").click();
  const displayed = JSON.parse((await resumed.locator("pre").textContent())!);
  expect(displayed.decision).toEqual(normals[6]);
  expect(displayed.action).toEqual(run.result.actionLog[normals[6]!.actionLogIndex!]);

  await page.locator('.product-nav a[href="/calculator"]').click();
  await page.locator("#calc-character").selectOption("character:10000005");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await page.locator("#calc-form").selectOption("aether-hydro");
  const skillId = "traveler-hydro-resolved-aether-hold-c0";
  const archive = JSON.parse(await readFile(new URL("../../../packages/game-data/sources/traveler-hydro-resolved-casts/definitions.json", import.meta.url), "utf8")) as {
    templates: Array<{ skillId: string; label: string }>;
  };
  const option = await page.locator("#calc-skill option").filter({ hasText: archive.templates.find(cast => cast.skillId === skillId)!.label }).getAttribute("value");
  await page.locator("#calc-skill").selectOption(option!);
  await page.locator("#calc-constellation").selectOption("0");
  await page.locator("#calc-talent-level").fill("1");
  await page.locator("#calc-talent-level").press("Tab");
  await expect.poll(async () => (await audit(page)).document.gameContext?.effectiveTalentLevel).toBe(1);
  expect((await audit(page)).document.gameContext!.skillId).toBe(skillId);
  await page.locator("#calc-scope").selectOption("single-hit");
  await page.locator("#calc-build-mode").selectOption("manual-final");
  await page.locator("#calc-ascension").selectOption("6");
  await numbers(page, { "build.stats.atk": 2000, "build.stats.hp": 20000, "build.stats.def": 800,
    "build.stats.em": 0, "build.stats.critRate": 0.5, "build.stats.critDamage": 1,
    characterLevel: 90, "enemy.level": 90, "enemy.resistance": 0.1 });
  const hydro = "gameContext.travelerHydroResolvedCast";
  await page.locator(`[data-source-cast-state-field="${hydro}.trueMoonStoryBuffInactive"]`).selectOption("1");
  await numbers(page, { [`${hydro}.sharedState.includedSourceFlatDamage`]: 0 });
  await page.locator('[data-traveler-hydro-resolved-known="independent"]').selectOption("provided");
  const independentRow = page.locator("[data-traveler-hydro-resolved-independent]");
  await independentRow.locator('[data-traveler-hydro-resolved-draft-key="templateRole"]').selectOption("torrent");
  await independentRow.locator('[data-traveler-hydro-resolved-draft-key="observedSourceEvent"]').selectOption("true");
  // These are explicit observations for this worked example, not an automatic animation / HP schedule.
  await hydroDraft(independentRow, { candidateId: "torrent", launchFrame: 54, frame: 57, snapshotFrame: 57,
    snapshotId: "snapshot-57", targetId: "enemy", consumedHpThisCast: 800 });
  await page.locator('[data-action="traveler-hydro-resolved-apply"]').click();
  const independent = await audit(page);
  expect(independent.result.status).toBe("calculated");
  expect(independent.document.gameContext!.travelerHydroResolvedCast!.hpEvents).toBeUndefined();
  expect(independent.document.gameContext!.travelerHydroResolvedCast!.events).toBeUndefined();
  expect(independent.document.gameContext!.travelerHydroResolvedCast!.fullObservedLifetime).toBeUndefined();
  expect(independent.result.totals!.expected).toBeCloseTo((2000 * 1.8928 + 800 * 0.45) * 0.5 * 0.9 * 1.5, 9);
  await hydroDraft(independentRow, { consumedHpThisCast: 1600 });
  await expect(page.locator("[data-traveler-hydro-resolved-draft-status]")).toContainText("尚未应用");
  await page.locator('[data-action="traveler-hydro-resolved-apply"]').click();
  const edited = await audit(page);
  expect(edited.result.totals!.expected).toBeCloseTo(3041.28, 9);
  const additive = edited.result.hits[0]!.trace.find(node => node.id === "customAdditiveBase")!;
  expect(additive.result!.value).toBe(720);
  const explanation = page.locator('#calc-results [data-detail-id="customAdditiveBase"]');
  await explanation.locator(":scope > summary").click();
  await expect(explanation.locator(".trace-substitution")).toContainText(additive.substitution);

  await page.locator("#calc-scope").selectOption("one-cast");
  expect((await audit(page)).result.status).toBe("blocked");
  for (const [key, value] of Object.entries({ casterId: "aether", targetId: "enemy" })) {
    const input = page.locator(`[data-source-cast-text-field="${hydro}.${key}"]`);
    await input.fill(value);
    await input.press("Tab");
  }
  for (const key of ["freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime",
    "allHpChangesRecorded", "allDamageEventsRecorded", "statsStableAcrossHits"]) {
    await page.locator(`[data-source-cast-state-field="${hydro}.${key}"]`).selectOption("1");
  }
  await page.locator(`[data-source-cast-state-field="${hydro}.spiritbreathTriggered"]`).selectOption("0");
  await numbers(page, { [`${hydro}.initialCurrentHp`]: 12000, [`${hydro}.initialMaxHp`]: 20000,
    [`${hydro}.releaseFrame`]: 54, [`${hydro}.releaseOrder`]: 2, [`${hydro}.dewCount`]: 1, [`${hydro}.observedThroughFrame`]: 60 });
  await page.locator('[data-action="traveler-hydro-resolved-add-hp"]').click();
  const hp = page.locator('[data-traveler-hydro-resolved-row="hp"]').first();
  await hp.locator('[data-traveler-hydro-resolved-draft-key="kind"]').selectOption("suffusion");
  await hydroDraft(hp, { id: "cost-1", frame: 54, order: 0 });
  for (const [index, role] of ["dew", "torrent"].entries()) {
    await page.locator('[data-action="traveler-hydro-resolved-add-events"]').click();
    const event = page.locator('[data-traveler-hydro-resolved-row="events"]').nth(index);
    await event.locator('[data-traveler-hydro-resolved-draft-key="templateRole"]').selectOption(role);
    await event.locator('[data-traveler-hydro-resolved-draft-key="contact"]').selectOption("true");
    const frame = role === "dew" ? 60 : 57;
    await hydroDraft(event, { candidateId: role === "dew" ? "dew-1" : "torrent", launchFrame: 54,
      frame, snapshotFrame: frame, snapshotId: `snapshot-${frame}`, targetId: "enemy",
      ...(role === "dew" ? { hpReadFrame: 54, hpReadOrder: 1 } : {}) });
  }
  await page.locator('[data-action="traveler-hydro-resolved-apply"]').click();
  const complete = await audit(page);
  expect(complete.result.status).toBe("calculated");
  expect(complete.document.gameContext!.scopeCoverage).toBe("complete-cast");
  expect(complete.result.includedHitIds).toEqual([`${skillId}:dew-1`, `${skillId}:torrent`]);
  expect(complete.document.gameContext!.travelerHydroResolvedCast!.targetContacts).toEqual({ "dew-1": true, torrent: true });
  const dew = complete.document.hits.find(hit => hit.id === `${skillId}:dew-1`)!;
  const torrent = complete.document.hits.find(hit => hit.id === `${skillId}:torrent`)!;
  expect(dew.kind === "ordinary" && dew.travelerHydroResolvedEvent).toMatchObject({ actualCurrentHp: 11200, actualMaxHp: 20000, hpReadFrame: 54, hpReadOrder: 1 });
  expect(torrent.kind === "ordinary" && torrent.travelerHydroResolvedEvent).toMatchObject({ consumedHpThisCast: 800 });
  // Actual HP ledger overrides the previous independent hit's 1600: 4% × 20000 = 800.
  // Dew base = 2000 × .328 + 20000 × .0064 = 784; torrent base = 4145.6.
  expect(complete.result.totals!.expected).toBeCloseTo(3327.48, 9);
  await expect(page.locator("[data-traveler-hydro-resolved-schedule]")).toContainText("12000 → 11200");
  const saved = await downloadJson<CalculatorDocument>(page, '[data-action="export"]');
  await numbers(page, { [`${hydro}.sharedState.includedSourceFlatDamage`]: 99 });
  await page.locator("#calc-import").setInputFiles({ name: "hydro-observed-complete-cast.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(saved)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  const restored = await audit(page);
  expect(restored.document.gameContext).toEqual(complete.document.gameContext);
  expect(restored.document.hits).toEqual(complete.document.hits);
  expect(restored.result).toEqual(complete.result);
  console.info("Horizontal source browser measurements", JSON.stringify({ normalIndices, startFrames, damageFrames,
    initialEnergyPreserved: [7, 11], normalDamage: run.result.totalDamage, refusedBurstFrame: 229,
    independentHydro: independent.result.totals, editedHydro: edited.result.totals, completeHydro: complete.result.totals,
    completeCalculatorRestored: true }));
});
