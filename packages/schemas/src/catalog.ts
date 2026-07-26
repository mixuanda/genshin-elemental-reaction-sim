import { z } from "zod";

export const CURRENT_GAME_DATA_SCHEMA_VERSION = "1.0.0" as const;

export const catalogVerificationStatusSchema = z.enum([
  "verified",
  "provisional",
  "user-supplied"
]);

export const simulationMappingStatusSchema = z.enum([
  "metadata-only",
  "partial",
  "mechanics-mapped"
]);

export const gameDataProvenanceSchema = z.object({
  patch: z.string().min(1),
  source: z.string().min(1),
  sourceVersion: z.string().min(1),
  verifiedAt: z.string().datetime(),
  verificationStatus: catalogVerificationStatusSchema,
  notes: z.string().min(1)
});

const numericRecordSchema = z.record(z.string(), z.number().finite());
const numericArrayRecordSchema = z.record(
  z.string(),
  z.array(z.number().finite()).min(1)
);

export const characterStatBlockSchema = z.object({
  base: numericRecordSchema,
  curve: z.record(z.string(), z.string()),
  specialized: z.string(),
  promotion: z.array(numericRecordSchema)
});

export const weaponStatBlockSchema = z.object({
  base: numericRecordSchema,
  curve: z.record(z.string(), z.string()),
  specialized: z.string(),
  promotion: z.array(numericRecordSchema)
});

export const abilityCatalogEntrySchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  kind: z.enum([
    "normal",
    "skill",
    "burst",
    "alternate",
    "passive",
    "other"
  ]),
  name: z.string().min(1),
  description: z.string(),
  labels: z.array(z.string()),
  parameters: numericArrayRecordSchema,
  levelCount: z.number().int().nonnegative(),
  provenance: gameDataProvenanceSchema,
  simulationStatus: simulationMappingStatusSchema,
  unmappedMechanics: z.array(z.string())
});

export const talentSetCatalogEntrySchema = z.object({
  id: z.string().min(1),
  numericId: z.number().int().positive(),
  slug: z.string().min(1),
  name: z.string().min(1),
  releasePatch: z.string().min(1),
  abilities: z.array(abilityCatalogEntrySchema).min(1),
  provenance: gameDataProvenanceSchema,
  simulationStatus: simulationMappingStatusSchema,
  unmappedMechanics: z.array(z.string())
});

export const characterCatalogEntrySchema = z.object({
  id: z.string().min(1),
  avatarId: z.number().int().positive(),
  slug: z.string().min(1),
  name: z.string().min(1),
  element: z.enum([
    "pyro",
    "cryo",
    "hydro",
    "electro",
    "anemo",
    "geo",
    "dendro",
    "unknown"
  ]),
  weaponType: z.enum(["sword", "claymore", "polearm", "catalyst", "bow"]),
  rarity: z.number().int().min(4).max(5),
  releasePatch: z.string().min(1),
  talentSetIds: z.array(z.string()),
  stats: characterStatBlockSchema,
  provenance: gameDataProvenanceSchema,
  simulationStatus: simulationMappingStatusSchema,
  unmappedMechanics: z.array(z.string())
});

export const weaponRefinementSchema = z.object({
  rank: z.number().int().min(1).max(5),
  description: z.string(),
  values: z.array(z.string())
});

export const weaponCatalogEntrySchema = z.object({
  id: z.string().min(1),
  itemId: z.number().int().positive(),
  slug: z.string().min(1),
  name: z.string().min(1),
  weaponType: z.enum(["sword", "claymore", "polearm", "catalyst", "bow"]),
  rarity: z.number().int().min(1).max(5),
  releasePatch: z.string().min(1),
  baseAtkValue: z.number().finite(),
  mainStatType: z.string(),
  baseStatText: z.string(),
  effectName: z.string(),
  refinements: z.array(weaponRefinementSchema),
  stats: weaponStatBlockSchema,
  provenance: gameDataProvenanceSchema,
  simulationStatus: simulationMappingStatusSchema,
  unmappedMechanics: z.array(z.string())
});

export const enkaCharacterInteropEntrySchema = z.object({
  id: z.string().min(1),
  variantKey: z.string().min(1),
  avatarId: z.number().int().positive(),
  element: z.enum([
    "pyro",
    "cryo",
    "hydro",
    "electro",
    "anemo",
    "geo",
    "dendro",
    "unknown"
  ]),
  skillOrder: z.array(z.number().int().positive()),
  proudMap: z.record(z.string(), z.number().int().positive()),
  provenance: gameDataProvenanceSchema
});

