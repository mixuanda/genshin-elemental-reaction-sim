import { batchFiniteCastContextSchema, type CalculatorDocument, type CalculatorFormula } from "./calculator-model";
import { expr } from "./calculation-trace";

const actions = new Set(["dehya-burst-auto-six-complete-c0", "dehya-burst-rhythm-ten-complete-c0", "jean-burst-two-boundaries-complete-c0", "diluc-burst-full-contact-complete-c0", "arlecchino-skill-unabsorbed-complete-c0", "kirara-burst-six-cardamoms-complete-c0", "chongyun-skill-without-a4-complete-c0", "chongyun-skill-with-a4-complete-c0"]);
const sourceRoot = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters";
const prefix = "batch-finite-context:";
export const isBatchFiniteCastAction = (doc: CalculatorDocument): boolean => actions.has(doc.gameContext?.skillId ?? "");

/** Fixed-source character bonus; the AST carries both actual and already-included values. */
export function createBatchFiniteDamageBonusFormula(character: "diluc" | "arlecchino" | "kirara", ascension: number | undefined, included: number): CalculatorFormula {
  const unlocked = character === "arlecchino" || (ascension !== undefined && ascension >= 4);
  const actual = !unlocked ? expr.value(0) : character === "kirara" ? expr.mul(expr.input("hp"), expr.value(.000003)) : expr.value(character === "arlecchino" ? .4 : .2);
  return { ruleId: `batch-finite-${character}-damage-bonus-accounting`, label: character === "kirara" ? "绮良良A4：实际最大生命×0.000003 − 已含爆发增伤" : character === "arlecchino" ? "阿蕾奇诺固有天赋：40%火伤 − 已含火伤" : "迪卢克A4：本次Q已先开启的20%火伤 − 已含火伤",
    expression: expr.sub(actual, expr.input("finiteCastIncludedDamageBonus")),
    inputs: [...(ascension === undefined ? [] : [{ key: "finiteCastAscension", value: ascension, unit: "level", meaningKey: "本击取样的实际突破阶段；阿蕾奇诺固有火伤不受突破门限制", origin: "derived-character-context" }]), { key: "finiteCastIncludedDamageBonus", value: included, minimum: 0, unit: "ratio", meaningKey: "本击输入增伤已经包含的该角色自身被动份额；0代表明确未含", origin: "explicit-accounting" }],
    requirements: { maximumConstellation: 0, elements: [character === "kirara" ? "dendro" : "pyro"], attackTags: [character === "arlecchino" ? "skill" : "burst"] },
    sourceRefs: [`${sourceRoot}/${character}/asc.go`, `${sourceRoot}/${character}/${character === "arlecchino" ? "skill" : "burst"}.go`] };
}

export function prepareBatchFiniteCastDocument(document: CalculatorDocument): CalculatorDocument {
  if (!isBatchFiniteCastAction(document)) return document;
  const result = structuredClone(document), game = result.gameContext!;
  const context = batchFiniteCastContextSchema.parse(game.batchFiniteCast ?? {});
  game.batchFiniteCast = context;
  context.hitStates ??= {};
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  const fullCast = result.scope === "one-cast" && result.hits.every(hit => result.selectedHitIds.includes(hit.id));
  const selectedCount = result.hits.filter(hit => result.selectedHitIds.includes(hit.id)).length;
  const slug = game.skillId.split("-")[0]!;
  const passive = slug === "arlecchino" || slug === "diluc" || slug === "kirara";
  for (const hit of result.hits) {
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(prefix));
    if (hit.kind !== "ordinary") continue;
    const state = context.hitStates[hit.id] ??= {};
    const ascension = hit.finalSnapshot?.ascension ?? (result.build.mode === "equipment-derived" ? result.build.equipment?.ascension : result.build.ascension) ?? game.ascension;
    const reasons: string[] = [];
    if (game.constellation !== 0) reasons.push("此有限完整动作只审阅C0；不能省略高命座的追加伤害、生命附加值或状态延长。");
    if (fullCast && context.completeCastConfirmed !== true) reasons.push("须确认本分支列出的全部自身伤害实际命中，且满足动作标签所述输入节奏、目标接触与实体未中断/未回收条件；不能把源码最大排程当作实际全中。");
    if (selectedCount > 1 && context.statsStableAcrossHits !== true) reasons.push("多个取样时点合计需要明确其他进攻、装备和目标条件稳定；逐击被动差额与反应仍分别处理。");
    if (game.skillId === "chongyun-skill-without-a4-complete-c0" && (ascension === undefined || ascension >= 4)) reasons.push("此完整分支要求明确突破0至3；解锁逆刃后应选择含逆刃分支，不能将初击冒充完整E。");
    if (game.skillId === "chongyun-skill-with-a4-complete-c0" && (fullCast || hit.id.endsWith("instance-2")) && (ascension === undefined || ascension < 4)) reasons.push("逆刃需要明确突破4及以上；未解锁时不会产生这一击。");
    if (passive) {
      delete hit.damageBonusFormula;
      if (ascension === undefined && slug !== "arlecchino") reasons.push("缺少实际突破阶段，不能确定A4已解锁或用零代替。");
      if (state.includedDamageBonus === undefined) reasons.push("缺少本击增伤中已经包含的自身被动份额；须明确填写实际比例，0才表示未含。");
      if (state.includedDamageBonus !== undefined && (ascension !== undefined || slug === "arlecchino")) hit.damageBonusFormula = createBatchFiniteDamageBonusFormula(slug, ascension, state.includedDamageBonus);
    }
    const id = `${prefix}${hit.id}`;
    hit.dependencies.push(id);
    result.dependencies.push({ id, status: reasons.length ? "missing" : "provisional", reason: reasons.join("；") || "本击处于明确C0来源分支；被动按实际份额减去输入已含份额，未将未知条件视为零。", sourceRefs: hit.sourceRefs });
  }
  const note = "有限完整动作记账：已含份额属于本击增伤，不改变共同面板；绮良良A4使用该击实际最大生命。选择一击不依赖未来未选命中，完整施放仍须确认其真实次数与不中断条件。";
  result.assumptions = [...result.assumptions.filter(row => !row.startsWith("有限完整动作记账：")), note];
  return result;
}

export function resetBatchFinitePanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isBatchFiniteCastAction(document)) return;
  const context = document.gameContext!.batchFiniteCast ??= {};
  context.hitStates ??= {};
  for (const hit of document.hits) {
    if (hit.kind !== "ordinary" || hit.finalSnapshot) continue;
    const state = context.hitStates[hit.id] ??= {};
    if (mode === "fresh-equipment") state.includedDamageBonus = 0;
    else delete state.includedDamageBonus;
  }
}
