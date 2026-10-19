import type { FormulaExpression } from "../../sim-core/src/calculation-trace";
import { equipmentCatalog, type EquipmentDataset } from "./equipment-dataset";
import { equipmentDescriptionSource } from "./equipment-source";
import type { EquipmentFormulaContext, EquipmentFormulaControl, EquipmentFormulaInput, EquipmentFormulaResolution, EquipmentDynamicHitBonus, EquipmentStatModifier } from "./equipment-formulas";
import type { EquipmentHitEffectResolution, EquipmentPendingHitEffect } from "./weapon-hit-effect-types";
import reviewedCatalog from "../sources/weapon-conditioned-expansion/reviewed-catalog.json";

export const SUPPORTED_WEAPON_CONDITIONED_EXPANSION_IDS = reviewedCatalog.map(rule => rule.id);
export const hasWeaponConditionedExpansionRule = (id: string): boolean => SUPPORTED_WEAPON_CONDITIONED_EXPANSION_IDS.includes(id);
export type WeaponConditionedExpansionResolution = EquipmentFormulaResolution & EquipmentHitEffectResolution;

export function getWeaponConditionedExpansionControls({ weaponId }: { weaponId: string }): EquipmentFormulaControl[] {
  switch (weaponId) {
    case "weapon:11430": return [
      { key: "weaponEffectActive", label: "弥坚骨：本击前冲刺后的7秒窗口已合法建立且仍有效", kind: "boolean" },
      { key: "weaponStacks", label: "弥坚骨：本击前剩余生效次数（0–18，不自动消耗）", kind: "number", min: 0, max: 18 },
      { key: "offField", label: "弥坚骨：本击时装备者位于后台", kind: "boolean" }
    ];
    case "weapon:12424": return [
      { key: "weaponEffectActive", label: "聊聊棒：承受火附着后的攻击窗口已确认有效", kind: "boolean" },
      { key: "weaponExtraEffectActive", label: "聊聊棒：承受水冰雷草附着后的元素增伤窗口已确认有效（时长来源有冲突）", kind: "boolean" }
    ];
    case "weapon:13402": return [{ key: "weaponStacks", label: "试作星镰：本击前12秒内有效层数（0–2）", kind: "number", min: 0, max: 2 }];
    case "weapon:14435": return [{ key: "weaponEffectActive", label: "群王局戏：本击前棋中法度有效（含已实际获得的延长，非自动触发）", kind: "boolean" }];
    case "weapon:14436": return [{ key: "weaponEffectActive", label: "寸心余响：本击前元素反应后的12秒精通窗口有效", kind: "boolean" }];
    case "weapon:12435": return [
      { key: "weaponStacks", label: "金律铸影：当前主乐章（0无、1攻击、2精通、3星烁）", kind: "number", min: 0, max: 3 },
      { key: "secondaryWeaponStacks", label: "金律铸影：当前复调（0无、1攻击、2精通、3星烁；时长来源有冲突）", kind: "number", min: 0, max: 3 }
    ];
    default: return [];
  }
}

const v = (key: string): FormulaExpression => ({ kind: "variable", key });
const c = (value: number): FormulaExpression => ({ kind: "constant", value });
const mul = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "multiply", terms });
const stateIs = (key: string, value: number): FormulaExpression => ({ kind: "condition", operator: "equal", left: v(key), right: c(value), whenTrue: c(1), whenFalse: c(0) });
const sourceInput = (key: string, value: number, meaningKey: string, unit = "ratio"): EquipmentFormulaInput => ({ key, value, meaningKey, unit, origin: "weapon-fixed-source" });
const stateInput = (key: string, value: number, meaningKey: string, unit = "boolean"): EquipmentFormulaInput => ({ key, value, meaningKey, unit, origin: "weapon-explicit-hit-context" });
const elements: NonNullable<EquipmentDynamicHitBonus["elements"]> = ["pyro", "hydro", "cryo", "electro", "anemo", "geo", "dendro"];
type Scope = Pick<EquipmentPendingHitEffect, "kind" | "elements" | "attackTags">;

