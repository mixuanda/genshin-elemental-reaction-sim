import type {
  AuraGaugeEntry,
  AuraStateEntry,
  ReactionType,
  SimulationEventType,
  TargetStateTimeline,
  TargetStateTimelineCause,
  TargetStateTimelineLink,
  TargetStateTimelinePoint
} from "@genshin-dps-lab/schemas";

function cloneAuraState(entry: AuraStateEntry): AuraStateEntry {
  return {
    element: entry.element,
    gaugeUnits: entry.gaugeUnits,
    expiresAtFrame: entry.expiresAtFrame,
    ...(entry.expiresAtTargetFrame === undefined
      ? {}
      : {
          expiresAtTargetFrame: entry.expiresAtTargetFrame
        }),
    ...(entry.sourceSlots === undefined
      ? {}
      : {
          sourceSlots: entry.sourceSlots.map((slot) => ({
            sourceActorId: slot.sourceActorId,
            gaugeUnits: slot.gaugeUnits
          }))
        })
  };
}

function cloneAuraStates(
  entries: readonly AuraStateEntry[]
): AuraStateEntry[] {
  return entries.map(cloneAuraState);
}

function cloneAuraGauge(entry: AuraGaugeEntry): AuraGaugeEntry {
  return {
    element: entry.element,
    gaugeUnits: entry.gaugeUnits,
    ...(entry.sourceActorId === undefined
      ? {}
      : { sourceActorId: entry.sourceActorId }),
    ...(entry.sourceMutations === undefined
      ? {}
      : {
          sourceMutations: entry.sourceMutations.map((mutation) => ({
            sourceActorId: mutation.sourceActorId,
            gaugeUnitsBefore: mutation.gaugeUnitsBefore,
            consumedGaugeUnits: mutation.consumedGaugeUnits,
            gaugeUnitsAfter: mutation.gaugeUnitsAfter
          }))
        })
  };
}

function cloneAuraGauges(
  entries: readonly AuraGaugeEntry[]
): AuraGaugeEntry[] {
  return entries.map(cloneAuraGauge);
}

export function auraStateSnapshotsEqual(
  left: readonly AuraStateEntry[],
  right: readonly AuraStateEntry[]
): boolean {
  if (left.length !== right.length) return false;
  return left.every((leftEntry, index) => {
    const rightEntry = right[index];
    const bothUseTargetClockDeadline =
      leftEntry.expiresAtTargetFrame !== undefined &&
      rightEntry?.expiresAtTargetFrame !== undefined;
    if (
      rightEntry === undefined ||
      leftEntry.element !== rightEntry.element ||
      leftEntry.gaugeUnits !== rightEntry.gaugeUnits ||
      (bothUseTargetClockDeadline
        ? leftEntry.expiresAtTargetFrame !==
          rightEntry.expiresAtTargetFrame
        : leftEntry.expiresAtFrame !==
            rightEntry.expiresAtFrame ||
          leftEntry.expiresAtTargetFrame !== rightEntry.expiresAtTargetFrame)
    ) {
      return false;
    }
    const leftSlots = leftEntry.sourceSlots ?? [];
    const rightSlots = rightEntry.sourceSlots ?? [];
    return (
      leftSlots.length === rightSlots.length &&
      leftSlots.every((leftSlot, slotIndex) => {
        const rightSlot = rightSlots[slotIndex];
        return (
          rightSlot !== undefined &&
          leftSlot.sourceActorId === rightSlot.sourceActorId &&
          leftSlot.gaugeUnits === rightSlot.gaugeUnits
        );
      })
    );
  });
}

export interface TargetStateBoundaryInput {
  frame: number;
  timeSeconds: number;
  targetId: string;
  targetName: string;
  cause: Extract<
    TargetStateTimelineCause,
    "simulation-start" | "simulation-end"
  >;
  aura: readonly AuraStateEntry[];
}

export interface TargetStateEventInput {
  frame: number;
  timeSeconds: number;
  targetId: string;
  targetName: string;
  cause: Exclude<
    TargetStateTimelineCause,
    | "simulation-start"
    | "simulation-end"
    | "aura-natural-expiry"
  >;
  eventType: SimulationEventType;
  eventPriority: number;
  eventSequence: number;
  intraEventSequence: number;
  reaction?: ReactionType;
  reactions?: readonly ReactionType[];
  primaryDamageEventId?: number | null;
  links?: readonly TargetStateTimelineLink[];
  auraBefore: readonly AuraStateEntry[];
  auraApplied?: readonly AuraGaugeEntry[];
  auraConsumed?: readonly AuraGaugeEntry[];
  auraAfter: readonly AuraStateEntry[];
}

export interface TargetStateNaturalExpiryInput {
  frame: number;
  timeSeconds: number;
  targetId: string;
  targetName: string;
  auraBefore: readonly AuraStateEntry[];
  auraAfter: readonly AuraStateEntry[];
}

export interface TargetReactableTickDecayInput {
  frame: number;
  timeSeconds: number;
  targetId: string;
  targetName: string;
  aura: readonly AuraStateEntry[];
}

