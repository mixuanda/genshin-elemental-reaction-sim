# QA 与实测报告

更新：2026-09-24。本轮接入久岐忍真实 E/Q 来源情景，解决已有同帧治疗／收球与新动作接受的先后关系，并按真实起手生命锁定 Q 的七击／十二击。独立单击／完整单技能计算器继续作为主导航功能，不要求队伍或轮转。最终 goal 保持进行中；未提交、推送或部署。

## 实际改动

正常轮转页新增固定 A6/T1/C0 或 C2 的 E/Q 来源入口，保留旧 E-only 入口及原身份。默认 E@1、切安柏@51、切回久岐忍@300、Q@564；初始能量60和初始HP50%是可编辑示例输入，不是无限资源。来源面板仍为钝剑Lv1、额外EM200及暴击率降至0的明确合成条件。

动作可以显式选择 `after-frame-tasks-v1`：先执行已有当帧任务，再接受动作并检查能量、取样生命及面板；动作自产的零延迟效果进入后续相位。未选择此模式的旧动作保持原顺序。这个有限合同不声称完整复制上游全部任务队列，尤其不掩盖来源对零延迟任务的TODO。

Q成功起手后，以同一个真实生命池判断 `当前HP≤最大HP×0.5`。前七击恒有，后五击按判断纳入或排除，后续治疗不重选分支。实际条件使用共享AST，记录输入、阈值、判断、事件顺序和命中组；没有预先用初始HP配置生成固定Q。Q保留起手面板快照，在+4帧实际扣60能量，冷却900帧；伤害从+50帧开始，每17帧一击。C2包含C1的范围扩大，但其他C4/C6行为未自动加入。

时间轴与预热账本新增真实起手条件表，展开显示公式、变量、数值代入、结果和解释。所有Q命中，包括基础七击，返回独立计算器时都保留同一次起手决策的真实AST与上下文；页面不重新猜测条件。完整运行和命中JSON均可恢复。README增加普通使用路径。

具体实现和边界见[动作相位与条件组](validation/action-condition-phase.md)、[久岐忍来源验证](validation/kuki-burst-runtime-source.md)及[固定E/Q契约](cross-validation/action-library/kuki-burst-source-contract.md)。

## 实际执行检查

| 检查 | 实际结果 | 原始证据 |
| --- | --- | --- |
| 唯一外部 gcsim CLI | 首次exit0，0.021687s；一次汇总迭代和独立调试sample，seed分开 | [执行及哈希](cross-validation/action-library/kuki-eq-same-frame.execution.json)、[逐项对照](cross-validation/action-library/kuki-eq-same-frame.comparison.json) |
| `npx vitest run packages/sim-core/src/__tests__/action-condition-phase.test.ts` | 首次3例均在配置入口失败：新合成夹具遗漏明确目标位置；880ms，测试22ms | [首轮日志](validation/action-condition-phase-test.log) |
| 仅修夹具后重跑同3个失败例 | 3/3通过，1.07s／测试273ms；没有因此修改生产实现 | [复验日志](validation/action-condition-phase-test-retry.log) |
| `npx vitest run packages/sim-core/src/__tests__/kuki-burst-source-action.test.ts --silent=false` | 首次2/2通过，2.20s／测试1.37s，exit0 | [日志](validation/kuki-burst-source-tests.log) |
| `npm run build` | 首次exit0，全工程TypeScript＋326模块生产构建通过，336ms | [日志](validation/kuki-burst-runtime-build.log)、[退出码](validation/kuki-burst-runtime-build.exit) |
| `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/kuki-burst-runtime.spec.ts` | 唯一新增页面流程首次1/1通过，总2.7s、流程2.3s，exit0，无重试 | [页面实测](validation/kuki-burst-runtime-browser.md)、[日志](validation/kuki-burst-runtime-browser.log) |

初次增量核心5项最终通过；收尾定位实际来源校验问题后另补1项，下文分开记录。不能说核心首次全通过。只复验实际失败的夹具范围；生产界面使用4173预览及已构建产物。未重跑旧全集、上一轮E完整矩阵、data:status／data:check、性能基准或大型Monte Carlo。构建、CLI和测试流程耗时不等于产品性能测量；既有大chunk及无效动态拆分提示保留。

## 失败Q后切人的定点修复

收尾代码审阅发现，新E/Q来源校验在通用能量探测之前静态编译整个轮转，把本应缺能失败的Q假定为成功，错误占用动画至626帧并拒绝565帧切人。新增唯一用例先确认失败，随后让来源时序检查读取同一次能量处理后的最终编译结果；静态检查保留身份、能力和指令范围。成功Q的取消窗与实际切换后60帧冷却没有放宽。普通E/Q时间线预览也复用同一模拟核心，显示实际能量失败与后续执行。

