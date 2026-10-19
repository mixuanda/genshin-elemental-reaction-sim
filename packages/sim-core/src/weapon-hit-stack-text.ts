const stages:Record<string,[string,string]>={
 cooldownPresence:["武器触发冷却存在性","来源状态在到期帧仍存在；事件帧大于到期帧后才允许重新触发。"],
 windowPresence:["旧叠层窗口存在性","来源窗口存在性包含到期帧；若真实属性读取已删除窗口则不存在。"],
 expiresOnRead:["真实属性读取清理到期窗口","实际Stats读取在到期帧即删除属性modifier；不改变未读取时的状态存在性，也不把审计预览当作实际读取。"],
 stackBase:["本次增加前的有效旧层数","旧窗口仍存在时保留私有层数，否则从0开始；宗室层数没有持续时间。"],
 stacksAfter:["武器命中后层数","在本次有效旧层数上加1，并按对应武器来源上限截断。触发命中本身使用此前面板。"],
 criticalReset:["宗室实际暴击清空专注","真实非零伤害且实际暴击时清空层数，即使仍在叠层冷却。原冷却不因暴击重置。期望暴击不能代替实际结果。"],
 cooldownExpiry:["武器触发冷却到期帧","本次真实回调帧加来源冷却帧；所有精炼使用固定来源时长。"],
 effectExpiry:["武器叠层窗口刷新","本次合法命中把整组属性窗口刷新至当前帧加来源时长，满层仍刷新；不是各层独立计时。"],
 effectiveStacks:["本次属性取样的有效层数","已到期属性窗口提供0层；私有历史计数可保留到下次来源触发再重置，宗室永久窗口始终可读。"],
 perStack:["精炼对应每层属性","按固定来源的常数项与精炼斜率计算每层比例；仅使用真实R1至R5。"],
 critRate:["宗室专注暴击率贡献","真实命中前有效层数乘本精炼每层暴击率。宿主与其他暴击率相加后再统一截断；此处不重抽随机。"],
 shieldedAttack:["金璋皇极实时护盾攻击贡献","有效层数乘每层攻击比例；属性取样时确实受到护盾庇护则翻倍。不会从旧的护盾事件猜当前仍有盾。"],
 attackAndDefense:["试作斩岩／白影攻击与防御贡献","相同层数与精炼系数分别作为攻击百分比、防御百分比加入对应基础属性，不把防御误作固定攻击。"],
 attack:["和璞鸢层数攻击贡献","有效层数乘当前精炼每层攻击比例。"],
 maximumStackDamage:["和璞鸢满层额外增伤","恰好达到7层时提供当前精炼的全伤加成；不足满层或窗口已失效时为0。"],
 damage:["铁蜂刺层数伤害加成","真实元素伤害触发的有效层数乘本精炼每层增伤。物理伤害不能触发新层，但可受已有全伤加成。"],
};
const inputs:Record<string,string>={hasExpiry:"对应状态是否存在（1/0）",eventFrame:"实际事件／属性读取帧",expiryFrame:"已有状态到期帧",windowPresent:"对应属性窗口仍有效（1/0）",stacks:"当前来源私有层数",previousStacks:"本次合法增层前有效层数",maximumStacks:"对应来源层数上限",durationFrames:"固定来源持续／冷却帧数",refinement:"武器实际精炼1至5",baseCoefficient:"精炼公式常数项",refinementStep:"每精炼档的比例增量",perStack:"本精炼每层属性比例",shielded:"本次实际取样时持有者受到护盾庇护（1/0）"};
export const WEAPON_HIT_STACK_TRACE_TEXT_ZH:Record<string,string>=Object.fromEntries([...Object.entries(stages).flatMap(([key,[title,explanation]])=>[[`stage.weaponStack.${key}`,title],[`explain.weaponStack.${key}`,explanation]]),...Object.entries(inputs).map(([key,label])=>[`input.weaponStack.${key}`,label])]);
