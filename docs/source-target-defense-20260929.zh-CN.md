# 固定来源目标 DEF 情景与来源追踪（2026-09-29）

本批为共享目标档案增加可选静态 `defenseAdjustment`，有效范围为有限值 `[-1, 0.9]`；未填写时沿用原生默认 0。负值表示用户声明的减防情景，正值表示增防。它是目标配置，不是有限时长的 `DefMod`，也不等于攻击字段 `defenseIgnore`。

原生 `EnemyProfile` 以该配置作为 DEF 起点，再按原有顺序叠加当时有效的动态 DEF 修正并沿用既有 clamp；来源 phase 快照另记 `defenseAdjustmentBase`。共享 scalar trace 将初始值、后续加法和 DEF 倍率分开呈现。它没有改变动态 modifier 的创建、期限或失效机制。

实际改动文件见[测量归档](validation/source-target-defense-measurements-20260929.json)的 `implementationFiles`：共享档案与控件、共享 scalar provenance、105 native patch、stellar build 脚本及本批测试／E2E。队伍和单技能入口复用共享控件，入口组件本身和两 lane sourcehost bridge／`main.go` 未修改。stellar build 脚本显式应用此 patch；classic 按 patch 名排序自动应用。

验证包括 2 项窄测（0.889 秒）、classic／stellar 构建（12.255／12.919 秒）、registry（0.211 秒）及 Web build（7.36 秒）。浏览器首轮 7.906 秒在名册尚未就绪时尝试导入，未运行原生场景；等待已有导入控件可用后，同一用例通过（7.243 秒，`pageErrors=[]`）。详细命令与产物身份见[汇总测量](validation/source-target-defense-measurements-20260929.json)。

唯一运行样本是 classic Kaeya E 对三个位置相同的目标，分别设 DEF adjustment 为 `0`、`-0.3`、`+0.2`。三次实际命中均非暴击，原始伤害依次为 `1161.8921525418264`、`1366.9319441668545`、`1056.2655932198422`，总计 `3585.089689928523`；共享公式重放差均为 0。相对基准的伤害倍率为 `1.1764705882352942` 和 `0.9090909090909092`。公式截图显示 `190 / (190 + 190 × (1 − 0.3) × (1 − 0)) = 0.5882352941176471`。队伍草稿在配置检查后保留成功；该步骤没有第二次原生运行。stellar 仅构建，没有 runtime 样本。

这验证的是显式静态 DEF 情景及普通伤害公式来源，不是敌人专属资料，也没有运行时动态 DEF 堆叠、特殊伤害族、phase、敌盾或长时间 HP 情景的新增验证。`coverage`、`verified`、数据指针、`activeVerified` 与 `completeCast` 均未提升。下一项应实现敌方 phase／无敌情景，并分别建模免伤、阻止命中、阻止附着或触发等语义，不能合并成单一开关。
