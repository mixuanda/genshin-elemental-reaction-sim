import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Acceptance arithmetic for the explicit C0 level90 reference build used by
// calculator-neuvillette-native-outputs.spec.ts; not a second damage engine.
// Constants: pinned Classic b4ae769 neuvillette/zz_neuvillette.dm.go,
// charge.go, burst.go and asc.go. Compare existing exported results only.
const [chargePath, burstPath] = process.argv.slice(2);
if (!chargePath || !burstPath) throw new Error("Usage: node scripts/verify-neuvillette-single-action.mjs charge-native.json burst-native.json");
const charge = JSON.parse(await readFile(chargePath, "utf8"));
const burst = JSON.parse(await readFile(burstPath, "utf8"));
const revision = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const check = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 1e-8, `${label}: ${actual} != ${expected}`);
const baseHp = 1143.984 * 8.739 + 4697.817;
const weaponHp = .09 * 4.594;
const criticalDamage = .5 + .384 + .8858;
const artifactHp = 5228.13, artifactHpRatio = .6525, artifactHydro = .466;
const maxHp = baseHp * (1 + weaponHp + artifactHpRatio) + artifactHp;
const rows = [];
for (const [action, exported] of [["charge", charge], ["burst", burst]]) {
  const { input, result } = exported, member = input.member;
  assert.equal(input.source.revision, revision); assert.equal(input.source.hostVariant, "classic");
  assert.equal(member.characterKey, "neuvillette"); assert.equal(member.level, 90); assert.equal(member.constellation, 0);
  assert.deepEqual(member.talents, { auto: 10, skill: 6, burst: 6 });
  assert.deepEqual(member.weapon, { key: "prototypeamber", level: 90, levelCap: 90, refinement: 1 });
  assert.deepEqual(member.artifactSets, [{ key: "marechausseehunter", count: 5 }]);
  assert.equal(input.action.kind, action); assert.equal(input.seed, "11"); assert.equal(input.durationSeconds, 12);
  assert.equal(input.startup, action === "charge" ? "zero" : "full");
  for (const [key, value] of Object.entries({ hp: artifactHp, "hp%": artifactHpRatio, "hydro%": artifactHydro, cd: .8858, cr: .8554 }))
    check(member.artifactStats[key], value, `artifact ${key}`);
  assert.equal(input.target.level, 90); assert.equal(input.target.resistance, .1);
  const accepted = result.logs.filter(row => row.msg === "source-host action accepted" && row.logs.action === action);
  assert.equal(accepted.length, 1); const start = accepted[0].frame;
  const hits = result.applications;
  assert.equal(hits.length, action === "charge" ? 8 : 3);
  assert.equal(new Set(hits.map(hit => hit.id)).size, hits.length);
  const offsets = action === "charge" ? [6, 28, 53, 78, 103, 128, 153, 173].map(frame => 14 + 3 + 209 + frame) : [95, 135, 154];
  assert.deepEqual(hits.map(hit => hit.frame - start), offsets);
  if (action === "charge") {
    assert.deepEqual(result.drainApplications.map(drain => drain.frame - start), [40, 70, 100, 130, 160].map(frame => 14 + 3 + 209 + frame));
    for (const drain of result.drainApplications) check(drain.amount, .08 * maxHp, "8% HP drain");
  } else {
    const consume = result.energyApplications.filter(event => event.operation === "consume");
    assert.equal(consume.length, 1); assert.equal(consume[0].requestedAmount, 70);
    assert.equal(consume[0].energyBefore, 70); assert.equal(consume[0].energyAfter, 0);
  }
  const byId = new Map(result.calculations.map(calculation => [calculation.request.id, calculation]));
  let independentTotal = 0, actualTotal = 0, maximumAbsoluteError = 0;
  const details = hits.map((hit, index) => {
    const request = byId.get(hit.calculationId).request;
    assert.equal(request.actorKey, "neuvillette"); assert.equal(hit.targetKey, 1);
    const drains = result.drainApplications.filter(drain => drain.frame < hit.frame).length;
    const hpRatio = 1 - .08 * drains;
    const a4 = Math.min(.3, Math.max(0, (hpRatio - .3) * .6));
    const coefficient = action === "charge" ? .14467 : index === 0 ? .31161 : .127477;
    const damageBonus = artifactHydro + a4 + (action === "charge" ? .15 : 0);
    assert.equal(hit.isCrit, request.input.critRoll < Math.min(1, Math.max(0, request.input.critRate)));
    check(request.input.flatDamage, coefficient * maxHp, "independent HP scaling");
    check(request.input.damageBonus, damageBonus, "single A4 and applicable artifact bonus");
    check(request.input.critDamage, criticalDamage, "independent critical damage");
    const expected = maxHp * coefficient * (1 + damageBonus) * .5 * .9 * (hit.isCrit ? 1 + criticalDamage : 1);
    const error = Math.abs(hit.rawDamage - expected);
    check(hit.rawDamage, expected, `hit ${index + 1}`); check(hit.appliedDamage, expected, "unbounded target application");
    independentTotal += expected; actualTotal += hit.rawDamage; maximumAbsoluteError = Math.max(maximumAbsoluteError, error);
    return { frame: hit.frame, offset: hit.frame - start, coefficient, hpRatio, a4, damageBonus,
      isCrit: hit.isCrit, independentDamage: expected, actualDamage: hit.rawDamage, absoluteError: error };
  });
  rows.push({ action, startingEnergy: input.startup, acceptedFrame: start, maxHp, hitCount: hits.length,
    independentTotal, actualTotal, maximumAbsoluteError, details, wasm: result.executionArtifact });
}
console.log(JSON.stringify({ scope: "fixed C0 reference build, two independent single actions, seed11; not a mean or a rotation", revision, rows }, null, 2));
