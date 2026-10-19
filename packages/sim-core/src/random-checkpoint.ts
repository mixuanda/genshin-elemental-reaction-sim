import type { SimConfig } from "@genshin-dps-lab/schemas";
import type { SeededRandomState } from "./energy";
import type { NormalHitEnergyCheckpointState } from "./normal-hit-energy";
import type { FavoniusCheckpointState } from "./favonius";
import type { SacrificialCheckpointState } from "./sacrificial";

/** These are live runtime captures, not reconstructed roll histories. */
export interface RandomExecutionCapturedState {
  dendroCorePosition?: SeededRandomState;
  crystallizePosition?: SeededRandomState;
  particleCount?: SeededRandomState;
  particleTrigger?: SeededRandomState;
  critical?: SeededRandomState;
  normalHitEnergy?: NormalHitEnergyCheckpointState;
  favonius?: FavoniusCheckpointState;
  sacrificial?: SacrificialCheckpointState;
  weaponProc?: SeededRandomState;
  /** The live `${randomSeed}:artifact-damage:echoes` stream, never inferred from proc counts. */
  artifactDamage?: SeededRandomState;
}

export function particleRandomness(config: SimConfig): { count: boolean; trigger: boolean } {
  const particles = [...config.rotation.flatMap(source => source.particles ?? []),
    ...(config.timeline?.abilities ?? []).flatMap(source => source.particles ?? [])];
  return { count: particles.some(particle => typeof particle.count !== "number"),
    trigger: particles.some(particle => particle.trigger?.probability !== undefined) };
}

/** Preserve every PRNG word and counter; normalise only known clock deadlines. */
export function normalizeRandomCheckpoint(state: RandomExecutionCapturedState | undefined, tick: number) {
  if (state === undefined || Object.keys(state).length === 0) return undefined;
  const streams = {
    ...(state.dendroCorePosition === undefined ? {} : { dendroCorePosition: state.dendroCorePosition }),
    ...(state.crystallizePosition === undefined ? {} : { crystallizePosition: state.crystallizePosition }),
    ...(state.particleCount === undefined ? {} : { particleCount: state.particleCount }),
    ...(state.particleTrigger === undefined ? {} : { particleTrigger: state.particleTrigger }),
    ...(state.critical === undefined ? {} : { critical: state.critical }),
    ...(state.normalHitEnergy === undefined ? {} : { normalHitEnergy: state.normalHitEnergy.random }),
    ...(state.favonius === undefined ? {} : { favonius: state.favonius.random }),
    ...(state.sacrificial === undefined ? {} : { sacrificial: state.sacrificial.random }),
    ...(state.weaponProc === undefined ? {} : { weaponProc: state.weaponProc }),
    ...(state.artifactDamage === undefined ? {} : { artifactDamage: state.artifactDamage }),
  };
  return { version: "named-rng-state-v1" as const, streams,
    ...(state.normalHitEnergy === undefined ? {} : { normalHitEnergy: {
      actors: state.normalHitEnergy.actors,
      globalIcdRemainingTicks: Math.max(0, state.normalHitEnergy.globalIcdReadyFrame - tick),
      lastEventAgeTicks: tick - state.normalHitEnergy.lastFrame,
    } }),
    ...(state.favonius === undefined ? {} : { favonius: {
      actors: state.favonius.actors.map(actor => ({ ...actor,
        cooldownRemainingTicks: Math.max(0, (state.favonius!.readyFrames.get(actor.actorId) ?? 0) - tick) })),
    } }),
    ...(state.sacrificial === undefined ? {} : { sacrificial: {
      actors: state.sacrificial.actors.map(actor => {
        const expiry = state.sacrificial!.cooldownExpiresFrames.get(actor.actorId);
        return { ...actor, cooldownRemainingTicks: expiry !== undefined && expiry >= tick ? expiry - tick : null };
      }),
    } }),
  };
}
