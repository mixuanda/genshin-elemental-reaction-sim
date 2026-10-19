import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const overlay = join(root, 'packages/source-host/stellar-overlay');
const publicDir = join(root, 'apps/web/public/source-host-stellar');
const configFile = resolve(process.argv[2] ?? join(overlay, 'example.gcsl'));
const config = readFileSync(configFile, 'utf8');
const digest = value => createHash('sha256').update(value).digest('hex');
const manifest = JSON.parse(readFileSync(join(publicDir, 'manifest.json'), 'utf8'));
const wasm = readFileSync(join(publicDir, 'source-host.wasm'));
if (digest(wasm) !== manifest.files.find(file => file.path === 'source-host.wasm')?.sha256) throw new Error('Stellar WASM does not match its manifest');
const temporary = mkdtempSync(join(tmpdir(), 'gidps-stellar-smoke-'));
let status = 0;
try {
  for (const [name, source] of [['formula', 'source-host-formula.ts'], ['capture', 'source-host-capture.ts']]) {
    const result = spawnSync(join(root, 'node_modules/.bin/rolldown'), [join(root, 'packages/sim-core/src', source), '--platform', 'node', '--format', 'esm', '--file', join(temporary, `${name}.mjs`)], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout || `Cannot bundle ${source}`);
  }
  const { createSourceHostFormulaResolver } = await import(pathToFileURL(join(temporary, 'formula.mjs')).href);
  const { createSourceHostResult } = await import(pathToFileURL(join(temporary, 'capture.mjs')).href);
  await import(pathToFileURL(join(publicDir, 'wasm_exec.js')).href);
  const go = new globalThis.Go();
  const instance = await WebAssembly.instantiate(wasm, go.importObject);
  void go.run(instance.instance);
  await new Promise(resolve => setTimeout(resolve, 20));
  if (typeof globalThis.gidpsSourceHostRun !== 'function') throw new Error('a7 Go/WASM entry point is absent');
  const resolver = createSourceHostFormulaResolver();
  const native = JSON.parse(globalThis.gidpsSourceHostRun(JSON.stringify({ protocol: 'gidps-source-host-v1', config, seed: '1' }), resolver.resolve));
  if (native.error) throw new Error(native.error);
  const captured = createSourceHostResult(native, resolver.calculations);
  const kinds = Object.fromEntries([...new Set(native.calculations.map(row => row.request.kind))].sort().map(kind => [kind, native.calculations.filter(row => row.request.kind === kind).length]));
  console.log(JSON.stringify({ sourceCommit: native.sourceCommit, wasmSha256: digest(wasm), configSha256: digest(config),
    seed: '1', calculations: native.calculations.length, applications: native.applications.length,
    sharedFormulaCalculations: resolver.calculations.length, capturedCalculations: captured.calculations.length,
    kinds, firstStellarBranches: native.calculations.filter(row => row.request.kind.startsWith('stellar-')).map(row => row.request.input.branch).filter((branch, index, all) => all.indexOf(branch) === index) }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  status = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
  process.exit(status);
}
