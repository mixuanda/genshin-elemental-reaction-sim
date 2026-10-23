import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { renderCoordinatedSchedule } from "./calculator-coordinated-schedule-controls";
import { renderHeldLifecycleCastControls } from "./calculator-held-lifecycle-controls";
import { renderFiniteFollowupCastControls } from "./calculator-finite-followup-controls";
import {renderGamingControls} from './calculator-gaming-controls';
import { renderXiaoControls } from "./calculator-xiao-controls";
import { renderObservedEntityControls } from "./calculator-observed-entity-controls";
import { renderMaleTravelerChargedControls } from "./calculator-traveler-male-charged-controls";
import { renderPeriodicOrdinaryControls } from "./calculator-periodic-ordinary-controls";
import { renderIdleStanceControls } from "./calculator-idle-stance-controls";
import { renderEntityFollowupControls } from "./calculator-entity-followup-controls";
import { renderExtendedStanceControls } from "./calculator-extended-stance-controls";
import { renderMixedSourceControls } from "./calculator-mixed-source-controls";
import { renderNoellePlungeControls } from "./calculator-noelle-plunge-controls";
import { renderKachinaCastControls } from "./calculator-kachina-controls";
import { renderObservedPlungeControls } from "./calculator-observed-plunge-controls";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const groupPath = (group: string, key: string): string => `gameContext.${group}.${key}`;

function state(group: string, key: string, label: string, value: boolean | undefined): string {
  const path = groupPath(group, key);
  return `<label>${esc(label)}<select data-source-cast-state-field="${esc(path)}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
}

function numberField(group: string, key: string, label: string, value: number | undefined, options: { min?: number; max?: number; integer?: boolean; readonly?: boolean } = {}): string {
  return `<label>${esc(label)}<input type="number" data-field="${esc(groupPath(group, key))}" data-source-cast-number-field data-optional-number value="${value ?? ""}" placeholder="未知" step="${options.integer ? "1" : "any"}"${options.min === undefined ? "" : ` min="${options.min}"`}${options.max === undefined ? "" : ` max="${options.max}"`}${options.readonly ? ' readonly aria-readonly="true"' : ""}></label>`;
}

function choice(group: string, key: string, label: string, value: string | number | undefined, options: ReadonlyArray<readonly [string | number, string]>, numeric = false): string {
  return `<label>${esc(label)}<select data-source-cast-${numeric ? "value" : "enum"}-field="${esc(groupPath(group, key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；需明确</option>${options.map(([key, text]) => `<option value="${esc(key)}"${value === key ? " selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
}

function textField(group: string, key: string, label: string, value: string | undefined): string {
  return `<label>${esc(label)}<input type="text" data-source-cast-text-field="${esc(groupPath(group, key))}" value="${esc(value)}" placeholder="未知；留空"></label>`;
}

function travelerControls(document: CalculatorDocument): string {
  const context = document.gameContext?.travelerCryo;
  if (!context) return "";
  const group = "travelerCryo", skill = document.gameContext!.skillId.includes("-skill-");
  return `<fieldset data-source-cast-controls="traveler-cryo"><legend>冰旅行者：普通完整施放与实际取样</legend><div class="calculator-fields">${
    choice(group, "radiance", "相关取样时点的辉映状态", context.radiance, [["none", "无辉映"], ["stellar-conduct", "星超导辉映"], ["stellar-swirl", "星扩散辉映"]]) +
    state(group, "trueMoonStoryBuff", "TrueMoon 剧情增益实际开启", context.trueMoonStoryBuff) +
    state(group, "statsStableAcrossHits", "所选多击的进攻面板、装备、反应属性与目标条件稳定", context.statsStableAcrossHits) +
    (skill ? state(group, "skillUninterrupted", "寒星未被替换或中断，未额外延长，所列九击均实际命中", context.skillUninterrupted)
      : numberField(group, "frostglowStacksAtBurst", "Q 构造攻击时实际消耗的寒辉层数（0–8）", context.frostglowStacksAtBurst, { min: 0, max: 8, integer: true })) +
    numberField(group, "nonExtraAtk", "实际取样的非 Extra 总攻击力", context.nonExtraAtk, { min: 0 }) +
    numberField(group, "a4IncludedEm", "输入精通已含的 A4 份额（0–160）", context.a4IncludedEm, { min: 0, max: 160 })
  }</div><p class="calculator-hint">当前普通分支要求明确无辉映、TrueMoon 关闭；其他选择会由核心保留阻塞原因。E 各击独立取样，Q 投矛共享构造时快照；0–7 层寒辉对应三击，8 层对应五击，请选择匹配的完整动作。单击仍可独立选择。</p><p class="calculator-hint">非 Extra 总攻击包含实际普通攻击修正，排除 Extra 转换，不能用最终 ATK 自动代替。A4 只补输入精通的差额；历史最终快照必须已含其实际完整份额。未知数值留空，明确为零才填 0。</p></fieldset>`;
}

