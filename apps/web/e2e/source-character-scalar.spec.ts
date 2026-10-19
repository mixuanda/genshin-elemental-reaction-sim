import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { captureSourceHostHit, replaySourceHostHit } from "../../../packages/sim-core/src/source-host-capture";
import { captureSourceHostHealing, replaySourceHostHealing } from "../../../packages/sim-core/src/source-host-healing-capture";
import { captureSourceHostCooldown, replaySourceHostCooldown } from "../../../packages/sim-core/src/source-host-cooldown-capture";
import { sourceHostArtifactSupportIds, sourceHostArtifactSupportRefs } from "../../../packages/sim-core/src/source-host-artifact-support";
import { resolveSourceHostCharacterScalarInput, sourceHostCharacterScalarRuleDescriptor } from "../../../packages/sim-core/src/source-host-character-scalar-formula";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT,
  type SourceHostCalculationRecord, type SourceHostCharacterScalarRequest, type SourceHostResult,
} from "../../../packages/sim-core/src/source-host-wire";

type Lane = "classic" | "stellar";
type Scenario = "field" | "bloom";
type ScalarRecord = SourceHostCalculationRecord & { request: SourceHostCharacterScalarRequest };
const laneFilter = process.env.GIDPS_SCALAR_LANE;
if (laneFilter !== undefined && laneFilter !== "classic" && laneFilter !== "stellar")
  throw new Error(`GIDPS_SCALAR_LANE must be classic or stellar: ${laneFilter}`);
const fieldConfig = `options iteration=1 duration=18;
chongyun char lvl=90/90 cons=2 talent=1,1,1;
chongyun add weapon="favoniusgreatsword" refine=1 lvl=90/90;
diona char lvl=90/90 cons=6 talent=1,1,1 +params=[start_energy=100];
diona add weapon="favoniuswarbow" refine=1 lvl=90/90;
mona char lvl=90/90 cons=1 talent=1,1,1 +params=[start_energy=100];
mona add weapon="magicguide" refine=1 lvl=90/90;
lisa char lvl=90/90 cons=0 talent=1,1,1;
lisa add weapon="magicguide" refine=1 lvl=90/90;
lisa add stats hp=1000 atk=200 em=100 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
hurt once interval=450 amount=7000,7000 element=physical;
active chongyun;
chongyun skill;
mona burst;
lisa skill;
mona skill;
lisa attack:3;
diona burst;
lisa attack;
wait(480);`;

