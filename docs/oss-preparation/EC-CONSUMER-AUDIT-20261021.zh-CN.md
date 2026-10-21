# 感电与消费者契约复查（2026-10-21）

审计起点为干净 `ffbd58c712ce6f936613ff527c6450db3edcfab4`。本块没有修改生产算法、现有测试、历史文件或 WASM；新增的是可执行只读盘点脚本与审查结论。不能称感电已修好。

## 剩余八项消费者

| 失败项 | 根因 | 应有行为／直接修复判断 |
| --- | --- | --- |
| optimizer-adapter 全部动作默认成功 | 卡齐娜下落缺实际碰撞数、落地接触、无附魔确认 | 已知条件可算，未知阻断；不能凭动作名补 1 次碰撞。未发现实现缺陷。 |
| classified-hits 全部文档默认成功 | 琴完整 Q 缺 completeCastConfirmed、statsStableAcrossHits | 完整技能必须证明多次接触与属性条件，独立命中入口另计。旧无条件断言过时。 |
| classified-hits 旧 catalog 漂移 | 默认 releasedRuntimeWorkspace 与旧 gameDataCatalog 是独立对象 | 显式工作区漂移必须局部阻断，不能把默认工作区重新绑定到旧模块；上一块已有局部 E 漂移负例。 |
| classified-hits 旅行者旧身份 | aether-anemo-burst 已被 traveler-cross-aether-anemo-burst-c0 取代 | 新入口仍须证明 trueMoonStoryBuffInactive；保留历史记录，不能为旧测试造一个同义旧入口。涉及历史身份的迁移不在本块实施。 |
| classified-hits 来源角色复合断言 | 奥黛塔已恢复，后续停在伊安珊旧 unresolved ID | 当前 explicit-iansan-swift-resolved-v1 已解析；不能恢复错误的“未解析”状态。此复合测试仍失败，不计作已修。 |
| equipment-additional-effects 固定数量 | 旧 53/44/42/5，对应实际 53/48/46/6 | 新映射不能删除以凑数量，verified 仍为 0。需要版本化目录快照测试，而非削弱数值断言。 |
| update-pipeline 空预览 | 现有两个隔离 Lunaris preview 快照 | 保持 preview 隔离，不能删除快照或晋升正式；旧“必须为空”假设过时。 |
| weapon-proc 弱点说明 | 要求每个非信使分支都使用相同自动触发文字，并禁止“无需随机触发抽样” | 水仙十字之剑是已有确定性生命周期，保留真实说明和数值；不能凭字符串断言引入随机性。 |

八项当前没有新确认的数值算法缺陷。前一块修复的草旅行者/奥黛塔入口不重复交付。更新这些旧测试应当保留原测试为固定历史快照，并增加当前明确条件正例和未知条件负例；不是把失败断言改成宽松通过。本块未更改旧测试。

## 感电：实际失败，不是全归因于过时测试

九项来自 electro-charged-propagation.test.ts（8）及其 Golden（1）。当前合法输入在模拟结束的可信结果引用校验中被拒绝，影响当前功能返回，因此这是产品缺陷。未有证据证明九种伤害机制分别错误；许多断言尚未执行到，修复首个拒绝点后仍需继续验证。

直接生产路径在 simulator.ts：每个队列事件 10095 重置计数，16351 为 direct hit 取号，16897 为 direct-hit-application 再取号，completeHitTarget 的 9211 为配置的 Hitlag 再取号。无额外记录时 landed 为 0/1/2，miss 为 0/1（没有 application）。schema.ts 27647 仍要求 Hitlag=hit+(landed?1:0)，28680 要求 application=hit。旧 1.41 Golden 的同号布局与当前布局不同。

但不能把修复简化为统一 +1/+2：

| 生产阶段 | 会影响计数的记录／调用 |
| --- | --- |
| hit 之前 | ensureTargetTaskPhase 的入参先取号；3492 起的函数若已有同帧同目标阶段就复用旧记录。分配号不一定对应新日志行。 |
| hit 与 application 之间 | sampleStats（5913）调用武器叠层与圣遗物采样回调；appendWeaponHitStackDecisions（4760）、appendArtifactBuffDecisions（4773）使用同一个闭包计数器。16639 记录 artifactDamage；16654 记录 Shatter；递归 Shatter 投递也收到计数器；16802 反应圣遗物回调发生在 application 前。 |
| application 与 Hitlag 之间 | 反应加成采样 artifactReactionBonus 可写 artifactBuffLog；Bloom、Shatter、转化反应调度及 17932 感电加成读取也在 completeHitTarget 前。具体启用路径由配置决定。 |
| 传播候选与传播命中 | reactionDamage 分支的候选观察、application 使用计数器，appendParentReactionHitResolution 读取当时计数而不递增；不能把所有日志合并后强制唯一。已有六候选/三 selected 探针为候选 0..5、application 6..8、hit 7..9。不能外推所有配置都无中间记录。 |

新增发现：18797 的 assertTrustedReactionDeliveryResultReferences 投影只传 action/damage/reaction/hit/periodic/clock/Hitlag/target-state 等日志，**没有传武器叠层、圣遗物 buff/damage 等中间见证**。schema.ts 26630 起的引用值 schema 也没有为这些中间日志定义叶级契约。仅把等号改成“大于”、计算现有行数或信任任意附加字段，均不能提供严格的子步骤证明。

### 消费路径盘点

