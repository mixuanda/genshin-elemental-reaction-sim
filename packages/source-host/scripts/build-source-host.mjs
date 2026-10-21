import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { defaultCacheDir, fileRecord, filesBelow, packageDir, pins, readOptions, run, sha256 } from './common.mjs';
import { prepareToolchain } from './prepare-toolchain.mjs';
import { pinnedTreeFile, prepareSource, readPinnedTree } from './prepare-source.mjs';

// This command builds once. It does not run the WASM, a simulation, or tests.
const options = readOptions(['--cache-dir', '--source-dir', '--tree-file', '--patch-dir', '--bridge-dir', '--output-dir', '--public-dir']);
const cacheDir = options['cache-dir'] ?? defaultCacheDir;
const treeFile = options['tree-file'] ?? pinnedTreeFile;
const preparedSource = options['source-dir'] ? null : await prepareSource(cacheDir, treeFile);
const sourceDir = options['source-dir'] ?? preparedSource.sourceDir;
const patchDir = options['patch-dir'] ?? join(packageDir, 'patches');
const bridgeDir = options['bridge-dir'] ?? join(packageDir, 'go');
const outputDir = options['output-dir'] ?? join(packageDir, 'dist');
const publicDir = options['public-dir'] ?? resolve(packageDir, '../../apps/web/public/source-host');
const { bytes: treeBytes, tree } = readPinnedTree(treeFile);
const patches = readdirSync(patchDir).filter((name) => name.endsWith('.patch')).sort();
if (patches.length === 0) throw new Error('No source-host patches supplied; wait for bridge freeze');
if (!existsSync(join(bridgeDir, 'cmd/sourcehost/main.go'))) throw new Error('Missing bridge cmd/sourcehost/main.go; wait for bridge freeze');

mkdirSync(cacheDir, { recursive: true });
const workspace = mkdtempSync(join(cacheDir, 'build-'));
const cleanSource = join(workspace, 'source');
const stagedOutput = join(workspace, 'dist');
mkdirSync(cleanSource);
mkdirSync(stagedOutput);
console.log(`Exporting verified source into ${cleanSource}`);
const sourceRecords = [];
for (const entry of tree.tree) {
  if (entry.type !== 'blob') continue;
  if (!['100644', '100755'].includes(entry.mode) || entry.path.startsWith('/') || entry.path.split('/').includes('..')) throw new Error(`Unsupported source tree entry ${entry.path}`);
  const bytes = readFileSync(join(sourceDir, entry.path));
  const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (blob !== entry.sha || bytes.length !== entry.size) throw new Error(`Pinned source blob mismatch: ${entry.path}`);
  const destination = join(cleanSource, entry.path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, bytes);
  chmodSync(destination, entry.mode === '100755' ? 0o755 : 0o644);
  sourceRecords.push({ path: entry.path, gitBlobSha1: blob, sha256: sha256(bytes), size: bytes.length });
}

const registeredSourcePackages = [];
const registrationFiles = {
  character: 'pkg/simulation/imports.character.dm.go',
  weapon: 'pkg/simulation/imports.weapon.dm.go',
  artifact: 'pkg/simulation/imports.artifact.dm.go',
};
for (const [kind, sourcePath] of Object.entries(registrationFiles)) {
  readFileSync(join(cleanSource, sourcePath), 'utf8').split('\n').forEach((line, index) => {
    const imported = line.match(/^\s*_\s+"([^"]+)"\s*$/);
    if (!imported) return;
    registeredSourcePackages.push({ kind, importPath: imported[1], sourcePath, sourceLine: index + 1, scope: 'source-implemented-not-game-verified' });
  });
}
const sourceInventory = {
  meaning: 'Pinned Go blank-import registrations; not canonical character IDs, a latest-release list, or a claim that every registered package is ready.',
  counts: Object.fromEntries(Object.keys(registrationFiles).map((kind) => [kind, registeredSourcePackages.filter((item) => item.kind === kind).length])),
  registeredSourcePackages,
};

