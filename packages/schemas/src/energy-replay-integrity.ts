import type { RefinementCtx } from "zod";
import type {
  AbilityDefinition,
  ActionDefinition,
  BuffDefinition,
  EnergyEvent,
  FrameBuffDefinition,
  FrameEnergyEvent,
  FrameParticleDefinition,
  ParticleCount,
  ParticleDefinition,
  SimulationResult,
  StatusTarget
} from "./types";

type IssuePath = Array<string | number>;

const FLOAT_TOLERANCE = 1e-9;
const ENERGY_COMPARISON_EPSILON = 1e-9;
const ENERGY_DECIMAL_PLACES = 12;

interface NormalizedBuff {
  key?: string;
  target?: StatusTarget;
  stat: BuffDefinition["stat"];
  value: number;
  offset: number;
  duration: number;
}

interface NormalizedEnergyGain {
  target?: EnergyEvent["target"];
  amount: number;
  offset: number;
  source?: string;
  internalCooldown?: {
    key: string;
    duration: number;
  };
}

interface NormalizedParticle {
  index: number;
  id?: string;
  source?: string;
  kind: NonNullable<ParticleDefinition["kind"]>;
  element: ParticleDefinition["element"];
  count: ParticleCount;
  spawnOffset: number;
  travelTime: number;
  trigger?: {
    kind: "hit-confirm";
    hitIds: string[];
    internalCooldown?: {
      key: string;
      duration: number;
    };
  };
}

interface ExpectedActionAttempt {
  ordinal: number;
  scheduleOrder: number;
  actorId: string;
  actionId: string;
  actionName: string;
  cycle: number;
  frame: number;
  timeSeconds: number;
  energyCost: number;
  buffs: NormalizedBuff[];
  energyGains: NormalizedEnergyGain[];
  particles: NormalizedParticle[];
  timelineCommandIndex?: number;
  sourceAbilityId?: string;
  cancelFrame?: number;
  animationEndFrame?: number;
  legalProbeSkip: boolean;
  requiredOutput: "action" | "skip" | "either";
  actionLogIndex: number | null;
  skippedActionIndex: number | null;
}

interface ExpectedBuffEvent {
  frame: number;
  timeSeconds: number;
  creationFrame: number;
  creationTimeSeconds: number;
  creationOrder: number;
  actorId: string;
  buffOrder: number;
  buff: NormalizedBuff;
}

interface ExpectedFixedEnergyGroup {
  kind: "fixed";
  energyLogStartIndex: number | null;
  frame: number;
  timeSeconds: number;
  creationFrame: number;
  creationTimeSeconds: number;
  creationOrder: number;
  gainOrder: number;
  actorId: string;
  actionId: string;
  source: string;
  targets: string[];
  gain: NormalizedEnergyGain;
}

interface ExpectedParticleSpawn {
  particle: NormalizedParticle;
  actorId: string;
  actionId: string;
  actionName: string;
  cycle: number;
  spawnFrame: number;
  spawnTimeSeconds: number;
  particleId: string;
  source: string;
  triggerLogId: number | null;
  triggerHitId: string | null;
}

interface ExpectedParticleEnergyGroup {
  kind: "particle";
  energyLogStartIndex: number | null;
  frame: number;
  timeSeconds: number;
  creationFrame: number;
  creationTimeSeconds: number;
  creationOrder: number;
  particleEventIndex: number;
  particleCount: number;
  spawn: ExpectedParticleSpawn;
}

type ExpectedEnergyGroup =
  | ExpectedFixedEnergyGroup
  | ExpectedParticleEnergyGroup;

interface ActiveEnergyRechargeBuff {
  key: string;
  targetId: string;
  stat: BuffDefinition["stat"];
  value: number;
  endTimeSeconds: number;
}

interface ReplayStats {
  initial: number;
  gained: number;
  fixedGained: number;
  particleGained: number;
  wasted: number;
  spent: number;
  skipped: number;
  final: number;
}

interface ReplayOperationAction {
  kind: "action";
  priority: 0;
  frame: number;
  timeSeconds: number;
  order: number;
  attempt: ExpectedActionAttempt;
}

interface ReplayOperationBuff {
  kind: "buff";
  priority: 1;
  frame: number;
  timeSeconds: number;
  order: number;
  event: ExpectedBuffEvent;
}

interface ReplayOperationEnergy {
  kind: "energy";
  priority: 2;
  frame: number;
  timeSeconds: number;
  order: number;
  group: ExpectedEnergyGroup;
}

type ReplayOperation =
  | ReplayOperationAction
  | ReplayOperationBuff
  | ReplayOperationEnergy;

function addIssue(
  context: RefinementCtx,
  path: IssuePath,
  message: string
): void {
  context.addIssue({
    code: "custom",
    path,
    message
  });
}

function nearlyEqual(left: number, right: number): boolean {
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return Object.is(left, right);
  }
  return (
    Math.abs(left - right) <=
    FLOAT_TOLERANCE *
      Math.max(1, Math.abs(left), Math.abs(right))
  );
}

function expectEqual(
  context: RefinementCtx,
  path: IssuePath,
  actual: unknown,
  expected: unknown,
  label: string
): void {
  if (actual !== expected) {
    addIssue(
      context,
      path,
      `${label} must equal ${String(expected)}; received ${String(actual)}`
    );
  }
}

function expectNearlyEqual(
  context: RefinementCtx,
  path: IssuePath,
  actual: number,
  expected: number,
  label: string
): void {
  if (!nearlyEqual(actual, expected)) {
    addIssue(
      context,
      path,
      `${label} must equal ${expected}; received ${actual}`
    );
  }
}

function expectOptionalEqual(
  context: RefinementCtx,
  path: IssuePath,
  actual: unknown,
  expected: unknown,
  label: string
): void {
  if (actual !== expected) {
    addIssue(
      context,
      path,
      `${label} must equal ${String(expected)}; received ${String(actual)}`
    );
  }
}

function quantizeEnergy(value: number): number {
  return Number(value.toFixed(ENERGY_DECIMAL_PLACES));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function toFrame(timeSeconds: number): number {
  return Math.round(timeSeconds * 60);
}

function processedTime(
  result: SimulationResult,
  requestedTimeSeconds: number
): { frame: number; timeSeconds: number } {
  const frame = toFrame(requestedTimeSeconds);
  return {
    frame,
    timeSeconds:
      result.compatibilityMode === "legal-frame-v1"
        ? frame / 60
        : requestedTimeSeconds
  };
}

function primaryOrder(
  result: SimulationResult,
  leftFrame: number,
  leftTime: number,
  rightFrame: number,
  rightTime: number
): number {
  return result.compatibilityMode === "legal-frame-v1"
    ? leftFrame - rightFrame
    : leftTime - rightTime;
}

function finiteNonNegative(
  context: RefinementCtx,
  path: IssuePath,
  value: number,
  label: string
): boolean {
  if (!Number.isFinite(value) || value < 0) {
    addIssue(
      context,
      path,
      `${label} must be a finite non-negative number; received ${String(value)}`
    );
    return false;
  }
  return true;
}

function validateStateEnergy(
  context: RefinementCtx,
  path: IssuePath,
  value: number,
  energyMax: number,
  label: string
): void {
  if (!finiteNonNegative(context, path, value, label)) return;
  if (value > energyMax + FLOAT_TOLERANCE) {
    addIssue(
      context,
      path,
      `${label} cannot exceed energyMax ${energyMax}; received ${value}`
    );
  }
}

function actionOccurrenceKey(input: {
  actorId: string;
  actionId: string;
  cycle: number;
  frame: number;
  timeSeconds: number;
}): string {
  return JSON.stringify([
    input.actorId,
    input.actionId,
    input.cycle,
    input.frame,
    input.timeSeconds
  ]);
}

function normalizedLegacyBuff(buff: BuffDefinition): NormalizedBuff {
  return {
    ...(buff.key === undefined ? {} : { key: buff.key }),
    ...(buff.target === undefined ? {} : { target: buff.target }),
    stat: buff.stat,
    value: buff.value,
    offset: buff.offset ?? 0,
    duration: buff.duration
  };
}

function normalizedFrameBuff(
  buff: FrameBuffDefinition
): NormalizedBuff {
  return {
    ...(buff.key === undefined ? {} : { key: buff.key }),
    ...(buff.target === undefined ? {} : { target: buff.target }),
    stat: buff.stat,
    value: buff.value,
    offset: (buff.startFrame ?? 0) / 60,
    duration: buff.durationFrames / 60
  };
}

function normalizedLegacyGain(
  gain: EnergyEvent
): NormalizedEnergyGain {
  return {
    ...(gain.target === undefined ? {} : { target: gain.target }),
    amount: gain.amount,
    offset: gain.offset ?? 0,
    ...(gain.source === undefined ? {} : { source: gain.source }),
    ...(gain.internalCooldown === undefined
      ? {}
      : {
          internalCooldown: {
            key: gain.internalCooldown.key,
            duration: gain.internalCooldown.duration
          }
        })
  };
}

function normalizedFrameGain(
  gain: FrameEnergyEvent
): NormalizedEnergyGain {
  return {
    ...(gain.target === undefined ? {} : { target: gain.target }),
    amount: gain.amount,
    offset: (gain.frame ?? 0) / 60,
    ...(gain.source === undefined ? {} : { source: gain.source }),
    ...(gain.internalCooldown === undefined
      ? {}
      : {
          internalCooldown: {
            key: gain.internalCooldown.key,
            duration:
              gain.internalCooldown.durationFrames / 60
          }
        })
  };
}

function normalizedLegacyParticle(
  particle: ParticleDefinition,
  index: number
): NormalizedParticle {
  return {
    index,
    ...(particle.id === undefined ? {} : { id: particle.id }),
    ...(particle.source === undefined
      ? {}
      : { source: particle.source }),
    kind: particle.kind ?? "particle",
    element: particle.element,
    count: particle.count,
    spawnOffset: particle.spawnOffset ?? 0,
    travelTime: particle.travelTime,
    ...(particle.trigger === undefined
      ? {}
      : {
          trigger: {
            kind: particle.trigger.kind,
            hitIds: [...particle.trigger.hitIds],
            ...(particle.trigger.internalCooldown === undefined
              ? {}
              : {
                  internalCooldown: {
                    key: particle.trigger.internalCooldown.key,
                    duration:
                      particle.trigger.internalCooldown.duration
                  }
                })
          }
        })
  };
}

function normalizedFrameParticle(
  particle: FrameParticleDefinition,
  index: number
): NormalizedParticle {
  return {
    index,
    ...(particle.id === undefined ? {} : { id: particle.id }),
    ...(particle.source === undefined
      ? {}
      : { source: particle.source }),
    kind: particle.kind ?? "particle",
    element: particle.element,
    count: particle.count,
    spawnOffset: (particle.spawnFrame ?? 0) / 60,
    travelTime: particle.travelFrames / 60,
    ...(particle.trigger === undefined
      ? {}
      : {
          trigger: {
            kind: particle.trigger.kind,
            hitIds: [...particle.trigger.hitIds],
            ...(particle.trigger.internalCooldown === undefined
              ? {}
              : {
                  internalCooldown: {
                    key: particle.trigger.internalCooldown.key,
                    duration:
                      particle.trigger.internalCooldown.durationFrames /
                      60
                  }
                })
          }
        })
  };
}

function appendLegacyAttempt(
  result: SimulationResult,
  attempts: ExpectedActionAttempt[],
  action: ActionDefinition,
  cycle: number,
  scheduleOrder: number
): void {
  const requestedTime =
    cycle * result.config.cycleLength + action.at;
  const processed = processedTime(result, requestedTime);
  attempts.push({
    ordinal: attempts.length,
    scheduleOrder,
    actorId: action.actorId,
    actionId: action.id,
    actionName: action.name,
    cycle,
    frame: processed.frame,
    timeSeconds: processed.timeSeconds,
    energyCost: Math.max(
      0,
      Number.isFinite(action.energyCost)
        ? (action.energyCost as number)
        : 0
    ),
    buffs: (action.buffs ?? []).map(normalizedLegacyBuff),
    energyGains: (action.energyGains ?? []).map(
      normalizedLegacyGain
    ),
    particles: (action.particles ?? []).map(
      normalizedLegacyParticle
    ),
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
      : { animationEndFrame: action.animationEndFrame }),
    legalProbeSkip: false,
    requiredOutput: "either",
    actionLogIndex: null,
    skippedActionIndex: null
  });
}

