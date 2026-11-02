import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectWorkspaceResolution } from './check-workspace-resolution.mjs';

test('rejects a dependency install whose workspace alias resolves a different checkout', () => {
  const temp = mkdtempSync(join(tmpdir(), 'gidps-resolution-'));
  try {
    const current = join(temp, 'current'), other = join(temp, 'other'), legitimate = join(temp, 'legitimate');
    for (const root of [current, other, legitimate]) {
      mkdirSync(join(root, 'packages', 'formulas'), { recursive: true });
      writeFileSync(join(root, 'package.json'), '{}');
      writeFileSync(join(root, 'packages', 'formulas', 'package.json'), JSON.stringify({ name: '@genshin-dps-lab/formulas', main: './index.js' }));
      writeFileSync(join(root, 'packages', 'formulas', 'index.js'), 'module.exports = {};');
    }
    const install = join(temp, 'install'); mkdirSync(join(install, '@genshin-dps-lab'), { recursive: true });
    symlinkSync(join(other, 'packages', 'formulas'), join(install, '@genshin-dps-lab', 'formulas'), 'junction');
    symlinkSync(install, join(current, 'node_modules'), 'junction');
    const errors = inspectWorkspaceResolution(current);
    assert.equal(errors.length, 1); assert.equal(errors[0].name, '@genshin-dps-lab/formulas');
    assert.ok(errors[0].actual.startsWith(other));
    // Use another root: Node deliberately caches realpath resolution within a process.
    mkdirSync(join(legitimate, 'node_modules', '@genshin-dps-lab'), { recursive: true });
    symlinkSync(join(legitimate, 'packages', 'formulas'), join(legitimate, 'node_modules', '@genshin-dps-lab', 'formulas'), 'junction');
    assert.deepEqual(inspectWorkspaceResolution(legitimate), []);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
