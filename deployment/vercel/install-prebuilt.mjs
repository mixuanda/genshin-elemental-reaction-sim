// Transport adapter only: verify and unpack a previously checked Build Output API tree.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const manifest = JSON.parse(readFileSync('upload-parts.json', 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const parts = manifest.parts.map(item => {
  if (!/^gidps-upload-\d{3}\.part$/.test(item.file)) throw Error('Invalid upload part path');
  const data = readFileSync(item.file);
  if (data.length !== item.size || hash(data) !== item.sha256) throw Error('Upload part integrity failure');
  return data;
});
const archive = Buffer.concat(parts);
if (archive.length !== manifest.size || hash(archive) !== manifest.sha256) throw Error('Prebuilt archive integrity failure');
writeFileSync('verified-prebuilt.tgz', archive);
const listing = spawnSync('tar', ['-tzf', 'verified-prebuilt.tgz'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
if (listing.status !== 0 || listing.stdout.split('\n').filter(Boolean).some(name => !name.startsWith('.vercel/output/') || name.split('/').includes('..'))) throw Error('Unsafe prebuilt archive');
const unpack = spawnSync('tar', ['-xzf', 'verified-prebuilt.tgz', '--no-same-owner'], { stdio: 'inherit' });
if (unpack.status !== 0 || !existsSync('.vercel/output/config.json')) throw Error('Prebuilt extraction failed');
console.log(`Installed verified GIDPS ${manifest.applicationCommit}; no application or native rebuild performed.`);
