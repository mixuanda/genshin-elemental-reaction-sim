# 四把状态追击武器：共享来源与明确状态转换

2026-09-24。本子任务新增笛剑、以理服人、流月针、竭泽的共享追击定义与纯状态转换。此前八把武器的数值和触发定义不变。真实技能执行、粒子接收、伤害回调、事件排程和 JSON 回放仍由宿主接入；独立计算器保持“一次追击已经真实发生”的条件计算，不要求建立团队。

## 本轮实际实现

`packages/reaction-formulas/src/independent-weapon-proc.ts` 新增四个 wire ID `flute`、`debateclub`、`crescentpike`、`endoftheline`，对应目录 11402、12305、13403、15418；半径类型增加 4 和 2.5。`lifecycleKind` 标明需要实际事件窗口，`sourceNotes` 保存明确的来源冲突。原有三个公共系数／冷却／概率 getter 继续适用。

| 武器 | 固定源码 ATK 原式 | R1–R5 数学值 | 一次追击范围 |
| --- | --- | --- | --- |
| 笛剑 | `.75 + .25 × R` | 1 / 1.25 / 1.5 / 1.75 / 2 | 半径 4，原触发目标为中心 |
| 以理服人 | `.45 + .15 × R` | .6 / .75 / .9 / 1.05 / 1.2 | 半径 3，原触发目标为中心 |
| 流月针 | `.15 + .05 × R` | .2 / .25 / .3 / .35 / .4 | 原目标单体 |
| 竭泽 | `.60 + .20 × R` | .8 / 1 / 1.2 / 1.4 / 1.6 | 半径 2.5，原触发目标为中心 |

以上按源式构造机器数值，不先四舍五入。全部是独立物理追击：在触发回调立即取样，固定代码排程 +1 帧伤害；不是往宿主命中加入一项固定伤害。四者均没有 RNG 门，但有各自的真实状态门槛。

`packages/reaction-formulas/src/weapon-proc-lifecycle.ts` 导出 `WEAPON_PROC_LIFECYCLE`，统一保存以下时间和次数，供运行时、回放、计算器说明和 UI 读取：

- 笛剑：音符获得间隔 30 帧、共享音符窗口 1800 帧、5 音符触发。
- 以理服人：效果 900 帧、命中冷却 180 帧。
- 流月针：效果 300 帧，没有额外命中冷却。
- 竭泽：效果 900 帧、启动冷却 720 帧、命中冷却 120 帧、每窗口最多 3 次追击。

`getWeaponProcCooldownFrames` 对这四把分别返回 30／180／0／120，但笛剑的 30 是音符获取间隔，流月针的 0 是源码明确没有命中 ICD，不是统一的追击周期；状态武器的说明与运行时必须结合 `lifecycleKind` 和上述常量，不能用该数值直接估算追击次数或 DPS。

## 纯函数契约与精确边界

共享 `WeaponProcLifecycleState` 保存 `effectExpiresFrame`、`hitCooldownExpiresFrame`、`activationCooldownExpiresFrame` 三个 nullable expiry，以及 `notes`、`procCount`。`createWeaponProcLifecycleState()` 初始化为空状态；`stepWeaponProcLifecycle(id, state, input)` 返回新状态及明确 outcome，没有内部任务队列。

输入是实际 `skill`、`particle-received` 或 `damage` 钩子。前两者包含帧和持有者前台状态；伤害额外包含伤害是否属于持有者、实际标签和实际伤害值。调用者不能以计划施放、能量增加的推测或界面手填层数冒充已发生事件。纯函数按四段明确源码分支执行：

1. **笛剑**：依次要求本人伤害、前台、普攻／重击、30 帧音符 ICD 可用。通过后设置音符 ICD；若旧共享音符窗口已失效，才将计数视为 0；加一并刷新 1800 帧窗口。第 5 音符清零并删除窗口，产生一次追击。未通过前置门的回调不会提前清除过期计数；零伤害没有额外拦截。
2. **以理服人**：真实 OnSkill 且持有者前台，删除命中 ICD 并刷新 900 帧窗口；这是固定源码的额外重置语义。伤害按本人、前台、窗口、普攻／重击、命中 ICD 的顺序检查，成功后设置 180 帧 ICD；无零伤害门。
3. **流月针**：只有真实 OnParticleReceived 且持有者前台才建立／刷新 300 帧窗口。伤害依次检查本人、普攻／重击、非零伤害、有效窗口；伤害回调没有再次检查前台，也没有每次命中 ICD。因此窗口内延迟命中可在离场后发生；普通能量加算不能替代粒子接收钩子。
4. **竭泽**：真实 OnSkill 且前台、启动 ICD 可用，建立 900 帧效果与 720 帧启动 ICD，清零计数；仅当旧命中 ICD 此刻仍有效时才删除它，过期旧值保留。伤害按前台、本人、窗口、命中 ICD 检查，不筛攻击标签和零伤害；成功计数加一。前两次设置 120 帧命中 ICD；第三次只删除效果，不新增 ICD，也不改写已有旧命中 ICD。

