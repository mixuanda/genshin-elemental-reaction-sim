# 来源角色同击附加伤害共享公式（2026-09-28）

## 本轮实现范围

本轮将来源 Go 中一部分角色 `FlatDmg` 算式接入共享公式 AST，分为 A–C 三组： [038 patch](../packages/source-host/patches/038-character-additive-a.patch) 对应 6 条规则，[039 patch](../packages/source-host/patches/039-character-additive-b.patch) 对应 8 条，[040 patch](../packages/source-host/patches/040-character-additive-c.patch) 对应 9 条，合计 23 条；其中 2 条为创建期规则、21 条为命中期规则。规则定义位于 [A 组](../packages/sim-core/src/source-host-character-additive-group-a.ts)、[B 组](../packages/sim-core/src/source-host-character-additive-group-b.ts)、[C 组](../packages/sim-core/src/source-host-character-additive-group-c.ts)，共享 schema 和计算器位于 [formula 模块](../packages/sim-core/src/source-host-character-additive-formula.ts)。

命中期共享公式仅替换原本的加法数值；来源 Go 仍负责原有攻击标签、目标和状态门、次数／层数扣除、ICD、日志及同击操作次序。例如，Clorinde A1 和 Xilonen C6 原 `AddAttackMod.Amount` 都直接对同一 `AttackEvent` 的 `FlatDmg` 加值并返回 `nil`；现在共享公式提供该加值，原 nil 返回和其它副作用仍留在 Go。Xilonen C6 的加值是三倍实际总防御力。

读数位置与跨帧字段也保留原语义。Kokomi A4 按原次序读取治疗加成，再读取最大生命；Mizuki C1 在原周期任务中保存元素精通及创建回执，后续命中引用最近一次保存值；Xianyun A4 在原 30 帧更新读取攻击力并存入字段，后续下落命中使用该快照。Shenhe 与 Yun Jin 则在原命中回调时读取总攻击力或总防御力。上述公式不提前运行来源门槛，也不在消费时重新读取已经保存的字段。

这 23 条只是本轮选定的直接加值及其必要创建快照，不是所有角色 `FlatDmg` 语法位置的完整迁移。固定源码树 AST 清单记录 classic 145 个、stellar 148 个 `FlatDmg` 语法位置；这些数字涵盖写入、覆写、结构字段等，不代表不同机制数量，也不代表本轮覆盖数量。详见[完整语法位置清单](source-character-flat-damage-inventory-20260928.json)。尚未覆盖的排队攻击、覆写及乘算 producer 仍保留原生路径。

## 单公式实验范围

角色附加伤害规则可在命中捕获文档中作为单项公式实验展示和保存。UI [角色公式控制](../apps/web/src/source-host-character-controls.ts)对可编辑规则呈现输入与公式 trace；范围仅是这条公式数值，不重跑轮转，不修改原始 capture，也不把编辑传播到后续命中伤害、反应或队伍结果。来源 Go 的触发、攻击身份和回调副作用仍按原路径执行。此类共享公式和回放不构成游戏内验证，game-verified 分母保持 0。

## 已执行检查与测量

| 检查 | 实际结果 | 墙钟时间 |
| --- | --- | --- |
| classic Go/WASM 首轮 | 通过 | 6.005 秒 |
| stellar Go/WASM 首轮 | 通过 | 6.385 秒 |
| Web 首轮 | 两处 TypeScript 联合类型收窄失败 | 7.684 秒 |
| Web retry1 | 修复后通过，723 模块 | 29.315 秒 |
| Web final | 创建公式单位修正为 EM/ATK、加入新页面用例后通过，723 模块；Vite 4.94 秒 | 19.908 秒 |
| 单个聚合页面首轮 | 测试轮转直接下落而未起跳，被原生合法动作检查拒绝 | 16.177 秒 |
| 同一页面 retry1 | 原生运行成功；测试以别名 kokomi 查找实际键 sangonomiyakokomi 而失败 | 16.054 秒 |
| 同一页面 retry2 | 1/1 通过；用例 40.4 秒、runner 43.4 秒、pageErrors 为空 | 45.365 秒 |
| tracked git diff --check | 通过，仅覆盖已跟踪差异 | 0.201 秒 |

失败没有删去或改写成通过。修复范围分别是两处类型判别、测试轮转中补 `noelle jump`、测试角色键；后两项没有修改生产计算逻辑。没有新增单元矩阵、全角色运行或重跑历史测试。Web 既有大块与动态导入警告仍在。所有命令、原始日志、运行 JSON 与最终产物身份见[汇总收据](validation/source-character-additive-measurements-20260928.json)。

每条来源只运行一个 16 秒、单迭代、seed=20260928 的云堇／心海／闲云／诺艾尔综合场景。classic 保存 2594 次计算、10 个实际伤害应用；stellar 为 2590 次、10 个。每条来源观察到 4 条新规则：云堇 Q 3 次、心海 A4 2 次、闲云攻击力创建 23 次和闲云 A4 消费 1 次。这些调用次数不是角色或机制覆盖数；其余 19 条新规则未作本批页面实跑，直月和星辉 direct 附加分支也没有新增页面样本。

两来源各选定一个心海普攻和一个诺艾尔下落，独立捕获重放差值均为 0。普攻同时保存云堇加值 291.26032761294005 和心海加值 1246.7588733900002；心海实际 getter 顺序为治疗加成、最大生命。闲云攻击力创建值 1187.727122016，消费值 2375.454244032；classic 创建／消费分别在 342／357 帧，stellar 在 340／355 帧，回放使用对应创建 ID，没有重新取样。

独立计算器实测把心海本项最大生命输入从 18470.501828 改为 23470.501828，公式结果从 1246.7588733900002 变为 1584.2588733900002；JSON 导出／导入后的实验值一致，原捕获与原命中保持不变。它证明本项可编辑公式，不代表自动把所有上游修改传播到完整模拟。

最终 classic WASM SHA-256 为 `be81467f8dc8c2aa0fcb626c685c7ab2191065b6cd6669fe2fbbc6f1ca69f8e1`，42,677,856 字节；stellar 为 `d9a59c26391b36eee390f36799aca9e254d43a75f6cc85b84d46e5f9dab2387f`，64,243,954 字节。实际页面运行回执与最终文件哈希一致。

## 剩余工作与交付边界

两个 nil-only Amount 回调的数值加项已接入，先前报告中“Clorinde A1／Xilonen C6 附加数值未展开”的状态由本报告更新；其原生触发状态不因此获得完整共享解释。其余排队攻击、覆写、乘算以及 helper 内部状态仍需逐类迁移。后续[分组定位清单](source-character-flat-damage-remaining-20260928.json)整理了 124 个 body 组／252 条双来源写入证据，行号沿用先前 AST 清单、按当前附近接线排除；这是定位工具，不是新的全量 AST 审计或完整机制分母。

全量 goal 仍为 active。正式、preview、verified 数据指针保持原状态，新增共享源码算式不提升游戏 verified。任意来源检查点、随机稳态、缺失游戏证据和预览的官方版本映射等仍有缺口。本轮保留已有工作树，没有提交、推送或部署。
