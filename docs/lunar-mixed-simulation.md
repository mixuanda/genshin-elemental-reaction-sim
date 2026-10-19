# 共享月感电／月结晶参考模拟

`simulateLunarMixedProfile(config, { party, ...runtimeOptions })` 返回 `lunar-mixed-simulation-v1`。这是一次实际运行：普通命中、雷云、月笼取样和月结晶弹体使用同一元素引擎、同一特殊状态以及同一主事件堆。原有五个独立入口保留各自范围和默认结果。

## 真正共享的机制

固定源码的岩反应顺序是先雷结晶，后水结晶。水结晶启用转换时改为月结晶。实现保留普通雷结晶及其 60 帧晶片间隔，并把同一次岩命中的剩余预算传给水分支。若雷分支消耗全部岩量，本次不会凭空增加月结晶次数；若普通晶片间隔阻止雷分支，雷和岩预算不消耗，水分支仍可执行月结晶。`conversionEvents[].geoResolution` 保存原始岩量、雷结晶子审计、雷后剩余量、水消费前所有权、用于水分支的岩量以及最后剩余量。

两个分支共用实际水附着。月感电在每次符合条件的扫描时读取当前水／雷个人槽和人物面板，交付伤害后每个个人槽消耗最多 `0.4U`。随后岩攻击看到此结果；岩攻击也可能耗尽雷，使已存在雷云后续扫描无法命中。云不因为暂时缺少附着而凭空刷新或重新创建。普通感电伤害与定期扣量任务不会同时生成。

月结晶在真实水分支触发时累计并捕获水所有者与岩触发者，按已有 3 次／37 帧间隔规则触发谐律，分别在 `+13/+25/+37` 帧拍人物快照，再于各自 `+10` 帧交付时读取岩抗。普通水晶片被替换，实际普通雷晶片保留。不会将 LCrys 投射当作新的岩附着。

共享状态的唤醒任务实际进入主堆，优先级 `2.5`；雷云扫描、即时命中与扣量在该任务内完成。普通命中和月结晶投射优先级 `3`；相同优先级使用真实入队序号。这是明确的参考执行配置，没有把同帧顺序宣称为官服逐帧实测结论。每个特殊命中保存 `executionOrder`，月感电消费同时进入基础结果的完整 Aura 时间线，接受严格消费及连续性校验。

## 公式与恢复

`specialDamageEvents` 的 ID 在本次合并运行内连续，按 `intent.branch` 区分两类伤害；每击保留真实贡献者、快照帧、投递帧、敌抗、共享数值轨迹和 Aura 消费记录。`lunarMixedEventToCalculatorDocument(result, eventId)` 导出完整特殊上下文并验证数值复现。普通命中继续由 `captureSimulationHit`／`replaySimulationHit` 恢复，包括真实普通雷结晶命中。

总伤为同一运行的 `classicDamage + lunarChargedDamage + lunarCrystallizeDamage`。专属基础提升、特殊增伤、加算、擢升及额外攻击明确取本参考配置的 `0/1`；未建模角色天赋没有按名字自动启用。暴击模式支持精确独立贡献者期望／全暴／不暴；特殊随机采样及暴击反馈尚未接入。

## 边界

- `party` 与角色一一对应，并分别通过月感电和月结晶固定来源资格；哥伦比娅可同时满足，两类独立启用者也可组合。身份不提供任何未声明技能或面板。
- 输入为 `aura-v3`、合法 60 帧时间轴、单个静止范围内目标、水／雷／岩／物理，禁止无归属初始 Aura、卡肉、移动／目标阶段、玩家伤害反馈、插件和手工反应覆写。
- **不包含月绽放／Dendro 混合。** Hydro 的 Bloom→LC 与 Electro 的 Quicken 等先后顺序、共享草原核及后续超绽放必须一并建立，不能将独立 LB 的资源执行附加后声称完成。
- 其他元素、冻结、Stellar、多目标和空间竞争明确拒绝。来源状态持续为 `fixed-source-provisional`，没有提升为游戏实测完成。

## 来源

本增量重新核对锁定提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的 [reactable.go 岩／水／雷顺序](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/reactable.go)、[crystallize.go 普通晶片间隔与水转换](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/crystallize.go)、[lunarcrystallize.go 剩余入射量消费与取样](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/lunarcrystallize.go)、[lunarcharged.go 实时参与者与回调扣量](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/lunarcharged.go)，以及 [attack.go 零延迟攻击同步交付](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/attack.go)。现有取证副本与哈希清单位于 `docs/research/` 对应特殊状态来源文件。

## 执行检查

`npx vitest run packages/sim-core/src/__tests__/lunar-mixed-simulation.test.ts`：**3/3 通过，1.32 秒；测试体 533 ms**。覆盖真实共享扣量与 Geo 顺序、普通雷晶片／水晶片与感电抑制、云存在但失去雷后不交付伤害、晶片间隔与 LCrys 的独立性、逐弹人物快照／实时抗性、两类特殊及每个普通命中的 JSON 恢复、消费篡改拒绝、各分支资格和未知元素拒绝。没有重复全量测试或性能矩阵。

浏览器专用 `docs/fixtures/lunar-mixed-reference.synthetic.json` 是明确合成输入，不代表实装角色。对应 `.expected.json` 记录同次结果：普通伤害 `3291.75`，月感电 `12656.313410639608`，月结晶 `15319.194631856271`，合计 `31267.25804249588`；云命中帧 `15/135`，月结晶取样 `43/55/67`，投递 `53/65/77`。随后新增浏览器场景在固定生产构建上实际通过，核对同次导出、岩预算和两类特殊命中恢复；两项综合浏览器首轮2/2通过、合计12.3秒，见[专项证据](validation/mixed-coverage-e2e.md)。
