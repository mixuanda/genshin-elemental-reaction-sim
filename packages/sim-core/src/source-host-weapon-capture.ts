/** Counterfactual arithmetic for a source-owned weapon proc already captured on one hit. */
import { replaySourceHostHit } from "./source-host-capture";
import { resolveSourceHostRequest, type SourceHostCalculation } from "./source-host-formula";
import { resolveSourceHostWeaponAdditiveInput, sourceHostWeaponAdditiveInputSchema, type SourceHostWeaponAdditiveInput } from "./source-host-weapon-formula";
import type { CalculationTraceNode } from "./calculation-trace";
import type { SourceHostCalculationRecord, SourceHostOutgoingRequest } from "./source-host-wire";

export type SourceHostWeaponAdditiveEditResult =
  | { status: "calculated"; originalValue: number; editedValue: number; formulaTrace: CalculationTraceNode[];
      originalRawDamage: number; editedRawDamage: number; editedRequest: SourceHostOutgoingRequest; calculation: SourceHostCalculation }
  | { status: "blocked"; originalValue: number; editedValue: number; formulaTrace: CalculationTraceNode[];
      originalRawDamage: number; reason: string };

/** The original statRead remains historical evidence. The edited statValue is a
 * separate formula input, and this helper does not replay native weapon state. */
export function deriveSourceHostWeaponAdditiveEdit(rawCapture: unknown, calculationId: number, rawInput: unknown): SourceHostWeaponAdditiveEditResult {
  const capture = replaySourceHostHit(rawCapture).captured;
  const original = capture.components.find(row => row.request.id === calculationId);
  if (original?.request.kind !== "weapon-additive") throw new Error(`捕获未引用武器附加值共享公式 #${calculationId}`);
  const input: SourceHostWeaponAdditiveInput = sourceHostWeaponAdditiveInputSchema.parse(rawInput);
  if (input.ruleId !== original.request.input.ruleId) throw new Error("武器公式独立编辑不能更换原装备规则。");
  const formula = resolveSourceHostWeaponAdditiveInput(input, capture.sourceCommit, `weaponAdditive.${calculationId}.edit`);
  const formulaTrace = formula.trace.map(node => ({ ...node,
    explanationKey: `独立上游公式实验；不表示 Go 已重新触发武器或读取编辑后的属性。${node.explanationKey}`,
    inputs: node.inputs.map(value => value.key === "refinement" || value.key === "statValue"
      ? { ...value, origin: "user-edited-weapon-experiment", meaningKey: value.key === "refinement"
        ? "用户在独立实验中输入的精炼等级" : "用户在独立实验中输入的属性值；原始 statRead 保持不变" } : value),
  }));
  const common = { originalValue: original.value, editedValue: formula.value, formulaTrace,
    originalRawDamage: capture.application.rawDamage };
  const blocked = (reason: string): SourceHostWeaponAdditiveEditResult => ({ status: "blocked", ...common, reason });
  const request: SourceHostOutgoingRequest = structuredClone(capture.calculation.request);
  if (request.kind !== "damage" || request.damageCategory !== "ordinary") return blocked("此武器项进入特殊或非普通伤害路径；不能只改写终端 FlatDmg 来宣称重算完整命中。");
  const applied = request.componentApplications.filter(row => row.id === calculationId);
  if (applied.length !== 1 || !request.componentIds.includes(calculationId) || applied[0]!.multiplier !== 1
    || applied[0]!.amount !== original.value) return blocked("原生武器返回值未唯一、直接、等额地加进本击 FlatDmg。");
  const records: SourceHostCalculationRecord[] = [...(capture.supportingCalculations ?? []), ...capture.components];
  const lookup = new Map(records.map(row => [row.request.id, row]));
  if (lookup.size !== records.length) throw new Error("来源武器捕获包含重复计算 ID。");
  const difference = formula.value - original.value;
  request.input.flatDamage += difference;
  applied[0]!.amount = formula.value;
  const calculation = resolveSourceHostRequest(request, lookup, {
    explicitFinalScaling: difference !== 0,
    weaponEdit: { id: calculationId, value: formula.value, trace: formulaTrace },
  });
  return { status: "calculated", ...common, editedRawDamage: calculation.value, editedRequest: request, calculation };
}
