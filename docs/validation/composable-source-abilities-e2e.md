# 可编辑队伍组合来源能力：浏览器流程

状态：`apps/web/e2e/composable-source-abilities.spec.ts` 唯一流程已首轮1/1 PASS，Playwright3.1s／命令墙钟3.594s，exit0。统一构建完成后以`GIDPS_PREBUILT=1`复用4173生产预览执行，没有启动／重启服务。[原始日志](composable-source-browser.initial.log)与[退出码](composable-source-browser.initial.exit)保留。本记录区分独立手算基准和页面实际测量。

## 覆盖的正常操作

- 导入明确标为 `user-supplied` 的两角色中性面板，无来源绑定和合法时间线。
- 在队伍页显式创建空合法时间线、指定起始角色与 1 帧切人占用，并采用所需 `aura-v3`、固定附着 ICD、直接伤害组和禁用卡肉规则。
- 正常选择钟离、刻晴的来源 Q。钟离绑定从 1 级／突破 3 编辑为 2 级／突破 4，刻晴使用 2 级／突破 4；角色名不充当来源身份。
- 保存绑定后，角色面板和初能 7／11 保持原样。随后由用户输入明确的 40 初能，并在正常面板把刻晴攻击从 1000 改为 1100，来源绑定继续保留。
- 普通 DSL 请求为钟离 0f Q、150f 切人、刻晴 160f Q。检查实际 40 能量的预留与扣除、151f 完成切人、钟离独立 HP 取样以及刻晴 10 击和 A4。
- 选钟离真实命中进入独立计算器，检查差值 0、共享轨迹和完整命中 JSON；导出配置及完整运行记录，经正常导入重算后检查输入、选项与结果相同。

## 来源与手算基准

固定来源系数从 `packages/game-data/sources/composable-source-abilities/definitions.json` 静态核对，控件身份由 `source-ability-registry.ts` 的实际标识与页面标签核对。测试没有静态导入生产 registry 的 JSON 模块链，也不调用模拟核心计算期望值。

共同条件：角色与敌人均 90 级，抗性 0，输入暴击率 0.1、暴击伤害 1，8 秒，期望暴击模式。钟离 ATK 1200／HP 20000；刻晴 ATK 1100。

| 项目 | 独立手算基准；对应实际断言已通过 |
| --- | ---: |
| 钟离 101f 伤害 | `(1200 × 4.4444 + 20000 × 0.33) × 0.5 × 1.1 = 6563.304` |
| 钟离独立 HP 附加值 | `20000 × 0.33 = 6600`，0f 取样 |
| 刻晴初击／每次连续斩击／末击 | 650.375／177.375／1395.35 |
| 刻晴十击合计 | 3464.725 |
| 总伤／DPS | 10028.029／1253.503625 |

实际日志输出：`initialEnergyPreserved=[7,11]`、`burstCosts=[40,40]`、`meteorDamage=6563.304`、`meteorFlatHpContribution=6600`、`keqingHitCount=10`、`totalDamage=10028.029`、`dps=1253.503625`、`replayDifference=0`、`completeRecordRestored=true`。天星独立HP的`sourceSnapshotLog`为0f、priority12.5；原始命中和计算器共享轨迹相同，完整配置、运行选项和结果重载后相同。

本流程不把固定源码来源一致视为游戏实测认证，不覆盖其他动作、命座或动态目标场景，没有新增完整检查点周期闭合实测。核心1/1、数据及统一构建的真实结果和原构建类型失败另见[本批报告](../composable-source-actions-20260925.zh-CN.md)。本页面没有额外运行旧测试、构建或随机矩阵；本次文档收尾没有执行检查。
