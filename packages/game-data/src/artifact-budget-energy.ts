/** One recipient's actual, already resolved energy events, in execution order.
 * Particle energy must be normalized to 100% ER using the source's element,
 * on/off-field and party-size calculation. Do not use the capped received delta.
 * Random particles must already be resolved, not substituted with an expectation.
 */
export type ArtifactBudgetEnergyEvent = {
  id: string; frame: number; order: number; sourceRef: string;
} & (
  | { kind: "particle-arrival"; energyAt100PercentER: number }
  | { kind: "flat-energy"; amount: number }
  | { kind: "burst-reserve"; reservationId: string; amount: number }
  | { kind: "burst-spend"; amount: number; reservationId?: string }
  | { kind: "burst-release"; reservationId: string }
);

export interface ArtifactBudgetEnergyContract {
  id: string;
  actorId: string;
  /** Finite horizon, not a claim that action/particle timing survives an ER change. */
  scope: "declared-fixed-event-schedule";
  capacity: number;
  initialEnergy: number;
  /** Total multiplier excluding artifacts: 1 means the base 100% ER. */
  nonArtifactEnergyRecharge: number;
  /** Explicit even when zero; use initialEnergy to require the same ending reserve. */
  minimumEndingEnergy: number;
  events: readonly ArtifactBudgetEnergyEvent[];
}

export interface ArtifactBudgetEnergyReplay {
  contractId: string; actorId: string;
  scope: "declared-fixed-event-schedule";
  actionAndParticleTiming: "requires-candidate-resimulation";
  status: "satisfied" | "unsatisfied";
  totalEnergyRecharge: number;
  endingEnergy: number;
  minimumEndingEnergy: number;
  endingReservedEnergy: number;
  trace: { eventId: string; frame: number; order: number; kind: ArtifactBudgetEnergyEvent["kind"];
    before: number; requested: number; applied: number; wasted: number; after: number;
    reservedBefore: number; reservedAfter: number; blocked: boolean }[];
  failure?: { kind: "insufficient-energy" | "ending-reserve" | "outstanding-reservation"; eventId: string | null;
    required: number; available: number; shortfall: number };
}

