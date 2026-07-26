import type {
  AbilityDefinition,
  AbilityFollowupKind,
  ActionDefinition,
  LegalTimelineCommand,
  SimConfig,
  TimelineAdjustment,
  TimelineCommandResult,
  TimelineExecution,
  TimelineFailure,
  TimelineFailureCode,
  TimelineStateGrant,
  TimelineStateLogEntry
} from "@genshin-dps-lab/schemas";

export class TimelineLegalityError extends Error {
  readonly failure: TimelineFailure;

  constructor(failure: TimelineFailure) {
    super(
      `合法时间线失败：commands.${failure.commandIndex} ` +
        `[${failure.code}] ${failure.message}`
    );
    this.name = "TimelineLegalityError";
    this.failure = failure;
  }
}

export interface CompiledTimeline {
  config: SimConfig;
  execution: TimelineExecution;
}

export interface RuntimeEnergyFailure {
  commandIndex: number;
  energyBefore: number;
  energyCost: number;
}

export interface CompileLegalTimelineOptions {
  runtimeEnergyFailures?: ReadonlyMap<number, RuntimeEnergyFailure>;
  /** Used by the runtime energy probe to avoid compiling later commands. */
  stopAfterCommandIndex?: number;
}

interface ActiveTimelineState {
  actorId: string;
  grant: TimelineStateGrant;
  expiresAtFrame: number;
  commandIndex: number;
  abilityId: string;
}

function toSeconds(frame: number): number {
  return frame / 60;
}

function withoutTimeline(config: SimConfig): Omit<SimConfig, "timeline"> {
  const { timeline: _timeline, ...base } = config;
  return base;
}

function compileAbilityAction(
  ability: AbilityDefinition,
  commandIndex: number,
  startFrame: number,
  cancelOffset: number
): ActionDefinition {
  return {
    id: `${ability.id}#${commandIndex}`,
    actorId: ability.actorId,
    name: ability.name,
    at: toSeconds(startFrame),
    once: true,
    ...(ability.energyCost === undefined
      ? {}
      : { energyCost: ability.energyCost }),
    ...(ability.hits === undefined
      ? {}
      : {
          hits: ability.hits.map(({ frame, ...hit }) => ({
            ...hit,
            offset: toSeconds(frame)
          }))
        }),
    ...(ability.buffs === undefined
      ? {}
      : {
          buffs: ability.buffs.map(
            ({ startFrame: effectFrame = 0, durationFrames, ...buff }) => ({
              ...buff,
              offset: toSeconds(effectFrame),
              duration: toSeconds(durationFrames)
            })
          )
        }),
    ...(ability.debuffs === undefined
      ? {}
      : {
          debuffs: ability.debuffs.map(
            ({
              startFrame: effectFrame = 0,
              durationFrames,
              ...debuff
            }) => ({
              ...debuff,
              offset: toSeconds(effectFrame),
              duration: toSeconds(durationFrames)
            })
          )
        }),
    ...(ability.energyGains === undefined
      ? {}
      : {
          energyGains: ability.energyGains.map(
            ({ frame = 0, internalCooldown, ...energy }) => ({
              ...energy,
              offset: toSeconds(frame),
              ...(internalCooldown === undefined
                ? {}
                : {
                    internalCooldown: {
                      key: internalCooldown.key,
                      duration: toSeconds(
                        internalCooldown.durationFrames
                      )
                    }
                  })
            })
          )
        }),
    ...(ability.particles === undefined
      ? {}
      : {
          particles: ability.particles.map(
            ({ spawnFrame = 0, travelFrames, ...particle }) => ({
              ...particle,
              spawnOffset: toSeconds(spawnFrame),
              travelTime: toSeconds(travelFrames)
            })
          )
        }),
    timelineCommandIndex: commandIndex,
    sourceAbilityId: ability.id,
    startFrame,
    cancelFrame: startFrame + cancelOffset,
    animationEndFrame: startFrame + ability.animationEndFrame
  };
}

function syntheticActiveAction(
  actorId: string,
  frame: number,
  id: string,
  name: string,
  commandIndex?: number
): ActionDefinition {
  return {
    id,
    actorId,
    name,
    at: toSeconds(frame),
    once: true,
    ...(commandIndex === undefined
      ? {}
      : { timelineCommandIndex: commandIndex }),
    startFrame: frame,
    cancelFrame: frame,
    animationEndFrame: frame
  };
}

function commandActor(command: LegalTimelineCommand): string | null {
  if (command.type === "wait") return null;
  return command.type === "swap" ? command.characterId : command.actorId;
}

function commandAbility(command: LegalTimelineCommand): string | null {
  return command.type === "wait" || command.type === "swap"
    ? null
    : command.abilityId;
}

