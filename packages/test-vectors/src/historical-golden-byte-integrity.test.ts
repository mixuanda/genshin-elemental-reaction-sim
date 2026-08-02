import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const HISTORICAL_GOLDEN_SHA256 = {
  "burning-callback-delivery-1.44.golden.json":
    "4caf9609daac1fde41195399e5c3af8daca60e14849aa4c5195b286ae947da65",
  "burning-reset-boundary-1.49.golden.json":
    "3e89c431c3b277fd1dc52881f7ea048b39060e0c16c5230af9c1a73b624e0e10",
  "direct-damage-group-1.46.golden.json":
    "eebbd992dddbf4a24b16dd5c9d00a31a2c6d107372ba9fc58994181061156899",
  "electro-charged-global-cadence-1.42.golden.json":
    "ed7a41b1bc67adb1908367172db2bcecd0e668dbdd9f214f14829adbb3375611",
  "electro-charged-propagation-1.41.golden.json":
    "b855f87f391a5f0dfd82e30a4666c8bb79a7777c94bc8f2bd675178fabdb0d18",
  "electro-charged-quicken-cleanup-1.40.golden.json":
    "bc1fb0bec7b526c1f3046ef81bb3aac5d947410fc013fbcc8d6fd2c6731563e0",
  "elemental-application-icd-1.47.golden.json":
    "9238417a2b2e54414366ecb7bb9eeba7ed2070845dff0e6c978af8e96673ddf7",
  "legacy-default-120s-1.46.golden.json":
    "3ef783e206a4566fd935c3251f97d31aeb6cddb7ec7e82eccf661d62cb994465",
  "legacy-default-120s-1.47.golden.json":
    "918a78d9cdd57d11d5fc9012896c5a7fc240a29b31cd9c09c9ff761fe38d8996",
  "legacy-default-120s-1.48.golden.json":
    "563c417efe82582c9647670104b39e0c34074ceb18259a8aaa36e9c997079d5c",
  "legacy-default-120s-1.49.golden.json":
    "961505ccb95b536c3563ebeb95ec114f236f3872850df2cb98e5bc8bb5218931",
  "quicken-bloom-task-order-1.40.golden.json":
    "b13f96768e589b77ff62daef1fd5cae0a3b1bab2a98fc88ce7c3f415356805b4",
  "reaction-matrix-1.35.golden.json":
    "d21e107dd1ed53f897d5f5d1f45af4735cd99297c281f5123d71e1fbc394d8c5",
  "reaction-owned-application-1.48.golden.json":
    "704c5db38dda87802aa000d664812b63673ea9498981ed21f26a21eac5c620bd",
  "reaction-damage-group-reset-boundary-1.50.golden.json":
    "f58cdac88ec2395239fc5f8c4818adff92e563479268ee5c4aa5a75639ae06d1",
  "shatter-recursive-delivery-1.39.golden.json":
    "a83ff459e5753ddef1082d923b6476bdbe5392dc9f574ac3d462e357df322579"
} as const;

function byteSha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("historical reviewed Golden byte integrity", () => {
  for (const [filename, expectedSha256] of Object.entries(
    HISTORICAL_GOLDEN_SHA256
  )) {
    it(`keeps ${filename} byte-for-byte frozen`, () => {
      const fixtureUrl = new URL(`../fixtures/${filename}`, import.meta.url);
      expect(byteSha256(readFileSync(fixtureUrl))).toBe(expectedSha256);
    });
  }
});
