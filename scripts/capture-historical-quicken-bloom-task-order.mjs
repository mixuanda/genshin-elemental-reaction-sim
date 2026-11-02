/** Observe original historical Quicken/Bloom assertions without changing them. */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PIN = '84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5';
const [checkoutArg, outputArg] = process.argv.slice(2);
if (!checkoutArg || !outputArg) throw new Error('Usage: node scripts/capture-historical-quicken-bloom-task-order.mjs HISTORICAL_CHECKOUT NEW_OUTPUT_JSON');
const checkout = resolve(checkoutArg), output = resolve(outputArg);
const git = (...args) => execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
const assertCleanPin = () => {
 if (git('rev-parse', 'HEAD') !== PIN || git('status', '--porcelain', '--untracked-files=all')) throw new Error('A clean checkout of the exact pinned commit is required. Install its locked dependencies first.');
};
assertCleanPin();
const target = 'packages/sim-core/src/__tests__/quicken-bloom-task-order.test.ts';
const frozenHashes = {
 '1.36': '6a1b2840ff3f6e2d8abbba0b80e98823336ab33cca3a6658fef4223974cdae84',
 '1.37': 'd7d6a4c5ec77fcc658f024b44044765cac74f5d60e59bff4fa4d8ed49317bfb6',
 '1.38': '07b35af482d2cf1f5cf77eb978682c51eb014300413ea516973dba1807863cfc',
 '1.39': 'a09f6c001bc0282299f96a81232fab56caa0803f3b5b83f4d85233772ef50534',
 '1.40': 'b13f96768e589b77ff62daef1fd5cae0a3b1bab2a98fc88ce7c3f415356805b4',
};
const temp = mkdtempSync(join(tmpdir(), 'gidps-quicken-bloom-capture-'));
const observations = join(temp, 'observations.jsonl'), config = join(temp, 'capture.config.mjs');
const first = 'function projectTaskOrderResult(result: SimulationResult) {';
const second = '      expect(\n        phased.targetTaskPhaseLog.length,';
const recordGolden = `\n recordHistoricalQuicken(${JSON.stringify(observations)},JSON.stringify({kind:'golden',caseId:result.config.randomSeed,sourceWireText:JSON.stringify(result)})+'\\n');`;
const recordProfiles = `      for (const [mode,result] of [['legacy-event-heap-v1',legacy],['target-phase-v1',phased],['target-phase-v2',phasedV2]] as const) recordHistoricalQuicken(${JSON.stringify(observations)},JSON.stringify({kind:'profile',caseId:scenario+'/'+mode,sourceWireText:JSON.stringify(result)})+'\\n');\n`;
writeFileSync(config, `import { defineConfig } from ${JSON.stringify(pathToFileURL(join(checkout, 'node_modules/vitest/dist/config.js')).href)};
export default defineConfig({root:${JSON.stringify(checkout)},json:{stringify:true,namedExports:false},plugins:[{name:'observe-original-quicken-input',enforce:'pre',transform(code,id){
 if(!id.endsWith(${JSON.stringify('/'+target)}))return;
 const first=${JSON.stringify(first)},second=${JSON.stringify(second)};
 if(code.split(first).length!==2||code.split(second).length!==2)throw Error('Pinned observation sites changed');
 return 'import { appendFileSync as recordHistoricalQuicken } from "node:fs";\\n'+code.replace(first,first+${JSON.stringify(recordGolden)}).replace(second,${JSON.stringify(recordProfiles)}+second);
}}],test:{environment:'node',include:[${JSON.stringify(target)}],fileParallelism:false,testTimeout:20000}});\n`);
const run = spawnSync(process.execPath, ['--max-old-space-size=256', join(checkout, 'node_modules/vitest/vitest.mjs'), 'run', '--config', config, '--pool', 'forks', '--maxWorkers', '1', '--execArgv=--max-old-space-size=768', '--reporter', 'verbose'], { cwd: checkout, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
process.stdout.write(run.stdout ?? ''); process.stderr.write(run.stderr ?? '');
if (run.error || run.status !== 0) throw run.error ?? new Error(`Historical tests failed: ${run.status}`);
const rows = readFileSync(observations, 'utf8').trim().split('\n').map(line => JSON.parse(line));
const goldenCases = {
 'quicken-bloom-task-order-aura-v7-fifo': 'fifo',
 'quicken-bloom-task-order-aura-v7-hydro-removes-quicken': 'missingQuicken',
 'quicken-bloom-task-order-aura-v7-cryo-removes-hydro': 'missingHydro',
 'quicken-bloom-task-order-aura-v6-fifo': 'auraV6Compatibility',
};
const profiles = ['legacy-event-heap-v1', 'target-phase-v1', 'target-phase-v2'];
const expected = [...Object.keys(goldenCases).map(id => 'golden:'+id), ...['fifo','missing-quicken','missing-hydro'].flatMap(id => profiles.map(mode => 'profile:'+id+'/'+mode))];
if (JSON.stringify(rows.map(row => row.kind+':'+row.caseId)) !== JSON.stringify(expected)) throw new Error('Historical observation manifest changed');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const cases = new Map();
for (const row of rows) {
 const caseId = row.kind === 'golden' ? goldenCases[row.caseId]+'/legacy-event-heap-v1' : row.caseId.replace('missing-quicken','missingQuicken').replace('missing-hydro','missingHydro');
 const previous = cases.get(caseId);
 if (previous) {
  if (previous.sourceWireText !== row.sourceWireText) throw new Error(`Original repeated result differs: ${caseId}`);
  previous.observedAt.push(row.kind+':'+row.caseId);
 } else cases.set(caseId, {caseId, observedAt:[row.kind+':'+row.caseId], sourceWireSha256:sha256(row.sourceWireText),sourceWireText:row.sourceWireText});
}
if(cases.size!==10)throw new Error('Expected exactly ten distinct original inputs');
assertCleanPin();
const frozenPaths = Object.keys(frozenHashes).map(version => {
 const path = `packages/test-vectors/fixtures/quicken-bloom-task-order-${version}.golden.json`;
 if(sha256(readFileSync(join(checkout,path)))!==frozenHashes[version])throw new Error(`Frozen Golden bytes changed: ${version}`);
 return path;
});
const paths = [target,...frozenPaths,'packages/sim-core/src/__tests__/fixtures.ts','packages/sim-core/src/simulator.ts','packages/sim-core/src/aura.ts','packages/sim-core/src/formulas.ts','packages/schemas/src/schema.ts','packages/schemas/src/result-schema.ts','packages/schemas/src/result-integrity.ts','package-lock.json'];
const archive = {fixtureVersion:'historical-quicken-bloom-task-order-v153-84ff5cd-v1',source:{repository:'mixuanda/genshin-elemental-reaction-sim',commit:PIN,tree:git('rev-parse','HEAD^{tree}'),method:'Original six-test Quicken/Bloom suite; read-only observers capture four genuine V153 inputs before all five original Golden comparisons and nine profile inputs before original causal/equality assertions. Three repeated legacy wires must be byte-identical; all original assertions execute unchanged. No current wire is stripped, renumbered or relabelled.',files:paths.map(path=>({path,gitBlobSha1:git('rev-parse',`HEAD:${path}`),sha256:sha256(readFileSync(join(checkout,path)))}))},cases:[...cases.values()]};
writeFileSync(output, JSON.stringify(archive,null,2)+'\n', {flag:'wx'});
console.log(`Captured genuine historical inputs; all original assertions passed. ${output}`);
