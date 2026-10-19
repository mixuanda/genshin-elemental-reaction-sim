# Default-source Bond of Life resource

Status: fixed-source-assumed, not game verified. The model ID is `gcsim-b4ae769-same-heal-remainder-v1`. This implements an explicitly declared generic resource and the fixed source's default `ReceiveHeal`; it does not identify a character by name or install character/weapon/artifact overrides.

## Fixed evidence

Revision: gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`. The archive at `packages/game-data/sources/bond-of-life/source.json.gz` contains nine original files including the license. Every file's Git blob SHA-1 was verified against the saved non-truncated Git tree for that revision. Manifest: `packages/game-data/sources/bond-of-life/manifest.json`; archive SHA-256: `432f0d09adcf19a1e8e1d74ebbe52b1e249a102854ad3101c8876e30f7603d59` (7,150 bytes).

| Rule | Fixed source | Adopted meaning |
| --- | --- | --- |
| Resource representation | [hp.go:35–59](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/hp.go#L35) | Debt is an absolute amount. Nonzero additions/removals clamp to [0, 2×current MaxHP]. Ratio additions first multiply current MaxHP. This model retains static MaxHP. |
| Zero request and callback | [hp.go:48](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/hp.go#L48) | Exact zero request returns with no source event. A nonzero request still emits when cap/clamp causes zero actual change. The source callback amount is old debt minus new debt, the inverse sign of actual resource change. |
| Healing bonuses | [heal.go:9](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/heal.go#L9) | Base fixed amount or target-MaxHP ratio is multiplied by 1 + source healing bonus + recipient healing bonus before debt absorption. |
| Default absorption and ordering | [heal.go:76](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/heal.go#L76) | Calculate remaining healing as max(full heal − old debt, 0); remove debt using the full heal amount; then update HP. Debt mutation precedes HP mutation; the outer `OnHeal` occurs afterward. |
| Overheal | [heal.go:36](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/heal.go#L36) | Overheal is remaining heal beyond missing HP. Absorbed debt is neither effective HP healing nor overheal. |
| Expiry | Generic hp.go/heal.go | The generic pool has no duration, expiry task or passive drain. An explicitly scheduled action can remove it; the model invents no timeout. |

## Preserved unknowns and exclusions

The default `ReceiveHeal` explicitly contains a TODO about whether healing can occur in the same heal that clears debt. The adopted model follows that source's immediate remainder behavior and displays this assumption in configuration, result ledger and AST warnings. No claim is made that it independently matches current in-game behavior.

[Arlecchino's override](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/arlecchino/arlecchino.go#L79) rejects healing other than its own named Burst heal. [Clorinde's override](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/clorinde/heal.go#L10) can convert healing into debt during its skill state, except its own named healing. Those files are archived as evidence of excluded overrides; this generic mode does not silently reproduce them.

True death/revival, incoming enemy attacks and general debt-triggered passives remain separate unsupported work. The source stores raw debt rather than an HP ratio; a MaxHP change does not proactively rescale/reclamp it. Dynamic declared HP buffs now require the separate explicit `gcsim-b4ae769-ratio-preserving-v1` model; without it, the existing static-HP restriction remains. Its source and retained callback boundary are recorded in [the dynamic-MaxHP audit](player-max-hp-source-audit.md). Enemy shields are not inferred from existing player crystallize-shield code.

## Execution contract

The optional `bondOfLifeModel` requires the explicit model ID and one `initialRatio` in [0, 2] for every configured actor. It requires the existing player HP pool and a legal frame timeline. Initial values are user-declared starting conditions; zero is not inferred from a character or equipped item.

`healthChanges` accepts `bond-add` and `bond-remove` using a nonnegative fixed value or target-MaxHP ratio. They use the existing actual accepted-action queue, delay and self/active/party/specific-actor resolution. They change debt without directly healing or consuming HP. Existing heals, including already-supported periodic healing, use the same live pool. Plain HP consumption and reaction self-damage do not pay debt.

Each enabled health event contains the actual debt before/after, requested and actual debt deltas, absorbed healing, remaining healing, and the source callback's emission condition/sign. These are audit facts; recording them does not automatically activate an unmapped passive. The result retains each actor's initial and final absolute debt. Independent result import reconstructs the pool from configuration and accepted events instead of trusting serialized `debtBefore`. The source's assumed status remains visible after JSON round-trip.

The actual checkpoint stores the current debt pool alongside current HP. Existing pending health-change tasks already retain the operation, coefficient/basis, targets and source; no invented timer is added. Validation is limited to the new shared module test file and the parent task's integration checks.
