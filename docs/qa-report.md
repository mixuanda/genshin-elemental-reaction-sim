# 当前实施与验证报告
2026-09-29 当前批：[来源有限技能与持续协同归属（109）](source-owned-generators-20260929.zh-CN.md)：35项合同（26个producer行＋10项原有合同－Bennett E重复1项）；两lane native build 8.022／8.473秒、Web build 4.915秒、registry 0.157秒通过。初次native补丁因Xiangling／Kirara引用已插桩源码行而未匹配，改用插桩前来源生成统一diff后两lane通过；首次typecheck也发现skill-ownership误经普通association selector，已显式拒绝该路径后最终build通过。producer声明／分析离线回归2/2（2文件，2.214秒墙钟，Vitest 1.70秒）；四份归档捕获回归既有结果；Venti结构终止是独立合成负例，两项离线回归均无新增native执行。浏览器唯一案例通过（用例12.5秒／runner 13.7秒／墙钟14.185秒，pageErrors=[]），使用单次Classic夜兰C2 Q团队运行（23秒／1380帧）：9次触发、32项owned应用，小计28378.67210456749，逐击重放32项差0；总native伤害34526.939080662196，未纳入10个凯亚普攻和1个夜兰E自身命中。离线删除触发回执及改为状态仍有效两种负例均不闭合，不是额外native短窗口；JSON导入导出一致。行秋与托马持续协同族只有来源审阅及构建证据，没有新增runtime样本。该结果仅限来源审阅的固有攻击，不是游戏验证。

2026-09-29 历史批次：[固定来源延迟有限技能范围（108）](source-delayed-finite-skill-casts-20260929.zh-CN.md)：12 families／19 sites／21 unique contracts（含107），classic／stellar build 6.262／6.875秒，registry 0.183秒。Web build首轮3.616秒因finite UI alias类型失败，修正build 4.799秒通过；producer regression 1/1、0.750秒，最终Web build 4.779秒。浏览器尝试1先完成Diona断言后因非法等级90 Dull Blade夹具在Kaeya前失败；尝试2因控件ready前导入失败、无native运行；第三次9.601秒通过、pageErrors=[]。总计native执行4次，含首次失败案例中的Diona重复；成功用例中归档Diona Q 7/7、2334.666065224993，Kaeya Q 13击、2966.6700854069763，以及Kaeya 2秒2击小计456.410782370304、3 producer pending。22条逐击重放断言差0。Venti terminal guard最终收窄后只跑synthetic回归与类型／build，无browser/native复测。stellar仅构建，未做游戏验证；命令与边界见[测量JSON](validation/source-delayed-finite-measurements-20260929.json)。

2026-09-29 历史批次：[有限动作根攻击与原生施放回执](source-finite-skill-casts-20260929.zh-CN.md)：有限技能完整／部分范围、逐击公式编辑与导入导出已在单技能和动作集合流程交付；另静态审计10个固定源码根动作。共享补丁纳入classic与stellar构建链。classic／stellar构建7.238／7.569秒，registry 0.224秒，Web最终构建4.093秒；单个classic浏览器案例通过（runner 10.7秒、命令墙钟11.165秒，pageErrors=[]），后续结果区布局调整仅Web构建1.267秒。首个浏览器命令在用例发现前因JSON导入属性失败，原生执行为0；保留该失败，修正后才执行唯一案例。完整Amber Q捕获18/18攻击闭合、18个逐击重放差0，总伤害与原生同为3644.908929157875；截断捕获5/18闭合、13待结且completeCast=false。完整导入导出一致；将一击标记为“不纳入”后不再报告完整总额（生命周期闭合证据仍成立）；移除派发完成回执后无法证明生命周期闭合；legacy捕获不可用作有限分析。两次native执行、单个browser case均仅为classic Amber Q；未跑Vitest，post-layout无重新运行native/browser。详见[测量JSON](validation/source-finite-cast-measurements-20260929.json)及[浏览器结果](validation/source-finite-cast-browser-20260929.result.json)。

2026-09-29 当前批：[目标阶段情景](source-target-phases-20260929.zh-CN.md)：native构建classic／stellar 7.372／7.854秒，registry .115秒；focused首轮5/6，经child引用修复后6/6（1.484秒）。Web首轮因请求kind／结果类型失败，修正后发现receipt/request schema混用；最终Web 4.405秒。浏览器首轮62.531秒超时且未接受结果，规范化request后同一用例5.694秒通过。唯一成功runtime为classic一次六目标Kaeya E；每击raw/applied replay差0，pageErrors=[]。

2026-09-29 当前批：[目标静态DEF adjustment](source-target-defense-20260929.zh-CN.md)：窄测2项通过；classic／stellar构建12.255／12.919秒，registry 0.211秒，Web 7.36秒。浏览器首轮在名册ready前尝试导入、未运行原生；同一案例增加ready等待后通过（7.243秒，pageErrors=[]）。唯一classic运行三目标Kaeya E，三次伤害共享公式重放差0；stellar只构建。

2026-09-29 当前批：[固定来源静态多目标场景与伤害汇总](source-target-scene-20260929.zh-CN.md)：focused合并首轮4/5，修复target summary rate bug后只重跑该文件2/2；Web因exactOptionalPropertyTypes首轮失败，修复后6.358秒通过。classic/stellar构建5.783/6.831秒，registry .182秒；浏览器单案14.971秒通过，pageErrors=[]。两次classic三目标应用与seed一致，换统计主目标未改变applications；逐目标回放四项均差0，JSON复制／删除恢复通过。stellar未runtime运行。

2026-09-29 当前批：[固定来源目标档案与 HP 截止策略](source-target-profile-20260929.zh-CN.md)：focused 3/3；classic/stellar native build 7.381/8.764秒，registry 0.223秒；Web首轮4.884秒因测试unknown类型失败，修复后6.316秒通过。浏览器1例首次通过6.674秒；3次classic native运行，pageErrors=[]。Cryo抗性0.1→0.5时knownSubtotal 1161.8921525418264→645.4956403010146（5/9，回放差0）；HP100时native applied/HP loss 100，frame29击杀；零能量Q于frame360按duration停止、0 applications。freeze/drop未实触发，stellar未runtime运行。

2026-09-29 当前批：[固定来源初始目标几何输入](source-target-geometry-20260929.zh-CN.md)：formatter 2/2、Web build及一个classic浏览器案例通过。近目标12 calculations／1 application，小计1161.8921525418264、回放差0；远目标2 calculations／0 applications，原生明确miss、小计0、pending0。队伍JSON/GCSL往返通过；无native build。详见报告及测量JSON。

2026-09-29 当前批：[固定来源单角色单动作入口](source-single-skill-20260929.zh-CN.md)：Web依次6.720秒通过、修tier状态后6.552秒通过，标签／工具显示修正后6.830秒通过。E2E首次在运行用例前因JSON import属性失败；type-only import后双lane案例通过（墙钟14.543秒／case12.6／runner13.9），标签显示修正后仅classic最终复跑通过（7.979秒）。每lane一条Kaeya E命中，共享回放差0、编辑和collection JSON往返通过；首次双lane运行classic用合成GOOD，stellar用本地参考构筑。没有native build、新unit、真实Enka请求或游戏验证。

2026-09-29 当前批：[固定来源原生 Task.Handler 生命周期](source-task-lifecycle-20260929.zh-CN.md)：classic／stellar build7.231／6.708秒，registry0.170秒，Web4.979秒（Vite978毫秒），聚合browser通过（case9.4秒／墙钟11.024秒，pageErrors=[]）。每lane148任务（136 completed／12 pending），131父链；core123／11、character13／1、enemy0个任务。行秋E关联7任务／2 hits，首击重放差0，collection JSON往返通过；core queue还差584帧。与098的102计算／38应用对照不变；未增加unit或矩阵。

2026-09-29 当前批：[固定来源天赋倍率算术表达式](source-talent-expression-provenance-20260929.zh-CN.md)：classic final／stellar构建5.420／8.217秒，registry0.126秒，Web retry4.440秒；聚合browser retry通过（case14.3秒／墙钟15.653秒，pageErrors=[]）。classic首构建审查后修正actorIndex；Web首轮类型失败、browser首轮null比较失败均留档。每lane6计算／4应用、3次expr读取、2 sites；选中Wanderer表达式0.9137759504999999重放差0，编辑差值39.692420126999934，UI／JSON成功。无新增unit／角色矩阵。

2026-09-29 当前批：[固定来源天赋表 range 行读取](source-talent-range-provenance-20260929.zh-CN.md)：classic／stellar构建6.150／6.776秒，registry0.150秒，Web4.451秒；聚合双lane页面通过（case11.3秒／墙钟12.863秒，pageErrors=[]）。无新unit测试。每lane102计算／38应用，旧14 talent reads不变并新增4 range reads；行秋首段三维索引[0,0,0]查表重放差0，编辑0.46612→0.56612、JSON往返通过。延迟callback的双帧差异未运行实测。

2026-09-29 当前批：[固定来源天赋索引生成过程](source-talent-index-provenance-20260929.zh-CN.md)：core 2/2（墙钟0.599秒）；classic／stellar native build 10.098／7.128秒；registry0.150秒；Web4.260秒（Vite945毫秒）；单个双lane浏览器案例通过（case11.1秒／墙钟12.673秒，pageErrors=[]）。每lane102计算／38应用，结果与096剥除新indexSources后完全一致；各14条回执、2个site。行秋Q的实际索引、查表与重放差0；编辑倍率UI及JSON回放一致。C3/passive非零只由合成测试覆盖。

2026-09-29 当前批：[固定来源天赋倍率表读取回执](source-talent-table-provenance-20260929.zh-CN.md)：`formula-lookup.test.ts` 2/2（墙钟0.597秒），classic／stellar构建9.594／9.983秒，registry生成0.148秒，Web重试4.031秒（Vite927毫秒）。Web首轮2.919秒因`prefixTrace`局部变量遮蔽函数而失败，改名后通过。唯一双lane浏览器案例通过（case10.0秒／墙钟11.721秒，pageErrors=[]）；每lane只实际采到2个site、14条回执命中。选定行秋Q倍率重放差0，编辑0.64272伤害差54.735166868903946并完成JSON往返。原生相对095 gameplay一致。