function projectileControls(document: CalculatorDocument): string {
  const context = document.gameContext?.batchProjectileCast;
  if (!context) return "";
  const group = "batchProjectileCast", skillId = document.gameContext!.skillId;
  const neuvillette = skillId.startsWith("neuvillette-"), chevreuse = skillId.startsWith("chevreuse-");
  const hitFields = (path: string, values: NonNullable<typeof context.sharedState> = {}, historical = false): string => neuvillette
    ? numberField(group, `${path}.actualHpRatio`, "本击实际取样生命比例（0–1）", values.actualHpRatio, { min: 0, max: 1 }) +
      numberField(group, `${path}.includedHydroBonus`, "本击输入增伤已含的 A4 水伤份额（小数）", values.includedHydroBonus, { min: 0, max: 0.3 })
    : state(group, `${path}.chevreuseA4Active`, "本击取样时 A4 攻击增益实际有效", values.chevreuseA4Active) +
      numberField(group, `${path}.a4SourceHp`, "赋予 A4 的超量弹发射时最大生命值", values.a4SourceHp, { min: 0 }) +
      numberField(group, `${path}.includedA4AtkPercent`, "本击最终 ATK 已含的 A4 攻击百分比（小数）", values.includedA4AtkPercent, { min: 0, max: 0.4 }) +
      state(group, `${path}.a1Active`, "目标在本击之前已存在 A1 超载减抗", values.a1Active) +
      state(group, `${path}.a1PartyEligible`, "该 A1 队伍只有火／雷且两种元素各至少一人", values.a1PartyEligible) +
      choice(group, `${path}.includedA1Shred`, "目标抗性输入已含的旧 A1 减抗", values.includedA1Shred, [[0, "明确未含（0）"], [0.4, "已含 40% 减抗（0.4）"]], true) +
      (historical ? numberField(group, `${path}.baseAttack`, "本击历史面板的基础攻击（角色白值＋武器白值）", values.baseAttack, { min: 0 }) : "");
  const ownContext = neuvillette || chevreuse ? `${chevreuse ? `<div class="calculator-fields">${numberField(group, "baseAttack", "共同面板基础攻击（角色白值＋武器白值）", context.baseAttack, { min: 0, readonly: document.build.mode === "equipment-derived" })}</div>` : ""}<details open><summary>共同实际状态（仅明确稳定、无历史快照的命中使用）</summary><div class="calculator-fields">${hitFields("sharedState", context.sharedState)}</div></details><details><summary>逐击实际状态与覆盖</summary><p class="calculator-hint">每击明确填写的字段覆盖共同状态；空白沿用允许使用的共同状态。未确认稳定时不采用共同状态。历史最终快照只读取自己的逐击状态，基础攻击也不能借用当前配装。</p>${document.hits.filter(hit => hit.kind === "ordinary").map(hit => `<fieldset><legend>${esc(hit.label)} · ${document.selectedHitIds.includes(hit.id) ? "已选" : "未选"}${hit.finalSnapshot ? " · 历史快照" : ""}</legend><div class="calculator-fields">${hitFields(`hitStates.${hit.id}`, context.hitStates?.[hit.id], !!hit.finalSnapshot)}</div></fieldset>`).join("")}</details>` : "";
  return `<fieldset data-source-cast-controls="projectile"><legend>组合施放：共同条件与逐击被动记账</legend><div class="calculator-fields">${state(group, "statsStableAcrossHits", "除所填逐击被动差额外，面板、装备与目标条件稳定", context.statsStableAcrossHits)}</div>${ownContext}<p class="calculator-hint">完整动作依赖明确稳定条件；独立选择已发生的一击，不要求未选后续命中的状态。这里只填写实际上下文，由共享公式计算差额，不运行触发时间线。</p>${neuvillette ? '<p class="calculator-hint">那维莱特 A4 使用每击实际取样生命比例，并减去输入已含水伤；未知不默认满血。芒性独立命中也需自己的实际上下文。</p>' : chevreuse ? '<p class="calculator-hint">夏沃蕾 A4 的生命值来自赋予增益的实际超量弹发射时点，不能用当前生命补造历史。A1 只作用于命中前已成立的减抗，本击首次触发的超载不能倒填本击。明确最终抗性仍使用逐击抗性输入。</p>' : ""}</fieldset>`;
}

