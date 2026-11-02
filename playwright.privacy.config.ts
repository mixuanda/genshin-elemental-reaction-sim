import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './apps/web/e2e', testMatch: 'import-session-privacy.spec.ts', workers: 1,
 use: { baseURL: 'http://127.0.0.1:4193', trace: 'retain-on-failure', launchOptions: process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {} },
 webServer: { command: 'node node_modules/vite/bin/vite.js apps/web --host 127.0.0.1 --port 4193 --strictPort', url: 'http://127.0.0.1:4193', reuseExistingServer: false, timeout: 60000 },
 projects: [{ name: 'chromium', use: { browserName: 'chromium' } }], timeout: 90000 });
