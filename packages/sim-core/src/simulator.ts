import {
  CURRENT_SCHEMA_VERSION,
  migrateConfig,
  type ActionDefinition,
  type ActiveStatusSnapshot,
  type BuffDefinition,
  type BuffStat,
  type CharacterStats,
  type DamageEvent,
  type DebuffDefinition,
  type Element,
  type EnergySummary,
  type HitDefinition,
  type ParticleDefinition,
  type ReactionAudit,
  type SimConfig,
  type SimulationEvent,
  type SimulationOptions,
  type SimulationResult,
  type TimelineExecution
} from "@genshin-dps-lab/schemas";
import { AuraEngine } from "./aura";
import {
  calculateParticleEnergy,
  resolveParticleCount,
  SeededRandom
} from "./energy";
import {
  calcDamage,
  calcTotalStat,
  clamp,
  type DamageCalculationInput
} from "./formulas";
import { MinHeap } from "./min-heap";
import type { DamageModifierPlugin } from "./plugins";
import {
  compileLegalTimeline,
  type RuntimeEnergyFailure
} from "./legal-timeline";

export const EVENT_PRIORITY = {
  action: 0,
  buff: 1,
  debuff: 1,
  energy: 2,
  particleSpawn: 2,
  particleReceive: 2,
  hit: 3
} as const;

export interface SimulationRuntimeOptions extends SimulationOptions {
  plugins?: readonly DamageModifierPlugin[];
}

interface ActionEventPayload {
  action: ActionDefinition;
  cycle: number;
}

interface BuffEventPayload {
  actorId: string;
  buff: BuffDefinition;
}

interface DebuffEventPayload {
  actorId: string;
  debuff: DebuffDefinition;
}

interface EnergyEventPayload {
  actorId: string;
  actionId: string;
  gain: NonNullable<ActionDefinition["energyGains"]>[number];
  cycle: number;
}

interface ParticleSpawnEventPayload {
  actorId: string;
  actionId: string;
  actionName: string;
  particle: ParticleDefinition;
  particleIndex: number;
  cycle: number;
  triggerLogId?: number;
  triggerHitId?: string;
}

interface ParticleReceiveEventPayload {
  particleEventId: number;
}

interface HitEventPayload {
  actorId: string;
  action: ActionDefinition;
  hit: HitDefinition;
  hitIndex: number;
  snapshots: Record<string, CharacterStats | undefined>;
  cycle: number;
}

type InternalEvent =
  | SimulationEvent<ActionEventPayload>
  | SimulationEvent<BuffEventPayload>
  | SimulationEvent<DebuffEventPayload>
  | SimulationEvent<EnergyEventPayload>
  | SimulationEvent<ParticleSpawnEventPayload>
  | SimulationEvent<ParticleReceiveEventPayload>
  | SimulationEvent<HitEventPayload>;

interface ActiveBuff {
  key: string;
  actorId: string;
  targetId: string;
  stat: BuffStat;
  value: number;
  start: number;
  end: number;
  label: string;
}

interface ActiveDebuff {
  key: string;
  actorId: string;
  element: Element | "all";
  resShred: number;
  defReduction: number;
  start: number;
  end: number;
  label: string;
}

