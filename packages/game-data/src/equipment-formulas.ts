import type { EquipmentPendingHitEffect } from "./weapon-hit-effect-types";
import type { FormulaExpression } from "../../sim-core/src/calculation-trace";
import { equipmentCatalog, requireEquipmentArtifactSet, type EquipmentDataset } from "./equipment-dataset";
import { equipmentDescriptionSource } from "./equipment-source";
import type { EquipmentEffectContext, EquipmentEffectElement, EquipmentEffectAttackTag, EquipmentEffectWeaponType } from "./equipment-effects";
import { getWeaponConditionalControls } from "./weapon-conditional-effects";
import { getWeaponAdditionalControls } from "./weapon-additional-effects";
import { getWeaponPolearmControls } from "./weapon-polearm-effects";
import { getWeaponRangedControls } from "./weapon-ranged-effects";
import { getWeaponExtendedControls } from "./weapon-extended-effects";
import { getWeaponMeleeHitControls } from "./weapon-melee-hit-effects";
import { getWeaponRangedHitControls } from "./weapon-ranged-hit-effects";
import { getWeaponConditionedExpansionControls } from "./weapon-conditioned-expansion";

export interface EquipmentFormulaContext extends EquipmentEffectContext {
  weaponStacks?: number;
  setStacks?: number;
  shielded?: boolean;
  offField?: boolean;
  burstEffectActive?: boolean;
  timedEffectActive?: boolean;
  keyTeamBuffActive?: boolean;
  timedSnapshotEm?: number;
  keySnapshotHp?: number;
  keyTeamSnapshotHp?: number;
  weaponEffectActive?: boolean;
  energyFull?: boolean;
  arrowTravelSeconds?: number;
  normalHitEffectActive?: boolean;
  skillBurstHitEffectActive?: boolean;
  teamBurstEnergyTotal?: number;
  nearbyEnemyCount?: number;
  targetFrozen?: boolean;
  targetIsSlime?: boolean;
  teamDistinctElementCount?: number;
  bondOfLifeRatio?: number;
  weakPointHit?: boolean;
  weaponState?: number;
  platformPassiveActive?: boolean;
  weaponNormalStacks?: number;
  weaponSkillStacks?: number;
  weaponBurstStacks?: number;
  secondaryWeaponStacks?: number;
  weaponExtraEffectActive?: boolean;
  energyZero?: boolean;
  nightsoulBlessingActive?: boolean;
  wearerEnergyMax?: number;
  weaponSnapshotDef?: number;
  clearedBondOfLife?: number;
  catalystSong?: number;
  catalystChargedWindowActive?: boolean;
  catalystSkillWindowActive?: boolean;
  catalystBurstWindowActive?: boolean;
  catalystReactionWindowActive?: boolean;
  catalystSecondaryWindowActive?: boolean;
  catalystLunarWindowActive?: boolean;
  catalystHexerei?: boolean;
  catalystClearedBondHp?: number;
  catalystSnapshotHp?: number;
  catalystSnapshotAtk?: number;
  catalystHydroCount?: number;
  catalystSameElementCount?: number;
  catalystDifferentElementCount?: number;
  witchLessonsCompleted?: boolean;
  moonsignLevel?: number;
  sameElementTeammates?: number;
  differentElementTeammates?: number;
}
export interface EquipmentFormulaInput { key: string; value: number; unit: string; meaningKey: string; origin: string }
export interface EquipmentStatModifier {
  id: string; label: string;
  target: "flatAtk" | "atkPercent" | "hpPercent" | "defPercent" | "em" | "critRate" | "critDamage" | "energyRechargeBonus";
  phase: "pre-panel" | "conversion";
  expression: FormulaExpression;
  inputs: EquipmentFormulaInput[];
  sourceRefs: string[];
}
export interface EquipmentDynamicHitBonus {
  id: string; label: string;
  elements?: EquipmentEffectElement[];
  attackTags?: EquipmentEffectAttackTag[];
  weaponTypes?: EquipmentEffectWeaponType[];
  expression: FormulaExpression;
  inputs: EquipmentFormulaInput[];
  sourceRefs: string[];
  inputPolicy?: "pre-conversion" | "final-panel";
}
export interface EquipmentFormulaResolution {
  pendingHitEffects?: EquipmentPendingHitEffect[];
  statModifiers: EquipmentStatModifier[];
  dynamicHitBonuses: EquipmentDynamicHitBonus[];
  assumptions: string[];
  effectBlockers: string[];
  missingConditions: string[];
  sourceRefs: string[];
  verification: "provisional";
}

