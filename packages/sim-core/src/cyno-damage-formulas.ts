import type { CalculatorDocument, CalculatorFormula, CalculatorHit } from './calculator-model';
import { expr } from './calculation-trace';
import { cynoDamageContextSchema, type CynoDamageContext } from './cyno-damage-context';
import { cynoDamageMappings, cynoDamageSourceEvidence } from '../../game-data/src/character-mappings/cyno-damage-mappings';

export type CynoCalculatorDocument = CalculatorDocument & {
  gameContext: NonNullable<CalculatorDocument['gameContext']> & { cynoDamage?: CynoDamageContext };
};
export const CYNO_DAMAGE_SOURCE_REFS = cynoDamageSourceEvidence.files.map(file =>
  `https://github.com/genshinsim/gcsim/blob/${cynoDamageSourceEvidence.revision}/${file.path}`);
export const CYNO_DAMAGE_DEPENDENCY_PREFIX = 'cyno-damage:';
export const cynoContext = (document: CalculatorDocument): CynoDamageContext | undefined =>
  (document as CynoCalculatorDocument).gameContext?.cynoDamage;
export function isCynoDamageDocument(document: CalculatorDocument): boolean {
  return document.dataIdentity.releaseStatus !== 'preview'
    && document.gameContext?.characterId === 'character:10000071'
    && cynoDamageMappings.some(mapping => mapping.skillId === document.gameContext?.skillId);
}
export const isCynoDamageAction = isCynoDamageDocument;

/** Final ATK/EM stats cannot contain FlatDmg. An empty unmaterialized additive input proves zero. */
export function canInferCynoA4BaseZero(document: CalculatorDocument): boolean {
  return isCynoDamageDocument(document) && document.hits.length === 1 && document.hits.every(hit =>
    hit.kind === 'ordinary' && hit.additiveBaseDamage === 0 && !hit.finalSnapshot
    && !hit.finalizedEquipmentEffects?.length
    && (!hit.additiveBaseFormula || hit.additiveBaseFormula.ruleId.startsWith('cyno-damage-')));
}

const input = (key: string, value: number, unit: string, origin: string) =>
  ({ key, value, unit, origin, meaningKey: key });

/** This EM adjustment also reaches Aggravate and equipment effects through the ordinary panel pipeline. */
export function createCynoBurstEmAdjustment(included: boolean): CalculatorFormula {
  return {
    ruleId: 'cyno-damage-q-em-accounting-b4ae769', label: '启途誓使100精通 − 当前面板已含份额',
    expression: expr.sub(expr.value(100), expr.input('cynoIncludedBurstEm')),
    inputs: [input('cynoIncludedBurstEm', included ? 100 : 0, 'stat', 'explicit-panel-accounting')],
    sourceRefs: CYNO_DAMAGE_SOURCE_REFS,
  };
}

export interface CynoA4FormulaInput {
  unlocked: boolean;
  emStableFromActionStart: boolean;
  actionStartEm?: number;
  includedA4Base: number;
}
export function createCynoA4AdditiveFormula(state: CynoA4FormulaInput): CalculatorFormula {
  if (state.unlocked && !state.emStableFromActionStart && state.actionStartEm === undefined)
    throw new Error('赛诺A4需要动作开始时的实际精通，或明确精通稳定。');
  const explicit = state.unlocked && !state.emStableFromActionStart;
  return {
    ruleId: 'cyno-damage-a4-action-start-em-b4ae769', label: 'A4：普攻动作开始时150%精通附加基伤 − 输入已含份额',
    expression: expr.sub(state.unlocked ? expr.mul(expr.value(1.5), expr.input(explicit ? 'cynoActionStartEm' : 'em')) : expr.value(0), expr.input('cynoIncludedA4Base')),
    inputs: [
      ...(explicit ? [input('cynoActionStartEm', state.actionStartEm!, 'stat', 'explicit-action-start-sample')] : []),
      input('cynoIncludedA4Base', state.includedA4Base, 'damage', 'explicit-panel-accounting'),
    ],
    sourceRefs: CYNO_DAMAGE_SOURCE_REFS,
  };
}