const BUFF_STATS = new Set<BuffStat>([
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
]);

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function safeNumber(value: number | undefined, fallback = 0): number {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function toFrame(timeSeconds: number): number {
  return Math.round(timeSeconds * 60);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function makeReproducibilityKey(
  config: SimConfig,
  options: Required<
    Pick<
      SimulationRuntimeOptions,
      "energyMode" | "critMode" | "compatibilityMode" | "randomSeed"
    >
  >,
  plugins: readonly DamageModifierPlugin[]
): string {
  return `gdl-${fnv1a(
    stableStringify({
      config,
      options,
      plugins: plugins.map((plugin) => plugin.id)
    })
  )}`;
}

function applyPluginChanges(
  input: DamageCalculationInput,
  changes: Partial<DamageCalculationInput> | void
): DamageCalculationInput {
  if (!changes) return input;
  return { ...input, ...changes };
}

function simulateConfig(
  config: SimConfig,
  runtimeOptions: SimulationRuntimeOptions = {},
  resultConfig: SimConfig = config,
  timelineExecution?: TimelineExecution
): SimulationResult {
  const options = {
    energyMode: runtimeOptions.energyMode ?? "configured",
    critMode: runtimeOptions.critMode ?? "average",
    compatibilityMode:
      runtimeOptions.compatibilityMode ??
      (timelineExecution ? "legal-frame-v1" : "legacy-v0.1"),
    randomSeed: runtimeOptions.randomSeed ?? config.randomSeed
  } as const;
  const plugins = runtimeOptions.plugins ?? [];
  const random = new SeededRandom(options.randomSeed);
  const auraEngine =
    config.reactionEngine?.mode === "aura-v1"
      ? new AuraEngine(config.reactionEngine)
      : null;
  const characters = new Map(
    config.characters.map((character) => [character.id, character])
  );
  const energies = new Map<string, number>();
  const energyStats = new Map<string, EnergySummary>();
  const fixedEnergyCooldownReadyFrames = new Map<string, number>();
  const particleCooldownReadyFrames = new Map<string, number>();

  for (const character of config.characters) {
    const initial =
      options.energyMode === "zero"
        ? 0
        : options.energyMode === "full"
          ? character.energyMax
          : character.initialEnergy;
    energies.set(character.id, initial);
    energyStats.set(character.id, {
      initial,
      gained: 0,
      fixedGained: 0,
      particleGained: 0,
      wasted: 0,
      spent: 0,
      skipped: 0,
      final: initial
    });
  }

  const frameNative = options.compatibilityMode === "legal-frame-v1";
  const queue = new MinHeap<InternalEvent>((left, right) => {
    const timeOrder = frameNative
      ? left.frame - right.frame
      : left.timeSeconds - right.timeSeconds;
    return (
      timeOrder ||
      left.priority - right.priority ||
      left.sequence - right.sequence
    );
  });
  let sequence = 0;
  const push = <TPayload>(
    timeSeconds: number,
    type: InternalEvent["type"],
    payload: TPayload
  ): void => {
    if (timeSeconds <= config.duration + 1e-9) {
      const frame = toFrame(timeSeconds);
      queue.push({
        timeSeconds: frameNative ? frame / 60 : timeSeconds,
        frame,
        priority: EVENT_PRIORITY[type],
        type,
        payload,
        sequence: sequence++
      } as InternalEvent);
    }
  };

  const cycleCount = Math.ceil(config.duration / config.cycleLength);
  for (let cycle = 0; cycle < cycleCount; cycle += 1) {
    const cycleStart = cycle * config.cycleLength;
    for (const action of config.rotation) {
      if (action.once && cycle > 0) continue;
      if (action.cycles?.includes(cycle) === false) continue;
      if (
        action.everyNCycles !== undefined &&
        cycle % action.everyNCycles !== (action.cycleRemainder ?? 0)
      ) {
        continue;
      }
      const timeSeconds = cycleStart + action.at;
      if (timeSeconds <= config.duration) {
        push(timeSeconds, "action", { action, cycle });
      }
    }
  }

  const activeBuffs: ActiveBuff[] = [];
  const activeDebuffs: ActiveDebuff[] = [];
  const damageEvents: DamageEvent[] = [];
  const hitResolutionLog: SimulationResult["hitResolutionLog"] = [];
  const skippedActions: SimulationResult["skippedActions"] = [];
  const actionLog: SimulationResult["actionLog"] = [];
  const energyLog: SimulationResult["energyLog"] = [];
  const particleEvents: SimulationResult["particleEvents"] = [];
  const particleTriggerLog: SimulationResult["particleTriggerLog"] = [];
  const energyCurve: SimulationResult["energyCurve"] = [];
  let activeCharacterId =
    resultConfig.timeline?.initialActiveCharacterId ??
    config.characters[0]?.id ??
    null;
  const recordEnergyCurve = (
    frame: number,
    timeSeconds: number,
    kind: SimulationResult["energyCurve"][number]["kind"],
    receiverId: string | null,
    source: string
  ): void => {
    energyCurve.push({
      id: energyCurve.length,
      frame,
      timeSeconds,
      kind,
      receiverId,
      source,
      energyByCharacter: Object.fromEntries(energies)
    });
  };
  recordEnergyCurve(0, 0, "initial", null, "initial-energy");

  const cleanup = (timeSeconds: number): void => {
    for (let index = activeBuffs.length - 1; index >= 0; index -= 1) {
      const buff = activeBuffs[index];
      if (buff !== undefined && buff.end <= timeSeconds + 1e-9) {
        activeBuffs.splice(index, 1);
      }
    }
    for (let index = activeDebuffs.length - 1; index >= 0; index -= 1) {
      const debuff = activeDebuffs[index];
      if (debuff !== undefined && debuff.end <= timeSeconds + 1e-9) {
        activeDebuffs.splice(index, 1);
      }
    }
  };

  const computeStats = (
    characterId: string,
    timeSeconds: number
  ): CharacterStats | undefined => {
    cleanup(timeSeconds);
    const character = characters.get(characterId);
    if (!character) return undefined;
    const stats = deepClone(character.stats);
    for (const buff of activeBuffs) {
      if (buff.targetId !== characterId || !BUFF_STATS.has(buff.stat)) continue;
      const compatibilityStats = stats as CharacterStats &
        Partial<Record<BuffStat, number>>;
      compatibilityStats[buff.stat] =
        safeNumber(compatibilityStats[buff.stat]) + buff.value;
    }
    stats.critRate = clamp(stats.critRate, 0, 1);
    stats.defIgnore = clamp(stats.defIgnore, 0, 1);
    return stats;
  };

  const addBuff = (
    timeSeconds: number,
    actorId: string,
    buff: BuffDefinition
  ): void => {
    const targets =
      buff.target === "team"
        ? config.characters.map((character) => character.id)
        : buff.target === "self"
          ? [actorId]
          : Array.isArray(buff.target)
            ? buff.target
            : [buff.target ?? actorId];
    for (const targetId of targets) {
      const key = `${buff.key ?? buff.stat ?? "buff"}:${targetId}`;
      for (let index = activeBuffs.length - 1; index >= 0; index -= 1) {
        if (activeBuffs[index]?.key === key) activeBuffs.splice(index, 1);
      }
      activeBuffs.push({
        key,
        actorId,
        targetId,
        stat: buff.stat,
        value: buff.value,
        start: timeSeconds,
        end: timeSeconds + buff.duration,
        label: buff.label ?? buff.key ?? buff.stat
      });
    }
  };

  const addDebuff = (
    timeSeconds: number,
    actorId: string,
    debuff: DebuffDefinition
  ): void => {
    const key = debuff.key ?? `${debuff.element ?? "all"}-debuff`;
    for (let index = activeDebuffs.length - 1; index >= 0; index -= 1) {
      if (activeDebuffs[index]?.key === key) activeDebuffs.splice(index, 1);
    }
    activeDebuffs.push({
      key,
      actorId,
      element: debuff.element ?? "all",
      resShred: safeNumber(debuff.resShred),
      defReduction: safeNumber(debuff.defReduction),
      start: timeSeconds,
      end: timeSeconds + debuff.duration,
      label: debuff.label ?? key
    });
  };

  const getDebuffState = (
    timeSeconds: number,
    element: Element
  ): {
    resShred: number;
    defReduction: number;
    relevantDebuffs: ActiveDebuff[];
  } => {
    cleanup(timeSeconds);
    let resShred = 0;
    let defReduction = config.enemy.defReduction;
    const relevantDebuffs: ActiveDebuff[] = [];
    for (const debuff of activeDebuffs) {
      const affectsResistance =
        debuff.element === "all" || debuff.element === element;
      if (affectsResistance) resShred += debuff.resShred;
      defReduction += debuff.defReduction;
      if (affectsResistance || debuff.defReduction !== 0) {
        relevantDebuffs.push(debuff);
      }
    }
    return {
      resShred,
      defReduction: clamp(defReduction, -1, 0.9),
      relevantDebuffs
    };
  };

  const processHitConfirmedParticles = ({
    actorId,
    action,
    hitId,
    cycle,
    frame,
    timeSeconds,
    landed,
    hitConfirmAllowed
  }: {
    actorId: string;
    action: ActionDefinition;
    hitId: string;
    cycle: number;
    frame: number;
    timeSeconds: number;
    landed: boolean;
    hitConfirmAllowed: boolean;
  }): void => {
    (action.particles ?? []).forEach((particle, particleIndex) => {
      const trigger = particle.trigger;
      if (
        trigger === undefined ||
        !trigger.hitIds.includes(hitId)
      ) {
        return;
      }
      const internalCooldown = trigger.internalCooldown;
      const internalCooldownDurationFrames =
        internalCooldown === undefined
          ? null
          : Math.max(1, toFrame(internalCooldown.duration));
      const scopedInternalCooldownKey =
        internalCooldown === undefined
          ? null
          : `${actorId}\u0000${internalCooldown.key}`;
      const previousReadyFrame =
        scopedInternalCooldownKey === null
          ? null
          : (particleCooldownReadyFrames.get(
              scopedInternalCooldownKey
            ) ?? 0);
      const blockedByInternalCooldown =
        hitConfirmAllowed &&
        previousReadyFrame !== null &&
        frame < previousReadyFrame;
      const internalCooldownReadyFrame =
        internalCooldownDurationFrames === null
          ? null
          : !hitConfirmAllowed
            ? previousReadyFrame !== null && previousReadyFrame > frame
              ? previousReadyFrame
              : null
            : blockedByInternalCooldown
              ? previousReadyFrame
              : frame + internalCooldownDurationFrames;
      if (
        hitConfirmAllowed &&
        scopedInternalCooldownKey !== null &&
        internalCooldownReadyFrame !== null &&
        !blockedByInternalCooldown
      ) {
        particleCooldownReadyFrames.set(
          scopedInternalCooldownKey,
          internalCooldownReadyFrame
        );
      }
      const particleId =
        particle.id ?? `${action.id}:particle-${particleIndex}`;
      const source = particle.source ?? `${action.name}:${particleId}`;
      const triggerLogId = particleTriggerLog.length;
      const blockedReason = !landed
        ? ("TARGET_MISS" as const)
        : !hitConfirmAllowed
          ? ("TARGET_HIT_CONFIRM_BLOCKED" as const)
        : blockedByInternalCooldown
          ? ("INTERNAL_COOLDOWN" as const)
          : null;
      particleTriggerLog.push({
        id: triggerLogId,
        frame,
        timeSeconds,
        cycle,
        sourceActorId: actorId,
        sourceActionId: action.id,
        source,
        particleId,
        hitId,
        triggered: blockedReason === null,
        blockedReason,
        internalCooldownKey: internalCooldown?.key ?? null,
        internalCooldownDurationFrames,
        internalCooldownReadyFrame
      });
      if (blockedReason === null) {
        push(timeSeconds, "particleSpawn", {
          actorId,
          actionId: action.id,
          actionName: action.name,
          particle,
          particleIndex,
          cycle,
          triggerLogId,
          triggerHitId: hitId
        });
      }
    });
  };

  while (queue.size > 0) {
    const event = queue.pop();
    if (!event) break;
    const timeSeconds = event.timeSeconds;
    if (timeSeconds > config.duration + 1e-9) break;
    cleanup(timeSeconds);

    if (event.type === "action") {
      const { action, cycle } = event.payload as ActionEventPayload;
      const actor = characters.get(action.actorId);
      if (!actor) continue;
      activeCharacterId = actor.id;
      const energyCost = Math.max(0, safeNumber(action.energyCost));
      const currentEnergy = energies.get(actor.id) ?? 0;
      if (energyCost > currentEnergy + 1e-9) {
        skippedActions.push({
          time: timeSeconds,
          frame: event.frame,
          actorId: actor.id,
          actionId: action.id,
          action: action.name,
          reason: `能量不足 ${round(currentEnergy, 1)}/${energyCost}`,
          reasonCode: "INSUFFICIENT_ENERGY",
          energyBefore: currentEnergy,
          energyCost,
          cycle,
          ...(action.timelineCommandIndex === undefined
            ? {}
            : { timelineCommandIndex: action.timelineCommandIndex }),
          ...(action.sourceAbilityId === undefined
            ? {}
            : { sourceAbilityId: action.sourceAbilityId })
        });
        const summary = energyStats.get(actor.id);
        if (summary) summary.skipped += 1;
        continue;
      }

      const energyAfterCost = round(currentEnergy - energyCost, 12);
      energies.set(actor.id, energyAfterCost);
      const energySummary = energyStats.get(actor.id);
      if (energySummary) {
        energySummary.spent = round(energySummary.spent + energyCost, 12);
      }
      if (energyCost > 0) {
        recordEnergyCurve(
          event.frame,
          timeSeconds,
          "spend",
          actor.id,
          `${action.id}:energy-cost`
        );
      }
      actionLog.push({
        time: timeSeconds,
        frame: event.frame,
        actorId: actor.id,
        actionId: action.id,
        action: action.name,
        cycle,
        energyBefore: currentEnergy,
        energyAfter: energyAfterCost,
        ...(action.timelineCommandIndex === undefined
          ? {}
          : { timelineCommandIndex: action.timelineCommandIndex }),
        ...(action.sourceAbilityId === undefined
          ? {}
          : { sourceAbilityId: action.sourceAbilityId }),
        ...(action.cancelFrame === undefined
          ? {}
          : { cancelFrame: action.cancelFrame }),
        ...(action.animationEndFrame === undefined
          ? {}
          : { animationEndFrame: action.animationEndFrame })
      });

      const snapshotIds = new Set([actor.id]);
      for (const hit of action.hits ?? []) {
        snapshotIds.add(hit.scalingOwnerId ?? actor.id);
        for (const source of hit.flatSources ?? []) {
          snapshotIds.add(source.ownerId ?? actor.id);
        }
      }
      const snapshots: Record<string, CharacterStats | undefined> = {};
      for (const characterId of snapshotIds) {
        snapshots[characterId] = computeStats(characterId, timeSeconds);
      }

      for (const gain of action.energyGains ?? []) {
        push(timeSeconds + safeNumber(gain.offset), "energy", {
          actorId: actor.id,
          actionId: action.id,
          gain,
          cycle
        });
      }
      (action.particles ?? []).forEach((particle, particleIndex) => {
        if (particle.trigger !== undefined) return;
        push(
          timeSeconds + safeNumber(particle.spawnOffset),
          "particleSpawn",
          {
            actorId: actor.id,
            actionId: action.id,
            actionName: action.name,
            particle,
            particleIndex,
            cycle
          }
        );
      });
      for (const buff of action.buffs ?? []) {
        push(timeSeconds + safeNumber(buff.offset), "buff", {
          actorId: actor.id,
          buff
        });
      }
      for (const debuff of action.debuffs ?? []) {
        push(timeSeconds + safeNumber(debuff.offset), "debuff", {
          actorId: actor.id,
          debuff
        });
      }
      (action.hits ?? []).forEach((hit, hitIndex) => {
        push(timeSeconds + hit.offset, "hit", {
          actorId: actor.id,
          action,
          hit,
          hitIndex,
          snapshots,
          cycle
        });
      });
      continue;
    }

    if (event.type === "energy") {
      const { actorId, actionId, gain } =
        event.payload as EnergyEventPayload;
      const internalCooldown = gain.internalCooldown;
      const internalCooldownDurationFrames =
        internalCooldown === undefined
          ? null
          : Math.max(1, toFrame(internalCooldown.duration));
      const scopedInternalCooldownKey =
        internalCooldown === undefined
          ? null
          : `${actorId}\u0000${internalCooldown.key}`;
      const previousReadyFrame =
        scopedInternalCooldownKey === null
          ? null
          : (fixedEnergyCooldownReadyFrames.get(
              scopedInternalCooldownKey
            ) ?? 0);
      const blockedByInternalCooldown =
        previousReadyFrame !== null && event.frame < previousReadyFrame;
      const internalCooldownReadyFrame =
        internalCooldownDurationFrames === null
          ? null
          : blockedByInternalCooldown
            ? previousReadyFrame
            : event.frame + internalCooldownDurationFrames;
      if (
        scopedInternalCooldownKey !== null &&
        internalCooldownReadyFrame !== null &&
        !blockedByInternalCooldown
      ) {
        fixedEnergyCooldownReadyFrames.set(
          scopedInternalCooldownKey,
          internalCooldownReadyFrame
        );
      }
      const targets =
        gain.target === "team"
          ? config.characters.map((character) => character.id)
          : Array.isArray(gain.target)
            ? gain.target
            : [gain.target ?? actorId];
      for (const targetId of targets) {
        const character = characters.get(targetId);
        if (!character) continue;
        const before = energies.get(targetId) ?? 0;
        const source = gain.source ?? `${actionId}:fixed-energy`;
        if (blockedByInternalCooldown) {
          energyLog.push({
            id: energyLog.length,
            kind: "fixed",
            frame: event.frame,
            timeSeconds,
            sourceActorId: actorId,
            sourceActionId: actionId,
            source,
            receiverId: targetId,
            activeCharacterId,
            isOnField: activeCharacterId === targetId,
            energyBefore: before,
            rawEnergy: gain.amount,
            finalEnergy: gain.amount,
            gainedEnergy: 0,
            wastedEnergy: 0,
            energyAfter: before,
            spawnFrame: null,
            receiveFrame: event.frame,
            particleElement: null,
            particleKind: null,
            particleCount: null,
            isSameElement: null,
            energyRecharge: 1,
            fieldMultiplier: 1,
            baseEnergyPerParticle: null,
            applied: false,
            blockedReason: "INTERNAL_COOLDOWN",
            internalCooldownKey: internalCooldown?.key ?? null,
            internalCooldownDurationFrames,
            internalCooldownReadyFrame
          });
          recordEnergyCurve(
            event.frame,
            timeSeconds,
            "fixed-blocked",
            targetId,
            source
          );
          continue;
        }
        const after = round(
          clamp(before + gain.amount, 0, character.energyMax),
          12
        );
        const gainedEnergy = round(after - before, 12);
        const wastedEnergy =
          gain.amount > 0
            ? round(Math.max(0, gain.amount - gainedEnergy), 12)
            : 0;
        energies.set(targetId, after);
        const summary = energyStats.get(targetId);
        if (summary) {
          summary.gained = round(summary.gained + gainedEnergy, 12);
          summary.fixedGained = round(
            summary.fixedGained + gainedEnergy,
            12
          );
          summary.wasted = round(summary.wasted + wastedEnergy, 12);
        }
        energyLog.push({
          id: energyLog.length,
          kind: "fixed",
          frame: event.frame,
          timeSeconds,
          sourceActorId: actorId,
          sourceActionId: actionId,
          source,
          receiverId: targetId,
          activeCharacterId,
          isOnField: activeCharacterId === targetId,
          energyBefore: before,
          rawEnergy: gain.amount,
          finalEnergy: gain.amount,
          gainedEnergy,
          wastedEnergy,
          energyAfter: after,
          spawnFrame: null,
          receiveFrame: event.frame,
          particleElement: null,
          particleKind: null,
          particleCount: null,
          isSameElement: null,
          energyRecharge: 1,
          fieldMultiplier: 1,
          baseEnergyPerParticle: null,
          applied: true,
          blockedReason: null,
          internalCooldownKey: internalCooldown?.key ?? null,
          internalCooldownDurationFrames,
          internalCooldownReadyFrame
        });
        recordEnergyCurve(
          event.frame,
          timeSeconds,
          "fixed",
          targetId,
          source
        );
      }
      continue;
    }

    if (event.type === "particleSpawn") {
      const {
        actorId,
        actionId,
        actionName,
        particle,
        particleIndex,
        cycle,
        triggerLogId,
        triggerHitId
      } = event.payload as ParticleSpawnEventPayload;
      const particleCount = resolveParticleCount(particle.count, random);
      const receiveTimeSeconds =
        timeSeconds + Math.max(0, particle.travelTime);
      const receiveFrame = toFrame(receiveTimeSeconds);
      const particleEventId = particleEvents.length;
      const particleId =
        particle.id ?? `${actionId}:particle-${particleIndex}`;
      const source = particle.source ?? `${actionName}:${particleId}`;
      const receivedWithinSimulation =
        receiveTimeSeconds <= config.duration + 1e-9;
      particleEvents.push({
        id: particleEventId,
        sourceActorId: actorId,
        sourceActionId: actionId,
        source,
        particleId,
        spawnFrame: event.frame,
        receiveFrame,
        spawnTimeSeconds: timeSeconds,
        receiveTimeSeconds: frameNative
          ? receiveFrame / 60
          : receiveTimeSeconds,
        particleElement: particle.element,
        particleKind: particle.kind ?? "particle",
        particleCount,
        receivedWithinSimulation,
        cycle,
        triggerLogId: triggerLogId ?? null,
        triggerHitId: triggerHitId ?? null
      });
      if (receivedWithinSimulation) {
        push(receiveTimeSeconds, "particleReceive", { particleEventId });
      }
      continue;
    }

    if (event.type === "particleReceive") {
      const { particleEventId } =
        event.payload as ParticleReceiveEventPayload;
      const particle = particleEvents[particleEventId];
      if (!particle) continue;
      for (const character of config.characters) {
        const before = energies.get(character.id) ?? 0;
        const stats = computeStats(character.id, timeSeconds);
        const energyRecharge = stats?.energyRecharge ?? 1;
        const calculation = calculateParticleEnergy({
          particleElement: particle.particleElement,
          particleKind: particle.particleKind,
          particleCount: particle.particleCount,
          receiverElement: character.element,
          isOnField: activeCharacterId === character.id,
          partySize: config.characters.length,
          energyRecharge
        });
        const after = round(
          clamp(
            before + calculation.finalEnergy,
            0,
            character.energyMax
          ),
          12
        );
        const gainedEnergy = round(after - before, 12);
        const wastedEnergy = round(
          Math.max(0, calculation.finalEnergy - gainedEnergy),
          12
        );
        energies.set(character.id, after);
        const summary = energyStats.get(character.id);
        if (summary) {
          summary.gained = round(summary.gained + gainedEnergy, 12);
          summary.particleGained = round(
            summary.particleGained + gainedEnergy,
            12
          );
          summary.wasted = round(summary.wasted + wastedEnergy, 12);
        }
        energyLog.push({
          id: energyLog.length,
          kind: "particle",
          frame: event.frame,
          timeSeconds,
          sourceActorId: particle.sourceActorId,
          sourceActionId: particle.sourceActionId,
          source: particle.source,
          receiverId: character.id,
          activeCharacterId,
          isOnField: activeCharacterId === character.id,
          energyBefore: before,
          rawEnergy: calculation.rawEnergy,
          finalEnergy: calculation.finalEnergy,
          gainedEnergy,
          wastedEnergy,
          energyAfter: after,
          spawnFrame: particle.spawnFrame,
          receiveFrame: event.frame,
          particleElement: particle.particleElement,
          particleKind: particle.particleKind,
          particleCount: particle.particleCount,
          isSameElement: calculation.isSameElement,
          energyRecharge: calculation.energyRecharge,
          fieldMultiplier: calculation.fieldMultiplier,
          baseEnergyPerParticle: calculation.baseEnergyPerParticle,
          applied: true,
          blockedReason: null,
          internalCooldownKey: null,
          internalCooldownDurationFrames: null,
          internalCooldownReadyFrame: null
        });
        recordEnergyCurve(
          event.frame,
          timeSeconds,
          "particle",
          character.id,
          particle.source
        );
      }
      continue;
    }

    if (event.type === "buff") {
      const { actorId, buff } = event.payload as BuffEventPayload;
      addBuff(timeSeconds, actorId, buff);
      continue;
    }

    if (event.type === "debuff") {
      const { actorId, debuff } = event.payload as DebuffEventPayload;
      addDebuff(timeSeconds, actorId, debuff);
      continue;
    }

    const {
      actorId,
      action,
      hit,
      hitIndex,
      snapshots,
      cycle
    } = event.payload as HitEventPayload;
    const scalingOwnerId = hit.scalingOwnerId ?? actorId;
    const creditOwnerId = hit.creditId ?? actorId;
    const sourceActor = characters.get(actorId);
    const scalingOwner = characters.get(scalingOwnerId);
    const creditOwner = characters.get(creditOwnerId);
    if (!sourceActor || !scalingOwner || !creditOwner) continue;
    const hitId = hit.id ?? `${action.id}:hit-${hitIndex}`;
    const element = hit.element ?? scalingOwner.element;
    const targetId = hit.targeting?.targetId ?? "enemy-0";
    const targetOutcome = hit.targeting?.outcome ?? "landed";
    const targetEffects = hit.targeting?.effects;
    const landed = targetOutcome === "landed";
    const damageAllowed =
      landed && targetEffects?.damage !== "immune";
    const auraAllowed =
      landed && targetEffects?.aura !== "blocked";
    const hitConfirmAllowed =
      landed && targetEffects?.hitConfirm !== "blocked";
    const targetResolutionId = hitResolutionLog.length;
    const targetResolution: SimulationResult["hitResolutionLog"][number] = {
      id: targetResolutionId,
      frame: event.frame,
      timeSeconds,
      cycle,
      sourceActorId: actorId,
      sourceActionId: action.id,
      actionName: action.name,
      hitId,
      hitLabel: hit.label ?? "命中",
      element,
      targetId,
      outcome: targetOutcome,
      landed,
      reason: hit.targeting?.reason ?? null,
      damageAllowed,
      auraAllowed,
      hitConfirmAllowed,
      damageEventId: null,
      potentialDamage: 0,
      finalDamage: 0,
      displayDamage: 0,
      ...(action.timelineCommandIndex === undefined
        ? {}
        : { timelineCommandIndex: action.timelineCommandIndex }),
      ...(action.sourceAbilityId === undefined
        ? {}
        : { sourceAbilityId: action.sourceAbilityId })
    };
    hitResolutionLog.push(targetResolution);
    if (!targetResolution.landed) {
      processHitConfirmedParticles({
        actorId,
        action,
        hitId,
        cycle,
        frame: event.frame,
        timeSeconds,
        landed: false,
        hitConfirmAllowed: false
      });
      continue;
    }

    const stats =
      hit.snapshot === "action"
        ? deepClone(
            snapshots[scalingOwnerId] ??
              computeStats(scalingOwnerId, timeSeconds)
          )
        : computeStats(scalingOwnerId, timeSeconds);
    if (!stats) continue;

    const scalingStat = hit.scalingStat ?? "atk";
    const scalingValue = calcTotalStat(stats, scalingStat);
    let flatDamage = safeNumber(hit.flat);
    const flatDetails: DamageEvent["flatDetails"] = [];
    for (const source of hit.flatSources ?? []) {
      const sourceId = source.ownerId ?? scalingOwnerId;
      const sourceStats =
        hit.snapshot === "action"
          ? deepClone(
              snapshots[sourceId] ?? computeStats(sourceId, timeSeconds)
            )
          : computeStats(sourceId, timeSeconds);
      if (!sourceStats) continue;
      const sourceStat = source.stat ?? "atk";
      const sourceValue = calcTotalStat(sourceStats, sourceStat);
      const amount = sourceValue * source.multiplier;
      flatDamage += amount;
      flatDetails.push({
        ownerId: sourceId,
        stat: sourceStat,
        multiplier: source.multiplier,
        sourceValue,
        amount
      });
    }

    const debuffState = getDebuffState(timeSeconds, element);
    const effectiveResistance =
      config.enemy.resistance -
      debuffState.resShred -
      safeNumber(hit.resShred);
    const effectiveDefenseReduction = clamp(
      debuffState.defReduction + safeNumber(hit.defReduction),
      -1,
      0.9
    );
    const activeStatuses: ActiveStatusSnapshot[] = [
      ...activeBuffs
        .filter((buff) => buff.targetId === scalingOwnerId)
        .map((buff) => ({
          key: buff.key,
          kind: "buff" as const,
          sourceActorId: buff.actorId,
          targetId: buff.targetId,
          stat: buff.stat,
          value: buff.value,
          startTimeSeconds: buff.start,
          endTimeSeconds: buff.end,
          label: buff.label
        })),
      ...debuffState.relevantDebuffs.map((debuff) => ({
        key: debuff.key,
        kind: "debuff" as const,
        sourceActorId: debuff.actorId,
        element: debuff.element,
        resShred: debuff.resShred,
        defReduction: debuff.defReduction,
        startTimeSeconds: debuff.start,
        endTimeSeconds: debuff.end,
        label: debuff.label
      }))
    ];
    const enemyStateBeforeHit = {
      level: config.enemy.level,
      baseResistance: config.enemy.resistance,
      resistanceShred: debuffState.resShred + safeNumber(hit.resShred),
      effectiveResistance,
      baseDefenseReduction: config.enemy.defReduction,
      effectiveDefenseReduction
    };
    const manualReaction = auraAllowed ? (hit.reaction ?? "none") : "none";
    const reactionAudit: ReactionAudit =
      auraEngine === null
        ? {
            model:
              manualReaction === "none" ? "none" : "manual-override",
            triggered: manualReaction !== "none",
            reaction: manualReaction,
            icdAllowed: null,
            icdTag: null,
            icdGroup: null,
            applicationGaugeUnits: null,
            auraBefore: null,
            auraApplied: null,
            auraConsumed: null,
            auraAfter: null,
            note:
              !auraAllowed
                ? "目标效果策略阻止了本段附着与手工反应标签。"
                : manualReaction === "none"
                ? "兼容模式未运行 Aura/ICD 引擎。"
                : "反应由命中配置手工指定；未运行 Aura/ICD 合法性判断。"
          }
        : auraAllowed
          ? auraEngine.processHit({
              frame: event.frame,
              sourceActorId: actorId,
              element,
              ...(hit.application === undefined
                ? {}
                : { application: hit.application }),
              ...(hit.reactionOverride === undefined
                ? {}
                : { reactionOverride: hit.reactionOverride })
            })
          : {
              ...auraEngine.processHit({
                frame: event.frame,
                sourceActorId: actorId,
                element
              }),
              note:
                "目标效果策略阻止了本段元素附着与反应；Aura 仅按当前帧衰减。"
            };
    const reaction = reactionAudit.reaction;
    let damageInput: DamageCalculationInput = {
      scaling: hit.scaling,
      scalingStat,
      scalingValue,
      flatDamage,
      damageBonus: stats.dmgBonus + safeNumber(hit.dmgBonus),
      characterLevel: scalingOwner.level,
      enemyLevel: config.enemy.level,
      defenseReduction: effectiveDefenseReduction,
      defenseIgnore: stats.defIgnore + safeNumber(hit.defIgnore),
      effectiveResistance,
      critRate: stats.critRate + safeNumber(hit.critRate),
      critDamage: stats.critDmg + safeNumber(hit.critDmg),
      critMode: options.critMode,
      reaction,
      elementalMastery: stats.em,
      reactionBonus:
        stats.reactionBonus + safeNumber(hit.reactionBonus),
      ...(hit.ampBase === undefined
        ? {}
        : { explicitReactionBase: hit.ampBase }),
      groupMultiplier: safeNumber(hit.groupMultiplier, 1)
    };
    for (const plugin of plugins) {
      damageInput = applyPluginChanges(
        damageInput,
        plugin.modifyDamage({
          config,
          action,
          hit,
          cycle,
          timeSeconds,
          sourceActor,
          scalingOwner,
          creditOwner,
          statsBeforeDamage: stats,
          enemyStateBeforeHit,
          damageInput
        })
      );
    }

    const calculation = calcDamage(damageInput);
    const factors = calculation.factors;
    const buffLabels = activeStatuses
      .filter((status) => status.kind === "buff")
      .map((status) => status.label);
    const debuffLabels = activeStatuses
      .filter((status) => status.kind === "debuff")
      .map((status) => status.label);
    const snapshot = hit.snapshot ?? "hit";
    const damageEventId = damageEvents.length;
    const targetDamageMultiplier = damageAllowed ? 1 : 0;
    const finalDamage =
      calculation.finalDamage * targetDamageMultiplier;
    const displayDamage = Math.round(finalDamage);
    damageEvents.push({
      id: damageEventId,
      sourceActorId: actorId,
      scalingOwnerId,
      creditOwnerId,
      actionId: action.id,
      hitId,
      targetResolutionId,
      targetId,
      targetDamagePolicy: damageAllowed ? "normal" : "immune",
      targetDamageMultiplier,
      potentialDamage: calculation.finalDamage,
      frame: event.frame,
      timeSeconds,
      activeCharacterId,
      statsBeforeDamage: deepClone(stats),
      activeStatuses,
      enemyStateBeforeHit,
      reactionAudit,
      damageFactors: factors,
      finalDamage,
      displayDamage,
      sourceActorName: sourceActor.name,
      scalingOwnerName: scalingOwner.name,
      creditOwnerName: creditOwner.name,
      actionName: action.name,
      hitLabel: hit.label ?? "命中",
      element,
      reaction,
      snapshot,
      cycle,
      flatDetails,
      ...(action.timelineCommandIndex === undefined
        ? {}
        : { timelineCommandIndex: action.timelineCommandIndex }),
      ...(action.sourceAbilityId === undefined
        ? {}
        : { sourceAbilityId: action.sourceAbilityId }),
      ...(action.startFrame === undefined
        ? {}
        : { actionStartFrame: action.startFrame }),
      ...(action.cancelFrame === undefined
        ? {}
        : { actionCancelFrame: action.cancelFrame }),
      ...(action.animationEndFrame === undefined
        ? {}
        : { actionAnimationEndFrame: action.animationEndFrame }),
      time: timeSeconds,
      second: Math.floor(timeSeconds),
      actorId,
      creditId: creditOwnerId,
      actorName: creditOwner.name,
      activeId: activeCharacterId,
      scaling: factors.scaling,
      scalingStat: factors.scalingStat,
      scalingValue: factors.scalingValue,
      flat: factors.flatDamage,
      baseDamage: factors.baseDamage,
      dmgBonus: factors.damageBonus,
      bonusFactor: factors.damageBonusMultiplier,
      defIgnore: factors.defenseIgnore,
      defReduction: factors.defenseReduction,
      defenseFactor: factors.defenseMultiplier,
      effectiveRes: factors.effectiveResistance,
      resFactor: factors.resistanceMultiplier,
      critRate: factors.critRate,
      critDmg: factors.critDamage,
      critFactor: factors.critMultiplier,
      em: damageInput.elementalMastery,
      reactionBase: factors.reactionBase,
      emBonus: factors.elementalMasteryBonus,
      reactionBonus: factors.reactionBonus,
      reactionFactor: factors.amplifyingReactionMultiplier,
      groupMultiplier: factors.groupMultiplier,
      buffs: buffLabels,
      debuffs: debuffLabels
    });
    targetResolution.damageEventId = damageEventId;
    targetResolution.potentialDamage = calculation.finalDamage;
    targetResolution.finalDamage = finalDamage;
    targetResolution.displayDamage = displayDamage;
    processHitConfirmedParticles({
      actorId,
      action,
      hitId,
      cycle,
      frame: event.frame,
      timeSeconds,
      landed: true,
      hitConfirmAllowed
    });
  }

  for (const character of config.characters) {
    const summary = energyStats.get(character.id);
    if (summary) summary.final = energies.get(character.id) ?? 0;
  }

  const totalDamage = damageEvents.reduce(
    (sum, event) => sum + event.finalDamage,
    0
  );
  const byCharacter: Record<string, number> = {};
  const bySkill = new Map<
    string,
    Omit<SimulationResult["bySkill"][number], "dps" | "share">
  >();
  const hitCountByCharacter: Record<string, number> = {};
  const perSecond: SimulationResult["perSecond"] = Array.from(
    { length: Math.ceil(config.duration) },
    () => ({})
  );
  for (const event of damageEvents) {
    byCharacter[event.creditOwnerId] =
      (byCharacter[event.creditOwnerId] ?? 0) + event.finalDamage;
    hitCountByCharacter[event.creditOwnerId] =
      (hitCountByCharacter[event.creditOwnerId] ?? 0) + 1;
    const skillKey = `${event.creditOwnerId}::${event.actionName}`;
    const skill = bySkill.get(skillKey) ?? {
      creditId: event.creditOwnerId,
      actionName: event.actionName,
      damage: 0,
      hits: 0
    };
    skill.damage += event.finalDamage;
    skill.hits += 1;
    bySkill.set(skillKey, skill);
    const bucket = perSecond[event.second];
    if (bucket) {
      bucket[event.creditOwnerId] =
        (bucket[event.creditOwnerId] ?? 0) + event.finalDamage;
    }
  }
  const characterSummaries = config.characters
    .map((character) => {
      const damage = byCharacter[character.id] ?? 0;
      return {
        characterId: character.id,
        damage,
        hits: hitCountByCharacter[character.id] ?? 0,
        dps: damage / config.duration,
        share: totalDamage ? damage / totalDamage : 0
      };
    })
    .sort((left, right) => right.damage - left.damage);
  const skillSummaries = [...bySkill.values()]
    .map((skill) => ({
      ...skill,
      dps: skill.damage / config.duration,
      share: totalDamage ? skill.damage / totalDamage : 0
    }))
    .sort((left, right) => right.damage - left.damage);
  let cumulativeDamage = 0;
  const cumulativeByCharacter: Record<string, number> = {};
  const damageCurve = damageEvents.map((event) => {
    cumulativeDamage += event.finalDamage;
    cumulativeByCharacter[event.creditOwnerId] =
      (cumulativeByCharacter[event.creditOwnerId] ?? 0) + event.finalDamage;
    return {
      damageEventId: event.id,
      frame: event.frame,
      timeSeconds: event.timeSeconds,
      sourceActorId: event.sourceActorId,
      creditOwnerId: event.creditOwnerId,
      finalDamage: event.finalDamage,
      cumulativeDamage,
      cumulativeByCharacter: { ...cumulativeByCharacter }
    };
  });
  const auraTimeline: SimulationResult["auraTimeline"] = damageEvents.flatMap(
    (event) => {
      const audit = event.reactionAudit;
      if (
        audit.auraBefore === null ||
        audit.auraApplied === null ||
        audit.auraConsumed === null ||
        audit.auraAfter === null
      ) {
        return [];
      }
      return [
        {
          damageEventId: event.id,
          frame: event.frame,
          timeSeconds: event.timeSeconds,
          sourceActorId: event.sourceActorId,
          actionId: event.actionId,
          hitId: event.hitId,
          incomingElement: event.element,
          icdAllowed: audit.icdAllowed,
          reaction: event.reaction,
          auraBefore: audit.auraBefore,
          auraApplied: audit.auraApplied,
          auraConsumed: audit.auraConsumed,
          auraAfter: audit.auraAfter
        }
      ];
    }
  );

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    engineVersion: config.engineVersion,
    dataVersion: config.dataVersion,
    randomSeed: options.randomSeed,
    reproducibilityKey: makeReproducibilityKey(
      resultConfig,
      options,
      plugins
    ),
    compatibilityMode: options.compatibilityMode,
    config: resultConfig,
    damageEvents,
    hitEvents: damageEvents,
    hitResolutionLog,
    skippedActions,
    actionLog,
    energyStats: Object.fromEntries(energyStats),
    energyLog,
    particleEvents,
    particleTriggerLog,
    energyCurve,
    totalDamage,
    dps: totalDamage / config.duration,
    reactedHits: damageEvents.filter((event) => event.reaction !== "none").length,
    byCharacter,
    characterSummaries,
    bySkill: skillSummaries,
    perSecond,
    damageCurve,
    auraTimeline,
    ...(timelineExecution === undefined ? {} : { timelineExecution })
  };
}

function simulateLegalTimeline(
  config: SimConfig,
  runtimeOptions: SimulationRuntimeOptions
): SimulationResult {
  const timeline = config.timeline;
  if (!timeline) {
    throw new Error("simulateLegalTimeline requires config.timeline");
  }

  const runtimeEnergyFailures = new Map<number, RuntimeEnergyFailure>();
  const skippedByCommand = new Map<
    number,
    SimulationResult["skippedActions"][number]
  >();
  const abilities = new Map(
    timeline.abilities.map((ability) => [ability.id, ability])
  );
  const legalRuntimeOptions: SimulationRuntimeOptions = {
    ...runtimeOptions,
    compatibilityMode: "legal-frame-v1"
  };

  for (
    let commandIndex = 0;
    commandIndex < timeline.commands.length;
    commandIndex += 1
  ) {
    const command = timeline.commands[commandIndex];
    if (
      command === undefined ||
      command.type === "wait" ||
      !("abilityId" in command)
    ) {
      continue;
    }
    const ability = abilities.get(command.abilityId);
    if (!ability || (ability.energyCost ?? 0) <= 0) continue;

    const prefix = compileLegalTimeline(config, {
      runtimeEnergyFailures,
      stopAfterCommandIndex: commandIndex
    });
    const probe = simulateConfig(
      prefix.config,
      legalRuntimeOptions,
      config,
      prefix.execution
    );
    const skipped = probe.skippedActions.find(
      (entry) => entry.timelineCommandIndex === commandIndex
    );
    if (!skipped) continue;

    runtimeEnergyFailures.set(commandIndex, {
      commandIndex,
      energyBefore: skipped.energyBefore,
      energyCost: skipped.energyCost
    });
    skippedByCommand.set(commandIndex, skipped);
  }

  const compiled = compileLegalTimeline(config, {
    runtimeEnergyFailures
  });
  const result = simulateConfig(
    compiled.config,
    legalRuntimeOptions,
    config,
    compiled.execution
  );
  for (const skipped of skippedByCommand.values()) {
    result.skippedActions.push(skipped);
    const summary = result.energyStats[skipped.actorId];
    if (summary) summary.skipped += 1;
  }
  result.skippedActions.sort(
    (left, right) =>
      left.frame - right.frame ||
      (left.timelineCommandIndex ?? Number.MAX_SAFE_INTEGER) -
        (right.timelineCommandIndex ?? Number.MAX_SAFE_INTEGER) ||
      left.actionId.localeCompare(right.actionId)
  );
  return result;
}

export function simulate(
  rawConfig: unknown,
  runtimeOptions: SimulationRuntimeOptions = {}
): SimulationResult {
  const config = migrateConfig(rawConfig);
  if (!config.timeline) {
    return simulateConfig(config, runtimeOptions);
  }
  return simulateLegalTimeline(config, runtimeOptions);
}
