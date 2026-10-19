# 实际项目基线审计（改动前）

审计时间：2026-09-22T14:29:49Z。本报告先于本次应用重构写入；下列内容描述冻结的原始提交，后续实现结果见 QA 报告。初版明确将检查列为待执行；本次补录为隔离基线实测结果，未将后续应用改动混入。

## 选择的基线与输入辨识

- 工作目录：`/Users/evan/Documents/gidps`，分支 `main`，提交 `84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5`，tree `72bd69a8c54a3e115685c7ee52f5862064c70f55`。
- 初次 `git status --short` 没有输出，工作区干净。保留其完整 Git 历史，不从远端覆盖，不提交或推送。
- `/Users/evan/Downloads/Archive.zip` 实际为 88 条 MATH1010 课程 PDF 等文件，未含项目 package.json；71,339,336 bytes；SHA-256 `10a6ea0cdba8b2c17c36471d6ec6ce64f5446882eb73c801d3e31c8d9e9dbd25`。它不是 master prompt 描述的原神源码包，不能拿来覆盖项目。
- `/Users/evan/Downloads/genshin-dps-lab.zip` 为 7 文件 vanilla 旧版本，286,075 bytes；SHA-256 `9106a8e8d553b9fbe4f881b5bce9d98810acefa23ae234403e37da02148a4aab`。全部 7 个文件与 `legacy/v0.1-vanilla/` 对应文件逐字节相同。现有仓库保留旧输入且已有大量后续实现，因此选择当前干净 HEAD。
- 主提示完整读取；文件 SHA-256 `54f4068825f203192593c3134c79e0ef27c34dafb27753020fb40db3bd7e6855`。其中列出的 `SingleSkillCalculator.tsx`、`packages/core/*`、`packages/data/*`、`packages/enka/`、`packages/shared/` 共 10 个候选路径全部不存在。不能把该文档关于旧包结构的观察当作本项目事实。
- 可重复基线以 Git HEAD、逐文件 SHA-256 和隔离导出目录冻结。检查在 `/var/folders/3k/lmzjz_h51dn_5rdqvwffprph0000gn/T/gidps-baseline-kjlvbhfr` 执行，源码由 `git archive HEAD` 导出，仅共享第三方已安装依赖；所有 `@genshin-dps-lab` 工作区包链接均指向隔离导出目录，已用 Node 模块解析验证，不会受并行实施编辑影响。依赖版本由 package-lock.json 固定。

## 原始包边界与界面

- `apps/web`：Vite + TypeScript vanilla DOM 界面，主逻辑在 `apps/web/src/app.ts`，不是 React。
- `packages/schemas`：配置、输出、数据目录、公开展示柜 Schema 与完整性门。
- `packages/game-data`：固定 genshin-db / Enka 元数据、目录生成器、样例预设、展示柜解析。
- `packages/sim-core`：纯公式、事件/行动时间线、能量、Aura、ICD、目标状态、反应、实体与结构化结果。
- `packages/reaction-formulas`、`packages/icd-profiles`：版本化公式和执行策略根；`packages/mechanics`：有限角色执行机制；`packages/test-vectors`：历史兼容与回归向量。
- 网页实际是 `/` 单页下的 5 个标签：总览、时间轴、逐段伤害、账号展示柜、高级配置。页面内部另含伤害曲线、目标命中、粒子/能量、Aura/反应审计与 JSON 预设编辑器。单段伤害公式只依附模拟结果。基线没有独立 `/calculator`、Worked Examples、Compare、Data Explorer 或 Update Status 路由；URL fallback 返回同页不等于已实现独立功能。
- 已有预设 JSON 导入/导出和公开展示柜 JSON/UID 流程；必须保留并在新增计算器工作流中验证真实效果。

## 原始数据计数与信任状态

| 类型 | 实际条数 | 原始状态 |
| --- | ---: | --- |
| 角色目录记录 | 120 | 全部 metadata-only + provisional |
| 天赋集合 | 125 | 全部 metadata-only + provisional |
| 天赋 ability 记录 | 762 | 原始描述/参数，不等同 762 个伤害动作 |
| 武器目录记录 | 237 | 全部 metadata-only + provisional |
| Enka 映射 | 148 | 数字映射，非机制验证 |
| 圣遗物套装目录 | 0 | 基线目录无此字段 |

