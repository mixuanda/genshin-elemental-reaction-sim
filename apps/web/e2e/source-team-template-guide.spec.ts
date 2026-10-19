import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { SourceTeamDraft } from "../src/source-team-builder";

type TestMetadata = {
  packages: Array<{
    kind: string;
    resolved?: { configurationKey?: string };
    actionCapabilities?: { actions: Array<{ kind: string; status: string }> };
  }>;
};

test("source team template explains a controlled capability gap and preserves its origin after repair", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  let controlledMetadataRequests = 0;
  // Test-only metadata: the pinned source does implement Hu Tao's normal attack.
  // Mark only that method unsupported here to verify the guide and editable draft response.
  await page.route("**/source-host/inventory-metadata.json", async route => {
    const response = await route.fetch();
    const metadata = await response.json() as TestMetadata;
    const huTao = metadata.packages.find(item => item.kind === "character" && item.resolved?.configurationKey === "hutao");
    const normal = huTao?.actionCapabilities?.actions.find(action => action.kind === "attack");
    if (!normal || normal.status !== "implemented") throw new Error("Controlled Hu Tao action fixture no longer matches the pinned metadata");
    normal.status = "unsupported";
    controlledMetadataRequests++;
    await route.fulfill({ response, json: metadata });
  });

  await page.goto("/source-simulation");
  const builder = page.locator("#source-team-builder");
  await expect(builder.locator("[data-template]")).toBeVisible();
  expect(controlledMetadataRequests).toBeGreaterThan(0);
  await builder.locator("[data-template]").selectOption("vaporize-hydro-pyro");
  const preview = builder.locator("[data-template-preview]");
  await expect(preview).toContainText("水火蒸发入门");
  await expect(preview).toContainText("蒸发");
  await expect(preview).toContainText("用行秋和夜兰提供水元素后台伤害");
  await expect(preview).toContainText("站场输出");
  await expect(preview).toContainText("护盾与抗打断");
  await expect(preview.locator("ul").first().locator("li")).toHaveCount(4);
  const previewSteps = preview.locator(".source-team-builder__guide-actions > li");
  await expect(previewSteps).toHaveCount(7);
  await expect(previewSteps.last().locator('[data-action-capability="unsupported"]')).toBeVisible();
  await expect(previewSteps.last()).toContainText("胡桃 · A 普攻 ×3");
  await expect(builder.locator("[data-member-tab]")).toHaveCount(0);

  await preview.locator('[data-template-load="vaporize-hydro-pyro"]').click();
  await expect(builder.locator("[data-template-origin]")).toContainText("原始模板：水火蒸发入门");
  await expect(builder.locator("[data-member-tab]")).toHaveCount(4);
  await expect(builder.locator(".source-team-builder__actions > li")).toHaveCount(7);
  const check = builder.locator("[data-current-action-check]");
  await expect(check.locator('[data-current-action-row][data-action-capability="unsupported"]')).toHaveCount(1);
  await expect(check.locator("[data-current-action-row]").last()).toContainText("胡桃 · A 普攻 ×3");

  await builder.locator('[data-action-kind="6"]').selectOption("charge");
  await expect(check.locator('[data-current-action-row][data-action-capability="unsupported"]')).toHaveCount(0);
  await expect(check.locator("[data-current-action-row]").last()).toHaveAttribute("data-action-capability", "implemented");
  await expect(check.locator("[data-current-action-row]").last()).toContainText("胡桃 · CA 重击 ×3");
  await expect(builder.locator("[data-template-origin]")).toContainText("原始模板：水火蒸发入门");

  const pending = page.waitForEvent("download");
  await builder.locator("[data-export-draft]").click();
  const exported = await readFile((await (await pending).path())!, "utf8");
  const draft = JSON.parse(exported) as SourceTeamDraft;
  expect(draft.templateId).toBe("vaporize-hydro-pyro");
  expect(draft.actions).toHaveLength(7);
  expect(draft.actions[6]).toMatchObject({ actorId: "hutao", kind: "charge", repeat: 3 });
  expect(draft.source?.hostVariant).toBe("classic");

  await builder.locator('[data-action-delete="6"]').click();
  await expect(builder.locator(".source-team-builder__actions > li")).toHaveCount(6);
  await builder.locator("[data-import-draft]").setInputFiles({
    name: "repaired-vaporize-template.json", mimeType: "application/json", buffer: Buffer.from(exported),
  });
  await expect(builder.locator(".source-team-builder__actions > li")).toHaveCount(7);
  await expect(builder.locator("[data-template-origin]")).toContainText("原始模板：水火蒸发入门");
  await expect(builder.locator("[data-current-action-check] [data-current-action-row]").last()).toContainText("胡桃 · CA 重击 ×3");
  await expect(builder.locator("[data-current-action-check] [data-current-action-row]").last()).toHaveAttribute("data-action-capability", "implemented");
  const restoredDownload = page.waitForEvent("download");
  await builder.locator("[data-export-draft]").click();
  const restoredDraft = JSON.parse(await readFile((await (await restoredDownload).path())!, "utf8")) as SourceTeamDraft;
  expect(restoredDraft).toEqual(draft);
  await writeFile("docs/validation/source-team-template-guide-20260928.result.json", JSON.stringify({
    metadataOverride: { hostVariant: "classic", actor: "hutao", action: "attack", actualSourceStatus: "implemented", testStatus: "unsupported" },
    previewMemberCount: 4, previewStepCount: 7, editedAction: restoredDraft.actions[6], restoredDraft,
    sourceExecutorRun: false, pageErrors,
  }, null, 2) + "\n");
  expect(pageErrors).toEqual([]);
});
