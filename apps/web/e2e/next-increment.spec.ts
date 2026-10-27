import { revealControl, runImportedScenario } from "./release-ui-helpers";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { LegalTimelineCommand } from "@genshin-dps-lab/schemas";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";
import type { StellarConductSimulationResult } from "../../../packages/sim-core/src/stellar-conduct-runtime";
import type { LunarBloomAbilityDeclaration, LunarBloomSimulationResult } from "../../../packages/sim-core/src/lunar-bloom-runtime";
import type { StellarSwirlSimulationResult } from "../../../packages/sim-core/src/stellar-swirl-runtime";

async function waitForSimulation(page: Page): Promise<void> {
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
}

async function importFixture(page: Page, name: string, notice: string): Promise<void> {
  const buffer = await readFile(new URL(`../../../docs/fixtures/${name}`, import.meta.url));
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name, mimeType: "application/json", buffer });
  await runImportedScenario(page);
  await expect(page.locator("#notice")).toContainText(notice);
  await waitForSimulation(page);
}

async function downloadJson<T>(page: Page, selector: string): Promise<T> {
  const pending = page.waitForEvent("download");
  await (await revealControl(page.locator(selector))).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}

async function calculatorAudit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

function hitValue(result: CalculatorResult, id: string): number {
  const value = result.hits[0]?.trace.find(node => node.id === id)?.result?.value;
  expect(value, `shared hit trace ${id}`).toBeDefined();
  return value!;
}

async function equipFourPieces(page: Page, setId: string): Promise<void> {
  for (const slot of ["flower", "plume", "sands", "goblet"]) {
    await (await revealControl(page.locator(`[data-artifact="${slot}"] > summary`))).click();
    await (await revealControl(page.locator(`[data-artifact="${slot}"] [data-artifact-field="set"]`))).selectOption(setId);
  }
  await (await revealControl(page.locator('[data-equipment="setEffectsEnabled"]'))).check();
  await (await revealControl(page.locator('[data-equipment="effectsDisabled"]'))).check();
}

