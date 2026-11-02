import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";
import type { CalculatorFieldRequirementDraft, CalculatorRequirementAdapter } from "./calculator-requirements";
import { isKukiDamageAction } from "./kuki-calculation-context";
import { isCharlotteSkillAction } from "./collei-charlotte-calculation-context";

const selected = (document: CalculatorDocument) => document.hits.filter(hit => hit.kind === "ordinary" && document.selectedHitIds.includes(hit.id));
const ascensionOf = (document: CalculatorDocument) => (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext?.ascension;
const ascensionPath = (document: CalculatorDocument) => document.build.mode === "equipment-derived" ? "gameContext.ascension" : "build.ascension";
const fullCast = (document: CalculatorDocument) => document.scope === "one-cast" && document.hits.every(hit => document.selectedHitIds.includes(hit.id));
const attribute = (name: string, value: string) => `[${name}="${value.replace(/["\\\u0000-\u001f\u007f]/g, character => `\\${character.codePointAt(0)!.toString(16)} `)}"]`;

/** Links existing controls only. The source context continues to decide which
 * inputs affect this hit; no answer, duration or passive trigger is supplied. */
export const kukiCastRequirementAdapter: CalculatorRequirementAdapter = {
  id: "kuki-conditional-cast",
  applies: document => isKukiDamageAction(document) && document.gameContext?.kukiDamage !== undefined,
  collect(document) {
    const game = document.gameContext!, context = game.kukiDamage!, hits = selected(document);
    if (!hits.length) return [];
    const fields: CalculatorFieldRequirementDraft[] = [];
    const add = (key: string, label: string, explanation: string, dependent = hits, numeric = false, unsatisfied = false) => {
      const fieldPath = `gameContext.kukiDamage.${key}`;
      fields.push({ id: `kuki-cast:${key}`, fieldPath,
        controlSelector: `${numeric ? "input" : "select"}${attribute(numeric ? "data-field" : "data-kuki-state-field", fieldPath)}`,
        label, explanation, status: unsatisfied ? "condition-not-satisfied" : "input-required",
        dependencyIds: dependent.map(hit => `kuki-damage-context:${hit.id}`), hitIds: dependent.map(hit => hit.id) });
    };
    const skill = game.skillId.startsWith("kuki-skill-"), complete = fullCast(document), ascension = ascensionOf(document);
    if (document.scope === "one-cast" && document.selectedHitIds.length > 1 && context.statsStableAcrossHits !== true)
      add("statsStableAcrossHits", "这些命中的面板和目标状态保持一致", "状态变化时可先选择一段，填写该击实际面板；不能把未知当作全程不变。", hits, false, context.statsStableAcrossHits === false);
    if (skill && complete && context.ringUninterrupted !== true)
      add("ringUninterrupted", "草轮完整持续，没有重新释放替换", "仅在本次草轮确实完整持续时确认；否则可独立计算已经发生的一击。", hits, false, context.ringUninterrupted === false);
    const hpHits = skill ? [] : hits.filter(hit => complete || Number(hit.id.split("-instance-").at(-1)) > 7);
    if (hpHits.length && (context.burstHpRatioAtCast === undefined || (context.burstHpRatioAtCast <= .5) !== (game.skillId === "kuki-burst-low-hp-complete-cast"))) {
      add("burstHpRatioAtCast", "施放Q时的当前生命比例", "50%及以下选完整12击，超过50%选完整7击。填写真实施放状态；最大生命与当前生命比例是不同输入，不能为凑分支修改实际值。", hpHits, true, context.burstHpRatioAtCast !== undefined);
      if (context.burstHpRatioAtCast !== undefined) fields.push({ id: "kuki-cast:burst-branch", fieldPath: "gameContext.skillId", controlSelector: "#calc-skill",
        label: "改选与施放生命相符的Q分支", explanation: "实际生命比例已填写，但当前招式的7／12击分支与它不符。保留真实比例，选择对应招式。", status: "condition-not-satisfied",
        dependencyIds: hpHits.map(hit => `kuki-damage-context:${hit.id}`), hitIds: hpHits.map(hit => hit.id) });
    }
    if (skill && ascension === undefined) fields.push({ id: "kuki-cast:ascension", fieldPath: ascensionPath(document), controlSelector: "#calc-ascension",
      label: "角色实际突破阶段", explanation: "突破4决定E伤害是否包含精通加算；无法仅由等级证明已经突破。", status: "input-required",
      dependencyIds: hits.map(hit => `kuki-damage-context:${hit.id}`), hitIds: hits.map(hit => hit.id) });
    if (game.constellation >= 6) {
      const manual = document.build.mode !== "equipment-derived";
      const emHits = hits.filter(hit => !manual || skill && (ascension === undefined || ascension >= 4 || hit.id.endsWith("-initial"))
        || hit.kind === "ordinary" && (hit.additiveReaction !== undefined || hit.reaction !== "none"));
      if (emHits.length && !(manual && context.c6FinalEmRestored === true) && (context.c6Active === undefined || context.c6IncludedInPanel === undefined)) {
        if (manual) add("c6FinalEmRestored", "已填写该击实际最终精通", "确认后直接采用当前精通，不再重复加入C6。若尚未恢复，请明确下列有效状态与面板已含份额。", emHits);
        if (context.c6Active === undefined) add("c6Active", "这次命中的C6精通增益实际有效", "命座已解锁不代表增益正在生效，也不能由当前生命比例反推此前触发。", emHits);
        if (context.c6IncludedInPanel === undefined) add("c6IncludedInPanel", "输入精通已计入C6的150点", "核心只补实际与已含的差值，明确没有计入选否，避免重复加入。", emHits);
      }
    }
    return fields;
  },
};

export const charlotteCastRequirementAdapter: CalculatorRequirementAdapter = {
  id: "charlotte-conditional-cast",
  applies: document => isCharlotteSkillAction(document) && document.gameContext?.charlotteSkill !== undefined,
  collect(document) {
    const game = document.gameContext!, context = game.charlotteSkill!, hits = selected(document);
    if (!hits.length) return [];
    const fields: CalculatorFieldRequirementDraft[] = [], hitIds = hits.map(hit => hit.id), ascension = ascensionOf(document);
    const add = (key: string, controlSelector: string, label: string, explanation: string, dependencyIds: string[], affected = hitIds, unsatisfied = false) => fields.push({
      id: `charlotte-cast:${key}`, fieldPath: `gameContext.charlotteSkill.${key}`, controlSelector, label, explanation,
      status: unsatisfied ? "condition-not-satisfied" as const : "input-required" as const, dependencyIds, hitIds: affected });
    const a4 = ["charlotte-skill-context:a4"], full = ["charlotte-skill-context:full-mark"];
    if (ascension === undefined) fields.push({ id: "charlotte-cast:ascension", fieldPath: ascensionPath(document), controlSelector: "#calc-ascension",
      label: "角色实际突破阶段", explanation: "确认队友人数增伤天赋是否已经解锁；不从等级猜突破。", status: "input-required", dependencyIds: a4, hitIds });
    if ((ascension === undefined || ascension >= 4) && context.nonFontaineTeammates === undefined)
      add("nonFontaineTeammates", "#calc-charlotte-non-fontaine", "除夏洛蒂外的非枫丹队友人数", "按这次实际队伍填写0–3；当前独立计算未提供完整队伍，不能把未知人数当作0。", a4);
    if (ascension !== undefined && ascension < 4 && context.a4IncludedInPanel)
      add("a4IncludedInPanel", "#calc-charlotte-a4-included", "面板中的队友天赋增伤", "当前突破尚未解锁此增伤；先恢复实际面板，不能声明已包含尚未解锁的效果。", a4, hitIds, true);
    if (fullCast(document)) for (const [key, id, label, explanation] of [
      ["markUninterrupted", "mark-uninterrupted", "目标上的标记完整持续", "目标没有提前死亡，标记未替换或额外延长到新增命中；否则先独立选择实际发生的一击。"],
      ["statsStableAcrossHits", "stats-stable-across-hits", "各次标记命中的面板与目标状态一致", "C2层数仍逐击填写；这里只确认其余属性、装备与目标状态没有变化。"],
    ] as const) if (context[key] !== true) add(key, `#calc-charlotte-${id}`, label, explanation, full, hitIds, context[key] === false);
    if (game.constellation >= 2 && game.constellation <= 5) {
      const c2 = (id: string) => `charlotte-skill-context:c2:${id}`;
      if (context.c2IncludedStacks === undefined) add("c2IncludedStacks", "#calc-charlotte-c2-included", "攻击面板已计入的C2层数", "未计入填0；这与每击实际有效层数分开记账，避免重复加攻。", hitIds.map(c2));
      for (const hit of hits) if (context.c2HitStacks?.[hit.id] === undefined) {
        const fieldPath = `gameContext.charlotteSkill.c2HitStacks.${hit.id}`;
        add(`c2HitStacks.${hit.id}`, `input${attribute("data-field", fieldPath)}`, "这次命中取样时的C2层数", "只填写本击实际存在的0–3层；初击不会倒用命中后才产生的增益，后续标记也不默认一直满层。", [c2(hit.id)], [hit.id]);
      }
      const changed = hits.filter(hit => context.c2HitStacks?.[hit.id] !== undefined && context.c2IncludedStacks !== undefined && context.c2HitStacks[hit.id] !== context.c2IncludedStacks);
      if (document.build.mode !== "equipment-derived" && context.c2BaseAttack === undefined && changed.length)
        add("c2BaseAttack", "#calc-charlotte-c2-base-atk", "角色与武器基础攻击力之和", "本击实际层数与面板已含层数不同，需要白字计算差值；不能从最终攻击力反推。", changed.map(hit => c2(hit.id)), changed.map(hit => hit.id));
    }
    return fields;
  },
};
