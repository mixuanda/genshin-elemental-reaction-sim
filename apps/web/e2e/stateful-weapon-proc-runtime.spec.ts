import { revealControl, runImportedScenario, downloadSimulationRecord, expectReadonlyRecord } from "./release-ui-helpers";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { AbilityDefinition, LegalTimelineCommand } from "@genshin-dps-lab/schemas";
import type { CapturedSimulationHit } from "@genshin-dps-lab/sim-core";
import type { SimulationStartupResult } from "../../../packages/sim-core/src/simulation-analysis";
import { makeConfig, neutralStats } from "../../../packages/sim-core/src/__tests__/fixtures";
import type { SimulationRecord } from "../src/simulation-record";

async function downloadJson<T>(page: Page, selector: string): Promise<T> {
  const pending = page.waitForEvent("download");
  await (await revealControl(page.locator(selector))).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}

async function waitForSimulation(page: Page): Promise<void> {
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
}

const declarations = [
  { actorId: "a", weaponId: "flute", refinement: 1, physicalDamageBonus: 0 },
  { actorId: "b", weaponId: "debateclub", refinement: 1, physicalDamageBonus: 0 },
  { actorId: "c", weaponId: "crescentpike", refinement: 1, physicalDamageBonus: 0 },
  { actorId: "d", weaponId: "endoftheline", refinement: 1, physicalDamageBonus: 0 },
] as const;