上述是输入记录数，既非独立建立的正式服总名单，也非可模拟数，旅行者/变体口径需另行规范。目录的游戏标记为 `6.7`、生成时间 `2026-07-26T00:00:00.000Z`，catalogVersion 为 `gi-6.7-zh-CN.genshin-db-5.2.12.enka-2b9d23b.1`。生成器硬编码 `GAME_PATCH = "6.7"` 及 catalogVersion，Schema 的 gamePatch 已经是非空字符串。未验证实时官服版本，不能把 6.7 或文档请求的 7.1/7.2 视作本次观察事实。

目录的 120/125/237 记录没有自动声明 verified：均明确 provisional、metadata-only。基线未发现提示所担忧的“把每个百分比自动认作 ATK 且标为 verified”的分类生成器；这不证明后续分类可省去证据。武器 refinement 文本不等于可执行被动；没有全面装备/命座执行定义。

原始 schema/engine 为 1.53.0 / 1.53.0-callback-bus；已有广泛经典反应、Aura、ICD、伤害组、冻结、结晶、草原核、目标时钟、能量与完整性回归。参考实现大多明确为 fixed-gcsim-provisional/community-provisional，不能称官服真值或全角色覆盖。Lunar/Stellar、完整可执行角色/装备库、独立伤害教学追踪、可编辑例题、持续版本更新系统在基线均未完成。

## 检查与基线证据

环境：macOS-27.0-arm64-arm-64bit-Mach-O，arm64，Node v24.15.0，npm 11.12.1。

| 命令 | 首次状态 |
| --- | --- |
| `npm run data:check` | PASS；120 角色 / 125 天赋集合 / 762 ability / 237 武器生成可复现；退出 0；0.820s |
| `npm run typecheck` | PASS；退出 0；1.311s |
| `npm run test:unit` | PASS；155 文件、1,858 测试；退出 0；85.141s |
| `npm run test:performance` | PASS；1 文件、3 测试；退出 0；3.833s |
| `npm run build` | PASS；有 chunk >500 kB 警告；退出 0；1.905s |
| `npm run test:e2e` | PASS；Chromium 36 测试；退出 0；25.156s |
| lint | 无 lint 脚本；不虚构检查通过 |

精确命令、时间、退出码和原始 stdout/stderr 已写入 `docs/baseline/checks.json` 与同目录 `.log`。`baseline-metadata.json` 保存归档逐项哈希、路径验证与环境；`tracked-files.sha256` 保存原始 tracked files 哈希；`git-history.txt` 保留最近提交标识。

`packages/test-vectors/fixtures/legacy-*` 及兼容投影用作旧行为复现证据，不是独立正确性证明。新增教学例题 A/B 以及来源核实后的公式边界测试应独立归为正确性 fixtures，不能为了历史 golden 数字保留已知错误。


### 基线性能实测与解释边界

三个场景各预热 1 次、测量 21 次，运行 120 秒的确定性模拟，保留基线默认结构化审计输出。性能门要求 median <100ms 且 maximum <250ms；不把单个桌面测量推广为所有输入保证。

| 场景 | mean ms | median ms | p95 ms | max ms |
| --- | ---: | ---: | ---: | ---: |
| 基线 120s 预设 | 28.899 | 27.971 | 32.632 | 40.050 |
| 运行时能量前缀探测 | 6.109 | 5.716 | 7.436 | 7.503 |
| 持续燃烧 | 89.567 | 88.080 | 97.451 | 111.747 |

燃烧场景保留 479 次 tick、119 次刷新、1,198 条目标状态；总伤害 `305928.90484071366`、DPS `2549.4075403392803`。这是固定旧规则复现值，并非新的游戏真实性验证。基线没有执行“关闭详细 trace”或 Monte Carlo 吞吐测量；本次实现需要另行报告，不能用以上数据填补。

构建转换 141 个模块；主 JS `1,746.85 kB`（gzip `387.15 kB`）、CSS `9.89 kB`、HTML `26.41 kB`，存在构建体积提示，构建退出码仍为 0。36 项旧 UI 流程全部通过，其中展示柜使用 mock；未对真实用户 UID 或在线 Enka 服务做请求测试。原始基线没有 calculator 页面，旧 E2E 通过不表示满足新增独立计算器验收。


### 来源交叉验证发现的具体基线缺陷

后续独立读取固定 gcsim 文件发现：基线白 E 的“Durability 未设置/无附着”备注与引用源码相反，且旧测试固定了错误无反应输出。该缺陷已作为正确性修复单独处理，详见 `docs/cross-validation/durin-white-e-correction.md`；本目录冻结的原始源码哈希及原始通过日志保持不变，避免把旧行为复现当作来源正确性验证。
