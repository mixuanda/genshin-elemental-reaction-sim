# 固定来源圣遗物事件算式与快照记录（2026-09-28）

## 本轮范围

本轮补接此前边界审计中没有进入共享公式的三类路径：a7 两套星辉圣遗物的 `Amount` 标量、Blizzard／Disenchantment 在攻击快照上直接写入的暴击率，以及 Echoes／Song of Days Past／Ocean-Hued Clam 的事件型附加伤害。新增内容仍按用途分为标量、快照变更、附加伤害事件；这些公式之间不能合并计数或互相替代。

### a7 新增标量规则 D6

`source-host-artifact-dynamic-group-d.ts` 新增六条固定 a7 规则，目录仅适用于 a7：

- 炉火融炼之心：两件 `.18` ATK%；四件 `.12` ATK%、`.50` 星辉反应伤害加成。
- 血红之证：两件 `.18` ATK%；四件 `.16` CR、`.40` 星辉扩散反应伤害加成。

规则绑定 a7 commit。来源回调继续决定星辉反应／扩散门、持有者、队友受益者及12秒／10秒窗口；共享 AST 只计算本次原生 `Amount` 返回值。加入六条后共享 scalar 规则总数为148，按目录计55套；b4仍是53套，没有这两套来源规则。这里是数值接线清单，不是套装机制覆盖数。

### 018：来源直接快照 CR

`packages/source-host/patches/018-artifact-snapshot.patch` 与 a7 overlay 的同名补丁将 Blizzard 两种实际原生门（冻结、冰元素附着）及 Disenchantment 的超导减抗状态门接入 `ArtifactSnapshot`。回调继续执行原本的条件与早退顺序，不增添角色归属门；共享已有规则 ID 计算 `.40／.20 CR` 或 `.16 CR`，不新增 scalar rule ID。原生直接修改 `AttackEvent.Snapshot.Stats[CR]` 仍发生在快照流程。

新回执保存实际攻击者 actor、目标、效果来源 holder、快照基线与结果，并把被调用的旧公式 ID 关联到来源 stat step。该 provenance 可辨认“谁持有修正”与“谁是本击受益者”，并明确记录事件直接写入快照。`SourceHost == nil` 时保留原生 CR 直接写值路径，不额外重读角色属性，也不增添 actor gate。

### 019：事件型圣遗物附加伤害

新增独立 `artifact-additive` 公式族，不计入148条 scalar 规则，也不更改原生触发、随机状态、次数消耗或排队：

- 来歆余响：当前真实总攻击力乘 `.70`，作为触发本次命中的 `FlatDmg` 附加项；触发概率／递增失败率、冷却和强化窗口仍由 Go 决定。
- 昔时之歌：六秒治疗快照 `healSnap` 乘 `.08`，用于原生有限次数附加命中；来源持有者、剩余次数和增伤窗口剩余帧沿用捕获值。
- 海染砗磲：三秒累计治疗量乘 `.90`，作为泡沫排队攻击伤害基数；累积、到期、冷却和排队延迟仍是原生状态。

余响复用已有 `SelectStatWithProvenance` 的一次属性读取，保留装备公式来源；三类事件均保留未启用 SourceHost 时的原生数值路径。

事件公式在独立核心入口中重算捕获的 scalar 值。捕获中仅当该项唯一、原值等额地进入普通终端命中的 `FlatDmg` 时，编辑实验才能联动重算完整命中；非普通终端或无法证明的组件路径会明确 blocked。编辑不回写原始 capture，也不重新抽样、重放事件或改变排队。

独立命中页面将这三类记录与标量公式卡分开，显示实际来源状态的只读回执，并允许编辑本次用于公式计算的快照值。编辑后的联动仅针对原命中上下文，不能视为新的队伍运行或机制反事实模拟。

## 与既有审计的关系

[动态与常量共享公式边界审计](cross-validation/artifact-dynamic-boundaries-20260928.md)曾列出 a7 炉火融炼之心与血红之证没有共享标量接线，以及 Blizzard／Disenchantment 快照 CR 和 Echoes／Song of Days Past／Ocean-Hued Clam 的原生直接算术。本轮分别加入 D6、018、019 路径，以新收据为准更新这些指定缺口；旧动态公式报告保留为当时的历史快照。

