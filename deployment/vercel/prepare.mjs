import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const [destination, sourceMaterials] = process.argv.slice(2);
if (!destination || !sourceMaterials) throw Error('Usage: node deployment/vercel/prepare.mjs STAGE_DIRECTORY SOURCE_MATERIALS_DIRECTORY');
const stage = resolve(destination), sources = resolve(sourceMaterials);
if (existsSync(join(stage, '.vercel/output'))) throw Error('Refusing to overwrite an existing output. Choose a new staging directory.');
const output = join(stage, '.vercel/output'), staticDir = join(output, 'static');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const files = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const name = prefix ? `${prefix}/${entry.name}` : entry.name;
  if (entry.isSymbolicLink()) throw Error(`Unexpected symlink: ${name}`);
  return entry.isDirectory() ? files(join(dir, entry.name), name) : [name];
}).sort();
mkdirSync(staticDir, { recursive: true });
for (const name of files(join(repo, 'apps/web/dist/assets'))) {
  if (!/^[\w.-]+\.(?:js|css)$/.test(name)) throw Error(`Unexpected production asset: ${name}`);
  cpSync(join(repo, 'apps/web/dist/assets', name), join(staticDir, 'assets', name), { recursive: false });
}
const native = [];
for (const variant of ['source-host', 'source-host-stellar']) {
  const source = join(repo, 'apps/web/public', variant);
  const manifest = JSON.parse(readFileSync(join(source, 'manifest.json')));
  for (const row of manifest.artifacts ?? manifest.files) {
    const bytes = readFileSync(join(source, row.path));
    if (digest(bytes) !== row.sha256 || bytes.length !== (row.size ?? row.bytes)) throw Error(`${variant}/${row.path} differs from binary manifest`);
  }
  cpSync(source, join(staticDir, variant), { recursive: true });
  native.push({ variant, artifacts: manifest.artifacts ?? manifest.files });
}
const distribution = JSON.parse(readFileSync(join(sources, 'source-distribution.json')));
if (!distribution.publishReady || distribution.licenceScopeSha256 !== digest(readFileSync(join(here, 'stellar-integration-scope.json')))) throw Error('Release source/licence scope is not finalized');
for (const archive of distribution.archives) {
  const bytes = readFileSync(join(sources, archive.path));
  if (digest(bytes) !== archive.sha256 || bytes.length !== archive.bytes) throw Error(`Source material hash mismatch: ${archive.path}`);
}
cpSync(sources, join(staticDir, 'sources', distribution.applicationCommit), { recursive: true });
const legal = join(staticDir, 'legal');
mkdirSync(legal, { recursive: true });
cpSync(join(repo, 'third_party/licenses'), join(legal, 'licenses'), { recursive: true });
cpSync(join(repo, 'THIRD_PARTY_NOTICES.md'), join(legal, 'THIRD_PARTY_NOTICES.md'));
cpSync(join(repo, 'node_modules/zod/LICENSE'), join(legal, 'licenses/zod-MIT.txt'));
cpSync(join(repo, 'node_modules/vite/LICENSE.md'), join(legal, 'licenses/vite-LICENSE.md'));
for (const name of ['STELLAR-RELEASE-LICENSE.md', 'stellar-integration-scope.json', 'AGPL-3.0-or-later.txt']) cpSync(join(here, name), join(legal, name));
writeFileSync(join(legal, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>GIDPS 来源与许可</title>
<h1>GIDPS 来源、许可与计算边界</h1>
<p>GIDPS 修改版本；发布材料准备日期 2026-10-22。修改包含 Go/WASM 桥接、补丁、插桩及共享计算接口；原始版权与许可声明保留。</p>
<p>非官方独立工具，与游戏权利方无关联。来源机制为 provisional；角色名册不代表全部机制验证。单次/短片段结果不等于完整持续循环，具体限制随结果保留。</p>
<p>Classic 固定 b4ae769 来源使用 MIT；Stellar 固定 a7dc4bf 使用 AGPL-3.0-or-later，并保留早期 MIT、Go 与链接依赖声明。GIDPS 修改与构建材料以实际哈希列出；没有将所有原创代码或游戏数据重新标成 MIT。</p>
<p>本次修改后的 Stellar 程序及清单列明的必要原创集成部分按 AGPL-3.0-or-later 提供，允许依该许可复制、修改和再分发，不提供担保。其他独立原创组件不因此统一改许可；第三方与游戏数据权利边界保留。</p>
<p><a href="/legal/STELLAR-RELEASE-LICENSE.md">本次 Stellar 发行授权与范围</a> · <a href="/legal/stellar-integration-scope.json">必要集成源码及哈希清单</a> · <a href="/legal/AGPL-3.0-or-later.txt">完整 AGPL 条款</a></p>
<p><a href="/source-host/licenses/gcsim-MIT.txt">Classic 许可</a> · <a href="/source-host-stellar/licenses/gcsim-AGPL-3.0-or-later.txt">Stellar 许可</a> · <a href="/legal/THIRD_PARTY_NOTICES.md">第三方声明</a> · <a href="/legal/licenses/zod-MIT.txt">Zod MIT</a></p>
<p><a href="/sources/${distribution.applicationCommit}/source-distribution.json">本版本修改源码、构建输入及产物清单</a></p>
<ul>${distribution.archives.map(item => `<li><a href="/sources/${distribution.applicationCommit}/${item.path}">${item.path}</a> · SHA-256 ${item.sha256}</li>`).join('')}</ul>
<p>这是一项限定到本次 Stellar 程序及其必要集成的发行授权，不是新的整仓根许可证。</p></html>`);
const index = readFileSync(join(repo, 'apps/web/dist/index.html'), 'utf8');
writeFileSync(join(staticDir, 'index.html'), index.replace('</body>', '<footer><p>实验版本 · 来源假设、未覆盖机制与 <a href="/legal/">第三方许可 / 对应源码</a>。Stellar 修改程序：AGPL-3.0-or-later，可依许可修改和再分发，不提供担保。非官方独立工具。</p></footer></body>'));
const func = join(output, 'functions/api/showcase.func');
mkdirSync(func, { recursive: true });
cpSync(join(here, 'showcase-proxy.mjs'), join(func, 'index.mjs'));
writeFileSync(join(func, '.vc-config.json'), JSON.stringify({ runtime: 'nodejs24.x', handler: 'index.mjs', launcherType: 'Nodejs', maxDuration: 15, shouldAddHelpers: false }, null, 2));
const config = { version: 3, routes: [
  { src: '^/api/showcase/([^/]+)/?$', dest: '/api/showcase?uid=$1' },
  { src: '^/api(?:/.*)?$', status: 404 },
  { src: '^/assets/.*$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
  { src: '^/source-host(?:-stellar)?/manifest\\.json$', headers: { 'Cache-Control': 'no-store' }, continue: true },
  { src: '^/.*$', headers: { 'X-Content-Type-Options': 'nosniff' }, continue: true },
  { src: '^/legal/?$', dest: '/legal/index.html' },
  { src: '^/$', dest: '/index.html' },
  { handle: 'filesystem' },
  { src: '^/(calculator|examples|builds|team|rotation|results|source-simulation|compare|data|updates)/?$', dest: '/index.html' }
], overrides: Object.fromEntries(['source-host', 'source-host-stellar'].map(name => [`${name}/source-host.wasm`, { contentType: 'application/wasm' }])) };
writeFileSync(join(output, 'config.json'), JSON.stringify(config, null, 2));
writeFileSync(join(stage, '.vercel/project.json'), JSON.stringify({ orgId: 'team_C7eBCyezgeOKwho1xfVLcnln', projectId: 'prj_sJ9g9ekx86oTiizlxalayHtklnxo', projectName: 'gidps' }, null, 2));
const inventory = files(output).map(path => { const bytes = readFileSync(join(output, path)); return { path, bytes: bytes.length, sha256: digest(bytes) }; });
const forbidden = inventory.filter(item => /(?:^|\/)(?:\.env[^/]*|\.git|node_modules|fixtures|test-results|playwright-report)(?:\/|$)|\.map$|\.zip$/.test(item.path));
if (forbidden.length) throw Error(`Unexpected private/test payload: ${forbidden.map(x => x.path).join(', ')}`);
const receipt = { applicationCommit: distribution.applicationCommit, stage, projectId: 'prj_sJ9g9ekx86oTiizlxalayHtklnxo',
  teamId: 'team_C7eBCyezgeOKwho1xfVLcnln', domain: 'gidps.mixuanda.top', publishReady: true,
  pending: [], licenceScopeSha256: distribution.licenceScopeSha256,
  fileCount: inventory.length, totalBytes: inventory.reduce((sum, item) => sum + item.bytes, 0),
  largestFileBytes: Math.max(...inventory.map(item => item.bytes)), native, inventory };
writeFileSync(join(stage, 'readiness.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify({ stage, applicationCommit: receipt.applicationCommit, fileCount: receipt.fileCount, totalBytes: receipt.totalBytes, largestFileBytes: receipt.largestFileBytes, publishReady: true }, null, 2));
