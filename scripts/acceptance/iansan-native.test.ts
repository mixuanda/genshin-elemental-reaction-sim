/** Opt-in, bounded real Stellar runs. Not part of the ordinary unit suite. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInThisContext } from "node:vm";
import { beforeAll, expect, it } from "vitest";
import { createSourceHostFormulaResolver } from "../../packages/sim-core/src/source-host-formula";
import { createSourceHostResult } from "../../packages/sim-core/src/source-host-capture";
import { calculateDocument } from "../../packages/sim-core/src/calculator";
import { applyCharacterConstellationScope, getCharacterDocuments } from "../../apps/web/src/character-calculations";
import { evaluateIansanBurstAttackFeedback } from "../../packages/sim-core/src/iansan-swift-resolved-numeric";

const revision = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd";
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
let output: string;
let wasmSha256: string;
beforeAll(async () => {
  if (!process.env.GIDPS_IANSAN_OUTPUT || !process.env.GIDPS_IANSAN_HOST) {
    throw Error("Set explicit GIDPS_IANSAN_OUTPUT and GIDPS_IANSAN_HOST; existing evidence is never overwritten.");
  }
  output = resolve(process.env.GIDPS_IANSAN_OUTPUT);
  mkdirSync(output, { recursive: true });
  const host = resolve(process.env.GIDPS_IANSAN_HOST);
  const bytes = readFileSync(resolve(host, "source-host.wasm"));
  const manifest = JSON.parse(readFileSync(resolve(host, "manifest.json"), "utf8"));
  wasmSha256 = sha(bytes);
  expect(manifest.source.revision).toBe(revision);
  expect(manifest.files.find((file: {path: string}) => file.path === "source-host.wasm")?.sha256).toBe(wasmSha256);
  const runtime = readFileSync(resolve(host, "wasm_exec.js"));
  expect(manifest.files.find((file: {path: string}) => file.path === "wasm_exec.js")?.sha256).toBe(sha(runtime));
  write("host.json", { host, wasmSha256, bytes: bytes.length, sourceRevision: revision, startedAt: new Date().toISOString() });
  if (process.env.GIDPS_IANSAN_REPLAY) {
    const captured = JSON.parse(readFileSync(resolve(process.env.GIDPS_IANSAN_REPLAY, "host.json"), "utf8"));
    expect(captured.wasmSha256).toBe(wasmSha256);
    return; // Revalidate a saved real capture without running the engine again.
  }
  runInThisContext(runtime.toString());
  const go = new (globalThis as any).Go();
  const wasm = await WebAssembly.instantiate(bytes, go.importObject);
  void go.run(wasm.instance);
});
function write(name: string, value: unknown) {
  writeFileSync(resolve(output, name), JSON.stringify(value), { flag: "wx" });
}
function run(name: string, script: string, initialEnergy: "full" | "zero" = "zero") {
  const request = { protocol: "gidps-source-host-v1", config: script, seed: "20261023", stopAtDuration: true,
    executionMode: "auto-wait", initialEnergy: { mode: initialEnergy } };
  write(`${name}.request.json`, request);
  const resolver = createSourceHostFormulaResolver();
  const start = performance.now();
  let native;
  if (process.env.GIDPS_IANSAN_REPLAY) {
    const captured = (suffix: string) => JSON.parse(readFileSync(resolve(process.env.GIDPS_IANSAN_REPLAY!, `${name}.${suffix}.json`), "utf8"));
    expect(captured("request")).toEqual(request);
    native = captured("native");
    resolver.calculations.push(...captured("formula-callbacks"));
  } else {
    native = JSON.parse((globalThis as any).gidpsSourceHostRun(JSON.stringify(request), resolver.resolve));
  }
  write(`${name}.native.json`, native);
  write(`${name}.formula-callbacks.json`, resolver.calculations);
  write(`${name}.time.json`, { nativeAndSharedFormulaMs: process.env.GIDPS_IANSAN_REPLAY ? null : performance.now() - start,
    replayed: Boolean(process.env.GIDPS_IANSAN_REPLAY), wasmSha256 });
  expect(native.error).toBeUndefined();
  return { native, resolver };
}
function config(cons: number, na: number, skill: number, duration: number, actions: string, far = false) {
  // Plain equipped spear, explicit zero CR and no artificial energy generator.
  // This is a controlled mechanism fixture, not a graduation preset.
  return `options iteration=1 duration=${duration};
iansan char lvl=90/90 cons=${cons} talent=${na},${skill},10;
iansan add weapon="beginnersprotector" refine=1 lvl=1/20;
iansan add stats cr=-0.05;
target lvl=90 resist=0.1 radius=2 pos=0,${far ? 100 : 2.4} hp=1000000000;
active iansan;
${actions}
`;
}

it.each([
  { name: "na1-e10-c0", na: 1, skill: 10, cons: 0, coefficient: .84194 },
  { name: "na10-e1-c0", na: 10, skill: 1, cons: 0, coefficient: 1.6643 },
  { name: "na10-e10-c3", na: 10, skill: 10, cons: 3, coefficient: 1.6643 },
])("uses the real normal talent getter for Swift ($name)", ({ name, na, skill, cons, coefficient }) => {
  const { native, resolver } = run(name, config(cons, na, skill, 3, "iansan skill;\niansan charge;\nwait(180);"));
  const damage = native.calculations.filter((row: any) => row.request.kind === "damage");
  const swifts = damage.filter((row: any) => row.request.ability === "Swift Stormflight");
  expect(swifts).toHaveLength(1);
  const hit = swifts[0];
  const expected = hit.request.input.scalingValue * coefficient * .5 * .9;
  write(`${name}.independent.json`, { expectedNormalTalent: na, expectedCoefficient: coefficient,
    observedCoefficient: hit.request.input.scaling, observedIndex: hit.request.talentTableRead,
    atkAtSnapshot: hit.request.input.scalingValue, defenseMultiplier: .5, resistanceMultiplier: .9,
    expectedNonCrit: expected, actual: hit.value, frame: hit.request.frame });
  expect(hit.request.input.scaling).toBe(coefficient);
  expect(hit.request.talentTableRead.indexSources[0]).toMatchObject({ kind: "attack", baseTalent: na, constellation: cons, constellationUnlock: -1, value: na - 1 });
  expect(hit.value).toBeCloseTo(expected, 10);
  expect(Number.isInteger(hit.request.frame)).toBe(true);
  expect(hit.request.frame - hit.request.sourceFrame).toBe(25);
  expect(hit.request.snapshotFrame).toBe(hit.request.frame);
  expect(native.applications.filter((row: any) => row.calculationId === hit.request.id)).toHaveLength(1);
  if (process.env.GIDPS_IANSAN_BEFORE) {
    const before = JSON.parse(readFileSync(resolve(process.env.GIDPS_IANSAN_BEFORE, `${name}.native.json`), "utf8"));
    const oldDamage = before.calculations.filter((row: any) => row.request.kind === "damage");
    expect(damage.map((row: any) => [row.request.actorKey, row.request.ability, row.request.sourceFrame,
      row.request.frame, row.request.snapshotFrame, row.request.input.critRoll]))
      .toEqual(oldDamage.map((row: any) => [row.request.actorKey, row.request.ability, row.request.sourceFrame,
        row.request.frame, row.request.snapshotFrame, row.request.input.critRoll]));
    // E is not modified by the Swift fix, including its legitimate C3 level.
    expect(damage.find((row: any) => row.request.ability === "Thunderbolt Rush").value)
      .toBe(oldDamage.find((row: any) => row.request.ability === "Thunderbolt Rush").value);
    expect(native.randomness).toEqual(before.randomness);
  }
  // Revalidate the actual capture, including its source read and per-hit formula.
  const result = createSourceHostResult(native, resolver.calculations);
  expect(result.applications.reduce((sum, row) => sum + row.rawDamage, 0)).toBeCloseTo(damage.reduce((sum: number, row: any) => sum + row.value, 0), 10);
  if (cons === 0) {
    const document = getCharacterDocuments("character:10000110", na).find(doc => doc.gameContext?.skillId === "iansan-swift-resolved-c0")!;
    document.scope = "single-hit";
    document.build = { mode: "manual-final", source: "Actual native pre-A1 Swift snapshot", ascension: 6,
      stats: { atk: hit.request.input.scalingValue, hp: 20000, def: 800, em: 0, critRate: 0, critDamage: .5 } };
    document.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    document.gameContext!.iansanSwiftResolvedCast = { sharedState: { swiftQualifiedAtCast: true,
      a1ActiveAtSnapshot: false, includedA1Attack: 0, burstInactiveAtSnapshot: true } };
    const standalone = calculateDocument(document);
    write(`${name}.standalone.json`, standalone);
    expect(standalone.status).toBe("calculated");
    expect(standalone.totals!.nonCritical).toBeCloseTo(expected, 10);
  }
  if (cons === 3) {
    const firstRefund = native.energyApplications.find((row: any) => row.source === "iansan-c1");
    // E starts at F1, grants 54 points at F4; the 10th six-frame drain
    // reaches six points at F64. Source energy is fixed, not multiplied by ER.
    expect(firstRefund).toMatchObject({ frame: 64, operation: "flat-change", requestedAmount: 15, energyBefore: 0, energyAfter: 15 });
    expect(native.energyApplications.filter((row: any) => row.source === "iansan-c1")).toHaveLength(1);
  }
});

it("does not manufacture the missing energy for a zero-energy E to Q request", () => {
  const { native, resolver } = run("zero-energy-e-q", config(1, 10, 10, 3, "iansan skill;\niansan burst;\nwait(180);"));
  expect(native.energyApplications.filter((row: any) => row.operation === "consume")).toHaveLength(0);
  expect(native.calculations.filter((row: any) => row.request.ability === "The Three Principles of Power")).toHaveLength(0);
  expect(native.energyApplications.find((row: any) => row.source === "iansan-c1")).toMatchObject({ frame: 64, requestedAmount: 15 });
  const gains = native.energyApplications.reduce((sum: number, row: any) => sum + row.energyAfter - row.energyBefore, 0);
  expect(gains).toBe(27); // Four Electro particles at ER100%, plus C1's fixed 15.
  expect(native.logs.some((row: any) => row.msg === "source-host action rejected"
    && row.logs.action === "burst" && row.logs.reason === "insufficient_energy")).toBe(true);
  const result = createSourceHostResult(native, resolver.calculations);
  expect(result.observationWindow).toMatchObject({ configuredEndFrame: 180, actualEndFrame: 180, endReason: "duration" });
});

it("keeps C2 self/ally and the actual C6 recipient separate through a real Q, E and swap", () => {
  const script = `options iteration=1 duration=20;
iansan char lvl=90/90 cons=6 talent=10,10,10;
iansan add weapon="beginnersprotector" refine=1 lvl=1/20;
iansan add stats cr=-0.05;
kaeya char lvl=90/90 cons=0 talent=10,10,10;
kaeya add weapon="dullblade" refine=1 lvl=1/20;
kaeya add stats cr=-0.05;
target lvl=90 resist=0.1 radius=2 pos=0,2.4 hp=1000000000;
active iansan;
iansan burst;
iansan skill;
iansan charge;
kaeya attack;
wait(900);
kaeya attack;
wait(1200);
`;
  const { native, resolver } = run("c6-q-team", script, "full");
  const damage = native.calculations.filter((row: any) => row.request.kind === "damage");
  const swift = damage.find((row: any) => row.request.ability === "Swift Stormflight");
  const kaeya = damage.filter((row: any) => row.request.actorKey === "kaeya");
  const consume = native.energyApplications.filter((row: any) => row.operation === "consume");
  expect(consume).toHaveLength(1);
  expect(consume[0]).toMatchObject({ actorKey: "iansan", requestedAmount: 70, energyBefore: 70, energyAfter: 0 });
  expect(consume[0].frame).toBe(7);
  expect(kaeya).toHaveLength(2);
  expect(swift.request.input.scaling).toBe(1.6643);
  // Pinned character growth/promotion plus a legal level-1 spear. Ascension
  // gives 24% ATK; C2 grants the source only A1's 20%, never ally-only 30%.
  const baseAtk = 21.54768 * 8.349 + 77.09902 + 23.245;
  const sourceNonExtra = baseAtk * (1 + .24 + .20);
  const qUpdates = native.calculations.filter((row: any) => row.request.input?.ruleId === "char-vector-iansan-burst-atk");
  expect(qUpdates.length).toBeGreaterThan(1);
  for (const update of qUpdates) {
    const state = update.request.input.state;
    expect(state.talentLevel).toBe(12); // Base Q10 + C5 exactly once -> Q13.
    expect(state.nonExtraAtk).toBeCloseTo(sourceNonExtra, 10);
    const independent = evaluateIansanBurstAttackFeedback({ effectiveBurstTalentLevel: state.talentLevel + 1,
      nonExtraAttackAtUpdate: state.nonExtraAtk, nightsoulPointsAtUpdate: state.pointsThreshold });
    expect(update.value).toBeCloseTo(independent.attackBonus, 10);
  }
  const qAtSwift = qUpdates.filter((row: any) => row.request.frame <= swift.request.snapshotFrame && row.request.id < swift.request.id).at(-1);
  expect(qAtSwift).toBeDefined();
  expect(swift.request.snapshot.baseAtk).toBeCloseTo(baseAtk, 10);
  expect(swift.request.snapshot.atkPct).toBeCloseTo(.24 + .20, 12);
  expect(kaeya[0].request.snapshot.atkPct).toBeCloseTo(.30, 12);
  expect(kaeya[1].request.snapshot.atkPct).toBe(0);
  // A C6 overflow buff received by Iansan does not transfer to Kaeya on swap.
  expect(swift.request.input.damageBonus).toBe(.25);
  expect(kaeya[0].request.input.damageBonus).toBe(0);
  expect(kaeya[1].request.input.damageBonus).toBe(0);
  expect(swift.request.input.scalingValue).toBeGreaterThan(sourceNonExtra);
  const expected = swift.request.input.scalingValue * 1.6643 * 1.25 * .5 * .9;
  expect(swift.value).toBeCloseTo(expected, 9);
  expect(swift.request.snapshot.flatAtk).toBe(qAtSwift.value);
  const doc = getCharacterDocuments("character:10000110", 10).find(row => row.gameContext?.skillId === "iansan-swift-resolved-c0")!;
  doc.scope = "single-hit";
  doc.characterLevel = 90;
  doc.gameContext!.constellation = 6;
  doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  doc.build = { mode: "manual-final", source: "Same equipped native fixture before Iansan-specific A1/Q/C6 contributions", ascension: 6,
    stats: { atk: baseAtk * 1.24, hp: 20000, def: 800, em: 0, critRate: 0, critDamage: .5 } };
  doc.gameContext!.iansanSwiftResolvedCast = { burstTalentLevel: 13, sharedState: { swiftQualifiedAtCast: true,
    a1ActiveAtSnapshot: true, includedA1Attack: 0, baseAttack: baseAtk, burstInactiveAtSnapshot: false,
    ownerOnFieldAtSnapshot: true, burstUpdateNonExtraAttack: qAtSwift.request.input.state.nonExtraAtk,
    burstUpdateNightsoulPoints: qAtSwift.request.input.state.pointsThreshold, includedBurstAttack: 0,
    c6DamageBonusActiveAtHit: true, includedC6DamageBonus: 0 } };
  const standalone = calculateDocument(applyCharacterConstellationScope(doc));
  write("c6-q-team.standalone.json", standalone);
  expect(standalone.status).toBe("calculated");
  expect(standalone.totals!.nonCritical).toBeCloseTo(swift.value, 9);
  expect(kaeya[0].request.input.scalingValue).toBeGreaterThan(kaeya[0].request.snapshot.baseAtk * 1.3);
  expect(kaeya[1].request.input.scalingValue).toBeCloseTo(kaeya[1].request.snapshot.baseAtk, 10);
  const result = createSourceHostResult(native, resolver.calculations);
  expect(result.observationWindow).toMatchObject({ configuredEndFrame: 1200, actualEndFrame: 1200, endReason: "duration" });
  expect(result.applications.every(hit => Number.isInteger(hit.frame) && hit.frame >= 0 && hit.frame < 1200)).toBe(true);
  const perActor: Record<string, number> = {};
  for (const row of damage) perActor[row.request.actorKey] = (perActor[row.request.actorKey] ?? 0) + row.value;
  expect(Object.values(perActor).reduce((sum, value) => sum + value, 0)).toBeCloseTo(result.applications.reduce((sum, row) => sum + row.appliedDamage, 0), 9);
  write("c6-q-team.independent.json", { sourceBaseAtk: baseAtk, sourceNonExtra,
    swiftFrame: swift.request.frame, swiftNonCrit: swift.value, expectedSwiftNonCrit: expected,
    qUpdateAtSwift: { frame: qAtSwift.request.frame, state: qAtSwift.request.input.state, value: qAtSwift.value },
    swiftSnapshot: swift.request.snapshot, kaeya: kaeya.map((row: any) => ({ frame: row.request.frame, input: row.request.input, snapshot: row.request.snapshot })),
    energyConsumption: consume, perActor, observationWindow: result.observationWindow });
});

it("grants C6 for the actual Q entry restoration overflow without treating it as C4 Scale overflow", () => {
  const script = config(6, 10, 10, 3, "iansan skill;\niansan burst;\niansan charge;\nwait(180);")
    .replace("iansan add stats cr=-0.05;", "");
  const { native, resolver } = run("c6-q-entry-overflow", script, "full");
  const q = native.abilityInvocations.find((row: any) => row.characterKey === "iansan" && row.action === "burst" && row.success);
  expect(q).toBeDefined();
  const regeneration = native.logs.find((row: any) => row.msg === "generate nightsoul points"
    && row.char_index === 0 && row.frame === q.startedFrame + 40 && row.logs.amount === 15);
  expect(regeneration).toBeDefined();
  const overflow = regeneration.logs["previous points"] + 15 - 54;
  const firstC6 = native.logs.find((row: any) => row.msg === "attack mod added" && row.logs.key === "iansan-c6");
  write("c6-q-entry-overflow.independent.json", { qStartFrame: q.startedFrame,
    regeneration, overflow, firstC6, expectedGrantFrame: q.startedFrame + 40,
    scope: "Actual E to Q with legal starter equipment and default CR; Q15 is not a Scale restoration or C4 overflow input." });
  expect(overflow).toBeGreaterThan(0);
  expect(regeneration.logs.final).toBe(54);
  expect(firstC6).toMatchObject({ frame: q.startedFrame + 40, char_index: 0 });
  const damage = native.calculations.filter((row: any) => row.request.kind === "damage");
  const swift = damage.find((row: any) => row.request.ability === "Swift Stormflight");
  expect(swift).toBeDefined();
  expect(swift.request.input.damageBonus).toBe(.25);
  const input = swift.request.input;
  const independent = input.scalingValue * 1.6643 * 1.25 * .5 * .9 * (input.isCrit ? 1 + input.critDamage : 1);
  expect(swift.value).toBeCloseTo(independent, 9);
  const result = createSourceHostResult(native, resolver.calculations);
  expect(result.applications.filter(row => row.calculationId === swift.request.id)).toHaveLength(1);
});

it("ends positive Nightsoul and the C4 marker at its actual expiry in a real no-movement team sequence", () => {
  const script = `options iteration=1 duration=17;
iansan char lvl=90/90 cons=4 talent=10,10,10;
iansan add weapon="beginnersprotector" refine=1 lvl=1/20;
kaeya char lvl=90/90 cons=0 talent=10,10,10;
kaeya add weapon="dullblade" refine=1 lvl=1/20;
target lvl=90 resist=0.1 radius=2 pos=0,2.4 hp=1000000000;
active iansan;
iansan burst;
iansan skill;
iansan charge;
kaeya burst;
kaeya attack;
wait(540);
kaeya attack;
wait(180);
kaeya attack;
wait(1020);
`;
  const { native, resolver } = run("c4-marker-expiry", script, "full");
  const marker = native.statusInstances.find((row: any) => row.actorIndex === 0 && row.statusKey === "iansan-burst");
  const exit = native.logs.find((row: any) => row.char_index === 0 && row.msg === "exit nightsoul blessing");
  const clear = native.logs.find((row: any) => row.char_index === 0 && row.msg === "clear nightsoul points");
  const qConsumes = native.energyApplications.filter((row: any) => row.operation === "consume");
  write("c4-marker-expiry.independent.json", { marker, exit, clear, qConsumes,
    scope: "One real Q/E/Swift to teammate Q; no movement override or artificial energy. Not a repeated rotation." });
  expect(qConsumes.map((row: any) => [row.actorKey, row.requestedAmount])).toEqual([["iansan", 70], ["kaeya", 60]]);
  expect(native.abilityInvocations.filter((row: any) => row.characterKey === "kaeya" && row.action === "burst" && row.success)).toHaveLength(1);
  expect(marker).toBeDefined();
  expect(exit).toBeDefined();
  expect(exit.frame).toBe(marker.finalExpiryFrame + 1);
  expect(marker.endFrame).toBe(exit.frame);
  expect(clear.logs["previous points"]).toBeGreaterThan(0);
  expect(native.logs.filter((row: any) => row.char_index === 0 && row.msg === "generate nightsoul points" && row.frame > exit.frame)).toHaveLength(0);
  const damage = native.calculations.filter((row: any) => row.request.kind === "damage");
  const laterKaeya = damage.filter((row: any) => row.request.actorKey === "kaeya" && row.request.snapshotFrame > exit.frame);
  expect(laterKaeya.length).toBeGreaterThan(0);
  for (const row of laterKaeya) {
    expect(row.request.snapshot.atkPct).toBe(0);
    expect(row.request.snapshot.flatAtk).toBe(0);
  }
  // Existing Q snapshots retain their original buffs even if their attack is
  // queued/applied after the marker ends; only fresh snapshots lose the buffs.
  const frozenKaeya = damage.filter((row: any) => row.request.actorKey === "kaeya"
    && row.request.frame > exit.frame && row.request.snapshotFrame <= exit.frame);
  expect(frozenKaeya.length).toBeGreaterThan(0);
  for (const row of frozenKaeya) {
    expect(row.request.ability).toBe("Glacial Waltz");
    expect(row.request.snapshot.atkPct).toBe(.3);
    expect(row.request.snapshot.flatAtk).toBeGreaterThan(0);
  }
  const result = createSourceHostResult(native, resolver.calculations);
  const byActor: Record<string, number> = {};
  for (const row of damage) byActor[row.request.actorKey] = (byActor[row.request.actorKey] ?? 0) + row.value;
  const total = result.applications.reduce((sum, row) => sum + row.appliedDamage, 0);
  expect(Object.values(byActor).reduce((sum, value) => sum + value, 0)).toBeCloseTo(total, 9);
  write("c4-marker-expiry.contributions.json", { byActor, total, window: result.observationWindow,
    freshAfterExit: laterKaeya.map((row: any) => ({ frame: row.request.frame, snapshotFrame: row.request.snapshotFrame, atkPct: row.request.snapshot.atkPct, flatAtk: row.request.snapshot.flatAtk })),
    frozenAfterExit: frozenKaeya.map((row: any) => ({ frame: row.request.frame, snapshotFrame: row.request.snapshotFrame, atkPct: row.request.snapshot.atkPct, flatAtk: row.request.snapshot.flatAtk })) });
});
