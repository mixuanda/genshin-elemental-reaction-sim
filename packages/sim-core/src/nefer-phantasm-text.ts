const stages:Record<string,[string,string]>={
 dewAfter:["首次召影后的草露","真实起手草露减去首次召影消耗1枚；不会由伤害命中数反推资源。"],
 usesAfter:["本次幻戏后的使用次数","在同一次影舞已发生的幻戏次数上加1；来源上限3次，未生成后续动作。"],
 emDelta:["本击满层帷幕精通补差","突破1且月兆达到2时，实际独立8秒窗口贡献100精通；减去输入面板已经包含的份额。不因当前帷幕3层自动认为该窗口激活。"],
 effectiveEm:["本击实际元素精通","输入面板加尚未计入的来源精通。装备构筑在公共属性阶段重算EM依赖转换；完整历史快照保留已结算属性。"],
 veilFactor:["本击帷幕天赋基数倍率","来源倍率为1+0.08×有效帷幕层数，最多3层；不是1.08的层数次方，不乘入其他固定伤害附加值。"],
 shadeCoefficient:["影子本段实际天赋倍率","独立固定来源的本段月绽放倍率乘本击帷幕倍率。三段系数分别来自技能参数9、10、11，直接月绽放公式不额外乘3。"],
 intrinsicBase:["奈芙尔固有月绽放基础提升","实际元素精通每点贡献0.0175%月绽放基础提升，上限14%；不计入普通草伤增伤区。"],
 baseBonusTotal:["本击月绽放基础提升合计","输入专属基础提升加本角色实际固有贡献，再扣除输入已含的同一来源份额。"],
 frame:["本段实际命中时刻","由本次已发生事件提供。来源只证明本人两段和影子三段各自顺序，不猜两者之间的交错动画帧。"],
 snapshotFrame:["本段实际进攻取样时刻","本击读取其对应历史面板或明确稳定的共同面板；另一段不自动共用取样。"],
};
const inputs:Record<string,string>={dewBefore:"首次召影前实际草露数",dewCost:"首次召影来源草露消耗",usesBefore:"本次影舞此前实际幻戏次数",eligible:"突破与月兆是否满足A1（1/0）",buffActive:"独立8秒精通窗口本击是否有效（1/0）",buffEm:"C0满层帷幕精通来源贡献",includedEm:"输入面板已含满层帷幕精通",panelEm:"输入面板元素精通",emDelta:"尚未计入的本击来源精通",veilStacks:"本击实际有效帷幕层数",veilBonus:"每层帷幕的天赋基数提升比例",coefficient0:"本段ATK天赋倍率",coefficient1:"本段EM天赋倍率",sourceCoefficient:"影子本段固定来源天赋倍率",veilFactor:"本击实际帷幕倍率",actualEm:"固有基础提升读取的实际元素精通",intrinsicRate:"每点元素精通固有基础提升比例",intrinsicCap:"固有基础提升上限",inputBaseBonus:"输入专属基础提升总额",ownBaseBonus:"本角色实际固有基础提升",includedBaseBonus:"输入已含本角色固有提升",frame:"实际命中相对帧",snapshotFrame:"实际进攻取样相对帧"};
export const NEFER_PHANTASM_TRACE_TEXT_ZH:Record<string,string>=Object.fromEntries([...Object.entries(stages).flatMap(([key,[title,explanation]])=>[[`stage.nefer.${key}`,title],[`explain.nefer.${key}`,explanation]]),...Object.entries(inputs).map(([key,label])=>[`input.nefer.${key}`,label])]);
