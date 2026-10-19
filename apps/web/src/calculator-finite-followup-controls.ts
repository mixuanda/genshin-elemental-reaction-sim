import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { finiteFollowupTemplates } from "../../../packages/game-data/src/character-mappings/finite-followup-mappings";

type OrdinaryHit = Extract<CalculatorDocument["hits"][number], { kind: "ordinary" }>;
const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const path = (key: string): string => `gameContext.finiteFollowupCast.${key}`;

function state(key: string, label: string, value: boolean | undefined): string {
  return `<label>${esc(label)}<select data-source-cast-state-field="${esc(path(key))}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；未填写</option><option value="0"${value === false ? " selected" : ""}>否</option><option value="1"${value === true ? " selected" : ""}>是</option></select></label>`;
}

function numberField(key: string, label: string, value: number | undefined, options: { min?: number; max?: number; integer?: boolean; placeholder?: string } = {}): string {
  return `<label>${esc(label)}<input type="number" data-field="${esc(path(key))}" data-source-cast-number-field data-optional-number value="${esc(value)}" placeholder="${esc(options.placeholder ?? "未知；留空")}" step="${options.integer ? "1" : "any"}" min="${options.min ?? 0}"${options.max === undefined ? "" : ` max="${options.max}"`}></label>`;
}

function talentLevel(value: number | undefined): string {
  return `<label>飓烈箭的独立普通攻击有效天赋等级<select data-source-cast-value-field="${path("normalTalentLevel")}"><option value="unknown"${value === undefined ? " selected" : ""}>未知；未填写</option>${Array.from({ length: 15 }, (_, index) => index + 1).map(level => `<option value="${level}"${value === level ? " selected" : ""}>${level} 级</option>`).join("")}</select></label>`;
}

