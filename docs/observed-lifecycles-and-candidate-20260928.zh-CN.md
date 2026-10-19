# 观察式状态绑定与 7.1.51 隔离候选实施记录

本批已把奈芙尔普通 E、莉奈娅露米指定攻击、桑多涅指定普通／特殊伤害的观察事件接入独立计算器。用户提供实际事件和面板，核心按事件顺序恢复所选命中的状态，再执行已有伤害公式；不要求先建立队伍。三条路径的页面导入、编辑、未命中阻塞及 JSON 往返通过。与此同时，已归档新的 7.1.51 局部候选，并保留当前已发布、预览和 verified 指针。

这是完整目标中的一次交付，不是全角色、完整召唤物／重击周期、原生稳态或游戏内验证完成声明。最终 goal 仍 active。

**基线与范围。** 工作目录为 `/Users/evan/Documents/gidps`，继续使用现有提取工作树；HEAD 仍为 `84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5`，保留已有大量未提交工作。原主提示已完整阅读，本轮首先复核真实代码、剩余清单和数据证据，使用上一批已通过的来源构建作为现有基线。本批没有改 Go 来源或 WASM，没有重建它们，也没有重跑历史全套测试。原动作映射仍为 1,271 个模板、713 个条件完整动作、24 个 partial；其中 8 个观察式低／高下落模板、其余 16 个 partial 与另列的 8 个特殊组成不可混算。三条新增账本不提升这些静态分类。

**实际代码变更。** 三个纯 context schema、三个 reducer／命中绑定模块和三个独立控件模块接入 `calculator-model.ts`、`prepareSourceCastDocument`、计算轨迹及公开导出。计算器保存完整账本；选定命中仅重放到绑定事件，未选或后续事件不改变此前的数值状态。账本 JSON 草稿尚未应用时清除旧结果并阻止导出；应用后重新执行同一核心，切回该动作可恢复已应用上下文。无账本的既有独立单击入口保持可用。

| 路径 | 新增可执行状态绑定 | 保留的边界 |
| --- | --- | --- |
| 奈芙尔普通 E | 按帧和同帧次序处理独立帷幕、满层精通窗口、草露与每轮幻戏消费、C2 实际加层、C4 目标附近／离开尾效；把 E 时点的精通和减抗状态写入既有公式 | 不把 E 突进当幻戏重击；既有五段幻戏独立保留。实际回调时间、初态、同帧到期关系、命中最终面板和已含精通策略由用户给出 |
| 莉奈娅露米 | 实际 E/Q、供给、形态、结束与接触事件；普通双击分别绑定，特殊重锤／重压连接已有月结晶公式；Q 重置已存在露米寿命时保留形态 | 未知供给保持未知；不从持续时间生成攻击数或供给阈值。只选第一击时不要求未选第二击；同时选双击才核对共同 pairId |
| 桑多涅 | 观察热量、解析／超载和辉映，区分普通光束与星导／星旋替代组成；绑定 ID 在特殊组成重建后保留，观察值覆盖本击旧状态 | 仅使用来源明确的 100／低于 50 门槛，不生成热量速率、射击间隔或完整周期。无辉映的普通第二棱镜弹不错误要求 A1 热量门槛；特殊分支仍按实际热量计算 |

新增事件轨迹与原伤害轨迹一起展示公式、输入含义、代入值和解释。核心来源固定为 Genshin Optimizer commit `180a0a1015cb725c7570cd828eb086749960df98` 的各角色 sheet、参数和说明归档；具体引用保存在每个模块的 `*_SOURCE_REFS`。这些固定来源和用户观察不是独立游戏内验证。

**执行的必要检查。** 下列日志和[汇总 JSON](validation/observed-lifecycles-measurements-20260928.json)保留实际结果，没有把失败抹掉。

| 检查 | 实际结果 |
| --- | --- |
| 奈芙尔窄 reducer 测试 | 2/2，Vitest 3.13 秒；[既有工具输出转录](validation/nefer-focused-test-receipt-20260928.md)，未为留档重跑 |
| 莉奈娅窄测试 | 并行模块尚未落地时有一次 0-test 导入失败；随后 2/2，增加导入与共享计算夹具后最终 3/3、2.25 秒；[初次失败](validation/linnea-observed-lifecycle-20260928.log)、[最终日志](validation/linnea-observed-lifecycle-20260928.fixture.log) |
| 桑多涅窄测试 | 初始 1/1；增加绑定案例时有一次 0-test 并行导入失败，模块落地后 2/2、3.24 秒；[输出转录](validation/sandrone-focused-test-receipts-20260928.md)。后续来源审阅修正普通棱镜热量门槛，没有重复单测；整合构建与本批页面随后执行 |
| `npm run build` | 首次因新增模块的 TypeScript 可选字段类型和测试字面量类型失败，3.237 秒；修正类型后 retry1 成功，4.320 秒，778 模块，Vite 893 ms。现有大 chunk 和静／动态混合 import 提示仍存在 |
| 合并页面流程 | `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/observed-lifecycles.spec.ts` 首次成功，1 个测试、3 个场景，墙钟 3.775 秒，测试 2.6 秒；`pageErrors=[]` |
| `git diff --check` | 通过，0.074 秒；此命令只检查 tracked diff，不覆盖所有 untracked 新文件。执行于报告写入前 |

