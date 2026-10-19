import type { FormulaExpression } from "../../sim-core/src/calculation-trace";
import { equipmentCatalog, type EquipmentDataset } from "./equipment-dataset";
import { equipmentDescriptionSource } from "./equipment-source";
import sourceManifest from "../sources/weapon-conditional-effects/manifest.json";
import type { EquipmentFormulaContext, EquipmentFormulaInput, EquipmentFormulaResolution, EquipmentStatModifier, EquipmentDynamicHitBonus } from "./equipment-formulas";

export interface WeaponConditionalContext extends EquipmentFormulaContext {
  weaponEffectActive?: boolean;
  energyFull?: boolean;
  arrowTravelSeconds?: number;
}
export interface WeaponConditionalControl { key: keyof WeaponConditionalContext; label: string; kind: "number" | "boolean"; min?: number; max?: number }
const blackcliffIds = ["weapon:11408", "weapon:12408", "weapon:13404", "weapon:14408", "weapon:15408"] as const;
const royalIds = ["weapon:11404", "weapon:12404", "weapon:13408", "weapon:14404", "weapon:15404"] as const;
export const SUPPORTED_WEAPON_CONDITIONAL_IDS = ["weapon:15414", "weapon:15304", "weapon:15406", "weapon:15407", "weapon:12405", "weapon:12302", "weapon:12301", ...blackcliffIds, ...royalIds, "weapon:14417", "weapon:14424"] as const;
export const hasWeaponConditionalRule = (id: string): boolean => (SUPPORTED_WEAPON_CONDITIONAL_IDS as readonly string[]).includes(id);
export function getWeaponConditionalControls({ weaponId }: { weaponId: string }): WeaponConditionalControl[] {
  const stack = (max: number, label: string): WeaponConditionalControl[] => [{ key: "weaponStacks", label, kind: "number", min: 0, max }];
  if ((blackcliffIds as readonly string[]).includes(weaponId)) return stack(3, "黑岩命中前仍有效的击败敌人层数（各层30秒）");
  if ((royalIds as readonly string[]).includes(weaponId)) return stack(5, "宗室本次命中前专注层数（本次暴击判定前）");
  switch (weaponId) {
    case "weapon:15414": return [{ key: "energyFull", label: "破魔命中时元素能量恰好全满", kind: "boolean" }];
    case "weapon:15304": return [{ key: "weaponEffectActive", label: "弹弓本次是适用箭矢（排除达达利亚近战/恰斯卡夜魂攻击）", kind: "boolean" }, { key: "arrowTravelSeconds", label: "弹弓本次箭矢发射至命中秒数", kind: "number", min: 0 }];
    case "weapon:15406": return [{ key: "weaponEffectActive", label: "试作澹月重击要害后10秒攻击增益仍有效", kind: "boolean" }];
    case "weapon:15407": return stack(4, "钢轮弓本次命中前仍有效的6秒层数");
    case "weapon:12301": return [{ key: "hpFraction", label: "铁影当前生命比例（0–1；精炼对应阈值等号待核验）", kind: "number", min: 0, max: 1 }];
    case "weapon:14417": return stack(5, "盈满之实当前仍有效的盈缺层数（同时降低攻击）");
    case "weapon:14424": return [{ key: "weaponEffectActive", label: "遗祀玉珑生命/精通窗口已经触发且仍有效", kind: "boolean" }];
    default: return [];
  }
}

