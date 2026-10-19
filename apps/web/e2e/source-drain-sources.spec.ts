import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  calculateSourceHostDrainEditable, captureSourceHostDrain,
  createSourceHostDrainEditable, replaySourceHostDrain,
  type SourceHostDrainCapture, type SourceHostDrainEditable,
} from "../../../packages/sim-core/src/source-host-drain-capture";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT, type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";

const laneFilter = process.env.GIDPS_DRAIN_SOURCE_LANE;
if (laneFilter !== undefined && laneFilter !== "classic" && laneFilter !== "stellar")
  throw new Error(`GIDPS_DRAIN_SOURCE_LANE must be classic or stellar: ${laneFilter}`);

// The saved healing-source result measured Kuki's unmodified MaxHP as
// 15237.931506964002. The native hurt at 60f is inspected in the receipt;
// only an actual post-hit 20% threshold branch qualifies as coverage.
const ordinary = `options iteration=1 duration=18;
kuki char lvl=90/90 cons=0 talent=1,1,1;
kuki add weapon="favoniussword" refine=1 lvl=90/90;
kuki add stats hp=4000 em=200 cr=0.2 cd=0.4;
hutao char lvl=90/90 cons=0 talent=1,1,1;
hutao add weapon="favoniuslance" refine=1 lvl=90/90;
hutao add stats hp=3000 cr=0.2 cd=0.4;
lynette char lvl=90/90 cons=0 talent=1,1,1;
lynette add weapon="favoniussword" refine=1 lvl=90/90;
lynette add stats atk=200 cr=0.2 cd=0.4;
xiao char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
xiao add weapon="favoniuslance" refine=1 lvl=90/90;
xiao add stats atk=200 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
hurt once interval=60 amount=14500,14500 element=physical;
active kuki;
wait(65);
kuki skill;
hutao skill;
lynette skill;
xiao burst;
wait(600);`;

// The shield must precede the external hurt. Some post-shield damage reaches
// Dehya's field, then her queued Redmane tick occurs while Noelle is active.
const dehya = `options iteration=1 duration=8;
dehya char lvl=90/90 cons=0 talent=1,1,1;
dehya add weapon="favoniusgreatsword" refine=1 lvl=90/90;
dehya add stats hp=4000 cr=0.2 cd=0.4;
noelle char lvl=90/90 cons=0 talent=1,1,1;
noelle add weapon="favoniusgreatsword" refine=1 lvl=90/90;
noelle add stats def=500 cr=0.2 cd=0.4;
barbara char lvl=90/90 cons=0 talent=1,1,1;
barbara add weapon="magicguide" refine=1 lvl=90/90;
lisa char lvl=90/90 cons=0 talent=1,1,1;
lisa add weapon="magicguide" refine=1 lvl=90/90;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
hurt once interval=120 amount=6500,6500 element=physical;
active dehya;
dehya skill;
noelle skill;
wait(360);`;

// This already-observed Hydro/Dendro rotation generated native Bountiful
// Core player self-hits in both pinned lanes. Keep its real buildup and time.
const nilou = `options iteration=1 duration=18;
nilou char lvl=90/90 cons=0 talent=1,1,1;
nilou add weapon="favoniussword" refine=1 lvl=90/90;
nilou add stats hp=30000 cr=0.2 cd=0.4;
furina char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
furina add weapon="favoniussword" refine=1 lvl=90/90;
barbara char lvl=90/90 cons=0 talent=1,1,1;
barbara add weapon="magicguide" refine=1 lvl=90/90;
baizhu char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
baizhu add weapon="magicguide" refine=1 lvl=90/90;
baizhu add stats hp=10000 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active nilou;
nilou skill;
nilou skill;
nilou skill;
nilou skill;
furina burst;
baizhu burst;
barbara attack;
wait(240);
barbara attack:3;
baizhu skill;
barbara attack:4;
wait(300);`;

