import type { FormulaExpression } from "../../sim-core/src/calculation-trace";
import { equipmentCatalog, equipmentDatasetSource, type EquipmentDataset } from "./equipment-dataset";
import { equipmentDescriptionSource } from "./equipment-source";
import type { EquipmentFormulaContext, EquipmentFormulaResolution, EquipmentFormulaInput, EquipmentStatModifier, EquipmentDynamicHitBonus } from "./equipment-formulas";
import reviewedCatalog from "../sources/weapon-extended-effects/reviewed-catalog.json";
import sourceManifest from "../sources/weapon-extended-effects/manifest.json";

export interface EquipmentExtendedWeaponContext extends EquipmentFormulaContext {
  secondaryWeaponStacks?: number;
  weaponExtraEffectActive?: boolean;
  energyZero?: boolean;
  wearerEnergyMax?: number;
  nightsoulBlessingActive?: boolean;
  weaponSnapshotDef?: number;
  clearedBondOfLife?: number;
  moonsignLevel?: number;
  witchLessonsCompleted?: boolean;
  platformPassiveActive?: boolean;
}
export interface WeaponExtendedControl { key: keyof EquipmentExtendedWeaponContext; label: string; kind: "number" | "boolean"; min?: number; max?: number }
export const SUPPORTED_WEAPON_EXTENDED_IDS = reviewedCatalog.filter(rule => rule.supported).map(rule => rule.id);
export const hasWeaponExtendedRule = (id: string): boolean => SUPPORTED_WEAPON_EXTENDED_IDS.includes(id);
export const weaponExtendedSourceEvidence = sourceManifest.files;
export const weaponExtendedExcludedRules = reviewedCatalog.filter(rule => !rule.supported).map(rule => ({ id: rule.id, slug: rule.slug, blocker: rule.blocker, sourceRefs: [equipmentDescriptionSource("weapons", rule.slug), ...rule.sourceRefs] }));

