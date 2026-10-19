# 2026-09-29：原生状态关联与更新任务审核

本批完成了明确状态激活来源的命中集合，以及更新任务失败回执的保存和页面导入。完整项目 goal 继续保持 active；这些改动不表示全角色机制或原生完整技能生命周期已经完成。

## 工作基线与实际改动

继续使用 `/Users/evan/Documents/gidps` 的已有工作树，HEAD 为 `84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5`，保留已有未提交工作。本批没有提交、推送、部署、远端任务执行或 provider 重新抓取。前批的工作树输入审计、基线和原生命中观察见 [动作来源报告](./source-action-origin-20260929.zh-CN.md)。

原生两条固定来源通道新增 `091-status-owner.patch`：角色实际 `AddStatus` 时记录状态实例编号、角色索引、状态键、创建帧和可用的创建动作序号。`minazuki` 监听器在既有状态/冷却/动作条件检查之后，围绕实际触发函数绑定该状态实例。源码里四个调用者是行秋、夜兰、托马及菲谢尔 C6。状态刷新生成新实例；失效或删除仍按原生检查处理，不改施放、伤害或计时规则。

新增 `origin.statusOwner` 与原有 `creationActionSequence`、`triggerActionSequence` 分别保存。行秋的监听器在 Init 安装，创建回调链仍然未知；启用雨帘剑的 Q 现在可通过实际状态实例关联，之后触发它的 N 也继续保留。子任务、攻击和嵌套事件携带当前明确绑定的状态关联；这表示执行来源关系，不自动将反应或协同伤害重新归属给某个角色。

共享核心与页面新增 `status-owner` 集合。用户可从动作结果打开状态关联的已观察命中，在独立计算器中逐击编辑、选择纳入项、查看共享公式轨迹及小计，再导出/导入完整上下文。创建链、触发链和状态关联可能重叠，不能相加。没有通过状态读取顺序、技能名称或临近帧猜测归属。

更新流程现在把 HTTP 错误、抓取失败、候选早期采集/标准化错误写入持久失败账本，并生成候选阶段回执。`review` 命令合并来源与候选账本，保留最近 20 条供页面审阅。每周工作流先保存日志、回执及取得的原始/候选字节，再依据真实步骤结果判定失败。更新页显示来源校验错误，并支持只读导入 `review-receipt.json`，区分构建内本地状态与导入文件。实际操作见 [更新说明](./update-status.md)。

主要改动文件：

- 原生：两通道 `patches/091-status-owner.patch`、`go/pkg/core/info/sourcehost_origin.go`、`go/pkg/core/sourcehost/bridge.go`，以及 stellar 构建补丁列表。
- 共享计算：`packages/sim-core/src/source-host-action-origin.ts`、`source-host-action-collection.ts`。
- 页面：`apps/web/src/source-host-origin-panel.ts`、`source-host-action-calculator.ts`、`update-operation-panel.ts`、`update-panel.ts`。
- 数据流程：`packages/game-data/scripts/update-data.mjs`、`sync-genshin-db-candidate.mjs`、`src/update-status.ts`、生成状态及 `.github/workflows/data-discovery.yml`。

## 执行检查与测量

没有扩大逐角色测试矩阵。检查记录在 [总测量回执](./validation/status-owner-update-measurements-20260929.json) 与 [更新流程检查转录](./validation/update-discovery-checks-20260929.json)。

| 检查 | 实际结果 |
| --- | --- |
| 两通道补丁应用和 Go 语法 | 在私有源码副本中通过；排除的相位字段仅为新增观察元数据，不隐藏状态时长等玩法字段 |
| 共享命中集合 focused unit | 3/3；测试 225 ms，命令 wall 1.576 s |
| 更新回执 focused unit | 1/1；Vitest 495 ms，测试 5 ms；随后仅移除“当前必须没有发现回执”的易过期断言，未重跑 |
| 经典宿主构建 | 通过；wall 14.897 s，43,444,334 字节 |
| 星辉宿主构建 | 通过；wall 15.641 s，65,346,785 字节 |
| Web 类型检查与构建 | 通过；wall 9.553 s，Vite 1.97 s；仍有既存动态导入/大 chunk 提示 |
| 两个聚合页面用例 | 2/2；wall 14.396 s；原生集合用例 8.7 s，回执导入用例 3.5 s；页面错误均为空 |
| 本地状态刷新 | exit 0；wall 0.729 s；未修改活动数据选择 |