function periodicControls(document: CalculatorDocument): string {
  const context = document.gameContext?.batchPeriodicCast;
  if (!context) return "";
  const group = "batchPeriodicCast", skillId = document.gameContext!.skillId;
  let controls = state(group, "completeCastConfirmed", "所列次数全部命中同一存活目标，未替换、中断或额外延长", context.completeCastConfirmed) +
    state(group, "statsStableAcrossHits", "除已列 A1／A4 差异外，实际面板、装备、反应属性与目标条件稳定", context.statsStableAcrossHits);
  if (skillId.startsWith("qiqi-")) controls += state(group, "qiqiRevelationInactive", "本次 E 的启示未激活", context.qiqiRevelationInactive);
  if (skillId.startsWith("kaeya-")) controls += state(group, "kaeyaFrontContactModelConfirmed", "采用固定来源的十三次正面接触模型", context.kaeyaFrontContactModelConfirmed);
  if (skillId.startsWith("kokomi-")) controls += state(group, "kokomiNoBurstOrRefresh", "全程没有 Q 增幅、Q 刷新或新 E 替换", context.kokomiNoBurstOrRefresh) +
    state(group, "kokomiPassiveIncludedInPanel", "输入最终暴击率已含固有天赋减少的 100 个百分点", context.kokomiPassiveIncludedInPanel);
  if (skillId.startsWith("venti-")) controls += state(group, "ventiNoAbsorption", "本次 Q 全程没有元素吸收", context.ventiNoAbsorption) +
    state(group, "ventiHexereiInactive", "魔导相关被动未激活", context.ventiHexereiInactive);
  if (skillId.startsWith("shenhe-")) controls += state(group, "shenheFreshBurstNoSkillEffects", "全新 Q，无旧 Q、E 冰翎或 A4；本人留圈至初击、目标全程留圈", context.shenheFreshBurstNoSkillEffects) +
    state(group, "shenheA1IncludedInPanel", "共同增伤输入已含 A1 的 15% 冰伤", context.shenheA1IncludedInPanel) +
    state(group, "shenheQReductionIncludedInResistance", "敌人抗性输入已含本级 Q 的减抗", context.shenheQReductionIncludedInResistance);
  if (skillId.startsWith("escoffier-")) controls += numberField(group, "escoffierCryoHydroMembers", "实际冰／水角色人数（含爱可菲本人）", context.escoffierCryoHydroMembers, { min: 1, max: 4, integer: true }) +
    state(group, "escoffierA4InitiallyActive", "初击结算前目标已存在 A4 减抗", context.escoffierA4InitiallyActive) +
    state(group, "escoffierInitialHitConnected", "本次初击实际命中目标并启动后续 A4", context.escoffierInitialHitConnected) +
    state(group, "escoffierA4IncludedInResistance", "共同敌人抗性输入已含上述人数对应的 A4 减抗", context.escoffierA4IncludedInResistance) +
    state(group, "escoffierArkheAvailable", "本次芒性伤害冷却可用且确实发生", context.escoffierArkheAvailable);
  return `<fieldset data-source-cast-controls="periodic"><legend>持续施放：命中集合与来源条件</legend><div class="calculator-fields">${controls}</div><p class="calculator-hint">完整施放确认仅适用于所列已定义集合；选择单击可保留其他条件未知。所选反应仍需明确实际反应属性。输入是可编辑的条件声明，不能代替自动轮转、碰撞、附着或持续状态记录。</p>${skillId.startsWith("kaeya-") ? '<p class="calculator-hint">十三次正面接触不是十四／十五击最大命中模型。</p>' : ""}${skillId.startsWith("shenhe-") || skillId.startsWith("escoffier-") ? '<p class="calculator-hint">初击与后续命中的被动状态由共享来源公式分别处理；本次初击之后施加的增益或减抗不会追溯到初击。若逐击填写了已经结算的最终抗性，核心使用该实际值，不再重复减抗。</p>' : ""}</fieldset>`;
}

