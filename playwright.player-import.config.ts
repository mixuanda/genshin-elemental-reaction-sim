import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./apps/web/e2e',testMatch:'player-import-calculator.spec.ts',fullyParallel:false,
 use:{baseURL:'http://127.0.0.1:4181',trace:'retain-on-failure'},
 webServer:{command:'npm run preview --workspace @genshin-dps-lab/web -- --host 127.0.0.1 --port 4181 --strictPort',url:'http://127.0.0.1:4181',reuseExistingServer:false,timeout:30000},
 projects:[{name:'chromium',use:{browserName:'chromium'}}]
});
