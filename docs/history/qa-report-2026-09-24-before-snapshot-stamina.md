# QA 与实测报告

更新：2026-09-24。本轮完成刻晴 Q 十击、行秋 E 两段的独立条件计算，以及主模拟器西风暴击产球的实际反馈、界面与导出。独立单击／单技能仍无需队伍；完整全游戏 goal 保持进行中。未提交、推送或部署。

## 实际整合检查

| 检查 | 结果与范围 | 原始证据 |
| --- | --- | --- |
| `npm run data:status` | 首次exit 0；120身份／868命中／536完整条件动作／149部分／18具体阻塞；194武器／958合法精炼、53二件套／44四件套 | [日志](../validation/critical-energy-actions-data-status.log)、[退出码](../validation/critical-energy-actions-data-status.exit) |
| `npm run data:check` | 首次exit 0；历史目录复现，活动7.1投影和圣遗物来源哈希一致 | [日志](../validation/critical-energy-actions-data-check.log)、[退出码](../validation/critical-energy-actions-data-check.exit) |
| `npm run build` | 首次exit 0；全工程TypeScript与生产构建，296模块、336 ms | [日志](../validation/critical-energy-actions-build.log)、[退出码](../validation/critical-energy-actions-build.exit) |
| 预热详情边界修复后的 `npm run build` | exit 0；296模块、524 ms。只过滤详情中的边界后能量，未改模拟值 | [日志](../validation/critical-energy-actions-build-ledger-boundary.log)、[退出码](../validation/critical-energy-actions-build-ledger-boundary.exit) |
| 新增2项浏览器流程 | 首次2/2通过，exit 0，总21.7 s；计算器18.8 s，西风1.2 s | [日志](../validation/critical-energy-actions-e2e.log)、[退出码](../validation/critical-energy-actions-e2e.exit) |

浏览器命令：`GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/critical-energy-actions.spec.ts`。使用4173生产产物；运行前将测试对精炼控件的假设从number input修正为实际select，没有浏览器失败或重试。未重跑旧浏览器、单元全集或性能；发布校验脚本加入本文件，远端CI尚未执行或配置必需检查。

## 新增聚焦核心检查

| 命令 | 实际结果 |
| --- | --- |
| `npx vitest run packages/sim-core/src/__tests__/calculator-keqing-xingqiu.test.ts` | 首次1文件3项通过，1.35 s、测试151 ms、exit 0。75个T1–15数值和归档哈希；真实入口、A4/C4/C2、逐击反应、明确最终覆写、源装备非转换ER、最终面板及JSON。[日志](../validation/keqing-xingqiu-core.log)、[退出码](../validation/keqing-xingqiu-core.exit)、[来源与逐项数值](../cross-validation/keqing-xingqiu-source-audit.md) |
| `npx vitest run packages/sim-core/src/__tests__/favonius-runtime.test.ts` | 首次2通过1失败，873 ms、测试78 ms、exit 1。运行时资格和非暴击场景通过；独立的既有粒子来源计数仍预期0，因实际2组新西风微粒拒绝结果。[日志](../validation/favonius-runtime-core.log)、[退出码](../validation/favonius-runtime-core.exit) |
| 修正粒子来源计数，仅 `-t 'feeds real seeded critical callbacks'` | 1通过2跳过，905 ms、测试123 ms、exit 0。补足来源可推导的预期产物，未放宽数量约束；没有重跑已过项。[日志](../validation/favonius-runtime-core-energy-fix.log)、[退出码](../validation/favonius-runtime-core-energy-fix.exit)、[完整记录](../validation/favonius-runtime.md) |

文档核对后发现预热西风详情按触发帧筛选，但关联能量可能晚于观察开始边界；现已对详情能量加同一半开区间过滤。模拟核心和总量不改，只重新构建通过，未重复浏览器流程；上表浏览器结果对应此详情过滤之前的生产产物。

以上为独立命令，不能合并声称一次全套通过。西风首次失败及修正均保留。没有大型 Monte Carlo、外部 gcsim 运行或性能复测；来源文件交叉核对不冒充外部运行验证。

## 可复算数值与浏览器行为

