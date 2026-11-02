# 单次语义校验快照缓存

基线：0ff35a7，云端 Chromium，Classic 固定来源，班尼特/凯亚/香菱/砂糖，合法测试配装，120 秒，seed 12021。未改变 WASM、公式、随机消费、历史格式或导入契约。

CPU profile 指向能量/治疗重放反复创建解释：冻结约 1973 ms、structuredClone 1277 ms、GC 558 ms。只做这一项优化：在整次结果规范化的能量/治疗验证阶段，构造独立 schema 校验、深复制和冻结的公式记录快照；缓存只认该快照拥有的 request 对象。返回只读 facade，不暴露 Map 写入口，forEach 的第三参数也为 facade。返回的计算/解释同样冻结。

快照不跨运行保存；新配置、版本、新导入自动建立新上下文。外部可变 request、普通回放 Map、装备编辑和显式缩放不享受该缓存。仍执行原来的逐击、源、身份、帧、归属和值校验；缓存不证明导入记录可信。旧记录不覆盖、不重算。

## 实测（各一次，不是统计置信结论）

| 同口径指标 | 前 | 后 |
| --- | ---: | ---: |
| 浏览器事件捕获点击至结果两次 RAF | 14.5533 s | 11.8357 s |
| Playwright click 前至结果可见及两次 RAF | 21.5582 s | 17.0038 s |
| Worker 语义校验 | 5.3854 s | 2.9740 s |
| 原生计算 | 7.7555 s | 7.5238 s |
| DOM 绘制 | 0.4191 s | 0.4190 s |
| 离线校验（均启用 CPU profiler） | 7.2253 s | 4.8056 s |

实际点击延迟下降约 18.7%，语义校验下降约 44.8%。现阶段原生计算仍为主耗时；不能将此称为秒内运行或将回放倍率当计算加速。单技能不在本轮重复测量。

## 验证与复现

- 5 项针对性单元测试通过：完整解释和值相同、同对象缓存、可变外部请求不缓存、上下文隔离、嵌套不可变、错误身份拒绝、缓存预热后能量篡改拒绝。
- 真实浏览器 1/1：全部 calculations/applications/randomness/abilityInvocations/energyApplications/healingApplications 与此前真实记录逐项完全相同；总伤害 508102.506556249。
- 已保存真实记录的独立检查：233 能量、12 治疗正向；6 类预热后篡改（帧/值/源/归属/治疗组件顺序）全部拒绝。
- 1002 条真实公式的完整结果（包含全部解释）无缓存与快照缓存 SHA-256 完全一致：`3030a1b128d8d5672af608b7f6125ce27decc9e47e6f0c841ddc84b6952bffdf`。
- 类型和构建通过。未重跑全回归；上一全量失败不能据此称已解决。未实测 Windows。

命令：

```sh
npx vitest run packages/sim-core/src/source-host-validation-memo.test.ts packages/sim-core/src/source-host-live-memo.test.ts
npm run build
GIDPS_PREBUILT=1 PLAYWRIGHT_BROWSERS_PATH=/workspace/GIDPS-cloud/browsers GIDPS_CURVE_EVIDENCE_DIR=/workspace/GIDPS-cloud/validation-cache-20261021/browser GIDPS_CURVE_COMPARE=/workspace/GIDPS-cloud/latency-profile-20261021/browser-final npm run test:e2e -- apps/web/e2e/validation-cache-performance.spec.ts --workers=1
```

浏览器基准明确 opt-in，需真实已保存 baseline，不以 mock 或新生成的结果作为自身对照。原始 profile、前后 JSON、真实捕获、负例与脚本位于 `/workspace/GIDPS-cloud/validation-cache-20261021`。此前 baseline 位于 `/workspace/GIDPS-cloud/latency-profile-20261021/browser-final`。
