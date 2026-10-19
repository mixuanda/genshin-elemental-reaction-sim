# 固定来源角色辅助标量：治疗、反应加成与冷却

本批把固定来源 b4/a7 中可证明的角色治疗、反应加成与相关标量接入共享公式。共 35 个 descriptor：A 组 12 条、B 组 23 条；按源码适用版本，b4 引用 22 条、a7 引用 33 条。它们是固定第三方源码的 provisional 行为，不代表游戏机制 verified，也不改变验证分母。

## 实现与保留边界

实现位于 [`source-host-character-scalar-formula.ts`](../packages/sim-core/src/source-host-character-scalar-formula.ts)、规则表 [`rules-a`](../packages/sim-core/src/source-host-character-scalar-rules-a.ts) 与 [`rules-b`](../packages/sim-core/src/source-host-character-scalar-rules-b.ts)，以及两来源的 030 provenance、031 A 组和 032 B 组 Go 补丁。真实状态 getter 只在来源原读取点执行并将同一读值回执连入公式；其他未绑定的状态叶继续作为原生观测值。Go 原生门控、目标、生命周期、nil 返回、日志和状态副作用仍保留。公式接入不等于新增角色 modifier 专属编辑器。

源码语义经复核的关键例子：白术 A4 的 Go `switch` 无隐式 fallthrough；激化加成为 `0.008` 分支，Bloom/Hyperbloom/Burgeon/BurningDamage 保持初始化 `0.02`，DirectLunarBloom 单独为 `0.007`。Nilou A4 初始字段为零，只在没有已有创建回执时登记零值；再次进入 A4 不清空旧值，原 30 帧更新才重读 MaxHP 并替换快照。Furina 爆发在 Q 创建时按天赋表保存治疗倍率，后续治疗公式通过 `valueSources` 引用该创建回执并计算 `min(fanfare, cap) × ratio`，避免重复计入倍率贡献。

版本边界也保留在 descriptor 与 Go patch 中：Ifa 只存在于 a7；Mizuki 扩散表和计算顺序按 b4/a7 分别表示；七七启明星辉反应、冰旅行者 C6、八重 C1 与 Odette 的相应公式只适用于 a7。旧辅助审计中 Ifa 被标成 b4 适用的条目已按 pinned 源码更正。完整语义及版本差异见 [`source-character-scalar-source-notes-20260928.json`](source-character-scalar-source-notes-20260928.json)。

尚未桥接的 `StatMod`/`AttackMod` 向量另见 [`source-character-vector-remaining-20260928.json`](source-character-vector-remaining-20260928.json)：两来源共有 243 个原回调、按源码路径与 body hash 去重为 139 个 callback body。该文件以 producer 与写入证据作静态分类，不表示剩余项可自动迁移或已证明运行时生命周期；classic source identity typo 已按构建 manifest 更正，hash 与源码根未变。

## 验收与边界

classic 与 stellar Go source build 首轮通过，分别 5.967 秒和 6.336 秒。初始 WASM SHA-256 与大小为 classic `e287d709526eee9978281a1868e6d2f6f0e64e16f0b4a9e4fb8a6d5425185270`（42,427,005 bytes）、stellar `a37ca20e97b5930ad67ea94d47997e4f33f1af0e74f9019ea5092d103cc85980`（63,751,843 bytes）。后续 033 a7 bridge 修复后仅重建 stellar，5.196 秒，最终 SHA-256 `e2df09de713cb5dfc89f6e0013c0ec8301ff76c8cf7a456949554b8cb844fbcc`（63,954,959 bytes）。Web build 首次通过（3.772 秒，713 modules，Vite 853 毫秒）；a7 bridge 更新后新 bundle 也通过（3.729 秒，713 modules，Vite 851 毫秒）。

E2E 首轮（3.371 秒）因测试直接从 application 查找 Mona 反应基础伤害而漏掉 component 路径失败。retry 1（8.012 秒）通过 classic field 与 bloom 断言、计算器 JSON 恢复，但在 stellar field 暴露真实问题：a7 `CharWrapper` 缺 `SourceHostBridge`，导致 `CalcReactionDmg` 没有启用共享 base；Mona 标量 calculation #187 实际执行，却没有连入十帧后的 damage calculation #190，造成计算来源链断裂。这些编号不是伤害数值，本次发现不证明原伤害数值错误。[033 补丁](../packages/source-host/stellar-overlay/patches/033-a7-delayed-electrocharged-provenance.patch)补齐该 bridge 后沿用既有 `snap.SourceHostComponents`，保留原预计算与排队时点；这是接通适用的共享反应接口，不更改原生反应时序。随后只对未通过的 stellar lane 重建和复跑，retry 2 通过（墙钟 5.254 秒，测试 3.8 秒，runner 4.7 秒，`pageErrors[]`）；classic lane 未重跑。

两 lane 各覆盖 18 秒、1 iteration、seed `20260928` 的 field 与 bloom 场景。Field 每 lane 252 calculations、27 applications、5 个治疗应用；bloom 为 classic 452 / stellar 450 calculations、各 51 applications 与 30 个治疗应用。每 lane 观察到 8 个 scalar 规则 ID；Nilou 初始零值创建没有消费者，跨 lane 合并观察到 9 个规则 ID，而不是 35 条规则全测。测得的关键值包括 Chongyun C2 `−0.15`、Diona C6 `0.3`、Mona C1 `0.15`；stellar 正值 Furina 治疗倍率 `0.00021015753509851589`、Nilou A4 `2.101897915809985`、Baizhu A4 `0.610585796318832`。Baizhu、Nilou 与 Furina 的来源分支和引用值均按共享公式回放差值 0。Classic Furina 首次只验证到零 fanfare 读值；正值 Furina 选择只在 stellar retry 2 验证。旧 0.02/0.007 branch 不作错误游戏推断。

Ifa 仅存在于 a7；其公式读取 `nightsoul`、`bonusPoints`、`capIncrease` 三个 Go 提供的状态叶，helper 如何产生这些值仍由原生路径维护，本次没有把 helper 内部状态展开为独立共享公式。其他 helper 状态叶同样保留为观测输入。最终规则观测联合仅 9 个 ID，未覆盖其余 26 个 descriptor；剩余向量清点也是语法与 producer 证据，不是自动迁移或运行时验证。数据与 preview 指针未改。

收据及原始场景：[首轮 Go builds](validation/source-character-scalar-classic-build-20260928.json)、[033 stellar rebuild](validation/source-character-scalar-stellar-build-033-20260928.json)、[首次 Web build](validation/source-character-scalar-web-build-20260928.json)、[033 Web bundle](validation/source-character-scalar-web-build-033-20260928.json)、[E2E retry 1](validation/source-character-scalar-e2e-retry1-20260928.json)、[stellar-only retry 2](validation/source-character-scalar-e2e-stellar-retry2-20260928.json)、[测量汇总](validation/source-character-scalar-measurements-20260928.json)、[classic field](validation/source-character-scalar-classic-field-20260928.result.json)、[classic bloom](validation/source-character-scalar-classic-bloom-20260928.result.json)、[stellar field](validation/source-character-scalar-stellar-field-20260928.result.json)、[stellar bloom](validation/source-character-scalar-stellar-bloom-20260928.result.json)。本轮不是 35 规则全矩阵，也不构成游戏 verified、完整角色机制验证或全量目标完成。

最终 `git diff --check` 通过（0.073 秒），范围仅为已跟踪文件的 diff；不据此声明未跟踪文件已获该项检查。见[收据](validation/source-character-scalar-diff-check-20260928.json)。
