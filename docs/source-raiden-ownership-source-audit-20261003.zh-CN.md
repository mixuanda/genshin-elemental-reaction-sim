# 雷电 E 131 frontier 只读来源审阅

审阅日期：2026-10-03。只读取两个 pinned source 与既有 patched source；没有执行 build/native/tests，未修改主树。

## 来源完整性

两个 pinnedtree 中 `internal/characters/raiden/skill.go` 均为 4461 bytes，Git blob SHA1 `d24bad4bb7173d918dee8d47781ae336a0ddf45b`。逐文件读取本地 pinned source 已吻合；SHA256 均为 `c2e1872f174b2fd078608116cef65266ebc0474e468a83b756587f97b031b363`。具体根路径与 revision 见 `raiden-source-integrity.json`。

Classic build-voBklW/source 与 Stellar stellar-build-F7xhXt/source 的 patched 雷电 skill.go 也逐行相同。两个原生文件没有 c.skillai 或 c.skillsnap 字段；协同使用本地新构造的 AttackInfo。

## 实际生命周期与取值

以下行号相对于 pinned upstream/b4ae769.../source，两个 lane 的 skill.go 完全一致。

- Skill 第 35–73 行：初始攻击立即排入 snapshotDelay=51、dmgDelay=51；给每位队员的原生 core.Tasks.Add 闭包延迟 66 帧执行。闭包捕获 `this`（受益者）、当前施放已读出的 `mult=skillBurstBonus[...]`、每次 E 新分配但队员共同使用的 `m` slice；没有保存协同快照。
- 第 60–72 行：66 帧闭包实际调用 `this.AddAttackMod`，key=raiden-e，NewBaseWithHitlag(...,1500)。modifier expiry 在 AddAttackMod 执行时设置为 holder 当前 global frame+1500；不是施放+1500，也不是初始 E hit 的 frame+1500。
- 第 63–69 行：Amount 只在 Burst tag 时返回 buff；EnergyMax 每次 Amount 调用动态读取受益者 `this.EnergyMax`，talentMultiplier 则是原施放捕获值。共享 `m` 被同步串行调用复用，审计应保留原生 slice 与闭包。
- eyeOnDamage 第 104–151 行：监听 Init 安装，真实 OnEnemyDamage 当帧先查全队共用 c.eyeICD，再查实际引发命中的 ae.Info.ActorIndex 的 StatusIsActive(raiden-e)。随后保留原生三类反应排除、自身 ElementalArt/Slash 排除、零伤害排除。
- 第 136–148 行：所有 gate 通过才构造 local ai，caster=Raiden c.Index()，Mult 在这一刻读取 skillTick[c.TalentLvlSkill()]；NewCircleHitOnTarget 使用原触发 target，并由 QueueAttack 原生复制成 AttackEvent。snapshotDelay=5、dmgDelay=5；5 帧后读取 Raiden live Snapshot、同帧同步 damage。
- 第 150 行：触发当帧设置 c.eyeICD=Core.F+54。E refresh不重置此 ICD。已接受的协同不会在 +5 帧执行时再次检查 holder 的 raiden-e，也不会因刷新/expiry撤销。

## Native modifier 边界

- AddAttackMod 原生 mods.go:83–86 调用 mod.SetExpiry、modifier.Add、LogAdd。modifier.Add 按同 key 替换真实对象（modifier.go:86–104），旧 object 与旧 hitlag extension不会延续到新 object；真实 overwrite flag 仅在旧 expiry>frame 或=-1时为 true。f==expiry 仍替换旧 object，但 native overwrite=false。
- StatusIsActive 不要求 *Status 类型，调用 modIsActive→FindCheckExpiry。FindCheckExpiry（modifier.go:117–125）在 expiry<frame 才 false，所以 retained AttackMod 在 f==expiry 仍 active。
- ApplyAttackMods（mods.go:238起，patched为317起）对 normal reaction damage先返回，对其余攻击按 expiry<=frame 且!=-1剔除 AttackMod。它先于 OnEnemyDamage 运行（patched pkg/enemy/attack.go:73 versus102/110）。因此普通非 SourceIsSim、非 normal reaction攻击在 f==expiry先移除该对象，随后 eye status gate见到 absent；跳过 ApplyAttackMods 的特殊攻击路径才可能保留 equal-frame active查询。禁止用单一 <= gate归一化此原生差异。
- Hitlag（patched hitlag.go:61–68）按受益者 holder逐对象扩展，只有 AffectedByHitlag && expiry!=-1 && expiry>frame 才 Extend。player.ApplyHitlag只对当时前台角色调用该方法（patched player/player.go:231起），每队员 expiry可以不同。ExtendStatus用 FindCheckExpiry，equal frame规则也仍沿用原生。
- 当前 SourceHostStatusOwner 仅返回 *Status，不能为 raiden-e的 *AttackMod提供 owner；现有 end观测与 replace/delete审计也仅 *Status，因此需要对 audited AttackMod exact object建立生命周期，不能额外 AddStatus掩盖这个缺口。

