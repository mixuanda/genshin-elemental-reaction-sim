# /goal C2 跨模式与真实用户路径：旧失败有限分类

审查基线 `6cbc4f9e380420913833581f72fe95cc4967e479`。最新已知整套结果仍是 `924edf6` 的 **3196 pass / 79 fail / 1 skip / 3276 total**，原件为 `/workspace/GIDPS-cloud/uid-team-20261022/full-final.json`，SHA256 `d43054c22d6c9b339b7e9c19a1d3c32541af258b2701bdb59cdd7d6fbef81a3a`。本轮只运行一个所选最小测试，没有全量或原生模拟。

逐项索引见 [结构化证据](c2-crossmode-failure-classification-20261023.json)：保留全部 79 个测试身份、原 JSON 位置、首错误、既有后续证据及本轮是否复测。这里分类的是**已观察到的首失败点**，不证明断言之后的未执行分支，也不更新整套通过／失败数。

| 分类 | 原 79 项数 | 证据及当前复测状态 |
| --- | ---: | --- |
| 本有限范围新确认的实现错误 | 0 | 不等于产品无缺陷。后述 C2 泄漏与 V2 输入挽救是真实实现错误，但不在这 79 项分母内。 |
| 过时协议／消费预期 | 52 | 历史严格 wire 45、旧消费者 6、EC 历史入口 1。45 项均精确拒绝 root 与 manifest 中的 `flatStatBuffSemantics`；不能删除语义标记冒充无损投影。四项反应完整性旧失败已在 `771f7b2` 后定向通过，本轮未重复。其余仅沿用有限证据。 |
| 冻结 Golden／顺序身份 | 24 | 既有逐字段报告定位 canonical 标记、hash、事件／子步骤号；核过的伤害、帧、Aura 等投影一致，原失败和 Golden 仍保留。本轮没有重跑或改写它们，不能推及投影外机制。 |
| 缺明确条件 | 2 | 琴完整 Q 缺全命中、跨时点面板稳定确认；卡齐娜下落缺实际碰撞、落地接触及无外部附魔确认。旧无条件成功断言失败，不能从动作名补值。本轮未跑其完整正例。 |
| 时限 | 1 | V153“71 required fields”整套中 `16474.55ms` 超过原 `15000ms`；既有单独复测 `12833ms` 通过，断言和时限未改。本轮不重复慢测，也不从 79 中扣除。 |

另有 **1 skip** 是 `player-import-public-smoke.test.ts` 的 `skipIf(!GIDPS_ENKA_RESPONSE)` 离线响应重放，不能当作公开 UID 联网失败或通过；本轮没有提供个人响应、联网或复测。

## 与真实用户路径直接相关的有限结论

旧消费者 6 项分别涉及：旧 catalog 与默认 released workspace 隔离、旅行者旧 skillId、伊安珊旧 unresolved ID、装备覆盖固定计数、隔离 preview、确定性武器说明。原证据见 `/workspace/GIDPS-cloud/failure-triage-20261022/followup-78/` 与仓库 `docs/oss-preparation/CONSUMER-AUDIT-20261021.zh-CN.md`。不能为旧期待重新耦合数据对象、恢复错误的未解析身份、删除映射或晋升 preview。

本轮唯一最小复测：

```text
./node_modules/.bin/vitest run packages/game-data/src/classified-hits.test.ts --testNamePattern='blocks a drifted skill field without blocking the same character' --reporter=json --outputFile=/tmp/GIDPS-c2-failure-classification-20261023/focused.json
```

实际 **1 fail / 10 未选**，exit 1，仍在原 `classified-hits.test.ts:80`：修改旧 catalog 后，独立默认 UI workspace 的 E 仍可算，与旧“应 blocked”期待不同。此前已有“明确传入的 workspace 发生 E 字段漂移时局部阻断、普攻不受影响”的负例；本次失败不能解释成允许真实来源漂移。原断言、测试与公共实现均未修改，JSON／日志位于上述 `/tmp` 目录。

四项 `reaction-formula-integrity.test.ts` 曾在当前数值断言之前，强迫当前 canonical 结果降为冻结 V144；`771f7b2` 分离协议后，原文件 **11/11**、不可变历史 wire 测试 **8/8**，原协调篡改拒绝断言保留。证据是 `docs/validation/reaction-formula-legacy-separation-evidence-20261023.json` 及 `/tmp/GIDPS-old-failure-correctness-evidence-20261023/separated-final.json`。这四项有明确局部恢复证据，**不能改报整套 75 fail 或全绿**。

旧 wire 投影失败不等于原用户文件无法只读。已有文档路径保留原文／下载，编辑另建 `not-recomputed` 副本；V2 合法源输入因结果校验失败而被清空，后来经真实浏览器确认是实现错误，已由 `cd7b32e` 修复。既有证据为单元 **10/10**、七个不同浏览器场景各自的最终通过结果，**不是单次 7/7**；本轮未重跑。见 [V2 输入挽救记录](../integration/V2-INPUT-SALVAGE-20261022.zh-CN.md)。不能把此前静态候选继续列成未知现存缺陷，也不能放宽结果校验来恢复输入。

## C2 的真实错误与 79 项分母分开

流浪者 Q 专属 C2 曾泄漏至非 Q 快照：原兼容 Go 负例两个子例真实 `got 2, want 0`，旧捕获五笔非 Q 伤害多含 `+2 DmgP`。这是实现错误，**不在上述旧 79 项中**。Classic 经 `77a0d05`／`6f5600e` 修复，原负例转为通过，六份实际捕获的 Q 五击、非 Q、C6 父链等另有冻结审计；详见 [C2 范围记录](wanderer-burst-cycle-20261023.zh-CN.md) 与 `wanderer-c2-classic-build-20261023.json`。

截至本分类基线 `6cbc4f9`，Stellar 只记录了相同源码模式，尚无注册补丁 137、重建及实际运行验证；不能把 Classic 成果写成两模式完成。根线程后续跨模式补丁与原生短轴是独立验收，本文件不预先代其报成功。C2 修复同样不自动完成所有角色、完整轮转或旧结果迁移。

下一优先项是根线程闭合当前跨模式 C2 的实际命中与边界，再给条件型消费者建立明确条件正例、未知／false／合法零负例及保存重开证据。历史格式应逐版本证明可表示性，原 Golden 和原件继续冻结；不建议重复已完成的 V153 单独复测、19 项协议隔离或原生 120 秒。

本轮只新增本文与索引，没有修改共享引擎、构建、WASM、候选、历史结果、原测试或 Golden；没有 push、部署、凭据或许可操作。
