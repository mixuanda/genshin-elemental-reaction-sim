import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareToolchain } from '../scripts/prepare-toolchain.mjs';
const packageDir = dirname(fileURLToPath(import.meta.url));
const pins = JSON.parse(readFileSync(join(packageDir, 'pins.json'), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  if (!['--cache-dir', '--source-dir', '--manifest', '--output'].includes(process.argv[i]) || !process.argv[i + 1]) throw new Error(`Invalid inventory option ${process.argv[i]}`);
  options[process.argv[i]] = resolve(process.argv[i + 1]);
}

// Static extraction: a local stdlib Go AST helper parses verified source text;
// upstream Go code, WASM and simulations are not executed.
// Without --source-dir, prepare the fixed source cache (a first run needs network).
// Manifest registrations are the inventory authority. Names/keys/TODO markers
// come from byte-verified files in the exact corresponding upstream Git tree.
const sourceDir = options['--source-dir'] ?? join('/tmp/gidps-source-host-cache/upstream', pins.sourceRevision, 'source');
const manifestFile = options['--manifest'] ?? join(packageDir, 'dist/manifest.json');
const output = options['--output'] ?? join(packageDir, 'dist/inventory-metadata.json');
const treeBytes = gunzipSync(readFileSync(join(packageDir, 'source-tree.json.gz'))), tree = JSON.parse(treeBytes);
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
if (sha256(treeBytes) !== pins.treeJsonSha256 || tree.truncated !== false || tree.sha !== pins.sourceRevision || manifest.source.revision !== tree.sha) throw new Error('Source manifest and fixed original tree identity must agree');
const blobs = new Map(tree.tree.filter(row => row.type === 'blob').map(row => [row.path, row]));
const readFiles = new Map();
const read = path => {
  if (readFiles.has(path)) return readFiles.get(path).text;
  const entry = blobs.get(path);
  if (!entry) throw new Error(`Source file not in pinned original tree: ${path}`);
  const bytes = readFileSync(join(sourceDir, path));
  const gitBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (gitBlob !== entry.sha || bytes.length !== entry.size) throw new Error(`Source blob mismatch: ${path}`);
  const text = bytes.toString('utf8');
  readFiles.set(path, { path, gitBlobSha1: gitBlob, sha256: sha256(bytes), size: bytes.length, text });
  return text;
};
const lineAt = (text, index) => text.slice(0, index).split('\n').length;
const ref = (path, line) => ({ path, ...(line === undefined ? {} : { line }) });
const namesPath = 'ui/packages/localization/src/locales/names.dm.json';
const overridePath = 'ui/packages/localization/src/locales/names.override.json';
const names = JSON.parse(read(namesPath)).Chinese ?? {}, overrides = JSON.parse(read(overridePath)).Chinese ?? {};
const configs = {
  character: { factory: 'Char', nameGroup: 'character_names', base: 'internal/characters/', catalog: 'character', shortcut: 'CharNameToKey' },
  weapon: { factory: 'Weapon', nameGroup: 'weapon_names', base: 'internal/weapons/', catalog: 'weapon', shortcut: 'WeaponNameToKey' },
  artifact: { factory: 'Set', nameGroup: 'artifact_names', base: 'internal/artifacts/', catalog: 'artifact', shortcut: 'SetNameToKey' },
};
const sourceMaps = new Map();
for (const [kind, config] of Object.entries(configs)) {
  const catalogPath = `pkg/catalog/${config.catalog}.dm.go`, shortcutPath = `pkg/shortcut/${config.catalog}.dm.go`;
  const catalogText = read(catalogPath), shortcutText = read(shortcutPath);
  const markers = [...catalogText.matchAll(/^\tkeys\.([A-Za-z]\w*):\s*\{/gm)];
  const entries = new Map(markers.map((match, i) => {
    const block = catalogText.slice(match.index, markers[i + 1]?.index ?? catalogText.length);
    const key = block.match(/^\s*Key:\s*"([^"]+)"/m)?.[1];
    const gameId = block.match(/^\s*(?:Id|SetId):\s*(\d+)/m)?.[1];
    const element = block.match(/^\s*Element:\s*model\.ElementType_(\w+)/m)?.[1];
    const weaponClass = block.match(/^\s*WeaponClass:\s*model\.WeaponType_(\w+)/m)?.[1];
    const levels = [...block.matchAll(/^\s*MaxLevel:\s*(\d+)/gm)].map(row => Number(row[1]));
    return [match[1], { key, ...(gameId ? { sourceGameId: Number(gameId) } : {}), ...(element ? { element } : {}), ...(weaponClass ? { weaponClass } : {}), ...(levels.length ? { maximumLevel: Math.max(...levels) } : {}), catalogRef: ref(catalogPath, lineAt(catalogText, match.index)) }];
  }));
  const aliases = new Map();
  for (const match of shortcutText.matchAll(/^\s*"([^"\r\n]+)":\s*keys\.([A-Za-z]\w*),/gm)) {
    aliases.set(match[2], [...aliases.get(match[2]) ?? [], { key: match[1], source: ref(shortcutPath, lineAt(shortcutText, match.index)) }]);
  }
  sourceMaps.set(kind, { entries, aliases });
}
const packageFiles = path => [...blobs.keys()].filter(file => file.startsWith(`${path}/`) && !file.slice(path.length + 1).includes('/') && file.endsWith('.go') && !file.endsWith('_test.go'));
const manifestRows = manifest.sourceInventory?.registeredSourcePackages;
if (!Array.isArray(manifestRows)) throw new Error('No registeredSourcePackages inventory in manifest');
const packages = manifestRows.map(registration => {
  const config = configs[registration.kind];
  if (!config) throw new Error(`Unknown registration kind: ${registration.kind}`);
  const path = registration.importPath.replace(/^github\.com\/genshinsim\/gcsim\//, '');
  if (!path.startsWith(config.base)) throw new Error(`Registration outside corresponding source family: ${path}`);
  const imports = read(registration.sourcePath).split('\n');
  if (!imports[registration.sourceLine - 1]?.includes(`"${registration.importPath}"`)) throw new Error(`Blank-import evidence changed: ${registration.importPath}`);
  const directFiles = packageFiles(path), factories = [];
  const scopeFiles = new Set(), pending = [...directFiles];
  while (pending.length) {
    const file = pending.pop(); if (scopeFiles.has(file)) continue;
    scopeFiles.add(file); const text = read(file);
    if (directFiles.includes(file)) {
      for (const match of text.matchAll(new RegExp(`core\\.Register${config.factory}Func\\(\\s*keys\\.([A-Za-z]\\w*)\\s*,`, 'g'))) factories.push({ symbol: match[1], source: ref(file, lineAt(text, match.index)) });
    }
    // Shared files in this same source family are part of implementation, e.g.
    // traveler/common/anemo. Do not mistake an aether directory for a GCSL key.
    for (const match of text.matchAll(/"github\.com\/genshinsim\/gcsim\/([^"\r\n]+)"/g)) {
      if (match[1].startsWith(config.base)) for (const dependency of packageFiles(match[1])) if (!scopeFiles.has(dependency)) pending.push(dependency);
    }
  }
  const todos = [];
  for (const file of [...scopeFiles].sort()) read(file).split('\n').forEach((line, index) => {
    if (/\b(?:TODO|FIXME)\b|not implemented|unimplemented/i.test(line)) todos.push({ ...ref(file, index + 1), text: line.trim(), sharedImplementation: !directFiles.includes(file) });
  });
  const candidates = factories.map(factory => {
    const data = sourceMaps.get(registration.kind).entries.get(factory.symbol), aliases = sourceMaps.get(registration.kind).aliases.get(factory.symbol) ?? [];
    const alias = aliases.find(item => item.key === data?.key);
    return data?.key && alias ? { configurationKey: data.key, symbol: factory.symbol,
      nameZh: overrides[config.nameGroup]?.[data.key] ?? names[config.nameGroup]?.[data.key] ?? null,
      aliases, registrationRef: factory.source, ...data, shortcutRef: alias.source,
      localizationRef: ref(overrides[config.nameGroup]?.[data.key] ? overridePath : namesPath) } : null;
  }).filter(Boolean);
  const unique = [...new Map(candidates.map(item => [item.configurationKey, item])).values()];
  return { kind: registration.kind, importPath: registration.importPath, sourcePath: registration.sourcePath, sourceLine: registration.sourceLine,
    packagePath: path, packageName: path.slice(config.base.length),
    keyStatus: unique.length === 1 ? 'source-registration-and-parser-confirmed' : 'unresolved',
    ...(unique.length === 1 ? { resolved: unique[0] } : { keyGap: unique.length ? '存在多个不同注册键，需人工确认所选配置入口。' : '尚未把本包的字面注册函数、来源目录 Key 与解析器别名表连成完整证据链。' }),
    implementationFiles: [...scopeFiles].sort(), todoMarkers: todos,
    limitations: ['注册表只证明固定宿主导入该包，不等于最新角色名册、完整机制或游戏验证。', 'TODO 是所列实现文件内的显式文本标记；没有标记不代表没有缺口。'] };
});
packageFiles('internal/template/character').forEach(read);
const toolchain = await prepareToolchain(options['--cache-dir']);
const extracted = spawnSync(toolchain.go, ['run', resolve(packageDir, '../scripts/extract-action-capabilities.go')], {
  input: JSON.stringify({ sourceRoot: sourceDir,
    files: [...readFiles.keys()].filter(path => path.endsWith('.go') && !path.endsWith('_test.go')),
    packages: packages.filter(row => row.kind === 'character').map(row => ({ packagePath: row.packagePath, directFiles: packageFiles(row.packagePath) })) }),
  encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  env: { ...process.env, GOROOT: toolchain.goRoot, GOTOOLCHAIN: 'local' }
});
if (extracted.error || extracted.status !== 0) throw new Error(`Action capability extraction failed: ${extracted.error ?? extracted.stderr}`);
const capabilityResult = JSON.parse(extracted.stdout);
const capabilityByPackage = new Map(capabilityResult.packages.map(row => [row.packagePath, row.actionCapabilities]));
capabilityResult.usedFiles.forEach(read);
for (const row of packages) if (row.kind === 'character') {
  const capability = capabilityByPackage.get(row.packagePath);
  if (!capability || capability.schemaVersion !== 1 || capability.actions.length !== 9) throw new Error(`Incomplete action extraction: ${row.packagePath}`);
  row.actionCapabilities = capability;
}
const syntaxPaths = ['pkg/gcs/parser/parseCharacter.go', 'pkg/gcs/parser/parse.go', 'pkg/gcs/ast/lex.go'];
syntaxPaths.forEach(read);
const result = { schemaVersion: 1, generatedAt: new Date().toISOString(),
  source: { repository: manifest.source.repository, revision: tree.sha, treeSnapshotSha256: sha256(treeBytes) },
  scope: 'Pinned source registration, literal factory key, parser aliases, localization and explicit TODO markers; not latest, canonical, game-verified or a promise that every branch executes.',
  registeredPackageCount: packages.length,
  counts: Object.fromEntries(Object.keys(configs).map(kind => [kind, packages.filter(row => row.kind === kind).length])),
  resolvedKeyCount: packages.filter(row => row.keyStatus === 'source-registration-and-parser-confirmed').length,
  todoPackageCount: packages.filter(row => row.todoMarkers.length).length,
  explicitTodoMarkerCount: packages.reduce((sum, row) => sum + row.todoMarkers.length, 0),
  syntaxEvidence: [ref('pkg/gcs/parser/parse.go', 85), ref('pkg/gcs/parser/parseCharacter.go', 44), ref('pkg/gcs/parser/parseCharacter.go', 126), ref('pkg/gcs/parser/parseCharacter.go', 180)],
  packages, sourceFiles: [...readFiles.values()].map(({ text: _text, ...record }) => record) };
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ output, packages: result.registeredPackageCount, resolvedKeys: result.resolvedKeyCount, todoPackages: result.todoPackageCount, todoMarkers: result.explicitTodoMarkerCount, sourceFiles: result.sourceFiles.length }));
