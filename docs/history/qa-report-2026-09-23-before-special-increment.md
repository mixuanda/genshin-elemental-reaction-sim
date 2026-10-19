# QA 与实测报告

更新：2026-09-23。范围是本地工作树，未提交或部署。验证按实际改动选择；旧检查保留为历史记录，新增失败只作针对性复验。

## 基线与环境

干净基线 `84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5` 的隔离检查为 1858 单元、3 性能、36 Chromium 浏览器测试通过，另有数据、类型和构建证据，见 [基线记录](baseline/checks.json)。9 月 22 日改造后的 1994 单元／3 性能／43 浏览器记录及当时的失败与修复保留在 [历史 QA](history/qa-report-2026-09-22.md)；不据此声称新增代码已测试。

环境为 Apple M5 Max、Darwin arm64、Node v24.15.0、npm 11.12.1、Vitest 4.1.10、Playwright Chromium。项目没有独立 lint 脚本，不报告未运行的 lint 结果。

## 本轮检查状态

本轮完整单元检查执行一次；发现的三个失败项修复后只重跑相应项。类型和构建只在实际生产预设／记录恢复修复后更新产物，没有重复全套单元、旧 43 个浏览器场景或性能矩阵。

| 检查 | 当前实际结果 | 证据 |
| --- | --- | --- |
| `npm test` | 首轮 exit 1：191 文件，2164 通过／3 失败，93.88 秒；因此其后串联性能阶段未执行 | [完整单元记录](validation/continuation-tests-final.log) |
| 三个失败项复验 | Schema 单项 1 通过，509 ms；杜林投影 2 通过，1.19 秒；其余已通过项未重复运行，2167 项最终均有通过记录 | [Schema](validation/continuation-schema-rerun.log)、[杜林](validation/continuation-durin-projection-retest.log) |
| `npm run test:performance` | 独立补跑一次，exit 0，3/3 通过，3.36 秒 | [性能门](validation/continuation-performance-final.log) |
| `npm run build`（含全项目 typecheck） | 整合、杜林生产身份、记录选项／精度修复后均 exit 0；最后 Vite 212 模块、298 ms，仍有大 chunk 提示 | [最后构建与类型记录](validation/continuation-build-record-precision-fix.log) |
| `npm run data:status` | exit 0；重新生成最后的 112/574 角色命中及 28/140/50/14 装备范围，README 与状态页一致 | [状态生成](validation/continuation-data-status-final.log) |
| 数据目录／更新流程定向测试 | 2 文件、15 项通过；归档规则调整后仅复验原子回退单项通过 | [数据测试](validation/data-continuation-tests.log)、[回退测试](validation/data-rollback-targeted.log) |
| 数据生成和验证 | 最终 `data:check` exit 0：历史目录复现、活动投影、覆盖摘要及 5 份圣遗物源哈希一致；`data:validate` 在数据接入阶段 exit 0 | [最终检查](validation/continuation-data-check-final.log)、[验证](validation/data-continuation-validate.log) |
| 共享装备集成 | 7/7，通过 962 ms；包含 HP→ATK、NonExtraStat 排除、最终面板等价与往返 | `packages/sim-core/src/__tests__/calculator-equipment.test.ts` |
| 执行配置与分析 | 18/18，通过 257 ms；真实延迟、连续状态、半开窗口、ER 与稳态判定 | `execution-profiles.test.ts`、`simulation-analysis.test.ts` |
| 特殊公式与月感电适配 | 43 项通过，314 ms；精确等级、共享特殊公式、上下文和 trace | `lunar-charged-calculation.test.ts` 及特殊公式测试 |
| 实际月感电与执行输入 | 11/11，通过 1.60 秒；抑制普通 EC、消耗／自然到期、真实快照和恢复 | `execution-context.test.ts`、`lunar-charged-simulation.test.ts` |
| 新月结晶与月感电兼容 | 3 新项 + 4 LC 项，7/7，通过 1.33 秒；真实转换、分段快照／投递、ICD 和截断 | `lunar-crystallize-simulation.test.ts`、`lunar-charged-simulation.test.ts` |
| 新套装和导入 | 四件套 10 项、黄金剧团核心集成 1 项分别通过；导入／showcase 2 文件 8 项通过，1.23 秒 | 来源套装测试、`calculator-equipment.test.ts`、`calculator-import.test.ts`、`showcase.test.ts` |
| 草主 A4 | 3 项通过，171 ms；E/Q 精通变化、突破依赖、最终面板转换／JSON 等价 | `character-damage-bonus.test.ts` |
| 新浏览器场景 | 3 个综合场景累计全部通过；首轮凯亚通过，固定预览第三项通过，最后只复验剩余记录场景 1/1 通过，2.1 秒；未重跑已通过项或旧 43 项 | [浏览器过程](validation/continuation-e2e.md)、[最后单项日志](validation/continuation-e2e-record-rerun.log) |

定向测试结果来自实施时实际执行，不把“存在测试文件”作为通过证据。通过后不为了增加数量重复运行无关浏览器场景或扩大压力测试。

最后浏览器记录确认：0.13123456 抗性、基础种子、完整运行选项、执行配置、逐击事件、执行审计及批量统计（排除墙钟耗时）全部精确往返相等；普通随机命中复算差值 0。月感电／月结晶固定夹具的总伤害、取样／投递帧及特殊上下文还原通过。当前本增量没有剩余检查失败。

## 已知失败与处置

