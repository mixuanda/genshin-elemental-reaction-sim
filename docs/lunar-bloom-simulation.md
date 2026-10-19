# 月绽放：真实草露与月露涤荡

`simulateLunarBloomProfile(config, { party, abilities?, ...runtimeOptions })` 已接入主模拟器。此配置明确要求 aura-v5（项目第一个已实现普通绽放与草原核的版本），单个有位置的静止范围内目标、水／草／物理输入、60 FPS、无卡肉及无插件。aura-v3 会截断普通绽放，不能用于此配置。

## 普通绽放与资源

实际 ICD 通过且主 Aura 解析出普通 Bloom 后，保持普通草原核生成和伤害，并刷新草露生产窗口。规则 `verdant-dew-fixed-core-order-v2` 在触发后第 1 帧先处理旧窗口生产，再由全局任务把截止更新到触发后第 149 帧；原窗口未启用时，首次累积在触发后第 2 帧，每 146 个有效帧产生 1 草露，上限 3，部分进度保留。连续有效窗口刷新不丢帧。转换自身不添加即时特殊伤害。实际来源选择能力发生在本帧草露产生之前，因此本帧刚生成的草露不能倒用于选择月露涤荡。

## 唯一已接入直接能力

声明需要 `sourceAbilityId`、`actorId`、`abilityKey:'columbina-moondew-cleanse-idle-v1'`、有效普通攻击天赋等级 1–15、突破 0–6、C0；明确 party 身份为 columbina。`createMoondewCleanseAbility(actorId, abilityId)` 提供来源动作定义：空普通命中、charge、完整动画及本配置占用 124 帧、无能量费用、冷却 0。124 帧是完整闲置起手配置锁，不表示游戏最早取消帧。

用户可在普通页面入口把来源动作和指定请求帧加入本次运行副本。公共 runner 校验声明所对应的真实 timeline 定义，拒绝附带普通命中、额外 buff/debuff/能量/粒子等重复计算输入。主循环核对前一动作完整结束，并禁止本段 124 帧期间插入其他动作或切换，不推定取消与连携。

动作开始必须已有草露。+55 帧消费 1；+62、+70、+92 帧产生三段无附着直接月绽放。每段读取当时 HP、EM、CR、CD 和敌人草抗；有效天赋 Lv10 的来源系数为 0.027202。共享特殊公式同时实际执行哥伦比娅固有月兆基础提升。完整声明、起手帧、消费收据和每段输入都保存在 `state-resolved` 上下文，可进入独立计算器恢复。

领域、月岭露、Gravity、命座、其他角色直接月绽放能力及普通未建模被动不由身份自动补齐。本配置没有开启这些额外能力或属性。

## 实测

主路径两项 focused case 覆盖：普通 damageEvents 与同输入普通模拟逐项一致；实际草原核存在；153 帧获得草露、215 帧消费、222／230／252 帧三段各 916.8434100000001；全部普通及特殊事件计算器恢复相同；缺资源、非 idle 起手拒绝；时限之外的第三段不计入结果；未声明直接能力时支持仅资源记录。修正前的 152 帧获取记录属于已知一帧提前的旧时序，当前 expected fixture 已相应调整，三段伤害数值不变。

2026-09-23 的草露修正验证仅运行受影响的共享状态、LB runtime 与 LB 主路径用例：3 文件、7 项通过，8 项无关测试跳过，耗时 1.38 秒；命令和边界说明见 [来源与验证记录](research/lunar-mixed-v2-source-evidence.md)。

`fixtures/lunar-bloom-reference.synthetic.json` **没有**占位月露动作。导入后使用普通来源动作入口，明确 c 角色、请求帧 160、talent 10、突破 6、C0。该 fixture 的 35000 HP 与普通水草命中为合成测试输入，不是完整实装角色构筑。对应 `expected.json` 总伤 6209.86653，普通 3459.3363，直接月绽放 2750.5302300000003。

来源及系数取证见 `research/lunar-bloom-evidence.md`，固定来源：[charge.go](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/columbina/charge.go)、[天赋表](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/columbina/zz_columbina.dm.go)、[草露资源](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/verdantdew.go)。当前实现为 fixed-source-provisional，未声称当前游戏实测验证。
