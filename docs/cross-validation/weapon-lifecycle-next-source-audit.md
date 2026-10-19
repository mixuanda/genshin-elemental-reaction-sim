# 下一批武器自动机制：讨龙与祭礼只读审阅

日期：2026-09-24。只读当前实现与固定源码，归档必需证据；没有修改 simulator、schemas 或生产注册表，没有运行测试、构建或外部模拟。

后续实施说明（2026-09-24）：讨龙现已有[独立外部增益条件计算](../validation/thrilling-tales-calculator.md)、[普通团队真实切人及确定性检查点](../validation/thrilling-tales-runtime.md)和[一次外部／一次本地对照](ttds-external.md)。三把独立武器追击也另见[运行时实施](../validation/independent-weapon-proc-runtime.md)。祭礼后续已接显式合法时间线、共享串行E槽和真实单层重置，见[共享来源/队列](../validation/sacrificial-shared-cooldown.md)、[独立结果校验](../validation/sacrificial-result-integrity.md)及[唯一外部样本](sacrificial-external.md)；角色卡肉、完整角色与随机稳态仍未完成。本文以下保留本次只读审阅时点与建议，不改写为当时已经实现或验证。

固定源为 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，数值目录为 genshin-db `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`。`packages/game-data/sources/weapon-lifecycle-next/manifest.json` 保存 17 个必要文件的固定 URL、SHA-256、字节数；已有相同原文引用既有档案，未重复复制。

## 建议先做什么

下一批真实自动机制优先 **讨龙的切人领取增益**：可复用现有 `activeBuffs → computeStats → snapshotAction → damage trace → calculator capture` 路径，仅增加受实际切换事件驱动的来源决策与日志。若优先扩大独立伤害覆盖，则先做 **钺矛 Halberd、苍纹角杯、冷寂迸音三把独立物理追击**：前者是 ATK 单目标，后两者是同一 HP 快照圆形追击模板。它们应是独立 damage event/独立计算动作，不增加到宿主普攻基础伤害。

祭礼四把虽然共用源码很短，但当前缺少能影响后续实际行动的冷却/充能重置接口，优先级低于上述两类。不能通过给下一次 E 静态减冷却或手工补能量宣称完成。

## 讨龙实际条款

源文件 [`internal/weapons/catalyst/thrilling/thrilling.go`](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/catalyst/thrilling/thrilling.go)：

- 28–38 行：持有者冷却键 `ttds-icd`，1200 帧；五精炼 `0.18 + 0.06R`，即攻击力百分比 **24/30/36/42/48%**。与目录五档完全一致。
- 33–35、40–47 行：初始化记录持有者是否在场，切入只更新状态；从持有者切出才判断触发。领取者是事件中真实新前台角色，不是任意指定队友，更不是持有者自身。
- 48–55 行：先检查持有者 ICD，成功通过后 **先写入持有者 ICD**，然后检查接收者的共享增益键 `ttds`。接收者已有时，**不刷新、不替换、不叠加**，但此次持有者 ICD 已消耗。
- 57–66 行：接收者攻击力百分比增益 600 帧；buff 与 ICD 都标记受角色卡肉影响。领取后换下接收者不会在本文件中删除增益，故不能实现成“仅当前前台拥有”。
- 持有者各自有 ICD，接收者 `ttds` 键共享；两把讨龙不可通过不同 owner key 绕过“不刷新已有接收者”的检查。

真实事件来源为 `pkg/core/player/player.go:104–138`：先改变前台，后发送 `OnCharacterSwap(prev,next)`。当前 `legal-timeline.ts:531–569` 在合法 swap 完成帧生成 `__swap#…` 合成动作；应由该实际切换驱动，不能预先遍历输入表生成 buff。重复切换到已在场角色、错误请求及等待不应获得增益。对未声明合法 swap 的旧式角色动作自动切换，是否适用必须明示，不能顺带扩大已验证范围。

### 最小拟议接口（尚未实现）

一个与已有 `FavoniusRuntime` 同级的小模块即可，避免通用武器事件框架：

```ts
type TtdsActor = { actorId: string; refinement: 1 | 2 | 3 | 4 | 5 };
// Host supplies an actual completed swap and authoritative recipient status.
onSwap({ frame, previousActorId, nextActorId, recipientHasTtds }): {
  ownerId, recipientId, refinement, coefficient,
  cooldownBefore, cooldownAfter, expiresAtFrame,
  outcome: "applied" | "owner-cooldown" | "recipient-already-buffed"
}
```

持有者检查依实际 `previousActorId`，无需另造一份可能不同步的前台状态。模块只决定是否触发及来源数值；host 调用既有 `addBuff`，target 使用真实接收者、stat `atkPct`、key `ttds`、duration 10。先判 recipient 已有再调用，因为既有 `addBuff` 会删除同 key 并替换（`simulator.ts` 本轮读取位置 7915–7943），与讨龙要求不同。