function legalAbilityAttempt(
  result: SimulationResult,
  ability: AbilityDefinition,
  commandIndex: number,
  startFrame: number,
  scheduleOrder: number,
  requiredOutput: "action" | "skip"
): ExpectedActionAttempt | null {
  const processed = processedTime(result, startFrame / 60);
  if (processed.timeSeconds > result.config.duration) {
    return null;
  }
  const commandResult =
    result.timelineExecution?.commandResults[commandIndex];
  return {
    ordinal: -1,
    scheduleOrder,
    actorId: ability.actorId,
    actionId: `${ability.id}#${commandIndex}`,
    actionName: ability.name,
    cycle: 0,
    frame: processed.frame,
    timeSeconds: processed.timeSeconds,
    energyCost: Math.max(
      0,
      Number.isFinite(ability.energyCost)
        ? (ability.energyCost as number)
        : 0
    ),
    buffs: (ability.buffs ?? []).map(normalizedFrameBuff),
    energyGains: (ability.energyGains ?? []).map(
      normalizedFrameGain
    ),
    particles: (ability.particles ?? []).map(
      normalizedFrameParticle
    ),
    timelineCommandIndex: commandIndex,
    sourceAbilityId: ability.id,
    ...(commandResult?.cancelFrame === null ||
    commandResult?.cancelFrame === undefined
      ? {}
      : { cancelFrame: commandResult.cancelFrame }),
    ...(commandResult?.animationEndFrame === null ||
    commandResult?.animationEndFrame === undefined
      ? {}
      : {
          animationEndFrame: commandResult.animationEndFrame
        }),
    legalProbeSkip: requiredOutput === "skip",
    requiredOutput,
    actionLogIndex: null,
    skippedActionIndex: null
  };
}

function appendSyntheticLegalAttempt(
  result: SimulationResult,
  attempts: ExpectedActionAttempt[],
  input: {
    scheduleOrder: number;
    actorId: string;
    actionId: string;
    actionName: string;
    frame: number;
    timelineCommandIndex?: number;
    cancelFrame: number;
    animationEndFrame: number;
  }
): void {
  const processed = processedTime(result, input.frame / 60);
  if (processed.timeSeconds > result.config.duration) {
    return;
  }
  attempts.push({
    ordinal: attempts.length,
    scheduleOrder: input.scheduleOrder,
    actorId: input.actorId,
    actionId: input.actionId,
    actionName: input.actionName,
    cycle: 0,
    frame: processed.frame,
    timeSeconds: processed.timeSeconds,
    energyCost: 0,
    buffs: [],
    energyGains: [],
    particles: [],
    ...(input.timelineCommandIndex === undefined
      ? {}
      : { timelineCommandIndex: input.timelineCommandIndex }),
    cancelFrame: input.cancelFrame,
    animationEndFrame: input.animationEndFrame,
    legalProbeSkip: false,
    requiredOutput: "action",
    actionLogIndex: null,
    skippedActionIndex: null
  });
}

function buildExpectedActionAttempts(
  result: SimulationResult,
  context: RefinementCtx
): ExpectedActionAttempt[] {
  const attempts: ExpectedActionAttempt[] = [];
  const timeline = result.config.timeline;
  if (timeline === undefined) {
    const cycleCount = Math.ceil(
      result.config.duration / result.config.cycleLength
    );
    let scheduleOrder = 0;
    for (let cycle = 0; cycle < cycleCount; cycle += 1) {
      for (const action of result.config.rotation) {
        const currentScheduleOrder = scheduleOrder++;
        if (action.once && cycle > 0) continue;
        if (action.cycles?.includes(cycle) === false) continue;
        if (
          action.everyNCycles !== undefined &&
          cycle % action.everyNCycles !==
            (action.cycleRemainder ?? 0)
        ) {
          continue;
        }
        const timeSeconds =
          cycle * result.config.cycleLength + action.at;
        if (timeSeconds > result.config.duration) continue;
        if (
          processedTime(result, timeSeconds).timeSeconds >
          result.config.duration + FLOAT_TOLERANCE
        ) {
          continue;
        }
        appendLegacyAttempt(
          result,
          attempts,
          action,
          cycle,
          currentScheduleOrder
        );
      }
    }
  } else {
    const execution = result.timelineExecution;
    if (execution === undefined) {
      addIssue(
        context,
        ["timelineExecution"],
        "legal timeline energy replay requires timelineExecution"
      );
      return attempts;
    }
    let scheduleOrder = 0;
    if (
      result.config.characters[0]?.id !==
      timeline.initialActiveCharacterId
    ) {
      appendSyntheticLegalAttempt(result, attempts, {
        scheduleOrder: scheduleOrder++,
        actorId: timeline.initialActiveCharacterId,
        actionId: "__timeline-initial-active",
        actionName: "设置初始前台",
        frame: 0,
        cancelFrame: 0,
        animationEndFrame: 0
      });
    }
    const abilitiesById = new Map(
      timeline.abilities.map((ability) => [ability.id, ability])
    );
    for (const commandResult of execution.commandResults) {
      const commandIndex = commandResult.commandIndex;
      const command = timeline.commands[commandIndex];
      if (command === undefined) {
        addIssue(
          context,
          ["timelineExecution", "commandResults", commandIndex],
          `references missing timeline command ${commandIndex}`
        );
        continue;
      }
      if (
        commandResult.status === "rejected" &&
        commandResult.failureCode !== "INSUFFICIENT_ENERGY"
      ) {
        continue;
      }
      if (
        command.type === "wait" ||
        command.type === "pickUpCrystallize"
      ) {
        continue;
      }
      if (
        commandResult.status === "rejected" &&
        commandResult.failureCode === "INSUFFICIENT_ENERGY"
      ) {
        if (!("abilityId" in command)) {
          addIssue(
            context,
            [
              "timelineExecution",
              "commandResults",
              commandIndex,
              "failureCode"
            ],
            "INSUFFICIENT_ENERGY is only valid for an ability command"
          );
          continue;
        }
        const ability = abilitiesById.get(command.abilityId);
        if (ability === undefined || commandResult.startFrame === null) {
          addIssue(
            context,
            ["timelineExecution", "commandResults", commandIndex],
            "energy-rejected command must resolve an ability and startFrame"
          );
          continue;
        }
        const attempt = legalAbilityAttempt(
          result,
          ability,
          commandIndex,
          commandResult.startFrame,
          scheduleOrder++,
          "skip"
        );
        if (attempt === null) continue;
        attempt.ordinal = attempts.length;
        attempts.push(attempt);
        continue;
      }
      if (
        commandResult.status !== "executed" &&
        commandResult.status !== "waited"
      ) {
        continue;
      }
      if (command.type === "swap") {
        if (commandResult.endFrame === null) {
          addIssue(
            context,
            ["timelineExecution", "commandResults", commandIndex],
            "executed swap must expose endFrame"
          );
          continue;
        }
        appendSyntheticLegalAttempt(result, attempts, {
          scheduleOrder: scheduleOrder++,
          actorId: command.characterId,
          actionId: `__swap#${commandIndex}`,
          actionName: `切换至 ${command.characterId}`,
          frame: commandResult.endFrame,
          timelineCommandIndex: commandIndex,
          cancelFrame: commandResult.endFrame,
          animationEndFrame: commandResult.endFrame
        });
        continue;
      }
      if (command.type === "dash" || command.type === "jump") {
        if (
          commandResult.startFrame === null ||
          commandResult.endFrame === null
        ) {
          addIssue(
            context,
            ["timelineExecution", "commandResults", commandIndex],
            "executed movement must expose startFrame and endFrame"
          );
          continue;
        }
        appendSyntheticLegalAttempt(result, attempts, {
          scheduleOrder: scheduleOrder++,
          actorId: command.actorId,
          actionId: `__${command.type}#${commandIndex}`,
          actionName: command.type === "dash" ? "冲刺" : "跳跃",
          frame: commandResult.startFrame,
          timelineCommandIndex: commandIndex,
          cancelFrame: commandResult.endFrame,
          animationEndFrame: commandResult.endFrame
        });
        continue;
      }
      if (!("abilityId" in command)) {
        addIssue(
          context,
          ["timelineExecution", "commandResults", commandIndex],
          "executed non-ability command was not resolved by energy replay"
        );
        continue;
      }
      const ability = abilitiesById.get(command.abilityId);
      if (ability === undefined || commandResult.startFrame === null) {
        addIssue(
          context,
          ["timelineExecution", "commandResults", commandIndex],
          "executed ability command must resolve an ability and startFrame"
        );
        continue;
      }
      const attempt = legalAbilityAttempt(
        result,
        ability,
        commandIndex,
        commandResult.startFrame,
        scheduleOrder++,
        "action"
      );
      if (attempt === null) continue;
      attempt.ordinal = attempts.length;
      attempts.push(attempt);
    }
  }

  attempts.sort(
    (left, right) =>
      primaryOrder(
        result,
        left.frame,
        left.timeSeconds,
        right.frame,
        right.timeSeconds
      ) || left.scheduleOrder - right.scheduleOrder
  );
  attempts.forEach((attempt, ordinal) => {
    attempt.ordinal = ordinal;
  });
  return attempts;
}

