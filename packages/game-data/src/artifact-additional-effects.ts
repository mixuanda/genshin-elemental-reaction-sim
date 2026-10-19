import type { FormulaExpression } from "../../sim-core/src/calculation-trace";
import { requireEquipmentArtifactSet, type EquipmentDataset } from "./equipment-dataset";
import { equipmentDescriptionSource } from "./equipment-source";
import type { ArtifactConditionalContext, ArtifactConditionalControl } from "./artifact-conditional-effects";
import type { EquipmentFormulaResolution, EquipmentFormulaInput, EquipmentStatModifier, EquipmentDynamicHitBonus } from "./equipment-formulas";
import type { EquipmentEffectElement } from "./equipment-effects";
import type { EquipmentReactionBonus } from "./artifact-reaction-effects";
import evidence from "../sources/artifact-additional-effects/manifest.json";

/** Source-reviewed four-piece clauses; entries may retain separately listed unimplemented clauses. */
export const SUPPORTED_ARTIFACT_ADDITIONAL_IDS = evidence.records.map(record => record.id);
export const SUPPORTED_ARTIFACT_ADDITIONAL_REACTION_IDS = ["artifact-set:15046"] as const;
export const hasArtifactAdditionalRule = (id: string): boolean => SUPPORTED_ARTIFACT_ADDITIONAL_IDS.includes(id);
export const artifactAdditionalSourceEvidence = evidence;

export function getArtifactAdditionalControls(pieceCounts: Readonly<Record<string, number>>, dataset?: EquipmentDataset): ArtifactConditionalControl[] {
  const controls: ArtifactConditionalControl[] = [];
  const bool = (key: keyof ArtifactConditionalContext, label: string) => controls.push({ key, label, kind: "boolean" });
  const num = (key: keyof ArtifactConditionalContext, label: string, min: number, max?: number) => controls.push({ key, label, kind: "number", min, ...(max === undefined ? {} : { max }) });
  const active = (label: string) => bool("setEffectActive", label);
  const elements = (key: "setBuffElements" | "setExtraBuffElements", label: string) => controls.push({ key, label, kind: "elements" });
  for (const [id, count] of Object.entries(pieceCounts)) {
    if (count < 4 || !hasArtifactAdditionalRule(id)) continue;
    const slug = requireEquipmentArtifactSet(id, dataset).slug;
    switch (slug) {
      case "berserker": num("hpFraction", "战狂当前生命比例（恰好70%存在来源冲突）", 0, 1); break;
      case "braveheart": num("enemyHpFraction", "勇士目标当前生命比例", 0, 1); break;
      case "bloodstainedchivalry": active("染血装备者前台击杀后10秒增伤仍有效"); break;
      case "martialartist": active("武人装备者战技后8秒增伤仍有效"); break;
      case "noblesseoblige": active("宗室12秒攻击效果已对本次命中生效（含快照先后）"); break;
      case "instructor": active("教官装备者前台亲自反应后8秒精通仍有效"); break;
      case "lavawalker": case "thundersoother": break; // Uses the existing explicit pre-hit aura input.
      case "retracingbolide": bool("shielded", "逆飞装备者在本次命中时实际受到护盾庇护"); break;
      case "desertpavilionchronicle": active("沙楼重击命中后15秒攻击增伤仍有效"); break;
      case "fragmentofharmonicwhimsy": num("setStacks", "谐律6秒内有效生命之契变化层数", 0, 3); break;
      case "longnightsoath": num("setStacks", "长夜当前仍有效的独立6秒层数", 0, 5); break;
      case "unfinishedreverie": num("setStacks", "遐思当前有效增伤档数（每档10%，不是燃烧秒数）", 0, 5); break;
      case "nighttimewhispersintheechoingwoods": active("回声之林战技后10秒岩伤效果仍有效"); bool("setExtraEffectActive", "结晶盾/月笼条件或退出后1秒延续仍有效"); break;
      case "gildeddreams": active("饰金装备者反应后8秒效果仍有效"); num("sameElementTeammates", "其他同元素队友人数（不含装备者）", 0, 3); num("differentElementTeammates", "其他异元素队友人数（不含装备者）", 0, 3); break;
      case "obsidiancodex": active("黑曜前台合法消耗至少1夜魂值后的6秒暴击窗口仍有效"); break;
      case "finaleofthedeepgalleries": bool("setNormalEffectActive", "深廊普攻资格成立（能量恰为0且普攻6秒封锁已结束）"); bool("setBurstEffectActive", "深廊爆发资格成立（能量恰为0且爆发6秒封锁已结束）"); break;
      case "archaicpetra": elements("setBuffElements", "磐岩当前合法10秒增益的唯一元素（空集合=无；仅火水冰雷）"); break;
      case "scrolloftheheroofcindercity": elements("setBuffElements", "烬城12%增益仍在15秒内的元素（空集合=无）"); elements("setExtraBuffElements", "烬城夜魂28%增益仍在20秒内的元素（可独立于12%存在）"); break;
      case "adaycarvedfromrisingwinds": active("风起之日命中后6秒风与牧歌效果仍有效"); bool("witchLessonsCompleted", "装备者已完成魔女的课业"); break;
      case "celestialgift": active("天赐由装备者合法战技触发的20秒窗口仍有效"); bool("witchLessonsCompleted", "装备者已完成魔女的课业"); bool("setExtraEffectActive", "队伍魔导·秘仪成立"); elements("setBuffElements", "天赐当前有效元素（装备者；秘仪时另含当前前台，去重）"); break;
      case "nightoftheskysunveiling": active("穹境装备者前台获得的4秒蓄念暴击仍有效"); num("moonsignLevel", "触发时月兆：0无、1初辉、2满辉", 0, 2); break;
      case "silkenmoonsserenade": active("纺月装备者元素伤害触发的8秒崇信精通仍有效"); num("moonsignLevel", "触发时月兆：0无、1初辉、2满辉", 0, 2); break;
      case "scarletproof": active("血红装备者星扩散后10秒条件暴击仍有效"); break;
      case "heartofthefurnace": active("炉火装备者星烁触发/伤害后12秒攻击增益仍有效"); break;
      case "tenacityofthemillelith": active("千岩装备者战技命中后3秒攻击增益仍有效"); break;
    }
  }
  return controls;
}