function fourWeaponCycle() {
  // Reuse the 32-second closed cycle from stateful-weapon-proc-checkpoint.test.ts.
  // The model itself is deliberately absent until the user enables it on the normal team page.
  const normal = (actorId: string, scaling = 0): AbilityDefinition => ({ id: `${actorId}-normal`, actorId,
    name: "明确合成普攻", kind: "normal", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
    hits: [{ id: `${actorId}-host`, frame: 0, scaling, element: "physical", attackTag: "normal", snapshot: "hit" }] });
  const skill = (actorId: string): AbilityDefinition => ({ id: `${actorId}-skill`, actorId,
    name: "明确合成施放", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0 });
  const crescentSkill = skill("c");
  crescentSkill.particles = [{ id: "actual-particle", source: "明确合成粒子", element: "pyro", count: 1,
    kind: "particle", spawnFrame: 0, travelFrames: 1 }];
  const lineNormal = normal("d");
  lineNormal.buffs = [{ key: "boundary-snapshot", target: "self", stat: "atkFlat", value: 200, durationFrames: 1, startFrame: 0 }];
  const commands: LegalTimelineCommand[] = [{ type: "swap", characterId: "a", atFrame: 0 },
    ...[2, 33, 64, 1850, 1881].map(atFrame => ({ type: "normal" as const, actorId: "a", abilityId: "a-normal", atFrame })),
    { type: "swap", characterId: "b", atFrame: 1882 },
    { type: "skill", actorId: "b", abilityId: "b-skill", atFrame: 1883 },
    { type: "normal", actorId: "b", abilityId: "b-normal", atFrame: 1884 },
    { type: "swap", characterId: "c", atFrame: 1885 },
    { type: "skill", actorId: "c", abilityId: "c-skill", atFrame: 1886 },
    { type: "normal", actorId: "c", abilityId: "c-normal", atFrame: 1888 },
    { type: "swap", characterId: "d", atFrame: 1889 },
    { type: "skill", actorId: "d", abilityId: "d-skill", atFrame: 1890 },
    { type: "normal", actorId: "d", abilityId: "d-normal", atFrame: 1919 }];
  const config = makeConfig({ duration: 32, cycleLength: 32, randomSeed: "test-seed",
    dataVersion: "synthetic-stateful-weapon-checkpoint-ui-v1",
    meta: { name: "合成四种状态武器的真实闭环", version: "synthetic-stateful-weapon-checkpoint-ui-v1", verificationStatus: "user-supplied",
      note: "角色与动作均为合成输入；验证固定来源的四种武器被动状态、真实粒子与边界快照，不代表实际角色配装或游戏实测。" },
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [
      { id: "enemy-0", name: "合成目标", position: { x: 0, y: 0 }, hitboxRadius: 0 },
    ] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "d", swapFrames: 1,
      abilities: [normal("a"), normal("b"), normal("c", 1), lineNormal, skill("b"), crescentSkill, skill("d")], commands },
    reactionEngine: { mode: "aura-v9", icdProfiles: { cycle: { resetFrames: 60, applicationSequence: [true, false], tailPolicy: "clamp" } } },
    targetTaskModel: { mode: "target-phase-v2" },
  });
  config.characters = ["a", "b", "c", "d"].map(id => ({ ...config.characters[0]!, id, name: id,
    initialEnergy: 60, stats: { ...neutralStats } }));
  for (const [index, element] of (["hydro", "pyro"] as const).entries()) {
    const hit = config.timeline!.abilities[index]!.hits![0]!;
    hit.element = element;
    hit.application = { gaugeUnits: 1, icd: { mode: "legacy-boolean-profile-v1", icdTag: element, profileId: "cycle" } };
    hit.geometry = { kind: "circle", coordinateSpace: "world", origin: { x: 0, y: 0 }, radius: 1 };
  }
  return config;
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("Stateful weapon normal controls show actual activations and notes, replay the boundary snapshot, and establish deterministic ordinary-aura checkpoints", async ({ page }) => {
  const config = fourWeaponCycle();
  await page.goto("/results");
  await (await revealControl(page.locator("#critModeInput"))).selectOption("noCrit");
  await (await revealControl(page.locator("#energyModeInput"))).selectOption("configured");
  await (await revealControl(page.locator("#iterationInput"))).fill("1");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "stateful-four-weapons.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await runImportedScenario(page);
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  await (await revealControl(page.locator('.product-nav a[href="/team"]'))).click();
  await expect(page.locator("#weaponProcModelEnabled")).not.toBeChecked();
  await (await revealControl(page.locator("#weaponProcModelEnabled"))).check();
  for (const declaration of declarations) {
    await (await revealControl(page.locator(`[data-weapon-proc-weapon="${declaration.actorId}"]`))).selectOption(declaration.weaponId);
    await (await revealControl(page.locator(`[data-weapon-proc-refinement="${declaration.actorId}"]`))).selectOption("1");
    await (await revealControl(page.locator(`[data-weapon-proc-physical-bonus="${declaration.actorId}"]`))).fill("0");
    await expect(page.locator(`[data-weapon-proc-lifecycle-definition="${declaration.weaponId}"]`)).toContainText("实际");
  }
  await expect(page.locator('[data-weapon-proc-definition="a"] [data-weapon-proc-source-note]')).toContainText("来源冲突");
  await (await revealControl(page.locator("#team-apply"))).click();
  await expect(page.locator("#team-status")).toHaveText("队伍配置已应用；请到模拟结果运行。");
  const saved = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(saved.weaponProcModel).toEqual({ mode: "fixed-source-no-character-hitlag-v1", actors: declarations });
  expect(saved.characters).toEqual(config.characters);
  await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  await (await revealControl(page.locator("#runButton"))).click();
  await waitForSimulation(page);
  const record = await downloadSimulationRecord(page);
  const result = record.result;
  expect(record.sourceConfig).toEqual(saved);
  expect(record.options.flatStatBuffSemantics).toBe("canonical-v1");
  expect(result.resolvedRuntimeOptions.flatStatBuffSemantics).toBe("canonical-v1");
  expect(result.skippedActions).toEqual([]);
  const fluteDecisions = result.weaponProcLog!.filter(entry => entry.actorId === "a" && entry.attackTag === "normal");
  expect(fluteDecisions.map(entry => [entry.frame, entry.outcome, entry.stateBefore!.notes, entry.stateAfter!.notes])).toEqual([
    [2, "note-gained", 0, 1], [33, "note-gained", 1, 2], [64, "note-gained", 2, 3],
    [1850, "note-gained", 3, 4], [1881, "triggered", 4, 0],
  ]);
  const activations = result.weaponProcLifecycleLog!.filter(entry => entry.outcome === "window-activated");
  expect(activations.map(entry => [entry.actorId, entry.kind, entry.frame, entry.stateAfter.effectExpiresFrame])).toEqual([
    ["b", "skill", 1883, 2783], ["c", "particle-received", 1887, 2187], ["d", "skill", 1890, 2790],
  ]);
  const pickup = activations.find(entry => entry.actorId === "c")!;
  const particle = result.particleEvents.find(entry => entry.id === pickup.particleEventId)!;
  expect(particle).toMatchObject({ spawnFrame: 1886, receiveFrame: 1887, particleCount: 1, receivedWithinSimulation: true });
  expect(result.energyStats.c!.final).toBe(60);
  const triggers = result.weaponProcLog!.filter(entry => entry.outcome === "triggered");
  expect(triggers.map(entry => [entry.weaponId, entry.frame, entry.damageFrame])).toEqual([
    ["flute", 1881, 1882], ["debateclub", 1884, 1885], ["crescentpike", 1888, 1889], ["endoftheline", 1919, 1920],
  ]);
  const children = result.damageEvents.filter(event => event.weaponProcLogId !== undefined);
  // Source R1 coefficients; final End of the Line hit retains the trigger's one-frame +200 ATK buff.
  expect(children.map(event => [event.actorId, event.frame, event.finalDamage])).toEqual([
    ["a", 1882, 1000 * 1 * 0.5], ["b", 1885, 1000 * 0.6 * 0.5],
    ["c", 1889, 1000 * 0.2 * 0.5], ["d", 1920, 1200 * 0.8 * 0.5],
  ]);
  expect(result.totalDamage).toBe(1000 * 0.5 + 500 + 300 + 100 + 480);
  const lineTrigger = triggers.find(entry => entry.weaponId === "endoftheline")!;
  const lineHit = children.find(event => event.actorId === "d")!;
  expect(lineTrigger).toMatchObject({ stateBefore: { procCount: 0 }, stateAfter: { procCount: 1, hitCooldownExpiresFrame: 2039 } });
  expect(lineHit.statsBeforeDamage.flatAtk).toBe(200);

  await (await revealControl(page.getByRole("button", { name: "时间轴", exact: true }))).click();
  await expect(page.locator('#weaponProcAudit [data-weapon-proc-lifecycle-outcome="window-activated"]')).toHaveCount(3);
  const debate = activations.find(entry => entry.actorId === "b")!;
  await (await revealControl(page.locator(`#weaponProcAudit [data-weapon-proc-lifecycle-detail="${debate.id}"] > summary`))).click();
  await expect(page.locator(`#weaponProcAudit [data-weapon-proc-lifecycle-action="${debate.actionLogIndex}"]`)).toContainText("b-skill");
  const debateDetails = page.locator(`#weaponProcAudit [data-weapon-proc-lifecycle-detail="${debate.id}"]`);
  await expect(debateDetails.locator("[data-weapon-proc-state-before]")).toContainText("无记录");
  await expect(debateDetails.locator("[data-weapon-proc-state-after]")).toContainText("2783f");
  await (await revealControl(page.locator(`#weaponProcAudit [data-weapon-proc-lifecycle-detail="${pickup.id}"] > summary`))).click();
  await expect(page.locator(`#weaponProcAudit [data-weapon-proc-lifecycle-particle="${particle.id}"]`)).toContainText("接收 1887f");
  const fluteTrigger = triggers.find(entry => entry.weaponId === "flute")!;
  await expect(page.locator(`#weaponProcAudit [data-weapon-proc-id="${fluteTrigger.id}"] [data-weapon-proc-state-summary]`)).toContainText("音符 4 → 0");
  await (await revealControl(page.locator(`#weaponProcAudit [data-weapon-proc-detail="${lineTrigger.id}"] > summary`))).click();
  await (await revealControl(page.locator(`#weaponProcAudit [data-weapon-proc-hit-detail="${lineHit.id}"] > summary`))).click();
  await expect(page.locator(`#weaponProcAudit [data-weapon-proc-replay="${lineHit.id}"]`)).toContainText("差值 0");
  await (await revealControl(page.getByRole("button", { name: "逐段伤害", exact: true }))).click();
  await (await revealControl(page.locator(`#hitTableBody tr[data-hit-id="${lineHit.id}"]`))).click();
  await expect(page.locator("#sharedHitTrace")).toContainText("差值 0");
  const sourceTrace = await page.locator("#sharedHitTrace tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })));
  await (await revealControl(page.locator("#openHitCalculator"))).click();
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  expect(await page.locator("#calc-results tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })))).toEqual(sourceTrace);
  const captured = await downloadJson<CapturedSimulationHit>(page, '[data-action="export"]');
  expect(captured.sourceResult).toEqual(result);
  expect(captured.sourceResult.resolvedRuntimeOptions.flatStatBuffSemantics).toBe("canonical-v1");
  expect(captured.eventId).toBe(lineHit.id);
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({ name: "stateful-boundary-hit.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(captured)) });
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "stateful-weapons-complete-record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(record.wire)) });
  await expectReadonlyRecord(page, record);
  const restored = await downloadSimulationRecord(page);
  expect(restored.sourceConfig).toEqual(saved);
  expect(restored.options).toEqual(record.options);
  expect(restored.result).toEqual(result);

  await (await revealControl(page.getByRole("button", { name: "总览", exact: true }))).click();
  await (await revealControl(page.locator("#analysis-warmup-energy"))).selectOption("configured");
  await (await revealControl(page.locator("#analysis-warmup-cycles"))).fill("8");
  await (await revealControl(page.locator("#analysis-steady-run"))).click();
  await expect(page.locator("#analysis-steady-run")).toBeEnabled();
  await expect(page.locator("#analysis-startup-output")).toContainText("已从完整模拟检查点建立稳态");
  await expect(page.locator("#analysis-startup-output")).toContainText("稳态窗口 DPS 58.75");
  const { startup } = await downloadJson<{ startup: SimulationStartupResult }>(page, "#analysis-export");
  expect(startup.status).toBe("steady-state-established");
  expect(startup.measurement).toMatchObject({ totalDamage: 1880, dps: 58.75, durationSeconds: 32 });
  expect(startup.steadyState).toMatchObject({ periodCycles: 1, steadyStateDps: 58.75 });
  expect(startup.result!.executionAudit!.checkpointCoverage).toEqual({ complete: true, missingDimensions: [], reasons: [] });
  expect(startup.result!.damageEvents.some(event => event.reaction === "reverseVaporize")).toBe(true);
  const point = startup.result!.executionAudit!.phaseCheckpoints.at(-1)!;
  expect(point.state).toMatchObject({
    icdAndTriggerHistory: { weaponProcs: { actors: [
      { actorId: "a", remainingCooldownTicks: null, lifecycle: { effectRemainingTicks: null, notes: 0 } },
      { actorId: "b", remainingCooldownTicks: 144, lifecycle: { effectRemainingTicks: 863 } },
      { actorId: "c", remainingCooldownTicks: null, lifecycle: { effectRemainingTicks: 267 } },
      { actorId: "d", remainingCooldownTicks: 119, lifecycle: { effectRemainingTicks: 870, activationCooldownRemainingTicks: 690, procCount: 1 } },
    ] } },
    pendingEvents: { inFlight: expect.arrayContaining([expect.objectContaining({ type: "hit", remainingTicks: 0,
      payload: expect.objectContaining({ action: expect.objectContaining({ id: "weapon-proc:d:endoftheline" }),
        snapshots: { d: expect.objectContaining({ flatAtk: 200 }) },
        weaponProcContext: expect.objectContaining({ triggerAgeTicks: 1, stateBefore: expect.objectContaining({ procCount: 0 }),
          stateAfter: expect.objectContaining({ procCount: 1 }), triggerBuffStatuses: [expect.objectContaining({ startAgeTicks: 1, endRemainingTicks: 0 })] }) }) })]) },
    buffsAndDebuffs: { buffs: [] },
  });
  const measuredLedger = page.locator("#analysis-startup-output [data-measurement-weapon-proc-ledger]");
  await expect(measuredLedger.locator("[data-weapon-proc-carry-in]")).toHaveCount(1);
  await expect(measuredLedger.locator('[data-weapon-proc-lifecycle-outcome="window-activated"]')).toHaveCount(3);
  console.info("Stateful weapon browser measurements", JSON.stringify({ totalDamage: result.totalDamage,
    activations: activations.map(entry => ({ weapon: entry.weaponId, frame: entry.frame, kind: entry.kind, effectExpiresFrame: entry.stateAfter.effectExpiresFrame })),
    independentHits: children.map(event => ({ actor: event.actorId, frame: event.frame, damage: event.finalDamage })),
    fullEnergyPickup: result.energyStats.c!.final, replayDifference: 0, steadyState: startup.status,
    checkpointComplete: startup.result!.executionAudit!.checkpointCoverage.complete, measurement: startup.measurement,
    boundaryTick: point.tick, pendingBoundaryFlatAtk: 200 }));
});
