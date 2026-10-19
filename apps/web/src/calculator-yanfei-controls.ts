import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";

type NumberField = (path: string, label: string, value: number, attributes?: string) => string;

export function renderYanfeiControls(document: CalculatorDocument, field: NumberField): string {
  const context = document.gameContext?.yanfeiCharged;
  if (!context) return "";
  const toggle = (id: string, label: string, value: boolean, off: string, on: string): string =>
    `<label>${label}<select id="${id}" data-yanfei-context><option value="0"${value ? "" : " selected"}>${off}</option><option value="1"${value ? " selected" : ""}>${on}</option></select></label>`;
  return `<fieldset data-yanfei-controls><legend>火漆制印：丹火印、灼灼与条件追击</legend><div class="calculator-fields">
    ${field("gameContext.yanfeiCharged.scarletSeals", "本次重击消耗的丹火印", context.scarletSeals, 'min="0" max="4" step="1"')}
    ${toggle("calc-yanfei-on-field", "主击回调时烟绯是否仍在场", context.onFieldAtMainHit, "不在场；不触发 A4", "仍在场；暴击时可触发 A4")}
    ${toggle("calc-yanfei-stats-stable", "主击至 A4 的面板与装备状态", context.statsStableToA4, "未声明稳定；A4 缺少另一份快照", "明确稳定；两段分别读取相同面板")}
    ${field("gameContext.yanfeiCharged.brilliance.effectiveTalentLevel", "灼灼有效 Q 等级（独立于普攻）", context.brilliance.effectiveTalentLevel, 'min="1" max="15" step="1"')}
    ${toggle("calc-yanfei-brilliance-main", "主击时灼灼状态", context.brilliance.mainActive, "无效", "有效")}
    ${toggle("calc-yanfei-brilliance-a4", "A4 时灼灼状态", context.brilliance.a4Active, "无效", "有效")}
    ${field("gameContext.yanfeiCharged.mainEnemyHpFraction", "主击前目标生命比例", context.mainEnemyHpFraction, 'min="0" max="1"')}
    ${field("gameContext.yanfeiCharged.a4EnemyHpFraction", "A4 前目标生命比例", context.a4EnemyHpFraction, 'min="0" max="1"')}
    ${field("gameContext.yanfeiCharged.priorA1BonusIncluded", "每段手动增伤已含的旧 A1（小数）", context.priorA1BonusIncluded, 'min="0" max="0.2"')}
    ${field("gameContext.yanfeiCharged.includedBrillianceBonus", "每段手动增伤已含的灼灼（小数）", context.includedBrillianceBonus, 'min="0" max="1"')}
    </div><p class="calculator-hint">本页计算单目标的一次重击。整次施放的 A4 期望贡献由主击暴击概率加权；单击模式选 A4 则计算已经触发的实际追击。A4 在主击后 10 帧独立快照和暴击，反应条件可逐段选择，不自动假定两段都蒸发。</p>
    <p class="calculator-hint">A1 替换旧增伤，灼灼按两段各自状态加入；只有手动增伤确实已含旧效果时才填写扣除量。新来源配装不包含这些条件效果。C2 在目标生命严格低于 50% 时加入暴击率；已填写的逐段最终暴击率覆盖仍优先，清空覆盖才按新条件重算。</p>
    <p class="calculator-hint">C6 才能使用四印；突破阶段未知时不猜测 A1/A4。这里明确输入印数、在场和快照条件，不模拟产印、体力、离场或 Q 结束的状态时间线，固定来源中的快照时机待核实项仍保留。</p></fieldset>`;
}
