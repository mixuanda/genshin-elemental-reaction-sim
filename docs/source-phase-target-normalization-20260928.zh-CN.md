# 原生目标相位状态：字段归一化与 ICD 任务描述

本次基于实际已构建源码 `build-AdoyVi/source`（classic）及 `stellar-build-knpD0p/source`（stellar）审计。两份 `080-phase-target-normalization.patch` 各修改 3 个文件；生成过程只复制所需源文件到私有临时目录，未修改上述构建缓存。补丁依赖 `078` 提供的 `phase.Descriptor` 与 `task.Handler.AddWithPhase`。

## 实际改变

| 字段或路径 | 处理 | 固定源码依据与边界 |
| --- | --- | --- |
| `combat.gadgets` 中的 `nil` 空位 | 导出时略去，保持其余装置顺序 | `combat.Tick` 的收集仅压缩 `nil`；已审计两条源码分支的生产 `Gadgets()` 消费者，均遍历或按类型过滤。生产代码没有使用 `Gadget(i)` 的物理下标访问；该访问仅见测试。碰撞、攻击、选择与装置上限处理仍保持原顺序。 |
| `combat.gadgetCollectionTick` | 从可比较状态移除 | `gccount` 仅决定每 101 tick 执行上述空位压缩，没有技能、计时器或伤害效果。没有执行或修改实际收集逻辑。 |
| `construct.expiryOffsetFrames` | 非负剩余帧数，加 `expiryPhase = pending / due / past` | `construct.Handler.Tick` 只在 `Expiry() == frame` 时移除；保留到当前帧之后的旧期限不会随着单调推进重新到期。保留 `due` 与 `past` 的区别，避免把本帧待移除对象当作已经失去到期事件的对象。未知构造物私有行为仍保留缺口。 |
| `Target.ResetDamageCounterAfterDelay` | 原位置排队时附加只读闭包描述 | 原回调只把捕获目标的对应计数清零、关闭计时标志并记日志。描述包含真实目标 key、actor、tag、group；deadline 与 FIFO 由任务队列描述。原延迟 `ICDGroupResetTimer[group] - 1`、回调内容与顺序不变。 |
| `Target.ResetTagCounterAfterDelay` | 同上，单独语义来源 | 普通附着 ICD 与伤害 ICD 是不同任务。classic 的索引为 actor/tag；stellar 的索引为 actor/tag/group；两版描述分别注明实际 `keyScope`，不把二者混同。 |

## 审计后保留的字段

| 字段 | 保留理由 |
| --- | --- |
| 目标 key、`nextTargetKey`、构造物 key | 仍是实际引用和未来身份分配依据。没有证明整张引用图可以重命名，不能为得到相等结果而删掉计数器。它们可能造成保守的不收敛判定。 |
| 装置 `generationAgeFrames`、剩余寿命与思考周期 | 生成顺序参与装置上限淘汰；思考阶段和实际剩余寿命影响后续行为。回调捕获与子类型私有字段没有因归一化而被视为已覆盖。 |
| 敌人 HP、最大 HP、粒子掉落索引及阈值余量 | 直接影响死亡与粒子产出。阈值余量原已用 `damageTaken − lastParticleDrop × threshold` 表示，未把累积伤害总量误作循环相位。 |
| 敌人队列、冻结帧数 | 队列按敌人本地时钟归一化；冻结帧数控制该时钟推进。本次未忽略任何实际排队任务。 |
| 修饰器 `infinite / expired / remainingFrames` | 原导出已将 `-1` 与有限期限分开，并区分 `expiry == frame` 和 `expiry < frame`。这对应 `StatusIsActive` 与抗性/防御修饰读取的不同边界。原持续时间、hitlag 与内部 extension 保留。 |
| 反应 GCD | 原已用 `max(0, deadline − frame)` 统一未设置或已就绪的截止时间；源码对应分支在这些情况下均允许触发，不需要重复改写。 |
| 非活跃 EC / burning 的旧攻击与旧快照 | 原导出已在 `tickSrc == -1` 时略去旧值。下一次启动会重新写入；残留排队闭包仍由任务队列单独处理。 |
| 活跃 EC / burning 的 generation、攻击、快照 | 捕获的 generation 比较与 burning tick counter 尚需专门描述；保留相应缺口，不用表面相同的伤害或光环宣称闭包完整。 |
| 月感电 owner、目标 tags、装置子类状态 | 来源仍可能读取旧 owner，tags 可能是数值、绝对期限或 generation 标记，不能统一清零或按帧取模。既有未覆盖提示保留。 |

## 验证边界

- 两版修改后的 Go 文件均经缓存 Go 1.27.1 的 `gofmt` 解析与格式化。
- 两份补丁均通过私有源文件副本上的 `patch --dry-run -p1`，退出码 0。
- 本子任务没有运行原生构建、单元测试、浏览器测试或全量套件；与 078 的类型及运行时集成由主任务集中验证。
- 这些证据证明补丁可静态应用，不证明所有原生角色或所有回调已经具备完整稳态闭包。
