// Recheck retained native evidence; this command does not rerun the simulation.
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { captureSourceHostHit, replaySourceHostHit } from '../packages/sim-core/src/source-host-capture';
import { captureSourceHostEnergy, replaySourceHostEnergy } from '../packages/sim-core/src/source-host-energy-capture';
import { captureSourceHostCooldown, replaySourceHostCooldown } from '../packages/sim-core/src/source-host-cooldown-capture';
import { buildSourceDamageCurve, curveSeries, cumulativeFrameSteps } from '../apps/web/src/source-damage-curve';
import type { SourceHostResult } from '../packages/sim-core/src/source-host-wire';

export function auditImportedTeam120(r: SourceHostResult) {
  assert.equal(r.observationWindow?.actualEndFrame, 7200);
  assert.equal(r.observationWindow?.configuredEndFrame, 7200);
  assert.equal(r.observationWindow?.endReason, 'duration');
  assert.ok(r.config.includes('start_energy=0'), 'this acceptance case starts at zero energy');
  const calculations = new Map(r.calculations.map(c => [c.request.id, c]));
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-8, `${actual} != ${expected}`);
  const contribution: Record<string, number> = {};
  let maxDamageError = 0, maxEnergyError = 0;
  const abilitySamples = new Set<string>();
  const rows = r.applications.map(a => {
    assert.ok(Number.isInteger(a.frame) && a.frame >= 0 && a.frame < 7200);
    const q = calculations.get(a.calculationId)!.request;
    assert.equal(q.kind, 'damage');
    if (q.kind !== 'damage') throw new Error('not a damage request');
    assert.equal(q.frame, a.frame);
    assert.equal(q.damageCategory, 'ordinary');
    assert.equal(q.input.amped, false);
    assert.equal(q.input.baseDamageBonus, 0);
    assert.equal(q.input.flatDamage, 0);
    assert.equal(q.input.groupMultiplier, 1);
    assert.equal(q.input.characterLevel, 90);
    assert.equal(q.input.enemyLevel, 90);
    assert.equal(q.input.defenseIgnore, 0);
    assert.equal(q.input.defenseAdjustment, 0);
    assert.equal(q.input.effectiveResistance, 0.1);
    const fixedSkills: Record<string, number> = {
      'kaedeharakazuha/Chihayaburu (Press)': 3.456, // base E10
      'kinich/Loop Shot 0': 1.03104, 'kinich/Loop Shot 1': 1.03104, // base E10
      'xiao/Lemniscatic Wind Cycling': 3.792, // base E7
      'venti/Skyward Sonnett (Press)': 4.692, // base E9
    };
    const fixedCoefficient = fixedSkills[`${q.actorKey}/${q.ability}`];
    if (fixedCoefficient !== undefined) assert.equal(q.input.scaling, fixedCoefficient);
    // Independent ordinary-hit arithmetic on the recorded state. This verifies
    // calculation consistency, not unobserved game geometry or upstream timings.
    const attack = q.snapshot.baseAtk * (1 + q.snapshot.atkPct) + q.snapshot.flatAtk;
    close(q.input.scalingValue, attack);
    const expected = attack * q.input.scaling * (1 + q.input.damageBonus) * 0.5 * 0.9
      * (a.isCrit ? 1 + q.snapshot.critDamage : 1);
    maxDamageError = Math.max(maxDamageError, Math.abs(expected - a.rawDamage));
    close(a.rawDamage, expected);
    assert.equal(a.appliedDamage, a.rawDamage); // fixed-HP-disabled observation target
    if (q.input.critRoll !== null) assert.equal(a.isCrit, q.input.critRoll < Math.max(0, Math.min(1, q.input.critRate)));
    else assert.equal(q.input.hitWeakPoint, true);
    contribution[q.actorKey] = (contribution[q.actorKey] ?? 0) + a.appliedDamage;
    const key = `${q.actorKey}/${q.ability}`;
    if (!abilitySamples.has(key)) {
      abilitySamples.add(key);
      assert.equal(replaySourceHostHit(captureSourceHostHit(r, a.id)).difference, 0);
    }
    return { id: a.id, frame: a.frame, actor: q.actorKey, ability: q.ability, expected, actual: a.rawDamage };
  });
  assert.equal(Object.keys(contribution).length, 4);
  assert.ok(r.applications.at(-1)!.frame > 6900, '120-second denominator alone is insufficient');
  assert.equal(new Set(r.applications.map(a => a.id)).size, r.applications.length);
  assert.equal(new Set(r.applications.map(a => `${a.attackId}/${a.targetKey}`)).size, r.applications.length);
  const model = buildSourceDamageCurve(r), series = curveSeries(model);
  const bursts = r.abilityInvocations!.filter(a => a.action === 'burst');
  assert.equal(bursts.length, 2);
  for (const burst of bursts) {
    assert.equal(burst.characterKey, 'venti');
    const hits = r.applications.filter(a => calculations.get(a.calculationId)!.request.origin?.creationActionSequence === burst.actionSequence);
    // Pinned venti/burst.go: 20 Anemo ticks at 106+24*i, snapshot at 104,
    // and actual energy debit at 84. No absorbable element exists in this case.
    assert.deepEqual(hits.map(a => a.frame), Array.from({ length: 20 }, (_, i) => burst.startedFrame + 106 + 24 * i));
    for (const hit of hits) {
      const q = calculations.get(hit.calculationId)!.request;
      assert.equal(q.ability, "Wind's Grand Ode");
      assert.equal(q.snapshotFrame, burst.startedFrame + 104);
      if (q.kind === 'damage') assert.equal(q.input.scaling, 0.6392); // base Q9, no C3
    }
    assert.ok(r.energyApplications!.some(a => a.operation === 'consume' && a.actorKey === 'venti'
      && a.frame === burst.startedFrame + 84 && a.requestedAmount === 60));
    const beforeInput = r.energyApplications!.filter(a => a.actorKey === 'venti' && a.frame <= burst.startedFrame).at(-1)!;
    assert.equal(beforeInput.energyAfter, 60);
  }
  const total = r.applications.reduce((sum, a) => sum + a.appliedDamage, 0);
  close(series.total, total);
  close(series.points.at(-1)!.cumulative, total);
  close(cumulativeFrameSteps(series.events, 0, 7200).at(-1)!.value, total);
  close(Object.values(contribution).reduce((a, b) => a + b, 0), total);
  for (const [actor, damage] of Object.entries(contribution)) close(curveSeries(model, { actor }).total, damage);
  close((r.result as { total_damage: number }).total_damage, total);
  const energy: Record<string, number> = Object.fromEntries(Object.keys(contribution).map(actor => [actor, 0]));
  for (const a of r.energyApplications ?? []) {
    close(a.energyBefore, energy[a.actorKey]!);
    const expected = a.operation === 'consume' ? Math.max(0, a.energyBefore - a.requestedAmount)
      : Math.min(a.energyMax, a.energyBefore + a.requestedAmount);
    maxEnergyError = Math.max(maxEnergyError, Math.abs(expected - a.energyAfter));
    close(a.energyAfter, expected);
    assert.ok(a.energyAfter >= 0 && a.energyAfter <= a.energyMax);
    if (a.operation === 'consume') {
      assert.equal(a.actorKey, 'venti'); assert.equal(a.requestedAmount, 60); assert.ok(a.energyBefore >= 60);
      assert.equal(replaySourceHostEnergy(captureSourceHostEnergy(r, a.id)).difference, 0);
    }
    energy[a.actorKey] = a.energyAfter;
  }
  const cooldownSamples = new Set<string>();
  for (const c of r.calculations) {
    const q = c.request;
    if (q.kind !== 'character-cooldown' || q.input.operation !== 'duration') continue;
    const key = `${q.actorKey}/${q.input.action}`;
    if (cooldownSamples.has(key)) continue;
    cooldownSamples.add(key);
    assert.equal(replaySourceHostCooldown(captureSourceHostCooldown(r, q.id)).difference, 0);
  }
  const changed = captureSourceHostHit(r, r.applications[0]!.id);
  changed.application.frame++;
  assert.throws(() => replaySourceHostHit(changed), 'changed hit frame must be rejected');
  return { seed: r.seed, sourceCommit: r.sourceCommit, total, dps: total / 120, contribution,
    hitCount: rows.length, lastFrame: rows.at(-1)!.frame, maxDamageError, maxEnergyError,
    independentlyReplayedAbilityKinds: abilitySamples.size, cooldownActorActions: [...cooldownSamples],
    finalEnergy: energy, burstFrames: bursts.map(a => a.startedFrame), rows };
}

if (process.env.GIDPS_AUDIT_INPUT) {
  const report = auditImportedTeam120(JSON.parse(readFileSync(process.env.GIDPS_AUDIT_INPUT, 'utf8')));
  if (process.env.GIDPS_AUDIT_OUTPUT) writeFileSync(process.env.GIDPS_AUDIT_OUTPUT, JSON.stringify(report, null, 2));
  const { rows: _, ...summary } = report;
  console.log(JSON.stringify(summary, null, 2));
}
