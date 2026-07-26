import { z } from "zod";
import {
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  LEGACY_SCHEMA_VERSION,
  type SimConfig
} from "./types";

const idSchema = z.string().trim().min(1);
const finiteNumber = z.number().finite();

export const elementSchema = z.enum([
  "pyro",
  "cryo",
  "hydro",
  "electro",
  "anemo",
  "geo",
  "dendro",
  "physical"
]);

export const reactionSchema = z.enum([
  "none",
  "melt",
  "reverseMelt",
  "vaporize",
  "reverseVaporize"
]);

export const scalingStatSchema = z.enum(["atk", "hp", "def", "em"]);

export const characterStatsSchema = z
  .object({
    baseAtk: finiteNumber.default(0),
    atkPct: finiteNumber.default(0),
    flatAtk: finiteNumber.default(0),
    baseHp: finiteNumber.default(0),
    hpPct: finiteNumber.default(0),
    flatHp: finiteNumber.default(0),
    baseDef: finiteNumber.default(0),
    defPct: finiteNumber.default(0),
    flatDef: finiteNumber.default(0),
    em: finiteNumber.default(0),
    critRate: finiteNumber.default(0.05),
    critDmg: finiteNumber.default(0.5),
    dmgBonus: finiteNumber.default(0),
    defIgnore: finiteNumber.default(0),
    reactionBonus: finiteNumber.default(0)
  })
  .strict();

export const characterProfileSchema = z
  .object({
    id: idSchema,
    name: idSchema,
    element: elementSchema,
    color: z.string().trim().min(1),
    level: z.number().int().min(1).max(100),
    energyMax: finiteNumber.min(0),
    initialEnergy: finiteNumber.min(0),
    stats: characterStatsSchema
  })
  .strict()
  .superRefine((character, context) => {
    if (character.initialEnergy > character.energyMax) {
      context.addIssue({
        code: "custom",
        path: ["initialEnergy"],
        message: "must not exceed energyMax"
      });
    }
  });

export const enemyProfileSchema = z
  .object({
    level: z.number().int().min(1).max(200),
    resistance: finiteNumber,
    defReduction: finiteNumber
  })
  .strict();

export const flatDamageSourceSchema = z
  .object({
    ownerId: idSchema.optional(),
    stat: scalingStatSchema.optional(),
    multiplier: finiteNumber
  })
  .strict();

export const hitDefinitionSchema = z
  .object({
    id: idSchema.optional(),
    offset: finiteNumber.min(0),
    label: z.string().optional(),
    scaling: finiteNumber,
    scalingStat: scalingStatSchema.optional(),
    element: elementSchema.optional(),
    reaction: reactionSchema.optional(),
    snapshot: z.enum(["action", "hit"]).optional(),
    scalingOwnerId: idSchema.optional(),
    creditId: idSchema.optional(),
    flat: finiteNumber.optional(),
    flatSources: z.array(flatDamageSourceSchema).optional(),
    dmgBonus: finiteNumber.optional(),
    defIgnore: finiteNumber.optional(),
    defReduction: finiteNumber.optional(),
    resShred: finiteNumber.optional(),
    critRate: finiteNumber.optional(),
    critDmg: finiteNumber.optional(),
    reactionBonus: finiteNumber.optional(),
    ampBase: finiteNumber.optional(),
    groupMultiplier: finiteNumber.optional()
  })
  .strict();

export const buffDefinitionSchema = z
  .object({
    kind: z.literal("buff").optional(),
    key: idSchema.optional(),
    label: z.string().optional(),
    target: z.union([z.string(), z.array(idSchema)]).optional(),
    stat: z.enum([
      "atkFlat",
      "atkPct",
      "hpFlat",
      "hpPct",
      "defFlat",
      "defPct",
      "dmgBonus",
      "critRate",
      "critDmg",
      "em",
      "defIgnore",
      "reactionBonus"
    ]),
    value: finiteNumber,
    duration: finiteNumber.min(0),
    offset: finiteNumber.min(0).optional()
  })
  .strict();

