# 缺能 Q 后立即切人：定点浏览器验证

本次只运行新增用例 `rejected Q releases the next swap`，首次 **1 PASS，exit 0**。用例耗时 **794 ms**，Playwright 总耗时 **1.2 秒**。没有重试，也没有重跑此前已通过的 Q 血线分支、计算器捕获、JSON 重放或其他测试矩阵。

运行前统一生产构建已通过：全工程 TypeScript 检查、Vite 326 模块 / 366 ms。见 [构建日志](kuki-source-execution-build.log) 与 [退出码](kuki-source-execution-build.exit)。浏览器使用现有 `127.0.0.1:4173` 生产预览。

```sh
GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/kuki-burst-runtime.spec.ts -g 'rejected Q releases the next swap'
```

原始证据：[浏览器日志](kuki-source-execution-browser.log)、[退出码](kuki-source-execution-browser.exit)。本轮只在已有 [浏览器测试文件](../../apps/web/e2e/kuki-burst-runtime.spec.ts) 追加这一条测试，脚本入口沿用此前设置。

流程全部使用正常页面：载入 C0 来源 E／Q，在队伍页把久岐忍初始能量设为 0，返回轮转编辑器添加安柏切人并设置请求帧 565，然后预览、保存并运行 Worker。

| 核对项目 | 实际结果 |
| --- | --- |
| 预览 Q@564 | `未施放：能量 9 / 60`，无取消帧 |
| 预览切人@565 | 实际开始 565，状态“执行” |
| Worker Q@564 | `INSUFFICIENT_ENERGY`，实际能量 9，需求 60 |
| Worker 切人 | 565 帧开始，566 帧完成 |
| 最终前台 | 安柏 |
| 后续实际草轮治疗 | 654、744 帧均治疗安柏 |
| 未施放 Q 的附带记录 | 无条件分支、无扣能事件、无 Q 命中 |

这些结果证明该明确来源情景中的失败 Q 不再被静态动画占用误挡后续切人；预览和 Worker 均使用能量判定后的执行时序。测试没有弱化成功 Q 的动画限制或真实切人冷却。此浏览器流程只覆盖缺能后立即切人的实际路径；成功 Q 占用、连续失败和真实 60 帧切人冷却由本轮对应核心测试检查，浏览器未重复铺设矩阵。来源范围继续保持 provisional，不声明完整角色或跨引擎随机序列一致。
