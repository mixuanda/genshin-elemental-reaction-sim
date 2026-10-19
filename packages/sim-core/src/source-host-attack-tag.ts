/** The pinned b4ae769 and a7dc4bf enums share exactly this initial 0..6 range.
 * Classic emits these names; Stellar's bridge emits the literal numeric aliases.
 * Their enums diverge at 7 (WeaponSkill versus RelicSkill), so no other numeric
 * spelling is inferred. Wire receipts and comparisons between receipts stay raw.
 * Source: both lanes' pkg/core/attacks/attack.go and sourcehost/attack.go. */
const sharedPinnedTagAliases: Readonly<Record<string, string>> = {
  "AttackTag(0)": "AttackTagNone",
  "AttackTag(1)": "AttackTagNormal",
  "AttackTag(2)": "AttackTagExtra",
  "AttackTag(3)": "AttackTagPlunge",
  "AttackTag(4)": "AttackTagElementalArt",
  "AttackTag(5)": "AttackTagElementalArtHold",
  "AttackTag(6)": "AttackTagElementalBurst",
};

/** Compare an original receipt against a reviewed symbolic contract tag. */
export function sourceHostAttackTagMatches(actual: string, expected: string): boolean {
  return actual === expected || Object.hasOwn(sharedPinnedTagAliases, actual)
    && sharedPinnedTagAliases[actual] === expected;
}
