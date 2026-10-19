# 来源共享公式、星辉宿主与昭心固定实现（2026-09-27）

本记录合并本轮四项交付：固定 `b4ae769` 来源的标量来源回执（patch 004）、玩家受击与护盾前公式回放（patch 005）、独立 `a7dc4bf` 星辉 Go/WASM 宿主，以及昭心唯一显式固定 gcsim 自动配置。这些模块使用同一 TypeScript 伤害公式边界，但运行时来源、输入身份和许可证保持隔离。它们不改变角色分类：`.27` 仍为 124 身份／1249 命中模板／710 条件完整／16 部分／0 分类阻塞；游戏 verified 与 team-ready 仍为 0。

## 固定来源 b4：实际标量回执

Go patch `packages/source-host/patches/004-scalar-provenance.patch` 在 reaction bonus、敌人抗性和防御调整 getter 处记录实际读取值、modifier 顺序、过期／元素不匹配跳过、实际增量、输出上限，以及 `ReactBonus Amount` 闭包内部真实发生的属性读取。读取来自原运行；TypeScript 不重跑闭包，也不推测其内部规则。

共享解析位于 `packages/sim-core/src/source-host-scalar-provenance.ts`，并递归接入既有 `source-host-stat-provenance.ts`。回放校验顺序与每步 before／after、求和、上限和最终送入伤害公式的值；重复 ID、缺项、顺序不连续或数值差异会拒绝。闭包内部计算仍是不透明边界，相关说明缺口会随 trace 保留。对应 Go 收集入口在 `packages/source-host/go/pkg/core/sourcehost/scalar_provenance.go`。

保存的 classic host 构建记录为 [source-scalar-incoming-wasm-20260927.log](validation/source-scalar-incoming-wasm-20260927.log)／[exit](validation/source-scalar-incoming-wasm-20260927.exit)：exit 0，4.225 秒；导出 401 个包、解析 401 个键，保留 182 个 TODO 包与 493 个 TODO 标记，名册分析读取 1599 个实现文件（固定构建核对完整来源树的4021个blob）。构建产物 WASM SHA-256 为 `6d2c948d5f779d6cd645e4d2ca9bdbd8d1ce544fb532a1f013a1668e8d388bf0`，大小 41,858,303 字节。该记录证明此固定构建通过，不代表这些 TODO 已实现或当前游戏已验证。

## 固定来源 b4：玩家受击与独立单次回放

Go patch `packages/source-host/patches/005-player-incoming.patch` 在玩家受击公式处交给共享计算器前记录实际攻击身份、输入、随机抽样和暴击结果；原 Go 运行仍执行护盾吸收与玩家 `Drain`。`packages/sim-core/src/source-host-incoming-formula.ts` 用共享 AST 逐步呈现倍率与固定伤害、增伤、防御、玩家抗性、暴击、增幅和伤害组乘区，输出值对应进入 Go 护盾处理前的伤害。`source-host-incoming-capture.ts` 保存该次实际受击及递归引用的前置计算；身份、组件顺序或金额无法精确回放时拒绝恢复。

产品侧 `apps/web/src/source-host-panel.ts` 在来源宿主的实际受击账本中提供“在独立计算器中恢复玩家受击”；`apps/web/src/source-host-incoming-calculator.ts` 让用户编辑本次伤害输入并在共享核心重算。编辑保留原随机数／弱点身份，不重跑队伍或来源随机流，且不重放 Go 护盾与 HP；原运行的护盾吸收和 Drain 仍作为观察回执。结果明确列出限制：此来源实现把玩家抗性硬编码为 0；上游角色／装备属性闭包尚未全部展开；护盾和生命仍由原 Go 宿主处理。这是固定来源 provisional 结果，不是完整玩家受击机制或游戏验证。

本轮协作信息提到 scalar 单测 1 项、incoming 3 项及昭心 1 项针对性测试通过，但没有保存这些测试命令的日志或计时。因此这里不把它们写成可独立复核的验收记录；以上可确认的构建证据仅引用持久化 `.log` 与 `.exit`。

