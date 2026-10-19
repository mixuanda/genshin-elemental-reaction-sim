# 历史预览选择、比较与URL恢复

当前预览工作区可以从所有已保存且通过结构校验的preview快照中选择并比较。预览选择仅更换隔离工作区，不改变正式目录、verified目录或运行时活动指针。加载采用惰性分支；比较以已校验快照的原始catalog与supplemental实体内容为输入，按stable ID匹配对象、按数值数组索引比较，来源与生成元数据单列；页面最多列出前200项，同时提供包括全部差异的JSON导出。

计算器选择器为 `#calc-preview-snapshot`；URL通过独立的 `snapshot=ID` 参数深链。已知preview快照可在页面间切换并由URL精确恢复。代码遇到未知snapshot URL时会载入失败，并避免显示默认教学伤害；本轮未对未知URL运行页面测试。页面E2E通过旧快照深链、切换到新快照、切回旧快照及reload恢复检查。本轮也没有测试JSON导入后自动选择历史preview的行为。

## 实际历史对比

页面比较了 `7.1.50` 旧局部预览 `snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc` 与 `7.1.50.2` 新局部预览 `snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217`。共529个字段差异：新增297、移除47、更改185；其中43项为数值变化，含浮点表示差异，不能直接当成平衡改动。UI展示前200项，完整529项均保存在[比较JSON](validation/preview-history-comparison-20260928.result.json)。页面确认旧snapshot URL恢复精确、preview不显示伤害数值，并显示124个released角色加1个占位选项；本次pageErrors为空。

选择和比较前后，`manifests/runtime/current.ts` SHA-256保持 `414badb3c7f2e145c039b61048507df6ae2160ce15fb377784a2a6c58f8de045`，`manifests/pointers.json`保持 `bcff67a4c25f405aac867e8924d3375dfa5405c2f08e5343c1f89977c7bc67e7`。活动released snapshot仍为 `snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34`，active verified仍为空。

验证摘要及所有初始失败见[测量收据](validation/preview-history-measurements-20260928.json)。核心首轮1过1失，失败揭示typed catalog比较遗漏 `sourceCombatMetadata`，修复raw比较后2项通过。隔离pipeline测试在临时合成store上通过1项、跳过8项，不修改真实目录。Web先后修复缺少类型导出与ability ID仍为unknown两处类型错误后通过；单页面E2E通过，墙钟3.639秒、用例2.4秒、runner3.1秒。tracked `git diff --check`通过0.068秒。

## 仍未确认

两个快照都只是各含2角色的局部preview；新候选有2个天赋集、13项能力、2命座集，当前采集到的武器／圣遗物套装条目均为0，可执行定义为0，数值与机制证据缺失。这只说明该候选未采到装备记录，不表示整个游戏版本没有装备。尚未证明它们对应7.2 V1，provider许可未知。比较功能只描述所存快照差异，不验证其数值或机制正确性；完整角色名册、游戏验证与全量目标仍未完成。
