import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";

type NumberField = (path: string, label: string, value: number, attributes?: string) => string;

/** These controls provide history; the shared character formulas do the arithmetic. */
export function renderIttoControls(document: CalculatorDocument, field: NumberField): string {
  const context = document.gameContext?.ittoCharged;
  if (!context) return "";
  const toggle = (id: string, label: string, value: boolean, off: string, on: string): string =>
    `<label>${label}<select id="${id}" data-itto-context><option value="0"${value ? "" : " selected"}>${off}</option><option value="1"${value ? " selected" : ""}>${on}</option></select></label>`;
  return `<fieldset data-itto-controls><legend>荒泷逆袈裟：本次动作、起手防御与爆发状态</legend>
    <div class="calculator-fields">
    ${field("gameContext.ittoCharged.superstrengthStacks", "本次动作起手乱神之怪力层数", context.superstrengthStacks, 'min="1" max="5" step="1"')}
    ${toggle("calc-itto-preserve-stack", "本次 C6 保层结果", context.c6PreserveStack, "未保层；按正常层数分支", "已保层；明确条件结果（仅 C6）")}
    <label>本次重击起手的总防御快照<input type="number" data-field="gameContext.ittoCharged.actionDefenseSnapshotTotal" data-optional-number min="0" step="any" value="${context.actionDefenseSnapshotTotal ?? ""}" placeholder="明确面板稳定时可留空"></label>
    ${toggle("calc-itto-defense-stable", "起手至命中防御是否等于输入面板", context.actionDefenseStable, "不确定；突破四需提供起手快照", "明确保持相同；可使用当前防御")}
    ${toggle("calc-itto-burst-active", "本次命中 Q 状态", context.burst.active, "未激活；物理重击", "已激活；岩元素重击")}
    ${field("gameContext.ittoCharged.burst.effectiveTalentLevel", "最恶鬼王有效天赋等级（独立于普攻）", context.burst.effectiveTalentLevel, 'min="1" max="15" step="1"')}
    <label>建立 Q 转换时的非 Extra 防御快照<input type="number" data-field="gameContext.ittoCharged.burst.defenseSnapshotNonExtra" data-optional-number min="0" step="any" value="${context.burst.defenseSnapshotNonExtra ?? ""}" placeholder="攻击面板已含转换时可留空"></label>
    <label>攻击面板与 Q 转换的关系<select id="calc-itto-burst-accounting" data-itto-context><option value="already-in-final-panel"${context.burst.accounting === "already-in-final-panel" ? " selected" : ""}>已包含，不再追加</option><option value="add-to-panel"${context.burst.accounting === "add-to-panel" ? " selected" : ""}>未包含，追加历史防御转换</option></select></label>
    ${toggle("calc-itto-c4-active", "本次命中 C4 增益状态", context.c4BuffActive, "未生效", "已生效；最终攻击与防御面板已含")}
    </div>
    <p class="calculator-hint">此处计算选中的一次连斩或终结斩，不推断整段长按重击的次数。分支使用动作起手层数及明确的 C6 保层结果；保层是条件输入，不代表每次都触发，也没有将它当作随机轮转的平均结果。</p>
    <p class="calculator-hint">突破四读取本次重击起手总防御；Q 转攻击另读取建立爆发转换时的非 Extra 防御，两份快照可以不同。总防御快照留空时，仅在明确选择面板稳定后使用当前防御。Q 攻击转换是固定攻击加值，不再乘攻击百分比。</p>
    <p class="calculator-hint">C6 的 70% 暴击伤害只用于本段重击。普通暴伤面板不含该限定加成；若填写“本段最终暴击伤害覆盖”，应填写包含 C6 的最终值，核心不会重复加入。C4 生效时最终面板必须已含其属性；尚无该状态推导的装备模式会明确阻塞。</p>
  </fieldset>`;
}
