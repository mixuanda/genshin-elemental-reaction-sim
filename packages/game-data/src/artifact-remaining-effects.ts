import type { FormulaExpression } from "../../sim-core/src/calculation-trace";
import { equipmentArtifactSets, type EquipmentDataset } from "./equipment-dataset";
import { equipmentDescriptionSource } from "./equipment-source";
import type { ArtifactConditionalContext, ArtifactConditionalControl } from "./artifact-conditional-effects";
import type { EquipmentFormulaInput, EquipmentDynamicHitBonus } from "./equipment-formulas";
import type { EquipmentHitEffectResolution } from "./weapon-hit-effect-types";
import type { EquipmentReactionBonus, EquipmentPendingReactionEffect } from "./artifact-reaction-effects";
import reviewed from "../sources/artifact-remaining-effects/reviewed-catalog.json";

/** Sourced hit and ordinary-reaction clauses; automatic lifecycles remain separate. */
export const SUPPORTED_ARTIFACT_REMAINING_IDS = reviewed.map(record => record.id);
export const hasArtifactRemainingRule = (id: string): boolean => SUPPORTED_ARTIFACT_REMAINING_IDS.includes(id);

export function getArtifactRemainingControls(pieceCounts: Readonly<Record<string, number>>): ArtifactConditionalControl[] {
  const controls: ArtifactConditionalControl[] = [];
  const flag = (key: keyof ArtifactConditionalContext, label: string) => controls.push({ key, label, kind: "boolean" });
  const number = (key: keyof ArtifactConditionalContext, label: string, max?: number) => controls.push({ key, label, kind: "number", min: 0, ...(max === undefined ? {} : { max }) });
  if ((pieceCounts["artifact-set:15024"] ?? 0) >= 4) {
    flag("echoesRiteActive", "余响：这次普攻已实际获得幽谷祝祀加值（不以36%代替触发）");
    flag("offField", "本次命中时装备者位于后台");
    number("echoesCurrentAttack", "余响：该次命中时装备者实际总攻击力（与主击历史快照独立）");
  }
  if ((pieceCounts["artifact-set:15033"] ?? 0) >= 4) {
    flag("songWavesActive", "昔时：6秒记录已结束，本次命中前浪潮10秒窗口仍有效");
    flag("offField", "本次命中时装备者位于后台");
    number("songRemainingTriggers", "昔时：本次命中前剩余生效次数（不自动扣除）", 5);
    number("songRecordedHealing", "昔时：该次渴盼实际记录的总治疗量，含溢出（核心上限15000）");
  }
  if ((pieceCounts["artifact-set:15046"] ?? 0) >= 4) {
    flag("targetSuperconductDebuffActive", "影中：当前目标仍受普通超导减抗状态影响（不是只有冰/雷附着）");
    flag("offField", "本次命中时装备者位于后台（影中后台适用性尚待证据）");
  }
  if ((pieceCounts["artifact-set:15028"] ?? 0) >= 4) number("paradiseLostStacks", "乐园：命中前实际仍有效的反应层数（未知不按0层）", 4);
  return controls;
}

const value = (n: number): FormulaExpression => ({ kind: "constant", value: n });
const variable = (key: string): FormulaExpression => ({ kind: "variable", key });
const multiply = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "multiply", terms });
const term = (key: string, n: number, meaningKey: string, unit = "ratio", origin = "artifact-explicit-hit-context"): EquipmentFormulaInput => ({ key, value: n, meaningKey, unit, origin });
type Scope = Pick<EquipmentDynamicHitBonus, "attackTags"> & { kind: "additive-base" | "critRate" };