页面输入明确是教学观察和教学面板，不是真实游戏采样；数值用于检验上下文恢复，不能作角色强弱或 DPS 排名。

| 教学输入 | 原期望伤害 | JSON 恢复后 | 绝对差 | 改为未接触 |
| --- | ---: | ---: | ---: | --- |
| 奈芙尔 E | 3453.2289791999997 | 3453.2289791999997 | 0 | blocked |
| 露米单次重锤 | 3238.1853658536584 | 3238.1853658536584 | 0 | blocked |
| 桑多涅单次光束 | 2029.4279999999999 | 2029.4279999999999 | 0 | blocked |

[页面测量原件](validation/observed-lifecycles-measurements-20260928.result.json)记录了具体命中 ID、阻塞原因与新增轨迹节点数。三份完整输入可直接导入计算器并编辑：[奈芙尔](validation/nefer-observed-input-20260928.json)、[莉奈娅](validation/linnea-observed-input-20260928.json)、[桑多涅](validation/sandrone-observed-input-20260928.json)。莉奈娅核心夹具还实际验证反应增伤由 0 改为 0.1 后，期望值为 3520.6653658536584；该数值编辑是核心测试证据，并非本次浏览器编辑步骤。

**持续更新的实际交付。** [本轮外部证据刷新](data-evidence-refresh-20260928.json)发现 [Lunaris 版本索引](https://api.lunaris.moe/data/version.json)新增 `7.1.51`。使用已有 `update-data.mjs sync` 和 `validate`，向候选专属 `isolated-store` 摄取；没有调用会改变项目预览指针的 `preview` 命令。

六次公共 HTTP 请求均返回 200，实际抓取 11.175 秒。角色列表与旧 `7.1.50.2` 字节相同；Mitya／Valeriy 的中英四份 JSON 均改变。[原始差异](../packages/game-data/sources/lunaris-preview-7.1.51-20260928/revision-diff.json)共 204 行：114 文本、63 新增、11 删除、14 numeric-value、1 数组变化、1 新版本项。14 个数值行包含中英重复、超链接 ID 和 provider 时间戳，不能直接称为 14 项游戏数值改动。

候选快照为 `snapshot-77008c3d87b7116802ca00435af9b69290113c9e4ab8545877a5585d977af819`：2 角色、13 技能记录、431 字段，schemaValid=true、errors=0，inventory=unknown、readiness 为空、0 可执行定义。sync／validate 分别为 0.10／0.07 秒；prepare 无可靠全程计时，报告为 null。[摄取回执](../packages/game-data/sources/lunaris-preview-7.1.51-20260928/ingestion-receipt.json)、[候选报告](../packages/game-data/sources/lunaris-preview-7.1.51-20260928/candidate-report.json)和原始哈希均已保存。该候选仅在本地隔离 store，未出现在当前可选预览工作区，也未发布或远端执行 CI。

项目指针文件 SHA-256 仍为 `bcff67a4c25f405aac867e8924d3375dfa5405c2f08e5343c1f89977c7bc67e7`，runtime selector 仍为 `414badb3c7f2e145c039b61048507df6ae2160ce15fb377784a2a6c58f8de045`。active catalog 仍为 `953ea16…`，当前 preview 仍为 `93da650…`，active verified 仍为空。7.1.51 与 7.2 V1 的对应关系、完整版本名册和许可仍未确认；[genshin-db v5.2.14](https://github.com/theBowja/genshin-db/releases/tag/v5.2.14)标签仍为 7.1。当前 GitHub／Lunaris 可访问，不能把历史网络失败说成现在的全面阻塞。

**用户关心的产品入口。** 已有 124 个角色各两档、共 248 个可编辑“小毕业／大毕业”参考预设、18 个入门队伍模板、b4/a7 隔离的命名队伍库、可视动作与真实冷却／动画回执、GOOD／Enka 单人及 1–4 人批量交接继续保留。本轮只读核对这些入口，没有重复测试它们。现有两档都是 C0 参考投入配置，不是来源验证的最优毕业推荐；真实 Enka 网络请求及完整真实圣遗物整队案例仍不能由此前合成 GOOD 验收替代。

**剩余工作。** 三条新增绑定仍不构成完整露米 25 秒召唤、完整桑多涅重击周期或自动奈芙尔资源生成。需要实际事件、接触、面板与来源缺失部分；普通／特殊多个组成的完整生命周期聚合、广角色可组合执行的剩余语义、原生完整状态的相位收敛和随机稳态证据仍有代码工作。远程更新工作流、7.2 V1 的可信身份及完整名册、缺失装备机制和游戏内交叉验证仍有外部条件。详细范围继续由[剩余清单](remaining-product-implementation-20260928.json)管理；不能因为新增字段、通过构建或恢复差为 0，就把未验证机制标为完成。
