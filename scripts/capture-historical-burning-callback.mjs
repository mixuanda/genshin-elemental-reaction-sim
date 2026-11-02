/** Capture genuine pre-marker input while all original Burning Golden assertions execute. */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PIN = '84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5';
const FROZEN_SHA = '4caf9609daac1fde41195399e5c3af8daca60e14849aa4c5195b286ae947da65';
const UPDATE_FLAG = 'UPDATE_BURNING_CALLBACK_DELIVERY_V144_GOLDEN';
const [checkoutArg, outputArg] = process.argv.slice(2);
if (!checkoutArg || !outputArg) throw new Error('Usage: node scripts/capture-historical-burning-callback.mjs HISTORICAL_CHECKOUT NEW_OUTPUT_JSON');
if (process.env[UPDATE_FLAG] === '1') throw new Error('Historical capture is read-only; Golden updates are forbidden.');
const checkout = resolve(checkoutArg), output = resolve(outputArg);
const git = (...args) => execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
const assertCleanPin = () => {
  if (git('rev-parse', 'HEAD') !== PIN || git('status', '--porcelain', '--untracked-files=all')) throw new Error('A clean checkout of the exact pinned commit is required. Install its locked dependencies first.');
};
assertCleanPin();
const target = 'packages/sim-core/src/__tests__/burning-callback-delivery-golden.test.ts';
const frozenPath = 'packages/test-vectors/fixtures/burning-callback-delivery-1.44.golden.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
if (sha256(readFileSync(join(checkout, frozenPath))) !== FROZEN_SHA) throw new Error('Frozen Burning callback Golden bytes changed.');
const temp = mkdtempSync(join(tmpdir(), 'gidps-burning-callback-capture-'));
const observations = join(temp, 'observations.jsonl'), config = join(temp, 'capture.config.mjs');
const needle = '    const frozenV149TargetPhaseFacet =';
const record = `    recordHistoricalBurning(${JSON.stringify(observations)},JSON.stringify({first:JSON.stringify(first),repeated:JSON.stringify(repeated)})+'\\n');\n`;
writeFileSync(config, `import { defineConfig } from ${JSON.stringify(pathToFileURL(join(checkout, 'node_modules/vitest/dist/config.js')).href)};
export default defineConfig({root:${JSON.stringify(checkout)},json:{stringify:true,namedExports:false},plugins:[{name:'observe-original-burning-input',enforce:'pre',transform(code,id){
 if(!id.endsWith(${JSON.stringify('/'+target)}))return;
 const needle=${JSON.stringify(needle)};
 if(code.split(needle).length!==2)throw Error('Pinned observation site changed');
 return 'import { appendFileSync as recordHistoricalBurning } from "node:fs";\\n'+code.replace(needle,${JSON.stringify(record)}+needle);
}}],test:{environment:'node',include:[${JSON.stringify(target)}],fileParallelism:false,testTimeout:20000}});\n`);
const run = spawnSync(process.execPath, ['--max-old-space-size=256', join(checkout, 'node_modules/vitest/vitest.mjs'), 'run', '--config', config, '--pool', 'forks', '--maxWorkers', '1', '--execArgv=--max-old-space-size=768', '--reporter', 'verbose'], { cwd: checkout, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
process.stdout.write(run.stdout ?? ''); process.stderr.write(run.stderr ?? '');
if (run.error || run.status !== 0) throw run.error ?? new Error(`Historical test failed: ${run.status}`);
const rows = readFileSync(observations, 'utf8').trim().split('\n').map(line => JSON.parse(line));
if (rows.length !== 1 || typeof rows[0].first !== 'string' || rows[0].first !== rows[0].repeated) throw new Error('Expected one pair of byte-identical original full results.');
assertCleanPin();
if (sha256(readFileSync(join(checkout, frozenPath))) !== FROZEN_SHA) throw new Error('Frozen Burning callback Golden bytes changed during capture.');
const paths = [target, frozenPath, 'packages/sim-core/src/__tests__/fixtures.ts', 'packages/sim-core/src/simulator.ts', 'packages/sim-core/src/aura.ts', 'packages/sim-core/src/formulas.ts', 'packages/schemas/src/schema.ts', 'packages/schemas/src/result-schema.ts', 'packages/schemas/src/result-integrity.ts', ...['153-to-v152', '152-to-v151', '151-to-v150', '150-to-v149'].map(version => `packages/test-vectors/src/project-v${version}.ts`), 'package-lock.json'];
const archive = {
  fixtureVersion: 'historical-burning-callback-v153-84ff5cd-v1',
  source: { repository: 'mixuanda/genshin-elemental-reaction-sim', commit: PIN, tree: git('rev-parse', 'HEAD^{tree}'), method: 'Original single-test Burning callback Golden suite; a read-only observer captures both genuine full V153 results before the frozen projector. Original deterministic/public/trusted/frozen-facet/backlink/semantic/byte assertions all execute unchanged. The two raw wires must be byte-identical. No current result is stripped, renumbered or relabelled.', files: paths.map(path => ({path, gitBlobSha1: git('rev-parse', `HEAD:${path}`), sha256: sha256(readFileSync(join(checkout, path)))})) },
  sourceWireSha256: sha256(rows[0].first), sourceWireText: rows[0].first,
};
writeFileSync(output, JSON.stringify(archive, null, 2)+'\n', {flag:'wx'});
console.log(`Captured genuine historical input; all original assertions passed. ${output}`);
