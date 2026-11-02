import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";
import type { IansanSwiftResolvedHitState } from "../../../packages/sim-core/src/iansan-swift-resolved-context";
import { iansanSwiftScheduleProvesOwnerOnField } from "../../../packages/sim-core/src/iansan-swift-resolved-schedule";
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
  if (!isSwift(document) || !Number.isInteger(document.gameContext!.constellation)
    || document.gameContext!.constellation < 0 || document.gameContext!.constellation > 6
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
    if (state.burstInactiveAtSnapshot === undefined) add(stateKey("burstInactiveAtSnapshot"), "本击取样时 Q 增攻未生效",
      "未生效选是；实际生效选否并填写本击采用的 Q 取值。未知不会自动按关闭或零增攻计算。", dependencies, hitIds);
    if (state.burstInactiveAtSnapshot === false) {
      const proven = iansanSwiftScheduleProvesOwnerOnField(document.scope, context);
      const ownerOnField = state.ownerOnFieldAtSnapshot ?? (proven ? true : undefined);
      if (ownerOnField === undefined || proven && ownerOnField === false) add(stateKey("ownerOnFieldAtSnapshot"), "本击取样时伊安珊本人正在前台",
        proven ? "完整合法动作在第 25 帧取样、最早第 31 帧才能换人，本人后台与所声明的无中断日程冲突，不能把矛盾状态当成合法零增攻。"
          : "Q 只增幅当前场上角色，也可增幅伊安珊自己。独立已发生命中须填写实际状态，明确本人在后台选否。",
        dependencies, hitIds, proven ? "condition-not-satisfied" : "input-required");
      if (ownerOnField === true) {
        if (context.burstTalentLevel === undefined) add("burstTalentLevel", "Q 有效天赋等级（独立于普通攻击）",
          "填写已经包含实际命座增级的有效 Q 等级 1–15，不再加级；雷霆飞缒本身仍使用普通攻击等级。", dependencies, hitIds, "input-required", "number");
        if (state.burstUpdateNonExtraAttack === undefined) add(stateKey("burstUpdateNonExtraAttack"), "Q 增攻计算采用的攻击力",
          "填写本击实际采用的那次 Q 刷新攻击力，排除 Q 自身等二次转换。不能用当前含 Q 的最终攻击力倒算；取值说明见 Q 详情。", dependencies, hitIds, "input-required", "number");
        if (state.burstUpdateNightsoulPoints === undefined) add(stateKey("burstUpdateNightsoulPoints"), "Q 增攻计算采用的夜魂值（0–54）",
          "填写同一次实际 Q 刷新采用的夜魂值，可含小数；0 是有效观察，留空才是未知。不能默认等于本击命中时的当前点数。", dependencies, hitIds, "input-required", "number");
      }
      if (hit.finalSnapshot) {
        if (hit.finalSnapshot.origin !== "equipment-conversion" && state.snapshotIncludesActualBurst !== true) add(stateKey("snapshotIncludesActualBurst"), "历史面板已包含当时实际的 Q 增攻",
          "只在历史最终攻击力确实已包含该次实际 Q 份额时确认，核心不再添加。未知或未含时应先提供真实最终快照。", dependencies, hitIds, status(state.snapshotIncludesActualBurst));
      } else if (state.includedBurstAttack === undefined) add(stateKey("includedBurstAttack"), "面板已计入的 Q 增攻（未计入填 0）",
        "填写输入攻击力中已经包含的自身 Q 固定攻击份额；核心计算实际份额后只补差一次。未计入填 0，不能把未知当作 0。", dependencies, hitIds, "input-required", "number");
    }
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
    const constellation = document.gameContext!.constellation;
    if (constellation === 6 || state.c6DamageBonusActiveAtHit !== undefined || state.includedC6DamageBonus !== undefined) {
      if (constellation === 6 && state.c6DamageBonusActiveAtHit === undefined) add(stateKey("c6DamageBonusActiveAtHit"), "本击实际受到「极限发力」增伤",
        "只有实际收到且本击仍有效时选是；Q 开启、夜魂 54 点或发生溢出都不证明伊安珊本人本击收到该效果。明确未受到选否。", dependencies, hitIds);
      if (constellation < 6 && state.c6DamageBonusActiveAtHit === true) add(stateKey("c6DamageBonusActiveAtHit"), "本击实际受到「极限发力」增伤",
        "当前命座尚未解锁自身 C6，不能声明此效果有效。", dependencies, hitIds, "condition-not-satisfied");
      if (state.includedC6DamageBonus === undefined) add(stateKey("includedC6DamageBonus"), "本击增伤中已计入的极限发力（小数）",
        "明确未含填 0，已完整计入填 0.25；本页只补实际份额与已含份额的差，不自动把未知当零。", dependencies, hitIds, "input-required", "number");
      else if (hit.finalSnapshot && hit.finalSnapshot.origin !== "equipment-conversion" && state.c6DamageBonusActiveAtHit !== undefined
        && state.includedC6DamageBonus !== (state.c6DamageBonusActiveAtHit && constellation === 6 ? .25 : 0)) {
        add(stateKey("includedC6DamageBonus"), "历史面板已计入当时实际的极限发力份额",
          "冻结后的增伤必须已经包含当时实际份额：有效时 0.25，未生效时 0；不能在历史最终快照上补加。", dependencies, hitIds, "condition-not-satisfied", "number");
      }
    }
  }
  return fields;
}

export const iansanSwiftRequirementAdapter: CalculatorRequirementAdapter = {
  id: "iansan-swift-conditions", applies: isSwift, collect: collectIansanSwiftRequirements,
};
