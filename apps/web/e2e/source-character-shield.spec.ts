import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  calculateSourceHostCharacterShieldEditable, captureSourceHostCharacterShield,
  createSourceHostCharacterShieldEditable, replaySourceHostCharacterShield,
  type SourceHostCharacterShieldCapture,
} from "../../../packages/sim-core/src/source-host-character-shield-capture";
import { resolveSourceHostCharacterShieldInput } from "../../../packages/sim-core/src/source-host-character-shield-formula";
import { captureSourceHostPlayerIncoming, replaySourceHostPlayerIncoming } from "../../../packages/sim-core/src/source-host-incoming-capture";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT,
  type SourceHostCalculationRecord, type SourceHostCharacterShieldRequest, type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";

type ShieldRecord = SourceHostCalculationRecord & { request: SourceHostCharacterShieldRequest };
const laneFilter = process.env.GIDPS_CHARACTER_SHIELD_LANE;
if (laneFilter !== undefined && laneFilter !== "classic" && laneFilter !== "stellar")
  throw new Error(`GIDPS_CHARACTER_SHIELD_LANE must be classic or stellar: ${laneFilter}`);

const party = `thoma char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=100];
thoma add weapon="favoniuslance" refine=1 lvl=90/90;
noelle char lvl=90/90 cons=0 talent=1,1,1;
noelle add weapon="thebell" refine=1 lvl=90/90;
noelle add stats def=400 cr=0.2 cd=0.4;
lanyan char lvl=90/90 cons=2 talent=1,1,1;
lanyan add weapon="magicguide" refine=1 lvl=90/90;
lanyan add stats atk=300 cr=0.2 cd=0.4;
kaeya char lvl=90/90 cons=6 talent=1,1,1 +params=[start_energy=100];
kaeya add weapon="favoniussword" refine=1 lvl=90/90;
kaeya add stats hp=2000 cr=0.2 cd=0.4;`;

// The 60f hit follows Thoma's 9f skill shield assignment and precedes the
// first burst-collapse hit from his post-Q normal. C2 Lanyan restores only
// after her E shield exists and the active character's normal hits an enemy.
const stackConfig = `options iteration=1 duration=15;
${party}
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
hurt every interval=60,61 amount=300,300 element=physical;
active thoma;
thoma skill;
thoma burst;
thoma attack;
lanyan skill;
lanyan attack:2;
kaeya skill;
kaeya burst;
noelle skill;
wait(60);
pick_up_crystallize("any");
wait(180);`;

// One external HP drain with Kaeya active reaches his C4 low-HP gate; The
// Bell's native listener on Noelle runs from the same drain event. No shield
// is present before that hit, so it does not hide Kaeya's HP threshold.
const lowHpConfig = `options iteration=1 duration=5;
${party}
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
hurt once interval=60 amount=13000,13000 element=physical;
active kaeya;
wait(180);`;

const shieldRows = (result: SourceHostResult): ShieldRecord[] =>
  result.calculations.filter((row): row is ShieldRecord => row.request.kind === "character-shield");

