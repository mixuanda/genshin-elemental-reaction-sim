import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runGoldenGenerator } from "./golden-generator.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

runGoldenGenerator({
  label: "Freeze Broken attack 1.52 Golden",
  outputPath: resolve(
    scriptDirectory,
    "../fixtures/freeze-broken-attack-1.52.golden.json",
  ),
  previewFlag: "PREVIEW_FREEZE_BROKEN_ATTACK_V152_GOLDEN",
  updateFlag: "UPDATE_FREEZE_BROKEN_ATTACK_V152_GOLDEN",
  expectedOutputSha256:
    "d9a8811a46efb2ed839fac111a4e796d308323f25f3ce0fe7b53c225664f01d4",
  testPath:
    "packages/test-vectors/src/freeze-broken-attack-v152-golden.test.ts",
  testName:
    "matches the reviewed V1-empty and V2 positive-negative audit matrix",
});
