/** Four-piece runtime only; the input build already owns two-piece panel stats. */
export const ARTIFACT_BUFF_EFFECT_IDS = ["noblesse-4pc", "instructor-4pc", "gilded-4pc", "fragment-4pc", "paradise-4pc", "vermillion-4pc"] as const;
export type ArtifactBuffEffectId = typeof ARTIFACT_BUFF_EFFECT_IDS[number];
export const ARTIFACT_BUFF_PROFILE_ID = "gcsim-b4ae769-artifact-buffs-v1" as const;
const root = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
export const ARTIFACT_BUFF_SOURCE = {
  id: ARTIFACT_BUFF_PROFILE_ID, sourceRevision: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", mode: "fixed-source-no-character-hitlag-v1",
  sourceRefs: {
    "noblesse-4pc": `${root}/internal/artifacts/noblesse/noblesse.go`,
    "instructor-4pc": `${root}/internal/artifacts/instructor/instructor.go`,
    "gilded-4pc": `${root}/internal/artifacts/gildeddreams/gildeddreams.go`,
    "fragment-4pc": `${root}/internal/artifacts/fragmentofharmonicwhimsy/fragmentofharmonicwhimsy.go`,
    "paradise-4pc": `${root}/internal/artifacts/flowerofparadiselost/flowerofparadiselost.go`,
    "vermillion-4pc": `${root}/internal/artifacts/vermillion/vermillion.go`,
  },
  noblesse: { key: "nob-4pc", atkPct: .2, durationFrames: 720 },
  instructor: { key: "instructor-4pc", em: 120, durationFrames: 480 },
  gilded: { key: "gd-4pc", atkPctPerSameElement: .14, emPerDifferentElement: 50, countCap: 3, durationFrames: 480, cooldownFrames: 480 },
  fragment: { key: "fragmentofharmonicwhimsy-4pc", dmgBonusPerStack: .18, stackCap: 3, durationFrames: 360 },
  paradise: { key: "flower-4pc-buff", baseReactionBonus: .4, reactionBonusPerStack: .4 * .25, stackCap: 4, durationFrames: 600, cooldownFrames: 60 },
  vermillion: { key: "verm-4pc", baseAtkPct: .08, atkPctPerStack: .1, stackCap: 4, durationFrames: 960, cooldownFrames: 48 },
  noblesseDelayedCharacterKeys: ["ganyu", "beidou", "ningguang", "aloy", "sayu", "aether-anemo", "lumine-anemo"],
} as const;
export interface ArtifactBuffActor {
  actorId: string; effectId: ArtifactBuffEffectId;
  /** Explicit source snapshot class; never inferred from a display name. */
  noblesseSelfDelayFrames?: 0 | 1;
}
export interface ArtifactBuffModel { mode: typeof ARTIFACT_BUFF_SOURCE.mode; actors: ArtifactBuffActor[]; }
export const ARTIFACT_BUFF_ORDINARY_REACTIONS = ["vaporize", "reverseVaporize", "melt", "reverseMelt", "overload", "superconduct", "electroCharged", "freeze", "shatter", "swirlPyro", "swirlHydro", "swirlCryo", "swirlElectro", "crystallizePyro", "crystallizeHydro", "crystallizeCryo", "crystallizeElectro", "burning", "quicken", "aggravate", "spread", "bloom", "hyperbloom", "burgeon"] as const;
export type ArtifactBuffOrdinaryReaction = typeof ARTIFACT_BUFF_ORDINARY_REACTIONS[number];
export const ARTIFACT_BUFF_REACTIONS = [...ARTIFACT_BUFF_ORDINARY_REACTIONS, "lunarCharged", "lunarCrystallize"] as const;
export type ArtifactBuffReaction = typeof ARTIFACT_BUFF_REACTIONS[number];
export interface ArtifactBuffState {
  stacks: number;
  /** Inclusive presence query; separately cleaned by real Stats/ReactBonus. */
  effectExpiresFrame: number | null;
  cooldownExpiresFrame: number | null;
}
export interface ArtifactBuffCapturedState {
  actors: Array<ArtifactBuffActor & { state: ArtifactBuffState; sameElementCount: number; differentElementCount: number }>;
}
export interface ArtifactBuffApplication {
  receiverId: string; sourceActorId: string; key: string; stat: "atkPct" | "em" | "dmgBonus";
  /** update changes a live modifier value without replacing its original window. */
  operation: "replace" | "update";
  value: number; startFrame: number; expiresFrame: number;
}
export interface ArtifactBuffRemoval { receiverId: string; key: string; }
export interface ArtifactBuffDelayedApplication {
  actorId: string; effectId: "noblesse-4pc"; receiverId: string; applyFrame: number; sourceFrame: number;
}
export type ArtifactBuffEvent =
  | { kind: "burst"; frame: number; sourceActorId: string; activeCharacterId: string | null }
  | { kind: "reaction"; frame: number; sourceActorId: string; activeCharacterId: string | null; reaction: ArtifactBuffReaction; targetIsEnemy: boolean }
  | { kind: "bond-of-life-change"; frame: number; actorId: string; amount: number }
  | { kind: "hp-drain"; frame: number; amount: number }
  | { kind: "swap"; frame: number; previousActorId: string | null; nextActorId: string }
  | { kind: "stats-sample"; frame: number; actorId: string }
  | { kind: "react-bonus-read"; frame: number; actorId: string; reaction: string }
  | { kind: "delayed-buff"; frame: number; task: ArtifactBuffDelayedApplication };
export type ArtifactBuffOutcome = "applied" | "scheduled" | "stack-gained" | "window-removed" | "expired-on-read" | "off-field" | "wrong-owner" | "zero-change" | "cooldown-blocked" | "window-inactive" | "max-stacks" | "target-not-enemy";
export interface ArtifactBuffDecision {
  sourceProfileId: typeof ARTIFACT_BUFF_PROFILE_ID; sourceRef: string; actorId: string; effectId: ArtifactBuffEffectId;
  event: ArtifactBuffEvent; outcome: ArtifactBuffOutcome; stateBefore: ArtifactBuffState; stateAfter: ArtifactBuffState;
  sameElementCount: number; differentElementCount: number; applications: ArtifactBuffApplication[];
  removals: ArtifactBuffRemoval[]; delayedApplications: ArtifactBuffDelayedApplication[];
}
export const createArtifactBuffState = (): ArtifactBuffState => ({ stacks: 0, effectExpiresFrame: null, cooldownExpiresFrame: null });
