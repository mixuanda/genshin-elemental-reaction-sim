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
  type SimConfig,
  type SimulationEvent,
  type SimulationOptions,
  type SimulationResult,
  type TimelineExecution
} from "@genshin-dps-lab/schemas";
import {
  calcDamage,
  calcTotalStat,
  clamp,
  type DamageCalculationInput
} from "./formulas";
import { MinHeap } from "./min-heap";
import type { DamageModifierPlugin } from "./plugins";
import { compileLegalTimeline } from "./legal-timeline";

export const EVENT_PRIORITY = {
  action: 0,
  buff: 1,
  debuff: 1,
  energy: 2,
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
  gain: NonNullable<ActionDefinition["energyGains"]>[number];
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
  "reactionBonus"
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
  const characters = new Map(
    config.characters.map((character) => [character.id, character])
  );
  const energies = new Map<string, number>();
  const energyStats = new Map<string, EnergySummary>();

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
  const skippedActions: SimulationResult["skippedActions"] = [];
  const actionLog: SimulationResult["actionLog"] = [];
  let activeCharacterId =
    resultConfig.timeline?.initialActiveCharacterId ??
    config.characters[0]?.id ??
    null;

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
          cycle
        });
        const summary = energyStats.get(actor.id);
        if (summary) summary.skipped += 1;
        continue;
      }

      energies.set(actor.id, currentEnergy - energyCost);
      const energySummary = energyStats.get(actor.id);
      if (energySummary) energySummary.spent += energyCost;
      actionLog.push({
        time: timeSeconds,
        frame: event.frame,
        actorId: actor.id,
        actionId: action.id,
        action: action.name,
        cycle,
        energyBefore: currentEnergy,
        energyAfter: currentEnergy - energyCost,
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
          gain
        });
      }
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
      const { actorId, gain } = event.payload as EnergyEventPayload;
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
        const after = clamp(before + gain.amount, 0, character.energyMax);
        energies.set(targetId, after);
        const summary = energyStats.get(targetId);
        if (summary) summary.gained += after - before;
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

    const element = hit.element ?? scalingOwner.element;
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
      reaction: hit.reaction ?? "none",
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
    const reaction = hit.reaction ?? "none";
    const snapshot = hit.snapshot ?? "hit";
    const hitId = hit.id ?? `${action.id}:hit-${hitIndex}`;

    damageEvents.push({
      id: damageEvents.length,
      sourceActorId: actorId,
      scalingOwnerId,
      creditOwnerId,
      actionId: action.id,
      hitId,
      frame: event.frame,
      timeSeconds,
      activeCharacterId,
      statsBeforeDamage: deepClone(stats),
      activeStatuses,
      enemyStateBeforeHit,
      reactionAudit: {
        model: reaction === "none" ? "none" : "manual-override",
        triggered: reaction !== "none",
        reaction,
        icdAllowed: null,
        applicationGaugeUnits: null,
        auraBefore: null,
        auraAfter: null,
        note:
          reaction === "none"
            ? "兼容模式未运行 Aura/ICD 引擎。"
            : "反应由命中配置手工指定；未运行 Aura/ICD 合法性判断。"
      },
      damageFactors: factors,
      finalDamage: calculation.finalDamage,
      displayDamage: Math.round(calculation.finalDamage),
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
    skippedActions,
    actionLog,
    energyStats: Object.fromEntries(energyStats),
    totalDamage,
    dps: totalDamage / config.duration,
    reactedHits: damageEvents.filter((event) => event.reaction !== "none").length,
    byCharacter,
    characterSummaries,
    bySkill: skillSummaries,
    perSecond,
    damageCurve,
    ...(timelineExecution === undefined ? {} : { timelineExecution })
  };
}

export function simulate(
  rawConfig: unknown,
  runtimeOptions: SimulationRuntimeOptions = {}
): SimulationResult {
  const config = migrateConfig(rawConfig);
  if (!config.timeline) {
    return simulateConfig(config, runtimeOptions);
  }
  const compiled = compileLegalTimeline(config);
  return simulateConfig(
    compiled.config,
    {
      ...runtimeOptions,
      compatibilityMode: "legal-frame-v1"
    },
    config,
    compiled.execution
  );
}
