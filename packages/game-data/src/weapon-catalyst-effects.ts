import type { FormulaExpression } from "../../sim-core/src/calculation-trace";
import { equipmentCatalog, type EquipmentDataset } from "./equipment-dataset";
import { equipmentDescriptionSource } from "./equipment-source";
import type { EquipmentEffectElement } from "./equipment-effects";
import type { EquipmentFormulaContext, EquipmentFormulaResolution, EquipmentFormulaInput, EquipmentStatModifier, EquipmentDynamicHitBonus } from "./equipment-formulas";
import type { EquipmentReactionBonus } from "./artifact-reaction-effects";
import reviewedCatalog from "../sources/weapon-catalyst-effects/reviewed-catalog.json";
import sourceManifest from "../sources/weapon-catalyst-effects/manifest.json";

/** Effective owner state at the instant being restored; no event is generated here. */
export interface WeaponCatalystContext extends EquipmentFormulaContext {
  /** 0 = none; 1 = ATK; 2 = elemental DMG; 3 = EM. Exactly one known song. */
  catalystSong?: number;
  catalystChargedWindowActive?: boolean;
  catalystSkillWindowActive?: boolean;
  catalystBurstWindowActive?: boolean;
  catalystReactionWindowActive?: boolean;
  catalystSecondaryWindowActive?: boolean;
  catalystLunarWindowActive?: boolean;
  /** Confirms every catalog requirement for the off-field Hexerei recipient, including applicable Secret Rite. */
  catalystHexerei?: boolean;
  catalystClearedBondHp?: number;
  catalystHydroCount?: number;
  catalystSameElementCount?: number;
  catalystDifferentElementCount?: number;
  catalystSnapshotHp?: number;
  catalystSnapshotAtk?: number;
}
export interface WeaponCatalystControl { key: keyof WeaponCatalystContext; label: string; kind: "number" | "boolean"; min?: number; max?: number }
export interface WeaponCatalystResolution extends EquipmentFormulaResolution { reactionBonuses: EquipmentReactionBonus[] }
export const SUPPORTED_WEAPON_CATALYST_IDS = reviewedCatalog.filter(rule => rule.supported).map(rule => rule.id);
export const hasWeaponCatalystRule = (id: string): boolean => SUPPORTED_WEAPON_CATALYST_IDS.includes(id);
export const weaponCatalystSourceEvidence = sourceManifest.files;
export const weaponCatalystExcludedRules = reviewedCatalog.filter(rule => !rule.supported).map(rule => ({ id: rule.id, slug: rule.slug, blocker: rule.blocker, sourceRefs: [equipmentDescriptionSource("weapons", rule.slug), ...rule.sourcePaths.map(path => `https://github.com/genshinsim/gcsim/blob/${sourceManifest.gcsimCommit}/${path}`)] }));

