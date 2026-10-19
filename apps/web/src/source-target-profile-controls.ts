import {
  sourceTargetResistanceElements, sourceParticleElements, sourceTargetResistanceValues, validateSourceTargetProfile,
  type SourceTargetProfile, type SourceTargetElement, type SourceParticleElement,
} from "./source-target-profile";
import {
  readSourceTargetPhaseControls, renderSourceTargetPhaseControls,
  type SourceTargetPhaseDraft,
} from "./source-target-phase-controls";

export type { SourceTargetPhaseDraft } from "./source-target-phase-controls";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const elementLabels: Record<SourceTargetElement, string> = {
  electro: "雷", pyro: "火", cryo: "冰", hydro: "水", anemo: "风", dendro: "草", geo: "岩", physical: "物理",
};
const particleLabels: Record<SourceParticleElement, string> = {
  electro: "雷", pyro: "火", cryo: "冰", hydro: "水", anemo: "风", dendro: "草", geo: "岩", none: "无元素",
};
const numberText = (value: number): string => String(value);

const optionalNumberInput = (field: string, label: string, value: number | undefined, attrs = ""): string =>
  `<label>${esc(label)}<input type="number" step="any" data-target-profile="${esc(field)}" ${attrs} value="${value === undefined ? "" : esc(value)}" placeholder="未提供"></label>`;

/** Advanced optional target fields; shared level, base resistance and geometry remain in their parent editor. */
export function renderSourceTargetProfileControls(target: SourceTargetProfile): string {
  validateSourceTargetProfile(target);
  const elementInputs = sourceTargetResistanceElements.map(element => {
    const value = target.resistanceByElement?.[element];
    return `<label>${elementLabels[element]}抗性绝对值<input type="number" step="any" data-target-resistance="${element}" value="${value === undefined ? "" : esc(value)}" placeholder="留空沿用共用抗性 ${esc(target.resistance)}"></label>`;
  }).join("");
  const particle = target.particleDrops;
  return `<details data-source-target-profile-controls><summary>进阶目标参数</summary>
    <fieldset><legend>逐元素抗性</legend><p>留空时使用上方共用抗性；填写的是该元素最终绝对抗性，不是加值。元素命中本组值不改变其他元素。</p><div class="workspace-fields">${elementInputs}</div></fieldset>
    <fieldset><legend>目标防御情景（可选）</legend>
      ${optionalNumberInput("defenseAdjustment", "DEF 调整比例（−1 至 0.9；留空沿用来源默认 0）", target.defenseAdjustment, 'min="-1" max="0.9"')}
      <p>原生公式按 1 + 调整比例处理：−0.3 表示 DEF 降低 30%，+0.2 表示 DEF 提高 20%。这是整个观察过程持续生效的用户声明条件，会与角色实际动态 DEF 调整相加；它不证明某个敌人的机制，也不设置攻击专属忽防。</p>
    </fieldset>
    ${optionalNumberInput("freezeResistance", "冻结抗性（可选，0–1）", target.freezeResistance, 'min="0" max="1"')}
    <fieldset><legend>目标生命与原生执行模式</legend>
      ${optionalNumberInput("hp", "目标初始 HP（正数；留空为固定时长模式）", target.hp, 'min="0"')}
      <p><strong>填写正数目标 HP 会启用来源击杀模式。</strong>结构化编辑器同时请求按配置观察时长硬停；目标提前死亡或脚本结束时会更早停止。原始 GCSL 沿用来源原生终止行为。</p>
    </fieldset>
    <fieldset><legend>自定义目标掉球</legend>
      ${optionalNumberInput("particleThreshold", "累计扣血阈值（正数）", particle?.threshold, 'min="0"')}
      ${optionalNumberInput("particleCount", "掉落数量", particle?.count, 'min="0"')}
      <label>掉球元素<select data-target-profile="particleElement"><option value="">未提供</option>${sourceParticleElements.map(element => `<option value="${element}"${particle?.element === element ? " selected" : ""}>${particleLabels[element]}</option>`).join("")}</select></label>
      <p>三项全部留空表示未提供自定义掉球。自定义掉球必须同时填写目标 HP、正数阈值、非负数量及元素；元素“无元素”是明确选择。来源按累计扣血检查阈值，后续命中触发检查后 100 帧分发微粒，不是即时回能；末击可能无法触发检查或等到分发，因此不保证末击掉球。</p>
    </fieldset>
  </details>${renderSourceTargetPhaseControls(target.phases)}`;
}

