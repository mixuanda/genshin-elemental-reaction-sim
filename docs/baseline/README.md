# 原始基线证据

此目录只描述本次实施前的 `84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5`，不是最终实现验收结果。后续 QA 必须单独执行，不能拿这些日志替代。

- `baseline-metadata.json`：原始提交/tree、输入 ZIP 与逐项 SHA-256、主提示哈希、环境、隔离检查目录、旧路径存在性。
- `tracked-files.sha256`：原始 Git 跟踪文件的字节哈希。
- `git-history.txt`：原始最近 15 次提交。
- `package.json`：原始脚本及依赖版本声明副本。
- `catalog-inventory.json`：原始实际目录计数与信任标记；未知独立清单和准备度维度用 null 表示。
- `checks.json` 与各 `.log`：实际执行命令、工作目录、开始时间、经过时间、退出码、完整合并 stdout/stderr。

检查方法：从指定提交用 `git archive` 建立临时导出目录，第三方依赖复用现有安装；独立的 `node_modules/@genshin-dps-lab/*` 全部指回临时导出中的工作区包。最初便捷的整个 node_modules 链接经检查发现会回指正在修改的项目，因此在接受结果之前替换并重新执行了所有门。记录的最终日志均来自修正后的隔离执行。

原始历史 golden 与兼容投影证明旧行为复现；它们不会自动证明官服机制正确。新公式的来源、独立手算和正确性向量应在 `docs/cross-validation/` 及相应测试中单独记录。
