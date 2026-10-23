import type { CalculatorDocument, CalculatorFormula, CalculatorHit } from './calculator-model';
import { expr } from './calculation-trace';
import { resolveCalculatorStats } from './calculator';
import { hutaoDamageContextSchema, type HutaoDamageContext } from './hutao-damage-context';
import { hutaoPrimaryMappings, hutaoPrimarySourceEvidence } from '../../game-data/src/character-mappings/hutao-primary-mappings';

export type HutaoCalculatorDocument = CalculatorDocument & {
  gameContext: NonNullable<CalculatorDocument['gameContext']> & { hutaoDamage?: HutaoDamageContext };
};
export const HUTAO_DAMAGE_SOURCE_REFS = hutaoPrimarySourceEvidence.files.map(file =>
  `https://github.com/genshinsim/gcsim/blob/${hutaoPrimarySourceEvidence.revision}/${file.path}`);
export const HUTAO_DAMAGE_DEPENDENCY_PREFIX = 'hutao-primary:';
/** Shared action allowlists may admit C0–C6; C6 still needs explicit actual-hit accounting. */
export const HUTAO_PRIMARY_MAX_CONSTELLATION = 6 as const;
export const hutaoContext = (document: CalculatorDocument): HutaoDamageContext | undefined =>
  (document as HutaoCalculatorDocument).gameContext?.hutaoDamage;
export function isHutaoPrimaryDocument(document: CalculatorDocument): boolean {
  return document.dataIdentity.releaseStatus !== 'preview' && document.gameContext?.characterId === 'character:10000046'
    && hutaoPrimaryMappings.some(mapping => mapping.skillId === document.gameContext?.skillId);
}
export const isHutaoDamageAction = isHutaoPrimaryDocument;
const input = (key: string, value: number, unit: string, origin: string) => ({ key, value, unit, origin, meaningKey: key });

/** Extra flat ATK: the cap uses white ATK, independently of final ATK and ATK%. */
export function createHutaoSkillAttackFormula(state: {
  skillTalentLevel: number; baseAttack: number; maxHpUnchangedSinceSkillCast: boolean; skillCastMaxHp?: number;
}): CalculatorFormula {
  const coefficient = hutaoPrimarySourceEvidence.skillConversion.values[state.skillTalentLevel - 1];
  if (!Number.isInteger(state.skillTalentLevel) || coefficient === undefined) throw new Error('需要独立有效E天赋等级1–15。');
  if (!Number.isFinite(state.baseAttack) || state.baseAttack < 0) throw new Error('需要角色加武器基础攻击力。');
  if (!state.maxHpUnchangedSinceSkillCast && (state.skillCastMaxHp === undefined || !Number.isFinite(state.skillCastMaxHp) || state.skillCastMaxHp <= 0))
    throw new Error('最大生命有变化时，需要施放E时的实际最大生命。');
  return {
    ruleId: 'hutao-damage-e-hp-to-extra-atk-b4ae769', label: '蝶引来生：施放E时最大生命×独立E系数，上限为400%基础攻击',
    expression: expr.min(expr.mul(expr.input('hutaoSkillHpRatio'), expr.input(state.maxHpUnchangedSinceSkillCast ? 'hp' : 'hutaoSkillCastMaxHp')),
      expr.mul(expr.value(4), expr.input('hutaoBaseAttack'))),
    inputs: [input('hutaoSkillHpRatio', coefficient, 'ratio', 'pinned-independent-effective-skill-talent'),
      input('hutaoBaseAttack', state.baseAttack, 'stat', 'character-and-weapon-white-attack'),
      ...(state.maxHpUnchangedSinceSkillCast ? [] : [input('hutaoSkillCastMaxHp', state.skillCastMaxHp!, 'stat', 'explicit-historical-skill-cast')])],
    sourceRefs: HUTAO_DAMAGE_SOURCE_REFS,
  };
}

export function createHutaoA4BonusFormula(ascension: number, hpPercent: number, included: boolean): CalculatorFormula {
  return {
    ruleId: 'hutao-damage-a4-low-hp-b4ae769', label: '血之灶火：取样时生命≤50%的33%火伤 − 面板已含份额',
    expression: expr.sub(expr.mul(expr.value(.33), expr.value(Number(ascension >= 4)),
      expr.condition('lte', expr.input('hutaoSnapshotHpPercent'), expr.value(50), expr.value(1), expr.value(0))),
    expr.value(included ? .33 : 0)),
    inputs: [input('hutaoSnapshotHpPercent', hpPercent, 'percent', 'actual-hit-snapshot-health')], sourceRefs: HUTAO_DAMAGE_SOURCE_REFS,
  };
}

