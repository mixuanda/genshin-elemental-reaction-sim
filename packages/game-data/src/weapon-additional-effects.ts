import type { FormulaExpression } from "../../sim-core/src/calculation-trace";
import { equipmentCatalog, type EquipmentDataset } from "./equipment-dataset";
import { equipmentDescriptionSource } from "./equipment-source";
import type { EquipmentFormulaContext, EquipmentFormulaResolution, EquipmentFormulaInput, EquipmentStatModifier, EquipmentDynamicHitBonus } from "./equipment-formulas";
import reviewedCatalog from "../sources/weapon-additional-effects/reviewed-catalog.json";
import sourceManifest from "../sources/weapon-additional-effects/manifest.json";

export interface EquipmentAdditionalWeaponContext extends EquipmentFormulaContext {
  normalHitEffectActive?: boolean;
  skillBurstHitEffectActive?: boolean;
  teamBurstEnergyTotal?: number;
  nearbyEnemyCount?: number;
  targetFrozen?: boolean;
}
export interface WeaponAdditionalControl { key: keyof EquipmentAdditionalWeaponContext; label: string; kind: "number" | "boolean"; min?: number; max?: number }
export const SUPPORTED_WEAPON_ADDITIONAL_IDS = reviewedCatalog.filter(rule => rule.supported).map(rule => rule.id);
export const hasWeaponAdditionalRule = (id: string): boolean => SUPPORTED_WEAPON_ADDITIONAL_IDS.includes(id);
export const weaponAdditionalSourceEvidence = sourceManifest.files;
export const weaponAdditionalExcludedRules = reviewedCatalog.filter(rule => !rule.supported).map(rule => ({ id: rule.id, slug: rule.slug, blocker: rule.blocker, sourceRefs: [equipmentDescriptionSource("weapons", rule.slug), ...rule.sourcePaths.map(path => `https://github.com/genshinsim/gcsim/blob/${sourceManifest.gcsimCommit}/${path}`)] }));

