import type { FormulaExpression } from "../../sim-core/src/calculation-trace";
import { equipmentCatalog, type EquipmentDataset } from "./equipment-dataset";
import { equipmentDescriptionSource } from "./equipment-source";
import type { EquipmentFormulaContext, EquipmentFormulaResolution, EquipmentFormulaInput, EquipmentStatModifier, EquipmentDynamicHitBonus } from "./equipment-formulas";
import reviewedCatalog from "../sources/weapon-bow-effects/reviewed-catalog.json";
import sourceManifest from "../sources/weapon-bow-effects/manifest.json";

export interface WeaponBowContext extends EquipmentFormulaContext {
  weakPointHit?: boolean;
  weaponState?: number;
  platformPassiveActive?: boolean;
  weaponNormalStacks?: number;
  weaponSkillStacks?: number;
  weaponBurstStacks?: number;
  moonsignLevel?: number;
  sameElementTeammates?: number;
  differentElementTeammates?: number;
}
export interface WeaponBowControl { key: keyof WeaponBowContext; label: string; kind: "number" | "boolean"; min?: number; max?: number }
export const SUPPORTED_WEAPON_BOW_IDS = reviewedCatalog.filter(rule => rule.supported).map(rule => rule.id);
export const hasWeaponBowRule = (id: string): boolean => SUPPORTED_WEAPON_BOW_IDS.includes(id);
export const weaponBowSourceEvidence = sourceManifest.files;
export const weaponBowExcludedRules = reviewedCatalog.filter(rule => !rule.supported).map(rule => ({ id: rule.id, slug: rule.slug, blocker: rule.blocker, sourceRefs: rule.sourcePaths }));

const stackRules: Record<string, { max: number; label: string }> = {
  alleyhunter: { max: 10, label: "暗巷猎手本击前仍有效增伤层数（不是后台秒数）" },
  predator: { max: 2, label: "掠食者本击前仍有效的冰伤触发层数" },
  ibispiercer: { max: 2, label: "鹮穿之喙本击前有效的6秒精通层数" },
  cloudforged: { max: 2, label: "筑云本击前有效的18秒精通层数" },
  rangegauge: { max: 3, label: "测距规当前10秒抗争效果已消耗的标记数（不是待消耗标记）" },
  flowerwreathedfeathers: { max: 6, label: "缀花之翎本击前仍有效重击增伤层数" },
  chainbreaker: { max: 4, label: "碎链队伍内符合纳塔或异元素条件的角色人数（同一人只计一次，纳塔自身可计）" },
  thunderingpulse: { max: 3, label: "飞雷本击前普攻/战技/未满能量三种来源的有效层数" },
  silvershowerheartstrings: { max: 3, label: "白雨心弦当前仍有效的不同疗护来源数" }
};
const windows: Record<string, string> = {
  kingssquire: "王下近侍12秒森林教诲尚未到期且未因换人移除",
  scionoftheblazingsun: "本次目标上由装备者阳炎矢造成的10秒灼心仍有效",
  snarehook: "罗网勾针本人反应后的12秒精通窗口有效",
  rainbowserpentsrainbow: "虹蛇装备者后台命中触发的8秒攻击窗口仍有效",
  covenantoffrostandsnow: "霜雪誓约本人战技后的12秒精通窗口有效",
  elegyfortheend: "终末已合法触发且当前装备者仍收到12秒别离之歌",
  astralvulturescrimsonplumage: "星鹫本人合法扩散后的12秒攻击窗口有效",
  goldenfrostboundoath: "霜结本击前已合法触发的6秒自身岩伤窗口有效"
};
export function getWeaponBowControls({ weaponId }: { weaponId: string }): WeaponBowControl[] {
  const rule = reviewedCatalog.find(entry => entry.id === weaponId && entry.supported);
  if (!rule) return [];
  const list: WeaponBowControl[] = [];
  const number = (key: keyof WeaponBowContext, label: string, max: number) => list.push({ key, label, kind: "number", min: 0, max });
  const flag = (key: keyof WeaponBowContext, label: string) => list.push({ key, label, kind: "boolean" });
  const stacks = stackRules[rule.slug];
  if (stacks) number("weaponStacks", stacks.label, stacks.max);
  if (windows[rule.slug]) flag("weaponEffectActive", windows[rule.slug]!);
  switch (rule.slug) {
    case "sharpshootersoath": flag("weakPointHit", "神射手本次命中已确认是目标要害"); break;
    case "fadingtwilight": number("weaponState", "落霞本击前状态：0夕暮、1流霞、2朝晖", 2); break;
    case "mitternachtswaltz": flag("normalHitEffectActive", "幽夜本人普攻命中后的5秒战技增伤有效"); flag("skillBurstHitEffectActive", "幽夜本人战技命中后的5秒普攻增伤有效（爆发不触发）"); break;
    case "predator": flag("platformPassiveActive", "掠食者正在PlayStation Network适用平台结算"); break;
    case "snarehook": number("moonsignLevel", "罗网当前月兆：0无、1初辉、2满辉", 2); break;
    case "jadevista": number("sameElementTeammates", "悬黎其他同固有元素队友人数", 3); number("differentElementTeammates", "悬黎其他异固有元素队友人数", 3); break;
    case "astralvulturescrimsonplumage": number("differentElementTeammates", "星鹫其他异固有元素队友人数（计人数而非种类）", 3); break;
    case "thedaybreakchronicles": number("weaponNormalStacks", "黎明本击前普通攻击有效增伤单位数", 6); number("weaponSkillStacks", "黎明本击前元素战技有效增伤单位数", 6); number("weaponBurstStacks", "黎明本击前元素爆发有效增伤单位数", 6); break;
  }
  return list;
}