function finalizedState(document: CalculatorDocument, hit: CalculatorHit, context: CynoDamageContext): string {
  const ascension = (document.build.mode === 'equipment-derived' ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext?.ascension;
  return JSON.stringify([document.gameContext?.skillId, document.gameContext?.abilityId,
    document.gameContext?.effectiveTalentLevel, document.gameContext?.constellation, ascension, document.characterLevel, hit.id,
    context.burstActive, context.burstEmIncludedInPanel, context.emStableFromActionStart, context.actionStartEm, context.includedA4Base]);
}

/** Rebuild sourced coefficients and accounting before every evaluation. No shared schema mutation is needed. */
export function prepareCynoDamageDocument(document: CalculatorDocument): CalculatorDocument {
  if (!isCynoDamageDocument(document)) return document;
  const result = structuredClone(document) as CynoCalculatorDocument, game = result.gameContext;
  const context = cynoDamageContextSchema.parse(game.cynoDamage ?? {}); game.cynoDamage = context;
  if (context.includedA4Base === undefined && canInferCynoA4BaseZero(result)) context.includedA4Base = 0;
  const mapping = cynoDamageMappings.find(entry => entry.skillId === game.skillId)!;
  const ascension = (result.build.mode === 'equipment-derived' ? result.build.equipment?.ascension : result.build.ascension) ?? game.ascension;
  result.dependencies = result.dependencies.filter(dependency => !dependency.id.startsWith(CYNO_DAMAGE_DEPENDENCY_PREFIX));
  for (const hit of result.hits) {
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(CYNO_DAMAGE_DEPENDENCY_PREFIX));
    if (hit.kind !== 'ordinary') {
      const id = CYNO_DAMAGE_DEPENDENCY_PREFIX + hit.id; hit.dependencies.push(id);
      result.dependencies.push({ id, status: 'missing', reason: '启途誓使单击必须使用已核对的普通伤害表达式，不能换成已结算伤害或其他命中类型。', sourceRefs: CYNO_DAMAGE_SOURCE_REFS });
      continue;
    }
    const issues: string[] = [];
    if (result.scope !== 'single-hit' || result.hits.length !== 1 || hit.id !== mapping.id
      || result.selectedHitIds.length !== 1 || result.selectedHitIds[0] !== mapping.id)
      issues.push('此入口仅计算明确的一次命中；第四段两击及其余循环请分别选择实际单击。');
    if (game.constellation !== 0) issues.push('此启途誓使入口仅审阅C0；不能静默忽略高命座增伤或额外渡荒之雷。');
    if (game.abilityId !== 'talent:cyno:combat3') issues.push('启途誓使倍率必须使用独立Q天赋，不能借用普攻天赋等级。');
    if (hit.baseDamageFormula || hit.groupMultiplier !== 1) issues.push('本入口只保留固定Q倍率的一次命中，不能覆盖基础伤害公式或乘出未声明的多击。');
    const coefficient = Number.isInteger(game.effectiveTalentLevel) ? mapping.sourceCoefficientValues?.[game.effectiveTalentLevel - 1] : undefined;
    if (coefficient === undefined) issues.push('请提供1–15级的有效Q天赋等级；本入口不会再次增加命座等级。');
    else hit.terms = [{ stat: 'atk', coefficient }];
    hit.element = 'electro'; hit.attackTag = mapping.attackTag!;
    if (context.burstActive !== true) issues.push(context.burstActive === undefined ? '请确认本动作开始时处于启途誓使状态。' : '本动作开始时未处于启途誓使状态，不能使用Q强化倍率。');
    if (context.burstEmIncludedInPanel === undefined) issues.push('请确认输入精通面板是否已包含Q的100精通。');
    if (context.includedA4Base === undefined) issues.push('请确认本击附加基础伤害中已含多少赛诺A4；未含填0。');
    const normal = mapping.attackTag === 'normal';
    if (normal && ascension === undefined) issues.push('请填写实际突破阶段，以确定150%精通加值被动是否解锁。');
    if (normal && ascension !== undefined && ascension >= 4) {
      if (context.emStableFromActionStart === undefined) issues.push('请确认普攻动作开始至本击快照时精通是否稳定。');
      else if (!context.emStableFromActionStart && context.actionStartEm === undefined) issues.push('精通发生变化时，请填写普攻动作开始时的实际总精通（含当时Q增益）。');
    }
    if (hit.elementalMasteryAdjustment?.formula.ruleId.startsWith('cyno-damage-')) delete hit.elementalMasteryAdjustment;
    else if (hit.elementalMasteryAdjustment) issues.push('此击已有其他来源的精通调整，需合并来源后再计算，不能覆盖。');
    if (hit.additiveBaseFormula?.ruleId.startsWith('cyno-damage-')) delete hit.additiveBaseFormula;
    else if (hit.additiveBaseFormula) issues.push('此击已有其他来源的附加基伤公式，需合并来源后再计算，不能覆盖。');
    const saved = context.finalizedHitStates?.[hit.id];
    const frozen = hit.finalSnapshot || hit.effectiveCritRate !== undefined || hit.effectiveCritDamage !== undefined;
    if ((saved !== undefined && saved !== finalizedState(result, hit, context))
      || (frozen && (saved === undefined || (hit.finalSnapshot && hit.finalSnapshot.origin !== 'equipment-conversion'))))
      issues.push('赛诺状态或天赋与已结算快照不一致；请重新应用配装，不能更改状态后沿用旧快照。');
    if (!issues.length) {
      hit.elementalMasteryAdjustment = { accounting: 'add-to-panel', formula: createCynoBurstEmAdjustment(context.burstEmIncludedInPanel!) };
      hit.additiveBaseFormula = createCynoA4AdditiveFormula({
        unlocked: normal && ascension !== undefined && ascension >= 4,
        emStableFromActionStart: context.emStableFromActionStart === true,
        ...(context.actionStartEm === undefined ? {} : { actionStartEm: context.actionStartEm }),
        includedA4Base: context.includedA4Base!,
      });
    }
    hit.sourceRefs = [...new Set([...hit.sourceRefs, ...CYNO_DAMAGE_SOURCE_REFS])];
    const id = CYNO_DAMAGE_DEPENDENCY_PREFIX + hit.id; hit.dependencies.push(id);
    result.dependencies.push({ id, status: issues.length ? 'missing' : 'provisional',
      reason: issues.join('；') || 'C0启途誓使单击：独立Q倍率、100精通补差、A4动作开始精通与本击快照分别核对。', sourceRefs: CYNO_DAMAGE_SOURCE_REFS });
  }
  game.scopeCoverage = 'single-hit';
  game.attributionPolicy = '仅所选C0启途誓使一次实际普攻或重击。Q提供100精通；A4普攻加值在该段动作开始取样，普攻面板在命中帧取样，重击面板在动作开始取样。不含E末途真眼35%、渡荒之雷或完整循环。';
  result.assumptions = result.assumptions.filter(value => !value.startsWith('赛诺Q单击：'));
  result.assumptions.push('赛诺Q单击：五段普攻共六击，第四段5/14帧分别取样；本入口只表示所选一击。明确精通稳定时才能用本击精通代替动作开始精通；重击没有A4普攻加值。');
  return result;
}

