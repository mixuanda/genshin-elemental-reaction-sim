# 星扩散参考适配器：数值、调度与宿主契约

原始记录日期：2026-09-23；高跳代码与契约补充于 2026-09-25，新增检查尚未运行。独立 `stellar-swirl-calculation.ts` / `stellar-swirl-runtime.ts` 现已由 `simulateStellarSwirlProfile` 接入真实主队列，具体执行及验证见 [主模拟器接入](./stellar-swirl-simulation.md)。它仍不能单凭手工命中标签认定转换，也不能把计划中的 1U 冰附着称作已执行。

## 已执行的适配器行为

- 初始星扩散：贡献者人物面板在触发帧取样，初始风伤在 `+3` 帧投递；投递时读取敌人风抗，且不附着风元素。
- 星漩涡：采用指南参考规则的三次升级、六次提前爆炸及 180 帧寿命；一级 / 二级分别执行 `2` / `3` 系数的冰伤。初始风伤系数为 `0.75`。
- 全部数值进入已有特殊公式 AST、独立贡献者暴击分支、排序和加权计算，不复制第二套伤害公式。支持非暴击、全暴击和解析期望；没有特殊贡献者的种子随机暴击或暴击反馈。
- 漩涡爆炸时取样人物面板和贡献者集合，同帧读取敌人冰抗。宿主必须实际执行带最后触发者归属的 `1U` 冰附着，再返回回执，才能发布 `state-resolved` 上下文。
- 事件保存人物上下文、抗性、执行轨迹、附着前后状态和实际投递回执。结果合计普通与特殊伤害，单个事件可导出计算器文档并经 JSON 往返重现。
- 高跳增量代码已接入实际动作反馈，新增验证仍待执行：爆炸产生全队共用的一次 300 帧资格，真实跳跃开始时删除有效资格并保存独立腾空状态；声明需要并消耗 `airborne` 的下落动作在执行时落地。结果为 `consumptionImplemented:true`，同时分别报告资格与 `airborne`；普通下落伤害计入 `classicDamage`。

## 主引擎接入契约

`StellarSwirlRuntime` 需要 `snapshot`、`resistance`、`auraAt`、`beforeWake` 和 `applyCryo` 回调。隔离适配器宿主应先 `advanceThrough(frame)` 排空延迟特殊投递，再读取该帧主命中的 `auraBefore`。真实主引擎改用 `scheduleTask` / `runScheduledTask` 把状态唤醒和每次投递放入同一主堆；第六次触发生成的零延迟投递在当前命中审计完成后按实际队列序号执行，不提前内联修改 Aura。

主 Aura 引擎负责确认实际 ICD、执行普通冰扩散的 0.5U 消耗，并抑制被替换的普通冰扩散伤害及传播。随后传递真实 `auraBefore`、`actualIcdAllowed`、`converted`、`ordinaryReactionReplacementApplied`，不能以手工 reaction 标签制造转换证明。

`applyCryo(intent)` 必须执行真实 Aura 操作，返回 `{ frame, ownerId, targetId, applied:true, element:'cryo', gaugeUnits:1, auraBefore, auraAfter }`。适配器检查帧、所有权、目标和元素量与当前投递一致。`calculateStellarSwirlIntent` 的宿主证明是内部接口契约，不是任意外部 JSON 可以获得机制验证状态的凭据。

高跳的 `jump(event)`／`plunge(event)` 接收主队列实际执行的帧、角色、来源事件和执行次序。`jump` 消费尚未到期的全局资格并创建腾空状态；`plunge` 仅在对应角色实际执行下落时结束腾空。主引擎将真实 `high-jump-use` 日志反馈给合法时间轴编译，空中非下落角色动作被拒绝，普通静态跳跃定义不会自动获得资格。未消费资格在 `expiresAt` 帧起失效；它与已经建立的腾空状态具有不同寿命。同帧动作不能预先执行排在后面的漩涡爆炸来取得资格。

下落能力必须明确声明 `timelineState.requires: ["airborne"]` 和 `timelineState.consumes: ["airborne"]`，其命中仍走普通队列与公共捕获。`jump.frames` 继续由输入者声明，不自动采用上游武器类别的 4／8 或 5／9 帧，也不推算高度或缺失的角色下落定义。普通跳跃途中爆炸的提升规则仍因上游 TODO 保留未支持，见[高跳来源审计](research/stellar-swirl-high-jump-source-audit.md)。

