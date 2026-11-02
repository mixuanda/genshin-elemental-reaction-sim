import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// Uses the locked local Playwright CLI; works without POSIX env assignments or shell quoting.
const cli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
const loader = fileURLToPath(new URL('./register-json-modules.mjs', import.meta.url));
const result = spawnSync(process.execPath, ['--import', loader, cli, 'test',
  'apps/web/e2e/source-worker-failure.spec.ts',
  'apps/web/e2e/source-runtime-cursor.spec.ts',
  'apps/web/e2e/source-team-builder-clear-actions.spec.ts', ...process.argv.slice(2)], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { ...process.env, GIDPS_PREBUILT: '1' }, stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
