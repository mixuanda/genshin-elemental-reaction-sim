# 护盾回调与延迟任务归属（116）

## 范围与实现

本批在第 115 批逐实例护盾身份、生命周期 hook 与白术 Q 合同之上，追踪护盾事件回调排出的角色生产者，并把相关延迟任务树绑定到真实护盾出生。任务记录携带父生产者身份与入口事实；出生盾仍由实际创建它的任务拥有，任务执行时读取的当前护盾门控另行记录。回执观测原生已有的 `Get` 条件，不改变游戏逻辑，也不以静态时长替代原生到期或回调事实。

范围包括 辛焱 E/Q 的护盾归属攻击、诺艾尔 E 的初始角色攻击及 C4 护盾回调，以及各自相关的延迟任务。辛焱 Q 沿用既有 C0–1 有限合同并扩展审计范围至 C2–6；诺艾尔 的 C4 回调爆炸和普通 +720 帧后备任务按原生分支分别追踪。保留 classic／Stellar 的护盾元素差异及原生队列、回调顺序、时间与门控。

通用原生护盾观察器与 TypeScript 分析、有限技能页面复用第 115 批路径；本批记录和组件 UI 由共享 registry 驱动。主要实现文件包括 `packages/source-host/go/pkg/core/sourcehost_shield.go`、`packages/source-host/stellar-overlay/go/pkg/core/sourcehost_shield.go`、`packages/sim-core/src/source-host-owned-shield-types.ts`、`packages/sim-core/src/source-host-owned-shield-analysis.ts`，以及两个来源 lane 的角色补丁和 `apps/web` 的组件／案例文件。逐角色调用链及 lane 差异以本批来源审计回执为准。

## 已完成实现与检查

本批新增 辛焱 E、诺艾尔 E 两项有限盾归属合同；辛焱 Q 沿用已有合同并扩展到 C2–6。原生护盾生产者回执分别记录 `ownerInstanceId`、`parentProducerId`、任务 ID、实际门控 shield ID 与任务入口事实；回调生成的角色任务显式携带父命中回调 ID。首个 DoT 任务仍按原生顺序先入队、后安装盾，再把生产者绑定到真实盾实例；递归 Core 任务继承实际父生产者和盾所有者。分析器观察原有 `Get` 门控，不添加盾所有者相等之类的游戏逻辑判断。

辛焱 E 的升级任务保留 13 帧角色任务及原回调命中计数；DoT 首／后续任务按原 gate 分别记录 0/1 排队攻击及实际 `gateInstanceId`。E 任务的 shield birth 按真正 Add 分支记录，不能假定每次 E 都出生新盾。Q C2 的盾任务独立归于 Q；65／83 帧两次额外攻击仍是 Q 直接攻击，不计作盾 DoT。classic 构盾模板继续不显式设置元素，Stellar 保留 Pyro。诺艾尔 E 立即出生的盾归于 E；14 个角色帧后的初击使用原生 `QueueAttack`，并保留 C4+ 的 +720 帧任务及真实 0/1 守卫事实。过期、覆盖或受击破裂时由确切旧盾 hook 拥有的 C4 攻击，与无活跃盾 hook 时仍归能力生产者的 timer 分开；classic 未设置盾元素，Stellar 保留 Geo。A1 盾与治疗排除在本合同外。

来源代码审阅见 [辛焱 审计](validation/source-shield-task-casts-xinyan-20260930.json) 与 [诺艾尔 审计](validation/source-shield-task-casts-noelle-20260930.json)；共享 native wire 与两 lane 变更摘要见[生产者 native 审计](validation/source-shield-producer-native-20260930.json)。合同数值及分支由共用分析器检验，见[合同审计](validation/source-shield-task-casts-contracts-20260930.json)。实现涉及 `packages/source-host/go/pkg/core/sourcehost/shield_producer.go`、`sourcehost/ability_producer.go`、`sourcehost/ability_receipt.go`、`sourcehost/shield_lifecycle.go`、`sourcehost_shield.go` 及相应 Stellar overlay；TypeScript 位于 `packages/sim-core/src/source-host-owned-shield-types.ts`、`source-host-owned-shield-analysis.ts`、`source-host-xinyan-shield-analysis.ts`、`source-host-noelle-shield-analysis.ts`、`source-host-action-collection.ts`、`source-host-wire.ts`；页面与案例在 `apps/web/src` 和 `apps/web/e2e/source-shield-task-casts.spec.ts`。

