import {
  manekinRawMappings, manekinRawTemplates, manekinRawStateContracts,
} from "../../game-data/src/character-mappings/manekin-raw-mappings";
import {
  released71RawMappings, released71RawTemplates, released71RawStateContracts,
} from "../../game-data/src/character-mappings/released-71-raw-mappings";
import type { SourceHitMapping } from "../../game-data/src/character-mappings/types";
import type { CalculatorDocument, CalculatorHit } from "./calculator-model";
import { rawSourceStateContextSchema, type RawSourceStateContext } from "./raw-source-state-context";
import { expr, formatFormulaExpression, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

export interface RawSourceStateContract {
  id: string; label: string; requiredTrue: readonly string[];
  completeActionRequiredTrue: readonly string[]; fieldLabels: Record<string, string>;
  sourceRefs: string[]; scope: string;
}
const fieldLabels: Record<string, string> = {
  actualHitConfirmed: "该来源伤害段已实际命中所选目标",
  talentLevelObserved: "所填有效天赋等级在本次实际状态下可用",
  wholeActionObserved: "本次命名输入已经完整观察，所列段数覆盖其自身伤害",
  noAdditionalCharacterDamage: "本次输入没有未计入的其他自身追加伤害",
  zeroCollisionConfirmed: "本次完整下落未发生路径碰撞伤害",
  infusionInactive: "奇偶本击没有 E 的元素转化",
  burstInactive: "奇偶本击没有生效的禁限区域及其离场尾爆",
  noExternalInfusion: "本击没有外部附魔",
  actualElementConfirmed: "实际技能配置与此 E 分支的元素一致（非无元素配置）",
  songInactive: "沃雅妮莎本击未处于遥久之歌状态",
  concertoAndChorusInactive: "沃雅妮莎领唱与重唱均未生效（与 E 状态分别确认）",
  noOwnStellarVortex: "本次输入没有沃雅妮莎自身的星扩散风旋追加伤害",
  armedForActionInactive: "薇斯纳本击未处于巡风列装",
  radianceInactive: "薇斯纳本击没有生效的辉映·星扩散",
};
const prefix = "raw-source-state:";
const mappings: readonly SourceHitMapping[] = [...manekinRawMappings, ...released71RawMappings];
const mappingById = new Map(mappings.map(mapping => [mapping.id, mapping]));
const skills = new Map<string, SourceHitMapping[]>();
for (const mapping of mappings) skills.set(mapping.skillId, [...skills.get(mapping.skillId) ?? [], mapping]);
const requiredCompleteOnly = new Set(["noAdditionalCharacterDamage", "noOwnStellarVortex"]);
const sourceRefsOf = (mapping: SourceHitMapping): string[] => mapping.sourcePaths.map(path =>
  `https://gitlab.com/${mapping.sourceRepository}/-/blob/${mapping.sourceCommit}/${path}`);
const contracts = new Map<string, RawSourceStateContract>();
for (const template of [...manekinRawTemplates, ...released71RawTemplates]) {
  const raw = template.stateContract in manekinRawStateContracts
    ? manekinRawStateContracts[template.stateContract as keyof typeof manekinRawStateContracts]
    : released71RawStateContracts[template.stateContract as keyof typeof released71RawStateContracts];
  const required = raw.requiredTrue.filter(key => !requiredCompleteOnly.has(key));
  const complete = [...raw.requiredTrue.filter(key => requiredCompleteOnly.has(key)),
    ...("completeActionRequiredTrue" in raw ? raw.completeActionRequiredTrue : [])];
  if (template.roles.some(role => role.attackTag === "plunge")) complete.push("zeroCollisionConfirmed");
  const first = skills.get(template.skillId)![0]!;
  contracts.set(template.skillId, {
    id: template.stateContract, label: template.label,
    requiredTrue: ["actualHitConfirmed", "talentLevelObserved", ...required],
    completeActionRequiredTrue: [...new Set(["wholeActionObserved", ...complete])],
    fieldLabels, sourceRefs: sourceRefsOf(first),
    scope: "固定原始参数与执行字段支持的条件输入。状态由本击实际观察确认；面板、装备与反应仍可编辑，不推定动画帧或自动团队轮转。",
  });
}
export function getRawSourceStateContract(skillId: string): RawSourceStateContract | undefined { return contracts.get(skillId); }
export const isRawSourceStateAction = (document: CalculatorDocument): boolean => contracts.has(document.gameContext?.skillId ?? "");
const stateOf = (context: RawSourceStateContext, hitId: string): Record<string, boolean> => ({ ...context.sharedState, ...context.hitStates?.[hitId] });
const requiredOf = (document: CalculatorDocument, contract: RawSourceStateContract): readonly string[] => document.scope === "single-hit"
  ? contract.requiredTrue : [...contract.requiredTrue, ...contract.completeActionRequiredTrue];

/** Gate actual states and restore exact reviewed scaling, without generating
 * future events. Unselected state dependencies cannot block an independent hit.
 * No state value here materializes a buff, so final panels need no accounting
 * reset/finalize hook and remain ordinary shared-core equipment snapshots. */
export function prepareRawSourceStateDocument(document: CalculatorDocument): CalculatorDocument {
  const contract = getRawSourceStateContract(document.gameContext?.skillId ?? "");
  if (!contract) return document;
  const result = structuredClone(document), game = result.gameContext!;
  const context = rawSourceStateContextSchema.parse(game.rawSourceState ?? {});
  game.rawSourceState = context;
  const sourceMappings = skills.get(game.skillId)!, selected = new Set(result.selectedHitIds);
  const required = requiredOf(result, contract), identityIssues: string[] = [];
  const template = [...manekinRawTemplates, ...released71RawTemplates].find(row => row.skillId === game.skillId)!;
  const characterIds: Record<string, string> = { manekin: "character:10000117", manekina: "character:10000118", vodyanitsa: "character:10000140", vesna: "character:10000143" };
  if (game.characterId !== characterIds[template.characterSlug] || game.abilityId !== `talent:${template.characterSlug}:${template.abilityKey}`) identityIssues.push("来源身份或天赋不匹配，不能把其他角色/技能的等级套入此动作。");
  if (game.constellation !== 0) identityIssues.push("该分支只覆盖 C0；奇偶固定配置未提供命座，不接受虚构的命座等级。");
  const level = game.effectiveTalentLevel;
  if (!Number.isInteger(level) || level < 1 || level > 15) identityIssues.push("需要原始表已记录的实际有效天赋等级 1 至 15；表中存在不等于游戏中可取得。");
  if (result.scope !== "single-hit" && sourceMappings.some(mapping => !result.hits.some(hit => hit.id === mapping.id))) identityIssues.push("完整输入缺少来源定义的伤害段；请重新加载本动作，不能以剩余一段冒充完整动作。");
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  let selectedComplete = true;
  for (const hit of result.hits) {
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(prefix));
    const mapping = mappingById.get(hit.id), state = stateOf(context, hit.id);
    const issues = [...identityIssues];
    if (!mapping || mapping.skillId !== game.skillId || hit.kind !== "ordinary") issues.push("该命中不是所选固定来源动作的普通伤害段；保留原阻塞，不能用条件声明抹除缺失字段。");
    for (const key of required) if (state[key] !== true) issues.push(`${contract.fieldLabels[key] ?? key}：${state[key] === false ? "条件不成立，不能使用此来源分支" : "尚未确认"}。`);
    if (hit.kind === "ordinary" && mapping && mapping.skillId === game.skillId) {
      const coefficient = mapping.sourceCoefficientValues?.[level - 1];
      if (coefficient === undefined) issues.push("缺少本次有效等级的精确来源倍率，不回退到一级或零。");
      else {
        hit.element = mapping.element; hit.attackTag = mapping.attackTag!;
        hit.terms = [{ stat: mapping.scalingStat, coefficient: coefficient * (mapping.coefficientMultiplier ?? 1) }];
        hit.sourceRefs = [...new Set([...hit.sourceRefs, ...sourceRefsOf(mapping)])];
      }
    }
    const id = `${prefix}${hit.id}`;
    result.dependencies.push({ id, status: issues.length ? "missing" : "provisional", sourceRefs: contract.sourceRefs,
      reason: issues.join("；") || "本击的必要来源条件已明确；固定原始字段并不等于独立游戏机制验证。" });
    hit.dependencies.push(id);
    if (selected.has(hit.id) && issues.length) selectedComplete = false;
  }
  game.scopeCoverage = result.scope === "single-hit" ? "single-hit"
    : selectedComplete && sourceMappings.every(mapping => selected.has(mapping.id)) ? "complete-cast" : "selected-components";
  result.assumptions = [...result.assumptions.filter(row => !row.startsWith("固定原始来源条件：")),
    "固定原始来源条件：仅按本击明确状态使用已审阅伤害字段；不生成未来事件，不将单源提取或相同数据链比对升级为独立机制验证。"];
  return result;
}