test("native shield creation, refresh, consumption and standalone arithmetic replay across both source lanes", async ({ page }) => {
  test.setTimeout(360000);
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const measurements: Array<Record<string, unknown>> = [];
  let edited = false;

  for (const lane of (["classic", "stellar"] as const).filter(value => laneFilter === undefined || laneFilter === value)) {
    for (const scene of [{ key: "stack", config: stackConfig }, { key: "low-hp", config: lowHpConfig }] as const) {
      await page.goto("/source-simulation");
      await page.locator("#source-host-variant").selectOption(lane);
      await page.locator("#source-host-config").fill(scene.config);
      await page.locator("#source-host-seed").fill("20260928");
      await page.locator("#source-host-run").click();
      await expect(page.locator("#source-host-status")).toContainText(/本次运行完成|运行停止|执行器错误/, { timeout: 90000 });
      await expect(page.locator("#source-host-status")).toContainText("本次运行完成");
      const pending = page.waitForEvent("download");
      await page.locator("#source-host-export").click();
      const raw = await readFile((await (await pending).path())!, "utf8");
      // Always preserve the unmodified native result before any detailed gate assertion.
      const rawPath = scene.key === "stack"
        ? `docs/validation/source-character-shield-${lane}-20260928.result.json`
        : `docs/validation/source-character-shield-${lane}-low-hp-20260928.result.json`;
      await writeFile(resolve(rawPath), raw);
      const result = JSON.parse(raw) as SourceHostResult;
      expect(result.sourceCommit).toBe(lane === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT);
      expect(result.config).toBe(scene.config);
      expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
      const byId = new Map(result.calculations.map(row => [row.request.id, row]));
      const rows = shieldRows(result);
      const ofRule = (ruleId: string) => rows.filter(row => row.request.input.ruleId === ruleId);
      for (const row of rows) {
        expect(resolveSourceHostCharacterShieldInput(row.request.input, result.sourceCommit).value)
          .toBeCloseTo(row.value, 9);
        const replay = replaySourceHostCharacterShield(captureSourceHostCharacterShield(result, row.request.id));
        expect(replay.reproducedValue).toBeCloseTo(row.value, 9);
      }

      const measurement: Record<string, unknown> = {
        lane, scene: scene.key, sourceCommit: result.sourceCommit,
        wasmSha256: result.executionArtifact?.wasmSha256,
        applications: result.applications.length, playerApplications: result.playerApplications?.length ?? 0,
        calculations: result.calculations.length,
        observedRules: Object.fromEntries([...new Set(rows.map(row => row.request.input.ruleId))]
          .map(ruleId => [ruleId, ofRule(ruleId).length])), rawPath,
      };

      if (scene.key === "stack") {
        const skill = ofRule("char-shield-thoma-skill-base")[0];
        const burst = ofRule("char-shield-thoma-burst-base")[0];
        const maximum = ofRule("char-shield-thoma-max")[0];
        const stack = ofRule("char-shield-thoma-stack")[0];
        const noelle = ofRule("char-shield-noelle-skill")[0];
        const lanyan = ofRule("char-shield-lanyan-base")[0];
        const restoreFraction = ofRule("char-shield-lanyan-restore-fraction")[0];
        const restore = ofRule("char-shield-lanyan-restore")[0];
        for (const [name, row] of Object.entries({ skill, burst, maximum, stack, noelle, lanyan, restoreFraction, restore }))
          expect(row, `${lane}: native ${name} shield branch`).toBeDefined();
        const hit = result.playerApplications?.find(row => row.shieldAbsorbed > 0 && row.shieldCalculationIds?.length);
        expect(hit, `${lane}: real hit must consume the prior Thoma shield`).toBeDefined();
        const incoming = replaySourceHostPlayerIncoming(captureSourceHostPlayerIncoming(result, hit!.id));
        expect(incoming.difference).toBe(0);
        expect(incoming.stateArithmeticProvenance).toBe("shared");
        const consumption = hit!.shieldCalculationIds!.map(id => byId.get(id))
          .find(row => row?.request.kind === "player-shield" && row.request.input.output === "hpAfter" &&
            row.request.componentIds.includes(skill!.request.id));
        expect(consumption, `${lane}: the hit must read Thoma's original shield HP ID`).toBeDefined();
        expect(skill!.request.frame).toBeLessThan(hit!.frame);
        expect(hit!.frame).toBeLessThan(stack!.request.frame);
        expect(stack!.request.valueSources?.amount).toBe(burst!.request.id);
        expect(stack!.request.valueSources?.maximum).toBe(maximum!.request.id);
        const latestConsumedHP = byId.get(stack!.request.valueSources?.oldHP ?? -1);
        expect(latestConsumedHP?.request.kind).toBe("player-shield");
        expect(latestConsumedHP!.request.frame).toBeGreaterThanOrEqual(consumption!.request.frame);
        expect(stack!.request.input.state.oldHP).toBe(latestConsumedHP!.value);
        expect(stack!.request.componentIds).toEqual(expect.arrayContaining([
          burst!.request.id, maximum!.request.id, latestConsumedHP!.request.id]));
        const stackCapture = captureSourceHostCharacterShield(result, stack!.request.id);
        expect(stackCapture.dependencies.map(row => row.request.id)).toEqual(expect.arrayContaining([
          skill!.request.id, consumption!.request.id, burst!.request.id, maximum!.request.id]));
        expect(replaySourceHostCharacterShield(stackCapture).reproducedValue).toBeCloseTo(stack!.value, 9);
        const restoreRead = byId.get(restoreFraction!.request.valueSources?.amount ?? -1);
        expect(restoreRead?.request.kind === "character-shield" ? restoreRead.request.input.ruleId : undefined)
          .toBe("char-shield-lanyan-base");
        expect(restoreRead!.request.id).not.toBe(lanyan!.request.id);
        expect(restoreRead!.request.frame).toBe(restore!.request.frame);
        expect(restore!.request.valueSources?.maximum).not.toBe(restoreRead!.request.id);
        expect(restore!.request.valueSources?.amount).toBe(restoreFraction!.request.id);
        expect(restore!.request.valueSources?.maximum).toBeDefined();
        expect(restore!.request.valueSources?.oldHP).toBeDefined();
        expect(restore!.request.componentIds).toContain(restoreFraction!.request.id);
        const crystalBase = ofRule("char-shield-crystallize-base")[0];
        const crystalEM = ofRule("char-shield-crystallize-em")[0];
        const crystalBonus = ofRule("char-shield-crystallize-bonus-total")[0];
        expect(crystalBase, `${lane}: original reaction must create a shard with level HP`).toBeDefined();
        expect(crystalEM, `${lane}: shard must save its original EM snapshot`).toBeDefined();
        expect(crystalBonus, `${lane}: picked-up crystallize shield must process a real later hit`).toBeDefined();
        expect(crystalBonus!.request.valueSources?.emBonus).toBe(crystalEM!.request.id);
        const crystalConsumption = result.calculations.find(row => row.request.kind === "player-shield" &&
          row.request.bonusCalculationId === crystalBonus!.request.id);
        expect(crystalConsumption?.request.kind === "player-shield" ? crystalConsumption.request.hpBeforeCalculationId : undefined).toBe(crystalBase!.request.id);
        const crystalHit = result.playerApplications?.find(row => row.shieldCalculationIds?.includes(crystalConsumption!.request.id));
        expect(crystalHit).toBeDefined();
        expect(replaySourceHostPlayerIncoming(captureSourceHostPlayerIncoming(result, crystalHit!.id)).difference).toBe(0);
        measurement.crystallize = { baseId: crystalBase!.request.id, emId: crystalEM!.request.id,
          bonusId: crystalBonus!.request.id, consumedHpId: crystalConsumption!.request.id,
          hitId: crystalHit!.id, replayDifference: 0 };
        measurement.lineage = { skillId: skill!.request.id, hitId: hit!.id,
          consumedHpId: consumption!.request.id, absorbed: hit!.shieldAbsorbed,
          burstBaseId: burst!.request.id, maximumId: maximum!.request.id, stackId: stack!.request.id,
          noelleId: noelle!.request.id, lanyanBaseId: lanyan!.request.id,
          lanyanRestoreFractionId: restoreFraction!.request.id, lanyanRestoreId: restore!.request.id,
          incomingReplayDifference: incoming.difference, stackReplayDifference: 0 };

        if (!edited && lane === "classic") {
          const selectedIndex = rows.findIndex(row => row.request.id === noelle!.request.id);
          await page.locator("#source-host-character-shield-index").fill(String(selectedIndex));
          await expect(page.locator("#source-host-character-shield-hit")).toContainText("共享公式重放");
          await page.locator("#source-host-open-character-shield-calculator").click();
          await expect(page).toHaveURL(/\/calculator$/);
          const editor = page.locator("[data-source-host-character-shield-calculator]");
          const field = editor.locator('[data-source-host-character-shield-input="totalDef"]');
          const originalDef = Number(await field.inputValue());
          const editedDef = originalDef + 100;
          await field.fill(String(editedDef));
          await expect(editor.locator("[data-source-host-character-shield-result]")).toContainText("编辑后护盾 HP");
          const originalCapture = captureSourceHostCharacterShield(result, noelle!.request.id);
          const expectedEditable = createSourceHostCharacterShieldEditable(originalCapture);
          expectedEditable.input.state.totalDef = editedDef;
          const expected = calculateSourceHostCharacterShieldEditable(expectedEditable);
          expect(expected.editedValue).not.toBe(expected.originalValue);
          const pendingEditable = page.waitForEvent("download");
          await editor.locator("[data-source-host-character-shield-export]").click();
          const editableRaw = await readFile((await (await pendingEditable).path())!, "utf8");
          await writeFile(resolve("docs/validation/source-character-shield-calculator-20260928.result.json"), editableRaw);
          const document = JSON.parse(editableRaw) as { originalCapture: SourceHostCharacterShieldCapture;
            input: typeof expectedEditable.input };
          expect(document.originalCapture).toEqual(originalCapture);
          expect(document.input.state.totalDef).toBe(editedDef);
          expect(calculateSourceHostCharacterShieldEditable(document).editedValue).toBeCloseTo(expected.editedValue, 9);
          expect(replaySourceHostCharacterShield(document.originalCapture).reproducedValue).toBeCloseTo(noelle!.value, 9);
          await page.locator("#calc-source-host-close").click();
          await page.locator("#calc-import").setInputFiles({ name: "source-character-shield-calculator.json",
            mimeType: "application/json", buffer: Buffer.from(editableRaw) });
          const restored = page.locator("[data-source-host-character-shield-calculator]");
          await expect(restored.locator('[data-source-host-character-shield-input="totalDef"]'))
            .toHaveValue(String(editedDef));
          await expect(restored.locator("[data-source-host-character-shield-result]")).toContainText("编辑后护盾 HP");
          measurement.edit = { calculationId: noelle!.request.id, originalDef, editedDef,
            originalValue: expected.originalValue, editedValue: expected.editedValue,
            originalCaptureUnchanged: true };
          edited = true;
        }
      } else {
        const kaeya = ofRule("char-shield-kaeya-c4")[0];
        const bell = ofRule("char-shield-bell")[0];
        expect(kaeya, `${lane}: C6 Kaeya must cross the native C4 low-HP gate`).toBeDefined();
        expect(bell, `${lane}: Noelle's Bell must respond to the same external HP drain`).toBeDefined();
        const hit = result.playerApplications?.find(row => row.drainAttempted > 0);
        expect(hit, `${lane}: a real external HP drain must occur`).toBeDefined();
        expect(hit!.frame).toBeLessThanOrEqual(kaeya!.request.frame);
        expect(hit!.frame).toBeLessThanOrEqual(bell!.request.frame);
        expect(kaeya!.request.input.sourceHolderIndex).toBe(3);
        expect(bell!.request.input.sourceHolderIndex).toBe(1);
        expect(replaySourceHostCharacterShield(captureSourceHostCharacterShield(result, kaeya!.request.id))
          .reproducedValue).toBeCloseTo(kaeya!.value, 9);
        measurement.lineage = { drainHitId: hit!.id, drainAttempted: hit!.drainAttempted,
          kaeyaId: kaeya!.request.id, kaeyaHp: kaeya!.value,
          bellId: bell!.request.id, bellHp: bell!.value };
      }
      measurements.push(measurement);
    }
  }
  expect(pageErrors).toEqual([]);
  await writeFile(resolve(laneFilter === undefined
    ? "docs/validation/source-character-shield-measurements-20260928.result.json"
    : `docs/validation/source-character-shield-${laneFilter}-measurements-20260928.result.json`),
  `${JSON.stringify({ schemaVersion: "source-character-shield-validation-v1", laneFilter: laneFilter ?? "both",
    configs: { stack: stackConfig, lowHp: lowHpConfig }, measurements, pageErrors,
    scope: "Two short native four-character configurations per source lane; Crystallize generation, pickup and later consumption included; other shield rules remain unsampled." }, null, 2)}\n`);
  console.log(JSON.stringify({ runs: measurements, pageErrors }));
});
