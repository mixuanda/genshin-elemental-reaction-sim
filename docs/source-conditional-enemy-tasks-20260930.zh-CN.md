# 固定来源条件敌方任务与零根攻击闭合（124）

## 本批实现范围

本批新增 8 项角色动作完整性规则：Jean E、Lanyan Q、Varka Q 三项常量型；Chasca E、Xilonen E、Qiqi Q、Aloy E 四项动态型；以及 Nilou Q 的目标命中后延迟任务。Sara E 未纳入：其 E 状态触发的后续瞄准伏击攻击归属仍未绑定。Chasca E 的 AimState 释放分支也仍为 partial；其它已闭合 E 分支不能代表整招完整。

共享轨迹和计算器界面现可区分“动作完整结束、完整性规则预期根攻击为零”和未完成／未知结果。Chasca E 与 Xilonen E 的指定分支在本批调用中以零根攻击完整结束；当分支事实缺失或未知时，系统仍保留 partial，不以未观察到的攻击推断零结果。

Nilou Q 的原生目标命中回调会创建敌方本地延迟任务，再由共享 hit-callback producer helper 与 TypeScript ownership 绑定到实际动作来源。任务保留原始 `Origin` 与敌方本地队列时钟，不转换为全局固定延迟。Mavuika Q 不纳入有限动作规则：初始斩击无法与 Q 模式、C6 及换人触发分支中的其它伤害生产者可靠隔离，其攻击所有权仍未闭合。

## 来源与对照

124 的冻结来源以 classic `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 与 Stellar `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd` 为基线。变更前对照使用上一批 123 已构建的 Classic WASM；实际执行了六个选定调用，观察至 653 帧、15 个伤害应用。前置对照见[baseline 原生结果](validation/source-conditional-enemy-20260930.baseline.result.json)。它是 123 产物基线，不是 PRE123 源码，也不构成游戏机制验证。

[共享私有状态审计](validation/source-private-state-next-step-20260930.json)记录的是前序捕获与下一步建议，不是 124 的实现成果。Barbara 与 Lisa 的私有字段包含计数器、stat 向量、绝对帧期限和任务代际 token 等不同语义；不能把所有数字字段按普通时钟处理。`skillInitF` 用来识别旧技能实例任务，必须与任务捕获的代际身份共同解释。

## 实际验证

Classic 与 Stellar 来源构建、talent registry、typecheck 和 Web build 均通过。构建时间分别为 7.152 秒、7.400 秒；registry 0.115 秒；Web build 最终 1.216 秒；typecheck 最终 2.853 秒。浏览器首次 post-change 检查因 Stellar 把普通 Burst tag 编码为 `AttackTag(6)`，而新增分析器只识别命名的 `AttackTagElementalBurst`，未匹配到有效 Nilou 攻击。共享 TypeScript helper 加入该 lane 使用的字面别名后，复用已保存的两 lane 捕获完成最终浏览器检查，3.334 秒；没有重复原生运行。浏览器页面错误为空。

全部原生执行共 3 次：一次 123 WASM 的 Classic 变更前对照，以及本批 Classic、Stellar 各一次。两 lane 变更后场景均观察至 653 帧、15 个应用、6 个完整调用；每 lane 选定 12 个应用，合计 24 次逐击共享公式重放，差值全部为零。Classic 15 个应用的来源、伤害、帧、目标、HP 与暴击投影均与 baseline 一致。

Nilou Q 在每 lane 创建 3 个根攻击、4 个命中，应用小计 7209.930777468864。两个已闭合敌方本地任务的队列时钟均由 392 到期于 513；对应全局帧为 396 至 517，任务完成时均为 517。Classic 计算器展示零根结果且 JSON 导出／导入往返通过；本例没有可编辑的伤害项，未测试修改命中。Stellar 未做此 UI 往返。

本次类型标签 helper 覆盖 7 个共享字面别名、涉及 9 个文件和 13 处比较；它仅匹配显式登记的 0–6 别名，其它完整性规则没有因此获得重测。登记共 27 个 direct rows、72 个 producer rows、99 条原始 registry rows；合并后为 98 个完整性规则 ID、96 个角色动作、72 个计划及 100 处计划内 site 声明（93 个唯一 site ID）。这些静态计数不等于运行覆盖。详见[最终测量](validation/source-conditional-enemy-measurements-20260930.json)与[最终结果](validation/source-conditional-enemy-20260930.result.json)。

## 证据边界与未完成范围

本批运行覆盖 Chasca E、Xilonen E、Qiqi Q、Nilou Q 的指定分支；Jean E、Lanyan Q、Varka Q、Aloy E 本批只有源码与构建证据。Qiqi Stellar Conduct 正分支、Chasca 待释放 AimState 分支和 Nilou 目标死亡后的 pending task 均未运行。Sara E 与 Mavuika Q 的上述所有权缺口仍未解决。

本批的来源完整性规则、构建、执行和共享公式重放不等于游戏内或独立外部机制验证。数据指针与 123 批保持一致，`activeVerified` 仍为空；没有运行新的数据发现流程或晋升目录。远端 CI／更新证据、完整角色动作与资源归属、跨角色 phase 收敛以及官方版本映射仍是主目标的未完成部分；后续 source-private-state 补丁尚未合并，不计入本批交付。独立单技能计算器保持现有产品入口；完整主目标仍为 active。
