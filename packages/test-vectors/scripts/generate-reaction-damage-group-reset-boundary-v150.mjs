import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runGoldenGenerator } from "./golden-generator.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

runGoldenGenerator({
  label: "Reaction damage-group reset boundary 1.50 Golden",
  outputPath: resolve(
    scriptDirectory,
    "../fixtures/reaction-damage-group-reset-boundary-1.50.golden.json",
  ),
  previewFlag:
    "PREVIEW_REACTION_DAMAGE_GROUP_RESET_BOUNDARY_V150_GOLDEN",
  updateFlag:
    "UPDATE_REACTION_DAMAGE_GROUP_RESET_BOUNDARY_V150_GOLDEN",
  expectedOutputSha256:
    "f58cdac88ec2395239fc5f8c4818adff92e563479268ee5c4aa5a75639ae06d1",
  testPath:
    "packages/test-vectors/src/reaction-damage-group-reset-boundary-v150-golden.test.ts",
  testName:
    "matches the reviewed V2 Superconduct/Overload 29-frame-offset reset vector",
});