const v = (key: string): FormulaExpression => ({ kind: "variable", key });
const c = (value: number): FormulaExpression => ({ kind: "constant", value });
const mul = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "multiply", terms });
const add = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "add", terms });
const choose = (operator: "lt" | "equal", left: FormulaExpression, right: FormulaExpression, whenTrue: FormulaExpression, whenFalse: FormulaExpression): FormulaExpression => ({ kind: "condition", operator, left, right, whenTrue, whenFalse });
const term = (key: string, value: number, meaningKey: string, unit = "ratio"): EquipmentFormulaInput => ({ key, value, meaningKey, unit, origin: "artifact-conditioned-source" });
const elementTypes: EquipmentEffectElement[] = ["pyro", "hydro", "cryo", "electro", "anemo", "geo", "dendro"];

/** The wearer receives the explicit active snapshot; no automatic team trigger, ownership or duration is inferred. */
export function resolveArtifactAdditionalEffects(args: { setId: string; pieces: number; enabled: boolean; context?: ArtifactConditionalContext; dataset?: EquipmentDataset }): EquipmentFormulaResolution & { reactionBonuses: EquipmentReactionBonus[] } {
  const result: EquipmentFormulaResolution & { reactionBonuses: EquipmentReactionBonus[] } = { statModifiers: [], dynamicHitBonuses: [], reactionBonuses: [], assumptions: [], effectBlockers: [], missingConditions: [], sourceRefs: [], verification: "provisional" };
  if (!args.enabled || args.pieces < 4) return result;
  const set = requireEquipmentArtifactSet(args.setId, args.dataset);
  const record = evidence.records.find(entry => entry.id === args.setId);
  if (!record) throw new Error(`没有套装 ${args.setId} 的已审阅条件规则。`);
  if (set.pieceEffects.find(effect => effect.pieces === 4)?.description !== record.fourPieceDescription) throw new Error(`${set.name}四件套来源文案改变，必须重新审阅。`);
  const refs = [equipmentDescriptionSource("artifacts", set.slug, args.dataset), ...record.sourcePaths];
  result.sourceRefs.push(...refs);
  result.assumptions.push(`${set.name}：只恢复当前装备者已确认有效的四件套状态；二件套另计一次。触发归属、前后台资格、持续时间、冷却和团队传播没有由本模块自动生成，不能据此证明循环覆盖率。`);
  const context = args.context ?? {};
  const missing = (key: string) => {
    const reason = `${set.name}缺少或冲突的显式条件 ${key}，不能猜测生效。`;
    result.effectBlockers.push(reason);
    // Pure hit bonuses retain their precise dependency; stat-changing clauses stay global.
    const filters: Record<string, Pick<EquipmentDynamicHitBonus, "elements" | "attackTags">> = {
      braveheart: {}, lavawalker: {}, thundersoother: {}, fragmentofharmonicwhimsy: {}, unfinishedreverie: {},
      bloodstainedchivalry: { attackTags: ["charged"] }, martialartist: { attackTags: ["normal", "charged"] },
      desertpavilionchronicle: { attackTags: ["normal", "charged", "plunge"] }, retracingbolide: { attackTags: ["normal", "charged"] },
      longnightsoath: { attackTags: ["plunge"] }, nighttimewhispersintheechoingwoods: { elements: ["geo"] },
      archaicpetra: { elements: ["pyro", "hydro", "cryo", "electro"] },
      scrolloftheheroofcindercity: { elements: elementTypes }, celestialgift: { elements: elementTypes }
    };
    const filter = set.slug === "finaleofthedeepgalleries"
      ? { attackTags: [key === "setNormalEffectActive" ? "normal" : "burst"] as NonNullable<EquipmentDynamicHitBonus["attackTags"]> }
      : filters[set.slug];
    if (filter) (result.pendingHitEffects ??= []).push({ id: `${set.id}:4pc:pending:${key}`, label: set.name, reason, sourceRefs: refs, kind: "damageBonus", ...filter });
    else result.missingConditions.push(reason);
  };
  const bool = (key: keyof ArtifactConditionalContext): boolean | undefined => {
    const value = context[key];
    if (value === undefined) { missing(key); return undefined; }
    if (typeof value !== "boolean") throw new Error(`${key}必须是显式布尔值。`);
    return value;
  };
  const number = (key: keyof ArtifactConditionalContext, max: number, integer = true): number | undefined => {
    const value = context[key];
    if (value === undefined) { missing(key); return undefined; }
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value))) throw new Error(`${key}必须为0–${max}${integer ? "整数" : "有限比例"}。`);
    return value;
  };
  const elements = (key: "setBuffElements" | "setExtraBuffElements", allowed = elementTypes, max = 7): EquipmentEffectElement[] | undefined => {
    const list = context[key];
    if (list === undefined) { missing(key); return undefined; }
    if (list.length > max || new Set(list).size !== list.length || list.some(element => !allowed.includes(element))) throw new Error(`${set.name}的${key}须为最多${max}个不同合法元素；不能把物理或重复项当元素增益。`);
    return list;
  };
  const stat = (suffix: string, target: EquipmentStatModifier["target"], expression: FormulaExpression, inputs: EquipmentFormulaInput[]) => result.statModifiers.push({ id: `${set.id}:4pc:${suffix}`, label: `${set.name}·${suffix}`, target, phase: "pre-panel", expression, inputs, sourceRefs: refs });
  const hit = (suffix: string, expression: FormulaExpression, inputs: EquipmentFormulaInput[], filters: Pick<EquipmentDynamicHitBonus, "elements" | "attackTags"> = {}) => result.dynamicHitBonuses.push({ id: `${set.id}:4pc:${suffix}`, label: `${set.name}·${suffix}`, expression, inputs, sourceRefs: refs, inputPolicy: "pre-conversion", ...filters });
  const windowInputs = (active: boolean, value: number, unit = "ratio") => [term("windowActive", Number(active), "对应命中前窗口已合法生效", "boolean"), term("bonus", value, "固定来源加成", unit)];
  const activeStat = (suffix: string, target: EquipmentStatModifier["target"], value: number) => { const active = bool("setEffectActive"); if (active !== undefined) stat(suffix, target, mul(v("windowActive"), v("bonus")), windowInputs(active, value, target === "em" ? "EM" : "ratio")); };
  switch (set.slug) {
    case "berserker": {
      const hp = number("hpFraction", 1, false);
      if (hp === 0.7) missing("生命恰好70%：目录要求<70%，固定gcsim执行<=70%，边界尚待游戏内验证");
      else if (hp !== undefined) stat("低血量暴击", "critRate", choose("lt", v("hpFraction"), v("threshold"), v("bonus"), c(0)), [term("hpFraction", hp, "命中前当前生命比例"), term("threshold", 0.7, "目录低生命门槛"), term("bonus", 0.24, "四件套额外暴击率")]);
      break;
    }
    case "braveheart": {
      const hp = number("enemyHpFraction", 1, false);
      if (hp !== undefined) hit("目标高生命增伤", choose("lt", v("threshold"), v("enemyHpFraction"), v("bonus"), c(0)), [term("enemyHpFraction", hp, "当前命中目标生命比例"), term("threshold", 0.5, "严格大于50%"), term("bonus", 0.3, "高生命目标增伤")]);
      break;
    }
    case "bloodstainedchivalry": case "martialartist": case "desertpavilionchronicle": {
      const active = bool("setEffectActive"), blood = set.slug === "bloodstainedchivalry", desert = set.slug === "desertpavilionchronicle";
      if (active !== undefined) hit("触发窗口攻击增伤", mul(v("windowActive"), v("bonus")), windowInputs(active, blood ? 0.5 : desert ? 0.4 : 0.25), { attackTags: blood ? ["charged"] : desert ? ["normal", "charged", "plunge"] : ["normal", "charged"] });
      if (blood) result.effectBlockers.push("染血免重击体力消耗尚未进入体力/动作调度，只执行重击增伤。");
      if (desert) result.effectBlockers.push("沙楼10%普通攻击速度尚未进入动作帧调度，只执行符合标签的伤害加成。");
      break;
    }
    case "noblesseoblige": activeStat("12秒攻击增益", "atkPercent", 0.2); result.assumptions.push("宗室同名攻击增益只恢复一次；特定自身爆发的1帧延迟/快照例外未自动判定，必须按本次技能实际快照时点确认窗口。"); break;
    case "instructor": activeStat("8秒精通增益", "em", 120); break;
    case "lavawalker": case "thundersoother": {
      if (context.enemyAuras === undefined) { missing("enemyAuras（命中前目标附着）"); break; }
      const element = set.slug === "lavawalker" ? "pyro" : "electro";
      hit("目标附着增伤", mul(v("targetAffected"), v("bonus")), [term("targetAffected", Number(context.enemyAuras.includes(element)), `目标命中前是否受${element}附着`, "boolean"), term("bonus", 0.35, "对应附着目标增伤")]);
      break;
    }
    case "retracingbolide": {
      const shielded = bool("shielded");
      if (shielded !== undefined) hit("实际护盾庇护增伤", mul(v("protected"), v("bonus")), [term("protected", Number(shielded), "攻击者本人此刻实际受盾保护，非仅队伍有盾", "boolean"), term("bonus", 0.4, "普通攻击与重击加成")], { attackTags: ["normal", "charged"] });
      break;
    }
    case "fragmentofharmonicwhimsy": case "longnightsoath": case "unfinishedreverie": {
      const fragment = set.slug === "fragmentofharmonicwhimsy", longnight = set.slug === "longnightsoath";
      const stacks = number("setStacks", fragment ? 3 : 5);
      if (stacks !== undefined) hit("当前有效叠层增伤", mul(v("stacks"), v("perStack")), [term("stacks", stacks, "命中前仍有效层数/档数", "count"), term("perStack", fragment ? 0.18 : longnight ? 0.15 : 0.1, "每层固定伤害加成")], longnight ? { attackTags: ["plunge"] } : {});
      if (set.slug === "unfinishedreverie") result.assumptions.push("遐思输入0–5个有效10%档位，不由燃烧秒数推导；固定实现的周期取样/严格帧边界与文案每秒变化存在差别，时序未声称验证。");
      break;
    }
    case "nighttimewhispersintheechoingwoods": {
      const active = bool("setEffectActive");
      if (active === false) hit("岩伤窗口未生效", c(0), [], { elements: ["geo"] });
      else if (active) {
        const extra = bool("setExtraEffectActive");
        if (extra !== undefined) hit("岩伤与结晶条件", mul(v("baseBonus"), add(c(1), mul(v("extraActive"), v("relativeIncrease")))), [term("baseBonus", 0.2, "战技后岩伤加成"), term("extraActive", Number(extra), "结晶盾/月笼或退出后1秒延续有效", "boolean"), term("relativeIncrease", 1.5, "额外相对提高150%")], { elements: ["geo"] });
      }
      break;
    }
    case "gildeddreams": {
      const active = bool("setEffectActive");
      if (active === false) { stat("饰金窗口未生效", "atkPercent", c(0), []); break; }
      if (active === undefined) break;
      const same = number("sameElementTeammates", 3), different = number("differentElementTeammates", 3);
      if (same === undefined || different === undefined) break;
      if (same + different > 3) throw new Error("饰金不含装备者的其他队友总数不能超过3；不能把人数缺失补成满队。");
      stat("同元素队友攻击", "atkPercent", mul(v("teammates"), v("perTeammate")), [term("teammates", same, "其他同元素队友人数", "count"), term("perTeammate", 0.14, "每位同元素队友攻击百分比")]);
      stat("异元素队友精通", "em", mul(v("teammates"), v("perTeammate")), [term("teammates", different, "其他异元素队友人数", "count"), term("perTeammate", 50, "每位异元素队友精通", "EM")]); break;
    }
    case "obsidiancodex": activeStat("6秒夜魂消耗暴击窗口", "critRate", 0.4); result.assumptions.push("黑曜四件套窗口与二件套当前夜魂且前台条件独立；已触发暴击窗口不因当前离开夜魂状态被自动清除。"); break;
    case "finaleofthedeepgalleries": {
      for (const [key, tag] of [["setNormalEffectActive", "normal"], ["setBurstEffectActive", "burst"]] as const) {
        const active = bool(key);
        if (active !== undefined) hit(`${tag}独立资格增伤`, mul(v("eligible"), v("bonus")), [term("eligible", Number(active), "当前能量恰为0且该标签6秒封锁已结束", "boolean"), term("bonus", 0.6, "深廊对应标签增伤")], { attackTags: [tag] });
      }
      result.assumptions.push("深廊两个资格分别包含同一当前能量=0前提；另一类命中后的6秒封锁事件未自动生成，不能由一个普通窗口替代两个资格。"); break;
    }
    case "archaicpetra": {
      const selected = elements("setBuffElements", ["pyro", "hydro", "cryo", "electro"], 1);
      if (selected?.length) hit("当前唯一元素增伤", v("bonus"), [term("bonus", 0.35, "合法拾晶/月结晶后的对应元素增伤")], { elements: selected });
      result.assumptions.push("磐岩只恢复一个仍有效元素，不能叠加多种晶片。同名窗口与拾取/反应归属必须已确认；月结晶在固定参考中对应水增伤，不能推为岩伤，参考回调归属限制不足以证明自动触发。"); break;
    }
    case "scrolloftheheroofcindercity": {
      for (const [key, value, label] of [["setBuffElements", 0.12, "15秒基础窗口"], ["setExtraBuffElements", 0.28, "20秒夜魂额外窗口"]] as const) {
        const selected = elements(key);
        if (selected?.length) hit(label, v("bonus"), [term("bonus", value, label)], { elements: selected });
      }
      result.assumptions.push("烬城两组元素为已合法触发且当前仍有效的独立窗口；可有28%单独尾段，同元素两组同时有效才合计40%。同名套装各组每元素只恢复一次；没有自动生成团队/反应关联或再次叠加。"); break;
    }
    case "adaycarvedfromrisingwinds": {
      const active = bool("setEffectActive");
      if (active !== undefined) stat("风与牧歌攻击", "atkPercent", mul(v("windowActive"), v("bonus")), windowInputs(active, 0.25));
      if (active) { const witch = bool("witchLessonsCompleted"); if (witch !== undefined) stat("通过课业的条件暴击", "critRate", mul(v("qualified"), v("bonus")), [term("qualified", Number(witch), "装备者完成魔女课业", "boolean"), term("bonus", 0.2, "决意额外暴击率")]); }
      break;
    }
    case "celestialgift": {
      const active = bool("setEffectActive");
      if (!active) break;
      const witch = bool("witchLessonsCompleted");
      if (!witch) { if (witch === false) result.assumptions.push("天赐装备者未完成魔女课业，不获得四件套增益。"); break; }
      const secret = bool("setExtraEffectActive");
      if (secret === undefined) break;
      const selected = elements("setBuffElements", elementTypes, secret ? 2 : 1);
      if (selected?.length) hit("当前有效元素天光增伤", choose("equal", v("secretRite"), c(1), v("greaterBonus"), v("lesserBonus")), [term("secretRite", Number(secret), "队伍魔导秘仪成立", "boolean"), term("greaterBonus", 0.4, "秘仪单元素加成"), term("lesserBonus", 0.2, "基础单元素加成")], { elements: selected });
      result.assumptions.push("天赐所选元素须为装备者元素、以及秘仪时当前前台角色元素，按角色元素而非伤害染色判断；相同元素仅一次，不得叠为80%。只恢复当前受益者窗口，换人重建和同名多持有者去重调度未执行。"); break;
    }
    case "nightoftheskysunveiling": case "silkenmoonsserenade": {
      const active = bool("setEffectActive"), sky = set.slug === "nightoftheskysunveiling";
      if (active === false) stat("月辉窗口未生效", sky ? "critRate" : "em", c(0), []);
      else if (active) {
        const level = number("moonsignLevel", 2);
        if (level !== undefined) stat("月兆条件属性", sky ? "critRate" : "em", choose("equal", v("moonsign"), c(0), c(0), choose("equal", v("moonsign"), c(1), v("nascentBonus"), v("ascendantBonus"))), [term("moonsign", level, "该效果触发时月兆0无/1初辉/2满辉", "count"), term("nascentBonus", sky ? 0.15 : 60, "初辉属性", sky ? "ratio" : "EM"), term("ascendantBonus", sky ? 0.3 : 120, "满辉属性", sky ? "ratio" : "EM")]);
      }
      result.effectBlockers.push(`本属性入口只恢复${set.name}已声明的暴击/精通窗口，不执行团队月曜10%反应加成；月曜参考模拟可按真实事件处理两种月辉窗口、同名去重及特殊命中恢复，不计为普通增伤。`); break;
    }
    case "scarletproof": activeStat("星扩散后条件暴击", "critRate", 0.16); result.effectBlockers.push("本属性入口不执行血红之证星扩散40%反应奖励；可在星辉参考模拟中明确声明四件套并从实际事件恢复特殊命中，不计为普通扩散或普通伤害加成。"); break;
    case "heartofthefurnace": activeStat("星辉触发窗口攻击", "atkPercent", 0.12); result.effectBlockers.push("本属性入口不执行炉火全队星辉50%反应奖励；星辉参考模拟的四件套模型按实际事件处理窗口及同名去重，不计为普通伤害加成。"); break;
    case "tenacityofthemillelith": activeStat("3秒团队攻击窗口", "atkPercent", 0.2); result.effectBlockers.push("千岩护盾强效30%尚未进入护盾承伤结算；只恢复当前装备者收到的单份攻击窗口，未自动传播给队友。"); break;
    case "disenchantmentindeepshadow":
      result.reactionBonuses.push({ id: `${set.id}:4pc:classic-superconduct`, label: `${set.name}·经典超导反应系数`, value: 0.8, reactions: ["superconduct"], sourceRefs: refs });
      result.effectBlockers.push("影中沉凝星超导40%与特殊月反应回调尚未接入特殊反应装备协议；普通超导目标的逐命中16%暴击率由独立条件条款恢复，不能写入全局面板或套给特殊反应。"); break;
  }
  return result;
}
