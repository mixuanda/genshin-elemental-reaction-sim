import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts"],
    // Wall-clock performance gates are only meaningful without other test
    // files competing for the same CPU. The suite is small enough that a
    // single file worker keeps CI deterministic without hiding slow paths.
    fileParallelism: false,
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
