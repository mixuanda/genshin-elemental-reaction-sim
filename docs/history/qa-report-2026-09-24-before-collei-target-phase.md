# QA 与实测报告

更新：2026-09-24。本轮补齐四个完整条件技能、六把武器的来源条款，并把确定性检查点推进到有限普通附着域。独立单击／单技能计算器仍是主导航功能，不依赖队伍或轮转。完整主提示 goal 继续进行；没有提交、推送或部署。

## 实际产品改动

新增多莉C0 E初弹＋两枚售后弹、白术C0 E三击、妮露C0 Q初击＋永世流沔、甘雨C0 E释放＋冰莲爆炸。新六个参数映射展开为10击，替换六个旧partial映射，原单击可在完整动作中选择，不把重复菜单计作覆盖。每击仍分别进入共享核心，反应按实际单击条件输入。

白术三击复用E起手快照；突破1后以起手在场角色HP比例是否≥0.5决定25%草伤。未知比例留空并阻塞依赖该条件的结果，突破0不需要该输入。共享上下文只存一次起手条件；核心执行及最终面板转换均重新准备三段公式，直接修改JSON复制出的某段公式不能绕过共同快照。界面提供真实条件、已含份额和逐步AST，来源面板／最终面板／JSON不重复加入A1。

六武器为弥坚骨、聊聊棒、试作星镰、群王局戏、寸心余响、金律铸影。新增30个合法精炼的普通属性或逐击条款，沿用原生来源配装控件和共享AST。未知命中特有条件只阻塞匹配命中；未知面板属性仍需明确。弥坚骨加算不是ATK面板，试作星镰是普攻／重击增伤，金律主／复调独立输入。触发、时间和消耗仍为显式条件，没有把星烁效果代入普通伤害。十把无被动武器原本就可配装，没有伪算成十个新增被动。

普通附着检查点读取真实原始gauge、decayPerFrame、来源槽、物化帧、应用ICD、直接伤害组窗口，以及自然消退实际依赖的观察状态。只读捕获不推进引擎，也不拿舍入过的公有Aura快照代替原态。完整未来输入域包括全部能力、初始附着、默认元素和休眠附魔；不能因为当前反应实体为空就假定未来不会产生。

当前解除的范围为legacy目标任务调度下的确定性普通单元素／水火／冰火域。保持配置原Aura版本；原生aura-v7合成循环已建立period1。v8/v9要求target-phase-v2，其原始阶段状态还未完整导出，仍阻塞；其他反应生命周期、特殊注入、随机流等也不在本层完成范围。

主要文件包括角色 `complete-followup-skill-mappings.ts`、共享 `baizhu-formulas.ts`、计算器上下文与 `calculator-baizhu-controls.ts`；装备 `weapon-conditioned-expansion.ts` 及既有build/formula接线；模拟 `ordinary-aura-checkpoint.ts`、Aura/ICD/伤害组/观察记录器捕获与 `phase-checkpoint.ts`、`simulator.ts`。具体来源和边界见[技能审计](cross-validation/complete-followup-skills-source-audit.md)、[武器专项](validation/weapon-conditioned-expansion.md)、[附着检查点专项](validation/ordinary-aura-phase-checkpoint-core.md)。

## 来源与生成覆盖

四技能保留26个gcsim原始文件、9个Optimizer固定文件及哈希／固定tree匹配。六组T1–15共90个系数位置在两份生产源码和活动目录三方逐项相同，最大绝对差0。六武器保存15份来源字节／哈希及完整五档目录，核心测试核对30精炼实例。静态来源一致性不是游戏内实测或外部整队运行。

弥坚骨gcsim系数及试作星镰gcsim属性／标签与目录、Optimizer冲突，采用后两者一致的普通数值规则并保留原冲突。聊聊棒元素窗口12／15秒、金律复调10／12秒的来源时长冲突没有解决；仅输入实际有效状态，不自动推演争议边界。熔猎、星锋及其余来源不足武器继续局部阻塞。

实际生成的 `.16` 为 **120身份／920击／545完整条件动作／140部分／18具体阻塞**，相比`.15`净增4击、4完整动作并移除6部分动作。装备为 **200武器／988合法精炼／53二件／44四件**。这些包括部分机制，不等于完整角色、完整武器或verified定义。

活动目录仍是 `gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2`，released/provisional，verified为空，preview数0。元数据仍124身份／127天赋集／789技能／255武器／63套装／127命座集。data:status本轮重新生成的是本地事实，不是新的在线发布观察；官方观察仍为2026-09-23 14:22香港时间。

## 实际执行的必要检查

