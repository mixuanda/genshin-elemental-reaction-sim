/** Observe the authentic historical V153 input; never strip current semantics. */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PIN = '84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5';
const [checkoutArg, outputArg] = process.argv.slice(2);
if (!checkoutArg || !outputArg) throw new Error('Usage: node scripts/capture-historical-electro-charged-cleanup.mjs HISTORICAL_CHECKOUT NEW_OUTPUT_JSON');
const checkout = resolve(checkoutArg), output = resolve(outputArg);
const git = (...args) => execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
if (git('rev-parse', 'HEAD') !== PIN || git('status', '--porcelain', '--untracked-files=all')) throw new Error('A clean checkout of the exact pinned commit is required. Install its locked dependencies first.');
const target = 'packages/sim-core/src/__tests__/electro-charged-cleanup-golden.test.ts';
const frozen = 'packages/test-vectors/fixtures/electro-charged-quicken-cleanup-1.40.golden.json';
for (const flag of ['UPDATE_EC_QUICKEN_CLEANUP_V140_GOLDEN']) {
 if (process.env[flag] === '1') throw new Error('Historical capture requires the original read-only Golden gate.');
}
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
if (sha256(readFileSync(join(checkout, frozen))) !== 'bc1fb0bec7b526c1f3046ef81bb3aac5d947410fc013fbcc8d6fd2c6731563e0') throw new Error('Reviewed Golden bytes changed before capture');
const temp = mkdtempSync(join(tmpdir(), 'gidps-electro-charged-cleanup-capture-'));
const observations = join(temp, 'observations.jsonl'), config = join(temp, 'capture.config.mjs');
const site = 'import { simulate } from "../simulator";';
const wrapper = `
import { appendFileSync as recordHistoricalInput } from 'node:fs';
function simulate(...args: Parameters<typeof originalSimulate>) {
  const result = originalSimulate(...args);
  recordHistoricalInput(${JSON.stringify(observations)}, JSON.stringify({ caseId: args[0].randomSeed, sourceWireText: JSON.stringify(result) }) + '\\n');
  return result;
}`;
writeFileSync(config, `import { defineConfig } from ${JSON.stringify(pathToFileURL(join(checkout, 'node_modules/vitest/dist/config.js')).href)};
export default defineConfig({ root: ${JSON.stringify(checkout)}, json: { stringify: true, namedExports: false },
 plugins: [{ name: 'observe-original-electro-charged-cleanup-input', enforce: 'pre', transform(code, id) {
  if (!id.endsWith(${JSON.stringify('/' + target)})) return;
  const site = ${JSON.stringify(site)};
  if (!code.includes(site)) throw new Error('Pinned import site changed');
  return code.replace(site, ${JSON.stringify(site.replace('simulate }', 'simulate as originalSimulate }'))}) + ${JSON.stringify(wrapper)};
 }}], test: { environment: 'node', include: [${JSON.stringify(target)}], fileParallelism: false, testTimeout: 20000 }
});\n`);
const run = spawnSync(process.execPath, ['--max-old-space-size=256', join(checkout, 'node_modules/vitest/vitest.mjs'), 'run', '--config', config, '--pool', 'forks', '--maxWorkers', '1', '--execArgv=--max-old-space-size=768', '--reporter', 'verbose'], { cwd: checkout, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
process.stdout.write(run.stdout ?? ''); process.stderr.write(run.stderr ?? '');
if (run.error || run.status !== 0) throw run.error ?? new Error(`Historical tests failed: ${run.status}`);
const rows = readFileSync(observations, 'utf8').trim().split('\n').map(line => JSON.parse(line));
const manifest = ['ec-quicken-cleanup-aura-v8-1-0-90','ec-quicken-cleanup-aura-v8-1-5-90'];
const expected = [manifest[0],manifest[0],manifest[1],manifest[1]];
if (JSON.stringify(rows.map(row => row.caseId)) !== JSON.stringify(expected)) throw new Error('Historical input manifest changed');
if(rows[0].sourceWireText!==rows[1].sourceWireText || rows[2].sourceWireText!==rows[3].sourceWireText) throw new Error('Repeated original runs are not byte-identical');
if (git('rev-parse', 'HEAD') !== PIN || git('status', '--porcelain', '--untracked-files=all')) throw new Error('Historical checkout changed during capture');
const paths = [target, frozen, 'packages/test-vectors/src/project-v153-to-v152.ts', 'packages/test-vectors/src/v152-compatibility-config.ts', 'packages/test-vectors/src/reviewed-golden.ts', 'packages/sim-core/src/__tests__/fixtures.ts', 'packages/sim-core/src/simulator.ts', 'packages/sim-core/src/aura.ts', 'packages/sim-core/src/formulas.ts', 'packages/schemas/src/schema.ts', 'packages/schemas/src/result-schema.ts', 'packages/schemas/src/result-integrity.ts', 'package-lock.json'];
if (sha256(readFileSync(join(checkout, frozen))) !== 'bc1fb0bec7b526c1f3046ef81bb3aac5d947410fc013fbcc8d6fd2c6731563e0') throw new Error('Reviewed Golden bytes changed');
const archive = {
 fixtureVersion: 'historical-electro-charged-cleanup-v153-84ff5cd-v1',
 source: { repository: 'mixuanda/genshin-elemental-reaction-sim', commit: PIN, tree: git('rev-parse', 'HEAD^{tree}'),
  method: 'Original one-test EC cleanup Golden suite; simulate import wrapper observes both full V153 F1/F6 inputs without changing their original frozen V140 assertions. All original assertions, including repeated runs and exact reviewed Golden bytes, run unchanged. Repeated source wires are byte-identical. No current-engine result is relabelled or stripped.',
  files: paths.map(path => ({ path, gitBlobSha1: git('rev-parse', `HEAD:${path}`), sha256: sha256(readFileSync(join(checkout, path))) })) },
 cases: [rows[0],rows[2]].map(row => ({ caseId: row.caseId, sourceWireSha256: sha256(row.sourceWireText), sourceWireText: row.sourceWireText }))
};
writeFileSync(output, JSON.stringify(archive, null, 2) + '\n', { flag: 'wx' });
console.log(`Captured genuine historical input; original assertions passed. ${output}`);