export function getWeaponCatalystControls({ weaponId }: { weaponId: string }): WeaponCatalystControl[] {
  const rule = reviewedCatalog.find(entry => entry.id === weaponId && entry.supported);
  if (!rule) return [];
  const controls: WeaponCatalystControl[] = [];
  const flag = (key: keyof WeaponCatalystContext, label: string) => controls.push({ key, label, kind: "boolean" });
  const number = (key: keyof WeaponCatalystContext, label: string, max?: number) => controls.push({ key, label, kind: "number", min: 0, ...(max === undefined ? {} : { max }) });
  const window = (label: string) => flag("weaponEffectActive", label);
  switch (rule.slug) {
    case "twinnephrite": window("甲级宝珏装备者前台击败敌人后的15秒攻击窗口仍有效"); break;
    case "thewidsith": number("catalystSong", "流浪乐章当前主题曲：0无、1攻击、2元素增伤、3精通（10秒内）", 3); break;
    case "wineandsong": window("酒与诗冲刺后的5秒攻击窗口仍有效"); break;
    case "dodocotales": flag("normalHitEffectActive", "嘟嘟可普攻命中后的6秒重击增伤仍有效"); flag("catalystChargedWindowActive", "嘟嘟可重击命中后的6秒攻击提升仍有效"); break;
    case "hakushinring": window("白辰装备者已合法获得自身元素的6秒增伤（反应与角色元素均符合）"); break;
    case "wanderingevenstar": flag("timedEffectActive", "晚星最近周期触发的12秒自身攻击转换仍有效"); number("timedSnapshotEm", "晚星最近周期触发时装备者的非转换元素精通"); break;
    case "flowingpurity": flag("catalystSkillWindowActive", "纯水战技后的15秒元素增伤仍有效"); flag("catalystSecondaryWindowActive", "纯水生命之契完全清除后的15秒增伤仍有效"); number("catalystClearedBondHp", "纯水最近已完全清除的该次生命之契数值（生命点数）"); break;
    case "waveridingwhirl": window("乘浪战技后10秒生命提升仍有效"); number("catalystHydroCount", "乘浪队伍水元素角色人数（包括符合条件的装备者）", 4); break;
    case "ringofyaxche": window("木棉之环战技后10秒玉锻之冕仍有效"); number("catalystSnapshotHp", "木棉之环触发战技时装备者生命上限快照"); break;
    case "etherlightspindlelute": window("天光战技后20秒精通窗口仍有效"); break;
    case "dawningfrost": flag("catalystChargedWindowActive", "霜辰重击命中后10秒精通窗口仍有效"); flag("catalystSkillWindowActive", "霜辰战技命中后10秒精通窗口仍有效"); break;
    case "jadefallssplendor": window("碧落爆发/创造护盾后的3秒定土玉圭仍有效"); number("catalystSnapshotHp", "碧落最近合法触发时装备者生命上限快照"); break;
    case "kagurasverity": number("weaponStacks", "神乐当前按24秒目录规则确认的有效层数", 3); break;
    case "athousandfloatingdreams": number("catalystSameElementCount", "千夜其他同元素队员人数（排除装备者）", 3); number("catalystDifferentElementCount", "千夜其他异元素队员人数（排除装备者）", 3); break;
    case "tulaytullahsremembrance": window("图莱杜拉最近一次战技的14秒窗口仍有效"); flag("offField", "图莱杜拉本击属性取样时装备者在后台"); number("weaponStacks", "图莱杜拉有效增伤单位（每秒+1，合法普攻命中+2，封顶10）", 10); break;
    case "cashflowsupervision":
    case "tomeoftheeternalflow": number("weaponStacks", "本击前仍有效的4秒生命变化层数（各次触发间隔至少0.3秒）", 3); break;
    case "cranesechoingcall": window("鹤鸣装备者下落命中后20秒下落增伤仍有效"); break;
    case "surfsup": number("weaponStacks", "冲浪本击前仍有效的炽夏层数（初始4层，不自动扣增）", 4); break;
    case "starcallerswatch": window("祭星装备者创造护盾后的15秒照夜之镜仍有效且目标在附近"); flag("offField", "祭星本击属性取样时装备者在后台"); break;
    case "sunnymorningsleepin": flag("catalystReactionWindowActive", "寝正月合法扩散后的6秒精通窗口仍有效"); flag("catalystSkillWindowActive", "寝正月战技命中后的9秒精通窗口仍有效"); flag("catalystBurstWindowActive", "寝正月爆发命中后的30秒精通窗口仍有效"); break;
    case "nightweaverslookingglass": flag("catalystSkillWindowActive", "纺夜装备者水/草战技伤害后的4.5秒终北圣言仍有效"); flag("catalystLunarWindowActive", "纺夜附近队伍月绽放后的10秒朔月诗篇仍有效"); break;
    case "reliquaryoftruth": flag("catalystSkillWindowActive", "真语战技后的12秒伪言之秘仍有效"); flag("catalystLunarWindowActive", "真语装备者月绽放伤害后的4秒真识之月仍有效"); break;
    case "nocturnescurtaincall": window("帷间装备者合法月曜反应/伤害后的12秒神酒仍有效"); break;
    case "angelosheptades": window("尘光装备者创造护盾后的20秒先导之光仍有效"); flag("offField", "尘光本击属性取样时装备者在后台"); flag("catalystHexerei", "尘光后台受益全部条件已确认（装备者魔导资格及魔导·秘仪适用）"); number("catalystSnapshotAtk", "尘光最近0.5秒刷新时装备者的非转换总攻击力"); break;
  }
  return controls;
}

