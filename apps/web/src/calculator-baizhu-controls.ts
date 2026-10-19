import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";

export function renderBaizhuSkillControls(document: CalculatorDocument): string {
  const context = document.gameContext?.baizhuSkill;
  if (!context) return "";
  return `<fieldset data-baizhu-skill-context><legend>游丝徵灵：一次施放的共同起手快照</legend><div class="calculator-fields"><label>E 起手时在场角色生命比例（0–1；未知留空）<input id="calc-baizhu-cast-hp" type="number" data-field="gameContext.baizhuSkill.activeHpRatioAtCast" data-baizhu-number-field data-optional-number min="0" max="1" step="any" value="${context.activeHpRatioAtCast ?? ""}" placeholder="未知"></label><label>输入增伤是否已含本次 A1 的25%草伤<select id="calc-baizhu-a1-included" data-baizhu-state-field="gameContext.baizhuSkill.a1IncludedInPanel"><option value="0"${context.a1IncludedInPanel ? "" : " selected"}>未含；适用时由公式加入</option><option value="1"${context.a1IncludedInPanel ? " selected" : ""}>已含；不重复加入</option></select></label></div><p class="calculator-hint">三次伤害共享 E 起手的进攻快照。突破1解锁后，起手生命比例至少50%时获得25%草伤；后续生命变化不会重新计算这次快照。未知生命比例不默认满血或零，突破0不依赖此条件。</p><p class="calculator-hint">本入口只合计 C0 三次游丝徵灵自身伤害，明确假定三次均命中同一稳定目标。治疗及额外反应伤害不混入总计；每击反应和实际反应加成仍需各自明确。单击计算继续独立可用。</p></fieldset>`;
}
