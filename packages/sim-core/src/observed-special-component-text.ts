/** Labels explain the shared source AST; no display-side arithmetic or inferred events. */
const stages: Record<string, [string, string]> = {
  a4Em: ["本人 A4 精通实际补差", "突破4解锁且本击适用时，莉奈娅按转换前防御的5%为实际接受者提供精通，桑多涅按转换前攻击的8%提供精通、上限160。本人应有份额减去输入面板已含份额，只补差一次；未解锁或莉奈娅本人不接受时，应有份额为零，不读取不存在的转换基数。"],
  effectiveEm: ["本击实际元素精通", "将输入精通与本角色A4尚未计入的份额相加。已经过装备属性阶段重算的面板直接使用该阶段结果；明确历史最终快照必须已含实际份额，不能重新取样。"],
  intrinsicBase: ["本人固有特殊基础提升", "莉奈娅读取本击实际防御，桑多涅读取本击实际攻击；每100点属性提供0.7%特殊基础提升，上限14%。它属于直接月结晶或星光反应的专属基础区，不属于普通元素伤害加成。"],
  baseBonus: ["特殊基础提升与已含份额", "输入特殊基础提升总额，加本角色实际固有贡献，再扣除输入已经含有的本人贡献。未知份额须明确补齐，不能默认为没有。"],
  skillMultiplier: ["第二棱镜弹 A1 天赋项倍率", "桑多涅突破1后，战技起手实际解析热量严格大于50才取4倍；恰好50或更低取1倍。倍率仅作用于这次第二棱镜弹的天赋×攻击项，特殊加算不跟随放大。"],
  burstMultiplier: ["爆发射线 A1 天赋项倍率", "桑多涅突破1后，按本次实际消费的0至10层精密战术计算1+0.1×层数。此处不检查当前解析热量是否超过50，也不从资源历史猜测层数；特殊加算不跟随放大。"],
  talent: ["来源天赋倍率与本击 A1", "固定来源所选有效天赋等级的原始系数，乘本击适用的A1天赋项倍率。该系数交由共享直接特殊反应公式与实际属性相乘，未乘普通增伤或重复计入被替代的普通组成。"],
  resistance: ["露米 A1 后的实际目标岩抗", "从输入岩抗减去露米A1应有减抗，再加回输入已经含有的A1份额。突破1后且露米在场、目标在范围内时，低月兆减15%，月兆至少2时总减30%；30%已是总量。"],
  frame: ["本击实际交付时刻", "命中帧来自已经发生的独立组成记录，用于还原本击上下文；它不是自动模拟或来源已认证的动画帧。"],
  snapshotFrame: ["本击实际进攻取样时刻", "进攻属性来自本击指定的实际取样帧与快照身份，取样不能晚于命中。若固有基础提升读取的属性不同，须另行恢复命中时的实际属性。"],
};
const inputs: Record<string, string> = {
  preConversionStat: "本击 A4 采用的实际转换前属性（莉奈娅防御／桑多涅攻击）",
  includedEm: "输入面板已经包含的本角色 A4 元素精通",
  panelEm: "本击输入面板的元素精通",
  emDelta: "本角色 A4 尚需补入的元素精通差额",
  actualIntrinsicStat: "固有基础提升实际读取的命中属性（莉奈娅防御／桑多涅攻击）",
  inputBaseBonus: "输入的特殊基础提升总额（小数）",
  ownBaseBonus: "本角色固有特殊基础提升的实际份额",
  includedBaseBonus: "输入总额已经包含的本角色固有基础提升",
  decodingPower: "本次战技起手的实际解析热量",
  tacticsConsumed: "本次爆发实际消费的精密战术层数",
  sourceTalent: "固定来源在所选有效天赋等级的原始系数",
  talentMultiplier: "本击适用的 A1 天赋项倍率",
  inputResistance: "目标输入岩元素抗性（小数）",
  actualShred: "本击露米 A1 应有的岩元素减抗",
  includedShred: "输入抗性已经包含的露米 A1 减抗份额",
  frame: "本击实际命中相对帧",
  snapshotFrame: "本击实际进攻取样相对帧",
};
export const OBSERVED_SPECIAL_COMPONENT_TRACE_TEXT_ZH: Record<string, string> = Object.fromEntries([
  ...Object.entries(stages).flatMap(([key, [title, explanation]]) => [[`stage.component.${key}`, title], [`explain.component.${key}`, explanation]]),
  ...Object.entries(inputs).map(([key, label]) => [`input.component.${key}`, label]),
]);
