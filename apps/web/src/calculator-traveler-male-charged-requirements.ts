import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { travelerMaleChargedConstellationScope } from "../../../packages/sim-core/src/traveler-male-charged-constellations";
import type { TravelerMaleChargedHitState } from "../../../packages/sim-core/src/traveler-male-charged-context";
import { travelerMaleChargedTemplates } from "../../../packages/game-data/src/character-mappings/traveler-male-charged-mappings";
import type { CalculatorFieldRequirementDraft, CalculatorRequirementAdapter } from "./calculator-requirements";

const SKILL = "male-charged-aether-anemo-c0", PREFIX = "traveler-male-charged:";
const path = (key: string): string => `gameContext.travelerMaleChargedCast.${key}`;
const applies = (document: CalculatorDocument): boolean => document.gameContext?.skillId === SKILL
  && travelerMaleChargedConstellationScope(document)?.allowed === true;

/** Links actual observations to the existing controls. It never infers an
 * action, stamina, contact, infusion or stable historical panel from a C value. */
export function collectTravelerMaleChargedRequirements(document: CalculatorDocument): CalculatorFieldRequirementDraft[] {
  if (!applies(document)) return [];
  const selected = document.hits.filter(hit => document.selectedHitIds.includes(hit.id));
  if (!selected.length) return [];
  const hits = selected.filter(hit => hit.kind === "ordinary"), context = document.gameContext!.travelerMaleChargedCast ?? {};
  const cast = travelerMaleChargedTemplates.find(row => row.skillId === SKILL)!;
  const fields: CalculatorFieldRequirementDraft[] = [];
  const add = (key: string, label: string, explanation: string, dependencyIds: string[], hitIds: string[], value: unknown,
    control: "state" | "number" | "text" = "state") => {
    const fieldPath = path(key), existing = fields.find(row => row.fieldPath === fieldPath);
    if (existing) {
      existing.dependencyIds = [...new Set([...existing.dependencyIds, ...dependencyIds])];
      existing.hitIds = [...new Set([...existing.hitIds, ...hitIds])];
      return;
    }
    const escaped = fieldPath.replace(/["\\\u0000-\u001f\u007f]/g, char => `\\${char.codePointAt(0)!.toString(16)} `);
    const attribute = control === "number" ? "data-field" : `data-source-cast-${control}-field`;
    fields.push({ id: `${PREFIX}${key}`, fieldPath, label, explanation, dependencyIds, hitIds,
      status: value === undefined ? "input-required" : "condition-not-satisfied",
      controlSelector: `${control === "state" ? "select" : "input"}[${attribute}="${escaped}"]` });
  };
  for (const hit of hits) {
    const role = hit.travelerMaleChargedEvent?.templateRole ?? (["hit-1", "hit-2"] as const).find(key => cast.roles[key].mappingId === hit.id);
    if (!role) continue;
    const baseId = cast.roles[role].mappingId;
    const layers = [
      { key: "sharedState", value: context.sharedState },
      { key: `hitStates.${baseId}`, value: context.hitStates?.[baseId] },
      ...(hit.id === baseId ? [] : [{ key: `hitStates.${hit.id}`, value: context.hitStates?.[hit.id] }]),
    ];
    const state: TravelerMaleChargedHitState = Object.assign({}, ...layers.map(row => row.value));
    const stateKey = (key: keyof TravelerMaleChargedHitState) => `${[...layers].reverse().find(row => row.value && Object.hasOwn(row.value, key))?.key ?? "sharedState"}.${key}`;
    const dependencies = [`${PREFIX}${hit.id}`];
    if (document.scope !== "single-hit") dependencies.push(`${PREFIX}schedule`);
    if (state.externalInfusionActive !== false) add(stateKey("externalInfusionActive"), "这记重击实际存在外部附魔（基础物理分支要求否）",
      "按本次命中取样的真实状态填写。存在附魔或尚未知时，不按物理重击计算；命座不会替你确认这一项。", dependencies, [hit.id], state.externalInfusionActive);
    if (state.trueMoonStoryBuffEnabled !== false) add(stateKey("trueMoonStoryBuffEnabled"), "这记重击实际开启了「真月」剧情增益（本分支要求否）",
      "剧情增益会改变自身重击；本入口只接受明确关闭的基础物理分支，不从地区、面板或命座推断。", dependencies, [hit.id], state.trueMoonStoryBuffEnabled);
  }
  if (document.scope === "single-hit") return fields;
  const schedule = [`${PREFIX}schedule`], allIds = selected.map(hit => hit.id);
  for (const [key, label] of [["casterId", "本次重击的施放者标识"], ["targetId", "本次实际观察的目标标识"]] as const) {
    if (!context[key]) add(key, label, "标明本次实际记录的施放者和所选目标，不能用命座或面板猜测。", schedule, allIds, context[key], "text");
  }
  for (const [key, label] of [
    ["precedingNormalAttackConfirmed", "本次重击之前已完成合法前置普攻"],
    ["actionReadyConfirmed", "本次重击在实际动作窗口内已经就绪"],
    ["freshCastConfirmed", "这是一次新的重击，没有前次输出残留"],
    ["noHitlag", "本次两段没有卡肉延长"],
    ["noInterruption", "本次两段所需动作没有被中断"],
    ["noReplacement", "本次没有替换或重置动作状态"],
    ["fullObservedLifetime", "已经观察两次机会的实际命中或落空"],
  ] as const) if (context[key] !== true) add(key, label,
    "仅在这个真实条件成立时选是；C1–C6不会证明动作或观察已经完成。独立已发生的一击无需填写未来整次记录。", schedule, allIds, context[key]);
  for (const [key, label, valid] of [
    ["normalCounterBeforeCast", "本次重击前的真实普攻计数（1–4）", Number.isInteger(context.normalCounterBeforeCast) && context.normalCounterBeforeCast! >= 1 && context.normalCounterBeforeCast! <= 4],
    ["initialStamina", "本次重击开始时的实际体力（至少20）", context.initialStamina !== undefined && context.initialStamina >= 20],
    ["staminaCostMultiplier", "本次实际体力消耗倍率（此分支为1）", context.staminaCostMultiplier === 1],
    ["observedThroughFrame", "从本次重击开始实际观察到的帧（至少20）", context.observedThroughFrame !== undefined && context.observedThroughFrame >= 20],
  ] as const) if (!valid) add(key, label, "填写实际值；留空表示未知，明确的0不会被改写成满足条件的数值。", schedule, allIds, context[key], "number");
  for (const role of ["hit-1", "hit-2"] as const) if (context.targetContacts?.[role] === undefined) add(`targetContacts.${role}`,
    `第${role === "hit-1" ? 9 : 20}帧的这一段实际命中了所选目标`, "是计入该次实际命中，否表示明确落空；未知仍阻断，不把两次机会当作两次保证命中。", schedule, allIds, undefined);
  if (context.statsStableAcrossHits !== true && hits.some(hit => !hit.finalSnapshot && !context.snapshots?.[hit.travelerMaleChargedEvent?.snapshotId ?? (hit.id.endsWith("hit-1") ? "sample:9" : "sample:20")])) {
    add("statsStableAcrossHits", "两次取样之间实际面板与装备、目标条件稳定",
      "只有真实稳定时才选是。若有变化，请在高级逐次历史快照中填写sample:9和sample:20的真实面板；不能把当前面板复制成历史值。", hits.map(hit => `${PREFIX}${hit.id}`), hits.map(hit => hit.id), context.statsStableAcrossHits);
  }
  return fields;
}

export const travelerMaleChargedRequirementAdapter: CalculatorRequirementAdapter = {
  id: "traveler-male-charged-anemo-conditions", applies, collect: collectTravelerMaleChargedRequirements,
};
