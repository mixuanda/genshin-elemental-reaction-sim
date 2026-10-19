import type { FormulaExpression } from "../../sim-core/src/calculation-trace";
import { equipmentCatalog, type EquipmentDataset } from "./equipment-dataset";
import { equipmentDescriptionSource } from "./equipment-source";
import type { EquipmentFormulaContext, EquipmentFormulaResolution, EquipmentFormulaInput, EquipmentStatModifier, EquipmentDynamicHitBonus } from "./equipment-formulas";
import type { EquipmentReactionBonus } from "./artifact-reaction-effects";
import reviewedCatalog from "../sources/weapon-polearm-effects/reviewed-catalog.json";
import sourceManifest from "../sources/weapon-polearm-effects/manifest.json";

export interface EquipmentPolearmContext extends EquipmentFormulaContext {
  targetIsSlime?: boolean;
  teamDistinctElementCount?: number;
  bondOfLifeRatio?: number;
  witchLessonsCompleted?: boolean;
}
export interface WeaponPolearmControl { key: keyof EquipmentPolearmContext; label: string; kind: "number" | "boolean"; min?: number; max?: number }
export const SUPPORTED_WEAPON_POLEARM_IDS = reviewedCatalog.map(rule => rule.id);
export const hasWeaponPolearmRule = (id: string): boolean => SUPPORTED_WEAPON_POLEARM_IDS.includes(id);
export const weaponPolearmSourceEvidence = sourceManifest.files;
const windowLabels: Record<string, string> = {
  bloodsoakedruins: "血染荒城：本装备者触发月感电后6秒暴伤效果仍有效",
  fracturedhalo: "支离轮光：本装备者战技/爆发后20秒攻击效果仍有效",
  moonpiercer: "贯月矢：本装备者已拾取苏生之叶，12秒攻击效果仍有效（不是只生成叶子）",
  mountainbracingbolt: "镇山之钉：附近其他角色战技后8秒额外战技增伤仍有效",
  symphonistofscents: "香韵奏者：本装备者发起治疗后的3秒甘美回奏仍有效",
  tamayurateinoohanashi: "且住亭御咄：本装备者战技后10秒攻击效果仍有效",
  frostbreath: "寒息：合法冰/水相关反应触发后的15秒攻击效果仍有效",
  songofthevigil: "戍望谣歌：本装备者触发星烁反应后的12秒攻击效果仍有效"
};
export function getWeaponPolearmControls({ weaponId }: { weaponId: string }): WeaponPolearmControl[] {
  const rule = reviewedCatalog.find(entry => entry.id === weaponId);
  if (!rule) return [];
  const list: WeaponPolearmControl[] = [];
  if (windowLabels[rule.slug]) list.push({ key: "weaponEffectActive", label: windowLabels[rule.slug]!, kind: "boolean" });
  if (rule.slug === "blacktassel") list.push({ key: "targetIsSlime", label: "黑缨枪：当前伤害目标是史莱姆类敌人", kind: "boolean" });
  if (rule.slug === "balladofthefjords") list.push({ key: "teamDistinctElementCount", label: "峡湾长歌：队伍中不同元素类型数（含自身）", kind: "number", min: 1, max: 4 });
  if (rule.slug === "crimsonmoonssemblance") list.push({ key: "bondOfLifeRatio", label: "赤月之形：本击结算时生命之契 / 当前生命上限（不是生命比例）", kind: "number", min: 0, max: 2 });
  if (rule.slug === "lumidouceelegy") list.push({ key: "weaponStacks", label: "柔灯挽歌：本击前仍有效的8秒增伤层数", kind: "number", min: 0, max: 2 });
  if (rule.slug === "prospectorsdrill") list.push({ key: "weaponStacks", label: "勘探钻机：当前10秒抗争效果已消耗的标记数（不是待消耗标记）", kind: "number", min: 0, max: 3 });
  if (rule.slug === "sacrificersstaff") list.push({ key: "weaponStacks", label: "圣祭者辉杖：本击前已确认仍有效的战技命中层数（不自动判断5/6秒冲突）", kind: "number", min: 0, max: 3 });
  if (rule.slug === "symphonistofscents") list.push({ key: "offField", label: "香韵奏者：本击取样时装备者位于后台", kind: "boolean" });
  if (rule.slug === "disasterandremorse") list.push(
    { key: "normalHitEffectActive", label: "灾悔：本击前「无赦」普攻/重击增伤窗口仍有效", kind: "boolean" },
    { key: "skillBurstHitEffectActive", label: "灾悔：本击前「无愈」战技/爆发增伤窗口仍有效", kind: "boolean" },
    { key: "witchLessonsCompleted", label: "灾悔：队伍已满足魔导·秘仪（至少两名魔导角色）", kind: "boolean" });
  return list;
}
const c = (value: number): FormulaExpression => ({ kind: "constant", value });
const v = (key: string): FormulaExpression => ({ kind: "variable", key });
const mul = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "multiply", terms });
const add = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "add", terms });
const choose = (operator: "lt" | "lte" | "equal", left: FormulaExpression, right: FormulaExpression, whenTrue: FormulaExpression, whenFalse: FormulaExpression): FormulaExpression => ({ kind: "condition", operator, left, right, whenTrue, whenFalse });
const term = (key: string, value: number, meaningKey: string, origin: string, unit = "ratio"): EquipmentFormulaInput => ({ key, value, meaningKey, origin, unit });
const source = (key: string, value: number, meaningKey: string, unit = "ratio") => term(key, value, meaningKey, "weapon-fixed-source", unit);
const state = (key: string, value: number, meaningKey: string, unit = "ratio") => term(key, value, meaningKey, "weapon-explicit-context", unit);
const elemental = ["pyro", "hydro", "cryo", "electro", "anemo", "geo", "dendro"] as const;
export function resolveWeaponPolearmEffects(args: { weaponId: string; refinement: number; enabled: boolean; context?: EquipmentPolearmContext; dataset?: EquipmentDataset }): EquipmentFormulaResolution & { reactionBonuses: EquipmentReactionBonus[] } {
  const result: EquipmentFormulaResolution & { reactionBonuses: EquipmentReactionBonus[] } = { statModifiers: [], dynamicHitBonuses: [], reactionBonuses: [], assumptions: [], effectBlockers: [], missingConditions: [], sourceRefs: [], verification: "provisional" };
  const weapon = equipmentCatalog(args.dataset).weapons.find(entry => entry.id === args.weaponId);
  const rule = reviewedCatalog.find(entry => entry.id === args.weaponId);
  if (!weapon || !rule) throw new Error(`未登记长柄武器条件规则 ${args.weaponId}。`);
  const rank = weapon.refinements.find(entry => entry.rank === args.refinement), fixedRank = rule.refinements.find(entry => entry.rank === args.refinement);
  if (!rank || !fixedRank || !Number.isInteger(args.refinement)) throw new Error(`${weapon.name}没有该精炼来源。`);
  if (weapon.slug !== rule.slug || rank.description !== fixedRank.description || JSON.stringify(rank.values) !== JSON.stringify(fixedRank.values)) throw new Error(`${weapon.name}来源条款已改变，须重新核验。`);
  if (!args.enabled) { result.assumptions.push(`${weapon.name}条件效果已明确停用。`); return result; }
  const context = args.context ?? {}, refs = [equipmentDescriptionSource("weapons", weapon.slug, args.dataset), ...rule.sourceRefs.slice(1)], prefix = `${weapon.id}:r${args.refinement}`;
  result.sourceRefs.push(...refs);
  result.assumptions.push(`${weapon.name}仅恢复本击前明确有效的条件快照；未生成触发、层数、叶子、护盾、治疗、能量或计时事件。数值来源经过目录与固定实现交叉核对，仍为provisional。`);
  const need = <K extends keyof EquipmentPolearmContext>(key: K): EquipmentPolearmContext[K] => {
    if (context[key] === undefined) { const reason = `${weapon.name}缺少显式 ${key}；未知不等于未触发。`; result.missingConditions.push(reason); result.effectBlockers.push(reason); }
    return context[key];
  };
  const bool = (key: keyof EquipmentPolearmContext): boolean | undefined => {
    const value = need(key); if (value !== undefined && typeof value !== "boolean") throw new Error(`${key}必须是显式布尔值。`); return value as boolean | undefined;
  };
  const number = (key: keyof EquipmentPolearmContext, min: number, max: number, integer = true): number | undefined => {
    const value = need(key); if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))) throw new Error(`${key}必须为${min}–${max}的${integer ? "整数" : "数值"}。`); return value as number | undefined;
  };
  const pct = (i: number) => Number(rank.values[i]!.replace("%", "")) / 100;
  const stat = (label: string, target: EquipmentStatModifier["target"], expression: FormulaExpression, inputs: EquipmentFormulaInput[]) => result.statModifiers.push({ id: `${prefix}:${label}`, label: `${weapon.name}·${label}`, target, phase: "pre-panel", expression, inputs, sourceRefs: refs });
  const hit = (label: string, expression: FormulaExpression, inputs: EquipmentFormulaInput[], filters: Pick<EquipmentDynamicHitBonus, "elements" | "attackTags"> = {}) => result.dynamicHitBonuses.push({ id: `${prefix}:${label}`, label: `${weapon.name}·${label}`, expression, inputs, sourceRefs: refs, inputPolicy: "pre-conversion", ...filters });
  const window = (label: string, index: number, target: EquipmentStatModifier["target"]) => { const active = bool("weaponEffectActive"); if (active !== undefined) stat(label, target, mul(v("active"), v("gain")), [state("active", +active, windowLabels[rule.slug]!, "boolean"), source("gain", pct(index), label)]); };
  switch (rule.slug) {
    case "balladofthefjords": {
      const count = number("teamDistinctElementCount", 1, 4); if (count !== undefined) stat("三元素精通", "em", choose("lte", c(3), v("count"), v("gain"), c(0)), [state("count", count, "队伍不同元素类型数", "count"), source("gain", Number(rank.values[0]), "三元素时精通增益", "stat")]); break;
    }
    case "blacktassel": {
      const active = bool("targetIsSlime"); if (active !== undefined) hit("史莱姆增伤", mul(v("slime"), v("gain")), [state("slime", +active, "当前目标是否史莱姆", "boolean"), source("gain", pct(0), "对史莱姆普通伤害加成")]);
      result.effectBlockers.push("黑缨枪固定gcsim为NoEffect占位；此条使用固定Optimizer实际条件公式与目录交叉，不能声称gcsim实现已核验。"); break;
    }
    case "bloodsoakedruins": window("荒落挽歌暴伤", 1, "critDamage"); result.effectBlockers.push("血染荒城月感电专属增伤与回能事件尚未接入本配装执行协议；不作为普通伤害加成。"); break;
    case "crimsonmoonssemblance": {
      const ratio = number("bondOfLifeRatio", 0, 2, false); if (ratio !== undefined) hit("生命之契增伤", add(choose("lt", c(0), v("bondRatio"), v("baseGain"), c(0)), choose("lte", c(.3), v("bondRatio"), v("extraGain"), c(0))), [state("bondRatio", ratio, "当前生命之契除以生命上限"), source("baseGain", pct(0), "存在生命之契增伤"), source("extraGain", pct(1), "生命之契至少30%额外增伤")]);
      result.effectBlockers.push("赤月之形重击生成生命之契、14秒冷却及契约消减未自动执行。"); break;
    }
    case "fracturedhalo": window("战技爆发后攻击", 0, "atkPercent"); result.effectBlockers.push("支离轮光创造护盾后团队月感电增伤未接入；不复制到普通伤害乘区。"); break;
    case "kitaincrossspear": hit("战技增伤", v("gain"), [source("gain", pct(0), "常驻战技增伤")], { attackTags: ["skill"] }); result.effectBlockers.push("喜多院十文字流失与定时恢复能量未生成事件。"); break;
    case "lumidouceelegy": {
      stat("常驻攻击", "atkPercent", v("gain"), [source("gain", pct(0), "常驻攻击百分比")]); const count = number("weaponStacks", 0, 2);
      if (count !== undefined) hit("燃烧触发层数增伤", mul(v("stacks"), v("perStack")), [state("stacks", count, "已明确有效的8秒层数", "count"), source("perStack", pct(1), "每层普通增伤")]);
      result.effectBlockers.push("柔灯挽歌定时回能未执行；固定gcsim以StatModIsActive检查AttackMod，层数生命周期存在实现疑点。条件层数公式与固定Optimizer交叉；不能从该gcsim路径自动推断层数。"); break;
    }
    case "moonpiercer": window("拾取叶子攻击", 0, "atkPercent"); result.effectBlockers.push("贯月矢叶子生成、拾取、其他队员受益及冷却尚未自动路由；本快照只计算明确由装备者拾取的增益。"); break;
    case "mountainbracingbolt": {
      hit("常驻战技增伤", v("gain"), [source("gain", pct(0), "常驻战技增伤")], { attackTags: ["skill"] }); const active = bool("weaponEffectActive");
      if (active !== undefined) hit("队友战技窗口增伤", mul(v("active"), v("gain")), [state("active", +active, windowLabels[rule.slug]!, "boolean"), source("gain", pct(1), "队友战技后额外战技增伤")], { attackTags: ["skill"] }); result.effectBlockers.push("镇山之钉攀爬体力条款不在伤害计算范围。"); break;
    }
    case "prospectorsdrill": {
      const count = number("weaponStacks", 0, 3); if (count !== undefined) { const inputs = [state("stacks", count, "当前抗争窗口已消耗标记数", "count")]; stat("抗争攻击", "atkPercent", mul(v("stacks"), v("perStack")), [...inputs, source("perStack", pct(0), "每枚标记攻击")]); hit("抗争元素增伤", mul(v("stacks"), v("perStack")), [...inputs, source("perStack", pct(1), "每枚标记元素增伤")], { elements: [...elemental] }); } break;
    }
    case "prospectorsshovel": result.reactionBonuses.push({ id: `${prefix}:electroCharged`, label: "掘金之锹·经典感电增伤", value: pct(0), reactions: ["electroCharged"], sourceRefs: refs }); result.effectBlockers.push("掘金之锹月感电与满辉额外条款尚未接入装备专属月反应协议；经典感电48%–96%独立执行。"); break;
    case "sacrificersstaff": {
      const count = number("weaponStacks", 0, 3); if (count !== undefined) for (const [target, index] of [["atkPercent", 0], ["energyRechargeBonus", 1]] as const) stat(target, target, mul(v("stacks"), v("perStack")), [state("stacks", count, "已确认仍有效的层数", "count"), source("perStack", pct(index), "每层精炼属性")]); result.effectBlockers.push("圣祭者的辉杖目录与Optimizer为6秒，固定gcsim使用300帧即5秒：仅执行显式有效层数，自动持续时间与触发仍有来源冲突。"); break;
    }
    case "skywardspine": stat("常驻暴击", "critRate", v("gain"), [source("gain", pct(0), "常驻暴击率")]); result.effectBlockers.push("天空之脊普攻攻速、概率真空刃额外攻击与冷却未建模，未折算成主击伤害。"); break;
    case "symphonistofscents": {
      stat("常驻攻击", "atkPercent", v("gain"), [source("gain", pct(0), "常驻攻击百分比")]); const back = bool("offField"); if (back !== undefined) stat("后台额外攻击", "atkPercent", mul(v("offField"), v("gain")), [state("offField", +back, "当前取样是否在后台", "boolean"), source("gain", pct(1), "后台额外攻击")]); window("甘美回奏攻击", 2, "atkPercent"); result.effectBlockers.push("香韵奏者对其他被治疗角色的增益路由与治疗事件尚未自动执行。"); break;
    }
    case "tamayurateinoohanashi": window("战技后攻击", 0, "atkPercent"); result.effectBlockers.push("且住亭御咄移动速度条款未纳入伤害公式。"); break;
    case "thecatch": hit("爆发增伤", v("gain"), [source("gain", pct(0), "仅爆发伤害加成")], { attackTags: ["burst"] }); result.assumptions.push("渔获的爆发专属暴击率由独立逐命中条款结算，不加到角色全局面板。"); break;
    case "disasterandremorse": {
      const magic = bool("witchLessonsCompleted"); for (const [key, tags] of [["normalHitEffectActive", ["normal", "charged"]], ["skillBurstHitEffectActive", ["skill", "burst"]]] as const) { const active = bool(key); if (active !== undefined && magic !== undefined) hit(key === "normalHitEffectActive" ? "无赦" : "无愈", mul(v("active"), v("gain"), add(c(1), mul(v("hexerei"), c(.75)))), [state("active", +active, "对应独立窗口本击前仍有效", "boolean"), source("gain", pct(key === "normalHitEffectActive" ? 0 : 1), "基础精炼增伤"), state("hexerei", +magic, "魔导秘仪条件已满足", "boolean")], { attackTags: [...tags] }); } result.effectBlockers.push("灾悔17秒纷争之途、互相延时、退场移除及18秒冷却不由此计算器自动执行；窗口必须为实际仍有效状态。"); break;
    }
    case "frostbreath": window("冰水反应后攻击", 0, "atkPercent"); result.effectBlockers.push("寒息为其他队员恢复能量与16秒触发冷却未生成事件。"); break;
    case "songofthevigil": window("星烁反应后攻击", 1, "atkPercent"); result.effectBlockers.push("戍望谣歌反应回能及9秒冷却未生成事件；星烁触发由显式窗口输入恢复。"); break;
  }
  return result;
}