export const debuffDefinitionSchema = z
  .object({
    kind: z.literal("debuff").optional(),
    key: idSchema.optional(),
    label: z.string().optional(),
    element: z.union([elementSchema, z.literal("all")]).optional(),
    resShred: finiteNumber.optional(),
    defReduction: finiteNumber.optional(),
    duration: finiteNumber.min(0),
    offset: finiteNumber.min(0).optional()
  })
  .strict();

export const energyEventSchema = z
  .object({
    target: z.union([z.string(), z.array(idSchema)]).optional(),
    amount: finiteNumber,
    offset: finiteNumber.min(0).optional()
  })
  .strict();

export const actionDefinitionSchema = z
  .object({
    id: idSchema,
    actorId: idSchema,
    name: idSchema,
    at: finiteNumber.min(0),
    once: z.boolean().optional(),
    cycles: z.array(z.number().int().min(0)).optional(),
    everyNCycles: z.number().int().positive().optional(),
    cycleRemainder: z.number().int().min(0).optional(),
    energyCost: finiteNumber.min(0).optional(),
    hits: z.array(hitDefinitionSchema).optional(),
    buffs: z.array(buffDefinitionSchema).optional(),
    debuffs: z.array(debuffDefinitionSchema).optional(),
    energyGains: z.array(energyEventSchema).optional()
  })
  .strict();

export const simConfigSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    engineVersion: z.literal(CURRENT_ENGINE_VERSION),
    dataVersion: idSchema,
    randomSeed: idSchema,
    meta: z
      .object({
        name: idSchema,
        version: idSchema,
        note: z.string().optional(),
        verificationStatus: z.enum(["verified", "provisional", "user-supplied"])
      })
      .strict(),
    duration: finiteNumber.min(1).max(600),
    cycleLength: finiteNumber.min(0.1).max(120),
    enemy: enemyProfileSchema,
    characters: z.array(characterProfileSchema).min(1),
    rotation: z.array(actionDefinitionSchema)
  })
  .strict()
  .superRefine((config, context) => {
    const characterIds = new Set<string>();
    config.characters.forEach((character, index) => {
      if (characterIds.has(character.id)) {
        context.addIssue({
          code: "custom",
          path: ["characters", index, "id"],
          message: `duplicate character id "${character.id}"`
        });
      }
      characterIds.add(character.id);
    });

    const actionIds = new Set<string>();
    config.rotation.forEach((action, actionIndex) => {
      const validateTarget = (
        target: string | string[] | undefined,
        path: Array<string | number>,
        allowSelf: boolean
      ): void => {
        const targets = Array.isArray(target) ? target : [target];
        targets.forEach((candidate, targetIndex) => {
          if (
            candidate === undefined ||
            candidate === "team" ||
            (allowSelf && candidate === "self")
          ) {
            return;
          }
          if (!characterIds.has(candidate)) {
            context.addIssue({
              code: "custom",
              path: [
                ...path,
                ...(Array.isArray(target) ? [targetIndex] : [])
              ],
              message: `unknown character id "${candidate}"`
            });
          }
        });
      };

      if (actionIds.has(action.id)) {
        context.addIssue({
          code: "custom",
          path: ["rotation", actionIndex, "id"],
          message: `duplicate action id "${action.id}"`
        });
      }
      actionIds.add(action.id);

      if (!characterIds.has(action.actorId)) {
        context.addIssue({
          code: "custom",
          path: ["rotation", actionIndex, "actorId"],
          message: `unknown character id "${action.actorId}"`
        });
      }

      if (
        action.everyNCycles !== undefined &&
        action.cycleRemainder !== undefined &&
        action.cycleRemainder >= action.everyNCycles
      ) {
        context.addIssue({
          code: "custom",
          path: ["rotation", actionIndex, "cycleRemainder"],
          message: "must be less than everyNCycles"
        });
      }

      action.hits?.forEach((hit, hitIndex) => {
        for (const [field, id] of [
          ["scalingOwnerId", hit.scalingOwnerId],
          ["creditId", hit.creditId]
        ] as const) {
          if (id !== undefined && !characterIds.has(id)) {
            context.addIssue({
              code: "custom",
              path: ["rotation", actionIndex, "hits", hitIndex, field],
              message: `unknown character id "${id}"`
            });
          }
        }
        hit.flatSources?.forEach((source, sourceIndex) => {
          if (source.ownerId !== undefined && !characterIds.has(source.ownerId)) {
            context.addIssue({
              code: "custom",
              path: ["rotation", actionIndex, "hits", hitIndex, "flatSources", sourceIndex, "ownerId"],
              message: `unknown character id "${source.ownerId}"`
            });
          }
        });
      });

      action.buffs?.forEach((buff, buffIndex) => {
        validateTarget(
          buff.target,
          ["rotation", actionIndex, "buffs", buffIndex, "target"],
          true
        );
      });
      action.energyGains?.forEach((gain, gainIndex) => {
        validateTarget(
          gain.target,
          ["rotation", actionIndex, "energyGains", gainIndex, "target"],
          false
        );
      });
    });
  });

