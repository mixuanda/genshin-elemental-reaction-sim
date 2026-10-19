import { expect, it } from "vitest";
import { applyEquipmentBuildToTeam } from "../equipment-team-handoff";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";
import { resolveEquipmentBuild } from "@genshin-dps-lab/game-data/equipment-build";

it("applies one selected character's sourced equipment to an actual local hit without retaining the old weapon", () => {
  const original = makeConfig({
    meta: { name: "本地白影剑配装", version: "custom-v1", verificationStatus: "user-supplied" },
    characters: [{ id: "noelle", name: "诺艾尔", element: "geo", color: "#aaa", level: 80,
      energyMax: 60, initialEnergy: 0, stats: { ...neutralStats } },
      { id: "amber", name: "安柏", element: "pyro", color: "#f80", level: 80,
        energyMax: 40, initialEnergy: 0, stats: { ...neutralStats } }],
    favoniusModel: { mode: "fixed-source-independent-stream-v1", actors: [
      { actorId: "noelle", weaponId: "favoniusgreatsword", refinement: 1, particleDelayFrames: 45 },
      { actorId: "amber", weaponId: "favoniuswarbow", refinement: 1, particleDelayFrames: 60 },
    ] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "wait", initialActiveCharacterId: "noelle", swapFrames: 1,
      abilities: [{ id: "noelle-normal", actorId: "noelle", name: "明确普通命中", kind: "normal",
        cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
        hits: [{ id: "normal-hit", frame: 0, scaling: 1, element: "physical", attackTag: "normal", snapshot: "hit" }] }],
      commands: [{ type: "normal", actorId: "noelle", abilityId: "noelle-normal", atFrame: 0 }] },
  });
  const input = {
    characterId: "character:10000034", weaponId: "weapon:12407", level: 90, ascension: 6,
    weaponLevel: 90, weaponAscension: 6, refinement: 1, effectsDisabled: true,
    artifacts: (["flower", "plume"] as const).map(slot => ({ slot, setId: "artifact-set:15001", rarity: 5 as const, level: 0,
      mainStat: slot === "flower" ? "hp" as const : "atk" as const, initialSubstats: 3,
      substats: [{ stat: "critRate_" as const, rolls: [3] }, { stat: "critDMG_" as const, rolls: [3] }, { stat: "atk_" as const, rolls: [3] }] })),
  };
  const result = applyEquipmentBuildToTeam(original, "noelle", input);
  expect(original.favoniusModel?.actors.map(row => row.actorId)).toEqual(["noelle", "amber"]);
  expect(result.config.favoniusModel?.actors.map(row => row.actorId)).toEqual(["amber"]);
  expect(result.config.weaponHitStackModel?.actors).toEqual([{ actorId: "noelle", weaponId: "weapon:12407", refinement: 1 }]);
  expect(result.config.characters[1]).toEqual(original.characters[1]);
  const base = resolveEquipmentBuild({ ...input, setEffectsEnabled: false, weaponEffectsEnabled: false });
  expect(result.config.characters[0]!.stats.atkPct).toBeCloseTo(base.build.atkPercent + 0.18);
  const reapplied = applyEquipmentBuildToTeam(result.config, "noelle", input);
  expect(reapplied.config.characters[0]!.stats).toEqual(result.config.characters[0]!.stats);
  expect(reapplied.config.weaponHitStackModel?.actors).toHaveLength(1);
  expect(result.enabled.some(row => row.includes("武器叠层"))).toBe(true);
  expect(simulate(result.config, { critMode: "noCrit" }).weaponHitStackLog?.some(row => row.actor.actorId === "noelle" && row.outcome === "stack-gained")).toBe(true);
  expect(() => applyEquipmentBuildToTeam(original, "noelle", { ...input, characterId: "character:10000021" })).toThrow(/元素与配装角色不一致/);
});