## 独立来源 a7：星辉宿主、身份及许可证

星辉实现放在独立 `packages/source-host/stellar-overlay/`，固定 gcsim revision `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`，不改变 b4 宿主、MIT 归属或其产物。`pins.json` 固定来源压缩包 SHA-256 `c0484e23afda76d7b38bb4fb49c2592b4b7bdccc8d549eaf8a4848e37aa55165`（64,166,679 字节）、完整 tracked tree 4283 个 Git blob、tree gzip／JSON 摘要，以及 Go 1.27.1 官方工具链平台包校验值。`a7-source-host.patch` 与独立构建脚本验证来源树和工具链后，产出独立 WASM、manifest 和许可证，并镜像到 `apps/web/public/source-host-stellar/`；普通 b4 构建目录不参与此流程。

身份／能力边界见 [`packages/source-host/stellar-overlay/README.md`](../packages/source-host/stellar-overlay/README.md)：a7 原始来源采用 AGPL-3.0-or-later；分发宿主时须同时保留原始 `LICENSE`、`LICENSE-MIT`、Go 与所链接模块的许可证通知，清楚标记 a7 来源身份。星辉贡献者选择、排序、最终交付、直接星辉伤害及非伤害星导事件由 a7 Go 源码执行；每次星辉来源计算同步调用 TypeScript 共享公式解析器，解析拒绝会终止本次运行，没有 Go 侧公式后备。请求和结果保留来源 commit，结果保留实际 WASM SHA-256。该宿主也可承载普通／月曜来源调用，但本次星辉记录单独身份化，不能切换正式目录或预览版本。

持久化执行回执 [`packages/source-host/stellar-overlay/validation/smoke-20260927.json`](../packages/source-host/stellar-overlay/validation/smoke-20260927.json) 标记 `executed-source-assumed-provisional`，记录 a7 commit、WASM SHA-256 `548a8b8bc2e3cc14e9eed129c4af696a8147c40ea7e12578d49bd58c24eb920d`、Go 1.27.1，并报告 4283 blobs 已核对。固定 Swirl 输入得到23次计算（共享公式、捕获各23次）、17次目标 HP 应用，实际观察到 Swirl 反应、Vortex、交付和直接伤害分支；固定 Conduct 输入得到38次共享公式计算、33次目标 HP 应用，观察到 Conduct 事件及直接伤害。两份示例使用假设属性，仅证明固定归档源码与同步公式边界可执行；不是游戏实测，也未裁决 guide/source 冲突。README 保留 counter `1→3→7`、gadget 类型不匹配、181帧寿命和范围差异等来源行为与限制，冻结贡献者、空间机制和全角色动作仍不在这份回执范围。

## 昭心：显式 gcsim 自动配置是第16个可运行来源模型

武器目录仍保留昭心目录／Optimizer 精炼倍率 `2.4／2.7／3.0／3.3／3.6` 及其50%概率描述；隐式目录自动触发仍有阻断。新增 `gcsim-implementation-v1` 是独立显式选项，profile ID 为 `gcsim-eye-of-perception-implementation-v1`，固定 b4 的 `internal/weapons/catalyst/perception/perception.go`，取倍率 `2.1 × 精炼序号 × 0.3`（R1–R5：`0.63／1.26／1.89／2.52／3.15`），按普攻／重击本人实际伤害回调检查精炼对应720／660／600／540／480帧冷却并触发，不抽50%概率。各次投射共享初始快照，初击与最多四次续跳各延迟10帧；每次从半径8范围选最近存活、36帧内未标记的敌人，在其固定位置以半径0.6造成物理伤害。

