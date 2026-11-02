import { describe, expect, it } from "vitest";
import { getCharacterBuildPreset } from "../../../packages/game-data/src/character-build-presets";
import { SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT } from "../../../packages/sim-core/src/source-host-wire";
import { compileSourceTeamDraft, equipmentBuildToSourceTeamMember, type SourceTeamInventory } from "./source-team-builder";
import { prepareSourceTeamHandoff } from "./source-team-handoff";

function inventory(variant: "classic" | "stellar"): SourceTeamInventory {
  return {
    repository: variant === "classic" ? "https://github.com/genshinsim/gcsim" : "genshinsim/gcsim",
    hostVariant: variant, revision: variant === "classic" ? SOURCE_HOST_COMMIT : SOURCE_HOST_STELLAR_COMMIT,
    characters: [{ kind: "character", key: "wanderer", name: "流浪者", packagePath: "internal/characters/wanderer", sourceGameId: 10000075, maximumLevel: 90, weaponClass: "catalyst" }],
    weapons: [{ kind: "weapon", key: "thewidsith", name: "流浪乐章", packagePath: "internal/weapons/thewidsith", sourceGameId: 14402, maximumLevel: 90, weaponClass: "catalyst" }], artifacts: [],
  };
}
function importedMember(level: 90 | 95 | 100, source: SourceTeamInventory) {
  const preset = getCharacterBuildPreset("character:10000075", "starter")!;
  return equipmentBuildToSourceTeamMember({ ...preset.build, level, ...(level > 90 ? { characterLevelCap: level as 95 | 100 } : {}), artifacts: [] },
    { constellation: 6, talents: { auto: 10, skill: 10, burst: 10 } }, source);
}
for (const variant of ["classic", "stellar"] as const) {
  describe(variant, () => {
    for (const level of [95, 100] as const) it(`preserves imported ${level}/${level} through team handoff, edit, serialized reopen and 120s script`, () => {
      const source = inventory(variant), member = importedMember(level, source);
      expect(member.level).toBe(level); expect(member.levelCap).toBe(level);
      const draft = prepareSourceTeamHandoff(undefined, [member], source, "replace");
      draft.name = `Lv.${level} saved edit`; draft.durationSeconds = 120;
      draft.actions = [{ actorId: member.id, kind: "wait", frames: 7200 }];
      const reopened = JSON.parse(JSON.stringify(draft));
      const before = structuredClone(reopened);
      const script = compileSourceTeamDraft(reopened, source);
      expect(script).toContain(`wanderer char lvl=${level}/${level} cons=6 talent=10,10,10;`);
      expect(script).toContain("duration=120"); expect(script).toContain("wait(7200);");
      expect(reopened).toEqual(before);
      expect(member.weapon.level).toBe(90); expect(member.weapon.levelCap).toBe(90);
    });
  });
}
it("retains ordinary 90 defaults and rejects invalid, unsupported or weapon-level extensions without clipping", () => {
  const source = inventory("classic"), member = importedMember(90, source);
  expect(member.levelCap).toBe(90);
  const draft = prepareSourceTeamHandoff(undefined, [member], source, "replace");
  draft.members[0]!.level = 100; draft.members[0]!.levelCap = 90;
  expect(() => compileSourceTeamDraft(draft, source)).toThrow(/角色等级/);
  draft.members[0]!.levelCap = 100;
  const unknownDraft = structuredClone(draft);
  delete unknownDraft.source;
  expect(() => compileSourceTeamDraft(unknownDraft, { ...source, revision: "unverified-source" })).toThrow(/角色上限/);
  draft.members[0]!.level = 101; draft.members[0]!.levelCap = 101;
  expect(() => compileSourceTeamDraft(draft, source)).toThrow(/角色上限/);
  draft.members[0]!.level = 96; draft.members[0]!.levelCap = 96;
  expect(() => compileSourceTeamDraft(draft, source)).toThrow(/解锁上限/);
  draft.members[0]!.level = 100; draft.members[0]!.levelCap = 100;
  draft.members[0]!.weapon.level = 95; draft.members[0]!.weapon.levelCap = 95;
  expect(() => compileSourceTeamDraft(draft, source)).toThrow(/武器上限/);
});
