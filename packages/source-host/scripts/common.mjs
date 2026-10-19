import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const pins = JSON.parse(readFileSync(join(packageDir, 'scripts/pins.json'), 'utf8'));
export const defaultCacheDir = '/tmp/gidps-source-host-cache';
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const fileRecord = (path, name) => {
  const bytes = readFileSync(path);
  return { path: name, sha256: sha256(bytes), size: bytes.length };
};

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status})\n${result.stdout ?? ''}${result.stderr ?? ''}`);
  return result.stdout?.trim() ?? '';
}

export function readOptions(allowed) {
  const options = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i];
    if (!allowed.includes(key) || !process.argv[i + 1]) throw new Error(`Expected one of ${allowed.join(', ')} followed by a value; received ${key}`);
    options[key.slice(2)] = resolve(process.argv[i + 1]);
  }
  return options;
}

export function filesBelow(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en')).flatMap((entry) => {
    if (entry.name === '.DS_Store') return [];
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return filesBelow(join(directory, entry.name), name);
    if (!entry.isFile()) throw new Error(`Expected a regular source file: ${join(directory, entry.name)}`);
    return [name];
  });
}
