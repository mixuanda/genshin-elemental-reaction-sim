# 外部 gcsim 可执行程序交叉验证

结果：**一项受控普通伤害案例通过**。采集：2026-09-23T06:27:27.756Z。上游 [gcsim v2.44.1](https://github.com/genshinsim/gcsim/releases/tag/v2.44.1) 的标签、二进制 `-version` 与输出 sim_version 均锁定 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。实际运行官方 macOS arm64 二进制，SHA-256 为 `2332566a3c06ab1b50003024b1838ee3565d2969bd4a004a35a60f482cbc8449`；没有用读取上游公式源码代替外部执行。固定版本的 [MIT 许可](./gcsim-LICENSE-MIT.txt) 随证据保存。

复现：`node docs/cross-validation/run-gcsim-comparison.mjs`。脚本下载到临时目录并校验哈希，不安装全局工具；也可传入相同哈希的已有二进制路径。当前封装仅支持 macOS arm64。

[输入配置](./gcsim-ordinary.gcsl)：一级 C0 安柏、一级 R1 猎弓、1/1/1 天赋、无圣遗物套装或额外属性（仅添加 CR −5% 抵消角色初始 5%），对等级 90、物理抗性 10% 的单个敌人，2 秒内只执行一次物理普攻。Hitlag 关闭，无反应、增益、产球或武器被动。本地显式输入解析后的 ATK 41.9434、倍率 0.3612；没有再次叠加武器/角色属性。帧 25 只有一次伤害；外部 sample 明确无暴击、无反应、无 pre_damage_mods。

`41.9434 × 0.3612 × 1 × (101 / 291) × 0.9 × 1 × 1 × 1 = 4.732408961072165`

外部实际伤害：**4.732408961072165**。同时检查 aggregate 的单次总伤害与 sample 一致。比较绝对容差为 1e−12，只用于 IEEE-754 数值对齐。

| 本地路径 | 伤害 | 对外部绝对残差 |
| --- | ---: | ---: |
| localSimulation | 4.732408961072165 | 0 |
| ordinaryFormula | 4.732408961072165 | 0 |
| structuredTrace | 4.732408961072165 | 0 |
| capturedHitReplay | 4.732408961072165 | 0 |
| standaloneCalculator | 4.732408961072165 | 0 |
| expectedCalculator | 4.732408961072165 | 0 |

[原始外部汇总](./gcsim-ordinary.result.json)、[原始逐帧 sample](./gcsim-ordinary.sample.json)、[本地完整模拟](./gcsim-ordinary.local-result.json)、[独立计算器输入](./gcsim-ordinary.calculator.json) 和 [机器报告](./gcsim-comparison.json) 均保存。外部执行是 1 次汇总迭代加单独 1 次 sample；CLI 自选的种子以字符串原样存档。本案例关闭所有影响结果的随机来源，因此每次伤害应一致，不能要求时间/种子等元数据字节一致，也不能把此案例称为 Monte Carlo 分布验证。

初次参数探测使用 `hitlag=0` 导致上游解析失败（exit 1，expecting 32, got token 0）；改为文法要求的 `hitlag=false` 后正式命令 exit 0。实际 stdout、参数、环境、源文件和输出哈希见机器报告。

此结果只覆盖该已对齐上下文的一个普通物理命中及其本地独立计算器还原。未验证安柏或武器的完整实现、反应、轮转、能量、随机反馈和全量数据覆盖；它也不是官方游戏真值。后续本地核心改动后须重新运行，当前结论仅属于已记录源码哈希的快照。
