import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

async function selectAction(page: Page, character: string, archive: string, skillId: string, level: number, form?: string): Promise<void> {
  await page.locator("#calc-character").selectOption(character);
  await expect(page.locator("#calc-skill")).toBeEnabled();
  if (form !== undefined) await page.locator("#calc-form").selectOption(form);
  const definitions = JSON.parse(await readFile(new URL(`../../../packages/game-data/sources/${archive}/definitions.json`, import.meta.url), "utf8")) as {
    templates: Array<{ skillId: string; label: string }>;
  };
  const label = definitions.templates.find(cast => cast.skillId === skillId)!.label;
  const option = await page.locator("#calc-skill option").filter({ hasText: label }).getAttribute("value");
  await page.locator("#calc-skill").selectOption(option!);
  await page.locator("#calc-constellation").selectOption("0");
  await page.locator("#calc-talent-level").fill(String(level));
  await page.locator("#calc-talent-level").press("Tab");
  await expect.poll(async () => (await audit(page)).document.gameContext?.effectiveTalentLevel).toBe(level);
  expect((await audit(page)).document.gameContext?.skillId).toBe(skillId);
}

async function numbers(page: Page, values: Record<string, number>): Promise<void> {
  for (const [field, value] of Object.entries(values)) {
    const input = page.locator(`[data-field="${field}"]`);
    await input.fill(String(value));
    await input.press("Tab");
  }
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("a level-14 Traveler cast keeps actual contacts and its historical snapshot while an independent Zibai hit remains editable and restorable", async ({ page }) => {
  await page.goto("/calculator");
  const travelerSkill = "traveler-cross-lumine-dendro-burst-c0";
  // Character IDs and weapon identity are from the supplied released catalog, not inferred from names.
  await selectAction(page, "character:10000007", "traveler-cross-source-casts", travelerSkill, 14, "lumine-dendro");
  await page.locator("#calc-scope").selectOption("one-cast");
  await page.locator("#calc-build-mode").selectOption("manual-final");
  await page.locator("#calc-ascension").selectOption("6");
  await numbers(page, { "build.stats.atk": 2000, "build.stats.hp": 20000, "build.stats.def": 800,
    "build.stats.em": 300, "build.stats.critRate": 0.5, "build.stats.critDamage": 1,
    characterLevel: 90, "enemy.level": 90, "enemy.resistance": 0.1 });
  const cross = "gameContext.travelerCrossEntityCast";
  for (const [key, value] of Object.entries({ casterId: "lumine", targetId: "enemy" })) {
    const input = page.locator(`[data-source-cast-text-field="${cross}.${key}"]`);
    await input.fill(value);
    await input.press("Tab");
  }
  for (const key of ["trueMoonStoryBuffInactive", "freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement",
    "fullObservedLifetime", "dendro.noTransformation", "dendro.noGadgetRemoval", "sharedState.actualEmIncludesLotuslight"]) {
    await page.locator(`[data-source-cast-state-field="${cross}.${key}"]`).selectOption("1");
  }
  await page.locator(`[data-source-cast-state-field="${cross}.statsStableAcrossHits"]`).selectOption("0");
  await numbers(page, { [`${cross}.observedThroughFrame`]: 816, [`${cross}.sharedState.actualEm`]: 200,
    [`${cross}.sharedState.includedA4DamageBonus`]: 0.05 });
  for (const candidate of [1, 3, 4, 5, 6, 7, 8]) {
    await page.locator(`[data-source-cast-state-field="${cross}.targetContacts.tick-${candidate}"]`).selectOption(candidate === 1 ? "1" : "0");
  }

  // This declared fixture is a historical 54f panel, intentionally different from the current panel and impact EM.
  const snapshotSummary = page.locator("[data-traveler-cross-entity-editor] > details > summary");
  await snapshotSummary.click();
  await page.locator('[data-action="traveler-cross-entity-add-snapshot"]').click();
  await snapshotSummary.click();
  const snapshot = page.locator('[data-traveler-cross-entity-snapshot-row="0"]');
  for (const [key, value] of Object.entries({ id: "snapshot-54", "stats.atk": 1000, "stats.hp": 20000,
    "stats.def": 800, "stats.em": 100, "stats.critRate": 0.5, "stats.critDamage": 1,
    characterLevel: 90, ascension: 6, damageBonus: 0.1, additiveBaseDamage: 0, reactionBonus: 0,
    source: "浏览器合成记录：第 54 帧历史面板，非游戏实测", sourceRefs: "synthetic:browser-traveler-snapshot-54" })) {
    await snapshot.locator(`[data-traveler-cross-entity-draft-key="${key}"]`).fill(String(value));
  }
  await expect(page.locator("[data-traveler-cross-entity-draft-status]")).toContainText("尚未应用");
  await page.locator('[data-action="traveler-cross-entity-apply"]').click();
  const unknownContact = await audit(page);
  expect(unknownContact.result.status).toBe("blocked");
  expect(unknownContact.document.gameContext!.travelerCrossEntityCast!.targetContacts?.["tick-2"]).toBeUndefined();
  await page.locator(`[data-source-cast-state-field="${cross}.targetContacts.tick-2"]`).selectOption("0");
  const complete = await audit(page);
  expect(complete.result.status).toBe("calculated");
  expect(complete.document.gameContext!.scopeCoverage).toBe("complete-cast");
  expect(complete.result.includedHitIds).toEqual([`${travelerSkill}:tick-1`]);
  const travelerHit = complete.document.hits.find(hit => hit.id === `${travelerSkill}:tick-1`)!;
  expect(travelerHit.kind === "ordinary" && travelerHit.travelerCrossEntityEvent).toMatchObject({ frame: 91, snapshotFrame: 54, snapshotId: "snapshot-54" });
  expect(travelerHit.kind === "ordinary" && travelerHit.finalSnapshot?.stats).toMatchObject({ atk: 1000, em: 100 });
  // Fixed independent Optimizer Lv14 coefficient is 1.8036; the conflicting historical 1.80036 is not the authority.
  // A4 reads impact EM 200, subtracts the already included .05, and adds .15 to the historical .10 bonus.
  const travelerExpected = 1000 * 1.8036 * (1 + 0.1 + 200 * 0.001 - 0.05) * 0.5 * 0.9 * 1.5;
  expect(complete.result.totals!.expected).toBeCloseTo(travelerExpected, 9);
  expect(complete.result.hits[0]!.trace.find(node => node.id === "customDamageBonus")!.result!.value).toBeCloseTo(0.15, 12);
  expect(complete.result.hits[0]!.trace.find(node => node.id === "traveler-cross-entity:snapshotFrame")!.result!.value).toBe(54);

  await selectAction(page, "character:10000126", "zibai-finite-casts", "zibai-finite-burst-c0", 1);
  await page.locator("#calc-scope").selectOption("single-hit");
  await page.locator("#calc-build-mode").selectOption("manual-final");
  await page.locator("#calc-ascension").selectOption("6");
  await numbers(page, { "build.stats.atk": 2000, "build.stats.hp": 20000, "build.stats.def": 1000,
    "build.stats.em": 0, "build.stats.critRate": 0, "build.stats.critDamage": 1,
    characterLevel: 90, "enemy.level": 90, "enemy.resistance": 0 });
  const zibai = "gameContext.zibaiFiniteCast";
  await numbers(page, { [`${zibai}.sharedState.otherGeoTeammates`]: 0, [`${zibai}.sharedState.hydroTeammates`]: 0,
    [`${zibai}.sharedState.includedA4DefensePercent`]: 0, [`${zibai}.sharedState.includedA4ElementalMastery`]: 0,
    [`${zibai}.sharedState.specialBaseBonus`]: 0, [`${zibai}.sharedState.includedIntrinsicBaseBonus`]: 0,
    [`${zibai}.sharedState.reactionBonus`]: 0, [`${zibai}.sharedState.specialAdditive`]: 0,
    [`${zibai}.sharedState.elevationMultiplier`]: 1 });
  await page.locator("[data-zibai-finite-independent-known]").selectOption("provided");
  const event = page.locator("[data-zibai-finite-independent-row]");
  await event.locator('[data-zibai-finite-draft-key="templateRole"]').selectOption("lunar");
  // Times are explicit synthetic observations; this source does not certify Q animation frames.
  for (const [key, value] of Object.entries({ candidateId: "observed-q-lunar", frame: 90, snapshotFrame: 60,
    snapshotId: "observed-q-snapshot", targetId: "enemy" })) {
    await event.locator(`[data-zibai-finite-draft-key="${key}"]`).fill(String(value));
  }
  await expect(page.locator("[data-zibai-finite-draft-status]")).toContainText("尚未应用");
  await page.locator('[data-action="zibai-finite-apply"]').click();
  const independent = await audit(page);
  expect(independent.document.gameContext!.zibaiFiniteCast!.fullObservedLifetime).toBeUndefined();
  expect(independent.document.gameContext!.zibaiFiniteCast!.observations).toBeUndefined();
  expect(independent.document.gameContext!.zibaiFiniteCast!.targetContacts).toBeUndefined();
  expect(independent.result.status).toBe("calculated");
  expect(independent.result.includedHitIds).toEqual(["zibai-finite-burst-c0:observed-q-lunar"]);
  // Q Lv1 Lunar coefficient 1.77744, direct Lunar-Crystallize ×1.6, intrinsic 1000/100×.007=.07.
  // Zero declared teammates add no A4 stats. Q has no Spirit Steed A1 and no ordinary DEF multiplier.
  const lunarBase = 1.6 * 1000 * 1.77744;
  expect(independent.result.totals!.expected).toBeCloseTo(lunarBase * 1.07, 8);
  expect(independent.result.hits[0]!.trace.find(node => node.id === "zibai.intrinsicBaseBonus")!.result!.value).toBeCloseTo(0.07, 12);
  expect(independent.result.hits[0]!.trace.find(node => node.id === "zibai.a1Additive")!.result!.value).toBe(0);
  await numbers(page, { [`${zibai}.sharedState.specialBaseBonus`]: 0.1 });
  const edited = await audit(page);
  expect(edited.result.totals!.expected).toBeCloseTo(lunarBase * 1.17, 8);
  const baseBonusTrace = edited.result.hits[0]!.trace.find(node => node.id === "zibai.baseBonusTotal")!;
  expect(baseBonusTrace.result!.value).toBeCloseTo(0.17, 12);
  const explanation = page.locator('#calc-results [data-detail-id="zibai.baseBonusTotal"]');
  await explanation.locator(":scope > summary").click();
  await expect(explanation.locator(".trace-substitution")).toContainText(baseBonusTrace.substitution);

  await page.locator('[data-equipment="weapon"]').selectOption("weapon:11101");
  await page.locator('[data-equipment="ascension"]').selectOption("6");
  await page.locator('[data-equipment="level"]').fill("90");
  await page.locator('[data-equipment="weaponEffectsEnabled"]').uncheck();
  await page.locator('[data-equipment="effectsDisabled"]').check();
  await page.locator("[data-equipment-apply]").click();
  const equipment = await audit(page);
  expect(equipment.document.build.mode).toBe("equipment-derived");
  expect(equipment.result.status).toBe("calculated");
  await page.locator("#calc-build-mode").selectOption("manual-final");
  const final = await audit(page);
  expect(final.document.build.mode).toBe("manual-final");
  expect(final.result.status).toBe("calculated");
  expect(final.result.totals!.expected).toBeCloseTo(equipment.result.totals!.expected, 9);
  const finalHit = final.document.hits.find(hit => hit.id === "zibai-finite-burst-c0:observed-q-lunar")!;
  expect(finalHit.kind === "special" && finalHit.finalSnapshot?.origin).toBe("equipment-conversion");
  const downloading = page.waitForEvent("download");
  await page.locator('[data-action="export"]').click();
  const saved = JSON.parse(await readFile((await (await downloading).path())!, "utf8")) as CalculatorDocument;
  await page.locator("#calc-import").setInputFiles({ name: "zibai-independent-final.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(saved)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  const restored = await audit(page);
  expect(restored.document.gameContext!.zibaiFiniteCast).toEqual(final.document.gameContext!.zibaiFiniteCast);
  expect(restored.document.hits).toEqual(final.document.hits);
  expect(restored.result.totals).toEqual(final.result.totals);
  expect(restored.result.hits[0]!.trace).toEqual(final.result.hits[0]!.trace);
  console.info("Traveler and Zibai calculator browser measurements", JSON.stringify({ travelerLv14Expected: travelerExpected,
    traveler: complete.result.totals, independentLunar: independent.result.totals, editedLunar: edited.result.totals,
    restoredEquipmentFinal: restored.result.totals }));
});
