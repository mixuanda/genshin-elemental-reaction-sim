import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SourceTeamDraft } from "../src/source-team-builder";

const syntheticGood = {
  format: "GOOD", version: 3, source: "synthetic-imported-team-library-e2e; not a real account",
  characters: [
    { key: "KamisatoAyaka", level: 90, ascension: 6, constellation: 0,
      talent: { auto: 8, skill: 8, burst: 8 } },
    { key: "Kaeya", level: 90, ascension: 6, constellation: 0,
      talent: { auto: 8, skill: 8, burst: 8 } },
    { key: "Lisa", level: 90, ascension: 6, constellation: 0,
      talent: { auto: 8, skill: 8 } }, // Deliberately lacks Q talent: batch selection must be disabled.
  ],
  weapons: [
    { key: "CoolSteel", location: "KamisatoAyaka", level: 90, ascension: 6, refinement: 1 },
    { key: "CoolSteel", location: "Kaeya", level: 90, ascension: 6, refinement: 1 },
    { key: "MagicGuide", location: "Lisa", level: 90, ascension: 6, refinement: 1 },
  ],
  artifacts: [],
};

async function importGood(page: Page, value: unknown): Promise<void> {
  await page.locator("#build-import").setInputFiles({ name: "synthetic-team.good.json",
    mimeType: "application/json", buffer: Buffer.from(JSON.stringify(value)) });
  await expect(page.locator("[data-imported-roster] [data-roster-entry]")).toHaveCount(3);
  await expect(page.locator("[data-roster-status]")).toContainText("请选择 1–4 套完整配装");
}
async function exportDraft(page: Page): Promise<SourceTeamDraft> {
  const pending = page.waitForEvent("download");
  await page.locator("#source-team-builder [data-export-draft]").click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as SourceTeamDraft;
}
async function nameAndSave(page: Page, name: string): Promise<string> {
  const builder = page.locator("#source-team-builder");
  await builder.locator("[data-preset-name]").fill(name);
  await builder.locator("[data-preset-name]").press("Tab");
  await builder.locator("[data-preset-save-new]").click();
  await expect(builder.locator(".source-team-builder__status")).toContainText(`已另存新预设“${name}”`);
  const id = await builder.locator("[data-team-preset]").inputValue();
  expect(id).not.toBe("");
  return id;
}