/** Merges advanced inputs onto the current target, deleting optional fields when cleared. */
export function readSourceTargetProfileControls(root: HTMLElement, currentTarget: SourceTargetProfile): SourceTargetProfile {
  const next = structuredClone(currentTarget);
  const optionalNumber = (field: string, label: string): number | undefined => {
    const input = root.querySelector<HTMLInputElement>(`[data-target-profile="${field}"]`);
    if (!input) throw new Error(`缺少目标参数输入：${label}。`);
    if (input.value.trim() === "") return undefined;
    if (!input.checkValidity() || !Number.isFinite(input.valueAsNumber)) throw new Error(`${label}须为有限数值。`);
    return input.valueAsNumber;
  };
  const freezeResistance = optionalNumber("freezeResistance", "冻结抗性");
  if (freezeResistance === undefined) delete next.freezeResistance; else next.freezeResistance = freezeResistance;
  const defenseAdjustment = optionalNumber("defenseAdjustment", "目标防御调整比例");
  if (defenseAdjustment === undefined) delete next.defenseAdjustment; else next.defenseAdjustment = defenseAdjustment;
  const hp = optionalNumber("hp", "目标初始 HP");
  if (hp === undefined) delete next.hp; else next.hp = hp;
  const phases: SourceTargetPhaseDraft[] = readSourceTargetPhaseControls(root);
  if (phases.length) next.phases = phases; else delete next.phases;

  const resistanceByElement: Partial<Record<SourceTargetElement, number>> = {};
  for (const element of sourceTargetResistanceElements) {
    const input = root.querySelector<HTMLInputElement>(`[data-target-resistance="${element}"]`);
    if (!input) throw new Error(`缺少${elementLabels[element]}抗性输入。`);
    if (input.value.trim() === "") continue;
    if (!input.checkValidity() || !Number.isFinite(input.valueAsNumber)) throw new Error(`${elementLabels[element]}抗性须为有限绝对值。`);
    resistanceByElement[element] = input.valueAsNumber;
  }
  if (Object.keys(resistanceByElement).length) next.resistanceByElement = resistanceByElement;
  else delete next.resistanceByElement;

  const threshold = optionalNumber("particleThreshold", "累计扣血阈值");
  const count = optionalNumber("particleCount", "掉落数量");
  const elementInput = root.querySelector<HTMLSelectElement>('[data-target-profile="particleElement"]');
  if (!elementInput) throw new Error("缺少目标掉球元素选择。");
  const element = elementInput.value as SourceParticleElement | "";
  if (threshold === undefined && count === undefined && element === "") delete next.particleDrops;
  else {
    if (threshold === undefined || count === undefined || element === "") throw new Error("自定义目标掉球须完整填写阈值、数量和元素；全部留空表示未提供。");
    next.particleDrops = { threshold, count, element };
  }
  validateSourceTargetProfile(next);
  return next;
}

/** Human-readable snapshot of configured target profile; geometry is summarized elsewhere. */
export function formatSourceTargetProfile(target: SourceTargetProfile): string {
  validateSourceTargetProfile(target);
  const resistances = sourceTargetResistanceValues(target);
  const rows = sourceTargetResistanceElements.map(element => `${elementLabels[element]} ${numberText(resistances[element])}`).join("；");
  const freeze = target.freezeResistance === undefined ? "未提供（来源默认）" : numberText(target.freezeResistance);
  const defense = target.defenseAdjustment === undefined
    ? "未提供（来源默认 0）"
    : `${numberText(target.defenseAdjustment)}（按 1 + 调整比例；${target.defenseAdjustment < 0 ? `DEF 降低 ${numberText(-target.defenseAdjustment * 100)}%` : `DEF 提高 ${numberText(target.defenseAdjustment * 100)}%`}）`;
  const hp = target.hp === undefined ? "未提供（固定时长模式）" : `${numberText(target.hp)}（来源击杀模式）`;
  const drops = target.particleDrops === undefined ? "未提供" : `${numberText(target.particleDrops.threshold)} 阈值 / ${numberText(target.particleDrops.count)} 个 / ${particleLabels[target.particleDrops.element]}`;
  const phases = target.phases?.length ? `${target.phases.length} 段用户声明情景` : "未设置用户声明阶段";
  return `目标等级 ${target.level}；共用抗性 ${numberText(target.resistance)}；元素绝对抗性：${rows}；目标 DEF 调整 ${defense}；冻结抗性 ${freeze}；初始 HP ${hp}；自定义掉球 ${drops}；目标阶段 ${phases}。`;
}
