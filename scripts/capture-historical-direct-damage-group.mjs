/** Capture all original direct-group runs without changing any historical assertion. */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PIN = '84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5';
const FROZEN_SHA = 'eebbd992dddbf4a24b16dd5c9d00a31a2c6d107372ba9fc58994181061156899';
const UPDATE_FLAG = 'UPDATE_DIRECT_DAMAGE_GROUP_V146_GOLDEN';
const [checkoutArg, outputArg] = process.argv.slice(2);
if (!checkoutArg || !outputArg) throw new Error('Usage: node scripts/capture-historical-direct-damage-group.mjs HISTORICAL_CHECKOUT NEW_OUTPUT_JSON');
if (process.env[UPDATE_FLAG] === '1') throw new Error('Historical capture is read-only; Golden updates are forbidden.');
const checkout = resolve(checkoutArg), output = resolve(outputArg);
const git = (...args) => execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
const assertCleanPin = () => {
  if (git('rev-parse', 'HEAD') !== PIN || git('status', '--porcelain', '--untracked-files=all')) throw new Error('A clean checkout of the exact pinned commit is required. Install its locked dependencies first.');
};
assertCleanPin();
const target = 'packages/sim-core/src/__tests__/direct-damage-group-golden.test.ts';
const frozenPath = 'packages/test-vectors/fixtures/direct-damage-group-1.46.golden.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
if (sha256(readFileSync(join(checkout, frozenPath))) !== FROZEN_SHA) throw new Error('Frozen direct-damage-group Golden bytes changed.');
const temp = mkdtempSync(join(tmpdir(), 'gidps-direct-group-capture-'));
const observations = join(temp, 'observations.jsonl'), config = join(temp, 'capture.config.mjs');
const needle = '  return simulate(makeVectorConfig(), OPTIONS);';
const replacement = `  const observed = simulate(makeVectorConfig(), OPTIONS);\n  recordHistoricalDirectGroup(${JSON.stringify(observations)},JSON.stringify(observed)+'\\n');\n  return observed;`;
writeFileSync(config, `import { defineConfig } from ${JSON.stringify(pathToFileURL(join(checkout, 'node_modules/vitest/dist/config.js')).href)};
export default defineConfig({root:${JSON.stringify(checkout)},json:{stringify:true,namedExports:false},plugins:[{name:'observe-original-direct-group-input',enforce:'pre',transform(code,id){
 if(!id.endsWith(${JSON.stringify('/'+target)}))return;
 const needle=${JSON.stringify(needle)};
 if(code.split(needle).length!==2)throw Error('Pinned observation site changed');
 return 'import { appendFileSync as recordHistoricalDirectGroup } from "node:fs";\\n'+code.replace(needle,${JSON.stringify(replacement)});
}}],test:{environment:'node',include:[${JSON.stringify(target)}],fileParallelism:false,testTimeout:20000}});\n`);
const run = spawnSync(process.execPath, ['--max-old-space-size=256', join(checkout, 'node_modules/vitest/vitest.mjs'), 'run', '--config', config, '--pool', 'forks', '--maxWorkers', '1', '--execArgv=--max-old-space-size=768', '--reporter', 'verbose'], { cwd: checkout, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
process.stdout.write(run.stdout ?? ''); process.stderr.write(run.stderr ?? '');
if (run.error || run.status !== 0) throw run.error ?? new Error(`Historical tests failed: ${run.status}`);
const wires = readFileSync(observations, 'utf8').trim().split('\n');
if (wires.length !== 3 || new Set(wires).size !== 1) throw new Error('Expected all three original runs to produce byte-identical full results.');
assertCleanPin();
if (sha256(readFileSync(join(checkout, frozenPath))) !== FROZEN_SHA) throw new Error('Frozen direct-damage-group bytes changed during capture.');
const paths = [target, frozenPath, 'packages/sim-core/src/__tests__/fixtures.ts', 'packages/sim-core/src/simulator.ts', 'packages/sim-core/src/direct-damage-group.ts', 'packages/sim-core/src/formulas.ts', 'packages/schemas/src/schema.ts', 'packages/schemas/src/result-schema.ts', 'packages/schemas/src/result-integrity.ts', 'packages/test-vectors/src/project-v153-to-v152.ts', 'packages/test-vectors/src/project-v152-to-v151.ts', 'package-lock.json'];
const archive = {
  fixtureVersion: 'historical-direct-damage-group-v153-84ff5cd-v1',
  source: { repository: 'mixuanda/genshin-elemental-reaction-sim', commit: PIN, tree: git('rev-parse', 'HEAD^{tree}'), method: 'Original three-test direct-damage-group Golden suite; a read-only observer captures every full V153 runVector result before its consumer. All original deterministic/public/trusted/group/zero/tail/reset/semantic/byte/creation/no-overwrite assertions execute unchanged. All three raw wires must be byte-identical. No current output is stripped, renumbered or relabelled.', files: paths.map(path => ({path, gitBlobSha1: git('rev-parse', `HEAD:${path}`), sha256: sha256(readFileSync(join(checkout, path)))})) },
  observedRunCount: wires.length, sourceWireSha256: sha256(wires[0]), sourceWireText: wires[0],
};
writeFileSync(output, JSON.stringify(archive, null, 2)+'\n', {flag:'wx'});
console.log(`Captured genuine historical input; all original assertions passed. ${output}`);
