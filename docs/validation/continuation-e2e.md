# 增量浏览器验收记录

范围为 `apps/web/e2e/continuation.spec.ts` 的三个综合场景；本轮未重跑原有 43 个场景，也未扩大浏览器矩阵。运行 Chromium、单 worker。数值检查读取实际导出的记录及计算器共享审计 JSON；截图仅为界面证据。

## 已执行

1. `GIDPS_E2E_BASE_URL=http://127.0.0.1:5174 npx playwright test apps/web/e2e/continuation.spec.ts --workers=1`
   - 日志：`continuation-e2e.log`。
   - 结果：1 通过、2 失败，11.8 秒，exit 1。
   - 通过：凯亚装备来源贡献、天赋／技能编辑保留当前配置、来源例题与编辑副本区分。来源例题期望伤害 `36.990303894`；抗性改为 `0.2` 后为 `32.880270128`。
   - 两个测试预期已修正：随机暴击轨迹选择器限定计算器区域；三秒杜林 E 审计情景不能绕过十二秒冷却预热，应断言 `ABILITY_ON_COOLDOWN`、零启动行动、无测量结果。

2. `GIDPS_E2E_BASE_URL=http://127.0.0.1:5174 npx playwright test apps/web/e2e/continuation.spec.ts --workers=1 --last-failed`
   - 日志：`continuation-e2e-rerun.log`。
   - 结果：仅重跑 2 项，均失败，exit 1。
   - 此次受开发服务器页面重新加载影响：两个 Playwright trace 均记录同一页面再次出现 Vite `connecting`／`connected`；第一项等待导入期间种子变为默认 `legacy-default`，第二项进入行动编辑时配置已变回默认旧时间线。
   - 因此不能据此认定产品导入错误，也未为此修改产品行为或放宽记录／种子／数值断言。等待稳定构建后，只重跑这两个失败场景。

3. `GIDPS_E2E_BASE_URL=http://127.0.0.1:4173 npx playwright test apps/web/e2e/continuation.spec.ts --workers=1 --last-failed`
   - 使用固定构建预览；日志：`continuation-e2e-preview-rerun.log`。
   - 结果：1 通过、1 失败，10.7 秒，exit 1。
   - 第三综合场景通过：八元素抗性只改变指定字段、执行延迟实际生效、半开窗口数值、ER 无耗能行动阻塞、预热冷却阻塞，以及月感电／月结晶实际事件与计算器回放全部通过。
   - 随机记录导入发现真实错误：`restoreSimulationInputs` 使用冻结的旧版 `resolvedSimulationRuntimeOptionsSchema`，严格校验拒绝记录中的 `execution`。浏览器 `#jsonError` 显示 `ZodError`，输入保留导入前的种子。修复应改用当前版本 Schema，保留旧版格式限制；不放宽测试断言。
   - 流程内截图：`screenshots/lunar-charged-result.png`；已打开检查，显示显式身份条件、合成情景提示、暂定来源、总伤害与两条实际事件。数值仍由导出记录断言验证。

4. `GIDPS_E2E_BASE_URL=http://127.0.0.1:4173 npx playwright test apps/web/e2e/continuation.spec.ts --workers=1 --last-failed`
   - 使用修复后的固定构建；日志：`continuation-e2e-record-rerun.log`。
   - 结果：仅剩余 1 项通过，2.1 秒，exit 0。
   - 已修复当前运行记录的 Schema 选择，以及控制项同步中的抗性中间舍入。场景输入 `13.123456%`，源记录为 `0.13123456`；导入后整个 `sourceConfig` 精确相等。
   - 原始种子 `continuation-critical-20260923`、执行选项、实际延迟配置、逐击伤害／随机审计和批量统计均精确往返相等；只排除测量耗时这一非确定字段。模拟击送到独立计算器的重现差值为 `0`。

## 最终覆盖与边界

- 已通过：八元素抗性保存、实际执行延迟、半开伤害窗口和明确的 ER／预热阻塞状态。
- 已通过：月感电合成机制参考情景的总伤害 `14038.98825362727`、事件帧 `[15, 135]`，完整状态单击回放及显式条件编辑副本。
- 已通过：月结晶合成情景总伤害 `12552.165602901818`，快照帧 `[31, 43, 55]` 与投递帧 `[41, 53, 65]` 分离，完整状态单击回放。
- 已通过：固定种子的完整记录导出／导入后，输入、执行延迟、逐击随机结果和批量统计一致。

三个增量综合场景已累计全部通过：首项在稳定 API 的开发预览通过，第三项及剩余随机记录项在固定 4173 构建通过。未在最后构建后重复已通过的凯亚场景，也未重新执行原有 43 项；因此本记录不声称做过一次最终全量浏览器运行。本增量验收无剩余浏览器失败。

来源例题与月感电机制输入仍保留其暂定／合成标识，浏览器通过不等同于独立官服数值验证。