test("sourced Viridescent resistance conditions and Thundering Fury aggravate bonuses affect the shared calculation", async ({ page }) => {
  await page.goto("/calculator");
  await (await revealControl(page.locator("#calc-character"))).selectOption("character:10000015");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  const frostgnaw = await page.locator("#calc-skill option").filter({ hasText: "霜袭" }).first().getAttribute("value");
  await (await revealControl(page.locator("#calc-skill"))).selectOption(frostgnaw!);
  await equipFourPieces(page, "artifact-set:15002");
  for (const element of ["Pyro", "Hydro", "Cryo", "Electro"]) {
    await (await revealControl(page.locator(`[data-equipment-formula="vv${element}ResActive"]`))).selectOption("false");
  }
  await (await revealControl(page.locator("[data-equipment-apply]"))).click();
  await (await revealControl(page.locator('[data-field="enemy.resistance"]'))).fill("0.1");
  const inactive = await calculatorAudit(page);
  expect(inactive.result.status).toBe("calculated");
  expect(hitValue(inactive.result, "effectiveResistance")).toBe(0.1);
  expect(hitValue(inactive.result, "applicableDamageBonus")).toBe(0);
  // An explicit target-state assumption, not proof that this actor triggers VV.
  await (await revealControl(page.locator('[data-equipment-formula="vvCryoResActive"]'))).selectOption("true");
  await (await revealControl(page.locator("[data-equipment-apply]"))).click();
  const active = await calculatorAudit(page);
  expect(hitValue(active.result, "effectiveResistance")).toBeCloseTo(-0.3, 12);
  expect(hitValue(active.result, "applicableDamageBonus")).toBe(0);
  expect(active.result.totals?.expected).toBeCloseTo(inactive.result.totals!.expected * 1.15 / 0.9, 8);
  await (await revealControl(page.locator("#calc-build-mode"))).selectOption("manual-final");
  const finalPanel = await calculatorAudit(page);
  expect(finalPanel.result.totals?.expected).toBeCloseTo(active.result.totals!.expected, 8);
  expect(finalPanel.document.hits[0]?.kind === "ordinary" && finalPanel.document.hits[0].effectiveResistance).toBeCloseTo(-0.3, 12);

  await (await revealControl(page.locator("#calc-character"))).selectOption("character:10000006");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await (await revealControl(page.locator("#calc-skill"))).selectOption({ index: 0 });
  await equipFourPieces(page, "artifact-set:15005");
  await (await revealControl(page.locator("[data-equipment-apply]"))).click();
  const lisa = (await calculatorAudit(page)).document;
  const firstHit = lisa.hits[0]!;
  expect(firstHit.kind === "ordinary" && firstHit.element).toBe("electro");
  if (firstHit.kind !== "ordinary") throw new Error("Expected Lisa's ordinary Electro hit");
  lisa.id = "e2e-lisa-aggravate-sourced-tf";
  lisa.assumptions.push("浏览器验收显式假定本次雷命中满足超激化条件，不声明自动附着已运行。");
  firstHit.additiveReaction = "aggravate";
  firstHit.reaction = "none";
  firstHit.reactionBonus = 0;
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({ name: "lisa-aggravate.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(lisa)) });
  await expect(page.locator("#calc-results .calculator-audit pre")).toContainText(lisa.id);
  const aggravated = await calculatorAudit(page);
  expect(aggravated.result.status).toBe("calculated");
  expect(hitValue(aggravated.result, "applicableReactionBonus")).toBe(0.2);
  expect(hitValue(aggravated.result, "applicableDamageBonus")).toBe(0.15);
  const reactionNode = aggravated.result.hits[0]!.trace.find(node => node.id === "additive.additiveReactionDamage")!;
  const inputs = Object.fromEntries(reactionNode.inputs.map(input => [input.key, input.value]));
  expect(inputs.reactionBonus).toBe(0.2);
  expect(reactionNode.result?.value).toBeCloseTo(inputs.levelBaseDamage! * 1.15 * (1 + inputs.elementalMasteryBonus! + 0.2), 8);
  await (await revealControl(page.locator("#calc-build-mode"))).selectOption("manual-final");
  expect((await calculatorAudit(page)).result.totals?.expected).toBeCloseTo(aggravated.result.totals!.expected, 8);
});

test("rotation DSL and visual ordering retain requested frames, movement and actor bindings", async ({ page }) => {
  await page.goto("/results");
  await importFixture(page, "lunar-crystallize-reference.synthetic.json", "合成机制验证：月结晶");
  await (await revealControl(page.locator('.product-nav a[href="/rotation"]'))).click();
  const dsl = [
    "at 12f action h for h",
    "at 20f dash 3f for h",
    "at 25f jump 4f for h",
    "at 35f swap g",
    "at 50f action g for g",
    "at 55f pickup hydro",
    "wait 6f",
  ].join("\n");
  await (await revealControl(page.locator("#rotation-dsl"))).fill(dsl);
  await (await revealControl(page.locator("#rotation-parse"))).click();
  await expect(page.locator("#rotation-status")).toContainText("请求帧、移动占用和拾取类型已保留");
  await expect(page.locator("#rotation-list li")).toHaveCount(7);
  await (await revealControl(page.locator('[data-move-up="2"]'))).click();
  await expect(page.locator("#rotation-list li").nth(1)).toContainText("跳跃");
  await (await revealControl(page.locator('[data-move-down="1"]'))).click();
  await expect(page.locator("#rotation-dsl")).toHaveValue(dsl);
  await (await revealControl(page.locator('[data-request="0"]'))).fill("14");
  await (await revealControl(page.locator('[data-request="0"]'))).press("Tab");
  const editedDsl = dsl.replace("at 12f", "at 14f");
  await expect(page.locator("#rotation-dsl")).toHaveValue(editedDsl);
  await (await revealControl(page.locator("#rotation-parse"))).click();
  await (await revealControl(page.locator("#rotation-compile"))).click();
  await expect(page.locator("#rotation-timeline")).toContainText("已编译 7 条指令");
  await expect(page.locator("#rotation-timeline")).toContainText("能量、附着与拾取成败在实际模拟中判定");
  await expect(page.locator("#rotation-timeline tbody tr").first()).toContainText("14");
  await (await revealControl(page.locator("#rotation-save"))).click();
  await expect(page).toHaveURL(/\/results$/);
  await waitForSimulation(page);
  const expected: LegalTimelineCommand[] = [
    { type: "skill", actorId: "h", abilityId: "h", atFrame: 14 },
    { type: "dash", actorId: "h", frames: 3, atFrame: 20 },
    { type: "jump", actorId: "h", frames: 4, atFrame: 25 },
    { type: "swap", characterId: "g", atFrame: 35 },
    { type: "skill", actorId: "g", abilityId: "g", atFrame: 50 },
    { type: "pickUpCrystallize", element: "hydro", atFrame: 55 },
    { type: "wait", frames: 6 },
  ];
  const config = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(config.timeline?.commands).toEqual(expected);
  const result = await page.evaluate(() => window.GenshinDpsLab.getLastResult());
  expect(result?.timelineExecution?.commandResults.slice(0, 6).map(command => command.requestedFrame)).toEqual([14, 20, 25, 35, 50, 55]);
  await (await revealControl(page.locator('.product-nav a[href="/rotation"]'))).click();
  await expect(page.locator("#rotation-dsl")).toHaveValue(editedDsl);
  await page.getByText("载入来源动作示例 · 安柏 N1–N5", { exact: true }).click();
  await (await revealControl(page.locator("#rotation-load-source-chain"))).click();
  await expect(page.locator("#execution-profile")).toHaveValue("unchanged");
  await (await revealControl(page.locator("#rotation-dsl"))).fill("at 1f N5");
  await (await revealControl(page.locator("#rotation-parse"))).click();
  await expect(page.locator("#rotation-list li")).toHaveCount(5);
  await expect(page.locator('[data-request="0"]')).toHaveValue("1");
  await (await revealControl(page.locator("#rotation-compile"))).click();
  await expect(page.locator("#rotation-timeline")).toContainText("已编译 5 条指令");
  await (await revealControl(page.locator("#rotation-dsl"))).fill("N6");
  await (await revealControl(page.locator("#rotation-parse"))).click();
  await expect(page.locator("#rotation-status")).toContainText("未定义合法的 N6 普攻输入序列");
  await expect(page.locator("#rotation-list li")).toHaveCount(5);
});

test("executed Stellar Conduct fields and the explicit Moondew ability restore their actual damage contexts", async ({ page }) => {
  const stellarExpected = JSON.parse(await readFile(new URL("../../../docs/fixtures/stellar-conduct-reference.synthetic.expected.json", import.meta.url), "utf8")) as {
    totalDamage: number; publication: { frame: number; count: number }[]; fieldInfluences: StellarConductSimulationResult["fieldInfluences"];
  };
  await page.goto("/results");
  await importFixture(page, "stellar-conduct-reference.synthetic.json", "合成机制验证：星导领域");
  await (await revealControl(page.locator('.tab[data-tab="special"]'))).click();
  await (await revealControl(page.locator('[data-lunar-action="refresh"]'))).click();
  await expect(page.locator("[data-lunar-config]")).toContainText("合成机制验证：星导领域");
  await (await revealControl(page.locator("#critModeInput"))).selectOption("average");
  await (await revealControl(page.locator("[data-lunar-profile]"))).selectOption("stellar-conduct");
  await (await revealControl(page.locator('[data-lunar-party-index="0"]'))).selectOption("sandrone");
  await (await revealControl(page.locator('[data-lunar-party-index="1"]'))).selectOption("lisa");
  await (await revealControl(page.locator('[data-lunar-action="run"]'))).click();
  await expect(page.locator("[data-lunar-status]")).toContainText("记录 6 条领域影响");
  const stellar = await downloadJson<{ result: StellarConductSimulationResult }>(page, '[data-lunar-action="export"]');
  expect(stellar.result.totalDamage).toBeCloseTo(stellarExpected.totalDamage, 8);
  expect(stellar.result.fieldInfluences).toEqual(stellarExpected.fieldInfluences);
  expect(stellar.result.executionLog.filter(entry => entry.type === "field-buffs").map(entry => ({ frame: entry.frame, count: entry.details.applicationCount }))).toEqual(stellarExpected.publication);
  expect(stellar.result.baseResult.damageEvents.every(hit => hit.reaction !== "superconduct")).toBe(true);
  expect("specialDamageEvents" in stellar.result).toBe(false);
  await expect(page.getByTestId("lunar-special-damage")).toHaveCount(0);
  const lingering = stellar.result.fieldInfluences.find(hit => hit.frame === 400)!;
  expect(lingering.fieldPresent).toBe(false);
  expect(lingering.physicalResistanceReduction).toBe(0.4);
  await (await revealControl(page.locator(`[data-stellar-field="${lingering.eventId}"] > summary`))).click();
  await (await revealControl(page.locator(`[data-stellar-field-detail="${lingering.eventId}"] [data-lunar-open-classic="${lingering.eventId}"]`))).click();
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  await expect(page.locator('#calc-results [data-trace-node="stellarConductResistance"]')).toBeVisible();

  const bloomExpected = JSON.parse(await readFile(new URL("../../../docs/fixtures/lunar-bloom-reference.synthetic.expected.json", import.meta.url), "utf8")) as {
    sourceAbilityRequest: { actorId: string; requestedFrame: number; talentLevel: number; ascension: number; constellation: number; abilityKey: string };
    totalDamage: number; classicDamage: number; lunarBloomDamage: number;
    events: { frame: number; damage: number; resourceConsumption: { frame: number; consumed: number } }[];
    resourceGains: number[]; resourceConsumptionFrames: number[]; verdantDew: LunarBloomSimulationResult["verdantDew"];
  };
  await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  await importFixture(page, "lunar-bloom-reference.synthetic.json", "合成机制验证：草露与月露涤荡");
  await (await revealControl(page.locator('.tab[data-tab="special"]'))).click();
  await (await revealControl(page.locator('[data-lunar-action="refresh"]'))).click();
  await expect(page.locator("[data-lunar-config]")).toContainText("合成机制验证：草露与月露涤荡");
  const original = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  await (await revealControl(page.locator("#critModeInput"))).selectOption("average");
  await (await revealControl(page.locator("[data-lunar-profile]"))).selectOption("lunar-bloom");
  await (await revealControl(page.locator('[data-lunar-party-index="0"]'))).selectOption("columbina");
  await (await revealControl(page.locator('[data-lunar-party-index="1"]'))).selectOption("nahida");
  await (await revealControl(page.locator("[data-lb-source-enabled]"))).check();
  const source = bloomExpected.sourceAbilityRequest;
  await (await revealControl(page.locator('[data-lb-source-field="actorId"]'))).selectOption(source.actorId);
  await (await revealControl(page.locator('[data-lb-source-field="requestedFrame"]'))).fill(String(source.requestedFrame));
  await (await revealControl(page.locator('[data-lb-source-field="talentLevel"]'))).fill(String(source.talentLevel));
  await (await revealControl(page.locator('[data-lb-source-field="ascension"]'))).selectOption(String(source.ascension));
  await (await revealControl(page.locator('[data-lb-source-field="constellation"]'))).selectOption(String(source.constellation));
  await (await revealControl(page.locator('[data-lunar-action="run"]'))).click();
  await expect(page.locator("[data-lunar-status]")).toContainText("实际结算 3 条月绽放事件");
  const bloom = await downloadJson<{ result: LunarBloomSimulationResult; declaredAbilities: LunarBloomAbilityDeclaration[] }>(page, '[data-lunar-action="export"]');
  expect(await page.evaluate(() => window.GenshinDpsLab.getConfig())).toEqual(original);
  expect(bloom.declaredAbilities).toHaveLength(1);
  expect(bloom.declaredAbilities[0]).toMatchObject({ actorId: source.actorId, abilityKey: source.abilityKey, talentLevel: source.talentLevel, ascension: source.ascension, constellation: source.constellation });
  expect(bloom.result.baseResult.config.reactionEngine?.mode).toBe("aura-v5");
  expect(bloom.result.totalDamage).toBeCloseTo(bloomExpected.totalDamage, 8);
  expect(bloom.result.classicDamage).toBeCloseTo(bloomExpected.classicDamage, 8);
  expect(bloom.result.lunarBloomDamage).toBeCloseTo(bloomExpected.lunarBloomDamage, 8);
  expect(bloom.result.specialDamageEvents.map(hit => hit.frame)).toEqual(bloomExpected.events.map(hit => hit.frame));
  expect(bloom.result.executionLog.filter(entry => entry.type === "resource-gain").map(entry => entry.frame)).toEqual(bloomExpected.resourceGains);
  expect(bloom.result.executionLog.filter(entry => entry.type === "ability-resource-consumed").map(entry => entry.frame)).toEqual(bloomExpected.resourceConsumptionFrames);
  expect(bloom.result.verdantDew).toEqual(bloomExpected.verdantDew);
  expect(new Set(bloom.result.specialDamageEvents.map(hit => hit.resourceConsumption.sourceEventId)).size).toBe(1);
  await page.locator("#lunarSimulationHost").screenshot({ path: "docs/validation/screenshots/lunar-bloom-result.png" });
  for (const [index, hit] of bloom.result.specialDamageEvents.entries()) {
    const expected = bloomExpected.events[index]!;
    expect(hit.damage).toBeCloseTo(expected.damage, 8);
    expect(hit.resourceConsumption).toMatchObject({ frame: expected.resourceConsumption.frame, consumed: 1 });
    await (await revealControl(page.locator(`[data-lunar-event="${hit.id}"] > summary`))).click();
    await (await revealControl(page.locator(`[data-lunar-open-calculator="${hit.id}"]`))).click();
    await expect(page).toHaveURL(/\/calculator$/);
    const replay = await calculatorAudit(page);
    const restoredHit = replay.document.hits[0]!;
    expect(restoredHit.kind === "special" && restoredHit.context).toEqual(hit.context);
    expect(replay.result.totals?.expected).toBeCloseTo(hit.damage, 8);
    if (index < bloom.result.specialDamageEvents.length - 1) await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  }
});

test("Stellar Swirl guide profile discloses source conflicts and restores initial and actual Cryo-delivery hits", async ({ page }) => {
  const expected = JSON.parse(await readFile(new URL("../../../docs/fixtures/stellar-swirl-reference.synthetic.expected.json", import.meta.url), "utf8")) as {
    totalDamage: number; classicDamage: number; stellarSwirlDamage: number;
    profile: StellarSwirlSimulationResult["profile"]; highJump: StellarSwirlSimulationResult["highJump"];
    events: { id: number; branch: string; snapshotFrame: number; frame: number; ownerId: string; contributorIds: string[]; damage: number; effectiveResistance: number; cryoDelivery: unknown; executionOrder: unknown }[];
  };
  await page.goto("/results");
  await importFixture(page, "stellar-swirl-reference.synthetic.json", "合成机制验证：星扩散指南参考");
  await (await revealControl(page.locator('.tab[data-tab="special"]'))).click();
  await (await revealControl(page.locator('[data-lunar-action="refresh"]'))).click();
  await (await revealControl(page.locator("#critModeInput"))).selectOption("average");
  await (await revealControl(page.locator("[data-lunar-profile]"))).selectOption("stellar-swirl");
  await expect(page.locator("[data-stellar-swirl-warning]")).toContainText("guide-profile-source-conflict");
  await expect(page.locator("[data-stellar-swirl-warning]")).toContainText("1→3→7");
  await (await revealControl(page.locator('[data-lunar-party-index="0"]'))).selectOption("sandrone");
  await (await revealControl(page.locator('[data-lunar-party-index="1"]'))).selectOption("sucrose");
  await (await revealControl(page.locator('[data-lunar-action="run"]'))).click();
  await expect(page.locator('[data-lunar-action="export"]')).toBeEnabled();
  const report = await downloadJson<{ format: string; result: StellarSwirlSimulationResult }>(page, '[data-lunar-action="export"]');
  expect(report.format).toBe("stellar-swirl-report-v1");
  const result = report.result;
  expect(result.profile).toEqual(expected.profile);
  expect(result.totalDamage).toBeCloseTo(expected.totalDamage, 8);
  expect(result.classicDamage).toBeCloseTo(expected.classicDamage, 8);
  expect(result.stellarSwirlDamage).toBeCloseTo(expected.stellarSwirlDamage, 8);
  expect(result.specialDamageEvents.map(event => ({
    id: event.id, branch: event.intent.branch, snapshotFrame: event.intent.snapshotFrame, frame: event.frame,
    ownerId: event.ownerId, contributorIds: event.intent.contributorIds, damage: event.damage,
    effectiveResistance: event.context.effectiveResistance, cryoDelivery: event.cryoDelivery, executionOrder: event.executionOrder,
  }))).toEqual(expected.events);
  expect(result.highJump).toEqual(expected.highJump);
  await expect(page.locator("[data-stellar-swirl-result-warning]")).toContainText("181 帧");
  await expect(page.locator("[data-stellar-swirl-high-jump]")).toContainText("consumptionImplemented: true");
  const initial = result.specialDamageEvents[0]!;
  expect(initial.intent.snapshotFrame).toBe(6);
  expect(initial.frame).toBe(9);
  expect(initial.context.contributors.find(contributor => contributor.id === "a")?.elementalMastery).toBe(200);
  expect(initial.context.effectiveResistance).toBe(-0.1);
  const vortex = result.specialDamageEvents.find(event => event.intent.branch === "stellar-swirl-vortex-2")!;
  expect(vortex.cryoDelivery).toMatchObject({ applied: true, element: "cryo", gaugeUnits: 1, ownerId: "a", frame: 36 });
  for (const [index, event] of [initial, vortex].entries()) {
    await (await revealControl(page.locator(`[data-lunar-event="${event.id}"] > summary`))).click();
    const receipt = page.locator(`[data-lunar-event-detail="${event.id}"] [data-stellar-swirl-cryo-receipt]`);
    if (event.cryoDelivery === null) await expect(receipt).toContainText("cryoDelivery = null 为不适用");
    else expect(JSON.parse((await receipt.locator("pre").textContent())!)).toEqual(event.cryoDelivery);
    await (await revealControl(page.locator(`[data-lunar-open-calculator="${event.id}"]`))).click();
    await expect(page).toHaveURL(/\/calculator$/);
    const replay = await calculatorAudit(page);
    const hit = replay.document.hits[0]!;
    expect(hit.kind === "special" && hit.context).toEqual(event.context);
    expect(replay.result.totals?.expected).toBeCloseTo(event.damage, 8);
    expect(replay.result.verification).toBe("provisional");
    if (index === 0) await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  }
});
