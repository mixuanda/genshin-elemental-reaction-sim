# 随机武器追击：普通页面验收

结果：统一生产构建通过后，唯一一条新增 Playwright 流程首跑通过，**1 passed（3.2s），退出码 0**。没有浏览器失败或重试。复用既有 4173 生产预览；本任务未构建、启动或重启服务器，未运行旧用例、额外核心测试、性能测试或大型蒙特卡洛。

文件：`apps/web/e2e/random-weapon-proc-runtime.spec.ts`。

本流程从明确标注的合成配置导入开始，通过普通队伍页启用追击，选择忍冬之果 R5、显式物理伤害加成 0 与普攻标签。检查新增五把武器在普通入口可选；实际执行只用一个 R5 霜葬场景，不逐把展开浏览器矩阵。

场景沿用 `packages/schemas/src/random-weapon-proc-integrity.test.ts` 已通过的合法时间线反例：单次普通动作含两段 F0 命中，两目标初始冰附着；先执行 100% ATK 物理命中，再执行 0 倍率、2GU 火附着。两段均显式声明目标与命中。后者清除原目标的冰，真实延期回调选择 140% 基础倍率，邻近目标仍有冰也不重新选择强化倍率。

| 项目 | 独立手算或执行要求 | 浏览器实际结果 |
| --- | --- | --- |
| 宿主物理伤害 | ATK 1000、等级 90/90、物抗 0、非暴击：`1000 × 1 × 0.5` | 500 |
| 追击交付与伤害 | F1；每目标 `1000 × 1.4 × 0.5` | 两目标各 700，总伤害 1900 |
| 同帧真实顺序 | 先火命中，再执行宿主的延期追击回调 | F0 火队列序号 2；回调序号 3 |
| 原目标状态与 AoE 分支 | 宿主伤后仍有冰，火后原目标无冰；邻近目标仍有冰但共用 1.4 | 全部成立；实际回调 `cryo=false, frozen=false` |
| R5 抽样 | 概率 1 仍消耗独立随机抽样 | roll `0.8347660845611244 < 1`，drawIndex 0，drawCount 0→1 |
| 公式及记录还原 | 账本→逐击公式→独立计算器；命中 JSON；完整记录重跑 | 差值均为 0；完整共享公式行与原结果一致；完整记录恢复结果完全相同 |
| 单周期稳态检查 | 随机流与延期回调未纳入完整检查点时明确阻塞 | `steady-state-not-established`；`checkpointCoverage.complete=false`，包含对应原因 |
| 微型批次来源 | 只运行 2 次短批次 | iterations 2、均值 1900、无置信区间；实际首轮种子 `schema-random-weapon:iteration:0` |

导出批次实测 `rngPolicy=seeded-particles-and-declared-independent-streams-v1`，`weaponProcPolicy.id=gcsim-random-weapon-proc-v1`，`rngStream=independent-weapon-proc-v1`，`rngAlgorithm=fnv1a32-mulberry32-v1`，`matchesGcsimRandomSequence=false`。测试检查实际抽样值完整显示、原目标分支说明、独立伤害上下文保存，没有把触发概率乘进已触发伤害。

实际命令：

```sh
GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/random-weapon-proc-runtime.spec.ts --reporter=line --output=test-results/random-weapon-proc-runtime
```

原始证据：`docs/validation/random-weapon-proc-runtime-browser.log` 与 `docs/validation/random-weapon-proc-runtime-browser.exit`（0）。输出目录 `test-results/random-weapon-proc-runtime`，本流程配置仅失败时保留 trace，且关闭快照；本次通过无失败 trace。

构建前的夹具修正也保留在工作记录：首次统一构建提示两处 `targeting` 缺少必填 `outcome`。同步 schema 已实测场景后，补入 `outcome: landed`，改用合法时间线与主目标 `enemy-0`。这些在浏览器执行前完成，不记作浏览器失败或重试；1900 的独立伤害预期没有更改。

验证范围只覆盖锁定源码、无角色卡肉条件下的已接入普通伤害回调。普通入口已验证五个新武器选项，但实际浏览器模拟仅验证忍冬之果 R5 代表场景，不声称浏览器逐把覆盖。随机流及延期回调的完整检查点仍是明确阻塞；两次批次只验证来源记录，不证明分布收敛、随机稳态、当前游戏实测、全伤害回调或与 gcsim 同种子随机序列一致。
