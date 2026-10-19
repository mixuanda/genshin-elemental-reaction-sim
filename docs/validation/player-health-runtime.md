# 动作治疗与生命消耗：共享角色生命状态

本增量将明确声明的治疗、生命消耗接入模拟器真实事件队列，复用既有 `playerHpStateByActorId`、`playerHpTimeline` 和生命汇总。未创建第二套独立 HP；生命消耗不会进入敌人伤害、反应自伤、伤害归属或结晶护盾吸收分支。本记录属于固定来源假设实现，不代表角色完整机制或服务器实测。

## 输入与执行语义

当前 1.53 配置的 `rotation[]` / `timeline.abilities[]` 可选 `healthChanges`，每项包含：

```ts
{
  id, label, frameOffset, // 相对实际接受动作输入的整数帧
  target: { kind: 'self' | 'active' | 'party' }
    | { kind: 'actor', actorId },
  source: { kind: 'custom', note } | { kind: 'source', refs },
  // 以下二选一
  operation: 'heal',
  amount: { basis: 'fixed' | 'target-max-hp', value },
  healingBonus, incomingHealingBonus
  // 或
  operation: 'consume',
  amount: { basis: 'fixed' | 'target-max-hp' | 'target-current-hp', value },
  minimumHpRatio
}
```

数值、治疗加成、受治疗加成、消耗下限、来源均须明确提供。开启既有 `playerDamageModel.mode = 'reaction-self-v1'` 是前提，因此同时沿用其角色初始生命比例、元素抗性、空间位置、结晶护盾及 `clamp-and-continue` 零生命规则；必须提供有位置的兼容敌人 `enemy-0`。不会由角色名推断生命行为。

健康配置要求 `duration`、`cycleLength` 与所有旧式 `rotation.at` 对齐 60 FPS 整数帧（容差 1e-8）。此模式默认明确采用 `legal-frame-v1`；显式请求 `legacy-v0.1` 会在公共入口被拒绝，避免原秒时钟的浮点误差改变同帧顺序。无生命动作的旧运行不变。

事件优先级为 2：同帧行动输入（0）/增益（1）之后、普通命中（3）之前；同优先级依队列序号执行。此为当前引擎的明确行动事件语义，尚未声称逐角色回调时序全部等价。`active` 在事件执行时读取当前角色；`self` 指动作来源；`party` 依配置队伍顺序。时间线不合法时按既有严格/等待规则处理；实际能量不足的动作不排治疗或消耗事件。

超出模拟终点的待执行事件不会补做。引擎总时长仍沿用既有闭区间终点规则；页面的半开观察窗须仅展示 `frame < endFrame`。后续增量已把确定性完整待执行 HP 队列纳入阶段检查点；尾段不足或仍有附着、随机等未导出状态时继续拒绝证明。见 [完整周期状态报告](player-health-phase-checkpoint.md)。

## 公式与来源

`player-health.ts` 使用计算器同一个 `TraceBuilder` / 表达式 AST 执行并生成中文解释、变量意义、实际代入和未舍入结果。每事件记录基础量、治疗乘区、请求量、下限、实际变化、结束生命和溢出共 7 个节点。

- 基础量 = 固定值，或事件前目标最大/当前生命 × 声明比例。
- 治疗请求 = 基础量 × (1 + 来源治疗加成 + 目标受治疗加成)。有效治疗 = max(0, min(请求量, 最大生命 − 当前生命))；溢出 = 请求量 − 有效治疗。
- 消耗下限 = 最大生命 × 声明下限比例。实际消耗 = max(0, min(请求量, 当前生命 − 下限))。角色已经低于下限时实际消耗为零，绝不因消耗反而回血。

固定主源为 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。[`heal.go`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/heal.go) 提供固定/目标最大生命比例治疗、加算乘区及溢出计算；本实现明确限定生命之契为零。[`hp.go`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/template/character/hp.go) 提供生命范围截断。非致死下限取自 [`久岐忍 E`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/kuki/skill.go) 的当前生命 30%、最大生命 20% 下限，以及嘉明特化下落的最大生命比例与 10% 下限；这些是可表达形式的来源，不自动新增完整角色行为。

6 份主源于本次联网读取固定 revision，与本地固定源码逐字节相等，归档及 SHA-256 在 [player-health-source/manifest.json](player-health-source/manifest.json)。没有运行外部 gcsim 程序，也没有游戏录像/服务器测量。

## 结果与兼容

可选 `playerHealthEvents` 每个目标一行，关联实际 `actionLogIndex`、`changeId`、事件序号与完整 AST。时间线新增 `heal` / `consume` 和对应 `playerHealthEventId`；所有生命变化在同一条角色链上。生命汇总新增可选 `totalHealing`、`totalOverheal`、`totalHpConsumed`；`initialHp + totalHealing − totalHpConsumed − totalHpDamage = finalHp`。

