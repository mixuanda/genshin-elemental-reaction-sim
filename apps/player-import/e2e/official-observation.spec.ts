import { expect, test } from "@playwright/test";

test("official observation file previews known equipment and displayed talents while preserving prior complete data", async ({ page }) => {
  const external: string[] = [];
  page.on("request", request => { if (new URL(request.url()).origin !== "http://127.0.0.1:5184") external.push(new URL(request.url()).origin); });
  await page.route("https://**", route => route.abort());
  await page.goto("/");
  await page.locator("#good-demo").click(); await page.locator("#apply").click();
  const prior = await page.locator("#current").textContent();
  const payload = { syntheticFixture: true, observations: { format: "gidps-official-ui-observation/1", provider: "miyoushe", evidence: "synthetic-test", role: { uid: "123456789", server: "cn_gf01" }, rosterIds: [10000002], characters: [{ id: 10000002, level: 95, constellation: 6,
    weapon: { id: 11301, level: 20, ascension: 0, refinement: 1 },
    relics: [{ id: 71544, posName: "生之花", rarity: 5, level: 0, main: { property_type: 1, name: "生命值", value: "717" }, substats: [{ property_type: 2, name: "暴击率", value: "10.5%" }] }],
    skills: [{ id: 10024, displayedLevel: 10, unlocked: true }, { id: 10018, displayedLevel: 13, unlocked: true }, { id: 10019, displayedLevel: 13, unlocked: true }] }] } };
  await page.locator("#file-input").setInputFiles({ name: "synthetic-official-observation.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(payload)) });
  await expect(page.locator("#preview-content")).toContainText("official-ui-observation");
  await expect(page.locator("#preview-content")).toContainText("等级 95");
  await expect(page.locator("#preview-content")).toContainText("hp：717");
  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "skill", exact: true }) });
  await expect(row.getByRole("cell")).toHaveText(["skill", /^missing：.*不按命座反推基础$/, /^missing：.*不按命座加算$/, "13"]);
  await expect(page.locator("#normalized")).toContainText("0.105");
  await expect(page.locator("#apply")).toBeDisabled();
  await expect(page.locator("#current")).toHaveText(prior!);
  payload.observations.rosterIds.push(10000042);
  await page.locator("#json-input").fill(JSON.stringify(payload)); await page.locator("#preview").click();
  await expect(page.locator("#status")).toContainText("覆盖不一致");
  await expect(page.locator("#current")).toHaveText(prior!);
  expect(external).toEqual([]);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
});