/**
 * Append-only recorder for the core-owned target state timeline.
 *
 * Point array order is authoritative. In particular, callers record directly
 * beside each AuraEngine call so the recorder preserves queue order and
 * intra-event mutations without reconstructing them from result logs.
 */
export class TargetStateTimelineRecorder {
  private readonly points: TargetStateTimelinePoint[] = [];
  private readonly latestAuraByTarget = new Map<
    string,
    AuraStateEntry[]
  >();
  private readonly latestFrameByTarget = new Map<string, number>();

  constructor(
    private readonly resolveTargetFrame?: (
      targetId: string,
      globalFrame: number
    ) => number
  ) {}

  private append(point: Omit<TargetStateTimelinePoint, "id">): void {
    const targetFrame =
      point.targetFrame ??
      this.resolveTargetFrame?.(point.targetId, point.frame);
    const emitted = {
      ...point,
      ...(targetFrame === undefined ? {} : { targetFrame }),
      id: this.points.length
    } satisfies TargetStateTimelinePoint;
    this.points.push(emitted);
    this.latestAuraByTarget.set(
      emitted.targetId,
      emitted.auraAfter
    );
    this.latestFrameByTarget.set(emitted.targetId, emitted.frame);
  }

  recordBoundary(input: TargetStateBoundaryInput): void {
    this.append({
      frame: input.frame,
      timeSeconds: input.timeSeconds,
      targetId: input.targetId,
      targetName: input.targetName,
      pointKind: "boundary",
      cause: input.cause,
      eventType: null,
      eventPriority: null,
      eventSequence: null,
      intraEventSequence: null,
      reaction: "none",
      reactions: [],
      primaryDamageEventId: null,
      links: [],
      auraBefore: cloneAuraStates(input.aura),
      auraApplied: [],
      auraConsumed: [],
      auraAfter: cloneAuraStates(input.aura)
    });
  }

  recordEvent(input: TargetStateEventInput): void {
    const auraApplied = cloneAuraGauges(input.auraApplied ?? []);
    const auraConsumed = cloneAuraGauges(input.auraConsumed ?? []);
    const auraBefore = cloneAuraStates(input.auraBefore);
    const auraAfter = cloneAuraStates(input.auraAfter);
    const mutation =
      auraApplied.length > 0 ||
      auraConsumed.length > 0 ||
      !auraStateSnapshotsEqual(auraBefore, auraAfter);
    this.append({
      frame: input.frame,
      timeSeconds: input.timeSeconds,
      targetId: input.targetId,
      targetName: input.targetName,
      pointKind: mutation ? "mutation" : "observation",
      cause: input.cause,
      eventType: input.eventType,
      eventPriority: input.eventPriority,
      eventSequence: input.eventSequence,
      intraEventSequence: input.intraEventSequence,
      reaction: input.reaction ?? "none",
      reactions: [...(input.reactions ?? [])],
      primaryDamageEventId: input.primaryDamageEventId ?? null,
      links: (input.links ?? []).map((link) => ({ ...link })),
      auraBefore,
      auraApplied,
      auraConsumed,
      auraAfter
    });
  }

  recordNaturalExpiry(input: TargetStateNaturalExpiryInput): void {
    this.append({
      frame: input.frame,
      timeSeconds: input.timeSeconds,
      targetId: input.targetId,
      targetName: input.targetName,
      pointKind: "derived",
      cause: "aura-natural-expiry",
      eventType: null,
      eventPriority: null,
      eventSequence: null,
      intraEventSequence: null,
      reaction: "none",
      reactions: [],
      primaryDamageEventId: null,
      links: [],
      auraBefore: cloneAuraStates(input.auraBefore),
      auraApplied: [],
      auraConsumed: [],
      auraAfter: cloneAuraStates(input.auraAfter)
    });
  }

  recordReactableTickDecay(
    input: TargetReactableTickDecayInput
  ): void {
    this.append({
      frame: input.frame,
      timeSeconds: input.timeSeconds,
      targetId: input.targetId,
      targetName: input.targetName,
      pointKind: "derived",
      cause: "target-reactable-tick-decay",
      eventType: null,
      eventPriority: null,
      eventSequence: null,
      intraEventSequence: null,
      reaction: "none",
      reactions: [],
      primaryDamageEventId: null,
      links: [],
      auraBefore: cloneAuraStates(input.aura),
      auraApplied: [],
      auraConsumed: [],
      auraAfter: cloneAuraStates(input.aura)
    });
  }

  latestAuraView(targetId: string): readonly AuraStateEntry[] {
    return this.latestAuraByTarget.get(targetId) ?? [];
  }

  latestFrame(targetId: string): number {
    return this.latestFrameByTarget.get(targetId) ?? 0;
  }

  synchronize(
    targetId: string,
    frame: number,
    aura: readonly AuraStateEntry[]
  ): void {
    this.latestAuraByTarget.set(targetId, cloneAuraStates(aura));
    this.latestFrameByTarget.set(targetId, frame);
  }

  result(): TargetStateTimeline {
    return {
      version: "1.0.0",
      points: this.points
    };
  }
}