当前结果校验独立核对行动是否被接受、目标/时间、事件数量、每项算术、同一生命时间线的前后值和汇总；旧 wire 严格拒绝新定义/结果。未配置新生命动作时，不新增上述可选字段。既有 `zeroHpReached` 仍保留“最终生命等于零”的兼容语义，不宣称记录真正死亡或复活。

安柏和诺艾尔固定来源动作契约已有完整能力签名及 HP 配置限制；追加治疗不能保留来源契约身份，测试实际验证诺艾尔被拒绝。无需另写重复 guard。

## 实际验证与测量

仅新增 3 个有意义的核心集成测试；未运行旧全集、构建、大样本随机模拟或性能基准。

1. 首次 `npx vitest run packages/sim-core/src/__tests__/player-health-runtime.test.ts`：3 失败，862 ms（测试 22 ms）。共同原因是合成 fixture 使用 `enemy`，未满足既有兼容目标 `enemy-0` 约束；尚未进入生命计算。见 [首次日志](player-health-runtime-test.log)。
2. 修正 fixture 后同命令：1 通过 / 2 失败，902 ms（测试 125 ms）。通过项覆盖全部基本公式、JSON 重跑和 AST。失败项是测试误预期燃烧第一 tick 在第 0 帧（实际既有源为第 15 帧），及误预期严格冷却失败仅返回行（既有规则抛 `TimelineLegalityError`）。见 [第二次日志](player-health-runtime-test-retry.log)。
3. 仅复验失败项：`npx vitest run packages/sim-core/src/__tests__/player-health-runtime.test.ts -t 'orders same-frame|rejects malformed'`，2 通过 / 1 跳过，978 ms（测试 196 ms）。见 [定点复验日志](player-health-runtime-targeted.log)。没有重复运行已通过项。

4. 静态检查发现旧式秒时钟存在同帧浮点排序差，补充上述整帧约束和真实运行模式后，仅跟进第三项 `-t 'rejects malformed'`。第一次 1 失败 / 2 跳过，900 ms（测试 107 ms）：显式 legacy 拒绝检查放在内部，合法时间线包装先改成 legal，未触发拒绝。第二次 902 ms（测试 106 ms）重复同一失败：补丁脚本因匹配多处 `migrateConfig` 断言失败未写文件，后续命令仍执行；该次没有有效修改，不视作新增证据。随后成功将检查移到公共入口；第三次 905 ms（测试 97 ms）败在新增测试 fixture 将帧式 buff 写成 `duration`，同时错误消息正则大小写不匹配。修正 fixture 为 `durationFrames` 和准确消息后，最后 1 通过 / 2 跳过，926 ms（测试 140 ms）。见 [首次时钟跟进](player-health-runtime-frame-followup.log)、[未写入后的失败](player-health-runtime-frame-retry.log)、[fixture 失败](player-health-runtime-frame-final.log)、[最终定点通过](player-health-runtime-frame-passed.log)。没有重跑前两项。

时钟边界实测：旧式 rotation 在 `5/60` 秒施放延迟 1 帧的 active 治疗，同帧 `6/60` 秒的角色 B 行动先执行，治疗准确选择 B，2500→2600；结果及 manifest 的实际模式为 `legal-frame-v1`。非整帧终点、显式 legacy 及实际动态最大生命增益均被拒绝。

已测数值：最大生命 10000、起始 2500。当前生命 30% 消耗受到 20% 下限限制，实际消耗 500，余 2000；随后目标最大生命 25%、20% 治疗加成、10% 受治疗加成，实际治疗 3250，余 5250；固定治疗 6000 只回复 4750、溢出 1250；最大生命 90% 消耗只扣 8000、余 2000；下限处再请求消耗 500，实际为零。汇总有效治疗 8000、溢出 1250、生命消耗 8500、反应自伤零。第 61 帧治疗在 60 帧时长外未执行。

共享状态场景：角色 B 在第 1 帧换入；第 15 帧迟发的 active 治疗选中 B，接着全队治疗分别更新 A/B，再扣 B 的固定 100 HP；同帧燃烧自伤读取 B 的实际 3500 HP。验证这四个生命事件与燃烧的连续时间线、守恒关系、AST 数值和 JSON 结果校验。第三项覆盖能量不足不排生命事件、严格冷却错误、伪造数值拒绝、旧配置拒绝及无新定义结果兼容。

## 明确边界

尚未实现：生命之契、真正死亡/复活、敌人攻击、治疗/消耗回调触发角色被动、HP 门槛自动伤害增益、角色技能自动映射、命座/装备治疗数值推导、源治疗者属性实时取值、带负治疗加成的状态、角色卡肉对生命任务的重新定时。加成和固定量是用户明确给出的本事件上下文。

最大生命取现有静态角色面板；同时配置改变最大生命的 `hpFlat`/`hpPct` 动作增益会被拒绝，避免把动态面板默认为固定值。特定角色状态门槛（例如仅大于 50% 才触发，但实际消耗仍可能低于 50%）不能等同于本次下限字段，不能用本入口伪造完整机制。数据分类未从 provisional 提升；角色/命中覆盖计数没有因泛化生命执行器而增加。
