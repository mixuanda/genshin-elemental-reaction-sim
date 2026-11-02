import type { CalculatorDocument } from '../../../packages/sim-core/src/calculator-model';
import { hutaoDamageContextSchema } from '../../../packages/sim-core/src/hutao-damage-context';
import { hutaoContext, isHutaoPrimaryDocument, type HutaoCalculatorDocument } from '../../../packages/sim-core/src/hutao-damage-formulas';
import type { CalculatorFieldRequirementDraft, CalculatorRequirementAdapter } from './calculator-requirements';

const path = (key: string) => `gameContext.hutaoDamage.${key}`;
const state = (key: string, label: string, value: boolean | undefined, no = '否', yes = '是') =>
  `<label>${label}<select data-source-cast-state-field="${path(key)}"><option value="unknown"${value === undefined ? ' selected' : ''}>请选择</option><option value="0"${value === false ? ' selected' : ''}>${no}</option><option value="1"${value === true ? ' selected' : ''}>${yes}</option></select></label>`;
const number = (key: string, label: string, value: number | undefined, min = 0, max?: number, readonly = false) =>
  `<label>${label}<input type="number" data-field="${path(key)}" data-source-cast-number-field data-optional-number min="${min}"${max === undefined ? '' : ` max="${max}"`} step="${key === 'skillTalentLevel' ? '1' : 'any'}" value="${value ?? ''}" placeholder="请填写实际值"${readonly ? ' readonly aria-readonly="true"' : ''}></label>`;

export function renderHutaoControls(document: CalculatorDocument): string {
  if (!isHutaoPrimaryDocument(document)) return '';
  const context = hutaoContext(document) ?? {}, game = document.gameContext!;
  const ascension = (document.build.mode === 'equipment-derived' ? document.build.equipment?.ascension : document.build.ascension) ?? game.ascension;
  const a4 = ascension === undefined || ascension >= 4, castHp = context.skillAttackIncludedInPanel === false;
  const c6 = game.constellation === 6;
  const charged = game.skillId === 'hutao-paramita-charged-c0-c1';
  const baseAttack = document.build.mode === 'equipment-derived' ? document.build.characterBaseAtk + document.build.weaponBaseAtk : context.baseAttack;
  return `<fieldset data-source-cast-controls="hutao"><legend>胡桃 · 开E后的这一击</legend><div class="calculator-fields">
${state('paramitaActive', '本击取样时仍在开E后的彼岸蝶舞状态', context.paramitaActive)}
${number('skillTalentLevel', '有效E天赋等级（与普攻等级独立）', context.skillTalentLevel, 1, 15)}
${ascension === undefined ? '<label>实际突破阶段<input type="number" data-field="gameContext.ascension" data-source-cast-number-field data-optional-number min="0" max="6" step="1" value="" placeholder="0–6"></label>' : ''}
${a4 ? number('hpPercentAtSnapshot', charged ? '重击动作开始取样时生命（%）' : '这一下普攻命中取样时生命（%）', context.hpPercentAtSnapshot, 0, 100)
  + state('a4ThresholdStable', '生命已在半血同一侧稳定，火伤面板已更新', context.a4ThresholdStable, '刚跨半血或尚未确认', '已稳定并确认') : ''}
${c6 ? state('c6Active', '这一下取样时，C6的100%暴击率增益仍在生效', context.c6Active, '未触发或已经结束', '确认仍在生效') : ''}</div>
<details${context.skillAttackIncludedInPanel === undefined || context.a4IncludedInDamageBonus === undefined || c6 && context.c6CritRateIncludedInPanel === undefined ? ' open' : ''}><summary>输入面板已含增益</summary><div class="calculator-fields">
${state('skillAttackIncludedInPanel', '攻击力已经包含本次开E增加的攻击', context.skillAttackIncludedInPanel)}
${castHp ? state('maxHpUnchangedSinceSkillCast', '施放E时的最大生命与现在相同，期间也未改变', context.maxHpUnchangedSinceSkillCast)
  + (context.maxHpUnchangedSinceSkillCast === false ? number('skillCastMaxHp', '施放E当时的最大生命', context.skillCastMaxHp, 1) : '')
  + number('baseAttack', '基础攻击力（角色＋武器白字）', baseAttack, 0, undefined, document.build.mode === 'equipment-derived') : ''}
${state('a4IncludedInDamageBonus', '火伤加成输入已包含半血被动的33%', context.a4IncludedInDamageBonus)}
${c6 ? state('c6CritRateIncludedInPanel', '输入暴击率已经包含C6增加的100个百分点', context.c6CritRateIncludedInPanel) : ''}</div></details>
<p class="calculator-hint">E增攻在开E时按最大生命固定，最高为基础攻击的4倍；之后生命变化不能改写这份加成。${charged ? '此处只算这一重击；血梅香另算。' : '普攻第五段两击分别选择。'} 半血被动含50%边界，刚跨半血时请等火伤面板更新后计算。C3已含于有效E等级，不再增加。${c6 ? 'C6只按这一下实际增益计算；当前血量低于25%不能证明它已触发或尚未结束。' : 'C2血梅香、C4队友增益与C5的Q不并入这一击。'}</p></fieldset>`;
}