const elements: Exclude<EquipmentEffectElement, "physical">[] = ["pyro", "hydro", "cryo", "electro", "anemo", "geo", "dendro"];
const c = (value: number): FormulaExpression => ({ kind: "constant", value });
const v = (key: string): FormulaExpression => ({ kind: "variable", key });
const mul = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "multiply", terms });
const add = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "add", terms });
const min = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "min", terms });
const input = (key: string, value: number, meaningKey: string, unit = "ratio", origin = "weapon-fixed-source"): EquipmentFormulaInput => ({ key, value, meaningKey, unit, origin });
const state = (key: string, value: number, meaningKey: string, unit = "ratio") => input(key, value, meaningKey, unit, "weapon-explicit-context");
const sourceRoot = `https://github.com/genshinsim/gcsim/blob/${sourceManifest.gcsimCommit}/`;

/** Numeric clauses only. The selected character is the wearer and sole restored recipient. */
export function resolveWeaponCatalystEffects(args: { weaponId: string; refinement: number; enabled: boolean; characterId?: string; context?: WeaponCatalystContext; dataset?: EquipmentDataset }): WeaponCatalystResolution {
  const result: WeaponCatalystResolution = { statModifiers: [], dynamicHitBonuses: [], reactionBonuses: [], assumptions: [], effectBlockers: [], missingConditions: [], sourceRefs: [], verification: "provisional" };
  const catalog = equipmentCatalog(args.dataset);
  const weapon = catalog.weapons.find(entry => entry.id === args.weaponId);
  if (!weapon) throw new Error(`活动目录未收录武器 ${args.weaponId}。`);
  const reviewed = reviewedCatalog.find(entry => entry.id === args.weaponId);
  if (!reviewed) { result.effectBlockers.push(`${weapon.name}不属于本批法器来源清单。`); return result; }
  const refs = [equipmentDescriptionSource("weapons", weapon.slug, args.dataset), ...reviewed.sourcePaths.map(path => sourceRoot + path), ...(weapon.slug === "kagurasverity" ? sourceManifest.files.filter(file => file.source === "genshin-optimizer" && file.evidenceRole !== "license").map(file => file.url) : [])];
  result.sourceRefs.push(...refs);
  if (!args.enabled) { result.assumptions.push(`${weapon.name}条件效果已明确停用。`); return result; }
  if (!reviewed.supported) { result.effectBlockers.push(reviewed.blocker); return result; }
  const rank = weapon.refinements.find(entry => entry.rank === args.refinement);
  const fixedRank = reviewed.refinements.find(entry => entry.rank === args.refinement);
  if (!Number.isInteger(args.refinement) || !rank || !fixedRank) throw new Error(`${weapon.name}没有精炼 ${args.refinement} 的固定来源。`);
  if (weapon.slug !== reviewed.slug || rank.description !== fixedRank.description || JSON.stringify(rank.values) !== JSON.stringify(fixedRank.values)) throw new Error(`${weapon.name}活动来源条款或精炼数值已改变，必须重新核验。`);
  const context = args.context ?? {};
  const bools = ["weaponEffectActive", "normalHitEffectActive", "timedEffectActive", "offField", "catalystChargedWindowActive", "catalystSkillWindowActive", "catalystBurstWindowActive", "catalystReactionWindowActive", "catalystSecondaryWindowActive", "catalystLunarWindowActive", "catalystHexerei"] as const;
  for (const key of bools) if (context[key] !== undefined && typeof context[key] !== "boolean") throw new Error(`${key}必须是显式布尔值。`);
  for (const key of ["catalystClearedBondHp", "catalystSnapshotHp", "catalystSnapshotAtk", "timedSnapshotEm"] as const) if (context[key] !== undefined && (!Number.isFinite(context[key]) || context[key]! < 0)) throw new Error(`${key}必须是非负有限数值。`);
  for (const [key, max] of [["catalystSong", 3], ["catalystHydroCount", 4], ["catalystSameElementCount", 3], ["catalystDifferentElementCount", 3]] as const) if (context[key] !== undefined && (!Number.isInteger(context[key]) || context[key]! < 0 || context[key]! > max)) throw new Error(`${key}必须是0–${max}整数。`);
  if (context.catalystSameElementCount !== undefined && context.catalystDifferentElementCount !== undefined && context.catalystSameElementCount + context.catalystDifferentElementCount > 3) throw new Error("千夜其他队员总人数不能超过3。" );
  result.assumptions.push(`${weapon.name}仅恢复本击结算前明确仍有效的装备者状态；不自动生成触发、随机歌曲、能量、治疗、计时、层数或覆盖率。普通增伤不用于独立剧变/月曜/星烁反应乘区。新触发不能倒灌触发它的那次伤害。`);
  const block = (reason: string) => { result.effectBlockers.push(reason); result.missingConditions.push(reason); };
  const need = <K extends keyof WeaponCatalystContext>(key: K): WeaponCatalystContext[K] => {
    if (context[key] === undefined) block(`${weapon.name}缺少显式 ${key}，未知不能视为零或未触发。`);
    return context[key];
  };
  const count = (max: number): number | undefined => {
    const n = need("weaponStacks");
    if (n !== undefined && (!Number.isInteger(n) || n < 0 || n > max)) throw new Error(`${weapon.name}有效层数必须是0–${max}整数。`);
    return n;
  };
  const ownerElement = (): Exclude<EquipmentEffectElement, "physical"> | undefined => {
    if (!args.characterId) { block(`${weapon.name}需要已选装备者角色来确定其固有元素。`); return undefined; }
    const character = catalog.characters.find(entry => entry.id === args.characterId);
    if (!character) throw new Error(`活动目录未收录角色 ${args.characterId}。`);
    if (!(elements as string[]).includes(character.element)) { block(`${weapon.name}装备者没有可用于此条款的已确定元素。`); return undefined; }
    return character.element as Exclude<EquipmentEffectElement, "physical">;
  };
  const pct = (index: number): number => {
    const value = rank.values[index];
    if (!value || !/^\d+(?:\.\d+)?%$/.test(value)) throw new Error(`${weapon.name}字段${index}不是已核验的百分数。`);
    return Number(value.slice(0, -1)) / 100;
  };
  const whole = (index: number): number => {
    const value = rank.values[index];
    if (!value || !/^\d+(?:\.\d+)?$/.test(value)) throw new Error(`${weapon.name}字段${index}不是已核验的固定数值。`);
    return Number(value);
  };
  const stat = (suffix: string, target: EquipmentStatModifier["target"], expression: FormulaExpression, inputs: EquipmentFormulaInput[], phase: EquipmentStatModifier["phase"] = "pre-panel") => result.statModifiers.push({ id: `${weapon.id}:r${args.refinement}:${suffix}`, label: `${weapon.name}·${suffix}`, target, phase, expression, inputs, sourceRefs: refs });
  const hit = (suffix: string, expression: FormulaExpression, inputs: EquipmentFormulaInput[], filters: Pick<EquipmentDynamicHitBonus, "attackTags" | "elements"> = {}) => result.dynamicHitBonuses.push({ id: `${weapon.id}:r${args.refinement}:${suffix}`, label: `${weapon.name}·${suffix}`, expression, inputs, sourceRefs: refs, inputPolicy: "pre-conversion", ...filters });
  const reaction = (suffix: string, value: number, reactions: EquipmentReactionBonus["reactions"]) => result.reactionBonuses.push({ id: `${weapon.id}:r${args.refinement}:${suffix}`, label: `${weapon.name}·${suffix}`, value, reactions, sourceRefs: refs });
  const fixedStat = (suffix: string, target: EquipmentStatModifier["target"], amount: number) => stat(suffix, target, v("amount"), [input("amount", amount, suffix, target === "em" ? "EM" : target === "flatAtk" ? "ATK" : "ratio")]);
  const stateAmount = (active: boolean, amount: number, unit = "ratio") => [state("active", Number(active), "已确认本击前有效状态", "boolean"), input("amount", amount, "来源增益", unit)];
  const windowExpr = mul(v("active"), v("amount"));
  const statWindow = (key: keyof WeaponCatalystContext, suffix: string, target: EquipmentStatModifier["target"], amount: number) => { const active = need(key); if (typeof active === "boolean") stat(suffix, target, windowExpr, stateAmount(active, amount, target === "em" ? "EM" : target === "flatAtk" ? "ATK" : "ratio")); };
  const hitWindow = (key: keyof WeaponCatalystContext, suffix: string, amount: number, filters: Pick<EquipmentDynamicHitBonus, "attackTags" | "elements"> = {}) => { const active = need(key); if (typeof active === "boolean") hit(suffix, windowExpr, stateAmount(active, amount), filters); };
  const stackInputs = (n: number, amount: number) => [state("stacks", n, "已确认本击前有效层数", "count"), input("perStack", amount, "每层来源增益")];
  switch (weapon.slug) {
    case "twinnephrite": statWindow("weaponEffectActive", "击败后攻击", "atkPercent", pct(0)); result.effectBlockers.push("甲级宝珏移动速度与击败事件未执行；来源只允许装备者前台击败触发。"); break;
    case "thewidsith": {
      const song = need("catalystSong");
      if (song === 1) stat("宣叙调攻击", "atkPercent", v("amount"), [state("song", song, "已知主题曲", "choice"), input("amount", pct(0), "宣叙调攻击增益")]);
      if (song === 2) hit("咏叹调元素增伤", v("amount"), [state("song", song, "已知主题曲", "choice"), input("amount", pct(1), "咏叹调七元素增伤")], { elements });
      if (song === 3) stat("间奏曲精通", "em", v("amount"), [state("song", song, "已知主题曲", "choice"), input("amount", whole(2), "间奏曲精通", "EM")]);
      if (song === 0) result.assumptions.push("明确没有仍有效的主题曲，三个主题曲均不生效。");
      result.effectBlockers.push("流浪乐章10秒持续/30秒冷却与随机抽取未自动执行；不能把三曲叠加或以均值替代当前歌曲。"); break;
    }
    case "wineandsong": statWindow("weaponEffectActive", "冲刺后攻击", "atkPercent", pct(1)); result.effectBlockers.push("酒与诗冲刺体力消耗降低及事件时序未执行。"); break;
    case "dodocotales": hitWindow("normalHitEffectActive", "普攻命中后重击增伤", pct(0), { attackTags: ["charged"] }); statWindow("catalystChargedWindowActive", "重击命中后攻击", "atkPercent", pct(1)); result.assumptions.push("两个6秒窗口独立；来源要求装备者前台命中触发，已有窗口不因随后退场立即删除。"); break;
    case "hakushinring": {
      const active = need("weaponEffectActive");
      if (active === false) hit("自身元素窗口未生效", c(0), [], { elements });
      if (active === true) { const element = ownerElement(); if (element) hit("自身元素有效增伤", v("amount"), [input("amount", pct(0), "自身元素6秒增伤")], { elements: [element] }); }
      result.effectBlockers.push("白辰仅恢复装备者作为合法受益者的自身元素增伤；其他队员传播未执行，同名来源不得重复叠加。雷相关反应须由前台装备者触发，不能由当前伤害类型推断。"); break;
    }
    case "wanderingevenstar": {
      const active = need("timedEffectActive");
      if (active === false) stat("周期转换未生效", "flatAtk", c(0), [], "conversion");
      if (active === true) { const em = need("timedSnapshotEm"); if (em !== undefined) stat("周期精通转攻击", "flatAtk", mul(v("snapshotEm"), v("ratio")), [state("snapshotEm", em, "最近周期触发时非转换精通", "EM"), input("ratio", pct(0), "自身精通转换系数")], "conversion"); }
      result.effectBlockers.push("晚星每10秒刷新与12秒窗口未自动运行；对其他队员的30%共享及多装备者叠加未执行，不能把共享再加给自身。"); break;
    }
    case "flowingpurity": {
      hitWindow("catalystSkillWindowActive", "战技元素增伤", pct(0), { elements });
      const active = need("catalystSecondaryWindowActive");
      if (active === false) hit("清契窗口未生效", c(0), [], { elements });
      if (active === true) { const hp = need("catalystClearedBondHp"); if (hp !== undefined) hit("清契生命转元素增伤", min(v("cap"), mul(v("clearedHp"), v("perThousand"), c(0.001))), [state("clearedHp", hp, "最近完全清除的该次生命之契点数", "HP"), input("perThousand", pct(1), "每1000生命增伤"), input("cap", pct(2), "清契增伤上限")], { elements }); }
      result.effectBlockers.push("纯水24%生命之契生成、治疗清偿和10秒冷却未执行；固定源重复施放时累计债务实现不能代替明确已清除点数。"); break;
    }
    case "waveridingwhirl": {
      const active = need("weaponEffectActive");
      if (active === false) fixedStat("生命窗口未生效", "hpPercent", 0);
      if (active === true) { const n = need("catalystHydroCount"); if (n !== undefined) stat("窗口水队生命", "hpPercent", add(v("base"), min(v("cap"), mul(v("hydroCount"), v("perMember")))), [state("hydroCount", n, "队伍水元素人数含自身", "count"), input("base", pct(0), "基础生命比例"), input("perMember", pct(1), "每位水队员生命比例"), input("cap", pct(2), "额外生命上限")]); }
      result.effectBlockers.push("乘浪游泳体力降低与10秒持续/15秒触发冷却未执行。"); break;
    }
    case "ringofyaxche":
    case "jadefallssplendor": {
      const jade = weapon.slug === "jadefallssplendor", active = need("weaponEffectActive");
      if (active === false) hit("生命快照窗口未生效", c(0), [], jade ? { elements } : { attackTags: ["normal"] });
      if (active === true) {
        const hp = need("catalystSnapshotHp"), element = jade ? ownerElement() : undefined;
        if (hp !== undefined && (!jade || element)) hit("生命快照增伤", min(v("cap"), mul(v("snapshotHp"), v("perThousand"), c(0.001))), [state("snapshotHp", hp, "最近合法触发时的生命上限", "HP"), input("perThousand", pct(jade ? 1 : 0), "每1000生命增伤"), input("cap", pct(jade ? 2 : 1), "增伤上限")], jade ? { elements: [element!] } : { attackTags: ["normal"] });
      }
      result.assumptions.push("生命上限按触发时快照读取，不能以命中时实时生命或当前生命值替代。");
      if (jade) result.effectBlockers.push("碧落定土玉圭的定时回能及爆发/创造护盾事件未执行。"); break;
    }
    case "etherlightspindlelute": statWindow("weaponEffectActive", "战技后精通", "em", whole(0)); break;
    case "blackmarrowlantern": reaction("普通绽放反应系数", pct(0), ["bloom"]); result.effectBlockers.push("乌髓月绽放及月兆满辉增伤属于月曜独立反应机制，未执行，不能作为普通绽放/增伤翻倍。"); break;
    case "dawningfrost": statWindow("catalystChargedWindowActive", "重击后精通", "em", whole(0)); statWindow("catalystSkillWindowActive", "战技后精通", "em", whole(1)); result.assumptions.push("霜辰两个10秒窗口独立，固定源需前台装备者命中触发。"); break;
    case "kagurasverity": {
      const n = count(3);
      if (n !== undefined) { hit("神乐舞战技增伤", mul(v("stacks"), v("perStack")), stackInputs(n, pct(0)), { attackTags: ["skill"] }); hit("满层七元素增伤", { kind: "condition", operator: "equal", left: v("stacks"), right: c(3), whenTrue: v("amount"), whenFalse: c(0) }, [state("stacks", n, "目录24秒内已确认有效层数", "count"), input("amount", pct(2), "满层七元素增伤")], { elements }); }
      result.assumptions.push("固定Optimizer实际sheets和元素常量独立核实R1–R5战技叠层/满层七元素增伤；其中文说明同为24秒。公式目录TODO占位文件不作为实现依据。");
      result.effectBlockers.push("神乐旧gcsim16秒与当前双目录24秒冲突，且旧源码满层错误含物理；只恢复明确有效层数并限七元素，自动时序未执行。星超导虽有固定Optimizer条款，当前反应引擎未支持，未执行。"); break;
    }
    case "athousandfloatingdreams": {
      const same = need("catalystSameElementCount"), different = need("catalystDifferentElementCount");
      if (same !== undefined) stat("其他同元素队员精通", "em", mul(v("count"), v("perMember")), [state("count", same, "其他同元素人数", "count"), input("perMember", whole(0), "每位同元素精通", "EM")]);
      if (different === 0) hit("无异元素队员增伤", c(0), [], { elements });
      if (different !== undefined && different > 0) { const element = ownerElement(); if (element) hit("其他异元素队员增伤", mul(v("count"), v("perMember")), [state("count", different, "其他异元素人数", "count"), input("perMember", pct(1), "每位异元素对应元素增伤")], { elements: [element] }); }
      result.effectBlockers.push("千夜给予其他队员的精通共享与多武器来源叠加未执行；装备者不获得自身发出的共享精通。"); break;
    }
    case "tulaytullahsremembrance": {
      const active = need("weaponEffectActive");
      if (active === false) hit("战技窗口未生效", c(0), [], { attackTags: ["normal"] });
      if (active === true) {
        const offField = need("offField");
        if (offField === true) hit("退场清除普攻增伤", c(0), [], { attackTags: ["normal"] });
        if (offField === false) { const n = count(10); if (n !== undefined) hit("当前普攻增伤单位", min(v("cap"), mul(v("stacks"), v("perStack"))), [...stackInputs(n, pct(1)), input("cap", pct(3), "总普攻增伤上限")], { attackTags: ["normal"] }); }
      }
      result.effectBlockers.push("图莱杜拉普通攻击速度、每秒增长、0.3秒命中冷却及重新施放清空时序未执行；输入为有效增伤单位，每次合法命中折算2单位。历史快照须使用当时前台状态。"); break;
    }
    case "cashflowsupervision":
    case "tomeoftheeternalflow": {
      const cash = weapon.slug === "cashflowsupervision";
      fixedStat(cash ? "常驻攻击" : "常驻生命", cash ? "atkPercent" : "hpPercent", pct(0));
      const n = count(3);
      if (n !== undefined) { if (cash) hit("生命变化普攻增伤", mul(v("stacks"), v("perStack")), stackInputs(n, pct(1)), { attackTags: ["normal"] }); hit("生命变化重击增伤", mul(v("stacks"), v("perStack")), stackInputs(n, pct(cash ? 2 : 1)), { attackTags: ["charged"] }); }
      result.effectBlockers.push(cash ? "金流生命事件与叠层时序、满层攻击速度、星超导反应条款未执行。" : "万世生命事件与叠层时序、满层或刷新满层回能及12秒冷却未执行。");
      result.assumptions.push("固定来源要求装备者前台时生命变化触发；已有有效层数不会因随后退场立即清除。"); break;
    }
    case "cranesechoingcall": hitWindow("weaponEffectActive", "有效下落增伤", pct(0), { attackTags: ["plunge"] }); result.effectBlockers.push("鹤鸣只恢复装备者自身享受的下落增伤；队伍传播、队友下落命中回能和0.7秒冷却未执行。"); break;
    case "surfsup": { fixedStat("常驻生命", "hpPercent", pct(0)); const n = count(4); if (n !== undefined) hit("炽夏普攻增伤", mul(v("stacks"), v("perStack")), stackInputs(n, pct(1)), { attackTags: ["normal"] }); result.effectBlockers.push("冲浪技能初始4层、14秒窗口、15秒触发冷却及普攻/蒸发各1.5秒扣增层时序未自动执行。"); break; }
    case "starcallerswatch": {
      fixedStat("常驻精通", "em", whole(0));
      const active = need("weaponEffectActive");
      if (active === false) hit("照夜之镜未生效", c(0), []);
      if (active === true) { const offField = need("offField"); if (offField !== undefined) hit("场上装备者照夜增伤", mul(v("onField"), v("amount")), [state("onField", Number(!offField), "装备者本人在场", "boolean"), input("amount", pct(1), "附近敌人伤害加成")]); }
      result.effectBlockers.push("祭星只恢复装备者本人作为当前场上受益者的效果；其他场上队员、创造护盾事件及14秒冷却未自动执行。固定源要求前台创造护盾并留有TODO，目录未明示此触发限制；有效窗口需独立确认，不能由当前有盾推断。"); break;
    }
    case "sunnymorningsleepin": statWindow("catalystReactionWindowActive", "扩散后精通", "em", whole(0)); statWindow("catalystSkillWindowActive", "战技命中后精通", "em", whole(1)); statWindow("catalystBurstWindowActive", "爆发命中后精通", "em", whole(2)); result.effectBlockers.push("寝正月固定源无星扩散事件；这里只恢复已确认的精通窗口，不证明新反应能触发。三个窗口独立，固定源触发要求前台。"); break;
    case "vividnotions": fixedStat("常驻攻击", "atkPercent", pct(0)); result.effectBlockers.push("溢彩两种下落专属暴击伤害由命中专属模块按本人合法触发的独立窗口恢复；15秒/坠地后0.1秒清除时序未执行，固定来源触发订阅缺少装备者身份过滤，不能直接用于队友代触发。"); break;
    case "nightweaverslookingglass": {
      const skill = need("catalystSkillWindowActive"), lunar = need("catalystLunarWindowActive");
      if (skill !== undefined) stat("终北圣言精通", "em", windowExpr, stateAmount(skill, whole(0), "EM"));
      if (lunar !== undefined) stat("朔月诗篇精通", "em", windowExpr, stateAmount(lunar, whole(1), "EM"));
      if (skill !== undefined && lunar !== undefined) { reaction("双窗口普通绽放", skill && lunar ? pct(2) : 0, ["bloom"]); reaction("双窗口超绽放烈绽放", skill && lunar ? pct(3) : 0, ["hyperbloom", "burgeon"]); }
      result.effectBlockers.push("纺夜月绽放独立反应增伤与队伍传播未执行；普通反应系数只对装备者生效且同名不可重复叠加。终北与朔月为独立窗口，不自动触发或刷新。"); break;
    }
    case "reliquaryoftruth": {
      fixedStat("常驻暴击率", "critRate", pct(0));
      const skill = need("catalystSkillWindowActive"), lunar = need("catalystLunarWindowActive");
      if (skill !== undefined && lunar !== undefined) {
        const both = skill && lunar;
        const multiplier = [state("both", Number(both), "两个窗口同时有效", "boolean"), input("extra", 0.5, "同时存在时额外提升比例")];
        stat("伪言之秘精通", "em", mul(v("active"), v("amount"), add(c(1), mul(v("both"), v("extra")))), [...stateAmount(skill, whole(1), "EM"), ...multiplier]);
        stat("真识之月暴伤", "critDamage", mul(v("active"), v("amount"), add(c(1), mul(v("both"), v("extra")))), [...stateAmount(lunar, pct(2)), ...multiplier]);
      }
      result.assumptions.push("真识之月虽由装备者月绽放伤害触发，其已生效暴击伤害为全局属性；常驻暴击率不参加双窗口50%强化。"); break;
    }
    case "nocturnescurtaincall": fixedStat("常驻生命", "hpPercent", pct(0)); statWindow("weaponEffectActive", "神酒额外生命", "hpPercent", pct(2)); result.effectBlockers.push("帷间月曜反应专属暴击伤害与18秒冷却回能未执行，不写成全局暴伤。固定源月结晶触发订阅被注释；本模块只接受已经合法存在的12秒生命窗口。"); break;
    case "angelosheptades": {
      fixedStat("常驻攻击", "atkPercent", pct(0));
      const active = need("weaponEffectActive");
      if (active === false) hit("先导之光未生效", c(0), []);
      if (active === true) {
        const offField = need("offField");
        const hexerei = offField === true ? need("catalystHexerei") : undefined;
        if (offField === true && hexerei === false) hit("后台非魔导无先导加成", c(0), []);
        else if (offField === false || (offField === true && hexerei === true)) {
          const atk = need("catalystSnapshotAtk");
          if (atk !== undefined) hit("先导之光攻击样本转增伤", mul(v("recipientFactor"), min(v("cap"), mul(v("snapshotAtk"), v("perThousand"), c(0.001)))), [state("snapshotAtk", atk, "最近刷新时非转换总攻击力", "ATK"), state("recipientFactor", offField ? 0.5 : 1, "装备者场上全额或后台魔导半额"), input("perThousand", pct(1), "每1000攻击增伤"), input("cap", pct(2), "先导之光上限")]);
        }
      }
      result.effectBlockers.push("尘光护盾/宝箱回能、14秒冷却、队伍传播及每0.5秒刷新未执行；只读取装备者最近刷新的非转换攻击样本，不允许循环把属性转换攻击再次转换。固定源后台仅检查IsHexerei而没有独立秘仪队伍门；catalystHexerei必须明确确认目录要求的全部后台受益条件，不从此源码推定秘仪已启动。"); break;
    }
  }
  return result;
}