export function resetCynoPanelAccounting(document: CalculatorDocument, mode: 'fresh-equipment' | 'imported-final'): void {
  if (!isCynoDamageDocument(document)) return;
  const context = (document as CynoCalculatorDocument).gameContext.cynoDamage ??= {};
  delete context.finalizedHitStates; delete context.actionStartEm;
  if (mode === 'fresh-equipment') {
    context.burstEmIncludedInPanel = false; context.includedA4Base = 0;
  } else {
    delete context.burstEmIncludedInPanel; delete context.includedA4Base;
    delete context.burstActive; delete context.emStableFromActionStart;
    if (canInferCynoA4BaseZero(document)) context.includedA4Base = 0;
  }
}

/** Call after ordinary conversion has captured equipment panels, exactly once per materialization. */
export function finalizeCynoDamageContextSnapshot(document: CalculatorDocument): void {
  if (!isCynoDamageDocument(document)) return;
  const context = (document as CynoCalculatorDocument).gameContext.cynoDamage ??= {};
  context.finalizedHitStates = Object.fromEntries(document.hits.filter(hit => hit.kind === 'ordinary')
    .map(hit => [hit.id, finalizedState(document, hit, context)]));
}
export const finalizeCynoPanelAccounting = finalizeCynoDamageContextSnapshot;
