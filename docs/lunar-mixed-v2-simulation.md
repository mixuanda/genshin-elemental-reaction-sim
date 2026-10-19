# 三类 Lunar 与 Dendro 共享执行参考配置

`simulateLunarMixedV2Profile(config, { party, abilities?, ...runtimeOptions })` 返回 `lunar-mixed-simulation-v2`，明确使用 `lunar-mixed-reference-v2`／`aura-v7`。原 `simulateLunarMixedProfile` 及五个独立入口保留；本增量另修正了现行独立 LB 的已证实草露时序错误，见下文。

## 实际接入

三类 Lunar 使用同一个元素引擎、同一个 `SpecialReactionState` 和主事件堆。v2 复用 mixed 的 cloud、moondrifts 和 Dew 状态；来源能力只增加真实消费及命中任务，没有第二份资源状态，也没有合并独立运行的伤害总数。

- 水入射先执行普通 Bloom，再用剩余水预算执行 LC 转换。已经参与 Bloom 的水不会再次附着；即使刷新雷云，是否产生伤害仍由扫描时实际 H/E 槽决定。
- 雷入射保留 Aggravate，依序执行 LC 与 Quicken；LC 不提前结束整条反应链。Dendro 保留 Spread、Quicken 和普通 Bloom。
- Q→Hydro Bloom 使用 aura-v7 的真实零延迟任务，执行时重新读取 Q/H。主引擎仅在该任务实际成功后刷新草露，保存原雷／草触发归属，不能根据原始命中猜测后来是否生成草核。
- 普通 Bloom 的草原核生成、容量、位置、到期及后续实际 Electro 接触 Hyperbloom 沿用同一个主引擎管理器。普通雷命中敌人后的元素预算消费不会抹掉其对已有草核的独立接触；新核实际等待 30 帧生成。LC 单目标、零附着攻击不会再去接触草核。
- 岩仍先尝试普通雷结晶，再以同份剩余岩量执行水→月结晶；保留真实雷晶片，抑制普通水晶片。LC 的真实个人槽消费和 Bloom／Quicken 的消费分别记录，后续扫描与岩触发读取已经发生的变化。
- 月露涤荡沿显式来源 factory 与声明执行：有效普攻天赋 1–15、突破 0–6、C0、闲置起手，完整动作锁 124 帧。`+55` 消费实际生成的 1 草露，`+62/+70/+92` 三段独立读取当前人物与草抗，无元素附着、无重复普通命中。

特殊状态唤醒在主堆 priority `2.5`，来源能力消费 `2.75`，普通攻击、月结晶投射和直接月绽放 `3`；同优先级保留实际 sequence。角色动作选择先于当帧生产，不能借用稍后才生成的草露。结果保存每次已交付特殊命中的真实队列 tuple；这是一份明确的参考调度契约，不是未取证的官服逐帧声明。

## 已修正的草露错误

重新核对完整固定源码发现：`OnLunarBloom` 把生产窗口截止赋值排到 `F+1` 的全局任务，而该帧的玩家草露生产已经先执行。因此无旧活跃窗口时，首次累计在 **F+2**，146 次有效累计后首枚在 **F+147**，窗口截止 **F+149**。

现行共享状态已统一采用 `verdant-dew-fixed-core-order-v2`：执行 `+1` 刷新任务前，先按旧窗口累计该帧；之后才赋新截止。旧窗口在截止帧仍能生产，已经失效的窗口不能倒补一次累计，部分进度和 3 层上限保留。独立 LB 与 mixed-v2 都使用此修正，没有在 v2 再叠一层延迟。

旧独立 LB 示例首枚记录 `152` 属于旧实现偏差，现为 **153**；既有显式起手 160、消费 215、三段 222／230／252 及相应数值不变。资源结果及日志保存新规则身份。旧保存的命中数值上下文仍可复算，但不能用其旧资源日志宣称当时时序正确。

## 输入与恢复

