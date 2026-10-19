# 定期数据源发现与候选摄取

`.github/workflows/data-discovery.yml` 配置为每周一 03:17 UTC 执行，也可从 GitHub Actions 手动触发。本轮只保存工作流，尚未推送或远端运行。工作流只有仓库读取权限，不提交改动、不建 issue 或 PR。

第一步运行 `npm run data:discover`，访问人工观察中已有的 `sourceUrls`，每个响应最多读取 5 MB，并保存 HTTP 状态、时间、字节数、SHA-256 和压缩响应。此步骤不发现新 URL、不解析发布身份，空 URL 列表会产生空检索结果。

第二步运行 `npm run data:sync:candidate -- --output artifacts/data-candidates`，动态查询 genshin-db 默认分支 HEAD、固定提交、归档 707 个当前实际 JSON 来源文件及许可证，再通过已有归一化器生成隔离候选。未来文件数随来源而变；结构不兼容时保留原始数据和错误。实际流程、命令和本地实采结果见 [候选摄取记录](data-candidates-20260928.zh-CN.md)。

候选默认版本与发布身份为 unknown，数值 unchecked、机制 missing。两个步骤均不修改活动数据指针，不自动晋升；需要独立发布证据和人工审核后，才通过现有同步、校验、比较与激活流程改变运行时工作区。

工作流将发现日志、压缩响应、固定源档案、候选清单和隔离快照作为 `data-discovery-<run id>-<attempt>` 产物保留 30 天；失败时仍上传已取得材料。这不是永久存储。当前实采来源与已有来源相同，没有产生新游戏内容；不能据此将预览声明为 7.2 V1。

工作流复用仓库当前 Actions 主版本；2026-09-28 查阅了官方 [checkout 发布页](https://github.com/actions/checkout/releases)、[setup-node 发布页](https://github.com/actions/setup-node/releases)及 [upload-artifact 发布页](https://github.com/actions/upload-artifact/releases)，确认所用版本存在。这项查阅不等于工作流已在远端成功执行。
