# 2026-09-28 released equipment gaps against a7 source host

The exact integer join finds **11 playable weapon IDs** and **8 artifact set IDs** in the released 7.1 dataset with no matching `resolved.sourceGameId` in the pinned a7 source-host inventory. The three quest-trial Isshin variants (`11419`, `11420`, `11421`) are retained in the dataset but excluded from playable comparison. This is an ID join, not a name or count reconciliation.

Dataset: `snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34` (`gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2`, releaseStatus `released`). Host: `genshinsim/gcsim` at `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`; inventory metadata counts `241` weapons and `55` artifact packages. Dataset inventory is 255 weapon rows (252 in ordinary playable scope) and 63 artifact sets.

“Missing from a7” means no pinned registered host package resolves to that numeric game ID. It does not mean every item is unimplemented in this repository. The table notes current typed-model references and partial/blocker state. Full pointers and per-item source evidence are in the companion JSON.

## Playable weapons

| ID | Name | Patch | Current typed model evidence |
|---:|---|---:|---|
| 11435 | 熔猎异端之刃 (`hereticsmoltenblade`) | 7.0 | Added fixed Optimizer active-window + manual 0–18 tier ATK formula; automatic movement mapping and exit removal remain absent |
| 11437 | 新枝 (`newbough`) | 7.1 | No direct typed effect reference found |
| 11438 | 银釭 (`silverlight`) | 7.1 | No direct typed effect reference found |
| 11520 | 白湖冬羽 (`whitelakefrostfeather`) | 7.0 | stacked attack term can consume supplied stack count; specialized damage and energy return remain blocked |
| 11522 | 蝶变 (`beyondthechrysalis`) | 7.1 | No direct typed effect reference found |
| 12516 | 超越之匙 (`ateaspoonoftranscendence`) | 6.7 | static attack term exists; charged-hit lunar damage and timed stacks remain blocked |
| 13436 | 戍望谣歌 (`songofthevigil`) | 7.0 | windowed attack term can consume supplied active window; reaction energy and cooldown event remain blocked |
| 14435 | 群王局戏 (`clashofkings`) | 7.0 | conditional expansion accepts a supplied active flag; trigger, window extension and cooldown remain blocked |
| 14437 | 凝雪沉心 (`wintersheavyheart`) | 7.1 | No direct typed effect reference found |
| 14524 | 漩流颂歌 (`hymnofthemaelstrom`) | 7.1 | No direct typed effect reference found |
| 15437 | 柔风游弦 (`breezebornerefrain`) | 7.1 | No direct typed effect reference found |

Five of the eleven gaps now have direct typed source references: Heretic’s Molten Blade (added after this initial audit), Clash of Kings, White Lake Frostfeather, A Teaspoon of Transcendence, and Song of the Vigil. These references describe partial/manual state support and name specific missing behavior. New Bough, Silver Light, Beyond the Chrysalis, Winter’s Heavy Heart, Hymn of the Maelstrom, and Breezeborne Refrain have no direct typed-effect slug reference in the searched current model files. Raw source imports and generated/optimizer copies are not treated as current model implementations.

## Artifact sets

| ID | Name | Patch | Current typed model evidence |
|---:|---|---:|---|
| 10004 | 奇迹 (`tinymiracle`) | 1.0 | 2-piece self-resistance description is present but marked not-modeled; 4-piece timed resistance trigger is not in executable outgoing-damage rules |
| 10010 | 冒险家 (`adventurer`) | 1.0 | 2-piece flat-HP rule is present; 4-piece chest healing is not modeled here |
| 10011 | 幸运儿 (`luckydog`) | 1.0 | 2-piece flat-DEF rule is present; 4-piece mora healing is not modeled here |
| 10013 | 游医 (`travelingdoctor`) | 1.0 | 2-piece incoming-healing description is present and marked not-modeled; 4-piece burst healing not modeled here |
| 15009 | 祭火之人 (`prayersforillumination`) | 1.0 | one-piece status-duration description is present and marked not-modeled |
| 15010 | 祭水之人 (`prayersfordestiny`) | 1.0 | one-piece status-duration description is present and marked not-modeled |
| 15011 | 祭雷之人 (`prayersforwisdom`) | 1.0 | one-piece status-duration description is present and marked not-modeled |
| 15013 | 祭冰之人 (`prayerstospringtime`) | 1.0 | one-piece status-duration description is present and marked not-modeled |

All eight have a typed description or a two-piece rule in `equipment-effects.ts`; these references are not equivalent to complete set execution. The JSON records whether the behavior is marked `not-modeled`, whether an executable effect list exists, and the exact source line.

## Evidence and limits

- Released data: `packages/game-data/manifests/runtime/datasets/snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34/metadata.json`, `catalog.json`, `catalog-index.json`, and `supplemental.json`.
- Pinned a7 inventory: `apps/web/public/source-host-stellar/inventory-metadata.json`; source-tree archive: `packages/source-host/stellar-overlay/source-tree.json.gz` (tree SHA-256 is recorded in the JSON). Since the IDs are absent, there is no per-item implementation archive path to cite.
- Quest-only trial exclusion: `packages/game-data/src/equipment-build.ts:102` and `docs/research/release-inventory-2026-09-23.md` (255 source rows versus 252 ordinary inventory names).
- Release identity does not establish numeric verification or mechanic completion. The selected snapshot metadata says numeric evidence is `unchecked` and mechanic evidence is `missing`.
