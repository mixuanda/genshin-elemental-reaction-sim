import { z } from "zod";
import {
  ACTION_STATE_SCHEMA_VERSION,
  AOE_FANOUT_SCHEMA_VERSION,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  FIXED_ENERGY_ICD_SCHEMA_VERSION,
  FOLLOWUP_CANCEL_SCHEMA_VERSION,
  HIT_PARTICLE_TRIGGER_SCHEMA_VERSION,
  ICD_PROFILE_SCHEMA_VERSION,
  INITIAL_TYPED_SCHEMA_VERSION,
  LEGACY_SCHEMA_VERSION,
  MOVEMENT_COMMAND_SCHEMA_VERSION,
  MULTI_TARGET_REGISTRY_SCHEMA_VERSION,
  PARTICLE_SCHEMA_VERSION,
  PREVIOUS_SCHEMA_VERSION,
  RUNTIME_ENERGY_SCHEMA_VERSION,
  TARGET_EFFECT_POLICY_SCHEMA_VERSION,
  TARGET_HIT_RESOLUTION_SCHEMA_VERSION,
  TARGET_PHASE_TIMELINE_SCHEMA_VERSION,
  TIMELINE_STATE_CLEAR_SCHEMA_VERSION,
  type SimConfig
} from "./types";

const idSchema = z.string().trim().min(1);
const finiteNumber = z.number().finite();
const spatialCoordinateSchema = finiteNumber.min(-10_000).max(10_000);

export const point2DSchema = z
  .object({
    x: spatialCoordinateSchema,
    y: spatialCoordinateSchema
  })
  .strict();

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

export const elementalApplicationSchema = z
  .object({
    gaugeUnits: finiteNumber.positive().max(20),
    icdTag: idSchema,
    icdGroup: idSchema
  })
  .strict();

export const initialAuraApplicationSchema = z
  .object({
    element: z.enum(["pyro", "cryo", "hydro"]),
    gaugeUnits: finiteNumber.positive().max(20)
  })
  .strict();

export const auraReactionEngineConfigSchema = z
  .object({
    mode: z.literal("aura-v1"),
    initialAura: z.array(initialAuraApplicationSchema).max(3).optional(),
    icdProfiles: z
      .record(
        idSchema,
        z
          .object({
            resetFrames: z.number().int().positive().max(36_000),
            applicationSequence: z.array(z.boolean()).min(1).max(128)
          })
          .strict()
      )
      .optional(),
    debugAllowReactionOverride: z.boolean().optional()
  })
  .strict()
  .superRefine((engine, context) => {
    const elements = new Set<string>();
    engine.initialAura?.forEach((aura, index) => {
      if (elements.has(aura.element)) {
        context.addIssue({
          code: "custom",
          path: ["initialAura", index, "element"],
          message: `duplicate initial aura element "${aura.element}"`
        });
      }
      elements.add(aura.element);
    });
    for (const builtIn of ["default", "no-icd"]) {
      if (engine.icdProfiles?.[builtIn] !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["icdProfiles", builtIn],
          message: `"${builtIn}" is a built-in ICD group and cannot be overridden`
        });
      }
    }
  });

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
    reactionBonus: finiteNumber.default(0),
    energyRecharge: finiteNumber.min(0).max(10).default(1)
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

export const flatDamageSourceSchema = z
  .object({
    ownerId: idSchema.optional(),
    stat: scalingStatSchema.optional(),
    multiplier: finiteNumber
  })
  .strict();

export const targetEffectPolicySchema = z
  .object({
    damage: z.enum(["normal", "immune"]),
    aura: z.enum(["normal", "blocked"]),
    hitConfirm: z.enum(["normal", "blocked"])
  })
  .strict()
  .superRefine((effects, context) => {
    if (
      effects.damage === "normal" &&
      effects.aura === "normal" &&
      effects.hitConfirm === "normal"
    ) {
      context.addIssue({
        code: "custom",
        message: "must change at least one target effect"
      });
    }
  });