/** Source CR modifier adds 100 percentage points. Probability clamping stays in the common core. */
export function createHutaoC6CritRateFormula(active: boolean, included: boolean): CalculatorFormula {
  return {
    ruleId: 'hutao-damage-c6-crit-rate-b4ae769', label: '幽蝶能留一缕芳：实际生效的100%暴击率 − 输入已含份额',
    expression: expr.sub(expr.input('hutaoC6ActiveCritRate'), expr.input('hutaoC6IncludedCritRate')),
    inputs: [input('hutaoC6ActiveCritRate', Number(active), 'ratio', 'explicit-actual-c6-buff-state'),
      input('hutaoC6IncludedCritRate', Number(included), 'ratio', 'explicit-final-crit-panel-accounting')],
    requirements: { minimumConstellation: 6, maximumConstellation: 6, attackTags: ['normal', 'charged'] },
    sourceRefs: HUTAO_DAMAGE_SOURCE_REFS,
  };
}

function identity(document: CalculatorDocument, hit: CalculatorHit, context: HutaoDamageContext): string {
  const stats = resolveCalculatorStats(document.build);
  const ascension = (document.build.mode === 'equipment-derived' ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext?.ascension;
  const state = [document.gameContext?.skillId, document.gameContext?.abilityId, document.gameContext?.effectiveTalentLevel,
    context.skillTalentLevel, document.gameContext?.constellation, ascension, document.characterLevel, hit.id,
    context.paramitaActive, context.skillAttackIncludedInPanel, context.maxHpUnchangedSinceSkillCast, context.skillCastMaxHp,
    context.baseAttack, context.hpPercentAtSnapshot, context.a4ThresholdStable, context.a4IncludedInDamageBonus,
    stats.atk, stats.hp, stats.def, stats.em, stats.critRate, stats.critDamage, stats.energyRecharge];
  // Keep the prior C0/C1 preimage unchanged so existing saved documents remain readable.
  if (document.gameContext?.constellation === 6) state.push(context.c6Active, context.c6CritRateIncludedInPanel);
  return JSON.stringify(state);
}

/** A selected contact only. Foreign evidence is retained and same-slot conflicts are blocked. */
export function prepareHutaoDamageDocument(document: CalculatorDocument): CalculatorDocument {
  if (!isHutaoPrimaryDocument(document)) return document;
  const result = structuredClone(document) as HutaoCalculatorDocument, game = result.gameContext;
  const context = hutaoDamageContextSchema.parse(game.hutaoDamage ?? {}); game.hutaoDamage = context;
  const mapping = hutaoPrimaryMappings.find(row => row.skillId === game.skillId)!;
  const ascension = (result.build.mode === 'equipment-derived' ? result.build.equipment?.ascension : result.build.ascension) ?? game.ascension;
  if (result.build.mode === 'equipment-derived') context.baseAttack = result.build.characterBaseAtk + result.build.weaponBaseAtk;
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(HUTAO_DAMAGE_DEPENDENCY_PREFIX));
  for (const hit of result.hits) {
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(HUTAO_DAMAGE_DEPENDENCY_PREFIX));
    const issues: string[] = [];
    if (result.scope !== 'single-hit' || result.hits.length !== 1 || hit.id !== mapping.id
      || result.selectedHitIds.length !== 1 || result.selectedHitIds[0] !== mapping.id || hit.kind !== 'ordinary')
      issues.push('此入口仅计算所选一次火元素命中；第五段两击分别取样，不能增加其他命中或当作完整E循环。');
    if (!Number.isInteger(game.constellation) || game.constellation < 0 || game.constellation > HUTAO_PRIMARY_MAX_CONSTELLATION) issues.push('本入口只支持已审阅的C0–C6命座范围。');
    const c6 = game.constellation === 6;
    if (c6) {
      if (context.c6Active === undefined) issues.push('请确认本击取样时C6的100%暴击率增益是否实际生效；当前低血量不能证明触发或仍在持续。');
      if (context.c6CritRateIncludedInPanel === undefined) issues.push('请确认输入暴击率是否已经包含C6增加的100个百分点。');
    } else if (context.c6Active === true || context.c6CritRateIncludedInPanel === true) issues.push('当前命座未解锁C6，不能声称C6增益生效或已含于暴击率面板。');
    if (game.abilityId !== 'talent:hutao:combat1') issues.push('普攻与重击必须使用独立普攻天赋，不能以E天赋替代。');
    const coefficient = Number.isInteger(game.effectiveTalentLevel) ? mapping.sourceCoefficientValues?.[game.effectiveTalentLevel - 1] : undefined;
    if (coefficient === undefined) issues.push('缺少1–15级的有效普攻倍率；有效等级不再增加命座等级。');
    if (context.paramitaActive !== true) issues.push(context.paramitaActive === undefined ? '请确认本击取样时仍处于开E后的彼岸蝶舞状态。' : '彼岸蝶舞未生效，不能使用本火元素入口。');
    if (context.skillTalentLevel === undefined) issues.push('请提供独立的有效E天赋等级；它决定HP转攻击比例，不借用普攻等级。');
    if (context.skillAttackIncludedInPanel === undefined) issues.push('请确认攻击力面板是否已经包含本次开E增加的攻击力。');
    if (context.skillAttackIncludedInPanel === false) {
      if (context.baseAttack === undefined) issues.push('请填写角色加武器的基础攻击力（白字），才能核对400%上限。');
      if (context.maxHpUnchangedSinceSkillCast === undefined) issues.push('请确认最大生命是否从施放E到本击取样一直相同。');
      if (context.maxHpUnchangedSinceSkillCast === false && context.skillCastMaxHp === undefined)
        issues.push('最大生命有变化，请填写施放E当时的最大生命；不能改用当前最大生命。');
    }
    if (ascension === undefined) issues.push('请填写实际突破阶段，确认半血33%火伤被动是否已解锁。');
    if (ascension !== undefined && ascension >= 4) {
      if (context.hpPercentAtSnapshot === undefined) issues.push('请填写本击取样时的生命百分比；不是开E前的生命比例。');
      if (context.a4ThresholdStable !== true) issues.push('请确认生命已在半血同一侧稳定、火伤面板已更新；刚跨半血时不能套用瞬时近似。');
    }
    if (context.a4IncludedInDamageBonus === undefined) issues.push('请确认火伤输入是否已经包含半血被动的33%。');
    if (hit.kind === 'ordinary') {
      hit.element = 'pyro'; hit.attackTag = mapping.attackTag!;
      if (coefficient !== undefined) hit.terms = [{ stat: 'atk', coefficient }];
      if (hit.baseDamageFormula || hit.groupMultiplier !== 1) issues.push('基础表达式或倍数与固定单击来源冲突，不能用总倍率伪造多次命中。');
      if (hit.attackAdjustment?.formula.ruleId === 'hutao-damage-e-hp-to-extra-atk-b4ae769') delete hit.attackAdjustment;
      else if (hit.attackAdjustment) issues.push('已有其他来源的攻击调整，必须先明确合并，不能覆盖该来源证据。');
      if (hit.damageBonusFormula?.ruleId === 'hutao-damage-a4-low-hp-b4ae769') delete hit.damageBonusFormula;
      else if (hit.damageBonusFormula) issues.push('已有其他来源的增伤公式，必须先明确合并，不能覆盖该来源证据。');
      if (hit.critRateFormula?.ruleId === 'hutao-damage-c6-crit-rate-b4ae769') delete hit.critRateFormula;
      else if (c6 && hit.critRateFormula) issues.push('已有其他来源的暴击率公式，必须先明确合并，不能覆盖该来源证据。');
      const saved = context.finalizedHitStates?.[hit.id], frozen = hit.finalSnapshot || hit.effectiveCritRate !== undefined || hit.effectiveCritDamage !== undefined;
      if ((saved !== undefined && saved !== identity(result, hit, context))
        || (frozen && (saved === undefined || hit.finalSnapshot && hit.finalSnapshot.origin !== 'equipment-conversion')))
        issues.push('本击状态、等级或面板与历史转换不一致；请重新应用配装，不能改状态后复用旧快照。');
      if (!issues.length) {
        if (context.skillAttackIncludedInPanel === false) hit.attackAdjustment = { accounting: 'add-to-panel', formula: createHutaoSkillAttackFormula({
          skillTalentLevel: context.skillTalentLevel!, baseAttack: context.baseAttack!, maxHpUnchangedSinceSkillCast: context.maxHpUnchangedSinceSkillCast === true,
          ...(context.skillCastMaxHp === undefined ? {} : { skillCastMaxHp: context.skillCastMaxHp }),
        }) };
        hit.damageBonusFormula = createHutaoA4BonusFormula(ascension!, context.hpPercentAtSnapshot ?? 100, context.a4IncludedInDamageBonus!);
        if (c6) hit.critRateFormula = createHutaoC6CritRateFormula(context.c6Active!, context.c6CritRateIncludedInPanel!);
      }
    }
    hit.sourceRefs = [...new Set([...hit.sourceRefs, ...HUTAO_DAMAGE_SOURCE_REFS])];
    const id = HUTAO_DAMAGE_DEPENDENCY_PREFIX + hit.id; hit.dependencies.push(id);
    result.dependencies.push({ id, status: issues.length ? 'missing' : 'provisional', reason: issues.join('；')
      || 'C0–C6开E后的实际单击；独立NA/E有效等级、E施放HP与白字上限、A4和C6实际生效/已含份额分别核对，不追加血梅香或队友增益。', sourceRefs: HUTAO_DAMAGE_SOURCE_REFS });
  }
  game.scopeCoverage = 'single-hit';
  game.attributionPolicy = 'C0–C6彼岸蝶舞所选自身单击：NA与有效E等级独立且不重复加C3；E增攻按施放时HP与400%白字上限固定，A4与C6分别按实际状态和已含份额补差。C2血梅香、C4队友暴击和C5的Q不并入本击，不提供完整轮转。';
  result.assumptions = result.assumptions.filter(row => !row.startsWith('胡桃E单击：'));
  result.assumptions.push('胡桃E单击：普攻第5段两击分别在15/26帧快照，重击按固定源0帧快照、3帧命中且存在TODO近似。A4使用明确稳定的半血分支，不声称瞬间跨半血的0.3秒检查时序已验证。');
  result.assumptions.push('胡桃E单击：C6增加100个百分点暴击率，并由公共公式限制实际概率；只使用明确的本击实际增益状态，不根据当前HP、命座或源2秒轮询近似推算触发、10秒到期、60秒冷却或免死。');
  return result;
}

