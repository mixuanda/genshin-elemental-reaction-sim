# 功能与复现草案（未发布）

这是2026-10-21的本地开发记录，不是“全部角色已实现”或申请通过声明。历史快照、分支和dirty工作均保留；本轮未push、合并或部署。上一次完整回归2794通过/95失败，本轮完整回归另以原始日志为准，不能把定向通过写成全绿。

## 需求与实际验收边界

| 用户需求 | 本轮实际状态 | 尚缺 |
|---|---|---|
| 独立单技能计算及逐步示范 | 原功能保留；没有改其公式或展示 | 本轮没有重新验证全部示范、角色和技能 |
| 真实角色/武器/天赋 | 固定来源命中映射逐身份导出；来源身份、系数、条件与部分动作分别保留 | 社区实现/目录不等于官方认证；全角色独立验证未完成 |
| 15/18/20秒轴、60/120秒循环 | 新合成测试验证循环展开、终点边界；120秒水火连续模拟手算对照、冷却、能量拒绝及暴击检查 | 不是所有角色、反应或原生Go宿主的120秒验收 |
| 满能量开局开关 | 零/满两种开局的120秒爆发时刻按手算核对 | 不证明任意队伍可循环 |
| N5/N6难度预设 | 此项指幽境危战难度，未计为已完成 | 需独立核实真实难度参数；普攻N1–N6不是替代 |
| 1/2/4/8/16x、直接出结果 | 来源队伍页新增已计算结果的时间游标回放；倍率不重算结果 | 本轮不是战斗动画，也尚未接所有普通结果页的视觉回放 |
| 1000/10000次、进度/取消/线程 | 普通TS模拟已有采样统计；本轮添加1/2/4 Worker控制、全局索引种子、故障取消同组Worker；保留首轮轨迹 | 当前不是Go/WASM来源宿主的并行接口；高复杂队伍仍须单独测资源 |
| UID→名字、等级、天赋 | 既有映射入口保留 | 本轮未联网访问用户UID、未做全量导入验收 |
| 中文UI、清晰计算表 | 新控件中文；未把来源审计塞回每一行 | 全页面可访问性与Windows/Edge真实设备仍未验证 |

## 复现

使用已有package-lock.json，在独立克隆目录执行 `npm ci`、`npm run typecheck`、`npm run build`。本次使用现有云依赖，未升级包。源宿主二进制不是主站构建自动生成的完整替代；Classic与Stellar构建、来源归档和哈希检查分别见 packages/source-host/README.md 与 stellar-overlay/README.md。不能下载一个不明二进制替代。

定向单测：`npx vitest run packages/sim-core/src/__tests__/continuous-120-second.test.ts packages/sim-core/src/__tests__/ordinary-aura-target-phase-checkpoint.test.ts packages/sim-core/src/__tests__/player-health-phase-checkpoint.test.ts apps/web/src/timeline-playback.test.ts apps/web/src/batch-statistics.test.ts apps/web/src/worker-client.test.ts`。

浏览器：先build，再运行 `npx playwright test apps/web/e2e/source-runtime-cursor.spec.ts apps/web/e2e/batch-parallel.spec.ts --workers=1`。原用例在真实WASM运行、五倍率和刷新保存合并后需要90秒总预算，断言未删除。批量测试先32次比较1/2/4线程，1000次少于20秒才扩至10000，超预算明确记为未运行。

统计：默认解析期望暴击不是随机暴击样本；明确选择“按种子逐击随机暴击”才逐命中抽样，采样后使用allCrit/noCrit公式，不再乘期望系数。每次种子为 base:iteration:index，分区不改变index，归并按原索引排序；样本标准差与P05/P50/P95描述单次离散，95%均值区间为至少30次时的正态近似，不保证任意分布覆盖率，也不证明随机稳态。部分机制结果不得汇总为完整批量结果。

## 贡献说明草案

从独立功能分支开始，保留来源版本/哈希和最小失败复现；机制修改需固定来源或独立公式证据，不能用当前输出生成自己的真值。运行受影响定向检查，再核对完整回归失败差集。历史Golden和wire不能批量重录。数据完整、机制完整、模拟可执行、游戏独立验证必须分别报告。提交不得夹带凭据、玩家私人数据或未核许可资源。贡献授权条款待项目许可证选择后明确，当前不要求贡献者接受新CLA。

本项目是非官方社区工具，与游戏权利人及其产品不存在官方隶属、认可或担保。Codex for Open Source申请尚未提交；测试状态、使用量和支持范围应据实填写。

## 已核真实角色120秒闭环

2026-10-21，Linux Chromium通过凯亚C0、角色90、战技天赋1、无锋剑90的固定Classic b4来源测试。输入固定uint64种子12021，战技后等待600帧，12次请求，原生观察窗口真实抵达7200帧且结束原因duration。实际12次霜袭命中，首击29帧、末击6904帧，间隔均超过来源360帧冷却；12条能量应用。总原始伤害5874.260315821921。每击按固定来源倍率1.912、同等级防御1/2、抗性0.1与原生暴击结果手算一致，每击独立计算器回放差0，末击能从页面进入独立计算器显示基础面板。

来源为internal/characters/kaeya/skill.go与zz_kaeya.dm.go，固定revision b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541；实际WASM SHA256=e5fccf99fdf90f95689dab13f25b28597113073641f84a2d0f4ae4130be38c07。已有kaeya-skill-hit映射保存全15级倍率，这次只验天赋1。结果保留provisional、解释partial，未提升verified。范围仅凯亚E重复与原生产球，不含Q能量循环、反应队或全部命座机制；原生来源并非游戏实机证明。

测试入口apps/web/e2e/kaeya-120-second.spec.ts；原始capture、日志与摘要在本次交付证据中。首轮错误期待未触发反应时的原生amplifyingMultiplier=1；现有公式明确以amped=false选择无反应路径，故改查amped=false并保留独立手算，没有改生产公式。

## 并行接入与证据精度

并行入口是普通TypeScript结果页的threadInput→runSimulationBatchInWorker→simulation-worker，不是原生Go来源页的多线程开关。1线程保持原请求格式；2/4线程携带全局sampleStart/totalIterations。每个Worker有自己的状态，种子与全局trial编号绑定；单次运行仍保留原seed。浏览器实际比较了32个trial各自总伤及首轮完整轨迹，1/2/4线程一致；没有保存并比较其余31轮全部逐事件日志。取消与完成后测试所跟踪的模拟Worker数为0，单测另覆盖脚本错误、反序列化错误及迟到消息。

回放入口仅来源队伍页的已有帧游标，使用独立展示时钟；所有倍率播放后导出JSON完全相同。并行和回放尚未承诺真实Windows/Edge性能。1000/10000采样证据是合成普通命中，不替代上面的真实凯亚E-only闭环。

## 最终回归收尾

本轮最终完整单元回归为2820通过/94失败（2914项），相对2794/95基线新增25项、删除0项、新增失败0项。修复诺艾尔原有失败1项；其余失败未掩盖。两轮均排除performance.test.ts。构建含typecheck、数据检查以及修复后小规模并行浏览器检查另见交付full-checks.json，不能称发布门禁全通过。