export const weaponConditionalSourceEvidence = sourceManifest.files;
const sourceRoot = `https://github.com/genshinsim/gcsim/blob/${sourceManifest.sourceCommit}/`;
const sourcePaths: Record<string, string> = {
  hamayumi: "internal/weapons/bow/hamayumi/hamayumi.go",
  slingshot: "internal/weapons/bow/slingshot/slingshot.go",
  prototypecrescent: "internal/weapons/bow/prototype/prototype.go",
  compoundbow: "internal/weapons/bow/compound/compound.go",
  rainslasher: "internal/weapons/claymore/rainslasher/rainslasher.go",
  bloodtaintedgreatsword: "internal/weapons/claymore/bloodtainted/bloodtainted.go",
  ferrousshadow: "internal/weapons/claymore/ferrousshadow/ferrousshadow.go",
  fruitoffulfillment: "internal/weapons/catalyst/fruitoffulfillment/fruitoffulfillment.go",
  sacrificialjade: "internal/weapons/catalyst/sacrificialjade/sacrificialjade.go"
};
const familyTypes: Record<string, string> = { "weapon:11408": "sword", "weapon:12408": "claymore", "weapon:13404": "spear", "weapon:14408": "catalyst", "weapon:15408": "bow", "weapon:11404": "sword", "weapon:12404": "claymore", "weapon:13408": "spear", "weapon:14404": "catalyst", "weapon:15404": "bow" };
const fixedRefinements: Record<string, readonly (readonly string[])[]> = {
  hamayumi: [["16%", "12%"], ["20%", "15%"], ["24%", "18%"], ["28%", "21%"], ["32%", "24%"]],
  slingshot: [["36%"], ["42%"], ["48%"], ["54%"], ["60%"]],
  prototypecrescent: [["36%"], ["45%"], ["54%"], ["63%"], ["72%"]],
  compoundbow: [["4%", "1.2%"], ["5%", "1.5%"], ["6%", "1.8%"], ["7%", "2.1%"], ["8%", "2.4%"]],
  rainslasher: [["20%"], ["24%"], ["28%"], ["32%"], ["36%"]],
  bloodtaintedgreatsword: [["12%"], ["15%"], ["18%"], ["21%"], ["24%"]],
  ferrousshadow: [["70%", "30%"], ["75%", "35%"], ["80%", "40%"], ["85%", "45%"], ["90%", "50%"]],
  blackcliff: [["12%"], ["15%"], ["18%"], ["21%"], ["24%"]],
  royal: [["8%"], ["10%"], ["12%"], ["14%"], ["16%"]],
  fruitoffulfillment: [["24"], ["27"], ["30"], ["33"], ["36"]],
  sacrificialjade: [["32%", "40"], ["40%", "50"], ["48%", "60"], ["56%", "70"], ["64%", "80"]]
};
const c = (value: number): FormulaExpression => ({ kind: "constant", value });
const v = (key: string): FormulaExpression => ({ kind: "variable", key });
const mul = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "multiply", terms });
const add = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "add", terms });
const condition = (operator: "lt" | "lte" | "equal", left: FormulaExpression, right: FormulaExpression, whenTrue: FormulaExpression, whenFalse: FormulaExpression): FormulaExpression => ({ kind: "condition", operator, left, right, whenTrue, whenFalse });
const input = (key: string, value: number, meaningKey: string, unit = "ratio", origin = "weapon-fixed-source"): EquipmentFormulaInput => ({ key, value, meaningKey, unit, origin });
const state = (key: string, value: number, meaningKey: string, unit = "ratio"): EquipmentFormulaInput => input(key, value, meaningKey, unit, "weapon-explicit-context");

