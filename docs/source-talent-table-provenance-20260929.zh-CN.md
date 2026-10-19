# 固定来源天赋倍率表读取回执（2026-09-29）

本批目标是把原生攻击倍率字段与它实际读取的固定天赋表位置相连。限定处理的是 AST 能识别的局部 `AttackInfo` 字面量，以及一至三维、纯生成表的读取；不从结果数值反猜表，也不试图替代原生战斗执行。自动化在原始索引表达式处只执行一次查表，将 table/site 身份、实际索引、结果值、角色与读取帧写入本次攻击的来源回执。构建产物同时提供按 pinned source commit 区分的静态 table registry，以及 instrumented/skipped 来源清单和内容哈希，供后续审阅具体边界。

主要代码改动位于 `packages/source-host/scripts/instrument-talent-reads.go`、两套 `096-talent-table-read.patch` 与 Go bridge；构建脚本和 `generate-talent-registry.mjs` 生成并记录固定表。共享核心新增 `source-host-talent-table.ts` 与生成的 registry，并扩展 `calculation-trace.ts` 的可执行 lookup；`calculator-trace-view.ts` 展示实际索引、选中值与可折叠的末层表行。命中复制到独立计算器后仍使用同一核心。

原生回执放在 `AttackInfo` 上，来源专用字段不进入游戏属性语义；私有状态阶段明确忽略此追踪字段。若某个候选 `AttackInfo` 字面量对应的局部变量后续还有 `AttackInfo.Mult` 写入，自动读取器只跳过该候选 literal，不因此跳过同一函数里的其他候选。回执保存的是读取点的原始倍率；后续写入仍须另有对应来源公式，不能把早期表读值错误声称为最终字段的唯一来源。

共享核心通过可选 `talentTableRead` 接收回执，并依 `sourceCommit` 查找随构建打包的静态表与 site 元数据。计算器使用本地表和回执中的实际索引重新执行查表；它不接受导入回执提供的替代表格。解析器还核对 site 与 table 的对应关系、索引维度、actor、读取帧不晚于当前攻击，并要求重算结果与原生读值完全一致。只有当这次读值也等于当前攻击最终 `scaling` 时，倍率输入才链接到查表节点。动态索引的实际索引值也会捕获并用于复算；未展开的是该索引由天赋、命座或动作状态产生的算式。读值相同但后续存在原生修改时仍显示剩余缺口。编辑倍率时保留旧读取作为历史记录，不把当前编辑值归因给旧来源。

此能力聚焦补齐普通伤害公式里的天赋倍率来源，并复用现有 `sourceTalentBase` AST；不改变原生触发、攻击队列、伤害计算或 capture 的最终值。它与既有角色 `AttackInfo.Mult` 生产公式互补：后者说明原生对倍率字段做的状态算术，本批补充固定等级系数表在某个实际位置的查值证据。天赋表之外的 `BaseDmgBonus`、Elevation、非默认 group multiplier、忽防等上游输入仍按实际缺失情况留作缺口；若存在后续 `Mult` 改写，也不能仅因某次表读回执而闭合最终字段来源。

验证结果：`formula-lookup.test.ts` 单文件2/2通过（Vitest墙钟0.597秒，runner87毫秒，测试2毫秒）；classic 与 stellar 来源构建首次通过，分别9.594秒／44,286,894 bytes／SHA-256 `3793ad70a79fddaf44fcf2249d58c90d855bacb6882258b4cc7b87b924d813ef`，以及9.983秒／66,483,675 bytes／SHA-256 `c247280ab1c46b16251705273d9bf6883e1f17f25a296f8304d83e0e324d814a`。离线 registry 命令在0.148秒内校验manifest哈希并生成固定表 lookup 文件。静态清单为：classic 514 sites／498 tables／224 skipped，表读取维数1/2/3分别441/70/3，涉及103个角色目录；stellar 543 sites／524 tables／242 skipped，维数分别468/73/2，涉及108个角色目录。角色目录数量不是角色机制覆盖率，instrumented/skipped 也不是伤害公式或角色完成数量。

Web 首个 typecheck/build 在2.919秒失败：`source-host-formula.ts` 局部 `prefixTrace` 遮蔽同名既有函数，导致调用点被视为数组变量；重命名为 `prefixNodes` 后，重建4.031秒通过（Vite927毫秒）。单个双lane浏览器案例首次通过（case10.0秒、runner11.2秒、墙钟11.721秒，`pageErrors=[]`）。每lane实际捕获14个回执命中、2张表、2个site；两lane运行各102次计算／38次应用，与095基线完全一致。选中行秋Q命中计算37／应用39／frame200，读取 `burst[0]=0.54272`，两lane重放差0；将倍率编辑为0.64272后伤害差54.735166868903946，UI、JSON往返一致并保留旧回执。该运行只采到2个site/lane，不等同全部静态site的runtime验证。

Registry 与 site 坐标来自补丁后的源码、注入前的行列坐标，不是上游原始文件坐标。若之后修改读取点，需保留既有 registry 版本，以继续解析旧 capture 的 site 身份；当前测量没有证明对任意未来artifact的兼容。构建顺序及限制见 `packages/source-host/scripts/README.md`。原始命令、双lane快照、manifest哈希及静态清单见 `docs/validation/talent-table-measurements-20260929.json` 与同目录 `talent-table-*` 回执。本批没有更新数据、verified状态或 coverage 分类，`verification="provisional"`、`explanationStatus="partial"`、`completeCast` 及全量goal状态均不变。
