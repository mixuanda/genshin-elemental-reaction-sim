import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A reused dependency install must not silently compile another checkout's workspace packages. */
export function inspectWorkspaceResolution(root) {
  return readdirSync(join(root, 'packages'), { withFileTypes: true }).filter(row => row.isDirectory()).flatMap(row => {
    const expected = join(root, 'packages', row.name);
    let manifest;
    try { manifest = JSON.parse(readFileSync(join(expected, 'package.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    if (!manifest.name?.startsWith('@genshin-dps-lab/')) return [];
    try {
      // Some workspace packages expose only subpaths and have no root entry.
      const actual = realpathSync(join(root, 'node_modules', manifest.name));
      return actual === realpathSync(expected) ? [] : [{ name: manifest.name, expected, actual }];
    } catch (error) { return [{ name: manifest.name, expected, actual: `unresolved: ${error.code ?? error.message}` }]; }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const errors = inspectWorkspaceResolution(root);
  if (errors.length) {
    console.error('Workspace package resolution does not belong to this checkout. Run npm ci here or correct only this checkout\'s local workspace links.');
    for (const error of errors) console.error(`${error.name}: expected ${error.expected}; received ${error.actual}`);
    process.exitCode = 1;
  } else console.log('Workspace package entries resolve to this checkout.');
}