/** Restore one explicitly known hit state. Unknown context blocks only matching ordinary hits. */
export type ArtifactRemainingEffectResolution = EquipmentHitEffectResolution & { reactionBonuses: EquipmentReactionBonus[]; pendingReactionEffects: EquipmentPendingReactionEffect[] };
export function resolveArtifactRemainingEffects(args: { setId: string; pieces: number; enabled: boolean; context?: ArtifactConditionalContext; dataset?: EquipmentDataset }): ArtifactRemainingEffectResolution {
  const result: ArtifactRemainingEffectResolution = { additiveBaseBonuses: [], criticalBonuses: [], pendingHitEffects: [], reactionBonuses: [], pendingReactionEffects: [], assumptions: [], effectBlockers: [], missingConditions: [], sourceRefs: [], verification: "provisional" };
  if (!args.enabled || args.pieces < 4) return result;
  const set = equipmentArtifactSets(args.dataset).find(entry => entry.id === args.setId);
  const record = reviewed.find(entry => entry.id === args.setId);
  if (!set || !record) throw new Error(`没有套装 ${args.setId} 的已审阅逐击条款。`);
  if (!Number.isInteger(args.pieces) || args.pieces > 5) throw new Error("套装件数必须为0–5的整数。");
  if (set.slug !== record.slug || set.pieceEffects.find(effect => effect.pieces === 4)?.description !== record.fourPieceDescription) throw new Error(`${set.name}四件套来源改变，须重新审阅。`);
  const refs = [equipmentDescriptionSource("artifacts", set.slug, args.dataset), ...record.sourceRefs];
  result.sourceRefs.push(...refs);
  result.assumptions.push(`${set.name}：仅恢复已选伤害事件的明确来源状态；二件套由原模块另计一次。限定暴击不改全局面板，追加基础伤害不加到ATK、不再乘天赋倍率。此条件快照不生成触发、概率、治疗、计时或消费。`);
  const context = args.context ?? {};
  const pending = (key: string, scope: Scope, reason = `${set.name}缺少显式 ${key}，未知不视为0或未触发。`) => result.pendingHitEffects.push({ id: `${set.id}:4pc:pending:${key}`, label: `${set.name}·${key}`, reason, sourceRefs: refs, ...scope });
  const flag = (key: "echoesRiteActive" | "songWavesActive" | "targetSuperconductDebuffActive" | "offField", scope: Scope): boolean | undefined => {
    const n = context[key];
    if (n === undefined) pending(key, scope);
    else if (typeof n !== "boolean") throw new Error(`${key}必须为明确布尔值。`);
    return n;
  };
  const number = (key: "echoesCurrentAttack" | "songRecordedHealing" | "songRemainingTriggers", scope: Scope): number | undefined => {
    const n = context[key];
    if (n === undefined) pending(key, scope);
    else if (!Number.isFinite(n) || n < 0 || (key === "songRemainingTriggers" && (!Number.isInteger(n) || n > 5))) throw new Error(`${key}必须为非负有限数；剩余次数须为0–5整数。`);
    return n;
  };
  const additive = (suffix: string, expression: FormulaExpression, inputs: EquipmentFormulaInput[], attackTags: EquipmentDynamicHitBonus["attackTags"]) => result.additiveBaseBonuses.push({ id: `${set.id}:4pc:${suffix}`, label: `${set.name}·${suffix}`, expression, inputs, ...(attackTags ? { attackTags } : {}), inputPolicy: "final-panel", sourceRefs: refs });
  const critical = (suffix: string, expression: FormulaExpression, inputs: EquipmentFormulaInput[], attackTags?: EquipmentDynamicHitBonus["attackTags"]) => result.criticalBonuses.push({ id: `${set.id}:4pc:${suffix}`, label: `${set.name}·${suffix}`, target: "critRate", expression, inputs, ...(attackTags ? { attackTags } : {}), inputPolicy: "final-panel", sourceRefs: refs });
  switch (set.slug) {
    case "resolutionofsojourner":
      critical("重击专属暴击率", variable("chargedCritRate"), [term("chargedCritRate", 0.3, "固定四件套的重击暴击率", "ratio", "artifact-fixed-source")], ["charged"]);
      break;
    case "echoesofanoffering": {
      const scope: Scope = { kind: "additive-base", attackTags: ["normal"] };
      const active = flag("echoesRiteActive", scope);
      if (active === undefined) break;
      const offField = active ? flag("offField", scope) : false;
      if (offField === undefined) break;
      if (!active || offField) {
        additive("幽谷祝祀未满足本击资格", multiply(variable("eligible"), variable("coefficient")), [term("eligible", 0, offField ? "来源只允许装备者前台普攻，本击位于后台" : "已明确本击没有幽谷祝祀加值", "boolean"), term("coefficient", 0.7, "来源攻击力转基础伤害比例", "ratio", "artifact-fixed-source")], scope.attackTags);
      } else {
        const attack = number("echoesCurrentAttack", scope);
        if (attack !== undefined) additive("实时攻击力转普攻基数", multiply(variable("currentAttack"), variable("coefficient")), [term("currentAttack", attack, "该命中时装备者实际TotalAtk，非主击先前快照的攻击力", "ATK"), term("coefficient", 0.7, "固定来源基础伤害比例", "ratio", "artifact-fixed-source")], scope.attackTags);
      }
      result.effectBlockers.push("余响36%起始概率、失败后增加20%、0.2秒判定间隔、0.05秒生效窗口及网络/帧行为尚未自动执行；这里只恢复已发生的本击加值，不以概率平均替代真实状态。");
      break;
    }
    case "songofdayspast": {
      const scope: Scope = { kind: "additive-base", attackTags: ["normal", "charged", "plunge", "skill", "burst"] };
      const active = flag("songWavesActive", scope);
      if (active === undefined) break;
      const offField = active ? flag("offField", scope) : false;
      if (offField === undefined) break;
      const remaining = active && !offField ? number("songRemainingTriggers", scope) : 0;
      if (remaining === undefined) break;
      if (!active || offField || remaining === 0) {
        additive("浪潮本击未生效", multiply(variable("eligible"), variable("coefficient")), [term("eligible", 0, !active ? "实际浪潮窗口未生效" : offField ? "本击角色不在前台，不是浪潮的当前受益者" : "本击前次数已耗尽", "boolean"), term("coefficient", 0.08, "来源记录治疗转基础伤害比例", "ratio", "artifact-fixed-source")], scope.attackTags);
      } else {
        const healing = number("songRecordedHealing", scope);
        if (healing !== undefined) additive("记录治疗转命中基数", multiply({ kind: "min", terms: [variable("recordedHealing"), variable("recordingCap")] }, variable("coefficient")), [term("recordedHealing", healing, "该次渴盼实际记录的治疗量，包含溢出及合法合并的装备者贡献", "HP"), term("recordingCap", 15000, "一次渴盼的来源记录上限", "HP", "artifact-fixed-source"), term("coefficient", 0.08, "记录量转基础伤害比例", "ratio", "artifact-fixed-source"), term("remainingBeforeHit", remaining, "本次命中前仍有的生效次数，不在计算器中自动消费", "count")], scope.attackTags);
      }
      result.assumptions.push("此配装入口只恢复装备者自己作为当前前台受益者的一击；可使用合法多装备者合并的同一记录，但不建立他人装备的传递或重复计入多份浪潮。");
      result.effectBlockers.push("昔时6秒治疗收集、转为10秒窗口、五次逐目标消费、共享记录及向其他前台角色传播尚未自动执行；治疗量输入不是本模块执行了治疗或溢出账本。");
      break;
    }
    case "disenchantmentindeepshadow": {
      const scope: Scope = { kind: "critRate" };
      const active = flag("targetSuperconductDebuffActive", scope);
      if (active === undefined) break;
      if (!active) critical("目标普通超导状态未成立", value(0), []);
      else {
        const offField = flag("offField", scope);
        if (offField === true) pending("backgroundSupport", scope, "影中固定来源保留后台适用性TODO；当前只支持明确前台、普通超导目标状态的命中，后台不能猜作已生效或零加成。");
        else if (offField === false) critical("普通超导目标的本击暴击率", multiply(variable("targetAffected"), variable("criticalRate")), [term("targetAffected", 1, "本击目标的普通超导减抗状态仍有效，不是根据冰雷附着猜测", "boolean"), term("criticalRate", 0.16, "目标满足时的本击暴击率", "ratio", "artifact-fixed-source")]);
      }
      result.effectBlockers.push("影中星超导资格、特殊月反应暴击回调与后台适用性仍未覆盖；普通超导80%反应系数由原独立模块另计，不把16%暴击率写入常驻面板或特殊反应。");
      break;
    }
    case "flowerofparadiselost": {
      const reactions = ["bloom", "hyperbloom", "burgeon"] as const;
      const stacks = context.paradiseLostStacks;
      if (stacks === undefined) result.pendingReactionEffects.push({ id: `${set.id}:4pc:pending:stacks`, label: `${set.name}·普通绽放族有效层数`, reactions: [...reactions], reason: "乐园缺少本击前实际有效的0–4层；仅阻塞绽放、超绽放、烈绽放，未知不当零层。", sourceRefs: refs });
      else {
        if (!Number.isInteger(stacks) || stacks < 0 || stacks > 4) throw new Error("paradiseLostStacks必须为0–4整数。");
        result.reactionBonuses.push({ id: `${set.id}:4pc:classic-bloom-family`, label: `${set.name}·普通绽放族反应系数`, value: 0.4 * (1 + 0.25 * stacks), reactions: [...reactions], sourceRefs: refs,
          formula: { expression: multiply(variable("baseBonus"), { kind: "add", terms: [value(1), multiply(variable("perStack"), variable("stacks"))] }),
            inputs: [term("baseBonus", 0.4, "普通绽放、超绽放、烈绽放的基础反应加成", "ratio", "artifact-fixed-source"), term("perStack", 0.25, "每层相对于基础反应加成的提高比例", "ratio", "artifact-fixed-source"), { ...term("stacks", stacks, "本击前实际仍有效的反应层数", "count"), minimum: 0, maximum: 4, integer: true }],
            explanation: "基础40%乘以(1+25%×有效层数)，0层仍有40%，4层为80%；进入普通绽放族反应加成加算项，不是普通增伤或最终独立乘数。" }
        });
      }
      result.effectBlockers.push("乐园的本人反应叠层、1秒触发间隔、持续/刷新与卡肉未自动执行；直接月绽放另用10%基础及每层相对25%，尚未接入该特殊伤害装备协议，不能套普通40%分支。");
      result.assumptions.push("普通三种绽放来源允许后台；层数是当前真实有效状态，不根据反应次数或固定源码共用刷新窗口推定完整生命周期。");
      break;
    }
  }
  return result;
}
