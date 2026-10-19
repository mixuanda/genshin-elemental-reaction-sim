# 五把随机武器追击：配置与独立回放校验

本轮扩展吃虎鱼刀、试作古华、雪葬的星银、龙脊长枪、忍冬之果。武器追击仍是独立物理伤害事件，保留自己的属性快照、暴击、防御和抗性计算，不加入宿主基础伤害。

## 实际修改

- 配置与当前结果类型加入五个武器 ID，核对显式武器类别与已有武器模型互斥。吃虎鱼刀为单体；其余四把要求明确范围目标位置。霜葬三把必须提供实际 Aura 引擎，不能把缺失环境当作无冰。
- 新五把使用 `gcsim-random-weapon-proc-v1`，追加完整 `random` 决策字段；只有霜葬三把携带 `triggerAura`，未查询时为 `null`。旧三把保留原来源标识与字段，完整性校验拒绝夹入随机或条件字段。
- 新五把的判断发生于同帧同相位 FIFO 延迟回调：真实在场角色、冷却、攻击标签、随机抽样、零伤害门槛与原目标冰／冻结状态均在此时读取。新五把使用原生 60 帧队列，显式旧秒时钟不支持。
- 独立结果回放从真实普通命中重建回调顺序，核验回调在该相位预排命中之后、按父命中顺序执行，并早于自身排出的下一帧攻击。绝对队列序号不参与倍率选择。
- 霜葬条件由共享目标时间线的相位末状态独立恢复；不信任武器日志自报状态，也不只读父命中的旧 `auraAfter`。选定倍率用于整次范围追击，邻近受击目标不会重新选择倍率。
- `independent-weapon-proc-v1` 独立种子流重放实际抽样。吃虎鱼刀使用 `roll <= 0.5`，先抽样再检查非零伤害；古华使用严格 `< 0.5`；霜葬使用严格 `< 0.5 + 0.1R`，R5 也会抽样。
- 命中回放桥复用独立计算器的 `getWeaponProcCoefficientFormula`，以已验证的实际触发条件执行同一选择 AST，再展示倍率乘快照面板的基础伤害。讨龙真实 Stats 读取排序也保留新回调序号，旧三把继续采用原父事件序号。

主要文件：`packages/schemas/src/weapon-proc-schema.ts`、`weapon-proc-replay.ts`、`weapon-proc-aura-replay.ts`、`weapon-proc-integrity.ts`，当前类型与结果 schema、`particle-provenance-integrity.ts`、`thrilling-tales-replay.ts`、`packages/sim-core/src/calculator-bridge.ts`。

## 来源与边界

固定 gcsim 修订仍为 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。武器公式及独立生产数据比对见 [五武器来源审计](../cross-validation/weapon-proc-five-source-audit.md) 与 [Optimizer 来源审计](../cross-validation/weapon-proc-five-optimizer-source-audit.md)。没有将 provisional 数据改为 verified。

来源审阅发现 `pkg/enemy/attack.go` 会将 `OnEnemyDamage` 放入同帧任务尾，因此不能把父命中刚结束的 Aura 无条件当作回调状态。本轮运行时已为新五把接入真实延迟任务。

相位末恢复只证明 Cryo/Frozen 两个条件，不声称整个 Aura 对象相同。当前普通命中在对应相位前由动作、召唤和周期任务排入；武器子攻击在下一帧。可能交错的普通 Quicken→Bloom 后续任务只修改 Hydro/Quicken 等状态，不消耗 Cryo/Frozen 或执行 Freeze。现有模型已排除月曜／星辉特殊宿主。

来源冷却仍以全局帧近似并明确假设没有角色卡肉。本地命名随机流不声称与 gcsim 共享 seed 产生同一抽样。此工作不完成反应伤害触发武器被动，也不证明随机武器的完整稳态检查点；相应限制由运行时维护。

## 唯一新增测试与实际结果

命令始终为：

```text
npx vitest run packages/schemas/src/random-weapon-proc-integrity.test.ts
```

只有一个测试，没有扩大矩阵。执行记录：

| 次序 | 结果 | 原因／结果 | Vitest 时间 |
| --- | --- | --- | --- |
| 首次 | exit 1 | 测试夹具遗漏兼容目标 `enemy-0` 及 `targeting.outcome: landed`，在配置校验阶段停止 | 985 ms，测试 23 ms |
| 定点复验 1 | exit 1 | 测试夹具的 Aura 模式需要合法时间轴；改为同一合成动作预排两次同帧命中 | 911 ms，测试 20 ms |
| 定点复验 2 | exit 0，1/1 通过 | 完整来源反例、JSON、共享 AST 与四种篡改检查通过 | 1.25 s，测试 313 ms |

两次修正只涉及夹具身份与结构，没有改动生产代码或计算数值。外层实测最终执行耗时 1.658985 秒。完整日志：[首次](logs/random-weapon-proc-integrity.txt)、[第一次定点复验](logs/random-weapon-proc-integrity.retry.txt)、[最终定点复验](logs/random-weapon-proc-integrity.retry2.txt)。

实际观察：

- 第 0 帧先进行物理普攻，父命中 `auraAfter` 仍含冰；已经排定的同帧火附着随后消耗原目标的冰。
- 忍冬之果 R5 的真实延迟回调读取到 `cryo: false, frozen: false`，选择 1.4，而非 3.6。
- 原目标与仍含冰的邻近目标都使用此已选倍率；各自手算与实测均为 `1000 × 1.4 × 0.5 = 700`，含宿主普攻的总伤害为 1900。
- 完整结果 JSON 解析通过；范围内第二次追击经过捕获、序列化、解析、共享计算器回放，差值 0；来源选择 AST 结果为 1.4。
- 伪造选定倍率、伪造触发 Aura、伪造随机值、把回调序号提前到父命中序号，均被结果校验拒绝。

未运行旧套件、构建、数据生成或外部 CLI。并行任务的运行时、独立计算器、外部对照和浏览器检查不计作本任务执行的测试。
