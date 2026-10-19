import { THRILLING_TALES } from "@genshin-dps-lab/reaction-formulas";

/** Fixed-source terms shared by runtime and result replay; this is not a claim
 * of current-game measurement or of modeled character hitlag. */
export const THRILLING_TALES_SOURCE_PROFILE = {
  ...THRILLING_TALES,
  id: "gcsim-thrilling-tales-v1",
  sourceRevision: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
  buffKey: "ttds",
  buffLabel: "讨龙英杰谭",
  evidence: "fixed-source-assumed",
  cooldownClock: "global-frame-assumes-no-character-hitlag",
} as const;
