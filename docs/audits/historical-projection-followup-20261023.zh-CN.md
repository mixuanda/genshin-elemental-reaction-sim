# /goal V153 → V152：固定历史 wire 与当前语义分开验收

基线 `fc733b32ce393b03422099efdcbb7718baacc2dd`。本次只处理 `packages/test-vectors/src/project-v153-to-v152.test.ts`，不修改 projector、schema、模拟器、Golden 或历史用户结果。结论是：**原用例强制把当前 canonical 结果投到不能表示该语义的冻结 V152，属于过时成功期待；此有限组未证明历史读取或投影实现错误。**

## 原失败与真实语义

未修改原断言先选一个空场景，实际 **0 pass / 1 fail / 11 未选**。失败准确为 V152 严格拒绝两处 `flatStatBuffSemantics`：root 的 `resolvedRuntimeOptions` 以及 `runManifest.resolvedRuntimeOptions`，不是伤害断言失败。

当前 `simulator.ts:2060` 对 `legal-frame-v1` 明确写入 `canonical-v1`；`:5889` 按该语义把 buff 的 `atkFlat/hpFlat/defFlat` 放到真正参与计算的 `flatAtk/flatHp/flatDef`。冻结旧 runtime-options wire 没有该字段。即使某个空场景的金额暂时不变，也不能删除标记、改签身份后称作普遍无损。

本次同配置短例独立说明区别：1000 ATK，实际 `atkFlat=100`，倍率1、防御0.5、抗性0.9、无暴击。固定旧实现取样1000，原值 `1000×.5×.9=450`；当前 canonical 取样1100，实际 `(1000+100)×.5×.9=495`。测试同时断言新旧配置完全相同、两次实际取样及金额，不把当前495改成旧450，也不把旧原件重算成495。

## 保留原保护的方法

固定原件来自本仓 `84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5`。现有独立归档中 **305 个 package 文件**均逐个匹配该提交 Git blob；schemas、sim-core、icd-profiles、reaction-formulas、test-vectors 全解析到归档自身，仅复用外部依赖。

原投影测试在原来源真实 **12/12**。只在内存为四个既有成功投影站点增加观察，不改原断言或磁盘源码，取得四类 source／projected wire；另选单独新增的四秒旧实现 flat-ATK 例，**1 pass / 12 未选**。原归档文件事后仍逐个匹配。它们是固定实现的合成边界样例，**不是游戏实测或真实用户文件**。

[新固定 fixture](../../packages/test-vectors/src/fixtures/historical-projection-v153-v152-84ff5cd.json) 保存五对原始 JavaScript `JSON.stringify` wireText、各自 SHA256、原源码 Git blob 与提交身份，没有让数字跨语言重新格式化。整体 **211588 字节**，SHA256 `7866e0fca5f6d4904473b44792c2b598fdf8a0e9d1e0f729608a467f4494cfb6`。fixture 没有更新入口，也未覆盖既有 Golden。

原12个测试名及全部 **51 条原 expect 完整表达式**保留。成功投影的原断言改读真正的旧 V153 wire，并核对返回 V152 的完整字节与原投影完全相等：包含版本、配置 hash、重现身份、450原数值、事件数组及嵌套 key 顺序。旧 source 原字节不变。原有 callback-subscriber、V2、活跃 V3、伪造日志、配置/root 不符及伪造 trust-root 的六个负例继续使用当前结果，不因新增 canonical 拒绝掩盖其原保护。

新增八项分别为：五对固定 wire 的来源／字节／数值／身份；四类实际当前 canonical 结果必须拒绝且不修改输入；450/495语义对照；冻结 V152 在 root／manifest 两个位置都继续拒绝注入标记。没有放宽数值容差或旧 parser。

## 实际检查与范围

所选文件最终 **20/20，无跳过**，定向 TypeScript 检查退出0。旧整套记录中本文件为6 pass／6 fail；本次原12身份全部通过，新增8项通过，移除0项。该局部差集**不能改报整套3134／3196等历史结果，也不表示旧45项全部解决**。

关键固定来源：原测试 Git blob `364abf8a266f8af5264c905232ff8ef4c71010df`、SHA256 `9fbc48d96c03362914f7d56099e87c1681eadd4f14635135afebb3f879a4bf48`；projector Git blob `912eef9773726f4ea5f9dd2ae5508242fbde33c6`、SHA256 `e266a7152ebc6e4fabf3f788a7f95bc6077614f4ae9a0c1198d87958afbe3f28`，projector 保持原样。

精确测试身份差集、source hash、命令及日志身份见 [机器证据](historical-projection-followup-20261023.json)。完整本地记录在 `/tmp/GIDPS-historical-projection-evidence-20261023/`：`before.json`、`historical-original.json`、`historical-flat.json`、`after.json`、`typecheck.log`、`archive-source-identity.json`、`assertion-preservation.json`。断言保留检查是平衡词法表达式比对，不冒称 AST 或运行覆盖证明。

最长输入轴10秒，未跑120秒 Golden、全回归或原生 WASM；未新增迁移路线。旧文件仍按原件只读／原样导出、输入另建新副本的既定策略处理。本次没有 push、部署、凭据或许可操作。
