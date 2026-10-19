# 星导领域参考执行配置

`simulateStellarConductProfile(config, { party, ...runtimeOptions })` 已接入主模拟器。只有显式选择此配置才执行；默认模拟与历史结果不变。身份映射启用转换资格，不提供角色面板、动作倍率、命座或天赋。来源为固定社区代码参考，状态和公式仍属 provisional；不等同当前游戏验证。

## 已执行的路径

配置限 aura-v3、单个静止范围内目标与队伍、冰／雷／物理输入、60 FPS、无卡肉、无插件。输入仍使用真实 ICD。冰或雷遇到另一种元素时，按 1:1 消耗对方个人附着；已反应的入射余量不再附着。主 Aura 在普通超导产生伤害及 12 秒减抗之前完成替换，避免双计。

领域寿命 360 帧，刷新仅延长寿命，不重置发布相位。创建时立即发布，随后每 240 帧发布。创建攻击不计数；之后实际冰雷附着每角色有 6 帧间隔，同一攻击去重，上限 12。记录计数与角色间隔跨领域重建保留，只有发布清计数。固定源码的增益持续 241 帧，领域消失与最后一次增益到期分别处理。

公布计数 0 对应冰雷增伤 20%，1 对应 29%，2 至 12 为 30% 至 40%；物理减抗 40%。冰雷增伤按具体命中的动作快照／实时取样执行，物理减抗在实际命中读取。共享可执行公式树记录计数查表、普通增伤相加和抗性相减；捕获保留原始普通量与领域量，不能以结果倒减伪造过程。

## 结果及计算器

结果包含 `baseResult`、`fieldInfluences`、`executionLog`、`totalDamage`、`totalDps`、`profile` 和 `blockers`。这里总伤即已经包含领域作用的普通命中总伤；没有虚构直接星导命中或特殊额外总伤。

`captureSimulationHit(result.baseResult, eventId)` 可在独立计算器恢复。捕获包含字段调整来源、实际公布计数、快照帧、增益届满帧、基础抗性、普通减抗与领域减抗。严格导入校验会拒绝与普通核心因子不一致、计数表不一致或适用取样帧已经过期的字段调整。字段实体是否仍存在是独立审计量，不冒充 buff 有效性。

## 验证与输入

`__tests__/stellar-conduct-simulation.test.ts` 覆盖真实替换、普通模式仍有超导、创建后第 240 帧发布计数 2、同帧动作快照增伤 0.2 与实时增伤 0.3、领域消失后末次减抗继续到期、所有受影响命中 JSON 恢复及篡改拒绝。

`fixtures/stellar-conduct-reference.synthetic.json` 是明确的合成面板及合成普通攻击，不能当作实装角色技能。其 `expected.json` 实测总伤 4469.75，6 条领域影响；发布帧为 6、246，计数为 0、2。

尚缺：真实角色直接星导能力定义与来源倍率；一般移动／多目标范围；和其他特殊状态混合；插件、玩家伤害反馈与特殊状态完整稳态 checkpoint。普通 hit 的 seeded crit 能沿既有采样核心运行，但尚不把暴击结果反馈到未实现天赋。

来源：[星导创建及附着](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/pkg/reactable/stellarconduct.go)、[领域与计数／发布](https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/pkg/reactable/stellarconduct_gadget.go)。完整取证见 `research/special-state-evidence.md`。