2026-09-29 当前批：[固定来源反应 EM 来源回执](source-reaction-em-provenance-20260929.zh-CN.md)：聚焦core 2/2（Vitest720毫秒／测试97毫秒／墙钟1.295秒），classic／stellar构建7.969／8.551秒，Web构建4.603秒；浏览器首轮测试选择器失败留档，修正后聚合用例通过（case9.1秒／墙钟10.645秒，pageErrors=[]）。两lane各12个producer、8个EC ticks，选定EM回执、公式重放差0、编辑及JSON往返通过。浏览器只实测EC；其他反应只静态接线与编译覆盖。

2026-09-29 当前批：[固定来源公式依赖链接](source-formula-dependency-links-20260929.zh-CN.md)：core 3文件／6测试通过（Vitest 2.27秒，test 1.25秒／墙钟2.923秒）；Web typecheck+Vite首轮通过（墙钟4.961秒，Vite992毫秒，仅既有chunk与dynamic/static告警）。复用旧两lane102计算／38应用档案，全计算值exact、selected E hit差0；没有新Go构建、模拟或浏览器用例。

2026-09-29 当前批：[固定来源动作机会与派发关联](source-action-opportunities-20260929.zh-CN.md)：core 5/5（用例313 ms／Vitest总耗时906 ms／墙钟1.547秒），classic／stellar构建8.519／8.940秒，Web构建5.081秒；聚合页面1用例通过（case 14.6秒／runner15.8秒／墙钟16.371秒，pageErrors=[]）。两lane各102计算／38应用的基线流程不变；行秋dispatch 2／3精确联接两击，总额1966.0871939310314；Venti落空有明确0记录，frame30截断样本的待应用任务保留且knownSubtotal未定义。六份集合JSON往返通过。

2026-09-29 当前批：[固定来源初始基础面板](source-base-panel-20260929.zh-CN.md)：核心最终2/2通过；classic／stellar构建19.292／19.887秒，Web最终构建8.551秒。页面E2E首轮因隐藏摘要选择器命中失败，收窄到可见来源命中及计算器编辑器后通过（用例18.2秒／墙钟18.847秒，pageErrors=[]）。两lane各102计算／38应用，应用编号11／frame 46差0，JSON往返通过，gameplay相对不可变基线不变。随后仅将空配置标签文案改为“未命名”，Vite bundle 2.397秒通过；没有重跑typecheck或E2E。初次失败及定点修复均保留在测量记录中。


2026-09-29 当前批：[状态生命周期与动作语义](source-lifecycle-and-action-semantics-20260929.zh-CN.md)：classic／stellar构建14.601／15.194秒，core 3/3（1.688秒），Web修正后构建8.718秒；唯一聚合页面通过（用例9.0秒／墙钟11.089秒）。首轮Web构建6.581秒遇到可选UI字段类型错误，修正后重建通过。页面在两lane各运行12秒、38次damage application与基线一致；22个status实例（4 active、12 replaced、6 expired）、pending 0；截断探针两lane均于30帧留下1条stage application待52帧应用、AttackID 1。桑多涅分支窄测试3/3（10.01秒Vitest／11.32秒墙钟），固定来源显示辉映不应阻塞普通扫射/超载，beam仍走Stellar替代。

2026-09-29 当前批：[状态实例归属与更新失败回执](source-status-owner-and-update-20260929.zh-CN.md)：classic／stellar 构建14.897／15.641秒，Web构建9.553秒；core 3/3、update-agent聚焦1/1；双页面用例2/2通过（总墙钟14.396秒，单用例8.7／3.5秒，pageErrors=[]）。首轮页面测试在执行用例前因测试运行时 JSON import attribute 失败，修为 type-only import；非生产代码缺陷。浏览器确认38次应用/lane未变、6次状态owner命中合计2403.863077651348、回放差0；更新流程只导入合成失败回执，不做远端执行或provider重抓。

2026-09-29 当前批次：[观察事件与逐击面板输入](observed-input-editors-20260929.zh-CN.md)：下落2例（54 ms）、卡齐娜6/6（80 ms）、最终 typecheck/Web build（6.801 s）及单页E2E（5.0 s用例／6.593 s墙钟）通过。页面仅抽奈芙尔事件与 Lohen low；两次交互失败及一次精确可选属性类型失败均已留档并修复。该批是教学输入恢复，不是游戏验证。

2026-09-29 最新：[原生动作来源记录](source-action-origin-20260929.zh-CN.md)：classic／stellar最终构建12.401／12.961秒，Web 8.019秒；2项核心用例执行235ms（命令墙钟1.930秒）；聚合页面最终1/1通过（用例4.8秒／墙钟6.796秒，pageErrors=[]）。两lane各38次应用、114阶段观察、2击重放差0；前三次页面失败均留档，最终纠正通过。未声明完整技能或游戏验证。

2026-09-29 最新：[来源 RNG 策略回执](source-rng-policy-20260928.zh-CN.md)：两来源构建 5.853／6.365 秒；聚焦单元 7/7（96ms）；Web 首次可选属性类型错误经窄修后 18.056 秒通过；聚合页面 1/1 通过（墙钟16.138秒，pageErrors=[]）。页面验证 seed alias 拒绝、结果导入／计算器元数据恢复及所选回放差0。来源没有发现模拟时全局 `math/rand` 调用；不宣称数学独立、游戏验证或随机稳态，数据指针未变。

2026-09-28 最新更正（覆盖此前“未建立原生完整状态稳态正例”的相位批次结论）：Venti C0 E／冲刺／等待的 40 秒脚本 的来源原生教学场景在 classic 与 stellar 各取得 6 个完整边界、gaps=0。stellar 连续边界 1333／1777／2221 建立 period 1（444帧，伤害 2059.5758212353603，条件 DPS 278.3210569236973）；classic 因 `skill_charge` 持续增长未建立。classic Amber 负对照仍有两个明确缺口并未建立。来源执行器回执不是游戏验证。最终 classic／stellar／Web 构建 7.914／8.256／4.772 秒；相位判定器5/5（109ms），最终聚合页面 E2E 通过（用例4.5秒／墙钟5.899秒，pageErrors=[]），初次失败有留档。未跑全矩阵、未激活数据候选、goal 仍 active。记录：[阶段报告](source-phase-captures-20260928.zh-CN.md)、[页面回执](validation/phase-captures-browser-20260928.result.json)。

2026-09-28 最新：[原生相位观察](source-native-phase-20260928.zh-CN.md)：判定器同四项最终 4/4 通过（112ms），classic 最终 3.723 秒／stellar 5.782 秒构建通过，Web 类型检查及最终资源打包通过。一次聚合页面通过（墙钟 4.872 秒），两版各 9 边界／8 已确认输入位置，JSON 保留一致；经典去掉 marker 对照结果精确相同。未建立任何原生完整状态稳态正例，不把合成单元正例冒充原生证据。

2026-09-28 最新：[观察组成聚合](observed-composition-20260928.zh-CN.md)：Linnea 2/2、Sandrone 1/1 聚焦用例通过；Web 首次可选类型报错修复后通过（4.239 秒／783 模块）。一次聚合页面 1/1 通过（墙钟 7.962 秒／用例 6.7 秒），目录教学例的逐段编辑、落空 trace、缺段／补回与完整 JSON 恢复通过，恢复差 0，pageErrors[]。未运行旧角色全矩阵或原生构建。

2026-09-28 最新：[观察式状态绑定与 7.1.51 隔离候选](observed-lifecycles-and-candidate-20260928.zh-CN.md)的三条新增绑定完成窄测试（最终 Nefer 2、Linnea 3、Sandrone 2 用例）；并行模块未落地的零用例失败及首次 tsc 类型失败均留档。Web retry1 4.320 秒、778 模块通过；聚合页面首次 3.775 秒通过，三份教学观察输入未接触阻塞、JSON 往返数值差 0、pageErrors 为空。未跑历史全套或 Go 构建。7.1.51 候选 schema 校验成功，不表示游戏验证或完整版本支持。

2026-09-28 当前批次：[固定来源 Drain 公式与扣血捕获](source-drain-sources-20260928.zh-CN.md)。b4/a7 WASM、Web build 769 modules／3.978s、E2E 20.704s 通过；55 个 Drain 应用重放差 0。每 lane 仅实测 9/19 条 Drain 规则；未把公式调用数误报为命中数。

2026-09-28 当前批次：[治疗来源共享公式](source-healing-sources-20260928.zh-CN.md)：最终 classic 3.688s、stellar 4.523s、Web 3.913s／760 modules，E2E 34.693s 通过。四场共 206 个治疗应用，捕获重放最大差值为 0；中间失败与修复均保留在批次报告中。

2026-09-28 最新：[护盾共享公式验证](source-character-shield-20260928.zh-CN.md)。核心 3 项通过；classic 构建 5.448s、stellar 修正后 5.057s、Web 修正后 3.934s／751 模块；唯一聚合页面最终 10.193s 通过，两 lane 各两场景、14 新规则 ID，pageErrors=[]，选定受击/叠盾重放差 0。首轮源码版本变量/类型错误、测试脚本与周期来源断言修正均记录；未重复全量测试。

2026-09-28 当前批次：[GOOD／Enka批量配装与来源队伍预设库](imported-team-library-20260928.zh-CN.md)：handoff核心2用例、Web构建742模块／3.794秒及聚合页面1用例最终重试通过。合成GOOD夹具验证两来源库隔离、预设保存恢复和合并保留动作；圣遗物列表为空，无伤害或WASM运行，也未请求真实Enka。首轮E2E的Ayaka键错配只改测试修复；不增加角色覆盖或verified分母。

2026-09-28 最新：[历史preview选择、比较与URL恢复](preview-history-20260928.zh-CN.md)：核心修复后2项通过，Web retry2／739模块构建与1个页面E2E通过。旧／新局部快照比较529字段（297新增、47移除、185更改，43数值项），页面显示200、完整JSON导出；深链切换/reload恢复通过，active pointers未变。JSON导入切换未测，preview仍0可执行定义且不证明7.2V1或游戏正确性。