const stackControls: Record<string, { max: number; min?: number; label: string }> = {
  ironsting: { max: 2, label: "铁蜂刺本击前仍有效的6秒增伤层数" },
  mappamare: { max: 2, label: "万国本击前仍有效的10秒元素增伤层数" },
  serpentspine: { max: 5, label: "螭骨剑本击前仍有效层数（退场不清除）" },
  lithicblade: { max: 4, label: "千岩：队伍中已确认的璃月角色人数（含符合条件的自身）" },
  lithicspear: { max: 4, label: "千岩：队伍中已确认的璃月角色人数（含符合条件的自身）" },
  prototyperancour: { max: 4, label: "试作斩岩本击前仍有效的6秒层数" },
  whiteblind: { max: 4, label: "白影剑本击前仍有效的6秒层数" },
  skyridergreatsword: { max: 4, label: "飞天大御剑本击前仍有效的6秒层数" },
  balladoftheboundlessblue: { max: 3, label: "无垠蔚蓝本击前合法普攻/重击触发的有效层数" },
  lostprayertothesacredwinds: { max: 4, label: "四风：本击属性取样时仍有效的在场层数（离场清除）" },
  polarstar: { max: 4, label: "冬极本击前12秒内仍有效的不同普/重/战技/爆发类别数" },
  harangeppakufutsu: { max: 2, label: "波乱当前8秒普攻增益对应的已消耗层数（不是待消耗波穗）" },
  thefirstgreatmagic: { max: 4, min: 1, label: "大魔术队伍同元素人数（含自身，至少1，3及以上封顶）" }
};
const windowLabels: Record<string, string> = {
  darkironsword: "暗铁剑已确认合法反应触发的12秒攻击窗口仍有效",
  emeraldorb: "翡玉法球已确认合法水相关反应后的12秒攻击窗口仍有效",
  fluteofezpitzal: "息燧之笛战技后15秒防御窗口仍有效",
  footprintoftherainbow: "虹的行迹战技后15秒防御窗口仍有效",
  oathsworneye: "证誓之明瞳战技后10秒充能窗口仍有效",
  mailedflower: "饰铁之花合法战技命中/反应后的8秒攻击与精通窗口仍有效",
  missivewindspear: "风信之锋合法反应后的10秒攻击与精通窗口仍有效",
  windblumeode: "风花之颂战技后6秒攻击窗口仍有效",
  tidalshadow: "浪影阔剑受治疗后8秒攻击窗口仍有效",
  songofstillness: "静谧之曲受治疗后8秒增伤窗口仍有效",
  earthshaker: "撼地者队伍合法火相关反应后的8秒战技窗口仍有效",
  aquasimulacra: "若水已确认近敌增伤状态仍有效（含检查后短暂保留）",
  urakumisugiri: "有乐御簾切合法前台岩伤触发的15秒加倍窗口仍有效",
  toukaboushigure: "当前目标上东花坊时雨的10秒纸伞作祟仍有效"
};
export function getWeaponAdditionalControls({ weaponId }: { weaponId: string }): WeaponAdditionalControl[] {
  const rule = reviewedCatalog.find(entry => entry.id === weaponId && entry.supported);
  if (!rule) return [];
  const list: WeaponAdditionalControl[] = [];
  const stacks = stackControls[rule.slug];
  if (stacks) list.push({ key: "weaponStacks", label: stacks.label, kind: "number", min: stacks.min ?? 0, max: stacks.max });
  if (windowLabels[rule.slug]) list.push({ key: "weaponEffectActive", label: windowLabels[rule.slug]!, kind: "boolean" });
  if (rule.slug === "solarpearl") list.push({ key: "normalHitEffectActive", label: "匣里日月普攻命中后6秒战技/爆发增伤有效", kind: "boolean" }, { key: "skillBurstHitEffectActive", label: "匣里日月战技/爆发命中后6秒普攻增伤有效", kind: "boolean" });
  if (["wavebreakersfin", "mouunsmoon", "akuoumaru"].includes(rule.slug)) list.push({ key: "teamBurstEnergyTotal", label: "队伍所有角色的元素能量上限总和（不是当前能量）", kind: "number", min: 0 });
  if (rule.slug === "deathmatch") list.push({ key: "nearbyEnemyCount", label: "决斗当前已生效分支的敌人数采样（不是瞬时位置）", kind: "number", min: 0 });
  if (rule.slug === "magicguide") list.push({ key: "targetFrozen", label: "魔导：当前目标是否冻结（无水雷附着时需明确）", kind: "boolean" });
  if (rule.slug === "lostprayertothesacredwinds") list.push({ key: "offField", label: "四风：本击属性取样时装备者位于后台（是则层数失效）", kind: "boolean" });
  return list;
}

const elemental = ["pyro", "hydro", "cryo", "electro", "anemo", "geo", "dendro"] as const;
const sourceRoot = `https://github.com/genshinsim/gcsim/blob/${sourceManifest.gcsimCommit}/`;
const c = (value: number): FormulaExpression => ({ kind: "constant", value });
const v = (key: string): FormulaExpression => ({ kind: "variable", key });
const mul = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "multiply", terms });
const add = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "add", terms });
const choose = (operator: "lt" | "lte" | "equal", left: FormulaExpression, right: FormulaExpression, whenTrue: FormulaExpression, whenFalse: FormulaExpression): FormulaExpression => ({ kind: "condition", operator, left, right, whenTrue, whenFalse });
const sourceInput = (key: string, value: number, meaningKey: string, unit = "ratio"): EquipmentFormulaInput => ({ key, value, meaningKey, unit, origin: "weapon-fixed-source" });
const stateInput = (key: string, value: number, meaningKey: string, unit = "ratio"): EquipmentFormulaInput => ({ key, value, meaningKey, unit, origin: "weapon-explicit-context" });

