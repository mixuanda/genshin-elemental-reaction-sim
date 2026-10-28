import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { observedPlungeContextSchema } from "../../../packages/sim-core/src/observed-plunge-context";
import { isObservedPlungeAction } from "../../../packages/sim-core/src/observed-plunge-formulas";
import type { CalculatorFieldRequirementDraft, CalculatorRequirementAdapter } from "./calculator-requirements";

const path = (key: string) => `gameContext.observedPlunge.${key}`;

/** Describes existing observed-plunge controls without supplying observations.
 * Explicit misses/zero opportunities are valid answers, not unmet conditions.
 */
export function collectObservedPlungeRequirements(document: CalculatorDocument): CalculatorFieldRequirementDraft[] {
  if (!isObservedPlungeAction(document)) return [];
  const selected = document.hits.filter(hit => document.selectedHitIds.includes(hit.id));
  if (!selected.length) return [];
  const context = observedPlungeContextSchema.parse(document.gameContext?.observedPlunge ?? {});
  const fields: CalculatorFieldRequirementDraft[] = [];
  const dependencyIds = [document.scope === "single-hit" ? "observed-plunge:physical" : "observed-plunge:schedule"];
  const hitIds = selected.map(hit => hit.id);
  const add = (key: string, label: string, explanation: string,
    status: "input-required" | "condition-not-satisfied" = "input-required", numeric = false) => {
    const fieldPath = path(key);
    fields.push({ id: `observed-plunge:${key}`, fieldPath,
      controlSelector: numeric ? `input[data-field="${fieldPath}"]` : `select[data-source-cast-state-field="${fieldPath}"]`,
      label, explanation, status, dependencyIds, hitIds });
  };
  if (context.noExternalInfusion !== true) add("noExternalInfusion", "本次实际没有外部附魔",
    "仅在实际没有外部附魔、保持来源物理下落时选是；未知不等于没有，实际有附魔时此分支仍不能计算。",
    context.noExternalInfusion === undefined ? "input-required" : "condition-not-satisfied");
  // One selected already-occurred hit does not depend on a future trajectory.
  if (document.scope === "single-hit") return fields;
  if (context.collisionCount === undefined) add("collisionCount", "途中实际碰撞机会次数",
    "填写实际观察的0–64次机会；低空／高空不决定次数，明确没有机会时填0，未知请留空。", "input-required", true);
  if (context.landingContact === undefined) add("landingContact", "落地冲击实际接触所选目标",
    "按实际接触选择是或否；明确未接触是有效答案，不会按落地倍率制造伤害。请勿从碰撞次数反推落地接触。");
  const possibleIds: string[] = [];
  if (context.collisionCount !== undefined) for (let index = 1; index <= context.collisionCount; index++) {
    const contact = context.collisionContacts?.[String(index)];
    if (contact === undefined) add(`collisionContacts.${index}`, `第 ${index} 次碰撞实际接触所选目标`,
      "每次机会分别说明是否接触此目标；否表示本机会未命中，不是缺失观察，也不会自动变成是。");
    if (contact !== false) possibleIds.push(`${document.gameContext!.skillId}:collision-${index}`);
  }
  if (context.landingContact !== false) possibleIds.push(`${document.gameContext!.skillId}:landing`);
  if (possibleIds.length > 1 && context.statsStableAcrossHits !== true) {
    const missingHistory = possibleIds.some(id => {
      const hit = document.hits.find(candidate => candidate.id === id);
      return hit?.kind !== "ordinary" || !hit.finalSnapshot || hit.finalSnapshot.origin === "equipment-conversion";
    });
    if (missingHistory) add("statsStableAcrossHits", "各次接触时的面板和目标条件保持稳定",
      "仅在实际稳定时使用共同面板；实际变化请保留否并填写逐击历史面板，不能复制当前构筑冒充过去快照。",
      context.statsStableAcrossHits === undefined ? "input-required" : "condition-not-satisfied");
    if (context.targetConditionsStableAcrossHits !== true) add("targetConditionsStableAcrossHits", "各次命中的目标防御与抗性条件稳定",
      "逐击历史面板只保存进攻数值；目标条件仍须实际稳定，未知或发生变化时不能默认为稳定。",
      context.targetConditionsStableAcrossHits === undefined ? "input-required" : "condition-not-satisfied");
  }
  return fields;
}

export const observedPlungeRequirementAdapter: CalculatorRequirementAdapter = {
  id: "observed-plunge-conditions",
  applies: isObservedPlungeAction,
  collect: collectObservedPlungeRequirements,
};