## 语义边界建议

- 将持有 modifier 的受益者 holder 与生成攻击的 Raiden creator/emitter明确保存。现有 SourceHostStatusOwner.ActorIndex 与 StatusInstances.ActorIndex代表 native holder，应保留；跨角色的 creator/emitter须独立 explicit字段或 helper参数，避免用受益者代替 Raiden创建者，也避免用 Raiden代替生命周期 holder。
- 现有 RegisterOwnedGenerator delayed fallback只匹配 burst且要求 invocation.ActorIndex==owner.ActorIndex；雷电 E由 Raiden queued core task替他人创建，需要 audited explicit creator=Raiden、action=skill、creation action sequence绑定。不能根据 buff key或角色名猜所属 E。
- 现有 BeginOwnedGeneratorTrigger会过滤 queued reference.actorIndex==generator.ActorIndex；如果 generator actor使用 holder，跨角色协同会被过滤。应将此条件移向实际 audited emitter绑定，同时继续要求确切 status instance、owned trigger、emit site、queue ID吻合。
- holder生命周期观测应读取真实 AttackMod.Expiry及真实同 key替换/删除/ApplyAttackMods剔除。audited owner字段属于 trace-only，应从 private phase反射中排除，维持 native数值状态观察边界。
- 触发 owner选择在真实 event gate通过之后、QueueAttack之前读取当前 holder exact AttackMod。queue保留当时 owner，即使 +5 帧内 refresh也不重新归属；snapshot读取规则仍为 +5帧的 Raiden live stats。
- 本次来源审阅确认的可实施 E 伤害边界包括原生初击，以及 Eye 整个真实 modifier 生命周期内的完整协同伤害归属：每次成功触发对应确切的施加/刷新实例、原生 gate、受益者 holder、雷电 caster、协同 QueueAttack和后续攻击身份，跨角色触发也在此范围内。该来源边界并未缩为单次协同攻击。相同 AttackMod 的 Q 增伤 Amount 修改的是 Q 伤害，产球/能量回调也不产生 E 伤害，所以二者不加入 E 伤害小计。完整交付仍须依据实际观察到的初击、成功协同及 pending/生命周期闭合证据；本静态来源审阅不提前宣称尚未执行的伤害已交付，也不提供游戏实测保证。

## 独立交叉核对

只读子代理对 Classic/Stellar modifier、mods、enemy.HandleAttack、QueueAttack执行顺序和 hitlag逐行复核，结论与以上吻合。两个 lane 的 expiry比较、same-key替换、deleteMod、hitlag条件完全一致；相关反应前置排除语法有所不同：Classic使用 AttackTag enum范围，Stellar使用 IsReaction() && !IsDirect()，因此反应 skip应保持各lane原实现，不能共用额外判定。没有执行任何 build/native/tests。

## 最终补丁阶段窄复核

最终 before/after 雷电 skill.go 已改为 verified raw pinned 文件叠加 028 dynamic modifier 和 113 direct event stage，最终补丁在 talent-read instrumenter之前应用。Classic/Stellar final after逐字节相同，SHA256 `78ce9c122e5730b402dd6240eea67c85bc7ac049314beac2d44365b5dbb54cde`；文件没有预先生成的 talent-read sidecar或 sourcehost talent import。对 native结构、局部 AttackInfo、捕获 mult/this/m闭包、初击51帧、activation66帧、modifier1500帧、原生gate顺序、snapshotDelay=5/dmgDelay=5、eyeICD及 exact modifier ownership重新只读复核，与原实现审阅相同。core/overlay仅清理 Status-only措辞；运行逻辑未偏移。最终文件哈希已刷新至 `raiden-implementation-static-review.json`，备注为 final pre-talent-instrumentation patch stage；没有 build/native/test。