const patchRecords = [];
const patchCopies = join(workspace, 'patches');
mkdirSync(patchCopies);
for (const name of patches) {
  const bytes = readFileSync(join(patchDir, name));
  const copy = join(patchCopies, name);
  writeFileSync(copy, bytes);
  run('git', ['apply', '--whitespace=nowarn', '--', copy], { cwd: cleanSource });
  patchRecords.push({ path: name, sha256: sha256(bytes), size: bytes.length });
}
const bridgeRecords = [];
for (const name of filesBelow(bridgeDir)) {
  const bytes = readFileSync(join(bridgeDir, name));
  const destination = join(cleanSource, name);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, bytes);
  bridgeRecords.push({ path: name, sha256: sha256(bytes), size: bytes.length });
}

const toolchain = await prepareToolchain(cacheDir);
const buildEnvironment = {
  ...process.env,
  GOROOT: toolchain.goRoot,
  GOTOOLCHAIN: 'local',
  GOENV: 'off',
  GOWORK: 'off',
  GO111MODULE: 'on',
  GOPATH: join(cacheDir, 'gopath'),
  GOMODCACHE: join(cacheDir, 'modules'),
  GOCACHE: join(cacheDir, 'go-build'),
  GOPROXY: 'https://proxy.golang.org',
  GOSUMDB: 'sum.golang.org',
  GOPRIVATE: '',
  GONOPROXY: '',
  GONOSUMDB: '',
  GOFLAGS: '',
  GOEXPERIMENT: '',
  GOWASM: '',
  GOOS: 'js',
  GOARCH: 'wasm',
  CGO_ENABLED: '0',
};
const wasmPath = join(stagedOutput, 'source-host.wasm');
const buildArgs = ['build', '-mod=readonly', '-trimpath', '-buildvcs=false', '-o', wasmPath, './cmd/sourcehost'];
const talentReadInstrumenter = join(packageDir, 'scripts/instrument-talent-reads.go');
const talentTableRegistryPath = join(stagedOutput, 'talent-table-registry.json');
const talentReadReportPath = join(stagedOutput, 'talent-read-instrumentation.json');
const hostGoOS = process.platform === 'win32' ? 'windows' : process.platform;
const hostGoArch = process.arch === 'x64' ? 'amd64' : process.arch;
const instrumentationEnvironment = {
  ...buildEnvironment,
  GOOS: hostGoOS,
  GOARCH: hostGoArch,
};
run(toolchain.go, ['run', talentReadInstrumenter, '--source-root', cleanSource,
  '--registry-out', talentTableRegistryPath, '--report-out', talentReadReportPath],
{ cwd: cleanSource, env: instrumentationEnvironment, stdio: 'inherit' });
console.log(`${toolchain.manifest.version}; building ./cmd/sourcehost once`);
run(toolchain.go, buildArgs, { cwd: cleanSource, env: buildEnvironment, stdio: 'inherit' });
// Go 1.25's debug/buildinfo reader does not recognize the WASM container.
// Read the linker-preserved runtime.modinfo framing without executing WASM.
// Format source: Go src/cmd/go/internal/modload/build.go:30-31,465;
// WASM data packing keeps this string contiguous (zero runs shorter than 8).
const wasmBytes = readFileSync(wasmPath);
const moduleInfoStart = Buffer.from('3077af0c9274080241e1c107e6d618e6', 'hex');
const moduleInfoEnd = Buffer.from('f932433186182072008242104116d8f2', 'hex');
let buildInfo = null;
for (let offset = wasmBytes.indexOf(moduleInfoStart); offset !== -1; offset = wasmBytes.indexOf(moduleInfoStart, offset + 1)) {
  const start = offset + moduleInfoStart.length;
  const end = wasmBytes.indexOf(moduleInfoEnd, start);
  if (end === -1) continue;
  const candidate = wasmBytes.subarray(start, end).toString('utf8');
  if (candidate.startsWith('path\tgithub.com/genshinsim/gcsim/cmd/sourcehost\n')) { buildInfo = candidate; break; }
}
if (buildInfo === null) throw new Error('Cannot locate source-host module build metadata in the compiled WASM');
writeFileSync(join(stagedOutput, 'go-build-info.txt'), `${buildInfo}\n`);
copyFileSync(join(toolchain.goRoot, 'lib/wasm/wasm_exec.js'), join(stagedOutput, 'wasm_exec.js'));

