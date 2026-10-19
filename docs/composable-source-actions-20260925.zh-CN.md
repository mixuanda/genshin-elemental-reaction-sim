# 可组合来源能力、真实取样与普通队伍入口

2026-09-25。本批已将五个来源 Q 接入可编辑队伍、合法轮转、真实能量扣费、共享伤害轨迹及完整 JSON 恢复。独立单击／单技能计算器仍为永久入口，不要求建立队伍。本批通过必要检查，**全量目标仍在进行中**；来源状态保持 provisional，没有晋升 verified。

## 实际交付与计数

注册版本为 `gcsim-b4ae769-composable-abilities-v1`。来源能力绑定只约束该能力的倍率、命中、取样、附着、费用、冷却、取消与自身增益，不再冻结整场角色面板。角色等级、实际属性、配装、初始能量、队友、其他自定义能力和轮转继续可编辑；同一角色的来源身份、突破和命座须一致。

| 可组合来源能力 | 命中模板数 | 本批范围 |
| --- | ---: | --- |
| 安柏 Q | 18 | C0，有效天赋 1–15，突破 0–6 |
| 重云 Q | 3 | 同上 |
| 刻晴 Q | 10 | 同上；突破 4 后实际 Q 起手给予 A4 暴击率／充能增益 |
| 埃洛伊 Q | 1 | 同上 |
| 钟离 Q | 1 | 同上；突破 4 后独立保存起手 HP 附加基数 |
| 合计 | 33 | 5 角色、5 个可执行来源动作 |

另有安柏 N1–N5 的 5 个来源定义，其连段推进与重置尚未接入这个可组合入口，仍为 `source-only`，不能执行。旧安柏、诺艾尔、久岐忍整场固定来源情景保留自身契约，不混用新身份。

上述分母独立于 `.23` 的 **120 身份／1157 命中模板／639 完整条件动作／30 部分／11 阻塞**；本批没有增加条件动作或条件映射的 team-ready 数量。正式 verified 仍为 0。真实预览缺少匹配的来源能力摘要和可执行定义，不回退至 released 的数值、注册表或计数。

## 来源与执行契约

固定来源为 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 和 genshin-db `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`。本地归档保存 64 个文件；12 组各 15 级系数共 180 个值与固定两源及活动目录逐项精确对齐。归档和数值一致不等于游戏实测验证，完整身份与逐文件哈希见 [manifest](../packages/game-data/sources/composable-source-abilities/manifest.json)。

| 对象 | SHA-256 |
| --- | --- |
| `source.json.gz` | `83b7eeec927b4933c660205ba20f29e0af1098f70067553ab49f55700033f7cc` |
| `definitions.json` | `98c5133929c58b8768487feee7ca4e4c15d408dd219753f033c02ec6cce02001` |
| 固定活动 catalog | `3ed973284f87bba52bf2dcc407c5ad08aa76fdc2c8f0cad475f34ed0812f5602` |

当前入口要求 C0、60 FPS 合法时间线、`aura-v3`、固定附着 ICD 与直接伤害组、单个静止且在范围内的目标，禁用调试反应覆盖与角色／目标卡肉。绑定角色的元素和 40 能量上限须匹配；初始能量由用户提供，不自动补满。正常队伍页可显式创建空合法时间线、采用所需规则、增改来源能力，再经普通 DSL 或按钮编辑轮转。别名有歧义时要求明确 action ID。

实际取样经主事件队列执行，`sourceSnapshotLog` 保存拥有者、实际帧、任务优先级、采样状态和属性。钟离 Q 的 HP 附加值在起手独立取样，普通 ATK 伤害面板仍按自己的取样时点读取；刻晴各击使用当时实际 A4 状态。共享 AST 展示来源取样、独立附加基数的公式、变量、代入、中间结果与解释。原始命中、捕获、计算器恢复及完整运行 JSON 保留同一上下文，没有页面第二套伤害公式。绑定限制详见[能力契约](validation/composable-source-ability-contract.md)。

## 已执行的必要检查

本批只新增 **1 个单元文件／1 用例及 1 条页面流程**。近期累计有通过记录的数量为 **32 个单元文件／83 用例、20 条页面流程**；重试不重复计数。下表区分工具报告耗时和根任务命令墙钟。原日志与同名 `.exit` 一并保留。

