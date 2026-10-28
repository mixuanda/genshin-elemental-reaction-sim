# 艾尔海森：受限配装的实际面板录入

基于 `67b3f25730105290dd0d9a18a4cc585cebbbe4c9` 的后续独立修复。C2跨触发／延后快照／命中精通变化时，具有精通转换规则的配装仍未实现多阶段重建，本次没有把该机制改为可计算。

## 实际故障与修改

原界面提示改用手动最终面板，但切换先要求把受限装备成功转换，用户无法进入录入界面。另一个数值边界是C2有效／已含层数相同、用户明确标记其余面板并非实际值时，旧判断仍允许计算；切换后选回“未知”也能错误放行。

现在只有未冻结、未结算的该类受限配装能够打开**待确认的实际面板草稿**：保留原构筑，预填值只是便于填写，不认证原配装，不创建成功转换的逐击快照或结算装备效果。用户填写实际攻击／精通／双暴、各段适用增伤和各阶段精通，再明确确认其他面板已是本击实际值后才能计算。实际状态没有由持镜数、导入面板或默认值猜出。

新增可选输入状态 `gameContext.alhaithamDamage.c2RequiresActualPanelConfirmation` 只标明这种录入途径需要确认，不是机制证据。未选、否、重新选未知以及保存重开都保持阻断；新导入或返回来源配装清除这项录入状态。已有手动实际面板的契约、原skillId和历史未含字段的记录不变；不覆盖原文件、重写旧结果或改Golden。

缺项收集器与核心采用同一确认条件，即使C2差额为0也提供对应控件，避免只显示泛化错误。

## 必要证据

证据目录 `/tmp/GIDPS-constellation-primary-batch-20261023/`：

- `actual-panel-before.log`：原浏览器切换失败。
- `manual-false-before.json`：明确非实际面板、C2差额为0的原断言失败。
- `manual-panel-unknown-before.json`：未知状态错误计算的原浏览器回执。
- `actual-panel-persisted.json`：66/66定向单元通过，包括61项原机制数值／负例、3项接线、2项草稿／历史保护；未降低原数值容差。
- `actual-panel-persisted-browser.log`：2/2 Linux Chromium，通过100级C3导入有效E13、计算、保存重开，以及受限配装→待确认草稿→未知→保存重开仍阻断→填实际值确认→计算→再次保存重开。无页面异常。
- `actual-panel-persisted-browser/` 保存实际截图与回执；第二例配装规则明确是合成UI夹具，不是已支持的真实武器机制。
- `build-actual-panel-persisted.log`：类型检查及前端构建通过。先前数据一致性检查已通过，未改来源目录数据，不重复运行全量。

独立样例：有效E10，ATK2000，实际触发EM300、逐击实际命中EM500，三镜分别实际命中，CR50%／CD100%，90级对90级，抗性10%，无其余增伤：

`3 × (2000×1.2096 + 300×2.4192) × 1.5 × 0.5 × 0.9 × 1.5 = 9552.816`

触发精通只进入原生加算基数，命中精通仅给A4的50%增伤，未把快照精通再次加给触发／命中阶段。浏览器与核心均核对该期望数值；它不是三镜生命周期、整队或随机循环期望。

验证期间发现长期开着的Vite进程提供旧版已缓存核心模块，已保存其实际响应并重启同一4205预览；核对响应为当前源码后完成最终验证，不将旧响应下的失败误归为新实现数值偏差。

## 复现

```sh
./node_modules/.bin/vitest run packages/sim-core/src/alhaitham-damage-formulas.test.ts apps/web/src/alhaitham-constellation-context.test.ts apps/web/src/alhaitham-final-panel-draft.test.ts
npm run test:e2e -- alhaitham-constellation-output.spec.ts
npm run build
```

本批未进行真实Windows或账号测试，未实现C4+、Q、完整镜生命周期或复杂跨阶段精通配装模型。历史完整回归3196通过／79失败／1跳过单独保留，本批定向通过不表示旧失败已清零。生产部署保持停止，不重试之前被拒操作。