export const SUPPORTED_WEAPON_FORMULA_IDS = ["weapon:13501", "weapon:11505", "weapon:13509", "weapon:13511", "weapon:11418", "weapon:12415", "weapon:12504", "weapon:14504", "weapon:13504", "weapon:13505", "weapon:13507", "weapon:11511"] as const;
export const SUPPORTED_ARTIFACT_FORMULA_IDS = ["artifact-set:15020", "artifact-set:15021"] as const;
export const hasWeaponFormulaRule = (id: string): boolean => (SUPPORTED_WEAPON_FORMULA_IDS as readonly string[]).includes(id);
export const hasArtifactFormulaRule = (id: string): boolean => (SUPPORTED_ARTIFACT_FORMULA_IDS as readonly string[]).includes(id);
export interface EquipmentFormulaControl { key: keyof EquipmentFormulaContext; label: string; kind: "number" | "boolean"; min?: number; max?: number }
const stacks = (max: number): EquipmentFormulaControl => ({ key: "weaponStacks", label: "命中前有效武器层数（未知请留空）", kind: "number", min: 0, max });
export function getEquipmentFormulaControls(input: { weaponId: string; setIds?: string[] }): EquipmentFormulaControl[] {
  const list: EquipmentFormulaControl[] = [];
  if (["weapon:13511", "weapon:11511"].includes(input.weaponId)) list.push(stacks(3));
  if (["weapon:12504", "weapon:14504", "weapon:13504"].includes(input.weaponId)) list.push(stacks(5), { key: "shielded", label: "命中时护盾有效", kind: "boolean" });
  if (input.weaponId === "weapon:13505") list.push(stacks(7));
  if (input.weaponId === "weapon:13507") list.push(stacks(6), { key: "offField", label: "命中时装备者位于后台", kind: "boolean" });
  if (input.weaponId === "weapon:13501") list.push({ key: "hpFraction", label: "当前生命比例（0–1）", kind: "number", min: 0, max: 1 });
  if (input.weaponId === "weapon:13509") list.push({ key: "burstEffectActive", label: "爆发后12秒充能效果有效", kind: "boolean" });
  if (["weapon:11418", "weapon:12415"].includes(input.weaponId)) list.push({ key: "timedEffectActive", label: "最近一次周期触发的12秒效果有效", kind: "boolean" }, { key: "timedSnapshotEm", label: "最近周期触发时的非转换元素精通", kind: "number", min: 0 });
  if (input.weaponId === "weapon:11511") list.push({ key: "keyTeamBuffActive", label: "圣显之钥团队精通效果有效（含自身）", kind: "boolean" }, { key: "keySnapshotHp", label: "圣显之钥自身层数最近触发时生命上限", kind: "number", min: 0 }, { key: "keyTeamSnapshotHp", label: "圣显之钥团队效果最近触发时生命上限", kind: "number", min: 0 });
  if (input.setIds?.includes("artifact-set:15021")) list.push({ key: "setStacks", label: "华馆问答当前有效层数", kind: "number", min: 0, max: 4 });
  const combined = [...list, ...getWeaponConditionalControls(input), ...getWeaponAdditionalControls(input), ...getWeaponPolearmControls(input), ...getWeaponRangedControls(input), ...getWeaponExtendedControls(input), ...getWeaponMeleeHitControls(input), ...getWeaponRangedHitControls(input), ...getWeaponConditionedExpansionControls(input)];
  return combined.filter((control, index) => combined.findIndex(other => other.key === control.key) === index);
}

