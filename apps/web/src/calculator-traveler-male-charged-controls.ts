import { travelerMaleChargedCastContextSchema, type CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { travelerMaleChargedTemplates } from "../../../packages/game-data/src/character-mappings/traveler-male-charged-mappings";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const path = (key: string): string => `gameContext.travelerMaleChargedCast.${key}`;
const state = (key: string, label: string, value: boolean | undefined): string => `<label>${esc(label)}<select data-source-cast-state-field="${esc(path(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const numberField = (key: string, label: string, value: number | undefined, min = 0, max?: number, integer = false): string => `<label>${esc(label)}<input type="number" data-field="${esc(path(key))}" data-source-cast-number-field data-optional-number value="${value ?? ""}" min="${min}"${max === undefined ? "" : ` max="${max}"`} step="${integer ? "1" : "any"}" placeholder="未知"></label>`;
const textField = (key: string, label: string, value: string | undefined): string => `<label>${esc(label)}<input type="text" data-source-cast-text-field="${esc(path(key))}" value="${esc(value)}" placeholder="未知；留空"></label>`;
const drafts = new Map<string, string>();
const keyFor = (doc: CalculatorDocument): string => `${doc.dataIdentity.datasetId}:${doc.gameContext?.characterId}/${doc.gameContext?.skillId}`;
export const MALE_CHARGED_DRAFT_FIELD = "gameContext.travelerMaleChargedCast.snapshotDraft";

export function renderMaleChargedDraft(doc: CalculatorDocument): string {
  const value = drafts.get(keyFor(doc)) ?? (doc.gameContext?.travelerMaleChargedCast?.snapshots ? JSON.stringify(doc.gameContext.travelerMaleChargedCast.snapshots, null, 2) : "");
  return `<div data-male-charged-editor><details><summary>逐次历史最终快照（高级）</summary><label>按 sample:9 / sample:20 填写快照 JSON 对象<textarea data-male-charged-draft-input rows="10" spellcheck="false" placeholder="未知；留空">${esc(value)}</textarea></label><p class="calculator-hint">每份快照包含 stats、characterLevel、ascension、damageBonus、additiveBaseDamage、reactionBonus、source、sourceRefs。没有历史记录时不补造当前面板；允许共用面板需要明确稳定条件。逐击附魔／剧情状态另外填写。</p></details><p data-male-charged-draft-status role="status" class="calculator-hint">${drafts.has(keyFor(doc)) ? "快照草稿尚未应用；请应用后再计算或导出。" : "当前快照记录已应用。"}</p><button type="button" data-action="male-charged-apply">应用快照记录</button><button type="button" data-action="male-charged-reset">放弃未应用的编辑</button></div>`;
}

export function renderMaleTravelerChargedControls(doc: CalculatorDocument): string {
  const context = doc.gameContext?.travelerMaleChargedCast, cast = travelerMaleChargedTemplates.find(row => row.skillId === doc.gameContext?.skillId);
  if (!context || !cast) return "";
  type HitState = NonNullable<typeof context.sharedState>;
  const hitFields = (key: string, values: HitState = {}): string => state(`${key}.externalInfusionActive`, "本次命中实际存在外部附魔（此基础物理分支要求否）", values.externalInfusionActive) + state(`${key}.trueMoonStoryBuffEnabled`, "本次实际开启 TrueMoon 剧情增益（本分支要求否）", values.trueMoonStoryBuffEnabled) + (cast.element === "cryo" ? state(`${key}.cryoSkillActive`, "本次实际处于冰 E 状态（基础分支要求否）", values.cryoSkillActive) + `<label>本次冰元素辉映状态<select data-source-cast-enum-field="${path(`${key}.cryoRadiance`)}"><option value="unknown"${values.cryoRadiance === undefined ? " selected" : ""}>未知</option>${[["none", "无辉映"], ["stellar-conduct", "星超导辉映"], ["stellar-swirl", "星扩散辉映"]].map(([value, label]) => `<option value="${value}"${value === values.cryoRadiance ? " selected" : ""}>${label}</option>`).join("")}</select></label>` + numberField(`${key}.cryoTrueMoonStacks`, "本次冰特殊重击层数（基础分支要求 0）", values.cryoTrueMoonStacks, 0, 3, true) : "");
  return `<fieldset data-source-cast-controls="male-charged"><legend>${esc(cast.label)}：真实起手与逐击条件</legend><p class="calculator-hint">本动作从合法普攻后的重击就绪状态开始，只合计男性重击的两段；前置普攻是另一动作。未知资格不会按默认就绪处理，单击只依赖本击状态。</p><div class="calculator-fields">${state("statsStableAcrossHits", "两击之间的面板、装备、反应与目标条件稳定", context.statsStableAcrossHits)}</div><details${doc.scope === "one-cast" ? " open" : ""}><summary>完整重击起手与接触记录</summary><div class="calculator-fields">${textField("casterId", "施放者标识", context.casterId) + textField("targetId", "所选目标标识", context.targetId) + state("precedingNormalAttackConfirmed", "起手前的合法普攻确实发生", context.precedingNormalAttackConfirmed) + numberField("normalCounterBeforeCast", "重击起手前真实普攻计数器", context.normalCounterBeforeCast, 0, 4, true) + state("actionReadyConfirmed", "在真实动作窗口内已就绪可重击", context.actionReadyConfirmed) + numberField("initialStamina", "重击起手实际体力（至少 20）", context.initialStamina) + numberField("staminaCostMultiplier", "真实体力消耗倍率（此分支为 1）", context.staminaCostMultiplier) + state("freshCastConfirmed", "全新本次重击，没有动作残留", context.freshCastConfirmed) + state("noHitlag", "没有卡肉延长", context.noHitlag) + state("noInterruption", "两段所需动作没有被中断", context.noInterruption) + state("noReplacement", "没有额外状态替换或重置", context.noReplacement) + state("fullObservedLifetime", "已观察两次机会的实际命中／落空", context.fullObservedLifetime) + numberField("observedThroughFrame", "已观察至重击起点后的帧", context.observedThroughFrame, 0, undefined, true) + state("targetContacts.hit-1", "第 9 帧第一段实际命中所选目标", context.targetContacts?.["hit-1"]) + state("targetContacts.hit-2", "第 20 帧第二段实际命中所选目标", context.targetContacts?.["hit-2"])}</div>${renderMaleChargedDraft(doc)}</details><details open><summary>共同实际资格</summary><div class="calculator-fields">${hitFields("sharedState", context.sharedState)}</div></details><details><summary>逐击实际资格覆盖</summary>${doc.hits.filter(hit => hit.kind === "ordinary").map(hit => `<fieldset data-male-charged-hit-context="${esc(hit.id)}"><legend>${esc(hit.label)} · ${doc.selectedHitIds.includes(hit.id) ? "已选" : "未选"}${hit.finalSnapshot ? " · 历史快照" : ""}</legend><div class="calculator-fields">${hitFields(`hitStates.${hit.id}`, context.hitStates?.[hit.id])}</div></fieldset>`).join("")}<p class="calculator-hint">每击独立填写时覆盖共同声明。即使只选一段，也不能省略该段是否附魔、是否存在相关剧情或冰特殊状态。</p></details></fieldset>`;
}

export function captureMaleChargedDraft(doc: CalculatorDocument, root: HTMLElement): void {
  const input = root.querySelector<HTMLTextAreaElement>("[data-male-charged-draft-input]"); if (input) drafts.set(keyFor(doc), input.value);
}
export function applyMaleChargedDraft(doc: CalculatorDocument, root: HTMLElement): void {
  captureMaleChargedDraft(doc, root);
  if (!doc.gameContext?.travelerMaleChargedCast) return;
  const next = structuredClone(doc.gameContext.travelerMaleChargedCast), value = drafts.get(keyFor(doc)) ?? "";
  if (!value.trim()) delete next.snapshots;
  else { try { next.snapshots = JSON.parse(value); } catch { throw new Error("男性重击历史快照不是有效 JSON；请修正后应用。"); } }
  const parsed = travelerMaleChargedCastContextSchema.safeParse(next);
  if (!parsed.success) throw new Error(`快照字段不合法：${parsed.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
  doc.gameContext.travelerMaleChargedCast = parsed.data; drafts.delete(keyFor(doc));
}
export function resetMaleChargedDraft(doc: CalculatorDocument): void { drafts.delete(keyFor(doc)); }
export function hasMaleChargedDraft(doc: CalculatorDocument): boolean { return drafts.has(keyFor(doc)); }
