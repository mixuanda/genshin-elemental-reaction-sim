# 观察事件与逐击面板输入编辑器批次（2026-09-29）

## 本批实现

初始缺口是奈芙尔、莉奈娅、桑多涅、阿罗夏的实际状态账本只能整段编辑 JSON；核心虽有各自严格 schema/reducer，普通用户没有按事件类型逐行输入的 UI。八个低／高下落模板可要求碰撞次数、接触和稳定面板，但不提供各个已接触 hit 的历史最终面板输入；因此不能在多击面板变化时满足“逐击快照”门槛。卡齐娜 C0 E 观察账本已有攻击事件，但 A1 岩伤生效与输入是否已经包含这份增伤尚须逐击记账。

现已增加共用事件行编辑器 `apps/web/src/calculator-observed-event-row-editor.ts`，接入 `apps/web/src/calculator-nefer-observed-controls.ts`、`apps/web/src/calculator-linnea-observed-controls.ts`、`apps/web/src/calculator-sandrone-observed-controls.ts`、`apps/web/src/calculator-alyosha-observed-controls.ts`。可按实际事件类型编辑字段、帧和顺序，增删／上下移动，绑定到普通命中；特殊露米重锤／百万吨重压另选匹配的 `selectedEventId`。高级 JSON 仍保留初始状态、观察完整性标志及精确导入编辑。桑多涅同帧次序由事件数组顺序承载。表单只记录实际观察，不推导持续时间、频率或命中数。四个事件编辑器的页面样本并未全覆盖：此轮浏览器仅采样奈芙尔事件账本；莉奈娅特殊 `selectedEventId` 选择器也未单独采样。

`packages/sim-core/src/observed-plunge-context.ts` 与 `observed-plunge-formulas.ts` 增加/消费分开的进攻面板稳定和目标防御／抗性稳定状态；`apps/web/src/calculator-observed-plunge-controls.ts` 为 Lohen、Linnea、Sandrone、Alyosha 的八个 low/high 模板增加逐次接触的历史快照行，绑定实际生成的碰撞／落地 hit ID；`apps/web/src/calculator-ui.ts` 管理草稿应用、恢复和丢弃。面板稳定路径保持原样。若多击未确认进攻面板稳定，每个实际接触 hit 都须有对应历史最终进攻面板；若未分别确认目标条件稳定，也会阻塞合计。未知值不能当零，也不能用当前面板假充历史面板。快照只冻结进攻侧，目标防御／抗性由独立目标状态处理。浏览器样本只覆盖 Lohen low 的碰撞加落地两击，不代表其余七模板均已页面验收。

卡齐娜 A1 改动位于 `packages/sim-core/src/kachina-cast-context.ts`、`kachina-cast-formulas.ts`、`apps/web/src/calculator-kachina-controls.ts`。每个真实接触事件可以注明 `a1Active`，激活时再说明当前手动增伤／历史快照是否已含 A1 的 20% 岩伤；共享公式只补未包含的份额，防止重复加算。固定 Optimizer 系数和持续文本只定义参数，不决定实际激活边界；相关限制及数值例见[卡齐娜 A1 专报](kachina-a1-observed-20260929.zh-CN.md)。

## 验收记录

来源基线为 HEAD `84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5`，与测量记录一致；指针 SHA-256 `bcff67a4c25f405aac867e8924d3375dfa5405c2f08e5343c1f89977c7bc67e7`，运行时 SHA-256 `414badb3c7f2e145c039b61048507df6ae2160ce15fb377784a2a6c58f8de045`。当前 catalog 为 `snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34`，preview workspace 为 `snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217`；active verified snapshot 为 null。完整命令与机器收据见[测量记录](validation/observed-input-editors-measurements-20260929.json)。

窄单元结果：下落映射两例通过，测试体 54 ms、命令墙钟 5.649 s；卡齐娜聚焦用例 6/6 通过，测试体 80 ms、命令墙钟 5.453 s。事件／快照页面采样所用 Web build 通过（5.956 s）；单页 E2E 1/1 通过（用例 5.0 s、墙钟 6.593 s，`pageErrors=[]`）。页面交互的两次初始失败均留档：第一次选到简单低空落地而非碰撞＋落地模板；第二次在接触选择器出现前等待，未先离开次数输入框触发既有 blur 更新。之后追加的 Linnea `selectedEventId` 选择器与标签文案修正曾遇 `exactOptionalPropertyTypes` 类型错误，改为条件性省略非激活字段后最终 `npm run build` 通过（6.801 s，含 typecheck 与 Vite，Vite 1.35 s）。这最后一处修正没有再做浏览器采样；没有运行广泛测试矩阵。

浏览器教学输入包含14条奈芙尔事件；明确选择接触为“否”会阻塞该命中，编辑与恢复伤害期望均为 `3453.2289791999997`（差0）。Lohen low 的碰撞＋落地原期望为 `2843.0235000000002`，编辑后为 `2899.8936000000003`，JSON 恢复仍为后值（差0）；缺逐击快照会阻塞，不完整草稿会隐藏旧结果。它们是教学输入，不是游戏内测量。

## 覆盖与边界

当前 v29 静态分类仍为 124 个角色身份、1271 个分类命中、713 个 complete action、24 个 partial action、0 个 blocked mapping；另有8个 standalone special components，作为单独分母。`independentlyVerifiedReleasedRoster=null`；`teamSimulationReadyFromTheseMappings=0` 仅是该静态映射分母的状态，不统计固定来源注册或可执行团队引擎。本批不改变分类或 verified 数。固定数据仍在已发布 7.1 快照，7.1.51 仅作为隔离的未映射候选，不等于 7.2 V1；该结论沿用[已有证据刷新记录](data-evidence-refresh-20260928.json)，本批没有新做版本观察。原生动作来源报告指针保持 [source-action-origin-20260929.zh-CN.md](source-action-origin-20260929.zh-CN.md)。本批没有提升游戏验证，不证明完整原生技能／完整实体寿命，也不宣称全量 goal 完成。
