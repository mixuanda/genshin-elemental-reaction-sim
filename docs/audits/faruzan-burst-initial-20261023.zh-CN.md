从404c76a实际调用角色文档、命座处理和同UI的source preparation后，珐露珊C6的 `finite-followup-faruzan-burst-fresh-c0` 初击被公共命座门及有限后续模块C0门同时阻断，requirements没有可链接字段。原始复现保存在 `/tmp/GIDPS-faruzan-nicole-single-evidence-20261023/before.json`。

本模块保持原skillId和hitId，新增可选 `gameContext.faruzanBurstInitial`，仅允许单选原Q初击。43帧祈风状态先于54帧初击，因而本级Q风伤和C6的40%风伤暴伤可以据明确命座及本次在范围内的资格计算，无需另问C6开关；A4另需真实白字及未被其他风伤消费。自身减抗在初击后才施加。C1第二箭、C2延时、C4回能、C6后续风压坍陷不混入初击，也没有开放完整Q日程。

固定B4源码原文及倍率向量继续复用原有归档，身份、完整向量和边界见 `packages/game-data/sources/faruzan-burst-initial/manifest.json`。来源是固定社区实现，不能当作当前官方游戏认证。所选向量为独立有效Q等级1–15，不再加C5；C3仅增加E。

核心导出 `faruzanBurstInitialContextSchema`、`initializeFaruzanBurstInitialDocument`、`prepareFaruzanBurstInitialDocument`、`resetFaruzanBurstInitialPanelAccounting`、`finalizeFaruzanBurstInitialPanelAccounting`、`isFaruzanBurstInitialHit(doc, hit)`、`FARUZAN_BURST_INITIAL_MAX_CONSTELLATION=6`。无新context的旧C0存档返回原对象，不迁移；新context的prepare必须在公共source-cast入口提前return，避免旧finite模块再次改写。

控件导出 `renderFaruzanBurstInitialControls`、`updateFaruzanBurstInitialControl` 和 `faruzanBurstInitialRequirementAdapter`。玩家只确认本次新Q/范围/A4资格及输入已经包含的份额；装备白字可直接推导，未知、否和合法0分开保存。同槽外来公式保持原证据，存在非零来源冲突时阻断。转换快照保存状态、等级与快照身份，改变后拒绝沿用或重新盖写。

9项定向断言覆盖：Q13单次计级、A4白字/C6暴伤真实AST数值、已含记账、C0–C5不误加C6、0与未知、外来公式、旧档不迁移、范围负例、JSON往返和旧转换身份。独立算式 `(2000×8.024+320)×1.3825×0.5×0.9×1.7=17311.0014`。测试直接运行专属模块和现有普通伤害AST，不伪称公共schema/路由已注册；公共注册及真实浏览器由根线程完成。未跑native、全套回归、部署或push。
