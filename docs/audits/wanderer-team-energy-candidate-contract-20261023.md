# /goal 合法充能候选：独立能量/CD验收合同

基线 `d00f040e58714a9f40d7d9072fa1c51f5cf6f6c2`。本增量只新增候选审计器、定向测试及本文；原 `wanderer-team-energy-audit.py`、其固定捕获 SHA、原捕获和既有审计均不修改。本模块不执行原生模拟、不改配装、不替根挑选运行版本。

历史缺口只给筛选门槛：原 F2485 窗口从 0 起步，固定回能 8、粒子未乘 ER 基值 37.2，因此达到 60 的门槛为 `(60-8)/37.2 = 1.3978494623655914`，即 **139.784946%** 总 ER；原 F6329 对应基值 39.6，门槛 **131.313131%**。该计算固定原粒子时点/数量/接收者和 8 点固定回能，不考虑额外 Q 改变动作长度、RNG、后续粒子、封顶与镜像循环。它不是候选循环证明，更不是自动填入的最低充能目标。

首候选 `wanderer-er140` 已独立做配装 preflight：五件共 45 次档位，每件 9 次，逐件档位品质多重集合、套装、位置、主词条、四副词条种类和初始四词条保持。固定 artifact_main/sub JSON 哈希核实后逐项求和，得到 ER 加成 `.40159999999999996`、总 ER `1.4016`；CR `.622`、CD `1.3753000000000004`、ATK% `.6525`、固定 ATK `373.26`。这是真实取舍，不能只把原属性行的 ER 抬高。装备 JSON SHA256 为 `f63d6fdd62a87f40da28ccf3eb2606b39f9068ef7c97b50a2aff911793ce6510`。preflight 不表示新 120 秒已运行或每轮 Q 已满足。

合同依次核对：

1. 固定历史 request/builds/capture SHA；四个 actor 按名字取对象，不按数组下标猜人。只允许流浪者的已声明五件分配改变，其他角色完整 input 与原始构筑一致。
2. 候选 equipment/report 的**当前确切文件** SHA，candidateId、原始来源 SHA、嵌入装备、完整属性汇总和 exact GCSL 属性行相符。报告只作声明，ER 由每件离散档位独立重算。
3. 原请求只替换已声明属性行，并只允许明确指定的 seed `20261022` / `20261023`。角色/武器/命座/基础天赋/目标/初始满能一次/自适应 GCSL/延迟/观测设置等其余内容完全相同。
4. 根的 `run.complete.json` 全部文件 SHA/字节数与 inputSha256，`run.gcsl` 与 exact 请求配置一致。原生和处理后的实际能量写入、日志、技能调用等完全对应。
5. 每个 run **显式指定** build manifest 的文件与 SHA、WASM 文件与 SHA、patchedRoot，再核固定 b4 tree、31 个 Git blob 原件和该 build 的全部 bridge 哈希。不能从待审捕获自选一个可通过的 WASM。

旧 C2 泄漏捕获只作为历史锚点。若根修正原生 C2 并重建，必须用新的明确 artifact 重跑同机制版本的 original/candidate 对照；不能把旧原生基线与修正后的候选混成一对。`compare` 对 seed、WASM 和完整 build manifest 身份都要求一致。

数值与顺序重放保留原独立审计的粒子元素基值、前后台系数、固定源粒子数、实际 ER 读取、固定回能不乘 ER、耗能时点、封顶、连续余额和原生日志 append 顺序。候选的 Q 数、命中数、阶段数和跳 Q 数不再硬套旧 23/21 观察值，改为验证实际程序：妮可 E/条件 Q → 杜林 EE/条件 Q → 珐露珊 E/瞄准/条件 Q → 流浪者 E/重击/18 次普攻/条件 Q 或结束 E。每个完成的循环必须有四次实际 Q 决策且动作体完整；末循环只允许真实持续时间截断的前缀。每次接纳 Q 对应唯一实际决策及窗口内该发生的延迟耗能，截断后的动作或耗能不虚构到窗口内。

精确余额来自 `energyApplications`，不把 OnTick 采样当作同帧所有动作结束后的状态；保留 `nextFrame` 任务→OnTick→直接动作的两阶段采样旁证。输出逐轮 `QDecisions/skips`、实际 Q 接纳状态和最终余额。`status: passed` 表示审计一致；是否解决缺 Q 要另看 `acceptance.allReachedQDecisionsReady` 和 `acceptance.skippedQ`。任何有限双 seed 验收都不等于无限稳态证明。

入口：

