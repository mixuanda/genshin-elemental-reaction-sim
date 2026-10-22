import { createHash } from 'node:crypto';
import { chmodSync, createWriteStream, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';

const packageDir = dirname(fileURLToPath(import.meta.url));
const pins = JSON.parse(readFileSync(join(packageDir, 'pins.json'), 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const gitBlob = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const record = (path, name) => { const bytes = readFileSync(path); return { path: name, sha256: hash(bytes), bytes: bytes.length }; };
const files = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const name = prefix ? `${prefix}/${entry.name}` : entry.name;
  return entry.isDirectory() ? files(join(dir, entry.name), name) : entry.isFile() ? [name] : [];
}).sort();
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${result.error ?? result.stderr ?? result.status}`);
  return result.stdout?.trim() ?? '';
};
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1];
  if (!['--cache-dir', '--source-dir', '--toolchain-dir', '--output-dir', '--public-dir'].includes(key) || !value) throw new Error(`Invalid build option ${key}`);
  options[key] = resolve(value);
}
const cacheDir = options['--cache-dir'] ?? '/tmp/gidps-source-host-cache';
const upstreamCache = join(cacheDir, 'upstream', pins.sourceRevision);
const sourceDir = options['--source-dir'] ?? join(upstreamCache, 'source');
const outputDir = options['--output-dir'] ?? join(packageDir, 'dist');
const publicDir = options['--public-dir'] ?? resolve(packageDir, '../../../apps/web/public/source-host-stellar');
const patchFile = join(packageDir, 'a7-source-host.patch');
const actionAttemptsPatchFile = join(packageDir, 'action-attempts.patch');
const actionQueuePolicyPatchFile = join(packageDir, '../patches/008-action-queue-policy.patch');
const executionProfileDelaysPatchFile = join(packageDir, '../patches/009-execution-profile-delays.patch');
const artifactScalarPatchFile = join(packageDir, '../patches/010-artifact-scalar.patch');
const weaponAdditivePatchFile = join(packageDir, '../patches/011-weapon-additive.patch');
const artifactConstantsAPatchFile = join(packageDir, '../patches/012-artifact-constants-a.patch');
const artifactConstantsBPatchFile = join(packageDir, '../patches/013-artifact-constants-b.patch');
const artifactDynamicAPatchFile = join(packageDir, '../patches/014-artifact-dynamic-a.patch');
const artifactDynamicBPatchFile = join(packageDir, 'patches/015-artifact-dynamic-b.patch');
const artifactDynamicCPatchFile = join(packageDir, 'patches/016-artifact-dynamic-c.patch');
const artifactStellarSetsPatchFile = join(packageDir, 'patches/017-artifact-stellar-sets.patch');
const artifactSnapshotPatchFile = join(packageDir, 'patches/018-artifact-snapshot.patch');
const artifactAdditivePatchFile = join(packageDir, '../patches/019-artifact-additive.patch');
const characterCooldownPatchFile = join(packageDir, 'patches/022-character-cooldown.patch');
const artifactResistancePatchFile = join(packageDir, 'patches/023-artifact-resistance.patch');
const shieldBonusPatchFile = join(packageDir, '../patches/024-shield-bonus.patch');
const characterModifierPatchFile = join(packageDir, 'patches/025-character-modifiers.patch');
const characterModifierSnapshotPatchFile = join(packageDir, 'patches/026-character-modifier-snapshot.patch');
const characterDynamicAPatchFile = join(packageDir, 'patches/027-character-dynamic-a.patch');
const characterDynamicBPatchFile = join(packageDir, 'patches/028-character-dynamic-b.patch');
const characterDynamicCPatchFile = join(packageDir, 'patches/029-character-dynamic-c.patch');
const characterScalarProvenancePatchFile = join(packageDir, 'patches/030-character-scalar-provenance.patch');
const characterScalarAPatchFile = join(packageDir, 'patches/031-character-scalar-a.patch');
const characterScalarBPatchFile = join(packageDir, 'patches/032-character-scalar-b.patch');
const delayedElectrochargedProvenancePatchFile = join(packageDir, 'patches/033-a7-delayed-electrocharged-provenance.patch');
const characterVectorAPatchFile = join(packageDir, 'patches/034-character-vector-a.patch');
const characterVectorBPatchFile = join(packageDir, 'patches/035-character-vector-b.patch');
const characterVectorCPatchFile = join(packageDir, 'patches/036-character-vector-c.patch');
const characterVectorDPatchFile = join(packageDir, 'patches/037-character-vector-d.patch');
const characterAdditiveAPatchFile = join(packageDir, 'patches/038-character-additive-a.patch');
const characterAdditiveBPatchFile = join(packageDir, 'patches/039-character-additive-b.patch');
const characterAdditiveCPatchFile = join(packageDir, 'patches/040-character-additive-c.patch');
const characterFlatAPatchFile = join(packageDir, 'patches/041-character-flat-a.patch');
const characterFlatBPatchFile = join(packageDir, 'patches/042-character-flat-b.patch');
const characterFlatCPatchFile = join(packageDir, 'patches/043-character-flat-c.patch');
const characterFlatDPatchFile = join(packageDir, 'patches/044-character-flat-d.patch');
const characterFlatEPatchFile = join(packageDir, 'patches/045-character-flat-e.patch');
const characterHelperDerivationsPatchFile = join(packageDir, 'patches/046-character-helper-derivations.patch');
const characterHealingOverridesPatchFile = join(packageDir, 'patches/047-character-healing-overrides.patch');
const cooldownOverridesPatchFile = join(packageDir, 'patches/048-cooldown-overrides.patch');
const characterMultiplierBasePatchFile = join(packageDir, 'patches/049-character-multiplier-base.patch');
const characterMultiplierAPatchFile = join(packageDir, 'patches/050-character-multiplier-a.patch');
const characterMultiplierBPatchFile = join(packageDir, 'patches/051-character-multiplier-b.patch');
const characterMultiplierCPatchFile = join(packageDir, 'patches/052-character-multiplier-c.patch');
const characterShieldBridgePatchFile = join(packageDir, 'patches/053-character-shield-bridge.patch');
const characterShieldAPatchFile = join(packageDir, 'patches/054-character-shield-a.patch');
const characterShieldBPatchFile = join(packageDir, 'patches/055-character-shield-b.patch');
const characterShieldCPatchFile = join(packageDir, 'patches/056-character-shield-c.patch');
const characterShieldDPatchFile = join(packageDir, 'patches/057-character-shield-d.patch');
const shieldWeaponCrystallizePatchFile = join(packageDir, 'patches/058-shield-weapon-crystallize.patch');
const healingSourceBridgePatchFile = join(packageDir, 'patches/059-healing-source-bridge.patch');
const healingSourceAPatchFile = join(packageDir, 'patches/060-healing-source-a.patch');
const healingSourceBPatchFile = join(packageDir, 'patches/061-healing-source-b.patch');
const healingSourceCPatchFile = join(packageDir, 'patches/062-healing-source-c.patch');
const healingSourceDPatchFile = join(packageDir, 'patches/063-healing-source-d.patch');
const healingSourceEPatchFile = join(packageDir, 'patches/064-healing-source-e.patch');
const healingSourceFPatchFile = join(packageDir, 'patches/065-healing-source-f.patch');
const healingSourceGPatchFile = join(packageDir, 'patches/066-healing-source-g.patch');
const drainSourceBridgePatchFile = join(packageDir, 'patches/067-drain-source-bridge.patch');
const drainSourceAPatchFile = join(packageDir, 'patches/068-drain-source-a.patch');
const drainSourceBPatchFile = join(packageDir, 'patches/069-drain-source-b.patch');
const dehyaDrainSourcePatchFile = join(packageDir, 'patches/070-dehya-drain-source.patch');
const nilouSelfDamagePatchFile = join(packageDir, 'patches/071-nilou-self-damage.patch');
const dendroCoreSelfDamagePatchFile = join(packageDir, 'patches/072-dendro-core-self-damage.patch');
const phaseBoundaryPatchFile = join(packageDir, 'patches/073-phase-boundary.patch');
const phaseActorStatePatchFile = join(packageDir, '../patches/074-phase-actor-state.patch');
const phaseTargetStatePatchFile = join(packageDir, 'patches/075-phase-target-state.patch');
const phaseRuntimeStatePatchFile = join(packageDir, '../patches/076-phase-runtime-state.patch');
const phaseCompletionPatches = [
  '../patches/077-phase-state-normalization.patch',
  'patches/078-phase-callback-state.patch',
  '../patches/079-phase-private-state.patch',
  'patches/080-phase-target-normalization.patch',
  '../patches/081-phase-observer-hooks.patch',
  '../patches/082-phase-modifier-state.patch',
  '../patches/083-phase-stats-captures.patch',
  'patches/084-phase-core-hooks.patch',
  '../patches/085-phase-resonance-modifiers.patch',
  '../patches/086-phase-cooldown-worker.patch',
  'patches/087-phase-stellar-wind.patch',
  'patches/088-action-origin.patch',
  'patches/089-attack-observation.patch',
  'patches/090-origin-phase-observation.patch',
  'patches/091-status-owner.patch',
  'patches/092-status-lifecycle-and-pending-attacks.patch',
  'patches/093-base-panel-provenance.patch',
  'patches/094-attack-dispatch-identity.patch',
  'patches/095-reaction-em-provenance.patch',
  'patches/096-talent-table-read.patch',
  'patches/099-talent-expression-read.patch',
  'patches/100-task-lifecycle.patch',
  '../patches/103-stop-at-duration.patch',
  '../patches/105-static-target-defense-adjustment.patch',
  '../patches/106-target-phases.patch',
  '../patches/107-ability-dispatch-receipts.patch',
  '../patches/108-ability-producer-sites.patch',
  '../patches/109-owned-generators.patch',
  '../patches/109-finite-producer-sites.patch',
  '../patches/110-owned-entities.patch',
  '../patches/111-hit-callbacks.patch',
  '../patches/112-event-ownership.patch',
  '../patches/112-event-character-sites.patch',
  '../patches/113-direct-event-sites-a.patch',
  '../patches/113-direct-event-sites-b.patch',
  '../patches/113-direct-event-sites-c.patch',
  'patches/114-event-sites-a.patch',
  'patches/114-event-sites-b.patch',
  '../patches/114-event-sites-c.patch',
  '../patches/114-event-beidou-chain.patch',
  '../patches/114-event-chiori-tree.patch',
  'patches/114-event-ororon.patch',
  '../patches/115-shield-lifecycle.patch',
  '../patches/115-baizhu-shield.patch',
  '../patches/116-noelle-shield.patch',
  '../patches/116-xinyan-shield.patch',
  '../patches/117-simple-tasks.patch',
  '../patches/117-kirara-tasks.patch',
  '../patches/118-beidou-owned-burst.patch',
  '../patches/118-entity-native-ticks.patch',
  '../patches/118-owned-entities.patch',
  'patches/118-recurring-skills.patch',
  '../patches/119-phase-attacks.patch',
  'patches/119-phase-player.patch',
  '../patches/119-phase-reactions.patch',
  'patches/111-hit-callback-sites.patch',
  'patches/110-finite-producer-sites.patch',
  'patches/121-animation-core.patch',
  'patches/121-animation-sites.patch',
  'patches/122-movement-core.patch',
  'patches/122-movement-stam.patch',
  'patches/122-movement-cooldown.patch',
  'patches/123-producer-fields.patch',
  'patches/124-conditional-entry-facts.patch',
  'patches/124-hit-callback-enemy-task.patch',
  'patches/125-private-numeric-state.patch',
  'patches/125-finite-frontier.patch',
  'patches/126-layla-ownership.patch',
  'patches/127-owned-constructs.patch',
  'patches/130-animation-callback-core.patch',
  'patches/130-animation-callback-sites.patch',
  'patches/131-raiden-owned-native.patch',
  // a7 also initializes character passives before InitializeTeam sets HP.
  // Sample A4 on OnInitialize; preserve native heal/drain callbacks.
  '../patches/132-neuvillette-initial-hp-a4.patch',
  // Backport upstream 2f1dc6a / PR3210; press and hold E use sampled CR.
  '../patches/133-venti-skill-crit.patch',
].map(path => join(packageDir, path));
const phasePatches = [phaseBoundaryPatchFile, phaseActorStatePatchFile, phaseTargetStatePatchFile, phaseRuntimeStatePatchFile, ...phaseCompletionPatches];
const characterEnergyPatchFile = join(packageDir, '../patches/020-character-energy.patch');
const characterHealingPatchFile = join(packageDir, '../patches/021-character-healing.patch');
const playerIncomingPatchFile = join(packageDir, '../patches/005-player-incoming.patch');
const playerShieldHealthPatchFile = join(packageDir, '../patches/006-player-shield-health.patch');
const bridgeDir = join(packageDir, 'go');
const treeGzip = readFileSync(join(packageDir, 'source-tree.json.gz'));
if (hash(treeGzip) !== pins.treeGzipSha256) throw new Error('a7 tree archive hash mismatch');
const treeBytes = gunzipSync(treeGzip);
if (hash(treeBytes) !== pins.treeJsonSha256) throw new Error('a7 full Git tree hash mismatch');
const tree = JSON.parse(treeBytes);
if (tree.sha !== pins.sourceRevision || tree.truncated !== false) throw new Error('a7 Git tree is incomplete or wrong commit');

async function download(url, destination) {
  if (existsSync(destination)) return;
  mkdirSync(dirname(destination), { recursive: true });
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Download failed ${url}: HTTP ${response.status}`);
  const temporary = `${destination}.download-${process.pid}`;
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: 'wx' }));
    renameSync(temporary, destination);
  } finally { rmSync(temporary, { force: true }); }
}
function verifySource(root) {
  let count = 0;
  for (const entry of tree.tree) {
    if (entry.type !== 'blob') continue;
    if (!['100644', '100755'].includes(entry.mode) || entry.path.startsWith('/') || entry.path.split('/').includes('..')) throw new Error(`Invalid a7 source path ${entry.path}`);
    const path = join(root, entry.path);
    if (!lstatSync(path).isFile()) throw new Error(`Expected regular a7 source file ${entry.path}`);
    const bytes = readFileSync(path);
    if (bytes.length !== entry.size || gitBlob(bytes) !== entry.sha) throw new Error(`a7 source Git blob mismatch ${entry.path}`);
    count++;
  }
  return count;
}
mkdirSync(upstreamCache, { recursive: true });
const sourceArchive = join(upstreamCache, 'source.tar.gz');
if (!options['--source-dir']) {
  await download(pins.sourceArchiveUrl, sourceArchive);
  if (record(sourceArchive, 'source.tar.gz').sha256 !== pins.sourceArchiveSha256 || lstatSync(sourceArchive).size !== pins.sourceArchiveBytes) throw new Error('a7 source archive bytes mismatch');
  if (!existsSync(sourceDir)) {
    const prefix = `gcsim-${pins.sourceRevision}/`;
    const entries = run('tar', ['-tzf', sourceArchive]).split('\n');
    if (entries.some(name => !name.startsWith(prefix) || name.split('/').includes('..'))) throw new Error('a7 source archive has an unsafe path');
    const staging = mkdtempSync(join(upstreamCache, 'unpack-'));
    try {
      run('tar', ['-xzf', sourceArchive, '-C', staging, '--strip-components=1']);
      verifySource(staging);
      renameSync(staging, sourceDir);
    } finally { rmSync(staging, { recursive: true, force: true }); }
  }
}
const verifiedBlobCount = verifySource(sourceDir);
const goArch = process.arch === 'x64' ? 'amd64' : process.arch;
const platform = `${process.platform}-${goArch}`;
const goPin = pins.toolchains[platform];
if (!goPin) throw new Error(`No pinned Go 1.27.1 toolchain for ${platform}`);
const goCache = join(cacheDir, pins.goVersion, platform);
const goArchive = join(goCache, 'go.tar.gz');
const goRoot = options['--toolchain-dir'] ?? join(goCache, 'go');
if (!options['--toolchain-dir']) {
  await download(`${pins.goDownloadBaseUrl}${goPin.filename}`, goArchive);
  if (hash(readFileSync(goArchive)) !== goPin.sha256 || lstatSync(goArchive).size !== goPin.size) throw new Error('Go 1.27.1 archive bytes mismatch');
  if (!existsSync(join(goRoot, 'bin/go'))) run('tar', ['-xzf', goArchive, '-C', goCache]);
}
const go = join(goRoot, 'bin/go');
if (run(go, ['version']) !== `go version ${pins.goVersion} ${process.platform}/${goArch}`) throw new Error('Unexpected Go compiler version or architecture');
const workspace = mkdtempSync(join(cacheDir, 'stellar-build-'));
const exported = join(workspace, 'source');
const staged = join(workspace, 'dist');
mkdirSync(exported);
mkdirSync(staged);
for (const entry of tree.tree) {
  if (entry.type !== 'blob') continue;
  const destination = join(exported, entry.path);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(sourceDir, entry.path), destination);
}
run('git', ['apply', '--whitespace=nowarn', patchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', playerIncomingPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', playerShieldHealthPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', actionAttemptsPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', actionQueuePolicyPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', executionProfileDelaysPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', artifactScalarPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', weaponAdditivePatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', artifactConstantsAPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', artifactConstantsBPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', artifactDynamicAPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', artifactDynamicBPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', artifactDynamicCPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', artifactStellarSetsPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', artifactSnapshotPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', artifactAdditivePatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterEnergyPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterHealingPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterCooldownPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', artifactResistancePatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', shieldBonusPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterModifierPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterModifierSnapshotPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterDynamicAPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterDynamicBPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterDynamicCPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterScalarProvenancePatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterScalarAPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterScalarBPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', delayedElectrochargedProvenancePatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterVectorAPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterVectorBPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterVectorCPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterVectorDPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterAdditiveAPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterAdditiveBPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterAdditiveCPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterFlatAPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterFlatBPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterFlatCPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterFlatDPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterFlatEPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterHelperDerivationsPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterHealingOverridesPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', cooldownOverridesPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterMultiplierBasePatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterMultiplierAPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterMultiplierBPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterMultiplierCPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterShieldBridgePatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterShieldAPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterShieldBPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterShieldCPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', characterShieldDPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', shieldWeaponCrystallizePatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', healingSourceBridgePatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', healingSourceAPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', healingSourceBPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', healingSourceCPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', healingSourceDPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', healingSourceEPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', healingSourceFPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', healingSourceGPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', drainSourceBridgePatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', drainSourceAPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', drainSourceBPatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', dehyaDrainSourcePatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', nilouSelfDamagePatchFile], { cwd: exported });
run('git', ['apply', '--whitespace=nowarn', dendroCoreSelfDamagePatchFile], { cwd: exported });
for (const phasePatch of phasePatches) run('git', ['apply', '--whitespace=nowarn', phasePatch], { cwd: exported });
const bridgeRecords = [];
for (const name of files(bridgeDir)) {
  const destination = join(exported, name);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(bridgeDir, name), destination);
  bridgeRecords.push(record(destination, name));
}
const talentReadInstrumenter = join(packageDir, '../scripts/instrument-talent-reads.go');
const talentTableRegistryPath = join(staged, 'talent-table-registry.json');
const talentReadReportPath = join(staged, 'talent-read-instrumentation.json');
const hostGoOS = process.platform === 'win32' ? 'windows' : process.platform;
const hostGoArch = process.arch === 'x64' ? 'amd64' : process.arch;
const instrumentationEnv = { ...process.env, GOROOT: goRoot, GOTOOLCHAIN: 'local', GOENV: 'off', GOWORK: 'off', GO111MODULE: 'on',
  GOPATH: join(cacheDir, 'gopath'), GOMODCACHE: join(cacheDir, 'modules'), GOCACHE: join(cacheDir, 'go-build'),
  GOOS: hostGoOS, GOARCH: hostGoArch, CGO_ENABLED: '0', GOPROXY: 'https://proxy.golang.org', GOSUMDB: 'sum.golang.org',
  GOFLAGS: '', GOEXPERIMENT: '', GOWASM: '' };