/** Named, source-reviewed numeric clauses evaluated by the shared core, with explicit effective state only. */
export function resolveWeaponAdditionalEffects(args: { weaponId: string; refinement: number; enabled: boolean; context?: EquipmentAdditionalWeaponContext; dataset?: EquipmentDataset }): EquipmentFormulaResolution {
  const result: EquipmentFormulaResolution = { statModifiers: [], dynamicHitBonuses: [], assumptions: [], effectBlockers: [], missingConditions: [], sourceRefs: [], verification: "provisional" };
  const weapon = equipmentCatalog(args.dataset).weapons.find(entry => entry.id === args.weaponId);
  if (!weapon) throw new Error(`活动目录未收录武器 ${args.weaponId}。`);
  const rank = weapon.refinements.find(entry => entry.rank === args.refinement);
  if (!rank || !Number.isInteger(args.refinement)) throw new Error(`${weapon.name}没有精炼 ${args.refinement} 的固定来源。`);
  if (!args.enabled) { result.assumptions.push(`${weapon.name}条件效果已明确停用。`); return result; }
  const reviewed = reviewedCatalog.find(entry => entry.id === args.weaponId && entry.supported);
  if (!reviewed) { result.effectBlockers.push(`${weapon.name}没有本模块已登记的条件公式。`); return result; }
  const fixedRank = reviewed.refinements.find(entry => entry.rank === args.refinement);
  if (weapon.slug !== reviewed.slug || !fixedRank || rank.description !== fixedRank.description || JSON.stringify(rank.values) !== JSON.stringify(fixedRank.values)) throw new Error(`${weapon.name}活动来源条款或精炼数值已改变，必须重新核验。`);
  const context = args.context ?? {};
  for (const key of ["weaponEffectActive", "normalHitEffectActive", "skillBurstHitEffectActive", "offField", "targetFrozen"] as const) if (context[key] !== undefined && typeof context[key] !== "boolean") throw new Error(`${key}必须为显式布尔值。`);
  for (const key of ["teamBurstEnergyTotal", "nearbyEnemyCount"] as const) if (context[key] !== undefined && (!Number.isFinite(context[key]) || context[key]! < 0 || (key === "nearbyEnemyCount" && !Number.isInteger(context[key])))) throw new Error(`${key}必须为非负有限${key === "nearbyEnemyCount" ? "整数" : "数值"}。`);
  if (context.enemyAuras?.some(value => !(elemental as readonly string[]).includes(value))) throw new Error("enemyAuras必须为元素附着，不能包含物理伤害。");
  const refs = [equipmentDescriptionSource("weapons", weapon.slug, args.dataset), ...reviewed.sourcePaths.map(path => sourceRoot + path)];
  result.sourceRefs.push(...refs);
  result.assumptions.push(`${weapon.name}只恢复明确的本击结算前有效状态；不自动生成触发、层数、团队构成、计时、覆盖率或随机事件。上下文改变需重新恢复；普通伤害加成不用于独立剧变反应乘区。`);
  const block = (reason: string): void => { result.effectBlockers.push(reason); result.missingConditions.push(reason); };
  const need = <K extends keyof EquipmentAdditionalWeaponContext>(key: K): EquipmentAdditionalWeaponContext[K] => {
    if (context[key] === undefined) block(`${weapon.name}缺少显式 ${key}，不能把未知条件当作零或未触发。`);
    return context[key];
  };
  const count = (max: number, min = 0): number | undefined => {
    const n = need("weaponStacks");
    if (n !== undefined && (!Number.isInteger(n) || n < min || n > max)) throw new Error(`${weapon.name}有效层数/人数必须为${min}–${max}整数。`);
    return n;
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
  const stat = (suffix: string, target: EquipmentStatModifier["target"], expression: FormulaExpression, inputs: EquipmentFormulaInput[]): void => {
    result.statModifiers.push({ id: `${weapon.id}:r${args.refinement}:${suffix}`, label: `${weapon.name}·${suffix}`, target, phase: "pre-panel", expression, inputs, sourceRefs: refs });
  };
  const hit = (suffix: string, expression: FormulaExpression, inputs: EquipmentFormulaInput[], filters: Pick<EquipmentDynamicHitBonus, "attackTags" | "elements"> = {}): void => {
    result.dynamicHitBonuses.push({ id: `${weapon.id}:r${args.refinement}:${suffix}`, label: `${weapon.name}·${suffix}`, expression, inputs, sourceRefs: refs, inputPolicy: "pre-conversion", ...filters });
  };
  const stackInputs = (n: number, amount: number, unit = "ratio") => [stateInput("stackCount", n, "已确认的本击前有效层数或构成人数", "count"), sourceInput("perStack", amount, "每层来源数值", unit)];
  const windowInputs = (active: boolean, amount: number, unit = "ratio") => [stateInput("windowActive", Number(active), "已确认效果状态是否仍有效", "boolean"), sourceInput("windowAmount", amount, "来源窗口增益", unit)];
  const windowExpression = mul(v("windowActive"), v("windowAmount"));
  switch (weapon.slug) {
    case "ironsting":
    case "mappamare":
    case "serpentspine": {
      const n = count(weapon.slug === "serpentspine" ? 5 : 2);
      if (n !== undefined) hit("有效层数增伤", mul(v("stackCount"), v("perStack")), stackInputs(n, pct(0)), weapon.slug === "mappamare" ? { elements: [...elemental] } : {});
      if (weapon.slug === "serpentspine") result.effectBlockers.push(`螭骨剑每层${rank.values[1]}受到伤害提高及受击减层/护盾交互未执行；已有层数退场不清除，不能据输出数值宣称生存或自动叠层完成。`);
      break;
    }
    case "lithicblade":
    case "lithicspear": {
      const n = count(4);
      if (n !== undefined) {
        stat("璃月人数攻击", "atkPercent", mul(v("stackCount"), v("perStack")), stackInputs(n, pct(0)));
        stat("璃月人数暴击", "critRate", mul(v("stackCount"), v("perStack")), stackInputs(n, pct(1)));
      }
      result.assumptions.push("千岩人数是队伍内已确认的璃月角色总数，包括符合条件的装备者；不从姓名猜籍贯，也不要求独立计算器先建立完整队伍。"); break;
    }
    case "prototyperancour":
    case "whiteblind":
    case "skyridergreatsword": {
      const n = count(4);
      if (n !== undefined) {
        stat("命中叠层攻击", "atkPercent", mul(v("stackCount"), v("perStack")), stackInputs(n, pct(0)));
        if (weapon.slug !== "skyridergreatsword") stat("命中叠层防御", "defPercent", mul(v("stackCount"), v("perStack")), stackInputs(n, pct(0)));
      }
      result.assumptions.push("普攻/重击触发的新层在本次伤害结算之后获得；输入只含本击前已有层数，不能倒灌新层。"); break;
    }
    case "darkironsword":
    case "emeraldorb":
    case "windblumeode":
    case "tidalshadow":
    case "fluteofezpitzal":
    case "footprintoftherainbow":
    case "oathsworneye": {
      const active = need("weaponEffectActive");
      const target = ["fluteofezpitzal", "footprintoftherainbow"].includes(weapon.slug) ? "defPercent" : weapon.slug === "oathsworneye" ? "energyRechargeBonus" : "atkPercent";
      if (active !== undefined) stat("明确窗口属性", target, windowExpression, windowInputs(active, pct(0)));
      if (weapon.slug === "darkironsword") result.effectBlockers.push("暗铁剑当前文案包含星超导触发，固定gcsim没有该事件订阅；这里只恢复已确认有效的攻击窗口，不证明星超导能自动触发。");
      break;
    }
    case "mailedflower":
    case "missivewindspear": {
      const active = need("weaponEffectActive");
      if (active !== undefined) {
        stat("窗口攻击", "atkPercent", windowExpression, windowInputs(active, pct(0)));
        stat("窗口精通", "em", windowExpression, windowInputs(active, whole(1), "EM"));
      }
      result.assumptions.push("来源要求触发时装备者前台；已合法获得的窗口不因随后退场立即删除。"); break;
    }
    case "songofstillness":
    case "earthshaker":
    case "toukaboushigure": {
      const active = need("weaponEffectActive");
      if (active !== undefined) hit("明确窗口增伤", windowExpression, windowInputs(active, pct(0)), weapon.slug === "earthshaker" ? { attackTags: ["skill"] } : {});
      if (weapon.slug === "toukaboushigure") result.assumptions.push("纸伞作祟属于当前目标，不能将一个敌人的10秒状态复制给全部目标；15秒触发冷却和击败目标清冷却未自动执行。");
      break;
    }
    case "magicguide": {
      const auras = need("enemyAuras");
      if (auras === undefined) break;
      const eligible = auras.includes("hydro") || auras.includes("electro");
      if (!eligible) {
        const frozen = need("targetFrozen");
        if (frozen === undefined) break;
        if (frozen || auras.includes("cryo")) { block("魔导绪论冰附着/冻结分支来源冲突：目录只列水/雷，固定gcsim还包含Cryo；该分支未执行，需游戏内核验。"); break; }
      }
      hit("水雷目标增伤", mul(v("auraEligible"), v("auraBonus")), [stateInput("auraEligible", Number(eligible), "当前目标水或雷附着是否满足", "boolean"), sourceInput("auraBonus", pct(0), "来源附着条件增伤")]); break;
    }
    case "balladoftheboundlessblue": {
      const n = count(3);
      if (n !== undefined) for (const [tag, index] of [["normal", 0], ["charged", 1]] as const) hit(`${tag}叠层增伤`, mul(v("stackCount"), v("perStack")), stackInputs(n, pct(index)), { attackTags: [tag] });
      result.effectBlockers.push("无垠蔚蓝固定源码在过滤攻击标签之前增加内部层数，触发状态机存在顺序问题；这里只接受已确认由普攻/重击合法产生的层数。源码旧注释R3重击8%与执行及目录9%不一致，采用后两者一致的数值。"); break;
    }
    case "aquasimulacra": {
      stat("常驻生命", "hpPercent", v("hpBonus"), [sourceInput("hpBonus", pct(0), "生命百分比")]);
      const active = need("weaponEffectActive");
      if (active !== undefined) hit("近敌有效增伤", windowExpression, windowInputs(active, pct(1)));
      result.assumptions.push("若水状态按已生效增益输入，非瞬时距离；源码每30帧扫描8单位范围并保留72帧。前台或后台均可享受，不从当前位置自行推断。"); break;
    }
    case "lostprayertothesacredwinds": {
      const offField = need("offField");
      if (offField === true) hit("退场清除元素层数", c(0), [], { elements: [...elemental] });
      else if (offField === false) {
        const n = count(4);
        if (n !== undefined) hit("在场元素层数", mul(v("stackCount"), v("perStack")), stackInputs(n, pct(0)), { elements: [...elemental] });
      }
      result.assumptions.push("四风offField与层数是本击所用属性的取样时状态。可快照技能退场后命中时应恢复其施放/快照时的前台层数，不能用命中时后台状态清除历史快照；自动历史快照调度未在本模块执行。");
      result.effectBlockers.push("四风10%移速及每4秒增层的时序未执行；固定源码240帧全局循环相位不随换入重启，不把该实现当作完整计时验证。元素增伤明确排除物理。"); break;
    }
    case "polarstar": {
      hit("常驻技能增伤", v("skillBonus"), [sourceInput("skillBonus", pct(0), "战技/爆发增伤")], { attackTags: ["skill", "burst"] });
      const n = count(4);
      if (n !== undefined) {
        const text = rank.values[1]!;
        if (!/^\d+(?:\.\d+)?\/\d+(?:\.\d+)?\/\d+(?:\.\d+)?\/\d+(?:\.\d+)?%$/.test(text)) throw new Error("冬极四档攻击曲线格式与固定来源不一致。");
        const curve = text.slice(0, -1).split("/").map(value => Number(value) / 100);
        const expression = choose("equal", v("stackCount"), c(0), c(0), choose("equal", v("stackCount"), c(1), v("oneStack"), choose("equal", v("stackCount"), c(2), v("twoStacks"), choose("equal", v("stackCount"), c(3), v("threeStacks"), v("fourStacks")))));
        stat("独立类别攻击曲线", "atkPercent", expression, [stateInput("stackCount", n, "本击前仍有效的不同攻击类别数", "count"), ...curve.map((amount, index) => sourceInput(["oneStack", "twoStacks", "threeStacks", "fourStacks"][index]!, amount, `${index + 1}类来源攻击加成`))]);
      }
      result.assumptions.push("冬极层数为普攻/重击/战技/爆发四类各自12秒状态数；同类多次命中只刷新，不增加类别数。源要求触发时前台，已有层数随后退场可保留。"); break;
    }
    case "solarpearl": {
      const normal = need("normalHitEffectActive"), skillBurst = need("skillBurstHitEffectActive");
      if (normal !== undefined) hit("普攻触发技能窗口", windowExpression, windowInputs(normal, pct(0)), { attackTags: ["skill", "burst"] });
      if (skillBurst !== undefined) hit("技能触发普攻窗口", windowExpression, windowInputs(skillBurst, pct(1)), { attackTags: ["normal"] });
      result.assumptions.push("匣里日月两个6秒窗口独立恢复；重击不受益。固定源码要求触发命中时装备者在前台，不因当前仍在前台就假设窗口已触发。"); break;
    }
    case "wavebreakersfin":
    case "mouunsmoon":
    case "akuoumaru": {
      const total = need("teamBurstEnergyTotal");
      if (total !== undefined) hit("队伍能量上限爆发增伤", { kind: "min", terms: [v("burstCap"), mul(v("teamEnergyMaxTotal"), v("bonusPerEnergy"))] }, [stateInput("teamEnergyMaxTotal", total, "全队元素能量上限总和，非当前能量", "energy"), sourceInput("bonusPerEnergy", pct(0), "每点能量上限的爆发增伤", "ratio/energy"), sourceInput("burstCap", pct(1), "爆发增伤上限")], { attackTags: ["burst"] });
      result.assumptions.push("只使用明确的全队能量上限总和，不估计缺失队员、不推断当前能量；该增伤不恢复能量，也不证明循环充能够用。"); break;
    }
    case "deathmatch": {
      const n = need("nearbyEnemyCount");
      if (n !== undefined) {
        const inputs = [stateInput("appliedEnemyCount", n, "当前已生效分支的已确认敌人数采样", "count"), sourceInput("fewEnemyAtk", pct(2), "少于2名敌人的攻击加成"), sourceInput("manyEnemyAtk", pct(0), "至少2名敌人的攻击加成"), sourceInput("manyEnemyDef", pct(1), "至少2名敌人的防御加成")];
        stat("敌人数分支攻击", "atkPercent", choose("lt", v("appliedEnemyCount"), c(2), v("fewEnemyAtk"), v("manyEnemyAtk")), inputs);
        stat("敌人数分支防御", "defPercent", choose("lt", v("appliedEnemyCount"), c(2), c(0), v("manyEnemyDef")), inputs);
      }
      result.assumptions.push("决斗读取当前已生效分支对应的敌人数采样。固定源码前台每60帧检查8单位范围，再延迟48帧且仅仍在前台时应用；不能把瞬时敌人数直接推断为该状态，离场保留分支也未自动模拟。"); break;
    }
    case "harangeppakufutsu": {
      hit("常驻全元素增伤", v("elementalBonus"), [sourceInput("elementalBonus", pct(0), "常驻元素伤害加成")], { elements: [...elemental] });
      const n = count(2);
      if (n !== undefined) hit("波乱有效普攻层数", mul(v("stackCount"), v("perStack")), stackInputs(n, pct(1)), { attackTags: ["normal"] });
      result.assumptions.push("波乱输入是已消耗波穗后、8秒增伤窗口仍有效的层数；待消耗波穗不能直接增伤。队友施放战技收集、0.3秒间隔、消耗和到期未自动执行。"); break;
    }
    case "urakumisugiri": {
      stat("常驻防御", "defPercent", v("defBonus"), [sourceInput("defBonus", pct(2), "常驻防御加成")]);
      const active = need("weaponEffectActive");
      if (active !== undefined) for (const [tag, index] of [["normal", 0], ["skill", 1]] as const) hit(`${tag}岩伤窗口增伤`, mul(v("baseBonus"), add(c(1), v("geoWindowActive"))), [sourceInput("baseBonus", pct(index), "基础对应攻击增伤"), stateInput("geoWindowActive", Number(active), "合法前台岩伤触发的15秒加倍窗口", "boolean")], { attackTags: [tag] });
      result.effectBlockers.push("有乐目录要求前台角色造成岩伤，固定gcsim触发订阅未检查前台；这里只恢复已确认合法的窗口，不采纳其过宽自动触发范围。"); break;
    }
    case "thefirstgreatmagic": {
      hit("常驻重击增伤", v("chargedBonus"), [sourceInput("chargedBonus", pct(0), "常驻重击增伤")], { attackTags: ["charged"] });
      const n = count(4, 1);
      if (n !== undefined) stat("同元素人数攻击", "atkPercent", mul({ kind: "min", terms: [v("sameElementCount"), c(3)] }, v("perMember")), [stateInput("sameElementCount", n, "队伍同元素人数，包括装备者自己", "count"), sourceInput("perMember", pct(0), "每位同元素成员攻击加成，三人封顶")]);
      result.effectBlockers.push("最初的大魔术异元素成员对应的移动速度条款未执行；当前只计算已确认同元素人数的攻击与常驻重击增伤。"); break;
    }
  }
  return result;
}