const scenarios = (["classic", "stellar"] as const).flatMap(lane => [
  { lane, key: "ordinary" as const, config: ordinary },
  { lane, key: "dehya" as const, config: dehya },
  { lane, key: "nilou" as const, config: nilou },
]).filter(row => laneFilter === undefined || row.lane === laneFilter);

const rulesIn = (capture: SourceHostDrainCapture): string[] => capture.sources.flatMap(row =>
  row.request.kind === "character-drain" ? [row.request.input.ruleId] : []);

test("actual native Drain sources preserve causal state, special self-hits, and one editable HP-ratio calculation", async ({ page }) => {
  test.setTimeout(720000);
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const measurements: Array<Record<string, unknown>> = [];
  let editedOnce = false;

  for (const scenario of scenarios) {
    await page.goto("/source-simulation");
    await page.locator("#source-host-variant").selectOption(scenario.lane);
    await page.locator("#source-host-config").fill(scenario.config);
    await page.locator("#source-host-seed").fill("20260928");
    await page.locator("#source-host-run").click();
    await expect(page.locator("#source-host-status"))
      .toContainText(/本次运行完成|运行停止|执行器错误/, { timeout: 90000 });
    await expect(page.locator("#source-host-status")).toContainText("本次运行完成");
    const pending = page.waitForEvent("download");
    await page.locator("#source-host-export").click();
    const raw = await readFile((await (await pending).path())!, "utf8");
    const rawPath = `docs/validation/source-drain-sources-${scenario.lane}-${scenario.key}-20260928.result.json`;
    await writeFile(resolve(rawPath), raw); // Keep the untouched Go result even if a later gate fails.
    const result = JSON.parse(raw) as SourceHostResult;
    expect(result.sourceCommit).toBe(scenario.lane === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT);
    expect(result.config).toBe(scenario.config);
    expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
    const applications = result.drainApplications ?? [];
    const linked = applications.flatMap((application, index) => application.sourceCalculationId === null
      ? [] : [{ application, index, capture: captureSourceHostDrain(result, application.id) }]);
    expect(linked.length, `${scenario.lane}/${scenario.key}: native source-linked Drain applications`).toBeGreaterThan(0);
    const rules = new Map<string, number>();
    let maximumReplayDifference = 0;
    for (const row of linked) {
      const replay = replaySourceHostDrain(row.capture);
      expect(replay.difference).toBe(0);
      expect(replay.reproducedAmount).toBe(replay.originalAmount);
      expect(replay.reproducedRatio).toBe(replay.originalRatio);
      maximumReplayDifference = Math.max(maximumReplayDifference, Math.abs(replay.difference));
      for (const ruleId of rulesIn(row.capture)) rules.set(ruleId, (rules.get(ruleId) ?? 0) + 1);
    }
    const measurement: Record<string, unknown> = {
      lane: scenario.lane, scene: scenario.key, rawPath,
      sourceCommit: result.sourceCommit, wasmSha256: result.executionArtifact?.wasmSha256,
      drainApplications: applications.length, linkedApplications: linked.length,
      sourceCalculationIds: [...new Set(linked.flatMap(row => row.capture.sources.map(source => source.request.id)))].length,
      observedRules: Object.fromEntries(rules), maximumReplayDifference, pageErrors: [...pageErrors],
    };

    if (scenario.key === "ordinary") {
      const kuki = linked.find(row => rulesIn(row.capture).includes("drain-source-kuki-skill"));
      const hutao = linked.find(row => rulesIn(row.capture).includes("drain-source-hutao-skill"));
      const periodic = linked.find(row => rulesIn(row.capture).some(ruleId =>
        ruleId === "drain-source-lynette-skill" || ruleId === "drain-source-xiao-burst"));
      expect(kuki, `${scenario.lane}: actual Kuki E drain`).toBeDefined();
      expect(hutao, `${scenario.lane}: actual Hu Tao E drain`).toBeDefined();
      expect(periodic, `${scenario.lane}: actual queued periodic drain`).toBeDefined();
      const source = kuki?.capture.sources.find(row => row.request.kind === "character-drain"
        && row.request.input.ruleId === "drain-source-kuki-skill");
      expect(source?.request.kind).toBe("character-drain");
      if (source?.request.kind !== "character-drain") throw new Error("Kuki source calculation is missing");
      const { currentHp, maxHp } = source.request.input.state;
      if (currentHp === undefined || maxHp === undefined) throw new Error("Kuki source HP leaves are missing");
      expect(currentHp).toBeGreaterThan(0.2 * maxHp);
      expect((0.7 * currentHp) / maxHp, `${scenario.lane}: native Kuki E takes the threshold-cap branch`)
        .toBeLessThanOrEqual(0.2);
      expect(source.value).toBeCloseTo(currentHp - 0.2 * maxHp, 9);
      expect(kuki?.capture.application.amount).toBe(source.value);
      measurement.threshold = { sourceId: source.request.id, currentHp, maxHp, amount: source.value,
        resultingRatio: kuki?.capture.application.resultRatio };

      if (!editedOnce && scenario.lane === "classic") {
        expect(hutao).toBeDefined();
        if (!hutao) throw new Error("Hu Tao source-linked drain is missing");
        const sourceId = hutao.application.sourceCalculationId;
        expect(sourceId).not.toBeNull();
        const editable = createSourceHostDrainEditable(hutao.capture);
        const original = editable.sourceInputs.find(row => row.id === sourceId);
        expect(original?.ruleId).toBe("drain-source-hutao-skill");
        if (!original) throw new Error("Hu Tao editable source input is missing");
        const before = original.state.currentHp;
        if (before === undefined) throw new Error("Hu Tao current HP leaf is missing");
        const after = before + 100;
        const expected = calculateSourceHostDrainEditable({ ...editable,
          sourceInputs: editable.sourceInputs.map(row => row.id === sourceId
            ? { ...row, state: { ...row.state, currentHp: after } } : row) });
        expect(expected.editedAmount).toBeCloseTo(expected.originalAmount + 30, 9);
        expect(expected.editedRatio).toBeCloseTo(Math.max(0, Math.min(1,
          (hutao.application.hpBefore - expected.editedAmount) / hutao.application.maxHp)), 12);
        expect(expected.editedRatio).not.toBe(expected.originalRatio);
        await page.locator("#source-host-drain-index").fill(String(hutao.index));
        await expect(page.locator("#source-host-drain-hit")).toContainText("Paramita Papilio");
        await page.locator("#source-host-open-drain-calculator").click();
        await expect(page).toHaveURL(/\/calculator$/);
        const editor = page.locator("[data-source-host-drain-calculator]");
        const field = editor.locator(`[data-source-host-drain-source-id="${sourceId}"][data-source-host-drain-source-key="currentHp"]`);
        await expect(field).toHaveValue(String(before));
        await field.fill(String(after));
        await expect(editor.locator("[data-source-host-drain-result]")).toContainText("编辑后扣血请求");
        const editedText = (await editor.locator("[data-source-host-drain-result]").textContent()) ?? "";
        const pendingEditable = page.waitForEvent("download");
        await editor.locator("[data-source-host-drain-export]").click();
        const editableRaw = await readFile((await (await pendingEditable).path())!, "utf8");
        const editablePath = "docs/validation/source-drain-sources-calculator-20260928.result.json";
        await writeFile(resolve(editablePath), editableRaw);
        const saved = JSON.parse(editableRaw) as SourceHostDrainEditable;
        expect(saved.originalCapture).toEqual(hutao.capture);
        expect(saved.sourceInputs.find(row => row.id === sourceId)?.state.currentHp).toBe(after);
        const restored = calculateSourceHostDrainEditable(saved);
        expect(restored.editedAmount).toBe(expected.editedAmount);
        expect(restored.editedRatio).toBe(expected.editedRatio);
        await editor.locator("[data-source-host-drain-import]").setInputFiles({ name: "source-drain-edit.json",
          mimeType: "application/json", buffer: Buffer.from(editableRaw) });
        await expect(page.locator(`[data-source-host-drain-source-id="${sourceId}"][data-source-host-drain-source-key="currentHp"]`))
          .toHaveValue(String(after));
        await expect(page.locator("[data-source-host-drain-result]")).toHaveText(editedText);
        measurement.edit = { applicationId: hutao.application.id, sourceId, originalCurrentHp: before,
          editedCurrentHp: after, originalAmount: expected.originalAmount, editedAmount: expected.editedAmount,
          originalRatio: expected.originalRatio, editedRatio: expected.editedRatio,
          difference: expected.difference, originalCaptureUnchanged: true, editablePath };
        editedOnce = true;
      }
    } else if (scenario.key === "dehya") {
      const mitigation = linked.find(row => rulesIn(row.capture).includes("drain-source-dehya-after-mitigation"));
      const selfHit = linked.find(row => row.application.ability === "Redmane's Blood" &&
        row.capture.sources.some(source => source.request.kind === "player-manual-incoming"));
      expect(mitigation, `${scenario.lane}: shielded external hit must leave damage for Dehya's field`).toBeDefined();
      expect(selfHit, `${scenario.lane}: queued Redmane tick must create a real manual player hit`).toBeDefined();
      expect(selfHit?.application.frame).toBeGreaterThan(mitigation!.application.frame);
      const externalHit = result.playerApplications?.find(row => row.attackId === mitigation!.application.attackId);
      expect(externalHit?.shieldAbsorbed).toBeGreaterThan(0);
      expect(externalHit?.damageAfterShield).toBeGreaterThan(0);
      expect(result.playerApplications?.some(row => row.attackId === selfHit!.application.attackId &&
        row.damagedActorIndex === selfHit!.application.actorIndex &&
        row.activeActorIndex !== row.damagedActorIndex)).toBe(true);
      measurement.special = { mitigationApplicationId: mitigation?.application.id,
        externalShieldAbsorbed: externalHit?.shieldAbsorbed, externalDamageAfterShield: externalHit?.damageAfterShield,
        selfHitApplicationId: selfHit?.application.id, selfHitFrame: selfHit?.application.frame,
        manualIncomingIds: selfHit?.capture.sources.filter(source => source.request.kind === "player-manual-incoming")
          .map(source => source.request.id) };
    } else {
      const selfHit = linked.find(row => row.application.ability.includes("bloom (self damage)") &&
        row.capture.sources.some(source => source.request.kind === "character-flat" &&
          source.request.input.ruleId === "char-flat-nilou-bountiful-self-hit"));
      expect(selfHit, `${scenario.lane}: an actual Bountiful Core player hit must carry its 2% source`).toBeDefined();
      measurement.special = { selfHitApplicationId: selfHit?.application.id,
        flatCalculationIds: selfHit?.capture.sources.filter(source => source.request.kind === "character-flat"
          && source.request.input.ruleId === "char-flat-nilou-bountiful-self-hit").map(source => source.request.id),
        playerHits: result.playerApplications?.filter(row => row.frame === selfHit?.application.frame).length ?? 0 };
    }
    measurements.push(measurement);
  }
  await writeFile(resolve(laneFilter === undefined
    ? "docs/validation/source-drain-sources-measurements-20260928.result.json"
    : `docs/validation/source-drain-sources-${laneFilter}-measurements-20260928.result.json`),
  `${JSON.stringify({ schemaVersion: "source-drain-sources-validation-v1", laneFilter: laneFilter ?? "both",
    configs: { ordinary, dehya, nilou }, measurements, pageErrors,
    scope: "Only real source-linked Drain applications; native threshold, mitigation, self-hit and shield gates are preserved." }, null, 2)}\n`);
  if (laneFilter === undefined || laneFilter === "classic") expect(editedOnce).toBe(true);
  expect(pageErrors).toEqual([]);
});
