import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:5184", launchOptions: { executablePath: process.env.GIDPS_IMPORT_BROWSER || "/usr/bin/chromium", args: ["--no-sandbox"] } },
  webServer: {
    command: "npx vite apps/player-import --host 127.0.0.1 --port 5184 --strictPort",
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    url: "http://127.0.0.1:5184", reuseExistingServer: false
  },
  outputDir: "../../test-results/player-import",
  reporter: "list"
});
