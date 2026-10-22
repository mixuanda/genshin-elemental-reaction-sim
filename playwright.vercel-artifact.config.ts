import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './apps/web/e2e', testMatch: 'vercel-artifact.spec.ts', fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:4188', trace: 'retain-on-failure' },
  webServer: { command: 'node deployment/vercel/preview-output.mjs /workspace/GIDPS-cloud/vercel-stage-7d3289b 4188', url: 'http://127.0.0.1:4188', reuseExistingServer: false, timeout: 30000 },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