2026-09-28 最新：[固定来源角色 Mult 算式](source-character-multiplier-20260928.zh-CN.md)：41条规则／11角色；两版WASM、Web最终构建和聚合E2E最终重试通过。每lane 7次伤害应用，页面实跑5条规则；平藏、法尔伽、娜维娅选定回放差0。初次overlay应用、TypeScript收窄和Physical消费者映射失败均保留并窄修；tracked diff-check通过。其余36条未本批页面实测，非游戏验证。

2026-09-28 最新：[角色治疗／冷却覆写与逐步 trace](source-character-overrides-20260928.zh-CN.md)。保留35条scalar并新增3条Durin／Ifa派生输入规则；Arlecchino／Clorinde治疗接收与Cyno、Varka、Odette冷却路由进入共享记录，真实队列仍由Go执行。两lane各5治疗与2冷却捕获重放差0；治疗公式编辑1545.51047554→1670.51047554、TF冷却446→386，原capture不变、JSON恢复成功。核心新文件重测1项通过，Web 730模块构建与聚合页面通过；trace报告49节点／67运算。未实跑Ifa、Durin、Varka、Odette完整机制或历史全集。

2026-09-28 最新：[排队来源角色 FlatDmg 公式](source-character-flat-20260928.zh-CN.md)。142条规则／40角色（classic适用140、stellar142；120 set、16 add、6 multiply）。最终4场聚合E2E通过（每lane 25应用／2690计算，观察13个规则ID；5个选定重放差0），Chiori设值加乘算1778.3118434808002→编辑1961.83398174186，JSON恢复一致，pageErrors[]。retry2同帧consumer选择问题由fixture修正；旧dist首轮不视为本批失败。页面WASM身份、完整失败历史及Dehya/Nilou链等未覆盖边界见报告；不是全142规则实测或游戏验证。

2026-09-28 本轮验收：[角色同击附加伤害](source-character-additive-20260928.zh-CN.md)。两Go首轮通过（6.005／6.385秒）；Web首轮两处类型收窄失败，修后通过，最终723模块／19.908秒。一个聚合页面首轮缺起跳动作、retry1角色别名断言错误，定点修fixture后retry2通过（墙钟45.365秒，用例40.4秒，pageErrors[]）。每lane只一场16秒、10次伤害应用，classic2594／stellar2590计算，实际观察4条新规则；普攻与下落捕获恢复差0，独立公式编辑及JSON恢复一致。其余19条规则、直月／星辉direct新增分支没有本批页面样本；未做全矩阵或新单元测试。[完整日志与最终身份](validation/source-character-additive-measurements-20260928.json)。

2026-09-28 本轮验收：[角色向量与公式编辑](source-character-vectors-20260928.zh-CN.md)。两Go构建首次均因一斗新增变量与旧变量重名失败，窄修改名后通过；Web首次事件类型错误修复后通过。一个聚合E2E首轮通过（墙钟14.096秒，用例12.6秒，pageErrors[]）：每lane两场，56次命中，classic2819/stellar2820计算，14个新规则ID；各6个选定命中恢复差0，classic单公式0.11→0.12、原capture未变、JSON恢复一致。随后AST清点发现流浪者吸冰漏项，补后仅重建两Go（3.976/4.288秒）与Web（4.006秒，718模块）并更新静态清点，未重跑无关页面；最终WASM与页面实测WASM身份在报告分别保存。没有新增单位测试或重跑历史矩阵。[测量汇总](validation/source-character-vectors-measurements-20260928.json)。

2026-09-28 本轮验收：[角色辅助标量](source-character-scalar-20260928.zh-CN.md)。classic/stellar首轮Go构建5.967/6.336秒通过，Web首轮3.772秒通过；E2E首轮夹具漏查component路径，retry1通过classic两场景及计算器JSON恢复后暴露a7延迟反应来源链缺口。033修复后只重建stellar（5.196秒）与Web（3.729秒，713模块），只复跑未通过的stellar lane：5.254秒墙钟、1用例3.8秒、pageErrors[]。每lane两场18秒场景，78次伤害应用/35次治疗；所选CD、治疗和伤害捕获重放差0。classic沿用retry1证据，未重复跑已通过场景；仅stellar复验覆盖正fanfare的Furina读值。全部失败及收据见[测量汇总](validation/source-character-scalar-measurements-20260928.json)，没有新增单位测试或全矩阵测试。

2026-09-28 本轮验收：[角色动态公式与预览](source-character-dynamic-20260928.zh-CN.md)。两Go构建首轮通过（5.374/6.160秒）；Web首轮两处E2E类型收窄错误，窄修后retry1通过（3.719秒，710模块）。聚合页首轮测试把原生aratakiitto误筛为itto，改夹具后retry1通过（7.267秒，1用例5.9秒，pageErrors[]）。每lane20命中/1054计算，仅实测5条动态规则共59调用；选定命中1804.3113722207872、恢复差0。旧受击夹具用于支持链回归，未新跑该WASM场景。完整收据见[测量汇总](validation/source-character-dynamic-measurements-20260928.json)；未扩跑旧角色或全集。

2026-09-28 最新：[角色固定修正量验收](source-character-modifiers-20260928.zh-CN.md)：classic/stellar Go构建首轮5.739/6.184秒通过；Web修复新增测试类型窄化后3.798秒通过（706 modules）。一个聚合E2E修正旧轨迹DPS约1e-13的精确相等断言后5.338秒通过：每版一次10秒原生运行，各11次角色修正调用、11次伤害应用，所选命中恢复差0；classic独立JSON恢复通过。3个起步场景复用已有6次轨迹，无新起步Worker。没有全量测试或新增单位测试。

2026-09-28 最新：[来源辅助公式](source-auxiliary-formulas-20260928.zh-CN.md)：两Go构建首次通过，trace单测26/26；Web首轮类型错误修复后retry1通过，聚合页面首次通过（4场，13.318秒墙钟，pageErrors[]）。每lane12治疗与2次冷却缩短，classic编辑408.74894297092→449.62383726801204、900→960并JSON恢复。后仅校正文案并重建bundle，未重跑已通过测试。

2026-09-28 最新：[固定来源角色能量公式](source-energy-formulas-20260928.zh-CN.md)：b4/a7构建及Web retry2通过；最终E2E retry1通过（墙钟5.165秒，3.8秒用例，errors[]）。每lane59计算／26应用，粒子四类/前后台分支均观察到；首次E2E虽然exit0，但NoElement enum差异在之后源码对照中揭露，修复后再验收。没有新核心单测或完整从头重执行。

2026-09-28 最新：[固定来源圣遗物事件算式与快照记录](source-artifact-events-20260928.zh-CN.md)：b4／a7 WASM、Web retry1及3场聚合E2E通过。页面首轮遗漏stellar-contributor快照consumer，修spec按componentIds定位后通过；不改生产保护。36个Blizzard快照实际事件有provenance与重放一致，Disenchantment snapshot为0；其余边界见报告。

2026-09-28 最新：[固定来源动态圣遗物公式](source-artifact-dynamic-20260928.zh-CN.md)：核心2项首轮通过，b4/a7、Web build及聚合E2E均retry1通过。E2E首轮Emblem编辑因后续AttackMod正确blocked；只改fixture插入透明终端命中后通过，四场景观察20个版本化规则／8套。未实跑Flower 4pc，不代表85规则或全套覆盖。

2026-09-28 最新：[计算器命中组成聚合](calculator-aggregation-20260928.zh-CN.md)：核心2/2通过（墙钟3.531秒）；`npm run build`通过（686模块／3.531秒／Vite860ms）。页面E2E首轮因测试格式器2位小数对比生产6位显示失败；只修测试格式精度并加组成点击展开后retry1单用例通过（墙钟3.922秒，test2.7s／runner3.4s，pageErrors[]）。行秋完整两段、部分段和ATK编辑导入恢复均核对；未构建新来源WASM。

2026-09-28 最新：[固定来源普通圣遗物常量](source-artifact-constants-20260928.zh-CN.md)：核心fixture首轮sourceCommit缺失失败、retry1通过（1测／0.710秒）；b4/a7 WASM首轮patch编译失败、修复后retry1通过（5.717／6.051秒）；Web build首轮E2E fixture Set字面量联合与`.has(string)`类型不符，retry1通过（3.507秒／685模块／Vite819ms）。聚合E2E首轮1/1通过（墙钟7.507秒，runner7.0秒）；每lane54次调用/7个rule IDs/4套实际运行，实际命中常量被捕获并支持限定数值编辑。39条规则与24套机制未全测。

2026-09-28 最新：[固定来源三把武器算式](source-finite-weapon-formulas-20260928.zh-CN.md)：b4/a7 WASM首轮通过（5.615／6.003秒）；核心trace-child首轮失败后窄修retry1 1/1通过（0.835秒）；Web build首次optional类型失败后retry1通过（3.691秒）。聚合E2E首轮1项通过（墙钟7.744秒、Playwright 7.2秒）；两lane各36计算/20命中，Foliar11/Hunter3/Cinnabar2；命中组件编辑重算、capture重放与JSON恢复一致。没有测耗尽/完整冷却或全精炼原生矩阵，不代表新增全武器支持或游戏验证。

2026-09-28 最新：[来源初能敏感度验收](source-startup-sensitivity-20260928.zh-CN.md)：b4/a7 页面聚合1流程首轮通过（用例2.8秒、runner3.6秒、墙钟4.098秒），执行Noelle 5秒轨迹10条，并完成Classic满能seed1原生完整重执行及capture重现。Web build首次TS失败、retry1 679模块／3.695秒／Vite 853ms通过；仅文案调整后的最终bundle 1.162秒／Vite 883ms通过，未重跑核心或页面。两核心筛选用例通过、2个旧用例跳过。零能每窗口120条不足能量是native同一Q重试，不是用户输入计数；有限数据不证明稳态或游戏验证。

