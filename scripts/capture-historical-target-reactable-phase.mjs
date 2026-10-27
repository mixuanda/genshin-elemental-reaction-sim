/** Capture authentic historical target-phase-v2 results without altering any assertion. */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PIN = '84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5';
const [checkoutArg, outputArg] = process.argv.slice(2);
if (!checkoutArg || !outputArg) throw new Error('Usage: node scripts/capture-historical-target-reactable-phase.mjs HISTORICAL_CHECKOUT NEW_OUTPUT_JSON');
const checkout = resolve(checkoutArg), output = resolve(outputArg);
const git = (...args) => execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
const assertCleanPin = () => {
 if (git('rev-parse', 'HEAD') !== PIN || git('status', '--porcelain', '--untracked-files=all')) throw new Error('A clean checkout of the exact pinned commit is required. Install its locked dependencies first.');
};
assertCleanPin();
if (process.env.UPDATE_TARGET_REACTABLE_PHASE_GOLDEN === '1' || process.env.UPDATE_TARGET_REACTABLE_PHASE_V139_GOLDEN === '1' || process.env.PRINT_TARGET_REACTABLE_PHASE_GOLDEN) throw new Error('Historical capture is read-only; Golden update is forbidden.');
const target = 'packages/sim-core/src/__tests__/target-reactable-phase-v2.test.ts';
const frozen = 'packages/test-vectors/fixtures/target-reactable-phase-1.39.golden.json';
const earlierFrozen = 'packages/test-vectors/fixtures/target-reactable-phase-1.38.golden.json';
const temp = mkdtempSync(join(tmpdir(), 'gidps-target-reactable-phase-capture-'));
const observations = join(temp, 'observations.jsonl'), config = join(temp, 'capture.config.mjs');
const site = "function expectGoldenScenario(\n  scenarioId: TargetReactablePhaseGoldenScenarioId,\n  result: SimulationResult,\n  boundaryFrame: number,\n  abandonedWakeFrame: number | null = null\n): void {";
const observation = `\n recordHistoricalInput(${JSON.stringify(observations)}, JSON.stringify({ caseId: scenarioId, boundaryFrame, abandonedWakeFrame, sourceWireText: JSON.stringify(result) }) + '\\n');`;
writeFileSync(config, `import { defineConfig } from ${JSON.stringify(pathToFileURL(join(checkout, 'node_modules/vitest/dist/config.js')).href)};
export default defineConfig({ root: ${JSON.stringify(checkout)}, json: { stringify: true, namedExports: false },
 plugins: [{ name: 'observe-original-target-phase-golden-input', enforce: 'pre', transform(code, id) {
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
const expected = ['frozenF176', 'quickenF600', 'burningFuelF61', 'electroChargedF570', 'frozenHitlag5F181'];
if (JSON.stringify(rows.map(row => row.caseId)) !== JSON.stringify(expected)) throw new Error('Historical input manifest changed');
assertCleanPin();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
if (sha256(readFileSync(join(checkout, frozen))) !== '40f4c76f3469453b08436b2fbd1cddab1af8b9975ce8f1133b3315b03253d5f8') throw new Error('Frozen 1.39 target-phase Golden bytes changed');
if (sha256(readFileSync(join(checkout, earlierFrozen))) !== 'f6bd14ae2a86596cc7d50b2d63b4b75c9c00aeb14cb75f0ada10e3ae4b3f5db0') throw new Error('Frozen 1.38 target-phase Golden bytes changed');
const paths = [target, frozen, earlierFrozen, 'packages/sim-core/src/__tests__/fixtures.ts', 'packages/sim-core/src/simulator.ts', 'packages/sim-core/src/aura.ts', 'packages/sim-core/src/formulas.ts', 'packages/schemas/src/schema.ts', 'packages/schemas/src/result-schema.ts', 'packages/schemas/src/result-integrity.ts', 'package-lock.json'];
const archive = {
 fixtureVersion: 'historical-target-reactable-phase-v153-84ff5cd-v1',
 source: { repository: 'mixuanda/genshin-elemental-reaction-sim', commit: PIN, tree: git('rev-parse', 'HEAD^{tree}'),
  method: 'Original fourteen-test target-phase-v2 suite; read-only transform observes all five V153 result wires before both original frozen 1.38/1.39 semantic comparisons. All original numerical, lifecycle, causal, Hitlag, strict Golden and negative assertions execute unchanged. No current result is stripped, renumbered or relabelled.',
  files: paths.map(path => ({ path, gitBlobSha1: git('rev-parse', `HEAD:${path}`), sha256: sha256(readFileSync(join(checkout, path))) })) },
 cases: rows.map(row => ({ caseId: row.caseId, boundaryFrame: row.boundaryFrame, abandonedWakeFrame: row.abandonedWakeFrame, sourceWireSha256: sha256(row.sourceWireText), sourceWireText: row.sourceWireText }))
};
writeFileSync(output, JSON.stringify(archive, null, 2) + '\n', { flag: 'wx' });
console.log(`Captured genuine historical input; original assertions passed. ${output}`);