const stackControls: Record<string, { max: number; label: string }> = {
  summitshaper: { max: 5, label: "斫峰：属性取样时仍有效的8秒层数" },
  thedockhandsassistant: { max: 3, label: "船坞：当前10秒精通窗口已消耗的标记数（非库存；无窗口填0）" },
  portablepowersaw: { max: 3, label: "动力锯：当前10秒精通窗口已消耗的标记数（非库存；无窗口填0）" },
  mistsplitterreforged: { max: 3, label: "雾切：属性取样时仍有效的三种独立巴印数量" },
  splendoroftranquilwaters: { max: 3, label: "静水：本击有效的自身生命变化战技增伤层数" },
  absolution: { max: 3, label: "赦罪：本击仍有效的生命之契增加层数" },
  peakpatrolsong: { max: 2, label: "岩峰：属性取样时仍有效的6秒荣花之歌层数" },
  whitelakefrostfeather: { max: 3, label: "白湖：本击仍有效的8秒独立战技命中层数" },
  hereticsmoltenblade: { max: 18, label: "熔猎：已由实际上一秒移动距离确认的Optimizer手动档位（0–18；不从移动距离推算）" },
  ultimateoverlordsmegamagicsword: { max: 6, label: "超级魔剑：已帮助的有效美露莘数量（最多6位）" },
  beaconofthereedsea: { max: 2, label: "苇海：仍有效的两种8秒攻击窗口数量（战技命中/外部受伤各一）" },
  verdict: { max: 2, label: "裁断：本击仍有效的约印数（含首次战技伤害后0.2秒窗口）" },
  fangofthemountainking: { max: 6, label: "山王：本击仍有效的6秒独立悬木祝赐层数" },
  gestofthemightywolf: { max: 4, label: "狼的武功歌：人工核实本击合法的4秒四风诗系层数" }
};
const windowLabels: Record<string, string> = {
  skyridersword: "飞天御剑：爆发后15秒攻击窗口仍有效",
  thealleyflash: "暗巷：本击属性取样时不处于外部受伤后的5秒失效期",
  kagotsurubeisshin: "一心：合法普攻/重击/下落命中后的8秒攻击窗口仍有效",
  sapwoodblade: "原木：装备者本人实际拾取种识之叶且12秒精通窗口有效",
  forestregalia: "森林：装备者本人实际拾取种识之叶且12秒精通窗口有效",
  fleuvecendreferryman: "灰河：战技施放后5秒充能窗口有效",
  serenityscall: "谧音：装备者反应后12秒生命窗口有效",
  emberwell: "引火之源：装备者元素反应后12秒攻击窗口有效",
  freedomsworn: "苍古：当前12秒抗争之歌有效，已处理千年同类攻击增益互斥",
  peakpatrolsong: "岩峰：当前15秒团队元素增伤窗口有效（与6秒自身层数独立）",
  azurelight: "苍耀：施放战技后12秒窗口有效",
  athameartis: "黑蚀：爆发命中后3秒自身攻击窗口已确立（不代表触发击）",
  fruitfulhook: "硕果钩：下落命中后10秒普攻/重击/下落增伤窗口有效",
  flameforgedinsight: "拾慧：已确认合法感电/绽放/结晶或对应月反应后的15秒精通窗口有效",
  masterkey: "万能钥匙：装备者反应后12秒精通窗口有效",
  bladeofatonement: "救赎之斩：装备者元素反应后12秒精通窗口有效",
  songofbrokenpines: "松籁：当前12秒揭旗之歌有效，已处理千年同类攻击增益互斥",
  athousandblazingsuns: "焚曜：本击焚光窗口仍有效（已计入合法延长和后台暂停）",
  finaleofthedeep: "海渊：战技触发的15秒攻击百分比窗口仍有效",
  hereticsmoltenblade: "熔猎：14秒效果窗口已合法触发且装备者仍在场，属性取样时仍有效"
};
export function getWeaponExtendedControls({ weaponId }: { weaponId: string }): WeaponExtendedControl[] {
  const rule = reviewedCatalog.find(entry => entry.id === weaponId && entry.supported);
  if (!rule) return [];
  const list: WeaponExtendedControl[] = [];
  const stack = stackControls[rule.slug];
  if (stack) list.push({ key: "weaponStacks", label: stack.label, kind: "number", min: 0, max: stack.max });
  if (windowLabels[rule.slug]) list.push({ key: "weaponEffectActive", label: windowLabels[rule.slug]!, kind: "boolean" });
  if (["summitshaper", "calamityofeshu", "thebell", "beaconofthereedsea"].includes(rule.slug)) list.push({ key: "shielded", label: "本次属性/命中条件取样时装备者处于护盾庇护", kind: "boolean" });
  if (["serenityscall", "masterkey"].includes(rule.slug)) list.push({ key: "moonsignLevel", label: "已确认队伍月兆等级（0/1/2；2为满辉）", kind: "number", min: 0, max: 2 });
  if (rule.slug === "splendoroftranquilwaters") list.push({ key: "secondaryWeaponStacks", label: "静水：独立的其他队员生命变化生命上限层数", kind: "number", min: 0, max: 2 });
  if (rule.slug === "moonweaversdawn") list.push({ key: "wearerEnergyMax", label: "织月：装备者实际元素能量上限（非当前能量/队伍总和）", kind: "number", min: 0 });
  if (rule.slug === "azurelight") list.push({ key: "energyZero", label: "苍耀：属性取样时装备者元素能量恰为0", kind: "boolean" });
  if (rule.slug === "athameartis") list.push({ key: "witchLessonsCompleted", label: "黑蚀：已确认队伍至少两位魔导角色且满足魔导·秘仪", kind: "boolean" });
  if (rule.slug === "athousandblazingsuns") list.push({ key: "nightsoulBlessingActive", label: "焚曜：属性取样时装备者处于夜魂加持状态", kind: "boolean" });
  if (rule.slug === "swordofdescension") list.push({ key: "platformPassiveActive", label: "降临之剑：已确认当前PlayStation专属被动生效", kind: "boolean" });
  if (rule.slug === "peakpatrolsong") list.push({ key: "weaponSnapshotDef", label: "岩峰：最近团队增益触发时装备者防御快照（已含自身层数）", kind: "number", min: 0 });
  if (rule.slug === "finaleofthedeep") list.push({ key: "weaponExtraEffectActive", label: "海渊：清除生命之契后的独立15秒固定攻击窗口有效", kind: "boolean" }, { key: "clearedBondOfLife", label: "海渊：触发该窗口时累计清除的生命之契绝对生命值", kind: "number", min: 0 });
  return list;
}

const elemental = ["pyro", "hydro", "cryo", "electro", "anemo", "geo", "dendro"] as const;
const c = (value: number): FormulaExpression => ({ kind: "constant", value });
const v = (key: string): FormulaExpression => ({ kind: "variable", key });
const mul = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "multiply", terms });
const add = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "add", terms });
const div = (left: FormulaExpression, right: FormulaExpression): FormulaExpression => ({ kind: "divide", left, right });
const min = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "min", terms });
const choose = (operator: "lt" | "lte" | "equal", left: FormulaExpression, right: FormulaExpression, whenTrue: FormulaExpression, whenFalse: FormulaExpression): FormulaExpression => ({ kind: "condition", operator, left, right, whenTrue, whenFalse });
const src = (key: string, value: number, meaningKey: string, unit = "ratio"): EquipmentFormulaInput => ({ key, value, meaningKey, unit, origin: "weapon-fixed-source" });
const state = (key: string, value: number, meaningKey: string, unit = "ratio"): EquipmentFormulaInput => ({ key, value, meaningKey, unit, origin: "weapon-explicit-context" });