const licensesDir = join(stagedOutput, 'licenses');
mkdirSync(licensesDir);
const licenseRecords = [];
function copyLicense(source, relative, owner, version, sourcePath) {
  const destination = join(licensesDir, relative);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  licenseRecords.push({ ...fileRecord(destination, `licenses/${relative}`), owner, version, sourcePath });
}
copyLicense(join(cleanSource, 'LICENSE'), 'gcsim-MIT.txt', 'github.com/genshinsim/gcsim', pins.sourceRevision, 'LICENSE');
copyLicense(join(toolchain.goRoot, 'LICENSE'), 'go-BSD.txt', 'Go Authors', pins.goVersion, 'LICENSE');
if (existsSync(join(toolchain.goRoot, 'PATENTS'))) copyLicense(join(toolchain.goRoot, 'PATENTS'), 'go-PATENTS.txt', 'Go Authors', pins.goVersion, 'PATENTS');
// Go build metadata omits standard-library vendor modules. Preserve their
// bundled notices as well, without claiming each is linked into this binary.
const goVendor = join(toolchain.goRoot, 'src/vendor');
for (const name of filesBelow(goVendor)) {
  if (!/\/(LICENSE|NOTICE|COPYING|PATENTS)(\.[^/]*)?$/i.test(`/${name}`)) continue;
  copyLicense(join(goVendor, name), `go-vendor/${name}`, 'Go bundled vendor notices (inclusive inventory)', pins.goVersion, `src/vendor/${name}`);
}
for (const name of filesBelow(join(packageDir, 'licenses'))) {
  if (name === 'gcsim-MIT.txt' || name === 'go-BSD.txt' || name === 'go-PATENTS.txt') continue;
  copyLicense(join(packageDir, 'licenses', name), name, 'source-host packaging notices', null, name);
}

const dependencies = buildInfo.split('\n').map((line) => line.trim().split('\t')).filter((fields) => fields[0] === 'dep').map((fields) => ({ path: fields[1], version: fields[2], goSum: fields[3] ?? null }));
const missingDependencyLicenses = [];
if (dependencies.length > 0) {
  const moduleRows = run(toolchain.go, ['list', '-mod=readonly', '-m', '-f', '{{.Path}}\t{{if .Replace}}{{.Replace.Dir}}{{else}}{{.Dir}}{{end}}', ...dependencies.map((dep) => dep.path)], { cwd: cleanSource, env: buildEnvironment });
  const moduleDirectories = new Map(moduleRows.split('\n').map((line) => line.split('\t')));
  const noticePattern = /^(license|licence|copying|notice|authors|copyright)($|[._-])/i;
  for (const dependency of dependencies) {
    const directory = moduleDirectories.get(dependency.path);
    if (!directory) throw new Error(`Cannot locate linked dependency ${dependency.path}`);
    const names = readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      if (entry.isFile() && noticePattern.test(entry.name)) return [entry.name];
      if (entry.isDirectory() && /^licenses?$/i.test(entry.name)) return filesBelow(join(directory, entry.name)).map((name) => `${entry.name}/${name}`);
      return [];
    }).sort();
    if (names.length === 0) missingDependencyLicenses.push(dependency.path);
    const safeName = `${dependency.path}@${dependency.version}`.replaceAll('/', '__');
    for (const name of names) copyLicense(join(directory, name), `dependencies/${safeName}/${name}`, dependency.path, dependency.version, name);
  }
}

writeFileSync(join(stagedOutput, 'source-files.json'), `${JSON.stringify(sourceRecords, null, 2)}\n`);
const artifactRecords = ['source-host.wasm', 'wasm_exec.js', 'go-build-info.txt', 'source-files.json',
  'talent-table-registry.json', 'talent-read-instrumentation.json'].map((name) => fileRecord(join(stagedOutput, name), name));