export const targetPhaseDefinitionSchema = z
  .object({
    id: idSchema,
    label: idSchema,
    targetId: idSchema,
    startFrame: z.number().int().min(0).max(36_000),
    endFrame: z.number().int().positive().max(36_000),
    reason: z.string().trim().min(1),
    effects: targetEffectPolicySchema
  })
  .strict()
  .superRefine((phase, context) => {
    if (phase.endFrame <= phase.startFrame) {
      context.addIssue({
        code: "custom",
        path: ["endFrame"],
        message: "must be greater than startFrame"
      });
    }
  });

export const enemyTargetProfileSchema = z
  .object({
    id: idSchema,
    name: idSchema,
    level: z.number().int().min(1).max(200).optional(),
    resistance: finiteNumber.optional(),
    defReduction: finiteNumber.optional(),
    initialAura: z.array(initialAuraApplicationSchema).max(3).optional(),
    position: point2DSchema.optional(),
    hitboxRadius: finiteNumber.min(0).max(1_000).optional()
  })
  .strict();

export const enemyProfileSchema = z
  .object({
    level: z.number().int().min(1).max(200),
    resistance: finiteNumber,
    defReduction: finiteNumber,
    targets: z.array(enemyTargetProfileSchema).min(1).max(32).optional(),
    targetPhases: z.array(targetPhaseDefinitionSchema).max(256).optional()
  })
  .strict()
  .superRefine((enemy, context) => {
    const targetIds = new Set<string>();
    for (const [index, target] of (enemy.targets ?? []).entries()) {
      if (targetIds.has(target.id)) {
        context.addIssue({
          code: "custom",
          path: ["targets", index, "id"],
          message: `duplicate enemy target id "${target.id}"`
        });
      }
      targetIds.add(target.id);
      const auraElements = new Set<string>();
      for (const [auraIndex, aura] of (
        target.initialAura ?? []
      ).entries()) {
        if (auraElements.has(aura.element)) {
          context.addIssue({
            code: "custom",
            path: ["targets", index, "initialAura", auraIndex, "element"],
            message: `duplicate initial aura element "${aura.element}"`
          });
        }
        auraElements.add(aura.element);
      }
    }
    if (enemy.targets !== undefined && !targetIds.has("enemy-0")) {
      context.addIssue({
        code: "custom",
        path: ["targets"],
        message:
          'must include compatibility target "enemy-0" because hits without targeting resolve to it'
      });
    }

    const phaseIds = new Set<string>();
    const previousEndFrameByTarget = new Map<string, number>();
    for (const [index, phase] of (enemy.targetPhases ?? []).entries()) {
      if (phaseIds.has(phase.id)) {
        context.addIssue({
          code: "custom",
          path: ["targetPhases", index, "id"],
          message: `duplicate target phase id "${phase.id}"`
        });
      }
      phaseIds.add(phase.id);
      const previousEndFrame =
        previousEndFrameByTarget.get(phase.targetId) ?? -1;
      if (phase.startFrame < previousEndFrame) {
        context.addIssue({
          code: "custom",
          path: ["targetPhases", index, "startFrame"],
          message:
            "target phases must be sorted and non-overlapping with half-open boundaries"
        });
      }
      previousEndFrameByTarget.set(
        phase.targetId,
        Math.max(previousEndFrame, phase.endFrame)
      );
    }
  });

export const hitTargetingSchema = z
  .object({
    targetId: idSchema,
    outcome: z.enum(["landed", "miss"]),
    reason: z.string().trim().min(1).optional(),
    effects: targetEffectPolicySchema.optional()
  })
  .strict()
  .superRefine((targeting, context) => {
    const requiresReason =
      targeting.outcome === "miss" || targeting.effects !== undefined;
    if (requiresReason && targeting.reason === undefined) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message:
          "is required for a miss or non-normal target effect policy"
      });
    }
    if (!requiresReason && targeting.reason !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message:
          "must be omitted for a normal landed target result"
      });
    }
    if (targeting.outcome === "miss" && targeting.effects !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["effects"],
        message: "must be omitted when outcome is miss"
      });
    }
  });

