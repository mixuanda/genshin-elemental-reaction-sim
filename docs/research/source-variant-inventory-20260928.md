# Classic b4 与 Stellar a7 来源清单对照

审计日期：2026-09-28。本文只比较仓库内固定来源登记、清单元数据与当前角色目录；不运行构建或测试。

| 来源 | 固定修订 | 角色 | 武器 | 圣遗物 | TODO 包 / 显式标记 |
|---|---|---:|---:|---:|---:|
| Classic | `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` | 117 | 231 | 53 | 182 / 493 |
| Stellar | `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd` | 124 | 241 | 55 | 178 / 444 |

## Stellar 新增键

相较 classic，Stellar 登记新增 7 个角色配置键、10 把武器、2 套圣遗物；没有在 Stellar 消失的旧键。新增的是 7 个角色配置键/形态，而不是 7 个全新游戏身份：`aethercryo` 与 `luminecryo` 是已有空与荧身份的冰元素形态，队伍构建器也将两者归并为同一旅行者入队身份。7 个来源游戏 ID 均可匹配当前目录，因此均可解析到两档参考假设预设；这 7 个键复用既有两档预设；相对 classic 新开放交接的是 5 个非旅行者身份与 2 个旅行者冰形态，本轮没有新增目录角色或预设。

| 配置键 | 来源游戏 ID | 来源中文名 | 当前目录角色 ID / slug | 当前预设 |
|---|---:|---|---|---|
| `aethercryo` | 10000005 | 空 (冰元素) | `character:10000005` / `aether` | starter, developed |
| `iansan` | 10000110 | 伊安珊 | `character:10000110` / `iansan` | starter, developed |
| `ifa` | 10000113 | 伊法 | `character:10000113` / `ifa` | starter, developed |
| `jahoda` | 10000124 | 雅珂达 | `character:10000124` / `jahoda` | starter, developed |
| `luminecryo` | 10000007 | 荧 (冰元素) | `character:10000007` / `lumine` | starter, developed |
| `odette` | 10000150 | 奥黛塔 | `character:10000150` / `odette` | starter, developed |
| `prune` | 10000132 | 布伦妮 | `character:10000132` / `prune` | starter, developed |

武器新增键：`bladeofatonement`, `covenantoffrostandsnow`, `disasterandremorse`, `echoesoftheheart`, `emberwell`, `exaiphanesblade`, `forgedbythegoldenmelody`, `frostbreath`, `jadevista`, `lightbearingmoonshard`。

圣遗物新增键：`heartofthefurnace`, `scarletproof`。

## 行动字段与解读范围

来源清单元数据没有按角色列出的行动包或行动可用性字段。队伍构建器共用的行动类型枚举为 `skill`、`burst`、`attack`、`charge`、`aim`、`dash`、`jump`、`low_plunge`、`high_plunge`、`wait`。两个来源版本都含有行动尝试补丁：classic manifest 的 `patches` 数组列出 `007-action-attempts.patch`（929 字节）；stellar manifest 以 `actionAttemptsPatch` 字段列出同一补丁（929 字节）。Classic 的公式族记录位于 `limitations.supportedFormulaFamilies`，含 `ordinary`、`amplifying`、`additive`、`transformative`、六个 Lunar 家族及 `player-incoming`、`player-shield`、`player-shield-min`、`player-drain`；其中 shared player incoming/shield-and-drain 能力标记均为 true。Stellar 顶层 `supportedFormulaFamilies` 记录上述普通/反应/Lunar/player 家族，并额外列出四个 stellar 家族：`stellar-conduct-event`、`stellar-conduct-direct`、`stellar-swirl-direct`、`stellar-swirl-reaction`；其 incoming 与 shield/drain shared formula 标记也为 true。上述是宿主能力元数据，不能推出某角色支持全部行动或公式。

## 证据和限制

- 对照输入：`apps/web/public/source-host/{manifest.json,inventory-metadata.json}`、`apps/web/public/source-host-stellar/{manifest.json,inventory-metadata.json}`、当前 runtime catalog `snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34/catalog.json`、`packages/game-data/src/character-build-presets.ts`。机器可读逐项数据见同目录 JSON。
- inventory metadata 的 scope 明确限定为固定来源登记、字面 factory key、parser alias、本地化及显式 TODO 标记；它不是最新或权威角色名册，也不证明游戏验证或实现准备度。Classic manifest 也明确说注册不代表包已可用；Stellar verification 标为 `source-assumed-provisional`。
- 目录交集只说明当前本地 catalog 可为这些角色生成两种 `reference-assumption` 示例预设，不代表其来源端完整、机制已验证或配装最优。
