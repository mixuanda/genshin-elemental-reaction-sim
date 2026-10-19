import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

async function selectAction(page: Page, character: string, archive: string, skillId: string, form?: string): Promise<void> {
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
  await page.locator("#calc-talent-level").fill("1");
  await page.locator("#calc-talent-level").press("Tab");
  await expect.poll(async () => (await audit(page)).document.gameContext?.effectiveTalentLevel).toBe(1);
  expect((await audit(page)).document.gameContext?.skillId).toBe(skillId);
}

async function manualPanel(page: Page): Promise<void> {
  await page.locator("#calc-build-mode").selectOption("manual-final");
  await page.locator("#calc-ascension").selectOption("6");
  for (const [field, value] of Object.entries({ atk: 2000, hp: 20000, def: 800, em: 200, critRate: 0.5, critDamage: 1 })) {
    await page.locator(`[data-field="build.stats.${field}"]`).fill(String(value));
  }
  await page.locator('[data-field="characterLevel"]').fill("90");
  await page.locator('[data-field="enemy.level"]').fill("90");
  await page.locator('[data-field="enemy.resistance"]').fill("0.1");
}

async function numbers(page: Page, prefix: string, values: Record<string, number>): Promise<void> {
  for (const [key, value] of Object.entries(values)) await page.locator(`[data-field="${prefix}.${key}"]`).fill(String(value));
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("an independent mixed-source special hit and an observed Noelle plunge use normal controls and retain their shared calculations", async ({ page }) => {
  await page.goto("/calculator");
  await selectAction(page, "character:10000120", "mixed-source-casts", "mixed-flins-burst-c0");
  await page.locator("#calc-scope").selectOption("single-hit");
  await manualPanel(page);
  const mixed = "gameContext.mixedSourceCast";
  await numbers(page, mixed, { moonsignLevel: 2, "sharedState.impactAtk": 1000, "sharedState.nonExtraAtk": 1000,
    "sharedState.includedFlinsA4Em": 0, "sharedState.otherSpecialBaseBonus": 0,
    "sharedState.otherReactionBonus": 0, "sharedState.specialAdditive": 0, "sharedState.elevationMultiplier": 1 });

  // Supply only this already occurred final strike; no full-cast contacts or future observations are entered.
  await page.locator("[data-mixed-source-independent-known]").selectOption("provided");
  const event = page.locator("[data-mixed-source-independent-row]");
  for (const [key, value] of Object.entries({ candidateId: "actual-final", frame: "164", snapshotFrame: "93", snapshotId: "actual-93", targetId: "enemy" })) {
    await event.locator(`[data-mixed-source-draft-key="${key}"]`).fill(value);
  }
  await event.locator('[data-mixed-source-draft-key="templateRole"]').selectOption("final");
  await expect(page.locator("[data-mixed-source-draft-status]")).toContainText("尚未应用");
  await expect(page.locator("#calc-results")).toContainText("请应用或放弃");
  await page.locator('[data-action="mixed-source-apply"]').click();
  const independent = await audit(page);
  expect(independent.document.gameContext!.mixedSourceCast!.fullObservedLifetime).toBeUndefined();
  expect(independent.document.gameContext!.mixedSourceCast!.targetContacts).toBeUndefined();
  expect(independent.result.status).toBe("calculated");
  expect(independent.result.includedHitIds).toEqual(["mixed-flins-burst-c0:actual-final"]);
  expect(independent.document.hits.find(hit => hit.id === independent.result.includedHitIds[0])?.kind).toBe("special");
  // Fixed Lv1 final coefficient 1.16928; A4 gives 1000 × 8% = 80 EM and Moon Sign 2 gives 20% A1.
  // Direct Lunar-Charged has its own ×3 scale and resistance, with no ordinary DEF multiplier.
  const specialBase = 3 * 2000 * 1.16928 * (1 + 6 * 280 / (280 + 2000) + 0.2) * 0.9;
  expect(independent.result.totals!.nonCritical).toBeCloseTo(specialBase * 1.07, 8);
  expect(independent.result.totals!.expected).toBeCloseTo(specialBase * 1.07 * 1.5, 8);
  expect(independent.result.hits[0]!.trace.find(node => node.id === "mixed-source.ownBaseBonus")!.result!.value).toBeCloseTo(0.07, 12);

  await numbers(page, mixed, { "sharedState.impactAtk": 1200 });
  const edited = await audit(page);
  expect(edited.result.totals!.expected).toBeCloseTo(specialBase * 1.084 * 1.5, 8);
  const sourceTrace = edited.result.hits[0]!.trace.find(node => node.id === "mixed-source.ownBaseBonus")!;
  expect(sourceTrace.result!.value).toBeCloseTo(0.084, 12);
  const explanation = page.locator('#calc-results [data-detail-id="mixed-source.ownBaseBonus"]');
  await explanation.locator(":scope > summary").click();
  await expect(explanation.locator(".trace-substitution")).toContainText(sourceTrace.substitution);

  // One equipment-to-final conversion covers the new special-hit panel path and its A4 accounting.
  await page.locator('[data-equipment="weapon"]').selectOption("weapon:13101");
  await page.locator('[data-equipment="ascension"]').selectOption("6");
  await page.locator('[data-equipment="level"]').fill("90");
  await page.locator('[data-equipment="weaponEffectsEnabled"]').uncheck();
  await page.locator('[data-equipment="effectsDisabled"]').check();
  await page.locator("[data-equipment-apply]").click();
  const newPanel = await audit(page);
  const actualAttack = newPanel.result.trace.find(node => node.id === "build.finalAtk")!.result!.value;
  await numbers(page, mixed, { "sharedState.impactAtk": actualAttack, "sharedState.nonExtraAtk": actualAttack,
    "sharedState.includedFlinsA4Em": 0 });
  const equipment = await audit(page);
  expect(equipment.document.build.mode).toBe("equipment-derived");
  expect(equipment.result.status).toBe("calculated");
  await page.locator("#calc-build-mode").selectOption("manual-final");
  const final = await audit(page);
  expect(final.document.build.mode).toBe("manual-final");
  expect(final.result.status).toBe("calculated");
  expect(final.result.totals!.expected).toBeCloseTo(equipment.result.totals!.expected, 9);
  const finalHit = final.document.hits.find(hit => hit.id === "mixed-flins-burst-c0:actual-final")!;
  expect(finalHit.kind === "special" && finalHit.finalSnapshot?.origin).toBe("equipment-conversion");
  const downloading = page.waitForEvent("download");
  await page.locator('[data-action="export"]').click();
  const saved = JSON.parse(await readFile((await (await downloading).path())!, "utf8")) as CalculatorDocument;
  await page.locator("#calc-import").setInputFiles({ name: "independent-mixed-source-final.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(saved)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  const restored = await audit(page);
  expect(restored.document.gameContext!.mixedSourceCast).toEqual(final.document.gameContext!.mixedSourceCast);
  expect(restored.document.hits).toEqual(final.document.hits);
  expect(restored.result.totals).toEqual(final.result.totals);
  expect(restored.result.hits[0]!.trace).toEqual(final.result.hits[0]!.trace);

  await selectAction(page, "character:10000034", "noelle-plunge-casts", "noelle-plunge-high-observed-c0", "noelle-burst-inactive");
  await manualPanel(page);
  await page.locator("#calc-scope").selectOption("single-hit");
  const plunge = "gameContext.noellePlungeCast";
  for (const key of ["burstInactive", "noExternalInfusion"]) await page.locator(`[data-source-cast-state-field="${plunge}.${key}"]`).selectOption("1");
  const collisionId = "noelle-plunge-high-observed-c0-collision";
  await page.locator(`[data-hit-id="${collisionId}"]`).check();
  const collision = await audit(page);
  expect(collision.document.gameContext!.noellePlungeCast!.fullObservedLifetime).toBeUndefined();
  expect(collision.result.status).toBe("calculated");
  expect(collision.result.includedHitIds).toEqual([collisionId]);
  expect(collision.result.totals!.expected).toBeCloseTo(2000 * 0.745878 * 0.5 * 0.9 * 1.5, 8);

  await page.locator("#calc-scope").selectOption("one-cast");
  expect((await audit(page)).result.status).toBe("blocked");
  await page.locator(`[data-source-cast-text-field="${plunge}.casterId"]`).fill("noelle");
  await page.locator(`[data-source-cast-text-field="${plunge}.targetId"]`).fill("enemy");
  for (const key of ["airborneXianyunConfirmed", "returnedToGroundConfirmed", "noHitlag", "noInterruption",
    "fullObservedLifetime", "statsStableAcrossHits", "collisionOccurred", "targetContacts.collision", "targetContacts.landing"]) {
    await page.locator(`[data-source-cast-state-field="${plunge}.${key}"]`).selectOption("1");
  }
  await numbers(page, plunge, { observedThroughFrame: 82 });
  const complete = await audit(page);
  expect(complete.document.gameContext!.scopeCoverage).toBe("complete-cast");
  expect(complete.result.status).toBe("calculated");
  expect(complete.result.hits).toHaveLength(2);
  expect(complete.document.hits.map(hit => hit.kind === "ordinary" ? hit.noellePlungeEvent?.frame : undefined)).toEqual([33, 42]);
  expect(complete.result.totals!.expected).toBeCloseTo(2000 * (0.745878 + 1.862889) * 0.5 * 0.9 * 1.5, 8);
  expect(complete.result.hits.map(hit => hit.trace.find(node => node.id === "noelle-plunge.snapshotFrame")!.result!.value)).toEqual([33, 42]);
  console.info("Remaining source calculator browser measurements", JSON.stringify({ independentSpecial: independent.result.totals,
    editedSpecial: edited.result.totals, restoredSpecialFinal: restored.result.totals,
    independentNoelleCollision: collision.result.totals, completeNoellePlunge: complete.result.totals }));
});
