import { expect, it } from "vitest";
import { applySourceSingleSkillSelection, resolveSourceSingleSkillSelection } from "./source-single-skill-selection";
import type { SourceSingleSkillDraft } from "./source-single-skill";
import type { SourceTeamInventory } from "./source-team-builder";

it("selects the declared native Neuvillette charge/Q without replacing equipment or granting energy", () => {
  const inventory: SourceTeamInventory = { repository: "https://github.com/genshinsim/gcsim", hostVariant: "classic",
    revision: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", weapons: [], artifacts: [],
    characters: [{ kind: "character", key: "neuvillette", name: "那维莱特", sourceGameId: 10000087,
      packagePath: "internal/characters/neuvillette", actionCapabilities: { schemaVersion: 1,
        actions: ["skill", "burst", "charge"].map(kind => ({ kind: kind as "skill" | "burst" | "charge", status: "implemented", method: kind, parameters: [] })),
        normalChain: { length: 3 } } }] };
  const draft: SourceSingleSkillDraft = { schemaVersion: 1, source: { hostVariant: inventory.hostVariant, revision: inventory.revision },
    member: { id: "imported-neuv", characterKey: "neuvillette", level: 90, levelCap: 90, constellation: 0,
      talents: { auto: 10, skill: 6, burst: 6 }, weapon: { key: "pocketgrimoire", level: 70, levelCap: 70, refinement: 1 },
      artifactSets: [], artifactStats: { "hp%": .466, cr: .311 }, initialEnergy: 0 },
    action: { kind: "skill", params: { previous: 1 } }, durationSeconds: 12,
    target: { level: 90, resistance: .1 }, startup: "zero", seed: "12021" };
  const before = structuredClone(draft);
  const charge = applySourceSingleSkillSelection(draft, { characterKey: "neuvillette", preferredAction: "charge" }, inventory);
  expect(charge).toEqual({ ...draft, action: { kind: "charge" } });
  expect(draft).toEqual(before);
  charge.action.params = { ticks: 1, short: 0 };
  expect(applySourceSingleSkillSelection(charge, { characterKey: "neuvillette", preferredAction: "charge" }, inventory)).toEqual(charge);
  const burst = applySourceSingleSkillSelection(charge, { characterKey: "neuvillette", preferredAction: "burst" }, inventory);
  expect(burst).toEqual({ ...draft, action: { kind: "burst" } });
  expect(burst.startup).toBe("zero");
  expect(burst.member.initialEnergy).toBe(0);
  expect(resolveSourceSingleSkillSelection(inventory, { characterKey: "neuvillette" }, "charge").actionKind).toBe("charge");
  expect(() => resolveSourceSingleSkillSelection(inventory, { characterKey: "missing", preferredAction: "charge" })).toThrow("没有角色配置键");
  expect(() => resolveSourceSingleSkillSelection(inventory, { characterKey: "neuvillette", preferredAction: "aim" })).toThrow("未改选其他动作");
  const stale = structuredClone(draft); stale.source.revision = "other-source";
  expect(() => applySourceSingleSkillSelection(stale, { characterKey: "neuvillette", preferredAction: "burst" }, inventory)).toThrow("固定来源名册不同");
});
