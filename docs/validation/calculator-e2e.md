# 独立计算器浏览器检查

环境：Chromium，已有生产构建预览 `http://127.0.0.1:4173`，单 worker。

初次执行：`npx playwright test apps/web/e2e/calculator.spec.ts --workers=1`，12.5 秒。模拟→计算器完整捕获/轨迹一致性场景通过；6 个场景因测试读取折叠元素 `innerText` 与公开展示模拟输入缺少 `playerInfo` 失败。

修正测试工具为 `textContent` 并补足合成响应的 `playerInfo` 后，只执行失败项：`npx playwright test apps/web/e2e/calculator.spec.ts --workers=1 --last-failed`，6/6 通过，5.7 秒。未因这些失败修改应用数值逻辑。

最终 7 个关键场景均已有通过证据：独立入口与 A 全部中间量/编辑重算；B 多段及错误反例；单击/选段/一次施放；JSON 和报告往返；杜林有效天赋与依赖阻塞；未知与已映射公开展示柜最终面板；完整模拟命中还原、共享渲染一致、差值 0；同批场景还检查 390px 布局无横向溢出及预览身份标记。

没有以截图替代数值断言，没有再次执行已经通过的相同测试。