| 命令／范围 | 实际结果 | 证据 |
| --- | --- | --- |
| `npx vitest run packages/game-data/src/character-mappings/complete-followup-skill-mappings.test.ts` | 首次3/3通过，1.24s／测试75ms，exit0；reset helper契约调整后仅复验白术1项，1.20s／46ms，通过 | [来源及执行记录](cross-validation/complete-followup-skills-source-audit.md)、[首轮](validation/complete-followup-skills.log)、[定点](validation/complete-followup-skills-reset-contract.log) |
| `npx vitest run packages/game-data/src/weapon-conditioned-expansion.test.ts` | 首次2通过／1夹具失败，1.14s；只修未选中命中夹具，仅失败项复验通过，1.07s，生产未因该失败改动 | [首轮](validation/logs/weapon-conditioned-expansion-vitest.txt)、[定点](validation/logs/weapon-conditioned-expansion-vitest-retry.txt) |
| `npx vitest run packages/sim-core/src/__tests__/ordinary-aura-phase-checkpoint.test.ts`及仅失败项复验 | 首轮测试语法漏括号，未收集；之后第2项通过，第1/3项经合法原生v7夹具、既有反应名称及实际重复timeline断言修正后通过；最终2通过／1跳过，962ms | [完整尝试表](validation/ordinary-aura-phase-checkpoint-core.md)、[退出码](validation/ordinary-aura-phase-checkpoint-exit-codes.json) |
| `node packages/game-data/scripts/generate-classified-coverage.mjs` | 首次exit0，生成920／545／140／18 | [日志](validation/coverage-aura-classified-generation.log) |
| `node packages/game-data/scripts/generate-equipment-coverage.mjs` | 首次exit0，生成200／988 | [日志](validation/coverage-aura-equipment-generation.log) |
| `npm run data:status` | 首次exit0，同步机器状态及README／更新页事实块 | [日志](validation/coverage-aura-data-status.log) |
| `npm run data:check` | 首次exit0，历史目录可复现、活动投影和来源哈希一致 | [日志](validation/coverage-aura-data-check.log) |
| `npm run build` | 首次exit0，全工程TypeScript＋336模块生产构建，356ms | [日志](validation/coverage-aura-build.log) |
| `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/coverage-expansion.spec.ts` | 新1流程首次通过，1.5s／总1.8s，exit0 | [页面报告](validation/coverage-expansion-browser.md)、[日志](validation/coverage-expansion-browser.log) |
| `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/weapon-conditioned-expansion.spec.ts` | 新1流程首次通过，3.5s／总3.9s，exit0 | [日志](validation/logs/weapon-conditioned-expansion-playwright.txt) |
| `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/ordinary-aura-checkpoint.spec.ts` | 新1流程首次通过，1.2s／总1.8s，exit0 | [页面报告](validation/ordinary-aura-checkpoint-e2e.md)、[日志](validation/ordinary-aura-checkpoint-e2e.log) |

最终九项新增核心分别有通过证据，不能说核心首次全绿。三个新增页面各首次通过，复用4173现有生产预览，无服务重启。没有旧全集、旧浏览器矩阵、性能或大型Monte Carlo重跑。构建／测试耗时不是产品性能指标；既有大chunk及无效动态拆分提示保留。

## 实测算术与状态

技能手算共同条件为T1、C0、ATK1000、HP10000、角色／目标90级、抗性10%、CR0.5／CD1，无其他反应和加成。下表为非暴击；小数显示不回流计算。

| 场景 | 真实结果 |
| --- | --- |
| 多莉E3 | 946.8000000000001；独立式 `(1.4728+2×0.3156)×1000×0.5×0.9` |
| 妮露Q2 | 1843.2000000000003；独立式 `(0.18432+0.22528)×10000×0.5×0.9` |
| 甘雨E2 | 1188；独立式 `2×1.32×1000×0.5×0.9` |
| 白术E起手HP=0.5 | 1336.5；`3×0.792×1000×1.25×0.5×0.9`；单击445.5 |
| 白术HP=0.49／未知 | 1069.2／明确阻塞；不默认满血或零 |
| 白术三段增伤已含A1 | 总量仍1336.5，未二次加25% |
| 白术实际来源配装→最终面板→JSON | 三阶段均730.9559001838501，保留真实共同起手条件及逐击轨迹 |
| 弥坚骨页面 | 凯亚N1用`0.5375×最终ATK + 0.16×最终ATK`后进入既有乘区；耗尽／后台不加，未知窗口只阻塞普攻；JSON和重新配装不双加 |
| 金律页面 | 诺艾尔T1 N1的0.7912倍率不变，两个乐章各自进入ATK／EM轨迹，切换到两份EM后按新实际面板重算 |
| 普通附着连续循环 | 原生aura-v7、120帧周期、Hydro0／Pyro108，8周期预热；1200帧真实运行，窗口`[960,1080)`为500＋750＝1250伤／625DPS，period1 |
| 五个相位检查点 | 边界480…960保持完整同状态；水量`0.8−108×0.8/570−0.5`、衰减`0.8/570`、物化年龄12、Pyro ICD剩48、直接伤害组剩17均保留 |
| 同量不同状态 | 实际衰减率或ICD命中索引不同则状态不同；后续推进不修改已捕获值；未用当前空状态豁免未来能力或附魔 |
| 蒸发命中计算器回放 | 原始2秒运行的750伤逆蒸发命中，完整输入及trace相同，复现差0；不声称启动详情新增了跳转按钮 |

## 仍需完成

来源完整动作与局部武器条款不建立其全部帧、触发、能量、命座和动态生命周期。白术／多莉等高命座、柯莱新叶、夏洛蒂状态、七七估算tick与夏沃蕾几何仍有明确缺口。当前普通附着层尚不包括v8/v9目标阶段状态、目标本地时钟，以及感电／冻结／激化／燃烧／草核／结晶等生命周期；随机暴击、概率产球、普攻回能和西风私有状态也不获确定性认证。久岐忍含概率粒子，不能据本轮普通附着进展宣称整队稳态。

全游戏数据／机制、特殊来源冲突、可靠7.2V1快照、完整敌人及广泛外部整队对照继续见[已知限制](known-limitations.md)。没有把实现工作量或来源缺失统一包装成“已完成”。

[历史QA](history/qa-report-2026-09-24-before-coverage-aura.md)保存前轮真实资源延迟和周期实体验证。120秒性能仍只引用2026-09-23T06:42:28.209Z的[既有测量](cross-validation/simulation-execution-benchmark.md)，本轮未重测。

本轮收尾 `git diff --check` exit0、无输出；只覆盖已跟踪差异，不当作全机制验证。[日志](validation/coverage-aura-diff-check.log)／[退出码](validation/coverage-aura-diff-check.exit)。