export function rawSourceStateTrace(document: CalculatorDocument, hit: CalculatorHit): CalculationTraceNode[] {
  const contract = getRawSourceStateContract(document.gameContext?.skillId ?? "");
  if (!contract) return [];
  const context = rawSourceStateContextSchema.parse(document.gameContext?.rawSourceState ?? {});
  const state = stateOf(context, hit.id), required = requiredOf(document, contract);
  const missing = required.filter(key => state[key] !== true), expression = expr.mul(...required.map(key => expr.input(key)));
  if (missing.length) return [{ id: `${prefix}trace:${hit.id}`, ruleId: `${prefix}eligibility`, titleKey: "固定来源分支的本击状态资格",
    explanationKey: "未知不是零，也不是默认成立；本分支不能出具确定伤害。", status: "blocked", expression,
    inputs: required.filter(key => state[key] !== undefined).map(key => traceInput(key, state[key] ? 1 : 0, "boolean", "explicit-actual-hit-state", contract.fieldLabels[key] ?? key)),
    childIds: [], sourceRefs: contract.sourceRefs, warnings: missing.map(key => `${contract.fieldLabels[key] ?? key}：${state[key] === false ? "不成立" : "未知"}`),
    symbolicFormula: formatFormulaExpression(expression), substitution: formatFormulaExpression(expression) }];
  const trace = new TraceBuilder(contract.sourceRefs);
  trace.add(`${prefix}trace:${hit.id}`, "固定来源分支的本击状态资格", expression,
    required.map(key => traceInput(key, 1, "boolean", "explicit-actual-hit-state", contract.fieldLabels[key] ?? key)),
    { ruleId: `${prefix}eligibility`, status: "assumed", unit: "boolean", warnings: ["声明为实际输入，不代表游戏观察已独立验证；不自动生成额外伤害事件。"] });
  return trace.nodes;
}
