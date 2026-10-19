import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import {
  deleteTeamConfigPreset,
  listTeamConfigPresets,
  saveNewTeamConfigPreset,
  updateTeamConfigPreset
} from "./team-config-preset-library";

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => storage.clear(),
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; }
};

const config = (actorName: string): SimConfig => ({
  dataVersion: "test",
  randomSeed: "seed",
  duration: 600,
  enemy: {},
  characters: [{ id: actorName, name: actorName }],
  rotation: []
} as unknown as SimConfig);

describe("team config preset library", () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("crypto", { randomUUID: () => "preset-id" });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("saves an independent config snapshot, updates it, and deletes it", () => {
    const original = config("Amber");
    const { preset } = saveNewTeamConfigPreset("  Vaporize  ", original);
    (original.characters[0] as { name: string }).name = "Changed";

    expect(listTeamConfigPresets()[0]?.config.characters[0]?.name).toBe("Amber");
    const updated = updateTeamConfigPreset(preset.id, "Vaporize v2", config("Xiangling"));
    expect(updated.preset.name).toBe("Vaporize v2");
    expect(listTeamConfigPresets()[0]?.config.characters[0]?.name).toBe("Xiangling");
    expect(deleteTeamConfigPreset(preset.id)).toEqual([]);
    expect(listTeamConfigPresets()).toEqual([]);
  });

  it("refuses to overwrite a malformed local library", () => {
    storage.set("gidps-team-config-presets-v1", "not json");
    expect(() => saveNewTeamConfigPreset("Plan", config("Amber"))).toThrow("不是有效 JSON");
    expect(storage.get("gidps-team-config-presets-v1")).toBe("not json");
  });
});
