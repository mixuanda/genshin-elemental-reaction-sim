import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import catalog from "../../../packages/game-data/src/generated/catalog-index.zh-CN.json";

const action = "finite-followup-faruzan-skill-hurricane-c0", prefix = "gameContext.finiteFollowupCast";
const audit = async (page: Page) => JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
async function chooseArrow(page: Page) {
  const option = page.locator("#calc-skill option").filter({ hasText: "一次飓烈箭与风压坍陷（C0）" });
  await expect(option).toHaveCount(1); await page.locator("#calc-skill").selectOption((await option.getAttribute("value"))!);
}
async function openAnswered(page: Page) {
  const panel = page.locator("[data-calculator-inline-conditions]");
  if (await panel.locator(":scope > summary").count() && await panel.getAttribute("open") === null) await panel.locator(":scope > summary").click();
}
async function answer(page: Page, normal?: number) {
  let data = await audit(page);
  const panel = page.locator("[data-calculator-inline-conditions]");
  for (const key of ["statsStableAcrossHits", "completeCastConfirmed", "noHitlag", "noReplacement", "noInterruption", "faruzanFreshNoPriorEffects"]) {
    await panel.locator(`select[data-source-cast-state-field="${prefix}.${key}"]`).selectOption("1");
  }
  const frame = panel.locator(`input[data-field="${prefix}.faruzanHurricaneStartFrame"]`);
  await frame.fill("35"); await frame.blur();
  if (normal !== undefined) await panel.locator(`select[data-source-cast-value-field="${prefix}.normalTalentLevel"]`).selectOption(String(normal));
  data = await audit(page);
  for (const hit of data.document.hits) for (const key of ["includedDamageBonus", "includedAdditiveBase", "includedResistanceReduction"]) {
    const input = panel.locator(`input[data-field="${prefix}.hitStates.${hit.id}.${key}"]`);
    await input.fill("0"); await input.blur();
  }
}

test("Faruzan C0 E offers local conditions, three independent damage rows and save/reopen without inventing future state", async ({ page }, testInfo) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/calculator"); await page.locator("#calc-character").selectOption("character:10000076");
  await page.locator("#calc-talent-level").fill("1"); await page.locator("#calc-talent-level").blur();
  await chooseArrow(page);
  expect((await audit(page)).result.status).toBe("blocked");
  await answer(page, 2);
  let data = await audit(page);
  expect(data.document.gameContext.skillId).toBe(action);
  expect(data.result.status).toBe("calculated");
  expect(data.result.hits.map((hit: any) => hit.nonCritical)).toEqual([1.488, 1.333, 1.08].map(coefficient => coefficient * 2000 * .5 * .9));
  expect(data.document.hits.map((hit: any) => hit.label)).toEqual([expect.stringContaining("14帧"), expect.stringContaining("94帧"), expect.stringContaining("127帧")]);
  await page.screenshot({ path: testInfo.outputPath("faruzan-three-hits.png"), fullPage: true });
  const before = data, download = page.waitForEvent("download"); await page.locator('[data-action="export"]').click();
  const text = await readFile((await (await download).path())!, "utf8"), file = testInfo.outputPath("faruzan-e.calculator.json");
  await writeFile(file, text); await page.reload(); await page.locator("#calc-import").setInputFiles(file);
  data = await audit(page); expect(data.document).toEqual(before.document); expect(data.result).toEqual(before.result);
  expect(await readFile(file, "utf8")).toBe(text);
  await openAnswered(page);
  const fresh = page.locator(`select[data-source-cast-state-field="${prefix}.faruzanFreshNoPriorEffects"]`);
  await fresh.selectOption("0"); data = await audit(page);
  expect(data.result.status).toBe("blocked"); expect(data.result.totals).toBeUndefined();
  await fresh.selectOption("1");
  await page.locator("#calc-scope").selectOption("single-hit");
  data = await audit(page); expect(data.result.status).toBe("calculated");
  expect(data.result.hits).toHaveLength(1); expect(data.result.totals.nonCritical).toBeCloseTo(1.488 * 2000 * .5 * .9, 8);
  expect(errors).toEqual([]);
});

for (const normalKnown of [true, false]) test(`Enka Faruzan keeps ${normalKnown ? "imported" : "manually completed"} normal5 independent from E10 when changing away and back`, async ({ page }, testInfo) => {
  const raw = JSON.parse(await readFile(new URL("./fixtures/player-import/kaeya-enka-panel.json", import.meta.url), "utf8"));
  const avatar = raw.avatarInfoList[0], mapping = catalog.enkaCharacterMappings.find(row => row.avatarId === 10000076)!;
  avatar.avatarId = 10000076; avatar.talentIdList = []; avatar.proudSkillExtraLevelMap = {};
  avatar.skillLevelMap = Object.fromEntries(mapping.skillOrder.flatMap((id, index) => !normalKnown && index === 0 ? [] : [[id, [5, 10, 7][index]]])); avatar.fightPropMap["44"] = .466;
  if (normalKnown) {
    await page.goto("/builds"); await page.locator("[data-player-fixture]").check();
    await page.locator("[data-player-file]").setInputFiles({ name: "synthetic-faruzan-panel.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(raw)) });
    await expect(page.locator("[data-player-panel]")).toBeEnabled(); await page.locator("[data-player-panel]").click();
  } else {
    // The calculator's existing showcase route allows a known primary E while
    // leaving the independent normal talent unknown. No account is requested.
    await page.route("**/api/showcase/900000003", route => route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ data: raw, cache: "hit", fetchedAt: "2026-10-23T00:00:00.000Z" }) }));
    await page.goto("/calculator"); await page.locator("[data-calculator-showcase] > summary").click();
    await page.locator("#calc-showcase-uid").fill("900000003"); await page.locator('[data-action="showcase"]').click();
    await page.locator('[data-showcase-index="0"]').click();
  }
  await chooseArrow(page);
  let data = await audit(page);
  expect(data.document.build.mode).toBe("imported-final"); expect(data.document.build.stats.atk).toBe(1700);
  expect(data.document.gameContext.effectiveTalentLevel).toBe(10);
  expect(data.document.gameContext.finiteFollowupCast.normalTalentLevel).toBe(normalKnown ? 5 : undefined);
  await answer(page, normalKnown ? undefined : 5);
  data = await audit(page); expect(data.result.status).toBe("calculated");
  // Fixed E10 coefficients, normal5 arrow, unchanged observed final anemo panel.
  const expected = (2.6784 + 1.643 + 1.944) * 1700 * 1.466 * .5 * .9;
  expect(data.result.totals.nonCritical).toBeCloseTo(expected, 8);
  await page.locator("#calc-skill").selectOption({ index: 0 }); await chooseArrow(page);
  data = await audit(page); expect(data.document.gameContext.finiteFollowupCast.normalTalentLevel).toBe(5);
  expect(data.result.totals.nonCritical).toBeCloseTo(expected, 8);
  await writeFile(testInfo.outputPath("faruzan-import-audit.json"), JSON.stringify(data, null, 2));
});
