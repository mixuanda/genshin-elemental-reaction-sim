# 固定来源起步能量敏感度对照（2026-09-28）

本轮为 b4／a7 来源请求增加显式 `initialEnergy` 政策，用同一来源脚本比较零能、满能及可选的逐角色自定义起步。实现只在解析后的队伍配置中调整 `start_energy` 参数，不改写用户 GCSL 文本，也不替换其他角色参数。起步快照在原生角色初始化完成后、首次行动前读取实际能量；请求值与实际值分开记录，不能把 requested 当成模拟器实际采用值。

## 原生实现与边界

两版本分别在 `packages/source-host/go/cmd/sourcehost/initial_energy.go` 与 `packages/source-host/stellar-overlay/go/cmd/sourcehost/initial_energy.go` 实现相同政策。`zero` 为每名角色的解析后 `start_energy` 写入0；`full` 删除该参数，让固定 GCSim 初始化使用原生满能默认；`custom` 按 canonical actor key 写入逐角色整数。zero/full 不接受 `byActor`；custom 必须精确覆盖队伍每名角色，键不得重复、未知或缺失，值为非负整数。实际能量与上限由 `captureStartupEnergy` 在 `simulation.New` 完成之后、`sim.Run()` 之前读取并随结果返回；custom 请求超过原生角色可用范围时以实际值和上限为准，不把请求数值误报成实际初值。

请求路径只对解析配置做 `start_energy` 覆写，不改 GCSL 字符串或其他 `Params` 项。该政策在一次完整原生运行开始时应用一次；运行中不会在轮次、循环或观察窗口边界补能，也不改变行动能量消耗或粒子回能规则。重执行输入会保存 `initialEnergy`，重放检查请求身份和初始化后实际状态。

## 页面敏感度对照

普通 `/source-simulation` 增加起步敏感度面板。每组任务从同一脚本、来源变体、执行模式与种子各自启动独立完整来源运行；种子数限制为2至32个不重复的 uint64 十进制值。必有 zero/full 两组，可选加入 custom；custom 要为全部成员填写来源 actor key 和整数初能。页面报告每次运行的实际起步状态，并根据用户选择的预热与窗口长度，对同一轨迹的两个相邻半开观察窗口做分析。

对照必须使用相同队伍、脚本、WASM、实际时长、执行模式、种子集合及窗口边界。差值先在匹配 seed 内计算，再跨 seed 汇总；相同 seed 仅是配对键，并不保证零能与满能两条已分叉轨迹的随机抽样逐事件对应。有限起步差异统计不穷尽角色、队伍或随机状态，也不证明长期稳态。

完整 `source-host-startup-v1` JSON 可导出与导入，包含各次原生运行、来源与 WASM 身份、初能请求/实际状态和观察政策。改变观察窗口后可用保存轨迹重新计算汇总，不额外启动 Worker 或重跑来源。单次来源完整重执行与已有单击 capture 仍分别保留初能政策/状态；它们的用途和验证等级不与起步敏感度汇总混同。

## 构建与实测记录

- b4 与 a7 来源 WASM 构建均首轮通过：b4 用时3.368秒，SHA-256 `c3b46cd940798beda2bc17fed601979da3a6ef1c4729385b055418d35176f681`，41,966,295字节；a7 用时3.719秒，SHA-256 `d449be21b8640b036878649200897e7a4f770dbddf48b931295c97fb23f23a1f`，61,580,559字节。收据分别为 `docs/validation/source-startup-classic-build-20260928.json`、`docs/validation/source-startup-stellar-build-20260928.json`。
- 两项聚焦核心用例通过，命令筛选出的2项通过、另有2项旧用例因 `-t` 未匹配而跳过；这不是全套核心测试。收据：`docs/validation/source-startup-core-20260928.json`。
- Web 构建首轮因 TypeScript 错误退出1（2.627秒）；retry1 退出0，用时3.695秒，679 modules、Vite 853ms。两次收据与首次错误保存在 `docs/validation/source-startup-web-build-20260928.{json,log}`、`source-startup-web-build-retry1-20260928.{json,log}`。
- 聚合页面验收首轮通过：1个 Playwright 用例，用例2.8秒、runner 3.6秒、墙钟4.098秒；收据 `docs/validation/source-startup-browser-20260928.json`。报告结果在 `docs/validation/source-startup-sensitivity-20260928.result.json`，派生数值在 `docs/validation/source-startup-measurements-20260928.json`。
- Noelle 队伍实跑 b4 六条、a7 四条各5秒轨迹：每来源两种子 zero/full；b4 另含两种子 custom（请求1000）。原生快照为零能请求0→实际0/60、满能无 requested 数值→实际60/60、自定义请求1000→实际60/60。实测只说明此角色与此脚本下的原生初始化结果。
- 两来源的同种子数值一致。seed 1、满能第一窗口 `[1,121)` 伤害821.3520391992001、DPS 410.67601959960007；第二窗口 `[121,241)` 伤害406.15858338400443、DPS 203.07929169200222。seed 2 第一窗伤害1560.5688744784802、DPS 780.2844372392402；第二窗伤害771.7013084296084、DPS 385.8506542148042。窗口均为两个相邻2秒窗；零能两窗伤害均为0。
- 零能每个两秒窗口记录120次 `insufficient energy`。这是同一 GCSL Q 命令的原生自动重试记录，不是120次用户输入的Q；页面说明文案已据此更新。满能及自定义运行的首个窗口接受一次Q，第二窗没有接受Q。
- Classic 满能 seed 1 另从头重执行通过：3个应用／3条计算／89个原生日志事件；保存的 full 初能 capture 伤害344.9678564636641，重现差0。汇总、两个 batch 与一次完整重执行合计使用3个 Worker；JSON 导入后改窗口重新分析不新增 Worker。
- Web 首次构建 TypeScript 失败和 retry1 通过仍如前记录。随后仅更新零能自动重试的说明文案，最终 web bundle 构建退出0，用时1.162秒、Vite 883ms（`docs/validation/source-startup-final-bundle-20260928.json`）；没有为文案修改重跑已通过的核心测试或页面流程。

上述记录证明所列固定来源构建、有限页面流程与特定 Noelle 场景。它们不证明随机稳态、任意角色/队伍初能差异、完整 GCSim 检查点或游戏内行为已验证；本轮不改变主提示数据分母。
