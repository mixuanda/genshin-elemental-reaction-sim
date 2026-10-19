# 固定来源天赋索引生成过程回执（2026-09-29）

本批继续细化 096 的倍率表来源：把“原生实际查到了哪个天赋表下标”向前拆解为当前已捕获的天赋索引来源步骤。两个固定来源 overlay 新增 `sourcehost_talent.go` 的 `indexSources` 记录，包含下标位置、来源种类、基础天赋等级、命座等级／解锁状态、可选 passive tag 值及最终值；新增 `character/sourcehost_talent_level.go` wrapper，只调用原天赋等级 getter 一次，再读取记录这些来源所需的纯字段。Burst 索引不读取 passive，相关字段保持省略。

构建时的 AST 改写将角色源码中直接调用 `TalentLvl*` 的候选位置转到 wrapper；site ID、index expression 和 registry table bytes 保持不变，从而延续 096 capture 的表与读取位置身份。当前静态清单为 classic 507 sites（attack 277、skill 142、burst 88），stellar 535 sites（attack 286、skill 155、burst 94）；这是索引表达式来源类型清单，不代表新增加了天赋表读取点，也不等于角色机制覆盖或每个 site 都有运行样本。096 的 instrumented 总数仍分别为514／543。

共享侧将每个已记录来源构成同一个 `TraceBuilder` 中的逐步索引 AST：`baseTalent`、`passiveBonus`（仅 attack／skill）、`constellationBonus`、`offset`、`cappedOffset`，最终形成 `nativeIndex` 并作为 096 查表节点的索引输入。消费者按来源读取记录与当前下标验证后才连接这些步骤。既有公式 renderer 显示新增 AST；本批复用现有 UI 渲染，不另建页面组件。未捕获的动态索引生成过程保留 gap；passive tag 的激活门及其持续生命周期也不因捕获 tag 值而自动解释。Burst 不生成 passive 步骤。

共享代码新增 `packages/sim-core/src/source-host-talent-index.ts`，在 `source-host-talent-table.ts` 连接索引与查表节点；`generate-talent-registry.mjs` 将构建清单中的 `talentLevelIndices` 写入固定 registry。实际验证文件为 `source-host-talent-index.test.ts` 和 `apps/web/e2e/source-talent-index.spec.ts`。

本批只解释固定来源执行时已经采用的天赋索引及其已捕获的来源分解，不改反应／伤害公式、攻击倍率表值或原生触发。新增共享步骤不替代原生 getter，不用计算出的默认值覆盖未捕获状态，也不从最终面板或伤害反推索引来源。尚未明确的字段、动态状态、命座／passive触发和生命周期继续作为逐项来源边界。

验收结果：`source-host-talent-index.test.ts` 两项核心测试通过（墙钟0.599秒，Vitest runner120毫秒、测试10毫秒）；classic／stellar固定来源构建分别10.098秒（44,316,502 bytes，SHA-256 `63a00b02f6a5fd6af45189718e05f27c74e66a8758d4fe7c8e1ed9dcc66d2acc`）和7.128秒（67,147,434 bytes，SHA-256 `b2aa5a14fc3d7b6768af1e667d4982c1fdb4bc0d11404c7ab220d53b0501db0c`）；registry生成0.150秒；Web build4.260秒（Vite945毫秒）。唯一双lane浏览器案例通过（case11.1秒、runner12.2秒、墙钟12.673秒，`pageErrors=[]`）。两lane各102 calculations／38 applications，与096仅剥除新增 `indexSources` 字段后的结果完全相同；各采到14个回执命中、2张表、2个site，静态source表值、site身份与原index expression保持不变。

浏览器选中行秋 C0 Q 命中：天赋等级1、命座0、解锁阈值3，没有 `passiveTagValue`；来源索引为 `1 + (-1) = 0`，表下标0读取倍率0.54272，两个lane重放差0。倍率编辑为0.64272后伤害差54.735166868903946，UI及JSON往返成功，旧读取回执保留为历史记录。此一运行只观察到burst与skill各一个site；C3与passive正值只由合成核心测试覆盖，不是本次原生浏览器运行结论。

静态wrapper清单 classic 507（attack277／skill142／burst88），stellar535（attack286／skill155／burst94）；总instrumented sites、tables、skipped清单与096相同。静态清单和角色目录数不是runtime覆盖率。source坐标按patched pre-instrumentation代码定义；未来改动读取点时须保留旧registry，以便继续解析旧capture。下一步仍需处理索引生成中未捕获的动态状态、passive tag 激活门与生命周期、后续 `AttackInfo.Mult` 写入、`range` 循环中的局部表行，以及完整技能和实体执行语义。完整命令、结果、哈希及原始捕获记录见 `docs/validation/talent-index-measurements-20260929.json`。本批没有游戏数据或coverage晋升，`verification="provisional"`、`explanationStatus="partial"`、数据指针和 `completeCast` 均保持不变。