/** Source-reviewed numeric clauses. All conditional inputs represent an already established legal state. */
export function resolveWeaponExtendedEffects(args: { weaponId: string; refinement: number; enabled: boolean; characterId?: string; context?: EquipmentExtendedWeaponContext; dataset?: EquipmentDataset }): EquipmentFormulaResolution {
  const result: EquipmentFormulaResolution = { statModifiers: [], dynamicHitBonuses: [], assumptions: [], effectBlockers: [], missingConditions: [], sourceRefs: [], verification: "provisional" };
  const catalog = equipmentCatalog(args.dataset);
  const weapon = catalog.weapons.find(entry => entry.id === args.weaponId);
  if (!weapon) throw new Error(`活动目录未收录武器 ${args.weaponId}。`);
  const rank = weapon.refinements.find(entry => entry.rank === args.refinement);
  if (!rank || !Number.isInteger(args.refinement)) throw new Error(`${weapon.name}没有精炼 ${args.refinement} 的固定来源。`);
  if (!args.enabled) { result.assumptions.push(`${weapon.name}条件效果已明确停用。`); return result; }
  const reviewed = reviewedCatalog.find(entry => entry.id === args.weaponId && entry.supported);
  if (!reviewed) { result.effectBlockers.push(`${weapon.name}没有本模块已登记的数值公式。`); return result; }
  const fixed = reviewed.refinements.find(entry => entry.rank === args.refinement);
  if (weapon.slug !== reviewed.slug || !fixed || rank.description !== fixed.description || JSON.stringify(rank.values) !== JSON.stringify(fixed.values)) throw new Error(`${weapon.name}活动来源条款或精炼数值已改变，必须重新核验。`);
  const context = args.context ?? {};
  const refs = [equipmentDescriptionSource("weapons", weapon.slug, args.dataset), ...reviewed.sourceRefs];
  result.sourceRefs.push(...refs);
  result.assumptions.push(`${weapon.name}恢复已确认的合法有效状态；不自动推导触发、冷却、叠层、受伤/治疗/能量事件、站场时长或团队覆盖率。面板取样与命中时条件须按本条款恢复，普通增伤不替代剧变/月/星烁反应乘区。`);
  const need = <K extends keyof EquipmentExtendedWeaponContext>(key: K): EquipmentExtendedWeaponContext[K] => {
    if (context[key] === undefined) { const reason = `${weapon.name}缺少显式 ${key}，未知条件不能默认为零或未触发。`; result.effectBlockers.push(reason); result.missingConditions.push(reason); }
    return context[key];
  };
  const flag = (key: "weaponEffectActive" | "weaponExtraEffectActive" | "shielded" | "energyZero" | "nightsoulBlessingActive" | "witchLessonsCompleted" | "platformPassiveActive"): boolean | undefined => {
    const value = need(key); if (value !== undefined && typeof value !== "boolean") throw new Error(`${key}必须为显式布尔值。`); return value;
  };
  const number = (key: "weaponStacks" | "secondaryWeaponStacks" | "wearerEnergyMax" | "weaponSnapshotDef" | "clearedBondOfLife" | "moonsignLevel", max = Infinity, integer = false): number | undefined => {
    const value = need(key); if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value)))) throw new Error(`${key}必须为0–${max}范围内的有限${integer ? "整数" : "数值"}。`); return value;
  };
  const count = (max: number): number | undefined => number("weaponStacks", max, true);
  const pct = (index: number): number => { const value = rank.values[index]; if (!value || !/^\d+(?:\.\d+)?%$/.test(value)) throw new Error(`${weapon.name}字段${index}不是已核对百分数。`); return Number(value.slice(0, -1)) / 100; };
  const whole = (index: number): number => { const value = rank.values[index]; if (!value || !/^\d+(?:\.\d+)?$/.test(value)) throw new Error(`${weapon.name}字段${index}不是已核对固定数值。`); return Number(value); };
  const stat = (label: string, target: EquipmentStatModifier["target"], expression: FormulaExpression, inputs: EquipmentFormulaInput[]): void => { result.statModifiers.push({ id: `${weapon.id}:r${args.refinement}:${label}`, label: `${weapon.name}·${label}`, target, phase: "pre-panel", expression, inputs, sourceRefs: refs }); };
  const hit = (label: string, expression: FormulaExpression, inputs: EquipmentFormulaInput[], filters: Pick<EquipmentDynamicHitBonus, "attackTags" | "elements"> = {}): void => { result.dynamicHitBonuses.push({ id: `${weapon.id}:r${args.refinement}:${label}`, label: `${weapon.name}·${label}`, expression, inputs, sourceRefs: refs, inputPolicy: "pre-conversion", ...filters }); };
  const staticStat = (label: string, target: EquipmentStatModifier["target"], value: number): void => stat(label, target, v("coefficient"), [src("coefficient", value, label, target === "em" || target === "flatAtk" ? "points" : "ratio")]);
  const staticHit = (label: string, value: number, filters: Pick<EquipmentDynamicHitBonus, "attackTags" | "elements"> = {}): void => hit(label, v("coefficient"), [src("coefficient", value, label)], filters);
  const gatedStat = (label: string, target: EquipmentStatModifier["target"], value: number, active: boolean | undefined): void => { if (active !== undefined) stat(label, target, mul(v("coefficient"), v("active")), [src("coefficient", value, label, target === "em" ? "points" : "ratio"), state("active", Number(active), "已确认有效窗口", "boolean")]); };
  const gatedHit = (label: string, value: number, active: boolean | undefined, filters: Pick<EquipmentDynamicHitBonus, "attackTags" | "elements"> = {}): void => { if (active !== undefined) hit(label, mul(v("coefficient"), v("active")), [src("coefficient", value, label), state("active", Number(active), "已确认有效条件", "boolean")], filters); };
  const stackedStat = (label: string, target: EquipmentStatModifier["target"], value: number, n: number | undefined): void => { if (n !== undefined) stat(label, target, mul(v("coefficient"), v("stacks")), [src("coefficient", value, label, target === "em" ? "points" : "ratio"), state("stacks", n, "当前有效层数", "count")]); };
  const stackedHit = (label: string, value: number, n: number | undefined, filters: Pick<EquipmentDynamicHitBonus, "attackTags" | "elements"> = {}): void => { if (n !== undefined) hit(label, mul(v("coefficient"), v("stacks")), [src("coefficient", value, label), state("stacks", n, "当前有效层数", "count")], filters); };

  switch (weapon.slug) {
    case "hereticsmoltenblade": {
      const active = flag("weaponEffectActive");
      const tier = active ? count(18) : 0;
      if (active !== undefined && tier !== undefined) stat("映落瞳中的初光攻击", "atkPercent", mul(v("active"), add(v("minimum"), mul(v("tier"), div(add(v("maximum"), mul(c(-1), v("minimum"))), c(18))))), [
        state("active", Number(active), "已合法触发且仍有效的14秒窗口", "boolean"),
        src("minimum", pct(0), "每秒攻击增益下限"),
        src("maximum", pct(1), "每秒攻击增益上限"),
        state("tier", tier, "由实际移动距离确认的Optimizer档位", "count")
      ]);
      result.effectBlockers.push("固定Optimizer仅提供0–18手动档位及对应攻击公式，未提供上一秒移动距离到档位的映射；战技触发、逐秒取样、14秒持续/冷却及退场移除均未自动执行。不得将任意手选档位称为已验证的实际移动结果。");
      break;
    }
    case "skyridersword": gatedStat("爆发后攻击", "atkPercent", pct(0), flag("weaponEffectActive")); result.effectBlockers.push("移动速度与15秒触发时序未实现。"); break;
    case "thealleyflash": gatedHit("未处于受伤失效期的增伤", pct(0), flag("weaponEffectActive")); result.assumptions.push("受伤指装备者实际外部生命损失；自身消耗生命不等同外部伤害，不能由当前生命比例倒推。"); break;
    case "swordofdescension": {
      const active = flag("platformPassiveActive"); const owner = catalog.characters.find(character => character.id === args.characterId);
      if (active && !owner) { const reason = "降临之剑需活动目录内真实characterId确认旅行者身份。"; result.effectBlockers.push(reason); result.missingConditions.push(reason); }
      if (owner) { const source = `${equipmentDatasetSource(args.dataset).root}/src/data/ChineseSimplified/characters/${owner.slug}.json`; refs.push(source); result.sourceRefs.push(source); }
      if (active !== undefined && (!active || owner)) stat("平台与旅行者固定攻击", "flatAtk", mul(v("platformActive"), v("traveler"), v("flatBonus")), [state("platformActive", Number(active), "PlayStation被动实际生效", "boolean"), { key: "traveler", value: Number(owner?.id === "character:10000005" || owner?.id === "character:10000007"), unit: "boolean", meaningKey: "由活动目录角色ID确认空或荧", origin: "active-character-catalog" }, src("flatBonus", whole(2), "旅行者固定攻击", "points")]);
      result.effectBlockers.push("仅R1有来源；50%概率的200%攻击物理范围追击与10秒冷却未执行。固定gcsim默认passive=1不是实际平台检测，产品必须明确平台状态。"); break;
    }
    case "festeringdesire": staticHit("战技增伤", pct(0), { attackTags: ["skill"] }); result.assumptions.push("战技专属暴击率由命中特有条款按skill标签执行，不写入全局暴击率。"); break;
    case "kagotsurubeisshin": gatedStat("澄澄一心攻击", "atkPercent", 0.15, flag("weaponEffectActive")); result.effectBlockers.push("目录只有R1；180%攻击力物理范围追击及触发/目标/8秒冷却未执行，不能折算为原技能增伤。"); break;
    case "sapwoodblade": case "forestregalia": gatedStat("实际拾叶者精通", "em", whole(0), flag("weaponEffectActive")); result.effectBlockers.push("叶片生成、拾取对象、10秒可拾取期限、20秒生成冷却及同类精通互斥未自动执行；窗口为装备者本人实际取得的效果。"); break;
    case "wolffang": staticHit("战技与爆发增伤", pct(0), { attackTags: ["skill", "burst"] }); result.assumptions.push("狼牙战技/爆发暴击率由命中特有条款读取两组独立层数，不折为全局暴击率。"); break;
    case "fleuvecendreferryman": gatedStat("战技后充能", "energyRechargeBonus", pct(1), flag("weaponEffectActive")); result.assumptions.push("常驻战技专属暴击率由命中特有条款按skill标签执行。"); break;
    case "thedockhandsassistant": case "portablepowersaw": stackedStat("奋起精通", "em", whole(0), count(3)); result.effectBlockers.push("输入为有效10秒窗口实际已消耗标记；治疗标记、15秒触发冷却和2秒后固定能量返还未执行，能量返还不等同充能效率。"); break;
    case "calamityofeshu": gatedHit("护盾下普重增伤", pct(0), flag("shielded"), { attackTags: ["normal", "charged"] }); result.assumptions.push("护盾下普攻/重击专属暴击率由命中特有条款按护盾条件与攻击标签执行。"); break;
    case "serenityscall": case "masterkey": {
      const active = flag("weaponEffectActive"); const level = active ? number("moonsignLevel", 2, true) : 0;
      if (active !== undefined && level !== undefined) stat("反应窗口与满辉", weapon.slug === "serenityscall" ? "hpPercent" : "em", mul(v("active"), v("coefficient"), choose("equal", v("moonsign"), c(2), c(2), c(1))), [state("active", Number(active), "有效12秒窗口", "boolean"), src("coefficient", weapon.slug === "serenityscall" ? pct(0) : whole(0), "非满辉基础增益", weapon.slug === "serenityscall" ? "ratio" : "points"), state("moonsign", level, "已确认月兆等级", "count")]);
      result.assumptions.push("满辉使该增益提高100%，即乘2；月兆等级需独立确认，未由角色名字推断。"); break;
    }
    case "moonweaversdawn": {
      const maximum = number("wearerEnergyMax");
      const pair = rank.values[1]!.split("/").map(value => Number(value.replace("%", "")) / 100);
      if (pair.length !== 2 || pair.some(value => !Number.isFinite(value))) throw new Error("织月能量分支来源格式改变。");
      if (maximum !== undefined) hit("能量上限分支爆发增伤", add(v("baseBonus"), choose("lte", v("energyMaximum"), c(40), v("lowBonus"), choose("lte", v("energyMaximum"), c(60), v("midBonus"), c(0)))), [src("baseBonus", pct(0), "常驻爆发增伤"), src("midBonus", pair[0]!, "能量上限不超过60的额外增伤"), src("lowBonus", pair[1]!, "能量上限不超过40的额外增伤"), state("energyMaximum", maximum, "装备者元素能量上限", "energy")], { attackTags: ["burst"] });
      result.assumptions.push("40与60边界均包含；不超过40时只取较高一支，不能与60分支叠加。"); break;
    }
    case "emberwell": gatedStat("元素反应后攻击", "atkPercent", pct(0), flag("weaponEffectActive")); result.effectBlockers.push("独立星烁反应后的星烁伤害乘区未执行，不能放入普通全伤加成。"); break;
    case "freedomsworn": {
      staticHit("常驻伤害", pct(0)); const active = flag("weaponEffectActive"); gatedStat("抗争之歌攻击", "atkPercent", pct(2), active); gatedHit("抗争之歌普重下落", pct(1), active, { attackTags: ["normal", "charged", "plunge"] });
      result.effectBlockers.push("反应叠符、团队转授、20秒冷却未自动执行；当前窗口必须已解决千年大乐章同类攻击增益互斥，不能重复累计。"); break;
    }
    case "summitshaper": {
      const n = count(5); const shield = n === 0 ? false : flag("shielded");
      if (n !== undefined && shield !== undefined) stat("层数与护盾攻击", "atkPercent", mul(v("stacks"), v("coefficient"), add(c(1), v("shielded"))), [state("stacks", n, "有效8秒层数", "count"), src("coefficient", pct(1), "每层攻击"), state("shielded", Number(shield), "护盾有效", "boolean")]);
      result.effectBlockers.push("护盾强效、命中叠层、护盾生命周期与0.3秒触发间隔未模拟。"); break;
    }
    case "mistsplitterreforged": {
      staticHit("所有元素基础增伤", pct(0), { elements: [...elemental] }); const n = count(3);
      const owner = catalog.characters.find(character => character.id === args.characterId);
      if (owner) { const source = `${equipmentDatasetSource(args.dataset).root}/src/data/ChineseSimplified/characters/${owner.slug}.json`; refs.push(source); result.sourceRefs.push(source); }
      if (n !== undefined && n > 0 && (!owner || !(elemental as readonly string[]).includes(owner.element))) { const reason = "雾切需目录中明确的装备角色characterId确定自身元素，不能将本击元素或用户输入替代角色身份。"; result.effectBlockers.push(reason); result.missingConditions.push(reason); }
      const tiers = rank.values[1]!.replace("%", "").split("/").map(value => Number(value) / 100);
      if (tiers.length !== 3 || tiers.some(value => !Number.isFinite(value))) throw new Error("雾切三层来源格式改变。");
      if (n !== undefined && owner && (elemental as readonly string[]).includes(owner.element)) hit("自身元素巴印增伤", choose("equal", v("stacks"), c(3), v("tier3"), choose("equal", v("stacks"), c(2), v("tier2"), choose("equal", v("stacks"), c(1), v("tier1"), c(0)))), [state("stacks", n, "有效独立巴印数量", "count"), src("tier1", tiers[0]!, "一层自身元素增伤"), src("tier2", tiers[1]!, "二层自身元素增伤"), src("tier3", tiers[2]!, "三层自身元素增伤")], { elements: [owner.element as typeof elemental[number]] });
      result.effectBlockers.push("只接受合法巴印数量；固定gcsim额外允许AttackTagExtra触发且零能量上限分支不同，未沿用其自动事件。自身元素由角色目录确定，与附魔/本击元素分开。"); break;
    }
    case "lightoffoliarincision": staticStat("常驻暴击率", "critRate", pct(0)); result.effectBlockers.push("裁叶的精通基础伤害加值由命中特有条款执行；28次消耗、12秒时序及触发首击假设仍未自动实现，每击需恢复窗口、剩余次数与前后台状态。"); break;
    case "splendoroftranquilwaters": stackedHit("自身生命变化战技增伤", pct(0), count(3), { attackTags: ["skill"] }); stackedStat("队友生命变化生命上限", "hpPercent", pct(1), number("secondaryWeaponStacks", 2, true)); result.assumptions.push("自身与队友生命变化使用两个独立层数、各自0.2秒间隔和6秒窗口；纯溢出治疗不算实际生命变化。"); break;
    case "absolution": staticStat("常驻暴击伤害", "critDamage", pct(0)); stackedHit("生命之契增加增伤", pct(1), count(3)); result.effectBlockers.push("生命之契事件、6秒刷新未自动执行；不能从当前生命之契数值倒推层数。"); break;
    case "peakpatrolsong": {
      const n = count(2); stackedStat("荣花之歌防御", "defPercent", pct(0), n); stackedHit("荣花之歌元素增伤", pct(1), n, { elements: [...elemental] }); const active = flag("weaponEffectActive"); const snapshot = active ? number("weaponSnapshotDef") : 0;
      if (active !== undefined && snapshot !== undefined) hit("触发防御快照团队元素增伤", mul(v("active"), min(mul(div(v("snapshotDef"), v("defUnit")), v("perUnit")), v("cap"))), [state("active", Number(active), "独立15秒团队窗口", "boolean"), state("snapshotDef", snapshot, "最近触发时防御快照", "points"), src("defUnit", 1000, "每份防御", "points"), src("perUnit", pct(2), "每1000防御对应元素增伤"), src("cap", pct(3), "团队元素增伤上限")], { elements: [...elemental] });
      result.effectBlockers.push("防御须取最近团队增益触发时已含自身层数的快照；不能默用当前防御。团队转授、触发与覆盖刷新未执行，15秒团队窗口可晚于6秒自身层数消失。"); break;
    }
    case "azurelight": {
      const active = flag("weaponEffectActive"); const zero = active ? flag("energyZero") : false;
      if (active !== undefined && zero !== undefined) { stat("战技窗口与零能量攻击", "atkPercent", mul(v("active"), add(v("baseBonus"), mul(v("zero"), v("extraBonus")))), [state("active", Number(active), "有效12秒窗口", "boolean"), state("zero", Number(zero), "能量恰为0", "boolean"), src("baseBonus", pct(0), "窗口攻击"), src("extraBonus", pct(1), "零能量额外攻击")]); gatedStat("零能量暴伤", "critDamage", pct(2), active && zero); }
      result.assumptions.push("恰为零能量与未满能量不同；窗口结束后零能量也不提供该增益。"); break;
    }
    case "athameartis": {
      const active = flag("weaponEffectActive"); const witch = active ? flag("witchLessonsCompleted") : false;
      if (active !== undefined && witch !== undefined) stat("已确立爆发命中窗口攻击", "atkPercent", mul(v("active"), v("coefficient"), choose("equal", v("hexerei"), c(1), c(1.75), c(1))), [state("active", Number(active), "已确立3秒窗口", "boolean"), src("coefficient", pct(1), "自身攻击基础提升"), state("hexerei", Number(witch), "已确认队伍魔导秘仪", "boolean")]);
      result.effectBlockers.push("爆发专属暴伤已由命中特有条款执行；固定gcsim仍明确TODO：触发窗口的那次爆发漏吃攻击，故攻击条款只恢复已确立窗口。团队转授、刷新与多把武器优先级未实现。"); break;
    }
    case "lightbearingmoonshard": staticStat("常驻防御", "defPercent", pct(0)); result.effectBlockers.push("战技后5秒月结晶伤害加成未接入对应反应通道，不能作为普通岩伤加成。"); break;
    case "whitelakefrostfeather": stackedStat("湖色哀告攻击", "atkPercent", pct(0), count(3)); result.effectBlockers.push("满层星烁反应专属暴伤与3.5秒间隔固定能量返还未执行；三层8秒时效各自独立。"); break;
    case "thebell": gatedHit("护盾下伤害", pct(2), flag("shielded")); result.effectBlockers.push("任意有效护盾均适用；钟剑护盾生成、吸收量、10秒时效与45秒冷却未执行。"); break;
    case "luxurioussealord": staticHit("元素爆发增伤", pct(0), { attackTags: ["burst"] }); result.effectBlockers.push("大鲔独立物理追击及15秒冷却未执行，不能并入原爆发倍率。"); break;
    case "katsuragikirinagamasa": staticHit("元素战技增伤", pct(0), { attackTags: ["skill"] }); result.effectBlockers.push("战技命中后扣能、2/4/6秒返能及10秒冷却未接入能量事件，返能不是充能效率。"); break;
    case "ultimateoverlordsmegamagicsword": {
      const n = count(6); if (n !== undefined) stat("常驻与美露莘攻击", "atkPercent", add(v("baseBonus"), mul(v("extraCap"), div(v("count"), v("fullCount")))), [src("baseBonus", pct(0), "常驻攻击"), src("extraCap", pct(1), "全部有效帮助时额外攻击上限"), state("count", n, "已帮助有效美露莘人数", "count"), src("fullCount", 6, "来源封顶人数", "count")]);
      result.assumptions.push("数量0–6线性映射来自固定gcsim；不继承参考实现默认已帮助6位，仍为provisional。"); break;
    }
    case "fruitfulhook": gatedHit("下落命中后普重下落增伤", pct(1), flag("weaponEffectActive"), { attackTags: ["normal", "charged", "plunge"] }); result.effectBlockers.push("常驻下落专属暴击率由命中特有条款执行；下落命中触发与10秒增伤刷新仍未自动生成。"); break;
    case "flameforgedinsight": gatedStat("合法反应精通", "em", whole(1), flag("weaponEffectActive")); result.effectBlockers.push("固定返能及15秒冷却未接入能量事件；来源包含感电/月感电/绽放/月绽放/结晶/月结晶。"); break;
    case "bladeofatonement": gatedStat("元素反应精通", "em", whole(0), flag("weaponEffectActive")); result.effectBlockers.push("星烁后攻击条款未启用：固定GO定义condStellar但攻击公式误读condReact，触发条件与目录冲突。"); break;
    case "songofbrokenpines": staticStat("常驻攻击", "atkPercent", pct(0)); gatedStat("揭旗之歌攻击", "atkPercent", pct(2), flag("weaponEffectActive")); result.effectBlockers.push("普攻速度、叠符、团队转授与20秒冷却未执行；当前窗口须先解决千年同类攻击增益互斥。"); break;
    case "redhornstonethresher": staticStat("常驻防御", "defPercent", pct(0)); result.assumptions.push("普攻/重击的实时完整防御×系数由命中特有条款加入伤害基数，不作为flatAtk或普通增伤。"); break;
    case "beaconofthereedsea": stackedStat("两种独立窗口攻击", "atkPercent", pct(0), count(2)); { const shield = flag("shielded"); if (shield !== undefined) gatedStat("无护盾生命上限", "hpPercent", pct(2), !shield); } result.assumptions.push("两种攻击窗口系数相等，可用有效类别数表示；同一类别重复触发只刷新，不能凑成第二层。受伤必须为实际外部生命损失。"); break;
    case "verdict": staticStat("常驻攻击", "atkPercent", pct(0)); stackedHit("有效约印战技增伤", pct(1), count(2), { attackTags: ["skill"] }); result.effectBlockers.push("结晶拾取/月结晶获得、15秒时效与首次战技伤害0.2秒后清空未自动执行；固定来源已含月结晶1秒间隔。"); break;
    case "fangofthemountainking": stackedHit("悬木祝赐战技爆发增伤", pct(0), count(6), { attackTags: ["skill", "burst"] }); result.effectBlockers.push("战技0.5秒/燃烧烈绽放2秒触发与6秒独立层时效未自动执行；有效层数不能以历史总触发数代替。"); break;
    case "athousandblazingsuns": {
      const active = flag("weaponEffectActive"); const nightsoul = active ? flag("nightsoulBlessingActive") : false;
      if (active !== undefined && nightsoul !== undefined) for (const [target, value, label] of [["atkPercent", pct(1), "焚光攻击"], ["critDamage", pct(0), "焚光暴伤"]] as const) stat(label, target, mul(v("active"), v("coefficient"), choose("equal", v("nightsoul"), c(1), c(1.75), c(1))), [state("active", Number(active), "焚光有效窗口", "boolean"), src("coefficient", value, "基础增益"), state("nightsoul", Number(nightsoul), "夜魂加持状态", "boolean")]);
      result.effectBlockers.push("75%提升为乘1.75；E/Q触发、10秒冷却、元素普重击延长和夜魂后台暂停未自动执行。"); break;
    }
    case "gestofthemightywolf": stackedHit("合法诗系层数伤害", pct(0), count(4)); result.effectBlockers.push("攻速未执行。暴伤条件冲突：目录要求队伍魔导，源码仅检查装备者IsHexerei。源码叠层事件缺owner/普通攻击筛选与0.01秒间隔，因此只接收人工核实合法层数。"); break;
    case "ateaspoonoftranscendence": staticStat("常驻攻击", "atkPercent", pct(0)); result.effectBlockers.push("重击后星超导/星扩散专属伤害、5秒层数及0.2秒间隔未执行，不能替代为普通全伤。"); break;
    case "finaleofthedeep": {
      gatedStat("战技窗口攻击", "atkPercent", pct(0), flag("weaponEffectActive")); const active = flag("weaponExtraEffectActive"); const cleared = active ? number("clearedBondOfLife") : 0;
      if (active !== undefined && cleared !== undefined) stat("清契快照固定攻击", "flatAtk", mul(v("active"), min(mul(v("clearedHp"), v("coefficient")), v("cap"))), [state("active", Number(active), "独立清契15秒窗口", "boolean"), state("clearedHp", cleared, "该窗口触发时累计清除生命之契绝对量", "points"), src("coefficient", pct(1), "清除量转换比例"), src("cap", whole(2), "固定攻击上限", "points")]);
      result.effectBlockers.push("此条款是实际固定攻击buff，可用flatAtk；生命之契累积/清除/触发与独立15秒窗口未模拟。固定gcsim累计实际清除债量，不能使用当前生命×25%代替。"); break;
    }
    default: throw new Error(`${weapon.name}已登记但缺少命名公式。`);
  }
  return result;
}
