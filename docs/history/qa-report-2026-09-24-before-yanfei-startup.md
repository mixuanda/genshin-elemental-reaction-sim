# QA 与实测报告

更新：2026-09-23。本轮交付32段新增条件命中、一斗两种独立逆袈裟计算、确定性动作状态检查点，以及普通回能队伍控件和导出政策。未提交、推送或部署；只执行与实际改动直接相关的检查。

## 当前整合检查

| 检查 | 实际结果与范围 | 证据 |
| --- | --- | --- |
| `npm run data:status` | 首次exit 0；120身份／829命中、519完整条件动作／149部分／18具体阻塞；装备194武器／958合法精炼、53二件套／44四件套 | [日志](../validation/itto-checkpoints-data-status.log)、[退出码](../validation/itto-checkpoints-data-status.exit) |
| `npm run data:check` | 首次exit 0；历史目录复现、活动7.1投影和圣遗物属性来源哈希一致 | [日志](../validation/itto-checkpoints-data-check.log)、[退出码](../validation/itto-checkpoints-data-check.exit) |
| `npm run build` 首轮 | exit 1；TypeScript发现新增浏览器合成夹具的swap误写actorId；实际类型要求characterId，尚未执行Vite | [日志](../validation/itto-checkpoints-build.log)、[退出码](../validation/itto-checkpoints-build.exit) |
| 修正夹具后 `npm run build` | exit 0；全工程TypeScript通过，首次执行本轮Vite生产构建，280模块、339 ms | [日志](../validation/itto-checkpoints-build-recheck.log)、[退出码](../validation/itto-checkpoints-build-recheck.exit) |
| 新增两个浏览器流程 | 首轮2/2通过、exit 0、5.6 s；一斗3.0 s、队伍回能1.3 s | [日志](../validation/itto-energy-controls-e2e.log)、[退出码](../validation/itto-energy-controls-e2e.exit) |

浏览器实际命令为 `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/itto-energy-controls.spec.ts`，使用4173生产产物。没有重跑诺艾尔、安柏或旧装备流程，没有修改断言来消除失败。构建前只修正新合成夹具的类型字段名，浏览器运行后没有修复或重试。

一斗流程通过真实选择器编辑两份独立防御、Q有效等级、C6限定暴伤及最终覆写，切换连斩/终结分支，应用赤角装备、转换最终面板、JSON往返和重新配装；实际数值和来源轨迹保持一致。队伍流程使用明确合成的双角色四击，显式选择武器和normal/extra资格，执行两次Worker迭代、检查实际回能流水和独立RNG政策，导出并重新导入完整运行记录。

## 新增聚焦来源与核心检查

下列是三个独立命令的结果，不合并冒充一次全套。

| 命令与范围 | 实际结果与证据 |
| --- | --- |
| `npx vitest run packages/game-data/src/character-mappings/conditioned-basic-action-mappings.test.ts` | 首次1/1通过，1.15 s（测试26 ms）；25动作30命中、52源文件、450倍率、芙宁娜就绪追击与海森A1冷却条件。[原始日志](../validation/conditioned-basic-action-mappings.log)、[动作审计](../cross-validation/basic-attack-gap-audit.md) |
| `npx vitest run packages/sim-core/src/__tests__/calculator-itto-kesagiri.test.ts` | 首次3/3通过，1.18 s（测试58 ms）；实际注册的两单次动作、A4与Q快照、C6、C4门、最终面板及JSON。[实际工具转录与来源](../cross-validation/itto-kesagiri/source-calculation.md) |
| `npx vitest run packages/sim-core/src/__tests__/phase-checkpoint-runtime-state.test.ts` | 首次3/3通过，911 ms（测试104 ms）；真实预留、召唤边界、转换到期、重叠周期与完整尾段，随机模型不误判确定性稳态。[原始日志](../validation/phase-checkpoint-runtime-state.log)、[完整证据](../phase-checkpoint-runtime-state.md) |

一斗另将三个15级固定源向量与活动表逐项比较：45数值最大差0，保留10份源文件哈希。它是来源交叉核对，不是外部游戏运行；本轮没有调用外部gcsim或重测性能。

## 实际数值与范围

- 一斗连斩T1系数0.9116；原ATK2000、Q1历史非Extra DEF1000，固定转换为576、命中ATK2576。A4独立重击起手总DEF1500产生525附加基数。当前DEF改为9000不重采这两份历史快照；C6仅本段重击增加0.70暴伤，保层结果不乘成伤害倍率。
- 芙宁娜T1教学N1：始基力冷却中的物理伤害435.4758；就绪时包含水伤追加的总量520.6158。两种都是来源条件输入，不自动建立整个始基力冷却时间线。
- 确定性检查点：59帧E=60、预留10；60帧E=50、预留0。召唤45生成、165事件前仍存在，转换在165帧失效；168帧攻击保留生成快照flatAtk=280。120帧合法周期中同时保留两个重叠召唤、待生成任务、待扣能和转换，最后五边界建立周期1稳态。预热1080帧，测量仍为[1080,1200)，完整模拟尾端1483帧。此项是通用机制合成夹具，不是诺艾尔/安柏全角色稳态认证。

证据状态仍为released/provisional；固定源码TODO、C4有效装备推导缺口、完整长按重击与随机产层/消耗、复杂反应状态继续明确列出。普通回能共享12帧及切人重置仍为来源假定；独立子流不声称与gcsim同seed轨迹一致。

## 历史、勘误与性能

[上一轮诺艾尔/基础动作QA](../history/qa-report-2026-09-23-before-itto-checkpoints.md)保留当时首轮失败与定点复验。其钟离说明误写ATK1000/HP30000；实际测试文件一直使用ATK2000/HP20000。正确公式为4×(0.1075×2000+0.0139×20000)×0.5×0.9=887.4，突破三为387。本轮更正当前报告与动作审计，未修改旧测试数值或为文字勘误重复运行测试。诺艾尔外部六击残差0及105.67709476067012总伤属于上一轮测量，不冒充本轮再测。

[2026-09-23T06:42:28.209Z性能](../cross-validation/simulation-execution-benchmark.md)仍为旧代码时点：120秒／269事件、2预热／12计时；trace关闭中位30.500 ms／p95 33.336 ms，开启129.735／148.481 ms；随机关闭trace中位29.397 ms、34.01次每秒。本轮无重测，不宣称新代码全负载达到100 ms。

环境仍为Apple M5 Max、Darwin arm64、Node24.15.0、npm11.12.1、Vitest4.1.10、Playwright Chromium。构建保留大chunk和无效动态拆分提示。未扩大旧单元、浏览器、性能或外部矩阵。

本轮 `git diff --check` 首次exit 0且无输出，检查Git已跟踪差异；见[日志](../validation/itto-checkpoints-diff-check.log)与[退出码](../validation/itto-checkpoints-diff-check.exit)，不据此宣称所有未跟踪文件已审阅。计算器发布校验脚本已纳入新浏览器文件；远端CI未执行或配置必需检查。完整goal保持进行中，未完成范围见[已知限制](../known-limitations.md)。
