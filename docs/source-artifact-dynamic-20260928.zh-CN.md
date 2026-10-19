# 固定来源动态圣遗物公式（2026-09-28）

## 实现范围

本轮把固定 b4／a7 宿主在既有圣遗物 `Amount` 回调中读取的动态数值接到共享 AST。Go 仍执行触发门、攻击／反应标签筛选、状态更新、层数、领取者和持续时间；调用点将本次 `Amount` 所消费的来源状态连同规则 ID 交给 `ArtifactScalar`，TypeScript 共享公式计算数值并留入命中捕获。该接线不重演事件历史，也不替代原生状态机。

公式目录集中在 `packages/sim-core/src/source-host-artifact-dynamic-formula.ts`，按组拆在 `source-host-artifact-dynamic-group-a.ts`、`-b.ts`、`-c.ts`，并由既有 `source-host-artifact-formula.ts` 与常量、旧公式共用 scalar 输入入口。严格 schema 校验规则 ID、必需参数、整数／范围／枚举选择及未知键；描述符可限制固定 source commit。捕获侧将原生传入参数保存为 `source-host-native-state` trace input，公式说明保留触发／到期语义归 Go 的边界。

冻结目录为 A 组20条／9套、B 组28条／9套、C 组37条／5套，合计85条动态规则／23套。A 组包括绝缘、华馆、饰金、辰砂、黑曜秘典、谐律异想断章、未竟的遐思、长夜之誓、回声之林夜话；B 组包括悠古的磐岩、如雷的盛怒、翠绿之影、乐园遗落之花、影中沉凝的幻灭、风起之日、深廊终曲、来歆余响、昔时之歌；C 组包括晨星与月的晓歌、纺月的夜歌、穹境示现之夜、烬城勇者绘卷、天之美赐。与旧有57条／31套普通及常量规则合并后，目录共142条规则、按圣遗物去重为53套（翠绿之影目录重叠）。规则数量不等于完整套装机制覆盖。

独立编辑器从捕获的真实 `artifact-scalar` 支持项生成参数控件，以同一 resolver 编辑公式；只有捕获上下文里可证明的属性传递路径才联动重算命中，其他项只展示公式值和解释。独立公式实验保存在编辑器 JSON 中，但不会合并到完整队伍状态，也不会改写既有触发资格或历史状态。界面显示中文规则名称，规则 ID 可展开检查。

## 来源及语义边界

固定 native 接线位于 `packages/source-host/patches/014-artifact-dynamic-a.patch`、`015-artifact-dynamic-b.patch`、`016-artifact-dynamic-c.patch`；a7 对应差异补丁位于 `packages/source-host/stellar-overlay/patches/015-artifact-dynamic-b.patch` 与 `016-artifact-dynamic-c.patch`。两套 Go 宿主通过 `ArtifactScalar` 传入实际查询状态，不能将这些 TS 公式视为独立游戏实现证明。

乐园遗落之花四件按 Go 源 `switch` 的分支实现：常规 Bloom／Hyperbloom／Burgeon 的基础项为 `0.4`、每层为 `0.1 × stacks`；DirectLunarBloom 的基础项为 `0.1`、每层为 `0.025 × stacks`。空分支不会 fall through。该规则现已按分支表达冻结；下方核心与 Go 构建验收范围仍应分别理解。

其余公式同样只表示原生 `Amount` 的 scalar 数值路径。例如绝缘四件读取来源本次的非额外 ER 并受75%上限约束；饰金按初始化记录的同／异元素队友数计算；如雷、翠绿、影中沉凝的幻灭等反应规则按固定来源分支 ID 限定 b4/a7；月兆等级或魔导秘仪状态仅在原生实际读取处作为参数传入。它们的门槛与事件时序仍由来源执行器负责。

