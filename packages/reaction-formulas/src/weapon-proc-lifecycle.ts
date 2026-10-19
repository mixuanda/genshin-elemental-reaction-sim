/** Fixed source clocks. The host supplies real hooks and explicitly assumes no character hitlag. */
export const WEAPON_PROC_LIFECYCLE = {
  flute: {noteCooldownFrames: 30, noteDurationFrames: 1800, requiredNotes: 5},
  debateclub: {effectDurationFrames: 900, hitCooldownFrames: 180},
  crescentpike: {effectDurationFrames: 300},
  endoftheline: {effectDurationFrames: 900, activationCooldownFrames: 720, hitCooldownFrames: 120, procLimit: 3}
} as const;
export type WeaponProcLifecycleId = keyof typeof WEAPON_PROC_LIFECYCLE;
export interface WeaponProcLifecycleState {
  effectExpiresFrame: number | null;
  hitCooldownExpiresFrame: number | null;
  activationCooldownExpiresFrame: number | null;
  notes: number;
  procCount: number;
}
export type WeaponProcLifecycleInput =
  | {kind: "skill"; frame: number; holderOnField: boolean}
  | {kind: "particle-received"; frame: number; holderOnField: boolean}
  | {kind: "damage"; frame: number; holderOnField: boolean; isHolderDamage: boolean; attackTag: string | null; damage: number};
export type WeaponProcLifecycleOutcome = "triggered" | "note-gained" | "window-activated" | "off-field" | "wrong-owner" | "wrong-attack-tag" | "zero-damage" | "window-inactive" | "cooldown-blocked" | "activation-cooldown-blocked" | "irrelevant-hook";
export interface WeaponProcLifecycleTransition {state: WeaponProcLifecycleState; outcome: WeaponProcLifecycleOutcome}

export function createWeaponProcLifecycleState(): WeaponProcLifecycleState {
  return {effectExpiresFrame: null, hitCooldownExpiresFrame: null, activationCooldownExpiresFrame: null, notes: 0, procCount: 0};
}
/** Source StatusIsActive only checks expiry; it does not remove stale fields or counters. */
export function weaponProcLifecycleStatusActive(expiryFrame: number | null, frame: number): boolean {
  return expiryFrame !== null && frame <= expiryFrame;
}

/** Explicit source transitions only: no timer scheduler, assumed casts or invented pickups. */
export function stepWeaponProcLifecycle(weaponId: WeaponProcLifecycleId, state: WeaponProcLifecycleState, input: WeaponProcLifecycleInput): WeaponProcLifecycleTransition {
  const {frame} = input;
  const unchanged = (outcome: WeaponProcLifecycleOutcome): WeaponProcLifecycleTransition => ({state, outcome});
  const active = (expiry: number | null) => weaponProcLifecycleStatusActive(expiry, frame);
  if (input.kind === "skill") {
    if (weaponId !== "debateclub" && weaponId !== "endoftheline") return unchanged("irrelevant-hook");
    if (!input.holderOnField) return unchanged("off-field");
    if (weaponId === "debateclub") return {state: {...state, effectExpiresFrame: frame + WEAPON_PROC_LIFECYCLE.debateclub.effectDurationFrames, hitCooldownExpiresFrame: null}, outcome: "window-activated"};
    if (active(state.activationCooldownExpiresFrame)) return unchanged("activation-cooldown-blocked");
    const config = WEAPON_PROC_LIFECYCLE.endoftheline;
    return {state: {...state, effectExpiresFrame: frame + config.effectDurationFrames, activationCooldownExpiresFrame: frame + config.activationCooldownFrames, hitCooldownExpiresFrame: active(state.hitCooldownExpiresFrame) ? null : state.hitCooldownExpiresFrame, procCount: 0}, outcome: "window-activated"};
  }
  if (input.kind === "particle-received") {
    if (weaponId !== "crescentpike") return unchanged("irrelevant-hook");
    if (!input.holderOnField) return unchanged("off-field");
    return {state: {...state, effectExpiresFrame: frame + WEAPON_PROC_LIFECYCLE.crescentpike.effectDurationFrames}, outcome: "window-activated"};
  }
  const normalOrCharged = input.attackTag === "normal" || input.attackTag === "charged";
  // End of the Line checks the holder's field status before damage ownership.
  if (weaponId === "endoftheline") {
    if (!input.holderOnField) return unchanged("off-field");
    if (!input.isHolderDamage) return unchanged("wrong-owner");
    if (!active(state.effectExpiresFrame)) return unchanged("window-inactive");
    if (active(state.hitCooldownExpiresFrame)) return unchanged("cooldown-blocked");
    const procCount = state.procCount + 1, config = WEAPON_PROC_LIFECYCLE.endoftheline;
    return {state: {...state, procCount, effectExpiresFrame: procCount === config.procLimit ? null : state.effectExpiresFrame, hitCooldownExpiresFrame: procCount === config.procLimit ? state.hitCooldownExpiresFrame : frame + config.hitCooldownFrames}, outcome: "triggered"};
  }
  if (!input.isHolderDamage) return unchanged("wrong-owner");
  if (weaponId === "crescentpike") {
    if (!normalOrCharged) return unchanged("wrong-attack-tag");
    if (input.damage === 0) return unchanged("zero-damage");
    if (!active(state.effectExpiresFrame)) return unchanged("window-inactive");
    return unchanged("triggered"); // No damage-time field check and no per-hit cooldown.
  }
  if (!input.holderOnField) return unchanged("off-field");
  if (weaponId === "debateclub" && !active(state.effectExpiresFrame)) return unchanged("window-inactive");
  if (!normalOrCharged) return unchanged("wrong-attack-tag");
  if (active(state.hitCooldownExpiresFrame)) return unchanged("cooldown-blocked");
  if (weaponId === "debateclub") return {state: {...state, hitCooldownExpiresFrame: frame + WEAPON_PROC_LIFECYCLE.debateclub.hitCooldownFrames}, outcome: "triggered"};
  const config = WEAPON_PROC_LIFECYCLE.flute;
  const notes = (active(state.effectExpiresFrame) ? state.notes : 0) + 1;
  const triggered = notes === config.requiredNotes;
  return {state: {...state, notes: triggered ? 0 : notes, effectExpiresFrame: triggered ? null : frame + config.noteDurationFrames, hitCooldownExpiresFrame: frame + config.noteCooldownFrames}, outcome: triggered ? "triggered" : "note-gained"};
}