当前范围为一个静止、范围内目标，`aura-v3` 个人附着所有权，60 FPS、无卡肉的合法帧时间轴，风 / 冰 / 物理输入。无归属初始附着、冻结贡献者重叠、多目标空间、移动、阶段、玩家伤害反馈均不在本参考配置中。专属基础提升、反应加成、加算、擢升和额外攻击明确关闭。

## 固定证据与冲突

采用 [已有来源审计](./research/special-state-evidence.md) 固定的 7.0 Stellar 指南及源码提交 `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`；原始适配器阶段读取已下载的固定源码文件，没有声称重新联网验证或执行上游模拟器。2026-09-25 的高跳补充另核对了同提交的角色跳跃、全局状态和玩家动作源码，采集观察时间及哈希独立记录在[高跳来源审计](research/stellar-swirl-high-jump-source-audit.md)。

- [stellarswirl.go](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/pkg/reactable/stellarswirl.go)：触发者及现存个人冰附着贡献者、`0.75` 系数、人物快照后 `+3` 帧投递。
- [stellarswirl_gadget.go](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/pkg/reactable/stellarswirl_gadget.go)：冰伤系数 `2 / 3`、1U 冰及最后触发者归属、高跳 300 帧。
- [reaction.go](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/pkg/core/combat/reaction.go)：星反应的 `6EM/(2000+EM)` 及等级基础表使用。固定文件 1,373 字节，SHA-256 `945d5bc1b15bbab4d216e4feeacef529f3eafa3afdba854adf8bb5a083b887a5`。
- [reaction.dm.go](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/pkg/core/combat/reaction.dm.go)：2,431 字节，SHA-256 `b3b8b2f16ffd32e6a133ffd6770889ea257dfae52ed35156e6e26bd2c1e9b9e9`，与项目固定 `b4ae769` 同文件哈希一致。两份表各 200 项；已支持的玩家 1–100 级逐项一致，不插值。

始终保留 `guide-profile-source-conflict`：固定源码计数会得到 `1 → 3 → 7`，漩涡注册和查找的实体类型不一致，寿命写 181 帧而指南写 3 秒；冻结与普通冰贡献者重叠仍有 TODO。参考指南的可执行分支不代表这些冲突已经解决，也不代表当前 7.1 官服验证。

## 定向验证记录

下列记录是实际工具结果的转录，不是补跑生成的日志。四个测试分别覆盖数值与回放、宿主执行证明、帧序 / 六次引爆 / 实际 Aura 回执 / JSON 复现，以及缺失替换与冻结阻塞。

1. `npx vitest run packages/sim-core/src/stellar-swirl-runtime.test.ts`：两个纯数值 / 证明测试通过；两个宿主用例因测试填写不存在的 ICD 标识 `none` 失败。测试改为实际支持的 `no-icd-v1`。
2. `npx vitest run packages/sim-core/src/stellar-swirl-runtime.test.ts -t 'snapshots before|blocks missing'`：阻塞测试通过；时间轴测试暴露宿主先读下一帧 Aura、后处理之前延迟投递的错误顺序。修正测试宿主顺序，保留运行时的单调时间要求。
3. 仅重跑 `-t 'snapshots before'`：数值、爆炸及 Aura 断言通过，结果封装时发现测试基础模拟配置缺少 `legal-frame-v1`；补齐合法空时间轴。
4. 同一未通过用例再次运行：**1 passed，3 skipped，798 ms**（2026-09-23 16:38:37，测试执行 47 ms）。其余三个已经通过的用例未重复运行。

以上是最初四个适配器用例的历史记录。后续真实主接入的三项 focused 集成用例与两个受调度重构影响的宿主适配器用例已执行；见 [主模拟器接入](./stellar-swirl-simulation.md)。没有重新运行完整旧测试套件。

高跳增量新增 `packages/sim-core/src/__tests__/stellar-swirl-high-jump.test.ts` 三项与 `apps/web/e2e/stellar-swirl-high-jump.spec.ts` 一条，尚未运行。本次文档同步没有新增测试或构建结果，不能将上面的历史通过记录视为高跳增量已通过。