export function resetHutaoPanelAccounting(document: CalculatorDocument, mode: 'fresh-equipment' | 'imported-final'): void {
  if (!isHutaoPrimaryDocument(document)) return;
  const context = (document as HutaoCalculatorDocument).gameContext.hutaoDamage ??= {};
  delete context.finalizedHitStates; delete context.skillCastMaxHp; delete context.baseAttack;
  if (mode === 'fresh-equipment') {
    context.skillAttackIncludedInPanel = false; context.a4IncludedInDamageBonus = false; context.c6CritRateIncludedInPanel = false;
  } else for (const key of ['paramitaActive', 'skillAttackIncludedInPanel', 'maxHpUnchangedSinceSkillCast', 'hpPercentAtSnapshot', 'a4ThresholdStable', 'a4IncludedInDamageBonus', 'c6Active', 'c6CritRateIncludedInPanel'] as const) delete context[key];
}

export function finalizeHutaoDamageContextSnapshot(document: CalculatorDocument): void {
  if (!isHutaoPrimaryDocument(document)) return;
  const context = (document as HutaoCalculatorDocument).gameContext.hutaoDamage ??= {};
  const entries = document.hits.filter(hit => hit.kind === 'ordinary').map(hit => [hit.id, identity(document, hit, context)] as const);
  if (entries.some(([id, state]) => context.finalizedHitStates?.[id] !== undefined && context.finalizedHitStates[id] !== state))
    throw new Error('胡桃历史状态已改变，不能重新盖写快照身份；请重新应用配装。');
  context.finalizedHitStates = Object.fromEntries(entries);
}
export const finalizeHutaoPanelAccounting = finalizeHutaoDamageContextSnapshot;
