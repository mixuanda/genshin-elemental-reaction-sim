import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runGoldenGenerator } from "./golden-generator.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

runGoldenGenerator({
  label: "Basic reaction scheduler 1.51 Golden",
  outputPath: resolve(
    scriptDirectory,
    "../fixtures/basic-reaction-scheduler-1.51.golden.json",
  ),
  previewFlag: "PREVIEW_BASIC_REACTION_SCHEDULER_V151_GOLDEN",
  updateFlag: "UPDATE_BASIC_REACTION_SCHEDULER_V151_GOLDEN",
  expectedOutputSha256:
    "25cf50a6f39eb9bf4de2d709c896dc74e079493ef2b4e81dfad8d65d17fa4424",
  testPath:
    "packages/test-vectors/src/basic-reaction-scheduler-v151-golden.test.ts",
  testName:
    "matches the reviewed legacy-immediate and V2 deferred mixed-Swirl vector",
});
