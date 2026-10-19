import type { CalculatorEquipmentReaction, CalculatorFormula } from "../../sim-core/src/calculator-model";
import type { EquipmentEffectElement } from "./equipment-effects";
import type { ArtifactConditionalContext } from "./artifact-conditional-effects";
import { requireEquipmentArtifactSet, type EquipmentDataset } from "./equipment-dataset";
import { equipmentDescriptionSource } from "./equipment-source";
import evidence from "../sources/artifact-reaction-effects/manifest.json";

export interface EquipmentReactionBonus {
  id: string; label: string; value: number; reactions: CalculatorEquipmentReaction[]; sourceRefs: string[];
  /** When present, the shared AST is authoritative; value is a compatibility mirror. */
  formula?: Pick<CalculatorFormula, "expression" | "inputs"> & { explanation: string };
}
export interface EquipmentPendingReactionEffect { id: string; label: string; reactions: CalculatorEquipmentReaction[]; reason: string; sourceRefs: string[] }
export interface EquipmentPendingResistanceEffect { id: string; label: string; elements: EquipmentEffectElement[]; reason: string; sourceRefs: string[] }
export interface EquipmentResistanceReduction { id: string; label: string; value: number; elements: EquipmentEffectElement[]; sourceRefs: string[]; active?: boolean; conditionLabel?: string }
export interface ArtifactReactionEffectResolution {
  reactionBonuses: EquipmentReactionBonus[];
  resistanceReductions: EquipmentResistanceReduction[];
  pendingResistanceEffects: EquipmentPendingResistanceEffect[];
  assumptions: string[]; effectBlockers: string[]; missingConditions: string[]; sourceRefs: string[];
  verification: "provisional";
}
export const SUPPORTED_ARTIFACT_REACTION_IDS = ["artifact-set:15002", "artifact-set:15005", "artifact-set:15006", "artifact-set:15025"] as const;
export const hasArtifactReactionRule = (id: string): boolean => (SUPPORTED_ARTIFACT_REACTION_IDS as readonly string[]).includes(id);
export const artifactReactionSourceEvidence = evidence;
const sourcePaths: Record<string, string> = {
  viridescentvenerer: "internal/artifacts/viridescent/viridescent.go",
  thunderingfury: "internal/artifacts/thunderingfury/thunderingfury.go",
  crimsonwitchofflames: "internal/artifacts/crimson/crimson.go",
  deepwoodmemories: "internal/artifacts/deepwood/deepwood.go"
};

