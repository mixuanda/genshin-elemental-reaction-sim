import type {
  Element,
  ParticleCount,
  ParticleElement,
  ParticleKind
} from "@genshin-dps-lab/schemas";

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Small deterministic PRNG used only for versioned simulation rolls.
 *
 * Changing this algorithm is an engine-version change because particle counts
 * are part of the reproducible result contract.
 */
export class SeededRandom {
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
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error(`maxExclusive must be a positive integer, got ${maxExclusive}`);
    }
    return Math.floor(this.next() * maxExclusive);
  }
}

export function resolveParticleCount(
  count: ParticleCount,
  random: SeededRandom
): number {
  if (typeof count === "number") return count;
  const step = count.step ?? 1;
  const stepCount = Math.floor((count.max - count.min) / step + 1e-9);
  return Number((count.min + random.integer(stepCount + 1) * step).toFixed(12));
}

export interface ParticleEnergyInput {
  particleElement: ParticleElement;
  particleKind: ParticleKind;
  particleCount: number;
  receiverElement: Element;
  isOnField: boolean;
  partySize: number;
  energyRecharge: number;
}

export interface ParticleEnergyCalculation {
  baseEnergyPerParticle: number;
  kindMultiplier: number;
  fieldMultiplier: number;
  isSameElement: boolean;
  rawEnergy: number;
  energyRecharge: number;
  finalEnergy: number;
}

/**
 * Particle distribution aligned with the current gcsim energy implementation:
 * same/neutral/different particles grant 3/2/1 base energy, orbs multiply the
 * base by 3, off-field characters use 1 - 0.1 × partySize, then ER applies.
 */
export function calculateParticleEnergy(
  input: ParticleEnergyInput
): ParticleEnergyCalculation {
  const isSameElement = input.particleElement === input.receiverElement;
  const baseEnergyPerParticle = isSameElement
    ? 3
    : input.particleElement === "neutral"
      ? 2
      : 1;
  const kindMultiplier = input.particleKind === "orb" ? 3 : 1;
  const fieldMultiplier = input.isOnField
    ? 1
    : Math.max(0, 1 - 0.1 * input.partySize);
  const energyRecharge = Math.max(0, input.energyRecharge);
  const rawEnergy = Number(
    (
      baseEnergyPerParticle *
      kindMultiplier *
      input.particleCount *
      fieldMultiplier
    ).toFixed(12)
  );
  const finalEnergy = Number((rawEnergy * energyRecharge).toFixed(12));
  return {
    baseEnergyPerParticle,
    kindMultiplier,
    fieldMultiplier,
    isSameElement,
    rawEnergy,
    energyRecharge,
    finalEnergy
  };
}
