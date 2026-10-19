import { observedSpecialComponentContextSchema, type CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { optimizerSpecialComponents, type OptimizerSpecialComponent } from "../../../packages/game-data/src/character-mappings/optimizer-special-components";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const path = (key: string): string => `gameContext.observedSpecialComponent.${key}`;
type Context = NonNullable<NonNullable<CalculatorDocument["gameContext"]>["observedSpecialComponent"]>;
type HitState = NonNullable<Context["sharedState"]>;
const componentOf = (document: CalculatorDocument): OptimizerSpecialComponent | undefined => optimizerSpecialComponents.find(component => component.id === document.gameContext?.skillId);
const state = (key: string, label: string, value: boolean | undefined): string => `<label>${esc(label)}<select data-source-cast-state-field="${esc(path(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const numberField = (key: string, label: string, value: number | undefined, bounds: { integer?: boolean; min?: number; max?: number } = { min: 0 }): string => `<label>${esc(label)}<input type="number" data-field="${esc(path(key))}" data-source-cast-number-field data-optional-number value="${value ?? ""}" placeholder="未知；留空" step="${bounds.integer ? "1" : "any"}"${bounds.min === undefined ? "" : ` min="${bounds.min}"`}${bounds.max === undefined ? "" : ` max="${bounds.max}"`}></label>`;
const textField = (key: string, label: string, value: string | undefined): string => `<label>${esc(label)}<input type="text" data-source-cast-text-field="${esc(path(key))}" value="${esc(value)}" placeholder="未知；留空"></label>`;
const enumField = (key: string, label: string, value: string | undefined, options: ReadonlyArray<readonly [string, string]>): string => `<label>${esc(label)}<select data-source-cast-enum-field="${esc(path(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option>${options.map(([id, name]) => `<option value="${esc(id)}"${value === id ? " selected" : ""}>${esc(name)}</option>`).join("")}</select></label>`;

function hitFields(key: string, values: HitState, component: OptimizerSpecialComponent): string {
  const number = (field: keyof HitState, label: string, bounds?: { integer?: boolean; min?: number; max?: number }): string => numberField(`${key}.${field}`, label, typeof values[field] === "number" ? values[field] as number : undefined, bounds);
  const intrinsicName = component.intrinsicStat === "def" ? "防御力" : "攻击力";
  const common = state(`${key}.intrinsicStatMatchesSnapshot`, `固有基础提升所用实际${intrinsicName}与本击进攻面板一致`, values.intrinsicStatMatchesSnapshot) +
    number("actualIntrinsicStat", `若不一致：固有基础提升所用实际${intrinsicName}`) +
    number("specialBaseBonus", "特殊基础提升输入总额（小数；含下项已计入份额）") +
    number("includedIntrinsicBaseBonus", "输入已含的本人固有基础提升（0–0.14）", { min: 0, max: 0.14 }) +
    number("reactionBonus", "本击适用的特殊反应增伤（小数）") +
    number("specialAdditive", "本击实际特殊加算伤害") +
    number("elevationMultiplier", "本击专属擢升总倍率（大于 0；明确没有才填 1）") +
    number("includedCharacterEm", "输入面板已含的本角色 A4 精通") +
    number("a4PreConversionStat", `本击 A4 取样的转换前${intrinsicName}（突破 4 后适用）`);
  const specific = component.passiveProfile === "linnea" ?
    enumField(`${key}.lumiForm`, "本次露米实际形态", values.lumiForm, [["super-power", "超强形态"], ["ultimate-power", "究极形态"]]) +
    (component.id.includes("heavy-overdrive") ? state(`${key}.nearbyMoondrift`, "这记重锤发生时附近实际存在月笼", values.nearbyMoondrift) : "") +
    state(`${key}.linneaA4AppliesToSelf`, "本击莉奈娅本人实际接受 A4 精通", values.linneaA4AppliesToSelf) +
    state(`${key}.lumiPresent`, "本击露米实际在场", values.lumiPresent) +
    state(`${key}.targetWithinLumiA1Range`, "本击目标实际处于露米 A1 范围内", values.targetWithinLumiA1Range) +
    number("moonsignLevel", "本击实际月兆等级（0–4）", { min: 0, max: 4, integer: true }) +
    number("includedResistanceReduction", "目标抗性输入已含的莉奈娅 A1 减抗（小数）") :
    enumField(`${key}.actualRadiance`, "本击实际辉映", values.actualRadiance, [["stellar-conduct", "星导"], ["stellar-swirl", "星旋"]]) +
    (component.attackTag === "charged" ? state(`${key}.decodingMode`, "本次凝聚光束实际处于解析模式", values.decodingMode) : "") +
    (component.baseTalentMultiplierKind === "sandrone-skill-decoding" ? number("decodingPowerAtSkill", "本次战技实际解析热量（0–100）", { min: 0, max: 100 }) : "") +
    (component.baseTalentMultiplierKind === "sandrone-burst-tactics" ? number("refinedTacticsConsumed", "本次爆发实际消费的精密战术层数（0–10）", { min: 0, max: 10, integer: true }) : "");
  const polestar = component.specialBranch === "stellar-conduct-direct" ? number("polestarApplicationCount", "本击实际极星领域应用计数（0–12）", { min: 0, max: 12, integer: true }) : "";
  return `<div class="calculator-fields">${common}${specific}${polestar}</div>`;
}

/** Actual components share the normal build editor; these fields never calculate damage. */
export function renderObservedSpecialControls(document: CalculatorDocument): string {
  const component = componentOf(document); if (!component) return "";
  const context = document.gameContext!.observedSpecialComponent ?? {};
  return `<fieldset data-source-cast-controls="observed-special"><legend>${esc(component.label)} · 已发生单次特殊组成</legend><p class="calculator-hint">这里只计算明确观察到的一次特殊组成，不把一段、一次重锤或一束射线当作完整技能。使用上方实际等级、天赋、武器、圣遗物和最终面板；无需整队或未来轮转。普通增伤不会移入特殊反应乘区，被替代的普通组成不得重复计入。</p><div class="calculator-fields">${textField("casterId", "本击施放者标识", context.casterId)}${textField("targetId", "本击所选敌人标识", context.targetId)}${state("actualComponentOccurred", "这次指定特殊组成已经实际发生", context.actualComponentOccurred)}</div><details open><summary>本击实际状态与面板已含份额</summary>${hitFields("sharedState", context.sharedState ?? {}, component)}<p class="calculator-hint">明确没有贡献才填 0；留空仍为未知。固有基础提升与 A4 转换使用各自真实取样，已计入份额用于避免重复相加。历史最终快照须已包含当时 A4 精通；当前共用构筑由核心执行转换和装备派生。</p>${component.passiveProfile === "linnea" ? '<p class="calculator-hint">核心依实际突破阶段判断 A1 与 A4。月兆、在场和范围不是同一条件；本人是否接受 A4 需独立明确。重锤与百万吨重压只接受各自真实形态，不重建喂食或召唤次数。</p>' : '<p class="calculator-hint">核心依实际突破阶段判断被动。战技 A1 只在本次热量超过 50 时改变天赋项；爆发读取实际消费的精密战术层数。两者均不把特殊加算一并乘入，也不代替专属擢升。</p>'}</details><details><summary>本击已保存状态覆盖</summary><p class="calculator-hint">逐击值覆盖同名共同值；留空才使用共同值。修改共同值不会覆盖已保存的本击取样。</p>${document.hits.filter(hit => hit.kind === "special").map(hit => `<fieldset data-observed-special-hit-context="${esc(hit.id)}"><legend>${esc(hit.label)}</legend>${hitFields(`hitStates.${hit.id}`, context.hitStates?.[hit.id] ?? {}, component)}</fieldset>`).join("")}</details>${renderObservedSpecialDraft(document)}<details><summary>固定来源与当前范围</summary><p>${esc(component.coefficientEvidence)}</p><ul>${component.exclusions.map(text => `<li>${esc(text)}</li>`).join("")}</ul></details></fieldset>`;
}

type Row = Record<string, string>;
type Draft = { independentKnown: boolean; independent: Row; snapshots: Row[]; dirty: boolean };
const drafts = new Map<string, Draft>();
export const OBSERVED_SPECIAL_DRAFT_FIELD = "gameContext.observedSpecialComponent.observationDraft";
const keyFor = (document: CalculatorDocument): string => `${document.dataIdentity.datasetId}:${document.gameContext?.characterId}/${document.gameContext?.variantId ?? ""}/${document.gameContext?.skillId ?? document.id}`;
const snapshotFields: ReadonlyArray<readonly [key: string, label: string, min?: number, max?: number]> = [
  ["stats.atk", "最终攻击力", 0], ["stats.hp", "生命上限", 0], ["stats.def", "最终防御力", 0], ["stats.em", "最终元素精通（含当时 A4）", 0],
  ["stats.critRate", "最终暴击率（小数）"], ["stats.critDamage", "最终暴击伤害（小数）", 0], ["stats.energyRecharge", "充能效率（1 = 100%，可留空）", 0],
  ["characterLevel", "角色等级", 1, 100], ["ascension", "突破阶段", 0, 6], ["damageBonus", "快照保存的普通增伤（不移入特殊公式）"], ["additiveBaseDamage", "快照保存的普通加算基伤"], ["reactionBonus", "快照保存的普通反应增伤"],
];
const toRow = (value: Record<string, unknown>): Row => Object.fromEntries(Object.entries(value).map(([key, field]) => [key, String(field)]));
function getDraft(document: CalculatorDocument): Draft {
  const saved = drafts.get(keyFor(document)); if (saved?.dirty) return saved;
  const context = document.gameContext?.observedSpecialComponent;
  const draft: Draft = {
    independentKnown: context?.independentEvent !== undefined, independent: toRow(context?.independentEvent ?? {}),
    snapshots: Object.entries(context?.snapshots ?? {}).map(([id, snapshot]) => ({ id, ...Object.fromEntries(snapshotFields.map(([key]) => {
      const value = key.startsWith("stats.") ? snapshot.stats[key.slice(6) as keyof typeof snapshot.stats] : snapshot[key as "characterLevel" | "ascension" | "damageBonus" | "additiveBaseDamage" | "reactionBonus"];
      return [key, value === undefined ? "" : String(value)];
    })), source: snapshot.source, sourceRefs: snapshot.sourceRefs.join("\n"), ...(snapshot.origin ? { origin: snapshot.origin } : {}) })), dirty: false,
  };
  drafts.set(keyFor(document), draft); return draft;
}
const input = (key: string, label: string, value: string | undefined, numeric = false, bounds = ""): string => `<label>${esc(label)}<input data-observed-special-draft-input data-observed-special-draft-key="${esc(key)}" type="${numeric ? "number" : "text"}" value="${esc(value)}" placeholder="未知；留空"${numeric ? ` step="any" ${bounds}` : ""}></label>`;
export function renderObservedSpecialDraft(document: CalculatorDocument): string {
  if (!componentOf(document)) return "";
  const draft = getDraft(document), row = draft.independent;
  return `<div data-observed-special-editor><details open><summary>本击实际时刻与取样身份</summary><label>实际命中事件<select data-observed-special-draft-input data-observed-special-independent-known><option value="unknown"${draft.independentKnown ? "" : " selected"}>未提供新事件；沿用已保存本击</option><option value="provided"${draft.independentKnown ? " selected" : ""}>提供或编辑这记实际命中</option></select></label><div data-observed-special-independent-row class="calculator-fields">${input("candidateId", "实际事件标识", row.candidateId)}${input("frame", "实际交付帧（相对同一次观察起点）", row.frame, true, 'min="0"')}${input("snapshotFrame", "实际进攻面板取样帧", row.snapshotFrame, true, 'min="0"')}${input("snapshotId", "实际取样标识", row.snapshotId)}${input("targetId", "实际命中敌人标识", row.targetId)}</div><p class="calculator-hint">帧数及取样身份来自本次实际命中记录，不由技能次数或名称推定。没有历史快照时使用明确还原的当前共用面板；不要求未来生命周期、其他命中或整支队伍。</p></details><details><summary>实际历史最终快照 · ${draft.snapshots.length} 份</summary><p class="calculator-hint">填写与本击取样标识对应的真实历史面板和来源。历史精通须已包含当时 A4 与装备派生；勿用当前配装冒充历史。专属基础提升、反应增伤、特殊加算及擢升读取上方实际状态，普通快照乘区不代替它们。</p>${draft.snapshots.map((snapshot, index) => `<fieldset data-observed-special-snapshot-row="${index}"><legend>历史快照 ${index + 1}</legend><div class="calculator-fields">${input("id", "取样标识（与实际事件一致）", snapshot.id)}${snapshotFields.map(([key, label, min, max]) => input(key, label, snapshot[key], true, `${min === undefined ? "" : `min="${min}"`}${max === undefined ? "" : ` max="${max}"`}`)).join("")}${input("source", "历史数值来源或记录说明", snapshot.source)}</div><label>来源引用（每行一条）<textarea data-observed-special-draft-input data-observed-special-draft-key="sourceRefs" rows="2">${esc(snapshot.sourceRefs)}</textarea></label><button type="button" data-action="observed-special-remove-snapshot" data-observed-special-row-index="${index}">删除此快照</button></fieldset>`).join("")}<button type="button" data-action="observed-special-add-snapshot">添加实际历史快照</button></details><p data-observed-special-draft-status role="status" class="calculator-hint">${draft.dirty ? "本击事件或快照草稿尚未应用；请应用后再计算或导出。" : "实际事件与快照没有未应用编辑。"}</p><button type="button" data-action="observed-special-apply">应用本击事件与快照</button><button type="button" data-action="observed-special-reset">放弃未应用编辑</button></div>`;
}
export function captureObservedSpecialDraft(document: CalculatorDocument, root: HTMLElement): void {
  const draft = getDraft(document);
  const rows = (kind: string): Row[] => [...root.querySelectorAll<HTMLElement>(`[data-observed-special-${kind}-row]`)].map(row => Object.fromEntries([...row.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[data-observed-special-draft-key]")].map(control => [control.dataset.observedSpecialDraftKey!, control.value])));
  const known = root.querySelector<HTMLSelectElement>("[data-observed-special-independent-known]");
  if (known) { draft.independentKnown = known.value === "provided"; draft.independent = rows("independent")[0] ?? {}; }
  draft.snapshots = rows("snapshot").map((row, index) => { const previous = draft.snapshots[index]; if (previous?.origin && Object.entries(row).every(([key, value]) => previous[key] === value)) row.origin = previous.origin; return row; });
  draft.dirty = true;
}
export function editObservedSpecialDraft(document: CalculatorDocument, root: HTMLElement, button: HTMLButtonElement): void {
  captureObservedSpecialDraft(document, root);
  const draft = getDraft(document);
  if (button.dataset.action === "observed-special-add-snapshot") draft.snapshots.push({});
  else if (button.dataset.action === "observed-special-remove-snapshot") draft.snapshots.splice(Number(button.dataset.observedSpecialRowIndex), 1);
}
export function applyObservedSpecialDraft(document: CalculatorDocument, root: HTMLElement): void {
  captureObservedSpecialDraft(document, root); if (!document.gameContext) return;
  const draft = getDraft(document), next: Record<string, unknown> = structuredClone(document.gameContext.observedSpecialComponent ?? {});
  const numeric = (value: string | undefined, label: string, integer = false): number => { const parsed = Number(value); if (!value?.trim() || !Number.isFinite(parsed) || integer && (!Number.isSafeInteger(parsed) || parsed < 0)) throw new Error(`${label}须明确填写${integer ? "非负整数" : "有限数值"}，未知不能当作零。`); return parsed; };
  if (draft.independentKnown) {
    const row = draft.independent;
    next.independentEvent = { candidateId: row.candidateId?.trim(), frame: numeric(row.frame, "本击实际交付帧", true), snapshotFrame: numeric(row.snapshotFrame, "本击实际取样帧", true), snapshotId: row.snapshotId?.trim(), targetId: row.targetId?.trim() };
  } else delete next.independentEvent;
  if (!draft.snapshots.length) delete next.snapshots;
  else {
    const snapshots: Record<string, unknown> = {};
    for (const [index, row] of draft.snapshots.entries()) {
      const id = row.id?.trim(); if (!id || Object.prototype.hasOwnProperty.call(snapshots, id)) throw new Error(`历史快照 ${index + 1} 须提供不重复的取样标识。`);
      const stats: Record<string, number> = {}, snapshot: Record<string, unknown> = { stats, source: row.source?.trim(), sourceRefs: (row.sourceRefs ?? "").split("\n").map(value => value.trim()).filter(Boolean), ...(row.origin ? { origin: row.origin } : {}) };
      for (const [key, label] of snapshotFields) {
        if (key === "stats.energyRecharge" && !row[key]?.trim()) continue;
        const value = numeric(row[key], `历史快照 ${index + 1} 的${label}`, key === "characterLevel" || key === "ascension");
        if (key.startsWith("stats.")) stats[key.slice(6)] = value; else snapshot[key] = value;
      }
      Object.defineProperty(snapshots, id, { value: snapshot, enumerable: true, configurable: true, writable: true });
    }
    next.snapshots = snapshots;
  }
  const parsed = observedSpecialComponentContextSchema.safeParse(next);
  if (!parsed.success) throw new Error(`实际特殊组成或历史快照不完整：${parsed.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
  document.gameContext.observedSpecialComponent = parsed.data; drafts.delete(keyFor(document));
}
export function resetObservedSpecialDraft(document: CalculatorDocument): void { drafts.delete(keyFor(document)); }
export function hasObservedSpecialDraft(document: CalculatorDocument): boolean { return drafts.get(keyFor(document))?.dirty === true; }
