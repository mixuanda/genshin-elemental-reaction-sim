import type { CalculatorDocument } from '../../../packages/sim-core/src/calculator-model';
import { cynoDamageContextSchema, type CynoDamageContext } from '../../../packages/sim-core/src/cyno-damage-context';
import { canInferCynoA4BaseZero, cynoContext, isCynoDamageDocument, type CynoCalculatorDocument } from '../../../packages/sim-core/src/cyno-damage-formulas';
import type { CalculatorFieldRequirementDraft, CalculatorRequirementAdapter } from './calculator-requirements';

const path = (key: string) => `gameContext.cynoDamage.${key}`;
const state = (key: string, label: string, value: boolean | undefined, falseLabel = '否', trueLabel = '是') =>
  `<label>${label}<select data-source-cast-state-field="${path(key)}"><option value="unknown"${value === undefined ? ' selected' : ''}>请选择</option><option value="0"${value === false ? ' selected' : ''}>${falseLabel}</option><option value="1"${value === true ? ' selected' : ''}>${trueLabel}</option></select></label>`;
const number = (key: string, label: string, value: number | undefined) =>
  `<label>${label}<input type="number" data-field="${path(key)}" data-source-cast-number-field data-optional-number min="0" step="any" value="${value ?? ''}" placeholder="请填写实际值"></label>`;

export function renderCynoControls(document: CalculatorDocument): string {
  if (!isCynoDamageDocument(document)) return '';
  const game = document.gameContext!, context = cynoContext(document) ?? {};
  const normal = game.skillId !== 'cyno-q-charged-c0';
  const ascension = (document.build.mode === 'equipment-derived' ? document.build.equipment?.ascension : document.build.ascension) ?? game.ascension;
  const a4 = normal && (ascension === undefined || ascension >= 4);
  const showA4Accounting = !canInferCynoA4BaseZero(document) || (context.includedA4Base ?? 0) !== 0;
  return `<fieldset data-source-cast-controls="cyno"><legend>赛诺 · 启途誓使的这一击</legend><div class="calculator-fields">
${state('burstActive', '本动作开始时处于启途誓使状态', context.burstActive)}
${a4 ? state('emStableFromActionStart', '本段普攻开始至本击取样时，精通保持相同', context.emStableFromActionStart, '精通有变化', '确认保持相同') : ''}
${a4 && context.emStableFromActionStart === false ? number('actionStartEm', '本段普攻开始时的实际总精通（含当时Q加成）', context.actionStartEm) : ''}</div>
<details${context.burstEmIncludedInPanel === undefined || showA4Accounting && context.includedA4Base === undefined ? ' open' : ''}><summary>输入面板已含增益</summary><div class="calculator-fields">
${state('burstEmIncludedInPanel', '精通面板已经包含Q的100精通', context.burstEmIncludedInPanel)}
${showA4Accounting ? number('includedA4Base', '附加基础伤害已含的赛诺A4数值（未含填0）', context.includedA4Base) : ''}</div></details>
<p class="calculator-hint">${normal ? '这一下使用Q天赋倍率，按普攻伤害处理。A4为本段普攻开始时总精通的150%；第四段两击各自选择，不能据此当作整轮伤害。' : '重击使用Q天赋倍率，面板在重击动作开始时取样，27帧命中；不加A4普攻精通伤害。'} 末途真眼的35%只属于对应E主击。</p></fieldset>`;
}

/** Optional UI handler: use when the existing generic source-state handler is unavailable. */
export function updateCynoDamageControl(document: CalculatorDocument, fieldPath: string, raw: string): boolean {
  if (!isCynoDamageDocument(document) || !fieldPath.startsWith('gameContext.cynoDamage.')) return false;
  const key = fieldPath.slice('gameContext.cynoDamage.'.length);
  if (!['burstActive', 'burstEmIncludedInPanel', 'emStableFromActionStart', 'actionStartEm', 'includedA4Base'].includes(key)) return false;
  const next: Record<string, unknown> = { ...cynoContext(document) };
  if (raw === '' || raw === 'unknown') delete next[key];
  else if (['actionStartEm', 'includedA4Base'].includes(key)) next[key] = Number(raw);
  else if (raw === '0' || raw === '1') next[key] = raw === '1';
  else throw new Error('赛诺条件必须为是、否或未知。');
  (document as CynoCalculatorDocument).gameContext.cynoDamage = cynoDamageContextSchema.parse(next);
  return true;
}

export const cynoRequirementAdapter: CalculatorRequirementAdapter = {
  id: 'cyno-damage-conditions', applies: isCynoDamageDocument,
  collect(document) {
    const game = document.gameContext!, context: CynoDamageContext = cynoContext(document) ?? {};
    const normal = game.skillId !== 'cyno-q-charged-c0';
    const ascension = (document.build.mode === 'equipment-derived' ? document.build.equipment?.ascension : document.build.ascension) ?? game.ascension;
    const fields: CalculatorFieldRequirementDraft[] = [];
    const add = (key: string, label: string, explanation: string, numeric = false, unsatisfied = false) => {
      const fieldPath = path(key);
      fields.push({ id: `cyno:${key}`, fieldPath,
        controlSelector: numeric ? `input[data-field="${fieldPath}"]` : `select[data-source-cast-state-field="${fieldPath}"]`,
        label, explanation, status: unsatisfied ? 'condition-not-satisfied' : 'input-required',
        dependencyIds: document.selectedHitIds.map(id => 'cyno-damage:' + id), hitIds: document.selectedHitIds });
    };
    if (context.burstActive !== true) add('burstActive', '动作开始时的启途誓使状态', '必须实际处于Q状态才可使用本倍率；选择此动作不会替你证明Q已生效。', false, context.burstActive === false);
    if (context.burstEmIncludedInPanel === undefined) add('burstEmIncludedInPanel', '精通是否已含Q的100精通', '导入精通不自动假定已含或未含；确认后只补一次差额。');
    if (context.includedA4Base === undefined && !canInferCynoA4BaseZero(document)) add('includedA4Base', '附加基伤中已含的赛诺A4', '通常填0；若附加基础伤害已经加入A4，请填写该确切份额，防止重复。', true);
    if (normal && (ascension === undefined || ascension >= 4)) {
      if (context.emStableFromActionStart === undefined) add('emStableFromActionStart', '本段普攻开始至本击取样的精通是否相同', 'A4在动作开始取样，本击面板在命中时取样；变化时必须提供动作开始时的实际精通。');
      if (context.emStableFromActionStart === false && context.actionStartEm === undefined) add('actionStartEm', '普攻动作开始时的实际总精通', '此值只用于A4；激化仍使用本击取样的精通。请包含当时Q的100精通。', true);
    }
    return fields;
  },
};