const gcsimRoot = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/";
const sourcePaths: Record<string, string[]> = {
  staffofhoma: ["internal/weapons/spear/homa/homa.go"],
  primordialjadecutter: ["internal/weapons/sword/primordial/primordial.go"],
  engulfinglightning: ["internal/weapons/spear/engulfing/engulfing.go"],
  staffofthescarletsands: ["internal/weapons/spear/scarletsands/scarletsands.go"],
  xiphosmoonlight: ["internal/weapons/sword/xiphos/xiphos.go"],
  makhairaaquamarine: ["internal/weapons/claymore/aquamarine/aquamarine.go"],
  keyofkhajnisut: ["internal/weapons/sword/keyofkhajnisut/keyofkhajnisut.go"],
  theunforged: ["internal/weapons/claymore/unforged/unforged.go", "internal/weapons/common/goldenmajesty.go"],
  memoryofdust: ["internal/weapons/catalyst/memory/memory.go", "internal/weapons/common/goldenmajesty.go"],
  vortexvanquisher: ["internal/weapons/spear/vortex/vortex.go", "internal/weapons/common/goldenmajesty.go"],
  primordialjadewingedspear: ["internal/weapons/spear/primordial/primordial.go"],
  calamityqueller: ["internal/weapons/spear/calamity/calamity.go"],
  emblemofseveredfate: ["internal/artifacts/emblem/emblem.go"],
  huskofopulentdreams: ["internal/artifacts/huskofopulentdreams/huskofopulentdreams.go"]
};
/** Raw UTF-8 source hashes, fetched from the immutable gcsim commit above. */
export const equipmentFormulaSourceEvidence = [
  ["internal/weapons/spear/homa/homa.go", "0d282791e4d9cab6e2f02d94e1c1a203129ce53b44dcb3dbe2f7e7c8302d07c8"],
  ["internal/weapons/sword/primordial/primordial.go", "c989f446c2fa699865e17bfadbc277455423a1bab9df36d3d6e16eb07393c204"],
  ["internal/weapons/spear/engulfing/engulfing.go", "9da65e7f80b0c40f872248908e16b240d9ee17d3e9d550aeb6de9b254f793da3"],
  ["internal/weapons/spear/scarletsands/scarletsands.go", "358d2fc8808ebe77ae93f3a5566f12f87ac492348e71f304b66f96088107bbf1"],
  ["internal/weapons/sword/xiphos/xiphos.go", "5a96ee752269742b31c8fa4bf9b34a90d2c3225c6aaf31d4bd0bd4acf90ab200"],
  ["internal/weapons/claymore/aquamarine/aquamarine.go", "d369452b0ce1866ab259745f7e15ddb529b284578a674c73ed5c97a4a600c8aa"],
  ["internal/weapons/sword/keyofkhajnisut/keyofkhajnisut.go", "a58a03354004a56a9b6b2741f4c11bc0ef08f236964438f922f12cfe45d7d0fd"],
  ["internal/weapons/claymore/unforged/unforged.go", "c50851c75a574b5992a126e103f96b1bf9fb384e91fae5e87638c060847093f0"],
  ["internal/weapons/catalyst/memory/memory.go", "1d48300b93ee53d6ab7a3c9bb00f4aa351d0e320da09cbfa37ca8adc58acf6b4"],
  ["internal/weapons/spear/vortex/vortex.go", "e8b5247c9c669fb98c33c66eb2548e13a3a623bb2a5cb1ff12fac0b15d3dedb6"],
  ["internal/weapons/common/goldenmajesty.go", "6f39046147d9c5997bb49f90704e91831ce50d0b121a79377e55ee4033f08e93"],
  ["internal/weapons/spear/primordial/primordial.go", "d45955167faa04a88ddcbdeee9d0aa7a18c372441c3523f7b318167b846687ef"],
  ["internal/weapons/spear/calamity/calamity.go", "8094f30d8bda30495353bd88eba03dec1f598c65580a186457d85989819c5b39"],
  ["internal/artifacts/emblem/emblem.go", "4e34fc825109b6289cc95dca9c505c9cc38e7c3be15e5ba31942c02e98575d24"],
  ["internal/artifacts/huskofopulentdreams/huskofopulentdreams.go", "3f1f8e2c055e9481eeadf2ac9b392fcfaae5cf53da2cc7d66bee6f4161c0a6c4"],
  ["pkg/core/player/character/stats.go", "47e64b4cae4551b74f829160367c73577c4b2779d5b2344f47e638f34c61324c"],
  ["pkg/enemy/attack.go", "27eae5912f201eb509bded28ed204e62d880b30c909059bf68f52d1ffd1ed01b"]
].map(([path, sha256]) => ({ path: path!, url: gcsimRoot + path!, sha256: sha256! }));
const v = (key: string): FormulaExpression => ({ kind: "variable", key });
const c = (value: number): FormulaExpression => ({ kind: "constant", value });
const mul = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "multiply", terms });
const add = (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "add", terms });
const condition = (operator: "lt" | "equal", left: FormulaExpression, right: FormulaExpression, whenTrue: FormulaExpression, whenFalse: FormulaExpression): FormulaExpression => ({ kind: "condition", operator, left, right, whenTrue, whenFalse });
const input = (key: string, value: number, meaningKey: string, unit = "ratio"): EquipmentFormulaInput => ({ key, value, unit, meaningKey, origin: "equipment-explicit-context" });
const empty = (): EquipmentFormulaResolution => ({ statModifiers: [], dynamicHitBonuses: [], assumptions: [], effectBlockers: [], missingConditions: [], sourceRefs: [], verification: "provisional" });
const elements: EquipmentEffectElement[] = ["pyro", "hydro", "cryo", "electro", "anemo", "geo", "dendro"];

