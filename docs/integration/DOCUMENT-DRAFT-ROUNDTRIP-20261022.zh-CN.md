# JSON 编辑、保存与计算状态一致性修复

起点 `e9f8f0b`，工作树 `/workspace/GIDPS-cloud/player-import-integration`，分支 `cloud/player-import-integration-20261021`。本块沿有限缺口清单的文档/消费者方向验证实际操作链路，发现一个新的 UI 数据丢失复现；不把它冒充原 86 项中的某项已清零。八项旧消费者和冻结格式投影的政策/来源限制没有更改。

## 先复现，再修改

导入既有真实诺艾尔来源配置，打开时不计算、不写本地副本。在 JSON 把时长从 6 改为 12 后，副本立即正确保存为 12；再选择满能量/不暴击，副本却被覆盖回 6。`before.json` 的前后附件及 `before.log` 保留正式失败（Expected 12 / Received 6）。

根因：JSON 的 input 处理器只保存文档，没有更新 `currentConfig` 和基本控件；控件变化保存旧对象，运行按钮也读取旧对象。导出又在旧对象和 JSON 草稿之间分别取值，进一步产生分叉。

## 实际修改

- 合法 JSON 先经过现有无损输入转换，再同步当前配置和基本控件；输入时不重写 textarea，不改变其文字格式或光标。
- 控件编辑、自动保存、导出和运行读取同一当前配置；控件更新后的 JSON 也同步。
- 未完成 JSON 或缺必要字段时阻断控件提交、两个运行按钮和导出。原有效副本与草稿文字均保留；修好后可以继续保存。
- “应用并运行”使用同一必要字段/无损门禁，不能先补默认字段再假装输入完整。

没有修改文档格式、历史身份、公式、引擎、来源动作限制、Golden 或原有测试。旧文件仍只读打开，编辑保存新格式副本，内嵌原始字节；`verification` 仍为 `not-recomputed`，没有把保存当成结果验证。

## 必要验证与独立数值

最终浏览器 3/3，通过且无重试：

1. 旧文件 → JSON 编辑 → 改运行选项 → 基本时长控件改为 18 秒 → 下载原件/新副本 → 重开 → 真实计算；打开不运行，原件字节不变。
2. 直接编辑合法 JSON 后点运行，正确消费新时长、抗性和种子，无须先切换其他控件。
3. 未完成 JSON、缺 randomSeed 的合法 JSON 均阻断两个运行按钮/导出，不覆盖已保存副本；修复后恢复保存。没有页面未捕获异常。

`project-document.test.ts` 原有 10/10；TypeScript 检查及 Vite 构建通过。没有全量回归，最近实际完整基线仍为 **2907 pass / 86 fail**。

数值样例保留诺艾尔固定来源 C0/T1/Lv1 配置、训练大剑、无圣遗物、无外部增益和暴击；仅改允许的敌人抗性为 20%。原角色属性受固定来源签名约束，初次测试尝试修改攻击力被正确拒绝，未放宽该门禁。最终用例使用合法输入，探索失败同样保留在 `after.json/after.log`；初次重复触发 change 后等待下载的测试超时也保留，最终采用正常 blur 提交。

独立 Python 50 位十进制计算（不导入模拟器）：

```
ATK = 39.2722 + 66.95325 × 0.4 = 66.0535
DEF 倍率 = 101 / 291
RES 倍率 = 0.8
伤害 = ATK × 各击倍率 × DEF 倍率 × RES 倍率
```

六击帧号 `[25,66,111,146,187,240]`，逐击最大绝对误差 `3.30584e-15`。手算总伤 `93.9351953428178694`，实际 `93.93519534281786`；18 秒窗口 DPS `5.218621963489881`，逐击和与总伤守恒。这是一次 Q→N1–N4 加空档的文档往返验证，**不是完整 18 秒持续循环，更不是新增 120 秒验收**。固定来源的 Q 持续、几何/卡肉等 provisional 限制沿用原说明。

原件 SHA-256：`f48b8dbfd1cefab3648a8f54744c854a48b33eb0804e1e13734816dccef686ef`。

## 复现命令与交付

依赖复用现有云端安装；如当前目录无 node_modules，先链接 `/workspace/GIDPS-cloud/latest/node_modules`。浏览器使用现有 `/workspace/GIDPS-cloud/browsers`，首次缺省路径找不到浏览器的启动日志也已保留，没有下载新执行物。

```sh
npm run build --workspace @genshin-dps-lab/web
npm run typecheck
npm run test:unit -- apps/web/src/project-document.test.ts
PLAYWRIGHT_BROWSERS_PATH=/workspace/GIDPS-cloud/browsers PLAYWRIGHT_JSON_OUTPUT_FILE=/workspace/GIDPS-cloud/document-draft-20261022/after-final.json npm run test:e2e -- --config=playwright.document-draft.config.ts --workers=1 --reporter=line,json
python3 docs/cross-validation/audit-document-draft.py /workspace/GIDPS-cloud/document-draft-20261022
```

证据目录 `/workspace/GIDPS-cloud/document-draft-20261022`，包括修改前失败、探索结果、最终浏览器报告/附件、原文档单测结果、构建/类型日志、独立审计、可重新导入的 `edited-document.gidps.json` 及补丁。

本块没有执行器或权限阻碍。实际验证为 Linux Chromium；未真实运行 Windows。历史格式投影/其他旧消费者剩余项未宣称修好。未 push、合并、部署、改根许可证、创建凭据或使用付费资源。
