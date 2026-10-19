# 固定来源天赋表 range 行读取回执（2026-09-29）

本批扩展 097 天赋索引 AST，解释由生成表 range 取得局部 row 后的倍率读取。受支持模式限于可静态证明的 `generatedTable[outerIndices...]` range 与局部行标量读取，包括 `AttackInfo.Mult` 字面量，以及分析器能证明来自 `AttackInfo` copy 的简单赋值（例如 `ax := ai; ax.Mult = mult[TalentLvlAttack()]`）。遇到无法证明别名、写入来源或索引语义的更复杂代码，继续保留来源缺口。

instrumenter 在原读取位置只求值一次 range 外层索引，并记录真实外层 indices 与实际 range 迭代下标；随后仍从原生局部 row 读取 scalar，不重新求值已可能变化的动作状态（例如 `c.NormalCounter`）。固定读取位置新增 `rangeSource={expression,rowVariable,indexVariable,indexPosition,path,line}`；运行记录另有可选 `rangeFrame`，表示 range slice 求值完成时的帧。既有 scalar receipt 的 `frame` 继续表示行内标量读取时点，两者区分而不互相替代。

frame helper 从调用点取得 `&c.Core.F` 并在函数体内解引用，以保存 range 表达式求值完成帧。依据 Go [Order of evaluation](https://go.dev/ref/spec#Order_of_evaluation)，函数调用在进入被调函数前先求值参数；此处只依赖传入帧指针在 helper 开始执行前已求值，不把此结论泛化为任意函数实参都具有某种整体求值顺序。

共享侧在同一个 `TraceBuilder` 中生成 `rangeIndex` 节点与完整 tuple lookup，再接回 097 的等级／命座／被动索引 AST，并复用现有公式 renderer。编辑值仍与历史 lookup 分开。不能从捕获数据解释的动作状态如何生成索引、复杂 alias/write 流程及其他未证明的range模式继续保留 gaps；已有已读表值与range帧不能单独证明整个技能或实体执行完整。

实际代码改动位于 `packages/source-host/scripts/instrument-talent-reads.go`、两套 Go overlay 的 `sourcehost_talent.go`／`talent_read.go`、共享 `source-host-talent-table.ts`、registry生成脚本及生成文件。新增的 `apps/web/e2e/source-talent-range.spec.ts` 负责本批页面验收；界面复用既有轨迹 renderer，未再实现一套公式。

验收结果：classic／stellar来源构建分别通过（6.150秒，44,550,197 bytes，SHA-256 `360f7bf0aa47426f2d0971ae698c516c528b7e04b1fd3d69a09984723f7232e5`；6.776秒，67,394,215 bytes，SHA-256 `1355449e73380a071ee8efa27d2fd5c49e3efd2a7eb101c687bc97717cf1db2b`）；registry生成0.150秒；Web build 4.451秒（Vite945毫秒）。唯一双lane浏览器案例通过（case11.3秒、runner12.4秒、墙钟12.863秒，`pageErrors=[]`）。本批没有新增或运行 unit tests，也没有跑完整矩阵。

静态清单 classic 新增74个range site（44个来自先前跳过的literal候选，30个来自已证明的Mult赋值）；stellar新增77个（47+30）。这些新增读取点分别分布在54／57个角色目录中；不是新增了54／57个角色支持。总清单为588／620 sites、571／600 tables；096/097已有514／543 sites和498／524 tables均逐对象保留。skipped 总数变为188／204，但新候选数分别为8／9；分母扩大且旧候选中有转为已识别项，不能把 skipped 总数直接当迁移完成率。新增range中，可支持的层级式包含 `attack[c.NormalCounter]`（43／46处）；其余表达式分布及候选理由详见唯一汇总。

两lane各102 calculations／38 applications，与097保持完全一致，原有14条 talentRead逐字段未变；每lane新增4条 rangeRead。实际捕获的三维tuple及表值为 `[0,0,0] → 0.46612`、`[1,0,0] → 0.47644`、`[2,0,0] → 0.28552`、`[2,1,0] → 0.28552`。所选行秋命中计算34／应用35／frame183，rangeFrame与coefficient frame均为173；classic读取点为 `attack.go:60:13`（range行57），stellar为 `attack.go:59:13`（range行56）。`[0,0,0]`的重放差0；倍率编辑0.46612→0.56612后伤害差45.61263905742001，UI／JSON恢复通过。由于本案例未遇到两帧不同的延迟callback，该差异仅由源代码检查与编译覆盖，不能称作运行时样本。

总清单、旧候选迁移与新增候选、捕获数据和全部构建身份见 `docs/validation/talent-range-measurements-20260929.json`。Go求值规则的范围仍仅限于调用参数在进入helper前求值；来源行列坐标来自补丁后、自动改写前的代码，不是上游原始行号；之后若改变读取点，仍须保留旧registry以解析旧capture。动态counter生成、复杂alias／nested range、later Mult、其余未解析的表行别名及完整技能／实体语义仍待处理。本批没有游戏数据、coverage、verified、`completeCast` 或数据指针提升；整体 goal 保持 active。
