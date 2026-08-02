import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runGoldenGenerator } from "./golden-generator.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

runGoldenGenerator({
  label: "default 1.53 Golden",
  outputPath: resolve(
    scriptDirectory,
    "../fixtures/legacy-default-120s-1.53.golden.json",
  ),
  previewFlag: "PREVIEW_LEGACY_DEFAULT_V153_GOLDEN",
  updateFlag: "UPDATE_LEGACY_DEFAULT_V153_GOLDEN",
  expectedOutputSha256:
    "617edf8482f3e212d6d78dbead3df484c2665e5169add9279ac2edd26182b45b",
  testPath: "packages/test-vectors/src/legacy-default-v153-golden.test.ts",
  testName: "matches the exact native default and V1.52 combat baseline",
  frozenSources: [
    {
      path: resolve(
        scriptDirectory,
        "../fixtures/legacy-default-120s-1.49.golden.json",
      ),
      sha256:
        "961505ccb95b536c3563ebeb95ec114f236f3872850df2cb98e5bc8bb5218931",
    },
  ],
});