function commandFollowupKind(
  command: LegalTimelineCommand | undefined
): AbilityFollowupKind | null {
  if (command === undefined || command.type === "wait") return null;
  return command.type;
}

export function compileLegalTimeline(
  config: SimConfig,
  options: CompileLegalTimelineOptions = {}
): CompiledTimeline {
  const timeline = config.timeline;
  if (!timeline) {
    throw new Error("compileLegalTimeline requires config.timeline");
  }

  const durationFrames = Math.round(config.duration * timeline.fps);
  const abilityById = new Map(
    timeline.abilities.map((ability) => [ability.id, ability])
  );
  const chargeAvailability = new Map<string, number[]>(
    timeline.abilities.map((ability) => [
      ability.id,
      Array.from({ length: ability.maxCharges ?? 1 }, () => 0)
    ])
  );
  const rotation: ActionDefinition[] = [];
  const commandResults: TimelineCommandResult[] = [];
  const adjustments: TimelineAdjustment[] = [];
  const failures: TimelineFailure[] = [];
  const stateLog: TimelineStateLogEntry[] = [];
  const activeStates = new Map<string, ActiveTimelineState>();
  let stateSequence = 0;
  let cursor = 0;
  let activeCharacterId = timeline.initialActiveCharacterId;

  const scopedStateKey = (actorId: string, statusKey: string): string =>
    `${actorId}\u0000${statusKey}`;

  const expireStatesThrough = (frame: number): void => {
    const cutoffFrame = Math.min(frame, durationFrames);
    const expiring = [...activeStates.entries()]
      .filter(([, state]) => state.expiresAtFrame <= cutoffFrame)
      .sort(
        (left, right) =>
          left[1].expiresAtFrame - right[1].expiresAtFrame ||
          left[1].commandIndex - right[1].commandIndex ||
          (left[1].grant.key < right[1].grant.key
            ? -1
            : left[1].grant.key > right[1].grant.key
              ? 1
              : 0)
      );
    for (const [key, state] of expiring) {
      if (activeStates.get(key) !== state) continue;
      activeStates.delete(key);
      stateLog.push({
        sequence: stateSequence++,
        frame: state.expiresAtFrame,
        timeSeconds: toSeconds(state.expiresAtFrame),
        operation: "expire",
        actorId: state.actorId,
        statusKey: state.grant.key,
        label: state.grant.label,
        expiresAtFrame: state.expiresAtFrame,
        commandIndex: state.commandIndex,
        abilityId: state.abilityId
      });
    }
  };

  const applyAbilityStates = (
    ability: AbilityDefinition,
    commandIndex: number,
    startFrame: number
  ): void => {
    const stateDefinition = ability.timelineState;
    if (!stateDefinition) return;
    for (const statusKey of stateDefinition.consumes ?? []) {
      const key = scopedStateKey(ability.actorId, statusKey);
      const state = activeStates.get(key);
      if (!state) continue;
      activeStates.delete(key);
      stateLog.push({
        sequence: stateSequence++,
        frame: startFrame,
        timeSeconds: toSeconds(startFrame),
        operation: "consume",
        actorId: ability.actorId,
        statusKey,
        label: state.grant.label,
        expiresAtFrame: state.expiresAtFrame,
        commandIndex,
        abilityId: ability.id
      });
    }
    for (const grant of stateDefinition.grants ?? []) {
      const key = scopedStateKey(ability.actorId, grant.key);
      const existing = activeStates.get(key);
      const expiresAtFrame = startFrame + grant.durationFrames;
      activeStates.set(key, {
        actorId: ability.actorId,
        grant,
        expiresAtFrame,
        commandIndex,
        abilityId: ability.id
      });
      stateLog.push({
        sequence: stateSequence++,
        frame: startFrame,
        timeSeconds: toSeconds(startFrame),
        operation: existing ? "replace" : "grant",
        actorId: ability.actorId,
        statusKey: grant.key,
        label: grant.label,
        expiresAtFrame,
        commandIndex,
        abilityId: ability.id
      });
    }
  };

  if (config.characters[0]?.id !== activeCharacterId) {
    rotation.push(
      syntheticActiveAction(
        activeCharacterId,
        0,
        "__timeline-initial-active",
        "设置初始前台"
      )
    );
  }

  const fail = (
    commandIndex: number,
    command: LegalTimelineCommand,
    code: TimelineFailureCode,
    frame: number,
    message: string,
    requestedFrame: number
  ): false => {
    const failure: TimelineFailure = {
      commandIndex,
      code,
      frame,
      message
    };
    failures.push(failure);
    if (timeline.legalityMode === "strict") {
      throw new TimelineLegalityError(failure);
    }
    commandResults.push({
      commandIndex,
      commandType: command.type,
      actorId: commandActor(command),
      abilityId: commandAbility(command),
      requestedFrame,
      startFrame: null,
      cancelFrame: null,
      animationEndFrame: null,
      endFrame: null,
      status: "rejected",
      waitedFrames: Math.max(0, frame - requestedFrame),
      failureCode: code
    });
    return false;
  };

  const applyRequestedFrame = (
    commandIndex: number,
    command: Exclude<LegalTimelineCommand, { type: "wait" }>
  ): { requestedFrame: number; startFrame: number } => {
    const requestedFrame = command.atFrame ?? cursor;
    if (requestedFrame >= cursor) {
      cursor = requestedFrame;
      return { requestedFrame, startFrame: cursor };
    }
    if (timeline.legalityMode === "strict") {
      const failure: TimelineFailure = {
        commandIndex,
        code: "ACTION_OVERLAP",
        frame: requestedFrame,
        message:
          `请求第 ${requestedFrame} 帧，但前一指令占用至第 ${cursor} 帧。`
      };
      failures.push(failure);
      throw new TimelineLegalityError(failure);
    }
    adjustments.push({
      commandIndex,
      code: "ACTION_OVERLAP",
      requestedFrame,
      executedFrame: cursor,
      waitedFrames: cursor - requestedFrame,
      message: `行动重叠，等待至第 ${cursor} 帧。`
    });
    return { requestedFrame, startFrame: cursor };
  };

  timeline.commands.forEach((command, commandIndex) => {
    if (
      options.stopAfterCommandIndex !== undefined &&
      commandIndex > options.stopAfterCommandIndex
    ) {
      return;
    }
    if (command.type === "wait") {
      const startFrame = cursor;
      cursor += command.frames;
      expireStatesThrough(cursor);
      commandResults.push({
        commandIndex,
        commandType: command.type,
        actorId: null,
        abilityId: null,
        requestedFrame: startFrame,
        startFrame,
        cancelFrame: null,
        animationEndFrame: null,
        endFrame: cursor,
        status: "executed",
        waitedFrames: 0
      });
      return;
    }

    const anchored = applyRequestedFrame(commandIndex, command);
    let startFrame = anchored.startFrame;
    expireStatesThrough(startFrame);
    if (startFrame > durationFrames) {
      fail(
        commandIndex,
        command,
        "OUT_OF_DURATION",
        startFrame,
        `指令开始帧 ${startFrame} 超出模拟结束帧 ${durationFrames}。`,
        anchored.requestedFrame
      );
      return;
    }

    if (command.type === "swap") {
      if (command.characterId === activeCharacterId) {
        fail(
          commandIndex,
          command,
          "ALREADY_ACTIVE",
          startFrame,
          `"${command.characterId}" 已在前台。`,
          anchored.requestedFrame
        );
        return;
      }
      const endFrame = startFrame + timeline.swapFrames;
      rotation.push(
        syntheticActiveAction(
          command.characterId,
          endFrame,
          `__swap#${commandIndex}`,
          `切换至 ${command.characterId}`,
          commandIndex
        )
      );
      cursor = endFrame;
      expireStatesThrough(endFrame);
      activeCharacterId = command.characterId;
      commandResults.push({
        commandIndex,
        commandType: command.type,
        actorId: command.characterId,
        abilityId: null,
        requestedFrame: anchored.requestedFrame,
        startFrame,
        cancelFrame: endFrame,
        animationEndFrame: endFrame,
        endFrame,
        status:
          startFrame > anchored.requestedFrame ? "waited" : "executed",
        waitedFrames: startFrame - anchored.requestedFrame
      });
      return;
    }

    if (command.actorId !== activeCharacterId) {
      fail(
        commandIndex,
        command,
        "WRONG_ACTIVE_CHARACTER",
        startFrame,
        `"${command.actorId}" 不在前台；当前前台为 "${activeCharacterId}"。`,
        anchored.requestedFrame
      );
      return;
    }

    const ability = abilityById.get(command.abilityId);
    if (!ability) {
      // The Zod schema reports this before compilation. This guard keeps the
      // compiler total when called with manually constructed typed values.
      fail(
        commandIndex,
        command,
        "UNKNOWN_ABILITY",
        startFrame,
        `未找到行动定义 "${command.abilityId}"。`,
        anchored.requestedFrame
      );
      return;
    }
    const chargeFrames = chargeAvailability.get(ability.id) ?? [0];
    let chargeIndex = 0;
    for (let index = 1; index < chargeFrames.length; index += 1) {
      if ((chargeFrames[index] ?? 0) < (chargeFrames[chargeIndex] ?? 0)) {
        chargeIndex = index;
      }
    }
    const chargeReadyFrame = chargeFrames[chargeIndex] ?? 0;
    if (chargeReadyFrame > startFrame) {
      if (timeline.legalityMode === "strict") {
        const failure: TimelineFailure = {
          commandIndex,
          code: "ABILITY_ON_COOLDOWN",
          frame: startFrame,
          message:
            `"${ability.name}" 尚未完成冷却/充能，最早可在第 ` +
            `${chargeReadyFrame} 帧施放。`
        };
        failures.push(failure);
        throw new TimelineLegalityError(failure);
      }
      adjustments.push({
        commandIndex,
        code: "ABILITY_ON_COOLDOWN",
        requestedFrame: startFrame,
        executedFrame: chargeReadyFrame,
        waitedFrames: chargeReadyFrame - startFrame,
        message: `"${ability.name}" 等待冷却/充能至第 ${chargeReadyFrame} 帧。`
      });
      startFrame = chargeReadyFrame;
      cursor = startFrame;
      expireStatesThrough(startFrame);
    }
    if (startFrame > durationFrames) {
      fail(
        commandIndex,
        command,
        "OUT_OF_DURATION",
        startFrame,
        `冷却等待后的开始帧 ${startFrame} 超出模拟结束帧 ${durationFrames}。`,
        anchored.requestedFrame
      );
      return;
    }

    const missingState = (ability.timelineState?.requires ?? []).find(
      (statusKey) =>
        !activeStates.has(scopedStateKey(ability.actorId, statusKey))
    );
    if (missingState !== undefined) {
      fail(
        commandIndex,
        command,
        "MISSING_REQUIRED_STATE",
        startFrame,
        `"${ability.name}" 需要 "${missingState}" 行动状态。`,
        anchored.requestedFrame
      );
      return;
    }

    const runtimeEnergyFailure =
      options.runtimeEnergyFailures?.get(commandIndex);
    if (runtimeEnergyFailure !== undefined) {
      const failure: TimelineFailure = {
        commandIndex,
        code: "INSUFFICIENT_ENERGY",
        frame: startFrame,
        message:
          `"${ability.name}" 能量不足 ` +
          `${runtimeEnergyFailure.energyBefore}/${runtimeEnergyFailure.energyCost}，` +
          "未施放且不占用冷却或改变行动状态。",
        energyBefore: runtimeEnergyFailure.energyBefore,
        energyCost: runtimeEnergyFailure.energyCost
      };
      failures.push(failure);
      commandResults.push({
        commandIndex,
        commandType: command.type,
        actorId: command.actorId,
        abilityId: ability.id,
        requestedFrame: anchored.requestedFrame,
        startFrame,
        cancelFrame: null,
        animationEndFrame: null,
        endFrame: startFrame,
        status: "rejected",
        waitedFrames: startFrame - anchored.requestedFrame,
        failureCode: "INSUFFICIENT_ENERGY",
        energyBefore: runtimeEnergyFailure.energyBefore,
        energyCost: runtimeEnergyFailure.energyCost
      });
      return;
    }

    const recoveryFrames =
      ability.chargeRecoveryFrames ?? ability.cooldownFrames;
    chargeFrames[chargeIndex] = startFrame + recoveryFrames;
    chargeAvailability.set(ability.id, chargeFrames);
    const followupKind = commandFollowupKind(
      timeline.commands[commandIndex + 1]
    );
    const cancelOffset =
      (followupKind === null
        ? undefined
        : ability.cancelFrames?.[followupKind]) ?? ability.cancelFrame;
    rotation.push(
      compileAbilityAction(
        ability,
        commandIndex,
        startFrame,
        cancelOffset
      )
    );
    applyAbilityStates(ability, commandIndex, startFrame);
    const cancelFrame = startFrame + cancelOffset;
    const animationEndFrame = startFrame + ability.animationEndFrame;
    cursor = cancelFrame;
    commandResults.push({
      commandIndex,
      commandType: command.type,
      actorId: command.actorId,
      abilityId: ability.id,
      requestedFrame: anchored.requestedFrame,
      startFrame,
      cancelFrame,
      animationEndFrame,
      endFrame: cancelFrame,
      status:
        startFrame > anchored.requestedFrame ? "waited" : "executed",
      waitedFrames: startFrame - anchored.requestedFrame
    });
  });

  expireStatesThrough(durationFrames);

  return {
    config: {
      ...withoutTimeline(config),
      rotation
    },
    execution: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: timeline.legalityMode,
      initialActiveCharacterId: timeline.initialActiveCharacterId,
      finalActiveCharacterId: activeCharacterId,
      totalFrames: cursor,
      commandResults,
      adjustments,
      failures,
      stateLog
    }
  };
}