/** Render only conditions used by this sourced action; blank values stay unknown. */
export function renderFiniteFollowupCastControls(document: CalculatorDocument): string {
  const game = document.gameContext;
  const cast = finiteFollowupTemplates.find(template => template.skillId === game?.skillId);
  if (!game || !cast) return "";
  const context = game.finiteFollowupCast ?? {};
  const selected = new Set(document.selectedHitIds);
  const selectedDefinitions = cast.hits.filter(hit => selected.has(hit.id));
  const full = document.scope === "one-cast" && cast.hits.every(hit => selected.has(hit.id));
  const ordinaryHits = document.hits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary" && cast.hits.some(definition => definition.id === hit.id));
  const selectedHits = ordinaryHits.filter(hit => selected.has(hit.id));
  const ascensionOf = (hit: typeof ordinaryHits[number]): number | undefined => hit.finalSnapshot?.ascension ?? (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? game.ascension;
  const mayNeedA4 = selectedHits.some(hit => {
    const ascension = ascensionOf(hit);
    return ascension === undefined || ascension >= 4;
  });
  const followupSelected = full || selectedDefinitions.some(hit => hit.role !== "initial");
  const faruzanQ = game.skillId === "finite-followup-faruzan-burst-fresh-c0";
  const endseer = game.skillId === "finite-followup-cyno-skill-endseer-c0";
  const detonation = game.skillId === "finite-followup-keqing-skill-detonation-c0";
  let common = "";
  if (selectedDefinitions.length > 1) common += state("statsStableAcrossHits", "除逐击明确差异外，所选命中的面板、装备与目标条件稳定", context.statsStableAcrossHits);
  if (full) common += state("completeCastConfirmed", cast.characterSlug === "faruzan" && !faruzanQ
    ? "三击均命中计算目标；飓烈箭只命中一个目标，只有一次生成风涡的回调"
    : "本分支所列自身伤害全部实际命中同一目标，完整动作条件成立", context.completeCastConfirmed) +
    state("noHitlag", "本次固定帧日程没有卡肉延长", context.noHitlag) +
    state("noReplacement", "本次实体与状态未被其他施放替换、重置或提前消耗", context.noReplacement) +
    state("noInterruption", "所需动作与实体存续没有被中断", context.noInterruption);

  let specific = "", explanation = "";
  if (cast.characterSlug === "keqing") {
    specific = state("keqingPriorQInactive", "此前 Q 的 15% 暴击率与充能增益未激活", context.keqingPriorQInactive);
    if (followupSelected) specific += state("keqingFreshStiletto", "后续伤害来自本次全新、仍存在且未提前消耗的雷楔", context.keqingFreshStiletto) +
      numberField("keqingFollowupFrame", detonation ? "触发雷暴连斩的重击开始帧（相对本次 E 起点）" : "再次施放 E 的开始帧（相对本次 E 起点）", context.keqingFollowupFrame, { min: detonation ? 37 : 35, max: 319, integer: true });
    explanation = `雷楔初击在第 25 帧取样；${detonation ? "重击从第 37–319 帧开始，雷暴连斩在该起点后 21／24 帧命中" : "再次施放从第 35–319 帧开始，斩击在该起点后 16 帧命中"}。本次 E 只合计这些雷伤；触发引爆的普通重击、前置普攻及后续附魔普攻另属其他动作。只选初击时不要求后续触发时点。`;
  } else if (cast.characterSlug === "faruzan") {
    specific = state("faruzanFreshNoPriorEffects", faruzanQ ? "全新 Q，无旧 E／Q 增伤、减抗或 A4 冷却残留" : "无旧 E／Q 增伤、减抗或 A4 冷却残留，且此 E 连段期间不开启 Q", context.faruzanFreshNoPriorEffects);
    if (faruzanQ) {
      specific += state("faruzanInsideBurstArea", "本人在第 43–54 帧持续处于本次 Q 的增益范围内", context.faruzanInsideBurstArea);
      if (mayNeedA4) specific += state("faruzanNoOtherAnemoBeforeInitial", "Q 初击前无其他合资格风伤消耗 A4，初击时冷却可用", context.faruzanNoOtherAnemoBeforeInitial) +
        numberField("faruzanBaseAtk", "A4 使用的真实基础攻击力（角色白值＋武器白值）", context.faruzanBaseAtk, { placeholder: document.build.mode === "equipment-derived" && !selectedHits.some(hit => hit.finalSnapshot) ? "可留空使用来源配装白值" : "未知；不能由最终 ATK 反推" });
      explanation = "本次完整 Q 只有第 54 帧的一次直接伤害；第 43 帧先获得本级 Q 风伤，后续三角脉冲不另计伤害。突破 4 的 A4 为 32% 基础攻击力，不能用最终 ATK 代替。初击后的减抗不能追溯到初击。手填或历史面板需提供实际白值；来源配装仅在该击没有历史快照时可沿用配装白值。";
    } else {
      if (followupSelected) specific += numberField("faruzanHurricaneStartFrame", "本次唯一满蓄飓烈箭的蓄力开始帧（相对 E 起点）", context.faruzanHurricaneStartFrame, { min: 35, max: 1092, integer: true });
      if (selectedDefinitions.some(hit => hit.talent === "normal")) specific += talentLevel(context.normalTalentLevel);
      explanation = "完整 E 包含初击、一发满蓄飓烈箭及一次风压坍陷。箭只命中一个目标并产生一次回调；多目标穿透产生额外风涡不属于此三击分支。箭使用独立普攻等级，初击与坍陷使用 E 等级。初击在第 14 帧；蓄力开始后，突破 1 已解锁时第 49 帧取样，否则第 86 帧，再经过 10 帧弹道命中；坍陷在箭命中时取样、33 帧后命中。本次坍陷的减抗在伤害之后生效。";
    }
  } else if (cast.characterSlug === "xinyan") {
    if (full) specific = numberField("xinyanInitialOpponentCount", "初击实际命中的敌人数（不是本目标的重复命中次数）", context.xinyanInitialOpponentCount, { min: 1, max: 99, integer: true }) +
      state("xinyanShieldUnbroken", "三级盾从第 28 帧保持至第 748 帧自然到期，未破裂或提前移除", context.xinyanShieldUnbroken);
    explanation = "突破 0 时初击至少命中 3 名敌人，突破 1 后至少 2 名，才生成三级盾。此处合计同一计算目标受到的初击与五次脉冲，不乘初击敌人数。初击第 15 帧，脉冲第 149／269／389／509／629 帧；护盾先于第六次脉冲到期。A4 的物理增伤不加入这些火伤。独立单击只表示该次命中已实际发生。";
  } else if (cast.characterSlug === "cyno") {
    specific = state("cynoBurstActive", "E 起手与第 28 帧取样均处于启途誓使，Q 的 100 精通持续有效", context.cynoBurstActive) +
      state("cynoEndseerActive", `本次 E 起手时末途真眼实际激活（本分支要求${endseer ? "是" : "否"}）`, context.cynoEndseerActive) +
      state("cynoBurstEmIncludedInPanel", "共同输入精通已含 Q 的 100 点精通（逐击可覆盖）", context.cynoBurstEmIncludedInPanel);
    if (endseer && selectedDefinitions.some(hit => hit.role.startsWith("bolt-")) && mayNeedA4) specific += numberField("cynoCastEm", "本次 E 起手时的真实总精通（已含当时 Q 的 100 精通）", context.cynoCastEm);
    explanation = `本次只归属 Q 状态中的一次 E${endseer ? "与三道渡荒之雷" : "冥祭"}，不代表整个 Q 普攻轮转。主击与渡荒之雷在第 28 帧取进攻面板；突破 4 的渡荒之雷加算基伤另读取 E 起手精通，为每道 2.5 × 起手 EM，不能用第 28 帧面板反推。裁定的 35% 增伤只给末途真眼主击，不给三道雷。共同精通已含声明与逐击已含份额分别保留；历史完整快照必须已经包含 Q 的 100 精通。`;
  }

  const accounting = cast.characterSlug === "faruzan" || cast.characterSlug === "cyno" ? `<div data-finite-followup-hit-accounting><p class="calculator-hint">逐击填写当前输入已经包含的同一来源份额。未知留空，明确未含才填 0；增伤与减抗用小数，0.35 表示 35%。核心计算实际份额减已含份额，旧效果失效时也能扣回。只缺未选命中的条件不妨碍独立单击。</p>${ordinaryHits.map(hit => {
    const values = context.hitStates?.[hit.id] ?? {}, key = `hitStates.${hit.id}`;
    const role = cast.hits.find(definition => definition.id === hit.id)!.role;
    let fields = "", hint = "";
    if (cast.characterSlug === "faruzan") {
      fields = numberField(`${key}.includedDamageBonus`, "本击增伤输入已含的本人 Q 风伤份额（小数）", values.includedDamageBonus) +
        numberField(`${key}.includedAdditiveBase`, "本击加算基伤输入已含的本人 A4 份额（伤害值）", values.includedAdditiveBase);
      if (hit.effectiveResistance === undefined) fields += numberField(`${key}.includedResistanceReduction`, "目标抗性输入已含的本人减抗份额（小数）", values.includedResistanceReduction);
      hint = hit.effectiveResistance === undefined ? "本分支各击实际享受的本人减抗为 0；若抗性输入已扣除旧减抗，需在此明确其份额。" : "本击已填写最终抗性覆盖，直接使用该值，不再根据已含减抗字段补差。";
      if (!faruzanQ) hint += " 此 E 分支本人的 Q 风伤与 A4 基伤实际均为 0；已含旧份额仍需明确，不能当作未知零值。";
    } else {
      fields = state(`${key}.cynoBurstEmIncludedInPanel`, "本击精通已含 Q 的 100 点精通（未填写时沿用共同声明）", values.cynoBurstEmIncludedInPanel) +
        numberField(`${key}.includedDamageBonus`, "本击增伤输入已含的裁定份额（小数）", values.includedDamageBonus) +
        numberField(`${key}.includedAdditiveBase`, "本击加算基伤输入已含的 A4 渡荒之雷份额（伤害值）", values.includedAdditiveBase);
      hint = role.startsWith("bolt-") ? "渡荒之雷没有裁定的 35% 增伤；突破 4 的实际 A4 基伤由独立 E 起手精通计算。" : `冥祭主击没有 A4 渡荒之雷加算基伤；${endseer ? "本分支实际裁定增伤为 35%" : "本分支实际裁定增伤为 0"}。`;
    }
    return `<details data-finite-followup-hit-context="${esc(hit.id)}"${selected.has(hit.id) ? " open" : ""}><summary>${esc(hit.label)} · ${selected.has(hit.id) ? "已选" : "未选"}${hit.finalSnapshot ? " · 历史快照" : ""}</summary><div class="calculator-fields">${fields}</div><p class="calculator-hint">${esc(hint)}</p></details>`;
  }).join("")}</div>` : "";

  return `<fieldset data-source-cast-controls="finite-followup"><legend>${esc(cast.label)}：实际条件</legend>${common || specific ? `<div class="calculator-fields">${common}${specific}</div>` : ""}<p class="calculator-hint">${esc(explanation)}</p>${accounting}<p class="calculator-hint">全部帧数相对本次施放起点。此组来源分支仅覆盖 C0；条件声明和固定来源公式不等于当前游戏实测，也不自动生成队伍或轮转。可独立选择一击；完整施放需要本分支全部条件成立。未知保持未填写，不自动视为零、未含或否。</p></fieldset>`;
}
