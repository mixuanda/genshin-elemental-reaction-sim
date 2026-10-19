# 武器独立追击计算器验证记录

2026-09-24；范围是钺矛、苍纹角杯、冷寂迸音三把武器的 **一次实际追击**，不要求团队或轮转，不把单次伤害入口记为武器全机制完成。实现与来源详见 [专项来源报告](../cross-validation/weapon-proc-calculator-source-audit.md)。

## 本轮实际顺序

1. 读取前轮审计后，重新打开固定 gcsim 三份实际武器源码及共享伤害代码、三份固定目录原文，归档 12 个实际源文件。另独立读取并归档固定 Optimizer 17 个原文，逐一核对固定树 Git blob。
2. 三武器 R1–R5 共 **15 个倍率位置**：gcsim 源式、目录和 Optimizer 生产 sheets 一致，最大差 **0**。空 refinementBonus 和 TODO 桩没有作为已实现证据。
3. 实现独立 CalculatorDocument builder，标签 `ordinary / physical / proc`，源码倍率进入既有 AST；最终面板、目标和物理增伤可编辑，倍率只读，JSON 可还原。
4. 唯一新增两项 focused 测试于 **06:34:49** 首次运行，**2 passed / 2**，总 **1.04 s**、测试 **106 ms**、exit **0**。
5. 随后按整合要求删除重复身份字段及 catalog 字符串兼容 getter，只保留 typed `weaponId` 和 `catalogWeaponId`，同步 builder 与测试引用。为避免重复验证，本子任务没有在此次简化后重跑；最终整合交由统一构建和新 UI 流程，不把首跑记录冒充简化后的构建结果。

实际执行命令：

```sh
npx vitest run packages/sim-core/src/__tests__/weapon-proc-calculator.test.ts
```

原始日志：[weapon-proc-calculator.log](./weapon-proc-calculator.log)；退出码：[weapon-proc-calculator.exit](./weapon-proc-calculator.exit)。没有运行旧全集、构建、性能或浏览器测试。

## 两项断言覆盖

- 原始归档 SHA-256、每份源文件指纹、Optimizer Git blob、全部 15 倍率与活动目录及归档目录；独立基础缩放和物理伤害来源。
- 三武器各 R1–R5 经过共享核心，独立手算的非暴击／暴击／期望，每步公式实际执行值、数值代入与变量解释，单击标签、编辑面板重新计算、JSON 往返与来源倍率只读数值域。

原始归档 SHA-256：`b3a6b709f619e1b96ea2b22c1ecaad4aa1ef7100eb6f9f99bf9943627f5711aa`。来源提交：gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，genshin-db `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`，Optimizer `180a0a1015cb725c7570cd828eb086749960df98`。

## 可复核数值与边界

教学面板 ATK 1000、HP 10000、CR .5、CD 1；角色／敌人 90 级、物抗 .1、增伤 0：

| 一次追击 | 非暴击 | 暴击 | 期望 |
| --- | ---: | ---: | ---: |
| 钺矛 R1 | 720 | 1440 | 1080 |
| 钺矛 R5 | 1440 | 2880 | 2160 |
| 角杯或冷寂 R1 | 1800 | 3600 | 2700 |
| 角杯或冷寂 R5 | 3600 | 7200 | 5400 |

条件前提是一次追击已经真实发生、实际命中已知目标；HP 取触发时最大生命值。追击独立结算自己的暴击、防御、物抗，不并入宿主加算、不继承普攻／E／Q 专属增伤、不强乘未知范围目标数。名义冷却、回调 +1 帧、前台与触发过滤属于固定来源元数据，独立计算入口不自动认证这些时序。

数据身份为固定 **released / provisional**，不等同当前游戏机制 verified。真实运行时触发、命中快照重放以及统一 UI/构建的结果，由对应整体报告另行据实记录。
