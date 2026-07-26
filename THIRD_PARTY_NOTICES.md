# Third-party references

## gcsim

- Project: [genshinsim/gcsim](https://github.com/genshinsim/gcsim)
- Documentation: [docs.gcsim.app](https://docs.gcsim.app/)
- License: MIT
- Copyright: Copyright (c) 2021 genshinsim

This project currently uses gcsim as a product and testing reference only:

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

No gcsim source code, character implementation, or game database has been
copied. The TypeScript Aura, ICD, particle, Ability Blueprint, and Durin audit
implementations were written independently; the pinned Go sources are used as
behavior/test oracles and are cited by the blueprint evidence. If code is
reused later, the applicable copyright and MIT license text must be retained
with the copied or substantial portions.

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
