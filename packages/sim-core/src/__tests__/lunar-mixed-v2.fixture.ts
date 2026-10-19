import { makeConfig, neutralStats } from "./fixtures";
import { createMoondewCleanseAbility } from "../lunar-bloom-runtime";

export const mixedV2Party = [{ actorId: "h", characterKey: "columbina" }, { actorId: "e", characterKey: "fischl" }, { actorId: "d", characterKey: "lauma" }, { actorId: "g", characterKey: "zibai" }];
export const mixedV2Declaration = { sourceAbilityId: "moon", actorId: "h", abilityKey: "columbina-moondew-cleanse-idle-v1" as const, talentLevel: 10, ascension: 6, constellation: 0 as const };
/** Explicit synthetic gauge/geometry/action inputs, never claimed as sourced character skills. */
export function mixedV2Config(withMoondew = true) {
  const base = makeConfig();
  return makeConfig({ duration: 6, cycleLength: 7, reactionEngine: { mode: "aura-v7" }, rotation: [],
    enemy: { ...base.enemy, targets: [{ id: "enemy-0", name: "Synthetic stationary target", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    characters: (["hydro", "electro", "dendro", "geo"] as const).map((element, i) => ({ ...base.characters[0]!, id: ["h", "e", "d", "g"][i]!, name: `Synthetic ${element}`, element, stats: { ...neutralStats, baseHp: i === 0 ? 35000 : 10000, em: 100 + i * 100, critRate: 0.3 } })),
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "h", swapFrames: 1,
      abilities: [...["h", "e", "d", "g"].map((actorId, i) => ({ id: actorId, actorId, name: actorId, kind: "skill" as const, cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        hits: [{ id: actorId, frame: 0, scaling: 1, element: (["hydro", "electro", "dendro", "geo"] as const)[i]!, application: { gaugeUnits: actorId === "h" ? 4 : 1, icd: { mode: "no-icd-v1" as const } }, ...(actorId === "e" ? { geometry: { kind: "circle" as const, coordinateSpace: "world" as const, origin: { x: 0, y: 0 }, radius: 5 } } : {}) }] })), ...(withMoondew ? [createMoondewCleanseAbility("h", "moon")] : [])],
      commands: [{ type: "skill", actorId: "h", abilityId: "h", atFrame: 0 }, { type: "swap", characterId: "e", atFrame: 5 }, { type: "skill", actorId: "e", abilityId: "e", atFrame: 6 }, { type: "swap", characterId: "d", atFrame: 7 }, { type: "skill", actorId: "d", abilityId: "d", atFrame: 8 },
        { type: "swap", characterId: "e", atFrame: 55 }, { type: "skill", actorId: "e", abilityId: "e", atFrame: 56 }, { type: "swap", characterId: "h", atFrame: 59 }, { type: "skill", actorId: "h", abilityId: "h", atFrame: 60 }, { type: "swap", characterId: "g", atFrame: 69 },
        ...[70, 76, 82].map(atFrame => ({ type: "skill" as const, actorId: "g", abilityId: "g", atFrame })), { type: "swap", characterId: "h", atFrame: 159 }, ...(withMoondew ? [{ type: "charge" as const, actorId: "h", abilityId: "moon", atFrame: 160 }] : [])] }
  });
}