/** Restores a source-reviewed numeric clause at an explicit instant; it does not generate trigger histories. */
export function resolveWeaponConditionalEffects(args: { weaponId: string; refinement: number; enabled: boolean; context?: WeaponConditionalContext; dataset?: EquipmentDataset }): EquipmentFormulaResolution {
  const result: EquipmentFormulaResolution = { statModifiers: [], dynamicHitBonuses: [], assumptions: [], effectBlockers: [], missingConditions: [], sourceRefs: [], verification: "provisional" };
  const weapon = equipmentCatalog(args.dataset).weapons.find(entry => entry.id === args.weaponId);
  if (!weapon) throw new Error(`活动目录未收录武器 ${args.weaponId}。`);
  const rank = weapon.refinements.find(entry => entry.rank === args.refinement);
  if (!Number.isInteger(args.refinement) || !rank) throw new Error(`${weapon.name}没有精炼 ${args.refinement} 的来源记录。`);
  if (!args.enabled) { result.assumptions.push(`${weapon.name}条件被动已明确停用。`); return result; }
  if (!hasWeaponConditionalRule(args.weaponId)) { result.effectBlockers.push(`${weapon.name}没有已登记的本类条件公式。`); return result; }
  const context = args.context ?? {};
  for (const key of ["weaponEffectActive", "energyFull"] as const) if (context[key] !== undefined && typeof context[key] !== "boolean") throw new Error(`${key}必须为显式布尔值。`);
  if (context.hpFraction !== undefined && (!Number.isFinite(context.hpFraction) || context.hpFraction < 0 || context.hpFraction > 1)) throw new Error("hpFraction必须为0–1的有限比例。");
  if (context.arrowTravelSeconds !== undefined && (!Number.isFinite(context.arrowTravelSeconds) || context.arrowTravelSeconds < 0)) throw new Error("arrowTravelSeconds必须为非负有限秒数。");
  if (context.enemyAuras?.some(value => !["pyro", "hydro", "cryo", "electro", "anemo", "geo", "dendro"].includes(value))) throw new Error("enemyAuras只能包含有效元素附着。");
  const family = (blackcliffIds as readonly string[]).includes(weapon.id) ? "blackcliff" : (royalIds as readonly string[]).includes(weapon.id) ? "royal" : undefined;
  const rule = family ?? weapon.slug;
  if (JSON.stringify(rank.values) !== JSON.stringify(fixedRefinements[rule]?.[args.refinement - 1])) throw new Error(`${weapon.name}精炼数值与固定源码核对表不一致，必须重新核验。`);
  const refs = [equipmentDescriptionSource("weapons", weapon.slug, args.dataset), ...(family ? [`internal/weapons/${familyTypes[weapon.id]}/${family}/${family}.go`, `internal/weapons/common/${family}.go`] : [sourcePaths[weapon.slug]!]).map(path => sourceRoot + path)];
  result.sourceRefs.push(...refs);
  result.assumptions.push(`${weapon.name}只恢复命中前显式状态；触发、计时、层数变化和覆盖率未由本模块自动模拟，改变命中上下文必须重新恢复。`);
  const fail = (reason: string): void => {
    result.effectBlockers.push(reason);
    const filters: Record<string, Pick<EquipmentDynamicHitBonus, "attackTags">> = {
      hamayumi: { attackTags: ["normal", "charged"] }, slingshot: { attackTags: ["normal", "charged"] },
      ferrousshadow: { attackTags: ["charged"] }, rainslasher: {}, bloodtaintedgreatsword: {}
    };
    const filter = filters[rule];
    if (filter) (result.pendingHitEffects ??= []).push({ id: `${weapon.id}:r${args.refinement}:pending:${result.pendingHitEffects?.length ?? 0}`, label: weapon.name, reason, sourceRefs: refs, kind: "damageBonus", ...filter });
    else result.missingConditions.push(reason);
  };
  const need = <K extends keyof WeaponConditionalContext>(key: K): WeaponConditionalContext[K] => {
    if (context[key] === undefined) fail(`${weapon.name}缺少显式 ${key}，不能把未知条件当作未触发。`);
    return context[key];
  };
  const count = (max: number): number | undefined => {
    const n = need("weaponStacks");
    if (n !== undefined && (!Number.isInteger(n) || n < 0 || n > max)) throw new Error(`${weapon.name}有效层数必须为0–${max}整数。`);
    return n;
  };
  const pct = (index: number): number => Number(rank.values[index]!.slice(0, -1)) / 100;
  const whole = (index: number): number => Number(rank.values[index]);
  const expected = (description: string): void => { if (rank.description !== description) throw new Error(`${weapon.name}来源条款已变更，必须重新核验公式映射。`); };
  const stat = (suffix: string, target: EquipmentStatModifier["target"], expression: FormulaExpression, inputs: EquipmentFormulaInput[]): void => {
    result.statModifiers.push({ id: `${weapon.id}:r${args.refinement}:${suffix}`, label: `${weapon.name}·${suffix}`, target, phase: "pre-panel", expression, inputs, sourceRefs: refs });
  };
  const hit = (suffix: string, expression: FormulaExpression, inputs: EquipmentFormulaInput[], attackTags?: EquipmentDynamicHitBonus["attackTags"]): void => {
    result.dynamicHitBonuses.push({ id: `${weapon.id}:r${args.refinement}:${suffix}`, label: `${weapon.name}·${suffix}`, expression, inputs, sourceRefs: refs, inputPolicy: "pre-conversion", ...(attackTags ? { attackTags } : {}) });
  };
  const stackInputs = (n: number, perStack: number, meaning: string, unit = "ratio") => [state("stackCount", n, "本次命中前仍有效层数", "count"), input("perStack", perStack, meaning, unit)];
  const values = rank.values;
  switch (rule) {
    case "hamayumi": {
      expected(`普通攻击造成的伤害提升${values[0]}，重击造成的伤害提升${values[1]}。当装备该武器的角色元素能量等于100%时，这个效果提升100%。`);
      const full = need("energyFull");
      if (full !== undefined) for (const [tag, index] of [["normal", 0], ["charged", 1]] as const) hit(tag === "normal" ? "普攻增伤" : "重击增伤", mul(v("baseBonus"), add(c(1), v("energyFull"))), [input("baseBonus", pct(index), "未满能量基础增伤"), state("energyFull", Number(full), "命中时能量是否恰好全满", "boolean")], [tag]);
      break;
    }
    case "slingshot": {
      expected(`普通攻击与重击的箭矢若在发射后的0.3秒内击中敌人，则造成的伤害增加${values[0]}；否则，造成的伤害下降10%。`);
      const eligible = need("weaponEffectActive");
      if (eligible === false) hit("不适用箭矢", c(0), [], ["normal", "charged"]);
      else if (eligible) {
        const travel = need("arrowTravelSeconds");
        if (travel !== undefined) hit("箭矢飞行时长增减伤", condition("lte", v("travelSeconds"), v("thresholdSeconds"), v("closeBonus"), v("farPenalty")), [state("travelSeconds", travel, "本次箭矢从发射快照至命中的秒数", "seconds"), input("thresholdSeconds", 0.3, "固定源码18帧窗口", "seconds"), input("closeBonus", pct(0), "窗口内增伤"), input("farPenalty", -0.1, "超过窗口伤害降低")], ["normal", "charged"]);
      }
      result.assumptions.push("弹弓weaponEffectActive在此专指本次普通/重击箭矢可适用：固定源码排除达达利亚近战斩击与恰斯卡夜魂攻击。false表示不适用（零加成），不是远距负增伤；0.3秒恰好边界按固定源码包含。混合技能中的不同箭矢需各自恢复条件。"); break;
    }
    case "prototypecrescent": {
      expected(`重击若命中要害，则提升10%移动速度与${values[0]}攻击力，持续10秒。`);
      const active = need("weaponEffectActive");
      if (active !== undefined) stat("要害窗口攻击", "atkPercent", mul(v("windowActive"), v("atkGain")), [state("windowActive", Number(active), "合法要害命中后10秒窗口仍有效", "boolean"), input("atkGain", pct(0), "窗口攻击百分比")]);
      result.effectBlockers.push("试作澹月10%移动速度没有进入伤害公式或动画时间；重击要害触发由显式窗口输入确认，未自动识别目标弱点。"); break;
    }
    case "compoundbow": {
      expected(`普通攻击与重击命中时，提升${values[0]}攻击力与${values[1]}普通攻击速度。该效果持续6秒，最多可以叠加4层，每0.3秒只能触发一次。`);
      const n = count(4);
      if (n !== undefined) stat("叠层攻击", "atkPercent", mul(v("stackCount"), v("perStack")), stackInputs(n, pct(0), "每层攻击百分比"));
      result.effectBlockers.push(`钢轮弓每层${values[1]}普通攻击速度尚未用于动作帧或循环时间；本次仅执行攻击百分比。`);
      result.assumptions.push("钢轮弓源码要求装备者前台普攻/重击命中，18帧触发间隔，360帧整体刷新；输入为本次命中前已有层数，本次新触发不倒算入当前伤害。"); break;
    }
    case "rainslasher":
    case "bloodtaintedgreatsword": {
      const rain = rule === "rainslasher", element = rain ? "hydro" : "pyro";
      expected(`对处于${rain ? "水" : "火"}元素或雷元素影响下的敌人，造成的伤害提高${values[0]}。`);
      const auras = need("enemyAuras");
      if (auras !== undefined) hit("附着目标增伤", mul(v("auraEligible"), v("damageBonus")), [state("auraEligible", Number(auras.includes(element) || auras.includes("electro")), `当前目标具有${rain ? "水" : "火"}或雷附着`, "boolean"), input("damageBonus", pct(0), "目标附着条件增伤")]);
      result.assumptions.push("附着条件读取本次目标命中瞬间状态；无攻击标签或伤害元素限制，但这是普通伤害加成，不增加独立剧变反应伤害。多目标或附着改变需各自恢复上下文。"); break;
    }
    case "ferrousshadow": {
      expected(`生命值低于${values[0]}时，重击不会轻易被打断，并提高${values[1]}重击伤害。`);
      const hp = need("hpFraction"), threshold = pct(0);
      if (hp === threshold) fail(`铁影阔剑恰好${values[0]}生命边界来源冲突：目录写低于，固定gcsim包含等号；此边界需游戏内核验，未执行条件增伤。`);
      else if (hp !== undefined) hit("低生命重击增伤", condition("lt", v("hpFraction"), v("hpThreshold"), v("damageBonus"), c(0)), [state("hpFraction", hp, "当前生命比例"), input("hpThreshold", threshold, "本精炼低生命阈值"), input("damageBonus", pct(1), "满足阈值的重击增伤")], ["charged"]);
      result.effectBlockers.push("铁影阔剑重击抗打断条款未执行，不能据本次数值推断受击时动作仍会完成。"); break;
    }
    case "blackcliff": {
      expected(`击败敌人后，攻击力提升${values[0]}，持续30秒。该效果至多叠加3层，每层持续时间独立。`);
      const n = count(3);
      if (n !== undefined) stat("击败敌人叠层攻击", "atkPercent", mul(v("stackCount"), v("perStack")), stackInputs(n, pct(0), "每层攻击百分比"));
      result.assumptions.push("黑岩输入是各自30秒仍有效的层数，不是累计击杀数；固定源码要求击杀归属装备者且触发时在前台，达到上限时环形刷新单层期限。"); break;
    }
    case "royal": {
      expected(`攻击造成伤害时，暴击率提升${values[0]}，最多堆叠5次。攻击造成暴击后，移除已有的专注效果。`);
      const n = count(5);
      if (n !== undefined) stat("专注暴击率", "critRate", mul(v("stackCount"), v("perStack")), stackInputs(n, pct(0), "每层专注暴击率"));
      result.assumptions.push("宗室只恢复本次命中前已有专注层数。固定源码由自身非零伤害的非暴击在18帧间隔后加层，暴击清层不受该间隔限制；零伤害不改变层数。未由期望暴击率反推层数，也不宣称已模拟随机暴击反馈。"); break;
    }
    case "fruitoffulfillment": {
      expected(`触发元素反应后，获得「盈缺」效果：元素精通提升${values[0]}点，攻击力降低5%。每0.3秒至多获得一层盈缺效果，至多叠加5层。未触发元素反应时将每6秒失去一层。角色处于队伍后台时也能触发效果。`);
      const n = count(5);
      if (n !== undefined) {
        stat("盈缺精通", "em", mul(v("stackCount"), v("perStack")), stackInputs(n, whole(0), "每层固定元素精通", "EM"));
        stat("盈缺攻击降低", "atkPercent", mul(v("stackCount"), v("perStack")), stackInputs(n, -0.05, "每层攻击百分比降低"));
      }
      result.assumptions.push("盈满之实每层同时获得精通并降低5%攻击，最高降低25%。固定源码允许后台归属反应触发；0.3秒内被忽略的反应不刷新6秒衰减期限，层数与衰减调度未自动生成。"); break;
    }
    case "sacrificialjade": {
      expected(`处于队伍后台超过5秒后，生命值上限提升${values[0]}，元素精通提升${values[1]}点。装备者登场并留在场上10秒后，该效果将失效。`);
      const active = need("weaponEffectActive");
      if (active !== undefined) {
        stat("后台窗口生命", "hpPercent", mul(v("windowActive"), v("hpGain")), [state("windowActive", Number(active), "已经触发且仍有效的生命/精通窗口", "boolean"), input("hpGain", pct(0), "窗口生命百分比")]);
        stat("后台窗口精通", "em", mul(v("windowActive"), v("emGain")), [state("windowActive", Number(active), "已经触发且仍有效的生命/精通窗口", "boolean"), input("emGain", whole(1), "窗口固定元素精通", "EM")]);
      }
      result.assumptions.push("遗祀玉珑窗口不能仅由当前前后台推断：已生效增益可在短暂离场后继续保持，上场10秒失效受后续换人重新调度。目录写后台超过5秒，固定源码于300帧调度；本模块只接受已确认有效状态，不裁定恰好5秒触发边界。"); break;
    }
  }
  return result;
}
