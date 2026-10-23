import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { alhaithamContext, alhaithamProjectionMirrorCount, isAlhaithamDamageAction, alhaithamUnstableC2EquipmentRules, alhaithamRequiresC2SnapshotStatsConfirmation } from "../../../packages/sim-core/src/alhaitham-damage-formulas";
import { alhaithamProjectionHitIds } from "../../../packages/game-data/src/character-mappings/alhaitham-primary-mappings";
import type { CalculatorFieldRequirementDraft, CalculatorRequirementAdapter } from "./calculator-requirements";

const path = (key: string) => `gameContext.alhaithamDamage.${key}`;
const state = (fieldPath: string, label: string, value: boolean | undefined) => `<label>${label}<select data-source-cast-state-field="${fieldPath}"><option value="unknown"${value === undefined ? " selected" : ""}>请选择实际条件</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const number = (fieldPath: string, label: string, value: number | undefined, max?: number, integer = false) => `<label>${label}<input type="number" data-field="${fieldPath}" data-source-cast-number-field data-optional-number min="0"${max === undefined ? "" : ` max="${max}"`} step="${integer ? "1" : "any"}" value="${typeof value === "number" && Number.isFinite(value) ? value : ""}" placeholder="请填实际值；明确没有填0"></label>`;
const stage = (document: CalculatorDocument) => (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext?.ascension;
export function renderAlhaithamControls(document: CalculatorDocument): string {
  if (!isAlhaithamDamageAction(document)) return "";
  const mirrors = alhaithamProjectionMirrorCount(document.gameContext!.skillId)!, context = alhaithamContext(document) ?? {};
  const ids = alhaithamProjectionHitIds(mirrors).filter(id => document.selectedHitIds.includes(id)), ascension = stage(document);
  const a4 = ascension === undefined || ascension >= 4, varying = context.masteryStableAcrossStages === false, c2 = document.gameContext!.constellation >= 2;
  const c2FieldsVisible = c2 || (context.c2SnapshotStacks ?? 0) > 0 || (context.c2SnapshotIncludedStacks ?? 0) > 0;
  const c2Fields = c2FieldsVisible ? `${number(path("c2SnapshotStacks"), "本击快照时C2实际有效层数（0–4，持镜数不等于层数）", context.c2SnapshotStacks, 4, true)}<details><summary>C2面板已含量</summary><div class="calculator-fields">${number(path("c2SnapshotIncludedStacks"), "本击精通面板已含C2层数（0–4）", context.c2SnapshotIncludedStacks, 4, true)}${state(path("c2OtherSnapshotStatsFinal"), "已填写C2生效后的实际攻击力等面板（否则改用配装计算）", context.c2OtherSnapshotStatsFinal)}</div></details>` : "";
  const unsupported = alhaithamUnstableC2EquipmentRules(document);
  return `<fieldset data-source-cast-controls="alhaitham"><legend>艾尔海森 · ${mirrors}镜的一次投射</legend><p class="calculator-hint">所选入口明确采用触发时${mirrors}镜情景。这里只计算投射，触发它的普攻、重击或下落另算。</p><div class="calculator-fields">${context.mirrorCount === mirrors ? "" : number(path("mirrorCount"), "触发时镜数（须与所选入口一致）", context.mirrorCount, 3, true)}${ascension === undefined ? number("gameContext.ascension", "角色突破阶段（不从等级猜测）", document.gameContext?.ascension, 6, true) : ""}${c2Fields}${state(path("projectionTriggerValid"), "前台普攻/重击/下落已命中敌人，且投射冷却已结束", context.projectionTriggerValid)}${state(path("masteryStableAcrossStages"), "触发到命中期间精通不变（可共用当前实际面板）", context.masteryStableAcrossStages)}${varying ? number(path("triggerMastery"), "投射触发瞬间的实际最终精通", context.triggerMastery) + (c2 ? state(path("c2TriggerMasteryFinal"), "上面的触发精通已含当时有效C2，不再加层", context.c2TriggerMasteryFinal) : "") : ""}${ids.length > 1 ? state(path("statsAndTargetStableAcrossHits"), "所选多击共用其余面板、装备和目标状态", context.statsAndTargetStableAcrossHits) : ""}</div>${ids.map(id => {
    const hit = context.hitStates?.[id] ?? {}, index = alhaithamProjectionHitIds(mirrors).indexOf(id) + 1, field = (key: string) => path(`hitStates.${id}.${key}`);
    return `<fieldset><legend>本次投射第${index}段</legend><div class="calculator-fields">${state(field("connected"), "这一段实际命中所选目标", hit.connected)}${a4 && varying ? number(field("hitTimeMastery"), "这一段命中瞬间的实际最终精通（A4用）", hit.hitTimeMastery) + (c2 ? state(field("c2HitMasteryFinal"), "本段命中精通已含当时有效C2，不再加层", hit.c2HitMasteryFinal) : "") : ""}</div><details><summary>本段面板已含份额（避免重复）</summary><div class="calculator-fields">${number(field("includedProjectionBase"), "附加基数已含的投射精通伤害量（未含填0）", hit.includedProjectionBase)}${a4 || hit.includedA4Bonus ? number(field("includedA4Bonus"), "增伤已含A4份额（1=100%，未含填0）", hit.includedA4Bonus, 1) : ""}</div></details></fieldset>`;
  }).join("")}${unsupported.length ? `<p class="calculator-hint">跨阶段精通变化尚不能重建装备规则「${unsupported.map(label => label.replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`)).join("、")}」。请在“配装与面板→面板模式”改用手动最终面板，填写实际快照攻击/精通及各阶段精通。</p>` : ""}<p class="calculator-hint">精通基数在触发时确定，A4按各段命中时精通计算，每点0.1%、上限100%。选择精通不变后才共用实际面板；C2只补已明确的快照差额。C1命中后减CD不改变本击，C3不重复加天赋；C2每层50精通、8秒独立计时、最多4层，镜溢出生成也可触发。仅覆盖C0–C3，未覆盖C4以上、完整镜生命周期或循环。</p></fieldset>`;
}
export const alhaithamRequirementAdapter: CalculatorRequirementAdapter = {
  id: "alhaitham-projection-conditions", applies: isAlhaithamDamageAction,
  collect(document) {
    const mirrors = alhaithamProjectionMirrorCount(document.gameContext!.skillId)!, context = alhaithamContext(document) ?? {}, ascension = stage(document);
    const c2 = document.gameContext!.constellation >= 2;
    const fields: CalculatorFieldRequirementDraft[] = [], selected = alhaithamProjectionHitIds(mirrors).filter(id => document.selectedHitIds.includes(id));
    const add = (fieldPath: string, label: string, explanation: string, numeric = false, unsatisfied = false, hitIds = selected) => fields.push({
      id: `alhaitham:${fieldPath}`, fieldPath, controlSelector: numeric ? `input[data-field="${fieldPath}"]` : `select[data-source-cast-state-field="${fieldPath}"]`,
      label, explanation, status: unsatisfied ? "condition-not-satisfied" : "input-required", dependencyIds: ["alhaitham-damage:conditions", ...hitIds.map(id => "alhaitham-damage:" + id)], hitIds,
    });
    if (!c2 && (context.c2SnapshotStacks ?? 0) > 0) add(path("c2SnapshotStacks"), "清除旧命座C2实际层数", "当前命座未解锁C2；请重新应用该命座实际面板，不能沿用高命座层数。", true, true);
    if (!c2 && (context.c2SnapshotIncludedStacks ?? 0) > 0) add(path("c2SnapshotIncludedStacks"), "清除旧命座C2已含层数", "当前命座未解锁C2；不能保留高命座面板已含声明，请重新应用正确面板。", true, true);
    if (c2 && context.c2SnapshotStacks === undefined) add(path("c2SnapshotStacks"), "本击快照时C2实际有效层数", "填写0–4个仍在各自8秒期限内的层数；持镜数、曾生成数和溢出次数均不能代替当前有效层数。", true);
    if (c2 && context.c2SnapshotIncludedStacks === undefined) add(path("c2SnapshotIncludedStacks"), "本击精通面板已含C2层数", "只补50乘以实际层数与已含层数的差；已含不得再次加入。", true);
    if (c2 && context.masteryStableAcrossStages === false && context.c2TriggerMasteryFinal !== true) add(path("c2TriggerMasteryFinal"), "触发精通已含当时C2", "提供触发瞬间的完整实际最终精通后确认，不把快照C2差额加到触发取样。", false, context.c2TriggerMasteryFinal === false);
    if ((alhaithamRequiresC2SnapshotStatsConfirmation(document) && context.c2OtherSnapshotStatsFinal !== true) || (c2 && document.build.mode === "manual-final" && context.c2SnapshotStacks !== undefined && context.c2SnapshotIncludedStacks !== undefined && context.c2SnapshotStacks !== context.c2SnapshotIncludedStacks && context.c2OtherSnapshotStatsFinal === false)) add(path("c2OtherSnapshotStatsFinal"), "其余属性为实际快照", "请先在最终面板填写实际快照攻击等属性；不会从新增精通反推缺少的武器转换。", false, true);
    const unsupported = alhaithamUnstableC2EquipmentRules(document);
    if (unsupported.length) fields.push({ id: "alhaitham:c2-actual-final-panel", fieldPath: "build.mode", controlSelector: "#calc-build-mode", label: "改用实际快照最终面板", explanation: `跨阶段精通变化时未重建装备规则「${unsupported.join("、")}」；请在此选择手动最终面板，填写实际快照攻击/精通，再填写触发和命中最终精通。`, status: "condition-not-satisfied", dependencyIds: ["alhaitham-damage:conditions"], hitIds: selected });
    if (context.mirrorCount !== mirrors) add(path("mirrorCount"), "投射触发时镜数", "须与所选1/2/3镜入口相符；未知或零镜不能推断命中数量。", true, context.mirrorCount !== undefined);
    if (ascension === undefined) add("gameContext.ascension", "突破阶段", "谜林道破需要突破4；不能依据角色等级推断。", true);
    if (context.projectionTriggerValid !== true) add(path("projectionTriggerValid"), "实际投射触发条件", "确认前台普攻/重击/下落命中敌人且1.6秒投射冷却已结束；持镜本身不证明本次触发。", false, context.projectionTriggerValid === false);
    if (context.masteryStableAcrossStages === undefined) add(path("masteryStableAcrossStages"), "触发到命中期间精通不变", "明确不变才共用当前实际面板；变化时分别填触发精通与各段命中精通。");
    if (context.masteryStableAcrossStages === false && context.triggerMastery === undefined) add(path("triggerMastery"), "投射触发精通", "固定源的精通FlatDmg在触发时固化，不能用后续精通代替。", true);
    if (selected.length > 1 && context.statsAndTargetStableAcrossHits !== true) add(path("statsAndTargetStableAcrossHits"), "多击间其余面板与目标状态共用", "目标抗性、防御或其余面板变化时应单选实际一击；不把共同输入当成自动时序。", false, context.statsAndTargetStableAcrossHits === false);
    for (const id of selected) {
      const hit = context.hitStates?.[id] ?? {}, field = (key: string) => path(`hitStates.${id}.${key}`);
      if (hit.connected !== true) add(field("connected"), "本段实际命中", "未命中请取消选择本段；不能把未知接触当成命中。", false, hit.connected === false, [id]);
      if (hit.includedProjectionBase === undefined) add(field("includedProjectionBase"), "已含投射精通基数", "核对附加基数中已含的原生精通伤害量，明确未含填0。", true, false, [id]);
      if (ascension === undefined || ascension >= 4) {
        if (context.masteryStableAcrossStages === false && hit.hitTimeMastery === undefined) add(field("hitTimeMastery"), "本段命中时精通", "A4读取各段命中时精通，而非触发或延后快照时精通。", true, false, [id]);
        if (c2 && context.masteryStableAcrossStages === false && hit.c2HitMasteryFinal !== true) add(field("c2HitMasteryFinal"), "本段命中精通已含当时C2", "提供本段命中瞬间完整实际最终精通后确认，A4不再追加快照层数。", false, hit.c2HitMasteryFinal === false, [id]);
        if (hit.includedA4Bonus === undefined) add(field("includedA4Bonus"), "本段增伤已含A4份额", "在折叠记账中填已含比例，未含填0，避免重复加入A4。", true, false, [id]);
      }
    }
    return fields;
  },
};
