import type { FormulaExpression } from "../../sim-core/src/calculation-trace";
import { requireEquipmentArtifactSet, type EquipmentDataset } from "./equipment-dataset";
import { equipmentDescriptionSource } from "./equipment-source";
import type { EquipmentFormulaContext, EquipmentFormulaInput, EquipmentFormulaResolution, EquipmentStatModifier, EquipmentDynamicHitBonus } from "./equipment-formulas";
import type { EquipmentEffectElement } from "./equipment-effects";
import { getArtifactAdditionalControls } from "./artifact-additional-effects";
import { getArtifactRemainingControls } from "./artifact-remaining-effects";

export interface ArtifactConditionalContext extends EquipmentFormulaContext {
  setEffectActive?: boolean;
  targetFrozen?: boolean;
  vvPyroResActive?: boolean;
  vvHydroResActive?: boolean;
  vvCryoResActive?: boolean;
  vvElectroResActive?: boolean;
  sameElementTeammates?: number;
  differentElementTeammates?: number;
  setExtraEffectActive?: boolean;
  setNormalEffectActive?: boolean;
  setBurstEffectActive?: boolean;
  witchLessonsCompleted?: boolean;
  moonsignLevel?: number;
  setBuffElements?: Exclude<EquipmentEffectElement, "physical">[];
  setExtraBuffElements?: Exclude<EquipmentEffectElement, "physical">[];
  echoesRiteActive?: boolean;
  echoesCurrentAttack?: number;
  songWavesActive?: boolean;
  songRecordedHealing?: number;
  songRemainingTriggers?: number;
  targetSuperconductDebuffActive?: boolean;
  paradiseLostStacks?: number;
}
export interface ArtifactConditionalControl { key: keyof ArtifactConditionalContext; label: string; kind: "number" | "boolean" | "elements"; min?: number; max?: number }
export const SUPPORTED_ARTIFACT_CONDITIONAL_IDS = ["artifact-set:15006", "artifact-set:14001", "artifact-set:15031", "artifact-set:15032", "artifact-set:15029", "artifact-set:15016", "artifact-set:15019", "artifact-set:15023", "artifact-set:15030", "artifact-set:15018"] as const;
export const hasArtifactConditionalRule = (id: string): boolean => (SUPPORTED_ARTIFACT_CONDITIONAL_IDS as readonly string[]).includes(id);
export function getArtifactConditionalControls(pieceCounts: Readonly<Record<string, number>>, dataset?: EquipmentDataset): ArtifactConditionalControl[] {
  const controls: ArtifactConditionalControl[] = [];
  if ((pieceCounts["artifact-set:15038"] ?? 0) >= 2) controls.push({ key: "nightsoulFrontlineActive", label: "黑曜装备者当前处于夜魂加持且在前台", kind: "boolean" });
  const stack = (label: string, max: number) => controls.push({ key: "setStacks", label, kind: "number", min: 0, max });
  const active = (label: string) => controls.push({ key: "setEffectActive", label, kind: "boolean" });
  for (const [id, pieces] of Object.entries(pieceCounts)) if (pieces >= 4) switch (id) {
    case "artifact-set:15002":
      controls.push(...([ ["vvPyroResActive", "火"], ["vvHydroResActive", "水"], ["vvCryoResActive", "冰"], ["vvElectroResActive", "雷"] ] as const).map(([key, element]) => ({ key, label: `当前目标由普通扩散触发的翠绿${element}减抗仍有效`, kind: "boolean" as const })));
      break;
    case "artifact-set:15025": active("当前目标深林8秒草减抗仍有效"); break;
    case "artifact-set:15006": stack("魔女命中前有效战技触发层数", 3); break;
    case "artifact-set:14001": controls.push({ key: "targetFrozen", label: "命中前目标处于冻结状态", kind: "boolean" }); break;
    case "artifact-set:15031": stack("逐影命中前有效生命变化层数", 3); break;
    case "artifact-set:15032": active("剧团额外25%技能增伤仍有效（后台或登场未满2秒）"); break;
    case "artifact-set:15029": stack("水仙命中前有效的不同攻击类别数（3代表3种及以上）", 3); break;
    case "artifact-set:15016": active("沉沦战技后15秒普攻/重击增伤仍有效"); break;
    case "artifact-set:15019": active("追忆已合法触发，10秒普攻/重击/下落增伤仍有效"); break;
    case "artifact-set:15023": active("辰砂潜光仍有效（爆发后16秒且未退场）"); stack("辰砂潜光内有效失血层数", 4); break;
    case "artifact-set:15030": stack("花海命中前仍有效的外部受伤层数", 5); break;
    case "artifact-set:15018": stack("苍白命中前有效战技命中层数", 2); break;
  }
  return [...controls, ...getArtifactAdditionalControls(pieceCounts, dataset), ...getArtifactRemainingControls(pieceCounts)];
}