export const hitTargetingGroupSchema = z
  .object({
    mode: z.literal("fanout"),
    targets: z.array(hitTargetingSchema).min(1).max(32)
  })
  .strict()
  .superRefine((group, context) => {
    const targetIds = new Set<string>();
    for (const [index, targeting] of group.targets.entries()) {
      if (targetIds.has(targeting.targetId)) {
        context.addIssue({
          code: "custom",
          path: ["targets", index, "targetId"],
          message: `duplicate fanout target id "${targeting.targetId}"`
        });
      }
      targetIds.add(targeting.targetId);
    }
  });

export const hitTargetingConfigSchema = z.union([
  hitTargetingSchema,
  hitTargetingGroupSchema
]);

export const circleHitGeometrySchema = z
  .object({
    kind: z.literal("circle"),
    origin: point2DSchema,
    radius: finiteNumber.min(0).max(1_000)
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
    targeting: hitTargetingConfigSchema.optional(),
    geometry: circleHitGeometrySchema.optional(),
    application: elementalApplicationSchema.optional(),
    reaction: reactionSchema.optional(),
    reactionOverride: reactionSchema.optional(),
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
    target: z
      .union([z.string(), z.array(idSchema).min(1)])
      .optional(),
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
      "reactionBonus",
      "energyRecharge"
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

export const energyInternalCooldownSchema = z
  .object({
    key: idSchema,
    duration: finiteNumber.positive()
  })
  .strict();

export const energyEventSchema = z
  .object({
    target: z.union([z.string(), z.array(idSchema)]).optional(),
    amount: finiteNumber,
    offset: finiteNumber.min(0).optional(),
    source: idSchema.optional(),
    internalCooldown: energyInternalCooldownSchema.optional()
  })
  .strict();

export const particleCountRangeSchema = z
  .object({
    min: finiteNumber.positive(),
    max: finiteNumber.positive(),
    step: finiteNumber.positive().optional()
  })
  .strict()
  .superRefine((range, context) => {
    if (range.max < range.min) {
      context.addIssue({
        code: "custom",
        path: ["max"],
        message: "must be greater than or equal to min"
      });
    }
    if (
      range.step !== undefined &&
      range.step > range.max - range.min + 1e-12 &&
      range.max !== range.min
    ) {
      context.addIssue({
        code: "custom",
        path: ["step"],
        message: "must not exceed the configured range"
      });
    }
    if (range.step !== undefined) {
      const steps = (range.max - range.min) / range.step;
      if (Math.abs(steps - Math.round(steps)) > 1e-9) {
        context.addIssue({
          code: "custom",
          path: ["step"],
          message: "must divide the min-to-max range into whole steps"
        });
      }
    }
  });

const particleDefinitionObjectSchema = z
  .object({
    id: idSchema.optional(),
    source: idSchema.optional(),
    kind: z.enum(["particle", "orb"]).optional(),
    element: z.union([
      z.enum(["pyro", "cryo", "hydro", "electro", "anemo", "geo", "dendro"]),
      z.literal("neutral")
    ]),
    count: z.union([finiteNumber.positive(), particleCountRangeSchema]),
    spawnOffset: finiteNumber.min(0).optional(),
    travelTime: finiteNumber.min(0),
    trigger: z
      .object({
        kind: z.literal("hit-confirm"),
        hitIds: z.array(idSchema).min(1),
        internalCooldown: energyInternalCooldownSchema.optional()
      })
      .strict()
      .optional()
  })
  .strict();

export const particleDefinitionSchema =
  particleDefinitionObjectSchema.superRefine((particle, context) => {
    if (
      particle.trigger !== undefined &&
      particle.spawnOffset !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["spawnOffset"],
        message: "must be omitted for hit-confirm particle triggers"
      });
    }
    const hitIds = new Set<string>();
    for (const [index, hitId] of (
      particle.trigger?.hitIds ?? []
    ).entries()) {
      if (hitIds.has(hitId)) {
        context.addIssue({
          code: "custom",
          path: ["trigger", "hitIds", index],
          message: `duplicate hit id "${hitId}"`
        });
      }
      hitIds.add(hitId);
    }
  });

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
    energyGains: z.array(energyEventSchema).optional(),
    particles: z.array(particleDefinitionSchema).optional(),
    timelineCommandIndex: z.number().int().min(0).optional(),
    sourceAbilityId: idSchema.optional(),
    startFrame: z.number().int().min(0).optional(),
    cancelFrame: z.number().int().min(0).optional(),
    animationEndFrame: z.number().int().min(0).optional()
  })
  .strict()
  .superRefine((action, context) => {
    const hitIds = new Set(
      (action.hits ?? []).flatMap((hit) =>
        hit.id === undefined ? [] : [hit.id]
      )
    );
    for (const [particleIndex, particle] of (
      action.particles ?? []
    ).entries()) {
      for (const [hitIndex, hitId] of (
        particle.trigger?.hitIds ?? []
      ).entries()) {
        if (!hitIds.has(hitId)) {
          context.addIssue({
            code: "custom",
            path: [
              "particles",
              particleIndex,
              "trigger",
              "hitIds",
              hitIndex
            ],
            message: `unknown action hit id "${hitId}"`
          });
        }
      }
    }
  });

