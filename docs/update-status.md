# Update Status / 更新状态

<!-- UPDATE-STATUS:START -->
以下事实由 `npm run data:status` 从校验后的本地清单生成。

- 最新官方版本观察：7.1（2026-09-28T02:35:53Z；发行商页面搜索索引列出 2026-09-23 更新安排，未归档完整官方原文）。
- 当前目录快照：gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2；发布状态 released。
- 活动已验证数据集：无（未晋升）。
- 官方下一版本候选：无观察记录；预览快照 2；归档快照 5。
- 当前隔离预览：Lunaris 7.1.50.2 / preview / `snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217`；米提亚、瓦列里 2 身份 / 2 天赋集 / 13 能力 / 2 命座集 / 0 武器 / 0 圣遗物套装；结构有效，可执行定义 0，数值与机制证据缺失。尚未证明等同 7.2 V1，provider 授权未知。
- 前一 preview `snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc` 保留于已保存且通过结构校验的preview清单；已可选择历史 preview 并比较完整快照实体，页面显示前200项且导出全量JSON。计算器选择器是 `#calc-preview-snapshot`，URL参数 `snapshot=ID` 可精确恢复选中预览；本轮未测试未知snapshot URL或JSON导入后的历史快照选择。
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

## 实际更新流程

Node 24 命令以已安装依赖运行。发布、解析、数值、机制和按依赖得到的计算支持独立；有条件可执行不自动成为正式 verified。

| 命令 | 实际行为 |
| --- | --- |
| `npm run data:discover` | 获取配置的官方来源，缓存访问状态与原始字节指纹；不自动推断发布事实 |
| `npm run data:discover -- --offline` | 读取最近人工核对的发布观察，不访问网络 |
| `npm run data:sync:candidate -- --output artifacts/data-candidates` | 固定上游 Git 提交并取得隔离候选，保存归档、处理回执及失败账本；不自动激活项目目录 |
| `node packages/game-data/scripts/update-data.mjs review --output artifacts/data-discovery/review-receipt.json` | 汇总来源发现、候选处理及两个失败账本，生成可在更新页只读导入的任务回执；可加 `--fail-on-errors` 用于任务最终状态判断 |
| `npm run data:normalize` | 重建固定供应历史目录，并复核/生成当前活动快照的运行时投影与覆盖摘要 |
| `npm run data:check` | 检查上述内容是否可重复、覆盖摘要是否陈旧及圣遗物词条源文件哈希 |
| `npm run data:sync -- --input bundle.json --metadata source.json` | 保存原始输入和新不可变候选；已存在活动目录时不覆盖它 |
| `npm run data:classify -- --id SNAPSHOT --details` | 输出保存的逐字段评估，保留人工交叉核对记录；原始百分比不自动变伤害定义 |
| `npm run data:validate -- --id SNAPSHOT` | 核对完整 schema、来源引用、字段依赖、哈希和独立名册的分类完整性 |
| `npm run data:diff -- --from OLD --to NEW` | 按稳定 ID 比较实体与字段评估；provenance 变化不等于倍率变化 |
| `npm run data:activate -- --id SNAPSHOT` | 只允许 released 且结构/哈希通过的目录，原子切换实际运行时目录、索引、补充数据与身份；保持原 verified 状态 |
| `npm run data:promote -- --id SNAPSHOT` | 还要求存在依赖完整的 verified 定义，再切换正式验证指针与运行时目录 |
| `npm run data:rollback -- --catalog` | 复核历史目标并实际回退运行时四件投影，不改历史发布标签 |
| `npm run data:rollback` | 回退正式验证通道和对应运行时目录 |
| `npm run data:preview -- --input bundle.json --metadata source.json` | 要求真实 preview 输入，仅更改独立预览工作区，不进默认运行时 |
| `npm run data:status` | 从当前快照与模块导出的真实覆盖生成 JSON、README/本文事实块 |

当前已经把真实 7.1 目录接入浏览器和计算器数据读取。`manifests/runtime/current.ts` 是一次原子替换的权威选择模块，四个导出指向同一不可变目录；`pointers.json` 是审计镜像。Vite 开发时会重新加载此模块；静态部署需正常重新构建，已经打开的旧静态包不会由本地 CLI 远程热替换。

