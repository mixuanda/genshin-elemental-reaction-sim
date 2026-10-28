import { readFileSync } from 'node:fs';

const evidence = JSON.parse(readFileSync(new URL('../../game-data/sources/iansan-swift-native-index-correction/correction-evidence.json', import.meta.url), 'utf8'));
const matches = (site, expected) => site?.tableId === expected.tableId
  && JSON.stringify(site.indexExpressions) === JSON.stringify(expected.indexExpressions)
  && JSON.stringify(site.talentLevelIndices) === JSON.stringify(expected.talentLevelIndices)
  && site.rangeSource === undefined;

/** Preserve exactly the independently archived old a7 site after its producer
 * moves to the real patched line. No caller-supplied aliases or numeric match. */
export function appendIansanSwiftHistoricalTalentSite(commit, manifest, tables, sites) {
  if (commit !== evidence.sourceCommit) return false;
  const patches = manifest.phasePatches?.filter(row => row.path === evidence.patch.name) ?? [];
  const patch = patches[0];
  const current = sites[evidence.correctedSite.id];
  if (!patch && !current) return false; // Uncorrected build: its original Skill site remains unchanged.
  if (manifest.source?.revision !== commit || patches.length !== 1 || patch?.sha256 !== evidence.patch.sha256
    || !matches(current, evidence.correctedSite.definition)
    || tables[evidence.table.tableId]?.tableId !== evidence.table.tableId
    || JSON.stringify(tables[evidence.table.tableId]?.values) !== JSON.stringify(evidence.table.values)
    || Object.prototype.hasOwnProperty.call(sites, evidence.legacySite.id)) {
    throw new Error('Iansan Swift corrected build/patch/table/site identity is invalid; historical alias not added');
  }
  sites[evidence.legacySite.id] = structuredClone(evidence.legacySite.definition);
  return true;
}