test("synthetic GOOD batch becomes an isolated, persistent multi-preset source team", async ({ page }) => {
  test.setTimeout(150000);
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/builds");
  await importGood(page, syntheticGood);
  const roster = page.locator("[data-imported-roster]");
  await expect(roster.locator('[data-roster-check="0"]')).toBeEnabled();
  await expect(roster.locator('[data-roster-check="1"]')).toBeEnabled();
  await expect(roster.locator('[data-roster-check="2"]')).toBeDisabled();
  await expect(roster.locator('[data-roster-entry="2"]')).toContainText("基础天赋等级未完整取得");
  await roster.locator("[data-roster-source]").selectOption("classic");
  await roster.locator("[data-roster-mode]").selectOption("replace");
  await roster.locator('[data-roster-check="0"]').check();
  await roster.locator('[data-roster-check="1"]').check();
  await expect(roster.locator("[data-roster-status]")).toContainText("已选 2/4 位");
  await expect(roster.locator("[data-roster-submit]")).toBeEnabled();
  await roster.locator("[data-roster-submit]").click();
  await expect(page).toHaveURL(/\/source-simulation$/);
  await expect(page.locator("#source-host-variant")).toHaveValue("classic");
  const builder = page.locator("#source-team-builder");
  await expect(builder.locator("[data-member-tab]")).toHaveCount(2);
  await expect(builder.locator(".source-team-builder__actions > li")).toHaveCount(0);
  const replaced = await exportDraft(page);
  expect(replaced.source?.hostVariant).toBe("classic");
  expect(replaced.members.map(member => member.characterKey)).toEqual(["kamisatoayaka", "kaeya"]);
  expect(replaced.members.map(member => member.weapon.key)).toEqual(["coolsteel", "coolsteel"]);
  expect(replaced.actions).toEqual([]);

  await builder.locator('[data-member-tab="0"]').click();
  await builder.locator('[data-quick-action="skill"]').click();
  await builder.locator('[data-member-tab="1"]').click();
  await builder.locator('[data-quick-action="burst"]').click();
  await expect(builder.locator(".source-team-builder__actions > li")).toHaveCount(2);
  const presetAId = await nameAndSave(page, "合成来源队伍 A");
  const presetA = await exportDraft(page);
  expect(presetA.actions.map(action => [action.kind, action.actorId])).toEqual([
    ["skill", presetA.members[0]!.id], ["burst", presetA.members[1]!.id],
  ]);

  await builder.locator('[data-member-tab="0"]').click();
  await builder.locator('[data-quick-action="attack"]').click();
  await builder.locator('[data-draft-field="durationSeconds"]').fill("18");
  await builder.locator('[data-draft-field="durationSeconds"]').press("Tab");
  const presetBId = await nameAndSave(page, "合成来源队伍 B");
  const presetB = await exportDraft(page);
  expect(presetB.actions).toHaveLength(3);
  expect(presetB.durationSeconds).toBe(18);
  expect(presetBId).not.toBe(presetAId);

  // Choosing a saved name must leave the edited B draft unchanged until Load.
  await builder.locator("[data-team-preset]").selectOption(presetAId);
  await expect(builder.locator(".source-team-builder__status")).toContainText("当前队伍未载入或改动");
  expect(await exportDraft(page)).toEqual(presetB);
  await builder.locator("[data-preset-load]").click();
  await expect(builder.locator(".source-team-builder__actions > li")).toHaveCount(2);
  expect(await exportDraft(page)).toEqual(presetA);
  await builder.locator("[data-apply-script]").click();
  const generatedScript = await page.locator("#source-host-config").inputValue();
  expect(generatedScript).toContain("kamisatoayaka skill;");
  expect(generatedScript).toContain("kaeya burst;");
  expect(generatedScript).not.toContain("kamisatoayaka attack;");

  await page.reload();
  await expect(builder.locator("[data-team-preset]")).toBeVisible();
  await expect(builder.locator(`[data-team-preset] option[value="${presetAId}"]`)).toHaveCount(1);
  await expect(builder.locator(`[data-team-preset] option[value="${presetBId}"]`)).toHaveCount(1);
  await builder.locator("[data-team-preset]").selectOption(presetAId);
  await builder.locator("[data-preset-load]").click();
  expect(await exportDraft(page)).toEqual(presetA);

  await page.locator("#source-host-variant").selectOption("stellar");
  await expect(builder).toContainText("a7dc4bf");
  await expect(builder.locator(`[data-team-preset] option[value="${presetAId}"]`)).toHaveCount(0);
  await expect(builder.locator(`[data-team-preset] option[value="${presetBId}"]`)).toHaveCount(0);
  await page.locator("#source-host-variant").selectOption("classic");
  await expect(builder).toContainText("b4ae769");
  await expect(builder.locator(`[data-team-preset] option[value="${presetAId}"]`)).toHaveCount(1);
  await expect(builder.locator(`[data-team-preset] option[value="${presetBId}"]`)).toHaveCount(1);

  // Return through the build editor in the same SPA session. Merge replaces
  // Kaeya's weapon but retains both saved actions in the active draft.
  await page.locator('.product-nav a[href="/builds"]').click();
  const changedGood = { ...syntheticGood, weapons: syntheticGood.weapons.map(weapon =>
    weapon.location === "Kaeya" ? { ...weapon, key: "HarbingerOfDawn" } : weapon) };
  await importGood(page, changedGood);
  const nextRoster = page.locator("[data-imported-roster]");
  await nextRoster.locator("[data-roster-mode]").selectOption("merge");
  await nextRoster.locator('[data-roster-check="1"]').check();
  await nextRoster.locator("[data-roster-submit]").click();
  await expect(page).toHaveURL(/\/source-simulation$/);
  await expect(builder.locator("[data-member-tab]")).toHaveCount(2);
  const merged = await exportDraft(page);
  expect(merged.members.map(member => member.characterKey)).toEqual(presetA.members.map(member => member.characterKey));
  expect(merged.members[1]?.weapon.key).toBe("harbingerofdawn");
  expect(merged.actions).toEqual(presetA.actions);
  expect(merged.members[0]?.weapon.key).toBe(presetA.members[0]?.weapon.key);
  // The named preset is an independent snapshot; the merge has not overwritten A.
  await builder.locator("[data-team-preset]").selectOption(presetAId);
  await builder.locator("[data-preset-load]").click();
  expect(await exportDraft(page)).toEqual(presetA);

  expect(pageErrors).toEqual([]);
  const report = {
    schemaVersion: "imported-team-library-validation-v1",
    fixture: "synthetic GOOD v3 with two mapped sword weapons, explicitly empty artifact lists, and one missing Q talent; no account or damage execution",
    batch: { replacedMemberKeys: replaced.members.map(member => member.characterKey), disabledSourceKey: "Lisa",
      originalWeapons: replaced.members.map(member => member.weapon.key) },
    presets: { aId: presetAId, bId: presetBId, aActionKinds: presetA.actions.map(action => action.kind),
      bActionKinds: presetB.actions.map(action => action.kind), bDurationSeconds: presetB.durationSeconds,
      selectedWithoutLoadingPreservedB: true, exportedAndReloadedA: true, survivedRefresh: true,
      classicStellarIsolated: true },
    merge: { changedActor: "kaeya", newWeapon: merged.members[1]?.weapon.key,
      actionKindsPreserved: merged.actions.map(action => action.kind), namedPresetUnchanged: true },
    generatedScript, pageErrors,
  };
  await writeFile(resolve("docs/validation/imported-team-library-20260928.result.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
});
