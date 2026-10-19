import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";

const context = "gameContext.observedEntityCast";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

async function setState(page: Page, field: string, value: "1" | "0" | "unknown" = "1"): Promise<void> {
  await page.locator(`[data-source-cast-state-field="${context}.${field}"]`).selectOption(value);
}

async function setNumber(page: Page, field: string, value: number | ""): Promise<void> {
  await page.locator(`[data-field="${context}.${field}"]`).fill(String(value));
}

async function selectAction(page: Page, character: string, skillId: string): Promise<void> {
  await page.locator("#calc-character").selectOption(character);
  await expect(page.locator("#calc-skill")).toBeEnabled();
  const definitions = JSON.parse(await readFile(new URL("../../../packages/game-data/sources/observed-entity-casts/definitions.json", import.meta.url), "utf8")) as { templates: Array<{ skillId: string; label: string }> };
  const label = definitions.templates.find(cast => cast.skillId === skillId)!.label;
  const action = await page.locator("#calc-skill option").filter({ hasText: label }).getAttribute("value");
  expect(action).toBeTruthy();
  await page.locator("#calc-skill").selectOption(action!);
  await page.locator("#calc-constellation").selectOption("0");
  await page.locator("#calc-talent-level").fill("1");
  await page.locator("#calc-talent-level").press("Tab");
  await expect.poll(async () => (await audit(page)).document.gameContext?.effectiveTalentLevel).toBe(1);
  expect((await audit(page)).document.gameContext?.skillId).toBe(skillId);
}

async function completeWindow(page: Page, throughFrame: number): Promise<void> {
  await page.locator("#calc-scope").selectOption("one-cast");
  await page.locator(`[data-source-cast-text-field="${context}.casterId"]`).fill("owner");
  await page.locator(`[data-source-cast-text-field="${context}.targetId"]`).fill("enemy");
  for (const field of ["freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits"]) await setState(page, field);
  await setNumber(page, "observedThroughFrame", throughFrame);
}

async function confirmContacts(page: Page, expectedCount: number, miss?: string): Promise<void> {
  const contacts = page.locator(`[data-source-cast-state-field^="${context}.targetContacts."]`);
  await expect(contacts).toHaveCount(expectedCount);
  const fields = await contacts.evaluateAll(nodes => nodes.map(node => node.getAttribute("data-source-cast-state-field")!));
  for (const field of fields) await page.locator(`[data-source-cast-state-field="${field}"]`).selectOption(field === `${context}.targetContacts.${miss}` ? "0" : "1");
}

async function useManualPanel(page: Page): Promise<void> {
  await page.locator("#calc-build-mode").selectOption("manual-final");
  await page.locator("#calc-ascension").selectOption("6");
  for (const [field, value] of Object.entries({ atk: 1000, hp: 30000, def: 800, em: 0, critRate: 0.5, critDamage: 1 })) {
    await page.locator(`[data-field="build.stats.${field}"]`).fill(String(value));
  }
  await page.locator('[data-field="characterLevel"]').fill("90");
  await page.locator('[data-field="enemy.level"]').fill("90");
  await page.locator('[data-field="enemy.resistance"]').fill("0.1");
}

function expectDamage(result: CalculatorResult, count: number, nonCritical: number, expected: number): void {
  expect(result.status).toBe("calculated");
  expect(result.hits).toHaveLength(count);
  expect(result.totals!.nonCritical).toBeCloseTo(nonCritical, 9);
  expect(result.totals!.expected).toBeCloseTo(expected, 9);
}