const frameSchema = z.number().int().min(0);

export const frameHitDefinitionSchema = hitDefinitionSchema
  .omit({ offset: true })
  .extend({
    frame: frameSchema
  })
  .strict();

export const frameBuffDefinitionSchema = buffDefinitionSchema
  .omit({ duration: true, offset: true })
  .extend({
    startFrame: frameSchema.optional(),
    durationFrames: frameSchema
  })
  .strict();

export const frameDebuffDefinitionSchema = debuffDefinitionSchema
  .omit({ duration: true, offset: true })
  .extend({
    startFrame: frameSchema.optional(),
    durationFrames: frameSchema
  })
  .strict();

export const frameEnergyEventSchema = energyEventSchema
  .omit({ offset: true, internalCooldown: true })
  .extend({
    frame: frameSchema.optional(),
    internalCooldown: z
      .object({
        key: idSchema,
        durationFrames: z.number().int().positive()
      })
      .strict()
      .optional()
  })
  .strict();

export const frameParticleDefinitionSchema = particleDefinitionObjectSchema
  .omit({ spawnOffset: true, travelTime: true, trigger: true })
  .extend({
    spawnFrame: frameSchema.optional(),
    travelFrames: frameSchema,
    trigger: z
      .object({
        kind: z.literal("hit-confirm"),
        hitIds: z.array(idSchema).min(1),
        internalCooldown: z
          .object({
            key: idSchema,
            durationFrames: z.number().int().positive()
          })
          .strict()
          .optional()
      })
      .strict()
      .optional()
  })
  .strict()
  .superRefine((particle, context) => {
    if (
      particle.trigger !== undefined &&
      particle.spawnFrame !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["spawnFrame"],
        message: "must be omitted for hit-confirm particle triggers"
      });
    }
    const hitIds = new Set<string>();
    for (const [index, hitId] of (
      particle.trigger?.hitIds ?? []
    ).entries()) {
      if (hitIds.has(hitId)) {
        context.addIssue({
          code: "custom",
          path: ["trigger", "hitIds", index],
          message: `duplicate hit id "${hitId}"`
        });
      }
      hitIds.add(hitId);
    }
  });

export const timelineStateGrantSchema = z
  .object({
    key: idSchema,
    label: idSchema,
    durationFrames: z.number().int().min(1).max(216_000)
  })
  .strict();

export const abilityTimelineStateSchema = z
  .object({
    requires: z.array(idSchema).optional(),
    consumes: z.array(idSchema).optional(),
    clears: z.array(idSchema).optional(),
    grants: z.array(timelineStateGrantSchema).optional()
  })
  .strict()
  .superRefine((state, context) => {
    for (const field of ["requires", "consumes", "clears"] as const) {
      const seen = new Set<string>();
      for (const [index, key] of (state[field] ?? []).entries()) {
        if (seen.has(key)) {
          context.addIssue({
            code: "custom",
            path: [field, index],
            message: `duplicate state key "${key}"`
          });
        }
        seen.add(key);
      }
    }
    const grantKeys = new Set<string>();
    for (const [index, grant] of (state.grants ?? []).entries()) {
      if (grantKeys.has(grant.key)) {
        context.addIssue({
          code: "custom",
          path: ["grants", index, "key"],
          message: `duplicate state key "${grant.key}"`
        });
      }
      grantKeys.add(grant.key);
    }
    const required = new Set(state.requires ?? []);
    for (const [index, key] of (state.consumes ?? []).entries()) {
      if (!required.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["consumes", index],
          message: `consumed state "${key}" must also be required`
        });
      }
    }
  });