本轮不覆盖审计中的其他剩余通道：能量发放／扣除、护盾与治疗数值、目标抗性、冷却返还及其他原生事件算术仍各由来源路径处理。公式注册或某一命中成功联动不代表圣遗物全套、角色覆盖、所有命中路径或游戏机制已完整验证。预览／正式数据指针与 verified 分母不变。

主要共享实现落在 `packages/sim-core/src/source-host-artifact-dynamic-group-d.ts`、`source-host-artifact-additive-formula.ts`、`source-host-artifact-additive-capture.ts` 和 `apps/web/src/source-host-calculator.ts`；Go bridge 的两种附加值消费接口位于 `packages/source-host/go/pkg/core/sourcehost/artifact_additive.go`。018 的 b4／a7 补丁保留 host-nil 原生回退；019 native hooks 与共享计算已纳入本轮实际构建和页面流程。

## 本轮验收

b4 与 a7 source build 均通过：b4 5.733秒，WASM SHA-256 `a8cfa04ac4ddeeaa1e7f54bdbe36fe65e045da2bce8bd5c8855e2577e4e44e15`、42,152,429 bytes；a7 6.112秒，SHA-256 `0bc341a5252657a1ece650cc959016db6828ed0a54894a3b3afb38a6ec7c7d82`、62,728,925 bytes。收据 `docs/validation/source-artifact-events-{classic-build,stellar-build}-20260928.json`。

Web build 首轮因 `source-host-formula.ts` 中宽联合类型的 `ruleId` narrowing 错误失败（2.609秒）；根线程只调整了直接 kind 判断，retry1 通过（3.689秒、693 modules、Vite 835ms）。原有 chunk 警告仍在。

聚合页面首轮失败（8.713秒）：测试只从 terminal calculation 查 snapshot CR，却遗漏真正消费它的 `stellar-contributor`；仅改 spec，沿 `componentIds` 找实际 consumer，未修改生产代码。retry1 通过（墙钟8.305秒；单测6.9秒、runner7.8秒，`errors: []`）。本轮为三个 native 场景：b4 healing 116 calculations／50 hits；a7 healing 116／50；a7 stellar 523／100。Healing 两条轨迹各记录 Echoes 10次（5次rolled-proc、5次active-window）、Song of Days Past 5次（剩余次数5→1）、Ocean-Hued Clam 4次泡沫回调，各有2个目标消费者。泡沫记录在205帧建立并按1帧延迟于206帧命中两个目标。

余响编辑例中来源真实 ATK `1117.15967929 → 1217.15967929`，附加值 `.7 × ATK` 为 `782.011775503 → 852.011775503`；捕获命中伤害 `558.1318586136048 → 589.6318586136048`。导出 JSON 保留原始 capture，页面回放与编辑结果可核对。星辉流程实际触发六条 D6 规则；Blizzard 有36个实际快照 CR 事件，样本 provenance 为 holder actor 2、受益者 actor 0、target 1，捕获计算ID 21经terminal calculation 86至application 90，重放差0，并关联 scalar ID 19。Disenchantment 四件普通 `.16` CR scalar 在该场景有33次读取，但直接快照事件数为0，不能宣称其 snapshot hook 已通过；b4 本轮也未运行 snapshot 场景。

收据汇总见 `docs/validation/source-artifact-events-measurements-20260928.json`；三个场景原始结果分别为 `source-artifact-events-classic-healing-20260928.result.json`、`source-artifact-events-stellar-healing-20260928.result.json`、`source-artifact-events-stellar-stellar-20260928.result.json`，聚合结果为 `source-artifact-events-20260928.result.json`。本轮没有额外执行核心单测。

结果只验证这三条固定来源场景和本次捕获／编辑路径，不代表全部事件数、所有目标组合、完整精炼矩阵或游戏实测。能量、护盾／治疗、目标抗性、冷却返还等边界审计中的其他缺口仍未完成；数据指针及 verified 分母不变。