刻晴 T1 Q：初击0.88＋8×0.24＋尾击1.888。ATK1000、原CR0.5、CD1、双方90级、10%雷抗且A4解锁：非暴击 `1000×4.688×0.5×0.9=2109.6`，实际CR0.65，期望 `2109.6×1.65=3480.84`。改共享CR为0.65且声明已含A4，结果相同。独立选择末击仍可计算，JSON恢复保留其单击选择与完整轨迹。

刻晴的源装备A4还增加15%非转换充能。聚焦来源公式夹具由ER1.2加入A4后为1.35，西福斯EM100的转换再加0.036，最终1.386；绝缘只读取1.35，因此爆发增伤0.3375。最终面板与JSON结果不重复叠加。此项由核心测试执行，未冒称浏览器配装流程再次测量。

行秋 T1 E：1.68＋1.912。C4且起手Q有效，天赋基数×1.5；A4加入20%水伤，C2既有减抗使10%变−5%，抗性乘数1.025。同一基本面板下非暴击 **3313.62**，期望 **4970.43**。C4不放大独立附加基数；核心另检查仅第一段蒸发，第二段独立不蒸发。浏览器实际将A4和C2改为已含的最终增伤／抗性，验证总量不变及JSON逐段轨迹相同。

西风合成两人队伍：精五、CR0/1明确逐击条件、零能量、10帧收球延迟、无角色卡肉。0帧非暴击不抽样；1帧暴击成功产球；2帧暴击仍在冷却；361帧恰到冷却边界再次触发，精五仍消耗随机数。微粒实际在11／371帧收到，每组站场A得6，后台B得4.8。5帧Q因0/6能量失败，12帧Q用收球后的6能量成功。A最终获12、消耗6、余6；B获9.6、余9.6。四击总伤 `1000×(1+3×1.5)×(190/400)×0.9=2351.25`，这是合成面板的机制验证，不是真实角色配装DPS。

浏览器还核对了显式武器／精炼／延迟控件、实际随机政策和无角色卡肉时钟、四条可展开事件记录、成功触发对应的伤害/粒子/每角色能量记录，以及完整导出再导入后重新模拟的抽样、能量与产物相同。核心另外把四次命中完整上下文还原到计算器，数值逐一相同；篡改随机抽样被结果验证拒绝。

## 仍保留的边界

- 数据状态仍为released/provisional，活动正式验证数据集为空；868命中与536条件动作不能当作完整角色或整队就绪数量。
- 刻晴支持已审C0–C3；C4/C6已有25%攻击和按动作类别6%雷伤来源，但缺逐段状态适配。行秋支持本次E的C0–C6，Q剑雨生命周期、治疗和完整附着不归入这次计算。两者都要求已说明的稳定快照条件。
- 西风源码冷却受角色卡肉延长；本宿主尚无角色卡肉时钟，限定无角色卡肉条件。平均暴击与特殊月曜／星辉宿主组合拒绝执行，旧固定武器来源示例也不能附加西风后保留原身份。私有随机状态／冷却未进入完整相位检查点，不能用它宣称确定性稳态。
- 西风独立流保证本地重现，不与gcsim共享随机流的同seed轨迹等同。有限随机预热可以保留该真实状态运行，但本轮未另行执行其新随机统计矩阵。

## 历史与测量时点

[上一轮烟绯／随机起步QA](../history/qa-report-2026-09-24-before-critical-energy-actions.md)保留当时7.1目录、核心定点修正、首次浮点断言失败及两项浏览器结果。旧诺艾尔外部六击残差0和105.67709476067012总伤仍为原时点证据。

[既有性能](../cross-validation/simulation-execution-benchmark.md)固定于2026-09-23T06:42:28.209Z：120秒269事件，2预热12计时；trace关闭中位30.500 ms／p95 33.336 ms，开启129.735／148.481 ms，随机关闭trace中位29.397 ms、34.01次/秒。未重测，不将这些数字当成当前新增西风的性能结论。

环境Apple M5 Max、Darwin arm64、Node24.15.0、npm11.12.1、Vitest4.1.10和Playwright Chromium。生产构建保留大chunk及无效动态拆分提示，未扩展为与本轮无关的重构。

本轮 `git diff --check` 首次exit 0、无输出；仅检查Git已跟踪差异，不能作为所有未跟踪文件已审阅的证明。[日志](../validation/critical-energy-actions-diff-check.log)／[退出码](../validation/critical-energy-actions-diff-check.exit)。完整未完成范围见[已知限制](../known-limitations.md)。
