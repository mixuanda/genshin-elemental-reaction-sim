import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { appendIansanSwiftHistoricalTalentSite } from './iansan-swift-talent-correction.mjs';

const evidence = JSON.parse(readFileSync(new URL('../../game-data/sources/iansan-swift-native-index-correction/correction-evidence.json', import.meta.url), 'utf8'));
const fixture = () => ({
  manifest: {source: {revision: evidence.sourceCommit}, phasePatches: [{path: evidence.patch.name, sha256: evidence.patch.sha256}]},
  tables: {[evidence.table.tableId]: {tableId: evidence.table.tableId, values: structuredClone(evidence.table.values)}},
  sites: {[evidence.correctedSite.id]: structuredClone(evidence.correctedSite.definition)},
});

test('appends only the exact archived E-index site, leaving the real corrected NA site unchanged', () => {
  const {manifest, tables, sites} = fixture(), before = structuredClone(sites);
  assert.equal(appendIansanSwiftHistoricalTalentSite(evidence.sourceCommit, manifest, tables, sites), true);
  assert.deepEqual(sites[evidence.legacySite.id], evidence.legacySite.definition);
  assert.deepEqual(sites[evidence.correctedSite.id], before[evidence.correctedSite.id]);
  assert.equal(Object.keys(sites).length, 2);
});
test('does not invent a correction or alias for an old build or another pin', () => {
  const {manifest, tables, sites} = fixture();
  assert.equal(appendIansanSwiftHistoricalTalentSite('b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541', manifest, tables, sites), false);
  const old = {[evidence.legacySite.id]: structuredClone(evidence.legacySite.definition)};
  assert.equal(appendIansanSwiftHistoricalTalentSite(evidence.sourceCommit, {source: {revision: evidence.sourceCommit}}, tables, old), false);
  assert.deepEqual(old[evidence.legacySite.id], evidence.legacySite.definition);
});
for (const change of ['patch', 'source', 'kind', 'expression', 'table', 'duplicate']) test(`rejects forged or hybrid ${change} identity even when a coefficient happens to match`, () => {
  const {manifest, tables, sites} = fixture();
  if (change === 'patch') manifest.phasePatches[0].sha256 = '0'.repeat(64);
  if (change === 'source') manifest.source.revision = 'other-pin';
  if (change === 'kind') sites[evidence.correctedSite.id].talentLevelIndices[0].kind = 'skill';
  if (change === 'expression') sites[evidence.correctedSite.id].indexExpressions[0] = 'c.TalentLvlSkill()';
  if (change === 'table') tables[evidence.table.tableId].values[0] = 1.6643;
  if (change === 'duplicate') sites[evidence.legacySite.id] = structuredClone(evidence.legacySite.definition);
  assert.throws(() => appendIansanSwiftHistoricalTalentSite(evidence.sourceCommit, manifest, tables, sites), /identity is invalid/);
});