不能据此声称整套圣遗物机制已经迁移或经游戏验证。其他 modifier 通道、状态和 lifecycle 仍按原生行为；来源未实现的规则不会因为存在类似 AST 而变为支持。此前共享的18条普通公式与39条常量公式也仍有各自范围限制；动态目录不改变角色／动作／游戏数据完成分母。

## 验收状态

核心测试2项首轮通过，收据 `docs/validation/source-artifact-dynamic-core-20260928.json`（0.697秒）。b4 与 a7 首轮 WASM 构建均失败：分别用时1.827秒、2.14秒，错误均为 Longnight／NightWhispers 方法中 `c`／`char` 不在作用域。四处 bridge 接收者修正为对应的 `s.c`／`s.char` 或 `s.core`／`s.char` 后，retry1 均通过：b4 3.624秒、SHA-256 `fb25458eae4191ab57d0c7f450999390da42c5269f5525e229080b50d7590725`、42,110,431 bytes；a7 4.019秒、SHA-256 `395682d9e3d34d211a071f2524f939140c2cf6ed61ad572150d43e8c79dbe068`、62,465,663 bytes。收据分别为 `docs/validation/source-artifact-dynamic-classic-build-retry1-20260928.json` 与 `...stellar-build-retry1...json`。

Web build 首轮因新 E2E evidence 可选字段不满足 `exactOptionalPropertyTypes` 而失败（2.420秒）；将证据字段类型改为允许其实际存在的 `undefined` 后 retry1 通过，3.483秒、690 modules、Vite 836ms。保留既有 chunk 警告。聚合 E2E 的最终结果见下文。

共享公式接线不是所有套装算术或机制的总覆盖。[边界盘点](cross-validation/artifact-dynamic-boundaries-20260928.md)指出，a7 的炉火融炼之心、血红之证仍无共享接线；另有非 `Amount` 数值路径留在 Go。142条／53目录只是共享 scalar 规则清单，不代表对应套装所有通道已迁移。

聚合 E2E retry1 通过：单用例12.1秒，runner 13.0秒，墙钟13.522秒，`errors: []`。首轮4.980秒失败发生于绝缘四件Q命中的独立编辑：该命中后还有Sucrose Hexerei AttackMod，生产端按保护规则正确将联动判为blocked。仅调整测试脚本，在Q后先追加行秋普通攻击再交给队友，以选中透明终端命中；未放宽保护或修改生产代码。

四条固定来源／场景运行共观察到20个唯一规则 ID（含b4/a7版本分支）、8套：ordinary b4 4,546 calculations／54 applications／4,474 dynamic calls／9 IDs；ordinary a7 4,530／54／4,474／9；lunar b4 345／57／245／9；lunar a7 316／57／245／9。四个选中命中均完成独立公式回放、差值0；纺月团队EM读数覆盖4名领取者，饰金攻击力0槽也保留其实际关联。此次没有运行乐园遗落之花四件（场景只有其两件34次调用），因此不能把该页面结果写作Flower 4pc验收；其公式分支有核心纯公式断言。

选中的绝缘四件公式读取ER `2.0125318020000003`，捕获值 `0.5031329505000001`；实验改ER为 `3.0125318020000003` 后按75%上限得到 `0.75`，原命中伤害 `421.60871347319085`、编辑联动伤害 `482.7203836502382`，原捕获保持不变，导出JSON重导入一致。实际measurements与运行聚合保存于 `docs/validation/source-artifact-dynamic-measurements-20260928.json` 和 `docs/validation/source-artifact-dynamic-20260928.result.json`；页面收据为 `docs/validation/source-artifact-dynamic-e2e-retry1-20260928.json`。

观察到的20个版本化规则／8套只是四个指定场景的实跑，不是85条动态规则全覆盖；也不改变套装／来源数据或 verified 分母。

最终 tracked whitespace 收据 `docs/validation/source-artifact-dynamic-final-worktree-20260928.json` 记录 PASS（0.056秒，HEAD `84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5`）。这不是对未跟踪文件或整体正确性的全面检查；本轮未提交或推送。
