# CURRENT V153与事件子步骤：尚未实施的兼容决策

2026-10-21，保持原有历史wire/Golden不动。此处不是感电机制新方案；现有EC失败尚未修复。

## 已核事实

CURRENT根声明107字段，71必填、36可选。35项可选扩展及2项必填callback日志相对V152的名单在测试中明确写出，不从模拟输出生成。只能证明现有声明与测试一致；没有找到批准全部扩展继续共用V153身份的完整版本政策。

`simulator.ts`自动为legal-frame结果选择`flatStatBuffSemantics=canonical-v1`，并把atkFlat/hpFlat/defFlat映射到真实flatAtk/flatHp/flatDef字段。`result-integrity.ts`同样按此语义重放。V153→V152投影保留resolvedRuntimeOptions后，冻结wire不接受新标记。直接删掉标记会在实际使用平坦增益的场景掩盖数值语义变化，不能作为修复。投影也不是对所有新增日志/状态都已证明无损。

本轮词法盘点在packages和apps/web/src的TS文件中发现事件步骤相关56文件/450处，V153/当前身份/平坦语义相关49文件/356处。完整路径、行号、文本在交付包event-step-consumers.txt、v153-consumers.txt。该清单包含测试，并非已经完成所有别名、动态传播与运行时路径的语义审计。

## 事件步骤消费者分类

| 范围 | 关键消费者/约束 |
|---|---|
| 生产取号 | simulator.ts事件内nextIntraEventSequence，以及nextExecutionIntraSequence透传到圣遗物/武器等回调；target-state-timeline.ts保留审计位置 |
| 直接命中与EC来源 | schema.ts直接附着同号、Hitlag固定偏移；同时校验frame/priority/queue/target/backlink/Aura |
| 传播 | 候选观察N行，selected第i项附着N+i、命中N+i+1；当前探针仍符合，不应全局换号 |
| 回调与碎冰 | callback-bus-result-integrity.ts绑定真实触发子步骤；freeze-broken-attack与target-phase-v3各有来源/交付审计 |
| 装备与状态 | artifact-damage-integrity.ts要求OnEnemyHit在命中之后；OnHeal偏移+2；player-health/max-hp要求HP点+1；weapon-hit-stack-replay在具体子步骤前取状态；artifact-buff、normal-chain也使用同队列内顺序 |
| 盾与展示 | enemy/player-shield日志保留实际事件位置；七个Web面板展示或排序对应记录 |

已观察的直接路径为hit0→application1→Hitlag2，miss为hit0→Hitlag1；校验仍要求application=hit、Hitlag=hit+(landed?1:0)。这确实冲突，但不是把等式改为任意“大于”的理由。中间可有额外取号操作，固定+1/+2也不足。跨路径全局唯一编号会破坏现有传播与HP等专用布局。

## 最小明确选项

| 选项 | 行为 | 影响/建议 |
|---|---|---|
| A：新增明确版本身份，冻结已发布旧wire | 当前扩展/语义标记进入新身份；旧版本仍严格读取；只对可证明无损的域做显式迁移 | 最清晰的长期边界，需要维护者决定版本政策；涉及类型、导入、投影、Golden等消费者，尚未实施 |
| B：允许V153内可选字段扩展，但拒绝无法保真的旧投影 | 必须正式说明哪些是纯附加审计、哪些是执行语义改变；按已有标记严格区分，不接受来源不明的混合布局 | 兼容成本可能较小，但需先证明可区分性与每个投影域，不能仅因schema当前接受便宣布合法 |

不建议删除flat-stat标记、不建议一律接受两个子步骤布局、不建议重录所有Golden。当前直接命中最小技术方向是建立实际取号消费者的完整来源证明，保持所有独立backlink/Aura/时钟约束，并把冒充CURRENT的1.41夹具还原成历史身份或明确迁移。仍需验证含额外回调、多目标、miss/Hitlag组合；未完成这项证明前不修改生产编号。

当前需要决定的是持久化格式/导入兼容政策，不是让用户猜感电伤害、范围或角色机制。其余无争议功能与严格校验修复继续推进。
