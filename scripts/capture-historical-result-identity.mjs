/** Observe the authentic historical V153 input; never strip current semantics. */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PIN = '84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5';
const [checkoutArg, outputArg] = process.argv.slice(2);
if (!checkoutArg || !outputArg) throw new Error('Usage: node scripts/capture-historical-result-identity.mjs HISTORICAL_CHECKOUT NEW_OUTPUT_JSON');
const checkout = resolve(checkoutArg), output = resolve(outputArg);
const git = (...args) => execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
if (git('rev-parse', 'HEAD') !== PIN || git('status', '--porcelain', '--untracked-files=all')) throw new Error('A clean checkout of the exact pinned commit is required. Install its locked dependencies first.');
const target = 'packages/sim-core/src/__tests__/simulation-result-schema.test.ts';
const temp = mkdtempSync(join(tmpdir(), 'gidps-result-identity-capture-'));
const observations = join(temp, 'observations.jsonl'), config = join(temp, 'capture.config.mjs');
const site = 'import { projectSimulationResultV153ToV152 } from "../../../test-vectors/src/project-v153-to-v152";';
const wrapper = `
import { appendFileSync as recordHistoricalInput } from 'node:fs';
function projectSimulationResultV153ToV152(...args: Parameters<typeof originalProjection>) {
  recordHistoricalInput(${JSON.stringify(observations)}, JSON.stringify({ caseId: 'same-frame-superconduct', sourceWireText: JSON.stringify(args[0]) }) + '\\n');
  return originalProjection(...args);
}`;
writeFileSync(config, `import { defineConfig } from ${JSON.stringify(pathToFileURL(join(checkout, 'node_modules/vitest/dist/config.js')).href)};
export default defineConfig({ root: ${JSON.stringify(checkout)}, json: { stringify: true, namedExports: false },
 plugins: [{ name: 'observe-original-result-identity-input', enforce: 'pre', transform(code, id) {
  if (!id.endsWith(${JSON.stringify('/' + target)})) return;
  const site = ${JSON.stringify(site)};
  if (!code.includes(site)) throw new Error('Pinned import site changed');
  return code.replace(site, ${JSON.stringify(site.replace('projectSimulationResultV153ToV152 }', 'projectSimulationResultV153ToV152 as originalProjection }'))}) + ${JSON.stringify(wrapper)};
 }}], test: { environment: 'node', include: [${JSON.stringify(target)}], fileParallelism: false, testTimeout: 20000 }
});\n`);
const run = spawnSync(process.execPath, ['--max-old-space-size=256', join(checkout, 'node_modules/vitest/vitest.mjs'), 'run', '--config', config, '-t', 'keeps persisted 1[.]42 and frozen 1[.]44-1[.]52 result identities separate$', '--pool', 'forks', '--maxWorkers', '1', '--execArgv=--max-old-space-size=768', '--reporter', 'verbose'], { cwd: checkout, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
process.stdout.write(run.stdout ?? ''); process.stderr.write(run.stderr ?? '');
if (run.error || run.status !== 0) throw run.error ?? new Error(`Historical tests failed: ${run.status}`);
const rows = readFileSync(observations, 'utf8').trim().split('\n').map(line => JSON.parse(line));
if (rows.length !== 1 || rows[0].caseId !== 'same-frame-superconduct') throw new Error('Historical input manifest changed');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const paths = [target, ...[153, 152, 151, 150, 149, 148].map(v => `packages/test-vectors/src/project-v${v}-to-v${v - 1}.ts`), 'packages/sim-core/src/__tests__/fixtures.ts', 'packages/sim-core/src/simulator.ts', 'packages/schemas/src/schema.ts', 'packages/schemas/src/result-schema.ts', 'packages/schemas/src/result-integrity.ts', 'package-lock.json'];
const archive = {
 fixtureVersion: 'historical-result-identity-v153-84ff5cd-v1',
 source: { repository: 'mixuanda/genshin-elemental-reaction-sim', commit: PIN, tree: git('rev-parse', 'HEAD^{tree}'),
  method: 'Original simulation-result schema identity test selected by its exact unique title; import wrapper observes the immutable V153 same-frame Superconduct input before its frozen identity projection. All assertions of that selected historical identity test run unchanged; this is not a claim that the entire historical suite passes. No current-engine result is relabelled or stripped.',
  files: paths.map(path => ({ path, gitBlobSha1: git('rev-parse', `HEAD:${path}`), sha256: sha256(readFileSync(join(checkout, path))) })) },
 cases: rows.map(row => ({ caseId: row.caseId, sourceWireSha256: sha256(row.sourceWireText), sourceWireText: row.sourceWireText }))
};
writeFileSync(output, JSON.stringify(archive, null, 2) + '\n', { flag: 'wx' });
console.log(`Captured genuine historical input; original assertions passed. ${output}`);