run(go, ['run', talentReadInstrumenter, '--source-root', exported,
  '--registry-out', talentTableRegistryPath, '--report-out', talentReadReportPath],
{ cwd: exported, env: instrumentationEnv, stdio: 'inherit' });
const env = { ...process.env, GOROOT: goRoot, GOTOOLCHAIN: 'local', GOENV: 'off', GOWORK: 'off', GO111MODULE: 'on',
  GOPATH: join(cacheDir, 'gopath'), GOMODCACHE: join(cacheDir, 'modules'), GOCACHE: join(cacheDir, 'go-build'),
  GOOS: 'js', GOARCH: 'wasm', CGO_ENABLED: '0', GOPROXY: 'https://proxy.golang.org', GOSUMDB: 'sum.golang.org',
  GOFLAGS: '', GOEXPERIMENT: '', GOWASM: '' };
const wasm = join(staged, 'source-host.wasm');
run(go, ['build', '-mod=readonly', '-trimpath', '-buildvcs=false', '-o', wasm, './cmd/sourcehost'], { cwd: exported, env, stdio: 'inherit' });
copyFileSync(join(goRoot, 'lib/wasm/wasm_exec.js'), join(staged, 'wasm_exec.js'));
const bytes = readFileSync(wasm);
const startSentinel = Buffer.from('3077af0c9274080241e1c107e6d618e6', 'hex');
const endSentinel = Buffer.from('f932433186182072008242104116d8f2', 'hex');
let buildInfo = null;
for (let offset = bytes.indexOf(startSentinel); offset !== -1; offset = bytes.indexOf(startSentinel, offset + 1)) {
  const end = bytes.indexOf(endSentinel, offset + startSentinel.length);
  if (end < 0) continue;
  const candidate = bytes.subarray(offset + startSentinel.length, end).toString('utf8');
  if (candidate.startsWith('path\tgithub.com/genshinsim/gcsim/cmd/sourcehost\n')) { buildInfo = candidate; break; }
}
if (!buildInfo) throw new Error('Cannot read embedded Go WASM module metadata');
writeFileSync(join(staged, 'go-build-info.txt'), `${buildInfo}\n`);
const licenses = join(staged, 'licenses');
mkdirSync(licenses);
const licenseRecords = [];
function license(path, relative, owner, version) {
  const destination = join(licenses, relative);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(path, destination);
  licenseRecords.push({ ...record(destination, `licenses/${relative}`), owner, version });
}
license(join(exported, 'LICENSE'), 'gcsim-AGPL-3.0-or-later.txt', 'genshinsim/gcsim', pins.sourceRevision);
license(join(exported, 'LICENSE-MIT'), 'gcsim-MIT-prior-contributions.txt', 'genshinsim/gcsim', pins.sourceRevision);
license(join(goRoot, 'LICENSE'), 'go-BSD.txt', 'Go Authors', pins.goVersion);
if (existsSync(join(goRoot, 'PATENTS'))) license(join(goRoot, 'PATENTS'), 'go-PATENTS.txt', 'Go Authors', pins.goVersion);
for (const name of files(join(goRoot, 'src/vendor'))) {
  if (/(?:^|\/)(LICENSE|NOTICE|COPYING|PATENTS)(?:\.[^/]*)?$/i.test(name)) {
    license(join(goRoot, 'src/vendor', name), `go-vendor/${name}`, 'Go bundled vendor notices (inclusive)', pins.goVersion);
  }
}
const dependencies = buildInfo.split('\n').map(line => line.trim().split('\t')).filter(row => row[0] === 'dep').map(row => ({ path: row[1], version: row[2], goSum: row[3] ?? null }));
const missingDependencyLicenses = [];
if (dependencies.length) {
  const rows = run(go, ['list', '-mod=readonly', '-m', '-f', '{{.Path}}\t{{if .Replace}}{{.Replace.Dir}}{{else}}{{.Dir}}{{end}}', ...dependencies.map(dep => dep.path)], { cwd: exported, env });
  const directories = new Map(rows.split('\n').map(row => row.split('\t')));
  for (const dep of dependencies) {
    const dir = directories.get(dep.path);
    if (!dir) throw new Error(`Missing linked module directory ${dep.path}`);
    const names = readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      if (entry.isFile() && /^(license|licence|copying|notice|authors|copyright)($|[._-])/i.test(entry.name)) return [entry.name];
      if (entry.isDirectory() && /^licenses?$/i.test(entry.name)) return files(join(dir, entry.name)).map(name => `${entry.name}/${name}`);
      return [];
    }).sort();
    if (!names.length) missingDependencyLicenses.push(dep.path);
    const safe = `${dep.path}@${dep.version}`.replaceAll('/', '__');
    for (const name of names) license(join(dir, name), `dependencies/${safe}/${name}`, dep.path, dep.version);
  }
}
const registrationFiles = {
  character: 'pkg/simulation/imports.character.dm.go',
  weapon: 'pkg/simulation/imports.weapon.dm.go',
  artifact: 'pkg/simulation/imports.artifact.dm.go',
};
const registeredSourcePackages = Object.entries(registrationFiles).flatMap(([kind, sourcePath]) =>
  readFileSync(join(sourceDir, sourcePath), 'utf8').split('\n').flatMap((line, index) => {
    const match = line.match(/^\s*_\s+"([^"]+)"\s*$/);
    return match ? [{ kind, importPath: match[1], sourcePath, sourceLine: index + 1, scope: 'source-implemented-not-game-verified' }] : [];
  }));
