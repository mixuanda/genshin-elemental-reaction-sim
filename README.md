# 提瓦特伤害实验室

最新交付：[129–132 中文实施报告](docs/source-animation-eye-frontier-20261003.zh-CN.md)。新增技能归属与动画回调描述；必要构建和聚合页面检查通过，全量实现继续进行。
中文优先的原神单技能计算器与队伍轮转模拟器。独立计算器是长期保留的产品入口；单击、技能计算与队伍模拟共享 TypeScript 公式、状态处理和结构化执行轨迹。固定来源 Go/WASM 执行器提供另一条逐击来源执行路径，不能替代独立计算器或把来源包注册数当作完整支持证明。

2026-09-30：[本批报告（126）](docs/source-layla-ownership-20260930.zh-CN.md)为莱依拉 E/Q 接入护盾实例及延迟星矢归属，护盾刷新保留原实例和护盾量。Classic、Stellar 各自 1,730 帧组合场景完成，六次施放闭合、104 次选定逐击重放差为0，并与各自基线的伤害和动作日志一致；最终浏览器检查通过。正向 OnSkill 加星、破盾和其他边界仍未验证，结果也不是游戏内核验。activeVerified 仍为空，整体目标继续进行，详见[报告](docs/source-layla-ownership-20260930.zh-CN.md)与[来源实现日志](docs/source-implementation-journal.zh-CN.md)。

2026-09-30（10-03 补齐报告）：[岩造物出生与共鸣归属（127）](docs/source-construct-ownership-20260930.zh-CN.md)接入阿贝多 E 阳华、钟离 E 石脊的对象身份、技能所有者、共享快照和实际发出位置。最终 Classic／Stellar 构建、注册表、Web typecheck/构建与浏览器通过；每 lane 观察2,634帧、77次应用、72条动作日志，四次施放闭合，两 lane 共152次逐击重放差0，baseline伤害及动作／Origin日志一致。含128的最终注册表为107合同ID／105角色动作；尚无合同的E/Q原生绑定为Classic129、Stellar143，均非完整覆盖分母。魈 Q 与夏沃蕾 Q 规则只有源码／构建证据，没有角色运行。未审查私有状态、全技能覆盖、远端更新与7.2映射仍待完成；activeVerified不因此晋升，整体目标仍active。[最终测量](docs/validation/source-construct-ownership-measurements-20260930.json)。

## 安装与运行

需要 Node.js 24 和 npm：

```sh
npm ci
./serve.sh
```

`./serve.sh` 将开发服务器限制在本机 `127.0.0.1:4179`。打开 `http://127.0.0.1:4179/builds` 从角色配装开始；按 `Ctrl+C` 关闭服务器。首次运行前需要安装依赖，之后无需重复执行 `npm ci`。

开发服务器启动后使用以下入口：

| 路径 | 用途 |
| --- | --- |
| `/calculator` | 独立单技能计算、配装或导入面板、逐步公式、公开展示柜与 JSON |
| `/builds` | 浏览 124 个角色身份的两档可编辑参考配装，共 248 套 |
| `/examples` | 通过共享核心运行的可编辑教学例题；合成案例与来源实例分别标记 |
| `/team`、`/rotation`、`/results` | 队伍、行动序列、Worker 模拟、伤害与能量账本及命中回放 |
| `/source-simulation` | 固定来源执行器的队伍编辑和 Go/WASM 模拟 |
| `/compare` | 在共同假设下比较结果；正式目录与隔离预览分开 |
| `/data`、`/updates` | 查看目录范围、数据证据和候选更新状态 |

生产预览可用 `npm run build` 后 `npm run preview` 启动。

## 数据更新与来源执行器

使用 `npm run data:status` 查看本地已校验状态；`npm run data:sync:candidate -- --output artifacts/data-candidates` 固定上游HEAD、取得原始文件并生成隔离候选及差异，不改活动目录。候选更新按发现、同步、归一化、分类、验证和差异检查推进；隔离候选用 `data:preview` 选择，满足正式验证门槛后才可用 `data:promote` 晋升。`data:activate`、`data:rollback` 分别用于选择已发布目录和恢复目录。各命令参数、数据来源和状态语义见[更新流程](docs/update-status.md)。目录结构完整、条件定义存在或成功执行，都不等同于已验证。

固定来源准备和执行命令：

```sh
npm run source:prepare
npm run source:build          # Classic 固定来源
npm run source:build:stellar  # Stellar 固定来源
```

准备步骤校验固定来源提交；两个构建入口分别生成对应的来源宿主产物。来源宿主的实际注册包、可用配置键和已捕获机制应按所选规则及其来源说明判断。来源动作界面按实际角色方法提供选项，讨龙与普通武器叠层已扩展至适用的特殊宿主路径；必要检查与限制见[本轮记录](docs/source-actions-weapon-composition-20260928.zh-CN.md)。

## 已交付能力与限制

`/builds` 提供 124 个目录角色身份、每个两档参考配装；`/source-simulation` 有 18 个可编辑队伍模板。配装可继续调整并导入 GOOD 或公开展示柜数据；加入来源队伍时由当前来源规则选择精确角色形态。独立计算器仍可不建队伍，单独计算技能并检查公式、变量、代入值及中间结果。

来源队伍支持严格/自动等待政策和动作实例时间线；本地七种特殊宿主支持完整结果重执行导入。共享模拟支持实际行动、伤害、能量与资源账本，并提供可编辑的普通技能和来源实例。来源执行器按固定来源的行为推进，再将实际捕获的逐击输入共享公式；来源覆盖仍有边界，尚不能据此推断所有角色、装备或组合都完整支持。月曜等专门分支及部分武器、圣遗物、护盾、随机和敌方机制只在其明确标注的条件或例题范围内可用；细节与源码假设集中列在限制和实现报告中。