const elements = ["pyro", "hydro", "cryo", "electro", "anemo", "geo", "dendro"] as const;
const c = (value: number): FormulaExpression => ({ kind: "constant", value });
const v = (key: string): FormulaExpression => ({ kind: "variable", key });
const mul = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "multiply", terms });
const add = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "add", terms });
const choose = (operator: "lt" | "lte" | "equal", left: FormulaExpression, right: FormulaExpression, whenTrue: FormulaExpression, whenFalse: FormulaExpression): FormulaExpression => ({ kind: "condition", operator, left, right, whenTrue, whenFalse });
const sourceInput = (key: string, value: number, meaningKey: string, unit = "ratio"): EquipmentFormulaInput => ({ key, value, meaningKey, unit, origin: "weapon-fixed-source" });
const stateInput = (key: string, value: number, meaningKey: string, unit = "ratio"): EquipmentFormulaInput => ({ key, value, meaningKey, unit, origin: "weapon-explicit-context" });

/** Restores reviewed numeric clauses at one explicit calculation instant, without generating proc histories. */
export function resolveWeaponBowEffects(args: { weaponId: string; refinement: number; enabled: boolean; characterId?: string; context?: WeaponBowContext; dataset?: EquipmentDataset }): EquipmentFormulaResolution {
  const result: EquipmentFormulaResolution = { statModifiers: [], dynamicHitBonuses: [], assumptions: [], effectBlockers: [], missingConditions: [], sourceRefs: [], verification: "provisional" };
  const catalog = equipmentCatalog(args.dataset);
  const weapon = catalog.weapons.find(entry => entry.id === args.weaponId);
  if (!weapon) throw new Error(`活动目录未收录武器 ${args.weaponId}。`);
  const reviewed = reviewedCatalog.find(entry => entry.id === weapon.id);
  if (!args.enabled) { result.assumptions.push(`${weapon.name}条件被动已明确停用。`); return result; }
  if (!reviewed?.supported) { result.effectBlockers.push(reviewed?.blocker || `${weapon.name}没有本模块已登记的条件公式。`); if (reviewed) result.sourceRefs.push(...reviewed.sourcePaths); return result; }
  const rank = weapon.refinements.find(entry => entry.rank === args.refinement);
  const fixedRank = reviewed.refinements.find(entry => entry.rank === args.refinement);
  if (!Number.isInteger(args.refinement) || !rank || !fixedRank) throw new Error(`${weapon.name}没有精炼 ${args.refinement} 的固定来源。`);
  if (weapon.slug !== reviewed.slug || rank.description !== fixedRank.description || JSON.stringify(rank.values) !== JSON.stringify(fixedRank.values)) throw new Error(`${weapon.name}活动条款或精炼数值改变，必须重新核验。`);
  const context = args.context ?? {};
  for (const key of ["weakPointHit", "platformPassiveActive", "weaponEffectActive", "normalHitEffectActive", "skillBurstHitEffectActive"] as const) if (context[key] !== undefined && typeof context[key] !== "boolean") throw new Error(`${key}必须为显式布尔值。`);
  const refs = [equipmentDescriptionSource("weapons", weapon.slug, args.dataset), ...reviewed.sourcePaths.slice(1)];
  result.sourceRefs.push(...refs);
  result.assumptions.push(`${weapon.name}只恢复本次命中取样时已确认的状态；触发、计时、层数、概率、团队传播和多持有者去重未自动生成。普通伤害加成不进入独立剧变、月曜或星烁反应乘区。`);
  const block = (reason: string) => { result.effectBlockers.push(reason); result.missingConditions.push(reason); };
  const need = <K extends keyof WeaponBowContext>(key: K): WeaponBowContext[K] => { if (context[key] === undefined) block(`${weapon.name}缺少显式 ${key}，不能把未知状态当成0或未触发。`); return context[key]; };
  const number = (key: "weaponStacks" | "weaponState" | "weaponNormalStacks" | "weaponSkillStacks" | "weaponBurstStacks" | "moonsignLevel" | "sameElementTeammates" | "differentElementTeammates", max: number): number | undefined => {
    const value = need(key);
    if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > max)) throw new Error(`${weapon.name} ${key}必须为0–${max}整数。`);
    return value;
  };
  const pct = (index: number): number => { const text = rank.values[index]; if (!text || !/^\d+(?:\.\d+)?%$/.test(text)) throw new Error(`${weapon.name}百分数字段${index}格式改变。`); return Number(text.slice(0, -1)) / 100; };
  const whole = (index: number): number => { const text = rank.values[index]; if (!text || !/^\d+(?:\.\d+)?$/.test(text)) throw new Error(`${weapon.name}数值字段${index}格式改变。`); return Number(text); };
  const percentages = (index: number): number[] => { const text = rank.values[index]; if (!text || !/^(?:\d+(?:\.\d+)?%?\/)+\d+(?:\.\d+)?%$/.test(text)) throw new Error(`${weapon.name}分段百分数字段改变。`); return text.split("/").map(value => Number(value.replace("%", "")) / 100); };
  const stat = (suffix: string, target: EquipmentStatModifier["target"], expression: FormulaExpression, inputs: EquipmentFormulaInput[]) => result.statModifiers.push({ id: `${weapon.id}:r${args.refinement}:${suffix}`, label: `${weapon.name}·${suffix}`, target, phase: "pre-panel", expression, inputs, sourceRefs: refs });
  const hit = (suffix: string, expression: FormulaExpression, inputs: EquipmentFormulaInput[], filters: Pick<EquipmentDynamicHitBonus, "attackTags" | "elements"> = {}) => result.dynamicHitBonuses.push({ id: `${weapon.id}:r${args.refinement}:${suffix}`, label: `${weapon.name}·${suffix}`, expression, inputs, sourceRefs: refs, inputPolicy: "pre-conversion", ...filters });
  const stackExpression = mul(v("stackCount"), v("perStack"));
  const stackInputs = (n: number, amount: number, unit = "ratio") => [stateInput("stackCount", n, "本击前有效层数或已确认人数", "count"), sourceInput("perStack", amount, "每层或每位来源数值", unit)];
  const windowExpression = mul(v("windowActive"), v("windowAmount"));
  const windowInputs = (active: boolean, amount: number, unit = "ratio") => [stateInput("windowActive", Number(active), "合法效果当前是否仍有效", "boolean"), sourceInput("windowAmount", amount, "来源窗口增益", unit)];
  const table = (n: number, values: number[], includeZero: boolean): { expression: FormulaExpression; inputs: EquipmentFormulaInput[] } => {
    const inputs = [stateInput("stateCount", n, "已确认层数或离散状态", "count"), ...values.map((value, i) => sourceInput(`tier${i}`, value, `来源第${i + 1}档数值`))];
    let expression: FormulaExpression = v(`tier${values.length - 1}`);
    for (let i = values.length - 2; i >= 0; i--) expression = choose("equal", v("stateCount"), c(i + (includeZero ? 1 : 0)), v(`tier${i}`), expression);
    if (includeZero) expression = choose("equal", v("stateCount"), c(0), c(0), expression);
    return { expression, inputs };
  };
  switch (weapon.slug) {
    case "sharpshootersoath": {
      const weak = need("weakPointHit");
      if (weak !== undefined) hit("本击要害增伤", windowExpression, windowInputs(weak, pct(0)));
      result.effectBlockers.push("神射手只执行已确认要害命中的伤害加成；目标弱点检测、要害命中的强制暴击判定未自动生成，必须恢复本击真实暴击上下文。不能把该状态复制给不命中要害的其他段。"); break;
    }
    case "alleyhunter":
    case "flowerwreathedfeathers": {
      const n = number("weaponStacks", stackRules[weapon.slug]!.max);
      if (n !== undefined) hit("有效层数增伤", stackExpression, stackInputs(n, pct(0)), weapon.slug === "flowerwreathedfeathers" ? { attackTags: ["charged"] } : {});
      if (weapon.slug === "alleyhunter") result.effectBlockers.push("暗巷后台每秒叠层与在场超过4秒的衰减未自动执行；fixed源码在恰好240帧开始减层，与文案超过4秒边界不同。只接受已确认有效层数。");
      else result.effectBlockers.push("缀花15%滑翔体力减耗和0.5秒瞄准叠层/离开瞄准10秒清除未执行；fixed源码基于OnAimShoot，不能据此证明持续瞄准未发射时的自动叠层。");
      break;
    }
    case "fadingtwilight": {
      const n = number("weaponState", 2);
      if (n !== undefined) { const term = table(n, percentages(0), false); hit("命中前夕暮流霞朝晖", term.expression, term.inputs); }
      result.assumptions.push("落霞取本击造成伤害前状态；命中导致的下一状态不得倒灌入当前伤害，后台可转换，7秒转换冷却由输入状态外的事件系统负责。"); break;
    }
    case "mitternachtswaltz": {
      const normal = need("normalHitEffectActive"), skill = need("skillBurstHitEffectActive");
      if (normal !== undefined) hit("普攻触发战技窗口", windowExpression, windowInputs(normal, pct(0)), { attackTags: ["skill"] });
      if (skill !== undefined) hit("战技触发普攻窗口", windowExpression, windowInputs(skill, pct(1)), { attackTags: ["normal"] });
      result.assumptions.push("幽夜两种5秒窗口相互独立；skillBurstHitEffectActive在此仅表示战技命中产生的普攻增伤，爆发命中不会触发。fixed源码要求触发时本人前台，随后后台仍可利用既有战技窗口。"); break;
    }
    case "predator": {
      const platform = need("platformPassiveActive");
      if (platform === undefined) break;
      if (!platform) { result.assumptions.push("掠食者平台条件已明确不满足，专属66攻击与冰伤叠层均不生效。"); break; }
      const character = catalog.characters.find(entry => entry.id === args.characterId);
      if (!character) { block("掠食者需要真实装备角色characterId以判断埃洛伊专属66点攻击，不能由用户任意声明身份。"); break; }
      stat("埃洛伊身份专属攻击", "flatAtk", mul(v("isAloy"), v("aloyAtk")), [stateInput("isAloy", Number(character.slug === "aloy"), "活动目录真实装备者是否埃洛伊", "boolean"), sourceInput("aloyAtk", 66, "来源专属固定攻击", "ATK")]);
      const n = number("weaponStacks", 2);
      if (n !== undefined) hit("有效冰伤触发层数", stackExpression, stackInputs(n, 0.1), { attackTags: ["normal", "charged"] });
      result.assumptions.push("掠食者只有R1来源；平台条件显式恢复，层数须由装备者前台非零冰伤触发并仍在6秒窗口。埃洛伊身份直接读取角色目录。"); break;
    }
    case "kingssquire":
    case "covenantoffrostandsnow": {
      const active = need("weaponEffectActive");
      if (active !== undefined) stat("有效窗口精通", "em", windowExpression, windowInputs(active, whole(0), "EM"));
      if (weapon.slug === "kingssquire") result.effectBlockers.push(`王下近侍窗口到期或换人时${rank.values[1]}攻击的独立物理伤害与20秒触发冷却未执行；不能把额外伤害转换成flatATK。`);
      break;
    }
    case "ibispiercer":
    case "cloudforged": {
      const n = number("weaponStacks", 2);
      if (n !== undefined) stat("有效层数精通", "em", stackExpression, stackInputs(n, whole(0), "EM"));
      result.assumptions.push(weapon.slug === "ibispiercer" ? "鹮穿层数来自本人前台重击命中，每0.5秒至多触发一次，6秒窗口；当前命中新增层不追溯本击。" : "筑云层数来自真实能量减少事件；18秒窗口可刷新，低能量本身不代表曾触发，不能由当前能量反推层数。"); break;
    }
    case "scionoftheblazingsun": {
      const active = need("weaponEffectActive");
      if (active !== undefined) hit("本目标灼心重击", windowExpression, windowInputs(active, pct(1)), { attackTags: ["charged"] });
      result.effectBlockers.push(`烈阳之嗣${rank.values[0]}攻击的阳炎矢属于独立物理范围命中，触发延迟、10秒冷却和目标施加事件未执行；本目标灼心不能复制给其他目标。`); break;
    }
    case "rangegauge": {
      const n = number("weaponStacks", 3);
      if (n !== undefined) { stat("消耗标记攻击", "atkPercent", stackExpression, stackInputs(n, pct(0))); hit("消耗标记元素增伤", stackExpression, stackInputs(n, pct(1)), { elements: [...elements] }); }
      result.assumptions.push("测距规输入为仍有效抗争窗口实际已消耗标记数；获得标记不直接提供增益。零表示无抗争增益，不把待消耗的30秒标记当成已生效10秒窗口。"); break;
    }
    case "chainbreaker": {
      const n = number("weaponStacks", 4);
      if (n !== undefined) { stat("合格角色人数攻击", "atkPercent", stackExpression, stackInputs(n, pct(0))); stat("三人阈值精通", "em", choose("lte", c(3), v("eligibleCount"), v("emGain"), c(0)), [stateInput("eligibleCount", n, "纳塔或异元素去重角色人数", "count"), sourceInput("emGain", whole(1), "至少三人固定精通", "EM")]); }
      result.assumptions.push("碎链同一名角色满足纳塔与异元素仍只计一次；纳塔装备者本人符合地域条件并可计数。输入人数不得由名称猜测地域，也不按元素种类计数。"); break;
    }
    case "snarehook": {
      const active = need("weaponEffectActive");
      if (active === false) stat("未触发反应窗口", "em", c(0), []);
      else if (active) { const moon = number("moonsignLevel", 2); if (moon !== undefined) stat("反应窗口月兆精通", "em", add(v("baseEm"), choose("lte", c(2), v("moonsign"), v("fullEm"), c(0))), [sourceInput("baseEm", whole(0), "反应窗口基础精通", "EM"), sourceInput("fullEm", whole(1), "满辉额外精通", "EM"), stateInput("moonsign", moon, "当前月兆等级", "count")]); }
      break;
    }
    case "rainbowserpentsrainbow": {
      const active = need("weaponEffectActive");
      if (active !== undefined) stat("后台触发攻击窗口", "atkPercent", windowExpression, windowInputs(active, pct(0)));
      result.assumptions.push("虹蛇需要本人后台命中触发；已经触发的8秒窗口不会仅因随后回到前台立即取消，不能以当前offField替代有效窗口。"); break;
    }
    case "jadevista": {
      const same = number("sameElementTeammates", 3), different = number("differentElementTeammates", 3);
      if (same !== undefined && different !== undefined) { if (same + different > 3) throw new Error("悬黎同元素与异元素队友总数不能超过3且不含自身。"); stat("同元素队友精通", "em", stackExpression, stackInputs(same, whole(0), "EM")); stat("异元素队友攻击", "atkPercent", stackExpression, stackInputs(different, pct(1))); }
      result.assumptions.push("悬黎普通四人队伍除装备者最多3人；显式人数总和限制避免GO表在不合法扩展人数时忽略原文三层总上限与同元素优先。依据固有元素，不用附魔或本击元素计数。"); break;
    }
    case "elegyfortheend": {
      stat("常驻精通", "em", v("baseEm"), [sourceInput("baseEm", whole(0), "来源常驻精通", "EM")]);
      const active = need("weaponEffectActive");
      if (active !== undefined) { stat("自身收到别离之歌精通", "em", windowExpression, windowInputs(active, whole(1), "EM")); stat("自身收到别离之歌攻击", "atkPercent", windowExpression, windowInputs(active, pct(2))); }
      result.effectBlockers.push("终末只恢复当前装备者收到的一次别离之歌；其他队友传播、与其他千年大乐章同类属性的非叠加选择、追思符获取及消费/20秒禁获未自动执行，不能重复录入相同团队buff。"); break;
    }
    case "thunderingpulse": {
      stat("常驻攻击", "atkPercent", v("atkGain"), [sourceInput("atkGain", pct(0), "常驻攻击百分比")]);
      const n = number("weaponStacks", 3);
      if (n !== undefined) { const term = table(n, percentages(1), true); hit("飞雷有效层数普攻", term.expression, term.inputs, { attackTags: ["normal"] }); }
      result.assumptions.push("飞雷三层来自不同条件，普攻命中5秒、战技施放10秒、能量未满；不是三次普攻叠三层。达到三层的档位非线性，直接使用来源40%至80%档位。"); break;
    }
    case "hunterspath":
      hit("常驻全元素增伤", v("elementGain"), [sourceInput("elementGain", pct(0), "七元素伤害加成")], { elements: [...elements] });
      result.effectBlockers.push("猎人之径精通重击基础加值由命中专属模块按当前精通、合法窗口和本击前剩余次数恢复；12次消费、10秒期限、12秒冷却及首击网络延迟仍未自动执行。"); break;
    case "silvershowerheartstrings": {
      const n = number("weaponStacks", 3);
      if (n !== undefined) { const term = table(n, percentages(0), true); stat("有效疗护生命", "hpPercent", term.expression, term.inputs); }
      result.effectBlockers.push("白雨心弦爆发专属暴击率由命中专属模块按当前疗护数和不足三层时的4秒残留状态恢复；生命之契、战技25秒与治疗20秒独立触发及降层残留计时仍未自动执行。"); break;
    }
    case "astralvulturescrimsonplumage": {
      const active = need("weaponEffectActive");
      if (active !== undefined) stat("扩散触发攻击窗口", "atkPercent", windowExpression, windowInputs(active, pct(0)));
      const n = number("differentElementTeammates", 3);
      if (n !== undefined) for (const [tag, index] of [["charged", 1], ["burst", 2]] as const) { const amounts = percentages(index); hit(`${tag}异元素人数`, choose("equal", v("differentCount"), c(0), c(0), choose("equal", v("differentCount"), c(1), v("oneGain"), v("twoGain"))), [stateInput("differentCount", n, "其他异固有元素队友人数", "count"), sourceInput("oneGain", amounts[0]!, "一名异元素队友增益"), sourceInput("twoGain", amounts[1]!, "至少两名异元素队友增益")], { attackTags: [tag] }); }
      result.effectBlockers.push("星鹫目录新增星扩散触发攻击窗口，但固定gcsim只订阅普通扩散；本模块只接受已确认合法状态，未验证星扩散自动触发。普通扩散fixed要求触发时装备者前台。"); break;
    }
    case "thedaybreakchronicles": {
      for (const [key, tag] of [["weaponNormalStacks", "normal"], ["weaponSkillStacks", "skill"], ["weaponBurstStacks", "burst"]] as const) { const n = number(key, 6); if (n !== undefined) hit(`${tag}独立当前增伤`, stackExpression, stackInputs(n, pct(2)), { attackTags: [tag] }); }
      result.effectBlockers.push("黎明只恢复普攻/战技/爆发各自当前增伤单位；战斗状态、脱战3秒、每秒衰减、每类别0.1秒触发、魔导秘仪跨类别增长未自动执行。fixed源码初始化全满、缺少0.1秒门限且魔导仅修改命中类别，不能作为完整状态机验证。"); break;
    }
    case "goldenfrostboundoath": {
      stat("常驻防御", "defPercent", v("defGain"), [sourceInput("defGain", pct(0), "常驻防御百分比")]);
      const active = need("weaponEffectActive");
      if (active !== undefined) hit("自身有效岩伤窗口", windowExpression, windowInputs(active, pct(1)), { elements: ["geo"] });
      result.effectBlockers.push(`霜结自身月结晶${rank.values[2]}、邻近月笼时其他角色岩伤${rank.values[3]}与月结晶${rank.values[4]}尚未接入团队及月反应路径；不能将其他角色奖励返加装备者。当前触发命中不倒算新获得的6秒增益。`); break;
    }
  }
  return result;
}
