import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runGoldenGenerator } from "./golden-generator.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

runGoldenGenerator({
  label: "default 1.48 Golden",
  outputPath: resolve(
    scriptDirectory,
    "../fixtures/legacy-default-120s-1.48.golden.json"
  ),
  previewFlag: "PREVIEW_LEGACY_DEFAULT_V148_GOLDEN",
  updateFlag: "UPDATE_LEGACY_DEFAULT_V148_GOLDEN",
  expectedOutputSha256:
    "563c417efe82582c9647670104b39e0c34074ceb18259a8aaa36e9c997079d5c",
  testPath:
    "packages/test-vectors/src/legacy-default-v148-golden.test.ts",
  testName: "matches the exact default 120-second 1.48 baseline",
  frozenSources: [
    {
      path: resolve(
        scriptDirectory,
        "../fixtures/legacy-default-120s-1.47.golden.json"
      ),
      sha256:
        "918a78d9cdd57d11d5fc9012896c5a7fc240a29b31cd9c09c9ff761fe38d8996"
    },
    {
      path: resolve(
        scriptDirectory,
        "../fixtures/elemental-application-icd-1.47.golden.json"
      ),
      sha256:
        "9238417a2b2e54414366ecb7bb9eeba7ed2070845dff0e6c978af8e96673ddf7"
    }
  ]
});