/** Separate reaction-coefficient and enemy-RES terms; never ordinary damage bonuses. */
export function resolveArtifactReactionEffects(args: { setId: string; pieces: number; enabled: boolean; context?: ArtifactConditionalContext; dataset?: EquipmentDataset }): ArtifactReactionEffectResolution {
  const result: ArtifactReactionEffectResolution = { reactionBonuses: [], resistanceReductions: [], pendingResistanceEffects: [], assumptions: [], effectBlockers: [], missingConditions: [], sourceRefs: [], verification: "provisional" };
  const set = requireEquipmentArtifactSet(args.setId, args.dataset);
  if (!Number.isInteger(args.pieces) || args.pieces < 0 || args.pieces > 5) throw new Error("套装件数必须为0–5整数。");
  if (!args.enabled || args.pieces < 4) return result;
  const record = evidence.activeCatalog.records.find(entry => entry.id === set.id);
  if (!record || !sourcePaths[set.slug]) throw new Error(`${set.name}没有已审阅的反应或减抗规则。`);
  if (set.pieceEffects.find(effect => effect.pieces === 4)?.description !== record.fourPieceDescription) throw new Error(`${set.name}来源文案已改变，必须重新核验反应与减抗映射。`);
  const refs = [equipmentDescriptionSource("artifacts", set.slug, args.dataset), evidence.files.find(file => file.upstreamPath === sourcePaths[set.slug])!.url];
  result.sourceRefs.push(...refs);
  const context = args.context ?? {};
  const reaction = (suffix: string, value: number, reactions: CalculatorEquipmentReaction[]) => result.reactionBonuses.push({ id: `${set.id}:4pc:${suffix}`, label: `${set.name}·${suffix}`, value, reactions, sourceRefs: refs });
  const resistance = (element: EquipmentEffectElement, value: number, key: keyof ArtifactConditionalContext, label: string): void => {
    const active = context[key];
    if (active === undefined) { const reason = `${set.name}缺少显式 ${key}：请确认${label}。`; result.pendingResistanceEffects.push({ id: `${set.id}:4pc:res:${element}`, label: `${set.name}·${element}减抗`, elements: [element], reason, sourceRefs: refs }); return; }
    if (typeof active !== "boolean") throw new Error(`${key} 必须是明确的是／否。`);
    result.resistanceReductions.push({ id: `${set.id}:4pc:res:${element}`, label: `${set.name}·${element}减抗`, value, elements: [element], active, conditionLabel: label, sourceRefs: refs });
  };
  switch (set.slug) {
    case "viridescentvenerer":
      reaction("普通扩散反应系数", 0.6, ["swirlPyro", "swirlHydro", "swirlCryo", "swirlElectro"]);
      resistance("pyro", 0.4, "vvPyroResActive", "当前目标由普通扩散触发的火减抗仍有效");
      resistance("hydro", 0.4, "vvHydroResActive", "当前目标由普通扩散触发的水减抗仍有效");
      resistance("cryo", 0.4, "vvCryoResActive", "当前目标由普通扩散触发的冰减抗仍有效");
      resistance("electro", 0.4, "vvElectroResActive", "当前目标由普通扩散触发的雷减抗仍有效");
      result.assumptions.push("翠绿恢复本目标逐元素仍有效的普通扩散减抗；触发时须装备者在场，触发后退场不立即清除。这里不生成10秒窗口、扩散传播或卡肉延长。同名同元素只保留一项，不叠加两次40%。");
      result.effectBlockers.push("翠绿7.1星扩散20%及星扩散触发冰减抗缺少固定参考实现对应标签／事件，未映射；不冒充普通冰扩散。");
      break;
    case "deepwoodmemories":
      resistance("dendro", 0.3, "setEffectActive", "当前目标深林8秒草减抗仍有效");
      result.assumptions.push("深林恢复本目标仍有效的草减抗；已合法由装备者战技／爆发命中触发，可在后台触发。这里不生成8秒窗口或到期事件，同名草减抗不重复叠加。");
      break;
    case "thunderingfury":
      reaction("常规剧变反应系数", 0.4, ["overload", "electroCharged", "superconduct", "hyperbloom"]);
      reaction("超激化加算反应系数", 0.2, ["aggravate"]);
      result.effectBlockers.push("如雷月感电20%已有固定源码证据，但直接／间接月感电的装备归属尚未接入此普通反应协议；星超导20%缺少固定参考标签。两者均不套用普通感电／超导奖励。", "如雷1秒战技减冷却与0.8秒触发间隔、前台所有者资格仍未接入事件调度；没有由此生成回能。");
      break;
    case "crimsonwitchofflames":
      reaction("常规剧变反应系数", 0.4, ["overload", "burning", "burgeon"]);
      reaction("蒸发融化反应系数", 0.15, ["melt", "reverseMelt", "vaporize", "reverseVaporize"]);
      result.assumptions.push("魔女反应系数与战技火伤叠层独立；零层时仍有符合种类的反应奖励，火伤叠层由原条件公式另行执行一次。");
      break;
  }
  result.assumptions.push("反应奖励进入对应反应系数的加算项；减抗在命中元素对应的敌人RES步骤扣除，均不进入普通增伤乘区。此结果为显式条件计算，未升级为自动事件覆盖或官服独立验证。");
  return result;
}
