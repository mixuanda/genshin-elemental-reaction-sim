import type { FormulaExpression } from "../../sim-core/src/calculation-trace";
import { equipmentCatalog, type EquipmentDataset } from "./equipment-dataset";
import { equipmentDescriptionSource } from "./equipment-source";
import type { EquipmentFormulaContext, EquipmentFormulaInput, EquipmentDynamicHitBonus } from "./equipment-formulas";
import type { EquipmentCriticalBonus, EquipmentHitEffectResolution } from "./weapon-hit-effect-types";
import manifest from "../sources/weapon-ranged-hit-effects/manifest.json";

/** State belongs to this individual hit; it is not a rotation-wide initial condition. */
export interface WeaponRangedHitContext extends EquipmentFormulaContext {}
export interface WeaponRangedHitControl { key: keyof WeaponRangedHitContext; label: string; kind: "number" | "boolean"; min?: number; max?: number }
export const SUPPORTED_WEAPON_RANGED_HIT_IDS = manifest.records.map(record => record.id);
export const hasWeaponRangedHitRule = (id: string): boolean => SUPPORTED_WEAPON_RANGED_HIT_IDS.includes(id);
export const weaponRangedHitSourceEvidence = manifest.files;

export function getWeaponRangedHitControls({ weaponId }: { weaponId: string }): WeaponRangedHitControl[] {
  switch (weaponId) {
    case "weapon:15511": return [
      { key: "weaponEffectActive", label: "猎径本击前合法获得的10秒无休止狩猎窗口仍有效（触发首击不默认生效）", kind: "boolean" },
      { key: "weaponStacks", label: "猎径本击前剩余合法生效次数（窗口有效时必填，0表示已耗尽）", kind: "number", min: 0, max: 12 }
    ];
    case "weapon:15513": return [{ key: "burstEffectActive", label: "白雨降层后4秒爆发暴击残留仍有效（当前疗护不足三层时必填）", kind: "boolean" }];
    case "weapon:14519": return [
      { key: "catalystSecondaryWindowActive", label: "溢彩本人下落产生的初霞之彩仍有效（15秒与坠地后0.1秒限制）", kind: "boolean" },
      { key: "catalystSkillWindowActive", label: "溢彩本人施放战技或爆发产生的苍暮之辉仍有效（15秒与坠地后0.1秒限制）", kind: "boolean" }
    ];
    default: return [];
  }
}

const v = (key: string): FormulaExpression => ({ kind: "variable", key });
const c = (value: number): FormulaExpression => ({ kind: "constant", value });
const mul = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "multiply", terms });
const input = (key: string, value: number, meaningKey: string, unit = "ratio"): EquipmentFormulaInput => ({ key, value, meaningKey, unit, origin: "weapon-fixed-source" });
const state = (key: string, value: number, meaningKey: string, unit = "boolean"): EquipmentFormulaInput => ({ key, value, meaningKey, unit, origin: "weapon-explicit-context" });

