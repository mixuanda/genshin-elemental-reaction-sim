# 来源动作执行政策与完整特殊结果重现

日期：2026-09-28。工作树 `/Users/evan/Documents/gidps`，基线仍为 `84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5`。上一轮属于有效进展；本轮继续补齐主提示 §18 的来源动作政策与时间窗口、§5/22/23 的完整特殊结果恢复。永久独立单技能计算器保留。全量目标仍进行中；没有提交、推送或部署。

## 实际新增行为

来源队伍页面现在可选择“自动等待”或“严格”。默认保留来源的逐帧等待。严格模式在同一个真实 `ReadyCheck` 首次返回角色动作未就绪或玩家动画未就绪时停止；能量、冷却、体力、切人冷却仍由原来源检查，非法动作仍由原合法性检查拒绝。两种模式都沿用原动画排队、隐式切人和显式 `wait`/`delay`，因此严格模式不是一个新的绝对时间 DSL，也不是将原生不存在的 `strict` 填入 GCSL options。

实现是两套固定来源共用的 `008-action-queue-policy.patch`、Go wrapper/bridge 中的执行政策，以及 TypeScript 请求/结果合同。成功结果回显政策；旧结果没有该字段时明确按历史默认自动等待显示。多种子／ER 对照要求请求与回执采用相同政策，不能将两种行为混作同一对照。

每个原生动作队列项都有单调 `sequence`，排队和接受回执还包含实际角色键与动作；下一输入窗口回执引用同一序号。新增卡片展示排队帧、施放帧、排队后经过帧数和下一输入窗口，最多显示80项，完整原始日志仍分页可查。这些是实际运行的实例，不猜其对应的编辑器行，也不将未执行到的后续动作填成零帧。显式等待仍在原动作日志展示。

动画表格分别显示来源 `AnimationLength`、`CanQueueAfter`、下一动作 `Frames` 门槛及实际结束／中断帧。内部帧可能受卡肉或归一化计时影响，不能直接加到起始帧当实际可施放时刻；实际输入窗口取新回执。冷却只显示来源真实触发、恢复和剩余值，不按 `触发+原CD` 伪造恢复。

严格中止时 wrapper 返回真实日志和错误，不返回完整 `result`。页面保留中止前队列与资源失败原因，停止输出本次总伤/DPS并禁用完整结果导出。首次构建后的集成发现原错误只剩泛化异常，随后补回中止账本并各重建一次；没有放宽原就绪条件。

## 七种本地特殊宿主的完整重现

新增共享核心 `special-result-capture.ts`，统一调用现有七个公开入口：月感电、月结晶、月绽放、两种月曜混合、星导、星扩散。`special-complete-reexecution-v1` 保存引擎版本、有效配置、宿主、实际运行选项、队伍身份、月曜装备/月兆和技能声明，以及完整复合结果。

导入在专用 Worker 中用原输入从头执行一次，随后比较完整规范化 JSON：包含普通 `baseResult`、全部特殊伤害、反应/资源/场/状态日志和总量。对象键的排列不影响比较。版本不符、事件删失或伤害变动会拒绝；实际重执行仍通过上一轮的特殊武器拥有者/贡献者检查，不绕过缺失回调。已完成结果导出只序列化，不重复运行整场。用户可以取消导入 Worker；导入失败或取消保留原结果。

导入成功后仍能将特殊事件或星导场影响的普通命中送入独立计算器。附带 `ui` 说明属于历史展示信息；角色身份取保存的有效配置和 `request.party`，不让未参与重现的附注改写人物。

该合同证明当前同引擎下的完整重现，不是独立游戏验证，也不是任意帧检查点。它用于本地 TypeScript 七种特殊宿主；来源 Go/WASM 的完整机制状态导入仍是另一范围，不能用这里的通过记录声称已完成。

## 实测值

[机器汇总](validation/action-timing-special-measurements-20260928.json)及完整运行文件保存了以下结果：

| 场景 | 本次实际结果 |
| --- | --- |
| b4 自动等待，4秒/240帧，两次普攻输入 | 第1次排队/施放均为1帧，下一输入窗口28帧；第2次28帧入队、49帧施放，实际经过21帧，下一输入窗口73帧。两次普攻加试作古华追击，共3次结算/3次共享计算，总伤9350.65539198744 |
| b4 严格，同一连续普攻 | 第28帧第二次输入遇到动画未就绪停止；没有完整观察窗结果 |
| b4 严格，零能Q | 第1帧停止；页面实际账本显示能量不足 |
| a7 严格，两次普攻间显式 `wait(120)` | 两次施放帧1/148，输入窗口28/172帧；4秒3次结算，总伤9350.65539198744；首击打开独立计算器的恢复差为0 |
| 月绽放完整页面导出/导入 | 普通3击3459.3363，特殊3击2750.5302300000003，复合总伤6209.86653；导入重现一致，改写特殊伤害被拒绝，保留原结果 |
| 星导完整页面导出/导入 | 普通9击，总伤4469.75，6条场影响；无独立特殊伤害事件，不能误报成特殊事件缺失；导入一致，普通命中可送入计算器 |

