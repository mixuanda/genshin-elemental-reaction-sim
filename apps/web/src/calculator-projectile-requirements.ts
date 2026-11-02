import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";
import type { CalculatorFieldRequirementDraft, CalculatorRequirementAdapter } from "./calculator-requirements";

const actionIds = new Set(["neuvillette-skill", "neuvillette-skill-complete-cast-c0-arkhe-ready"]);
const isNeuvilletteProjectile = (document: CalculatorDocument): boolean =>
  document.gameContext?.characterId === "character:10000087" && actionIds.has(document.gameContext.skillId);
const prefix = "gameContext.batchProjectileCast";
const dependencyPrefix = "batch-projectile-cast:";
const selector = (attribute: string, value: string): string => {
  const escaped = value.replace(/["\\\u0000-\u001f\u007f]/g, character => `\\${character.codePointAt(0)!.toString(16)} `);
  return `${attribute === "data-field" ? "input" : "select"}[${attribute}="${escaped}"]`;
};

/** Describes only the existing E HP/A4 inputs, using the same sharing and
 * historical-snapshot rules as prepareBatchProjectileCastDocument. */
export const neuvilletteProjectileRequirementAdapter: CalculatorRequirementAdapter = {
  id: "neuvillette-projectile-conditions",
  applies: isNeuvilletteProjectile,
  collect(document) {
    if (!isNeuvilletteProjectile(document) || document.gameContext!.constellation !== 0) return [];
    const hits = document.hits.filter(hit => hit.kind === "ordinary" && document.selectedHitIds.includes(hit.id));
    if (!hits.length) return [];
    const context = document.gameContext!.batchProjectileCast ?? {};
    const fields: CalculatorFieldRequirementDraft[] = [];
    const fullCast = document.scope === "one-cast" && document.hits.every(hit => document.selectedHitIds.includes(hit.id));
    if (fullCast && context.statsStableAcrossHits !== true) {
      const fieldPath = `${prefix}.statsStableAcrossHits`;
      fields.push({
        id: "neuvillette-projectile:statsStableAcrossHits", fieldPath,
        controlSelector: selector("data-source-cast-state-field", fieldPath),
        label: "所选命中的其余面板、装备及目标条件保持稳定",
        explanation: "完整两击分支需要实际条件稳定；不稳定时可选择已经发生的一击并填写该击的实际面板。",
        status: context.statsStableAcrossHits === undefined ? "input-required" : "condition-not-satisfied",
        dependencyIds: [`${dependencyPrefix}stable-other-context`], hitIds: hits.map(hit => hit.id),
      });
    }
    const byPath = new Map<string, CalculatorFieldRequirementDraft>();
    const missingAscensionHitIds: string[] = [];
    for (const hit of hits) {
      if (hit.kind !== "ordinary") continue;
      const own = context.hitStates?.[hit.id] ?? {};
      const usesShared = context.statsStableAcrossHits === true && !hit.finalSnapshot;
      const state = { ...(usesShared ? context.sharedState : undefined), ...own };
      const ascension = hit.finalSnapshot?.ascension
        ?? (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension)
        ?? document.gameContext!.ascension;
      if (ascension === undefined) missingAscensionHitIds.push(hit.id);
      for (const key of ["actualHpRatio", "includedHydroBonus"] as const) {
        if (state[key] !== undefined || key === "actualHpRatio" && ascension !== undefined && ascension < 4) continue;
        // An explicit per-hit key always overrides sharing, including an
        // unanswered in-memory value. Historical samples never borrow sharing.
        const statePath = usesShared && !Object.hasOwn(own, key) ? "sharedState" : `hitStates.${hit.id}`;
        const fieldPath = `${prefix}.${statePath}.${key}`;
        let field = byPath.get(fieldPath);
        if (!field) {
          field = {
            id: `neuvillette-projectile:${statePath}:${key}`, fieldPath,
            controlSelector: selector("data-field", fieldPath),
            label: key === "actualHpRatio" ? "本击取样时的实际生命比例（0–1）" : "输入增伤已含的 A4 水伤份额（小数）",
            explanation: key === "actualHpRatio"
              ? "A4 按本击实际取样生命比例计算；未知不能默认满血。历史快照须填写自身逐击条件。"
              : "填写输入面板已经包含的 A4 水伤；明确未含才填 0，核心只补实际份额与已含份额的差值。",
            status: "input-required", dependencyIds: [], hitIds: [],
          };
          byPath.set(fieldPath, field);
          fields.push(field);
        }
        field.dependencyIds.push(`${dependencyPrefix}${hit.id}`);
        field.hitIds.push(hit.id);
      }
    }
    if (missingAscensionHitIds.length) fields.unshift({
      id: "neuvillette-projectile:ascension",
      fieldPath: document.build.mode === "equipment-derived" ? "gameContext.ascension" : "build.ascension",
      controlSelector: "#calc-ascension", label: "本击实际突破阶段（0–6）",
      explanation: "需要明确实际突破阶段，才能判定 A4 是否解锁；未知不能按未解锁处理，也不从当前生命比例推断。",
      status: "input-required",
      dependencyIds: missingAscensionHitIds.map(id => `${dependencyPrefix}${id}`), hitIds: missingAscensionHitIds,
    });
    return fields;
  },
};
