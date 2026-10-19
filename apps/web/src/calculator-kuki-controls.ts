import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { isKukiDamageAction } from "./kuki-calculation-context";

const state = (key: string, label: string, value: boolean | undefined): string => `<label>${label}<select data-kuki-state-field="gameContext.kukiDamage.${key}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;

export function renderKukiDamageControls(document: CalculatorDocument): string {
  const game = document.gameContext, context = game?.kukiDamage;
  if (!isKukiDamageAction(document) || !game || !context) return "";
  const skill = game.skillId.startsWith("kuki-skill-");
  return `<fieldset><legend>久岐忍：完整施放条件与实际面板</legend><div class="calculator-fields">${state("statsStableAcrossHits", "所选各击面板、装备与目标状态稳定（含C6精通）", context.statsStableAcrossHits)}${skill ? state("ringUninterrupted", "本次草轮完整持续，未被重放替换", context.ringUninterrupted) : `<label>施放Q时实际生命比例（0–1；0.5=50%，未知留空）<input type="number" data-field="gameContext.kukiDamage.burstHpRatioAtCast" data-kuki-number-field data-optional-number min="0" max="1" step="any" value="${context.burstHpRatioAtCast ?? ""}" placeholder="未知"></label>`}${game.constellation >= 6 ? state("c6FinalEmRestored", "手动/导入面板已恢复该击实际最终EM（不再补加C6）", context.c6FinalEmRestored) + state("c6Active", "该击C6的150精通实际有效", context.c6Active) + state("c6IncludedInPanel", "共享输入精通已包含C6的150份额", context.c6IncludedInPanel) : ""}</div><p class="calculator-hint">“稳定”“完整持续”是可修改的教学条件假设，不是实战观测；未知可留为未知并独立选择已有上下文的一击。${skill ? "完整E仅初击与草轮8/10击；突破4的25%EM是伤害基数，不填入增伤再次叠加。" : "Q施放HP≤50%为12击，>50%为7击；不从最大HP或所选动作名称推测比例。前7击可独立计算，额外第8–12击仍需低HP条件。"} C4追加印记需要另一次普攻/重击/下落触发，不含于本动作。${game.constellation >= 6 ? " C6来自明确状态或实际最终EM；来源配装的最终EM声明不代替有效/已含记账。不执行治疗、扣血或C6触发时钟。" : ""}</p></fieldset>`;
}