范围为 H/E/D/G/P、单个静止定位目标、合法 60 帧时间轴、无卡肉和玩家受伤反馈。Electro 附着沿 aura-v7 原有 schema 要求显式几何来判断草核接触，不替用户猜测范围。party 逐一检查 LC、LCrys、LB 三类固定来源转换资格；角色身份不提供未声明构筑或技能数值。无归属初始 Aura、手工反应覆写、插件、特殊贡献者随机暴击，以及火冰风／冻结／Stellar、多目标与位置竞争明确不在此配置内。

`specialDamageEvents` 是有判别字段的联合：`kind: reaction` 保存 LC／LCrys 意图及 Aura 记录，`kind: direct-ability` 保存 Moondew 能力、消费收据与全部上下文；全局 ID 按本次实际交付顺序连续。`lunarMixedV2EventToCalculatorDocument(result, id)` 恢复任一特殊命中并核对数值。普通 Bloom／Hyperbloom、加算及普通攻击继续使用完整 `baseResult` 的捕获桥接。

总伤只累计本次真实交付：`classicDamage + lunarChargedDamage + lunarCrystallizeDamage + lunarBloomDamage`。普通草核及 Hyperbloom 归入 classic 分项。LC／LCrys 的专属提升、增伤、加算、擢升与额外攻击仍是显式 0/1；Moondew 已执行其来源月兆 HP 提升，其余角色被动、领域、Gravity、月岭露、命座、其他直接月绽放能力与取消连携未自动补齐。证据状态仍为 `fixed-source-provisional`。

## 来源与实际检查

完整固定源码已在 `/tmp/gidps-gcsim-b4ae769` 找到，无需重新下载。Quicken 原件是 `pkg/reactable/catalyze.go`，不是 `quicken.go`。本轮 [来源证据](research/lunar-mixed-v2-source-evidence.md) 与 [19 件原件 SHA-256 清单](research/lunar-mixed-v2-source-evidence.json) 记录反应顺序、Q→Bloom 原攻击归属、敌人／草核接触顺序、LC 排除草核以及 Dew 的真实 tick／task 顺序。

本轮只运行必要检查：

- `npx vitest run packages/sim-core/src/__tests__/lunar-mixed-v2-simulation.test.ts`：**3/3 首次通过，1.78 秒，测试体 981 ms**。覆盖实际共享 Q→Bloom／草核／Hyperbloom、三类 Lunar 和真实草露消费，完整 JSON 逐击回放，H/E 的源顺序向量、同帧资源选择边界、资格与观察时限。
- 共享 Dew 与独立 LB 的受影响检查：**3 文件、7 项通过、8 项未运行，1.38 秒，测试体 328 ms**，仅执行一次。包含旧窗口截止当帧刷新和窗口失效后一帧刷新边界；具体命令见来源证据文档。

没有运行全量测试、性能矩阵、构建或浏览器。后者由主任务统一执行。

浏览器专用 `docs/fixtures/lunar-mixed-v2-reference.synthetic.json` 是明确合成的输入，不代表角色实装构筑。输入本身无 Moondew 占位能力；用户在正常入口显式追加 `h` 的第 160 帧动作、天赋 10、突破 6、C0。对应 `.expected.json` 保存该运行：

| 分项 | 实测数值／帧 |
| --- | --- |
| 普通与普通反应 | 23110.385481818183；其中 Hyperbloom id 8/9 在 116 帧各 9588.692740909091 |
| LC | 5992.856862332142；57 帧 |
| LCrys | 11398.06384097143；105／117／129 帧 |
| Moondew 直接 LB | 4066.8554115；222／230／252 帧 |
| 统一总伤 | **44568.16159662175** |
| Q→Bloom／草核 | 实际任务 8 帧，两个草核均 38 帧生成 |
| 草露 | 155 帧取得，215 帧消费；最终 partialFrames=2 |

该输出已由核心实际运行生成，浏览器验收状态由主任务另记。
