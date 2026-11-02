/** Replay one saved callback stream and profile only fresh-result validation, without running Go. */
import { createServer } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { Session } from 'node:inspector';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const [capture, output, baseline] = process.argv.slice(2);
assert.ok(capture && output, 'Provide capture.json and a fresh evidence directory.');
await mkdir(output, { recursive: true });
await writeFile(`${output}/runner-start.json`, JSON.stringify({
  kind: 'offline fresh-result validation; recorded callbacks, no native simulation', capture,
  gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  applicationPatchSha256: createHash('sha256').update(execFileSync('git', ['diff', 'HEAD', '--', 'packages/sim-core/src', 'apps/web/src'])).digest('hex'),
  startedAt: new Date().toISOString(), pid: process.pid,
}), { flag: 'wx' });
const server = await createServer({ root: process.cwd(), configFile: 'apps/web/vite.config.ts', server: { middlewareMode: true }, appType: 'custom' });
const session = new Session();
try {
  const { createSourceHostFormulaResolver } = await server.ssrLoadModule('/packages/sim-core/src/source-host-formula.ts');
  const { createSourceHostResult } = await server.ssrLoadModule('/packages/sim-core/src/source-host-capture.ts');
  const raw = JSON.parse(await readFile(capture, 'utf8'));
  const resolver = createSourceHostFormulaResolver();
  for (const row of raw.calculations) {
    const response = JSON.parse(resolver.resolve(JSON.stringify(row.request)));
    assert.equal(response.error, undefined); assert.equal(response.value, row.value); assert.equal(response.id, row.request.id);
  }
  // A Go response has none of the metadata added by the worker after validation.
  const { schemaVersion, formulaVersion, verification, explanationStatus, explanationGaps, executionArtifact, ...native } = raw;
  session.connect();
  const post = (method, params = {}) => new Promise((resolve, reject) => session.post(method, params, (error, result) => error ? reject(error) : resolve(result)));
  await post('Profiler.enable'); await post('Profiler.start');
  const started = performance.now();
  const result = createSourceHostResult(native, resolver.calculations);
  const elapsedMs = performance.now() - started;
  const { profile } = await post('Profiler.stop');
  if (executionArtifact !== undefined) result.executionArtifact = executionArtifact;
  assert.deepEqual(result, raw, 'Validation must preserve every original result field and list order.');
  const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const identity = { captureSha256: sha(raw), validatedSha256: sha(result), calculations: result.calculations.length, applications: result.applications.length };
  // JSON property insertion order is not an archive identity. Deep equality above
  // checks every value and array order; these hashes also pin each exact rendering.
  if (baseline) assert.deepEqual(identity, JSON.parse(await readFile(baseline, 'utf8')).identity);
  const summary = { kind: 'offline fresh-result validation, not browser latency', elapsedMs, identity };
  await writeFile(`${output}/validation.cpuprofile`, JSON.stringify(profile), { flag: 'wx' });
  await writeFile(`${output}/summary.json`, JSON.stringify(summary, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(summary));
} finally { session.disconnect(); await server.close(); }