所以当前状态应写作：15把在既有常规自动配置中运行；昭心另有固定 gcsim 显式自动配置，来源模型总数达到16。不可把显式 gcsim 选择写成目录／Optimizer 自动规则已解除，更不可把冲突的系数和概率混合成一个游戏verified配置。`packages/reaction-formulas/src/independent-weapon-proc.ts` 保存目录自动阻断与 profile 分离，`packages/sim-core/src/weapon-proc.ts` 按明确选择解析定义，`packages/sim-core/src/__tests__/eye-of-perception-runtime.test.ts` 保存覆盖来源链、冷却和回放的测试代码。该测试没有单独保存的运行日志，故此处不声称已独立计量通过。

## 实际整合检查与数值

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| b4 WASM | 首轮exit0，4.225s；同源004/005编译，41,858,303字节 | [日志](validation/source-scalar-incoming-wasm-20260927.log) |
| 类型／网页构建 | 首轮exit0，648模块，3.468s；轨迹连接窄修后exit0，648模块，3.372s，Vite605ms | [首轮](validation/source-shared-stellar-build-20260927.log)、[最终](validation/source-shared-stellar-build-20260927.retry1.log) |
| 玩家受击页面 | 首轮通过，Playwright1.7s。6计算／5敌方命中／1玩家受击，10次标量读取；raw1000、盾吸收0、Drain1000，独立编辑为1100，完整JSON恢复一致，pageerrors=[] | [首次两项日志](validation/source-shared-stellar-browser-20260927.log)、[实际结果](validation/source-host-player-incoming-20260927.result.json) |
| 星辉页面首轮 | 失败；跨图childIds未在局部TraceBuilder注册，报 `Unknown or unexecuted trace child: stellar.5.sampled.total`；两页组合exit1、墙钟62.265s（含等待失败状态超时），不是模拟耗时 | [保留原失败](validation/source-shared-stellar-browser-20260927.log) |
| 星辉页面定点复验 | 只复验失败的1页，exit0、Playwright2.7s／整次3.5s、墙钟3.948s；420条来源名册；23计算／17命中，4贡献者、2排名、2交付、5直接星伤；初始命中3885.398600922288，编辑贡献者EM后4184.838308438685；原捕获恢复差0，编辑JSON再导入一致，pageerrors=[] | [复验](validation/source-shared-stellar-browser-20260927.retry1.log)、[实际结果](validation/source-host-stellar-20260927.result.json) |

修复把外部已执行轨迹在合并时关联，保留局部AST执行约束；星辉交付使用已有抗性AST，完整带上贡献者、排序、属性与标量读取，并修正原始抗性和抗性倍率的来源连接。受击页通过后没有再跑。没有重跑历史预设页、全角色矩阵、数据生成或大型随机。构建的大分块提示仍保留。

b4清单的旧能力字段随后按真实运行回执纠正为 `playerIncomingDamageSharedFormula:true`，并补`player-incoming`族；`metadataCorrections`记录修改原因。未重编译相同WASM，原构建脚本哈希和实际WASM字节身份保持，后续构建脚本也已同步该字段。这项元数据修正不改变上面执行结果。

## 剩余目标

- 原16个部分动作和8个观察特殊组成的完整自动生命周期、全部命座／被动及装备状态仍未齐。最新逐类清单见[剩余动作审计](research/remaining-actions-20260927.md)，旧`.23`分组已明确标为历史。
- b4玩家入伤的共享边界目前到护盾前；护盾内部和HP处理保留Go观察回执，不冒称已逐项复算。a7玩家入伤仍未桥接。
- 星辉源码的计数、实体类型、寿命与范围争议未裁决。二阶Vortex分支有代码接线，但本轮实际例子仅产生初始星扩散与一阶Vortex，不能把它写成二阶已测。
- 任意Go闭包内部公式、跨角色状态、完整检查点、任意队伍稳态及游戏独立验证继续缺失。昭心链的标记和在途快照未进入周期检查点，会保留明确阻断。
- 正式／预览数据指针和verified状态未改变；真实7.1.50不被重命名为已证实的7.2V1。没有提交、推送、部署或宣布全部goal完成。