/** Optional handler; existing generic source-state/optional-number handlers can use the same paths. */
export function updateHutaoDamageControl(document: CalculatorDocument, fieldPath: string, raw: string): boolean {
  if (!isHutaoPrimaryDocument(document) || !fieldPath.startsWith('gameContext.hutaoDamage.')) return false;
  const key = fieldPath.slice('gameContext.hutaoDamage.'.length);
  const numeric = ['skillTalentLevel', 'skillCastMaxHp', 'baseAttack', 'hpPercentAtSnapshot'];
  if (![...numeric, 'paramitaActive', 'skillAttackIncludedInPanel', 'maxHpUnchangedSinceSkillCast', 'a4ThresholdStable', 'a4IncludedInDamageBonus', 'c6Active', 'c6CritRateIncludedInPanel'].includes(key)) return false;
  const next: Record<string, unknown> = { ...hutaoContext(document) };
  if (raw === '' || raw === 'unknown') delete next[key];
  else if (numeric.includes(key)) next[key] = Number(raw);
  else if (raw === '0' || raw === '1') next[key] = raw === '1';
  else throw new Error('胡桃条件必须为是、否或未知。');
  (document as HutaoCalculatorDocument).gameContext.hutaoDamage = hutaoDamageContextSchema.parse(next);
  return true;
}

export const hutaoRequirementAdapter: CalculatorRequirementAdapter = {
  id: 'hutao-primary-conditions', applies: isHutaoPrimaryDocument,
  collect(document) {
    const context = hutaoContext(document) ?? {}, fields: CalculatorFieldRequirementDraft[] = [];
    const ascension = (document.build.mode === 'equipment-derived' ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext?.ascension;
    const add = (key: string, label: string, explanation: string, numeric = false, unsatisfied = false, fullPath = path(key)) => fields.push({
      id: `hutao:${key}`, fieldPath: fullPath, controlSelector: numeric ? `input[data-field="${fullPath}"]` : `select[data-source-cast-state-field="${fullPath}"]`,
      label, explanation, status: unsatisfied ? 'condition-not-satisfied' : 'input-required',
      dependencyIds: document.selectedHitIds.map(id => 'hutao-primary:' + id), hitIds: document.selectedHitIds,
    });
    if (context.paramitaActive !== true) add('paramitaActive', '开E后的彼岸蝶舞状态', '取样时必须实际处于E状态；选择此动作不等于证明E已生效。', false, context.paramitaActive === false);
    if (context.skillTalentLevel === undefined) add('skillTalentLevel', '独立有效E等级', '开E转攻击比例使用E天赋，不能借用普攻等级或重复增加命座等级。', true);
    if (context.skillAttackIncludedInPanel === undefined) add('skillAttackIncludedInPanel', '攻击力是否已含开E增攻', '如果输入的是开E后攻击力，请明确已含，避免再次加入。');
    if (context.skillAttackIncludedInPanel === false) {
      if (context.maxHpUnchangedSinceSkillCast === undefined) add('maxHpUnchangedSinceSkillCast', '施放E至本击取样的最大生命是否相同', 'E在施放时固定转换；最大生命变化后不能自动改用当前生命上限。');
      if (context.maxHpUnchangedSinceSkillCast === false && context.skillCastMaxHp === undefined) add('skillCastMaxHp', '施放E当时的最大生命', '填写当时最大生命，不是当前剩余血量，也不是现在改变后的上限。', true);
      if (document.build.mode !== 'equipment-derived' && context.baseAttack === undefined) add('baseAttack', '角色加武器的基础攻击', '400%上限按白字计算，不能从最终攻击力推测。', true);
    }
    if (ascension === undefined) add('ascension', '实际突破阶段', '突破4才解锁半血33%火伤。', true, false, 'gameContext.ascension');
    if (ascension === undefined || ascension >= 4) {
      if (context.hpPercentAtSnapshot === undefined) add('hpPercentAtSnapshot', '本击取样时生命百分比', '重击在动作开始取样，普攻在各命中帧取样；不是开E前的生命比例。', true);
      if (context.a4ThresholdStable !== true) add('a4ThresholdStable', '半血分支已稳定且火伤面板已更新', '固定源对0.3秒检查存在近似，本入口要求实际半血分支已经稳定。', false, context.a4ThresholdStable === false);
    }
    if (context.a4IncludedInDamageBonus === undefined) add('a4IncludedInDamageBonus', '火伤输入是否已含半血33%', '确认火伤面板已含份额，避免重复增加或保留过期增益。');
    if (document.gameContext?.constellation === 6) {
      if (context.c6Active === undefined) add('c6Active', '这一下取样时C6增益是否实际生效', '需要确认已触发且仍在持续；当前低血量或拥有C6不能代替实际状态。');
      if (context.c6CritRateIncludedInPanel === undefined) add('c6CritRateIncludedInPanel', '暴击率是否已含C6增加的100个百分点', '已含时不再加；未含时只加入一次，实际暴击概率由公共公式限幅。');
    }
    return fields;
  },
};
