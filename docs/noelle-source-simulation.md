# 诺艾尔 Q→N 来源执行与实际快照

当前实现是 `createNoelleBurstNormalScenario()` 提供的有界、显式来源配置：诺艾尔 Lv1/20、C0、N/E/Q 有效天赋 1、Lv1/20 R1 训练大剑，无圣遗物、护盾、治疗或外部增益，无卡肉，单个静止目标始终处于全部攻击范围。`NOELLE_BURST_NORMAL_CONTRACT.status` 为 `fixed-source-assumed`；固定 gcsim 仍将 Q 精确快照时机及 980 帧持续时间标为 TODO，本项目没有提升为官方验证。

## 实际执行

Q 在第 1 帧成功输入，读取当时非 Extra 防御 `66.95325`，执行 `66.95325 × 0.4 = 26.7813`，将这笔历史转换结果作为固定攻击力加入后续有效期内的当前面板。基础攻击 `39.2722` 因此得到 `66.0535`。转换通过通用 `statConversions` 声明执行，既不预先改角色静态属性，也不在随后防御改变时重新取样。

Q 两击位于第 25、66 帧，来源标签均为 ElementalBurst，第二击名字中的 Skill 不会把它改成元素战技。两击各自读取当前攻击面板。第 9 帧由实际任务扣除 60 能量，起手保留与真实扣款分别记录在 `energyCostLog`。

N1→N4 输入帧为 `84, 122, 168, 199`，实际命中帧为 `111, 146, 187, 240`。每次命中通过 `hit.infusion` 读取真实转换状态，Q 有效时使用岩元素和无 ICD 附着；失效后恢复原物理命中。起手后 980 帧的截止点为第 981 帧：来源 `Stats()` 先删除到期转换，再由 Snapshot 检查附魔，因此最终伤害在该帧已经没有转换攻击力且为物理。来源前置的范围/ICD检查有调用顺序细节；本样例的静止目标处于两套范围内，不声称实现普攻动态几何或角色卡肉。

`statConversionLog` 保存真实起手面板、来源值、转换值、截止帧及执行次序。计算器还原调用与模拟相同的 `calculateStatConversion()`，显示 DEF 分解和 DEF→ATK 的 AST 公式、变量定义、数值代入、中间结果及来源假设。命中后的最终面板仍完整保存在既有逐击执行上下文中。

## 普通攻击随机回能

`normalHitEnergyModel` 明确启用固定来源规则；已标记为 Normal 或 Extra 的实际敌人命中后，在同帧任务中执行概率状态。满能量或零伤害组不跳过抽样，未命中不触发。失败增加该角色武器类型的概率，成功固定恢复 1 能量并设置全队共享 12 帧间隔；切换角色按源码假定重置全部角色概率。成功回能不乘充能效率，并保留真实增加与溢出。

该规则的 12 帧间隔与切人重置本身仍带源码 TODO。实现使用 `normal-hit-energy-v1` 命名独立随机流，记录实际 roll、drawIndex、概率/间隔前后状态和能量前后值，不宣称与 gcsim 的共享随机流在相同 seed 下逐抽样一致。`normalHitEnergyLog` 独立保存这些信息，`energyCurve` 和 `energyStats` 同步真实变化。

安柏现行 E/Q 来源工厂升级为 `amber-expiry-eq-normal-energy-c0-t1-b4ae769-v2`，登记弓类型回能并允许 Q 后的真实 N1→N5。旧 `amber-expiry-eq-c0-t1-b4ae769-v1` 与显式 `createAmberSkillBurstScenario("legacy-v1")` 保留原输入签名、无随机回能模型及原范围；旧纯普攻入口也没有隐式改变。

## 实测

固定外部二进制仅调用一次，证据与 23 份源码哈希见 `docs/research/noelle-source-evidence.md` 和 `docs/validation/noelle-q-normal-external.*`。本地导出见 `docs/fixtures/noelle-q-normal-reference.json`、对应 `.expected.json` 与 `docs/validation/noelle-q-normal-local.result.json`。

本地六击总伤为 **105.67709476067012**：六个逐击值分别与外部 sample 的对应值差为 **0**；总伤与外部 aggregate 的 **105.67709476067012** 差为 **0**。外部 sample 逐击重新求和为 **105.6770947606701**，与 aggregate 的差来自求和记录的浮点末位，不能将这两个总值混称完全相同。外部 aggregate 与 sample 使用不同随机流，sample 在 N3 恢复 1 能量；本地独立子流在 N4 恢复 1 能量，没有借用外部结果或更换 seed 来伪造逐抽样一致。

新增验证结果：

- `normal-hit-energy.test.ts` 的一个概率/间隔/切人/重放用例首轮通过。
- `noelle-source-action.test.ts` 最终三个用例全部通过，测试耗时 846 ms、命令总耗时 1.65 s，涵盖六击外部对照与完整命中还原、历史 DEF 快照/精确到期、安柏 v2 Q 后普攻及旧 v1 范围保留。
- 首轮发现来源示例错误选择不支持岩的 aura-v1，改为 aura-v3；合成边界探针改用真实合法时间线。随后发现旧命中来源校验仍静态要求物理，已接入同一套独立附魔状态推导，保持严格校验。只复验失败用例及新安柏用例，没有重跑已通过的随机模块或旧全集。

实际运行分为三次，不能合称一次 4 项通过：

| 运行 | 实际结果 | 测试耗时 / 命令总时长 | 原始记录 |
| --- | --- | --- | --- |
| 首轮：Noelle 2 项 + 随机回能模块 1 项 | 1 通过、2 失败；模块通过，两个配置错误阻塞 Noelle | 26 ms / 901 ms | `docs/validation/noelle-source-core-tests.log` |
| 配置修正后，只复验 Noelle 2 项 | 2 失败；旧静态命中元素证明拒绝岩附魔 | 90 ms / 895 ms | `docs/validation/noelle-source-core-recheck.log` |
| 附魔证明修正后：复验 Noelle 2 项 + 新增安柏 v2 1 项 | 3 通过；没有再次运行随机模块 | 846 ms / 1.65 s | `docs/validation/noelle-source-core-infusion-recheck.log` |

没有运行本轮统一构建、浏览器或性能矩阵；由根任务统一执行。

## 剩余范围

本来源入口不覆盖 Noelle E/护盾/治疗、重击动作时序、取消、C6 延长或更高等级被动反馈。独立单技能计算器的 Noelle Q 状态公式是另一条明确条件输入入口，不因此宣称上述完整角色状态已自动实现。转换快照与延迟扣能状态现已进入 [完整相位检查点](phase-checkpoint-runtime-state.md)，但本来源入口的附着引擎及随机回能仍有独立限制，不能据此标成确定性稳态，也不以能量稳定代替完整状态稳定。
