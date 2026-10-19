import type { ArtifactEffectId } from "./types";

const sourceRevision = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const sourceRoot = `https://github.com/genshinsim/gcsim/blob/${sourceRevision}`;

/** Fixed reference callbacks, with character hitlag explicitly excluded.
 * Panel bonuses and the Scroll four-piece effect are outside this model. */
export const ARTIFACT_EVENT_SOURCE_PROFILE = {
  id: "gcsim-artifact-events-v1",
  sourceRevision,
  mode: "fixed-source-no-character-hitlag-v1",
  sourceRefs: {
    "exile-4pc": `${sourceRoot}/internal/artifacts/exile/exile.go`,
    "scholar-4pc": `${sourceRoot}/internal/artifacts/scholar/scholar.go`,
    "gambler-4pc": `${sourceRoot}/internal/artifacts/gambler/gambler.go`,
    "scroll-2pc": `${sourceRoot}/internal/artifacts/scrolloftheheroofcindercity/scrolloftheheroofcindercity.go`,
  } satisfies Record<ArtifactEffectId, string>,
  exile: { durationFrames: 360, tickFrames: [120, 240, 360], energy: 2 },
  scholar: { cooldownFrames: 180, energy: 3 },
  gambler: { cooldownFrames: 900 },
  scroll: { energy: 6 },
} as const;

export const NIGHTSOUL_BURST_SOURCE_PROFILE = {
  id: "gcsim-nightsoul-burst-v1",
  sourceRevision,
  sourceRef: `${sourceRoot}/pkg/simulation/setup.go`,
  cooldownFramesByNatlanCount: [0, 1080, 720, 540, 540],
} as const;
