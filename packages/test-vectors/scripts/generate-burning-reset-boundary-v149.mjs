import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runGoldenGenerator } from "./golden-generator.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

runGoldenGenerator({
  label: "Burning reset boundary 1.49 Golden",
  outputPath: resolve(
    scriptDirectory,
    "../fixtures/burning-reset-boundary-1.49.golden.json",
  ),
  previewFlag: "PREVIEW_BURNING_RESET_BOUNDARY_V149_GOLDEN",
  updateFlag: "UPDATE_BURNING_RESET_BOUNDARY_V149_GOLDEN",
  expectedOutputSha256:
    "3e89c431c3b277fd1dc52881f7ea048b39060e0c16c5230af9c1a73b624e0e10",
  testPath:
    "packages/test-vectors/src/burning-reset-boundary-v149-golden.test.ts",
  testName:
    "matches the reviewed v1/v2 Burning reset-boundary comparison vector",
});