export const abilityCancelFramesSchema = z
  .object({
    normal: frameSchema.optional(),
    charge: frameSchema.optional(),
    skill: frameSchema.optional(),
    burst: frameSchema.optional(),
    dash: frameSchema.optional(),
    jump: frameSchema.optional(),
    swap: frameSchema.optional()
  })
  .strict();

export const abilityDefinitionSchema = z
  .object({
    id: idSchema,
    actorId: idSchema,
    name: idSchema,
    kind: z.enum(["skill", "burst", "normal", "charge"]),
    cancelFrame: frameSchema,
    cancelFrames: abilityCancelFramesSchema.optional(),
    animationEndFrame: frameSchema,
    cooldownFrames: frameSchema,
    maxCharges: z.number().int().min(1).max(10).optional(),
    chargeRecoveryFrames: frameSchema.optional(),
    energyCost: finiteNumber.min(0).optional(),
    hits: z.array(frameHitDefinitionSchema).optional(),
    buffs: z.array(frameBuffDefinitionSchema).optional(),
    debuffs: z.array(frameDebuffDefinitionSchema).optional(),
    energyGains: z.array(frameEnergyEventSchema).optional(),
    particles: z.array(frameParticleDefinitionSchema).optional(),
    timelineState: abilityTimelineStateSchema.optional()
  })
  .strict()
  .superRefine((ability, context) => {
    if (ability.cancelFrame > ability.animationEndFrame) {
      context.addIssue({
        code: "custom",
        path: ["cancelFrame"],
        message: "must not exceed animationEndFrame"
      });
    }
    for (const [followup, cancelFrame] of Object.entries(
      ability.cancelFrames ?? {}
    )) {
      if (
        cancelFrame !== undefined &&
        cancelFrame > ability.animationEndFrame
      ) {
        context.addIssue({
          code: "custom",
          path: ["cancelFrames", followup],
          message: "must not exceed animationEndFrame"
        });
      }
    }
    if (
      (ability.maxCharges ?? 1) > 1 &&
      (ability.chargeRecoveryFrames ?? ability.cooldownFrames) <= 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["chargeRecoveryFrames"],
        message: "multi-charge abilities require a positive recovery"
      });
    }
    const abilityHitIds = new Set(
      (ability.hits ?? []).flatMap((hit) =>
        hit.id === undefined ? [] : [hit.id]
      )
    );
    for (const [particleIndex, particle] of (
      ability.particles ?? []
    ).entries()) {
      for (const [hitIndex, hitId] of (
        particle.trigger?.hitIds ?? []
      ).entries()) {
        if (!abilityHitIds.has(hitId)) {
          context.addIssue({
            code: "custom",
            path: [
              "particles",
              particleIndex,
              "trigger",
              "hitIds",
              hitIndex
            ],
            message: `unknown ability hit id "${hitId}"`
          });
        }
      }
    }
  });

export const legalTimelineCommandSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("wait"),
      frames: z.number().int().min(1)
    })
    .strict(),
  z
    .object({
      type: z.literal("swap"),
      characterId: idSchema,
      atFrame: frameSchema.optional()
    })
    .strict(),
  ...(["dash", "jump"] as const).map((type) =>
    z
      .object({
        type: z.literal(type),
        actorId: idSchema,
        frames: z.number().int().positive(),
        atFrame: frameSchema.optional()
      })
      .strict()
  ),
  ...(["skill", "burst", "normal", "charge"] as const).map((type) =>
    z
      .object({
        type: z.literal(type),
        actorId: idSchema,
        abilityId: idSchema,
        atFrame: frameSchema.optional()
      })
      .strict()
  )
]);

