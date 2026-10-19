# 自动候选采集（2026-09-28）

每周发现工作流现在还运行 `node packages/game-data/scripts/sync-genshin-db-candidate.mjs --output artifacts/data-candidates`。脚本从 [genshin-db 官方仓库](https://github.com/theBowja/genshin-db) 动态查询默认分支 HEAD，浅克隆后核对提交是否仍与发现时相同，再调用现有固定树摄入脚本。它只解析上游 JSON，不执行上游构建程序。此处的“官方仓库”指该社区项目自己的仓库，不代表游戏发行商发布确认。工作流尚未推送或远端执行。

每个 `genshin-db-<完整提交>-<投影哈希前缀>/` 候选包含固定树的 `source-tree.tar.gz`（实际原始 JSON、`package.json` 和许可证）、逐文件 SHA-256 清单、战斗数据投影、来源清单及候选清单。若当前来源格式可由现有解析器接受，还包含 `bundle.json`、`metadata.json`、生成目录与隔离的不可变 `snapshot-store/`。有活动目录快照时，脚本还会用现有 `diffSnapshots` 生成 `diff-from-active.json`，并在候选清单的 `comparison` 中记录两侧快照身份及各类增删改计数；没有活动快照时，清单明确标记 `unavailable-no-active-snapshot`，不会伪造零差异。候选清单分别记录 Git 提交、原始档案哈希、投影哈希、来源文件数、采集时间和结构处理结果。归一化失败时保留真实来源档案与错误，工作流失败但仍上传产物，供人工修正映射。产物保留 30 天；需要长期保存的候选须另行归档，Actions 保留期并非永久存储。

自动任务默认 `gameVersion=unknown`、`releaseStatus=unknown`。源码提交、npm 包版本和 JSON 内的版本字段均不能单独证明官方发布日期，也不能证明整套内容属于一个正式版本。人工有独立证据时，可显式传 `--game-version 7.2 --release-status preview --release-evidence-url https://...`，但这只记录人工归类；仍需逐项审阅真实来源、时间和冲突。未经独立核验的数值保持 `unchecked`，机制保持 `missing`；不会推断攻击倍率、帧、元素附着或完整名册。

工作流的候选全部写在 `artifacts/data-candidates/`，不修改 `packages/game-data/manifests/pointers.json`、运行时当前目录、人工官方观察或发布状态。只有审阅候选、补足证据并按 [更新流程](update-status.md) 显式同步、校验、比较与激活后，才可能改变应用使用的数据。隔离 `snapshot-store/` 中的指针只属于候选产物；它不是生产活动指针。旧版本与候选以独立身份并存。预览内容也必须采用明确的预览证据与独立工作区，不能从社区分支出现新条目就自动标为“7.2 V1”。

本地运行可指定空的输出目录：

```sh
node packages/game-data/scripts/sync-genshin-db-candidate.mjs --output /tmp/gidps-candidates
```

候选 `bundle.json` 与 `metadata.json` 供审核后按现有 `data:sync` 输入；之后用 `data:validate -- --id ...`、`data:diff -- --from ... --to ...` 复核字段、来源及身份，再决定是否人工激活。`diff-from-active.json` 是候选隔离生成时相对当时活动快照的字段级实体身份清单，可供审核；后续活动快照变化时，应重新比较。结构通过仅代表该候选符合当前数据 schema，不是游戏数值或机制验证。

本地实采一次：2026-09-28 查询到提交 `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`，投影 SHA-256 为 `6720353b1a8f5f9b26e96a7f117fcfe070c2be3ec469235b7dbae0eb5098d7e0`，涉及 707 个来源文件。候选在 `/tmp/gidps-candidates-20260928/`，结构归一化与隔离快照校验通过。这个提交及投影哈希与现有 7.1 来源一致，因此这次实采证明自动通路可用，却没有产生新游戏内容；正式发布观察、验证证据和活动数据均未改变。

离线比较适配验证记录在 [candidate-offline-diff-20260928.json](validation/candidate-offline-diff-20260928.json)。它使用上述已采集候选和当前活动快照直接调用 `diffSnapshots`，没有重新联网、运行候选生成器或修改原候选清单。该函数返回的实体变更清单约 13 KB；它将 124 个角色、127 个天赋组和 255 个武器标为 `changed`，没有增删，圣遗物套装、命座组及字段评估均为零变化。虽然来源投影哈希相同，此快照级字段差异仍需审核，不能据此声称上游加入了新内容。