| 定点检查 | 实际结果 | 证据 |
| --- | --- | --- |
| `npx vitest run packages/sim-core/src/__tests__/kuki-source-execution.test.ts` 修复前 | 唯一用例失败，842ms／测试4ms，证明前置校验误拒 | [red日志](validation/kuki-source-execution-red.log) |
| 同一用例修复后 | 1/1通过，1.13s／测试336ms | [通过日志](validation/kuki-source-execution-test.log)、[核心说明](validation/kuki-source-execution.md) |
| 修复后的 `npm run build` | 首次exit0，全工程类型／326模块构建，366ms | [日志](validation/kuki-source-execution-build.log) |
| `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/kuki-burst-runtime.spec.ts -g 'rejected Q releases the next swap'` | 仅新定点流程首次1/1通过，1.2s／流程794ms，无重试 | [报告](validation/kuki-source-execution-browser.md)、[日志](validation/kuki-source-execution-browser.log) |

最终本轮新增核心共6项有通过证据、两个新增页面流程分别首次通过。没有重跑已通过的七／十二击页面矩阵；第二次构建与定点检查由实际生产修复触发。默认显式请求帧下，Q564以9/60能量拒绝，切安柏565→566正常执行，654/744帧草轮实际治疗安柏。核心还确认连续两次失败Q不占冷却，真正成功Q后的过早切人及真实换人间隔不足仍被拒绝。

本地语义是记录一次不足能请求失败并继续后续指令；固定gcsim默认会等待请求变得可执行。该区别已在来源契约明示，不将本地拒绝行为冒充外部自动等待队列。

## 实测数值与同帧证据

唯一外部sample第564帧的真实顺序是：治疗日志序号82，Q快照83，动作执行86。久岐忍HP从7394.142141417917变为8424.575198408174，比例从0.4852457919264609变为0.5528686878896913，因此Q取七击。第568帧实际能量60→0。固定来源的代码注释写11击，但可执行低血分支循环明确为12；报告采用实际执行并保留冲突说明。

| 量 | 实测结果 |
| --- | --- |
| Q单击公式 | `15237.931506964002 × 0.036048 × (190/380) × 0.9` |
| Q每击伤害 | 247.18362973336724 |
| 外部七击帧 | 614、631、648、665、682、699、716 |
| 外部Q总伤害 | 1730.2854081335706 |
| 外部E/Q总伤害 | 2227.1835668556187 |
| 页面Q@564，E/Q总伤害 | 2227.183566855619，Q七击 |
| 页面Q@563，E/Q总伤害 | 3463.1017155224545，Q十二击 |
| 页面初能0后的Q检查 | 实际能量9／60，失败；无Q条件、扣能或命中，只剩E伤496.8981587220481 |
| 计算器重现 | 源测试所有Q命中差值0；页面实际第十二击差值0，含同次起手条件AST |

Q@563起手读取7394.142141417917HP，锁定十二击，随后564帧治疗过半不会缩短该次Q。该路径和恰50%的十二击边界通过本地检查；没有冒充另一次外部低血或C2参考运行。

独立数学与外部sample逐击最大残差0，治疗后HP最大残差1.82e-12。本地源码测试断言每击差<5e-12、总伤差<5e-11、治疗量及HP差<5e-10；测试配置没有输出精确本地最大残差，未为了打印再重跑。源CLI汇总与sample是两个不同seed轨迹；本地粒子子流不与外部随机序列强行等同。

新增通用核心合成例另证明同帧治疗4500→6000、收球57→60先于Q资格和生命判断；该Q自己的零延迟耗血在判断后执行，6000→3500，不反向改变已锁分支。恰5000/10000时选择十二击，后续治疗到6500不缩短；移除显式相位时旧动作仍在收球前因缺能失败。以上是明确合成输入，不当作角色来源数值。

## 数据与剩余工作

本轮未更改活动目录或条件技能映射：`.15`仍为120身份／916命中／541完整条件动作／146部分／18具体阻塞，194武器／958合法精炼及53二件／44四件规则。完整条件动作不等于完整角色。

活动目录仍为 `gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2`，released/provisional，verified为空，preview数0。发行观察仍为2026-09-23 14:22香港时间，本轮未在线刷新、激活新目录或晋升证据等级。

新E/Q只覆盖声明的固定面板、静止目标与明确动作；C4追击、C6时钟、动态属性／最大HP、低突破E初击A4冲突与动态快照TODO仍未完成。新动作相位和锁定条件、周期实体代次／未来任务、随机流尚未完整导出到相位检查点，不能证明该情景稳态。原静态确定性healthChanges的周期证明继续保留。完整角色／装备、特殊反应余下范围、可靠预览来源、广泛外部整队验证等仍见[已知限制](known-limitations.md)。

[上轮QA](history/qa-report-2026-09-24-before-kuki-burst-runtime.md)保留草轮动态治疗与概率产球的证据。120秒性能只引用2026-09-23T06:42:28.209Z的[历史基准](cross-validation/simulation-execution-benchmark.md)，本轮未重测。

原增量与定点修复后的 `git diff --check` 均exit0、无输出，仅覆盖已跟踪差异。[最终日志](validation/kuki-source-execution-diff-check.log)／[退出码](validation/kuki-source-execution-diff-check.exit)。
