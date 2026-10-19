# 久岐忍：固定 Optimizer 来源审阅

本记录只审阅固定生产来源，不修改计算器、映射或覆盖状态。来源仍为 `provisional`，不构成游戏内机制认证。

## 可重现来源

固定提交：`frzyc/genshin-optimizer@180a0a1015cb725c7570cd828eb086749960df98`。2026-09-24 实际从固定 raw URL 获取生产角色表、天赋参数、角色数据、中英文角色文本及许可证，共 6 文件、30,998 字节；全部 HTTP 200。每份原文的 Git blob 均与本地固定 tree.json 所记录的 blob 相同，另记录 SHA-256、字节数与实际获取时间。

- [来源清单](../../packages/game-data/sources/kuki-skills/manifest-go.json)
- [逐参数比对结果](../../packages/game-data/sources/kuki-skills/optimizer-catalog-comparison.json)
- [固定生产角色表](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/KukiShinobu/index.tsx)
- [固定十五级参数表](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/Data/Characters/KukiShinobu/skillParam.json)
- [固定中文文本](https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/chs/char_KukiShinobu_gen.json)

这些文件属于同一仓库，不能作为多个独立来源。

## 倍率与条件

稳定身份为 `talent-set:kukishinobu`。以下参数坐标由生产表索引逐项追溯，E/Q 全部 14 组十五级数组、共 210 个数值，与当前活动目录精确相等。

**活动目录更正：**初次比对误读了 `packages/game-data/src/generated/catalog.zh-CN.json` 的历史 6.7 目录，曾将其误称为活动目录。现已依据 `packages/game-data/manifests/runtime/current.ts` 的 `activeCatalogData` 引用，实际重新比对 `snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34/catalog.json`，版本为 `gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2`；210 个数值全部精确相等。比对档案同时记录当前指针、实际目录路径及 SHA-256，并保留历史目录比对的更正记录。此次更正没有重复联网获取、测试或构建。

|项目|Optimizer 坐标|目录坐标|来源语义|
|---|---|---|---|
|E 初击|`skill[0]`|`talent:kukishinobu:combat2.param1`|ATK 缩放；T1 为 0.75712|
|E 环击|`skill[3]`|`talent:kukishinobu:combat2.param4`|ATK 缩放；T1 为 0.2524|
|E 持续时间|`skill[5]`|`combat2.param6`|12 秒；C2 再加 3 秒|
|Q 单击|`burst[0]`|`talent:kukishinobu:combat3.param1`|HP 上限缩放；T1 为 0.036048|
|Q 普通／延长总倍率|`burst[1]`／`burst[2]`|`combat3.param2`／`param3`|独立存储的显示总倍率|
|Q 普通／延长持续时间|`burst[3]`／`burst[4]`|`combat3.param4`／`param5`|2 秒／3.5 秒|
|A4 伤害增加项|`passive2[1][0]`|此处不新增目录映射|0.25 × EM，突破至少 4|

生产表第 102–110、127–139、159–165 行将 A4 作为固定基础伤害增加项送入技能伤害，E 初击与环击都适用；Q 仍是 HP 单击公式，没有该 E 增加项。治疗的 0.75 × EM 与伤害分开。A1 只增加治疗，不作为伤害乘区。

Q 中文描述明确在**施放时**检查生命值，条件为 **HP ≤ 50%**；生产 UI 同样使用 `lessEqPercentHP`。因此恰好 50% 属于延长分支，不能把它实现为严格小于或逐次命中重新判断。

## 次数证据及差异

Optimizer 的生产表只建立独立 E/Q 命中节点，既不安排 E 环击任务，也不安排 Q 命中任务。中文说明给出 E 环击间隔 1.5 秒，参数给出 C0 持续 12 秒、C2 持续 15 秒，但没有首次环击和终点纳入规则；本审阅**不以持续时间除间隔认定 8／10 次**。完整 E 与 Q 次数、帧偏移、刷新及快照语义须由固定可执行调度源码另外证明。

Q 显示总倍率还存在独立舍入：十五级中，普通总倍率与 `7 × 单击倍率` 的最大绝对差为 `0.000003`；延长总倍率与 `12 × 单击倍率` 的最大绝对差为 `0.000005`。不能要求这些比值严格等于整数，也不能用显示总倍率替代逐击求和。上面的数值比对档案保留每一级十进制残差。这是数表舍入差异，不是本次观测到的游戏伤害差异。

C4 与 C6不纳入本次 E/Q 完整动作结论：生产表另有 C4 HP 伤害节点、全局技能增加项与 C6 条件精通项，自动触发条件及历史状态须另行审阅。来源表中“支持一个节点”不等于整个命座生命周期已实现。

本次只执行来源获取、Git blob / SHA-256 记录及定向数表比对；没有执行测试、构建、覆盖统计或旧检查全集。