function indexRowsByOccurrence<
  T extends {
    actorId: string;
    actionId: string;
    cycle: number;
    frame: number;
    time: number;
  }
>(rows: T[]): Map<string, number[]> {
  const indicesByKey = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const key = actionOccurrenceKey({
      actorId: row.actorId,
      actionId: row.actionId,
      cycle: row.cycle,
      frame: row.frame,
      timeSeconds: row.time
    });
    const indices = indicesByKey.get(key) ?? [];
    indices.push(index);
    indicesByKey.set(key, indices);
  });
  return indicesByKey;
}

function takeUnusedIndex(
  indices: number[] | undefined,
  used: Set<number>
): number | null {
  if (indices === undefined) return null;
  for (const index of indices) {
    if (!used.has(index)) {
      used.add(index);
      return index;
    }
  }
  return null;
}

function bindActionOutputs(
  result: SimulationResult,
  context: RefinementCtx,
  attempts: ExpectedActionAttempt[]
): void {
  const actionIndices = indexRowsByOccurrence(result.actionLog);
  const skippedIndices = indexRowsByOccurrence(
    result.skippedActions
  );
  const usedActions = new Set<number>();
  const usedSkipped = new Set<number>();

  for (const attempt of attempts) {
    const key = actionOccurrenceKey(attempt);
    const actionIndex = takeUnusedIndex(
      actionIndices.get(key),
      usedActions
    );
    const skippedIndex = takeUnusedIndex(
      skippedIndices.get(key),
      usedSkipped
    );
    attempt.actionLogIndex = actionIndex;
    attempt.skippedActionIndex = skippedIndex;

    if (actionIndex !== null && skippedIndex !== null) {
      addIssue(
        context,
        ["actionLog", actionIndex],
        `action occurrence ${attempt.actionId} cycle ${attempt.cycle} cannot be both executed and skipped`
      );
      continue;
    }
    if (attempt.requiredOutput === "action" && actionIndex === null) {
      addIssue(
        context,
        ["actionLog"],
        `missing executed action occurrence ${attempt.actionId} cycle ${attempt.cycle} at frame ${attempt.frame}`
      );
    } else if (
      attempt.requiredOutput === "skip" &&
      skippedIndex === null
    ) {
      addIssue(
        context,
        ["skippedActions"],
        `missing energy-rejected action occurrence ${attempt.actionId} at frame ${attempt.frame}`
      );
    } else if (
      attempt.requiredOutput === "either" &&
      actionIndex === null &&
      skippedIndex === null
    ) {
      addIssue(
        context,
        ["actionLog"],
        `configured action occurrence ${attempt.actionId} cycle ${attempt.cycle} has neither actionLog nor skippedActions output`
      );
    }
  }

  result.actionLog.forEach((_row, index) => {
    if (!usedActions.has(index)) {
      addIssue(
        context,
        ["actionLog", index],
        "does not correspond to a configured action occurrence"
      );
    }
  });
  result.skippedActions.forEach((_row, index) => {
    if (!usedSkipped.has(index)) {
      addIssue(
        context,
        ["skippedActions", index],
        "does not correspond to a configured action occurrence"
      );
    }
  });
}

function validateTrustedEnergyDomains(
  result: SimulationResult,
  context: RefinementCtx
): {
  characterIds: Set<string>;
  energyMaxByCharacter: Map<string, number>;
} {
  const characterIds = new Set<string>();
  const energyMaxByCharacter = new Map<string, number>();
  result.config.characters.forEach((character, index) => {
    const path = ["config", "characters", index] satisfies IssuePath;
    if (characterIds.has(character.id)) {
      addIssue(
        context,
        [...path, "id"],
        `duplicate energy character id "${character.id}"`
      );
    }
    characterIds.add(character.id);
    finiteNonNegative(
      context,
      [...path, "energyMax"],
      character.energyMax,
      "energyMax"
    );
    energyMaxByCharacter.set(character.id, character.energyMax);
    validateStateEnergy(
      context,
      [...path, "initialEnergy"],
      character.initialEnergy,
      character.energyMax,
      "configured initial energy"
    );
    finiteNonNegative(
      context,
      [...path, "stats", "energyRecharge"],
      character.stats.energyRecharge,
      "base Energy Recharge"
    );
  });

  const validateActor = (
    path: IssuePath,
    actorId: string | null,
    nullable: boolean
  ): void => {
    if (actorId === null) {
      if (!nullable && characterIds.size > 0) {
        addIssue(context, path, "must reference a configured character");
      }
      return;
    }
    if (!characterIds.has(actorId)) {
      addIssue(
        context,
        path,
        `references ghost character "${actorId}"`
      );
    }
  };

  result.actionLog.forEach((entry, index) => {
    const path = ["actionLog", index] satisfies IssuePath;
    validateActor([...path, "actorId"], entry.actorId, false);
    const energyMax =
      energyMaxByCharacter.get(entry.actorId) ?? 0;
    validateStateEnergy(
      context,
      [...path, "energyBefore"],
      entry.energyBefore,
      energyMax,
      "action energyBefore"
    );
    validateStateEnergy(
      context,
      [...path, "energyAfter"],
      entry.energyAfter,
      energyMax,
      "action energyAfter"
    );
  });

  result.skippedActions.forEach((entry, index) => {
    const path = ["skippedActions", index] satisfies IssuePath;
    validateActor([...path, "actorId"], entry.actorId, false);
    const energyMax =
      energyMaxByCharacter.get(entry.actorId) ?? 0;
    validateStateEnergy(
      context,
      [...path, "energyBefore"],
      entry.energyBefore,
      energyMax,
      "skipped action energyBefore"
    );
    finiteNonNegative(
      context,
      [...path, "energyCost"],
      entry.energyCost,
      "skipped action energyCost"
    );
  });

  result.energyLog.forEach((entry, index) => {
    const path = ["energyLog", index] satisfies IssuePath;
    validateActor(
      [...path, "sourceActorId"],
      entry.sourceActorId,
      false
    );
    validateActor(
      [...path, "receiverId"],
      entry.receiverId,
      false
    );
    validateActor(
      [...path, "activeCharacterId"],
      entry.activeCharacterId,
      true
    );
    const energyMax =
      energyMaxByCharacter.get(entry.receiverId) ?? 0;
    validateStateEnergy(
      context,
      [...path, "energyBefore"],
      entry.energyBefore,
      energyMax,
      "energy event energyBefore"
    );
    validateStateEnergy(
      context,
      [...path, "energyAfter"],
      entry.energyAfter,
      energyMax,
      "energy event energyAfter"
    );
    for (const field of [
      "rawEnergy",
      "finalEnergy",
      "gainedEnergy",
      "wastedEnergy",
      "energyRecharge",
      "fieldMultiplier"
    ] as const) {
      finiteNonNegative(
        context,
        [...path, field],
        entry[field],
        `energy event ${field}`
      );
    }
    if (entry.particleCount !== null) {
      finiteNonNegative(
        context,
        [...path, "particleCount"],
        entry.particleCount,
        "particle count"
      );
    }
    if (entry.baseEnergyPerParticle !== null) {
      finiteNonNegative(
        context,
        [...path, "baseEnergyPerParticle"],
        entry.baseEnergyPerParticle,
        "base energy per particle"
      );
    }
  });

  result.particleEvents.forEach((entry, index) => {
    const path = ["particleEvents", index] satisfies IssuePath;
    validateActor(
      [...path, "sourceActorId"],
      entry.sourceActorId,
      false
    );
    finiteNonNegative(
      context,
      [...path, "particleCount"],
      entry.particleCount,
      "particle count"
    );
  });

  result.particleTriggerLog.forEach((entry, index) => {
    validateActor(
      ["particleTriggerLog", index, "sourceActorId"],
      entry.sourceActorId,
      false
    );
  });

  const summaryIds = Object.keys(result.energyStats);
  for (const summaryId of summaryIds) {
    if (!characterIds.has(summaryId)) {
      addIssue(
        context,
        ["energyStats", summaryId],
        `energyStats contains ghost character "${summaryId}"`
      );
    }
    const summary = result.energyStats[summaryId];
    if (summary === undefined) continue;
    const energyMax = energyMaxByCharacter.get(summaryId) ?? 0;
    validateStateEnergy(
      context,
      ["energyStats", summaryId, "initial"],
      summary.initial,
      energyMax,
      "summary initial energy"
    );
    validateStateEnergy(
      context,
      ["energyStats", summaryId, "final"],
      summary.final,
      energyMax,
      "summary final energy"
    );
    for (const field of [
      "gained",
      "fixedGained",
      "particleGained",
      "wasted",
      "spent",
      "skipped"
    ] as const) {
      finiteNonNegative(
        context,
        ["energyStats", summaryId, field],
        summary[field],
        `summary ${field}`
      );
    }
  }
  for (const characterId of characterIds) {
    if (result.energyStats[characterId] === undefined) {
      addIssue(
        context,
        ["energyStats", characterId],
        `missing energy summary for configured character "${characterId}"`
      );
    }
  }

  result.energyCurve.forEach((point, pointIndex) => {
    const keys = Object.keys(point.energyByCharacter);
    for (const key of keys) {
      if (!characterIds.has(key)) {
        addIssue(
          context,
          [
            "energyCurve",
            pointIndex,
            "energyByCharacter",
            key
          ],
          `energy curve contains ghost character "${key}"`
        );
      }
      validateStateEnergy(
        context,
        [
          "energyCurve",
          pointIndex,
          "energyByCharacter",
          key
        ],
        point.energyByCharacter[key] ?? Number.NaN,
        energyMaxByCharacter.get(key) ?? 0,
        "energy curve state"
      );
    }
    for (const characterId of characterIds) {
      if (
        !Object.prototype.hasOwnProperty.call(
          point.energyByCharacter,
          characterId
        )
      ) {
        addIssue(
          context,
          [
            "energyCurve",
            pointIndex,
            "energyByCharacter",
            characterId
          ],
          "energy curve must contain every configured character"
        );
      }
    }
    if (
      point.receiverId !== null &&
      !characterIds.has(point.receiverId)
    ) {
      addIssue(
        context,
        ["energyCurve", pointIndex, "receiverId"],
        `references ghost character "${point.receiverId}"`
      );
    }
  });

  return { characterIds, energyMaxByCharacter };
}

function resolveTargets(
  result: SimulationResult,
  context: RefinementCtx,
  path: IssuePath,
  actorId: string,
  target: EnergyEvent["target"] | StatusTarget | undefined
): string[] {
  const targets =
    target === "team"
      ? result.config.characters.map((character) => character.id)
      : target === "self" || target === undefined
        ? [actorId]
        : Array.isArray(target)
          ? target
          : [target];
  const characterIds = new Set(
    result.config.characters.map((character) => character.id)
  );
  targets.forEach((targetId, index) => {
    if (!characterIds.has(targetId)) {
      addIssue(
        context,
        [...path, index],
        `references ghost character "${targetId}"`
      );
    }
  });
  return targets.filter((targetId) => characterIds.has(targetId));
}