function finiteControls(document: CalculatorDocument): string {
  const context = document.gameContext?.batchFiniteCast;
  if (!context) return "";
  const group = "batchFiniteCast", skillId = document.gameContext!.skillId;
  const accounting = ["arlecchino-", "diluc-", "kirara-"].some(prefix => skillId.startsWith(prefix));
  return `<fieldset data-source-cast-controls="finite"><legend>完整施放：实际命中与增伤记账</legend><div class="calculator-fields">${state(group, "completeCastConfirmed", "所列命中全部实际发生，满足当前完整动作分支", context.completeCastConfirmed)}${state(group, "statsStableAcrossHits", "除已列逐击差异外，所选命中的面板、装备与目标条件稳定", context.statsStableAcrossHits)}</div>${accounting ? `<div class="calculator-fields">${document.hits.filter(hit => hit.kind === "ordinary").map(hit => numberField(group, `hitStates.${hit.id}.includedDamageBonus`, `${hit.label} · ${document.selectedHitIds.includes(hit.id) ? "已选" : "未选"}：输入已含的本分支被动增伤（小数）`, context.hitStates?.[hit.id]?.includedDamageBonus, { min: 0 })).join("")}</div><p class="calculator-hint">按每击实际面板填写已含份额，明确未含才填 0；未知留空。核心按来源条件补增伤差额，避免旧面板与本次被动重复相加。</p>` : ""}<p class="calculator-hint">完整合计需要明确的命中与稳定条件；单击保留独立入口，不要求未选命中的未来状态。未接入的命座、追加伤害或分支仍由核心显示阻塞。</p></fieldset>`;
}

