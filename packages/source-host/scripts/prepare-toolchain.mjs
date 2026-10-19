import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { defaultCacheDir, pins, readOptions, run, sha256 } from './common.mjs';

export async function prepareToolchain(cacheDir = defaultCacheDir) {
  const arch = process.arch === 'x64' ? 'amd64' : process.arch;
  const host = `${process.platform}-${arch}`;
  const archive = pins.toolchains[host];
  if (!archive) throw new Error(`No pinned toolchain for ${host}`);
  const cache = join(cacheDir, pins.goVersion, host);
  mkdirSync(cache, { recursive: true });
  const archivePath = join(cache, archive.filename);
  const sourceUrl = `${pins.goDownloadBaseUrl}${archive.filename}`;
  if (!existsSync(archivePath)) {
    console.log(`Downloading ${sourceUrl}`);
    const response = await fetch(sourceUrl);
    if (!response.ok || !response.body) throw new Error(`Go download failed: HTTP ${response.status}`);
    const temporary = `${archivePath}.download-${process.pid}`;
    try {
      await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: 'wx' }));
      const bytes = readFileSync(temporary);
      if (bytes.length !== archive.size || sha256(bytes) !== archive.sha256) throw new Error('Official Go archive checksum or size mismatch');
      renameSync(temporary, archivePath);
    } finally {
      rmSync(temporary, { force: true });
    }
  }
  const archiveBytes = readFileSync(archivePath);
  if (archiveBytes.length !== archive.size || sha256(archiveBytes) !== archive.sha256) throw new Error(`Cached Go archive failed verification: ${archivePath}`);
  const goRoot = join(cache, 'go');
  if (!existsSync(goRoot)) {
    const temporary = mkdtempSync(join(cache, 'unpack-'));
    try {
      run('tar', ['-xzf', archivePath, '-C', temporary]);
      renameSync(join(temporary, 'go'), goRoot);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }
  const go = join(goRoot, 'bin/go');
  const version = run(go, ['version'], { env: { ...process.env, GOROOT: goRoot, GOTOOLCHAIN: 'local' } });
  if (version !== `go version ${pins.goVersion} ${process.platform}/${arch}`) throw new Error(`Unexpected Go version: ${version}`);
  const manifest = { version, host, sourceUrl, releaseMetadataUrl: pins.goReleaseMetadataUrl, archive: { ...archive }, executableSha256: sha256(readFileSync(go)) };
  writeFileSync(join(cache, 'toolchain-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { go, goRoot, manifest };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = readOptions(['--cache-dir']);
  const toolchain = await prepareToolchain(options['cache-dir']);
  console.log(JSON.stringify({ go: toolchain.go, ...toolchain.manifest }, null, 2));
}
