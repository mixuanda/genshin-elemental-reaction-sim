# 固定来源角色修正量与起步窗口差异

本轮记录两项增量：把可静态绑定的角色 Amount 修正向量接入共享公式，以及在起步敏感度页展示同一场景的第二统计窗减第一统计窗。它们复用固定第三方 b4/a7 实现及当前观测流程，不构成正式服机制验证；游戏 verified 分母仍为 0。

## 角色修正量的范围

最终静态范围为 101 个独立 rule ID：b4 接入 94 个固定向量回调、99 个槽；a7 接入 95 个回调、100 个槽；两版共用 98 个 ID，b4 独有 Qiqi C2，a7 独有 Ifa A4 与 C4。对应原始回调名册分别有 302 与 326 个向量回调，仍有 208 与 231 个 opaque 回调未展开。Dendro Traveler C6 因完整词法作用域检查发现条件写入而被排除。纳入项经过源码静态审计，确认向量只有字面量赋值且无其他写入或别名逃逸；接入在原生 `return m` 处整体替换完整固定向量，不做逐槽 fallback。

条件、到期、目标、命座门槛以及 nil 返回仍由 Go 原生执行。上述描述的是固定源码接入范围，不等于覆盖这些角色的全部机制或全角色验证。

## 起步观察窗口

`source-host-startup-panel.ts` 新增每个起步场景的窗间漂移表，直接按同一运行中的种子配对计算第二窗减第一窗，并显示 DPS 等窗口统计的配对差分布及均值区间。预热后仍沿用同一条连续轨迹，不重置能量、冷却、角色状态或随机流；半开统计窗口和现有样本门槛照旧。表格明确提示：有限样本的窗间差异不能单独证明稳态；同 seed 也不表示随机事件逐项对应。本轮页面验收重用了既有 startup 的 6 条保存运行记录（zero/full/custom 三场景、各两个 seed），未为该重分析创建新 Worker。

## 六把武器的来源边界

当前 HEAD 审计文件 [`audit.json`](../packages/game-data/sources/weapon-latest-audit-20260928/audit.json) 对 New Bough（11437）、Silver Light（11438）、Beyond the Chrysalis（11522）、Winter’s Heavy Heart（14437）、Hymn of the Maelstrom（14524）及 Breezeborne Refrain（15437）做了只读核查：在审计所列 genshin-optimizer 与 gcsim 两个上游项目仓库提交的完整树，以及 gcsim 生成武器注册表中均未找到相应 ID 或 slug。该检查仅覆盖两个仓库的指定 HEAD，不证明其他来源均无实现；没有复制或晋升新武器公式。目录/本地化数据不能替代来源机制证据。

## 本轮验收记录

classic 与 stellar Go 构建首轮通过，分别 5.739 秒、6.184 秒。Web 构建首轮因新 E2E 结果类型窄化错误失败（2.705 秒），修正后通过（3.798 秒，706 modules，Vite 859 毫秒）。页面聚合首轮在导入旧 JSON 后比较 DPS 时因浮点值使用精确相等断言失败（相差约 1e-13）；该轮在失败处停止，尚未启动本批原生运行。仅将该断言改为 9 位小数精度比较后 retry 1 通过（墙钟 5.338 秒，测试 4.0 秒，runner 4.9 秒，`pageErrors[]`），此轮才执行后文记录的两条原生运行。本轮没有新增单位测试。

页面验证含 classic 与 stellar 各一条 10 秒原生运行；每条 42 个 calculations、11 个 outgoing applications、11 次角色修正调用。实际观察到两个 rule ID：行秋 A4 水伤加成 0.2（6 次）与阿贝多 A4 元素精通 +125（5 次）。选中行秋命中由 actor 1 消费 holder 1 的自身加成和 holder 0 的队友加成；原始伤害为 1747.1465264554156，两 lane 捕获回放差值均为 0。Classic 页面导出的独立 JSON 导入恢复通过。

本轮没有测完整 101 条规则、preview、任意 checkpoint 或从头完整重执行；startup 仅重分析旧记录。六武器结论仍是对 audit.json 所列两个仓库指定 HEAD 的有限只读审计。固定来源仍为 provisional，未提升游戏 verified；不据本轮小样本宣称全角色或全部角色修正已覆盖。未提交、推送或部署。

原始证据索引见[构建、执行与范围测量](validation/source-character-modifiers-measurements-20260928.json)和[页面聚合结果](validation/source-character-modifiers-20260928.result.json)。classic WASM 为 `efbf66f6bbc013ffcd025886c5562e57cab91e3a03c05cf8667631b28bd4e05e`（42,218,293 bytes）；stellar 为 `01045287162a4bc67471eac89671c8ea20553547d6283b0b508021f46f298866`（63,290,061 bytes），实际原生回执与构建 manifest 对应。已执行 tracked `git diff --check` 通过；它不覆盖未跟踪文件。全量目标保持 active。