两 lane 来源构建首次通过：classic 4.514 秒（45,197,266 B，SHA-256 `66066323e69688389bf30be9c4585346bd805d75c5f8d6a89ab572aa0789c84e`），Stellar 5.224 秒（70,002,974 B，SHA-256 `0ee9b8fc75924f2329f9775f4cacabe7d824e3d76915edb421552ef1ccd7b604`）。Talent registry 0.124 秒，typecheck 2.766 秒，Web build 1.113 秒。registry 分别报告 classic 576 表／600 sites／10 expression sites，Stellar 605／632／10；数据见各自[测量记录](validation/source-shield-task-casts-classic-build-20260930.json)、[Stellar](validation/source-shield-task-casts-stellar-build-20260930.json)、[registry](validation/source-shield-task-casts-talent-registry-20260930.json)、[typecheck](validation/source-shield-task-casts-typecheck-20260930.json)、[Web build](validation/source-shield-task-casts-web-build-20260930.json)。

单个 classic 双目标配置完成一份原生运行，实际观察 1,291 帧、38 个伤害应用，actions-exhausted；记录 4 个护盾实例、4 个 hook、8 个 shield producer 与 8 个 ability producer。最终浏览器案例选择 诺艾尔 C4 E、辛焱 C2 E 与 辛焱 C2 Q，三项有限合同全部闭合：诺艾尔 4 击小计 2,292.4880410260785；辛焱 E 4 击小计 691.6303929066518；辛焱 Q 30 击小计 3,783.136560570299。共 38 击逐击共享公式重放差均为 0，页面错误为空。诺艾尔 护盾第 721 帧自然到期，独立 +720 Core 后备任务实际排队数为 0。辛焱 E 出生盾实例 2、3 分别于第 121、343 帧被覆盖，Q 盾实例 4 于第 1,063 帧到期；E 调用有 8 个命中回调，其中精确归于护盾升级的回调 ID 为 3、6。DoT 链在第 241 帧发出一次攻击；第 361 帧终止任务的实际门控 Get 指向新 Q 盾 4，但 tick source 不匹配，因此没有攻击。移除该终止任务的离线探针正确阻止合同闭合；组件 JSON 编辑、导入／导出通过。

浏览器尝试共 3 次、只执行这 1 次原生运行：首轮因测试错误地把 8 个命中回调都断言为 2 个护盾回调而失败（10.742 秒）；第二轮已复用捕获并通过原生分析，但 UI 测试在打开 details 前检查其内部 summary 可见而失败（8.901 秒）；调整测试顺序后第三轮复用同一归档捕获通过（5.9 秒 runner、5.0 秒用例，6.207 秒 wrapper）。产品源码未因两次测试失败而更改。相关记录见[最终运行结果](validation/source-shield-task-casts-team-20260930.result.json)、[最终浏览器日志](validation/source-shield-task-casts-browser-final-20260930.log)，前两轮日志见[首轮](validation/source-shield-task-casts-browser-20260930.log)和[第二轮](validation/source-shield-task-casts-browser-retry-20260930.log)及[原生捕获](validation/source-shield-task-casts-team-20260930.capture.json)。

此结果只证明选定配置的来源执行、有限合同和共享公式重放；不能推广至其他护盾角色、未选命座／分支或完整 E/Q 生命周期，也不代表游戏机制已 verified。受击破盾分支未由本配置覆盖；执行和重放不提升正式／预览数据指针或 `activeVerified`。本批 finite contracts／producer plans／producer sites 为 63／54／70，统计及固定指针摘要见[合同汇总](validation/source-shield-task-casts-contracts-20260930.json)与[测量汇总](validation/source-shield-task-casts-measurements-20260930.json)；整体目标仍开放；后续实际事项包括其他技能与资源驱动来源归属、完整动作范围及更广的稳态收敛证据。远端 CI 实跑未观察，`activeVerified` 仍为 null，7.2 V1 与固定来源的不可变版本映射未核实。上游数据沿用 2026-09-30 已取证记录，本批未重复抓取；正式／预览指针未变。
