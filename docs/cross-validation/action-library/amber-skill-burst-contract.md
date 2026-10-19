# 安柏 E／Q 来源动作与独立计算器实施记录

本轮保留原 N1–N5 来源入口，并新增自然到期兔兔伯爵与箭雨来源动作。固定参考为 `genshinsim/gcsim@b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`；当前数据的同一倍率向量逐值一致并不构成当前版本所有安柏机制已验证的声明，结果保持 `provisional`。

## 实际新增内容

- `packages/sim-core/src/source-action-library.ts`：新 `AMBER_SKILL_BURST_CONTRACT`、`createAmberSkillBurstScenario()`，共用来源身份、签名与序列验证；E/E.tap/Q DSL 别名，保留原五个普通动作。
- 通用时间线的 `energyCostFrame` 与 `summons` 由模拟核心执行真实延迟扣能、生成时快照、到期与绑定命中。接口与独立通用验证见 [运行时说明](../../source-action-runtime-primitives.md)。
- `packages/game-data/src/character-mappings/amber-skill-burst-mappings.ts`：E 一击与 Q 十八击，直接进入常规角色选择和独立计算器，无须先建立队伍或模拟轮转。E `combat2.param2`、Q `combat3.param1` 各完整 15 级向量与固定源表精确相等；Q 不是把总倍率再次乘 18。
- `character-source-formulas.ts` 与通用角色文档适配：Q 的 `critRateFormula` 在突破 ≥1 时逐段加 0.10 暴击率，经共享核心处理公式、代入、合计与范围限制；不改共用面板。未知突破仅阻塞相关 Q；显式最终暴击率覆盖不重复加 A1，final/JSON 转换保留来源审计和等值结果。
- 条件明确为 C0；有效天赋等级保持显式输入。E 的快照攻击力取兔兔生成时，Q 取起手时；A4 若已生效，必须包含在实际输入攻击力中，本轮不推断弱点命中的时间或触发。

实际读取覆盖函数：120 个身份、695 个命中、408 个条件完整动作、146 个部分动作；相比本轮前增加 19 个命中和两个条件完整动作。安柏为 24 个命中、7 个动作，原 5 普攻均保留。生成覆盖文件由主任务统一更新。

## 外部执行与数值

外部固定二进制只执行一次，exit 0。命令、二进制 SHA-256、源文件固定 URL/SHA-256、输入和原始输出分别见 [execution](amber-eq-expiry.execution.json)、[机器契约](amber-skill-burst-contract.json)、[GCSL](amber-eq-expiry.gcsl)、[原始 result](amber-eq-expiry.result.json) 与 [原始 sample](amber-eq-expiry.sample.json)。未平移外部结果帧。

固定等级 1／突破 0／C0／天赋 1，猎弓等级 1、无圣遗物、额外暴击率 −0.05，最终 ATK 41.9434。单个等级 90、火抗 0.1、位置 (0,2)、半径 2 的静止目标；不模拟卡肉。

| 检查 | 外部与本地实际结果 |
|---|---|
| E／Q 输入帧 | 1／33 |
| Q 能量 | frame33 保留资格但实际仍40；frame92 扣40→0 |
| Q 命中 | 18次，frame117–225；每次3.6790156042886593 |
| 兔生成／到期／攻击 | frame46／530／531；快照frame46 |
| E 伤害 | 16.141549944742266 |
| E 粒子 | frame531生成，631入账，4火微粒，获得12能量 |
| 总伤害 | 82.36383082193812 |
| 逐次伤害最大绝对误差 | 0 |
| 原始 gcsim 总伤均值与本地总量差 | 0 |

全部 19 个命中均捕获完整上下文，经过导出、JSON 解析和回放后保持精确相等；另通过独立伤害核心恢复同一数值。独立角色文档中的 E/Q 与外部实际单击数值也精确相等。Q 高突破案例验证了 `.7 + .1` 的逐击暴击率及来源 trace；明确覆盖为 `.25` 时不再加 `.1`，final/JSON 保持等值。

## 实际验证与修正过程

专项文件为 `packages/sim-core/src/__tests__/source-action-amber-skill-burst.test.ts`。

1. 第一次运行三个新用例全部失败，原因是来源契约内 `actor` 在声明前使用。已移动声明顺序，没有改数值算法。[日志](../../validation/amber-source-skill-burst.log)
2. 第二次运行一个通过、两个失败。19 次命中的帧和伤害已经精确相同；派生 fixture 的总量误用了 Python 新版 `sum` 的补偿求和，得到 82.36383082193814。实际 gcsim 原始 `statistics.total_damage.mean` 为 82.36383082193812，现直接读取该字段，保留精确断言。另一个用例篡改召唤寿命后先被严格 schema 拒绝，改为同时调整相应命中帧，确保内部有效的篡改仍被固定来源签名拒绝。[日志](../../validation/amber-source-skill-burst-recheck.log)
3. 最后只复验前次失败的两项，并首次执行新增的独立角色 E/Q、A1、突破门、最终值覆盖和 JSON 用例：**3 passed、1 skipped，6.83 秒**。被跳过的正常序列用例已在第二次通过。四项行为均有实际通过记录，没有重复已通过的旧来源全集。[日志](../../validation/amber-source-skill-burst-final.log)

最后命令：

```sh
npx vitest run packages/sim-core/src/__tests__/source-action-amber-skill-burst.test.ts -t 'matches external|rejects edited|offers standalone'
```

## 明确保留的缺口

E 只覆盖自然到期爆炸；兔的受伤／生命耗尽、冻结、移动、长按落点、C2 手动和特殊超载爆破、C4 第二充能均未在此契约实现。固定源本身兔 `HandleAttack` 不扣生命，不能将源码存在视为承伤模型已完成。

Q 的 18 段是固定参考下全部命中的条件完整动作；不预测随机落点与移动目标碰撞。独立计算的反应选择不证明实际附着、ICD 或反应覆盖率。

新的模拟契约允许等待，E/Q 会重置普通序列；第一次 Q 前初始满能的普通命中回能溢出。第一次 Q 后的普通动作因尚未映射来源随机回能而具体阻塞。原纯 N1–N5 契约继续存在。来源签名也拒绝未经核验的角色、面板、能力、召唤寿命、扣能时机及动态模型修改。冷却仅以确切 ready 偏移 E +905／Q +776 表达，不宣称实现独立冷却开始回调。
