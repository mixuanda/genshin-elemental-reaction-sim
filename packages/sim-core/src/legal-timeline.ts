import type {
  AbilityDefinition,
  ActionDefinition,
  LegalTimelineCommand,
  SimConfig,
  TimelineAdjustment,
  TimelineCommandResult,
  TimelineExecution,
  TimelineFailure,
  TimelineFailureCode
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
  startFrame: number
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
            ({ frame = 0, ...energy }) => ({
              ...energy,
              offset: toSeconds(frame)
            })
          )
        }),
    timelineCommandIndex: commandIndex,
    sourceAbilityId: ability.id,
    startFrame,
    cancelFrame: startFrame + ability.cancelFrame,
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

export function compileLegalTimeline(config: SimConfig): CompiledTimeline {
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
  let cursor = 0;
  let activeCharacterId = timeline.initialActiveCharacterId;

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
      waitedFrames: 0,
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
    if (command.type === "wait") {
      const startFrame = cursor;
      cursor += command.frames;
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

    const recoveryFrames =
      ability.chargeRecoveryFrames ?? ability.cooldownFrames;
    chargeFrames[chargeIndex] = startFrame + recoveryFrames;
    chargeAvailability.set(ability.id, chargeFrames);
    rotation.push(
      compileAbilityAction(ability, commandIndex, startFrame)
    );
    const cancelFrame = startFrame + ability.cancelFrame;
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
      failures
    }
  };
}