export const legalTimelineConfigSchema = z
  .object({
    mode: z.literal("legal-frame-v1"),
    fps: z.literal(60),
    legalityMode: z.enum(["strict", "wait"]),
    initialActiveCharacterId: idSchema,
    swapFrames: z.number().int().min(1),
    abilities: z.array(abilityDefinitionSchema),
    commands: z.array(legalTimelineCommandSchema)
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
    characters: z
      .array(characterProfileSchema)
      .min(1)
      .max(4, "Genshin parties support at most four characters"),
    rotation: z.array(actionDefinitionSchema),
    timeline: legalTimelineConfigSchema.optional(),
    reactionEngine: auraReactionEngineConfigSchema.optional()
  })
  .strict()
  .superRefine((config, context) => {
    const enemyTargetIds = new Set(
      (config.enemy.targets ?? [{ id: "enemy-0" }]).map(
        (target) => target.id
      )
    );
    const validateEnemyTarget = (
      targetId: string | undefined,
      path: Array<string | number>
    ): void => {
      if (targetId !== undefined && !enemyTargetIds.has(targetId)) {
        context.addIssue({
          code: "custom",
          path,
          message: `unknown enemy target id "${targetId}"`
        });
      }
    };
    const validateHitGeometry = (
      hit: { targeting?: unknown; geometry?: unknown },
      path: Array<string | number>
    ): void => {
      if (hit.targeting !== undefined && hit.geometry !== undefined) {
        context.addIssue({
          code: "custom",
          path: [...path, "geometry"],
          message:
            "cannot be combined with scripted targeting; choose one hit-resolution source"
        });
      }
      if (
        hit.geometry !== undefined &&
        (config.enemy.targets === undefined ||
          config.enemy.targets.some((target) => target.position === undefined))
      ) {
        context.addIssue({
          code: "custom",
          path: [...path, "geometry"],
          message:
            "requires enemy.targets and a position for every registered target"
        });
      }
    };
    const durationFrames = Math.round(config.duration * 60);
    config.enemy.targets?.forEach((target, index) => {
      if (
        target.initialAura !== undefined &&
        config.reactionEngine?.mode !== "aura-v1"
      ) {
        context.addIssue({
          code: "custom",
          path: ["enemy", "targets", index, "initialAura"],
          message: "requires reactionEngine.mode to be aura-v1"
        });
      }
    });
    config.enemy.targetPhases?.forEach((phase, index) => {
      validateEnemyTarget(phase.targetId, [
        "enemy",
        "targetPhases",
        index,
        "targetId"
      ]);
      if (phase.endFrame > durationFrames) {
        context.addIssue({
          code: "custom",
          path: ["enemy", "targetPhases", index, "endFrame"],
          message: `must not exceed simulation duration (${durationFrames} frames)`
        });
      }
    });

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
        validateHitGeometry(hit, [
          "rotation",
          actionIndex,
          "hits",
          hitIndex
        ]);
        const targetings =
          hit.targeting === undefined
            ? []
            : "mode" in hit.targeting
              ? hit.targeting.targets
              : [hit.targeting];
        targetings.forEach((targeting, targetingIndex) => {
          validateEnemyTarget(targeting.targetId, [
            "rotation",
            actionIndex,
            "hits",
            hitIndex,
            "targeting",
            ...("mode" in (hit.targeting ?? {})
              ? ["targets", targetingIndex]
              : []),
            "targetId"
          ]);
        });
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

    if (config.timeline) {
      if (config.rotation.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["rotation"],
          message: "must be empty when timeline.mode is legal-frame-v1"
        });
      }
      const durationFrames = config.duration * config.timeline.fps;
      if (
        Math.abs(durationFrames - Math.round(durationFrames)) >
        1e-9
      ) {
        context.addIssue({
          code: "custom",
          path: ["duration"],
          message: "must resolve to an integer frame for legal-frame-v1"
        });
      }
      if (!characterIds.has(config.timeline.initialActiveCharacterId)) {
        context.addIssue({
          code: "custom",
          path: ["timeline", "initialActiveCharacterId"],
          message: `unknown character id "${config.timeline.initialActiveCharacterId}"`
        });
      }

      const abilityIds = new Set<string>();
      const abilityById = new Map<
        string,
        (typeof config.timeline.abilities)[number]
      >();
      config.timeline.abilities.forEach((ability, abilityIndex) => {
        if (abilityIds.has(ability.id)) {
          context.addIssue({
            code: "custom",
            path: ["timeline", "abilities", abilityIndex, "id"],
            message: `duplicate ability id "${ability.id}"`
          });
        }
        abilityIds.add(ability.id);
        abilityById.set(ability.id, ability);
        if (!characterIds.has(ability.actorId)) {
          context.addIssue({
            code: "custom",
            path: ["timeline", "abilities", abilityIndex, "actorId"],
            message: `unknown character id "${ability.actorId}"`
          });
        }
        ability.hits?.forEach((hit, hitIndex) => {
          validateHitGeometry(hit, [
            "timeline",
            "abilities",
            abilityIndex,
            "hits",
            hitIndex
          ]);
          const targetings =
            hit.targeting === undefined
              ? []
              : "mode" in hit.targeting
                ? hit.targeting.targets
                : [hit.targeting];
          targetings.forEach((targeting, targetingIndex) => {
            validateEnemyTarget(targeting.targetId, [
              "timeline",
              "abilities",
              abilityIndex,
              "hits",
              hitIndex,
              "targeting",
              ...("mode" in (hit.targeting ?? {})
                ? ["targets", targetingIndex]
                : []),
              "targetId"
            ]);
          });
          for (const [field, id] of [
            ["scalingOwnerId", hit.scalingOwnerId],
            ["creditId", hit.creditId]
          ] as const) {
            if (id !== undefined && !characterIds.has(id)) {
              context.addIssue({
                code: "custom",
                path: [
                  "timeline",
                  "abilities",
                  abilityIndex,
                  "hits",
                  hitIndex,
                  field
                ],
                message: `unknown character id "${id}"`
              });
            }
          }
          hit.flatSources?.forEach((source, sourceIndex) => {
            if (
              source.ownerId !== undefined &&
              !characterIds.has(source.ownerId)
            ) {
              context.addIssue({
                code: "custom",
                path: [
                  "timeline",
                  "abilities",
                  abilityIndex,
                  "hits",
                  hitIndex,
                  "flatSources",
                  sourceIndex,
                  "ownerId"
                ],
                message: `unknown character id "${source.ownerId}"`
              });
            }
          });
        });
        const validateTimelineTarget = (
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
        ability.buffs?.forEach((buff, buffIndex) => {
          validateTimelineTarget(
            buff.target,
            [
              "timeline",
              "abilities",
              abilityIndex,
              "buffs",
              buffIndex,
              "target"
            ],
            true
          );
        });
        ability.energyGains?.forEach((gain, gainIndex) => {
          validateTimelineTarget(
            gain.target,
            [
              "timeline",
              "abilities",
              abilityIndex,
              "energyGains",
              gainIndex,
              "target"
            ],
            false
          );
        });
      });

      config.timeline.commands.forEach((command, commandIndex) => {
        if (command.type === "wait") return;
        if (command.type === "swap") {
          if (!characterIds.has(command.characterId)) {
            context.addIssue({
              code: "custom",
              path: ["timeline", "commands", commandIndex, "characterId"],
              message: `unknown character id "${command.characterId}"`
            });
          }
          return;
        }
        if (!characterIds.has(command.actorId)) {
          context.addIssue({
            code: "custom",
            path: ["timeline", "commands", commandIndex, "actorId"],
            message: `unknown character id "${command.actorId}"`
          });
        }
        if (!("abilityId" in command)) {
          return;
        }
        const ability = abilityById.get(command.abilityId);
        if (!ability) {
          context.addIssue({
            code: "custom",
            path: ["timeline", "commands", commandIndex, "abilityId"],
            message: `unknown ability id "${command.abilityId}"`
          });
          return;
        }
        if (ability.actorId !== command.actorId) {
          context.addIssue({
            code: "custom",
            path: ["timeline", "commands", commandIndex, "actorId"],
            message: `ability "${command.abilityId}" belongs to "${ability.actorId}"`
          });
        }
        if (ability.kind !== command.type) {
          context.addIssue({
            code: "custom",
            path: ["timeline", "commands", commandIndex, "type"],
            message: `ability "${command.abilityId}" is kind "${ability.kind}"`
          });
        }
      });
    }

    if (config.reactionEngine?.mode === "aura-v1") {
      if (!config.timeline) {
        context.addIssue({
          code: "custom",
          path: ["reactionEngine"],
          message: "aura-v1 currently requires timeline.mode legal-frame-v1"
        });
      }
      const validateAuraHit = (
        hit: {
          reaction?: string | undefined;
          reactionOverride?: string | undefined;
          application?:
            | { gaugeUnits: number; icdGroup: string }
            | undefined;
          element?: string | undefined;
        },
        path: Array<string | number>
      ): void => {
        if (hit.reaction !== undefined && hit.reaction !== "none") {
          context.addIssue({
            code: "custom",
            path: [...path, "reaction"],
            message:
              "manual reaction labels are forbidden in aura-v1; use reactionOverride only for explicit debug runs"
          });
        }
        if (
          hit.reactionOverride !== undefined &&
          hit.reactionOverride !== "none" &&
          config.reactionEngine?.debugAllowReactionOverride !== true
        ) {
          context.addIssue({
            code: "custom",
            path: [...path, "reactionOverride"],
            message:
              "requires reactionEngine.debugAllowReactionOverride=true"
          });
        }
        if (
          hit.application !== undefined &&
          !["pyro", "cryo", "hydro"].includes(hit.element ?? "")
        ) {
          context.addIssue({
            code: "custom",
            path: [...path, "application"],
            message:
              "aura-v1 elemental applications currently support only pyro, cryo, and hydro hits"
          });
        }
        if (
          hit.application !== undefined &&
          !["default", "no-icd"].includes(hit.application.icdGroup) &&
          config.reactionEngine?.icdProfiles?.[
            hit.application.icdGroup
          ] === undefined
        ) {
          context.addIssue({
            code: "custom",
            path: [...path, "application", "icdGroup"],
            message: `unknown ICD profile "${hit.application.icdGroup}"`
          });
        }
      };
      config.rotation.forEach((action, actionIndex) => {
        action.hits?.forEach((hit, hitIndex) => {
          validateAuraHit(hit, [
            "rotation",
            actionIndex,
            "hits",
            hitIndex
          ]);
        });
      });
      config.timeline?.abilities.forEach((ability, abilityIndex) => {
        ability.hits?.forEach((hit, hitIndex) => {
          validateAuraHit(hit, [
            "timeline",
            "abilities",
            abilityIndex,
            "hits",
            hitIndex
          ]);
        });
      });
    }
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
          defReduction: input.enemy.defReduction ?? 0,
          ...(Array.isArray(input.enemy.targets)
            ? { targets: input.enemy.targets }
            : {}),
          ...(Array.isArray(input.enemy.targetPhases)
            ? { targetPhases: input.enemy.targetPhases }
            : {})
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
  if (version === AOE_FANOUT_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === MULTI_TARGET_REGISTRY_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === TARGET_PHASE_TIMELINE_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === TARGET_EFFECT_POLICY_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === TARGET_HIT_RESOLUTION_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === TIMELINE_STATE_CLEAR_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === MOVEMENT_COMMAND_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === HIT_PARTICLE_TRIGGER_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === FIXED_ENERGY_ICD_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === RUNTIME_ENERGY_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === FOLLOWUP_CANCEL_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === ACTION_STATE_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === ICD_PROFILE_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === PARTICLE_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === PREVIOUS_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === INITIAL_TYPED_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  throw new ConfigMigrationError(
    `不支持的 schemaVersion "${String(version)}"；当前版本为 ${CURRENT_SCHEMA_VERSION}`
  );
}
