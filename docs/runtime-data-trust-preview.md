# 运行时数据可信链与隔离预览

本次实现将“数据可解析”“来源分类已可条件执行”“正式晋升且本次依赖完整”分开。当前真实数据仍无正式晋升的可执行定义，不增加verified数量。可信链初批未取得真实预览；2026-09-24后续已摄入真实7.1.50两角色部分快照，保留来源版本及未知字段，不把它称为7.2V1。

## 可信链

不可变 snapshot 经原有内容哈希与结构验证后，生成独立 `evidence-v1.json`。旧 catalog/index/metadata 投影原文保持不变；原子 `runtime/current.ts` 同时选择 catalog、supplemental、evidence 和权威 pointers。字段聚合状态来自真实字段评估，不再统一写 unchecked。目录索引的 provisional 仍只是目录标签，不能授权计算结果。

`assessRuntimeEvidence` 只检查明确选中的执行定义及其声明依赖。verified 必须来自 released、`activeVerifiedSnapshotId` 精确匹配、已分类且数值/机制证据均 verified、不可变来源指纹与测试记录完整。无关角色、未选择爆发或完整队伍机制缺失，不影响这次命中的依赖评估。

计算器通过 `CalculatorTrustContext` 接收外部来源凭据。单纯 JSON 自称 verified 或旧 dataset ID 白名单不再足够。每段凭据绑定独立重新生成的来源表达式、倍率、规则版本、适用装备/反应规则及其全部相关依赖。编辑来源 AST、倍率、元素/标签或公式位置后不能复用旧凭据；合法最终面板和目标输入不被当作来源常量。装备和特殊反应不再一律降级，仍须取得自身相关依赖的正式证据。

快照定义使用 `calculator:hit:<hitId>`（或精确 hit ID）与 hitCalculation，或 `calculator:skill:<skillId>`（或精确 skill ID）与 skillCalculation。定义必须逐项列出 `getCalculatorHitTrustDependencies` 返回的字段 ID；前缀不是通配授权。此约定只建立今后的真实晋升通路，本次没有替现有 0 个定义补造验证记录。

## 预览工作区

预览命令实际 materialize 指定快照，原子选择器生成 literal lazy imports。`loadPreviewWorkspace` 对独立 catalog/index/supplemental 和证据身份做 Schema/一致性校验；浏览器消费构建时已经验证的生成产物，不把用户上传的任意目录当作可信来源。

更新页提供真实预览目录的角色、武器、技能浏览；计算器提供“已发布目录 / 隔离预览”切换。切换清空跨渠道草稿和装备缓存。分类映射从所选 workspace 读取完整天赋向量；相关向量变更只阻塞该动作，不能退回正式目录。诺艾尔、一斗、行秋额外天赋读取同样注入所选来源。

预览的文档身份保留 snapshot ID，结果标为 preview；即使底层快照原发布状态为 released，预览工作区也不能取得 verified 凭据。预览配装已注入所选workspace：角色/武器目录、套装说明与精确等级成长表从独立来源读取，缺少对应曲线就报缺失，不回退正式值。通用圣遗物主副词条规则仍使用明示的固定参考；来源说明变动会要求重新审阅。独立武器条款/展示柜/来源例题进入正式工作区；预览的单击和单技能计算不需要它们。无真实预览快照时入口显示缺失并禁用，不生成空的成功数据。

## 当前预览事实

当前选择`snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc`，原始版本`7.1.50`。它包含2角色、2天赋集、13非空能力、2命座集和425字段评估，原始参数槽与倍率文本已保存，但可执行定义仍为0。未采集武器／套装不是全版本数量为零；没有独立完整名册，许可未知，内部时间戳晚于采集日的异常保留。没有来源证明它对应7.2V1，未知数值语义不得靠正式目录补全。

正式目录及verified指针未变。一次真实页面流程已读取预览中的两位角色、确认尚未核实和无猜造伤害，再切回正式目录恢复原角色与教学。来源字节、哈希、入库结果和最终构建见[后续模块记录](continuation-modules-20260924.zh-CN.md)。

## 验证记录

可信链初批已运行runtime evidence、calculator trust与workspace相关用例；独立workspace两项检查通过，包括预览基础ATK变化隔离和缺曲线禁止正式回退。真实active新增sidecar/selector生成成功，该批数据一致性与构建通过；当时没有晋升、网络同步或真实preview输入。后续真实7.1.50入库及一次预览页面流程已完成；最新统一构建退出0，2.833s／425模块／Vite418ms，数据一致性4.371s。必要检查、原失败和窄修见[QA](qa-report.md)，本次文档同步未新增测试或构建。
