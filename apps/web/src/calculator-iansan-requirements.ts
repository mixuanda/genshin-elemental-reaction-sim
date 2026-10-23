import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";
import type { IansanSwiftResolvedHitState } from "../../../packages/sim-core/src/iansan-swift-resolved-context";
import type { CalculatorFieldRequirementDraft, CalculatorRequirementAdapter } from "./calculator-requirements";

const SKILL = "iansan-swift-resolved-c0";
const TEMPLATE_HIT = `${SKILL}-swift`;
const PREFIX = "iansan-swift-resolved:";
const path = (key: string) => `gameContext.iansanSwiftResolvedCast.${key}`;
const isSwift = (document: CalculatorDocument) => document.gameContext?.characterId === "character:10000110"
  && document.gameContext.skillId === SKILL;

/** Links existing controls only. Unknown observations, false conditions and
 * explicit zero amounts remain distinct; no entry qualification is inferred. */
export function collectIansanSwiftRequirements(document: CalculatorDocument): CalculatorFieldRequirementDraft[] {
  if (!isSwift(document) || document.gameContext!.constellation !== 0
    || document.gameContext!.abilityId !== "talent:iansan:combat1") return [];
  const selected = document.hits.filter(hit => document.selectedHitIds.includes(hit.id));
  if (!selected.length) return [];
  const context = document.gameContext!.iansanSwiftResolvedCast ?? {};
  const fields: CalculatorFieldRequirementDraft[] = [];
  const add = (key: string, label: string, explanation: string,
    dependencyIds: string[], hitIds: string[],
    status: CalculatorFieldRequirementDraft["status"] = "input-required",
    control: "state" | "number" = "state") => {
    const fieldPath = path(key);
    const existing = fields.find(field => field.fieldPath === fieldPath);
    if (existing) {
      existing.dependencyIds = [...new Set([...existing.dependencyIds, ...dependencyIds])];
      existing.hitIds = [...new Set([...existing.hitIds, ...hitIds])];
      return;
    }
    const attribute = control === "number" ? "data-field" : `data-source-cast-${control}-field`;
    const escaped = fieldPath.replace(/["\\\u0000-\u001f\u007f]/g, char => `\\${char.codePointAt(0)!.toString(16)} `);
    fields.push({ id: `${PREFIX}${key}`, fieldPath,
      controlSelector: `${control === "number" ? "input" : "select"}[${attribute}="${escaped}"]`,
      label, explanation, status, dependencyIds, hitIds });
  };
  const status = (value: unknown) => value === undefined ? "input-required" as const : "condition-not-satisfied" as const;

  // A complete explicit miss has no damage snapshot or A1 accounting to fill.
  if (document.scope !== "single-hit" && context.targetContacts?.swift === false) return fields;
  for (const hit of selected) if (hit.kind === "ordinary") {
    const dependencies = [`${PREFIX}${hit.id}`], hitIds = [hit.id];
    const layers = [
      { key: "sharedState", value: context.sharedState },
      { key: `hitStates.${TEMPLATE_HIT}`, value: context.hitStates?.[TEMPLATE_HIT] },
      ...(hit.id === TEMPLATE_HIT ? [] : [{ key: `hitStates.${hit.id}`, value: context.hitStates?.[hit.id] }]),
    ];
    const state: IansanSwiftResolvedHitState = Object.assign({}, ...layers.map(layer => layer.value));
    const stateKey = (key: keyof IansanSwiftResolvedHitState) => `${[...layers].reverse()
      .find(layer => layer.value && Object.hasOwn(layer.value, key))?.key ?? "sharedState"}.${key}`;
    if (document.scope === "single-hit" ? (state.swiftQualifiedAtCast ?? hit.iansanSwiftResolvedEvent?.swiftQualifiedAtCast) !== true
      : state.swiftQualifiedAtCast === false) {
      add(stateKey("swiftQualifiedAtCast"), "这记命中在起手时已满足雷霆飞缒资格",
        "只确认已经发生的这一击；不能从雷伤结果推断起手资格，也不要求未来 E 或夜魂持续时间。", dependencies, hitIds,
        status(state.swiftQualifiedAtCast ?? hit.iansanSwiftResolvedEvent?.swiftQualifiedAtCast));
    }
    if (state.burstInactiveAtSnapshot !== true) add(stateKey("burstInactiveAtSnapshot"), "本击取样时 Q 增攻未生效",
      "本分支只覆盖 Q 攻击力反馈未生效的实际命中；已生效或未知时不能按关闭状态计算。", dependencies, hitIds, status(state.burstInactiveAtSnapshot));
    const ascension = hit.finalSnapshot?.ascension ?? (document.build.mode === "equipment-derived"
      ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext!.ascension;
    if (ascension !== undefined && (ascension >= 1 && state.a1ActiveAtSnapshot === undefined
      || ascension < 1 && state.a1ActiveAtSnapshot === true)) add(stateKey("a1ActiveAtSnapshot"), "本击取样时先前的天赋增攻已生效",
      "记录本击取样前已存在的 A1；本击命中之后才获得的新增攻不会增幅自身。明确未生效请选择否。",
      dependencies, hitIds, status(state.a1ActiveAtSnapshot));
    if (document.scope !== "single-hit" && context.statsStableAcrossHits !== true && !context.snapshots?.["snapshot-25"]) {
      add("statsStableAcrossHits", "所填面板确实代表本击取样时的实际状态",
        "只有实际稳定时选是；若当前面板不代表第 25 帧，请提供该时点的真实历史快照，不能复制当前构筑冒充过去。", dependencies, hitIds, status(context.statsStableAcrossHits));
    }
    if (hit.finalSnapshot) {
      if (hit.finalSnapshot.origin !== "equipment-conversion" && state.snapshotIncludesActualA1 !== true) {
        add(stateKey("snapshotIncludesActualA1"), "历史面板已计入当时实际的天赋增攻",
          "历史最终攻击力应已包含当时先前 A1 的实际份额，未生效时也需明确该事实；不能在冻结攻击力上再加一次。", dependencies, hitIds, status(state.snapshotIncludesActualA1));
      }
    } else {
      if (state.includedA1Attack === undefined) add(stateKey("includedA1Attack"), "面板已计入的天赋增攻（未计入填 0）",
        "填写输入攻击力已包含的先前 A1 攻击力数值；0 表示明确未计入，留空仍表示未知。核心只调整实际份额与已含份额的差。", dependencies, hitIds, "input-required", "number");
      if (ascension !== undefined && ascension >= 1 && state.a1ActiveAtSnapshot === true
        && document.build.mode !== "equipment-derived" && state.baseAttack === undefined) add(stateKey("baseAttack"), "本击基础攻击力之和（角色与武器白字）",
        "先前 A1 增攻为真实基础攻击力的 20%；不能用最终攻击力反推。装备构筑可直接使用已提供的白字，不要求重复填写。", dependencies, hitIds, "input-required", "number");
    }
  }
  return fields;
}

export const iansanSwiftRequirementAdapter: CalculatorRequirementAdapter = {
  id: "iansan-swift-conditions", applies: isSwift, collect: collectIansanSwiftRequirements,
};
