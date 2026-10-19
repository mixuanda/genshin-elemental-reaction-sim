import { kukiDamageContextSchema, type CalculatorDocument, type KukiDamageContext } from "../../../packages/sim-core/src/calculator-model";
import { createKukiC6EmFormula, createKukiSkillBaseFormula, KUKI_DAMAGE_SOURCE_REFS } from "../../../packages/sim-core/src/kuki-formulas";

export const KUKI_DAMAGE_ACTION_IDS = ["kuki-skill-c0-complete-cast", "kuki-skill-c2-complete-cast", "kuki-burst-high-hp-complete-cast", "kuki-burst-low-hp-complete-cast"];
export const isKukiDamageAction = (document: CalculatorDocument): boolean => KUKI_DAMAGE_ACTION_IDS.includes(document.gameContext?.skillId ?? "");

export function resetKukiPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  const context = document.gameContext?.kukiDamage;
  if (!context) return;
  delete context.c6FinalEmRestored;
  if (mode === "fresh-equipment") context.c6IncludedInPanel = false;
  else delete context.c6IncludedInPanel;
}

/** Restores damage conditions only. No healing, HP drain, ring refresh or C6 timer is simulated here. */
export function applyKukiDamageContext(document: CalculatorDocument, supplied: KukiDamageContext): CalculatorDocument {
  if (!isKukiDamageAction(document)) return document;
  const result = structuredClone(document), game = result.gameContext!, context = kukiDamageContextSchema.parse(supplied);
  const prefix = "kuki-damage-context:", assumptionPrefix = "久岐忍 E/Q 来源上下文：";
  game.kukiDamage = context;
  result.dependencies = result.dependencies.filter((dependency) => !dependency.id.startsWith(prefix));
  result.assumptions = result.assumptions.filter((assumption) => !assumption.startsWith(assumptionPrefix));
  const ascension = (result.build.mode === "equipment-derived" ? result.build.equipment?.ascension : result.build.ascension) ?? game.ascension;
  const skill = game.skillId.startsWith("kuki-skill-"), extendedRing = game.skillId === "kuki-skill-c2-complete-cast", lowHpBurst = game.skillId === "kuki-burst-low-hp-complete-cast";
  const multipleSelected = result.scope === "one-cast" && result.selectedHitIds.length > 1;
  const completeCastSelected = result.scope === "one-cast" && result.hits.every((hit) => result.selectedHitIds.includes(hit.id));
  for (const hit of result.hits) {
    hit.dependencies = hit.dependencies.filter((dependency) => !dependency.startsWith(prefix));
    if (hit.kind !== "ordinary") continue;
    const reasons: string[] = [], initial = hit.id.endsWith("-initial");
    const instance = initial ? 0 : Number(hit.id.split("-instance-").at(-1));
    hit.sourceRefs = [...new Set([...hit.sourceRefs, ...KUKI_DAMAGE_SOURCE_REFS])];
    if (multipleSelected && context.statsStableAcrossHits !== true) reasons.push("尚未声明所选各击共享进攻面板（含 C6 精通）、装备与目标状态稳定；独立单击可恢复其实际面板后计算。");
    if (skill) {
      if (ascension === undefined) reasons.push("E 的25%精通基础加算依赖突破4；突破阶段未知，不能猜测已解锁。");
      else {
        hit.baseDamageFormula = createKukiSkillBaseFormula(hit.terms[0]!.coefficient, ascension);
        if (initial && ascension < 4) reasons.push("低突破 E 初击存在固定来源冲突：gcsim 无条件加25%EM，Optimizer 在突破4后才加；当前不裁定此分歧。环击与 Q 不受这个初击冲突阻塞。");
      }
      if (completeCastSelected && context.ringUninterrupted !== true) reasons.push("未确认本次草轮完整持续且未被重放替换，不能认证完整环击总数；可独立选已发生的初击或环击。");
      if ((completeCastSelected && extendedRing !== (game.constellation >= 2)) || (instance > 8 && game.constellation < 2)) reasons.push("当前命座与本动作完整环数不符：C0–1 为8次环击，C2–6 为10次；共同的独立初击/前8环仍可选择。");
    } else if (completeCastSelected || instance > 7) {
      if (context.burstHpRatioAtCast === undefined) reasons.push("施放 Q 时生命比例未知；完整7/12击分支及第8击以后必须提供当时实际比例，不能从最大HP面板或动作名称猜测。");
      else if ((context.burstHpRatioAtCast <= .5) !== lowHpBurst) reasons.push("所选 Q 分支与施放时生命比例不符：HP≤50%为12击，HP>50%为7击；独立前7击不依赖持续分支。");
    }
    if (hit.elementalMasteryAdjustment?.formula.ruleId.startsWith("kuki-c6-")) delete hit.elementalMasteryAdjustment;
    if (game.constellation >= 6) {
      const manualFinal = result.build.mode !== "equipment-derived";
      const emAffectsHit = !manualFinal || (skill && (ascension === undefined || ascension >= 4 || initial)) || hit.additiveReaction !== undefined || hit.reaction !== "none";
      if (manualFinal && context.c6FinalEmRestored === true) {
        // The supplied EM is already the actual value; no source breakdown is invented or added twice.
      } else if (context.c6Active !== undefined && context.c6IncludedInPanel !== undefined) {
        hit.elementalMasteryAdjustment = {accounting: "add-to-panel", formula: createKukiC6EmFormula(context.c6Active, context.c6IncludedInPanel)};
      } else if (emAffectsHit) reasons.push("本击依赖精通，但 C6 的150精通实际有效/面板已含状态未知。手动或导入最终面板可明确声明已恢复实际EM；来源配装需填写有效和已含份额，不能由当前HP反推历史触发。");
    }
    const id = `${prefix}${hit.id}`;
    hit.dependencies.push(id);
    result.dependencies.push({id, status: reasons.length ? "missing" : "provisional", reason: reasons.join("；") || "本击按固定来源倍率、已明确的分支与实际面板执行；独立单击不依赖无关的整段持续条件。", sourceRefs: KUKI_DAMAGE_SOURCE_REFS});
  }
  result.assumptions.push(
    `${assumptionPrefix}E 完整自身伤害为初击＋8次环击（C0–1）或初击＋10次环击（C2–6）。固定源初击11帧，23帧建立草轮；每90帧排环伤并延迟2帧快照/命中，含持续期末最后一击；重放会替换旧环。`,
    `${assumptionPrefix}E ATK项与A4的25%EM都是基础伤害，随后共用增伤、暴击、防御与抗性。A4不是面板属性或百分比增伤，不能额外填入增伤或附加基础伤害再加一次。gcsim初击低突破缺门禁，与Optimizer冲突时阻塞初击；环按明确突破门执行。`,
    `${assumptionPrefix}Q 在施放时一次取进攻快照，HP≤50%为12击，HP>50%为7击；阈值来自执行条件。源码旧注释“11”与实际count=12冲突，采用循环执行路径；不以目录独立舍入总倍率替代逐击求和。最大HP参与每击伤害，不等同于当前生命比例。`,
    `${assumptionPrefix}多击中的共享面板、装备及目标稳定是可编辑的用户条件，默认教学条件不是实战观测。E上游仍有快照TODO：不认证动态快照、扣血、治疗、C6生命触发或其他时钟；各击反应仍独立，不从雷伤次数推断激化次数或ICD。`,
    `${assumptionPrefix}C6有效/已含差值只在共享精通核心执行150×(有效−已含)，可移除失效旧份额。手动/导入最终面板明确恢复实际EM后不重复加算；新来源配装不含角色C6。稳定声明同时涵盖本次所选各击C6精通状态；只选一击时使用该击实际状态。`,
    `${assumptionPrefix}C1只改变Q范围，C2改变E时长，C3/C5已经包含在有效天赋等级；C4需要另一个角色动作命中来触发追加印记，不归入本次E/Q自身总伤。只增加条件动作覆盖，不将久岐忍全角色或当前游戏机制标为verified。`,
  );
  return result;
}
