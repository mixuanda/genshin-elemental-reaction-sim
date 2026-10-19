# Weapon formula source refresh — 2026-09-28

Checked current upstream source trees for the six exact missing weapon IDs in [the equipment execution gap inventory](equipment-execution-gaps-20260928.json). No matching new typed formula implementation was found.

The fixed Genshin Optimizer source is still current at `180a0a1015cb725c7570cd828eb086749960df98`; its recursive tree contains no sheets for these six slugs. The current gcsim tree at `286685309697cc8904122ec582ea0c3b78f53c7e` likewise contains no implementation paths for them. I inspected that exact commit’s [`LICENSE`](https://github.com/genshinsim/gcsim/blob/286685309697cc8904122ec582ea0c3b78f53c7e/LICENSE): it states AGPL-3.0-or-later effective 2026-09-19, while versions through v2.47.2 were MIT-licensed and retain a separate `LICENSE-MIT`. No gcsim implementation file was copied. Genshin-DB has localized descriptive records, but those records are not formulas and were not used to infer mechanics.

| Item ID | Slug | Optimizer formula | gcsim formula | Genshin-DB metadata |
|---:|---|---|---|---|
| 11437 | `newbough` | absent | absent | present; descriptive only |
| 11438 | `silverlight` | absent | absent | present; descriptive only |
| 11522 | `beyondthechrysalis` | absent | absent | present; descriptive only |
| 14437 | `wintersheavyheart` | absent | absent | present; descriptive only |
| 14524 | `hymnofthemaelstrom` | absent | absent | present; descriptive only |
| 15437 | `breezebornerefrain` | absent | absent | present; descriptive only |

No source file was copied into `packages/game-data/sources/weapon-refresh-20260928/`, because no newly available typed formula source matched these items. The machine-readable record includes repository revisions, tree links, matching outcomes, and source-license context.

This refresh establishes absence only within the inspected current recursive source trees. It does not establish weapon semantics from localized passive text.