```bash
# 纯配装和请求声明检查，不要求新捕获。
python3 scripts/wanderer-team-energy-candidate.py preflight \
  --mode candidate --candidate-id wanderer-er140 --seed 20261022 \
  --equipment /tmp/GIDPS-legal-recharge-evidence-20261023/wanderer-er140.equipment.json \
  --candidate-report /tmp/GIDPS-legal-recharge-evidence-20261023/wanderer-er140.report.json \
  --output /tmp/GIDPS-legal-recharge-evidence-20261023/wanderer-team-energy-er140-declaration.json

# 根运行完成后才绑定实际捕获。原配装对照用 --mode baseline --candidate-id baseline，
# 不传 equipment/report。修正版本的 manifest 和 patched-root 必须由根明确提供。
python3 scripts/wanderer-team-energy-candidate.py create-contract \
  --mode candidate --candidate-id wanderer-er140 --seed 20261022 \
  --equipment <equipment.json> --candidate-report <当前report.json> \
  --run-dir <er140-seed-20261022-c2fixed> \
  --build-manifest <明确的build/dist/manifest.json> --patched-root <同build/source> \
  --output <acceptance-contract.json>
python3 scripts/wanderer-team-energy-candidate.py audit \
  --contract <acceptance-contract.json> --output <energy-acceptance.json>
python3 scripts/wanderer-team-energy-candidate.py compare \
  --baseline-report <original-energy-acceptance.json> \
  --candidate-report <candidate-energy-acceptance.json> --output <paired-energy.json>
```

`create-contract` 锁定的是调用时当前 report 字节；report 在绑定后改变会拒绝，不能静默刷新旧合同。`run.complete` 适配根 runner 的 `{endedAt,inputSha256,files:[{name,bytes,sha256}]}`。`--pristine-root` 和 `--tree` 可显式指定存放位置，但 tree SHA 与每个原件 Git blob 仍严格验证。

定向验证：`python3 scripts/wanderer-team-energy-candidate-test.py`，**19/19**。覆盖合法档位取舍、seedB 仅变 seed、身份/档位/额外 roll/主词条/其他角色/免费 ER/目标/天赋/初始能量/18N 动作修改拒绝，旧粒子金额不能冒充新 ER 证据、漏完整轮 Q 决策拒绝、实际合法零，以及不同 seed/机制版本不能配对。完整合同管道测试只读复用旧捕获及其明确旧 artifact，不重新执行或冒充新的候选结果。

已完成 seed `20261022` 的实际配对能量审计，显式绑定修正后 WASM `3e5fc685e2743552b4be8f14533f75794092d88b7236166e0ac38103bed5a53e`、`/tmp/GIDPS-wanderer-c2-build-20261023/dist/manifest.json` 和同 build 的 patched source。两份捕获均通过固定来源、公式金额、真实写入顺序、CD、28800 个分相位采样与实际循环前缀核对：

| seedA 实际观察 | 原配装 114.24% ER | 合法候选 140.16% ER |
| --- | ---: | ---: |
| 写入 / 粒子金额公式 / 耗能 | 375 / 248 / 21 | 403 / 244 / 23 |
| 已到达 / 实际接纳 Q | 23 / 21 | 23 / 23 |
| 流浪者 Q 接纳 / 能量不足跳过 | 3 / 2 | 5 / 0 |
| 完整轮 / 末轮已到达 Q | 5 / 3 | 5 / 3 |

原配装仍于 F2485、F6329 因能量 `50.49728`、`53.23904` 而跳 Q，CD 均为零；其 `energyApplications` 与历史锚点完全相同。候选五次流浪者 Q 决策为 F1164、F2485、F3806、F5127、F6448，均 `60/60`、CD0，并逐次匹配实际接纳和延迟耗能。末轮到 F7200 尚未到流浪者 Q，不能记为第六次成功。候选实际粒子/固定回能次数也发生变化，不能用旧收入缩放替代此重放。

seedA 原配装 result SHA256 `64b645c87a56c6d23a9d29678c139778134deb3d8c3b01fd83bc3e690d87e8ea`；候选 `501872e80a60dbc4dd143282f6552325d807a032afc4fedb57dc1f1b53355b9c`。完整逐次证据保存在 `/tmp/GIDPS-legal-recharge-evidence-20261023/{original,er140}-seed-20261022-c2fixed/wanderer-team-energy-{contract,audit}.json`，配对输出 `wanderer-team-energy-paired-seed-20261022.json`。

本模块不独立重演出球 RNG，也不证明每个角色增益/固定回能触发状态的资格；这些仍由独立状态审计负责。例如候选后段实际出现 38 次 `wanderer-a1-electro-energy`（请求合计 30.4）：本审计证明固定 0.8 金额与实际顺序/封顶一致，触发元素是否成立须由状态审计核对，不能从金额反推资格。第二 seed 与状态资格结论仍待根的捕获/专门审计；目前不声明已完成全部循环验收。

配装 preflight 和定向测试记录同在上述证据目录。本文作者没有运行原生模拟、修改共享文件、push、部署或访问账号。
