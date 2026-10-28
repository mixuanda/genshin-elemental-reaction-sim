# 雷霆飞缒的 C0–C6 当前命中支持

此补充接续 `active-burst-evidence.json`，把同一 `iansan-swift-resolved-c0` 扩展到有实际条件的 C0–C6 当前命中。原技能标识、原压缩包、原 manifest、普通攻击倍率及天赋绑定裁决均不修改；原文的 C0 限制保留为历史边界。本功能没有构建夜魂、能量、冷却或完整队伍轮转。

固定 Optimizer `180a0a1015cb725c7570cd828eb086749960df98`、原包 gcsim `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd` 和固定 `cons.go` 的证据与字节身份记在 `constellation-evidence.json`。这些社区实现不是当前游戏实测认证。

| 命座 | 对这次计算的处理 |
| --- | --- |
| C1 | 消耗夜魂后的回能不直接改变本击；不自动产生回能或夜魂历史。 |
| C2 | 施 Q 可授予15秒的普通 A1，实际有效时本人仍只有20%白字攻击。另30%是其他角色的增攻，绝不把本人算成50%。A1在 Q 刷新与本击时的状态分别读取。 |
| C3 | 只提高 E 等级；Swift仍用实际普通攻击等级，保留原 gcsim E 索引冲突原文。 |
| C4 | 夜魂恢复层数及溢出返还影响后续真实点数；本页只读取实际 Q 刷新点数，不自动加4或重放资源历史。 |
| C5 | Q 的已有效等级独立输入，上限按该级取值，不再额外加3。 |
| C6 | Q 延时不用于推断循环；仅当本人本击实际收到且仍有效的极限发力才计25%增伤，再扣除输入已含份额。当前54点、Q开启或某次溢出不能代替实际接收状态。 |

gcsim 的 C2 初始化跳过本人，但其他角色的 getter 没有显式检查伊安珊是否后台；Optimizer 限定当前活动目标，原描述要求伊安珊后台。本次不把这些不同上下文强行合成统一的队伍 C2 函数，也不修改原生实现。

不能仅凭 Q 生效就把未知 A1 改为有效。虽然 Q 和 A1 都受本人卡肉延时，但 Swift 帧末刷新 A1 时会替换整个同名 modifier，不保留旧 extension。固定源码允许 Swift 第24帧衔接 Q、第25帧伤害先施加卡肉再运行敌人回调；C6 的 Q 与 A1 初始时长同为15秒时，同名刷新可破坏它们到期时间相等的关系。补充 JSON 保存了这条源码顺序的到期反例模型；它不是完整资源轮转的原生实跑。当前单击不含整段旧 Q 的生命周期证据，因此保留已有实际 A1 字段。

新增 `sharedState` / `hitStates` 字段：

| 字段 | 语义 |
| --- | --- |
| `c6DamageBonusActiveAtHit` | 本击实际持有且仍有效的极限发力；未知不等于否。 |
| `includedC6DamageBonus` | 本击增伤输入已含的该项份额，范围0–0.25；明确未含为0。 |

普通输入使用 `实际C6份额 - 已含份额` 的增伤公式；有效且已含0.25时不重复加，已失效但旧输入含0.25时移除它。玩家提供的历史完整最终快照必须已经包含当时实际份额，有效为0.25、未生效为0，不在冻结增伤上补差。

共享转换器只物化装备和手填增伤，保留独立角色 `damageBonusFormula`，所以来源 C6 公式及其原已含份额也保持独立，保存重开后继续只应用一次。状态、命座、独立有效天赋或其他来源身份变化时，旧转换身份不能复用。外来的增伤公式保留，并在与 C6 同槽冲突时阻塞。

公开范围接口位于 `iansan-swift-resolved-formulas.ts`：`IANSAN_SWIFT_MAX_CONSTELLATION=6`，`isIansanSwiftConstellationHit(document,hit)`。后者锁定角色10000110、原技能标识、combat1、雷元素重击、实际普通攻击倍率及唯一合法25帧事件，不能给其他动作开放高命座。

可供队伍回调直接导入的纯数值函数位于 `iansan-swift-resolved-numeric.ts`，不推进时间、不判断接收者、不反推面板：

```ts
evaluateIansanBurstAttackFeedback({
  effectiveBurstTalentLevel, nonExtraAttackAtUpdate, nightsoulPointsAtUpdate,
}) // { rate, cap, attackBonus }
evaluateIansanC6DamageBonus({
  constellation, active, includedDamageBonus,
}) // { actualBonus, delta }
```

以 NA10=1.6643、输入攻击2000、白字1000、先前 A1实际有效且未含、90对90、10%抗性、无暴击/反应为例：Q10 最近一次刷新攻击2200、42点夜魂，非暴击为2092.52439；C5采用已有效 Q13 且刷新攻击5000触顶810时为2254.29435。前一条件若本人本击实际收到 C6 且未含，则为2615.6554875。均未给本人加入30%的队友增攻。
