import type { FormulaExpression } from "../../sim-core/src/calculation-trace";
import { equipmentCatalog, type EquipmentDataset } from "./equipment-dataset";
import { equipmentDescriptionSource } from "./equipment-source";
import type { EquipmentFormulaContext, EquipmentFormulaInput, EquipmentDynamicHitBonus } from "./equipment-formulas";
import type { EquipmentAdditiveBaseBonus, EquipmentCriticalBonus, EquipmentHitEffectResolution } from "./weapon-hit-effect-types";
import reviewedCatalog from "../sources/weapon-melee-hit-effects/reviewed-catalog.json";
import sourceManifest from "../sources/weapon-melee-hit-effects/manifest.json";

export interface WeaponMeleeHitContext extends EquipmentFormulaContext {
  weaponSkillStacks?: number;
  weaponBurstStacks?: number;
}
export interface WeaponMeleeHitControl { key: keyof WeaponMeleeHitContext; label: string; kind: "number" | "boolean"; min?: number; max?: number }
type PendingScope = { kind: "additive-base" | "critRate" | "critDamage"; attackTags: NonNullable<EquipmentDynamicHitBonus["attackTags"]> };
export const SUPPORTED_WEAPON_MELEE_HIT_IDS = reviewedCatalog.filter(rule => rule.supported).map(rule => rule.id);
export const hasWeaponMeleeHitRule = (id: string): boolean => SUPPORTED_WEAPON_MELEE_HIT_IDS.includes(id);
export const weaponMeleeHitSourceEvidence = sourceManifest.files;
export const weaponMeleeHitExcludedRules = reviewedCatalog.filter(rule => !rule.supported).map(rule => ({ id: rule.id, slug: rule.slug, blocker: rule.blocker, sourceRefs: [equipmentDescriptionSource("weapons", rule.slug), ...rule.sourceRefs] }));

export function getWeaponMeleeHitControls({ weaponId }: { weaponId: string }): WeaponMeleeHitControl[] {
  switch (weaponId) {
    case "weapon:11424": return [
      { key: "weaponSkillStacks", label: "狼牙：本击前仍有效的战技专属暴击层数", kind: "number", min: 0, max: 4 },
      { key: "weaponBurstStacks", label: "狼牙：本击前仍有效的爆发专属暴击层数", kind: "number", min: 0, max: 4 }
    ];
    case "weapon:11512": return [
      { key: "weaponEffectActive", label: "裁叶：本击前12秒效果窗口已合法建立且仍有效", kind: "boolean" },
      { key: "weaponStacks", label: "裁叶：本击前剩余可生效次数（0–28；不自动补满/消耗）", kind: "number", min: 0, max: 28 },
      { key: "offField", label: "裁叶：本击发生时装备者位于后台", kind: "boolean" }
    ];
    case "weapon:11415": return [{ key: "weaponEffectActive", label: "辰砂之纺：已确认本次战技命中可获得附加基数（考虑清除及冷却）", kind: "boolean" }];
    case "weapon:11432": return [{ key: "shielded", label: "厄水：本次命中时装备者受到护盾庇护", kind: "boolean" }];
    default: return [];
  }
}

const c = (value: number): FormulaExpression => ({ kind: "constant", value });
const v = (key: string): FormulaExpression => ({ kind: "variable", key });
const mul = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "multiply", terms });
const choose = (operator: "equal" | "lte", left: FormulaExpression, right: FormulaExpression, whenTrue: FormulaExpression, whenFalse: FormulaExpression): FormulaExpression => ({ kind: "condition", operator, left, right, whenTrue, whenFalse });
const sourceInput = (key: string, value: number, meaningKey: string): EquipmentFormulaInput => ({ key, value, meaningKey, unit: "ratio", origin: "weapon-fixed-source" });
const stateInput = (key: string, value: number, meaningKey: string, unit: "boolean" | "count"): EquipmentFormulaInput => ({ key, value, meaningKey, unit, origin: "weapon-explicit-hit-context" });

