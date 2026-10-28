本批把指定四人队的第二次能量／治疗复核索引从 19,602 条缩至实际依赖的 712 条；完整回调、首次校验、逐击记录、解释、能量和 RNG 均保留。代码提交 `d86563f403792b6b6fd3ccd51c7ec5073861e41b`，基于 `81b55a05e85b46d9535ff09d688745263ed0f495`。代码已推送 `origin/cloud/player-import-integration-20261021`，未部署或上传 Library。

本地真实页面的一对同配置／同种子记录为 **36.3188 秒 → 30.4505 秒**（点击至两次 requestAnimationFrame 后的绘制点），观察差值 5.8683 秒／16.16%。这不是多次采样均值或设备性能承诺。未修改的公式／原生桥接阶段也快了约 3 秒，因此不能把整个页面差值都归因于本次代码；直接对应修改的浏览器校验阶段为 **6.4493 秒 → 3.6734 秒**，同一录制数据的离线校验为 **7.4764 秒 → 5.5519 秒**。

本批没有修改 Go、WASM、伤害公式或解释模板缓存。没有减动作、减伤害、改种子、降帧精度、减少采样、裁剪保存记录或省略不可信输入的完整校验。单技能与 1/2/4/8/16 倍回放本批均未修改；这里的时间是一次真实 120 秒计算的页面响应，不是回放播放时间。

修改与根因：

- `source-host-capture.ts` 仍先解析完整结果 schema，逐条核对 19,602 条本次共享核心回调；旧保存结果仍逐条独立公式复算。每条应用与帧号、来源、数值的既有检查保留。
- 旧实现随后为能量／治疗的第二次复核，对全部回调再次 structuredClone、schema.parse 和冻结。离线 CPU profile 中该索引构建累计采样约 2.9 秒。新 `source-host-application-validation.ts` 从实际 application 根出发，递归保留 `componentIds`、角色／装备支持、属性读取及其嵌套来源，再调用原来的完整克隆、schema 校验和冻结。缺失依赖显式失败。此次实际索引为 647 条能量、38 条角色 modifier、27 条装备标量，共 712 条，对应 403 次能量应用；完整结果仍保存 19,602 条。
- 还修复了一项校验缺口：旧请求的 JSON 字符串不同后，仅比较 kind/input，可能放过帧号、角色、技能或不透明元数据被改动。现在按完整 JSON 树比较全部字段，仅忽略对象键插入顺序；数组顺序和值严格保留，不进行排序归一化。新增五个真实反例在旧实现可被接受，修后全部拒绝。
- 第二次复核索引每次独立创建，不共享跨角色、跨配装或跨运行的动态结果；没有新增以动态参数不完整为键的缓存。未知／passthrough 数据继续完整克隆，调用者修改原对象不能污染已拥有快照。

验证与数据：

- 18 项定向测试通过：完整请求比对／篡改、Classic 和 Stellar 能量、治疗 source／override、完整解释对照、不可变快照及缓存归属。`npm run build` 通过，包含工作区检查、TypeScript 与 Vite 构建（3.89 秒）；保留原有大 chunk 和 ineffective dynamic import 提示。本批未跑全量回归，历史失败数没有清零。
- 新反例的首次原始日志也有一个正向测试错误地要求当前诊断文字等于 9 月归档的旧诊断，随后将这个新测试改为比较同版本的有序／逆序对象输入；没有修改归档、Golden、数值或原有断言。该日志中的其余五项失败才是上述请求身份缺口。
- 当前提交离线重放全部 19,602 次真实已录制回调，所有返回值及每次完整解释对象的 SHA256 与上一版逐项一致，序列 SHA256 为 `dee0750f66230beb5da48e3c71ade9c5ed13d12fcf8f2cbed0c2d1b53751d3a4`，557,747 个解释节点引用保留。此离线解释回放耗时 17.096 秒，不是原生／页面计算时间，也未显示公式生成本身变快。
- 浏览器使用现有 `127.0.0.1:4205`，1440×1000 Chromium，真实固定 WASM 与共享 TS 回调。新运行在干净 `d86563f`，application patch SHA256 为 SHA256(empty)。只启动一次 native Worker，无 mock 或替换数值。
- 基准沿用上一批干净代码 `9d8a7dc` 的实际页面记录（2026-10-23 18:28:22 UTC），`81b55a0` 只在它之后保存了证据。新记录始于 19:04:04 UTC，终于 19:05:08 UTC；不是声称在 `81b55a0` 又跑了一次基准。

| 阶段（毫秒；包含关系不可重复相加） | 上版记录 | 本版记录 |
| --- | ---: | ---: |
| 点击至绘制 | 36,318.80 | 30,450.50 |
| native 调用，包含 TS 回调 | 26,866.10 | 23,854.00 |
| 共享公式回调合计 | 14,413.40 | 12,653.70 |
| 回调计算与完整解释 | 11,811.60 | 10,303.40 |
| 回调冻结／捕获 | 2,214.70 | 1,981.10 |
| native 返回 JSON 解析 | 237.70 | 225.20 |
| 完整结果校验 | 6,449.30 | 3,673.40 |
| 传输及主线程排队 | 899.70 | 833.40 |
| 同步结果渲染 | 1,007.90 | 988.10 |

