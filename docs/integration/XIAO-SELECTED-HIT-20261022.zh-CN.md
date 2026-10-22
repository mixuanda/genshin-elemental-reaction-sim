# 魈：普通、Q状态与E连用的实际单击

基线为 `9b753c593532480db3c8ee0583588fbbdb17df3e`。真实调用 `getCharacterDocuments("character:10000026",10)` 只有 E、六段物理普攻、重击、低/高空无碰撞下落，共10项；C1的E实际被 `constellation-scope:xiao-skill-hit` 阻塞。复现失败留在 `/workspace/GIDPS-cloud/function-batch-20261022/xiao/baseline.log`。

本提交只增加专属模块、测试与可审接线 patch。**共享生产文件已恢复基线，主线没有被本工作树修改；根线程仍需整合接线，尚未构建或部署。**

## 最小接线

新模块应用后，按 [XIAO-WIRING-20261022.patch](XIAO-WIRING-20261022.patch) 整合七个共享文件，共24行新增、5行替换。它基于9b；父线程其他角色也改同一接线时，请保留双方字段/分支，不整文件覆盖。

- `calculator-model.ts`：导入 `xiaoDamageContextSchema`，给严格 `gameContext` 增加可选 `xiaoDamage`。
- `character-calculations.ts`：最终返回 `extendXiaoDocuments(documents,workspace)`；命座保护只为 `isXiaoDamageAction` 所识别的实际动作允许已审 C0–C6，其他条件照常检查。
- `source-cast-context.ts`：接 `prepareXiaoDamageDocument`、`resetXiaoPanelAccounting`、`finalizeXiaoPanelAccounting`，使计算、JSON重开和来源配装转换共用同一公式。
- `calculator-source-cast-controls.ts` 与 `calculator-requirements.ts`：分别接 `renderXiaoControls`、`xiaoRequirementAdapter`，使用现有 source-cast 输入事件和就地缺项控件。
- `calculator-ui.ts`：保留同一动作的答案；来源配装独立绑定有效 Q 等级；将 `xiao-damage-` 公式识别为来源公式，避免重复暴露公式内部输入。
- `calculator-import.ts`：从实际 `talent:xiao:combat3` 导入有效 Q 等级；未知时保持未知。现有通用 reset 钩子会清空已含份额，不默认展示柜包含或不包含临时增伤。

接口：`gameContext.xiaoDamage` 的玩家输入是 `burstActive`、`burstTalentLevel`、`burstElapsedSeconds`、`skillA4Stacks`、`includedDamageBonus`。另有内部 `finalizedHitStates` 指纹，防止装备属性已按旧元素/时刻物化后改Q状态继续计算。每个属性可缺失，但依赖该属性的命中会明确阻塞，不用0冒充未知。

## 实现与来源

原物理动作及索引保留，另加物理碰撞单段、10项Q状态普通/重击/低高空落地/碰撞动作和一个明确的 **non-damaging Q开启说明**。Q开启没有伪造直接伤害。落地不默认叠加途中碰撞；碰撞单段也不代表落地。Q状态默认只选一击，多段普攻可分别选真实组成，不把一个共同时间当作两击时刻或整轮击数。

固定 Classic `b4ae769` 与 Stellar `a7dc4bf` 的 `xiao.go`、`burst.go`、`asc.go`、`skill.go`、`cons.go`、下落和倍率表逐字相同；`attack.go` 仅 N6→重击取消合法性有一行差异，不影响所选伤害系数。本批没有运行或重建 native；单击结果使用两固定源共有的数值规则。[来源身份原件](../audits/xiao-selected-hit-20261022.json) 保存10个文件的两版 Git blob 和 SHA256。

- `xiao.go:Snapshot` 仅对普攻、重击、下落作风附魔，并增加本级 Q 的伤害加成；E不吃这项Q增伤。
- `asc.go:a1` 按快照时 `min(1+floor((F-qStarted)/180),5)×0.05`，从按Q开始计时。Q10加成0.952，Q13为1.0885。Q等级独立于普攻等级，不再次加C5的三级。
- E在施放时快照、第4帧命中；A4在施放后15帧才新增一层。本模块输入**命中前实际仍有效**的0–3层，每层0.15，不把本次E先算一层。A1的时间则是E施放取样瞬间；例如179帧施放、183帧命中，仍用5%A1，不用10%。
- C1仅额外E充能，C2后台充能效率，C4防御，C6下落命中后的后续E资格，都不改这里的ATK天赋单击；C3/C5由调用者给出的有效E/Q天赋处理。没有生成C6额外E或认证E次数、能量/CD与整轮轴，伪造追加E集合会被拒绝。
- 自身增伤使用 `实际Q份额＋A1＋E实际A4－includedDamageBonus`；已含份额明确为0才表示未含。导入清为未知，fresh equipment设为0。来源面板转换保留可执行公式并冻结状态指纹，序列化重开不重复加算；更改旧转换的Q时间/状态须重建配装。

默认ATK2000、双方90级、抗性10%时，E10无Q/无前置A4的非暴击为 **4095.36**；Q10起始A1下，高空落地为 **7279.5945222**。原表高/低落地倍率分别4.040179/3.234591、碰撞1.617638、重击2.16032，各独立计算。

## 验证与边界

临时应用该精确 patch 的隔离树通过 **66/66** 针对断言（其中魈35项），覆盖C0–6 E、Q/A1三秒边界与封顶、独立Q等级、低/高/碰撞/重击、A4层数、已含/过期份额、缺项控件、序列化与转换负例。随后补集合形状和规范攻击标签的保护，魈 **35/35** 再过。相关旧角色输出、导入有效等级和就地控件断言未删改。typecheck通过；没有全回归或native重建。

日志均在 `/workspace/GIDPS-cloud/function-batch-20261022/xiao/`：`focused-final-2.log`、`focused-shape.log`、`typecheck-final.log`。保留 `focused-first.log` 的32/34初测：一处新手算断言错抄重击倍率，按原表改为2.16032；另一处是新实现只检查显式finalSnapshot、漏了未生成快照的来源面板转换，已扩为所有物化状态指纹检查，没有改数值容差。

本模块不证明已声明Q状态/层数如何发生，不推演Q持续、卡肉延长、扣血、敌人碰撞、反应附着或C6/队友触发。原生Q时长起算与A4满层刷新仍有源码TODO/近似，结果继续 provisional。浏览器、真实展柜到计算闭环、合并构建与发布由父线程统一验收；本批未读取/保存用户账号或Cookie。
