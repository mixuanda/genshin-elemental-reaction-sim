/goal 指定散／珐／妮／杜120秒轴：E/N3、C6、Q及gift有限只读核查

基线 `5b43d99`，分支 `cloud/wanderer-axis-boundaries-20261023`。本轮没有证明需要修复的新伤害数值错误，没有修改引擎、WASM或原始捕获。核查对象为既有合法ER151.82%、seed20261022的自适应GCSL，保持流浪者100级C6图莱R5、珐露珊C6西风R5、妮可／杜林C2专武R1；其余配装、天赋、敌人和操作仍是已披露参考假设。

原件为 `/tmp/GIDPS-legal-recharge-evidence-20261023/er150-seed-20261022-c2fixed/run.result.json`，SHA256 `e6ccae8bec3bfe8483eed2e32cc8387ed8eeb4e688162fdd5d6d6826f4c46af3`；配置SHA256 `4fed915e08373c9a25cdb28ef7fe0a9c63f36f5cae39808aa2f581c2c4c93059`。固定Classic来源 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，实际WASM `3e5fc685e2743552b4be8f14533f75794092d88b7236166e0ac38103bed5a53e`。仍为610击、7200帧、总伤27,069,474.337322712、本次DPS225,578.9528110226，不能称随机期望或稳态。逐件输入／入口身份沿用[既有回执](wanderer-public-scenario-20261023.json)。

本轮读取完整原件以核对相关120次普攻、120次C6追加、25次Q及11次E／重击的状态消费者，不重做既有全场总伤守恒、能量、图莱层数、反应网络或52项单击计算器测试。机器结果及实际patched源码的11份SHA256见[本次诊断](wanderer-axis-boundaries-20261023.json)。

| 实际边界 | 本轴证据与结论 |
| --- | --- |
| E资源耗尽／N3中途结束 | 前五个E各有24次普攻命中，其中12次为N3子击。按每6帧消耗1点、实际火／C4吸收和已记录C6恢复重算，所有普攻快照／命中的保守资源下界分别为28、15、28、15、15，仍大于0。保守式不计同帧新恢复，避免猜回调先后。本轴没有经过源码“E can expire during N3”未实现分支；不能把该TODO记为这610击的错误。第六E在F7142，第六轮尚未进入普攻即截断。 |
| C6生成与Q同帧 | 每次追加有不同的真实普攻父攻击，倍率为父Mult×0.4，创建帧等于父命中帧，并在+8帧重新快照和命中；没有递归父链或复制父攻击。五次末N3第二击均与Q调用同帧，任务中的父命中／追加排队先于当帧Q动作接受，故F1177、2498、3819、5140、6461五次Q后的追加属于先前合法排队。不能仅因落点在Q动画内删除它们；这五击的C2均未应用。 |
| C6快照是否有实际数值影响 | 有。攻击46、177、313、448、584的原普攻快照与追加快照之间出现妮可 `guidance-of-theosis`，追加多300平攻。首例为父攻击44在F704快照、F709命中，追加F717取样；平攻1187.1868892393447→1487.1868892393447。因此不能将整批C6简化成原击伤害×0.4。本轮资料没有独立游戏计帧证据可替换源8f取样，故不把这个实际差异说成已证实的游戏数值错误。图莱自然层数由根线程另审。 |
| Q取样与结束E | 五次实际Q开演为F1169、2490、3811、5132、6453，均比对应打印决策晚5帧；开演前资源31、15、31、15、15点，C2均达2.0上限。各五击在+92、98、104、110、116帧命中，共用数值相同的+55帧进攻快照。源码在Q开演将资源置0，状态及A1清理发生于后续换人，即Q+145；本轮未擅自将清理前移。 |
| Q55f是否无关紧要 | 不能这样声称。每轮最后N3快照（Q−5f）的攻击4379.182358585185；Q+55f快照攻击3050.10925082584。其间妮可 `grace-of-kenosis`／C2／`guidance-of-theosis`及宗室已过期。首例宗室到F1184，妮可三项到F1214，Q在F1224取样。旧源码自己保留“Determine correct Frame”TODO；这25击实际依赖该时点。本轮仅证明与固定源一致，缺游戏实测时不能改成开演取样、命中取样或倒灌末普攻面板。 |
| Q／追加碰撞 | 265次普攻／C6／Q均只有target1一次resolved、没有missed，目标固定在(0,2.4)、半径2。本轴没有walk/dash/jump/plunge动作；四角色源码未写玩家／敌人位置。固定模型的Q圆心直接取主目标、半径5，C6圆心取父目标、半径2，因此该静止单目标在模型内会命中。这不是实际游戏碰撞半径、多目标、位移或墙体的独立认证。 |
| 珐露珊gift几何与刷新 | 玩家F0位置(0,0)、方向(0,1)，没有实际位移，始终位于施放点40半径的源gift场内。31次Wanderer gift刷新与实际Q调度完全一致、覆盖连续；276次E／重击／普攻／追加／Q均在快照读到38.25%风伤，并在命中读到C6的40%风伤暴伤。每轮Q快照与gift刷新同帧，但旧实例仍覆盖到下一帧，新旧数值相同；无临界漏增益。三角顶点的敌人减抗脉冲与gift是两条不同路径，不能以远端脉冲未碰到敌人推断玩家失去gift。源239f刷新近似在本轴静止、持续在场且数值不变条件下没有显示缺口，不推广到玩家进出范围。 |

原件另有两个应保留的观察边界。F7175第六轮重击只剩queued观察，尚无attackId／伤害应用，不能补造第六轮伤害。120个正常父攻击的C6回调2及批次均在父命中帧完成，实际queued阶段与`parentAttackId`也一致，但其 `hitCallbacks.queuedAttacks` 数组为空；本轮脚本先暴露这一解释链接缺口，随后明确分别检查可见批次、排队观察及父链，报告直接列表链接数为0，没有把它包装成完整回调溯源，也没有据此指控新的伤害错误。原始诊断保留在 `/tmp/GIDPS-wanderer-axis-boundaries-20261023/audit-first-callback-link-check.json`。

固定原始源码：[普攻及N3 TODO](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/wanderer/attack.go)、[E消耗及清理](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/wanderer/skill.go)、[C6回调及8f TODO](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/wanderer/cons.go)、[Q五击及55f TODO](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/wanderer/burst.go)、[珐露珊gift与三角脉冲](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/faruzan/burst.go)。实际执行树为 `/tmp/GIDPS-wanderer-c2-build-20261023/cache/build-ImmxbI/source`，不是把原始pin当作已应用137补丁的执行树。C2范围修复继续沿用原137补丁，不新增规则。

实际离线命令如下，退出0、`failures: []`；没有调用模拟器、构建或测试套件：

```sh
python3 scripts/wanderer-axis-boundaries-audit.py \
  --capture /tmp/GIDPS-legal-recharge-evidence-20261023/er150-seed-20261022-c2fixed/run.result.json \
  --source-root /tmp/GIDPS-wanderer-c2-build-20261023/cache/build-ImmxbI/source \
  --output /tmp/GIDPS-wanderer-axis-boundaries-20261023/audit.json
```

下一项需要的是能区分C6重新取样时点及Q55f时点的实际游戏帧证据，而不是再跑一次同一社区引擎来证明它自己的TODO。没有这类证据，本轮不提出任意时点修复；完整Aura／ICD与变动几何继续保持既有provisional边界。生产／上传仍暂停，本轮没有相关请求。