const gcsimRoot = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/";
const rules: Record<string, { path: string; description: string }> = {
  crimsonwitchofflames: { path: "internal/artifacts/crimson/crimson.go", description: "超载、燃烧、烈绽放反应造成的伤害提升40%，蒸发、融化反应的加成系数提高15%。施放元素战技后的10秒内，2件套的效果提高50%，该效果最多叠加3次。" },
  blizzardstrayer: { path: "internal/artifacts/blizzard/blizzard.go", description: "攻击处于冰元素影响下的敌人时，暴击率提高20%；若敌人处于冻结状态下，则暴击率额外提高20%。" },
  marechausseehunter: { path: "internal/artifacts/marechausseehunter/marechausseehunter.go", description: "当前生命值提升或降低时，暴击率提升12%，该效果持续5秒，至多叠加3次。" },
  goldentroupe: { path: "internal/artifacts/goldentroupe/goldentroupe.go", description: "元素战技造成的伤害提升25%；此外，处于队伍后台时，元素战技造成的伤害还将进一步提升25%，该效果将在登场后2秒移除。" },
  nymphsdream: { path: "internal/artifacts/nymphsdream/nymphsdream.go", description: "普通攻击、重击、下落攻击、元素战技或元素爆发命中敌人后，将产生1层持续8秒的「镜中水仙」效果。处于1/2/3层及以上「镜中水仙」效果下时，攻击力将提高7%/16%/25%，水元素伤害加成提升4%/9%/15%。由普通攻击、重击、下落攻击、元素战技或元素爆发产生的「镜中水仙」将分别独立存在。" },
  heartofdepth: { path: "internal/artifacts/heartofdepth/heartofdepth.go", description: "施放元素战技后的15秒内，普通攻击与重击造成的伤害提高30%。" },
  shimenawasreminiscence: { path: "internal/artifacts/reminiscence/reminiscence.go", description: "施放元素战技时，如果角色的元素能量高于或等于15点，则会流失15点元素能量，使接下来的10秒内，普通攻击、重击、下落攻击造成的伤害提高50%，持续期间内该效果不会再次触发。" },
  vermillionhereafter: { path: "internal/artifacts/vermillion/vermillion.go", description: "施放元素爆发后，将产生持续16秒的「潜光」效果：攻击力提升8%；并在角色的生命值降低时，攻击力进一步提升10%，至多通过这种方式提升4次，每0.8秒至多触发一次。「潜光」效果将在角色退场时消失；持续期间再次施放元素爆发，将移除原有的「潜光」。" },
  vourukashasglow: { path: "internal/artifacts/vourukashasglow/vourukashasglow.go", description: "元素战技与元素爆发造成的伤害提升10%；装备者受到伤害后的5秒内，上述伤害提升效果提高80%，该提高效果至多叠加5层，每层持续时间独立计算，处于队伍后台时依然能触发该效果。" },
  paleflame: { path: "internal/artifacts/paleflame/paleflame.go", description: "元素战技命中敌人后，攻击力提升9%。该效果持续7秒，至多叠加2层，每0.3秒至多触发一次。叠满2层时，2件套的效果提升100%。" }
};
/** Immutable source bytes are preserved under /tmp/gidps-artifact-conditional-sources. */
export const artifactConditionalSourceEvidence = [
  ["internal/artifacts/crimson/crimson.go", "22ddd500ba3c8d7a6dc702e0bc8881978a61f9d1f28ff0ee16a2d8d4d464ebe2"],
  ["internal/artifacts/blizzard/blizzard.go", "9d1751bc0194f4726d2ac4c3d869c5944d25e0e9378804e5f80a33d899978212"],
  ["internal/artifacts/marechausseehunter/marechausseehunter.go", "a5fe706eb04a1ba854cd1a4fd531625d2708aabf666edde79429716842bc4049"],
  ["internal/artifacts/goldentroupe/goldentroupe.go", "656d316251bc80080574eaeb2473791c8cc731c9adac7f39ef149b6264cb736b"],
  ["internal/artifacts/nymphsdream/nymphsdream.go", "c7635bf09e8c84e9f0ce0e714bf3498d4dc3061f81dd664a8daf6fa44255d7b4"],
  ["internal/artifacts/heartofdepth/heartofdepth.go", "6dedfbd4601e9756793c77dcce938e9e74a999bed39ea10448699045318bfaf4"],
  ["internal/artifacts/reminiscence/reminiscence.go", "c84c62d0919c4a8cd6847ddcaf4ba216593d38dde393dc081eb387cc1b5dc3f5"],
  ["internal/artifacts/vermillion/vermillion.go", "ef1a81a53baa156fd13ef1dc338d312d25bbefe43480db47c1e63ad781646950"],
  ["internal/artifacts/vourukashasglow/vourukashasglow.go", "5a7b510c8f3e35d25e32cc603510f2389e926f906a06ed53c33203e0a3fdbc05"],
  ["internal/artifacts/paleflame/paleflame.go", "d7c0ee52636a40a793af8eabf287003f21769e43510efc981852ce0dd1bd4c3e"]
].map(([path, sha256]) => ({ path: path!, url: gcsimRoot + path!, sha256: sha256! }));
const c = (value: number): FormulaExpression => ({ kind: "constant", value });
const v = (key: string): FormulaExpression => ({ kind: "variable", key });
const mul = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "multiply", terms });
const add = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "add", terms });
const choose = (left: FormulaExpression, right: FormulaExpression, whenTrue: FormulaExpression, whenFalse: FormulaExpression): FormulaExpression => ({ kind: "condition", operator: "equal", left, right, whenTrue, whenFalse });
const input = (key: string, value: number, meaningKey: string, unit = "ratio"): EquipmentFormulaInput => ({ key, value, meaningKey, unit, origin: "artifact-explicit-context" });

