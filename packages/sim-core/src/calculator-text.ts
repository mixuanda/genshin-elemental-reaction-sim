import { WEAPON_HIT_STACK_TRACE_TEXT_ZH } from "./weapon-hit-stack-text";
import { NEFER_PHANTASM_TRACE_TEXT_ZH } from "./nefer-phantasm-text";
import { OBSERVED_SPECIAL_COMPONENT_TRACE_TEXT_ZH } from "./observed-special-component-text";
import { ZIBAI_FINITE_TRACE_TEXT_ZH } from "./zibai-finite-text";
import { PLAYER_SHIELD_TRACE_TEXT_ZH } from "./player-shield-runtime";
import { SPECIAL_TRACE_TEXT_ZH } from "./special-calculator";
import { traceText } from "./calculation-trace";
const stages:Record<string,string>={
sourceSnapshotFrame:"来源属性的实际取样帧",sourceSnapshotEm:"独立来源快照的元素精通",
capturedFinalSnapshot:"历史快照的最终数值",
statConversionDefense:"起手非 Extra 防御快照",statConversionAttack:"防御快照转换为固定攻击力",
characterCritRate:"角色来源的本段暴击率",characterCritDamage:"角色来源的本段暴击伤害",
equipmentBaseAddition:"装备来源的命中基数附加",equipmentAndManualBaseAddition:"手动与装备附加基数合计",equipmentCriticalBonus:"装备暴击属性的命中适用性",applicableCritRate:"本段暴击率合计（限制前）",applicableCritDamage:"本段暴击伤害合计",finalizedEquipmentEffect:"已固化的装备来源代入记录",
sourceElementalMasteryAdjustment:"本段来源精通状态",hitElementalMastery:"本段实际元素精通",
characterResistanceReduction:"来源角色公式的敌方减抗",
equipmentReactionBonus:"装备反应加成适用性",applicableReactionBonus:"本段反应加成合计",equipmentResistanceReduction:"装备减抗条件与元素",totalResistanceReduction:"本段适用减抗合计",effectiveResistance:"本段最终有效抗性",
equipmentAndManualDamageBonus:"装备与手动增伤合计",customDamageBonus:"来源被动的逐击伤害加成",
equipmentStatModifier:"装备属性公式",appliedStatModifier:"加入装备公式的属性贡献",dynamicDamageBonus:"装备动态伤害加成",customAdditiveBase:"来源公式的附加基础伤害",energyRecharge:"最终元素充能效率",customBaseDamage:"已定义的资源与复合基础伤害公式",resolvedScalingValue:"插件结算后缩放面板",resolvedAdditiveContribution:"插件结算后激化追加值",criticalSample:"带种子暴击判定",coefficientPercent:"天赋百分比换算",damageBonusPercent:"伤害加成百分比换算",equipmentBonus:"装备增伤适用性",applicableDamageBonus:"本段适用伤害加成合计",baseAtk:"基础攻击力",atkPercent:"攻击力百分比换算",finalAtk:"最终攻击力",finalHp:"最终生命值",finalDef:"最终防御力",critRatePercent:"暴击率百分比换算",critDamagePercent:"暴击伤害百分比换算",scaling:"天赋缩放项",scalingSum:"合并缩放项",talentDamage:"天赋基础伤害",baseDamage:"加入附加基础伤害",damageBonusMultiplier:"伤害加成乘区",afterBonus:"伤害加成后",defenseIgnore:"防御无视限制",defenseAdjustment:"有符号防御调整",defenseMultiplier:"敌人防御乘区",afterDefense:"防御乘区后",resistanceMultiplier:"敌人抗性分支",afterResistance:"抗性乘区后",critRate:"有效暴击率",critDamage:"有效暴击伤害",nonCriticalMultiplier:"非暴击乘数",criticalMultiplier:"暴击乘数",expectedMultiplier:"期望暴击乘数",amplifyingEmBonus:"增幅反应精通加成",reactionMultiplier:"增幅反应乘数",afterCritical:"暴击分支伤害",afterReaction:"反应结算后",finalDamage:"本分支最终伤害",weightedVerification:"概率加权验证",criticalDamage:"暴击伤害",expectedDamage:"期望伤害",entryPoint:"教学输入起点",levelBaseDamage:"精确等级基础值",transformativeEmBonus:"剧变反应精通加成",transformativeBaseDamage:"剧变反应抗性前伤害",transformativeDamage:"剧变反应最终伤害",transformativeExclusions:"不适用的普通乘区",additiveEmBonus:"激化反应精通加成",additiveReactionDamage:"激化附加基础伤害",combinedAdditive:"合并附加基础伤害",nonDamaging:"非伤害事件",critIneligible:"暴击不适用",counterexample:"错误的全段统一增幅",overstatement:"错误结果的高估量","total.nonCritical":"所选段数非暴击合计","total.critical":"所选段数暴击合计","total.expected":"所选段数期望合计",reactionGroupPolicy:"剧变反应伤害组倍率",targetDamagePolicy:"目标伤害策略",flatContributor:"追加伤害贡献"
};
const explanations:Record<string,string>={
sourceSnapshotFrame:"实际接受动作的起手帧加上该来源声明的相对取样帧，得到队列真实执行的取样帧。后续命中使用该帧保存的属性；命中时属性变化不会改写本份样本。来源时点遵循固定源码模型，不等同于游戏实测。",sourceSnapshotEm:"直接读取本独立来源在注明帧保存的最终元素精通。记录没有更早的精通属性分解，不补造基础值或再次叠加增益。",
capturedFinalSnapshot:"直接恢复此前明确记录的数值；当前装备与属性转换不会再次加入。最终面板之前的历史装备分解未知，不补造；后续伤害仍由共享公式核心执行。",
characterCritDamage:"按明确命座和攻击标签执行本段来源暴击伤害加成，只加入对应命中，不改角色全局暴伤面板。已提供本段最终暴伤时不执行或重复加入；不会把不耗资源概率乘成伤害倍率。",
statConversionDefense:"在成功起手时读取防御；本通用转换只输出 flatAtk，不反馈进防御。来源精确快照时机仍是固定源码假设。",statConversionAttack:"转换结果在声明的有效期内叠加到 flatAtk；之后的防御变化不重算历史快照。",
characterCritRate:"只对符合突破、元素和攻击标签条件的普通命中执行角色来源暴击率公式；与面板及装备暴击率合计后再限制概率。明确最终暴击率覆盖本式时不执行、不重复添加，也不要求未执行的历史属性分解。",
equipmentBaseAddition:"只对来源允许的元素、攻击标签和武器执行此命中基数附加。它直接加入本段普通伤害基数，不是攻击力；随后按本段定义进入增伤、防御、抗性、暴击及增幅，不能套给剧变或月星特殊公式。final-panel读取本段实际面板（含逐击精通调整）；独立历史快照则使用显式保存的状态输入。",equipmentAndManualBaseAddition:"手动附加基数加本段实际适用的装备附加基数；角色来源附加式和激化追加值在后续各加入一次。",equipmentCriticalBonus:"只有标签、元素、武器和暴击资格均符合时，才加入本段暴击率或暴击伤害；不写入角色全局面板。已有本段最终暴击属性时不重复应用。",applicableCriticalStat:"先合计当前面板与本段适用的暴击属性，再由共享伤害公式限制暴击概率到0至1。明确最终值直接作为入口；不可暴击命中不适用这些属性。",finalizedEquipmentEffect:"用转换时保存的表达式、真实输入和来源重现历史代入；贡献已包含于本段固化值，此记录不再次进入伤害。重新应用配装时由核心仅撤销装备份额，保留手动输入与角色公式。",
sourceElementalMasteryAdjustment:"用该命中明确保存的状态开关和来源参数计算精通贡献；状态是否仍在持续时间内由输入明确提供，不从本段当前或已消耗的资源层数推断。",hitElementalMastery:"本段精通等于面板精通加来源贡献乘记账开关。尚未计入时开关为1，已包含在最终面板时为0；所得精通同时进入本段缩放、被动与反应公式，不修改其他段数。",
characterResistanceReduction:"按明确的突破、元素和状态输入执行来源角色减抗公式，与适用装备减抗合计后从敌人基础抗性扣除一次。若已给出本段最终抗性，则本式不再执行，保留来源与不适用原因。",
equipmentReactionBonus:"来源条款只进入明确列出的经典反应：增幅加成进入蒸发/融化，激化加成进入附加基础伤害，剧变加成进入剧变乘区；不会作为普通伤害加成。",applicableReactionBonus:"手动额外反应加成与本次实际适用的装备反应加成相加。各反应使用自己的列表，不把同套装的其他反应条款一并套用。",equipmentResistanceReduction:"来源减抗比例乘显式条件的 0/1 值，再乘伤害元素匹配的 0/1 值；关闭的效果仍保留原始比例、条件和来源。",totalResistanceReduction:"合计对当前伤害元素已生效的装备与角色来源减抗，不降低其他元素抗性。",effectiveResistance:"输入的敌方抗性减去本段适用的装备与角色来源减抗；负抗性随后进入共享抗性公式的负值分支。",suppliedEffectiveResistance:"直接使用已保存或用户明确输入的最终抗性；不再扣除装备或角色来源减抗。",
characterDamageBonus:"满足突破和攻击类型要求时，使用本次命中的最终面板执行来源被动公式。结果属于普通伤害加成，与装备及额外手动增伤各计入一次；不是天赋倍率或附加基础伤害。",combinedDamageBonus:"装备与手动追加增伤，加上已执行的来源被动增伤。手动栏只填写其他补充，不应再次填入本条自动计算的被动。",
contextFormula:"使用记录的表达式和显式状态输入执行公式。属性转换读取注明的转换前快照，按来源允许的顺序应用；没有把已转换属性再用于不允许的二次转换。",appliedStatModifier:"将本条已执行的属性公式结果加入目标属性一次；不重新加入来源装备数值。",dynamicDamageBonus:"只在命中类型、元素及武器条件满足时执行动态增伤公式，否则明确排除。",energyRecharge:"100% 基础充能加上明确来源与条件公式的充能提升；1.00 表示100%。",customBaseDamage:"直接执行记录的类型化公式：可包含多属性、资源、队友贡献、条件分支和上下限。它替代默认缩放项合计，随后仅按已定义顺序进入附加值与伤害乘区。面板输入来自当前构筑，其余变量显式列出所有者和来源；不从自然语言猜测公式。",resolvedScalingValue:"使用事件捕获的插件结算后精确缩放值，不再从旧快照重建一次。",resolvedAdditiveContribution:"先展示来源公式，再展示插件结算后实际进入普通伤害的追加值。",criticalSample:"独立、带种子的随机数小于有效暴击率时，本段发生暴击。当前伤害使用已捕获的实际判定，不是解析期望。",coefficientPercent:"天赋百分数除以 100 得到计算倍率；此百分数等价值来自未舍入输入，显示文本不会回写核心。",damageBonusPercent:"伤害加成百分数除以 100 得到乘区使用的比例。",equipmentBonus:"逐项检查装备效果的元素、攻击标签与武器种类条件；不适用时明确排除，并保留来源和原因。",applicableDamageBonus:"手动追加增伤与本段实际适用的装备增伤相加；装备原始属性只在此进入一次，不叠加到导入最终面板。",sourceContributions:"按精确来源逐条相加：角色基础/突破、副属性、圣遗物主词条与每次副词条，以及明确启用的已实现装备效果。",manualAdjustment:"当前输入与已知来源合计的差值是用户显式面板调整，不假设未知的装备来源。",resolvedContribution:"已知来源合计加手动调整，作为后续属性公式实际使用的输入。",baseAtk:"先合并角色和武器基础攻击力；百分比攻击力只对这部分生效。",atkPercent:"百分数除以 100 得到计算用小数；显示数值不回写计算。",finalAtk:"基础攻击力先乘百分比攻击增益，再加入固定攻击力。",finalHp:"基础生命先乘生命百分比增益，再加入固定生命。",finalDef:"基础防御先乘防御百分比增益，再加入固定防御。",critRatePercent:"暴击率从百分数转换为比例，后续再限制在 0 到 1。",critDamagePercent:"暴击伤害从百分数转换为比例。",scaling:"此项按已选定的生命、攻击、防御或精通数值计算；基础伤害倍率只作用于该项。",scalingSum:"按明确的缩放公式合并各项，不猜测缺失的缩放属性。",talentDamage:"指定缩放面板乘以有效天赋系数。",baseDamage:"附加基础伤害在天赋缩放后相加；它不是固定攻击力，不再乘天赋系数。",damageBonusMultiplier:"只使用此伤害实例适用的伤害加成。",afterBonus:"加入附加基础伤害后，再乘伤害加成乘区。",defenseIgnore:"防御无视按当前历史规则限制在 0 到 100%。",defenseAdjustment:"此兼容字段用负数表示减防：-0.30 即降低 30%。小于 -0.90 超出当前来源确认范围，不能标记为已验证。",defenseMultiplier:"人物与敌人等级共同决定防御比例；此兼容字段以 1 加有符号防御调整表示敌方剩余防御。",afterDefense:"抗性结算前先乘敌人防御乘区。",resistanceMultiplier:"负抗性使用减半分支；0 至 75% 使用线性分支；至少 75% 使用倒数分支。",afterResistance:"对当前伤害元素的有效抗性乘区进行结算。",critRate:"暴击概率限制在 0 到 1；超出范围不会产生额外暴击概率。",critDamage:"普通暴击伤害增幅不低于 0。",nonCriticalMultiplier:"非暴击分支乘数为 1。",criticalMultiplier:"暴击允许时，暴击分支乘数为 1 加暴击伤害。",expectedMultiplier:"独立暴击且不存在暴击反馈时，期望乘数为 1 加暴击率乘暴击伤害；这不是保证出现的单次数字。",amplifyingEmBonus:"符合元素条件的蒸发或融化使用对应精通增幅；无增幅反应时不适用。",reactionMultiplier:"反应基础倍率乘精通与反应专属加成；假设反应成立并不证明实战附着与 ICD 覆盖。",afterCritical:"执行当前非暴击、暴击或期望分支；保留模拟器既有的浮点运算顺序。",afterReaction:"对这一个伤害实例应用反应，不向其他段数传播假设。",finalDamage:"再应用当前已定义的独立伤害组倍率，得到此分支最终值。",weightedVerification:"以未暴击概率乘非暴击伤害、暴击概率乘暴击伤害并相加，独立核验期望值。",criticalDamage:"非暴击基础乘暴击乘数。",expectedDamage:"非暴击基础乘概率期望乘数。",entryPoint:"这组教学输入已经结算其他非暴击因素，不能当作原始攻击力或真实角色倍率。",conditionedReaction:"为此段明确规定增幅覆盖，仅用于教学条件计算，不宣称实战能建立该覆盖。",levelBaseDamage:"按整数等级查固定来源表，不插值，不推测缺失等级。",transformativeEmBonus:"普通剧变使用 16 × 精通 / (2000 + 精通)。",transformativeBaseDamage:"精确等级值乘反应倍率，再乘精通和反应专属加成。",transformativeDamage:"普通剧变只乘相关元素抗性；不套用普通防御与暴击公式。",transformativeExclusions:"普通攻击、防御、暴击与普通伤害加成不属于这条剧变公式。",additiveEmBonus:"激化附加项使用 5 × 精通 / (1200 + 精通)。",additiveReactionDamage:"按等级、激化分支倍率和精通生成附加基础伤害，稍后随普通伤害乘区结算。",combinedAdditive:"固定附加基础伤害与激化附加值先合并，再进入普通伤害乘区。",nonDamaging:"该事件只建立状态或防护效果，没有已定义的伤害实例；不编造伤害数字。",critIneligible:"此类伤害不允许普通暴击。",skillTotal:"逐段结算后只累加明确选中的伤害实例；没有持续时间分母，因此不报告 DPS。",counterexample:"此式错误地把第一段反应覆盖用于所有段数，仅作为反例，绝不进入正式总伤害。",overstatement:"错误总值减去逐段计算的正确总值。",reactionGroupPolicy:"公式输出乘该事件已经执行并记录的伤害组倍率。",targetDamagePolicy:"潜在伤害乘该目标的命中、免疫或阶段倍率；免疫时为 0。",flatContributor:"贡献者数值乘系数成为附加基础伤害；保留其来源与所有者。"
};
const inputs:Record<string,string>={
sourceActionFrame:"本次动作实际被接受的全局起手帧",sourceRelativeFrame:"该属性来源相对实际起手声明的取样偏移帧",
ascension:"历史快照对应的突破阶段（0 至 6）",
statConversionBaseDef:"角色基础防御",statConversionDefPct:"已生效的防御百分比",statConversionFlatDef:"已生效的固定防御",statConversionSnapshotDef:"起手锁定的非 Extra 总防御",statConversionCoefficient:"来源声明的 DEF→ATK 转换比例",clorindeA1Stacks:"破夜的明焰层数（显式条件）",erRatio:"元素充能效率比例（1为100%）",energyRechargeBonus:"元素充能效率额外提升",energyRecharge:"最终元素充能效率",previousValue:"应用本公式前的属性贡献",modifierValue:"本装备公式的属性贡献",formulaContribution:"来源公式产生的附加基础伤害",resource:"显式资源数量",stacks:"显式层数",teammateAtk:"指定队友的最终攻击力",roll:"带种子随机抽样值 [0,1)",equipmentBonus:"本项装备伤害加成",enteredValue:"当前手动可编辑的总值",manualAdjustment:"相对已知来源的手动调整",FIGHT_PROP_ATTACK_PERCENT:"攻击力百分比",FIGHT_PROP_ATTACK:"固定攻击力",FIGHT_PROP_HP_PERCENT:"生命百分比",FIGHT_PROP_HP:"固定生命",FIGHT_PROP_DEFENSE_PERCENT:"防御百分比",FIGHT_PROP_DEFENSE:"固定防御",FIGHT_PROP_ELEMENT_MASTERY:"元素精通",FIGHT_PROP_CRITICAL:"暴击率",FIGHT_PROP_CRITICAL_HURT:"暴击伤害",FIGHT_PROP_CHARGE_EFFICIENCY:"元素充能效率",FIGHT_PROP_HEAL_ADD:"治疗加成",FIGHT_PROP_NONE:"无副属性",FIGHT_PROP_FIRE_ADD_HURT:"火元素伤害加成",FIGHT_PROP_WATER_ADD_HURT:"水元素伤害加成",FIGHT_PROP_ICE_ADD_HURT:"冰元素伤害加成",FIGHT_PROP_ELEC_ADD_HURT:"雷元素伤害加成",FIGHT_PROP_WIND_ADD_HURT:"风元素伤害加成",FIGHT_PROP_ROCK_ADD_HURT:"岩元素伤害加成",FIGHT_PROP_GRASS_ADD_HURT:"草元素伤害加成",FIGHT_PROP_PHYSICAL_ADD_HURT:"物理伤害加成",baseStat:"原始基础属性",levelCurve:"该等级成长系数",ascensionBonus:"该突破阶段固定提升",atk:"最终攻击力",hp:"最终生命值",def:"最终防御力",em:"元素精通",characterBaseAtk:"角色基础攻击力",weaponBaseAtk:"武器基础攻击力",weaponSecondary:"武器副属性",baseAtk:"基础攻击力",atkPercent:"攻击力百分比比例",flatAtk:"固定攻击力",baseHp:"角色基础生命",hpPercent:"生命百分比比例",flatHp:"固定生命",baseDef:"角色基础防御",defPercent:"防御百分比比例",flatDef:"固定防御",percentage:"百分数",critRate:"暴击率",critDamage:"暴击伤害增幅",coefficient:"天赋系数",baseMultiplier:"基础伤害倍率",scalingTerm:"已计算的缩放项",scaling:"天赋倍率",scalingValue:"用于缩放的面板数值",talentDamage:"天赋基础伤害",flatDamage:"附加基础伤害",baseDamage:"附加后基础伤害",damageBonus:"适用伤害加成",damageBonusMultiplier:"伤害加成乘数",afterBonus:"伤害加成后数值",defenseIgnore:"防御无视比例",defenseAdjustment:"有符号防御调整",characterLevel:"角色等级",enemyLevel:"敌人等级",defenseMultiplier:"防御乘数",afterDefense:"防御结算后伤害",resistance:"对应元素有效抗性",resistanceMultiplier:"抗性乘数",afterResistance:"抗性结算后伤害",elementalMastery:"元素精通",reactionBase:"增幅基础倍率",elementalMasteryBonus:"精通反应加成",reactionBonus:"反应专属加成",critMultiplier:"所选暴击乘数",afterCritical:"暴击分支结果",reactionMultiplier:"反应乘数",afterReaction:"反应后伤害",groupMultiplier:"独立伤害组倍率",nonCriticalDamage:"非暴击最终值",criticalDamage:"暴击最终值",preReactionDamage:"反应前且暴击前伤害",amplificationMultiplier:"该段假设增幅倍率",criticalMultiplier:"暴击乘数",expectedMultiplier:"期望暴击乘数",levelBaseDamage:"等级表精确基础值",preResistanceDamage:"抗性前伤害",additiveBaseDamage:"固定附加基础伤害",additiveReactionDamage:"激化附加基础伤害",incorrectDamage:"错误总值",correctDamage:"正确总值",formulaDamage:"公式伤害",potentialDamage:"潜在伤害",targetDamageMultiplier:"目标状态倍率",sourceValue:"贡献者数值"};
export function calculatorTraceText(key:string):string {
  if (Object.prototype.hasOwnProperty.call(WEAPON_HIT_STACK_TRACE_TEXT_ZH,key)) return WEAPON_HIT_STACK_TRACE_TEXT_ZH[key]!;
  if (Object.prototype.hasOwnProperty.call(NEFER_PHANTASM_TRACE_TEXT_ZH, key)) return NEFER_PHANTASM_TRACE_TEXT_ZH[key]!;
  if (Object.prototype.hasOwnProperty.call(OBSERVED_SPECIAL_COMPONENT_TRACE_TEXT_ZH, key)) return OBSERVED_SPECIAL_COMPONENT_TRACE_TEXT_ZH[key]!;
  if (Object.prototype.hasOwnProperty.call(ZIBAI_FINITE_TRACE_TEXT_ZH, key)) return ZIBAI_FINITE_TRACE_TEXT_ZH[key]!;
  if (Object.prototype.hasOwnProperty.call(PLAYER_SHIELD_TRACE_TEXT_ZH, key)) return PLAYER_SHIELD_TRACE_TEXT_ZH[key]!;
  const artifactRuntimeText:Record<string,string>={
    "stage.artifactEchoesFlat":"余响来歆加算基伤",
    "stage.artifactSongFlat":"昔时之歌加算基伤",
    "explain.artifactRuntimeFlat":"在本击暴击、增伤、防御、抗性与增幅反应乘区前加入普通加算基伤。余响使用本次实际回调的实时攻击力；昔时使用六秒记录窗口封存的治疗量。",
    "input.artifactLiveAttack":"命中回调时本人实时攻击力",
    "input.artifactRecordedHealing":"六秒窗口转换时封存的治疗量",
    "stage.artifactEchoesSuccess":"余响本次抽样是否成功",
    "explain.artifactEchoesSuccess":"固定源码在抽样值大于阈值时失败，因此成功条件为 roll ≤ p；表达式返回 1 表示成功、0 表示失败。此布尔值用于选择实际状态分支，不是伤害乘数。",
    "stage.artifactEchoesCooldown":"余响下一次可抽样帧",
    "explain.artifactEchoesCooldown":"成功与失败都把冷却到期帧设为本次抽样帧加 12。严格早于到期帧时不抽样；等于到期帧即可再次抽样。",
    "stage.artifactEchoesProbability":"余响下次抽样阈值",
    "explain.artifactEchoesProbability":"成功时重置为 0.36；失败时在原阈值上加 0.2。沿用固定源码不钳制到 1；阈值超过 1 时，下一次符合条件的命中仍抽样。",
    "stage.artifactEchoesExpiry":"余响来歆窗口到期帧",
    "explain.artifactEchoesExpiry":"本次成功抽样帧加 3。只有严格早于到期帧的后续命中沿用窗口，窗口内命中不延长到期帧，也不额外抽样。",
    "stage.artifactSongPool":"昔时共享治疗记录池",
    "explain.artifactSongPool":"原共享记录量加本次实际请求治疗量，再限制为至多 15000。请求量为治疗加成后、抵扣生命之契前的量，包含溢出和抵债部分。",
    "stage.artifactSongWindowStart":"本次治疗是否开始新的记录期",
    "explain.artifactSongWindowStart":"原记录期到期帧小于或等于实际治疗帧时返回 1，表示新增六秒转换任务；否则返回 0，沿用现有记录期。零请求治疗仍执行该判定。",
    "stage.artifactSongYearningExpiry":"昔时记录期到期帧",
    "explain.artifactSongYearningExpiry":"开始新记录期时取治疗帧加 360；否则保留原到期帧。这里不会取消已排队的旧转换任务，同帧先后由真实队列决定。",
    "stage.artifactSongSnapshot":"昔时转换时封存的治疗量",
    "explain.artifactSongSnapshot":"复制转换任务实际执行前的共享治疗池，覆盖此前浪潮的治疗快照；不读取当前生命、当前治疗加成或之后发生的治疗。",
    "stage.artifactSongPoolReset":"昔时封存后的记录池",
    "explain.artifactSongPoolReset":"封存完成后将共享记录池设为 0。该清零不会取消另一个已开始记录期的转换任务。",
    "stage.artifactSongWavesExpiry":"昔时浪潮到期帧",
    "explain.artifactSongWavesExpiry":"转换执行帧加 600，覆盖旧浪潮期限。只有严格早于该到期帧时，命中才可能消费浪潮次数。",
    "stage.artifactSongChargesReset":"昔时新浪潮的可用次数",
    "explain.artifactSongChargesReset":"每次实际转换将共享可用次数设为 5，而不是在旧次数上叠加；封存治疗量为零时仍建立这些次数。",
    "stage.artifactSongCharges":"昔时本次消费后的次数",
    "explain.artifactSongCharges":"每个符合来源条件的持有者回调将共享次数减 1。多个持有者的重复消费沿用固定源码，并按真实回调顺序逐次执行。",
    "stage.artifactSongWavesRemaining":"昔时消费后的窗口状态",
    "explain.artifactSongWavesRemaining":"消费后次数为 0 时，将浪潮到期字段设为 0，表示删除窗口；仍有次数时保留原到期帧，不延长持续时间。",
    "input.artifactEventFrame":"本次真实回调或转换任务执行的全局帧",
    "input.artifactRoll":"本次实际独立随机流抽样值",
    "input.artifactProbabilityBefore":"该持有者本次抽样前保存的概率阈值",
    "input.artifactSuccess":"本次抽样成功判定结果（1 成功，0 失败）",
    "input.artifactHealingPoolBefore":"本次回调前共享待封存治疗量",
    "input.artifactRequestedHealing":"实际治疗回调的请求量（治疗加成后、清契前）",
    "input.artifactYearningExpiryBefore":"本次回调前保存的记录期到期帧",
    "input.artifactStartsWindow":"本次是否建立新记录期（1 是，0 否）",
    "input.artifactChargesBefore":"本次持有者回调前的共享剩余次数",
    "input.artifactChargesAfter":"本次消费后的共享剩余次数",
    "input.artifactWavesExpiryBefore":"本次消费前保存的浪潮到期帧",
  };
  if(artifactRuntimeText[key])return artifactRuntimeText[key]!;
  const weakPointText:Record<string,string>={
    "stage.weakPointGuaranteedCritical":"明确弱点命中的必暴判定",
    "explain.weakPointGuaranteedCritical":"使用实际命中上下文的弱点标记：1代表来源规则保证暴击，0沿用普通暴击模式。保证暴击不会改写人物暴击率，也不消耗一次暴击随机抽样。",
    "explain.weakPointCriticalMultiplier":"先按明确弱点条件选择分支：命中弱点时使用1＋暴击伤害；否则使用所选模式的普通暴击乘数。面板暴击率保留原值，条件判断与乘数代入由同一表达式执行。",
    "input.hitWeakPoint":"本次实际命中是否明确为弱点命中（1是，0否）；不能从普通暴击结果反推。"
  };
  if(weakPointText[key])return weakPointText[key]!;
  const passiveInputs:Record<string,string>={"input.keqingA4Rate":"刻晴 A4 来源暴击率提升（15%）","input.keqingA4Unlocked":"刻晴是否已达到突破 4","input.keqingA4Included":"共享暴击率面板是否已包含刻晴 A4","input.keqingA4EnergyRecharge":"刻晴 A4 固定非转换充能提升（15%）","input.xingqiuA4Bonus":"行秋 A4 来源水伤提升（20%）","input.xingqiuA4Unlocked":"行秋是否已达到突破 4","input.xingqiuA4Included":"每段已填增伤是否包含行秋 A4","input.xingqiuSkillCoefficient":"该段有效 E 天赋等级对应的来源倍率","input.xingqiuC4Unlocked":"行秋是否已解锁 C4","input.xingqiuBurstActiveAtCast":"本次 E 起手构造攻击信息时 Q 是否有效","input.xingqiuC4Multiplier":"行秋 C4 对天赋缩放项的独立乘数（1.5）","input.xingqiuC2Reduction":"行秋 C2 来源水抗降低比例（15%）","input.xingqiuC2Active":"目标是否已有有效的行秋 C2 水减抗","input.xingqiuC2Included":"敌人抗性输入是否已经扣过行秋 C2"};
  Object.assign(passiveInputs,{"input.kukiSkillCoefficient":"久岐忍本段有效E天赋对应的ATK倍率","input.kukiA4Rate":"久岐忍A4伤害基数中的精通比例（25%）","input.kukiA4Unlocked":"是否达到突破4并解锁A4（已知未解锁为0）","input.kukiC6Em":"久岐忍C6来源精通提升量（150）","input.kukiC6Active":"本击实际C6精通状态是否有效","input.kukiC6Included":"共享输入精通已包含C6的150份额"});
  Object.assign(passiveInputs,{"input.keqingC4Rate":"刻晴C4攻击提升比例（25%基础攻击）","input.keqingC4Active":"该击快照时C4是否有效","input.keqingC4Included":"共享输入ATK是否已包含C4份额","input.keqingCharacterBaseAtk":"当前配装的角色基础攻击","input.keqingWeaponBaseAtk":"当前配装的武器基础攻击","input.keqingHistoricalBaseAtk":"该历史面板明确的基础攻击之和","input.keqingC6PerCategory":"C6每个独立动作类别的雷伤提升（6%）","input.keqingC6BurstActive":"本次Q起手刷新且覆盖十击的Q类别","input.keqingC6NormalActive":"该击C6普攻类别是否有效","input.keqingC6ChargedActive":"该击C6重击类别是否有效","input.keqingC6SkillActive":"该击C6初次战技类别是否有效","input.keqingC6IncludedStacks":"本击已填增伤包含的C6类别份数（0至4）"});
  if(passiveInputs[key])return passiveInputs[key]!;
  const occurrenceText:Record<string,string>={"stage.conditionedOccurrence":"已经触发的单击条件","explain.conditionedOccurrence":"本入口以追击已经出现为条件，计算它自己的非暴击、暴击和独立暴击期望；主击触发概率不属于这一个实际命中的伤害倍率。","stage.occurrenceProbability":"追击在整次输入中的触发概率","explain.occurrenceProbability":"来源规则要求主击暴击；使用主击经过角色与装备条件修正、并限制到 0–1 的真实暴击率。","stage.occurrenceNonCritical":"全非暴击输入的追击贡献","explain.occurrenceNonCritical":"主击不暴击，因此不会产生这次追击，整次非暴击贡献为零。","stage.occurrenceCritical":"全暴击输入的追击贡献","explain.occurrenceCritical":"全暴击分支包含主击触发和追击自身暴击；只加入一次追击暴击伤害。","stage.occurrenceExpected":"整次输入的追击期望贡献","explain.occurrenceExpected":"主击触发概率乘追击发生条件下的独立暴击期望。此数值是多次施放平均贡献，不是一次实际命中的伤害数字。","input.sourceCritRate":"触发主击实际限幅后的暴击率","input.triggerProbability":"本次追击出现的概率","input.conditionalExpectedDamage":"追击已触发条件下的自身期望伤害","input.yanfeiSeals":"本次重击消耗的有效丹火印数量","input.yanfeiA1Unlocked":"是否已解锁 A1（1 是，0 否）","input.yanfeiA1PerSeal":"A1 每印火元素伤害加成","input.yanfeiIncludedOldA1":"已包含于本段手动增伤的旧 A1 加成","input.yanfeiBrillianceActive":"本段灼灼增伤是否生效","input.yanfeiBrillianceBonus":"独立有效 Q 等级的灼灼重击增伤","input.yanfeiIncludedBrilliance":"已包含于本段手动增伤的灼灼加成","input.yanfeiEnemyHpFraction":"本段伤害前目标当前生命/生命上限","input.yanfeiC2Threshold":"C2 目标生命比例阈值（严格小于）","input.yanfeiC2Rate":"C2 重击条件暴击率提升"};
  if(occurrenceText[key])return occurrenceText[key]!;
  if(/^input\.yanfeiCharge[0-4]$/.test(key))return `${key.at(-1)} 印在当前有效普攻天赋等级的倍率`;
  const ittoInputs:Record<string,string>={"input.ittoBurstDefConversion":"独立有效 Q 等级对应的 DEF→ATK 转换系数","input.ittoBurstDefenseSnapshotNonExtra":"建立本次 Q 转换时的历史非 Extra DEF（不使用当前 DEF）","input.ittoA4DefCoefficient":"A4 总防御附加伤害比例","input.ittoActionDefenseSnapshotTotal":"本次重击动作起手完整 DEF（包含 Extra，独立于 Q 旧快照）","input.ittoC6CritDamage":"C6 重击暴击伤害提升"};
  if(ittoInputs[key])return ittoInputs[key]!;
  const attackTexts:Record<string,string>={"stage.sourceAttackAdjustment":"来源状态的固定攻击力转换","explain.sourceAttackAdjustment":"按角色来源式与明确输入执行本段攻击差值，例如历史防御转换，或C4基础攻击百分比与已含份额之差。只对来源指定的基础量运算，不从最终攻击反推基础，不把差值再乘攻击百分比。已含份额相同则不重复加入；实际输入与来源见该式。","stage.hitAttack":"本段实际攻击力","explain.hitAttack":"本段攻击力等于明确面板入口加尚未计入的来源固定攻击力。装备转换为最终面板时仍保留每段独立的来源记账方式；若手动或导入攻击力本已包含转换，选择已计入而不再追加。其他面板属性使用本次命中的当前输入。","input.panelAttack":"本段原有或已结算的最终攻击力","input.sourceAttack":"本段尚未计入的来源固定攻击力"};
  if(attackTexts[key])return attackTexts[key]!;
  if(key==="input.characterCritDamage")return "本段角色来源暴击伤害贡献";
  if(key==="input.characterCritRate")return "本段角色来源暴击率贡献";
  if(key==="stage.ordinaryEquipmentEffectsExcluded")return "普通装备命中效果不适用";
  if(key==="explain.ordinaryEquipmentEffectsExcluded")return "这些来源条款只为普通伤害命中定义；本类事件不执行装备基数附加或标签暴击属性。";
  const hitEquipmentInputs:Record<string,string>={manualAdditiveBaseDamage:"手动附加伤害基数",equipmentBaseAddition:"本项装备附加伤害基数",equipmentCriticalBonus:"本项适用的暴击属性提升"};
  if(key.startsWith("input.")&&hitEquipmentInputs[key.slice(6)])return hitEquipmentInputs[key.slice(6)]!;
  const masteryInputs:Record<string,string>={panelElementalMastery:"共享面板的元素精通",sourceElementalMastery:"本段来源状态的精通贡献",addToPanel:"是否额外加入面板（已含则0，未含则1）"};
  if(key.startsWith("input.")&&masteryInputs[key.slice(6)])return masteryInputs[key.slice(6)]!;
  const reactionInputs:Record<string,string>={equipmentReactionBonus:"本项装备反应加成",reactionEligible:"该条款是否适用于当前反应",manualReactionBonus:"手动额外反应加成",resistanceReduction:"来源敌方抗性降低比例",conditionActive:"显式效果条件是否有效",elementEligible:"该条款是否匹配当前伤害元素",enemyResistance:"来源减抗前的敌方抗性输入",totalResistanceReduction:"本段已生效的来源减抗合计",suppliedEffectiveResistance:"已结算的最终有效抗性"};
  if(key.startsWith("input.")&&reactionInputs[key.slice(6)])return reactionInputs[key.slice(6)]!;
  if(key==="input.equipmentAndManualDamageBonus")return "已结算的装备与手动追加增伤";
  if(key==="input.formulaDamageBonus")return "来源被动公式产生的伤害加成";
  if(SPECIAL_TRACE_TEXT_ZH[key]) return SPECIAL_TRACE_TEXT_ZH[key];
  if(key.startsWith("stage.prePanel.")) return `固定属性快照：${inputs[key.slice(15)]??key.slice(15)}`;
  if(key.startsWith("stage.preConversion.")) return `转换前属性快照：${inputs[key.slice(20)]??key.slice(20)}`;
  if(key.startsWith("explain.prePanel.")||key.startsWith("explain.preConversion.")) return "按当前固定来源与已应用的前置效果，计算供后续有序公式读取的属性；转换后的属性不会回写这个快照。";
  if(key.startsWith("stage.source.")) return `来源贡献合计：${inputs[key.slice(13)]??key.slice(13)}`;
  if(key.startsWith("stage.manual.")) return `手动调整：${inputs[key.slice(13)]??key.slice(13)}`;
  if(key.startsWith("stage.resolved.")) return `最终属性输入：${inputs[key.slice(15)]??key.slice(15)}`;
  if(key.startsWith("stage.equipment.")) return `等级与突破推导：${inputs[key.slice(16)]??key.slice(16)}`;
  if(key==="explain.equipmentStat") return "原始基础属性乘精确等级成长系数，再加入对应突破阶段的固定提升；没有插值或隐藏装备加算。";
  if(key.startsWith("stage.supplied.")) return `最终面板输入：${inputs[key.slice(15)]??key.slice(15)}`;
  if(key.startsWith("explain.supplied.")) return "直接使用已提供的最终面板，之前的装备或永久增益分解未知且不会再次添加。";
  if(key.startsWith("stage.blocked")) return "依赖未满足";
  if(key.startsWith("explain.blocked")) return "缺失的相关依赖阻止此计算；详见阻塞原因。";
  if(key.startsWith("stage.excludedModifier")) return "不适用的修正项";
  if(key.startsWith("explain.excludedModifier")) return "此修正项不符合当前伤害的作用范围，原因见下方。";
  if(key.startsWith("stage.")) return stages[key.slice(6)]??traceText(key);
  if(key.startsWith("explain.")) return explanations[key.slice(8)]??traceText(key);
  if(key.startsWith("input.")) return inputs[key.slice(6)]??key.slice(6);
  return inputs[key]??traceText(key);
}
