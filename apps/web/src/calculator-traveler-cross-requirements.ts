import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";
import type { CalculatorRequirementAdapter } from "./calculator-requirements";

const anemoActions = new Set([
  "traveler-cross-aether-anemo-burst-c0",
  "traveler-cross-lumine-anemo-burst-c0",
]);
const applies = (document: CalculatorDocument): boolean => document.scope === "single-hit"
  && anemoActions.has(document.gameContext?.skillId ?? "");

/** Describes the existing single-hit story condition only. It never fills an
 * event, target, snapshot or future lifecycle, and does not broaden C0 support. */
export const travelerCrossRequirementAdapter: CalculatorRequirementAdapter = {
  id: "traveler-cross-anemo-single-hit-conditions",
  applies,
  collect(document) {
    if (!applies(document) || document.gameContext!.constellation !== 0) return [];
    const hits = document.hits.filter(hit => hit.kind === "ordinary" && document.selectedHitIds.includes(hit.id));
    if (!hits.length) return [];
    const value = document.gameContext!.travelerCrossEntityCast?.trueMoonStoryBuffInactive;
    if (value === true) return [];
    const fieldPath = "gameContext.travelerCrossEntityCast.trueMoonStoryBuffInactive";
    return [{
      id: "traveler-cross:trueMoonStoryBuffInactive", fieldPath,
      controlSelector: `select[data-source-cast-state-field="${fieldPath}"]`,
      label: "本击没有「真月」剧情限定增益",
      explanation: "只按这次实际命中的状态确认；若当时有该剧情增益，本入口继续阻塞。不会从地区、剧情进度或当前面板推断，也不要求未来命中记录。",
      status: value === undefined ? "input-required" : "condition-not-satisfied",
      dependencyIds: ["traveler-cross-entity:schedule"], hitIds: hits.map(hit => hit.id),
    }];
  },
};