首次页面命令在执行用例前失败，wall 2.104 s：测试直接导入带 JSON 依赖的状态模块，Node 要求 JSON import attribute。改成仅类型导入后再次执行，两例通过；没有因此修改应用计算代码。失败日志保留在总回执中。

原生样本使用两角色、12 秒、seed 11 的固定脚本。两条通道各 38 次实际命中，与前批不可变基线的计算、应用、能量、治疗、玩家/扣血应用及结果相同；只有来源信息扩展。Go map 导出的最终 `reaction_status` 报表按语义排序比较，实际事件数组保留原顺序。两条通道各有 6 次雨帘剑命中关联到状态创建动作 1：

| 数值 | 两条通道实测 |
| --- | --- |
| 状态关联命中原始公式合计 | 2403.863077651348 |
| 共享计算器重放差值 | 0 |
| 既有 E 创建链两击合计 | 1966.0871939310314，重放差值 0 |
| 页面编辑并排除末击后的合计 | 2136.111260020432，JSON 恢复相同 |

完整原生结果保存为 [经典 capture](./validation/status-owner-classic-20260929.capture.json)、[星辉 capture](./validation/status-owner-stellar-20260929.capture.json)，页面数值见 [原生结果回执](./validation/status-owner-browser-20260929.result.json)。本次页面只取行秋路径作为共享监听器的运行样本；夜兰、托马、菲谢尔 C6 的依据是源码审查，不声称做过页面验证。刷新/失效分支也未逐项做游戏内测量。

更新流程样本为明确的测试输入：localhost 不可达来源与返回失败的模拟 Git 命令。discover、candidate、带失败门槛的 review 均按预期 exit 1，两条原因进入同一审核回执。页面成功展示原因，之后导入无效 JSON 会清空旧展示。见 [模拟任务回执](./validation/update-discovery-fixture-20260929.review.json) 和 [页面回执](./validation/update-review-browser-20260929.result.json)。这不代表真实 provider 同步成功或 GitHub 定时任务已运行。

## 数据与产品范围

本批刷新的是本地状态展示，未更新游戏目录。最近版本证据仍为 2026-09-28 归档的正式 7.1 观察；活动目录为 `snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34`，`activeVerifiedSnapshotId` 仍为 null。隔离 preview 仍选中 7.1.50.2，两角色的 7.1.51 候选仍单独保存；没有证据将其改称 7.2 V1。

活动目录仍为 124 身份、255 武器记录、63 套装；v29 分类仍为 1271 命中模板、713 条件完整动作、24 partial 动作。15 角色/57 动作/89 命中是本地可组合库分母；原生注册 117/124 是另外两个分母，均不等于完整验证人数。本批不调整任何覆盖分类或正式 verified 数量。指针 SHA-256 为 `bcff67a4c25f405aac867e8924d3375dfa5405c2f08e5343c1f89977c7bc67e7`，运行时选择模块 SHA-256 为 `414badb3c7f2e145c039b61048507df6ae2160ce15fb377784a2a6c58f8de045`，与批次开始相同。

独立单击/单技能计算器、逐步公式及数值代入、可编辑 A/B 示例、多段合计、公开展柜导入及模拟命中重放均继续保留；其既有实现和测试证据见主实现报告。本批新增并实际测试了状态关联多击集合的共享计算与编辑恢复，没有重跑早先示例、展柜或全部动作测试。配装/轮转的只读复核也确认仍有每个活动身份两档小毕业/大毕业参考配装、18 个入门队伍模板、武器圣遗物编辑、GOOD/JSON/公开展柜入口及 E/Q 等可视化编排；参考配装不宣称最优解。

剩余范围包括更多原生实体和持续效果的明确关联、攻击机会与观察窗后待结算事件的生命周期闭合、24 个 partial 动作所需真实输入/执行语义、未覆盖的确定性私有状态，以及远端更新执行和版本/机制独立证据。当前集合始终是已观察小计，不能标为完整技能或稳态结果。
