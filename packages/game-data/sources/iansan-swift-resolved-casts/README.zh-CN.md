# 伊安珊雷霆飞缒：普攻等级绑定裁决与单次完整动作

本目录仅定义 `iansan-swift-resolved-c0`（角色模板 `swift`，映射 `iansan-swift-resolved-c0-swift`）。名称采用原始中文「雷霆飞缒」及英文 Swift Stormflight。完整性仅指一次合法进入的 C0 雷霆飞缒动作的唯一直接伤害候选；不代表 E 加雷霆飞缒的组合、完整夜魂状态或完整团队轮转。

## 数值与等级权威

数值及实际天赋等级绑定以 `frzyc/genshin-optimizer@180a0a1015cb725c7570cd828eb086749960df98` 为权威。`Iansan/index.tsx:34–47` 令 `a` 从 −1 开始递增，`dm.charged.swiftDmg` 指向 `skillParam_gen.auto[4]`。该文件165–167行调用 `dmgNode('atk', dm.charged.swiftDmg, 'charged', …)`，只覆盖伤害元素为雷，没有传入第六个天赋覆盖参数。`Characters/dataUtil.tsx:90–109` 将 charged 解析为 auto，179–184行据此读取 `input.total.autoIndex`。`wr/formula.ts:341–348` 定义索引为 `total.auto - 1`，`wr/api.ts:101–104` 从 `char.talent.auto` 独立输入普通攻击等级。因此雷霆飞缒使用普通攻击等级，而非元素战技等级。

独立 `skillParam.json.auto[4]`、`allStat_gen.json.char.skillParam.Iansan.auto[4]`、原始 genshin-db `iansan.combat1.param5` 和活动目录 `talent-set:iansan/combat1.param5` 的全部15级完全相等，容差为0。档案保存完整原始目录文件；其SHA-256为 `3ed973284f87bba52bf2dcc407c5ad08aa76fdc2c8f0cad475f34ed0812f5602`。

gcsim行为来源固定为 `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`。它的 `zz_iansan.dm.go` 把 swift 注释为 `attack: WeightedSpike - Swift Stormflight DMG: {4}`，`config.yml` 也写 `swift: attack(Swift Stormflight DMG)`；其向量15级与上述数据完全相等。但 `charge.go` 实际写了 `swift[c.TalentLvlSkill()]`，构成**天赋索引冲突**。原文件、原表达式、原向量和注释均未修改，manifest单独保留裁决证据。采用已独立证明的 Optimizer autoIndex，不要求 NA 与 E 同级。例如 NA1/E10 的系数应为0.84194，旧索引会取1.6643；不能通过同级输入掩盖问题。

## 实际动作资格与体力

实际normal指令只有在 `fast-skill` 有效时才转入雷霆飞缒；单有夜魂加持不会将普通攻击指令变为此动作。实际charged指令在 `fast-skill` 或夜魂加持有效时进入Swift。`fast-skill` 同时免除charge体力和长枪前置普攻要求；只有夜魂加持时，仍须满足原队列的前置普攻条件，并支付25点体力。本限定分支明确体力倍率为1和实际可用体力，不从夜魂状态推断免费重击。

玩家先通过队列合法性与可执行检查，再在charged执行分支扣体力，最后调用会消耗 `fast-skill` 的角色函数；normal执行分支不执行charge扣体力。归档包含这条顺序、体力减耗计算及队列helper。资格取本次动作真正执行时的状态；模拟器会先运行该帧角色任务和退出回调，不能仅从一个inclusive expiry时间戳认定仍可起手。

起手进入Swift后，源码没有在命中前再次检查夜魂或 `fast-skill`。无需强求它们持续到命中帧；起手和本击快照状态必须分别记录。

## 唯一伤害、快照与命中后A1

无卡肉且不中断时，本动作唯一伤害候选在动作开始后25帧，进攻快照也在25帧。33帧只是默认动画结束；源码另允许特定动作更早衔接，它不增加本动作伤害。完整伤害观察覆盖25帧候选及其明确命中或落空即可，不把动画尾帧当作第二击。

源码使用以primary target为参照、Y偏移0.5、半径2.5的全圆范围，雷元素、charged伤害、附加夜魂标签。上述形状不能替代实际目标接触证据；本实现不自动选择敌人、保证命中、模拟附着/ICD或生成后续伤害。

25帧先取进攻快照并计算本击伤害，敌人伤害任务之后才调用A1回调。突破至少1且实际接触敌人时，每次Swift至多授予／刷新一次20%攻击力的标准动作状态。**当前命中新授予的A1不能反向增强当前击**；若旧A1在25帧确实仍有效，则需按快照中的实际增益及已经计入份额处理一次。本限定分支另要求25帧快照时Q未生效，不接受正在生效的Q攻击力反馈；不根据起手状态、夜魂点数或队友移动补造增益。

A1源modifier写有900帧持续时间，但本动作只记录命中后的状态授予，不计算其未来续攻，也不要求900帧未来观察。未命中任何敌人不会授予新A1；所选目标落空不能据此推断其他敌人的接触或A1授予。A4治疗和夜魂资源变化不作为额外直接伤害；C1–C6不属于本分支。

## 原文与来源身份

`source.json.gz` 含52份原始UTF-8文件字符串，按来源别名和原路径保存；UTF-8重编码还原原字节。完整目录原文作为独立本地证据保存，树条目另置于 `selectedTreeEvidence`。每份上游文件记录字节数、SHA-256与计算出的Git blob SHA-1，许可证按来源归档。归档SHA-256为 `bd9cec771d0adc043622153bb8242cef441dcde67a362bbb36bfbbba0720b2ec`。

Optimizer文件均与固定提交的完整、未截断树匹配；genshin-db原文通过本地固定提交的 `git show REV:path` 读取，并与 `git rev-parse REV:path` 的blob匹配。gcsim本地只保有早先的selected-tree：本包36份中6份可与所选树条目匹配，另30份仅记录固定codeload归档身份及实际字节摘要，未声称通过完整a7树验证。原codeload SHA-256为 `c0484e23afda76d7b38bb4fb49c2592b4b7bdccc8d549eaf8a4848e37aa55165`；具体缺口见manifest。

此次仅制作来源、定义和映射；已进行必要的原始向量及文件身份比较，未运行测试、构建或数据管道。曾仅为固定Optimizer原文联网取证。该跨来源裁决是固定社区实现证据，不代表当前游戏实测认证。
