import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts"],
    // Wall-clock performance gates are only meaningful without other test
    // files competing for the same CPU. The suite is small enough that a
    // single file worker keeps CI deterministic without hiding slow paths.
    fileParallelism: false,
    // Several reviewed Golden tests replay multiple 120-second versions. Keep
    // their correctness timeout tolerant of a busy desktop; the dedicated
    // performance suite below retains its own strict median/max thresholds.
    testTimeout: 20_000,
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
