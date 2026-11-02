import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";

for (const variant of ["classic", "stellar"] as const) for (const branch of ["white", "black"] as const) {
  test(`${variant} Durin C2 ${branch} E uses its independent talent rows`, async ({ page }, info) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/source-simulation");
    await page.getByText("机制版本与支持范围", { exact: true }).click();
    await page.locator("#source-host-variant").selectOption(variant);
    await page.getByText("高级：示例脚本与来源运行参数", { exact: true }).click();
    await page.getByText("高级：完整 GCSL 脚本（可选）", { exact: true }).click();
    const config = `# Synthetic C2/R1 input, not the player's team or artifact build.
options iteration=1 duration=3;
durin char lvl=90/90 cons=2 talent=10,10,10;
durin add weapon="athameartis" refine=1 lvl=90/90;
target lvl=90 resist=0.1 radius=2 pos=0,2;
active durin;
durin skill;
durin ${branch === "white" ? "skill" : "attack"};`;
    await page.locator("#source-host-config").fill(config);
    await page.locator("#source-host-seed").fill("1");
    await page.locator("#source-host-run").click();
    await expect(page.locator("#source-host-status")).toContainText(/本次运行完成|失败|执行器错误/, { timeout: 45_000 });
    await expect(page.locator("#source-host-status")).toContainText("本次运行完成");
    const pending = page.waitForEvent("download");
    await page.locator("#source-host-export").click();
    const result = JSON.parse(await readFile((await (await pending).path())!, "utf8")) as SourceHostResult;
    await writeFile(info.outputPath("durin-skill.capture.json"), JSON.stringify(result));
    const coefficients = branch === "white" ? [1.9008] : [1.30032, .9576, 1.16352];
    const requests = result.calculations.map(row => row.request).filter(row => row.kind === "damage");
    expect(requests).toHaveLength(coefficients.length);
    expect(result.applications).toHaveLength(coefficients.length);
    for (const [index, request] of requests.entries()) {
      if (request.kind !== "damage") throw new Error("Expected a damage receipt");
      expect(request.actorKey).toBe("durin");
      expect(request.input.scaling).toBe(coefficients[index]);
      expect(request.talentTableRead?.indices).toEqual(branch === "white" ? [9] : [index, 9]);
      expect(request.talentTableRead?.siteId).toBe(`internal/characters/durin/skill.go:${branch === "white" ? "85:15" : "121:13"}`);
      const hit = result.applications.find(row => row.calculationId === request.id)!;
      const attack = request.snapshot.baseAtk * (1 + request.snapshot.atkPct) + request.snapshot.flatAtk;
      expect(hit.rawDamage).toBeCloseTo(attack * coefficients[index]! * .5 * .9 * (hit.isCrit ? 1 + request.input.critDamage : 1), 8);
    }
    expect(errors).toEqual([]);
  });
}
