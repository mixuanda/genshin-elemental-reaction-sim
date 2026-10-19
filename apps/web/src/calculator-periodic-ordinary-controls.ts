import { compilePeriodicOrdinarySchedule, PERIODIC_ORDINARY_CAST_KINDS, periodicOrdinaryCastContextSchema, type CalculatorDocument, type PeriodicOrdinaryCastKind } from "@genshin-dps-lab/sim-core";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const path = (key: string): string => `gameContext.periodicOrdinaryCast.${key}`;
const state = (key: string, label: string, value: boolean | undefined): string => `<label>${esc(label)}<select data-source-cast-state-field="${esc(path(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
const numberField = (key: string, label: string, value: number | undefined, integer = false): string => `<label>${esc(label)}<input type="number" data-field="${esc(path(key))}" data-source-cast-number-field data-optional-number value="${value ?? ""}" min="0" step="${integer ? "1" : "any"}"${integer ? ' max="100000"' : ""} placeholder="未知"></label>`;
const textField = (key: string, label: string, value: string | undefined): string => `<label>${esc(label)}<input type="text" data-source-cast-text-field="${esc(path(key))}" value="${esc(value)}" placeholder="未知；留空"></label>`;
const elementNames: Record<string, string> = { pyro: "火", hydro: "水", cryo: "冰", electro: "雷", anemo: "风", geo: "岩", dendro: "草" };
type Draft = { partyCount: string; party: string[]; bullets: string[]; snapshots: string; dirty: boolean };
const drafts = new Map<string, Draft>();
const keyFor = (doc: CalculatorDocument): string => `${doc.dataIdentity.datasetId}:${doc.gameContext?.characterId}/${doc.gameContext?.skillId}`;
export const PERIODIC_ORDINARY_DRAFT_FIELD = "gameContext.periodicOrdinaryCast.observationDraft";
function getDraft(doc: CalculatorDocument): Draft {
  const saved = drafts.get(keyFor(doc)); if (saved?.dirty) return saved;
  const context = doc.gameContext?.periodicOrdinaryCast;
  const draft: Draft = { partyCount: context?.chasca?.partyElements ? String(context.chasca.partyElements.length) : "", party: [...context?.chasca?.partyElements ?? []], bullets: [...context?.chasca?.bulletElements ?? []], snapshots: context?.snapshots ? JSON.stringify(context.snapshots, null, 2) : "", dirty: false };
  drafts.set(keyFor(doc), draft); return draft;
}
function elementSelect(kind: "party" | "bullet", index: number, value: string | undefined): string {
  return `<label>${kind === "party" ? `其余队员 ${index + 1} 的真实元素` : `实际第 ${index + 1} 枚子弹元素`}<select data-periodic-draft-input data-periodic-${kind}="${index}"><option value="">未知；未填写</option>${Object.entries(elementNames).filter(([element]) => kind === "party" || !["geo", "dendro"].includes(element)).map(([element, label]) => `<option value="${element}"${element === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>`;
}
export function renderPeriodicOrdinaryDraft(doc: CalculatorDocument): string {
  const draft = getDraft(doc), chasca = doc.gameContext?.skillId.includes("chasca");
  return `<div data-periodic-ordinary-editor>${chasca ? `<details open><summary>真实队伍元素与六弹顺序</summary><label>其余实际队员人数<select data-periodic-draft-input data-periodic-party-count><option value=""${draft.partyCount === "" ? " selected" : ""}>未知</option>${[0, 1, 2, 3].map(count => `<option value="${count}"${draft.partyCount === String(count) ? " selected" : ""}>${count} 人${count === 0 ? "（明确没有其他队员）" : ""}</option>`).join("")}</select></label><div class="calculator-fields">${[0, 1, 2].map(index => elementSelect("party", index, draft.party[index])).join("")}${[0, 1, 2, 3, 4, 5].map(index => elementSelect("bullet", index, draft.bullets[index])).join("")}</div><p class="calculator-hint">只采用所填队员人数对应的前几个元素；重复元素的队员分别填写。六弹填写真实顺序，由核心核对转换规则，不选期望元素。全部留空表示未知。</p></details>` : ""}<details><summary>逐击历史最终快照（高级）</summary><label>按候选表取样标识填写快照 JSON 对象<textarea data-periodic-draft-input data-periodic-snapshots rows="10" spellcheck="false">${esc(draft.snapshots)}</textarea></label><p class="calculator-hint">每份快照含 stats、characterLevel、ascension、damageBonus、additiveBaseDamage、reactionBonus、source、sourceRefs。已含被动与命中前减抗另按逐击记录。</p></details><p data-periodic-draft-status role="status" class="calculator-hint">${draft.dirty ? "观测草稿尚未应用；请应用后再计算或导出。" : "当前记录已应用。"}</p><button type="button" data-action="periodic-ordinary-apply">应用记录并刷新候选</button><button type="button" data-action="periodic-ordinary-reset">放弃未应用的编辑</button></div>`;
}
export function renderPeriodicOrdinaryControls(doc: CalculatorDocument): string {
  const context = doc.gameContext?.periodicOrdinaryCast, skill = doc.gameContext?.skillId ?? "";
  if (!context || !(PERIODIC_ORDINARY_CAST_KINDS as readonly string[]).includes(skill)) return "";
  const schedule = compilePeriodicOrdinarySchedule(skill as PeriodicOrdinaryCastKind, context), lauma = skill.includes("lauma"), chasca = skill.includes("chasca");
  const singlePassive = doc.scope === "single-hit" && (skill.includes("ineffa") || skill.includes("columbina"));
  const specific = singlePassive ? "" : skill.includes("ineffa") ? state("ineffa.noLunarChargedField", "全部放电取样时均无月感电雷云", context.ineffa?.noLunarChargedField) + state("ineffa.burstInactive", "没有此前或期间 Q 启动的 A4 精通转换", context.ineffa?.burstInactive)
    : skill.includes("columbina") ? state("columbina.noLunarEvents", "期间没有月反应或月伤事件", context.columbina?.noLunarEvents) + state("columbina.noPriorGravityOrA1", "没有此前引力任务或 A1 暴击层数残留", context.columbina?.noPriorGravityOrA1)
      : chasca ? state("chasca.onlyOneEnemy", "只有一个合资格敌人", context.chasca?.onlyOneEnemy) + state("chasca.nightsoulInactive", "没有处于 E 夜魂飞行状态", context.chasca?.nightsoulInactive) + state("chasca.noNightsoulBurst", "期间没有夜魂迸发", context.chasca?.noNightsoulBurst) : state("lauma.noPriorShred", "所选目标没有前次菈乌玛减抗", context.lauma?.noPriorShred);
  type HitState = NonNullable<typeof context.sharedState>;
  const hitFields = (key: string, values: HitState = {}, finalResistance = false): string => singlePassive ? skill.includes("ineffa") ? state(`${key}.ineffaA4Inactive`, "本击实际没有 Q 的 A4 精通转换", values.ineffaA4Inactive) : state(`${key}.columbinaA1Inactive`, "本击实际没有 A1 暴击增益", values.columbinaA1Inactive) : numberField(`${key}.includedDamageBonus`, "增伤输入已含的菈乌玛对应被动份额", values.includedDamageBonus) + (finalResistance ? "" : numberField(`${key}.includedResistanceReduction`, "目标抗性输入已含的本人减抗份额", values.includedResistanceReduction) + state(`${key}.laumaOwnShredActive`, "独立单击：伤害结算前本人减抗已实际生效", values.laumaOwnShredActive));
  return `<fieldset data-source-cast-controls="periodic-ordinary"><legend>来源普通完整施放：真实条件与接触</legend><div class="calculator-fields">${state("statsStableAcrossHits", "除逐击明确差异外，面板、装备与目标条件稳定", context.statsStableAcrossHits) + specific}${lauma ? numberField("lauma.initializationEm", "来源初始化时真正记录的精通（非当前面板精通）", context.lauma?.initializationEm) : ""}</div><details${doc.scope === "one-cast" ? " open" : ""}><summary>完整施放日程与逐次接触</summary><div class="calculator-fields">${textField("casterId", "施放者标识", context.casterId) + textField("targetId", "所选目标标识", context.targetId) + state("freshCastConfirmed", "全新施放，没有旧实体或触发遗留", context.freshCastConfirmed) + state("noHitlag", "全程没有卡肉延长", context.noHitlag) + state("noInterruption", "没有中断", context.noInterruption) + state("noReplacement", "没有重施、替换、死亡或重置", context.noReplacement) + state("fullObservedLifetime", "记录覆盖完整实体与所有末尾命中", context.fullObservedLifetime) + numberField("observedThroughFrame", "已观察至本次起点后的帧", context.observedThroughFrame, true)}</div>${renderPeriodicOrdinaryDraft(doc)}<p class="calculator-hint">核心当前要求至少观察至第 ${schedule.requiredObservedThroughFrame} 帧；逐条确认实际接触，未知不当作命中。</p><div class="table-wrap"><table><thead><tr><th>候选标识</th><th>命中帧</th><th>取样标识／帧</th><th>实际接触</th></tr></thead><tbody>${schedule.candidates.map(candidate => `<tr><td>${esc(candidate.id)}</td><td>${candidate.frame}</td><td>${esc(candidate.snapshotId)} · ${candidate.snapshotFrame}</td><td>${state(`targetContacts.${candidate.id}`, "实际命中所选目标", candidate.contact)}</td></tr>`).join("")}</tbody></table></div></details>${lauma || singlePassive ? `<details open><summary>共同实际被动状态</summary><div class="calculator-fields">${hitFields("sharedState", context.sharedState)}</div><p class="calculator-hint">${lauma ? "完整施放的本人减抗由之前实际命中与有效期决定，首次命中之后的减抗不会追溯初击。独立单击才直接采用已生效声明。最终抗性覆盖存在时不再次补减抗。" : "只声明本击实际被动状态；不要求未来的月反应或其他未选攻击历史。逐击明确值覆盖共同声明。"}</p></details><details><summary>逐击已含份额覆盖</summary>${doc.hits.filter(hit => hit.kind === "ordinary").map(hit => `<fieldset><legend>${esc(hit.label)} · ${doc.selectedHitIds.includes(hit.id) ? "已选" : "未选"}</legend><div class="calculator-fields">${hitFields(`hitStates.${hit.id}`, context.hitStates?.[hit.id], hit.effectiveResistance !== undefined)}</div></fieldset>`).join("")}</details>` : ""}<p class="calculator-hint">每个已发生命中均可独立选择；未选后续的生命周期条件不应阻塞单击。这里的来源分支仍是明确条件计算，不认证整队月反应或夜魂事件。</p></fieldset>`;
}
export function capturePeriodicOrdinaryDraft(doc: CalculatorDocument, root: HTMLElement): void {
  const draft = getDraft(doc), count = root.querySelector<HTMLSelectElement>("[data-periodic-party-count]");
  if (count) { draft.partyCount = count.value; draft.party = [...root.querySelectorAll<HTMLSelectElement>("[data-periodic-party]")].map(input => input.value); draft.bullets = [...root.querySelectorAll<HTMLSelectElement>("[data-periodic-bullet]")].map(input => input.value); }
  const snapshots = root.querySelector<HTMLTextAreaElement>("[data-periodic-snapshots]"); if (snapshots) draft.snapshots = snapshots.value;
  draft.dirty = true;
}
export function applyPeriodicOrdinaryDraft(doc: CalculatorDocument, root: HTMLElement): void {
  capturePeriodicOrdinaryDraft(doc, root); if (!doc.gameContext?.periodicOrdinaryCast) return;
  const draft = getDraft(doc), next = structuredClone(doc.gameContext.periodicOrdinaryCast) as Record<string, unknown>;
  if (doc.gameContext.skillId.includes("chasca")) {
    const chasca = { ...(next.chasca as Record<string, unknown> | undefined) };
    if (draft.partyCount === "") delete chasca.partyElements;
    else { const party = draft.party.slice(0, Number(draft.partyCount)); if (party.some(value => !value)) throw new Error("请明确所填人数对应的每位队员元素；未知请把人数留空。"); chasca.partyElements = party; }
    if (draft.bullets.every(value => !value)) delete chasca.bulletElements;
    else { if (draft.bullets.length !== 6 || draft.bullets.some(value => !value)) throw new Error("请逐枚填写实际六弹元素与顺序；未知不能补为风弹。"); chasca.bulletElements = draft.bullets; }
    next.chasca = chasca;
  }
  if (!draft.snapshots.trim()) delete next.snapshots;
  else { try { next.snapshots = JSON.parse(draft.snapshots); } catch { throw new Error("历史快照不是有效 JSON，请修正后应用。"); } }
  const parsed = periodicOrdinaryCastContextSchema.safeParse(next);
  if (!parsed.success) throw new Error(`来源记录不合法：${parsed.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
  doc.gameContext.periodicOrdinaryCast = parsed.data; drafts.delete(keyFor(doc));
}
export function resetPeriodicOrdinaryDraft(doc: CalculatorDocument): void { drafts.delete(keyFor(doc)); }
export function hasPeriodicOrdinaryDraft(doc: CalculatorDocument): boolean { return drafts.get(keyFor(doc))?.dirty === true; }
