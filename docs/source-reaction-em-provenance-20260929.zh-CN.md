# 固定来源反应元素精通来源回执（2026-09-29）

本批把固定来源反应基数当时实际读取的元素精通（EM）连接到共享公式来源图，不改数值公式、反应触发或原生时序。每个固定源码lane有11处读取：九个剧变反应（Overloaded、Burning、Electro-Charged、Swirl、Shatter、Superconduct、Bloom、Burgeon、Hyperbloom），以及 Aggravate／Spread 两处激化读取。原 `Stat(EM)` 改为返回相同数值的 `StatWithProvenance(EM)`；反应tick继续消费创建反应攻击时保存的 producer，不重新读取。

`CalcReactionDmg` 和 `CalcCatalyzeDmg` 增加可选回执参数，将已有 `SourceHostStatRead` 传给 `transformative-base`／`additive-base` 请求。wire 的 `statRead` 可选以兼容旧 capture。resolver 只在 actor、frame、`kind=stat`、`nonExtra=false`、EM selector `[8]` 及读取数值均匹配时，才把 `transformativeEmBonus`／`additiveEmBonus` 输入连接到实际 getter，并展开它的 modifier 依赖。普通可见 UI 编辑的是 reaction producer 的等级、EM 与反应加成；它不等于下游 main-hit 的 EM 输入。没有历史回执时旧文件仍可计算，但保留“本次 EM getter 来源未保存”的具体缺口。编辑本组件 EM 不会误连历史 getter。

验证边界：`source-host-reaction-em.test.ts` 2/2通过（Vitest 720毫秒、测试97毫秒、墙钟1.295秒）；classic 与 stellar 固定来源构建分别7.969秒、8.551秒；Web typecheck/build 首次通过，墙钟4.603秒、Vite 938毫秒。浏览器首轮在 classic 的公式值、回执和重放差0后，因测试选择器命中三个嵌套 `summary` 而失败；只收窄测试选择器，未改生产代码。随后唯一聚合案例通过（case 9.1秒、runner 10.1秒、墙钟10.645秒，`pageErrors=[]`）。两lane 各12个 reaction producer、8个感电tick；7个 producer 被消费，producer 43复用两tick。所选应用编号51关联 actor 1、frame 204 的 EM=100 getter；两版重放差0。将 producer EM 编辑为110后，伤害差188.08115910629658，JSON导出／导入保留原 getter 与编辑结果。两lane gameplay 与先前相同脚本去掉本批 `statRead` 后的结果完全相等。

浏览器只实测 Electro-Charged；其余十条来源位置有固定源码静态接线与双lane编译覆盖，没有逐个反应的运行样本。首次选择器失败保留在 `docs/validation/reaction-em-browser-20260929.first-failure.result.json`；最终回执见 `docs/validation/reaction-em-browser-final-20260929.json` 和 `docs/validation/reaction-em-browser-20260929.result.json`，综合测量见 `docs/validation/reaction-em-measurements-20260929.json`。本批未改变 `verification="provisional"`、`explanationStatus="partial"`、coverage 分类、数据指针或 `completeCast` 状态；也不声称游戏内验证或所有反应均已独立实测。
