import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Deliberately independent of all production artifact/equipment/score functions.
// Recompute the archived before/after from the pinned raw JSON tables.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const evidence = read('docs/fixtures/wanderer-graduation-budget-20261022.json');
const catalogRoot = `packages/game-data/manifests/runtime/datasets/${evidence.snapshotId}`;
const catalog = read(`${catalogRoot}/catalog.json`);
const supplemental = read(`${catalogRoot}/supplemental.json`);
const main = read('packages/game-data/sources/artifacts/artifact_main.json')['5'];
const sub = read('packages/game-data/sources/artifacts/artifact_sub.json')['5'];
const artifactSource = read('packages/game-data/sources/artifacts/manifest.json');
assert.equal(artifactSource.sourceCommit, evidence.artifactSourceCommit);
const character = catalog.characters.find(item => item.id === 'character:10000075');
const allowed = {
  flower: ['hp'], plume: ['atk'], sands: ['hp_', 'def_', 'atk_', 'eleMas', 'enerRech_'],
  goblet: ['hp_', 'def_', 'atk_', 'eleMas', 'physical_dmg_', 'pyro_dmg_', 'hydro_dmg_', 'cryo_dmg_', 'electro_dmg_', 'anemo_dmg_', 'geo_dmg_', 'dendro_dmg_'],
  circlet: ['hp_', 'def_', 'atk_', 'eleMas', 'critRate_', 'critDMG_', 'heal_'],
};
const same = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const tierBag = piece => piece.substats.flatMap(item => item.rolls).sort();
function verifyPieces(pieces) {
  assert.equal(pieces.length, 5);
  assert.equal(new Set(pieces.map(piece => piece.slot)).size, 5);
  return pieces.map(piece => {
    assert.equal(piece.rarity, 5);
    assert.equal(piece.level, 20);
    assert.ok(!piece.observed);
    assert.ok([3, 4].includes(piece.initialSubstats));
    assert.ok(allowed[piece.slot].includes(piece.mainStat));
    const set = supplemental.artifactSets.find(item => item.id === piece.setId);
    assert.ok(set.rarityList.includes(5) && set.slots.some(item => item.slot === piece.slot));
    assert.equal(piece.substats.length, 4);
    assert.equal(new Set(piece.substats.map(item => item.stat)).size, 4);
    for (const item of piece.substats) {
      assert.notEqual(item.stat, piece.mainStat);
      assert.ok(item.rolls.length >= 1 && item.rolls.length <= piece.initialSubstats + 2);
      for (const tier of item.rolls) assert.ok(Number.isInteger(tier) && sub[item.stat][tier] !== undefined);
    }
    const rolls = tierBag(piece).length;
    assert.equal(rolls, piece.initialSubstats + 5);
    return { slot: piece.slot, initialSubstats: piece.initialSubstats, rolls,
      largestSubstatCount: Math.max(...piece.substats.map(item => item.rolls.length)) };
  });
}
function panel(summary, pieces) {
  const weapon = catalog.weapons.find(item => item.id === summary.weaponId);
  const value = (kind, item, key) => item.stats.base[key] * supplemental.statCurves[kind]['90'][item.stats.curve[key]]
    + (key === 'specialized' ? 0 : item.stats.promotion[6][key]);
  const totals = {};
  const add = (key, amount) => { totals[key] = (totals[key] ?? 0) + amount; };
  for (const piece of pieces) {
    add(piece.mainStat, main[piece.mainStat][20]);
    for (const item of piece.substats) for (const tier of item.rolls) add(item.stat, sub[item.stat][tier]);
  }
  add('critRate_', character.stats.base.critrate);
  add('critDMG_', character.stats.base.critdmg);
  const specialized = { FIGHT_PROP_CRITICAL: 'critRate_', FIGHT_PROP_CRITICAL_HURT: 'critDMG_', FIGHT_PROP_ATTACK_PERCENT: 'atk_' };
  add(specialized[character.stats.specialized], character.stats.promotion[6].specialized);
  add(specialized[weapon.stats.specialized], value('weapons', weapon, 'specialized'));
  const attack = (value('characters', character, 'attack') + value('weapons', weapon, 'attack')) * (1 + (totals.atk_ ?? 0)) + (totals.atk ?? 0);
  const actual = { attack, critRate: totals.critRate_, critDamage: totals.critDMG_, energyRecharge: 1 + (totals.enerRech_ ?? 0),
    expectedDirectFactor: attack * (1 + Math.min(1, Math.max(0, totals.critRate_)) * Math.max(0, totals.critDMG_)) };
  for (const [key, result] of Object.entries(actual)) same(result, summary[key]);
  return actual;
}
let starterScore;
for (const row of evidence.rows) {
  const before = row.fixedContextBefore, after = row.after;
  const beforeBudget = verifyPieces(before.artifacts), afterBudget = verifyPieces(after.artifacts);
  assert.equal(before.weaponId, after.weaponId);
  assert.deepEqual(before.talents, after.talents);
  for (const [index, piece] of after.artifacts.entries()) {
    const original = before.artifacts[index];
    for (const key of ['slot', 'setId', 'rarity', 'level', 'mainStat', 'initialSubstats']) assert.equal(piece[key], original[key]);
    assert.deepEqual(piece.substats.map(item => item.stat), original.substats.map(item => item.stat));
    assert.deepEqual(tierBag(piece), tierBag(original));
  }
  panel(row.original, before.artifacts);
  const oldPanel = panel(before, before.artifacts), newPanel = panel(after, after.artifacts);
  assert.ok(newPanel.expectedDirectFactor >= oldPanel.expectedDirectFactor);
  if (row.tier === 'starter') starterScore = newPanel.expectedDirectFactor;
  else assert.ok(newPanel.expectedDirectFactor >= starterScore);
  console.log(JSON.stringify({ tier: row.tier, totalRollsBefore: beforeBudget.reduce((sum, piece) => sum + piece.rolls, 0),
    totalRollsAfter: afterBudget.reduce((sum, piece) => sum + piece.rolls, 0), pieces: afterBudget,
    before: oldPanel, after: newPanel, gainPercent: 100 * (newPanel.expectedDirectFactor / oldPanel.expectedDirectFactor - 1) }));
}
console.log('Independent raw-table budget, main/substat exclusion, per-piece tier-quality and direct-factor audit passed.');
