/** Capture authentic historical Shatter results without altering any assertion. */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PIN = '84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5';
const [checkoutArg, outputArg] = process.argv.slice(2);
if (!checkoutArg || !outputArg) throw new Error('Usage: node scripts/capture-historical-shatter-recursive.mjs HISTORICAL_CHECKOUT NEW_OUTPUT_JSON');
const checkout = resolve(checkoutArg), output = resolve(outputArg);
const git = (...args) => execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
const assertCleanPin = () => {
 if (git('rev-parse', 'HEAD') !== PIN || git('status', '--porcelain', '--untracked-files=all')) throw new Error('A clean checkout of the exact pinned commit is required. Install its locked dependencies first.');
};
assertCleanPin();
if (process.env.UPDATE_SHATTER_RECURSIVE_DELIVERY_GOLDEN === '1') throw new Error('Historical capture is read-only; Golden update is forbidden.');
const target = 'packages/sim-core/src/__tests__/shatter-recursive-delivery.test.ts';
const frozen = 'packages/test-vectors/fixtures/shatter-recursive-delivery-1.39.golden.json';
const temp = mkdtempSync(join(tmpdir(), 'gidps-shatter-recursive-capture-'));
const observations = join(temp, 'observations.jsonl'), config = join(temp, 'capture.config.mjs');
const site = 'function expectShatterGolden(\n  scenarioId: ShatterGoldenScenarioId,\n  result: SimulationResult,\n): void {';
const observation = `\n recordHistoricalInput(${JSON.stringify(observations)}, JSON.stringify({ caseId: scenarioId, sourceWireText: JSON.stringify(result) }) + '\\n');`;
writeFileSync(config, `import { defineConfig } from ${JSON.stringify(pathToFileURL(join(checkout, 'node_modules/vitest/dist/config.js')).href)};
export default defineConfig({ root: ${JSON.stringify(checkout)}, json: { stringify: true, namedExports: false },
 plugins: [{ name: 'observe-original-shatter-golden-input', enforce: 'pre', transform(code, id) {
  if (!id.endsWith(${JSON.stringify('/' + target)})) return;
  const site = ${JSON.stringify(site)};
  if (code.split(site).length !== 2) throw new Error('Pinned observation site changed');
  return 'import { appendFileSync as recordHistoricalInput } from "node:fs";\\n' + code.replace(site, site + ${JSON.stringify(observation)});
 }}], test: { environment: 'node', include: [${JSON.stringify(target)}], fileParallelism: false, testTimeout: 20000 }
});\n`);
const run = spawnSync(process.execPath, ['--max-old-space-size=256', join(checkout, 'node_modules/vitest/vitest.mjs'), 'run', '--config', config, '--pool', 'forks', '--maxWorkers', '1', '--execArgv=--max-old-space-size=768', '--reporter', 'verbose'], { cwd: checkout, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
process.stdout.write(run.stdout ?? ''); process.stderr.write(run.stderr ?? '');
if (run.error || run.status !== 0) throw run.error ?? new Error(`Historical tests failed: ${run.status}`);
const rows = readFileSync(observations, 'utf8').trim().split('\n').map(line => JSON.parse(line));
const expected = ['directPhysical', 'directGeo', 'nestedOverload', 'gcdBlocked', 'poiseDepleted'];
if (JSON.stringify(rows.map(row => row.caseId)) !== JSON.stringify(expected)) throw new Error('Historical input manifest changed');
assertCleanPin();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
if (sha256(readFileSync(join(checkout, frozen))) !== 'a83ff459e5753ddef1082d923b6476bdbe5392dc9f574ac3d462e357df322579') throw new Error('Frozen Shatter Golden bytes changed');
const paths = [target, frozen, 'packages/sim-core/src/__tests__/fixtures.ts', 'packages/sim-core/src/simulator.ts', 'packages/sim-core/src/aura.ts', 'packages/sim-core/src/formulas.ts', 'packages/schemas/src/schema.ts', 'packages/schemas/src/result-schema.ts', 'packages/schemas/src/result-integrity.ts', 'package-lock.json'];
const archive = {
 fixtureVersion: 'historical-shatter-recursive-v153-84ff5cd-v1',
 source: { repository: 'mixuanda/genshin-elemental-reaction-sim', commit: PIN, tree: git('rev-parse', 'HEAD^{tree}'),
  method: 'Original nine-test recursive Shatter suite; read-only transform observes all five V153 result wires before the original frozen 1.39 semantic comparison. All original assertions, including numeric/parent-chain/strict Golden checks and direct repeated runs, execute unchanged. No current result is stripped, renumbered or relabelled.',
  files: paths.map(path => ({ path, gitBlobSha1: git('rev-parse', `HEAD:${path}`), sha256: sha256(readFileSync(join(checkout, path))) })) },
 cases: rows.map(row => ({ caseId: row.caseId, sourceWireSha256: sha256(row.sourceWireText), sourceWireText: row.sourceWireText }))
};
writeFileSync(output, JSON.stringify(archive, null, 2) + '\n', { flag: 'wx' });
console.log(`Captured genuine historical input; original assertions passed. ${output}`);