native 减 TS 回调后的余量仍混合 Go 机制执行、Go JSON 和 Go↔JS 转换，不能称为纯引擎耗时。导出、重开、截图和工具等待都没有计入点击至绘制。构建和其他模拟未与这次页面计时并行。

计算及保存守恒：

- 固定 `wanderer-team-recharge.er150.gcsl`，配置 SHA256 `4fed915e08373c9a25cdb28ef7fe0a9c63f36f5cae39808aa2f581c2c4c93059`，seed `20261022`。流浪者 100 级 C6 图莱 R5；珐露珊 90 级 C6 西风 R5；妮可及杜林 90 级 C2 专武 R1。其余等级、天赋、合法圣遗物、敌人与轴沿用明确的参考配置，不冒充用户实装。
- 7,200 个 60 FPS 整数帧，半开窗口 `[0,7200)`，610 次命中；19,602 次回调，回调请求文本 40,644,264 字符，原生返回 49,677,378 字符。帧、同帧顺序、所有计算／应用、能量、任务／攻击／状态及已记录事件流逐项严格相等。
- 总伤害 `27069474.337322712`，120 秒 DPS `225578.9528110226`。这是固定种子单次样本，不是随机总体均值或已证明稳态。5 个完整轮转及第 6 轮实际前缀，23 次合法 Q 仍相同；没有续充开场满能量。

| 角色 | 原样保留的伤害 |
| --- | ---: |
| 流浪者 | 19675557.80279801 |
| 杜林 | 4621465.1979512945 |
| 珐露珊 | 1851300.261779438 |
| 妮可 | 921151.0747939858 |

角色与技能贡献守恒，逐击曲线显示 610 笔整数帧事件。导出后重开并再次导出，字节 SHA256 均为 `e122d548b348db78d27567056755d629ab847cfab02bc9abdcca07e670d14e04`，没有再启 Worker 或重新模拟。固定 WASM SHA256 仍为 `3e5fc685e2743552b4be8f14533f75794092d88b7236166e0ac38103bed5a53e`。

原始顺序限制没有被掩盖：

47 个顶层结果字段严格相等，只有 `logs` 与 `phaseObservations` 不同。两次归档各自重开原样一致，但跨运行完整字节相等仍**失败**。比较器的 `--strict-archive` 因此保留退出 1；它没有被计入“全绿”。30 项相位差异仍保存原始顺序。源码审计详见同目录 `WANDERER-TEAM-OBSERVATION-ORDER-20261023.zh-CN.md` 与 `.evidence.json`。

差异涉及实际 modifier 容器写入及 OnTick 钩子的执行顺序，不能叫纯 JSON 重排。源码支持本固定配置中两种交换可交换：火共鸣固定 StatMod 与风共鸣固定 CooldownMod 分别按类型读取；两统计钩子所触及的护盾强效列表在此配置为空、计数器独立。OnTick 不在当前已记录事件流家族中，因此“已记录事件流相等”不代表所有 tick 调用先后相同。不可将这一结论推广到其他队伍。

比较器现在只接受这支队伍已审计的相邻火／风两项交换，以及 subscription 12 的两统计钩子反转；任意其他 modifier 排列或 F0 日志变化明确失败。原始结果、相位模型与同次运行的周期判定均未归一化。六对边界存在同一可逆排列，只能证明该排列本身不改变同次运行内部的状态相等判定，不能证明无限稳态。

复现命令（在仓库根，输出目录须全新）：

```sh
node --import ./scripts/register-json-modules.mjs ./node_modules/vitest/vitest.mjs run packages/sim-core/src/source-host-request-identity.test.ts packages/sim-core/src/source-host-application-validation.test.ts packages/sim-core/src/source-host-validation-memo.test.ts --reporter=verbose
npm run build
node scripts/acceptance/source-result-performance.mjs <captured-result.json> <fresh-output> <baseline-summary.json>
node scripts/acceptance/source-formula-performance.mjs <captured-result.json> <fresh-output> <baseline-explanations.json>
node scripts/acceptance/wanderer-team-performance-browser.mjs http://127.0.0.1:4205 <fresh-output>
node scripts/acceptance/compare-team-performance.mjs <before-directory> <after-directory> <fresh-report.json> --strict-archive
```

最后一条的跨运行归档严格检查在本对记录应失败；此前完整战斗值检查通过及顺序差异已写入报告。离线校验 CPU profile、完整逐击文件、逐条解释哈希与截图留在云端 `/tmp/GIDPS-team-performance-20261023/`，文件清单及 SHA256 见本目录 `.index.json`。此批停止于已验证优化；剩余公式构建和桥接仍较慢，尚无足够证据安全扩大缓存或删校验。原有 Q 55 帧／C6 新快照 8 帧等固定来源近似仍保留，不宣称官方碰撞精度或全角色完成。
