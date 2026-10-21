# Third-party references

## gcsim

- Project: [genshinsim/gcsim](https://github.com/genshinsim/gcsim)
- Documentation: [docs.gcsim.app](https://docs.gcsim.app/)
- License: MIT for the pinned Classic b4ae769 source described below; the separate Stellar a7 host is AGPL-3.0-or-later.
- Copyright: Copyright (c) 2021 genshinsim
- Included license: [`third_party/licenses/gcsim-MIT.txt`](./third_party/licenses/gcsim-MIT.txt)

This project uses gcsim as a product and testing reference:

- character and skill damage distribution;
- frame-oriented sample/event inspection;
- expandable damage calculation details;
- energy diagnostics;
- particle distribution behavior documented by
  [`pkg/core/player/character/energy.go`](https://github.com/genshinsim/gcsim/blob/main/pkg/core/player/character/energy.go);
- explicit warnings about simulator limitations.
- Durin black-skill behavior cross-checked against repository commit
  `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`, specifically
  `internal/characters/durin/skill.go`,
  `pkg/core/attacks/icd_groups.dm.go`, and the default particle delay in
  `pkg/core/player/character/character.go`.
- Overload and Superconduct trigger order, one-frame delay, independent
  six-frame damage GCDs, radius, reaction multipliers, defense/crit behavior,
  resistance application, and Superconduct's 720-frame physical-resistance
  modifier were cross-checked against the same fixed commit.
- Electro-Charged Hydro/Electro coexistence, ten-frame first damage,
  sixty-frame tick cadence, snapshot ownership refresh, six-frame delayed
  `0.4U` Aura wane, zero-damage behavior, single-target scope, and `2.0`
  reaction multiplier were cross-checked against
  `pkg/reactable/electrocharged.go` in the same fixed commit.
- Frozen Hydro/Cryo consumption, doubled Frozen durability, accelerating
  per-frame decay, Freeze resistance, Frozen Melt/Vaporize exclusion,
  Electro-Charged exclusion, and Frozen Superconduct consumption order were
  cross-checked against `pkg/reactable/freeze.go`, `melt.go`, `vaporize.go`,
  `superconduct.go`, and `reactable.go` in the same fixed commit.

The level 1–100 transformative-reaction base-damage numeric table in
`packages/sim-core/src/formulas.ts` is reproduced from that fixed commit's
`pkg/core/combat/reaction.dm.go` and is covered by the included MIT license.
The earlier TypeScript-only scope did not include a Go host. The current repository also contains patched Go/WASM source hosts; that earlier no-copy statement does not describe the current tree. The TypeScript Aura,
ICD, reaction scheduling, particle, Ability Blueprint, and Durin audit
implementations were written independently against the pinned behavior
oracles. Any later reused code or substantial data portions must retain the
applicable copyright and MIT license text.

## Separate Stellar Go/WASM host

The `packages/source-host/stellar-overlay/` and `apps/web/public/source-host-stellar/` host uses pinned gcsim revision `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`. Its source is AGPL-3.0-or-later, with a separate notice for prior MIT contributions. Preserve the [AGPL text](apps/web/public/source-host-stellar/licenses/gcsim-AGPL-3.0-or-later.txt), prior-contribution notices, Go notices and linked dependency notices alongside this artifact. This is separate from the Classic b4 host's MIT attribution.

The [Stellar build documentation](packages/source-host/stellar-overlay/README.md) identifies archived source verification and the isolated overlay. A release still needs an audit of corresponding modified source, build materials and the actual distribution/serving boundary. This notice does not select a new license for original project code or certify the entire repository for redistribution. See the [license-boundary draft](docs/oss-preparation/LICENSE-BOUNDARIES.zh-CN.md).

## Enka.Network

- API documentation: [Enka.Network API docs](https://github.com/EnkaNetwork/API-docs/blob/master/docs/gi/api.md)
- Endpoint used at development/preview time: `https://enka.network/api/uid/:uid/`
- Identifier snapshot audited at commit:
  `2b9d23b334306f5845551ae7571d1165cdf096e5`

The optional showcase importer reads only data made public by the player. It
uses a custom `User-Agent`, honors the response TTL with an in-memory cache, and
does not persist account responses. Enka data describes the public player build;
it is not a source for verified talent multipliers or simulator mechanics.

No license file was detected in the audited API documentation repository. The
committed interoperability snapshot therefore retains only factual numeric
relationships needed to match `avatarId`, skill IDs and proud-skill IDs. It
does not copy localized text, descriptions, images or icons. The snapshot is
marked `NO-LICENSE-DETECTED` and `provisional`; update or redistribution must
be re-audited if the upstream licensing status changes.

## genshin-db

- Project: [theBowja/genshin-db](https://github.com/theBowja/genshin-db)
- Pinned npm package: `genshin-db@5.2.12`
- Audited repository commit:
  `1bab2cdba4d218fd5caa46b5f54e7884ee8359a2`
- Package description reports Genshin Impact data through version `6.7`.
- License: MIT
- Copyright: Copyright (c) 2020 theBowja
- Included license: [`third_party/licenses/genshin-db-MIT.txt`](./third_party/licenses/genshin-db-MIT.txt)

`packages/game-data/scripts/generate-catalog.mjs` deterministically derives the
Chinese character, talent and weapon catalogs from the exact npm artifact
pinned by `package-lock.json`. The generated records remain
`verificationStatus: "provisional"` and `simulationStatus: "metadata-only"`
because community/datamined numbers do not by themselves verify frames, ICD,
Aura, target rules, particles, snapshots or special mechanics.
