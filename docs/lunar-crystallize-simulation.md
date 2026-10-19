# 自动月结晶参考模拟

`simulateLunarCrystallizeProfile(config, { party, ...runtimeOptions })` 执行真实、显式选择的月结晶参考模式，返回 `lunar-crystallize-simulation-v1`。原 `simulateLunarChargedProfile` API 与行为保留。共享月感电／月结晶执行现由独立的 `simulateLunarMixedProfile` 提供，详见 [混合 Lunar 参考模拟](lunar-mixed-simulation.md)；不能通过同时设置两个独立选项替代共享运行。

## 已实现的状态与时序

- 真实元素附着 ICD 成功，且岩命中时目标有实际角色的正水附着，才发生转换。元素引擎在普通水结晶晶片与其 60 帧全局间隔之前转换，不创建普通水晶片。
- 每次以岩入射元素量的 0.5 倍消费水；各个人水槽扣 `min(本次聚合消费量, 该槽现有量)`，聚合量为 `min(0.5 × 岩入射量, 最大个人水量)`。不会产生持久岩附着。消费前的水所有者与岩触发者进入本轮贡献者集合。
- 全局累计次数上限为 6；第一次转换建立三个持续 540 帧的月笼。当三个实体已存在、累计至少 3 次且 37 帧谐律间隔结束时，消费 3 次，捕获并清空本轮贡献者集合，刷新实体 540 帧。普通转换不会单独刷新实体期限。实体到期不会擅自清除全局累计。
- 每轮分别在触发后 `13 / 25 / 37` 帧读取人物面板，每段再经过 10 帧投射后交付。人物快照与敌人减抗明确分离：投射途中人物变化不修改已取样弹体，敌人岩抗在交付当帧读取。每个实际命中均调用独立计算器使用的同一个特殊数值核心与轨迹生成器。
- 只有实际交付且位于观察时限内的弹体进入 `lunarCrystallizeDamage`；总伤害为 `classicDamage + lunarCrystallizeDamage`。普通命中和月结晶命中均保存完整上下文，可经各自桥接恢复到独立计算器。

## 输入范围与未完成部分

参考模式固定为 `aura-v3`、`legal-frame-v1`、60 FPS、无目标卡肉、一个静止范围内目标，仅接受水／岩／物理攻击。需要明确的一一对应角色映射；转换启用键为 `zibai`、`columbina` 或 `linnea`。角色身份与运行选项参与当前运行哈希。

未归属的初始附着、其他元素混合、目标阶段／移动、多目标、玩家受伤反馈、特殊贡献插件和特殊贡献者随机暴击会明确阻止此配置。只提供精确独立暴击期望／全部暴击／全部不暴击；没有宣称暴击触发状态反馈已实现。专属基础提升、加成、加算、擢升和额外攻击在参考配置中显式关闭，不将角色未建模被动默认为已经实现。

证据状态始终为 `fixed-source-provisional`，不能当作当前服务器实测完成。月绽放、星导和星扩散已有各自有界自动执行入口，具体范围见相应模拟文档；它们尚未纳入混合 Lunar。星扩散仍保留指南与固定源码冲突，高跳资源尚无实际下落动作消费；不能把未交付伤害意图加进正式总伤。

## 来源与执行证据

状态与转换锁定于 [gcsim lunarcrystallize.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/lunarcrystallize.go)、[crystallize.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/crystallize.go) 与 [reactable.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/reactable.go)。人物快照和投射来自 [core/attack.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/attack.go)，投递时敌人抗性来自 [enemy/damage.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/damage.go) 与 [enemy/mods.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/mods.go)。数值读取同版本 `reactionLvlBase` 精确表，绝不插值或把普通剧变公式移植为特殊公式。

本轮新增 3 项月结晶集成测试与已有 4 项月感电测试合计 **7/7 通过，1.33 秒**。覆盖真实 3 次转换与消费、普通晶片抑制、延迟快照／投递、投射中 Buff 与减抗变化、真实 ICD 阻止、观察时限、JSON 复算及同次普通命中复算。随后独立审查还修复了桥接对非有限伤害值的比较漏洞；最终统一检查由主任务执行。

浏览器验证专用 `docs/fixtures/lunar-crystallize-reference.synthetic.json` 是**明确合成的机制输入，非真实角色构筑或实装动作帧**。实际运行普通伤害 `2158.875`，月结晶 `10393.290602901818`，合计 `12552.165602901818`；三次人物快照位于 `31 / 43 / 55` 帧，实际交付位于 `41 / 53 / 65` 帧，每次特殊伤害 `3464.4302009672724`。对应选项与运行标识在同目录 `.expected.json`。