`weaponProcLifecycleStatusActive(expiry, frame)` 使用 expiry 等号仍有效的规则。与固定 `StatusIsActive → FindCheckExpiry` 一致，查询失效不主动删 raw expiry，也不主动归零 notes／procCount；仅源码明确删除／刷新时改变。周期判定可另行对已证明不可观测的失效值归一，但不能因此改写原始事件账本。

源码的 status 标记可受角色卡肉延长。本实现的共享时间是固定名义帧，调用方明确使用**无角色卡肉**范围；没有凭这四段纯函数认证卡肉延长、实际游戏落地／移动命中或所有反应伤害回调。

## 必须保留的 Optimizer 冲突

固定 Optimizer `TheFlute/index.tsx` 写的是 `prod(percent(2), input.premod.atk)`，没有按精炼读取系数。`percent(2)` 由其真实工具源码确认表示 200%。因此：

| 笛剑精炼 | 固定 gcsim＋目录 | 固定 Optimizer sheet | 差值 |
| --- | ---: | ---: | ---: |
| R1 | 1 | 2 | 1 |
| R2 | 1.25 | 2 | .75 |
| R3 | 1.5 | 2 | .5 |
| R4 | 1.75 | 2 | .25 |
| R5 | 2 | 2 | 0 |

本实现明确采用固定 gcsim 与目录的精炼向量，保留 `sourceNotes` 供计算器和 UI 显示，不把冲突隐藏为“全部已验证”。本轮 20 个系数位置中 **16 个与该固定 sheet 一致、4 个冲突**。笛剑 sheet 用 `premod.atk`，其余三把用 `total.atk`；没有将默认公式的别名关系推广为所有转换增益都完全等价。

其余三把的 15 个倍率位置支持来自实际生产 sheet。四份 sheet 都没有音符、技能／粒子触发、时间窗或计次调度；描述中的秒数和次数不是这些状态转换的独立执行证据。详见 [Optimizer 专项来源报告](./weapon-proc-lifecycle-optimizer-source-audit.md) 和 [14 份原文／Git blob 清单](../../packages/game-data/sources/weapon-proc-lifecycle-optimizer/manifest.json)。

## 原始来源与本轮实际检查

固定提交：gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，genshin-db `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`，Optimizer `180a0a1015cb725c7570cd828eb086749960df98`。

[共享清单](../../packages/game-data/sources/weapon-proc-lifecycle/manifest.json) 与 [实际原文归档](../../packages/game-data/sources/weapon-proc-lifecycle/source.json.gz) 保存 **29 个原文文件**：23 个 gcsim 机制／钩子／Diona 来源与独立外部审计的原始指纹完全一致，另含 gcsim LICENSE、4 份武器目录与其 LICENSE。压缩归档 31571 bytes，SHA-256：`b75a1dacd3ddd4f57ad2291c7670d361cc195e4fa10ba2229b122fb733d4fa71`；清单 SHA-256：`be72d41bef9361ddedf4c9b4015c2f08828b3226ec84d9d8e829f7e6f4c6df90`。清单包含笛剑冲突，不将这些固定社区源码标成当前游戏 verified。

唯一新增来源／状态转换检查实际命令：

```sh
npx vitest run packages/reaction-formulas/src/weapon-proc-lifecycle.test.ts
```

首次运行 **1 passed / 1**，11:36:38 开始，总 **96 ms**、测试 **6 ms**、exit **0**。[原始日志](../validation/weapon-proc-lifecycle-shared.log)、[退出码](../validation/weapon-proc-lifecycle-shared.exit)。本子任务未运行旧全集、构建或外部模拟器，也没有重跑该检查。

这一个检查读取 29＋14 份实际原文与指纹／Git blob，校验 20 个源式精炼位置及 16／4 一致／冲突分类；同时执行四段纯状态转换：笛剑 30 帧等号阻挡、0／31／62／93／124 五次合法音符触发及过期计数；以理服人真实 E 清除尚有效的命中 ICD 与效果到期等号；流月针前台接粒、零伤害门、离场延迟命中及同帧多次无 ICD；竭泽命中与启动 ICD 的等号、第三次只删除效果、重新启动时区分有效／过期旧命中 ICD。所有步骤保留传入状态不被修改。

独立计算器的新 20R 单击 trace／JSON、真实运行时钩子、回放和检查点由对应子任务另行验证；本报告不代替它们。外部 Diona／竭泽原始样本位于 `docs/cross-validation/stateful-weapon-procs/`，本子任务只归档并匹配相关原文，没有执行或重跑该外部样本。
