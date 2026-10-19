# 阿罗夏 C0 实际事件账本

固定来源为 Optimizer `180a0a1015cb725c7570cd828eb086749960df98`，归档在 `packages/game-data/sources/optimizer-missing-components/alyosha/raw/`。`char_Alyosha_gen.json` 的 E/Q/A1 文本与 `tooltips_gen.json` 的 `11480001`、`11480002` 决定事件顺序；`skillParam.json` 的 `skill[3]`、`skill[4]`、`skill[5]` 分别给出印记 15 秒、精准加攻百分比和精准 15 秒。sheet 的 `skillPrecision_atk_` 仅对前台接受者生效，`passive1.heal` 使用 120% 阿罗夏攻击力。

`alyosha-observed-lifecycle.ts` 在 C0 下重放实际施印、再次施印激活并移除、附近队员领取精准、切人、Q 施放、猎场攻击及图加林攻击。每个事件有实际帧和同帧顺序。图加林命中已有印记时激活它；A1 治疗使用该次实际攻击与当时攻击力，并记录前台接受者。已有四个 E/Q 单击来源系数仍由原独立 calculator 行计算；账本通过 `hitBindings` 把单击绑定到真实事件，已命中检查与顺序成为计算依赖。

Q 文本给出 14 秒持续时间和两类各 2 秒的攻击周期，但没有首击帧、接近时间、目标选择或到期等号规则。本实现验证相邻同类攻击不得短于 120 帧，不从持续时间生成七次命中，也不把若干已观察攻击称为完整 Q。印记或精准恰在到期帧时须填写实际边界状态。精准仅提供前台攻击百分比；20% 星导反应增伤仅在检查事件明确确认星导辉映有效时记账。最终伤害面板仍须含实际攻击力，星导反应必须另证。C1–C6、队友 HP 账本、完整 Q 所有攻击数和目标轨迹不在此 C0 协议内。

检查：`npx vitest run packages/sim-core/src/alyosha-observed-lifecycle.test.ts packages/game-data/src/character-mappings/optimizer-source-formulas.test.ts --reporter=dot`。阿罗夏文件 3 项通过；同批另一文件的奈芙尔 Q 系数漂移断言曾失败，因为测试修改了另一个目录实例中的参数。测试现改用传入计算器的独立运行工作区；仅该失败用例的复查通过。原始输出分别存于 `docs/validation/alyosha-observed-lifecycle-20260928.log` 和 `docs/validation/nefer-runtime-workspace-drift-20260928.log`。
