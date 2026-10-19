import { makeConfig, neutralStats } from "./fixtures";
import { createMoondewCleanseAbility } from "../lunar-bloom-runtime";
export function stellarConfig() {
  const base = makeConfig();
  return makeConfig({ duration: 10, cycleLength: 11, reactionEngine: { mode: "aura-v3" }, characters: [
    { ...base.characters[0]!, id: "c", element: "cryo", stats: { ...neutralStats } }, { ...base.characters[0]!, id: "e", element: "electro", stats: { ...neutralStats } }
  ], rotation: [], timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "c", swapFrames: 1,
    abilities: [
      { id: "c", actorId: "c", name: "cryo", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0, hits: [{ id: "c", frame: 0, scaling: 1, application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" } } }] },
      { id: "e", actorId: "e", name: "electro", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0, hits: [{ id: "e", frame: 0, scaling: 1, application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" } } }] },
      { id: "p", actorId: "e", name: "physical", kind: "normal", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0, hits: [{ id: "p", frame: 0, scaling: 1, element: "physical" }] },
      { id: "delay", actorId: "e", name: "snapshot", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0, hits: [{ id: "snap", frame: 20, scaling: 1, snapshot: "action" }, { id: "live", frame: 20, scaling: 1, snapshot: "hit" }] }
    ], commands: [{ type: "skill", actorId: "c", abilityId: "c", atFrame: 0 }, { type: "swap", characterId: "e", atFrame: 5 }, ...[6,12,18].map(atFrame => ({ type: "skill" as const, actorId: "e", abilityId: "e", atFrame })), { type: "skill", actorId: "e", abilityId: "delay", atFrame: 240 }, ...[260,400,500].map(atFrame => ({ type: "normal" as const, actorId: "e", abilityId: "p", atFrame }))] } });
}
export const lunarBloomParty = [{ actorId: "c", characterKey: "columbina" }, { actorId: "d", characterKey: "nahida" }];
export const lunarBloomDeclaration = { sourceAbilityId: "moon", actorId: "c", abilityKey: "columbina-moondew-cleanse-idle-v1" as const, talentLevel: 10, ascension: 6, constellation: 0 as const };
export function lunarBloomConfig(withDeclaredAbility = true) {
  const base = makeConfig();
  return makeConfig({ duration: 10, cycleLength: 11, reactionEngine: { mode: "aura-v5" }, enemy: { ...base.enemy, targets: [{ id: "enemy-0", name: "Synthetic stationary target", position: { x: 0, y: 0 }, hitboxRadius: 0 }] }, characters: [
    { ...base.characters[0]!, id: "c", element: "hydro", stats: { ...neutralStats, baseHp: 35000 } },
    { ...base.characters[0]!, id: "d", element: "dendro", stats: { ...neutralStats } }
  ], rotation: [], timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "c", swapFrames: 1,
    abilities: [
      { id: "c", actorId: "c", name: "hydro", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0, hits: [{ id: "c", frame: 0, scaling: 1, application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" } } }] },
      { id: "d", actorId: "d", name: "dendro", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0, hits: [{ id: "d", frame: 0, scaling: 1, application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" } } }] },
      ...(withDeclaredAbility ? [createMoondewCleanseAbility("c", "moon")] : [])
    ], commands: [{ type: "skill", actorId: "c", abilityId: "c", atFrame: 0 }, { type: "swap", characterId: "d", atFrame: 5 }, { type: "skill", actorId: "d", abilityId: "d", atFrame: 6 }, { type: "swap", characterId: "c", atFrame: 153 }, ...(withDeclaredAbility ? [{ type: "charge" as const, actorId: "c", abilityId: "moon", atFrame: 160 }] : [])] } });
}
export const stellarSwirlParty = [{ actorId: "c", characterKey: "sandrone" }, { actorId: "a", characterKey: "sucrose" }];
export function stellarSwirlConfig(triggerFrames = [6,12,18,24,30,36,37]) {
  const base = makeConfig();
  return makeConfig({ duration: 5, cycleLength: 6, reactionEngine: { mode: "aura-v3" }, characters: [
    { ...base.characters[0]!, id: "c", element: "cryo", stats: { ...neutralStats, em: 100, critRate: 0.3 } },
    { ...base.characters[0]!, id: "a", element: "anemo", stats: { ...neutralStats, em: 200, critRate: 0.6 } }
  ], rotation: [], timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "c", swapFrames: 1,
    abilities: [
      { id: "c", actorId: "c", name: "Synthetic Cryo", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0, hits: [{ id: "c", frame: 0, scaling: 1, application: { gaugeUnits: 3.75, icd: { mode: "no-icd-v1" } } }] },
      { id: "a", actorId: "a", name: "Synthetic Anemo", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0, hits: [{ id: "a", frame: 0, scaling: 1, application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" } } }] },
      { id: "flight-buff", actorId: "a", name: "Explicit during-flight modifier", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0, buffs: [{ stat: "em", value: 300, target: "self", durationFrames: 5 }], debuffs: [{ element: "anemo", resShred: 0.2, durationFrames: 5 }] }
    ], commands: [{ type: "skill" as const, actorId: "c", abilityId: "c", atFrame: 0 }, { type: "swap" as const, characterId: "a", atFrame: 5 }, ...triggerFrames.map(atFrame => ({ type: "skill" as const, actorId: "a", abilityId: "a", atFrame })), { type: "skill" as const, actorId: "a", abilityId: "flight-buff", atFrame: 7 }].sort((a,b) => a.atFrame - b.atFrame) } });
}
