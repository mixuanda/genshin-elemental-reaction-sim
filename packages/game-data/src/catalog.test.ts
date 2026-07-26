import { describe, expect, it } from "vitest";
import {
  GameDataMigrationError,
  gameDataCatalogSchema,
  migrateGameDataCatalog
} from "@genshin-dps-lab/schemas";
import {
  findCharacterByAvatarId,
  findTalentSetById,
  findWeaponByItemId,
  gameDataCatalog
} from "./catalog";

describe("versioned game-data catalog", () => {
  it("parses the committed catalog with complete deterministic counts", () => {
    expect(() => gameDataCatalogSchema.parse(gameDataCatalog)).not.toThrow();
    expect(gameDataCatalog.counts).toEqual({
      characters: 120,
      talentSets: 125,
      weapons: 237,
      enkaCharacterMappings: 148
    });
    expect(
      gameDataCatalog.talentSets.reduce(
        (count, talentSet) => count + talentSet.abilities.length,
        0
      )
    ).toBe(762);
    expect(gameDataCatalog.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "genshin-db",
          version: "5.2.12",
          license: "MIT"
        }),
        expect.objectContaining({
          id: "enka-api-docs-identifiers",
          license: "NO-LICENSE-DETECTED"
        })
      ])
    );
  });

  it("keeps every record source-attributed and non-executable by default", () => {
    const catalogRecords = [
      ...gameDataCatalog.characters,
      ...gameDataCatalog.talentSets,
      ...gameDataCatalog.weapons
    ];
    for (const record of catalogRecords) {
      expect(record.provenance).toMatchObject({
        source: "genshin-db",
        sourceVersion: "5.2.12",
        verificationStatus: "provisional"
      });
      expect(record.provenance.patch).not.toBe("");
      expect(record.provenance.verifiedAt).not.toBe("");
      expect(record.provenance.notes).not.toBe("");
      expect(record.simulationStatus).toBe("metadata-only");
      expect(record.unmappedMechanics.length).toBeGreaterThan(0);
    }
    for (const talentSet of gameDataCatalog.talentSets) {
      for (const ability of talentSet.abilities) {
        expect(ability.provenance.verificationStatus).toBe("provisional");
        expect(ability.simulationStatus).toBe("metadata-only");
      }
    }
  });

  it("indexes the requested first-batch identities without promoting them to verified mechanics", () => {
    const requested = [
      [10000103, "希诺宁", "5.1"],
      [10000107, "茜特菈莉", "5.3"],
      [10000123, "杜林", "6.2"],
      [10000129, "洛恩", "6.6"],
      [10000131, "尼可", "6.6"]
    ] as const;
    for (const [avatarId, name, patch] of requested) {
      expect(findCharacterByAvatarId(avatarId)).toMatchObject({
        avatarId,
        name,
        releasePatch: patch,
        simulationStatus: "metadata-only",
        provenance: {
          verificationStatus: "provisional"
        }
      });
    }
  });

  it("stores level-indexed talent parameters and weapon refinement values exactly", () => {
    const durin = findTalentSetById("talent-set:durin");
    const burst = durin?.abilities.find(
      (ability) => ability.key === "combat3"
    );
    expect(burst).toMatchObject({
      name: "白化法·如光流变",
      levelCount: 15
    });
    expect(burst?.parameters.param1?.[9]).toBe(2.14128);
    expect(burst?.parameters.param12?.[9]).toBe(70);

    const aquila = findWeaponByItemId(11501);
    expect(aquila).toMatchObject({
      name: "风鹰剑",
      rarity: 5,
      simulationStatus: "metadata-only"
    });
    expect(aquila?.refinements).toHaveLength(5);
  });

  it("rejects unversioned or future catalog shapes through the migration gate", () => {
    expect(() =>
      migrateGameDataCatalog({
        ...gameDataCatalog,
        schemaVersion: "2.0.0"
      })
    ).toThrow(GameDataMigrationError);
    expect(() => migrateGameDataCatalog({})).toThrow(
      /Unsupported game-data schema/
    );
  });
});