- simulator.ts 18797 的可信校验与 schema.ts 31559/31604 的 JSON 边界共享同一 cross-log refinement，不能只修一个入口。可信入口不做叶级解析，JSON 入口还检查 plain-wire/身份。
- result-schema.ts 多个版本化结果 schema 接入 reactionDeliveryResultReferencesSchema；schema.ts 的 Golden/场景包校验也复用它。修改公共函数会波及历史消费者，必须显式区分历史契约。
- result-integrity.ts 10240 起另查 application 唯一归属、cause、frame、queue、target、Aura 快照；1100/11168 附近查 Hitlag 及引用。这些独立检查必须保留，不能靠跳过完整 integrity 来返回结果。
- target-state-timeline.ts 存储传入子步骤号，不负责给所有日志分配全局身份；target-clock.ts 负责时钟行为，不决定上述跨日志布局。
- Web app.ts 2549 起读取 reactionDamageLog/targetStateTimeline 做来源详情；武器/圣遗物详情直接展示事件内编号。导入/导出需经过结果 schema；UI 不应自行重编号或篡改旧数据。
- schema.test.ts 的 makeNearbyWetPropagationReferenceResult 把 1.41 Golden 标成 CURRENT、补 damage-group 却保留旧子步骤，是混合测试数据。该测试过时不消除当前模拟输出被拒绝这一真实缺陷。

`audits/ec-stellar-audit.py` 输出引用位置与固定补丁哈希盘点。它是静态搜索工具，不声称完整控制流证明；完整跨回调重放实现尚未完成。旧探针保存在 current-contract-tests-20261020/ec-full-trace.json 和 frozen-141-trace.json，不冒充本轮新运行。

### 工程处理与真正的兼容选项

纯工程工作无需用户选择：建立当前事件内分配/引用的严格证明，显式携带并验证实际中间见证，保留 target/owner/Aura/queue/clock/backlink 校验，针对 miss、有/无 Hitlag、额外采样/反应回调、复用阶段及传播扇出分别测试。缺号、重复/伪造见证、错 target/queue/priority、倒序和缺 clock transition 都必须拒绝。这个实现本块未完成，不将它伪装成权限阻碍。

若必须改变持久化格式，最小用户选项是：

1. **推荐：新结果显式版本化；旧结果保留原样阅读/导出，只对具备明确旧校验器的版本验证。无法证明来源的混合 CURRENT 旧结果不能当作当前可重放结果，用户可另建新模拟。** 代价是部分旧结果不能直接重放；优点是不编造缺失审计位置。
2. 仅对可证明无损的旧布局提供显式、另存副本迁移，保留原文件/哈希/迁移报告；缺少中间见证的一律拒绝迁移。代价是迁移实现与验证更多，不保证全部旧结果可迁移。

现在尚未发现必须立即替用户决定的数据覆盖操作；沿既定“原样保留、不同步重算”原则继续即可。这两个选项不能用来推迟当前运行时的工程修复。

## Stellar A4：只读结论

固定上游 a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd 的 asc.go:108 在 a4() 注册时立即 updateA4；player.go:273 先角色 Init，再于 284..291 设置初始 HP，core.go:134 最后才 OnInitialize。与 Classic 同类初始化时序问题仍存在于声明的构建源码。

清单 145 个补丁全部有哈希一致的本地文件。相关 asc.go 补丁 028 只增加动态来源读写、043 只改 A1 计数；没有移动 A4 初始化。构建脚本及清单未包含 132-neuvillette-initial-hp-a4.patch。Stellar WASM 清单哈希仍为 95e33baf8dfdb7264cea14d9b339724de41311d906df93f8d4c1f4e0c8131256。

本轮仅下载三个固定上游文本文件并记录 SHA256，检查补丁，未执行 Stellar、未重建、未修改其二进制。因此结论是源码级确认受影响，尚无本轮 Stellar 运行数值复现；Classic 的四项动态生命验证不能替代它。下一次修复需复用初始化后采样原则，保留 heal/drain 动态回调并独立重建/验证。

## 证据与边界

目录 `/workspace/GIDPS-cloud/ec-contract-audit-20261021`：full.json/full.log 为本轮完整回归；static-inventory.json 为 145 补丁及 151 处匹配位置；stellar-source/sources.json 含固定上游 URL/哈希。脚本不访问用户电脑、不修改数据、不联网。

本块不新增功能，没有降低/删除断言、修改历史格式、修改根许可证、push、合并或部署。没有 Windows 实机验证。此报告明确保留 EC 工程修复未完成和 Stellar 运行验证未做的断点。

### 本轮新运行的最小失败复现

证据 `runtime-probe.test.ts`、`vitest.probe.config.mjs`、`runtime-probe.json`、`runtime-probe-summary.json` 和日志。命令：

```sh
node node_modules/vitest/vitest.mjs run --config /workspace/GIDPS-cloud/ec-contract-audit-20261021/vitest.probe.config.mjs
```

探针在可信校验入口捕获实际入参，然后调用原校验并保留抛错。没有跳过任何生产校验，也没有改生产源文件。输入为同一合成感电目标场景，对照有/无教官四件套、有/无 Hitlag：

| 条件 | landed hit | application | landed Hitlag | miss hit / Hitlag |
| --- | --- | --- | --- | --- |
| 无圣遗物、无 Hitlag | 0 | 1 | 无 | 0 / 无 |
| 教官、无 Hitlag | 0 | 2 | 无 | 0 / 无 |
| 无圣遗物、有 Hitlag | 0 | 1 | 2 | 0 / 1 |
| 教官、有 Hitlag | 0 | 2 | 3 | 0 / 1 |

四组全部复现当前来源校验拒绝，且四组校验入参都不含 artifactBuffLog。教官使用既有真实反应回调，不人工注入 buff 或改面板。该诊断用例显示 1 passed 只表示成功捕获上述失败，**不计入产品回归通过数，更不表示感电功能通过**。这是合成输入的执行器契约证据，不宣称真实感电队 120 秒验证完成。
