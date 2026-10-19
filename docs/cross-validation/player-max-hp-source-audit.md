# 动态生命值上限：固定来源审查

状态：`source-backed-provisional`。固定版本为 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。实现入口 `playerMaxHpModel.mode = gcsim-b4ae769-ratio-preserving-v1` 明确标为 `fixed-source-assumed`。本文记录通用角色模型的实际代码语义及本增量的映射边界；不认证实机行为，也不把角色、武器的专属属性提供器视为已经接入。

## 原文与完整性

[原文归档](../../packages/game-data/sources/player-max-hp/source.json.gz) 包含九份必要文件：通用 `hp.go`、`heal.go`，角色属性 `stats.go`、`mods.go`、`hitlag.go`，公共 `modifier.go`、属性公式 `stats.go`、事件分发 `event.go` 及 `LICENSE`。`hitlag.go` 用于证明受卡肉修饰的到期延长条件。

[清单](../../packages/game-data/sources/player-max-hp/manifest.json) 保存每文件字节数、SHA-256、Git blob SHA-1、固定来源链接，以及整个压缩归档的 SHA-256。写入前先按 Git blob 格式重新计算每份原文的 SHA-1，逐一匹配已保存固定 Git tree 中的路径与 blob；tree SHA 等于上述版本且 `truncated=false`，包含 4,779 个条目。可复用的生命之契归档文本亦逐字匹配。九个文件全部通过原文身份核对。

## HP 的保存形式与实时上限

