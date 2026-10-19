# 来源动画、雷电将军 E 归属与角色公式审计（129–132）

本报告记录 2026-10-03 执行、2026-10-05 归档的来源宿主收据。范围包括 129 烟绯／米卡 Q 根、130 动画回调与阶段状态、131 雷电将军 E 的施术者／持有者归属，以及 132 角色数值公式静态审计。证据以[测量收据](validation/source-animation-eye-frontier-measurements-20261003.json)、其引用的 capture/build/log 和[132 审计](validation/source-character-formula-frontier-audit-20261003.json)为准。

## 结果

129 的实测闭合包含烟绯 Q 一根伤害根，以及米卡 Q 零伤害根；这不表示米卡治疗、增益或动画生命周期完整。130 在 Classic／Stellar 分别检查 17／18 个实际 actor 捕获点，并各记录两个归一化时间谓词候选。运行时只采到胡桃重击的实际 actor 与 `OnRemoved`；归一化谓词没有在采样阶段留存，只有源码／构建证据。

131 将雷电将军 E 施术者与四个持有者分开追踪。每 lane 记录 4 次原生激活、5 次实际触发和 6 次命中（含 E 初击与 Eye 后续攻击）；仅计入该来源链，排除爆发增益数值、粒子能量、触发者自有伤害，以及独立反应／装备伤害。计算器展示四个实际持有者行，并通过完整 E 导入与 JSON 往返。重施与 +51 至 +66 帧重叠只有源码／构建审查，没有运行样本。

两 lane 各观察 2,178 帧、17 次应用、61 条动作日志，总应用伤害均为 13,164.172125839998。伤害、动作、帧与玩家状态均与各自基线相同；Origin 除忽略新增的 `StatusOwner` 外完整相等，并另行核对 owner 指向准确的生成状态与持有者。6 次技能调用闭合，14 次选定重放的最大绝对误差为 0。两 lane 的 5 个 phase 边界仍全部 incomplete，因此该样本不构成稳态证明。

Native 共 4 次：变更前基线两次、变更后两次；最终浏览器检查复用 capture，新增 native 运行数为 0。本场景显式使用 `ignore_burst_energy=true`，因此不据此验证能量可持续性或合法充能轮转。Classic／Stellar 构建分别 6.881／8.384 秒，注册表 0.119 秒。Web 初始构建因类型 fixture 失败（3.139 秒），修正后通过（4.376 秒）。浏览器初始断言要求未采样的 normalized predicate，失败（13.205 秒）；只修正断言并复用 capture 后通过（7.793 秒）。这些失败保留在日志中。

132 是只读静态审计，没有新增规则或实现。候选公式规则已由共享调用接入；共享调用存在本身不能证明完整公式、机制、阈值或游戏行为正确。

## 仍未完成

捕获真实 actor 后，具体私有状态缺口从每 lane 47 增至 54；这些是新捕获对象暴露的未审阅字段，不能据缺口计数推断完成率。全部 5 个 phase 边界仍 incomplete。注册表为 110 个合并 ID／108 个 canonical 角色动作；尚无有限合同的 E/Q 绑定为 Classic 126、Stellar 140；这些是缺口计数，不是 readiness 分母。activeVerified 仍为 null，数据指针未变；没有游戏内核验或版本晋升。Oct 3 提供方版本索引与 genshin-db 提交未变；发布 API 响应体改变的原因未确定，7.2 V1 等仍缺来源证明；本报告不声称 Oct 5 重新抓取或证明官方当前版本。全量目标保持 active，未 commit、push 或 deploy。

[完整测量与执行回执](validation/source-animation-eye-frontier-measurements-20261003.json) · [角色公式审计收据](validation/source-character-formula-frontier-audit-20261003.json)。
