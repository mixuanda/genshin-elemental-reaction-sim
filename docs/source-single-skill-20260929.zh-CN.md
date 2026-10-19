# 固定来源单角色单动作执行入口（2026-09-29）

本批在普通 `/calculator` 增加独立的单角色来源动作入口：从 b4／a7 固定来源名册选择一个角色，直接运行该角色已登记为 implemented 的一次 E、Q、N 等动作，不要求用户先组队或编写 GCSL。执行器内部按一个成员、一次动作和后续等待观察窗编译来源请求；UI不开放任意队伍轮转脚本。每次输入固定来源版本与revision，并编辑角色等级、命座、基础天赋、武器／精炼、圣遗物套装与词条增量、目标、观察秒数、启动能量模式及 uint64 种子。小／大毕业配装是本地可编辑参考值，不代表最优或实测。

可导入并预检单人来源草稿 JSON、现有来源队伍草稿 JSON，以及 GOOD／Enka 导出的装备与圣遗物词条。导入结果作为候选显式选择后才能应用；缺少来源角色键、revision、命座或基础天赋时保持错误，不补零或猜默认值。游戏配装导入读取装备输入，不从最终面板反推来源。输入JSON可导出，运行结果以独立schema导出。

原生结果保留完整source result，包括未关联命中；用户选择 creation／trigger／status-owner 关联只决定后续分析的collection子集，不会删掉原始结果或其它关联。关联选择不自动偏向“命中较多”的类型。若有已关联的实际命中，系统复用共享命中集合：每击恢复保存的完整计算输入，可用已有共享公式计算、编辑、导出并导入；无命中时，只有明确miss账本才能记零，否则数值保持未知。集合的 `completeCast` 固定为 false，有限观察窗与已记录命中不等同完整技能施放，也不输出DPS。

此入口复用现有固定来源名册、动作能力标记、配装转换、source worker、action provenance及共享命中collection；没有新增 native mechanics。UI明确标注来源及机制仍为暂定，并保留所选动作未观察到的记录边界。

验证分阶段完成：无 native build 或新 native mechanics，本批复用固定版本来源执行器。Web 首构建6.720秒通过；发现参考构筑载入后tier控件仍禁用，修正状态同步后构建6.552秒通过。首次E2E在Node测试加载阶段遇到JSON import attribute错误；测试改为type-only import后，双lane Kaeya E 聚合案例通过（墙钟14.543秒、case12.6秒、runner13.9秒）。随后页面复核发现命中标题误用application文本，且单技能面板下方仍显示无关legacy artifact utility；只修显示标签并在单技能模式隐藏该工具，未改公式／native行为。最终Web构建6.830秒通过，最终UI smoke仅重跑classic，E2E通过（7.979秒）。因此，双lane双结果／回放证据来自标签修复前的聚合运行；标签修复后的最终UI核对只覆盖classic，不能称作最终UI已对stellar重跑。

双lane聚合运行每lane为 Kaeya E 一次、一个观察到的命中；原始命中collection首击重放差0，单击倍率编辑后collection与JSON往返一致。此前双lane浏览器回执记录classic为 synthetic GOOD fixture（非真实账号），stellar用本地 starter 配装；没有发送真实Enka请求。结果明确显示 `completeCast=false`。最终classic-only结果见 `docs/validation/source-single-skill-browser-classic-final-20260929.json`；双lane标签修正前结果见 `docs/validation/source-single-skill-browser-both-before-label-fix-20260929.result.json`。该入口在本批时使用固定 radius=2、pos=0,2.4；后续的[初始目标几何输入](source-target-geometry-20260929.zh-CN.md)已开放可编辑几何，但不代表真实接触几何已普遍验证。所有精确command记录以 `docs/validation/source-single-skill-measurements-20260929.json` 为准（聚合文件由主线程归档）。本批不提升 `verification`、coverage、数据指针或 `completeCast`。