/** Four-piece additions only: existing two-piece terms must be applied once by the caller. */
export function resolveArtifactConditionalEffects(args: { setId: string; pieces: number; enabled: boolean; context?: ArtifactConditionalContext; dataset?: EquipmentDataset }): EquipmentFormulaResolution {
  const result: EquipmentFormulaResolution = { statModifiers: [], dynamicHitBonuses: [], assumptions: [], effectBlockers: [], missingConditions: [], sourceRefs: [], verification: "provisional" };
  const set = requireEquipmentArtifactSet(args.setId, args.dataset);
  if (!Number.isInteger(args.pieces) || args.pieces < 0 || args.pieces > 5) throw new Error("套装件数必须为0–5整数。");
  if (!args.enabled || args.pieces < 4) return result;
  const rule = rules[set.slug];
  if (!rule) { result.effectBlockers.push(`${set.name}没有已登记的四件套条件公式。`); return result; }
  if (set.pieceEffects.find(effect => effect.pieces === 4)?.description !== rule.description) throw new Error(`${set.name}四件套来源文本已变更，必须重新核验规则。`);
  const context = args.context ?? {};
  for (const key of ["setEffectActive", "targetFrozen"] as const) if (context[key] !== undefined && typeof context[key] !== "boolean") throw new Error(`${key}必须为显式布尔值。`);
  if (context.enemyAuras?.some(element => !["pyro", "hydro", "cryo", "electro", "anemo", "geo", "dendro"].includes(element))) throw new Error("敌人附着类型无效，物理不是元素附着。");
  const refs = [equipmentDescriptionSource("artifacts", set.slug, args.dataset), gcsimRoot + rule.path];
  result.sourceRefs.push(...refs);
  result.assumptions.push(`${set.name}：四件套只恢复命中前显式状态；层数与窗口未通过事件模拟生成，二件套另行且只计一次。`);
  const missing = (key: string): void => {
    const reason = `${set.name}缺少显式 ${key}，不能把未知状态当作零层或已触发。`;
    result.effectBlockers.push(reason);
    // These clauses change only matching ordinary DMG Bonus, never the panel.
    const filters: Record<string, Pick<EquipmentDynamicHitBonus, "elements" | "attackTags">> = {
      crimsonwitchofflames: { elements: ["pyro"] },
      goldentroupe: { attackTags: ["skill"] },
      heartofdepth: { attackTags: ["normal", "charged"] },
      shimenawasreminiscence: { attackTags: ["normal", "charged", "plunge"] },
      vourukashasglow: { attackTags: ["skill", "burst"] }
    };
    const filter = filters[set.slug];
    if (filter) (result.pendingHitEffects ??= []).push({ id: `${set.id}:4pc:pending:${key}`, label: set.name, reason, sourceRefs: refs, kind: "damageBonus", ...filter });
    else result.missingConditions.push(reason);
  };
  const count = (max: number): number | undefined => {
    const n = context.setStacks;
    if (n === undefined) { missing("setStacks"); return undefined; }
    if (!Number.isInteger(n) || n < 0 || n > max) throw new Error(`${set.name}有效层数必须为0–${max}整数。`);
    return n;
  };
  const active = (): boolean | undefined => {
    if (context.setEffectActive === undefined) missing("setEffectActive");
    return context.setEffectActive;
  };
  const stat = (suffix: string, target: EquipmentStatModifier["target"], expression: FormulaExpression, inputs: EquipmentFormulaInput[]): void => {
    result.statModifiers.push({ id: `${set.id}:4pc:${suffix}`, label: `${set.name}·${suffix}`, target, phase: "pre-panel", expression, inputs, sourceRefs: refs });
  };
  const hit = (suffix: string, expression: FormulaExpression, inputs: EquipmentFormulaInput[], filters: Pick<EquipmentDynamicHitBonus, "elements" | "attackTags">): void => {
    result.dynamicHitBonuses.push({ id: `${set.id}:4pc:${suffix}`, label: `${set.name}·${suffix}`, expression, inputs, sourceRefs: refs, inputPolicy: "pre-conversion", ...filters });
  };
  const stackInputs = (n: number, ratio: number, meaning: string) => [input("stacks", n, "命中前仍有效层数", "count"), input("perStack", ratio, meaning)];
  switch (set.slug) {
    case "crimsonwitchofflames": {
      const n = count(3);
      if (n !== undefined) hit("战技叠层火伤", mul(v("stacks"), v("twoPiecePyro"), v("perStackIncrease")), [input("stacks", n, "命中前有效战技触发层数", "count"), input("twoPiecePyro", 0.15, "二件套原始火伤加成"), input("perStackIncrease", 0.5, "每层提高二件套效果的比例")], { elements: ["pyro"] });
      result.assumptions.push("魔女反应系数由独立反应条款模块执行，火伤层数不替代或重复叠加反应系数。");
      break;
    }
    case "blizzardstrayer": {
      result.assumptions.push("冰风暴击仅是当前明确目标状态的条件暴击率，不是角色常驻面板；目标或附着变化必须重新恢复配装快照。不支持不同目标状态的自动切换，特殊月反应目标钩子未纳入核验。");
      if (context.targetFrozen === undefined) { missing("targetFrozen"); break; }
      if (context.targetFrozen) {
        stat("冻结目标暴击", "critRate", mul(v("frozen"), v("frozenCrit")), [input("frozen", 1, "命中前目标确实冻结", "boolean"), input("frozenCrit", 0.4, "冻结分支总暴击加成")]);
        result.assumptions.push("固定源码优先判定冻结，直接给予40%暴击；此分支不要求另有独立冰附着，也不限伤害元素。");
      } else if (context.enemyAuras === undefined) missing("enemyAuras（未冻结时需明确冰附着状态）");
      else stat("未冻结冰附着暴击", "critRate", mul(v("cryoAffected"), v("cryoCrit")), [input("cryoAffected", Number(context.enemyAuras.includes("cryo")), "未冻结目标是否带冰附着", "boolean"), input("cryoCrit", 0.2, "冰附着暴击加成")]);
      break;
    }
    case "marechausseehunter": {
      const n = count(3);
      if (n !== undefined) stat("生命变化暴击", "critRate", mul(v("stacks"), v("perStack")), stackInputs(n, 0.12, "每层暴击率"));
      result.assumptions.push("逐影只接受已确认有效的层数，不宣称覆盖受击/溢出治疗/前后台的所有自动触发时序。"); break;
    }
    case "goldentroupe": {
      hit("四件套常驻战技增伤", v("baseBonus"), [input("baseBonus", 0.25, "四件套常驻战技增伤")], { attackTags: ["skill"] });
      const value = active();
      if (value !== undefined) hit("后台窗口额外战技增伤", mul(v("windowActive"), v("extraBonus")), [input("windowActive", Number(value), "后台/登场2秒窗口是否仍有效", "boolean"), input("extraBonus", 0.25, "额外战技增伤")], { attackTags: ["skill"] });
      result.assumptions.push("黄金二件套20%由基础套装模块计入；本模块只添加四件套25%及条件25%，合计应为45%或70%。"); break;
    }
    case "nymphsdream": {
      const n = count(3);
      if (n !== undefined) {
        const curve = (a: number, b: number, d: number): FormulaExpression => choose(v("stacks"), c(0), c(0), choose(v("stacks"), c(1), c(a), choose(v("stacks"), c(2), c(b), c(d))));
        const inputs = [input("stacks", n, "仍有效的不同攻击类别数，3表示3种及以上", "count")];
        stat("镜中水仙攻击", "atkPercent", curve(0.07, 0.16, 0.25), inputs);
        hit("镜中水仙水伤", curve(0.04, 0.09, 0.15), inputs, { elements: ["hydro"] });
      }
      result.assumptions.push("水仙按普攻/重击/下落/战技/爆发五类各自8秒状态计数；同类多段不重复加层，输入3代表至少三类同时有效。"); break;
    }
    case "heartofdepth":
    case "shimenawasreminiscence": {
      const value = active(), shimenawa = set.slug === "shimenawasreminiscence";
      if (value !== undefined) hit("触发窗口攻击增伤", mul(v("windowActive"), v("damageBonus")), [input("windowActive", Number(value), "对应触发增益窗口是否仍有效", "boolean"), input("damageBonus", shimenawa ? 0.5 : 0.3, "窗口内攻击增伤")], { attackTags: shimenawa ? ["normal", "charged", "plunge"] : ["normal", "charged"] });
      if (shimenawa) result.effectBlockers.push("追忆这里只恢复已合法触发的伤害窗口；15点能量门槛、约10帧后扣能和持续期间禁止再触发的事件调度未执行，不据此证明循环能量可行。");
      break;
    }
    case "vermillionhereafter": {
      const value = active();
      if (value === false) stat("潜光未生效", "atkPercent", c(0), []);
      else if (value) {
        const n = count(4);
        if (n !== undefined) stat("潜光攻击", "atkPercent", add(v("baseAtkBonus"), mul(v("stacks"), v("perStack"))), [input("baseAtkBonus", 0.08, "潜光常驻攻击百分比"), ...stackInputs(n, 0.1, "每层失血攻击百分比")]);
      }
      result.assumptions.push("辰砂setEffectActive已包含16秒窗口且未退场条件；再次爆发重置、失血间隔与退场清除未自动模拟。"); break;
    }
    case "vourukashasglow": {
      const n = count(5);
      if (n !== undefined) hit("外部受伤叠层技能增伤", mul(v("baseBonus"), add(c(1), mul(v("stacks"), v("relativeIncrease")))), [input("baseBonus", 0.1, "四件套初始战技与爆发增伤"), input("stacks", n, "当前仍有效的外部受伤层数", "count"), input("relativeIncrease", 0.8, "每层相对初始增伤的提高比例")], { attackTags: ["skill", "burst"] });
      result.assumptions.push("花海每层单独持续5秒，触发要求外部伤害；主动生命消耗不是受伤层。本模块恢复有效层数，最高总增伤50%，不是410%。"); break;
    }
    case "paleflame": {
      const n = count(2);
      if (n !== undefined) {
        stat("战技命中叠层攻击", "atkPercent", mul(v("stacks"), v("perStack")), stackInputs(n, 0.09, "每层攻击百分比"));
        hit("满层额外物伤", choose(v("stacks"), c(2), v("extraPhysical"), c(0)), [input("stacks", n, "命中前有效战技层数", "count"), input("extraPhysical", 0.25, "满层额外物理伤害加成")], { elements: ["physical"] });
      }
      result.assumptions.push("苍白二件套25%另行计入；满两层四件套只额外加25%，最终物伤为50%。"); break;
    }
  }
  return result;
}