function validateContext(context: EquipmentFormulaContext): void {
  for (const key of ["hpFraction", "weaponStacks", "setStacks", "timedSnapshotEm", "keySnapshotHp", "keyTeamSnapshotHp"] as const) {
    const value = context[key];
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || (key === "hpFraction" && value > 1))) throw new Error(`${key} 必须为合法有限数值。`);
  }
  for (const key of ["shielded", "offField", "burstEffectActive", "timedEffectActive", "keyTeamBuffActive"] as const) if (context[key] !== undefined && typeof context[key] !== "boolean") throw new Error(`${key} 必须为显式布尔值。`);
}

/** Emits source expressions; panel arithmetic and evaluation remain in the shared core. */
export function resolveWeaponFormulaEffects(args: { weaponId: string; refinement: number; enabled: boolean; context?: EquipmentFormulaContext; dataset?: EquipmentDataset }): EquipmentFormulaResolution {
  const weapon = equipmentCatalog(args.dataset).weapons.find(entry => entry.id === args.weaponId);
  if (!weapon) throw new Error(`没有武器 ${args.weaponId} 的活动来源。`);
  const rank = weapon.refinements.find(entry => entry.rank === args.refinement);
  if (!rank) throw new Error(`${weapon.name}缺少精炼 ${args.refinement} 的来源记录。`);
  const result = empty();
  const context = args.context ?? {};
  validateContext(context);
  if (!args.enabled) { result.assumptions.push(`${weapon.name}转换与叠层效果明确停用。`); return result; }
  if (!(SUPPORTED_WEAPON_FORMULA_IDS as readonly string[]).includes(weapon.id)) { result.effectBlockers.push(`${weapon.name}没有已登记的转换或叠层公式。`); return result; }
  const refs = [equipmentDescriptionSource("weapons", weapon.slug, args.dataset), ...(sourcePaths[weapon.slug] ?? []).map(path => gcsimRoot + path), gcsimRoot + "pkg/core/player/character/stats.go", gcsimRoot + "pkg/enemy/attack.go"];
  result.sourceRefs.push(...refs);
  result.assumptions.push(`${weapon.name}：只计算显式命中瞬间状态；层数、触发窗口和周期快照由用户提供，不模拟生成或覆盖率。`);
  const prefix = `${weapon.id}:r${args.refinement}`;
  const pct = (index: number): number => {
    const value = rank.values[index];
    if (!value || !/^\d+(?:\.\d+)?%$/.test(value)) throw new Error(`${weapon.name}精炼字段 ${index} 缺少精确百分比。`);
    return Number(value.slice(0, -1)) / 100;
  };
  const expected = (text: string): void => { if (rank.description !== text) throw new Error(`${weapon.name}来源条款已变更，请重新核验公式映射。`); };
  const stat = (suffix: string, target: EquipmentStatModifier["target"], phase: EquipmentStatModifier["phase"], expression: FormulaExpression, inputs: EquipmentFormulaInput[] = []): void => {
    result.statModifiers.push({ id: `${prefix}:${suffix}`, label: `${weapon.name}·${suffix}`, target, phase, expression, inputs, sourceRefs: refs });
  };
  const hit = (suffix: string, expression: FormulaExpression, inputs: EquipmentFormulaInput[] = [], filters: Pick<EquipmentDynamicHitBonus, "elements" | "attackTags"> = {}): void => {
    result.dynamicHitBonuses.push({ id: `${prefix}:${suffix}`, label: `${weapon.name}·${suffix}`, expression, inputs, sourceRefs: refs, inputPolicy: "pre-conversion", ...filters });
  };
  const need = <K extends keyof EquipmentFormulaContext>(key: K): EquipmentFormulaContext[K] => {
    if (context[key] === undefined) {
      const reason = `${weapon.name}缺少显式 ${key}，相关条件公式未执行。`;
      result.effectBlockers.push(reason); result.missingConditions.push(reason);
    }
    return context[key];
  };
  const count = (max: number): number | undefined => {
    const value = need("weaponStacks");
    if (value !== undefined && (!Number.isInteger(value) || value > max)) throw new Error(`${weapon.name}有效层数必须为 0–${max} 的整数。`);
    return value;
  };
  const values = rank.values;
  switch (weapon.slug) {
    case "staffofhoma": {
      expected(`生命值提升${values[0]}。此外，基于装备该武器的角色生命值上限的${values[1]}，获得攻击力加成。当装备该武器的角色生命值低于50%时，进一步获得${values[2]}基于生命值上限的攻击力提升。`);
      stat("生命提升", "hpPercent", "pre-panel", v("hpGain"), [input("hpGain", pct(0), "生命百分比来源")]);
      stat("生命转攻击", "flatAtk", "conversion", mul(v("hp"), v("hpToAtk")), [input("hpToAtk", pct(1), "生命转攻击比例")]);
      const hp = need("hpFraction");
      if (hp === 0.5) {
        const reason = "护摩之杖恰好50%生命边界来源冲突：目录写 <，固定 gcsim 用 <=；额外攻击未执行，需游戏内验证。";
        result.effectBlockers.push(reason); result.missingConditions.push(reason);
      }
      else if (hp !== undefined) stat("低生命额外攻击", "flatAtk", "conversion", condition("lt", v("hpFraction"), c(0.5), mul(v("hp"), v("lowHpToAtk")), c(0)), [input("hpFraction", hp, "当前生命比例"), input("lowHpToAtk", pct(2), "低生命附加转换比例")]);
      break;
    }
    case "primordialjadecutter":
      expected(`生命值提升${values[0]}。此外，基于装备该武器的角色生命值上限的${values[1]}，获得攻击力加成。`);
      stat("生命提升", "hpPercent", "pre-panel", v("hpGain"), [input("hpGain", pct(0), "生命百分比来源")]);
      stat("生命转攻击", "flatAtk", "conversion", mul(v("hp"), v("hpToAtk")), [input("hpToAtk", pct(1), "生命转攻击比例")]); break;
    case "engulfinglightning": {
      expected(`攻击力获得提升，提升程度相当于元素充能效率超出100%部分的${values[0]}，至多通过这种方式提升${values[1]}。施放元素爆发后的12秒内，元素充能效率提升${values[2]}。`);
      const active = need("burstEffectActive");
      if (active !== undefined) stat("爆发后充能", "energyRechargeBonus", "pre-panel", mul(v("burstActive"), v("erGain")), [input("burstActive", Number(active), "爆发后12秒增益是否有效", "boolean"), input("erGain", pct(2), "爆发后充能增益")]);
      stat("额外充能转攻击", "atkPercent", "conversion", { kind: "min", terms: [v("atkCap"), mul(v("erToAtk"), { kind: "max", terms: [c(0), { kind: "subtract", left: v("erRatio"), right: c(1) }] })] }, [input("atkCap", pct(1), "攻击百分比上限"), input("erToAtk", pct(0), "额外充能转换比例")]);
      result.assumptions.push("薙草之稻光按非转换充能读取：包括自身已生效爆发充能，排除西福斯等由其他属性转换出的充能。"); break;
    }
    case "staffofthescarletsands": {
      expected(`基于装备者元素精通的${values[0]}，获得攻击力加成。元素战技命中敌人时，将产生持续10秒的「赤沙之梦」效果：基于装备者元素精通的${values[1]}，获得攻击力加成，该效果至多叠加3层。`);
      stat("精通基础转攻击", "flatAtk", "conversion", mul(v("em"), v("baseEmToAtk")), [input("baseEmToAtk", pct(0), "常驻精通转换比例")]);
      const n = count(3);
      if (n !== undefined) stat("赤沙之梦转攻击", "flatAtk", "conversion", mul(v("em"), v("stacks"), v("stackEmToAtk")), [input("stacks", n, "当前有效赤沙之梦层数", "count"), input("stackEmToAtk", pct(1), "每层精通转换比例")]);
      break;
    }
    case "xiphosmoonlight":
    case "makhairaaquamarine": {
      const xiphos = weapon.slug === "xiphosmoonlight";
      expected(xiphos ? `每10秒，产生如下效果：装备者的每点元素精通，都会为该角色提升${values[0]}元素充能效率，并基于该提升的30%为队伍中附近的其他角色提升元素充能效率，持续12秒，多件同名武器产生的此效果可以叠加。角色处于队伍后台时也能触发效果。` : `每10秒，产生如下效果：基于装备者的元素精通的${values[0]}，提升该角色的攻击力，并基于该提升的30%为队伍中附近的其他角色提升攻击力，持续12秒，多件同名武器产生的此效果可以叠加。角色处于队伍后台时也能触发效果。`);
      const active = need("timedEffectActive");
      if (active === false) stat("周期效果停用", xiphos ? "energyRechargeBonus" : "flatAtk", "conversion", c(0));
      else if (active) {
        const em = need("timedSnapshotEm");
        if (em !== undefined) stat("周期精通转换", xiphos ? "energyRechargeBonus" : "flatAtk", "conversion", mul(v("snapshotEm"), v("conversionRatio")), [input("snapshotEm", em, "最近周期触发时非转换元素精通", "stat"), input("conversionRatio", pct(0), "精通转换系数")]);
      }
      result.effectBlockers.push(`${weapon.name}：只计算装备者；对其他队员30%共享及多个装备者叠加未纳入本角色配装。`); break;
    }
    case "theunforged":
    case "memoryofdust":
    case "vortexvanquisher": {
      expected(`护盾强效提升${values[0]}。攻击命中后的8秒内，攻击力提升${values[1]}。该效果至多可叠加5层，每0.3秒只能触发一次。此外，处于护盾庇护下时，该效果的攻击力提升效果提高100%。`);
      const n = count(5), shielded = need("shielded");
      if (n !== undefined && shielded !== undefined) stat("护盾叠层攻击", "atkPercent", "pre-panel", mul(v("stacks"), v("perStackAtk"), add(c(1), v("shielded"))), [input("stacks", n, "当前有效攻击层数", "count"), input("perStackAtk", pct(1), "每层攻击百分比"), input("shielded", Number(shielded), "当前护盾是否有效", "boolean")]);
      result.effectBlockers.push(`${weapon.name}：护盾强效不在当前伤害面板目标中，未执行护盾吸收计算。`); break;
    }
    case "primordialjadewingedspear": {
      expected(`命中敌人时自身攻击力提高${values[0]}，持续6秒，最高可以叠加7层。该效果每0.3秒最多触发一次。满层状态时伤害提升${values[1]}。`);
      const n = count(7);
      if (n !== undefined) {
        stat("命中叠层攻击", "atkPercent", "pre-panel", mul(v("stacks"), v("perStackAtk")), [input("stacks", n, "当前有效层数", "count"), input("perStackAtk", pct(0), "每层攻击百分比")]);
        hit("满层增伤", condition("equal", v("stacks"), c(7), v("maxStackBonus"), c(0)), [input("stacks", n, "当前有效层数", "count"), input("maxStackBonus", pct(1), "满层伤害加成")]);
      }
      break;
    }
    case "calamityqueller": {
      expected(`获得${values[0]}所有元素伤害加成；施放元素战技后，获得持续20秒的「圆顿」，攻击力每1秒提升${values[1]}，该攻击力提升效果至多叠加6次。当装备此武器的角色处于队伍后台时，「圆顿」的攻击力提升效果翻倍。`);
      hit("所有元素增伤", v("elementBonus"), [input("elementBonus", pct(0), "所有元素伤害加成")], { elements });
      const n = count(6), offField = need("offField");
      if (n !== undefined && offField !== undefined) stat("圆顿叠层攻击", "atkPercent", "pre-panel", mul(v("stacks"), v("perStackAtk"), add(c(1), v("offField"))), [input("stacks", n, "当前圆顿层数", "count"), input("perStackAtk", pct(1), "每层攻击百分比"), input("offField", Number(offField), "装备者是否在后台", "boolean")]);
      break;
    }
    case "keyofkhajnisut": {
      expected(`生命值提升${values[0]}。元素战技命中敌人时，将产生持续20秒的「宏大诗篇」效果：基于装备者生命值上限的${values[1]}，获得元素精通提升，该效果每0.3秒至多触发一次，至多叠加3层。该效果叠加至3层或3层的持续时间刷新时，将基于装备者生命值上限的${values[2]}，为队伍中附近所有角色提供元素精通提升，持续20秒。`);
      stat("生命提升", "hpPercent", "pre-panel", v("hpGain"), [input("hpGain", pct(0), "生命百分比来源")]);
      const n = count(3), teamActive = need("keyTeamBuffActive");
      if (teamActive && n !== undefined && n < 3) throw new Error("本装备者圣显团队增益有效时，其自身层数不能低于3；其他装备者的团队增益不属于此输入。");
      const hp = n !== undefined && n > 0 ? need("keySnapshotHp") : undefined;
      if (n === 0) stat("宏大诗篇无层数", "em", "conversion", c(0));
      else if (n !== undefined && hp !== undefined) stat("宏大诗篇自身精通", "em", "conversion", mul(v("snapshotHp"), v("stacks"), v("stackHpToEm")), [input("snapshotHp", hp, "最近触发时生命值上限", "stat"), input("stacks", n, "宏大诗篇层数", "count"), input("stackHpToEm", pct(1), "每层生命转精通比例")]);
      if (teamActive === false) stat("团队精通未生效", "em", "conversion", c(0));
      else if (teamActive) {
        const teamHp = need("keyTeamSnapshotHp");
        if (teamHp !== undefined) stat("团队精通自身份额", "em", "conversion", mul(v("teamSnapshotHp"), v("teamHpToEm")), [input("teamSnapshotHp", teamHp, "团队效果最近三层触发时生命值上限", "stat"), input("teamHpToEm", pct(2), "团队生命转精通比例")]);
      }
      result.assumptions.push("圣显自身每次触发会用最近一次生命上限重算所有现存层数；团队效果使用独立提供的团队触发快照，不默认等于当前生命或自身快照。");
      result.effectBlockers.push("圣显之钥：只计装备者获得的团队精通份额；其他队员与不同触发瞬间生命变化的完整状态调度未实现。"); break;
    }
  }
  return result;
}

