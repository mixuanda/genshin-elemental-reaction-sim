/** Capture frozen inputs from the original test without rewriting engine output. */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PIN = '84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5';
const [checkoutArg, outputArg, sourceVersion = "152"] = process.argv.slice(2);
if (!["152", "151", "150"].includes(sourceVersion)) throw new Error("Supported source versions: 152, 151, 150");
if (!checkoutArg || !outputArg) throw new Error('Usage: node scripts/capture-historical-v152-projection.mjs HISTORICAL_CHECKOUT NEW_OUTPUT_JSON [152|151|150]');
const checkout = resolve(checkoutArg), output = resolve(outputArg);
const git = (...args) => execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
if (git('rev-parse', 'HEAD') !== PIN || git('status', '--porcelain', '--untracked-files=all')) throw new Error('A clean checkout of the exact pinned commit is required. Install its locked dependencies first.');
const temp = mkdtempSync(join(tmpdir(), 'gidps-v152-capture-'));
const observations = join(temp, 'observations.jsonl');
const targetVersion = String(Number(sourceVersion) - 1);
const target = `packages/test-vectors/src/project-v${sourceVersion}-to-v${targetVersion}.test.ts`;
const captureFunction = sourceVersion === '150' ? 'simulate' : sourceVersion === '152' ? 'projectSimulationResultV153ToV152' : 'projectSimulationResultV152ToV151';
const captureModule = sourceVersion === '150' ? '../../sim-core/src/simulator' : sourceVersion === '152' ? './project-v153-to-v152' : './project-v152-to-v151';
const config = join(temp, 'capture.config.mjs');
const importSite = `import { ${captureFunction} } from "${captureModule}";`;
const wrapper = `
import { appendFileSync as writeObservation } from 'node:fs';
function ${captureFunction}(...args: Parameters<typeof originalProjection>) {
  const value = originalProjection(...args);
  ${sourceVersion === '150' ? "if (value.config.dataVersion !== 'v150-to-v149-three-bloom') return value;" : ""}
  const caseId = ${sourceVersion === '150' ? "value.config.reactionDamageGroupModel.mode.startsWith('legacy-') ? 'active-v1' : 'active-v2'" : sourceVersion === '152' ? "(value.frozenStateLog.length ? 'natural-expiry' : 'inactive') + '-' + (value.config.freezeBrokenAttackModel.mode.startsWith('legacy-') ? 'v1' : 'v2')" : "(value.config.timeline?.abilities.some(ability => ability.id === 'single-swirl') ? 'single-swirl' : 'inactive') + '-' + (value.config.basicReactionSchedulerModel.mode.startsWith('legacy-') ? 'v1' : 'v2')"};
  writeObservation(${JSON.stringify(observations)}, JSON.stringify({ caseId, sourceWireText: JSON.stringify(value) }) + '\\n');
  return value;
}`;
writeFileSync(config, `import { defineConfig } from ${JSON.stringify(pathToFileURL(join(checkout, 'node_modules/vitest/dist/config.js')).href)};
export default defineConfig({
  root: ${JSON.stringify(checkout)}, json: { stringify: true, namedExports: false },
  plugins: [{ name: 'observe-original-historical-test', enforce: 'pre', transform(code, id) {
    if (!id.endsWith(${JSON.stringify('/' + target)})) return;
    const site = ${JSON.stringify(importSite)};
    if (!code.includes(site)) throw new Error('Pinned import site changed');
    return code.replace(site, ${JSON.stringify(`import { ${captureFunction} as originalProjection } from "${captureModule}";`)}) + ${JSON.stringify(wrapper)};
  }}],
  test: { environment: 'node', include: [${JSON.stringify(target)}], fileParallelism: false, testTimeout: 20000 }
});\n`);
const run = spawnSync(process.execPath, ['--max-old-space-size=256', join(checkout, 'node_modules/vitest/vitest.mjs'), 'run', '--config', config, '--pool', 'forks', '--maxWorkers', '1', '--execArgv=--max-old-space-size=768', '--reporter', 'verbose'], { cwd: checkout, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
process.stdout.write(run.stdout ?? ''); process.stderr.write(run.stderr ?? '');
if (run.error || run.status !== 0) throw run.error ?? new Error(`Historical tests failed: ${run.status}`);
const rows = readFileSync(observations, 'utf8').trim().split('\n').map(line => JSON.parse(line));
const cases = new Map();
for (const row of rows) {
  if (cases.has(row.caseId) && cases.get(row.caseId) !== row.sourceWireText) throw new Error(`Nondeterministic historical capture: ${row.caseId}`);
  cases.set(row.caseId, row.sourceWireText);
}
const expectedCaseIds = sourceVersion === '150' ? 'active-v1,active-v2' : sourceVersion === '152' ? 'inactive-v1,inactive-v2,natural-expiry-v1,natural-expiry-v2' : 'inactive-v1,inactive-v2,single-swirl-v1,single-swirl-v2';
if ([...cases.keys()].sort().join() !== expectedCaseIds) throw new Error('Historical case manifest changed');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const paths = [target, ...(sourceVersion !== '152' ? ['packages/test-vectors/src/project-v151-to-v150.ts'] : []), ...(sourceVersion === '150' ? ['packages/test-vectors/src/project-v150-to-v149.ts'] : []), 'packages/test-vectors/src/project-v153-to-v152.ts', 'packages/test-vectors/src/project-v152-to-v151.ts', 'packages/sim-core/src/__tests__/fixtures.ts', 'packages/sim-core/src/simulator.ts', 'packages/schemas/src/schema.ts', 'packages/schemas/src/result-schema.ts', 'packages/schemas/src/result-integrity.ts', 'package-lock.json'];
const archive = {
  fixtureVersion: `historical-projection-v${sourceVersion}-v${targetVersion}-84ff5cd-v1`,
  source: { repository: 'mixuanda/genshin-elemental-reaction-sim', commit: PIN, tree: git('rev-parse', 'HEAD^{tree}'), method: sourceVersion === '150' ? 'Original three-test historical projection suite; import wrapper observes immutable V153 active Bloom inputs before projection. All original assertions run unchanged. Current inactive-runtime coverage stays live in the consumer tests; no current-engine result is relabelled or stripped.' : sourceVersion === '152' ? 'Original nine-test historical projection suite; import wrapper observes immutable V152 outputs before callers mutate them. All original assertions run unchanged. No current-engine result is relabelled or stripped.' : 'Original ten-test historical projection suite; import wrapper observes immutable V151 outputs before callers mutate them. All original assertions run unchanged. No current-engine result is relabelled or stripped.', files: paths.map(path => ({ path, gitBlobSha1: git('rev-parse', `HEAD:${path}`), sha256: sha256(readFileSync(join(checkout, path))) })) },
  cases: [...cases].sort(([a], [b]) => a.localeCompare(b)).map(([caseId, sourceWireText]) => ({ caseId, sourceWireSha256: sha256(sourceWireText), sourceWireText }))
};
writeFileSync(output, JSON.stringify(archive, null, 2) + '\n', { flag: 'wx' });
console.log(`Captured ${cases.size} historical cases; original assertions passed. ${output}`);
