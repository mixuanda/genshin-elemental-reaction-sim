/** Fixed shared source values; the host still owns real damage callbacks and task ordering. */
const revision = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const source = (path: string) => `https://github.com/genshinsim/gcsim/blob/${revision}/${path}`;
export const SACRIFICIAL = {
  sourceRevision: revision,
  // Preserve the source floating point expression because the RNG comparison is strict <.
  probabilities: [1, 2, 3, 4, 5].map(refinement => 0.3 + refinement * 0.1),
  cooldownFrames: [1800, 1560, 1320, 1140, 960],
  sourceRef: source("internal/weapons/common/sacrificial.go"),
  sourceRefs: [source("internal/weapons/common/sacrificial.go"), source("internal/template/character/cooldown.go"), source("pkg/core/player/character/mods.go"), source("pkg/core/task/task.go")]
} as const;

export const SACRIFICIAL_WEAPONS = [
  {weaponId: "sacrificialsword", catalogWeaponId: "weapon:11403", weaponName: "祭礼剑", sourceRef: source("internal/weapons/sword/sacrificial/sacrificial.go")},
  {weaponId: "sacrificialgreatsword", catalogWeaponId: "weapon:12403", weaponName: "祭礼大剑", sourceRef: source("internal/weapons/claymore/sacrificial/sacrificial.go")},
  {weaponId: "sacrificialfragments", catalogWeaponId: "weapon:14403", weaponName: "祭礼残章", sourceRef: source("internal/weapons/catalyst/sacrificial/sacrificial.go")},
  {weaponId: "sacrificialbow", catalogWeaponId: "weapon:15403", weaponName: "祭礼弓", sourceRef: source("internal/weapons/bow/sacrificial/sacrificial.go")}
] as const;
export type SacrificialWeaponId = typeof SACRIFICIAL_WEAPONS[number]["weaponId"];

export function sacrificialProbability(refinement: number): number {
  const value = SACRIFICIAL.probabilities[refinement - 1];
  if (value === undefined) throw new Error("祭礼精炼必须为 R1–R5。");
  return value;
}
export function sacrificialCooldownFrames(refinement: number): number {
  const value = SACRIFICIAL.cooldownFrames[refinement - 1];
  if (value === undefined) throw new Error("祭礼精炼必须为 R1–R5。");
  return value;
}
/** Source StatusIsActive expires only once Expiry < frame; hitlag extension is host-owned. */
export function sacrificialCooldownIsActive(expiryFrame: number | null, frame: number): boolean {
  return expiryFrame !== null && frame <= expiryFrame;
}
