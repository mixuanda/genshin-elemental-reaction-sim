# 星扩散单项浏览器验收

范围：`next-increment.spec.ts` 中唯一的 `Stellar Swirl guide profile...` 场景。此前三个新综合场景已经通过，本次不重复执行。

## 首轮

命令：`GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/next-increment.spec.ts --workers=1 --grep 'Stellar Swirl guide profile'`。

日志：`stellar-swirl-e2e.log`；1 项失败，单项耗时 5.4 秒，exit 1。使用固定 4173 构建，无开发热重载。

失败发生在导入参考情景后的默认普通模拟，尚未进入星扩散专用执行。页面 `#jsonError` 显示：

```text
Trusted SimulationResult 1.53 integrity validation failed:
executionAudit.hits.6.input / hits.8.input / hits.10.input
does not reproduce captured formula input
(expected 1917.738548181818, received 0)
```

没有绕过导入、跳过审计或放宽数值断言。该首轮失败发生在星扩散执行之前，不能单独作为星扩散数值证据。

## 修复后复验

捕获审计此前漏乘真实反应组系数 `0`，导致零伤害事件恢复为非零。实现代理补齐该系数；未修改实际伤害核心数值。统一类型检查／构建后，使用相同输入与原断言执行同一条命令。

日志：`stellar-swirl-e2e-rerun.log`。**1 passed，2.2 秒，exit 0**。此前三个已通过场景未重复运行。

- 普通导入与命中完整性校验正常。
- 总伤害 `25208.73759373466 = 4381.875 + 20826.86259373466`，9 个特殊事件及交付顺序与参考输出一致。
- 初始事件人物快照在帧 6、交付在帧 9；风贡献者 EM 保留 `200`，实际交付抗性为 `-0.1`，不产生冰附着。
- 二级漩涡在帧 36 实际投递 `1U` 冰，保存所有者、目标、投递前后附着以及队列顺序回执。
- 同一次运行的初始事件与二级漩涡分别通过完整上下文恢复，计算器数值相同；往返页面未重新运行模拟。
- UI 与结果导出明确显示 `guide-profile-source-conflict`，没有消除指南与固定源码的计数／寿命／实体差异。高跳仅跟踪状态，`consumptionImplemented: false` 明确显示。

本单项浏览器验收无剩余失败。它验证所选参考规则可执行、可复现，不宣称来源冲突已解决或官服机制已核验。