2026-09-29 已补齐更新运行回执：发现请求的 HTTP 错误与抓取失败、候选早期采集或标准化失败均保留阶段和原因。每周工作流先上传日志、原始字节、候选及两个失败账本，再根据实际步骤结果报告失败。`review-receipt.json` 可在更新页“更新运行与候选审核”导入；页面会区分构建内的本地清单与导入文件，不把它们称为远端实时状态，也不更改活动数据指针。对自定义候选输出目录，汇总时传入 `--candidate-run 路径/run-status.json`。人工审核仍须依次完成来源身份核对、差异与字段验证，再执行上表的目录激活或正式验证晋升。

本轮仅执行隔离的 localhost 抓取失败及模拟 Git 失败样本，两条错误成功进入回执并在页面显示；没有执行远端工作流或重新抓取 provider。实际项目状态刷新时没有保存的发现/候选运行回执，相关字段为 `null`，不能读作“任务成功”。完整证据见 [本批报告](./source-status-owner-and-update-20260929.zh-CN.md)。

目录激活与正式验证晋升是两个操作。此次只激活 released/provisional 目录，`activeVerifiedSnapshotId` 仍为空。字段的 `dependencyFieldIds` 决定各命中/动作是否可正式验证；无关爆发未完成不封锁一个已具备相应证据的选中命中。预览或 official-next 不能通过默认激活或正式晋升。

有条件角色支持来自 `getClassifiedHitCoverage()`，有条件装备支持来自 `getConditionalEquipmentCoverage()`；生成 JSON 绑定活动 datasetId，`data:check` 会发现源代码或活动目录变化后的陈旧结果。完整动作计数表示该动作的当前输入覆盖，不等于全角色/循环支持；装备计数包含手工输入触发条件的部分映射，不等于自动模拟全部被动。已验证定义另栏保持精确数量。

## 当前真实预览与版本观察

2026-09-28 02:35:53 UTC 的最新发行商页面索引观察仍指向正式版本 7.1，索引正文列出 2026-09-23 06:00 UTC+8 更新安排。英文详情直接读取失败，未归档完整官方原文；Lunaris `7.1.50.2` 仍未证明等同“7.2 V1”。

当前隔离预览来自 Lunaris provider 版本 `7.1.50.2`，snapshot `snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217`，仅含米提亚（10000136）与瓦列里（10000137）、2 天赋集、13 非空能力、2 命座集；武器与圣遗物套装均为 0。字段槽和来源数组以原始差异归档；浮点表示差异不当作平衡变化。该快照结构校验有效，但数值/机制证据缺失、inventory 未知、可执行定义 0；0 武器/套装仅表示这个两角色候选未采集相应类别，不是全版本数量。provider 再分发许可未知。

当前隔离 preview workspace 已选中新 snapshot；前一 `7.1.50` 快照 `snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc` 可从已保存且通过结构校验的preview清单中选择并对比。计算器选择器 `#calc-preview-snapshot` 与URL参数 `snapshot=ID` 是两个独立入口；已测的已知快照URL可精确恢复。代码遇到未知snapshot URL会载入失败且不显示默认教学伤害，但本批未page-test此行为；JSON导入后历史快照选择同样未测。新局部候选中武器／圣遗物采集条目为0，不表示整个版本没有装备。页面限制展示前200项，完整差异JSON可导出。正式7.1目录与active verified指针保持原值。入库收据未捕获完整命令wall-time，不能据tool wrapper时间报告性能；provider原文哈希、结构差异与摄入状态见 `sources/lunaris-preview-7.1.50.2-20260928/`。

## 剩余数据阻碍

- 已有可复核的7.1.50.2两角色部分快照；7.2 V1身份映射、完整清单及数值语义／机制核验仍缺，不能把该快照重命名为7.2 V1或称完整预览。
- 124 身份/63 套装与独立版本内容名册匹配；武器 252 普通名称与 3 个任务变体已对齐口径，但全游戏独立武器分母仍标 partial。
- 多数角色/装备的帧、状态、能量、命座和条件机制尚未取得逐项独立验证；新数据解析成功不自动晋升支持级别。
- 官方正文的直接下载受限，实际网页观察保留 URL/时间；不可取得的正文 SHA-256 明确为 null，不把 HTML 外壳当正文证据。

来源、日期变化、原始/派生字段与本轮测试见 [data-provenance.md](./data-provenance.md) 与 `research/`。
