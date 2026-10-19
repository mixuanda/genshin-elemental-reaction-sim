import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { defaultCacheDir, packageDir, pins, readOptions, run, sha256 } from './common.mjs';

export const pinnedTreeFile = join(packageDir, 'sources/gcsim-b4ae769-tree.json');
export function readPinnedTree(treeFile = pinnedTreeFile) {
  const bytes = readFileSync(treeFile);
  if (sha256(bytes) !== pins.sourceTreeSnapshotSha256) throw new Error('Fixed source tree snapshot SHA-256 mismatch');
  const tree = JSON.parse(bytes);
  if (tree.sha !== pins.sourceRevision || tree.truncated !== false) throw new Error('Expected the complete pinned upstream tree');
  return { bytes, tree };
}

/** Verify tracked bytes, rather than trusting an extraction marker or Git branch. */
export function verifySourceDirectory(sourceDir, tree) {
  let verifiedBlobCount = 0;
  for (const entry of tree.tree) {
    if (entry.type !== 'blob') continue;
    if (!['100644', '100755'].includes(entry.mode) || entry.path.startsWith('/') || entry.path.split('/').includes('..')) throw new Error(`Unsupported source tree entry ${entry.path}`);
    const path = join(sourceDir, entry.path);
    if (!lstatSync(path).isFile()) throw new Error(`Expected pinned source file: ${entry.path}`);
    const bytes = readFileSync(path);
    const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (blob !== entry.sha || bytes.length !== entry.size) throw new Error(`Pinned source blob mismatch: ${entry.path}`);
    verifiedBlobCount++;
  }
  return verifiedBlobCount;
}

/** A new checkout can build without any task-local /tmp source files. */
export async function prepareSource(cacheDir = defaultCacheDir, treeFile = pinnedTreeFile) {
  const { tree } = readPinnedTree(treeFile);
  const cache = join(cacheDir, 'upstream', pins.sourceRevision);
  const sourceDir = join(cache, 'source');
  const receiptFile = join(cache, 'source-download.json');
  mkdirSync(cache, { recursive: true });
  let receipt;
  if (!existsSync(sourceDir)) {
    const sourceUrl = `https://codeload.github.com/genshinsim/gcsim/tar.gz/${pins.sourceRevision}`;
    const archive = join(cache, 'source.tar.gz');
    if (!existsSync(archive)) {
      console.log(`Downloading pinned source ${sourceUrl}`);
      const response = await fetch(sourceUrl);
      if (!response.ok || !response.body) throw new Error(`Source download failed: HTTP ${response.status}`);
      const temporary = `${archive}.download-${process.pid}`;
      try {
        await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: 'wx' }));
        renameSync(temporary, archive);
      } finally { rmSync(temporary, { force: true }); }
    }
    const archiveBytes = readFileSync(archive);
    const prefix = `gcsim-${pins.sourceRevision}/`;
    const entries = run('tar', ['-tzf', archive]).split('\n');
    if (entries.some(name => !name.startsWith(prefix) || name.split('/').includes('..'))) throw new Error('Archive does not contain the pinned source root');
    const staging = mkdtempSync(join(cache, 'unpack-'));
    try {
      run('tar', ['-xzf', archive, '-C', staging, '--strip-components=1']);
      const verifiedBlobCount = verifySourceDirectory(staging, tree);
      receipt = { sourceUrl, archiveSha256: sha256(archiveBytes), archiveBytes: archiveBytes.length, revision: pins.sourceRevision, treeSnapshotSha256: pins.sourceTreeSnapshotSha256, verifiedBlobCount };
      renameSync(staging, sourceDir);
      writeFileSync(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`);
    } finally { rmSync(staging, { recursive: true, force: true }); }
  } else {
    const verifiedBlobCount = verifySourceDirectory(sourceDir, tree);
    receipt = { ...JSON.parse(readFileSync(receiptFile, 'utf8')), verifiedBlobCount };
  }
  return { sourceDir, treeFile, receipt };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = readOptions(['--cache-dir', '--tree-file']);
  console.log(JSON.stringify(await prepareSource(options['cache-dir'], options['tree-file']), null, 2));
}