const manifest = {
  schemaVersion: 1,
  builtAt: new Date().toISOString(),
  source: { repository: 'https://github.com/genshinsim/gcsim', revision: pins.sourceRevision, treeSnapshotSha256: sha256(treeBytes), verifiedBlobCount: sourceRecords.length, exportedOnlyTrackedBlobs: true, preparation: preparedSource?.receipt ?? { kind: 'explicit-local-source', trackedBytesVerified: true } },
  sourceInventory,
  talentReadInstrumentation: {
    tool: fileRecord(talentReadInstrumenter, 'scripts/instrument-talent-reads.go'),
    registry: fileRecord(talentTableRegistryPath, 'talent-table-registry.json'),
    report: fileRecord(talentReadReportPath, 'talent-read-instrumentation.json'),
    host: { goos: hostGoOS, goarch: hostGoArch },
  },
  limitations: {
    sourceTODOsUnreviewed: true, fullModifierDerivation: false, checkpoint: false,
    supportedFormulaFamilies: ['ordinary', 'amplifying', 'additive', 'transformative', 'lunar-charged-direct', 'lunar-bloom-direct', 'lunar-crystallize-direct', 'lunar-charged-reaction', 'lunar-crystallize-reaction', 'lunar-bloom-event', 'player-incoming', 'player-shield', 'player-shield-min', 'player-drain', 'artifact-scalar', 'weapon-additive', 'artifact-additive', 'character-energy', 'character-cooldown', 'character-healing', 'character-modifier', 'character-scalar', 'character-additive', 'character-flat', 'character-multiplier', 'character-shield', 'character-drain', 'player-manual-incoming'],
    unsupportedSpecialFormulaFamilies: ['stellar'], lunarNonIgnoredDefense: false, sourceLunarMechanicsVerified: false, playerIncomingDamageSharedFormula: true, playerShieldAndDrainSharedFormula: true,
  },
  patches: patchRecords,
  bridge: bridgeRecords,
  buildScripts: filesBelow(join(packageDir, 'scripts')).map((name) => fileRecord(join(packageDir, 'scripts', name), `scripts/${name}`)),
  toolchain: toolchain.manifest,
  build: { target: 'js/wasm', args: buildArgs.map((arg) => arg === wasmPath ? '<output>/source-host.wasm' : arg), goSumSha256: sha256(readFileSync(join(cleanSource, 'go.sum'))), moduleMode: 'readonly', automaticToolchainDownload: false, moduleMetadataExtraction: 'go1.25.0-runtime.modinfo-framing-from-wasm-bytes', simulatorExecuted: false, testsExecuted: false },
  artifacts: artifactRecords,
  linkedDependencies: dependencies,
  licenses: { files: licenseRecords, missingDependencyLicenseTexts: missingDependencyLicenses, reviewStatus: 'texts-collected-not-a-legal-clearance', resourceBoundary: 'The source-host build does not grant rights to upstream game images, fonts, names or data. See licenses/README.md.' },
};
writeFileSync(join(stagedOutput, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
// Regenerate the normal product's searchable keys and TODO evidence from the
// same pinned source as this artifact, before publishing either output.
run(process.execPath, [join(packageDir, 'scripts/generate-source-inventory-metadata.mjs'), '--cache-dir', cacheDir, '--source-dir', sourceDir, '--tree-file', treeFile, '--manifest', join(stagedOutput, 'manifest.json'), '--output', join(stagedOutput, 'inventory-metadata.json')], { stdio: 'inherit' });
manifest.artifacts.push(fileRecord(join(stagedOutput, 'inventory-metadata.json'), 'inventory-metadata.json'));
writeFileSync(join(stagedOutput, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
// Publish only after compilation and provenance collection both succeed.
mkdirSync(outputDir, { recursive: true });
for (const name of filesBelow(stagedOutput)) {
  const destination = join(outputDir, name);
  mkdirSync(dirname(destination), { recursive: true });
  // Go's module cache stores license files read-only. Published artifacts are
  // generated copies and must remain replaceable on the next build.
  if (existsSync(destination)) chmodSync(destination, 0o644);
  copyFileSync(join(stagedOutput, name), destination);
  chmodSync(destination, 0o644);
}
const publicNames = filesBelow(stagedOutput).filter((name) => ['source-host.wasm', 'wasm_exec.js', 'go-build-info.txt', 'manifest.json', 'inventory-metadata.json', 'talent-table-registry.json', 'talent-read-instrumentation.json'].includes(name) || name.startsWith('licenses/'));
for (const name of publicNames) {
  const destination = join(publicDir, name);
  mkdirSync(dirname(destination), { recursive: true });
  if (existsSync(destination)) chmodSync(destination, 0o644);
  copyFileSync(join(stagedOutput, name), destination);
  chmodSync(destination, 0o644);
}
console.log(JSON.stringify({ outputDir, publicDir, workspace, wasm: artifactRecords[0], linkedDependencyCount: dependencies.length, missingDependencyLicenses }, null, 2));
