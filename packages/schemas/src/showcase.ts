import { z } from "zod";

const numericStringSchema = z.union([z.string(), z.number()]);

const enkaPropValueSchema = z
  .object({
    type: z.number().int().optional(),
    ival: numericStringSchema.optional(),
    val: numericStringSchema.optional()
  })
  .passthrough();

const enkaArtifactStatSchema = z
  .object({
    appendPropId: z.string(),
    statValue: z.number().finite()
  })
  .passthrough();

const enkaArtifactMainStatSchema = z
  .object({
    mainPropId: z.string(),
    statValue: z.number().finite()
  })
  .passthrough();

const enkaFlatItemSchema = z
  .object({
    nameTextMapHash: numericStringSchema.optional(),
    rankLevel: z.number().int().optional(),
    itemType: z.string(),
    icon: z.string().optional(),
    equipType: z.string().optional(),
    setId: z.number().int().optional(),
    setNameTextMapHash: numericStringSchema.optional(),
    weaponStats: z
      .array(
        z
          .object({
            appendPropId: z.string(),
            statValue: z.number().finite()
          })
          .passthrough()
      )
      .optional(),
    reliquarySubstats: z.array(enkaArtifactStatSchema).optional(),
    reliquaryMainstat: enkaArtifactMainStatSchema.optional()
  })
  .passthrough();

const enkaEquipSchema = z
  .object({
    itemId: z.number().int(),
    weapon: z
      .object({
        level: z.number().int().min(1),
        promoteLevel: z.number().int().optional(),
        affixMap: z.record(z.string(), z.number().int()).optional()
      })
      .passthrough()
      .optional(),
    reliquary: z
      .object({
        level: z.number().int().min(1),
        mainPropId: z.number().int().optional(),
        appendPropIdList: z.array(z.number().int()).optional()
      })
      .passthrough()
      .optional(),
    flat: enkaFlatItemSchema
  })
  .passthrough();

export const enkaShowcaseResponseSchema = z
  .object({
    ttl: z.number().int().positive().optional(),
    playerInfo: z
      .object({
        level: z.number().int().min(1).optional(),
        worldLevel: z.number().int().min(0).optional(),
        showAvatarInfoList: z
          .array(
            z
              .object({
                avatarId: z.number().int(),
                level: z.number().int().min(1).optional(),
                costumeId: z.number().int().optional()
              })
              .passthrough()
          )
          .optional()
      })
      .passthrough(),
    avatarInfoList: z
      .array(
        z
          .object({
            avatarId: z.number().int(),
            propMap: z.record(z.string(), enkaPropValueSchema).optional(),
            talentIdList: z.array(z.number().int()).optional(),
            skillLevelMap: z.record(z.string(), z.number().int()).optional(),
            proudSkillExtraLevelMap: z
              .record(z.string(), z.number().int())
              .optional(),
            fightPropMap: z.record(z.string(), z.number().finite()),
            equipList: z.array(enkaEquipSchema).optional()
          })
          .passthrough()
      )
      .optional()
  })
  .passthrough();

export type EnkaShowcaseResponse = z.infer<typeof enkaShowcaseResponseSchema>;

export interface ImportedArtifactStat {
  id: string;
  value: number;
}

export interface ImportedArtifact {
  itemId: number;
  slot: string;
  setId: number | null;
  rarity: number | null;
  level: number;
  mainStat: ImportedArtifactStat | null;
  substats: ImportedArtifactStat[];
}

export interface ImportedWeapon {
  itemId: number;
  level: number;
  ascension: number | null;
  refinement: number;
  rarity: number | null;
  stats: ImportedArtifactStat[];
}

export interface ImportedShowcaseCharacter {
  avatarId: number;
  level: number;
  constellation: number;
  skillLevels: Record<string, number>;
  skillLevelBonuses: Record<string, number>;
  stats: {
    maxHp: number;
    attack: number;
    defense: number;
    elementalMastery: number;
    critRate: number;
    critDamage: number;
    energyRecharge: number;
    damageBonuses: Record<string, number>;
  };
  weapon: ImportedWeapon | null;
  artifacts: ImportedArtifact[];
}

export interface ImportedShowcase {
  source: "enka";
  uid: string;
  fetchedAt: string;
  cacheTtlSeconds: number;
  playerLevel: number | null;
  worldLevel: number | null;
  visibility: "public" | "closed-or-empty";
  characters: ImportedShowcaseCharacter[];
}

export interface CatalogResolvedSkill {
  skillId: string;
  baseLevel: number;
  bonusLevel: number;
  effectiveLevel: number;
  abilityId: string | null;
  name: string | null;
  matchStatus: "matched" | "unmatched";
}

export interface CatalogResolvedShowcaseCharacter
  extends ImportedShowcaseCharacter {
  catalog: {
    matchStatus: "matched" | "unmatched";
    catalogVersion: string;
    characterId: string | null;
    name: string | null;
    element: string | null;
    weaponType: string | null;
    rarity: number | null;
    simulationStatus: "metadata-only" | "partial" | "mechanics-mapped" | null;
    notes: string;
  };
  weaponCatalog: {
    matchStatus: "matched" | "unmatched" | "not-equipped";
    weaponId: string | null;
    name: string | null;
    simulationStatus: "metadata-only" | "partial" | "mechanics-mapped" | null;
  };
  resolvedSkills: CatalogResolvedSkill[];
}

export interface CatalogResolvedShowcase
  extends Omit<ImportedShowcase, "characters"> {
  catalogVersion: string;
  catalogSchemaVersion: string;
  catalogPatch: string;
  catalogVerificationStatus: "verified" | "provisional" | "user-supplied";
  characters: CatalogResolvedShowcaseCharacter[];
  diagnostics: {
    unmatchedAvatarIds: number[];
    unmatchedWeaponIds: number[];
    unmatchedSkillIds: string[];
  };
}

export interface GraduationBuildPlaceholder {
  status: "graduation-target-placeholder";
  avatarId: number;
  sourceLevel: number;
  retainedWeapon: ImportedWeapon | null;
  retainedSkillLevels: Record<string, number>;
  artifactTarget: null;
  note: string;
}