目录身份数量、预设数量、条件映射、来源执行能力和已验证能力各有独立口径。当前正式目录仍为 provisional，机器状态中的 verified 数量为零；暂定字段、分类命中或已执行例题均不代表游戏数值与机制已经正式核验。隔离预览也不回退到正式目录补齐缺失数据。候选快照范围和验证状态以如下生成状态块及[已知限制](docs/known-limitations.md)为准。

## Update Status

<!-- UPDATE-STATUS:START -->
以下事实由 `npm run data:status` 从校验后的本地清单生成。

- 最新官方版本观察：7.1（2026-09-28T02:35:53Z；发行商页面搜索索引列出 2026-09-23 更新安排，未归档完整官方原文）。
- 当前目录快照：gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2；发布状态 released。
- 活动已验证数据集：无（未晋升）。
- 官方下一版本候选：无观察记录；预览快照 2；归档快照 5。
- 当前隔离预览：Lunaris 7.1.50.2 / preview / `snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217`；米提亚、瓦列里 2 身份 / 2 天赋集 / 13 能力 / 2 命座集 / 0 武器 / 0 圣遗物套装；结构有效，可执行定义 0，数值与机制证据缺失。尚未证明等同 7.2 V1，provider 授权未知。
- 前一 preview `snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc` 保留于历史清单；已可选择历史 preview 并比较完整快照实体，页面显示前200项且导出全量JSON。计算器 URL 的 `snapshot=ID` 可精确恢复选中预览；本轮未测试JSON导入的历史快照选择。
- 最近同步成功：2026-09-28T02:29:19.724Z；最近尝试：2026-09-28T02:29:19.724Z；状态：success。
- 元数据：124 身份 / 127 天赋集 / 789 技能 / 255 武器 / 63 圣遗物套装 / 127 命座集。
- 数值已验证字段 0；机制已验证字段 0；单段 / 单技能 / 自定义序列 / 队伍已验证定义 0 / 0 / 0 / 0。
- 临时已分类命中 1271；已验证可执行武器 / 圣遗物定义 0 / 0。
- 字段评估 9025；缺失字段组 5366；独立名册整体状态 partial，按类别标记完整性，不报告项目总完成百分比。
- 独立名册 characters：124 预期 / 124 导入；范围 complete；缺少 0，额外 0。
- 独立名册 weapons：252 预期 / 255 导入；范围 partial；缺少 0，额外 3。
- 独立名册 artifactSets：63 预期 / 63 导入；范围 complete；缺少 0，额外 0。
- 有条件角色支持：124 角色 / 713 完整输入动作 / 24 部分动作；这不是完整角色验证。
- 有条件装备支持：201 武器 / 993 精炼变体 / 53 两件套 / 48 四件套；独立于 verified 通道。
- 可组合来源能力：15 角色 / 57 可执行来源动作 / 89 命中模板；仅来源数据 0 动作；正式 verified 0。这是独立分母，不增加条件动作或 teamReady。注册 gcsim-b4ae769-composable-abilities-v1；固定目录 snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34。
- 隔离预览可组合来源能力：snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217 尚无匹配来源能力摘要，不采用已发布目录的计数。
<!-- UPDATE-STATUS:END -->

## 代码结构

- `apps/web`：路由、中文工作界面、Worker 和公开展示柜代理。
- `packages/sim-core`：共享执行公式、技能计算、队伍模拟、DSL、状态账本和结构化轨迹。
- `packages/reaction-formulas`：反应公式；`packages/schemas`：输入、结果与可恢复执行状态格式。
- `packages/game-data`：正式目录、隔离预览、角色与装备映射、来源证据及更新流程。
- `packages/mechanics`：已实现并接入的角色专属机制。
- `packages/source-host`：固定来源执行器、配置名册和 Go/WASM 构建入口。

## 报告导航

- [来源实现日志](docs/source-implementation-journal.zh-CN.md)
- [来源严格/等待、实际输入窗口与完整特殊结果重现](docs/action-timing-special-replay-20260928.zh-CN.md)

- [当前项目审计](docs/current-project-audit.md) · [中文实施报告](docs/implementation-report.zh-CN.md) · [主需求状态矩阵](docs/master-requirements-status.zh-CN.md) · [来源有限技能与持续协同归属（109）](docs/source-owned-generators-20260929.zh-CN.md) · [固定来源延迟有限技能报告（108）](docs/source-delayed-finite-skill-casts-20260929.zh-CN.md)
- [单技能计算器规格](docs/single-skill-calculator-spec.md) · [数据来源与证据](docs/data-provenance.md) · [反应支持范围](docs/reaction-support-matrix.md) · [已知限制](docs/known-limitations.md)
- [角色配装、队伍模板与导入](docs/builds-rotation-import-20260927.zh-CN.md)
- [候选数据与队伍起步](docs/candidate-utilities-startup-20260928.zh-CN.md) · [来源变体与圣遗物组合](docs/source-variants-artifact-composition-20260928.zh-CN.md) · [来源生命周期与能量](docs/source-energy-lifecycle-20260928.zh-CN.md)
- [来源动作界面与武器特殊组合](docs/source-actions-weapon-composition-20260928.zh-CN.md)
- [变更记录](CHANGELOG.md)