| 检查 | 真实结果 | 原始记录 |
| --- | --- | --- |
| 组合核心 | 首轮 1/1 PASS，Vitest 3.27s，墙钟 3.754s，exit 0 | [日志](validation/composable-source-core.initial.log)／[退出码](validation/composable-source-core.initial.exit) |
| 数据生成 | 首轮 exit 0，墙钟 4.502s | [日志](validation/composable-source-data-generate.log)／[退出码](validation/composable-source-data-generate.exit) |
| 数据一致性 | 首轮 exit 0，墙钟 4.345s | [日志](validation/composable-source-data-check.log)／[退出码](validation/composable-source-data-check.exit) |
| 本地状态更新 | 首轮 exit 0，墙钟 3.469s；没有网络同步或重新观察版本 | [日志](validation/composable-source-data-status.log)／[退出码](validation/composable-source-data-status.exit) |
| 类型与生产构建 | 首轮 exit 1：`reproducibility.test.ts:604` 的审计字段联合类型漏列 `sourceSnapshotLog`；补齐后 exit 0，墙钟 3.283s、484 模块、Vite 442ms，原大 chunk 提示保留 | [首次失败](validation/composable-source-build.initial.log)／[退出码](validation/composable-source-build.initial.exit)、[窄修后通过](validation/composable-source-build.retry.log)／[退出码](validation/composable-source-build.retry.exit) |
| 正常页面 | 唯一新增流程首轮 1/1 PASS，Playwright 3.1s，墙钟 3.594s，exit 0；复用 4173 生产预览 | [日志](validation/composable-source-browser.initial.log)／[退出码](validation/composable-source-browser.initial.exit) |

数据生成／一致性日志中的 legacy 解析量只证明该生成路径一致，不代替活动目录或可组合能力的覆盖计数。没有重跑历史测试全集、性能、完整发布门或大型随机矩阵；本次文档收尾没有执行测试、构建或数据命令。

## 页面实际测量

唯一页面流程从两个没有来源绑定、没有合法时间线的用户面板开始，通过正常控件绑定钟离和刻晴 Q，修改天赋／突破后保存，再由用户明确填写初能并运行普通 DSL。共同条件为角色／敌人均 90 级、抗性 0、暴击率 0.1、暴击伤害 1、期望暴击模式、8 秒；钟离 ATK 1200／HP 20000，刻晴 ATK 经面板改为 1100。

| 项目 | 实测结果与独立手算基准 |
| --- | --- |
| 保存来源能力后的初能 | 原有 7／11 保留；没有自动填成 40 |
| 用户输入 40 后的真实 Q 费用 | 两角色各扣 40；分别在 7f 与 215f 扣除，预留与实际余额记录均保留 |
| 实际换人 | 请求 150f，151f 完成；刻晴 160f 起手 Q |
| 钟离独立 HP 附加基数 | 0f 取样，任务优先级 12.5；`20000 × 0.33 = 6600` |
| 钟离 101f 天星 | `(1200 × 4.4444 + 6600) × 0.5 × 1.1 = 6563.304` |
| 刻晴实际 Q | 10 击，A4 后 CR 0.25、ER 1.15；初击 650.375、连续斩击各 177.375 × 8、末击 1395.35，合计 3464.725 |
| 全场总伤／DPS | `6563.304 + 3464.725 = 10028.029`；`10028.029 ÷ 8 = 1253.503625` |
| 真实命中回计算器 | 天星重算差 0，共享轨迹与完整命中 JSON 一致 |
| 配置与完整记录重载 | `completeRecordRestored = true`；输入、运行选项、实际结果一致 |

以上是保存输入下的本地模拟与页面测量，不是游戏实测。测试的系数与期望来自固定来源和独立手算，不以待测模拟结果反推期望；详细步骤见[页面记录](validation/composable-source-abilities-e2e.md)。

## 尚未完成的范围

本批没有对新的来源取样任务执行完整检查点／周期闭合验证，不能把历史其他模型的 period 1 证据转用于本批。完整捕获和 JSON 恢复已通过，并不证明稳态。

五个 C0 Q 之外的可组合角色动作、安柏 N 连段、完整命座／被动、空间与卡肉、其他反应私有状态仍须继续实施。新一批 12 个部分动作、玩家护盾及自动装备工作正在推进，尚未计入本报告的已交付范围或通过数量。主要求和真正来源阻塞继续见[全量矩阵](master-requirements-status.zh-CN.md)与[已知限制](known-limitations.md)。
