# 固定来源天赋倍率算术表达式回执（2026-09-29）

本批扩展 096–098 的固定来源天赋倍率读取：在已有表读取叶、实际天赋索引和 range 行来源之上，解释由这些叶、真实数字常量或可解析的同包常量组成的 `AttackInfo.Mult` 算术表达式。共享 `FormulaExpression` 保留原始二元运算树与括号，不把表达式展平或改写成另一种运算顺序。它不是任意 Go 公式转换器；动态字段、未解析 helper 和不能固定解析的表达式仍跳过并保留来源缺口。

原生记录新增 `talentExpressionRead={schemaVersion,siteId,reads,value,actorIndex,frame}`。固定 registry 的 `expressionSites` 保存原表达式、term site IDs 与源码路径/行/列；运行回执提供实际叶读值与最终值，但不携带可由 capture 指定的替代表格或任意公式。Go 只在叶位置包装并求值原叶一次，原生运算与分组仍照既有源码执行；frame 通过指针在 helper 中读取。每个 table leaf 继续复用 096 查表回执、097 索引来源或 098 range row 来源，同包常量由固定源码 registry 解析。比如 Chiori 的 `kinuDmgRatio` 是同包常量 `1.7`，不是动态字段。

共享侧在同一个 `TraceBuilder` 重建并复算每个叶与完整表达式；只有 site、叶和最终值均与回执一致，且结果等于本次 `scaling` 时，才把倍率节点连接到伤害公式。编辑倍率时原始表达式仍仅作为历史依据，不连接到编辑后的输入。未知动态值、helper语义和后续 `AttackInfo.Mult` 写入仍须保留 gap；这些来源路径不能由表达式回执自动闭合。

099前置基线使用 C0 Wanderer E→charge→attack:2 脚本（case3.8秒／runner5.0秒／墙钟5.458秒）；它只作为原生前后对照，不是099实现的验收。最终每lane保留旧588／620 sites与571／600 tables，并新增10个表达式site、12个table leaves、覆盖9个角色目录及每lane5张新表；新总数为600／632 sites、576／605 tables。Chasca只识别默认最终倍率赋值，initializer与早期分支仍跳过。静态计数不代表其他表达式分支都实际执行。

最终检查：classic首次构建6.948秒，随后代码审查发现leaf `actorIndex`未复制，修复后final构建5.420秒；stellar构建8.217秒；registry生成0.126秒。Web首轮3.340秒在测试代码的possibly-undefined类型检查失败，修正后4.440秒通过。浏览器首轮3.966秒因无反应的原生结果合法返回 `reaction_status=null`、测试比较未处理该值而失败；比较逻辑修正后同一案例通过（case14.3秒／runner15.3秒／墙钟15.653秒，`pageErrors=[]`）。本批没有新增unit test或角色矩阵。

最终页面每lane捕获3次expression reads、覆盖2个site；Wanderer场景共6 calculations／4 applications。选中命中计算5／应用6／frame96，原始表达式为 `1.329825 × 0.68714 = 0.9137759504999999`，两lane重放差0；编辑倍率后的伤害差39.692420126999934，UI及JSON往返通过且旧receipt保留。一个direct-leaves与一个range-leaf site均出现在该运行中；不能把site数量当作全表路径运行覆盖。详细测量、失败与修复记录、构建/capture/registry hashes见 `docs/validation/talent-expression-measurements-20260929.json` 与 `docs/validation/talent-expression-browser-20260929.result.json`。

本批不改变游戏数据或外部来源证据；没有 coverage、verified、数据指针或 `completeCast` 晋升，整体goal仍未完成。后续仍需处理动态字段与未知helper、其他尚未解析的局部表别名／动态表达式、后续 Mult 写入、Chasca未支持分支、完整技能生命周期和来源外部证据；不能从静态sites计数推出全量支持。
