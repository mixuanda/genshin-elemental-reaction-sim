/** Fixed TTDS values; receiving a buff and calculating its ATK contribution are separate operations. */
export const THRILLING_TALES = {
  catalogWeaponId: "weapon:14302",
  weaponName: "讨龙英杰谭",
  coefficients: [.24, .30, .36, .42, .48],
  durationFrames: 600,
  cooldownFrames: 1200,
  sourceRef: "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/catalyst/thrilling/thrilling.go",
  sourceRefs: [
    "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/catalyst/thrilling/thrilling.go",
    "https://github.com/theBowja/genshin-db/blob/49a6544a6c6ae36089cb42fa591fc46f01de8bcf/src/data/ChineseSimplified/weapons/thrillingtalesofdragonslayers.json",
    "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/attributes/stats.go"
  ]
} as const;
export function thrillingTalesCoefficient(refinement: number): number {
  const value=THRILLING_TALES.coefficients[refinement-1];
  if(value===undefined)throw new Error("讨龙精炼必须为 R1–R5。");
  return value;
}
