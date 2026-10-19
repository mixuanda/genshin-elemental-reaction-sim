import { expect, it } from "vitest";
import { defaultSourceExecutionProfile } from "./source-execution-profiles";
import { prepareSourceTeamHandoff } from "./source-team-handoff";
import type { SourceTeamDraft, SourceTeamInventory, SourceTeamMember } from "./source-team-builder";

// Synthetic source keys exercise the handoff contract, not any game's data.
const inventory: SourceTeamInventory = {
  repository: "example.test/synthetic-source",
  hostVariant: "classic",
  revision: "fixed-revision",
  characters: ["amber", "kaeya", "lisa", "barbara", "noelle"].map(key => ({
    kind: "character", key, name: key, packagePath: `characters/${key}`,
    weaponClass: "bow",
    actionCapabilities: {
      schemaVersion: 1,
      actions: [{ kind: "attack", status: "implemented", method: "Attack", parameters: [] }],
      normalChain: { length: 1 },
    },
  })),
  weapons: ["oldbow", "newbow"].map(key => ({
    kind: "weapon", key, name: key, packagePath: `weapons/${key}`, weaponClass: "bow",
  })),
  artifacts: [],
};

const member = (characterKey: string, id = characterKey, weaponKey = "oldbow"): SourceTeamMember => ({
  id, characterKey, level: 80, levelCap: 90, constellation: 0,
  talents: { auto: 8, skill: 8, burst: 8 },
  weapon: { key: weaponKey, level: 80, levelCap: 90, refinement: 1 },
  artifactSets: [], artifactStats: {},
});

it("merges a replacement without losing action identity or startup settings, while replace starts a fresh draft", () => {
  const profile = defaultSourceExecutionProfile();
  const current: SourceTeamDraft = {
    schemaVersion: 1, source: { hostVariant: "classic", revision: "fixed-revision" },
    name: "existing", members: [{ ...member("amber", "stable_actor"), initialEnergy: 25 }],
    actions: [{ actorId: "stable_actor", kind: "attack", repeat: 2 }],
    durationSeconds: 42, startup: "custom", executionProfile: profile,
    target: { level: 90, resistance: 0.1 },
  };
  const incoming = [{ ...member("amber", "import_actor", "newbow"), initialEnergy: 1 }];
  const originalCurrent = structuredClone(current);
  const originalIncoming = structuredClone(incoming);

  const merged = prepareSourceTeamHandoff(current, incoming, inventory, "merge");
  expect(merged.members).toEqual([{ ...incoming[0], id: "stable_actor", initialEnergy: 25 }]);
  expect(merged.actions).toEqual(current.actions);
  expect(merged.startup).toBe("custom");
  expect(merged.executionProfile).toEqual(profile);
  expect(merged.source).toEqual(current.source);

  const replaced = prepareSourceTeamHandoff(current, incoming, inventory, "replace");
  expect(replaced.members).toEqual(incoming);
  expect(replaced.actions).toEqual([]);
  expect(replaced.startup).toBeUndefined();
  expect(replaced.executionProfile).toBeUndefined();
  expect(replaced.source).toEqual(current.source);
  expect(current).toEqual(originalCurrent);
  expect(incoming).toEqual(originalIncoming);
});

it("rejects oversized, source-mismatched, and duplicate-character handoffs without mutating inputs", () => {
  const full: SourceTeamDraft = {
    schemaVersion: 1, source: { hostVariant: "classic", revision: "fixed-revision" },
    name: "full", members: ["amber", "kaeya", "lisa", "barbara"].map(key => member(key)),
    actions: [], durationSeconds: 30, target: { level: 90, resistance: 0.1 },
  };
  const oneMore = [member("noelle")];
  const wrongSource: SourceTeamDraft = {
    ...structuredClone(full), source: { hostVariant: "classic", revision: "other-revision" },
  };
  const duplicate = [member("amber", "first"), member("amber", "second")];
  const inputsBefore = structuredClone({ full, oneMore, wrongSource, duplicate, inventory });

  expect(() => prepareSourceTeamHandoff(full, oneMore, inventory, "merge")).toThrow(/超过四人/);
  expect(() => prepareSourceTeamHandoff(wrongSource, oneMore, inventory, "merge")).toThrow(/不同的固定来源/);
  expect(() => prepareSourceTeamHandoff(undefined, duplicate, inventory, "replace")).toThrow(/同一角色/);
  expect({ full, oneMore, wrongSource, duplicate, inventory }).toEqual(inputsBefore);
});
