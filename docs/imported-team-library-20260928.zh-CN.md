# 导入队伍与来源队伍预设库

本批在 `/builds` 增加从已解析的 GOOD 装备导出或 Enka 展柜结果中，批量把1至4套配装交给固定来源队伍的流程；普通／月曜 b4 与星辉 a7 分开选择。每项必须具备完整装备、命座、基础普攻/E/Q天赋，并选定精确来源角色形态。全部成员转换、映射和队伍验证通过后才一次提交；未映射形态、缺字段或来源版本不匹配会阻止提交。

合并模式用导入装备替换相同角色条目，同时保留现有角色actor ID、起步能量和动作序列；替换模式创建只包含选中成员的新草稿，动作列表为空。既有单角色编辑与单槽载入仍保留。每个来源版本另有可命名的本地多预设库，支持另存、明确更新、载入和删除；仅选择预设不会自动覆盖当前队伍。小毕业／大毕业是可编辑参考配装假设，不是推荐排名，也不增加既有124×2配装预设或18个来源模板的覆盖分母。

## 当前验证边界

核心handoff两用例首轮通过，墙钟2.718秒；生产Web构建首轮通过，墙钟3.794秒、742模块、Vite 896ms。构建仍有既有的chunk-size和static/dynamic import警告。页面E2E retry1通过，墙钟3.480秒、用例2.5秒、runner3.2秒，`pageErrors[]`为空。首轮失败是测试断言预期键写成`ayaka`，而固定来源实际键为`kamisatoayaka`；修正断言，未改生产代码。

E2E通过两名成员的合成GOOD输入：缺失Q天赋的Lisa行被禁用；A/B两套预设分别有2/3个动作，B持续18秒；选中预设不自动载入，从本机载入A后导出的JSON与保存前相等，且刷新后预设仍保留；classic与stellar库隔离。将Kaeya武器改为`harbingerofdawn`后合并保留2个现有动作，命名预设A没有被改写。本轮没有测试从文件导入JSON。该GOOD夹具带两把可映射剑、圣遗物列表为空，也没有执行伤害计算。

Enka解析入口已接入，但本批没有发起真实UID/Enka网络请求；E2E用合成GOOD数据，不代表真实用户账号或真实Enka结果。没有重建或运行b4/a7 WASM。tracked `git diff --check` 通过0.063秒；运行时current与pointers SHA保持前批值。本批不增加角色、动作、装备或游戏verified覆盖。完整目标仍active。

更广产品目标仍有代码与证据缺口：任意帧来源状态恢复尚未完整实现；部分完整技能和机制缺动作事件或可靠来源；下一版本映射、完整名册与游戏验证缺可靠证据，远端数据更新流程也未实跑。后续工作清单见[剩余产品实施清单](remaining-product-implementation-20260928.json)（当前优先级持续更新）。

收据摘要在[测量JSON](validation/imported-team-library-measurements-20260928.json)；实现位置包括[批量导入控件](../apps/web/src/imported-roster-controls.ts)、[队伍handoff](../apps/web/src/source-team-handoff.ts)与[来源预设库](../apps/web/src/source-team-preset-library.ts)。