// Nilou's fourth skill action completes the original dance. Its A4 updates
// every 30 frames; Baizhu's first A4 heal occurs 223 frames after his Q.
const bloomConfig = `options iteration=1 duration=18;
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
const scenarios: Array<{ lane: Lane; name: Scenario; config: string }> =
  (["classic", "stellar"] as const).flatMap(lane => [
    { lane, name: "field" as const, config: fieldConfig },
    { lane, name: "bloom" as const, config: bloomConfig },
  ]).filter(row => laneFilter === undefined || row.lane === laneFilter);

test("native character scalar receipts preserve heal, cooldown and reaction support through standalone replay", async ({ page }) => {
  test.setTimeout(420000);
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const evidence: Array<{ lane: Lane; scenario: Scenario; sourceCommit: string; wasmSha256?: string | undefined;
    calculations: number; applications: number; healingApplications: number;
    scalarRules: Record<string, number>; consumers: Record<string, number>;
    selected: Record<string, { scalarId: number; consumerId: number; value: number; frame: number; replayDifference: number }>;
    browserRestore?: { applicationId: number; captureDifference: number; documentSchema: string };
  }> = [];

  for (const scenario of scenarios) {
    await page.goto("/source-simulation");
    await page.locator("#source-host-variant").selectOption(scenario.lane);
    await page.locator("#source-host-config").fill(scenario.config);
    await page.locator("#source-host-seed").fill("20260928");
    await page.locator("#source-host-run").click();
    await expect(page.locator("#source-host-status")).toContainText(/本次运行完成|运行停止|执行器错误/, { timeout: 90000 });
    await expect(page.locator("#source-host-status")).toContainText("本次运行完成");
    const pending = page.waitForEvent("download");
    await page.locator("#source-host-export").click();
    const raw = await readFile((await (await pending).path())!, "utf8");
    await writeFile(resolve(`docs/validation/source-character-scalar-${scenario.lane}-${scenario.name}-20260928.result.json`), raw);
    const result = JSON.parse(raw) as SourceHostResult;
    expect(result.sourceCommit).toBe(scenario.lane === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT);
    expect(result.config).toBe(scenario.config);
    expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
    const byId = new Map(result.calculations.map(row => [row.request.id, row]));
    const containsComponent = (parentId: number, childId: number, seen = new Set<number>()): boolean => {
      if (parentId === childId) return true;
      if (seen.has(parentId)) return false;
      seen.add(parentId);
      return byId.get(parentId)?.request.componentIds.some(id => containsComponent(id, childId, seen)) ?? false;
    };
    // Reaction formula records can be pre-damage components. The native
    // application identifies the terminal damage calculation, not that base.
    const appliedHitFor = (calculationId: number) => result.applications.find(application =>
      containsComponent(application.calculationId, calculationId));
    const scalars = result.calculations.filter((row): row is ScalarRecord => row.request.kind === "character-scalar");
    const scalarRules = Object.fromEntries([...new Set(scalars.map(row => row.request.input.ruleId))]
      .map(id => [id, scalars.filter(row => row.request.input.ruleId === id).length]));
    const consumers = Object.fromEntries(Object.keys(scalarRules).map(ruleId => [ruleId,
      result.calculations.filter(row => sourceHostArtifactSupportIds(row.request).some(id => {
        const support = byId.get(id);
        return support?.request.kind === "character-scalar" && support.request.input.ruleId === ruleId;
      })).length]));
    const selected: (typeof evidence)[number]["selected"] = {};
    const measurement: (typeof evidence)[number] = { lane: scenario.lane, scenario: scenario.name,
      sourceCommit: result.sourceCommit, wasmSha256: result.executionArtifact?.wasmSha256,
      calculations: result.calculations.length, applications: result.applications.length,
      healingApplications: result.healingApplications?.length ?? 0, scalarRules, consumers, selected };
    evidence.push(measurement);

    for (const row of scalars) {
      const descriptor = sourceHostCharacterScalarRuleDescriptor(row.request.input.ruleId);
      expect(row.request.input.modifierKey).toBe(descriptor.modifierKey);
      expect(row.request.input.phase).toBe(descriptor.phase);
      const resolved = resolveSourceHostCharacterScalarInput(row.request.input, result.sourceCommit);
      expect(resolved.value).toBe(row.value);
      expect(resolved.trace.some(node => node.id.includes(row.request.input.ruleId))).toBe(true);
    }
    const findConsumer = (ruleId: string, kind: string, scalarPredicate: (row: ScalarRecord) => boolean = () => true) => {
      const scalar = scalars.find(row => row.request.input.ruleId === ruleId
        && scalarPredicate(row)
        && result.calculations.some(consumer => consumer.request.kind === kind
          && sourceHostArtifactSupportIds(consumer.request).includes(row.request.id)));
      const consumer = scalar && result.calculations.find(row => row.request.kind === kind
        && sourceHostArtifactSupportIds(row.request).includes(scalar.request.id));
      return scalar && consumer ? { scalar, consumer } : undefined;
    };
    const record = (key: string, pair: NonNullable<ReturnType<typeof findConsumer>>, replayDifference: number) => {
      const { scalar, consumer } = pair;
      const refs = sourceHostArtifactSupportRefs(consumer.request);
      expect(refs.some(ref => ref.kind === "scalar" && ref.ids.includes(scalar.request.id)
        && ref.key === scalar.request.input.modifierKey)).toBe(true);
      selected[key] = { scalarId: scalar.request.id, consumerId: consumer.request.id,
        value: scalar.value, frame: scalar.request.frame, replayDifference };
    };

    if (scenario.name === "field") {
      const chongyunId = scenario.lane === "classic" ? "char-scalar-chongyun-c2-b4" : "char-scalar-chongyun-c2-a7";
      const cooldown = findConsumer(chongyunId, "character-cooldown");
      expect(cooldown, `${scenario.lane} requires a real Chongyun C2 cooldown read`).toBeDefined();
      expect(cooldown!.scalar.value).toBe(-0.15);
      expect(cooldown!.scalar.request.input.sourceHolderIndex).toBe(0);
      expect(cooldown!.consumer.request.kind).toBe("character-cooldown");
      const cooldownCapture = captureSourceHostCooldown(result, cooldown!.consumer.request.id);
      const cooldownReplay = replaySourceHostCooldown(cooldownCapture);
      expect(cooldownReplay.difference).toBe(0);
      expect(cooldownCapture.supportingCalculations?.map(row => row.request.id)).toContain(cooldown!.scalar.request.id);
      record("chongyun-c2", cooldown!, cooldownReplay.difference);

      const diona = findConsumer("char-scalar-diona-c6-heal", "character-healing");
      expect(diona, `${scenario.lane} requires actual low-HP healing inside Diona C6 field`).toBeDefined();
      expect(diona!.scalar.value).toBe(0.3);
      expect(diona!.scalar.request.input.sourceHolderIndex).toBe(1);
      const healApplication = result.healingApplications?.find(row => row.bonusCalculationId === diona!.consumer.request.id);
      expect(healApplication).toBeDefined();
      const healingCapture = captureSourceHostHealing(result, healApplication!.id);
      const healingReplay = replaySourceHostHealing(healingCapture);
      expect(healingReplay.difference).toBe(0);
      expect(healingCapture.supportingCalculations?.map(row => row.request.id)).toContain(diona!.scalar.request.id);
      record("diona-c6", diona!, healingReplay.difference);

      const mona = findConsumer("char-scalar-mona-c1", "transformative-base");
      expect(mona, `${scenario.lane} requires a post-Omen electro-charged hit`).toBeDefined();
      expect([0.15, 0.24]).toContain(mona!.scalar.value);
      expect(mona!.scalar.request.input.sourceHolderIndex).toBe(2);
      const hit = appliedHitFor(mona!.consumer.request.id);
      expect(hit).toBeDefined();
      const hitCapture = captureSourceHostHit(result, hit!.id);
      const hitReplay = replaySourceHostHit(hitCapture);
      expect(hitReplay.difference).toBe(0);
      expect(hitCapture.supportingCalculations?.map(row => row.request.id)).toContain(mona!.scalar.request.id);
      record("mona-c1", mona!, hitReplay.difference);

      if (scenario.lane === "classic") {
        await page.locator("#source-host-import").setInputFiles({ name: "source-character-scalar-native.json",
          mimeType: "application/json", buffer: Buffer.from(raw) });
        await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
        await page.locator("#source-host-hit-index").fill(String(result.applications.indexOf(hit!)));
        await expect(page.locator("#source-host-hit")).toContainText("差值 0");
        await page.locator("#source-host-open-calculator").click();
        await expect(page).toHaveURL(/\/calculator$/);
        await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
        const pendingEditable = page.waitForEvent("download");
        await page.locator("[data-source-host-export]").click();
        const editableText = await readFile((await (await pendingEditable).path())!, "utf8");
        await writeFile(resolve("docs/validation/source-character-scalar-calculator-20260928.result.json"), editableText);
        const editable = JSON.parse(editableText) as { schemaVersion: string; originalCapture: typeof hitCapture };
        expect(editable.originalCapture).toEqual(hitCapture);
        await page.locator("#calc-source-host-close").click();
        await page.locator("#calc-import").setInputFiles({ name: "source-character-scalar-calculator.json",
          mimeType: "application/json", buffer: Buffer.from(editableText) });
        await expect(page.locator("#calc-source-host-capture")).toContainText("差值 0");
        measurement.browserRestore = { applicationId: hit!.id, captureDifference: hitReplay.difference,
          documentSchema: editable.schemaVersion };
      }
    } else {
      const furinaCreate = scalars.find(row => row.request.input.ruleId === "char-scalar-furina-burst-heal-ratio");
      const furinaRead = findConsumer("char-scalar-furina-burst-heal", "character-healing", row => row.value > 0);
      expect(furinaCreate, `${scenario.lane} requires Furina's native Q ratio snapshot`).toBeDefined();
      expect(furinaRead, `${scenario.lane} requires the Q modifier at an actual Baizhu heal`).toBeDefined();
      expect(furinaRead!.scalar.value).toBeGreaterThan(0);
      expect(furinaRead!.scalar.request.valueSources?.talentRatio).toBe(furinaCreate!.request.id);
      expect(furinaRead!.scalar.request.input.state.talentRatio).toBe(furinaCreate!.value);
      const furinaApplication = result.healingApplications?.find(row => row.bonusCalculationId === furinaRead!.consumer.request.id);
      expect(furinaApplication).toBeDefined();
      const furinaCapture = captureSourceHostHealing(result, furinaApplication!.id);
      const furinaReplay = replaySourceHostHealing(furinaCapture);
      expect(furinaReplay.difference).toBe(0);
      expect(furinaCapture.supportingCalculations?.map(row => row.request.id)).toEqual(expect.arrayContaining([
        furinaCreate!.request.id, furinaRead!.scalar.request.id,
      ]));
      record("furina-q-heal", furinaRead!, furinaReplay.difference);

      const nilouInitial = scalars.find(row => row.request.input.ruleId === "char-scalar-nilou-a4-initial");
      const nilouUpdate = findConsumer("char-scalar-nilou-a4-update", "transformative-base");
      expect(nilouInitial, `${scenario.lane} requires native pure-Hydro/Dendro A4 creation`).toBeDefined();
      expect(nilouInitial!.value).toBe(0);
      expect(nilouUpdate, `${scenario.lane} requires a timed Nilou snapshot consumed by a Bloom hit`).toBeDefined();
      const nilouRefs = sourceHostArtifactSupportRefs(nilouUpdate!.consumer.request);
      expect(nilouUpdate!.scalar.request.input.phase).toBe("creation");
      expect(nilouUpdate!.scalar.request.statRead).toBeDefined();
      expect(nilouUpdate!.scalar.request.input.state.maxHP).toBeGreaterThan(30000);
      expect(nilouRefs.some(ref => ref.creationIds?.includes(nilouUpdate!.scalar.request.id))).toBe(true);
      expect(nilouUpdate!.consumer.request.frame).toBeGreaterThan(nilouUpdate!.scalar.request.frame);
      const nilouHit = appliedHitFor(nilouUpdate!.consumer.request.id);
      expect(nilouHit).toBeDefined();
      const nilouCapture = captureSourceHostHit(result, nilouHit!.id);
      const nilouReplay = replaySourceHostHit(nilouCapture);
      expect(nilouReplay.difference).toBe(0);
      expect(nilouCapture.supportingCalculations?.map(row => row.request.id)).toContain(nilouUpdate!.scalar.request.id);
      record("nilou-a4", nilouUpdate!, nilouReplay.difference);

      const baizhu = findConsumer("char-scalar-baizhu-a4-bloom-family", "transformative-base");
      expect(baizhu, `${scenario.lane} requires a real Bloom after Baizhu's first shield heal`).toBeDefined();
      const hp = baizhu!.scalar.request.input.state.maxHP!;
      expect(baizhu!.scalar.value).toBeCloseTo(Math.min(hp / 1000, 50) * 0.02, 12);
      expect(baizhu!.scalar.request.statRead).toBeDefined();
      expect(baizhu!.scalar.request.input.sourceHolderIndex).toBe(3);
      const baizhuHit = appliedHitFor(baizhu!.consumer.request.id);
      expect(baizhuHit).toBeDefined();
      const baizhuCapture = captureSourceHostHit(result, baizhuHit!.id);
      const baizhuReplay = replaySourceHostHit(baizhuCapture);
      expect(baizhuReplay.difference).toBe(0);
      expect(baizhuCapture.supportingCalculations?.map(row => row.request.id)).toContain(baizhu!.scalar.request.id);
      record("baizhu-a4", baizhu!, baizhuReplay.difference);
    }
  }

  expect(pageErrors).toEqual([]);
  const aggregatePath = laneFilter === undefined
    ? "docs/validation/source-character-scalar-20260928.result.json"
    : `docs/validation/source-character-scalar-${laneFilter}-20260928.result.json`;
  await writeFile(resolve(aggregatePath), `${JSON.stringify({
    schemaVersion: "source-character-scalar-validation-v1", laneFilter: laneFilter ?? "both", evidence, pageErrors,
  }, null, 2)}\n`);
  console.log(JSON.stringify({ runs: evidence.map(({ lane, scenario, scalarRules, consumers, selected }) => ({
    lane, scenario, scalarRules, consumers, selected })), pageErrors }));
});
