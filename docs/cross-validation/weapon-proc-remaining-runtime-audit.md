# Remaining independent weapon callbacks: fixed-source audit

Status: source-backed provisional. Automatic models now cover 15 of the 16 mapped independent-proc weapons. This increment adds The Viridescent Hunt and Sword of Narzissenkreuz. Eye of Perception remains calculator-only with an explicit automatic-trigger blocker. No current-game verification or external simulator run was performed.

The three weapon files in `/tmp/gidps-gcsim-b4ae769` were compared byte-for-byte with the existing `packages/game-data/sources/weapon-proc-final-four/source.json.gz` archive. Its manifest pins gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`, genshin-db `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`, and archive SHA-256 `9d9ecac13a0b2794aa8303aa20128478e5c2754dff476b24ab3a57ca53454d1d`. The companion Optimizer archive is pinned to `180a0a1015cb725c7570cd828eb086749960df98`. Those archives retain their original archival-stage scope description; this document records the subsequent runtime adoption.

## Adopted behavior

| Weapon | Trigger and cooldown | Snapshot and delivery | Limits |
| --- | --- | --- | --- |
| The Viridescent Hunt | Owner, front field, normal/charged tag, cooldown, then `roll <= .5`; no nonzero-damage gate. Cooldown `900 - 60R` frames. | Nine calls in the successful callback immediately sample stats and fix a radius-3 centre at the triggering target. Global deliveries at +1, +31, …, +241. No later on-field check or cancellation. | Local named RNG is reproducible, not gcsim's shared RNG. Source has no attraction movement. Nine endpoint ticks are source behavior, not independently game-verified. Existing random full-cycle checkpoint blocker is preserved. |
| Sword of Narzissenkreuz | Explicit `hasInnateArkhe` is required. If true, source subscribes to no callback and runtime produces no attempts. Otherwise owner, front field, normal/charged/plunge tag, cooldown; no RNG or nonzero-damage gate. Cooldown 720 frames. | A +6 character task samples stats and the original target's current position when it executes, then immediately queues radius-3 physical damage. Switching out after triggering does not cancel it. | The fixed source calls +6 a rough estimate; the supported mode explicitly assumes no character hitlag. Source Arkhe polarity only logs a parameter and retains a TODO; elemental/Arkhe interactions are not implemented or inferred. |

Cooldown status expiry is inclusive: expiry frame remains blocked, next frame can trigger. Source statuses and Sword character tasks are hitlag affected; the model continues its explicit `fixed-source-no-character-hitlag-v1` scope. Ordinary direct damage callbacks, including actual weapon damage, are covered; special Lunar/Stellar and reaction-damage callback coverage is not claimed.

Sources:

- [Viridescent callback and nine QueueAttack calls](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/bow/viridescent/viridescent.go#L33)
- [QueueAttack immediately snapshots when snapshotDelay is zero](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/attack.go#L69)
- [Circle centre captures its current target position](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/combat/hitbox.go#L50)
- [Sword innate eligibility, gates and delayed task](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/sword/swordofnarzissenkreuz/swordofnarzissenkreuz.go#L51)
- [Inclusive modifier expiry](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/modifier/modifier.go#L117)

## Eye of Perception: retained blocker

The adopted single-bolt coefficients remain the fixed catalogue/Optimizer values 2.4 / 2.7 / 3 / 3.3 / 3.6. Fixed gcsim instead computes `2.1 * R * .3` (0.63 / 1.26 / 1.89 / 2.52 / 3.15) and omits the catalogue's 50% probability gate. The catalogue does not specify the RNG equality comparison. We do not combine that conflicting trigger implementation with assumed probability semantics to claim a source-certified automatic model.

The fixed gcsim chain also requires nearest eligible living target searches within radius 8, an initial +10 projectile and up to four subsequent +10 hops, a shared initial snapshot, radius-.6 centres fixed at each target selection, and inclusive 36-frame bounce marks. Only the first actual enemy callback of each local AoE advances the chain. These facts do not resolve the coefficient/probability conflict. The explicit blocker and single-hit calculator remain visible.

- [Eye source coefficient, missing RNG and target-chain implementation](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/catalyst/perception/perception.go)
- [Pinned catalogue](https://github.com/theBowja/genshin-db/blob/49a6544a6c6ae36089cb42fa591fc46f01de8bcf/src/data/ChineseSimplified/weapons/eyeofperception.json)
- [Pinned Optimizer sheet](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Weapons/Catalyst/EyeOfPerception/index.tsx)

## Reproduction and lifecycle state

One actual callback log owns all nine Viridescent deliveries; each tick has an independently replayed action/hit identity and actual hit-resolution references. Sword logs distinguish trigger time from planned snapshot time and the executed task's queue sequence. Before a delayed task executes, its snapshot, buff list and centre remain empty. At execution, actual stats and geometry are captured; the ordinary damage capture uses that snapshot time.

Result import independently replays eligible parents, RNG, cooldowns, delivery offsets, snapshot panels, target centres and child identities. Delayed task creation order is checked against independently reconstructed hit enqueue order, including a Sword task that creates a hit after an already queued Viridescent callback in the same frame. The deterministic checkpoint stores the actual unsampled Sword task, owner/eligibility, coefficient, original target, trigger age and parent identity. It does not invent future stats. Pending horizons include Sword +6 and Viridescent final +241. Existing target-motion and random-stream steady-state blockers remain explicit.

Validation: see `docs/validation/remaining-weapon-proc-lifecycle.md`. One focused three-case lifecycle file passed; no additional production build was run by this subtask.