const manifest = {
  schemaVersion: 'source-host-stellar-overlay-v1', sourceCommit: pins.sourceRevision,
  source: { repository: 'genshinsim/gcsim', revision: pins.sourceRevision, treeSnapshotSha256: pins.treeJsonSha256 },
  sourceInventory: { meaning: 'Pinned a7 blank imports; not game verification or ability completeness',
    counts: Object.fromEntries(Object.keys(registrationFiles).map(kind => [kind, registeredSourcePackages.filter(row => row.kind === kind).length])),
    registeredSourcePackages },
  sourceLicense: 'AGPL-3.0-or-later', sourceArchiveUrl: pins.sourceArchiveUrl,
  sourceArchiveSha256: pins.sourceArchiveSha256, sourceArchiveBytes: pins.sourceArchiveBytes,
  sourceTreeSha256: pins.treeJsonSha256, verifiedBlobCount,
  patch: record(patchFile, 'a7-source-host.patch'), playerIncomingPatch: record(playerIncomingPatchFile, '005-player-incoming.patch'),
  playerShieldHealthPatch: record(playerShieldHealthPatchFile, '006-player-shield-health.patch'),
  actionAttemptsPatch: record(actionAttemptsPatchFile, 'action-attempts.patch'), bridge: bridgeRecords,
  actionQueuePolicyPatch: record(actionQueuePolicyPatchFile, '008-action-queue-policy.patch'),
  executionProfileDelaysPatch: record(executionProfileDelaysPatchFile, '009-execution-profile-delays.patch'),
  artifactScalarPatch: record(artifactScalarPatchFile, '010-artifact-scalar.patch'),
  weaponAdditivePatch: record(weaponAdditivePatchFile, '011-weapon-additive.patch'),
  artifactConstantsAPatch: record(artifactConstantsAPatchFile, '012-artifact-constants-a.patch'),
  artifactConstantsBPatch: record(artifactConstantsBPatchFile, '013-artifact-constants-b.patch'),
  artifactDynamicAPatch: record(artifactDynamicAPatchFile, '014-artifact-dynamic-a.patch'),
  artifactDynamicBPatch: record(artifactDynamicBPatchFile, '015-artifact-dynamic-b.patch'),
  artifactDynamicCPatch: record(artifactDynamicCPatchFile, '016-artifact-dynamic-c.patch'),
  artifactStellarSetsPatch: record(artifactStellarSetsPatchFile, '017-artifact-stellar-sets.patch'),
  artifactSnapshotPatch: record(artifactSnapshotPatchFile, '018-artifact-snapshot.patch'),
  artifactAdditivePatch: record(artifactAdditivePatchFile, '019-artifact-additive.patch'),
  characterEnergyPatch: record(characterEnergyPatchFile, '020-character-energy.patch'),
  characterHealingPatch: record(characterHealingPatchFile, '021-character-healing.patch'),
  goVersion: pins.goVersion, goArchive: { filename: goPin.filename, sha256: goPin.sha256, bytes: goPin.size },
  goCompiler: record(go, 'bin/go'), linkedModules: dependencies,
  files: [record(wasm, 'source-host.wasm'), record(join(staged, 'wasm_exec.js'), 'wasm_exec.js'), record(join(staged, 'go-build-info.txt'), 'go-build-info.txt'),
    record(talentTableRegistryPath, 'talent-table-registry.json'), record(talentReadReportPath, 'talent-read-instrumentation.json')],
  talentReadInstrumentation: {
    tool: record(talentReadInstrumenter, 'scripts/instrument-talent-reads.go'),
    registry: record(talentTableRegistryPath, 'talent-table-registry.json'),
    report: record(talentReadReportPath, 'talent-read-instrumentation.json'),
    host: { goos: hostGoOS, goarch: hostGoArch },
  },
  licenses: licenseRecords, missingDependencyLicenses,
  characterCooldownPatch: record(characterCooldownPatchFile, '022-character-cooldown.patch'),
  artifactResistancePatch: record(artifactResistancePatchFile, '023-artifact-resistance.patch'),
  shieldBonusPatch: record(shieldBonusPatchFile, '024-shield-bonus.patch'),
  characterModifierPatch: record(characterModifierPatchFile, '025-character-modifiers.patch'),
  characterModifierSnapshotPatch: record(characterModifierSnapshotPatchFile, '026-character-modifier-snapshot.patch'),
  characterDynamicAPatch: record(characterDynamicAPatchFile, '027-character-dynamic-a.patch'),
  characterDynamicBPatch: record(characterDynamicBPatchFile, '028-character-dynamic-b.patch'),
  characterDynamicCPatch: record(characterDynamicCPatchFile, '029-character-dynamic-c.patch'),
  characterScalarProvenancePatch: record(characterScalarProvenancePatchFile, '030-character-scalar-provenance.patch'),
  characterScalarAPatch: record(characterScalarAPatchFile, '031-character-scalar-a.patch'),
  characterScalarBPatch: record(characterScalarBPatchFile, '032-character-scalar-b.patch'),
  delayedElectrochargedProvenancePatch: record(delayedElectrochargedProvenancePatchFile, '033-a7-delayed-electrocharged-provenance.patch'),
  characterVectorAPatch: record(characterVectorAPatchFile, '034-character-vector-a.patch'),
  characterVectorBPatch: record(characterVectorBPatchFile, '035-character-vector-b.patch'),
  characterVectorCPatch: record(characterVectorCPatchFile, '036-character-vector-c.patch'),
  characterVectorDPatch: record(characterVectorDPatchFile, '037-character-vector-d.patch'),
  characterAdditiveAPatch: record(characterAdditiveAPatchFile, '038-character-additive-a.patch'),
  characterAdditiveBPatch: record(characterAdditiveBPatchFile, '039-character-additive-b.patch'),
  characterAdditiveCPatch: record(characterAdditiveCPatchFile, '040-character-additive-c.patch'),
  characterFlatAPatch: record(characterFlatAPatchFile, '041-character-flat-a.patch'),
  characterFlatBPatch: record(characterFlatBPatchFile, '042-character-flat-b.patch'),
  characterFlatCPatch: record(characterFlatCPatchFile, '043-character-flat-c.patch'),
  characterFlatDPatch: record(characterFlatDPatchFile, '044-character-flat-d.patch'),
  characterFlatEPatch: record(characterFlatEPatchFile, '045-character-flat-e.patch'),
  characterHelperDerivationsPatch: record(characterHelperDerivationsPatchFile, '046-character-helper-derivations.patch'),
  characterHealingOverridesPatch: record(characterHealingOverridesPatchFile, '047-character-healing-overrides.patch'),
  cooldownOverridesPatch: record(cooldownOverridesPatchFile, '048-cooldown-overrides.patch'),
  characterMultiplierBasePatch: record(characterMultiplierBasePatchFile, '049-character-multiplier-base.patch'),
  characterMultiplierAPatch: record(characterMultiplierAPatchFile, '050-character-multiplier-a.patch'),
  characterMultiplierBPatch: record(characterMultiplierBPatchFile, '051-character-multiplier-b.patch'),
  characterMultiplierCPatch: record(characterMultiplierCPatchFile, '052-character-multiplier-c.patch'),
  characterShieldBridgePatch: record(characterShieldBridgePatchFile, '053-character-shield-bridge.patch'),
  characterShieldAPatch: record(characterShieldAPatchFile, '054-character-shield-a.patch'),
  characterShieldBPatch: record(characterShieldBPatchFile, '055-character-shield-b.patch'),
  characterShieldCPatch: record(characterShieldCPatchFile, '056-character-shield-c.patch'),
  characterShieldDPatch: record(characterShieldDPatchFile, '057-character-shield-d.patch'),
  shieldWeaponCrystallizePatch: record(shieldWeaponCrystallizePatchFile, '058-shield-weapon-crystallize.patch'),
  healingSourceBridgePatch: record(healingSourceBridgePatchFile, '059-healing-source-bridge.patch'),
  healingSourceAPatch: record(healingSourceAPatchFile, '060-healing-source-a.patch'),
  healingSourceBPatch: record(healingSourceBPatchFile, '061-healing-source-b.patch'),
  healingSourceCPatch: record(healingSourceCPatchFile, '062-healing-source-c.patch'),
  healingSourceDPatch: record(healingSourceDPatchFile, '063-healing-source-d.patch'),
  healingSourceEPatch: record(healingSourceEPatchFile, '064-healing-source-e.patch'),
  healingSourceFPatch: record(healingSourceFPatchFile, '065-healing-source-f.patch'),
  healingSourceGPatch: record(healingSourceGPatchFile, '066-healing-source-g.patch'),
  drainSourceBridgePatch: record(drainSourceBridgePatchFile, '067-drain-source-bridge.patch'),
  drainSourceAPatch: record(drainSourceAPatchFile, '068-drain-source-a.patch'),
  drainSourceBPatch: record(drainSourceBPatchFile, '069-drain-source-b.patch'),
  dehyaDrainSourcePatch: record(dehyaDrainSourcePatchFile, '070-dehya-drain-source.patch'),
  nilouSelfDamagePatch: record(nilouSelfDamagePatchFile, '071-nilou-self-damage.patch'),
  dendroCoreSelfDamagePatch: record(dendroCoreSelfDamagePatchFile, '072-dendro-core-self-damage.patch'),
  phasePatches: phasePatches.map(path => record(path, path.split('/').at(-1))),
  supportedFormulaFamilies: ['ordinary', 'classic-reaction', 'lunar', 'stellar-conduct-event', 'stellar-conduct-direct', 'stellar-swirl-direct', 'stellar-swirl-reaction', 'player-incoming', 'player-shield', 'player-shield-min', 'player-drain', 'artifact-scalar', 'weapon-additive', 'artifact-additive', 'character-energy', 'character-cooldown', 'character-healing', 'character-modifier', 'character-scalar', 'character-additive', 'character-flat', 'character-multiplier', 'character-shield', 'character-drain', 'player-manual-incoming'],
  playerIncomingDamageSharedFormula: true, playerShieldAndDrainSharedFormula: true,
  verification: 'source-assumed-provisional',
};
if (missingDependencyLicenses.length) throw new Error(`Missing linked module notices: ${missingDependencyLicenses.join(', ')}`);
writeFileSync(join(staged, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
run(process.execPath, [join(packageDir, 'generate-inventory.mjs'), '--cache-dir', cacheDir, '--source-dir', sourceDir, '--manifest', join(staged, 'manifest.json'), '--output', join(staged, 'inventory-metadata.json')]);
manifest.files.push(record(join(staged, 'inventory-metadata.json'), 'inventory-metadata.json'));
writeFileSync(join(staged, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
for (const destination of [outputDir, publicDir]) {
  mkdirSync(destination, { recursive: true });
  for (const name of ['source-host.wasm', 'wasm_exec.js', 'go-build-info.txt', 'manifest.json', 'inventory-metadata.json', 'talent-table-registry.json', 'talent-read-instrumentation.json']) {
    const target = join(destination, name);
    if (existsSync(target)) chmodSync(target, 0o644);
    copyFileSync(join(staged, name), target);
  }
  for (const name of files(licenses)) {
    const target = join(destination, 'licenses', name);
    mkdirSync(dirname(target), { recursive: true });
    if (existsSync(target)) chmodSync(target, 0o644);
    copyFileSync(join(licenses, name), target);
  }
}
console.log(JSON.stringify({ sourceCommit: pins.sourceRevision, verifiedBlobCount, wasm: manifest.files[0], manifest: join(outputDir, 'manifest.json') }, null, 2));