/** Only four-piece additions: two-piece terms are owned by equipment-effects.ts. */
export function resolveArtifactFormulaEffects(args: { setId: string; pieces: number; enabled: boolean; context?: EquipmentFormulaContext; dataset?: EquipmentDataset }): EquipmentFormulaResolution {
  const result = empty();
  const set = requireEquipmentArtifactSet(args.setId, args.dataset);
  if (!Number.isInteger(args.pieces) || args.pieces < 0 || args.pieces > 5) throw new Error("套装件数必须为0–5整数。");
  if (!args.enabled || args.pieces < 4) return result;
  const context = args.context ?? {};
  validateContext(context);
  const refs = [equipmentDescriptionSource("artifacts", set.slug, args.dataset), ...(sourcePaths[set.slug] ?? []).map(path => gcsimRoot + path)];
  result.sourceRefs.push(...refs);
  if (set.slug === "emblemofseveredfate") {
    if (set.pieceEffects.find(effect => effect.pieces === 4)?.description !== "基于元素充能效率的25%，提高元素爆发造成的伤害。至多通过这种方式获得75%提升。") throw new Error("绝缘四件套来源文本已变更。");
    result.dynamicHitBonuses.push({ id: `${set.id}:4pc:er`, label: "绝缘四件套·非转换充能转爆发增伤", expression: { kind: "min", terms: [v("bonusCap"), mul(v("erRatio"), v("erToBonus"))] }, inputs: [input("bonusCap", 0.75, "爆发增伤上限"), input("erToBonus", 0.25, "充能转爆发增伤比例")], attackTags: ["burst"], sourceRefs: refs, inputPolicy: "pre-conversion" });
    result.assumptions.push("绝缘读取非转换充能；不把西福斯等属性转换产生的充能再次转换为爆发增伤。");
  } else if (set.slug === "huskofopulentdreams") {
    const text = "装备此圣遗物套装的角色在以下情况下，将获得「问答」效果：在场上用岩元素攻击命中敌人后获得一层，每0.3秒至多触发一次；在队伍后台中，每3秒获得一层。问答至多叠加4层，每层能提供6%防御力与6%岩元素伤害加成。每6秒，若未获得问答效果，将损失一层。";
    if (set.pieceEffects.find(effect => effect.pieces === 4)?.description !== text) throw new Error("华馆四件套来源文本已变更。");
    const n = context.setStacks;
    if (n === undefined) {
      const reason = "华馆四件套缺少明确当前有效层数，未假定满层。";
      result.effectBlockers.push(reason); result.missingConditions.push(reason);
    }
    else {
      if (!Number.isInteger(n) || n > 4) throw new Error("华馆层数必须为0–4整数。");
      const expression = mul(v("stacks"), v("perStackBonus"));
      const inputs = [input("stacks", n, "当前有效问答层数", "count"), input("perStackBonus", 0.06, "每层防御与岩伤加成")];
      result.statModifiers.push({ id: `${set.id}:4pc:def`, label: "华馆四件套·防御", target: "defPercent", phase: "pre-panel", expression, inputs, sourceRefs: refs });
      result.dynamicHitBonuses.push({ id: `${set.id}:4pc:geo`, label: "华馆四件套·岩伤", elements: ["geo"], expression, inputs, sourceRefs: refs, inputPolicy: "pre-conversion" });
      result.assumptions.push("华馆仅恢复当前有效层数；命中增层、后台增层、衰减与刷新不由此计算器推定。");
    }
  } else result.effectBlockers.push(`${set.name}未登记四件套转换公式。`);
  return result;
}