- 中间类型检查曾发现特殊状态联合类型、exactOptionalPropertyTypes 的 undefined 字段及测试字面量推断问题，按实际接口修复，没有关闭严格检查。随后全项目类型检查 exit 0。
- 完整单元的 Schema 失败是 CURRENT 字段列表遗漏新增可选 `executionAudit`，更新当前断言，历史版本隔离和既有字段精确断言保留。两个杜林失败是真实浏览器预设仍带旧 6.7 数据身份；完整递归比对确认其他配置完全一致，改为同一个活动 metadata，未修改模拟器或哈希函数。原始复现键／事件精确相等断言保留，并增加完整配置相等检查，见 [原因与修复](cross-validation/durin-projection-data-identity.md)。
- 一次 shell 日志包装误用了 zsh 只读变量 `status`，包装命令失败；改用专用返回码变量取得明确 exit 0，不将包装失败称为应用失败或成功证据。
- 首轮新增浏览器场景：计算器 trace 选择器同时匹配隐藏模拟区域，改为限定计算器根节点；3 秒黑 E 周期的预热被冷却合法性正确阻塞，修正“必定可预热”的测试假设，保留实际 blocked 原因和无测量窗口断言。
- 两项复验期间，开发服务器因并行改源码重复热重载，页面回到默认配置；trace 有 Vite 重连证据。暂停开发环境复验，待固定构建；保留基础种子、逐击事件、运行选项及批量摘要的精确相等断言，没有据此修改产品导入行为或放宽数值。
- 固定预览排除热重载后，记录导入仍失败：入口误用了冻结的历史运行选项 schema，拒绝合法的当前 `execution` 字段。改用已有当前 schema，历史格式仍严格隔离。另修复同路径抗性显示舍入后写回的问题，保留未编辑输入的完整精度；同一个浏览器场景加入 13.123456% 输入及完整配置精确往返断言，没有增加新场景。
- 初次启动开发服务的 workspace 参数转发错误已纠正，不属于应用构建结果。

## 数值与范围

教学 A/B、来源凯亚实例、月感电执行与外部普通命中的具体值见 [中文报告](implementation-report.zh-CN.md)。计算器独立路由、逐步公式与编辑联动、单技能逐段加总、公开展示柜合成导入、导出／重放等已有历史浏览器验收；本轮新增来源配装与种子／特殊状态恢复继续覆盖实际改动。公开展示柜测试不使用现场个人响应。

外部验证实际调用固定 gcsim v2.44.1 arm64 二进制，其版本输出、SHA-256、输入、完整样本和本地六条路径保存在 [交叉验证](cross-validation/gcsim-comparison.md)。受控安柏物理单击 **4.732408961072165**，六项绝对／相对残差均为 0；无反应、能量循环或整队结论。

确定性连续预热测试会同时检查能量、真实行动、延迟粒子与窗口，而非只检查计数器。稳态只对 producer 声明并实际记录全部相关状态的确定情景成立；复杂反应／特殊实体／随机反馈仍明确未建立。

## 性能

一次新增性能测量固定于 `2026-09-23T06:42:28.209Z` 的源码哈希，见 [执行选项报告](cross-validation/simulation-execution-benchmark.md)。后续代码增量没有冒充重测。2 次预热、12 次计时，不重复旧 30 轮基准。

| 120 秒／269 事件场景 | 中位 ms | p95 ms | 次/秒 | 逐击 trace 记录 |
| --- | ---: | ---: | ---: | ---: |
| 解析期望，关闭详细 trace | 30.500 | 33.336 | 32.24 | 0 |
| 解析期望，开启详细 trace | 129.735 | 148.481 | 7.56 | 269 |
| 独立随机暴击，关闭详细 trace | 29.397 | 30.913 | 34.01 | 0 |

开／关 trace 保留 capture 和其他审计，其确定性总伤与全部 damageEvents 一致。随机模式每轮 263 次真实抽样，6 次无暴击资格命中不抽样；12 个种子产生不同总伤，首种子字节级重放一致。吞吐样本不是收敛的均值置信区间；未测所有队伍或暴击触发反馈。开启详细 trace 的 p95 超过 100 ms，如实保留。

最终既有性能门另测 21 次：普通 120 秒情景中位 27.607 ms、p95 32.148 ms；能量情景中位 5.191 ms、p95 6.967 ms；持续燃烧中位 81.520 ms、p95 90.142 ms。它使用既有独立门限和输入，不与上表详细轨迹／随机暴击情景混算吞吐或数值。

## 限制

当前证据验证本地可执行范围，不能晋升全角色、全部装备或全部 Lunar／Stellar 为当前官服已验证。构建不证明机制正确，单击外部对照不证明全队正确。最后构建仍有大于 500 kB 的 chunk：catalog 约 1.97 MB，三个 Worker 各约 1.62 MB（构建报告中的未压缩大小）；未宣称体积已优化。9 月 22 日依赖审计通报是历史观测，本轮未运行额外安全审计，不宣称通报已经解决。当前阻塞见 [已知限制](known-limitations.md)。

本轮目视检查了流程内保存的 [月感电结果截图](validation/screenshots/lunar-charged-result.png)：合并伤害、经典／特殊分项、两个实际事件与暂定范围均可读，未见横向截断。该截图不是数值验证，也未冒充新一轮全路由或移动端验收。

新增 `check:release` 串联数据检查、完整单元、一次构建和独立计算器／整合 E2E；GitHub workflow 使用相同失败即停止的命令。当前只写入本地配置，未推送、未运行远端 CI、未修改远端分支必需检查，不宣称远端发布控制已经生效。此命令定义不算一次新的执行记录。
