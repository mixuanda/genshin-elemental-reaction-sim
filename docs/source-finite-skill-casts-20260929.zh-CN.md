# 固定来源有限动作与原生施放回执（107）

2026-09-29。本批交付固定来源宿主的显式有限技能范围：单技能页和动作集合可呈现完整或部分范围、逐击共享公式trace与计算器编辑，并支持导入导出及团队动作集合交接。有限范围闭合由真实原生调用／攻击派发回执结合固定源码契约计算。唯一实测的classic Amber Q完整窗18/18根攻击闭合、18击公式重放差0；截断窗口5/18闭合、13击待结，仍为partial。除此之外，本批还对十个固定源码根动作入口作静态契约清点；静态清单不代表十项均有runtime样本。

审计清单来自 [固定源码契约 JSON](validation/source-finite-intrinsic-contracts-20260929.json)，固定源 commit 为 classic `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 与 stellar `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`。表中的行号来自已补丁固定源码；每个来源文件 SHA-256 和辅助 callback/init 审核均保存在 JSON 中。

| 角色／动作 | 方法根攻击数契约 | 固定源码依据 |
| --- | ---: | --- |
| 凯亚 E | 1 | `internal/characters/kaeya/skill.go`：QueueAttack 位于 hitmark 前；粒子、A1治疗及命座初始化不增加此施放的攻击 |
| 砂糖 E | 1 | `internal/characters/sucrose/skill.go`：一次排队，另有 42 帧延迟；A4／命座回调改状态，不增加根攻击 |
| 神里绫华 E | 1 | `internal/characters/ayaka/skill.go`：一次排队；A1 与粒子回调不增加施放攻击 |
| 班尼特 E | 有效蓄力等级为 0 时 1 | `internal/characters/bennett/skill.go`：只计 skillPress 的根攻击；蓄力分支不在本契约内 |
| 迪奥娜 E | `hold=1` 时 5，否则 2 | `internal/characters/diona/skill.go`：按 pawCount 逐一排队；护盾与粒子回调不是额外攻击 |
| 安柏 Q | 18 | `internal/characters/amber/burst.go`：三个命中节奏分别 5、3、10 次，直接排队 |
| 重云 Q | 命座低于 6 时 3，C6 起 4 | `internal/characters/chongyun/burst.go`：三个命中帧，C6 另排第四击 |
| 刻晴 Q | 10 | `internal/characters/keqing/burst.go`：起始 1、循环 8、末击 1 |
| 钟离 Q | 1 | `internal/characters/zhongli/burst.go`：一次排队；C2 玉璋护盾为非伤害任务 |
| 班尼特 Q | 1 | `internal/characters/bennett/burst.go`：一次排队；领域后续治疗／增益不计为额外 Q 根攻击 |

## 回执含义与验证状态

动作调用回执描述一次原生 `useAbility` 调用的角色、动作、参数、命座／突破、开始与返回帧、返回成功标记、返回的 action callback 数及 `OnRemoved` 是否存在，并列出该调用中实际观察到的攻击排队记录。攻击派发完成回执只描述一次原生 `ApplyAttack` 敌方循环检查的 target keys、跳过的已死亡目标及来源是否声明跳过目标。回执分开保存“方法根攻击契约”“本次是否排队／派发”和“逐目标实际应用”，不可互相替代。

共享 `107-ability-dispatch-receipts.patch` 同时位于 classic 构建链与 stellar overlay 构建链；stellar 构建顺序明确包含该共享补丁及 overlay 的 `ability_receipt.go` bridge。两版 `source:build` 命令回执分别 exit 0，用时 7.238 秒与 7.569 秒（[classic](validation/source-finite-cast-classic-build-20260929.json)、[stellar](validation/source-finite-cast-stellar-build-20260929.json)）。这只证明两版产物可编译 instrumentation；实际运行仅在 classic Amber Q 做了两次，stellar 本批只有构建证据。

## 有限范围产品行为与实际证据

在单角色技能页及动作集合中，用户可按静态来源契约分析明确选择的有限动作范围。完成状态由捕获的原生调用／派发／命中回执与仓库固定契约重新计算，不读取捕获内可伪造的 `completeCast` 标记。闭合范围提供逐击共享伤害公式与代入追踪，并可在计算器编辑；结果支持导出／导入，团队动作集合可接收该范围。完整收集与观察到的部分集合分别呈现；窗口截断时保留已知小计和未结攻击，不称完整。十条固定源码契约的UI状态分类不代表十种动作均有实际运行样本。

经典 Amber Q 是唯一运行样本，且仅有两次原生执行（完整JSON归档、SHA及截图见[测量记录](validation/source-finite-cast-measurements-20260929.json)）：

| 捕获 | 配置／实际帧 | 18个源码预期根攻击 | 回执及公式结果 |
| --- | ---: | --- | --- |
| 完整窗口 | 360／360（6秒） | 18个均闭合、18次派发完成、18个应用、0个待结攻击 | 汇总 3644.908929157875，与原生总伤害相同；18击重放差均为0；导出后再导入结果相同 |
| 截断窗口 | 120／120（2秒） | 5个闭合，13个仍待结算 | 已知小计 1100.540369191713，`completeCast=false` |

闭合审计还确认：将其中一击标为“不纳入”后，生命周期闭合证据仍成立，但当前合计不再标为完整技能伤害；移除完成回执则无法证明生命周期闭合；没有新式有限回执的旧捕获无法启用有限分析、观察命中集合保持partial。完整状态仅适用于本次经典 Amber Q 的固定来源契约与实际捕获范围，不能外推为其它角色的验证。

## 本批检查和边界

Web最终构建通过，用时4.093秒（JSON导入修正后的构建）；首轮类型构建3.258秒及中间替换语法错误构建0.680秒均失败并保留记录。浏览器单案例最终通过：runner报告10.7秒、命令墙钟11.165秒，未单独记录测试用例耗时，`pageErrors=[]`。最初浏览器尝试在用例发现前因缺少JSON import attribute失败，执行原生次数为0；该次不计入上述两次执行。未跑Vitest。之后仅调整结果区布局（结果移至逐击编辑器上方、明细折叠），Web-only构建1.267秒通过；无后续浏览器／原生复测，截图早于此布局更新但公式内容相同。逐次完整命令记录见[测量JSON](validation/source-finite-cast-measurements-20260929.json)。

本批不覆盖 E/Q/N 全角色、非根攻击回调、后续状态与延迟任务的完整生命周期、武器／圣遗物独立攻击、之后的玩家动作、无关队伍伤害、治疗／增益延续，也不补足来源未验证的反应。根攻击队列数量不等于命中次数：攻击仍可能因位置、目标状态或来源行为未产生目标应用。native source 输出亦不是游戏验证。完整 Amber Q 的有限闭合不扩大至未审计来源动作；未闭合项仍为partial；数据指针SHA未变，active verified仍为null，全局角色 `coverage`、`verified` 与全量完成状态不变。下一步优先扩展不同角色／动态有限动作来源，不重复扩测Amber Q。
