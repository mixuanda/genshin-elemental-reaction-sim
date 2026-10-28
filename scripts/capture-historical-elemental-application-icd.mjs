/** Capture all original elemental-icd runs without changing any historical assertion. */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PIN = '84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5';
const FROZEN_SHA = '9238417a2b2e54414366ecb7bb9eeba7ed2070845dff0e6c978af8e96673ddf7';
const UPDATE_FLAG = 'UPDATE_ELEMENTAL_APPLICATION_ICD_V147_GOLDEN';
const [checkoutArg, outputArg] = process.argv.slice(2);
if (!checkoutArg || !outputArg) throw new Error('Usage: node scripts/capture-historical-elemental-application-icd.mjs HISTORICAL_CHECKOUT NEW_OUTPUT_JSON');
if (process.env[UPDATE_FLAG] === '1' || process.env.PREVIEW_ELEMENTAL_APPLICATION_ICD_V147_GOLDEN === '1') throw new Error('Historical capture is read-only; Golden updates are forbidden.');
const checkout = resolve(checkoutArg), output = resolve(outputArg);
const git = (...args) => execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
const assertCleanPin = () => {
  if (git('rev-parse', 'HEAD') !== PIN || git('status', '--porcelain', '--untracked-files=all')) throw new Error('A clean checkout of the exact pinned commit is required. Install its locked dependencies first.');
};
assertCleanPin();
const target = 'packages/sim-core/src/__tests__/elemental-application-icd-golden.test.ts';
const frozenPath = 'packages/test-vectors/fixtures/elemental-application-icd-1.47.golden.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
if (sha256(readFileSync(join(checkout, frozenPath))) !== FROZEN_SHA) throw new Error('Frozen elemental-application-icd Golden bytes changed.');
const temp = mkdtempSync(join(tmpdir(), 'gidps-elemental-icd-capture-'));
const observations = join(temp, 'observations.jsonl'), config = join(temp, 'capture.config.mjs');
const needle = 'simulate(makeVectorConfig(), OPTIONS)';
const replacement = `((observed) => { recordHistoricalElementalIcd(${JSON.stringify(observations)},JSON.stringify(observed)+'\\n'); return observed; })(simulate(makeVectorConfig(), OPTIONS))`;
writeFileSync(config, `import { defineConfig } from ${JSON.stringify(pathToFileURL(join(checkout, 'node_modules/vitest/dist/config.js')).href)};
export default defineConfig({root:${JSON.stringify(checkout)},json:{stringify:true,namedExports:false},plugins:[{name:'observe-original-elemental-icd-input',enforce:'pre',transform(code,id){
 if(!id.endsWith(${JSON.stringify('/'+target)}))return;
 const needle=${JSON.stringify(needle)};
 if(code.split(needle).length!==2)throw Error('Pinned observation site changed');
 return 'import { appendFileSync as recordHistoricalElementalIcd } from "node:fs";\\n'+code.replace(needle,${JSON.stringify(replacement)});
}}],test:{environment:'node',include:[${JSON.stringify(target)}],fileParallelism:false,testTimeout:20000}});\n`);
const run = spawnSync(process.execPath, ['--max-old-space-size=256', join(checkout, 'node_modules/vitest/vitest.mjs'), 'run', '--config', config, '--pool', 'forks', '--maxWorkers', '1', '--execArgv=--max-old-space-size=768', '--reporter', 'verbose'], { cwd: checkout, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
process.stdout.write(run.stdout ?? ''); process.stderr.write(run.stderr ?? '');
if (run.error || run.status !== 0) throw run.error ?? new Error(`Historical tests failed: ${run.status}`);
const wires = readFileSync(observations, 'utf8').trim().split('\n');
if (wires.length !== 2 || new Set(wires).size !== 1) throw new Error('Expected both original runs to produce byte-identical full results.');
assertCleanPin();
if (sha256(readFileSync(join(checkout, frozenPath))) !== FROZEN_SHA) throw new Error('Frozen elemental-application-icd bytes changed during capture.');
const paths = [target, frozenPath, 'packages/sim-core/src/__tests__/fixtures.ts', 'packages/sim-core/src/simulator.ts', 'packages/sim-core/src/elemental-application-icd.ts', 'packages/icd-profiles/src/application-profile.ts', 'packages/sim-core/src/aura.ts', 'packages/sim-core/src/formulas.ts', 'packages/schemas/src/schema.ts', 'packages/schemas/src/result-schema.ts', 'packages/schemas/src/result-integrity.ts', 'packages/test-vectors/src/project-v153-to-v152.ts', 'packages/test-vectors/src/project-v152-to-v151.ts', 'packages/test-vectors/src/project-v151-to-v150.ts', 'packages/test-vectors/src/project-v150-to-v149.ts', 'packages/test-vectors/src/project-v149-to-v148.ts', 'packages/test-vectors/src/project-v148-to-v147.ts', 'package-lock.json'];
const archive = {
  fixtureVersion: 'historical-elemental-application-icd-v153-84ff5cd-v1',
  source: { repository: 'mixuanda/genshin-elemental-reaction-sim', commit: PIN, tree: git('rev-parse', 'HEAD^{tree}'), method: 'Original four-test elemental-application ICD Golden suite; a read-only observer captures both full V153 simulation results before projection. All original deterministic/public/trusted/shared-window/zero-gauge/tail/reset/reference/semantic/byte/no-overwrite assertions execute unchanged. Both raw wires must be byte-identical. No current output is stripped, renumbered or relabelled.', files: paths.map(path => ({path, gitBlobSha1: git('rev-parse', `HEAD:${path}`), sha256: sha256(readFileSync(join(checkout, path)))})) },
  observedRunCount: wires.length, sourceWireSha256: sha256(wires[0]), sourceWireText: wires[0],
};
writeFileSync(output, JSON.stringify(archive, null, 2)+'\n', {flag:'wx'});
console.log(`Captured genuine historical input; all original assertions passed. ${output}`);
