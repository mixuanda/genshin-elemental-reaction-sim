# 安柏来源动作库：E／Q 实施前核对与实际边界

审阅固定 `genshinsim/gcsim@b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，输入目录 `/tmp/gidps-gcsim-b4ae769`。本审阅随后落实为独立的 E/Q 来源契约，保留原 N1–N5 工厂与签名。18份相关源码、73,418 bytes已存档至 `docs/cross-validation/action-library/source/`；固定URL和SHA-256在[机器契约](../cross-validation/action-library/amber-skill-burst-contract.json)。它是固定社区实现的条件模型，仍为 provisional，不是当前游戏完整安柏认证。

## 源码给出的具体行为

|动作／事件|相对输入帧与事实|精确来源|
|---|---|---|
|点按E释放／冷却|+5起冷却900帧，ready +905|`internal/characters/amber/skill.go:10–35`|
|E→N／Q|+32可输入；动画长度33|`skill.go:16–22`|
|生成兔、伤害快照|+45，固定寿命484 tick|`skill.go:27–29`，`bunny.go:127–171`|
|自然到期／爆炸|+529到期，再延迟1帧，伤害+530|`pkg/core/core.go:150–153`，`pkg/core/combat/combat.go:90–99`，`pkg/gadget/gadget.go:58–70`，`bunny.go:176–184`|
|E命中与微粒|T1倍率1.232、2U火、无附着ICD、blunt/poise260；首次命中敌人后只生成一次4火，默认延迟100帧|`bunny.go:137–164,186–198`，`pkg/core/player/character/character.go:144`|
|Q伤害|T1每击0.2808，18事件，首+84，末+192，输入时快照|`burst.go:26–73`|
|Q能量／冷却|输入须有40能量；+59真实扣40；+56开始720帧冷却，ready +776|`burst.go:93–104`，`pkg/core/player/character/energy.go:9–31`|
|Q附着|1U火，ElementalBurst/Amber，附着序列1,0,0循环、重置常量60帧；伤害组序列全1|`burst.go:28–36`，`pkg/core/attacks/icd_groups.dm.go:77,138,199`|
|普攻重置|成功E/Q重置到N1；等待和自然Idle不重置|`pkg/core/player/exec.go:159–165`，`pkg/simulation/run.go:138–140,200`，`pkg/core/player/animation/animation.go:108–115`|

Q的三个循环生成5、3、10个事件。按时间归并为 `84×1,96×2,108×2,120×2,132×1,144×3,156×1,168×2,180×2,192×2`。源码 `burstStart=72` 的“first tick”注释与循环偏移不同，不能据注释把首击写成72。

兔在生成时玩家前方1.4米；但固定实现爆炸圆心采用生成时的玩家位置、半径3米，并非兔的位置。长按投掷距离及实体碰撞调整本身仍有TODO。源 `HandleAttack` 不扣兔HP，不应宣称承伤致死分支已真实建模。C2手爆和安柏额外攻击触发超载另有特定分支，本契约均不接入。

## 最小实现与公共边界

`packages/sim-core/src/source-action-library.ts` 增加 `AMBER_SKILL_BURST_CONTRACT`、`createAmberSkillBurstScenario()`、`getSourceActionContract(config)`、`validateSourceBackedActionSequence`，最后一项与原验证API共用实现。默认输入E在frame1、Q在frame33，持续12秒。新能力列表保留五个原普通动作，另加 `amber-skill-tap-expiry` 和 `amber-burst-fiery-rain`，DSL别名为E/E.tap/Q。

必要通用核心接口由模拟桥接任务实现：

- `energyCostFrame:59`：输入时检查并保留40能量，实际+59扣除并记录前后能量；不能在输入时先扣再伪造显示。
- `summons:[{spawnFrame:45,lifetimeFrames:484,expiryAttackDelayFrames:1,hitIds:[…]}]`：真实生成、生成时快照、到期后释放绑定命中。原命中仍声明相对+530与已有命中确认产球；不会以第二个假输入伪装召唤寿命。
- 当前冷却只按确切ready偏移905/776表达，未模拟独立的冷却开始回调，边界在契约中公开。

来源契约拒绝能力签名修改、动态增益插件、多角色、移动目标与未映射动作；固定等级1/突破0/C0/T1/猎弓确保A1未解锁。C0本身并不能推出A1关闭，因此不允许仅改为高等级仍沿用此契约。

另发现普攻随机回能由固定来源 `pkg/core/energy.go:31–104` 自动启用，现动作库未映射它。新E/Q契约只允许第一次Q以前的普通输入：初始40能量已满，普攻额外回能溢出；Q后普通输入明确阻塞，不能把未实现回能记作零。旧纯N1–N5入口不受删除或替换。等待合法且不重置普通计数。

## 独立外部执行证据

已单次运行现有固定gcsim二进制，输入见 [amber-eq-expiry.gcsl](../cross-validation/action-library/amber-eq-expiry.gcsl)，实际命令、二进制SHA-256、时间、exit0和标准输出见 [execution记录](../cross-validation/action-library/amber-eq-expiry.execution.json)。原始sample/result均存档，没有平移结果帧。

|事件|外部实际结果|
|---|---|
|输入|E=1，Q=33|
|Q扣能|frame92，40→0|
|Q18命中|frame117–225，每击3.6790156042886593|
|兔生成／到期／伤害|46／530／531；伤害16.141549944742266|
|火微粒入账|frame631，4枚，同元素前台ER100%，+12能量|
|总伤害|82.36383082193812|

目标为固定半径2、位于(0,2)的静止目标，全部18个随机箭雨圆都命中；本地没有声称重现随机落点几何，也不把这个全命中参考当作所有目标运动条件的结果。实际来源专项、独立计算器新增19段、A1暴击公式以及所有失败修正记录见[实施报告](../cross-validation/action-library/amber-skill-burst-contract.md)。