export const gameDataSourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  version: z.string().min(1),
  commit: z.string().min(1),
  license: z.string().min(1),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  notes: z.string().min(1)
});

export const gameDataCatalogSchema = z.object({
  schemaVersion: z.literal(CURRENT_GAME_DATA_SCHEMA_VERSION),
  catalogVersion: z.string().min(1),
  locale: z.literal("zh-CN"),
  gamePatch: z.string().min(1),
  generatedAt: z.string().datetime(),
  sources: z.array(gameDataSourceSchema).min(1),
  counts: z.object({
    characters: z.number().int().nonnegative(),
    talentSets: z.number().int().nonnegative(),
    weapons: z.number().int().nonnegative(),
    enkaCharacterMappings: z.number().int().nonnegative()
  }),
  characters: z.array(characterCatalogEntrySchema),
  talentSets: z.array(talentSetCatalogEntrySchema),
  weapons: z.array(weaponCatalogEntrySchema),
  enkaCharacterMappings: z.array(enkaCharacterInteropEntrySchema)
});

export const gameDataRuntimeIndexSchema = z.object({
  schemaVersion: z.literal(CURRENT_GAME_DATA_SCHEMA_VERSION),
  catalogVersion: z.string().min(1),
  gamePatch: z.string().min(1),
  verificationStatus: catalogVerificationStatusSchema,
  counts: z.object({
    characters: z.number().int().nonnegative(),
    talentSets: z.number().int().nonnegative(),
    abilities: z.number().int().nonnegative(),
    weapons: z.number().int().nonnegative(),
    enkaCharacterMappings: z.number().int().nonnegative()
  }),
  characters: z.array(
    characterCatalogEntrySchema.pick({
      id: true,
      avatarId: true,
      name: true,
      element: true,
      weaponType: true,
      rarity: true,
      talentSetIds: true,
      simulationStatus: true
    })
  ),
  talentSets: z.array(
    z.object({
      id: z.string().min(1),
      abilities: z.array(
        abilityCatalogEntrySchema.pick({
          id: true,
          key: true,
          name: true
        })
      )
    })
  ),
  weapons: z.array(
    weaponCatalogEntrySchema.pick({
      id: true,
      itemId: true,
      name: true,
      simulationStatus: true
    })
  ),
  enkaCharacterMappings: z.array(
    enkaCharacterInteropEntrySchema.pick({
      variantKey: true,
      avatarId: true,
      element: true,
      skillOrder: true,
      proudMap: true
    })
  )
});

export type GameDataProvenance = z.infer<typeof gameDataProvenanceSchema>;
export type AbilityCatalogEntry = z.infer<typeof abilityCatalogEntrySchema>;
export type TalentSetCatalogEntry = z.infer<
  typeof talentSetCatalogEntrySchema
>;
export type CharacterCatalogEntry = z.infer<
  typeof characterCatalogEntrySchema
>;
export type WeaponCatalogEntry = z.infer<typeof weaponCatalogEntrySchema>;
export type EnkaCharacterInteropEntry = z.infer<
  typeof enkaCharacterInteropEntrySchema
>;
export type GameDataCatalog = z.infer<typeof gameDataCatalogSchema>;
export type GameDataRuntimeIndex = z.infer<
  typeof gameDataRuntimeIndexSchema
>;

export class GameDataMigrationError extends Error {
  readonly sourceVersion: string | null;

  constructor(message: string, sourceVersion: string | null) {
    super(message);
    this.name = "GameDataMigrationError";
    this.sourceVersion = sourceVersion;
  }
}

/**
 * Catalog migrations are deliberately explicit. Version 1.0.0 is the first
 * supported catalog; future versions must add a transform here rather than
 * silently accepting a changed upstream shape.
 */
export function migrateGameDataCatalog(input: unknown): GameDataCatalog {
  const sourceVersion =
    typeof input === "object" &&
    input !== null &&
    "schemaVersion" in input &&
    typeof input.schemaVersion === "string"
      ? input.schemaVersion
      : null;
  if (sourceVersion !== CURRENT_GAME_DATA_SCHEMA_VERSION) {
    throw new GameDataMigrationError(
      `Unsupported game-data schema ${sourceVersion ?? "(missing)"}; expected ${CURRENT_GAME_DATA_SCHEMA_VERSION}.`,
      sourceVersion
    );
  }
  return gameDataCatalogSchema.parse(input);
}