/** Verified source agreement for explicit ordinary-hit snapshots, not automatic passive lifecycles. */
export function resolveWeaponConditionedExpansionEffects(args: { weaponId: string; refinement: number; enabled: boolean; context?: EquipmentFormulaContext; dataset?: EquipmentDataset }): WeaponConditionedExpansionResolution {
  const result: WeaponConditionedExpansionResolution = { statModifiers: [], dynamicHitBonuses: [], additiveBaseBonuses: [], criticalBonuses: [], pendingHitEffects: [], assumptions: [], effectBlockers: [], missingConditions: [], sourceRefs: [], verification: "provisional" };
  const reviewed = reviewedCatalog.find(entry => entry.id === args.weaponId);
  const weapon = equipmentCatalog(args.dataset).weapons.find(entry => entry.id === args.weaponId);
  if (!weapon || !reviewed) throw new Error(`武器 ${args.weaponId} 不在本批已审条款中。`);
  const rank = weapon.refinements.find(entry => entry.rank === args.refinement);
  const fixed = reviewed.refinements.find(entry => entry.rank === args.refinement);
  if (!rank || !fixed || weapon.slug !== reviewed.slug || rank.description !== fixed.description || JSON.stringify(rank.values) !== JSON.stringify(fixed.values)) throw new Error(`${weapon.name}活动条款或精炼向量改变，需重新核验固定来源。`);
  if (!args.enabled) { result.assumptions.push(`${weapon.name}条件条款已明确停用。`); return result; }
  const refs = [...new Set([equipmentDescriptionSource("weapons", weapon.slug, args.dataset), ...reviewed.sourceRefs])];
  const context = args.context ?? {};
  result.sourceRefs.push(...refs);
  result.assumptions.push(`${weapon.name}：仅恢复本次命中前的明确有效状态；未知不等于未触发，逐击状态变化需分别恢复。固定目录与固定 Optimizer 的数值一致；仍属 provisional，未宣称整把武器或实战触发链已验证。`);
  const need = <K extends keyof EquipmentFormulaContext>(key: K, scope?: Scope): EquipmentFormulaContext[K] => {
    if (context[key] === undefined) {
      const label = getWeaponConditionedExpansionControls({ weaponId: args.weaponId }).find(control => control.key === key)!.label;
      const reason = `${weapon.name}缺少显式 ${key}，不能将未知状态视为未触发或满层。`;
      if (scope) result.pendingHitEffects.push({ id: `${weapon.id}:pending:${key}`, label, reason, sourceRefs: refs, ...scope });
      else result.missingConditions.push(reason);
    }
    return context[key];
  };
  const flag = (key: "weaponEffectActive" | "weaponExtraEffectActive" | "offField", scope?: Scope): boolean | undefined => {
    const value = need(key, scope);
    if (value !== undefined && typeof value !== "boolean") throw new Error(`${key}必须为明确布尔值。`);
    return value;
  };
  const state = (key: "weaponStacks" | "secondaryWeaponStacks", max: number, scope?: Scope): number | undefined => {
    const value = need(key, scope);
    if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > max)) throw new Error(`${key}必须为0–${max}整数。`);
    return value;
  };
  const number = (index: number): number => Number(rank.values[index]!.replace("%", "")) / (rank.values[index]!.endsWith("%") ? 100 : 1);
  const stat = (label: string, target: EquipmentStatModifier["target"], expression: FormulaExpression, inputs: EquipmentFormulaInput[]): void => {
    result.statModifiers.push({ id: `${weapon.id}:r${args.refinement}:${target}`, label: `${weapon.name}·${label}`, target, phase: "pre-panel", expression, inputs, sourceRefs: refs });
  };
  const damage = (label: string, expression: FormulaExpression, inputs: EquipmentFormulaInput[], filters: Pick<EquipmentDynamicHitBonus, "elements" | "attackTags">): void => {
    result.dynamicHitBonuses.push({ id: `${weapon.id}:r${args.refinement}:damage`, label: `${weapon.name}·${label}`, expression, inputs, sourceRefs: refs, ...filters });
  };
  const conditionalStat = (label: string, target: EquipmentStatModifier["target"], coefficient: number, active: boolean, unit = "ratio"): void => stat(label, target, mul(v("coefficient"), v("active")), [sourceInput("coefficient", coefficient, label, unit), stateInput("active", Number(active), "本次命中前效果有效")]);
  switch (weapon.slug) {
    case "sturdybone": {
      const scope: Scope = { kind: "additive-base", attackTags: ["normal"] };
      const active = flag("weaponEffectActive", scope);
      const remaining = active ? state("weaponStacks", 18, scope) : 0;
      const offField = active && remaining !== undefined && remaining > 0 ? flag("offField", scope) : false;
      if (active !== undefined && remaining !== undefined && offField !== undefined) result.additiveBaseBonuses.push({
        id: `${weapon.id}:r${args.refinement}:normal-base`, label: "弥坚骨·实时攻击力转普攻基数", attackTags: ["normal"], inputPolicy: "final-panel", sourceRefs: refs,
        expression: mul(v("atk"), v("coefficient"), v("active"), { kind: "condition", operator: "lt", left: c(0), right: v("remaining"), whenTrue: c(1), whenFalse: c(0) }, stateIs("offField", 0)),
        inputs: [sourceInput("coefficient", number(0), "攻击力转普攻基础伤害比例"), stateInput("active", Number(active), "冲刺效果窗口有效"), stateInput("remaining", remaining, "本击前剩余生效次数", "count"), stateInput("offField", Number(offField), "本击时装备者位于后台")]
      });
      result.effectBlockers.push("弥坚骨冲刺、7秒计时、18次逐击消耗及体力降低未自动执行；固定 gcsim 的 0.12+0.4R 系数与目录和 Optimizer 不一致，本模块采用后两者一致的 R1–R5 16/20/24/28/32%，不把冲突实现当作数值验证。");
      break;
    }
    case "talkingstick": {
      const atk = flag("weaponEffectActive");
      const bonus = flag("weaponExtraEffectActive", { elements });
      if (atk !== undefined) conditionalStat("火附着攻击窗口", "atkPercent", number(0), atk);
      if (bonus !== undefined) damage("独立元素增伤窗口", mul(v("coefficient"), v("active")), [sourceInput("coefficient", number(1), "所有元素伤害加成"), stateInput("active", Number(bonus), "水冰雷草附着效果窗口有效")], { elements });
      result.effectBlockers.push("聊聊棒两种附着触发与12秒触发间隔未自动执行。元素增伤窗口目录写15秒、固定 Optimizer 显示12秒，gcsim 为 TODO；仅接受用户已确认的有效状态，不推断争议边界。");
      break;
    }
    case "prototypestarglitter": {
      const stacks = state("weaponStacks", 2, { attackTags: ["normal", "charged"] });
      if (stacks !== undefined) damage("普重有效层增伤", mul(v("coefficient"), v("stacks")), [sourceInput("coefficient", number(0), "每层普攻重击伤害加成"), stateInput("stacks", stacks, "本击前仍有效层数", "count")], { attackTags: ["normal", "charged"] });
      result.effectBlockers.push("试作星镰施放战技叠层与12秒计时未自动执行；固定 gcsim 使用攻击力百分比及普通攻击额外标签，与目录和 Optimizer 的普攻/重击伤害加成冲突，本模块采用后两者一致条款。");
      break;
    }
    case "clashofkings": {
      const active = flag("weaponEffectActive");
      if (active !== undefined) { conditionalStat("棋中法度攻击", "atkPercent", number(0), active); conditionalStat("棋中法度精通", "em", number(1), active, "stat"); }
      result.effectBlockers.push("群王局戏仅恢复已成立的棋中法度状态；战技触发、6秒窗口、重击命中延长至多6秒及12秒触发间隔未自动执行。");
      break;
    }
    case "echoesoftheheart": {
      const active = flag("weaponEffectActive");
      if (active !== undefined) conditionalStat("元素反应精通窗口", "em", number(0), active, "stat");
      result.effectBlockers.push("寸心余响的反应触发与12秒计时未自动执行；独立星烁反应增伤尚未接入，不能作为普通技能增伤或其他反应加成。");
      break;
    }
    case "forgedbythegoldenmelody": {
      const main = state("weaponStacks", 3), contra = state("secondaryWeaponStacks", 3);
      if (main !== undefined && contra !== undefined) {
        const inputs = [stateInput("main", main, "本击前主乐章：0无1攻击2精通3星烁", "state"), stateInput("contra", contra, "本击前复调：0无1攻击2精通3星烁", "state")];
        const branches = (kind: number): FormulaExpression => ({ kind: "add", terms: [stateIs("main", kind), stateIs("contra", kind)] });
        stat("主乐章与复调攻击", "atkPercent", mul(v("coefficient"), branches(1)), [sourceInput("coefficient", number(0), "每个攻击乐章的攻击力加成"), ...inputs]);
        stat("主乐章与复调精通", "em", mul(v("coefficient"), branches(2)), [sourceInput("coefficient", number(1), "每个精通乐章的元素精通", "stat"), ...inputs]);
      }
      result.effectBlockers.push("金律铸影每10秒乐章轮替、星烁触发复调及触发间隔未自动执行。复调时长目录写12秒、固定 Optimizer 显示10秒；只恢复明确有效的两个独立状态。星烁乐章增伤未接入，不得折算为普通技能或其他反应增伤。");
      break;
    }
  }
  return result;
}