function frames(document: CalculatorDocument): Array<number | undefined> {
  return document.hits.map(hit => hit.kind === "ordinary" ? hit.observedEntityEvent?.frame : undefined);
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("observed contacts and Blood Blossom records use ordinary controls, preserve final JSON, and keep a past hit independent", async ({ page }) => {
  await page.goto("/calculator");
  await selectAction(page, "character:10000015", "observed-kaeya-burst-c0");
  await useManualPanel(page);
  await completeWindow(page, 600);
  await setState(page, "kaeya.fixedSourceApproximationConfirmed");
  expect((await audit(page)).result.status).toBe("blocked");
  // The fixed source window has 13 candidates, but the explicitly missed contact contributes no damage.
  await confirmContacts(page, 13, "icicle-2");
  const kaeya = await audit(page);
  expect(kaeya.document.gameContext).toMatchObject({ skillId: "observed-kaeya-burst-c0", scopeCoverage: "complete-cast" });
  expect(frames(kaeya.document)).toEqual([53, 133, 173, 213, 253, 293, 333, 373, 413, 453, 493, 533]);
  const kaeyaHit = 1000 * 0.776 * 0.5 * 0.9;
  expectDamage(kaeya.result, 12, 12 * kaeyaHit, 12 * kaeyaHit * 1.5);

  await selectAction(page, "character:10000062", "observed-aloy-skill-c0");
  await useManualPanel(page);
  await completeWindow(page, 122);
  await setState(page, "aloy.fixedSourceApproximationConfirmed");
  await setState(page, "aloy.allSourceBombletsDeclared");
  await setNumber(page, "aloy.travelFrames", 30);
  await setNumber(page, "aloy.bombDelayFrames", 60);
  await expect(page.locator(`[data-field="${context}.aloy.bombletCount"]`)).toHaveValue("");
  expect((await audit(page)).result.status).toBe("blocked");
  await setNumber(page, "aloy.bombletCount", 2);
  // Numeric inputs update the calculation immediately; the normal apply action redraws its contact candidates.
  await page.locator('[data-action="observed-entity-apply"]').click();
  // The source approximation is an explicitly declared pair, not a default game-wide mine count.
  await confirmContacts(page, 3, "bomblet-2");
  const aloy = await audit(page);
  expect(aloy.document.gameContext).toMatchObject({ skillId: "observed-aloy-skill-c0", scopeCoverage: "complete-cast" });
  expect(frames(aloy.document)).toEqual([50, 116]);
  expect(aloy.document.hits.map(hit => hit.kind === "ordinary" ? hit.observedEntityEvent?.snapshotFrame : undefined)).toEqual([20, 50]);
  const aloyDamage = 1000 * (1.776 + 0.4) * 0.5 * 0.9;
  expectDamage(aloy.result, 2, aloyDamage, aloyDamage * 1.5);

  await selectAction(page, "character:10000046", "observed-hutao-skill-c0");
  await useManualPanel(page);
  await completeWindow(page, 873);
  await setState(page, "hutao.noSwapUntilNaturalEnd");
  await setState(page, "hutao.allChargedAttacksRecorded");
  for (const [field, value] of Object.entries({ "hutao.skillStartCurrentHP": 15000, "hutao.skillStartMaxHP": 30000,
    "hutao.skillStartBaseATK": 1000, "sharedState.actualHPRatioAtSnapshot": 0.35,
    "sharedState.includedAttackBonus": 0, "sharedState.includedDamageBonus": 0 })) await setNumber(page, field, value);
  expect((await audit(page)).result.status).toBe("blocked");
  for (const [index, times] of [[30, 60], [300, 340]].entries()) {
    await page.locator('[data-action="observed-entity-row-add"][data-observed-collection="hutao.chargedAttacks"]').click();
    const row = page.locator(`[data-observed-row="hutao.chargedAttacks"][data-observed-row-index="${index}"]`);
    for (const [field, value] of Object.entries({ id: `charge-${index + 1}`, startFrame: String(times[0]), removedFrame: String(times[1]), actorId: "owner", targetId: "enemy" })) {
      await row.locator(`[data-observed-row-field="${field}"]`).fill(value);
    }
    await row.locator('[data-observed-row-field="nextState"]').selectOption("other");
    await row.locator('[data-observed-row-field="hitConfirmed"]').selectOption("true");
  }
  await expect(page.locator("[data-observed-draft-status]")).toContainText("尚未应用");
  await expect(page.locator("#calc-results")).toContainText("请应用或放弃");
  await page.locator('[data-action="observed-entity-apply"]').click();
  await expect(page.locator("[data-observed-draft-status]")).toContainText("已应用");
  await confirmContacts(page, 3);
  const hutao = await audit(page);
  expect(hutao.document.gameContext).toMatchObject({ skillId: "observed-hutao-skill-c0", scopeCoverage: "complete-cast" });
  expect(frames(hutao.document)).toEqual([273, 513, 753]);
  expect(hutao.document.hits.map(hit => hit.kind === "ordinary" ? hit.observedEntityEvent?.paramitaActiveAtSnapshot : undefined)).toEqual([true, true, false]);
  // CA at 33f applies the mark; CA at 303f refreshes its expiry to 873f without resetting 240f ticks.
  // E adds min(30000 × 3.841%, 4 × 1000) ATK only before the 554f stance end; A4 adds 33% at 35% HP.
  const activeBlossom = (1000 + 1152.3) * 0.64 * 1.33 * 0.5 * 0.9;
  const expiredBlossom = 1000 * 0.64 * 1.33 * 0.5 * 0.9;
  const hutaoDamage = 2 * activeBlossom + expiredBlossom;
  expectDamage(hutao.result, 3, hutaoDamage, hutaoDamage * 1.5);
  expect(hutao.document.hits.every(hit => hit.kind === "ordinary" && hit.observedEntityEvent?.templateRole === "blossom")).toBe(true);
  expect(hutao.result.hits.every(hit => hit.trace.some(node => node.id === "observed-entity.damageFrame"))).toBe(true);

  // Convert once through the real equipment UI, retaining both active and expired E snapshot states.
  await page.locator('[data-equipment="weapon"]').selectOption("weapon:13101");
  await page.locator('[data-equipment="ascension"]').selectOption("6");
  await page.locator('[data-equipment="level"]').fill("90");
  await page.locator('[data-equipment="weaponEffectsEnabled"]').uncheck();
  await page.locator('[data-equipment="effectsDisabled"]').check();
  await page.locator("[data-equipment-apply]").click();
  const equippedPanel = await audit(page);
  const equippedHP = equippedPanel.result.trace.find(node => node.id === "build.finalHp")!.result!.value;
  const equippedBaseATK = equippedPanel.result.trace.find(node => node.id === "build.baseAtk")!.result!.value;
  for (const [field, value] of Object.entries({ "hutao.skillStartCurrentHP": equippedHP * 0.5, "hutao.skillStartMaxHP": equippedHP,
    "hutao.skillStartBaseATK": equippedBaseATK, "sharedState.actualHPRatioAtSnapshot": 0.35,
    "sharedState.includedAttackBonus": 0, "sharedState.includedDamageBonus": 0 })) await setNumber(page, field, value);
  const equipment = await audit(page);
  expect(equipment.document.build.mode).toBe("equipment-derived");
  expect(equipment.result.status).toBe("calculated");
  await page.locator("#calc-build-mode").selectOption("manual-final");
  const converted = await audit(page);
  expect(converted.document.build.mode).toBe("manual-final");
  expect(converted.result.status).toBe("calculated");
  expect(converted.result.totals).toEqual(equipment.result.totals);
  expect(Object.keys(converted.document.gameContext!.observedEntityCast!.finalizedHitEvents!)).toHaveLength(3);
  const downloading = page.waitForEvent("download");
  await page.locator('[data-action="export"]').click();
  const saved = JSON.parse(await readFile((await (await downloading).path())!, "utf8")) as CalculatorDocument;
  await page.locator("#calc-import").setInputFiles({ name: "observed-contact-final.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(saved)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  const restored = await audit(page);
  expect(restored.document.gameContext!.observedEntityCast).toEqual(converted.document.gameContext!.observedEntityCast);
  expect(restored.document.hits).toEqual(converted.document.hits);
  expect(restored.document.selectedHitIds).toEqual(converted.document.selectedHitIds);
  expect(restored.result.totals).toEqual(converted.result.totals);
  expect(restored.result.hits.map(hit => hit.trace)).toEqual(converted.result.hits.map(hit => hit.trace));

  const last = restored.result.hits.at(-1)!;
  await page.locator("#calc-scope").selectOption("single-hit");
  await page.locator(`[data-hit-id="${last.id}"]`).check();
  const lifetime = page.locator('[data-source-cast-controls="observed-entity"] > details').first();
  await lifetime.locator(":scope > summary").click();
  await setState(page, "fullObservedLifetime", "unknown");
  await lifetime.locator(":scope > summary").click();
  await page.locator('[data-observed-provided="hutao.chargedAttacks"]').selectOption("unknown");
  await page.locator('[data-action="observed-entity-apply"]').click();
  const independent = await audit(page);
  expect(independent.document.gameContext!.observedEntityCast!.hutao!.chargedAttacks).toBeUndefined();
  expect(independent.result.status).toBe("calculated");
  expect(independent.result.includedHitIds).toEqual([last.id]);
  expect(independent.result.totals!.expected).toBeCloseTo(last.expected!, 9);
  console.info("Observed contact and mark browser measurements", JSON.stringify({ kaeya: kaeya.result.totals,
    aloy: aloy.result.totals, hutao: hutao.result.totals, equipment: equipment.result.totals,
    restoredFinal: restored.result.totals, independentPastHit: independent.result.totals }));
});
