import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { isKazuhaBurstAction, kazuhaBurstContext, type KazuhaCalculatorDocument } from "../../../packages/sim-core/src/kazuha-burst-formulas";
import { KAZUHA_BURST_ABSORPTION_CHECK_FRAMES } from "../../../packages/sim-core/src/kazuha-burst-source-values";
import type { CalculatorRequirementAdapter, CalculatorFieldRequirementDraft } from "./calculator-requirements";

const names = {none: "无元素转化", pyro: "火", hydro: "水", electro: "雷", cryo: "冰"};
const path = (key: string) => `gameContext.kazuhaBurst.${key}`;
const state = (key: string, label: string, value: boolean | undefined) => `<label>${label}<select data-kazuha-control data-source-cast-state-field="${path(key)}"><option value="unknown"${value === undefined ? " selected" : ""}>请选择实际状态</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const number = (key: string, label: string, value: number | undefined, min?: number) => `<label>${label}<input type="number" data-kazuha-control data-field="${path(key)}" data-source-cast-number-field data-optional-number step="any"${min === undefined ? "" : ` min="${min}"`} value="${value ?? ""}" placeholder="未知；请填写实际值"></label>`;

export function renderKazuhaControls(document: CalculatorDocument): string {
  if (!isKazuhaBurstAction(document)) return "";
  const context = kazuhaBurstContext(document) ?? {}, full = document.gameContext!.skillId === "kazuha-burst-complete";
  const element = context.absorptionElement;
  const absorbed = full && element !== undefined && element !== "none";
  const ascension = (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext!.ascension;
  const selected = document.hits.filter(hit => document.selectedHitIds.includes(hit.id));
  const historical = selected.some(hit => hit.kind === "ordinary" && hit.finalSnapshot);
  const elements = `<label>本次Q转化了哪种元素<select data-kazuha-control data-source-cast-enum-field="${path("absorptionElement")}"><option value="unknown"${element === undefined ? " selected" : ""}>请选择实际元素</option>${(["none", "pyro", "hydro", "electro", "cryo"] as const).map(value => `<option value="${value}"${element === value ? " selected" : ""}>${names[value]}</option>`).join("")}</select></label>`;
  const timing = `<label>首次成功吸收检查<select data-kazuha-control data-source-cast-value-field="${path("absorptionStartFrame")}"><option value="unknown"${context.absorptionStartFrame === undefined ? " selected" : ""}>请选择实际时点</option>${KAZUHA_BURST_ABSORPTION_CHECK_FRAMES.map(frame => `<option value="${frame}"${context.absorptionStartFrame === frame ? " selected" : ""}>${frame === 81 ? "施放时已有元素（81f）" : `${frame}f（${(frame / 60).toFixed(2)}秒）`}</option>`).join("")}</select></label>`;
  return `<fieldset data-source-cast-controls="kazuha"><legend>万叶Q · 本次战斗条件</legend><div class="calculator-fields">${full ? elements + (absorbed ? timing : "") : ""}${full && document.scope === "one-cast" ? state("allHitsConnected", "本次Q全部命中，领域未被替换", context.allHitsConnected) + state("statsStableAcrossSnapshots", "期间面板、装备和敌人状态不变", context.statsStableAcrossSnapshots) : ""}
    ${absorbed && document.build.mode !== "equipment-derived" && !historical ? number(`elementDamageBonuses.${element}`, `${names[element]}元素最终增伤（独立于风伤；1=100%）`, context.elementDamageBonuses?.[element]) : ""}
    ${absorbed && (ascension === undefined || ascension >= 4) ? state("priorA4Active", `81f前已有${names[element]}扩散触发的A4，且81f仍生效`, context.priorA4Active) + (context.priorA4Active ? number("priorSwirlNonExtraEm", "该次前序扩散的非额外精通（不取本Q当前精通）", context.priorSwirlNonExtraEm, 0) : "") + number("includedA4DamageBonus", "该元素增伤已含的A4份额（未含填0；1=100%）", context.includedA4DamageBonus, 0) : ""}</div>
    <p class="calculator-hint">${full ? "完整Q仅统计直接伤害，不含扩散实体。晚转化会减少染色附加次数；其元素增伤使用上方独立输入。" : document.gameContext!.skillId === "kazuha-burst-slash" ? "本入口只算82f初斩。" : "本入口只算单次风DoT，使用81f进攻快照。"}风DoT和染色附加在81f锁定，82f初斩后的新A4不会追溯生效。${absorbed ? "非额外精通指该次扩散精通中排除其他属性转化所得的额外精通。" : ""}${historical ? "已有转换快照；修改分支或前序状态后须重新应用来源配装。" : ""}</p></fieldset>`;
}

/** Run first inside applySourceCastControl; true means fully handled.
 * Controls also carry the standard data-source-cast-* attributes so existing
 * input/change routing and refresh apply without a new UI event branch. */
export function applyKazuhaControl(document: CalculatorDocument, input: HTMLInputElement | HTMLSelectElement): boolean {
  if (!isKazuhaBurstAction(document) || !input.hasAttribute("data-kazuha-control")) return false;
  const field = input.dataset.sourceCastStateField ?? input.dataset.sourceCastEnumField ?? input.dataset.sourceCastValueField ?? input.dataset.field;
  if (!field?.startsWith(path(""))) return false;
  const context = (document as KazuhaCalculatorDocument).gameContext.kazuhaBurst ??= {};
  const keys = field.slice(path("").length).split(".");
  const oldElement = context.absorptionElement;
  let target = context as unknown as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) target = (target[key] ??= {}) as Record<string, unknown>;
  const key = keys.at(-1)!;
  if (input.value.trim() === "" || input.value === "unknown") delete target[key];
  else if (input.dataset.sourceCastStateField) target[key] = input.value === "1";
  else if (input.dataset.sourceCastEnumField) target[key] = input.value;
  else {
    const value = Number(input.value);
    if (!Number.isFinite(value)) throw new Error("万叶Q条件需要有限数值。");
    target[key] = value;
  }
  if (key === "absorptionElement" && context.absorptionElement !== oldElement) {
    delete context.absorptionStartFrame;
    delete context.priorA4Active;
    delete context.priorSwirlNonExtraEm;
    if (document.build.mode === "equipment-derived") context.includedA4DamageBonus = 0;
    else delete context.includedA4DamageBonus;
  }
  return true;
}

export const kazuhaBurstRequirementAdapter: CalculatorRequirementAdapter = {
  id: "kazuha-burst-conditions", applies: isKazuhaBurstAction,
  collect(document) {
    const context = kazuhaBurstContext(document) ?? {}, game = document.gameContext!;
    const hits = document.hits.filter(hit => hit.kind === "ordinary" && document.selectedHitIds.includes(hit.id));
    const full = game.skillId === "kazuha-burst-complete", selectedAll = document.hits.every(hit => document.selectedHitIds.includes(hit.id));
    const complete = full && document.scope === "one-cast" && selectedAll;
    const element = context.absorptionElement, absorbed = full && element !== undefined && element !== "none";
    const ascension = (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? game.ascension;
    const fields: CalculatorFieldRequirementDraft[] = [];
    const add = (key: string, label: string, explanation: string, attribute = "data-field", condition = false) => fields.push({
      id: `kazuha:${key}`, fieldPath: path(key), controlSelector: `${attribute === "data-field" ? "input" : "select"}[${attribute}="${path(key)}"]`,
      label, explanation, status: condition ? "condition-not-satisfied" : "input-required", dependencyIds: hits.map(hit => `kazuha-burst:${hit.id}`), hitIds: hits.map(hit => hit.id),
    });
    if (complete && element === undefined) add("absorptionElement", "实际元素转化", "明确无转化或实际转化元素。", "data-source-cast-enum-field");
    if (complete && absorbed && context.absorptionStartFrame === undefined) add("absorptionStartFrame", "首次成功吸收时点", "吸收检查81f起每18f一次；晚转化不生成更早的附加伤害。", "data-source-cast-value-field");
    if (complete && context.allHitsConnected !== true) add("allHitsConnected", "完整Q全部命中", "确认本分支全部生成命中实际接触目标，领域未被替换。", "data-source-cast-state-field", context.allHitsConnected === false);
    const snapshots = hits.map(hit => context.hitEvents?.[hit.id]?.snapshotFrame);
    if (snapshots.includes(81) && snapshots.includes(82) && context.statsStableAcrossSnapshots !== true) add("statsStableAcrossSnapshots", "跨快照面板与目标稳定", "81f与82f共用面板须确认稳定；不稳定请单选实际命中。", "data-source-cast-state-field", context.statsStableAcrossSnapshots === false);
    const absorbedHits = hits.filter(hit => context.hitEvents?.[hit.id]?.role === "absorbed-dot");
    if (absorbed && absorbedHits.length) {
      if (document.build.mode !== "equipment-derived" && absorbedHits.some(hit => hit.kind === "ordinary" && !hit.finalSnapshot) && context.elementDamageBonuses?.[element] === undefined) add(`elementDamageBonuses.${element}`, `${names[element]}元素最终增伤`, "导入缺项保持未知；不能复制风伤或默认0。");
      if (ascension === undefined || ascension >= 4) {
        if (context.priorA4Active === undefined) add("priorA4Active", "81f前同元素扩散A4", "只使用81f前实际前序扩散且在81f仍生效的增益；本Q初斩后触发无效。", "data-source-cast-state-field");
        if (context.priorA4Active && context.priorSwirlNonExtraEm === undefined) add("priorSwirlNonExtraEm", "实际前序扩散的非额外精通", "填写该次扩散时NonExtraEM，不借用现在的最终精通。");
        if (context.includedA4DamageBonus === undefined) add("includedA4DamageBonus", "已含A4份额", "明确该元素增伤已包含的自身A4份额，未含填0。");
      }
    }
    return fields;
  },
};
