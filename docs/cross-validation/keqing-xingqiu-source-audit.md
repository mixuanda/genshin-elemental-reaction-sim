# 刻晴 Q 与行秋 E：完整条件单次动作

后续更新：下文记录最初 `.12` 批次的 C0–C3 范围与当时检查。`.14` 已补齐刻晴 Q C4/C6 的逐击状态和已含份额计算，见 [逐击命座实施与检查](../validation/keqing-constellation-context.md)；没有把旧结果改写成当时已完成。

本批新增刻晴 Q 十击、行秋 E 两段，共 **12 个伤害实例、2 个完整条件动作**，注册版本为 `reviewed-hits.12`。完整指明确条件下本次技能输入的自身伤害；不代表完整角色、实战时间线或队伍模拟已验证。两个入口继续属于独立计算器，不需要队伍或轮转。

来源固定为 `genshinsim/gcsim@b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。本批复用先前 `conditional-skills/source.json.gz` 归档；新的 [来源清单](../../packages/game-data/src/character-mappings/keqing-xingqiu-source-manifest.json) 记录实际文件哈希、归档哈希、5 条完整 T1–15 向量和对照 catalog。75 个参数逐值一致、最大差值 0，结果继续为 `source-backed-provisional`。

代码：[命中映射](../../packages/game-data/src/character-mappings/keqing-xingqiu-mappings.ts)、[条件适配](../../apps/web/src/keqing-xingqiu-calculation-context.ts)、[共享 AST 公式](../../packages/sim-core/src/keqing-xingqiu-formulas.ts)。UI 接线及构建状态由主 QA 另行记录，本专项测试没有代替浏览器检查。

## 刻晴 Q

- 固定 [burst.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/keqing/burst.go) 给出初击、八次连续斩击、尾击；T1 系数依次为 `0.88`、`8 × 0.24`、`1.888`。每击独立进入普通伤害核心，反应各自输入。
- Q 起手先调用 [A4](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/keqing/asc.go)，突破 4 解锁时增加 15% 暴击率与 15% 充能。`a4IncludedInPanel` 仅记录暴击率面板是否已含这 15%，公式为 `0.15 × (A4已解锁 − 已含)`。逐击最终暴击率覆盖始终优先，适配器不会自行改写它。
- 来源装备模式把 A4 充能作为固定 `pre-panel` 属性送进现有面板核心，不增加另一套伤害公式。绝缘四件套读取包含 A4 的非转换充能，西福斯等精通转充能仍不会被二次转换。重复刷新先按同一来源 ID 移除旧条再重建；切换非本次 Q 动作时移除该 Q 状态。手动/导入模式直接使用用户给出的生效后最终充能，不推断未知分解。
- 本项支持 **C0–C3**。C1 是 E 重放额外伤害，C2 是普攻/重击产球，C3 已在有效 Q 等级中体现。C4–C6 保持明确阻塞：已读来源，C4 实际是反应触发 **25% ATK**，C6 是按动作类别各 **6% 雷伤**；缺少逐击状态与记账适配，不能套用 C0–C3。阻塞不是缺少数值来源。
- 固定源在 56–197 帧分别快照。完整动作以面板、装备和目标状态持续稳定为明确条件；未声明稳定则阻塞。当前没有把这段条件伤害登记成完整 Q 时间线实现。

## 行秋 E

- 固定 [skill.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/xingqiu/skill.go) 给出两次伤害，T1 系数 `1.68`、`1.912`；在各自任务执行时快照，完整计算明确假定两击间共享面板、装备和目标状态稳定。
- [A4](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/xingqiu/asc.go) 是永久 20% 水伤。是否已包含于每段已填增伤由 `a4IncludedInPanel` 显式记账：`0.20 × (A4已解锁 − 已含)`。导入的最终水伤通常含有永久 A4，而来源配装推导本身不含角色战斗被动；适配器不凭面板数值猜测。
- C4 且 Q 在 **E 起手构造两段攻击信息时**有效，来源执行 `ax.Mult *= 1.5`。共享基础公式因此为 `ATK × 本段天赋倍率 × (条件成立 ? 1.5 : 1)`；额外固定基数仍在其后另加，50% 不进入普通增伤区。
- [C2](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/xingqiu/burst.go) 由 Q 剑雨命中施加 15% 水减抗，E 本身不会触发它。`c2ShredActive` 与 `c2ShredIncludedInResistance` 分别记录目标既有状态和敌人抗性输入已含份额，减抗公式只补差额；逐击最终抗性覆盖始终优先。
- 支持 **C0–C6** 的本次 E 两段。C1 雨帘剑数量、C2/C6 的 Q 时长/波次/回能不新增这次 E 伤害；有效 E 天赋已包含 C5，不再次加级。反应由两击分别输入，不默认双蒸发，不自动推断目标附着或 C2 有效期。

## 实际执行

仅运行新增文件一次：

```sh
npx vitest run packages/sim-core/src/__tests__/calculator-keqing-xingqiu.test.ts
```

2026-09-24 00:56:54 开始，首次 **1 个文件、3 项通过，1.35 秒，测试 151 毫秒，exit 0**。日志：[keqing-xingqiu-core.log](../validation/keqing-xingqiu-core.log)，退出码：[keqing-xingqiu-core.exit](../validation/keqing-xingqiu-core.exit)。没有执行旧测试全集、数据状态生成、构建、浏览器、性能或外部模拟器。

| 实际断言的条件 | 结果 |
| --- | ---: |
| ATK 1000、基础 CR 0.5、CD 1、攻守 Lv90、10% 抗性，刻晴 T1 Q、A4 未含 | 非暴击 2109.6；期望 3480.84 |
| 刻晴共享 CR 改为 0.65，并声明已含 A4 | 与上行完全相等 |
| 刻晴逐击最终 CR 显式设为 0.2，再修改 A4 记账 | 该击 CR 仍为 0.2 |
| 刻晴条件来源公式夹具：初始 ER 1.2，A4 +0.15，西福斯固定历史 EM100 转 ER0.036 | 最终 ER1.386；绝缘仅读非转换 ER1.35，Q 增伤 0.3375 |
| 上述来源公式夹具转换最终面板并 JSON 往返，再应用同一角色上下文 | 总伤保持完全相等，无重复 A4 ER |
| 相同基本面板，行秋 T1 E、C4、Q 起手有效、A4 未含、既有 C2 有效 | 非暴击 3313.62；期望 4970.43 |
| 行秋第一击额外基数 100 且仅第一击蒸发 | 第一击 `(1000×1.68×1.5+100)×1.2×0.5×1.025×2`；第二击独立不蒸发 |
| 行秋把每击 0.2 增伤与目标 −0.05 抗性填入面板，分别声明 A4/C2 已含 | 总伤保持完全相等 |

另检查完整来源向量、注册实例数、未知突破阻塞、未解锁 A4 却声明已含的矛盾状态、刻晴 C4 范围阻塞、行秋最终抗性覆盖与两个上下文 JSON 保存。以上是共享核心实际执行的条件伤害，不是游戏服务器测量、全角色验证或整队 DPS。