function coordinatedControls(document: CalculatorDocument): string {
  const context = document.gameContext?.coordinatedCast;
  if (!context) return "";
  const group = "coordinatedCast", skill = document.gameContext!.skillId;
  const dehyaReposition = skill.includes("dehya") && skill.includes("reposition"), fischl = skill.includes("fischl");
  const yelan = skill.includes("yelan"), raiden = skill.includes("raiden"), albedo = skill.includes("albedo");
  const accounting = skill.includes("xingqiu") || yelan || raiden || albedo;
  const hitFields = (path: string, values: NonNullable<typeof context.sharedState> = {}): string =>
    numberField(group, `${path}.includedDamageBonus`, "输入面板已含的本角色被动增伤（小数）", values.includedDamageBonus, { min: 0 }) +
    (albedo ? numberField(group, `${path}.targetHpFraction`, "本击实际目标生命比例（0–1）", values.targetHpFraction, { min: 0, max: 1 }) : "") +
    (yelan ? state(group, `${path}.ownerOnField`, "本击伤害取样时夜兰本人实际在场", values.ownerOnField) + numberField(group, `${path}.yelanBurstElapsedFrames`, "独立单击距 Q 状态启动的实际帧数（有日程时由事件确定）", values.yelanBurstElapsedFrames, { min: 0, max: 100000, integer: true }) + numberField(group, `${path}.yelanInitialCastHp`, "Q 初击基伤实际采用的施放起点（第 0 帧）生命值上限", values.yelanInitialCastHp, { min: 0 }) : "") +
    (raiden ? numberField(group, `${path}.raidenNonExtraEnergyRecharge`, "本击 A4 最近一次更新采用的非额外充能效率（每 30 帧更新；1 = 100%）", values.raidenNonExtraEnergyRecharge, { min: 0 }) : "");
  const events = document.hits.flatMap(hit => hit.kind === "ordinary" && hit.coordinatedEvent ? [{ hit, event: hit.coordinatedEvent }] : []);
  return `<fieldset data-source-cast-controls="coordinated"><legend>协同施放：显式日程与逐击条件</legend><div class="calculator-fields">${
    textField(group, "casterId", "本技能施放者标识（与事件中的角色标识一致）", context.casterId) +
    textField(group, "targetId", "本次计算目标标识（与事件中的目标标识一致）", context.targetId) +
    (dehyaReposition ? "" : state(group, "freshCastConfirmed", "本次全新施放，无旧实例、旧冷却、标记或残留增益", context.freshCastConfirmed)) +
    state(group, "fullObservedLifetime", "已记录整个实际有效期内的相关日程", context.fullObservedLifetime) +
    numberField(group, "observedThroughFrame", "已观察至施放后的第几帧（包括末次触发的伤害尾段）", context.observedThroughFrame, { min: 0, max: 100000, integer: true }) +
    state(group, "noHitlag", "本次没有卡肉延长", context.noHitlag) +
    state(group, "noReplacement", "本次没有额外替换实体或状态", context.noReplacement) +
    state(group, "noInterruption", "本次没有中断", context.noInterruption) +
    state(group, "allGeneratedHitsConfirmed", "日程生成的各次伤害均实际命中计算目标", context.allGeneratedHitsConfirmed) +
    state(group, "statsStableAcrossHits", "除逐击覆盖外，进攻面板、装备、反应属性与目标条件保持稳定", context.statsStableAcrossHits) +
    (skill.includes("yoimiya") ? state(group, "yoimiyaA1Inactive", "本次宵宫 A1 增伤未激活", context.yoimiyaA1Inactive) : "") +
    (fischl ? numberField(group, "fischlOzTravelFrames", "奥兹弹道实际飞行帧数", context.fischlOzTravelFrames, { min: 0, max: 100000, integer: true }) + state(group, "noFischlA4", "本次没有菲谢尔 A4 额外反应追击", context.noFischlA4) + state(group, "noFischlHexerei", "本次魔导相关效果未激活", context.noFischlHexerei) + (skill.includes("burst") ? state(group, "noEarlySwapBeforeOz", "Q 全程持续至奥兹生成，未提前换人", context.noEarlySwapBeforeOz) + numberField(group, "skillTalentLevel", "奥兹使用的实际 E 天赋等级", context.skillTalentLevel, { min: 1, max: 15, integer: true }) : "") : "")
  }</div>${dehyaReposition ? `<details open><summary>重新放置前的领域记录</summary><div class="calculator-fields">${textField(group, "dehyaPrior.snapshotId", "前次领域快照标识", context.dehyaPrior?.snapshotId) + numberField(group, "dehyaPrior.snapshotFrame", "前次领域快照帧（相对本次施放，可为负值）", context.dehyaPrior?.snapshotFrame, { min: -100000, max: -1, integer: true }) + numberField(group, "dehyaPrior.remainingLifetimeFrames", "本次开始时前领域剩余寿命帧", context.dehyaPrior?.remainingLifetimeFrames, { min: 0, max: 100000, integer: true }) + numberField(group, "dehyaPrior.remainingCooldownFrames", "本次开始时前领域剩余触发冷却帧", context.dehyaPrior?.remainingCooldownFrames, { min: 0, max: 100000, integer: true })}</div></details>` : ""}${renderCoordinatedSchedule(document)}${accounting ? `<details open><summary>共同实际被动状态与已含份额</summary><div class="calculator-fields">${hitFields("sharedState", context.sharedState)}</div><p class="calculator-hint">只有明确稳定且未使用历史快照的命中可采用共同状态。已含份额明确为零才填 0；留空保留未知。${yelan ? "夜兰 Q 初击的基伤生命值取施放第 0 帧，其余进攻快照在第 76 帧；若两者不稳定，须另填第 0 帧的实际生命值，不能用第 76 帧快照替代。" : ""}</p></details><details><summary>逐击被动状态覆盖</summary>${document.hits.filter(hit => hit.kind === "ordinary").map(hit => `<fieldset><legend>${esc(hit.label)} · ${document.selectedHitIds.includes(hit.id) ? "已选" : "未选"}${hit.finalSnapshot ? " · 历史快照" : ""}</legend><div class="calculator-fields">${hitFields(`hitStates.${hit.id}`, context.hitStates?.[hit.id])}</div></fieldset>`).join("")}<p class="calculator-hint">逐击填写的字段覆盖共同值；历史最终快照需要自身对应的实际被动状态与已含份额。</p></details>` : ""}${events.length ? `<details><summary>当前日程生成的 ${events.length} 次命中</summary><div class="table-wrap"><table><thead><tr><th>命中</th><th>命中帧</th><th>触发事件</th><th>快照标识／帧</th></tr></thead><tbody>${events.map(({ hit, event }) => `<tr><td>${esc(hit.label)}</td><td>${event.frame}</td><td>${esc(event.trigger.eventId)} · ${event.trigger.frame}</td><td>${esc(event.snapshotId)} · ${event.snapshotFrame}</td></tr>`).join("")}</tbody></table></div></details>` : ""}<p class="calculator-hint">此入口计算明确日程下的一次施放。未知资格、冷却冲突与不支持条件会显示在依赖说明中；独立选取一击时，仍可保留未选后续的条件未知。</p></fieldset>`;
}

