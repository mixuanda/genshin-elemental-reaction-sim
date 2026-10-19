# 自动月感电参考模拟

`simulateLunarChargedProfile(config, { party, ...runtimeOptions })` 是独立、显式选择的团队运行模式。`party` 将模拟 actorId 一一映射到来源中的 characterKey，至少一名 `ineffa`、`flins` 或 `columbina` 才能启用。配置被哈希绑定，普通 `simulate` 不接受这一选项以免把只包含普通伤害的部分结果当完整总伤害。

当前范围：`aura-v3` 逐角色附着、单个静止范围内目标、60 FPS 无目标卡肉、Hydro／Electro／Physical、无未归属的初始附着。保留当前合法时间线、能量、普通伤害、Buff 与减抗；未建模角色被动不会自动补全。其他元素混合、目标阶段、玩家伤害反馈及修改特殊贡献者的插件会明确阻止运行。

每次成功附着先执行真实 ICD。水雷相遇时，在普通感电的扣量和任务创建之前替换：正常附着而不创建普通 EC 定时伤害。雷云在触发后第 9 帧扫描，此后每 6 帧检查，目标伤害间隔 120 帧，330 帧存在时间在新触发时刷新。扫描读取该帧仍为正的每个角色水／雷附着，并从共享面板和减抗状态快照独立贡献者。交付伤害后每个个人 Hydro、Electro 槽各扣最多 0.4U，生成专属时间线变更。相同帧的雷云任务先于下一个普通事件，是本参考配置的明确调度规则。

返回 `lunar-charged-simulation-v1` 复合结果：`baseResult` 保留真实普通事件，`specialDamageEvents` 保存月感电实际命中及上下文、公式轨迹、扣量前后状态，`totalDamage = classicDamage + lunarChargedDamage`。特殊事件未伪装成普通剧变事件，没有虚构 DEF 或普通增伤因子。

`lunarChargedEventToCalculatorDocument(result, eventId)` 恢复完整独立贡献者、来源版本、目标有效抗性及自动状态出处，经同一特殊公式核心复算后才允许打开独立计算器。可执行精确独立暴击期望、全部暴击、全部不暴击；尚未声称特殊贡献者随机抽样完成。

证据状态为 `fixed-source-provisional`。该模式使用锁定参考来源，不能视为当前正式游戏已完成实测。普通模式未开启此功能时保持原行为。月结晶另有已接入真实队列的独立参考模式，见 `lunar-crystallize-simulation.md`。月绽放／星导／星旋目前仍只提供明确受限的独立状态与公式模块，不能把未交付的伤害意图加入正式总伤害。

## 本次执行验证

集成测试 `lunar-charged-simulation.test.ts` 的 4 项，加原有 execution-context 的 7 项，实际共 **11/11 通过**（一次运行 1.60 秒）。覆盖：三名独立贡献者的个人扣量；普通感电抑制；云生成、两次交付与到期；当前 Buff 和减抗快照；JSON 后同次普通／特殊命中复算；被修改的特殊上下文拒绝；水雷分别在 85／91 帧自然到期的边界记录。

供浏览器验证的 `docs/fixtures/lunar-charged-reference.synthetic.json` **仅是明确合成的机制输入，不代表真实角色或合法实装动画**。此输入实际运行得到普通伤害 1047.375、月感电 12991.61325362727、合计 14038.98825362727；云命中位于第 15、135 帧。对应选项和运行标识保存在同目录 `.expected.json` 文件。此机制测试不提升真实角色覆盖率或当前游戏验证状态。
