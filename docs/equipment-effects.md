# 装备效果：明确条件下的来源映射

本模块把固定目录中的部分装备条款写成类型化规则。它提供可执行的条件计算；另有 [12 把武器与 2 套四件套的转换／叠层模块](equipment-formulas.md)，以及 [10 种常见四件套的条件公式](artifact-conditional-effects.md)、[反应与敌人减抗](artifact-reaction-effects.md) 和 [19 把新增条件武器](weapon-conditional-effects.md)。本模块不把目录中的所有文字转成程序，也不把来源条款的可执行性等同于当前游戏版本的独立验证。

## 已实现范围

- 当前活动目录 63 个已收录圣遗物套装中，59 个拥有二件套条款，其中 50 个有显式规则：攻击、生命、防御、精通、充能、暴击率、治疗加成、元素/物理增伤，以及普攻、重击、下落、战技、爆发的限定增伤。它们保留固定源文本校验；文字改变会要求重新审阅，不会继续套用旧规则。
- 角斗士与乐团的四件套同时限制武器类型和攻击标签。装备者不符合武器类型时不会得到加成；缺少武器类型时给出阻塞。
- 16 把武器有已映射条款：黎明神剑、风鹰剑、狼的末路、天空之刃、天空之翼、天空之卷、天空之傲、白缨枪、绝弦、弓藏、阿莫斯之弓、黑剑、冷刃、匣里龙吟、匣里灭辰、鸦羽弓。精炼数值从对应来源字段精确读取，不插值。
- 对于只实现一部分条款的武器，已实现部分可以计算，其余治疗、追击、触发时序、层数、冷却等逐项返回 `effectBlockers`。例如风鹰剑会增加固定攻击百分比，同时明确说明受伤追击和治疗未执行。

## 调用与语义

`resolveWeaponEffects({ weaponId, refinement, enabled, context })` 与 `resolveArtifactSetEffects({ setId, pieces, enabled, context })` 返回 `statContributions`、`hitBonuses`、`assumptions`、`effectBlockers`、`missingConditions`、`sourceRefs` 和固定的 `verification: "provisional"`。

属性贡献使用 `FIGHT_PROP_*` 属性名、实际数值和固定来源引用。百分比以小数表示，固定生命/防御/精通以原始数值表示。伤害加成使用独立的 `elements`、`attackTags`、`weaponTypes` 条件；`equipmentHitBonusApplies` 取这些条件的交集。缺少必要攻击标签或武器类型不能视为符合。

`enabled: false` 是用户明确停用，返回对应假设。启用但缺少已支持效果的必要条件时返回 `missingConditions`，配装入口拒绝应用；不会把缺失状态默认设为满血、已有附着或增益已触发。`hpFraction` 必须是 0–1 的有限数，`enemyAuras` 是命中前附着状态，空数组代表用户明确提供的无附着，省略数组代表未知。命中伤害的元素不会自动建立此前附着。

`pieces` 必须为 0–5 的整数；上层配装系统必须按不同装备槽统计件数，不能把同一槽的重复条目当作两件。套装效果只执行实际已达到的件数条款，四件套未实现不会抹掉已实现的二件套，也不能省略四件套阻塞。

伤害加成属于通常伤害公式的增伤乘区；转换反应及特殊反应是否使用该乘区，由共享反应核心决定。本模块不将普通增伤直接叠加至所有反应，也不模拟装备触发事件或持续覆盖率。弓藏的重击惩罚保留为 `-0.1`，不能钳制为零。

## 证据与边界

装备条款来自 [genshin-db 固定提交的原始目录](https://github.com/theBowja/genshin-db/tree/49a6544a6c6ae36089cb42fa591fc46f01de8bcf/src/data/ChineseSimplified)，由本项目活动快照的固定 `5.2.14` 来源归一化。运行时 7.1 的 released 身份与数值／机制证据分开记录；每条引用按活动快照指向真实原始 JSON 文件，不复用旧版标记。本模块的条件映射仍为 provisional，不能当作完整实战模拟。

弓藏的普通/重击区分及重击 `-10%` 已与 [gcsim 固定提交实现](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/bow/rust/rust.go) 对照。黎明神剑在恰好 90% 生命时存在证据差异：固定目录文案写“高于”，而 [gcsim 固定实现](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/sword/harbinger/harbinger.go) 使用大于等于。因此本模块只在高于/低于 90% 时执行无争议分支，恰好 90% 时不给出假装完整的结果，而是保留明确阻塞。这仍需要游戏内测试解决。

尚未映射的二件套包括奇迹、游医、平息鸣雷的尊者、渡过烈火的贤人、逆飞的流星、烬城勇者绘卷、黑曜秘典及 7.1 新目录的 Scarlet Proof 与 Heart of the Furnace；这些条款涉及承伤/治疗/护盾属性、额外触发状态或待审阅新文案。祭礼单件冠的附着持续时间规则、其余四件套、其他武器被动、角色天赋/命座与完整事件触发也保持未验证或未映射。

## 本次实测

最近与 `equipment-build.test.ts` 一同执行：27 项通过，1.13 秒（测试执行 24 ms），其中本模块 22 项。其中参数化用例对全部 16 把支持武器的 R1–R5 共 80 个精炼条款逐一执行，确认来源字段与文案可正确匹配。其余用例覆盖90% 来源冲突、非有限输入拒绝、弓藏正负加成、天空之卷物理排除、命中前附着缺失、全部二件套来源匹配、来源漂移拒绝、四件套武器与攻击限定、未实现与明确停用语义。

已执行全项目 `npx tsc --noEmit --pretty false`。本模块与配装集成文件在最近检查中没有诊断；共享 schema/simulator 同期改动仍有类型诊断，因此这次检查不能记为全项目通过，最终状态以主任务完成后执行的检查为准。