/** Ordinary-hit overlays only. Separate weapon attacks never become additive base terms. */
export function resolveWeaponMeleeHitEffects(args: { weaponId: string; refinement: number; enabled: boolean; context?: WeaponMeleeHitContext; dataset?: EquipmentDataset }): EquipmentHitEffectResolution {
  const result: EquipmentHitEffectResolution = { additiveBaseBonuses: [], criticalBonuses: [], pendingHitEffects: [], assumptions: [], effectBlockers: [], missingConditions: [], sourceRefs: [], verification: "provisional" };
  const weapon = equipmentCatalog(args.dataset).weapons.find(entry => entry.id === args.weaponId);
  if (!weapon) throw new Error(`活动目录未收录武器 ${args.weaponId}。`);
  const rank = weapon.refinements.find(entry => entry.rank === args.refinement);
  if (!rank || !Number.isInteger(args.refinement)) throw new Error(`${weapon.name}没有精炼 ${args.refinement} 的固定来源。`);
  if (!args.enabled) { result.assumptions.push(`${weapon.name}命中特有条款已明确停用。`); return result; }
  const reviewed = reviewedCatalog.find(entry => entry.id === args.weaponId && entry.supported);
  if (!reviewed) { result.effectBlockers.push(`${weapon.name}没有本模块可执行的命中特有条款。`); return result; }
  const fixed = reviewed.refinements.find(entry => entry.rank === args.refinement);
  if (weapon.slug !== reviewed.slug || !fixed || rank.description !== fixed.description || JSON.stringify(rank.values) !== JSON.stringify(fixed.values)) throw new Error(`${weapon.name}活动条款或精炼数值改变，命中特有规则需重新核验。`);
  const context = args.context ?? {};
  const refs = [equipmentDescriptionSource("weapons", weapon.slug, args.dataset), ...reviewed.sourceRefs];
  result.sourceRefs.push(...refs);
  result.assumptions.push(`${weapon.name}命中特有条款只作用于匹配的普通命中。基础伤害加值不增加角色攻击力，限定暴击不写入常驻面板；不改变独立反应公式。每击应恢复其实际有效状态，重复使用同一配装快照不自动生成触发、消耗或刷新。`);
  const need = <K extends keyof WeaponMeleeHitContext>(key: K, scope: PendingScope): WeaponMeleeHitContext[K] => {
    if (context[key] === undefined) {
      const label = getWeaponMeleeHitControls({ weaponId: weapon.id }).find(control => control.key === key)?.label ?? `${weapon.name}·${String(key)}`;
      result.pendingHitEffects.push({ id: `${weapon.id}:r${args.refinement}:pending:${String(key)}`, label, reason: `${weapon.name}命中上下文缺少显式 ${String(key)}，该条款待确认，不能把未知条件当作零、未触发或满层。`, sourceRefs: refs, ...scope });
    }
    return context[key];
  };
  const flag = (key: "weaponEffectActive" | "offField" | "shielded", scope: PendingScope): boolean | undefined => {
    const value = need(key, scope); if (value !== undefined && typeof value !== "boolean") throw new Error(`${key}必须为明确布尔值。`); return value;
  };
  const count = (key: "weaponStacks" | "weaponSkillStacks" | "weaponBurstStacks", max: number, scope: PendingScope): number | undefined => {
    const value = need(key, scope); if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > max)) throw new Error(`${key}必须为0–${max}整数。`); return value;
  };
  const pct = (index: number): number => {
    const value = rank.values[index]; if (!value || !/^\d+(?:\.\d+)?%$/.test(value)) throw new Error(`${weapon.name}字段${index}不是已审百分比。`); return Number(value.slice(0, -1)) / 100;
  };
  const additive = (suffix: string, expression: FormulaExpression, inputs: EquipmentFormulaInput[], filters: Pick<EquipmentDynamicHitBonus, "attackTags" | "elements">): void => {
    const entry: EquipmentAdditiveBaseBonus = { id: `${weapon.id}:r${args.refinement}:hit:${suffix}`, label: `${weapon.name}·${suffix}`, expression, inputs, sourceRefs: refs, inputPolicy: "final-panel", ...filters };
    result.additiveBaseBonuses.push(entry);
  };
  const critical = (suffix: string, target: EquipmentCriticalBonus["target"], expression: FormulaExpression, inputs: EquipmentFormulaInput[], filters: Pick<EquipmentDynamicHitBonus, "attackTags" | "elements">): void => {
    result.criticalBonuses.push({ id: `${weapon.id}:r${args.refinement}:hit:${suffix}`, label: `${weapon.name}·${suffix}`, target, expression, inputs, sourceRefs: refs, inputPolicy: "pre-conversion", ...filters });
  };
  const constantCritical = (suffix: string, target: EquipmentCriticalBonus["target"], coefficient: number, attackTags: NonNullable<EquipmentDynamicHitBonus["attackTags"]>): void => critical(suffix, target, v("coefficient"), [sourceInput("coefficient", coefficient, suffix)], { attackTags });

  switch (weapon.slug) {
    case "redhornstonethresher":
      additive("实时防御转普重命中基数", mul(v("def"), v("coefficient")), [sourceInput("coefficient", pct(1), "防御转命中基础伤害比例")], { attackTags: ["normal", "charged"] });
      result.assumptions.push("赤角读取本次命中时TotalDef(false)，包括已生效转换属性，使用final-panel；没有元素、前台、次数或窗口限制。不是释放技能时的旧防御快照。");
      break;
    case "lightoffoliarincision": {
      const scope: PendingScope = { kind: "additive-base", attackTags: ["normal", "skill"] };
      const active = flag("weaponEffectActive", scope); const remaining = active ? count("weaponStacks", 28, scope) : 0;
      const offField = active && remaining !== undefined && remaining > 0 ? flag("offField", scope) : false;
      if (active !== undefined && remaining !== undefined && offField !== undefined) additive("裁叶实时精通命中基数", mul(v("em"), v("coefficient"), v("active"), choose("lte", v("remaining"), c(0), c(0), c(1)), choose("equal", v("offField"), c(1), c(0), c(1))), [sourceInput("coefficient", pct(1), "实时精通转命中基础伤害比例"), stateInput("active", Number(active), "本击前合法效果窗口有效", "boolean"), stateInput("remaining", remaining, "本击前剩余生效次数", "count"), stateInput("offField", Number(offField), "本次命中时装备者后台", "boolean")], { attackTags: ["normal", "skill"] });
      result.assumptions.push("裁叶读取命中时char.Stat(EM)，包含已生效转换，使用final-panel。已有窗口内物理普攻也符合；元素普攻仅是获得窗口的条件，不能给整条加元素筛选。后台命中不生效且不消费，离场不主动清除窗口。");
      result.effectBlockers.push("裁叶元素普攻建立窗口、28次逐目标消耗、12秒计时与刷新未自动执行；固定源码明确假设触发首击不吃加值且与网络延迟有关，触发首击机制仍未验证。输入只恢复本击前已确立状态。");
      break;
    }
    case "cinnabarspindle": {
      const active = flag("weaponEffectActive", { kind: "additive-base", attackTags: ["skill"] });
      if (active !== undefined) additive("可生效战技的实时防御基数", mul(v("def"), v("coefficient"), v("active")), [sourceInput("coefficient", pct(0), "防御转战技基础伤害比例"), stateInput("active", Number(active), "本击已确认可获得加值", "boolean")], { attackTags: ["skill"] });
      result.assumptions.push("辰砂读取命中时TotalDef(false)，包含已生效转换，使用final-panel；无前台限制。当前状态只说明本击可生效，不自动安排后续多段或多目标。");
      result.effectBlockers.push("辰砂0.1秒清除及1.5秒冷却未自动执行。固定gcsim明确TODO：其实现假设冷却从0.1秒清除后开始，起点未验证，不能据此宣称整段时序完整。");
      break;
    }
    case "festeringdesire": constantCritical("战技专属暴击率", "critRate", pct(1), ["skill"]); break;
    case "fleuvecendreferryman": constantCritical("战技专属暴击率", "critRate", pct(0), ["skill"]); break;
    case "fruitfulhook": constantCritical("下落攻击专属暴击率", "critRate", pct(0), ["plunge"]); break;
    case "athameartis": constantCritical("元素爆发专属暴击伤害", "critDamage", pct(0), ["burst"]); result.assumptions.push("黑蚀爆发专属暴伤常驻，不依赖3秒攻击窗口或魔导条件；攻击窗口及其触发击问题仍由已有规则单独说明。"); break;
    case "calamityofeshu": {
      const shield = flag("shielded", { kind: "critRate", attackTags: ["normal", "charged"] });
      if (shield !== undefined) critical("护盾下普重专属暴击率", "critRate", mul(v("coefficient"), v("shielded")), [sourceInput("coefficient", pct(1), "普攻与重击专属暴击率"), stateInput("shielded", Number(shield), "命中时护盾有效", "boolean")], { attackTags: ["normal", "charged"] });
      break;
    }
    case "wolffang": {
      const skill = count("weaponSkillStacks", 4, { kind: "critRate", attackTags: ["skill"] }); const burst = count("weaponBurstStacks", 4, { kind: "critRate", attackTags: ["burst"] });
      if (skill !== undefined) critical("战技独立层暴击率", "critRate", mul(v("coefficient"), v("stacks")), [sourceInput("coefficient", pct(1), "战技每层暴击率"), stateInput("stacks", skill, "本击前有效战技层数", "count")], { attackTags: ["skill"] });
      if (burst !== undefined) critical("爆发独立层暴击率", "critRate", mul(v("coefficient"), v("stacks")), [sourceInput("coefficient", pct(2), "爆发每层暴击率"), stateInput("stacks", burst, "本击前有效爆发层数", "count")], { attackTags: ["burst"] });
      result.effectBlockers.push("狼牙两类10秒层数、各自0.1秒触发间隔和4层上限只恢复本击前状态，不自动叠层；固定源码只允许装备者前台命中获取层数，已有层数并无后台失效筛选。触发本击后的新层不得提前用于该击。");
      break;
    }
    default: throw new Error(`${weapon.name}已登记命中特有条款但没有对应命名规则。`);
  }
  return result;
}
