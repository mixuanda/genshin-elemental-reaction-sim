# 那维莱特独立初击与原生循环实测（2026-10-21）

本轮基于 `85d1a5a`，仅云端本地分支。旧独立 E HP 初击被完整弹体替换集合过滤，已恢复 `neuvillette-skill`；灵息之棘的 ATK 分量仍独立，不能算进 HP 初击。独立入口复用已有 A4 公式及逐击实际状态输入，不默认为满血。实际生命比例或已含 A4 水伤未知时阻断；已含份额扣除后不重复增伤。保留中文公式步骤和 JSON 往返。

新增五项核心测试覆盖未知状态、A4 未解锁、生命比例 0.3/0.5/0.8/1、ATK 不影响 HP 初击、已含增伤去重、序列化及最终面板转换。浏览器测试明确有效天赋 1、HP 20000、实际生命比例 0.5、已含 A4 份额 0，非暴击结果 `1296.6912`。只在 Linux Chromium 实测，未测试 Windows/Edge。

## 120 秒实际发现：尚未通过

新增 `apps/web/e2e/neuvillette-energy-cycle.spec.ts` 保留真实失败断言，不 skip、不接受错误 A4 数值。固定 Classic b4 来源，C0、90 级、天赋 1，口袋魔导书合法 70/70；额外 100% ER 与 45% CR 是受控输入，不代表真实毕业配装。四个 E 每次等待 750 帧，然后 Q；重复两轮。无重击、无敌方伤害、无反应，不据此宣称完整那维莱特机制。

两种开局能量 × 种子 12021/12022，四次原生运行都到 7200 帧，22 次命中（8 次 E HP 初击、8 次独立芒性 ATK、2 次 Q 初击、4 次 Q 瀑布）；Q 在第 3089、6473 帧消耗 70→0。捕获中基础伤害与固定倍率 × 实际 HP/ATK 的差值均为 0。

但 **A4 生命比例在初始化时记录为 0，水伤为 0；满血应为 0.3**。种子 12021 实际合计 18770.809461978366，满血手算应为 24402.05230057188；12022 实际 17229.46330998253，应为 22398.30230297729。两种开局能量结果相同，因为首轮 E 已先充满。暴击按各次真实抽样计算，未再乘期望暴击。

固定上游 `pkg/core/player/player.go` 的 `InitializeTeam` 先调用角色 `Init()`，后 `SetHPByRatio(1)`；那维莱特 `Init` 调用 A4，`asc.go` 的 `a4()` 当即 `updateA4()`，后续只在满足条件的治疗/扣血事件刷新。该循环没有这些事件，因此保留错误初值。这是需要修复并重新构建宿主的实际初始化缺陷，不能由 TS 端强塞 30% 水伤掩盖。尚未修改或重建 Go/WASM，未声称此循环通过。

## 证据与复现

证据根：`/workspace/GIDPS-cloud/neuvillette-20261021`。`source/manifest.json` 记录固定 b4 上游文件、SHA-256 和全部 Git blob 对照，原 MIT 文本保留。这是诊断来源子集，不是修改后宿主的完整对应源码包。

```sh
node node_modules/vitest/vitest.mjs run packages/game-data/src/classified-hits.test.ts packages/sim-core/src/__tests__/neuvillette-independent.test.ts
npm run build
npm run data:check
PLAYWRIGHT_BROWSERS_PATH=/workspace/GIDPS-cloud/browsers GIDPS_PREBUILT=1 node node_modules/@playwright/test/cli.js test neuvillette-independent.spec.ts neuvillette-energy-cycle.spec.ts --workers=1
node node_modules/vitest/vitest.mjs run --exclude packages/sim-core/src/__tests__/performance.test.ts --reporter=default --reporter=json --outputFile=/tmp/neuv-full.json
```

`before.json`、`targeted.json` 保留原失败与修复后断言；`browser.log`/`browser-output` 保留原生失败捕获，`browser-independent-verified.log` 是独立入口最终通过结果。早期浏览器尝试包含折叠详情未展开、默认天赋 10 的测试配置错误，未修改产品数值来适配它们。构建首次发现新测试缺少非空类型断言，修复后构建及最终类型检查通过。完整单测差集见 `regression-comparison.json`，浏览器新发现的原生失败单独计数，不能混成全绿。

本轮不更改历史读取/导出代码、不覆盖旧数据、不改变 schema 身份、不静默重算；保留旧结果可读/可导出仍是兼容原则，并不表示现有历史格式测试已全部通过。旧 Golden、EC 契约和历史格式失败未删断言。没有推送、合并、部署或更改根许可证。

## 最终同口径回归

`2834 pass / 89 fail / 2923 tests / 375 files`，耗时 622.79 秒。对比 `85d1a5a` 的 2828/90：修复旧 HP/DEF/混合属性保留测试 1 项，新增 5 项全部通过；新增单测失败 0、删除测试 0。剩余消费者 11、历史格式 45、Golden 身份/顺序 24、EC 来源契约 9。排除项仍只有 performance.test.ts，与基线一致。原生 120 秒浏览器新失败另计 1 项，独立入口浏览器最终通过 1 项。完整回归命令退出码 1，不能称全通过。
