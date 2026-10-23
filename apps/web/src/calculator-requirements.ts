import {gamingRequirementAdapter} from './calculator-gaming-controls';
import {xiaoRequirementAdapter} from "./calculator-xiao-controls";
import {tighnariRequirementAdapter} from './calculator-tighnari-controls';
import {kinichRequirementAdapter} from './calculator-kinich-controls';
import {cynoRequirementAdapter} from './calculator-cyno-controls';
import {arlecchinoRequirementAdapter} from './calculator-arlecchino-controls';
import {hutaoRequirementAdapter} from './calculator-hutao-controls';
import {kazuhaBurstRequirementAdapter} from './calculator-kazuha-controls';
import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";

export interface CalculatorFieldRequirement {
  id: string;
  adapterId: string;
  fieldPath: string;
  controlSelector: string;
  label: string;
  explanation: string;
  status: "input-required" | "condition-not-satisfied" | "missing-control";
  dependencyIds: string[];
  hitIds: string[];
}

export interface CalculatorBlockerRequirement {
  id: string;
  dependencyId?: string;
  reason: string;
  hitIds: string[];
  fieldPaths: string[];
  status: "linked-controls" | "missing-control" | "unsupported";
}

export interface CalculatorRequirements {
  fields: CalculatorFieldRequirement[];
  /** Original reasons remain visible even when one or more fields have links.
   * A link does not certify that every condition in a dependency is covered. */
  blockers: CalculatorBlockerRequirement[];
}

export type CalculatorFieldRequirementDraft = Omit<CalculatorFieldRequirement, "adapterId" | "status"> & {
  status: Exclude<CalculatorFieldRequirement["status"], "missing-control">;
};

/** Each adapter describes existing fields and controls. It never supplies a
 * value, changes the document, or derives a trigger from a reaction selection. */
export interface CalculatorRequirementAdapter {
  id: string;
  applies(document: CalculatorDocument): boolean;
  collect(document: CalculatorDocument): CalculatorFieldRequirementDraft[];
}

export interface CalculatorRequirementOptions {
  adapters?: readonly CalculatorRequirementAdapter[];
  /** The UI can check its rendered controls without making this module depend
   * on a DOM. A missing control remains an explicit, actionable integration gap. */
  isControlAvailable?(selector: string): boolean;
}

const selectedOrdinaryHits = (document: CalculatorDocument) => document.hits.filter(
  hit => hit.kind === "ordinary" && document.selectedHitIds.includes(hit.id),
);

