# 轨迹按需展示：四项受影响浏览器流程

日期：2026-09-24。使用已构建的生产服务 `http://127.0.0.1:4173`，不重跑耐力、西风、随机起步或浏览器全集。本记录仅覆盖浏览器交互，不代表 checkpoint 核心验证。

首次命令：

```sh
GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/snapshot-stamina.spec.ts apps/web/e2e/critical-energy-actions.spec.ts apps/web/e2e/yanfei-startup.spec.ts apps/web/e2e/calculator.spec.ts --grep 'Ningguang twelve-gem Q|Keqing Q and Xingqiu E|Yanfei charged cast|calculator independently renders fixture A'
```

实测 4 项中 1 通过、3 失败，总 36.0 秒，exit 1。刻晴 Q／行秋 E 流程通过（16.2 秒），没有重跑。其余失败及处置：

- 教学 A：原测试的 `summary` 同时命中步骤及嵌套的来源展开按钮；只把定位缩至步骤直属 `summary`。
- 烟绯：修改丹火印数后直接点击 A4 卡片，输入失焦触发重复 `change` 重绘，替换正在点击的元素，展开操作丢失。这是实际交互问题；root 删除已由 `input` 完成的数值字段重复刷新。测试保留直接 `fill` 后点击，没有插入 Tab 绕过问题。
- 凝光：新增折叠／键盘／去重／保留展开与更新数值断言通过，但完整 JSON 往返后默认 30 秒预算耗尽。已有 trace 显示大审计文本的 DOM 快照开销，不能当作用户延迟。设置专属 describe 的 trace 配置被 Playwright 拒绝，因为 trace 是 worker 级选项；这次收集失败 exit 1，没有执行任何测试。随后采用文件顶层 `trace: { mode: 'retain-on-failure', snapshots: false }`。保留操作／错误记录、全部断言和默认 30 秒预算；同文件耐力测试逻辑不变且本轮未执行。

仅复验前述三项失败：

```sh
GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/snapshot-stamina.spec.ts apps/web/e2e/yanfei-startup.spec.ts apps/web/e2e/calculator.spec.ts --grep 'Ningguang twelve-gem Q|Yanfei charged cast|calculator independently renders fixture A'
```

最终 3 项通过、总 5.0 秒、exit 0：教学 A 789 ms；凝光 2.0 秒；烟绯 4.2 秒。完整原始记录依次为 [首次执行](render-checkpoint-e2e.log)／[退出码](render-checkpoint-e2e.exit)、[收集失败](render-checkpoint-e2e-retry.log)／[退出码](render-checkpoint-e2e-retry.exit)、[三项最终复验](render-checkpoint-e2e-retry2.log)／[退出码](render-checkpoint-e2e-retry2.exit)。

凝光新增验证明确覆盖：折叠卡片尚未挂载轨迹但完整 audit JSON 已存在；Enter 展开后每个节点的值、公式和代入与共享核心轨迹一致；关闭重开只有一份表；历史 A4 改变后卡片及具体计算步骤保持展开，贡献值更新至 0.12；原有完整十二枚及选定单击 JSON 往返、历史数值独立和清除阻断断言全部保留并通过。

性能表述边界：root 的同输入单次探针（无 Playwright DOM 快照、有 CPU profiler）在修改前为 83.556 ms、23079 个元素、4004079 HTML bytes，修改后为 79.802 ms、573 个元素、2580389 HTML bytes，期望伤害均为 10401.2856。原始结果：[before](calculator-render-before.json)、[after](calculator-render-after.json)。这是减少折叠轨迹 DOM 的证据；不是“5 秒降至 80 ms”，也不是统计性能基准。