现有 `computeStats` 对目标角色叠加 `atkPct`，随后共享 AST 从基础攻击力计算最终攻击力；现有 calculator bridge 使用捕获的 `statsBeforeDamage` 重建，不需另算伤害或把讨龙再加一次。新增来源日志宜记录 owner/recipient/精炼/实际帧/ICD 前后/不刷新的判定，并将此记录作为“基础攻击 × 讨龙系数”的解释步骤，而不是再修改最终面板。启用此模型的保存/恢复还须保存 ICD 与接收者状态，旧记录语义保持不变。

### 必须显式处理的时间边界

当前宿主只有敌方卡肉时钟，尚无角色卡肉时钟。第一版应像现有西风一样声明 `global-frame-assumes-no-character-hitlag` 来源参考范围，不能把敌方时钟代替角色时钟。

固定源自身还存在不同的过期检查路径：

- `pkg/modifier/modifier.go:117–125` 的 `FindCheckExpiry` 在 `expiry < frame` 才认为不活动，**相等时仍返回活动**；`StatusIsActive` 与 `StatModIsActive` 调用它。
- `pkg/core/player/character/stats.go:24–34` 计算属性时却在 `expiry <= frame` 排除并删除 StatMod；普通 Status 不会在这段循环删除。
- `pkg/core/player/character/hitlag.go:18–35` 的 Tick 只运行角色任务，没有一个每帧统一删除所有状态的步骤。
- 当前宿主 `cleanup` 在 `buff.end <= time` 删除增益，所以属性失效边界可匹配，但“恰好到期帧对接收者的存在性检查”可能受源端该帧是否已读过属性影响。持有者 Status ICD 到期帧也不能直接套用 `< readyFrame` 的西风实现而假称严格一致。

因此不能只照抄“600/1200”后宣称全边界验证完成。需要后续实现明确固定源判定与同帧顺序；精确到期边界可作为唯一重要来源对照，而无需扩展成大量参数矩阵。该问题不影响五精炼普通百分比条款的核对结果。

## 祭礼四把：为何不是较小的接口

四个包装器均转发 `internal/weapons/common/sacrificial.go`：祭礼剑、祭礼大剑、祭礼残章、祭礼弓。

该文件 31–37 行与目录五档一致：成功概率 **40/50/60/70/80%**；触发 ICD **30/26/22/19/16 秒**，最后两档不能按前面的每档减 4 秒外推。

39–64 行触发顺序是：本人造成伤害 → 本人在前台 → ElementalArt（E）标签 → 未在祭礼 ICD → 实际技能冷却不是 0 → 实际伤害非零 → 严格 `roll < probability` → 成功重置 E 冷却并开始祭礼 ICD。没有暴击条件；未通过前置条件不抽随机；失败抽样不启动 ICD，所以多段 E 可以继续尝试。角色卡肉时钟与独立命名随机流也需要像西风一样保留范围与本地复现说明，不能声称跨引擎同 seed 序列相同。

`internal/template/character/cooldown.go:86–119` 表明：有任何可用 charge 时 `Cooldown(E)==0`；Reset 是恢复 **一个 charge**、弹出队列首项并重启后续队列，绝不是把所有 E 充能填满。`SetCDWithDelay` 还说明某些动作在命中之后才真正开始冷却，此前不能触发“冷却中的 E 重置”。

当前 `legal-timeline.ts:636–668,740–743` 的 charge 表只由静态编译决定，`simulateLegalTimeline` 仅向编译器反馈实际能量失败；没有实际命中时的 reset 回流。最小正确扩展也要让已发生的重置事件影响后续命令的合法开始帧，并让重新施放的 E 自然生成命中和粒子，不能孤立修改结果末尾的 cooldown 数字。它还会改变 Q 的真实能量资格与 practical profile 的实际基线，所以不能通过局部 static allowance 绕过。

## 来源文案校正

前轮试作星镰来源报告中“标签冲突”表述应收窄：固定 gcsim 的 `AttackTagExtra` 在凯亚/诺艾尔重击源码中就是重击，因此 `Normal | Extra` 与普攻/重击并不冲突。真正冲突为固定源使用 **ATKP**，目录与 Optimizer 使用 **普重 DMG%**。已实现的生产计算本来就是正确的 normal/charged DMG%，无需数值逻辑修改。此处记录审阅结论，当前只读任务没有改动前轮生产代码。

独立追击 16 把的并行详细审计另见 `weapon-proc-next-source-audit.md`，其中独立攻击必须保留它自己的快照、延迟、元素、标签、暴击与防御/抗性步骤。