通用角色保存 `currentHPRatio`。[`hp.go:62–75`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/hp.go#L62) 中，`CurrentHPRatio()` 直接返回保存比例，`CurrentHP()` 每次返回 `currentHPRatio × MaxHP()`；生命之契则保存绝对数额，读取比例时除以实时上限。

因此，单纯改变上限保持 HP 比例。例如比例 50%、上限 10,000 时 HP 为 5,000，上限变为 15,000 后读到的 HP 为 7,500。这是源码公式的推导示例，不是运行样本；它不构成治疗、扣血或生命之契事件。

[`stats.go:122–156`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/stats.go#L122) 的 `MaxHP()` 调用 `SelectStat(false, BaseHP, HPP, HP)`，从基础属性加上当前有效的相关 StatMod。`false` 表示不排除 `Extra` 修饰。每次读取都会执行相应 `Amount()`，只采用未到期且非 nil 的结果。最终公式为 [`BaseHP × (1 + HPP) + HP`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/attributes/stats.go#L49)。

[`hp.go:15–32`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/hp.go#L15) 的绝对 HP 写入会除以当时 `MaxHP()`，再把比例夹至 [0, 1]；绝对增减先读取实时当前 HP，再按绝对写入路径保存比例。比例写入则直接夹比例。不能把固定上限时期保存的绝对 HP 当成动态模型的唯一状态。

## 修饰新增、替换、删除与到期

[`AddStatMod`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/mods.go#L156) 设置到期时间、维护修饰列表及日志；[`modifier.Add`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/modifier/modifier.go#L86) 按同键替换旧实例。不同键仍各自存在。[删除](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/mods.go#L164) 移除对应修饰并结束日志。它们均没有通用 HP 比例改写、债额缩放或生命事件发出逻辑。

数值取样与状态查询的到期边界不同：

| 读取路径 | 固定来源行为 |
| --- | --- |
| `SelectStat` / `MaxHP` | 仅采用 `expiry > frame` 或永久修饰；到期帧已不计该属性，但不删除记录。 |
| 完整 `Stats()` | [`stats.go:24–69`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/stats.go#L24) 在遍历时删除 `expiry <= frame` 的 StatMod，保留其他类型。 |
| `StatModIsActive()` | 经 [`FindCheckExpiry`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/modifier/modifier.go#L117)，只在 `expiry < frame` 时判失效；到期帧若尚未被完整 `Stats()` 清理仍可能为真。 |
| 受卡肉修饰 | [`hitlag.go:60–67`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/hitlag.go#L60) 只延长标为受卡肉、非永久且 `expiry > 当前帧` 的修饰。 |

这里的懒处理是属性实时计算及过期修饰的部分清理，**不是读取时把新的绝对 HP 写回**。`StatModIsActive()` 的边界不能替代数值取样边界；完整 `Stats()` 是否提前清理记录，也不能令已经到期的属性重新计入 MaxHP。

MaxHP 的变化不一定伴随 StatMod 的增删。永久修饰的 `Amount()` 可以依据别的状态返回不同数值。固定来源的[白雨心弦](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/bow/heartstrings/heartstrings.go#L54) 读取当前层数，[芙宁娜 C2](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/furina/cons.go#L23) 读取爆发状态和气氛值。两者这里只作为未映射的专属来源例子，未加入本归档，也不代表对应被动已实现。

## 生命之契不随上限主动缩放或夹值

[`hp.go:35–59`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/hp.go#L35) 仅在非零债额增减请求中把新债额夹至 [0, 2 × 当前 MaxHP]。比例请求先乘当时 MaxHP；精确零请求立即返回，不夹值、不发事件。非零请求即使实际变化为零仍同步发 `OnHPDebt(index, oldDebt − newDebt)`。

单纯改变 MaxHP 不缩放债额、不重新夹上限、不发 `OnHPDebt`。上限降低后债额比例可以暂时超过 200%；下一次非零增减才触发夹值。由此也可能发生请求增加、实际却因重新夹值而减少，或请求减少的绝对量小于实际债额下降量。示例：债额 300、上限降到 100 后仍保存 300；随后增加 1 的请求把结果夹到 200，事件量为 +100。此例只是逐式推导，不是实机或外部模拟器证据。

不要把变化请求方向当成实际变化方向，也不要在上限变化时提前替源码清除债额。默认治疗先按旧债额算余量，再执行减债及夹值，不能把由于新上限夹值额外消失的债额转换成回血。

## 治疗期间的上限读取与同步回调边界

[`Heal`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/heal.go#L21) 与默认 [`ReceiveHeal`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/heal.go#L76) 的顺序为：

1. 百分比治疗读取此时 MaxHP 得到基础量，再使用目标端 `HealBonus()` 与 `HealInfo.Bonus` 计算加成后治疗量；绝对治疗基础量直接使用 `Src`。
2. 保存旧 HP 比例、旧当前 HP、旧债额供日志及溢出计算使用。
3. 默认 `ReceiveHeal` 计算 `max(加成后治疗量 − 旧债额, 0)`，作为清契后的治疗余量。
4. 用全部加成后治疗量减债、夹值，随后同步执行 `OnHPDebt` 回调；同步分发见 [`event.go:165–171`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/event/event.go#L165)。
5. 再调用 `ModifyHPByAmount(治疗余量)`，重新读取此时当前 HP 和 MaxHP，保存新的 HP 比例。
6. 外层再次读取 MaxHP，用之前保存的旧 HP 与治疗余量计算 `max(旧HP + 余量 − 当前MaxHP, 0)`，最后发 `OnHeal`。

若同步 `OnHPDebt` 回调在第 4 步改变 MaxHP，第 5 步必须看到改变后的上限与按原比例计算的当前 HP；整次治疗缓存一份上限或直接写入 `旧绝对HP + 余量` 都不等价。源码的溢出计算亦混用旧 HP 与之后读取的 MaxHP，不能无条件视为实际 HP 变化的补数。`OnHeal` 中的清契后治疗量是尚未扣溢出的余量，最后一个参数是清契前加成后治疗量。

**本增量尚不支持治疗内部由同步 `OnHPDebt` 回调改变上限，也没有映射这些回调产生的角色、武器或圣遗物状态。** 本文保留调用顺序作为明确边界，不以通用池的动态 MaxHP 支持声称已复现该嵌套交互。已经按事件顺序生效、在普通健康操作之间变化的上限，与一次操作内部由未映射回调再次改变上限，应分别说明。

## 保留假设与验证范围

默认 [`ReceiveHeal` 的 TODO](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/heal.go#L78) 仍未确认同次治疗能否清契后立即使用余量回血。动态上限不会消除这个假设；应继续保留明确的来源假设策略。

[阿蕾奇诺](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/arlecchino/arlecchino.go#L79) 和[克洛琳德](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/clorinde/heal.go#L10) 的专属治疗覆盖仍未映射；这里只链接固定原文，不额外归档或接入。通用源码结果亦不能证明所有角色在游戏内的上限增减、死亡复活或其他专属机制。

来源归档核验只检查固定 tree/blob、逐文件 SHA-256 与压缩归档完整性，没有运行游戏或外部模拟器。生产实现及验收另行记录。

## 已声明增益的实现接口

`playerMaxHpModel` 是显式的当前 schema 扩展，仅接受 `gcsim-b4ae769-ratio-preserving-v1`，要求合法帧时间轴与启用的玩家生命状态。没有此模式时，治疗、周期治疗、生命条件和生命之契与动态 HP buff 的旧阻塞继续保留。变化前后最大生命必须为正。

运行时在已支持的 buff 应用、同键覆盖（包括用非生命属性覆盖旧生命属性）后同步真实状态。所有同帧到期在优先级 −1 的任务中统一清理并同步，早于通常优先级 0 的行动。只有有效最大生命发生改变才写入 `playerMaxHpEvents`，并通过 `playerMaxHpEventId` 连接 `max-hp-change` 生命时间轴节点。

事件保存前后上限、真实 `statsAfter` 中的基础／百分比／固定生命、前后 HP、前后比例、带符号的上限调整量、可选前后绝对债额及四个可执行 AST 节点。第一步直接以真实属性计算新上限，后续步骤保留比例并计算绝对调整。`summary.maxHp` 保留初始上限语义；`finalMaxHp` 保存末态上限，`totalMaxHpAdjustment` 独立计入生命守恒，不并入治疗或受伤。所有普通治疗、周期治疗、反应自伤和行动时生命条件继续读取同一实际生命池。

导入校验从配置及实际接受的行动独立重建增益目标、开始、同键替换和到期，校验每次有效上限变化及其生命时间轴连接、债额不变和末态。当前生命及最大生命也进入已有真实检查点；未来的最大生命到期任务保留在待执行队列。页面通过正常队伍生命设置启用模式，账本将上限调整与治疗分别显示。

定向用例文件：`packages/sim-core/src/__tests__/player-max-hp-runtime.test.ts`（三个聚合用例）及 `apps/web/e2e/player-max-hp-resource.spec.ts`（一个正常控件及 JSON 恢复流程）。编写完成不等于执行通过，原始执行结果由本轮验证记录说明。

## 后续实际接入与检查

本来源审查完成后，运行时、正常页面、完整JSON与必要核心检查已接入并执行；实际通过、原失败和范围见[2026-09-25增量记录](../lifecycle-maxhp-expansion-20260925.zh-CN.md)。来源身份不因此升级为官服verified。