function buildExpectedFixedAndBuffEvents(
  result: SimulationResult,
  context: RefinementCtx,
  attempts: ExpectedActionAttempt[]
): {
  fixedGroups: ExpectedFixedEnergyGroup[];
  buffEvents: ExpectedBuffEvent[];
} {
  const fixedGroups: ExpectedFixedEnergyGroup[] = [];
  const buffEvents: ExpectedBuffEvent[] = [];
  for (const attempt of attempts) {
    if (attempt.actionLogIndex === null) continue;
    for (const [gainOrder, gain] of
      attempt.energyGains.entries()) {
      const requestedTime = attempt.timeSeconds + gain.offset;
      if (requestedTime > result.config.duration + FLOAT_TOLERANCE) {
        continue;
      }
      const processed = processedTime(result, requestedTime);
      if (
        processed.timeSeconds >
        result.config.duration + FLOAT_TOLERANCE
      ) {
        continue;
      }
      const targets = resolveTargets(
        result,
        context,
        [
          "config",
          result.config.timeline === undefined
            ? "rotation"
            : "timeline",
          attempt.timelineCommandIndex ?? attempt.actionId,
          "energyGains",
          gainOrder,
          "target"
        ],
        attempt.actorId,
        gain.target
      );
      fixedGroups.push({
        kind: "fixed",
        energyLogStartIndex: null,
        frame: processed.frame,
        timeSeconds: processed.timeSeconds,
        creationFrame: attempt.frame,
        creationTimeSeconds: attempt.timeSeconds,
        creationOrder: attempt.ordinal,
        gainOrder,
        actorId: attempt.actorId,
        actionId: attempt.actionId,
        source: gain.source ?? `${attempt.actionId}:fixed-energy`,
        targets,
        gain
      });
    }
    for (const [buffOrder, buff] of attempt.buffs.entries()) {
      const requestedTime = attempt.timeSeconds + buff.offset;
      if (requestedTime > result.config.duration + FLOAT_TOLERANCE) {
        continue;
      }
      const processed = processedTime(result, requestedTime);
      if (
        processed.timeSeconds >
        result.config.duration + FLOAT_TOLERANCE
      ) {
        continue;
      }
      buffEvents.push({
        frame: processed.frame,
        timeSeconds: processed.timeSeconds,
        creationFrame: attempt.frame,
        creationTimeSeconds: attempt.timeSeconds,
        creationOrder: attempt.ordinal,
        actorId: attempt.actorId,
        buffOrder,
        buff
      });
    }
  }
  return { fixedGroups, buffEvents };
}

function particleId(
  actionId: string,
  particle: NormalizedParticle
): string {
  return particle.id ?? `${actionId}:particle-${particle.index}`;
}

function particleSource(
  actionName: string,
  resolvedParticleId: string,
  particle: NormalizedParticle
): string {
  return particle.source ?? `${actionName}:${resolvedParticleId}`;
}

function buildExpectedParticleSpawns(
  result: SimulationResult,
  context: RefinementCtx,
  attempts: ExpectedActionAttempt[]
): ExpectedParticleSpawn[] {
  const expected: ExpectedParticleSpawn[] = [];
  const executedByActionCycle = new Map<
    string,
    ExpectedActionAttempt[]
  >();
  for (const attempt of attempts) {
    if (attempt.actionLogIndex === null) continue;
    const key = JSON.stringify([
      attempt.actorId,
      attempt.actionId,
      attempt.cycle
    ]);
    const rows = executedByActionCycle.get(key) ?? [];
    rows.push(attempt);
    executedByActionCycle.set(key, rows);
    for (const particle of attempt.particles) {
      if (particle.trigger !== undefined) continue;
      const requestedTime =
        attempt.timeSeconds + particle.spawnOffset;
      if (requestedTime > result.config.duration + FLOAT_TOLERANCE) {
        continue;
      }
      const processed = processedTime(result, requestedTime);
      if (
        processed.timeSeconds >
        result.config.duration + FLOAT_TOLERANCE
      ) {
        continue;
      }
      const resolvedParticleId = particleId(
        attempt.actionId,
        particle
      );
      expected.push({
        particle,
        actorId: attempt.actorId,
        actionId: attempt.actionId,
        actionName: attempt.actionName,
        cycle: attempt.cycle,
        spawnFrame: processed.frame,
        spawnTimeSeconds: processed.timeSeconds,
        particleId: resolvedParticleId,
        source: particleSource(
          attempt.actionName,
          resolvedParticleId,
          particle
        ),
        triggerLogId: null,
        triggerHitId: null
      });
    }
  }

  const consumedDefinitionCountByProducer =
    new Map<string, number>();
  result.particleTriggerLog.forEach((trigger, triggerIndex) => {
    expectEqual(
      context,
      ["particleTriggerLog", triggerIndex, "id"],
      trigger.id,
      triggerIndex,
      "particle trigger id"
    );
    const attemptKey = JSON.stringify([
      trigger.sourceActorId,
      trigger.sourceActionId,
      trigger.cycle
    ]);
    const candidates =
      executedByActionCycle.get(attemptKey) ?? [];
    const matches: Array<{
      attempt: ExpectedActionAttempt;
      particle: NormalizedParticle;
    }> = [];
    for (const attempt of candidates) {
      for (const particle of attempt.particles) {
        const triggerDefinition = particle.trigger;
        if (
          triggerDefinition === undefined ||
          !triggerDefinition.hitIds.includes(trigger.hitId)
        ) {
          continue;
        }
        const resolvedParticleId = particleId(
          attempt.actionId,
          particle
        );
        const source = particleSource(
          attempt.actionName,
          resolvedParticleId,
          particle
        );
        if (
          resolvedParticleId === trigger.particleId &&
          source === trigger.source
        ) {
          matches.push({ attempt, particle });
        }
      }
    }
    // Particle provenance has already authenticated trigger-log order against
    // config order. Consume otherwise indistinguishable explicit definitions
    // one-to-one within each direct-hit producer rather than requiring their
    // public identity fields to be globally unique. hitGroupId deliberately
    // keeps duplicate hit ids and same-frame hit groups independent.
    const producerKey = JSON.stringify([
      trigger.sourceActorId,
      trigger.sourceActionId,
      trigger.cycle,
      trigger.frame,
      trigger.hitId,
      trigger.hitGroupId,
      trigger.particleId,
      trigger.source
    ]);
    const consumedCount =
      consumedDefinitionCountByProducer.get(producerKey) ?? 0;
    const match = matches[consumedCount];
    if (match === undefined) {
      addIssue(
        context,
        ["particleTriggerLog", triggerIndex],
        `must resolve the next executed particle definition for its producer; consumed ${consumedCount} of ${matches.length} candidate(s)`
      );
      return;
    }
    consumedDefinitionCountByProducer.set(
      producerKey,
      consumedCount + 1
    );
    const definition = match.particle.trigger!;
    const expectedDuration =
      definition.internalCooldown === undefined
        ? null
        : Math.max(
            1,
            toFrame(definition.internalCooldown.duration)
          );
    expectOptionalEqual(
      context,
      [
        "particleTriggerLog",
        triggerIndex,
        "internalCooldownKey"
      ],
      trigger.internalCooldownKey,
      definition.internalCooldown?.key ?? null,
      "particle trigger internal cooldown key"
    );
    expectOptionalEqual(
      context,
      [
        "particleTriggerLog",
        triggerIndex,
        "internalCooldownDurationFrames"
      ],
      trigger.internalCooldownDurationFrames,
      expectedDuration,
      "particle trigger internal cooldown duration"
    );
    expectEqual(
      context,
      ["particleTriggerLog", triggerIndex, "triggered"],
      trigger.triggered,
      trigger.blockedReason === null,
      "particle trigger status"
    );
    if (!trigger.triggered) return;
    expected.push({
      particle: match.particle,
      actorId: match.attempt.actorId,
      actionId: match.attempt.actionId,
      actionName: match.attempt.actionName,
      cycle: match.attempt.cycle,
      spawnFrame: trigger.frame,
      spawnTimeSeconds: trigger.timeSeconds,
      particleId: trigger.particleId,
      source: trigger.source,
      triggerLogId: trigger.id,
      triggerHitId: trigger.hitId
    });
  });
  return expected;
}

function particleSpawnKey(spawn: {
  actorId?: string;
  sourceActorId?: string;
  actionId?: string;
  sourceActionId?: string;
  cycle: number;
  spawnFrame: number;
  spawnTimeSeconds: number;
  particleId: string;
  source: string;
  triggerLogId: number | null;
  triggerHitId: string | null;
}): string {
  return JSON.stringify([
    spawn.actorId ?? spawn.sourceActorId,
    spawn.actionId ?? spawn.sourceActionId,
    spawn.cycle,
    spawn.spawnFrame,
    spawn.spawnTimeSeconds,
    spawn.particleId,
    spawn.source,
    spawn.triggerLogId,
    spawn.triggerHitId
  ]);
}

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

class EnergyReplayRandom {
  private state: number;

  constructor(seed: string) {
    this.state = fnv1a32(seed);
  }

