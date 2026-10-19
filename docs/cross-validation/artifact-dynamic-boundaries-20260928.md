# 圣遗物共享公式边界快照（2026-09-28）

本清单按已冻结的 b4 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 与 a7 `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd` 固定源码，以及当前 `010/012/013/014/015/016` 补丁和共享描述符整理。b4/a7 注册包分别为 53/55 个；共享规则为旧批 57 条、动态批 85 条，合计 142 条、覆盖 53 个目录（VV 在两批重叠）。这是算术接线盘点，不代表相应套装的生命周期也已移入 TypeScript：触发事件、受益对象、目标门、层数、冷却和持续时间仍由原生 gcsim 回调驱动。注册本身也不计为公式覆盖。

## 尚未共享的算术类别

| 原生实现类别 | 当前仍由宿主直接完成的具体算术 |
| --- | --- |
| 直接反应伤害加成 | a7 `heartofthefurnace.go` 的全队 Stellar `ReactBonusMod`（`.50`）；`scarletproof.go` 的 Stellar Swirl `ReactBonusMod`（`.40`）。两套均无共享规则或补丁。其他已有共享 `ReactBonusMod.Amount` 的分支不因本项而视为缺失。 |
| 直接快照写值 | `blizzard.go` 在攻击快照直接加 `.20/.40 CR`；`disenchantmentindeepshadow.go` 在反应攻击快照直接加 `.16 CR`。这些语句不经过已共享的 `Amount` 回调，仍有第二份原生算术。 |
| 事件型直接伤害 | `echoes.go` 把 `.70 × 当时总攻击` 写入命中 `FlatDmg`，并由随机率、递增失败率及 ICD 控制；`songofdayspast.go` 将治疗账本按每次 `.08 × healSnap` 写入至多五次命中的 `FlatDmg`；`oceanhuedclam.go` 以累计治疗值 `.90 × bubbleHealStacks` 排入泡泡攻击。源码没有 `AddDamageMod` 调用；这些直接攻击数值也不经过共享 Amount 路径。 |
| 能量事件 | `exile.go` 每个符合事件向队友加 2 能量，`scholar.go` 加 3，`scrolloftheheroofcindercity.go` 两件效果加 6；`reminiscence.go` 战技后扣 15。能量分发/扣除仍是原生事件算术。 |
| 非角色 StatMod 通道 | 护盾加成：`bolide.go`、`tenacity.go`；治疗加成：`maiden.go`；目标抗性修正：`deepwood.go`、`viridescent.go`。这几类由各自的 shield/heal/resist 通道直接应用，不属于现有共享 StatMod/AttackMod 标量规则。 |
| 冷却状态算术 | `thunderingfury.go` 的反应触发技能冷却返还仍由事件处理器改写冷却时间；ReactBonus 数值已共享不代表该冷却分支已共享。 |

## 完全没有共享公式接线的套装

按“套装目录没有进入本轮任何共享规则/补丁”定义，b4 的 53 个目录均有至少一条共享规则；a7 新增的两套尚无共享接线：

- **炉火融炼之心** `internal/artifacts/heartofthefurnace/heartofthefurnace.go`：两件攻击力 `.18`；四件触发后攻击力 `.12`，并给全队 Stellar 反应伤害 `.50`。其事件来源为 `OnStellarConduct`、`OnStellarSwirl`，以及装备者造成 `AttackTag.IsStellar()` 伤害；持续 12 秒。建议优先接入，常量值清楚，触发、目标队伍与窗口继续使用宿主回调。
- **血红之证** `internal/artifacts/scarletproof/scarletproof.go`：两件攻击力 `.18`；装备者触发 Stellar Swirl 后，暴击率 `.16` 与 Stellar Swirl 反应伤害 `.40` 持续 10 秒。建议与炉火一并接入：规则窄、数值和触发源明确，独立保留反应标签及窗口。

## 下一步实施顺序

1. 为上面两套新增共享标量规则，并在 b4/a7 source patch 中保留原生订阅、施加对象和持续时间；a7 才注册，不能借 b4 覆盖数推算其已支持。
2. 将 Blizzard 与 Disenchantment 的 `Snapshot.Stats` 直接写值接入既有对应 CR 公式或增加明确规则 ID，避免 AttackMod 与快照路径各维护一份常量。
3. 再按通道拆分事件型工作：直接 FlatDmg/泡泡攻击、能量分发、shield/heal/resist、技能冷却。每一类需各自保留事件时点和消费对象，不能用“Amount 已桥接”推定完成。

## 主要源码与接线证据

- 固定版本：`packages/source-host/scripts/pins.json`、`packages/source-host/stellar-overlay/pins.json`；注册目录计数取两份生成的 `inventory-metadata.json` 的 `counts.artifact`。
- 共享接线：`packages/source-host/patches/010-artifact-scalar.patch`、`012-artifact-constants-a.patch`、`013-artifact-constants-b.patch`、`014-artifact-dynamic-a.patch`；015/016 同时核对 b4 与 `packages/source-host/stellar-overlay/patches/` 对应补丁。
- 共享描述符：`packages/sim-core/src/source-host-artifact-formula.ts`、`source-host-artifact-constant-group-a.ts`、`source-host-artifact-constant-group-b.ts`、`source-host-artifact-dynamic-group-a.ts`、`source-host-artifact-dynamic-group-b.ts`、`source-host-artifact-dynamic-group-c.ts`。
- 原生残余示例：固定 a7 `source/internal/artifacts/{heartofthefurnace,scarletproof,blizzard,disenchantmentindeepshadow,echoes,songofdayspast,oceanhuedclam,exile,scholar,scrolloftheheroofcindercity,reminiscence,bolide,tenacity,maiden,deepwood,viridescent,thunderingfury}/<folder>.go`。

未运行测试或构建；本文件只记录静态接线边界。