function durinControls(document: CalculatorDocument): string {
  const game = document.gameContext, context = game?.durinSkill;
  if (!context) return "";
  const hits = document.hits.filter(hit => hit.kind === "ordinary" && document.selectedHitIds.includes(hit.id));
  if (hits.length < 2 && game.constellation !== 2) return "";
  return `<fieldset data-source-cast-controls="durin-skill"><legend>杜林 E · 本次命中条件</legend>` +
    (hits.length > 1 ? state("durinSkill", "statsStableAcrossHits", "这几击的其余面板、装备和目标状态保持不变", context.statsStableAcrossHits) : "") +
    (game.constellation === 2 ? hits.map(hit => `<div class="calculator-fields"><p class="calculator-full">${esc(hit.label)}</p>${state("durinSkill", `hitStates.${hit.id}.c2PyroBonusActive`, "本击的 C2 火伤增益仍在生效", context.hitStates?.[hit.id]?.c2PyroBonusActive)}${state("durinSkill", `hitStates.${hit.id}.c2PyroBonusIncluded`, "本击的增伤输入已经计入 C2 火伤", context.hitStates?.[hit.id]?.c2PyroBonusIncluded)}</div>`).join("") : "") +
    `<p class="calculator-hint">C2需在Q持续期间触发相关反应，增益持续6秒；本页按每击实际状态计算，不从反应选项猜触发。</p></fieldset>`;
}

/** These controls record context only; all source formulas are rebuilt by sim-core. */
export function renderSourceCastControls(document: CalculatorDocument): string {
  return renderGamingControls(document) + renderXiaoControls(document) + durinControls(document) + travelerControls(document) + projectileControls(document) + periodicControls(document) + finiteControls(document) + coordinatedControls(document) + renderHeldLifecycleCastControls(document) + renderFiniteFollowupCastControls(document) + renderObservedEntityControls(document) + renderMaleTravelerChargedControls(document) + renderPeriodicOrdinaryControls(document) + renderIdleStanceControls(document) + renderEntityFollowupControls(document) + renderExtendedStanceControls(document) + renderMixedSourceControls(document) + renderNoellePlungeControls(document) + renderKachinaCastControls(document) + renderObservedPlungeControls(document);
}

/** Optional nested hit/shared maps are created only after the user supplies a value. */
export function applySourceCastControl(document: CalculatorDocument, input: HTMLInputElement | HTMLSelectElement): void {
  const path = input.dataset.sourceCastStateField ?? input.dataset.sourceCastEnumField ?? input.dataset.sourceCastValueField ?? input.dataset.sourceCastTextField ?? input.dataset.field!;
  const keys = path.split(".");
  const hitStateIndex = keys.indexOf("hitStates");
  if (hitStateIndex >= 0 && keys.length > hitStateIndex + 3) keys.splice(hitStateIndex + 1, keys.length - hitStateIndex - 2, keys.slice(hitStateIndex + 1, -1).join("."));
  const contactIndex = keys.indexOf("targetContacts");
  if (contactIndex >= 0 && keys.length > contactIndex + 2) keys.splice(contactIndex + 1, keys.length - contactIndex - 1, keys.slice(contactIndex + 1).join("."));
  const missing = input.value.trim() === "" || !input.dataset.sourceCastTextField && input.value === "unknown";
  let target = document as unknown as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) {
    if (target[key] === undefined) {
      if (missing) return;
      target[key] = {};
    }
    target = target[key] as Record<string, unknown>;
  }
  const key = keys[keys.length - 1]!;
  if (missing) delete target[key];
  else if (input.dataset.sourceCastStateField) target[key] = input.value === "1";
  else if (input.dataset.sourceCastEnumField) target[key] = input.value;
  else if (input.dataset.sourceCastTextField) target[key] = input.value.trim();
  else target[key] = Number(input.value);
}
