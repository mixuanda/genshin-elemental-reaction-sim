# 7.1 发行版基础伤害来源

沃雅妮莎和薇斯纳已经列入官方 7.1 正式更新，不再只是预览身份。官方账号发布的[更新说明](https://www.hoyolab.com/article/46791577)正文和 [GINews 固定公告归档](https://github.com/KQM-git/GINews/blob/aa559020c349f14666f85f8b802f99995a78d517/readme.md)随包保存。两人的祈愿公告分别为 21877、21876，开放至服务器时间 2026-10-13 17:59。发布状态和伤害实现的验证状态分别记录。

执行来源为 [Dimbreath/AnimeGameData2 固定提交](https://gitlab.com/Dimbreath/AnimeGameData2/-/tree/b061b403c8afc7bca633cf4f201edc4a3baa75fe)。归档包括角色配置、能力配置、天赋变量绑定、薇斯纳动画攻击事件及原始 Excel 表。14 份发行版原文的 Git blob 均与固定提交 API 核对。genshin-db 的固定提交为 `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`。51 条参数向量、每条 15 级，共 765 值与活动 catalog、genshin-db rawstats、ProudSkill 原表完全相等，不使用容差。这是同一原始数据链的精确核对，不是独立游戏实测。

`definitions.json` 提供 `coefficients`、`templates`、`stateContracts`、`pendingComponents` 和 `lifecycleEvidence`。系数 ID 为 `{slug}-{combat1|combat2|combat3}-{paramN}`。映射模块仅导出 16 个有条件完整伤害动作、17 条命中：沃雅妮莎 N1–N4、重击、低/高空零碰撞下落；薇斯纳 N1–N6、重击、低/高空零碰撞下落。薇斯纳 N3 保留两条独立命中；归一动画时间更早的 `AttackEvent_02` 排在 `AttackEvent_01` 之前。

这些动作计算已执行的命中伤害，不建立输入帧、连段状态、攻速、体力、飞行、命中接触、附着或 ICD 模拟。下落限定实际成功落地、路径碰撞数为 0，并已确认来源低/高分类；不从任意跳跃推导下落资格。未知状态不能自动当作基础状态：沃雅妮莎须分别排除遥久之歌、30 秒领唱/重唱池及自身风旋；薇斯纳须排除巡风列装、辉映及外部附魔。基础 N/CA/下落不能通过只改元素获得完整 E 状态动作。

E/Q 尚未导出到可执行 mapping，精确来源分支保留在 `pendingComponents`，供后续共享状态核心使用：

- 沃雅妮莎 E 初击和角笛各按对应 HP 倍率计算。16 秒状态、3 秒角笛周期并不足以确定所有实际命中和尾部实体；完整 E 仍需要实体生命周期与接触日程。首次 E 初击先于本次新领唱池重置，不能自动加入新池加成。
- 沃雅妮莎 Q 为一个伤害事件。命中事件检查遥久之歌，基础项是 `MaxHP × param1`，有状态时再乘 `1 + param2`。这是基础伤害倍率，不是普通伤害加成；额外领唱 flat 项不处于该乘式内。
- 薇斯纳 Q 的大型灵剑 Handler 在第一个 0.55 秒 tick 发出一次伤害后移除自身；这里的时间相对实体 Handler，不是施放动作第 33 帧。实体生成时复制辉映状态，普通分支与星扩散分支由这个副本决定。实际伤害修正还读取整肃层数和角色属性。
- 薇斯纳普通灵剑/Q 的整肃倍率是 `1 + 0.1 × 层数`；Q 初始化先触发 A1。A1 层数有独立到期、离场清空及 E 重置语义。星扩散分支须接入实际反应计算，不得当普通风伤。

本包保持 `source-provisional`，不宣称 `game-verified` 或队伍模拟可用。Dimbreath 仓库根目录未发现独立 LICENSE，保存其原文 README 和来源归属；不对该仓库虚构 MIT 授权。genshin-db 的 LICENSE 已随包保存。