2026-09-28 最新：[普通圣遗物共享公式页面验收](source-host-artifact-formulas-20260928.zh-CN.md)：core构造性公式用例1/1通过；b4／a7 WASM构建各一次通过（5.534／5.918秒）。Web构建首轮失败、retry1通过（3.546秒）；页面首轮因 `AttackTag(n)` 与名称断言不符失败，retry1通过1项（墙钟11.107秒；Playwright用例9.7秒）。两来源各51应用、1,133次标量调用，10种规则ID来自四套；重放／导入主结果差0。核心用例不是实际Go证明，七套全流程及游戏行为未验证。

2026-09-28 最新：[来源模板页面验收](source-team-template-guide-20260928.zh-CN.md)：1个Playwright用例通过（806ms；全套约1.5秒；墙钟1.768秒），675模块构建通过（3.647秒，Vite 848ms）。receipt确认4名成员／7步预览及编辑后完整draft导出导入相等；胡桃普攻状态只在测试metadata中从真实implemented覆写为unsupported。未执行WASM或18模板旧矩阵。

2026-09-28 最新：[月曜圣遗物与配装页面验收](moonlight-equipment-handoff-20260928.zh-CN.md)：最终核心 handoff 与 Moonlight 两用例均有通过记录，两个页面最终通过；构建 675 modules／3.450秒／Vite 807ms。Moonlight capture 8 callbacks／10 reads／5 special＋6 ordinary events，特殊伤害独立重现 delta 0；本地配装两击 frame1／31 分别 1611.7910693920485／1653.0613746609279，后击重现 delta 0。首轮EM ledger、到期预期、构建类型及三次浏览器失败原因均保留于报告；不代表实机验证。

2026-09-28 最新：[固定 a7 星辉组合验收](stellar-artifact-composition-20260928.zh-CN.md)：首轮页面1流程失败／墙钟31.052秒（控件不可见），修复后 retry1 核心1项通过／2.029秒、构建通过／3.285秒／671 modules／Vite 630ms、页面1流程通过／Playwright3.1秒／墙钟3.348秒。Conduct 10秒伤害5631.125；Swirl 5秒伤害31490.881476071634；两 capture 导入重跑一致。核心精确相等，页面断言精度1e-8；未扩展为游戏验证或完整装备属性来源树。 中文变量释义补齐后最终构建通过：3.380秒／671模块／Vite 644ms；未重复行为测试。

2026-09-28 最新：[固定来源完整复跑](source-complete-reexecution-20260928.zh-CN.md)：核心1文件2用例首轮通过，记录0.428秒（Vitest 218ms）；生产构建首轮exit0／3.457秒／669模块；新增1页面聚合首轮pass，Playwright用例2.9秒、runner3.7秒、记录3.928秒。b4既有6秒结果复跑与a7新4秒运行后复跑一致，receipt分别核对35/34日志事件。改日志与假WASM hash拒绝通过，历史receipt不继承。未新建WASM；本次范围不证明任意checkpoint、游戏验证或稳态。

2026-09-28 最新：[来源方案与观测窗口](source-profiles-observation-windows-20260928.zh-CN.md)：最终 npm build retry1 exit0，668模块／3.468秒／Vite 615ms；首次仅 helper 闭包类型窄化失败 exit1／2.590秒，窄修后通过。两新页面 Playwright 首轮2/2通过（2.0秒，墙钟2.245秒）；核心聚合1项通过（Vitest1.27秒，墙钟1.486秒），在补 missing-boundary null 断言后执行一次；agent 初版早先1项通过不重复计数。Classic profile 页面实测：排队1、接受并施放13、下一输入窗40帧（相对施放延迟12帧）；2个真实 seed、每次6秒，预热1秒后窗口[61,181)、[181,301)，同 seed 后窗减前窗 DPS 差分别为196.118429与203.650396。a7 本轮有构建记录，未做新增页面 profile 实测；未验证稳态、checkpoint 或游戏行为。

2026-09-28 最新：[来源动作政策与完整特殊结果重现](action-timing-special-replay-20260928.zh-CN.md)。七宿主1核心聚合用例通过（exit0、real2.29s）；两个新页面首轮2/2通过（4.149s），真实21帧动作等待、严格动画／零能中止及完整特殊捕获恢复已记录。构建在修正新测试两项类型声明后667模块／3.540s通过；两个来源因补回中止日志各作一次补充构建，全部原始日志保留，未重跑旧矩阵。

2026-09-28 最新：[动作入口与武器组合验收](source-actions-weapon-composition-20260928.zh-CN.md)：665模块构建首轮exit0／3.226s。核心1聚合用例修正两项输入夹具后通过；新页面修正普攻输入与武器追击计数断言后1/1通过／3.655s。实际5击总伤18065.953304499893、首击恢复差0；原失败保留，未跑历史全集。

2026-09-28 最新：[本轮整合验收](source-variants-artifact-composition-20260928.zh-CN.md)：新页面首轮1/1通过（3.798s），实际两次E／3秒6击／恢复差0；核心组合1聚合用例窄修后通过（retry7墙钟2.014s）。首次4处类型错误保留，最终构建3.526s／664模块通过。仅候选脚本语法与已有候选离线diff，未重跑历史全集或完整网络采集。

2026-09-28 最新：[本轮必要检查](candidate-utilities-startup-20260928.zh-CN.md)：数据生成4.706s通过；构建首次重复类型导出失败，修正后3.198s／664模块通过；新增3页面首轮通过，墙钟4.068s。来源动作日志使用前批实际保存的WASM结果，未重复运行来源模拟；历史全集未重跑。

