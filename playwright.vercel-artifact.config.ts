import { defineConfig } from '@playwright/test';
const deployedUrl = process.env.GIDPS_VERCEL_URL;
const stage = process.env.GIDPS_VERCEL_STAGE ?? '/workspace/GIDPS-cloud/vercel-stage-release-7d3289b';
const proxy = deployedUrl ? process.env.HTTPS_PROXY : undefined;
const proxyCaSpki = process.env.GIDPS_BROWSER_CA_SPKI;
export default defineConfig({
  testDir: './apps/web/e2e', testMatch: /vercel-(artifact|native)\.spec\.ts/, fullyParallel: false,
  workers: 1,
  use: {
    baseURL: deployedUrl ?? 'http://127.0.0.1:4188', trace: 'retain-on-failure',
    ...(proxy ? { proxy: { server: proxy } } : {}),
    ...(proxyCaSpki ? { launchOptions: { args: [`--ignore-certificate-errors-spki-list=${proxyCaSpki}`] } } : {})
  },
  ...(deployedUrl ? {} : { webServer: { command: `node deployment/vercel/preview-output.mjs ${stage} 4188`, url: 'http://127.0.0.1:4188', reuseExistingServer: false, timeout: 30000 } }),
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