// Escape a CSS quoted attribute value, including imported hit identifiers.
const attributeSelector = (element: string, attribute: string, value: string): string => {
  const escaped = value.replace(/["\\\u0000-\u001f\u007f]/g, character => `\\${character.codePointAt(0)!.toString(16)} `);
  return `${element}[${attribute}="${escaped}"]`;
};

const keqingAdapter: CalculatorRequirementAdapter = {
  id: "keqing-burst-conditions",
  applies: document => document.gameContext?.skillId === "keqing-burst-complete-cast" && document.gameContext.keqingBurst !== undefined,
  collect(document) {
    const game = document.gameContext!, context = game.keqingBurst!, hits = selectedOrdinaryHits(document);
    const requirements: CalculatorFieldRequirementDraft[] = [];
    const dependencyId = (hitId: string) => `keqing-burst-context:${hitId}`;
    if (document.scope === "one-cast" && document.selectedHitIds.length > 1 && !context.statsStableAcrossHits && hits.length) {
      requirements.push({
        id: "keqing-burst:statsStableAcrossHits", fieldPath: "gameContext.keqingBurst.statsStableAcrossHits",
        controlSelector: "#calc-keqing-stats-stable", label: "基础面板及 C4/C6 以外的装备、目标状态",
        explanation: "多击共用面板需要这些实际条件稳定；不稳定时可单选一击，使用该击的实际面板。",
        status: "condition-not-satisfied", dependencyIds: hits.map(hit => dependencyId(hit.id)), hitIds: hits.map(hit => hit.id),
      });
    }
    for (const hit of hits) {
      const state = context.hitStates[hit.id] ?? {}, prefix = `gameContext.keqingBurst.hitStates.${hit.id}`;
      const add = (key: string, label: string, explanation: string, numeric = false): void => {
        const fieldPath = `${prefix}.${key}`;
        requirements.push({
          id: `keqing-burst:${hit.id}:${key}`, fieldPath,
          controlSelector: attributeSelector(numeric ? "input" : "select", numeric ? "data-field" : "data-keqing-state-field", fieldPath),
          label, explanation, status: "input-required", dependencyIds: [dependencyId(hit.id)], hitIds: [hit.id],
        });
      };
      if (game.constellation >= 4) {
        if (state.c4Active === undefined) add("c4Active", "本击快照时 C4 有效", "填写该击实际快照时的状态；选择激化等反应不证明 C4 已在快照前触发。");
        if (state.c4IncludedInPanel === undefined) add("c4IncludedInPanel", "共享 ATK 输入已包含 C4 的25%基础攻击", "说明当前共享攻击面板已计入的份额，核心只补加或移除差值。");
        if (document.build.mode !== "equipment-derived" && state.c4Active !== undefined && state.c4IncludedInPanel !== undefined
          && state.c4Active !== state.c4IncludedInPanel && state.baseAttack === undefined) {
          add("baseAttack", "该面板基础攻击（不是最终 ATK）", "C4 份额需要调整；提供该面板的角色基础攻击与武器基础攻击之和，不能从最终 ATK 反推。", true);
        }
      }
      if (game.constellation >= 6) {
        const categories = [
          ["c6NormalActive", "本击 C6 普攻类别有效"],
          ["c6ChargedActive", "本击 C6 重击类别有效"],
          ["c6SkillActive", "本击 C6 初次 E 类别有效"],
        ] as const;
        for (const [key, label] of categories) if (state[key] === undefined) {
          add(key, label, "填写本击快照时该类别的实际状态；本次 Q 类别由已有来源规则自动计入，不要求重复选择。");
        }
        if (state.c6IncludedStacks === undefined) add("c6IncludedStacks", "本击已填增伤中含有的 C6 类别数（0–4）", "提供本击增伤输入已经包含的类别数；明确未包含时填 0。", true);
      }
    }
    return requirements;
  },
};

const xingqiuAdapter: CalculatorRequirementAdapter = {
  id: "xingqiu-skill-conditions",
  applies: document => document.gameContext?.skillId === "xingqiu-skill-complete-cast" && document.gameContext.xingqiuSkill !== undefined,
  collect(document) {
    const context = document.gameContext!.xingqiuSkill!, hits = selectedOrdinaryHits(document);
    if (context.statsStableAcrossHits || !hits.length) return [];
    return [{
      id: "xingqiu-skill:statsStableAcrossHits", fieldPath: "gameContext.xingqiuSkill.statsStableAcrossHits",
      controlSelector: "#calc-xingqiu-stats-stable", label: "两段取样之间的面板状态",
      explanation: "两段在不同命中任务取样；当前共用面板分支要求面板、装备及目标状态实际稳定。不稳定时仍保留本项阻塞。",
      status: "condition-not-satisfied", dependencyIds: ["xingqiu-skill-context:conditions"], hitIds: hits.map(hit => hit.id),
    }];
  },
};

const wandererInitialAdapter: CalculatorRequirementAdapter = {
  id: "wanderer-initial-skill-conditions",
  applies: document => document.gameContext?.skillId === "idle-wanderer-skill-c0" && document.scope === "single-hit",
  collect(document) {
    const hits = selectedOrdinaryHits(document);
    if (!hits.length) return [];
    const state = document.gameContext!.idleStanceCast?.wanderer;
    return ([
      ["noAbsorption", "本次 E 没有水／火／冰／雷元素吸收", "A1及C4吸收可在初击快照前增加攻击或暴击；只在本次实际无吸收时选是。"],
      ["panelExcludesAbsorptionBonuses", "输入面板没有未触发的吸收攻击／暴击增益", "确认本击使用的实际面板未计入未触发的吸收增益；不能把未知状态当作没有。"],
    ] as const).flatMap(([key, label, explanation]) => {
      if (state?.[key] === true) return [];
      const fieldPath = `gameContext.idleStanceCast.wanderer.${key}`;
      return [{
        id: `wanderer-initial:${key}`, fieldPath,
        controlSelector: attributeSelector("select", "data-source-cast-state-field", fieldPath),
        label, explanation, status: state?.[key] === undefined ? "input-required" as const : "condition-not-satisfied" as const,
        dependencyIds: hits.map(hit => `idle-stance:${hit.id}`), hitIds: hits.map(hit => hit.id),
      }];
    });
  },
};

const durinAdapter: CalculatorRequirementAdapter = {
  id: "durin-skill-conditions",
  applies: document => document.gameContext?.durinSkill !== undefined,
  collect(document) {
    const game = document.gameContext!, context = game.durinSkill!, hits = selectedOrdinaryHits(document);
    const fields: CalculatorFieldRequirementDraft[] = [];
    if (hits.length > 1 && context.statsStableAcrossHits !== true) {
      const fieldPath = "gameContext.durinSkill.statsStableAcrossHits";
      fields.push({id:"durin-skill:statsStableAcrossHits",fieldPath,
        controlSelector:attributeSelector("select","data-source-cast-state-field",fieldPath),
        label:"这几击的其余面板、装备和目标状态保持不变",explanation:"黑E合计使用共同面板；状态变化时应单选一击并提供该击面板。C2仍逐击判断。",
        status:"condition-not-satisfied",dependencyIds:["durin-skill:conditions"],hitIds:hits.map(hit=>hit.id)});
    }
    if (game.constellation === 2) for (const hit of hits) {
      const hitState = context.hitStates?.[hit.id];
      for (const [key,label,explanation] of [
        ["c2PyroBonusActive","本击的 C2 火伤增益仍在生效","Q持续期间触发相关反应后生效6秒；本页没有触发轴，需要该击实际状态。"],
        ["c2PyroBonusIncluded","本击的增伤输入已经计入 C2 火伤","已含时不重复加算；明确未含才选择否。"],
      ] as const) {
        if (hitState?.[key] !== undefined) continue;
        const fieldPath = `gameContext.durinSkill.hitStates.${hit.id}.${key}`;
        fields.push({id:`durin-skill:${hit.id}:${key}`,fieldPath,
          controlSelector:attributeSelector("select","data-source-cast-state-field",fieldPath),label,explanation,
          status:"input-required",dependencyIds:[`durin-skill:${hit.id}`],hitIds:[hit.id]});
      }
    }
    return fields;
  },
};

/** Extend with another sourced adapter and its existing control selectors. */
export const CALCULATOR_REQUIREMENT_ADAPTERS: readonly CalculatorRequirementAdapter[] = [arlecchinoRequirementAdapter,hutaoRequirementAdapter,keqingAdapter, xingqiuAdapter, wandererInitialAdapter, durinAdapter,kazuhaBurstRequirementAdapter,cynoRequirementAdapter,kinichRequirementAdapter,gamingRequirementAdapter,tighnariRequirementAdapter,xiaoRequirementAdapter];

/** Supplement the calculator's result blockers with concrete field links.
 * Uncovered dependency/blocked-hit reasons stay explicit; this is not a
 * replacement for calculateDocument or its formula/equipment validation. */
export function collectCalculatorRequirements(document: CalculatorDocument, options: CalculatorRequirementOptions = {}): CalculatorRequirements {
  const fields: CalculatorFieldRequirement[] = [];
  for (const adapter of options.adapters ?? CALCULATOR_REQUIREMENT_ADAPTERS) {
    if (!adapter.applies(document)) continue;
    for (const draft of adapter.collect(document)) fields.push({
      ...draft, adapterId: adapter.id,
      status: options.isControlAvailable?.(draft.controlSelector) === false ? "missing-control" : draft.status,
    });
  }

  const blockers: CalculatorBlockerRequirement[] = [];
  const selectedHits = document.hits.filter(hit => document.selectedHitIds.includes(hit.id));
  const dependencyIds = [...new Set(selectedHits.flatMap(hit => hit.dependencies))];
  for (const dependencyId of dependencyIds) {
    const dependency = document.dependencies.find(row => row.id === dependencyId);
    if (dependency && dependency.status !== "missing") continue;
    const linked = fields.filter(field => field.dependencyIds.includes(dependencyId));
    blockers.push({
      id: `dependency:${dependencyId}`, dependencyId,
      reason: dependency?.reason ?? `缺少所需依赖记录：${dependencyId}`,
      hitIds: selectedHits.filter(hit => hit.dependencies.includes(dependencyId)).map(hit => hit.id),
      fieldPaths: linked.map(field => field.fieldPath),
      status: linked.length === 0 ? "unsupported" : linked.some(field => field.status === "missing-control") ? "missing-control" : "linked-controls",
    });
  }
  for (const hit of selectedHits) if (hit.kind === "blocked") for (const [index, reason] of hit.reasons.entries()) {
    blockers.push({ id: `blocked-hit:${hit.id}:${index}`, reason, hitIds: [hit.id], fieldPaths: [], status: "unsupported" });
  }
  return { fields, blockers };
}
