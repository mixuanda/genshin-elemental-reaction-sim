import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runGoldenGenerator } from "./golden-generator.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

runGoldenGenerator({
  label: "reaction-owned application 1.48 Golden",
  outputPath: resolve(
    scriptDirectory,
    "../fixtures/reaction-owned-application-1.48.golden.json"
  ),
  previewFlag:
    "PREVIEW_REACTION_OWNED_APPLICATION_V148_GOLDEN",
  updateFlag: "UPDATE_REACTION_OWNED_APPLICATION_V148_GOLDEN",
  expectedOutputSha256:
    "704c5db38dda87802aa000d664812b63673ea9498981ed21f26a21eac5c620bd",
  testPath:
    "packages/test-vectors/src/reaction-owned-application-v148-golden.test.ts",
  testName:
    "matches the reviewed Burning and Swirl reaction-owned application vector"
});
