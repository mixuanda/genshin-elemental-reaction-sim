import { resolveMoonsignLevel, SPECIAL_STATE_REGISTRY, type SpecialPartyMember } from "../../../packages/sim-core/src/special-reaction-state";

type MoonsignLevel = 0 | 1 | 2;
type PartyIdentity = Pick<SpecialPartyMember, "actorId" | "characterKey">;

export interface LunarPanelMoonsign {
  origin: "party" | "capture";
  level: MoonsignLevel | undefined;
  unknownActorIds: string[];
  sourceRefs: string[];
}

const sourceRoot = "https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/";
// These are character constructor facts, not regional classifications. Aino and
// Jahoda contribute Moonsign without enabling any lunar reaction conversion.
// Their unconditional grants do not require an ascension/constellation choice.
const extraContributors = new Set(["aino", "jahoda"]);
// Bounded negatives: these pinned character implementations never assign a
// Moonsign grant to their default-zero CharWrapper. Unreviewed keys stay unknown.
// The specified Wanderer/Faruzan/Nicole/Durin party has also been checked in
// this exact a7 source: NewChar keeps CharWrapper.Moonsign at zero throughout
// Init. Nicole/Durin's independently assigned IsHexerei flag is not a grant.
const knownNonContributors = new Set([
  "barbara", "fischl", "kaeya", "lisa", "nahida", "noelle", "sucrose",
  "wanderer", "faruzan", "nicole", "durin",
]);
const registeredContributors = new Set<string>([
  ...SPECIAL_STATE_REGISTRY["lunar-charged"].enablers,
  ...SPECIAL_STATE_REGISTRY["lunar-bloom"].enablers,
  ...SPECIAL_STATE_REGISTRY["lunar-crystallize"].enablers,
]);

/** Derive only a new-run input. Neither identity nor Moonsign means a reaction
 * actually happened; the existing aura/ICD engine still owns those events. */
export function deriveLunarPanelMoonsign(party: readonly PartyIdentity[]): LunarPanelMoonsign {
  if (party.length < 1 || party.length > 4 || new Set(party.map(member => member.actorId)).size !== party.length) {
    return { origin: "party", level: undefined, unknownActorIds: [...new Set(party.map(member => member.actorId))], sourceRefs: [] };
  }
  const members: SpecialPartyMember[] = party.map(member => ({
    actorId: member.actorId, characterKey: member.characterKey,
    ...(extraContributors.has(member.characterKey) ? { moonsignBenediction: true }
      : knownNonContributors.has(member.characterKey) ? { moonsignBenediction: false } : {}),
  }));
  const resolved = resolveMoonsignLevel(members);
  const constructorRefs = party.filter(member => extraContributors.has(member.characterKey) || knownNonContributors.has(member.characterKey))
    .map(member => `${sourceRoot}internal/characters/${member.characterKey}/${member.characterKey}.go`);
  const registryRefs = party.some(member => registeredContributors.has(member.characterKey))
    ? ["lunar-charged", "lunar-bloom", "lunar-crystallize"].flatMap(key => SPECIAL_STATE_REGISTRY[key as "lunar-charged" | "lunar-bloom" | "lunar-crystallize"].sourceRefs) : [];
  return {
    origin: "party",
    // The core's displayed level is capped at two. Two proven contributors
    // establish that value even if another member's grant is not yet known.
    level: resolved.unknownActorIds.length === 0 || resolved.level === 2 ? resolved.level : undefined,
    unknownActorIds: resolved.unknownActorIds,
    sourceRefs: [...new Set([`${sourceRoot}pkg/core/player/player.go`, `${sourceRoot}pkg/core/player/character/character.go`, ...constructorRefs, ...registryRefs])],
  };
}

/** Historical inputs are displayed exactly as captured. Calling the party
 * resolver for a later run must not rewrite the original capture or result. */
export function capturedLunarPanelMoonsign(level: MoonsignLevel | undefined): LunarPanelMoonsign {
  return { origin: "capture", level, unknownActorIds: [], sourceRefs: [] };
}