const EPSILON = 1e-9;
const quantize = (value: number) => Number(value.toFixed(12));
const nonnegative = (value: number, label: string) => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and nonnegative`);
};

function validate(contract: ArtifactBudgetEnergyContract, artifactEnergyRechargeBonus: number): void {
  if (!contract.id?.trim() || !contract.actorId?.trim() || contract.scope !== "declared-fixed-event-schedule")
    throw new Error("Energy contract requires an identity, recipient and explicit fixed-event scope");
  nonnegative(contract.capacity, "capacity");
  if (contract.capacity === 0) throw new Error("capacity must be positive");
  nonnegative(contract.initialEnergy, "initialEnergy");
  nonnegative(contract.nonArtifactEnergyRecharge, "nonArtifactEnergyRecharge");
  nonnegative(contract.minimumEndingEnergy, "minimumEndingEnergy");
  nonnegative(artifactEnergyRechargeBonus, "artifactEnergyRechargeBonus");
  if (contract.initialEnergy > contract.capacity || contract.minimumEndingEnergy > contract.capacity)
    throw new Error("Initial energy and ending reserve cannot exceed capacity");
  if (!Number.isFinite(contract.nonArtifactEnergyRecharge + artifactEnergyRechargeBonus)) throw new Error("Total ER must be finite");
  const ids = new Set<string>();
  const reservations = new Map<string, number>();
  const reservationIds = new Set<string>();
  let previousFrame = -1;
  let previousOrder = -1;
  for (const event of contract.events) {
    if (!event.id?.trim() || ids.has(event.id) || !event.sourceRef?.trim()) throw new Error("Energy event identities must be unique and source-backed");
    ids.add(event.id);
    if (!Number.isSafeInteger(event.frame) || event.frame < 0 || !Number.isSafeInteger(event.order) || event.order < 0
      || event.frame < previousFrame || (event.frame === previousFrame && event.order <= previousOrder))
      throw new Error("Energy events require strict (frame, order) execution order; events are never silently sorted");
    previousFrame = event.frame;
    previousOrder = event.order;
    if (event.kind === "particle-arrival") nonnegative(event.energyAt100PercentER, "particle energy at 100% ER");
    else if (event.kind === "flat-energy" || event.kind === "burst-spend" || event.kind === "burst-reserve") nonnegative(event.amount, "event amount");
    else if (event.kind !== "burst-release") throw new Error("Unsupported energy event kind");
    if (event.kind === "burst-reserve") {
      if (!event.reservationId?.trim() || reservationIds.has(event.reservationId)) throw new Error("Energy reservation identities must be nonempty and unique");
      reservations.set(event.reservationId, event.amount);
      reservationIds.add(event.reservationId);
    } else if (event.kind === "burst-release" || (event.kind === "burst-spend" && event.reservationId !== undefined)) {
      const amount = reservations.get(event.reservationId!);
      if (amount === undefined || (event.kind === "burst-spend" && amount !== event.amount))
        throw new Error("Burst debit/release requires an earlier unmatched reservation with the same cost");
      reservations.delete(event.reservationId!);
    }
    if ((event.kind === "burst-spend" || event.kind === "burst-reserve") && (event.amount === 0 || event.amount > contract.capacity))
      throw new Error("Burst cost must be positive and cannot exceed capacity");
  }
}

/** Rejects an unaffordable Q before applying its spend or any later event.
 * No infinite energy, initial-energy refill, timing correction or ER floor is inferred.
 */
export function replayArtifactBudgetEnergy(
  contract: ArtifactBudgetEnergyContract, artifactEnergyRechargeBonus: number,
): ArtifactBudgetEnergyReplay {
  validate(contract, artifactEnergyRechargeBonus);
  const totalEnergyRecharge = contract.nonArtifactEnergyRecharge + artifactEnergyRechargeBonus;
  let energy = quantize(contract.initialEnergy);
  let reserved = 0;
  const reservations = new Map<string, number>();
  const result: ArtifactBudgetEnergyReplay = { contractId: contract.id, actorId: contract.actorId, scope: contract.scope,
    actionAndParticleTiming: "requires-candidate-resimulation", status: "satisfied", totalEnergyRecharge,
    endingEnergy: energy, endingReservedEnergy: 0, minimumEndingEnergy: contract.minimumEndingEnergy, trace: [] };
  for (const event of contract.events) {
    const before = energy;
    const reservedBefore = reserved;
    const requested = event.kind === "particle-arrival" ? quantize(event.energyAt100PercentER * totalEnergyRecharge)
      : event.kind === "burst-release" ? reservations.get(event.reservationId)! : event.amount;
    if (!Number.isFinite(requested)) throw new Error("Energy event produced a non-finite gain");
    const available = event.kind === "burst-spend" && event.reservationId !== undefined ? energy : quantize(energy - reserved);
    const blocked = (event.kind === "burst-spend" || event.kind === "burst-reserve") && available + EPSILON < requested;
    if (event.kind === "burst-reserve") {
      if (!blocked) {
        reservations.set(event.reservationId, requested);
        reserved = quantize(reserved + requested);
      }
    } else if (event.kind === "burst-release") {
      reservations.delete(event.reservationId);
      reserved = quantize(Math.max(0, reserved - requested));
    } else if (event.kind === "burst-spend") {
      if (!blocked) {
        energy = quantize(Math.max(0, energy - requested));
        if (event.reservationId !== undefined) {
          reservations.delete(event.reservationId);
          reserved = quantize(Math.max(0, reserved - requested));
        }
      }
    } else energy = quantize(Math.min(contract.capacity, energy + requested));
    result.trace.push({ eventId: event.id, frame: event.frame, order: event.order, kind: event.kind,
      before, requested, applied: event.kind === "burst-spend" ? before - energy : energy - before,
      wasted: event.kind === "particle-arrival" || event.kind === "flat-energy" ? quantize(Math.max(0, before + requested - contract.capacity)) : 0,
      after: energy, reservedBefore, reservedAfter: reserved, blocked });
    if (blocked) {
      result.status = "unsatisfied";
      result.failure = { kind: "insufficient-energy", eventId: event.id, required: requested, available, shortfall: quantize(requested - available) };
      break;
    }
  }
  result.endingEnergy = energy;
  result.endingReservedEnergy = reserved;
  if (result.status === "satisfied" && reserved > EPSILON) {
    result.status = "unsatisfied";
    result.failure = { kind: "outstanding-reservation", eventId: null, required: reserved, available: 0, shortfall: reserved };
  }
  if (result.status === "satisfied" && energy + EPSILON < contract.minimumEndingEnergy) {
    result.status = "unsatisfied";
    result.failure = { kind: "ending-reserve", eventId: null, required: contract.minimumEndingEnergy,
      available: energy, shortfall: quantize(contract.minimumEndingEnergy - energy) };
  }
  return result;
}

/** Searches only the legal template's ER capacity, with fixed event timing.
 * null means this template cannot meet the supplied schedule, not infinite ER.
 */
export function minimumArtifactEnergyForFixedSchedule(
  contract: ArtifactBudgetEnergyContract, maximumArtifactBonus: number,
): number | null {
  nonnegative(maximumArtifactBonus, "maximumArtifactBonus");
  if (replayArtifactBudgetEnergy(contract, 0).status === "satisfied") return 0;
  if (replayArtifactBudgetEnergy(contract, maximumArtifactBonus).status !== "satisfied") return null;
  let lower = 0;
  let upper = maximumArtifactBonus;
  for (let iteration = 0; iteration < 48; iteration++) {
    const candidate = (lower + upper) / 2;
    if (replayArtifactBudgetEnergy(contract, candidate).status === "satisfied") upper = candidate;
    else lower = candidate;
  }
  return upper;
}
