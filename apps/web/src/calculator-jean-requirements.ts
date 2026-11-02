import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";
import type { CalculatorFieldRequirementDraft, CalculatorRequirementAdapter } from "./calculator-requirements";

const isJeanBoundaryBurst = (document: CalculatorDocument): boolean =>
  document.gameContext?.characterId === "character:10000003"
  && document.gameContext.skillId === "jean-burst-two-boundaries-complete-c0";

/** Links the existing finite-cast declarations; never confirms hits or changes
 * selection, constellation, snapshots, formulas, or any input value. */
export const jeanRequirementAdapter: CalculatorRequirementAdapter = {
  id: "jean-burst-conditions",
  applies: isJeanBoundaryBurst,
  collect(document) {
    if (!isJeanBoundaryBurst(document) || document.gameContext!.constellation !== 0) return [];
    const selected = document.hits.filter(hit => document.selectedHitIds.includes(hit.id));
    const ordinary = selected.filter(hit => hit.kind === "ordinary");
    if (!ordinary.length) return [];
    const context = document.gameContext!.batchFiniteCast ?? {};
    // Match prepareBatchFiniteCastDocument: completeness is required only for
    // the whole one-cast set; stability is required for any multi-hit selection.
    const fullCast = document.scope === "one-cast"
      && document.hits.every(hit => document.selectedHitIds.includes(hit.id));
    const hitIds = ordinary.map(hit => hit.id);
    const dependencyIds = hitIds.map(id => `batch-finite-context:${id}`);
    const fields: CalculatorFieldRequirementDraft[] = [];
    const add = (key: "completeCastConfirmed" | "statsStableAcrossHits", label: string, explanation: string): void => {
      if (context[key] === true) return;
      const fieldPath = `gameContext.batchFiniteCast.${key}`;
      fields.push({
        id: `jean-burst:${key}`, fieldPath,
        controlSelector: `select[data-source-cast-state-field="${fieldPath}"]`,
        label, explanation,
        status: context[key] === undefined ? "input-required" : "condition-not-satisfied",
        dependencyIds, hitIds,
      });
    };
    if (fullCast) add("completeCastConfirmed", "初击与领域起终两次边界伤害都实际命中",
      "本分支共三次风伤，期间没有其他进出领域命中。只按实际情况确认；不能确定完整集合时，可选择实际发生的一击。");
    if (selected.length > 1) add("statsStableAcrossHits", "所选几击的面板、装备及目标条件保持稳定",
      "三击共用起手进攻快照，目标条件仍须符合所填值。条件变化时可单选一击并填写该击实际条件，不能用当前面板代替未知状态。");
    return fields;
  },
};
