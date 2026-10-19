# 桑多涅辉映下的普通扫射与超载射击

本次只修正 C0 观察式单击的分支归属。固定 Genshin Optimizer 提交 `180a0a1015cb725c7570cd828eb086749960df98` 的 [Sandrone sheet](../packages/game-data/sources/optimizer-missing-components/sandrone/raw/libs/gi/sheets/src/Characters/Sandrone/index.tsx#L215-L251) 第 215–251 行把 `sweepDmg`（216）和 `overdriveDmg`（244–249）写成普通 `dmgNode` 冰伤，没有 `condA0StellarRadiance` 门；该门只出现在 `beamStellarDmg`（218–230）和 `beamSsDmg`（231–243）。同一归档的[英文技能文本](../packages/game-data/sources/optimizer-missing-components/sandrone/raw/libs/gi/dm-localization/assets/locales/en/char_Sandrone_gen.json#L15-L20)第 15–18 行说明辉映替换的是凝聚光束，解析模式扫射及超载模式的冰伤分别描述。因此，已观察到的星导／星旋辉映本身不阻塞普通扫射或超载射击；光束仍须按实际辉映选择普通或星反应替代组成。

修改限于三个文件：[观察事件解析](../packages/sim-core/src/sandrone-observed-lifecycle.ts)、[两条普通来源映射的假设与排除项](../packages/game-data/src/character-mappings/optimizer-additional-mappings.ts)、[针对性测试](../packages/sim-core/src/sandrone-observed-lifecycle.test.ts)。事件解析保留实际模式、接触目标、快照及精确来源命中绑定；普通扫射需解析模式，超载射击需超载模式。凝聚光束的原有辉映替代门没有改变。来源映射没有新增或改动倍率；最终普通命中计算器、敌方防御／抗性、暴击和增伤路径也没有改变。现有 UI 已提供辉映与攻击类型观察字段；教学示例的旧措辞已由主任务更新。

已执行一次 `npx vitest run packages/sim-core/src/sandrone-observed-lifecycle.test.ts`：一个文件、三项测试通过；Vitest 用时 10.01 秒，命令墙钟约 11.32 秒。新增测试实际绑定并计算星导下扫射与星旋下超载射击，同时证明星导下的普通光束文档不能冒充替代光束。主任务随后报告包含本次改动的 Web 构建最终通过（8.718 秒）；此处仅转录，不重跑。详细执行记录见 [JSON 回执](validation/sandrone-radiant-ordinary-checks-20260929.json)。

此结果是固定来源表达式与用户明确观察状态下的条件计算，不是实机机制验证。扫射／超载次数、命中、发射间隔、热量变化和完整 Fagio 窗口归属仍须由实际观察事件提供；本次没有把所选单击提升为完整施放。
