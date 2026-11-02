# 两处旧消费者身份的定向验收（2026-10-23）

基线 `fcdf2e9897d14328c67c0b5443398edc39c8765e`。本次修的是旧测试对已替代入口的期待；未改生产映射、注册器、公式、UI、schema、Golden 或容差。范围限于 `classified-hits.test.ts` 中指定的两个复合测试及新增的独立测试文件。

原样运行两个测试，结果 **0 通过、2 失败、9 项未选择**。首次失败分别在原文件第 161、191 行：查询 `aether-anemo-burst`、`iansan-swift-talent-unresolved` 返回 `undefined`，随后 `calculateDocument` 抛出根对象缺失的 Zod 错误。不是伤害容差问题，也不应恢复旧映射迎合测试。

| 原消费者期待 | 当前入口与本次保留的保护 |
| --- | --- |
| `aether-anemo-burst` 旧入口仍存在且阻断 | 改用 `traveler-cross-aether-anemo-burst-c0`，保留空／风／Q 天赋身份。未知条件仍阻断；明确一次完整施放、C0、剧情增益关闭、未吸收元素、无中断／卡肉、实际接触及稳定面板后，核验九击和伤害。旧固定 blocker 不再存在，阻断由真实条件依赖承担。 |
| `iansan-swift-talent-unresolved` 阻断 | 改用 `iansan-swift-resolved-c0`，绑定普攻天赋 `combat1.param5`，不是 E 等级。未知条件仍阻断；明确快攻状态、合法输入、25 帧实际命中、此前 A1 和面板已含份额、Q 反馈未生效后可算。 |
| 同一 Traveler 测试后续的 `aether-anemo-charged-base` | 首处修复后，该旧 ID 另在当时第 182 行复现同样的 `undefined` 错误。改用 `male-charged-aether-anemo-c0`。完整动作缺条件仍阻断；独立第一击也须明确无外部附魔、剧情增益关闭，之后可算。没有删除原独立组件保护。 |
| 同一 Traveler 测试原有的冰 Q 零层情景 | 改用 `aether-cryo-burst-state-c0`，明确第 36 帧无辉映、实际消耗 0 层寒辉、三个实际接触及观察到第 80 帧、稳定面板、独立声明的非 Extra ATK 和 A4 已含精通。检查实际编译结果三击及完整施放范围；未知入口仍阻断。 |

现入口默认是单击模板。填写完整生命周期条件不会隐式改变 `scope`；正例显式选择 `one-cast`。中间验证曾因此得到单击而非九击、Swift 仍被阻断，记录保留，未以放宽计算器解决。

Traveler 原测试中的风 E 身份与可算、荧火和冰未验证动作的两个 blocker 排除断言、荧火重击两击可算均保留。原风Q固定 blocker 的存在断言则按上表改为不存在，并以未知条件阻断及明确条件数值正例验证现入口。另一个原测试中的 Prune 七击、完整范围、逐击固定 `a7dc4bf4` 引用和原逐项求和，Odette 四击及 `selected-components`，Iansan 独立 E 可算均未改变。

新增文件 [classified-identity-replacements.test.ts](../../packages/game-data/src/classified-identity-replacements.test.ts) 包含 5 个测试实例：男女风 Q 各一个、风 Q 缺条件一个、Swift 倍率与 A1 记账一个、Swift 资格与缺条件一个。男女测试核对完整 15 级向量与当前目录，保留固定 gcsim 数值冲突作为非权威证据；明确落空不计伤害，未知接触阻断。Swift 检查 A1 只读取此前状态，已含 160 ATK 的最终面板不会再加同一份；慢速重击体力 24 不通过、明确 25 才通过。JSON 保存重开保留明确的 `false` 与已含份额，缺失的剧情／A1 条件仍保持未知并阻断。

全部数值使用声明的合成面板：ATK 2000，角色／敌人均 90 级，10% 抗性，无额外增伤、反应或武器团队效果；暴击率 50%、暴伤 100%。这些是测试输入，不是导入状态或实际战斗的默认值。

| 已知情景 | 独立非暴击算式与结果 |
| --- | --- |
| 空风 Q，有效等级 10，九次实际命中 | `9 × 2000 × 1.4544 × 0.5 × 0.9 = 11780.64` |
| Swift，普攻有效等级 10，无此前 A1 | `2000 × 1.6643 × 0.5 × 0.9 = 1497.87` |
| 空冰普通 Q，有效等级 10，无辉映、0 层寒辉、三击 | `3 × 2000 × 0.992358 × 0.5 × 0.9 = 2679.3666` |
| 男女风 Q，有效等级 1，九次机会中明确一次落空 | `8 × 2000 × 0.808 × 0.5 × 0.9 = 5817.6`；期望 `8726.4` |
| Swift，普攻有效等级 1，无此前 A1 | `2000 × 0.84194 × 0.5 × 0.9 = 757.746` |
| Swift，普攻有效等级 1，此前 A1 实际基础 ATK 800 | `(2000 + 0.2 × 800) × 0.84194 × 0.5 × 0.9 = 818.36568`，与 ATK 2160／已含 160 的结果一致 |

固定数值来源为 Optimizer `180a0a1015cb725c7570cd828eb086749960df98`，行为来源为 gcsim `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`，当前目录旁证为 genshin-db `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`。本次核对现有映射、调度、公式和冻结 manifest，并确认风 Q／Swift 两份 `source.json.gz` SHA256 与 manifest 相同。逐文件哈希、旧失败原文摘录和完整运行报告哈希见 [结构化证据](classified-identity-replacements-20261023.json)。未重新下载上游，也未把原 manifest 已声明的 gcsim 选定树覆盖缺口写成完整树验证。

最终命令仅运行两个原测试和上述新测试：

```sh
./node_modules/.bin/vitest run packages/game-data/src/classified-hits.test.ts packages/game-data/src/classified-identity-replacements.test.ts --testNamePattern='keeps traveler gender and element identity|keeps the new source revision explicit|current classified identity replacements' --reporter=json --outputFile=/tmp/GIDPS-classified-identity-evidence-20261023/final.json
```

结果 **7/7 通过、0 失败，另 9 项按名称过滤未选择**；没有把它们改成跳过测试。仅包含这两个文件的 TypeScript 检查也通过。原始报告位于 `/tmp/GIDPS-classified-identity-evidence-20261023/`，已在结构化证据锁定哈希与错误摘录。

未运行全角色首个循环、全回归、浏览器、原生或 120 秒模拟，不据历史 79 项失败或其他批次断言数推算新总数。结果仍是固定来源的 provisional 计算，不声称游戏验证、完整团队能力、高命座、吸收风 Q 或 Iansan 生效 Q 反馈已覆盖。