这些是明确参考构筑与合成配置的实现测量，不是最佳配装推荐或游戏实测。两来源总伤相同也不证明其所有角色机制等价。

- [自动等待实际结果](validation/source-action-timing-auto-20260928.result.json)
- [严格加显式等待实际结果](validation/source-action-timing-strict-20260928.result.json)
- [中止状态与页面错误记录](validation/source-action-timing-failures-20260928.json)
- [月绽放完整捕获](validation/lunar-bloom-complete-capture-20260928.result.json)
- [星导完整捕获](validation/stellar-conduct-complete-capture-20260928.result.json)

当前浏览器实际加载的WASM身份：

| 来源 | SHA-256 | 字节 |
| --- | --- | ---: |
| b4ae769 | `9654d6b2f8d66daaad3528ebb3f42978f70a25bb9719ec6900bd26190f6ad7b4` | 41914824 |
| a7dc4bf | `09de0dc39091d1843632815044e7d97bad32ead5db0f5ffcdf0d5940357903bf` | 61529031 |

## 必要检查及失败记录

| 命令/范围 | 实际结果与证据 |
| --- | --- |
| 两来源初次构建 | b4 exit0/3.965s，a7 exit0/4.566s；[b4](validation/source-host-b4-strict-build-20260928.log)、[a7](validation/source-host-a7-strict-build-20260928.log) |
| 中止账本接线后的来源构建 | b4 exit0/2.865s，a7 exit0/3.286s；[b4 retry1](validation/source-host-b4-strict-build-20260928-retry1.log)、[a7 retry1](validation/source-host-a7-strict-build-20260928-retry1.log)。属于补充实现后的重建，不是重复跑机制测试 |
| `npx vitest run packages/sim-core/src/__tests__/special-result-capture.test.ts` | 一个聚合用例覆盖全部七宿主、完整事件删失、键顺序、版本与特殊武器拥有者门禁；1/1通过、exit0，Vitest1.82s，`time real`2.29s；[日志](validation/special-result-capture-20260928.log)、[exit](validation/special-result-capture-20260928.exit) |
| `npm run build` | initial exit1/2.740s，新页面测试文件写入期间出现两项类型声明错误；稳定测试类型后retry1 exit0/3.540s，667模块/Vite626ms。生产构建仍提示既有较大chunk；[首次](validation/action-timing-special-build-20260928.log)、[通过](validation/action-timing-special-build-20260928.retry1.log) |
| `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/source-action-timing.spec.ts apps/web/e2e/lunar-special-capture.spec.ts` | 两个新增聚合页面首轮2/2通过；Playwright3.7s，墙钟4.149s，两页均无未捕获页面错误；[日志](validation/action-timing-special-browser-20260928.log)、[命令回执](validation/action-timing-special-checks-20260928.json) |

`git diff --check` 最终exit0／0.068s，回执同上；HEAD仍为原基线。

没有重跑历史角色/页面矩阵、全单元集、数据生成或大型随机。来源页面总共执行四次小场景，分别覆盖严格动画中止、自动等待、严格零能中止及另一来源的合法严格输入。两份原有特殊页面的导出结构断言已随合同更新，本轮没有运行它们，不计入通过数。

## 文件及剩余工作

核心改动：来源008补丁及两份bridge/wrapper、`source-host-wire.ts`、`special-result-capture.ts`；产品改动：来源政策选择与失败账本、`source-action-receipts.ts`、原动作时间线、特殊反应面板与专用Worker。新增两个页面流程和一个核心聚合用例。

尚未完成的范围包括：来源任意检查点与随机稳态、运行前静态确定任意角色组合的完整动作时序、脚本实例到编辑器行/循环次数的显式映射、特殊伤害自身完整武器/装备回调、全来源闭包属性解释，以及独立游戏验证与缺失数据。排队实例日志只关联真实运行事件，不补猜这些状态。

本轮不改变活动正式/预览目录、v29分类分母或verified指针；最新官方版本观察仍是2026-09-24的7.1，未声称本轮刷新。6把缺执行来源的武器、部分预览的真实版本对应及其他覆盖缺口继续留在全量目标中。