export class ConfigMigrationError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = "ConfigMigrationError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeLegacyCharacter(raw: unknown, index: number): unknown {
  if (!isRecord(raw)) return raw;
  const element = typeof raw.element === "string" ? raw.element : "physical";
  return {
    ...raw,
    id: typeof raw.id === "string" && raw.id ? raw.id : `char-${index}`,
    name:
      typeof raw.name === "string" && raw.name
        ? raw.name
        : typeof raw.id === "string" && raw.id
          ? raw.id
          : `char-${index}`,
    element,
    color:
      typeof raw.color === "string" && raw.color
        ? raw.color
        : "#9aa4b2",
    level: raw.level ?? 90,
    energyMax: raw.energyMax ?? 60,
    initialEnergy: raw.initialEnergy ?? 0,
    stats: isRecord(raw.stats) ? raw.stats : {}
  };
}

function migrateLegacyConfig(input: Record<string, unknown>): Record<string, unknown> {
  const meta = isRecord(input.meta) ? input.meta : {};
  const dataVersion =
    typeof meta.version === "string" && meta.version
      ? meta.version
      : "0.1.0-demo";

  return {
    ...input,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    engineVersion: CURRENT_ENGINE_VERSION,
    dataVersion,
    randomSeed: "legacy-default",
    meta: {
      name:
        typeof meta.name === "string" && meta.name
          ? meta.name
          : "迁移的 v0.1 配置",
      version: dataVersion,
      ...(typeof meta.note === "string" ? { note: meta.note } : {}),
      verificationStatus: "provisional"
    },
    duration: input.duration ?? 120,
    cycleLength: input.cycleLength ?? 20,
    enemy: isRecord(input.enemy)
      ? {
          level: input.enemy.level ?? 110,
          resistance: input.enemy.resistance ?? 0.1,
          defReduction: input.enemy.defReduction ?? 0
        }
      : { level: 110, resistance: 0.1, defReduction: 0 },
    characters: Array.isArray(input.characters)
      ? input.characters.map(normalizeLegacyCharacter)
      : [],
    rotation: Array.isArray(input.rotation) ? input.rotation : []
  };
}

export function formatZodError(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "<root>";
    return `${path}: ${issue.message}`;
  });
}

export function parseSimConfig(input: unknown): SimConfig {
  const parsed = simConfigSchema.safeParse(input);
  if (!parsed.success) {
    const issues = formatZodError(parsed.error);
    throw new ConfigMigrationError(
      `配置校验失败：\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
      issues
    );
  }
  return parsed.data as SimConfig;
}

export function migrateConfig(input: unknown): SimConfig {
  if (!isRecord(input)) {
    throw new ConfigMigrationError("配置校验失败：<root>: expected an object");
  }

  const version = input.schemaVersion;
  if (
    version === undefined ||
    version === LEGACY_SCHEMA_VERSION ||
    version === "0.1.0-demo"
  ) {
    return parseSimConfig(migrateLegacyConfig(input));
  }
  if (version === CURRENT_SCHEMA_VERSION) {
    return parseSimConfig(input);
  }
  throw new ConfigMigrationError(
    `不支持的 schemaVersion "${String(version)}"；当前版本为 ${CURRENT_SCHEMA_VERSION}`
  );
}