  next(): number {
    let value = (this.state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  integer(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
}

function resolveParticleCount(
  count: ParticleCount,
  random: EnergyReplayRandom
): number {
  if (typeof count === "number") return count;
  const step = count.step ?? 1;
  const stepCount = Math.floor(
    (count.max - count.min) / step + 1e-9
  );
  return Number(
    (
      count.min +
      random.integer(stepCount + 1) * step
    ).toFixed(12)
  );
}

function bindParticleEvents(
  result: SimulationResult,
  context: RefinementCtx,
  expectedSpawns: ExpectedParticleSpawn[]
): {
  spawnByParticleEvent: Map<number, ExpectedParticleSpawn>;
  particleGroups: ExpectedParticleEnergyGroup[];
} {
  const descriptorsByKey = new Map<
    string,
    ExpectedParticleSpawn[]
  >();
  for (const spawn of expectedSpawns) {
    const key = particleSpawnKey(spawn);
    const rows = descriptorsByKey.get(key) ?? [];
    rows.push(spawn);
    descriptorsByKey.set(key, rows);
  }
  const spawnByParticleEvent = new Map<
    number,
    ExpectedParticleSpawn
  >();
  const particleGroups: ExpectedParticleEnergyGroup[] = [];
  const random = new EnergyReplayRandom(
    result.resolvedRuntimeOptions.randomSeed
  );
  let previousFrame = Number.NEGATIVE_INFINITY;
  let previousTime = Number.NEGATIVE_INFINITY;

  result.particleEvents.forEach((event, eventIndex) => {
    const path = ["particleEvents", eventIndex] satisfies IssuePath;
    expectEqual(
      context,
      [...path, "id"],
      event.id,
      eventIndex,
      "particle event id"
    );
    if (
      primaryOrder(
        result,
        previousFrame,
        previousTime,
        event.spawnFrame,
        event.spawnTimeSeconds
      ) > 0
    ) {
      addIssue(
        context,
        path,
        "particle events must be ordered by spawn execution"
      );
    }
    previousFrame = event.spawnFrame;
    previousTime = event.spawnTimeSeconds;

    const key = particleSpawnKey(event);
    const candidates = descriptorsByKey.get(key);
    const expected = candidates?.shift();
    if (expected === undefined) {
      addIssue(
        context,
        path,
        "does not correspond to an executed configured particle spawn"
      );
      return;
    }
    spawnByParticleEvent.set(eventIndex, expected);
    const expectedCount = resolveParticleCount(
      expected.particle.count,
      random
    );
    expectNearlyEqual(
      context,
      [...path, "particleCount"],
      event.particleCount,
      expectedCount,
      "deterministic particle count"
    );
    expectEqual(
      context,
      [...path, "particleElement"],
      event.particleElement,
      expected.particle.element,
      "particle element"
    );
    expectEqual(
      context,
      [...path, "particleKind"],
      event.particleKind,
      expected.particle.kind,
      "particle kind"
    );
    expectEqual(
      context,
      [...path, "spawnFrame"],
      event.spawnFrame,
      expected.spawnFrame,
      "particle spawn frame"
    );
    expectNearlyEqual(
      context,
      [...path, "spawnTimeSeconds"],
      event.spawnTimeSeconds,
      expected.spawnTimeSeconds,
      "particle spawn time"
    );

    const receiveRequestedTime =
      expected.spawnTimeSeconds +
      Math.max(0, expected.particle.travelTime);
    const receive = processedTime(result, receiveRequestedTime);
    const receivedWithinSimulation =
      receiveRequestedTime <=
      result.config.duration + FLOAT_TOLERANCE;
    expectEqual(
      context,
      [...path, "receiveFrame"],
      event.receiveFrame,
      receive.frame,
      "particle receive frame"
    );
    expectNearlyEqual(
      context,
      [...path, "receiveTimeSeconds"],
      event.receiveTimeSeconds,
      receive.timeSeconds,
      "particle receive time"
    );
    expectEqual(
      context,
      [...path, "receivedWithinSimulation"],
      event.receivedWithinSimulation,
      receivedWithinSimulation,
      "particle in-range status"
    );
    if (
      event.receivedWithinSimulation &&
      receive.timeSeconds <=
        result.config.duration + FLOAT_TOLERANCE
    ) {
      particleGroups.push({
        kind: "particle",
        energyLogStartIndex: null,
        frame: receive.frame,
        timeSeconds: receive.timeSeconds,
        creationFrame: event.spawnFrame,
        creationTimeSeconds: event.spawnTimeSeconds,
        creationOrder: eventIndex,
        particleEventIndex: eventIndex,
        particleCount: expectedCount,
        spawn: expected
      });
    }
  });

  for (const descriptors of descriptorsByKey.values()) {
    for (const descriptor of descriptors) {
      addIssue(
        context,
        ["particleEvents"],
        `missing particle event ${descriptor.particleId} from ${descriptor.actionId} cycle ${descriptor.cycle} at frame ${descriptor.spawnFrame}`
      );
    }
  }
  return { spawnByParticleEvent, particleGroups };
}

function expectedEnergyGroupReceivers(
  result: SimulationResult,
  group: ExpectedEnergyGroup
): string[] {
  return group.kind === "fixed"
    ? group.targets
    : result.config.characters.map((character) => character.id);
}

function energyGroupMatchesAt(
  result: SimulationResult,
  group: ExpectedEnergyGroup,
  startIndex: number,
  usedIndices: Set<number>
): boolean {
  const receivers = expectedEnergyGroupReceivers(result, group);
  if (receivers.length === 0) return false;
  for (const [offset, receiverId] of receivers.entries()) {
    const index = startIndex + offset;
    if (usedIndices.has(index)) return false;
    const row = result.energyLog[index];
    if (
      row === undefined ||
      row.kind !== group.kind ||
      row.frame !== group.frame ||
      !nearlyEqual(row.timeSeconds, group.timeSeconds) ||
      row.receiverId !== receiverId
    ) {
      return false;
    }
    if (group.kind === "fixed") {
      if (
        row.sourceActorId !== group.actorId ||
        row.sourceActionId !== group.actionId ||
        row.source !== group.source ||
        row.spawnFrame !== null ||
        row.receiveFrame !== group.frame
      ) {
        return false;
      }
    } else if (
      row.sourceActorId !== group.spawn.actorId ||
      row.sourceActionId !== group.spawn.actionId ||
      row.source !== group.spawn.source ||
      row.spawnFrame !== group.spawn.spawnFrame ||
      row.receiveFrame !== group.frame ||
      row.particleElement !== group.spawn.particle.element ||
      row.particleKind !== group.spawn.particle.kind ||
      row.particleCount === null ||
      !nearlyEqual(row.particleCount, group.particleCount)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * SimulationResult 1.42 does not serialize the internal heap sequence or a
 * particleEventId on EnergyLog rows. Bind each contiguous output group back to
 * exactly one configured source first, then use the bound first-row index only
 * as the tertiary order among same-clock priority-2 groups. All numeric state
 * and formulas remain independently replayed below.
 */
function bindEnergyGroupsToLog(
  result: SimulationResult,
  context: RefinementCtx,
  groups: ExpectedEnergyGroup[]
): void {
  const usedIndices = new Set<number>();
  const bindingOrder = [...groups].sort((left, right) => {
    const eventOrder = primaryOrder(
      result,
      left.frame,
      left.timeSeconds,
      right.frame,
      right.timeSeconds
    );
    if (eventOrder !== 0) return eventOrder;
    const creationOrder = primaryOrder(
      result,
      left.creationFrame,
      left.creationTimeSeconds,
      right.creationFrame,
      right.creationTimeSeconds
    );
    if (creationOrder !== 0) return creationOrder;
    if (left.kind !== right.kind) {
      return left.kind === "fixed" ? -1 : 1;
    }
    if (left.kind === "fixed" && right.kind === "fixed") {
      return (
        left.creationOrder - right.creationOrder ||
        left.gainOrder - right.gainOrder
      );
    }
    return (
      (left as ExpectedParticleEnergyGroup).particleEventIndex -
      (right as ExpectedParticleEnergyGroup).particleEventIndex
    );
  });

  for (const group of bindingOrder) {
    const rowCount = expectedEnergyGroupReceivers(
      result,
      group
    ).length;
    if (rowCount === 0) continue;
    let matchIndex: number | null = null;
    for (
      let index = 0;
      index + rowCount <= result.energyLog.length;
      index += 1
    ) {
      if (
        energyGroupMatchesAt(
          result,
          group,
          index,
          usedIndices
        )
      ) {
        matchIndex = index;
        break;
      }
    }
    if (matchIndex === null) {
      addIssue(
        context,
        ["energyLog"],
        `cannot bind configured ${group.kind} group at frame ${group.frame} to one contiguous EnergyLog group`
      );
      continue;
    }
    group.energyLogStartIndex = matchIndex;
    for (let offset = 0; offset < rowCount; offset += 1) {
      usedIndices.add(matchIndex + offset);
    }
  }

  result.energyLog.forEach((_row, index) => {
    if (!usedIndices.has(index)) {
      addIssue(
        context,
        ["energyLog", index],
        "does not belong to any configured contiguous energy group"
      );
    }
  });
}

interface EnergyReplayState {
  energies: Map<string, number>;
  stats: Map<string, ReplayStats>;
  activeCharacterId: string | null;
  activeBuffs: ActiveEnergyRechargeBuff[];
  fixedCooldownReadyFrames: Map<string, number>;
  energyLogIndex: number;
  energyCurveIndex: number;
}

function compareBuffEvents(
  result: SimulationResult,
  left: ExpectedBuffEvent,
  right: ExpectedBuffEvent
): number {
  return (
    primaryOrder(
      result,
      left.frame,
      left.timeSeconds,
      right.frame,
      right.timeSeconds
    ) ||
    primaryOrder(
      result,
      left.creationFrame,
      left.creationTimeSeconds,
      right.creationFrame,
      right.creationTimeSeconds
    ) ||
    left.creationOrder - right.creationOrder ||
    left.buffOrder - right.buffOrder
  );
}

function compareEnergyGroups(
  result: SimulationResult,
  left: ExpectedEnergyGroup,
  right: ExpectedEnergyGroup
): number {
  const eventOrder = primaryOrder(
    result,
    left.frame,
    left.timeSeconds,
    right.frame,
    right.timeSeconds
  );
  if (eventOrder !== 0) return eventOrder;

  /*
   * The 1.42 wire omits heap sequence. A configured group was already bound
   * to a contiguous EnergyLog range, so the first-row index is the only
   * authoritative tertiary order for same-clock priority-2 groups. Formula,
   * state and curve values are still recomputed independently in that order.
   */
  if (
    left.energyLogStartIndex !== null &&
    right.energyLogStartIndex !== null
  ) {
    return (
      left.energyLogStartIndex - right.energyLogStartIndex
    );
  }

  // Invalid/unbound results retain a deterministic fallback for diagnostics.
  const creationTimeOrder = primaryOrder(
    result,
    left.creationFrame,
    left.creationTimeSeconds,
    right.creationFrame,
    right.creationTimeSeconds
  );
  if (creationTimeOrder !== 0) return creationTimeOrder;
  if (left.kind !== right.kind) {
    return left.kind === "fixed" ? -1 : 1;
  }
  if (left.kind === "fixed" && right.kind === "fixed") {
    return (
      left.creationOrder - right.creationOrder ||
      left.gainOrder - right.gainOrder
    );
  }
  return (
    (left as ExpectedParticleEnergyGroup).particleEventIndex -
    (right as ExpectedParticleEnergyGroup).particleEventIndex
  );
}

function buildReplayOperations(
  result: SimulationResult,
  attempts: ExpectedActionAttempt[],
  buffEvents: ExpectedBuffEvent[],
  energyGroups: ExpectedEnergyGroup[]
): ReplayOperation[] {
  const operations: ReplayOperation[] = attempts.map(
    (attempt, order) => ({
      kind: "action",
      priority: 0,
      frame: attempt.frame,
      timeSeconds: attempt.timeSeconds,
      order,
      attempt
    })
  );

  [...buffEvents]
    .sort((left, right) => compareBuffEvents(result, left, right))
    .forEach((event, order) => {
      operations.push({
        kind: "buff",
        priority: 1,
        frame: event.frame,
        timeSeconds: event.timeSeconds,
        order,
        event
      });
    });

  [...energyGroups]
    .sort((left, right) =>
      compareEnergyGroups(result, left, right)
    )
    .forEach((group, order) => {
      operations.push({
        kind: "energy",
        priority: 2,
        frame: group.frame,
        timeSeconds: group.timeSeconds,
        order,
        group
      });
    });

  operations.sort(
    (left, right) =>
      primaryOrder(
        result,
        left.frame,
        left.timeSeconds,
        right.frame,
        right.timeSeconds
      ) ||
      left.priority - right.priority ||
      left.order - right.order
  );
  return operations;
}

function initialEnergyForCharacter(
  result: SimulationResult,
  character: SimulationResult["config"]["characters"][number]
): number {
  return result.resolvedRuntimeOptions.energyMode === "zero"
    ? 0
    : result.resolvedRuntimeOptions.energyMode === "full"
      ? character.energyMax
      : character.initialEnergy;
}

function expectEnergyProjection(
  result: SimulationResult,
  context: RefinementCtx,
  path: IssuePath,
  actual: Record<string, number>,
  expected: Map<string, number>
): void {
  for (const character of result.config.characters) {
    expectNearlyEqual(
      context,
      [...path, character.id],
      actual[character.id] ?? Number.NaN,
      expected.get(character.id) ?? Number.NaN,
      `energy projection for ${character.id}`
    );
  }
}

function consumeEnergyCurvePoint(
  result: SimulationResult,
  context: RefinementCtx,
  state: EnergyReplayState,
  expected: {
    frame: number;
    timeSeconds: number;
    kind: SimulationResult["energyCurve"][number]["kind"];
    receiverId: string | null;
    source: string;
  }
): void {
  const pointIndex = state.energyCurveIndex++;
  const point = result.energyCurve[pointIndex];
  const path = ["energyCurve", pointIndex] satisfies IssuePath;
  if (point === undefined) {
    addIssue(
      context,
      path,
      `missing ${expected.kind} energy curve point`
    );
    return;
  }
  expectEqual(
    context,
    [...path, "id"],
    point.id,
    pointIndex,
    "energy curve id"
  );
  expectEqual(
    context,
    [...path, "frame"],
    point.frame,
    expected.frame,
    "energy curve frame"
  );
  expectNearlyEqual(
    context,
    [...path, "timeSeconds"],
    point.timeSeconds,
    expected.timeSeconds,
    "energy curve time"
  );
  expectEqual(
    context,
    [...path, "kind"],
    point.kind,
    expected.kind,
    "energy curve kind"
  );
  expectOptionalEqual(
    context,
    [...path, "receiverId"],
    point.receiverId,
    expected.receiverId,
    "energy curve receiver"
  );
  expectEqual(
    context,
    [...path, "source"],
    point.source,
    expected.source,
    "energy curve source"
  );
  expectEnergyProjection(
    result,
    context,
    [...path, "energyByCharacter"],
    point.energyByCharacter,
    state.energies
  );
}

function validateBoundOutputOrdering(
  context: RefinementCtx,
  attempts: ExpectedActionAttempt[]
): void {
  let previousActionIndex = -1;
  let previousSkippedIndex = -1;
  for (const attempt of attempts) {
    if (attempt.actionLogIndex !== null) {
      if (attempt.actionLogIndex <= previousActionIndex) {
        addIssue(
          context,
          ["actionLog", attempt.actionLogIndex],
          "executed actions must preserve configured event order"
        );
      }
      previousActionIndex = attempt.actionLogIndex;
    }
    if (attempt.skippedActionIndex !== null) {
      if (attempt.skippedActionIndex <= previousSkippedIndex) {
        addIssue(
          context,
          ["skippedActions", attempt.skippedActionIndex],
          "skipped actions must preserve configured event order"
        );
      }
      previousSkippedIndex = attempt.skippedActionIndex;
    }
  }
}

function validateActionIdentity(
  result: SimulationResult,
  context: RefinementCtx,
  attempt: ExpectedActionAttempt
): void {
  if (attempt.actionLogIndex !== null) {
    const index = attempt.actionLogIndex;
    const row = result.actionLog[index]!;
    const path = ["actionLog", index] satisfies IssuePath;
    expectNearlyEqual(
      context,
      [...path, "time"],
      row.time,
      attempt.timeSeconds,
      "action time"
    );
    expectEqual(
      context,
      [...path, "frame"],
      row.frame,
      attempt.frame,
      "action frame"
    );
    expectEqual(
      context,
      [...path, "actorId"],
      row.actorId,
      attempt.actorId,
      "action actor"
    );
    expectEqual(
      context,
      [...path, "actionId"],
      row.actionId,
      attempt.actionId,
      "action id"
    );
    expectEqual(
      context,
      [...path, "action"],
      row.action,
      attempt.actionName,
      "action name"
    );
    expectEqual(
      context,
      [...path, "cycle"],
      row.cycle,
      attempt.cycle,
      "action cycle"
    );
    expectOptionalEqual(
      context,
      [...path, "timelineCommandIndex"],
      row.timelineCommandIndex,
      attempt.timelineCommandIndex,
      "action timeline command"
    );
    expectOptionalEqual(
      context,
      [...path, "sourceAbilityId"],
      row.sourceAbilityId,
      attempt.sourceAbilityId,
      "action source ability"
    );
    expectOptionalEqual(
      context,
      [...path, "cancelFrame"],
      row.cancelFrame,
      attempt.cancelFrame,
      "action cancel frame"
    );
    expectOptionalEqual(
      context,
      [...path, "animationEndFrame"],
      row.animationEndFrame,
      attempt.animationEndFrame,
      "action animation end frame"
    );
  }

  if (attempt.skippedActionIndex !== null) {
    const index = attempt.skippedActionIndex;
    const row = result.skippedActions[index]!;
    const path = ["skippedActions", index] satisfies IssuePath;
    expectNearlyEqual(
      context,
      [...path, "time"],
      row.time,
      attempt.timeSeconds,
      "skipped action time"
    );
    expectEqual(
      context,
      [...path, "frame"],
      row.frame,
      attempt.frame,
      "skipped action frame"
    );
    expectEqual(
      context,
      [...path, "actorId"],
      row.actorId,
      attempt.actorId,
      "skipped action actor"
    );
    expectEqual(
      context,
      [...path, "actionId"],
      row.actionId,
      attempt.actionId,
      "skipped action id"
    );
    expectEqual(
      context,
      [...path, "action"],
      row.action,
      attempt.actionName,
      "skipped action name"
    );
    expectEqual(
      context,
      [...path, "cycle"],
      row.cycle,
      attempt.cycle,
      "skipped action cycle"
    );
    expectEqual(
      context,
      [...path, "reasonCode"],
      row.reasonCode,
      "INSUFFICIENT_ENERGY",
      "skipped action reason code"
    );
    expectOptionalEqual(
      context,
      [...path, "timelineCommandIndex"],
      row.timelineCommandIndex,
      attempt.timelineCommandIndex,
      "skipped action timeline command"
    );
    expectOptionalEqual(
      context,
      [...path, "sourceAbilityId"],
      row.sourceAbilityId,
      attempt.sourceAbilityId,
      "skipped action source ability"
    );
  }
}

function replayAction(
  result: SimulationResult,
  context: RefinementCtx,
  state: EnergyReplayState,
  attempt: ExpectedActionAttempt
): void {
  validateActionIdentity(result, context, attempt);
  const character = result.config.characters.find(
    (candidate) => candidate.id === attempt.actorId
  );
  if (character === undefined) {
    addIssue(
      context,
      [
        attempt.actionLogIndex === null
          ? "skippedActions"
          : "actionLog",
        attempt.actionLogIndex ??
          attempt.skippedActionIndex ??
          0,
        "actorId"
      ],
      `configured action references ghost character "${attempt.actorId}"`
    );
    return;
  }

  /*
   * Legacy skipped actions are real priority-0 events and set the active
   * actor before their energy check. Legal energy failures are prefix probes
   * appended after the final compiled run, so they must not mutate the final
   * run's active-character replay.
   */
  if (!attempt.legalProbeSkip) {
    state.activeCharacterId = attempt.actorId;
  }

  const currentEnergy = quantizeEnergy(
    Math.max(0, state.energies.get(attempt.actorId) ?? 0)
  );
  const energyCost = quantizeEnergy(
    Math.max(
      0,
      Number.isFinite(attempt.energyCost)
        ? attempt.energyCost
        : 0
    )
  );
  const shouldSkip =
    energyCost > currentEnergy + ENERGY_COMPARISON_EPSILON;
  const actionRow =
    attempt.actionLogIndex === null
      ? undefined
      : result.actionLog[attempt.actionLogIndex];
  const skippedRow =
    attempt.skippedActionIndex === null
      ? undefined
      : result.skippedActions[attempt.skippedActionIndex];

  if (shouldSkip && actionRow !== undefined) {
    addIssue(
      context,
      ["actionLog", attempt.actionLogIndex ?? 0, "energyBefore"],
      `configured energy cost ${energyCost} exceeds replayed energy ${currentEnergy}; action must be skipped`
    );
  }
  if (!shouldSkip && skippedRow !== undefined) {
    addIssue(
      context,
      [
        "skippedActions",
        attempt.skippedActionIndex ?? 0,
        "energyBefore"
      ],
      `replayed energy ${currentEnergy} satisfies configured cost ${energyCost}; action must execute`
    );
  }
  if (
    attempt.requiredOutput === "action" &&
    shouldSkip
  ) {
    addIssue(
      context,
      [
        "timelineExecution",
        "commandResults",
        attempt.timelineCommandIndex ?? 0,
        "status"
      ],
      "executed legal command is impossible under replayed energy state"
    );
  }
  if (attempt.requiredOutput === "skip" && !shouldSkip) {
    addIssue(
      context,
      [
        "timelineExecution",
        "commandResults",
        attempt.timelineCommandIndex ?? 0,
        "failureCode"
      ],
      "energy-rejected legal command has sufficient replayed energy"
    );
  }

  if (shouldSkip) {
    if (skippedRow !== undefined) {
      const path = [
        "skippedActions",
        attempt.skippedActionIndex ?? 0
      ] satisfies IssuePath;
      expectNearlyEqual(
        context,
        [...path, "energyBefore"],
        skippedRow.energyBefore,
        currentEnergy,
        "skipped action energyBefore"
      );
      expectNearlyEqual(
        context,
        [...path, "energyCost"],
        skippedRow.energyCost,
        energyCost,
        "skipped action configured energyCost"
      );
      expectEqual(
        context,
        [...path, "reason"],
        skippedRow.reason,
        `能量不足 ${Number(currentEnergy.toFixed(1))}/${energyCost}`,
        "skipped action reason"
      );
    }
    const stats = state.stats.get(attempt.actorId);
    if (stats !== undefined) stats.skipped += 1;
    return;
  }

  const energyAfter = quantizeEnergy(
    Math.max(0, currentEnergy - energyCost)
  );
  const spent = quantizeEnergy(currentEnergy - energyAfter);
  if (actionRow !== undefined) {
    const path = [
      "actionLog",
      attempt.actionLogIndex ?? 0
    ] satisfies IssuePath;
    expectNearlyEqual(
      context,
      [...path, "energyBefore"],
      actionRow.energyBefore,
      currentEnergy,
      "action energyBefore"
    );
    expectNearlyEqual(
      context,
      [...path, "energyAfter"],
      actionRow.energyAfter,
      energyAfter,
      "action energyAfter"
    );
  }
  state.energies.set(attempt.actorId, energyAfter);
  const stats = state.stats.get(attempt.actorId);
  if (stats !== undefined) {
    stats.spent = quantizeEnergy(stats.spent + spent);
  }
  if (energyCost > 0) {
    consumeEnergyCurvePoint(result, context, state, {
      frame: attempt.frame,
      timeSeconds: attempt.timeSeconds,
      kind: "spend",
      receiverId: attempt.actorId,
      source: `${attempt.actionId}:energy-cost`
    });
  }
}

function cleanupReplayBuffs(
  buffs: ActiveEnergyRechargeBuff[],
  timeSeconds: number
): void {
  for (let index = buffs.length - 1; index >= 0; index -= 1) {
    const buff = buffs[index];
    if (
      buff !== undefined &&
      buff.endTimeSeconds <= timeSeconds + FLOAT_TOLERANCE
    ) {
      buffs.splice(index, 1);
    }
  }
}

function replayBuff(
  result: SimulationResult,
  context: RefinementCtx,
  state: EnergyReplayState,
  event: ExpectedBuffEvent
): void {
  const targets = resolveTargets(
    result,
    context,
    [
      "config",
      result.config.timeline === undefined
        ? "rotation"
        : "timeline",
      event.creationOrder,
      "buffs",
      event.buffOrder,
      "target"
    ],
    event.actorId,
    event.buff.target
  );
  for (const targetId of targets) {
    const key = `${
      event.buff.key ?? event.buff.stat ?? "buff"
    }:${targetId}`;
    for (
      let index = state.activeBuffs.length - 1;
      index >= 0;
      index -= 1
    ) {
      if (state.activeBuffs[index]?.key === key) {
        state.activeBuffs.splice(index, 1);
      }
    }
    state.activeBuffs.push({
      key,
      targetId,
      stat: event.buff.stat,
      value: event.buff.value,
      endTimeSeconds: event.timeSeconds + event.buff.duration
    });
  }
}

function replayEnergyRecharge(
  result: SimulationResult,
  state: EnergyReplayState,
  receiverId: string
): number {
  const character = result.config.characters.find(
    (candidate) => candidate.id === receiverId
  );
  const buffDelta = state.activeBuffs.reduce(
    (sum, buff) =>
      buff.targetId === receiverId &&
      buff.stat === "energyRecharge"
        ? sum + buff.value
        : sum,
    0
  );
  return Math.max(
    0,
    (character?.stats.energyRecharge ?? 1) + buffDelta
  );
}

function consumeEnergyLogRow(
  result: SimulationResult,
  context: RefinementCtx,
  state: EnergyReplayState
): {
  row: SimulationResult["energyLog"][number] | undefined;
  index: number;
  path: IssuePath;
} {
  const index = state.energyLogIndex++;
  const row = result.energyLog[index];
  const path = ["energyLog", index] satisfies IssuePath;
  if (row === undefined) {
    addIssue(context, path, "missing replayed energy event");
    return { row, index, path };
  }
  expectEqual(
    context,
    [...path, "id"],
    row.id,
    index,
    "energy event id"
  );
  return { row, index, path };
}

function validateEnergyLogClockAndIdentity(
  context: RefinementCtx,
  row: SimulationResult["energyLog"][number],
  path: IssuePath,
  expected: {
    kind: "fixed" | "particle";
    frame: number;
    timeSeconds: number;
    sourceActorId: string;
    sourceActionId: string;
    source: string;
    receiverId: string;
    activeCharacterId: string | null;
  }
): void {
  expectEqual(
    context,
    [...path, "kind"],
    row.kind,
    expected.kind,
    "energy event kind"
  );
  expectEqual(
    context,
    [...path, "frame"],
    row.frame,
    expected.frame,
    "energy event frame"
  );
  expectNearlyEqual(
    context,
    [...path, "timeSeconds"],
    row.timeSeconds,
    expected.timeSeconds,
    "energy event time"
  );
  expectEqual(
    context,
    [...path, "sourceActorId"],
    row.sourceActorId,
    expected.sourceActorId,
    "energy event source actor"
  );
  expectEqual(
    context,
    [...path, "sourceActionId"],
    row.sourceActionId,
    expected.sourceActionId,
    "energy event source action"
  );
  expectEqual(
    context,
    [...path, "source"],
    row.source,
    expected.source,
    "energy event source"
  );
  expectEqual(
    context,
    [...path, "receiverId"],
    row.receiverId,
    expected.receiverId,
    "energy event receiver"
  );
  expectOptionalEqual(
    context,
    [...path, "activeCharacterId"],
    row.activeCharacterId,
    expected.activeCharacterId,
    "energy event active character"
  );
  expectEqual(
    context,
    [...path, "isOnField"],
    row.isOnField,
    expected.activeCharacterId === expected.receiverId,
    "energy event on-field state"
  );
}

function replayFixedEnergyGroup(
  result: SimulationResult,
  context: RefinementCtx,
  state: EnergyReplayState,
  group: ExpectedFixedEnergyGroup,
  energyMaxByCharacter: Map<string, number>
): void {
  const gainPath = [
    "config",
    result.config.timeline === undefined ? "rotation" : "timeline",
    group.creationOrder,
    "energyGains",
    group.gainOrder,
    "amount"
  ] satisfies IssuePath;
  const amountIsValid = finiteNonNegative(
    context,
    gainPath,
    group.gain.amount,
    "configured fixed energy gain"
  );
  const amount = amountIsValid ? group.gain.amount : 0;
  const internalCooldown = group.gain.internalCooldown;
  const durationFrames =
    internalCooldown === undefined
      ? null
      : Math.max(1, toFrame(internalCooldown.duration));
  const scopedKey =
    internalCooldown === undefined
      ? null
      : `${group.actorId}\u0000${internalCooldown.key}`;
  const previousReadyFrame =
    scopedKey === null
      ? null
      : (state.fixedCooldownReadyFrames.get(scopedKey) ?? 0);
  const blocked =
    previousReadyFrame !== null &&
    group.frame < previousReadyFrame;
  const readyFrame =
    durationFrames === null
      ? null
      : blocked
        ? previousReadyFrame
        : group.frame + durationFrames;
  if (
    scopedKey !== null &&
    readyFrame !== null &&
    !blocked
  ) {
    state.fixedCooldownReadyFrames.set(scopedKey, readyFrame);
  }

  for (const receiverId of group.targets) {
    const before = state.energies.get(receiverId) ?? 0;
    const energyMax = energyMaxByCharacter.get(receiverId) ?? 0;
    const after = blocked
      ? before
      : quantizeEnergy(
          clamp(before + amount, 0, energyMax)
        );
    const gained = blocked
      ? 0
      : quantizeEnergy(after - before);
    const wasted = blocked
      ? 0
      : amount > 0
        ? quantizeEnergy(Math.max(0, amount - gained))
        : 0;
    const consumed = consumeEnergyLogRow(
      result,
      context,
      state
    );
    if (consumed.row !== undefined) {
      const row = consumed.row;
      const path = consumed.path;
      validateEnergyLogClockAndIdentity(context, row, path, {
        kind: "fixed",
        frame: group.frame,
        timeSeconds: group.timeSeconds,
        sourceActorId: group.actorId,
        sourceActionId: group.actionId,
        source: group.source,
        receiverId,
        activeCharacterId: state.activeCharacterId
      });
      expectNearlyEqual(
        context,
        [...path, "energyBefore"],
        row.energyBefore,
        before,
        "fixed energyBefore"
      );
      expectNearlyEqual(
        context,
        [...path, "rawEnergy"],
        row.rawEnergy,
        amount,
        "fixed rawEnergy"
      );
      expectNearlyEqual(
        context,
        [...path, "finalEnergy"],
        row.finalEnergy,
        amount,
        "fixed finalEnergy"
      );
      expectNearlyEqual(
        context,
        [...path, "gainedEnergy"],
        row.gainedEnergy,
        gained,
        "fixed gainedEnergy"
      );
      expectNearlyEqual(
        context,
        [...path, "wastedEnergy"],
        row.wastedEnergy,
        wasted,
        "fixed wastedEnergy"
      );
      expectNearlyEqual(
        context,
        [...path, "energyAfter"],
        row.energyAfter,
        after,
        "fixed energyAfter"
      );
      expectOptionalEqual(
        context,
        [...path, "spawnFrame"],
        row.spawnFrame,
        null,
        "fixed spawn frame"
      );
      expectEqual(
        context,
        [...path, "receiveFrame"],
        row.receiveFrame,
        group.frame,
        "fixed receive frame"
      );
      for (const field of [
        "particleElement",
        "particleKind",
        "particleCount",
        "isSameElement",
        "baseEnergyPerParticle"
      ] as const) {
        expectOptionalEqual(
          context,
          [...path, field],
          row[field],
          null,
          `fixed ${field}`
        );
      }
      expectNearlyEqual(
        context,
        [...path, "energyRecharge"],
        row.energyRecharge,
        1,
        "fixed Energy Recharge"
      );
      expectNearlyEqual(
        context,
        [...path, "fieldMultiplier"],
        row.fieldMultiplier,
        1,
        "fixed field multiplier"
      );
      expectEqual(
        context,
        [...path, "applied"],
        row.applied,
        !blocked,
        "fixed applied state"
      );
      expectOptionalEqual(
        context,
        [...path, "blockedReason"],
        row.blockedReason,
        blocked ? "INTERNAL_COOLDOWN" : null,
        "fixed blocked reason"
      );
      expectOptionalEqual(
        context,
        [...path, "internalCooldownKey"],
        row.internalCooldownKey,
        internalCooldown?.key ?? null,
        "fixed internal cooldown key"
      );
      expectOptionalEqual(
        context,
        [...path, "internalCooldownDurationFrames"],
        row.internalCooldownDurationFrames,
        durationFrames,
        "fixed internal cooldown duration"
      );
      expectOptionalEqual(
        context,
        [...path, "internalCooldownReadyFrame"],
        row.internalCooldownReadyFrame,
        readyFrame,
        "fixed internal cooldown ready frame"
      );
    }

    if (!blocked) {
      state.energies.set(receiverId, after);
      const stats = state.stats.get(receiverId);
      if (stats !== undefined) {
        stats.gained = quantizeEnergy(stats.gained + gained);
        stats.fixedGained = quantizeEnergy(
          stats.fixedGained + gained
        );
        stats.wasted = quantizeEnergy(stats.wasted + wasted);
      }
    }
    consumeEnergyCurvePoint(result, context, state, {
      frame: group.frame,
      timeSeconds: group.timeSeconds,
      kind: blocked ? "fixed-blocked" : "fixed",
      receiverId,
      source: group.source
    });
  }
}

function replayParticleEnergyGroup(
  result: SimulationResult,
  context: RefinementCtx,
  state: EnergyReplayState,
  group: ExpectedParticleEnergyGroup,
  energyMaxByCharacter: Map<string, number>
): void {
  const partySize = result.config.characters.length;
  const kindMultiplier =
    group.spawn.particle.kind === "orb" ? 3 : 1;
  for (const character of result.config.characters) {
    const receiverId = character.id;
    const before = state.energies.get(receiverId) ?? 0;
    const isOnField = state.activeCharacterId === receiverId;
    const isSameElement =
      group.spawn.particle.element === character.element;
    const baseEnergyPerParticle = isSameElement
      ? 3
      : group.spawn.particle.element === "neutral"
        ? 2
        : 1;
    const fieldMultiplier = isOnField
      ? 1
      : Math.max(0, 1 - 0.1 * partySize);
    const energyRecharge = replayEnergyRecharge(
      result,
      state,
      receiverId
    );
    const rawEnergy = quantizeEnergy(
      baseEnergyPerParticle *
        kindMultiplier *
        group.particleCount *
        fieldMultiplier
    );
    const finalEnergy = quantizeEnergy(
      rawEnergy * energyRecharge
    );
    const energyMax =
      energyMaxByCharacter.get(receiverId) ?? 0;
    const after = quantizeEnergy(
      clamp(before + finalEnergy, 0, energyMax)
    );
    const gained = quantizeEnergy(after - before);
    const wasted = quantizeEnergy(
      Math.max(0, finalEnergy - gained)
    );

    const consumed = consumeEnergyLogRow(
      result,
      context,
      state
    );
    if (consumed.row !== undefined) {
      const row = consumed.row;
      const path = consumed.path;
      validateEnergyLogClockAndIdentity(context, row, path, {
        kind: "particle",
        frame: group.frame,
        timeSeconds: group.timeSeconds,
        sourceActorId: group.spawn.actorId,
        sourceActionId: group.spawn.actionId,
        source: group.spawn.source,
        receiverId,
        activeCharacterId: state.activeCharacterId
      });
      expectNearlyEqual(
        context,
        [...path, "energyBefore"],
        row.energyBefore,
        before,
        "particle energyBefore"
      );
      expectNearlyEqual(
        context,
        [...path, "rawEnergy"],
        row.rawEnergy,
        rawEnergy,
        "particle rawEnergy"
      );
      expectNearlyEqual(
        context,
        [...path, "finalEnergy"],
        row.finalEnergy,
        finalEnergy,
        "particle finalEnergy"
      );
      expectNearlyEqual(
        context,
        [...path, "gainedEnergy"],
        row.gainedEnergy,
        gained,
        "particle gainedEnergy"
      );
      expectNearlyEqual(
        context,
        [...path, "wastedEnergy"],
        row.wastedEnergy,
        wasted,
        "particle wastedEnergy"
      );
      expectNearlyEqual(
        context,
        [...path, "energyAfter"],
        row.energyAfter,
        after,
        "particle energyAfter"
      );
      expectOptionalEqual(
        context,
        [...path, "spawnFrame"],
        row.spawnFrame,
        group.spawn.spawnFrame,
        "particle spawn frame"
      );
      expectEqual(
        context,
        [...path, "receiveFrame"],
        row.receiveFrame,
        group.frame,
        "particle receive frame"
      );
      expectOptionalEqual(
        context,
        [...path, "particleElement"],
        row.particleElement,
        group.spawn.particle.element,
        "particle element"
      );
      expectOptionalEqual(
        context,
        [...path, "particleKind"],
        row.particleKind,
        group.spawn.particle.kind,
        "particle kind"
      );
      if (row.particleCount === null) {
        addIssue(
          context,
          [...path, "particleCount"],
          "particle energy row must expose particleCount"
        );
      } else {
        expectNearlyEqual(
          context,
          [...path, "particleCount"],
          row.particleCount,
          group.particleCount,
          "particle count"
        );
      }
      expectOptionalEqual(
        context,
        [...path, "isSameElement"],
        row.isSameElement,
        isSameElement,
        "particle same-element state"
      );
      expectNearlyEqual(
        context,
        [...path, "energyRecharge"],
        row.energyRecharge,
        energyRecharge,
        "particle Energy Recharge"
      );
      expectNearlyEqual(
        context,
        [...path, "fieldMultiplier"],
        row.fieldMultiplier,
        fieldMultiplier,
        "particle field multiplier"
      );
      if (row.baseEnergyPerParticle === null) {
        addIssue(
          context,
          [...path, "baseEnergyPerParticle"],
          "particle energy row must expose baseEnergyPerParticle"
        );
      } else {
        expectNearlyEqual(
          context,
          [...path, "baseEnergyPerParticle"],
          row.baseEnergyPerParticle,
          baseEnergyPerParticle,
          "particle base energy"
        );
      }
      expectEqual(
        context,
        [...path, "applied"],
        row.applied,
        true,
        "particle applied state"
      );
      expectOptionalEqual(
        context,
        [...path, "blockedReason"],
        row.blockedReason,
        null,
        "particle blocked reason"
      );
      for (const field of [
        "internalCooldownKey",
        "internalCooldownDurationFrames",
        "internalCooldownReadyFrame"
      ] as const) {
        expectOptionalEqual(
          context,
          [...path, field],
          row[field],
          null,
          `particle ${field}`
        );
      }
    }

    state.energies.set(receiverId, after);
    const stats = state.stats.get(receiverId);
    if (stats !== undefined) {
      stats.gained = quantizeEnergy(stats.gained + gained);
      stats.particleGained = quantizeEnergy(
        stats.particleGained + gained
      );
      stats.wasted = quantizeEnergy(stats.wasted + wasted);
    }
    consumeEnergyCurvePoint(result, context, state, {
      frame: group.frame,
      timeSeconds: group.timeSeconds,
      kind: "particle",
      receiverId,
      source: group.spawn.source
    });
  }
}

function validateReplayStats(
  result: SimulationResult,
  context: RefinementCtx,
  state: EnergyReplayState
): void {
  for (const character of result.config.characters) {
    const expected = state.stats.get(character.id);
    const actual = result.energyStats[character.id];
    const path = ["energyStats", character.id] satisfies IssuePath;
    if (expected === undefined || actual === undefined) continue;
    expected.final = state.energies.get(character.id) ?? 0;
    for (const field of [
      "initial",
      "gained",
      "fixedGained",
      "particleGained",
      "wasted",
      "spent",
      "final"
    ] as const) {
      expectNearlyEqual(
        context,
        [...path, field],
        actual[field],
        expected[field],
        `replayed energy summary ${field}`
      );
    }
    expectEqual(
      context,
      [...path, "skipped"],
      actual.skipped,
      expected.skipped,
      "replayed skipped action count"
    );
  }
}

/**
 * Replays every 1.42 energy mutation from the versioned input configuration.
 *
 * This is intentionally independent of sim-core. It binds action costs,
 * fixed gains, particle definitions and deterministic particle rolls back to
 * config, then reconstructs the priority-0/1/2 event state machine. Every
 * EnergyLog row, cap/waste calculation, summary bucket and EnergyCurve point
 * is checked against that independent replay.
 */
export function validateEnergyReplayIntegrity(
  result: SimulationResult,
  context: RefinementCtx
): void {
  const { energyMaxByCharacter } =
    validateTrustedEnergyDomains(result, context);
  const attempts = buildExpectedActionAttempts(result, context);
  bindActionOutputs(result, context, attempts);
  validateBoundOutputOrdering(context, attempts);

  const { fixedGroups, buffEvents } =
    buildExpectedFixedAndBuffEvents(
      result,
      context,
      attempts
    );
  const expectedParticleSpawns = buildExpectedParticleSpawns(
    result,
    context,
    attempts
  );
  const { particleGroups } = bindParticleEvents(
    result,
    context,
    expectedParticleSpawns
  );
  const energyGroups: ExpectedEnergyGroup[] = [
    ...fixedGroups,
    ...particleGroups
  ];
  bindEnergyGroupsToLog(result, context, energyGroups);
  const operations = buildReplayOperations(
    result,
    attempts,
    buffEvents,
    energyGroups
  );

  const energies = new Map<string, number>();
  const stats = new Map<string, ReplayStats>();
  for (const character of result.config.characters) {
    const initial = initialEnergyForCharacter(result, character);
    energies.set(character.id, initial);
    stats.set(character.id, {
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
  const state: EnergyReplayState = {
    energies,
    stats,
    activeCharacterId:
      result.config.timeline?.initialActiveCharacterId ??
      result.config.characters[0]?.id ??
      null,
    activeBuffs: [],
    fixedCooldownReadyFrames: new Map(),
    energyLogIndex: 0,
    energyCurveIndex: 0
  };

  consumeEnergyCurvePoint(result, context, state, {
    frame: 0,
    timeSeconds: 0,
    kind: "initial",
    receiverId: null,
    source: "initial-energy"
  });

  for (const operation of operations) {
    cleanupReplayBuffs(
      state.activeBuffs,
      operation.timeSeconds
    );
    if (operation.kind === "action") {
      replayAction(result, context, state, operation.attempt);
    } else if (operation.kind === "buff") {
      replayBuff(result, context, state, operation.event);
    } else if (operation.group.kind === "fixed") {
      replayFixedEnergyGroup(
        result,
        context,
        state,
        operation.group,
        energyMaxByCharacter
      );
    } else {
      replayParticleEnergyGroup(
        result,
        context,
        state,
        operation.group,
        energyMaxByCharacter
      );
    }
  }

  if (state.energyLogIndex !== result.energyLog.length) {
    for (
      let index = state.energyLogIndex;
      index < result.energyLog.length;
      index += 1
    ) {
      addIssue(
        context,
        ["energyLog", index],
        "unexpected energy event without a configured replay source"
      );
    }
  }
  if (state.energyCurveIndex !== result.energyCurve.length) {
    for (
      let index = state.energyCurveIndex;
      index < result.energyCurve.length;
      index += 1
    ) {
      addIssue(
        context,
        ["energyCurve", index],
        "unexpected energy curve point without a replayed mutation"
      );
    }
  }
  validateReplayStats(result, context, state);
}