/** Ordinary base additions and tag-specific critical stats; never character ATK or generic DMG%. */
export function resolveWeaponRangedHitEffects(args: { weaponId: string; refinement: number; enabled: boolean; characterId?: string; context?: WeaponRangedHitContext; dataset?: EquipmentDataset }): EquipmentHitEffectResolution {
  const result: EquipmentHitEffectResolution = { additiveBaseBonuses: [], criticalBonuses: [], pendingHitEffects: [], assumptions: [], effectBlockers: [], missingConditions: [], sourceRefs: [], verification: "provisional" };
  const weapon = equipmentCatalog(args.dataset).weapons.find(entry => entry.id === args.weaponId);
  if (!weapon) throw new Error(`活动目录未收录武器 ${args.weaponId}。`);
  if (!args.enabled) { result.assumptions.push(`${weapon.name}命中专属被动已明确停用。`); return result; }
  const reviewed = manifest.records.find(entry => entry.id === args.weaponId);
  if (!reviewed) { result.effectBlockers.push(`${weapon.name}没有本模块已登记的普通伤害加值或命中专属暴击公式。`); return result; }
  const rank = weapon.refinements.find(entry => entry.rank === args.refinement);
  const fixedRank = reviewed.refinements.find(entry => entry.rank === args.refinement);
  if (!Number.isInteger(args.refinement) || !rank || !fixedRank) throw new Error(`${weapon.name}没有精炼 ${args.refinement} 的固定来源。`);
  if (weapon.slug !== reviewed.slug || rank.description !== fixedRank.description || JSON.stringify(rank.values) !== JSON.stringify(fixedRank.values)) throw new Error(`${weapon.name}活动条款或精炼数值改变，必须重新核验。`);
  const refs = [equipmentDescriptionSource("weapons", weapon.slug, args.dataset), ...reviewed.sourcePaths.slice(1)];
  result.sourceRefs.push(...refs);
  const context = args.context ?? {};
  const pending = (key: string, reason: string, tag: "charged" | "burst" | "plunge", kind: "additive-base" | "critRate" | "critDamage") => result.pendingHitEffects.push({ id: `${weapon.id}:r${args.refinement}:pending:${key}`, label: `${weapon.name}·待恢复${key}`, reason, attackTags: [tag], kind, sourceRefs: refs });
  const needFlag = (key: "weaponEffectActive" | "burstEffectActive" | "catalystSecondaryWindowActive" | "catalystSkillWindowActive", tag: "charged" | "burst" | "plunge", kind: "additive-base" | "critRate" | "critDamage"): boolean | undefined => {
    const value = context[key];
    if (value === undefined) {
      const reason = `${weapon.name}缺少显式 ${key}，不能把未知的本击状态当成未触发。`;
      pending(key, reason, tag, kind);
    } else if (typeof value !== "boolean") throw new Error(`${weapon.name} ${key}必须为显式布尔值。`);
    return value;
  };
  const pct = (index: number): number => {
    const text = rank.values[index];
    if (!text || !/^\d+(?:\.\d+)?%$/.test(text)) throw new Error(`${weapon.name}百分数字段 ${index} 格式改变。`);
    return Number(text.slice(0, -1)) / 100;
  };
  const term = (suffix: string, expression: FormulaExpression, inputs: EquipmentFormulaInput[], attackTags: NonNullable<EquipmentDynamicHitBonus["attackTags"]>): EquipmentDynamicHitBonus & { inputPolicy: "final-panel" } => ({
    id: `${weapon.id}:r${args.refinement}:${suffix}`, label: `${weapon.name}·${suffix}`, expression, inputs, attackTags, inputPolicy: "final-panel", sourceRefs: refs
  });
  const critical = (suffix: string, target: EquipmentCriticalBonus["target"], active: boolean, amount: number, tag: "burst" | "plunge", meaning: string) => result.criticalBonuses.push({
    ...term(suffix, mul(v("windowActive"), v("criticalGain")), [state("windowActive", Number(active), meaning), input("criticalGain", amount, "来源中本精炼的命中专属暴击增益")], [tag]), target
  });
  result.assumptions.push(`${weapon.name}只恢复本次普通命中前已确认的装备者状态；加值进入伤害基础，专属暴击仅过滤对应命中标签，不改变全局面板，不用于独立剧变、月曜或星烁反应。`);
  switch (weapon.slug) {
    case "everlastingmoonglow":
      result.additiveBaseBonuses.push(term("普攻生命基础加值", mul(v("hp"), v("hpCoefficient")), [input("hpCoefficient", pct(1), "本精炼普通攻击基础加值的生命上限系数")], ["normal"]));
      result.assumptions.push("不灭月华普攻加值始终生效，不要求施放爆发；hp读取本击命中时最终生命上限，包含已生效转换属性，不沿用技能施放时的历史快照。");
      result.effectBlockers.push("不灭月华治疗加成、爆发后12秒内普攻命中的0.6回能与0.1秒内置冷却尚未自动执行。");
      break;
    case "hunterspath": {
      const active = needFlag("weaponEffectActive", "charged", "additive-base");
      if (active !== undefined) {
        let expression = mul(v("windowActive"), v("em"), v("emCoefficient"));
        const inputs = [state("windowActive", Number(active), "本击前合法狩猎10秒窗口是否有效"), input("emCoefficient", pct(1), "本精炼重击基础加值的元素精通系数")];
        if (active) {
          const remaining = context.weaponStacks;
          if (remaining === undefined) {
            const reason = "猎人之径有效窗口必须明确本击前剩余次数 weaponStacks（0–12），不能默认补满12次。";
            pending("weaponStacks", reason, "charged", "additive-base");
          } else {
            if (!Number.isInteger(remaining) || remaining < 0 || remaining > 12) throw new Error("猎人之径本击前剩余次数 weaponStacks 必须为0–12整数。");
            inputs.push(state("remainingUses", remaining, "本击前剩余合法生效次数，0不再生效", "count"));
            expression = { kind: "condition", operator: "lt", left: c(0), right: v("remainingUses"), whenTrue: expression, whenFalse: c(0) };
            result.additiveBaseBonuses.push(term("重击精通基础加值", expression, inputs, ["charged"]));
          }
        } else result.additiveBaseBonuses.push(term("重击精通基础加值", expression, inputs, ["charged"]));
      }
      result.assumptions.push("猎径em读取当前命中时最终精通（含转换属性），不同于历史技能快照；weaponStacks是本击前剩余次数，12次上限不是每段自动补满。窗口明确无效时无需提供剩余次数。");
      result.effectBlockers.push("猎径10秒窗口、12秒获得冷却、逐次消耗与首击网络延迟未自动执行；固定来源假定触发首击不享受加值。多段技能必须逐击恢复真实剩余次数和窗口，不得将一个有效状态复制到已经耗尽的后续段。");
      break;
    }
    case "silvershowerheartstrings": {
      const stacks = context.weaponStacks;
      if (stacks === undefined) {
        const reason = "白雨心弦需要显式当前疗护来源数 weaponStacks（0–3），与生命档位使用同一个状态。";
        pending("weaponStacks", reason, "burst", "critRate");
      } else {
        if (!Number.isInteger(stacks) || stacks < 0 || stacks > 3) throw new Error("白雨心弦当前疗护来源数 weaponStacks 必须为0–3整数。");
        const inputs = [state("remedyStacks", stacks, "当前仍有效的不同疗护来源数", "count"), input("criticalGain", pct(1), "本精炼爆发专属暴击率")];
        const residual = stacks === 3 ? undefined : needFlag("burstEffectActive", "burst", "critRate");
        if (stacks === 3 || residual !== undefined) {
          if (residual !== undefined) inputs.push(state("residualActive", Number(residual), "降至三层以下后的4秒残留是否仍有效"));
          const expression: FormulaExpression = { kind: "condition", operator: "equal", left: v("remedyStacks"), right: c(3), whenTrue: v("criticalGain"), whenFalse: residual === undefined ? c(0) : mul(v("residualActive"), v("criticalGain")) };
          result.criticalBonuses.push({ ...term("爆发专属暴击率", expression, inputs, ["burst"]), target: "critRate" });
        }
      }
      result.assumptions.push("白雨当前三层疗护直接赋予爆发专属暴击率；burstEffectActive只在不足三层时表示降层后4秒残留，此时必须明确。当前三层无需残留标志，也不受残留标志false影响。");
      result.effectBlockers.push("白雨三种独立疗护来源、战技/生命之契25秒与治疗20秒期限、降层后4秒暴击残留计时尚未自动生成。");
      break;
    }
    case "vividnotions": {
      const plunge = needFlag("catalystSecondaryWindowActive", "plunge", "critDamage");
      const skillOrBurst = needFlag("catalystSkillWindowActive", "plunge", "critDamage");
      if (plunge !== undefined) critical("初霞下落专属暴伤", "critDamage", plunge, pct(1), "plunge", "本人进行下落攻击取得的初霞之彩当前有效");
      if (skillOrBurst !== undefined) critical("苍暮下落专属暴伤", "critDamage", skillOrBurst, pct(2), "plunge", "本人施放战技或爆发取得的同一个苍暮之辉窗口当前有效");
      result.assumptions.push("溢彩两种暴伤独立叠加；catalystSkillWindowActive在此包括本人施放爆发，战技与爆发不各算一份。下落碰撞和坠地冲击均按plunge标签适用，不以元素附着量额外限制加成。");
      result.effectBlockers.push("溢彩两个15秒窗口与坠地冲击后0.1秒清除尚未自动执行；固定gcsim触发订阅缺少装备者身份过滤，故只接受已确认由本人合法触发的窗口，不能据该订阅实现队友代触发。");
      break;
    }
  }
  return result;
}