2026-09-28：[新增功能验收](source-energy-lifecycle-20260928.zh-CN.md#已执行检查与失败记录)：两来源WASM首轮通过；网页类型窄修后retry2通过，659模块／12.360s。卡齐娜与阿罗夏页面首轮通过；两来源受击页修正测试初能参数后仅定点复验，2/2通过／9.019s。总计4个新增流程通过，保留全部首次失败；实测额外ER0／20%、每次341次实际能量不足重试、盾吸收2750.769483240001及独立恢复。没有重跑历史全集。

2026-09-27 后续：[实际共享来源／星辉验收](source-shared-stellar-20260927.zh-CN.md#实际整合检查与数值)：b4 WASM首轮4.225s通过；最终类型／构建648模块／3.372s通过。受击页首轮通过；星辉轨迹跨图引用首轮失败，修复后只复验星辉1页通过，3.948s。原失败与两份实际运行JSON均留档，未重跑已通过受击页或历史全集。

2026-09-27：本次预设/导入/可视化增量的必要验收、所有失败窄修和实测值见[独立报告](builds-rotation-import-20260927.zh-CN.md#已执行检查与测量)。新增3个页面流程首轮3/3通过；仅新增导入单元与受影响Enka单项复验；没有重跑历史全集。

更新：2026-09-25。此批优先完成共用模块和批量数据接线，不继续扩大少数角色的外部测试。最终 goal **进行中**，全部主提示尚未完成。没有提交、推送或部署。前一批原报告保存在[历史 QA](history/qa-report-2026-09-24-before-module-completion.md)。

## 来源宿主名册、月曜与属性贡献增量

本批未重跑数据生成、旧角色／页面矩阵或大型随机；`.27`保持124身份／1249模板／710条件完整／16部分／0分类阻塞。只新增1页面，累计38核心文件／91用例、26页面；历史批次计数不回填。[本批生产范围与身份](source-host-lunar-provenance-20260925.zh-CN.md)。

| 检查 | 实际结果 | 原始记录 |
| --- | --- | --- |
| 固定源码自动取得 | 首轮PASS、exit0、墙钟8.634s；56,440,121字节，归档SHA256及4021blob匹配 | [日志](validation/source-portable-prepare.initial.log)、[退出码](validation/source-portable-prepare.initial.exit) |
| 名册metadata | 已生成401注册包／401实际键；182个包包含429独立TODO位置，493按包展开；这是静态来源提取，不是游戏测试 | 生成文件`apps/web/public/source-host/inventory-metadata.json` |
| 同身份WASM／metadata构建 | initial exit1／3.865s；Go编译与metadata已成功，旧license输出0444导致覆盖EACCES。复制前／后chmod0644窄修后retry1 exit0／2.752s；WASM41,554,594字节，6链接依赖、missingDependencyLicenses=[] | [原失败](validation/source-lunar-wasm-build.initial.log)、[通过](validation/source-lunar-wasm-build.retry1.log) |
| 月曜／属性贡献类型与生产构建 | initial exit1／2.418s，enum-valued union负向缩窄；已验证排除经典分支处窄标注特殊类型后retry1 exit0／3.197s／630模块／Vite561ms | [原失败](validation/source-lunar-app-build.initial.log)、[通过](validation/source-lunar-app-build.retry1.log) |
| 唯一新正常页面聚合 | 首次PASS、exit0；用例2.8s／Playwright3.1s／墙钟3.651s；名册键、六月曜分支、独立编辑与完整JSON | [页面](validation/source-lunar-browser.initial.log)、[退出码](validation/source-lunar-browser.initial.exit) |

页面实测3600帧／60秒、172命中／261计算，总伤408385.34443141945；月感电／月结晶各反应与直接两类、月绽放事件与直接两类共六分支真实出现。命中索引11回放差0，参与者EM编辑后3440.839616994448→3728.2198397710567；完整result JSON重算及独立editable JSON导入一致，pageerrors=[]。实载WASM SHA256为`70c4f7c8087a1889b8a22f54d0911f7510a786c3b0fa98eefd4fe4fe33926f8f`，与本批构建一致。

收尾静态读取dist／public／已构建网页三份WASM，均41,554,594字节且SHA256与manifest一致，读取工具exit0；`git diff --check` exit0。未新增模拟或测试计数。

通用属性贡献已经接普通／直月／贡献者／排名trace，JSON导入也执行逐项加法和最终快照验证。闭包内部、ReactBonus／抗防逐项与跨角色关联仍partial；Stellar、任意帧checkpoint和共享玩家入伤不计本批完成。两次构建失败、所有同名退出码保留。以下`.27`段落保存上一批实际验收，不反向覆盖本批新增行为。

## 当前 `.27` 整类覆盖与来源宿主

本批按共用机制族使用集中脚本和同核心例题，未增加逐角色测试矩阵。此前登记38核心文件／91用例不变，新来源页面通过后累计25页面；本批下列脚本单列，不将动作或包注册数量当作新增测试数。`.27`为124身份／1249模板／710条件完整／16部分／0分类阻塞；可组合15角色／57动作／89模板，8特殊组成另列，verified与team-ready仍0。[完整交付记录](broad-coverage-runtime-20260925.zh-CN.md)。

| 检查 | 实际结果 | 原始记录 |
| --- | --- | --- |
| 两资源例题 | 首轮exit0、0.553s；1072.44／5845.171915636364，61／52 trace节点，两例完整恢复相同 | [日志](validation/observed-resource-examples.initial.log) |
| 十角色弓族 | initial DSL映射失败1.121s，retry1字符串JSON比较失败1.147s；规范化结构比较后retry2 exit0、1.465s，47输入／51箭、整链回1与JSON恢复通过 | [initial](validation/default-bow-family.initial.log)、[retry1](validation/default-bow-family.retry1.log)、[通过](validation/default-bow-family.retry2.log) |
| 13武器叠层代表 | 唯一试作斩岩运行与全部断言首次PASS；500／500／520／540，JSON状态相同、回放差0；内部1129ms。外层zsh误用status，退出码UNRECORDED，不称exit0 | [日志](validation/weapon-hit-stack-runtime.initial.log)、[退出码实况](validation/weapon-hit-stack-runtime.initial.exit) |
| 四身份来源 | 首轮exit0、2.475s；44动作／49模板，Manekin N3为454.90275／单击227.451375，未知阻塞及完整JSON／trace相同 | [日志](validation/four-identity-source.initial.log) |
| 敌盾普通域 | initial夹具缺target.name失败1.097s；retry1 exit0、1.180s，HP伤害0／0／450，潜在1350，GU9.9892／9.9784，HP99550、回放差0 | [initial](validation/enemy-shield-runtime.initial.log)、[通过](validation/enemy-shield-runtime.retry1.log) |
| 数据三步 | 生成／一致性／状态首轮exit0，4.712／4.700／3.617s | [生成](validation/broad-coverage-data-generate.initial.log)、[一致性](validation/broad-coverage-data-check.initial.log)、[状态](validation/broad-coverage-data-status.initial.log) |
| 类型／生产构建 | initial exit1、2.525s：来源host optional及两个历史审计联合类型；retry1 exit0、3.307s、625模块、Vite572ms | [initial](validation/broad-coverage-build.initial.log)、[通过](validation/broad-coverage-build.retry1.log) |
| 来源WASM实物 | 首轮exit0、13.227s，41439681字节；注册117角色／231武器／53套装不是readiness | [构建](validation/source-host-wasm-build.initial.log) |
| 来源WASM运行 | initial真实跨TraceBuilder引用finalDamage失败0.765s；retry1 HP声明触发damage模式提前结束、retry2误认命中ID0均为夹具；retry3 exit0、0.898s，内部91.202167ms | [initial](validation/source-host-runtime.initial.log)、[retry1](validation/source-host-runtime.retry1.log)、[retry2](validation/source-host-runtime.retry2.log)、[通过](validation/source-host-runtime.retry3.log) |
| 含页面修复的构建retry2 | 全类型＋Vite exit0、3.540s／625模块／Vite569ms | [日志](validation/broad-coverage-build.retry2.log) |
| 新来源页面聚合 | initial 6.698s失败于冻结AST节点元数据写入；不改算式、改不可变副本后retry1 PASS，用例1.2s／Playwright1.5s／墙钟2.005s | [initial](validation/source-host-browser.initial.log)、[通过](validation/source-host-browser.retry1.log) |
| 产物身份补充后最终构建 | 全类型＋Vite exit0、3.673s／625模块／Vite590ms；新增哈希身份只构建检查，无页面重跑 | [最终日志](validation/broad-coverage-build.final.log)／[退出码](validation/broad-coverage-build.final.exit) |

源宿主retry3实际480帧／5击，总伤1580.3007656274563、DPS197.53759570343203，五次回放差全0；首击213.07426053403904编辑后426.1485210680781，完整运行JSON相同。原生源机制使用TS实际返回伤害，没有Go后备数值；属性上游完整推导仍partial、checkpoint=false、月星及共享玩家入伤未接。

页面实际24秒／1440帧、27命中／34计算，damage／additive-base／transformative-base均执行，实际增幅1次；总伤33451.32354597975，独立编辑280.09202865019205，完整导出导入相同，pageerrors为空。其后Worker对已fetch WASM字节计算SHA256与大小，result／capture／独立编辑JSON保留该身份，旧记录明确未保存；只执行最终类型／构建，不称新哈希显示已浏览器实测。

每份日志及现存同名退出码保留，武器退出码缺失不补造。最终build覆盖本批冻结生产树及前批待构建修复；正常页面数学与操作仍以此前retry1为证。不声称全部反应组合或全产品已完成，未重跑历史全集、性能或大型随机。

## `.26` 横向来源与运行时（前批）

本批限定1个新增核心文件／2个聚合用例、1条正常页面。第一项核心在retry3通过，此后不重跑；第二项在retry7通过（1PASS／1SKIP）。页面首轮通过，近期累计**38文件／91用例、24页面**。数据为120身份／1200模板／666条件完整／16部分／0分类阻塞，8个已发生特殊组成单列；team-ready及verified仍0。[完整范围、算式和失败记录](horizontal-source-runtime-20260925.zh-CN.md)。

| 检查 | 实际结果 | 原始记录 |
| --- | --- | --- |
| 数据生成／一致性／状态 | 首轮exit0，墙钟4.674／4.999／3.669s | [生成](validation/remaining-horizontal-data-generate.initial.log)、[一致性](validation/remaining-horizontal-data-check.initial.log)、[状态](validation/remaining-horizontal-data-status.initial.log) |
| 分类最终读取 | exit0，1.606s；120／1200／666／16／0，8 special另列 | [分类](validation/remaining-horizontal-classified.final.log) |
| 类型／生产构建 | initial类型接线失败；2026-09-25的retry1 exit0，3.232s、582模块、Vite510ms；后续核心修复未包含在该构建，保留chunk提示 | [首次失败](validation/remaining-horizontal-build.initial.log)、[通过](validation/remaining-horizontal-build.retry1.log) |
| 核心第一项 | retry3首次PASS；该轮第二项FAIL，整轮Vitest2.93s／墙钟3.402s。后续跳过本项 | [retry3](validation/remaining-horizontal-core.retry3.log) |
| 核心第二项 | retry7首次PASS，1PASS／1SKIP、测试460ms、Vitest2.96s／墙钟3.455s、exit0；第一项未重跑 | [retry7](validation/remaining-horizontal-core.retry7.log)／[退出码](validation/remaining-horizontal-core.retry7.exit) |
| 保留核心失败 | initial至retry6均exit1；身份／几何夹具修正与实际next-v1回链、奈芙尔快照、周期时钟／priority／随机流生产缺陷分别记录 | [initial](validation/remaining-horizontal-core.initial.log)、[retry1](validation/remaining-horizontal-core.retry1.log)、[retry2](validation/remaining-horizontal-core.retry2.log)、[retry3](validation/remaining-horizontal-core.retry3.log)、[retry4](validation/remaining-horizontal-core.retry4.log)、[retry5](validation/remaining-horizontal-core.retry5.log)、[retry6](validation/remaining-horizontal-core.retry6.log) |
| 唯一正常页面 | 首轮1/1PASS，用例2.6s、Playwright3.9s／墙钟4.483s，复用4173 | [页面](validation/remaining-horizontal-browser.initial.log) |

页面实际普攻段号1,2,3,4,5,1,2,3,1，总伤1900.6000000000004；229帧Q被拒绝不重置，初能7／11未被绑定动作改写。水主独立洪流期望2798.28，编辑后3041.28，完整两击3327.4800000000005；`completeCalculatorRestored=true`。核心第一项检查水主不同历史面板、Swift正确普通天赋及体力、Linnea／Sandrone直接特殊组成和奈芙尔5段最终面板／JSON，不代表完整角色生命周期。retry2发现奈芙尔普通两段未物化实际EM窗口的生产缺陷，修复最终面板转换后五段均保存EM200，保留原断言；Swift／幻戏身份与几何修正单列为夹具问题。

retry6因检查点schema未注册`dendroCorePosition`／`crystallizePosition`失败（墙钟3.394s）；补齐并核对帧前真实spawn抽样后，retry7通过before2／before32队列、随机流drawCount0→1与完整JSON断言。日志没有打印测量对象，不宣称存在原始console数值或周期1证明。

三处正常日志分页已合并且当次构建通过，未专门加页面测试；周期状态捕获不等于随机稳态。2026-09-25的build.retry1及页面通过后，还有奈芙尔物化、感电旧到期、草核priority和位置随机流schema修复；这些核心通过当时不替代统一构建，后续已由[`.27`最终构建](broad-coverage-runtime-20260925.zh-CN.md)收口；该处保留原批次时间边界。所有原失败和`.exit`保留，文档整理不执行检查；resources、weaponstack、enemyshield、bowfamily为下一批，不能因参与本次类型检查就计为运行时已验收。

## `.25` 旅行者与兹白独立来源协议（前批）

本批仅新增1核心文件／1聚合用例及1页面流程，均经定点复验通过；近期累计**37文件／89用例、23页面流程**。两次真实生产失败保留，重试不重复计数，已通过项不重跑。`.25`为120身份／1191模板／662完整条件动作／16部分／3阻塞，verified和team-ready仍0。[完整来源域、独立算式和失败记录](traveler-zibai-source-20260925.zh-CN.md)。

| 检查 | 实际结果 | 原始记录 |
| --- | --- | --- |
| 数据生成／一致性／状态 | exit0，墙钟4.784／5.090／4.230s；正式与preview身份未晋升 | [生成](validation/traveler-zibai-data-generate.initial.log)、[一致性](validation/traveler-zibai-data-check.log)、[状态](validation/traveler-zibai-data-status.log) |
| 类型与生产构建 | 首次exit0，3.497s、546模块、Vite515ms；保留原chunk提示 | [原日志](validation/traveler-zibai-build.log) |
| 聚合核心 | 初次1FAIL、Vitest2.61s：Zibai A4重建引用未执行的hitElementalMastery；修为实际子节点后retry1的1/1PASS，2.09s／墙钟2.590s，用例111ms | [原失败](validation/traveler-zibai-core.log)、[通过](validation/traveler-zibai-core.retry1.log) |
| 定点Web打包 | trace修复后bundle retry1 exit0，0.779s／546模块／Vite512ms；没有再次运行全工程类型检查 | [bundle retry1](validation/traveler-zibai-bundle.retry1.log) |
| 唯一正常页面 | 初次1FAIL，用例1.4s／墙钟2.415s；未选Zibai普通代表行每次prepare重复追加依赖，三个本批helper统一Set幂等修复，保持完整JSON深比较；仅复验该页1/1PASS，用例1.4s／Playwright1.7s／墙钟2.155s | [原失败](validation/traveler-zibai-browser.initial.log)、[通过](validation/traveler-zibai-browser.retry1.log) |
| 页面修复后单独打包 | bundle retry2 exit0，墙钟0.762s、546模块、Vite499ms；不重跑已通过核心或类型检查 | [bundle retry2](validation/traveler-zibai-bundle.retry2.log) |

页面实测草Lv14期望1521.7875，独立兹白月段3042.97728，编辑基础提升后3327.36768；实际装备转最终面板与完整JSON期望3315.9334107998875一致。所有选中／未选中命中、gameContext与共享trace完整相同；未用删字段方式绕过首轮失败。

核心通过A完整9击与独立星超导、风／草Lv14历史面板和实时EM、兹白普通／月结晶两段及A1仅灵驹、A4参与EM/DEF装备转换和最终面板JSON。合成属性转换得到DEF1176／EM412，非真实武器条款。原core／build／data-check／data-status文件没有`.initial`后缀，不改名或覆盖。未运行团队、旧核心／页面全集、性能、大型随机或新游戏外测；下一批在制模块不计本批通过。

## `.24` 来源协议、通用玩家盾与六套增益（前批）

该批新增4个核心文件／5用例和2条页面流程，分次均有通过记录；该批后累计 **36文件／88用例、22页面流程**。已通过项不重跑，失败与重试不重复计数。`.24`生成120身份／1183命中模板／652完整条件动作／18部分／11阻塞，team-ready及verified仍0。[完整范围、命令和失败记录](remaining-source-runtime-20260925.zh-CN.md)。

| 检查 | 实际结果 | 原始记录 |
| --- | --- | --- |
| 来源技能＋非周期反应 | 在本次统一initial中2项PASS，此后未重复；六种反应闭合输入的实际状态均period1。前序观察尾段和冻结空生命周期记录失败保留 | [最早观察尾段失败](validation/nonperiodic-reaction-checkpoint.initial.log)、[联合失败](validation/remaining-reaction-core.initial.log)、[统一initial](validation/remaining-source-runtime-core.initial.log) |
| 通用玩家盾 | 初始缺显式目标，其后两次夹具尾段不足；保持完整检查点要求，扩充观察后retry3单项PASS | [initial](validation/remaining-source-runtime-core.initial.log)、[retry1](validation/remaining-source-runtime-core.retry1.log)、[retry2](validation/remaining-source-runtime-core.retry2.log)、[retry3](validation/remaining-source-runtime-core.retry3.log) |
| 六套普通圣遗物 | 2项分别在retry1／retry4通过；修夹具目标／几何互斥、Bloom过滤误含直接触发击及独立参考基础值1446.8535，未放宽容差或重跑已过项 | [retry1](validation/remaining-source-runtime-core.retry1.log)、[retry2](validation/remaining-source-runtime-core.retry2.log)、[数值定位](validation/remaining-source-runtime-core.retry3.log)、[最终单项](validation/remaining-source-runtime-core.retry4.log) |
| 数据生成／一致性／状态 | 首次exit0，4.555／4.709／3.781s；正式与预览身份未晋升 | [生成](validation/remaining-source-data-generate.log)、[一致性](validation/remaining-source-data-check.log)、[状态](validation/remaining-source-data-status.log) |
| 类型与生产构建 | 初次类型接线失败，窄修后exit0，墙钟3.176s、525模块、Vite471ms；原chunk提示保留 | [失败](validation/remaining-source-runtime-build.initial.log)、[通过](validation/remaining-source-runtime-build.retry1.log) |
| 两条正常页面 | 团队首次PASS（用例1.7s）；独立页发现真实mixed JSON重复依赖，Set幂等修复后只重打包0.734s／Vite497ms并单项复验PASS，Playwright1.5s／墙钟2.016s | [首次一过一败](validation/remaining-source-runtime-browser.initial.log)、[定点bundle](validation/remaining-source-runtime-bundle.retry2.log)、[独立页面通过](validation/remaining-source-runtime-browser.retry1.log) |

统一initial核心为2过3败，Vitest3.62s／墙钟4.144s；后续retry1至retry4分别为2.07／2.570s、1.92／2.385s、1.63／2.089s、1.70／2.190s（Vitest／墙钟）。最后一轮只跑尚未通过的宗室／教官／饰金／乐园聚合项，1PASS＋1SKIP，不写成同次全套通过。

团队页面实际总伤1000→1200，盾吸收2500／穿透500，HP9500，命中回放差0且`completeRecordRestored=true`。独立特殊末击期望19628.247956210533→19885.06615376843；装备转最终面板及JSON保留2436.026350157214。诺艾尔独立碰撞1006.9353000000001，完整高空下落3521.8354500000005。这些数值对应明确合成输入与来源域，不是游戏实测。六种反应checkpoint通过不涵盖感电／燃烧／草原核／结晶等尚未导出资源，也不证明随机稳态。

该批复用4173，未重启预览、未重跑历史全集／性能／大型随机或新外部模拟。该批结束时A／B／C尚未计入通过，其后接线和验收见上方`.25`记录；文档收尾不执行检查。

## 可组合来源能力与真实取样（前批）

安柏／重云／刻晴／埃洛伊／钟离5个C0来源Q、33命中模板已接正常可编辑队伍、合法轮转与共享执行核心。指定时点取样、独立HP附加基数、实际优先级和`sourceSnapshotLog`进入AST、捕获与完整JSON；来源状态仍provisional，安柏5个N定义仅source-only，预览缺匹配不回退。`.23`的639完整／30部分／11阻塞未变，正式verified及条件映射team-ready未晋升。[本批完整记录](composable-source-actions-20260925.zh-CN.md)。

新增1单元文件／1用例及1页面，均首轮通过；该批后累计**32文件／83用例、20页面流程**，重试不重复计数。

| 检查 | 实际结果 | 记录 |
| --- | --- | --- |
| 组合核心 | 首轮1/1 PASS，Vitest3.27s／墙钟3.754s，exit0 | [日志](validation/composable-source-core.initial.log)／[退出码](validation/composable-source-core.initial.exit) |
| 数据生成／一致性／本地状态 | 首轮exit0，墙钟4.502／4.345／3.469s；无新网络同步或版本观察 | [生成](validation/composable-source-data-generate.log)、[一致性](validation/composable-source-data-check.log)、[状态](validation/composable-source-data-status.log)；各同名`.exit`为0 |
| 类型／生产构建 | 首轮exit1，仅`reproducibility.test.ts:604`审计字段联合类型漏列`sourceSnapshotLog`；补齐后exit0，墙钟3.283s、484模块、Vite442ms，原chunk提示保留 | [首次失败](validation/composable-source-build.initial.log)／[退出码](validation/composable-source-build.initial.exit)、[通过](validation/composable-source-build.retry.log)／[退出码](validation/composable-source-build.retry.exit) |
| 正常页面 | 唯一新流程首轮1/1 PASS，Playwright3.1s／墙钟3.594s，exit0；复用4173，无重启 | [日志](validation/composable-source-browser.initial.log)／[退出码](validation/composable-source-browser.initial.exit)、[步骤与手算](validation/composable-source-abilities-e2e.md) |

实际测量：保存来源绑定保留原初能7／11，用户填40后两Q各扣40；钟离0f独立HP附加6600、101f伤害6563.304；刻晴A4参与10击，总伤10028.029、8秒DPS1253.503625。真实天星回独立计算器差0，输入／选项／完整运行结果重载一致（`completeRecordRestored=true`）。期望来自固定来源与独立手算，不由模拟结果自证。

该批没有新游戏／外部模拟对照，也没有新的完整检查点周期闭合实测，不能从完整JSON恢复推导稳态。未重跑历史全集、性能或大型随机实验；本文档收尾没有执行检查。后续来源协议、玩家护盾与六套增益的有限交付见上节，不能借用其反应样例证明可组合来源任务任意稳态。

## `.23`装备实际生命周期、依赖范围与接触协议（前批）

余响／昔时实际回调、状态和伤害AST、JSON与检查点；25类纯增伤仅阻塞相关命中；3个接触／标记完整条件协议替换4部分组件。当前120身份／1157模板／639完整条件动作／30部分／11阻塞，verified与团队就绪指针未晋升。[本批完整记录](artifact-contact-expansion-20260925.zh-CN.md)。

新增3单元文件／6用例和2页面流程均有实际通过记录，该批后累计**31文件／82用例、19页面流程**。另2项直接受影响旧配装用例通过，不计新增；重试及已有用例补断言不重复计数。

| 检查 | 实际结果 | 记录 |
| --- | --- | --- |
| 圣遗物及范围依赖 | 首轮6过1败（含2旧配装），修真实转换任务计序初始化及夹具观察尾段；新增状态AST后仅重跑受影响圣遗物3项全过，1.34s／墙钟1.809s | [初轮](validation/artifact-contact-core.initial.log)、[观察尾段失败](validation/artifact-damage-core.retry.log)、[集成通过](validation/artifact-damage-core.second.log)、[最终AST](validation/artifact-damage-trace.final.log) |
| 三组接触协议 | 单个聚合首轮通过，2.35s／墙钟2.807s；含完整日程、来源条件、逐击/最终面板/JSON与独立末击 | [日志](validation/contact-marker-core.initial.log) |
| 数据生成／一致性／状态 | 首轮exit0，4.256／4.211／3.290s；`.23`，正式和真实preview身份未变 | [生成](validation/artifact-contact-data-generate.log)、[一致性](validation/artifact-contact-data-check.log)、[状态](validation/artifact-contact-data-status.log) |
| 类型／生产构建 | 首轮1处optional标签数组类型错误；仅收窄已存在数组类型后exit0，墙钟2.761s、479模块、Vite436ms，原chunk提示保留 | [失败](validation/artifact-contact-build.initial.log)、[通过](validation/artifact-contact-build.retry.log) |
| 两条正常页面 | 分次通过；收集JSON入口、应用候选表、等待新路由及错选角色均为测试修正，无生产改动。最后接触页2.6s／墙钟3.125s | [收集失败](validation/artifact-contact-browser.initial.log)、[首次执行](validation/artifact-contact-browser.retry.log)、[圣遗物通过](validation/artifact-contact-browser.second.log)、[接触通过](validation/contact-marker-browser.third.log) |

实测余响11抽6触发，总伤7600；昔时15000请求治疗在360f封存，5次各加1200基伤，总伤8500，完整JSON相同、宿主回放差0。三接触协议期望6285.6／1468.8／3047.810976；配装与最终JSON期望828.0625785066362一致。不重跑历史角色、完整发布门、性能或大型随机实验，未执行新的游戏／外部模拟对照。

## `.22`批量交付与必要检查（历史）

本批30个完整条件分支替换34部分组件，并解决男性旅行者7项系数阻塞。当前120身份／1157命中模板／636完整条件动作／34部分／11阻塞；自动团队就绪0，正式verified指针仍空。动态生命上限与实际星涡跳跃／下落同时接入。来源、实测数值、具体边界见[本批记录](lifecycle-maxhp-expansion-20260925.zh-CN.md)。

本批新增3单元文件／10用例及3页面流程，均有通过记录；近期模块累计**28文件／76用例、17页面流程**。重试与补入已有用例的断言不重复计数，不将4个聚合用例覆盖的30分支另算30用例。

| 本批检查 | 实际结果 | 原记录 |
| --- | --- | --- |
| 30分支共用核心 | 4个聚合用例首轮通过，Vitest3.08s、墙钟3.533s；每组代表完整转换／JSON，其余协议查必要来源条件与日程 | [日志](validation/lifecycle-source-batch.initial.log) |
| 动态上限 | 3项首轮通过；后补检查点断言仅重跑所在1项，Vitest1.13s、墙钟1.569s，其他2项跳过 | [初轮](validation/maxhp-highjump-core.log)、[后补断言](validation/maxhp-checkpoint.increment.log) |
| 星涡真实跳跃 | 边界项首轮通过；另外2项先修夹具合法值，再修真实投递未被结果校验识别的接线，最终2项通过／1项跳过，Vitest1.18s、墙钟1.651s | [中间失败](validation/stellar-highjump-core.retry.log)、[最终](validation/stellar-highjump-core.second.log) |
| 数据生成／一致性／状态 | 首轮exit0，墙钟4.348s／4.241s／3.314s；`.22`与正式／预览身份分离 | [生成](validation/lifecycle-maxhp-data-generate.log)、[一致性](validation/lifecycle-maxhp-data-check.log)、[状态](validation/lifecycle-maxhp-data-status.log) |
| 统一类型／生产构建 | 修复首轮3处类型接线遗漏后exit0，墙钟2.806s、473模块、Vite438ms；仍有既有大chunk提示 | [初轮](validation/lifecycle-maxhp-build.initial.log)、[通过](validation/lifecycle-maxhp-build.retry.log) |
| 3条正常页面 | 持续实体与动态上限首轮通过；星涡修正导入夹具和只读捕获视图断言后单项通过，Playwright1.7s、墙钟2.153s，未重跑前2条 | [初轮2通过／1失败](validation/lifecycle-maxhp-browser.initial.log)、[断言失败](validation/stellar-highjump-browser.retry.log)、[最终](validation/stellar-highjump-browser.second.log) |

本次没有重跑旧角色矩阵、历史完整发布门、性能、大型随机或外部游戏测试。普通计算文档与只读模拟命中捕获视图结构不同，星涡页面断言修正没有改动产品计算行为。生产构建后仅修新页面夹具／断言及交付文档，没有重复构建。

以下保留各批当时的覆盖和日志，其计数不代表当前状态。

## `.21`持按与资源批次记录（历史）

本批新增18个持按／生命周期／有限后续条件完整动作，替换19个部分组件；`.21`实际为120身份／1130命中模板／606完整条件动作／68部分／18阻塞。1130不是日程展开后的实际击数，明确接触记录、历史快照和条件资格仍须完整；新增动作不自动成为完整角色或团队支持。显式生命之契资源与七类命名随机流检查点同步接入，来源和边界见[本批记录](held-resource-expansion-20260925.zh-CN.md)。

当前必要检查累计**25个单元文件／66用例、14页面流程**有通过记录；本批在原22文件／59用例、11页面流程上增加3文件／7用例和3页面流程，重试不重复计数。未运行旧套件、历史完整发布门、性能或大型随机实验；本次文档同步只汇总已有记录，没有运行新检查。

| 本批最新检查 | 实际结果 | 记录 |
| --- | --- | --- |
| 持按与有限后续合并核心 | 1文件2项首轮通过；两项合并覆盖18个条件协议，不按每个角色另开测试套件。同命令随机检查点失败不改变本文件通过事实 | [首轮原日志](validation/held-random-batch.initial.log)、[来源与范围](cross-validation/held-finite-casts-source-audit.md) |
| 七类随机流检查点 | 1文件2项最终通过，Vitest1.31s；真实边界抽样位置、触发状态、在途任务、JSON及后续随机序列；不证明随机稳态 | [最终日志](validation/random-phase-checkpoint.second.log)、[失败与边界](validation/random-phase-checkpoint.md) |
| 生命之契资源 | 1文件3项最终通过，Vitest1.12s；来源AST、治疗吸收／余量、真实账本、JSON完整性和待治疗检查点 | [最终日志](validation/bond-of-life-runtime.log)、[首轮夹具失败](validation/bond-of-life-runtime.md) |
| 数据生成／一致性／状态 | exit0，分别4.234s／4.167s／3.243s；生成`.21`，正式元数据与真实preview身份不变 | [生成](validation/held-resource-data-generate.log)、[一致性](validation/held-resource-data-check.log)、[状态](validation/held-resource-data-status.log) |
| 类型与统一生产构建 | 首轮三处类型接线问题修复后exit0，总3.015s，440模块，Vite420ms；大chunk提示保留 | [原失败](validation/held-resource-data-build.log)、[通过日志](validation/held-resource-build.retry.log) |
| 三条新页面 | 持按、生命之契、随机检查点全部首轮通过，Playwright2.6s、命令3.027s；正常控件、实际结果、最终面板／JSON恢复和独立命中按各流程覆盖 | [首轮日志](validation/held-resource-browser.initial.log) |

生命之契遵循显式`gcsim-b4ae769-same-heal-remainder-v1`，保持fixed-source-assumed；同次治疗余量仍有来源TODO，不能写成官服已验证。随机七流状态已真实捕获，不再因缺少这些流而一律阻塞检查点，但随机稳态、复杂反应私有状态和其他独立缺口仍未解决。原失败与窄修记录保留，没有把最终通过改写为首次全绿。

## 前次协同、追击与真实预览记录（保留历史）

前次已完成12个显式协同日程完整条件施放、苍翠猎弓和水仙十字之剑自动追击，以及真实7.1.50两角色隔离预览入库。当时`.20`分类为120身份／1111命中模板／588完整条件动作／87部分／18阻塞；1111不是所有日程展开后的实际击数。16把独立追击中15把已有自动执行，仅昭心保留来源冲突阻塞。

7.1发布事实最新观察为2026-09-24 14:48:17 UTC（香港22:48:17）。preview现为1，原始版本标识保留7.1.50，尚无证据对应7.2V1。候选含2角色、2天赋集、13非空能力、2命座集、425字段评估，可执行定义0；未采集武器／套装不代表全版本为零。正式目录及verified指针未变；采集字节、来源内部时间戳异常及许可未知等边界见[后续模块记录](continuation-modules-20260924.zh-CN.md)。

截至前次，必要检查累计22个单元文件／59用例、11页面流程有通过记录；月曜与该次后续模块共新增4文件／11用例和3页面流程，不重复计重试，未运行历史完整发布门、性能或大型随机实验。

| 前次检查 | 实际结果 | 记录 |
| --- | --- | --- |
| 协同日程合并核心 | 1文件2项通过，最终Vitest2.64s，命令3.086s；十二协议共享检查 | [最终日志](validation/coordinated-casts-identity-retry.log)、[失败与范围](validation/coordinated-casts-batch-notes.md) |
| 两把追击生命周期 | 1文件3项通过，1.62s；实际排程、取样、捕获、回放、有限检查点和FIFO | [验证与五次夹具失败](validation/remaining-weapon-proc-lifecycle.md) |
| 数据生成／一致性／状态 | exit0，分别4.561s／4.371s／3.399s；当时生成`.20`与真实预览状态 | [一致性日志](validation/continuation-modules-data-check.log) |
| 类型与统一生产构建 | exit0，总2.833s，425模块，Vite418ms；大chunk提示保留 | [最终日志](validation/continuation-modules-build.final.log) |
| 真实预览页面 | 1条通过，528ms；两角色独立目录、未核实状态和返回正式教学 | [日志](validation/continuation-modules-browser.retry.log) |
| 协同日程页面 | 1条通过，1.0s，命令1.703s；日程编辑、最终面板、JSON和独立末击 | [日志](validation/coordinated-casts-browser.final.log) |

协同页面100–221帧普攻状态实际生成120／180／240帧的2／3／2剑，共7击。核心曾发现最终面板错误扣除20%被动，修复后转换保留13589.0141184，不再变为11324.178432；首轮临时原日志被重试覆盖的事实仍保留。页面随后发现失焦重绘丢输入、JSON键顺序误作事件身份导致抗性覆盖丢失，已修复并只复验失败流程。预览首轮失败来自断言在错误提示区域寻找角色名，修正断言而未改变产品数据。两把追击的五次前期夹具约束失败继续保留，不改写为首次全绿。

## 月曜装备增量记录（后续模块之前）

如雷、乐园、晓歌月曜条款已通过同一AST接入独立计算器、3可编辑例题、五种月曜宿主、实际叠层和完成切人事件。来源/数值/真实检查/限制见[模块记录](lunar-artifact-bonus.md)。该增量新增2文件6用例和1页面流程通过；与下方前批当时合计20文件54用例、9页面流程，不重复计重试。当次构建exit0，2.557s，414模块，Vite401ms；该增量没有重跑数据生成、历史矩阵或性能。

首轮运行时夹具误把队友绽放归给装备者，改为真实归属断言；随后来源审查修复实际切人完成与取样同帧排序。浏览器夹具遗漏executionProfile:null导致导入失败，补齐后只复验该流程。原失败日志均保留。

## 前批实际修改

- 数据快照新增独立证据 sidecar、按所选依赖的计算凭据和真实隔离工作区。角色、天赋、装备目录、精确成长表均从所选 workspace 读取；缺预览字段不退回正式值。该前批真实preview仍为0，未制造示例快照或晋升；其后7.1.50实际入库见上文。
- 四组固定来源共28个完整条件分支、201个组成命中接入正常计算器；包含有限多段、投射物、持续技能、男女冰旅行者明确分支。完整施放、面板稳定、突破及特有状态须明确。生成覆盖由 `.18` 的941击／550完整／135部分变为 `.19` 的1106击／576完整／105部分；18个明确阻塞保留。不是全角色团队能力。
- 通用E共享串行槽与延迟SetCD不再依赖装备祭礼；真实冷却状态反馈动作，纳入回放和检查点。合法时间线补walk和受空中状态约束的plunge，正常行动编辑器有入口。
- ER求解使用每个候选的实际产球、定值回能与已执行扣能请求；不再因静态技能表无粒子断言任意ER无解。安全余量需要实际评估。
- 报告区分请求周期、真实输入占用、观察窗和完整尾段；归属保留指令、周期和父事件。完整轮转使用已观察的全时间区间，未知／截断尾段不报假完整DPS。
- 目标HP、有效伤害、过量伤害、击杀、阈值／击杀／显式外部掉能接入真实队列、能量和独立JSON重放。该模型采用用户声明的敌方HP/掉落规则，不冒称完整原生敌人表。新账本按25行分页。
- 流放者、学士、赌徒、烬城二件套接入实际Q、拾球、击杀和夜魂迸发事件；受益者、固定回能、触发冷却及技能重置均实际执行。UI可声明装备与夜魂队伍。
- 补行者重击CR、余响已发生加值、昔时已完成治疗记录加值、乐园普通绽放层数AST，以及影中普通超导目标CR。已实现条件条款的四件套名义数量44→48；触发全生命周期另计。
- 月感电、月结晶、月露涤荡和受限mixed执行新增独立种子贡献者抽样；先逐人暴击再排序，保留解析期望。实际随机上下文随模拟命中还原至计算器。
- 逐击EM改变时重建装备转换；转最终面板保留真实逐击派生值，修正心海完整技能转面板后重复被动记账的问题。翠绿／深林未知减抗改按伤害元素阻塞，普通／剧变及未选命中的最终面板JSON均保留缺口。
- 16把独立追击／80精炼位置／95条件分支已有入口；信使补真实弱点必暴击及自动回调。该前批昭心、苍翠、水仙仅能恢复明确已经发生的一击；后续苍翠、水仙自动执行已完成，昭心仍缺。
- 修复移动端长快照ID撑宽；Vitest入口现也收录 `apps/web/src/**/*.test.ts`，避免已写网页集成用例被静默跳过。

## 已执行的必要检查

同一用例重试不重复计数。以下前批累计18个单元文件、48项用例有通过记录；另8条页面流程有通过记录。不是执行整个历史测试全集，也不是所有官服机制已核验。构建通过不代替数值和机制证据。

| 检查 | 真实结果及范围 | 记录 |
| --- | --- | --- |
| 数据生成 | exit0，4.436s；活动runtime投影及5份圣遗物来源哈希一致，生成 `.19` | [日志](validation/module-completion-data-generate.log) |
| 数据一致性 | exit0，4.383s；legacy可再生及活动投影一致。日志的120/125/762/237/61是legacy生成器计数，不是活动目录 | [日志](validation/module-completion-data-check.final.log) |
| 前批状态刷新 | `npm run data:status` exit0；当时status为 `.19`、四件套48，仅更新本地派生状态，未做网络同步或重新观察版本；当前`.22`与真实预览见上表 | [当前生成状态](../packages/game-data/src/generated/update-status.json) |
| 共用核心初批 | 15文件38项，37通过、1夹具导出错误；网页workspace测试起初未在include内 | [首轮](validation/module-completion-focused.log) |
| workspace与批量技能 | 补入网页测试后2文件3项：workspace两项通过；批量技能发现心海最终面板真实记账错误。修复后唯一批量用例通过，28分支／201击，测试608ms | [首次窄验](validation/module-completion-focused.retry.log)、[批量通过](validation/module-completion-source-batch.retry.log) |
| HP和装备事件JSON | 2文件2项通过，测试340ms、Vitest1.49s；实际运行、完整记录解析、捕获回放及能量对照 | [日志](validation/module-completion-health-energy-replay.log) |
| 抗性依赖与可信合同 | 2文件31项通过，其中24项既有信任合同、7项套装／范围检查；测试130ms、Vitest1.81s，不将重复24项再次计数 | [日志](validation/scoped-resistance-focused.log) |
| 前批最终构建 | tsc + Vite exit0，总2.669s，412模块、Vite384ms；仍有大chunk提示，非性能测量 | [当次日志](validation/scoped-resistance-build.retry.log) |
| 页面原批 | 新夹具最初直接导入raw JSON失败，未进浏览器；改用正常角色/技能入口后8项运行，6通过、2失败。真实失败为移动端长ID溢出；另一项需先从legacy预设切换到合法时间线 | [8项记录](validation/module-completion-browser.retry.log) |
| 页面窄验 | 修正后只运行原两项，2通过／3.9s；未重跑已通过6项 | [日志](validation/module-completion-browser.narrow-retry.log) |

构建早期暴露目标控件模板括号、跨版本timeline类型、可选字段与装备类型接线问题，均窄修；其后两处新夹具类型错误也已修正。失败及各次构建保留在 `docs/validation/module-completion-build*`、`module-completion-ui-build*`、`scoped-resistance-build*`。初次浏览器raw-JSON错误的完整输出在任务工具记录，文件仅保留退出码；不将重命名后的通过记录冒充初次原日志。

## 实测数值

| 共用场景 | 结果 |
| --- | --- |
| 28来源分支 | 正常文档累计201组成击；全部经共享核，转换最终面板和JSON后合计一致；不证明自动附着/粒子/动作时序 |
| 正常页面整次技能 | 7击，明确教学ATK2000时非暴13881.78、暴击30539.916、期望25542.4752；ATK2500后16844.355／37057.581／30993.6132。未建立队伍，分段和等于总值 |
| 实际目标HP | HP750，两次raw500后死亡，后续命中失败；raw总1000、有效750、过量250。阈值/击杀/外部球实际入队，ER2角色最终能量22；捕获JSON复算差0 |
| 四装备事件 | 四角色最终能量0／9／15／6；流放者9次受益者tick；夜魂101帧；赌徒151帧重置、153帧ICD拦截，使150／152帧E真实成功；捕获JSON复算差0 |
| ER动态来源 | 源配置没有静态技能粒子，真实西风仍产1次球、ER前6能量；150%上限只能报范围内不可行，200%满足Q，250%安全值已实际评估；预算不足的225%不伪报推荐 |
| 轮转分母 | 合成4秒观察1000伤/250DPS；输入占用1秒；尾击在150帧，完整区间[0,151)为151/60秒，DPS=1000÷(151/60)。截断或动作未结束不返回完整轮转值 |

本轮不重跑已完成的角色外部对照、历史性能或大型Monte Carlo。2026-09-23的120秒／269事件性能样本仍为历史：trace关闭中位30.500ms、开启129.735ms；随机暴击34.01次/秒，不能说是本批重测。Messenger只保留先前一次外部样本，本地外部逐击对照尚未运行，不增加其外部认证范围。

## 未完成与阻塞

代码仍须补齐30个部分动作及全量被动/命座、已交付5个C0 Q之外的可组合来源动作库、装备生命周期与特殊反应装备协议、反应复杂混合/空间/反馈、敌盾、人物专属动态属性回调与死亡复活、生命之契角色映射和治疗余量证据、未导出的反应私有队列等状态；七类随机流已捕获仍不构成随机稳态证明，新来源取样亦未获本批周期闭合证据。它们是继续实施的工作，不统称外部阻塞。

真实7.1.50部分结构化预览已摄入，尚未证明7.2 V1身份，数值语义和机制证据仍缺；`.26`已解除水长E两性与伊安珊的3个分类阻塞，当前分类阻塞0但仍有16部分动作；风／草Q的旧冲突保留并采用独立数值裁决，冰主状态协议不消除领域计数与男性下落来源等限制。四身份现已按固定发行版原始表补44基础条件动作，但其完整状态、E/Q和自动团队机制尚未齐。当前活跃正式目录仍provisional，9025证据字段中5366缺失，verified与team-ready不因本批测试增加。详见[主要求完成矩阵](master-requirements-status.zh-CN.md)和[中文实施报告](implementation-report.zh-CN.md)。
2026-09-28 最新：[计算器命中组成聚合](calculator-aggregation-20260928.zh-CN.md)：build 686模块/3.531秒通过；聚合E2E首轮为spec精度断言不匹配，precision6后retry1通过（墙钟3.922秒，pageErrors空）。行秋ATK编辑前后两段值及导出／导入聚合详见报告。最终 `git diff --check` 通过，仅为tracked whitespace范围；无新WASM或新增游戏数据覆盖。
