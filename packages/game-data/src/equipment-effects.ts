import { gameDataCatalog } from "./catalog";
import { equipmentCatalog, requireEquipmentArtifactSet, type EquipmentDataset } from "./equipment-dataset";
import { equipmentDescriptionSource } from "./equipment-source";
import type { EquipmentDynamicHitBonus } from "./equipment-formulas";

export type EquipmentEffectElement = "physical" | "pyro" | "hydro" | "cryo" | "electro" | "anemo" | "geo" | "dendro";
export type EquipmentEffectAttackTag = "normal" | "charged" | "plunge" | "skill" | "burst";
export type EquipmentEffectWeaponType = "sword" | "claymore" | "polearm" | "bow" | "catalyst";

/** A user-supplied state at the calculation instant, never an inferred uptime. */
export interface EquipmentEffectContext {
  hpFraction?: number;
  enemyHpFraction?: number;
  enemyAuras?: EquipmentEffectElement[];
  weaponType?: EquipmentEffectWeaponType;
  /** Both Nightsoul's Blessing and being on-field are explicitly true at this instant. */
  nightsoulFrontlineActive?: boolean;
}

export interface EquipmentEffectStatContribution {
  property: `FIGHT_PROP_${string}`;
  value: number;
  sourceRef: string;
  effectId: string;
  label: string;
}

/** Additive DMG bonus, applicable only when every supplied filter matches. */
export interface EquipmentHitBonus {
  id: string;
  value: number;
  sourceRef: string;
  label: string;
  elements?: EquipmentEffectElement[];
  attackTags?: EquipmentEffectAttackTag[];
  weaponTypes?: EquipmentEffectWeaponType[];
}

export interface EquipmentEffectResolution {
  statContributions: EquipmentEffectStatContribution[];
  hitBonuses: EquipmentHitBonus[];
  dynamicHitBonuses?: EquipmentDynamicHitBonus[];
  assumptions: string[];
  effectBlockers: string[];
  missingConditions: string[];
  sourceRefs: string[];
  verification: "provisional";
}

const gcsimRoot = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const optimizerRoot = "https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Artifacts";
const elementalTypes: EquipmentEffectElement[] = ["pyro", "hydro", "cryo", "electro", "anemo", "geo", "dendro"];
export const SUPPORTED_STATIC_WEAPON_SLUGS = ["harbingerofdawn", "aquilafavonia", "wolfsgravestone", "skywardblade", "skywardharp", "skywardatlas", "skywardpride", "whitetassel", "thestringless", "rust", "amosbow", "theblacksword", "coolsteel", "lionsroar", "dragonsbane", "ravenbow"] as const;
export const SUPPORTED_STATIC_WEAPON_IDS = gameDataCatalog.weapons.filter(weapon => (SUPPORTED_STATIC_WEAPON_SLUGS as readonly string[]).includes(weapon.slug)).map(weapon => weapon.id);
export const SUPPORTED_STATIC_ARTIFACT_FOUR_PIECE_SLUGS = ["gladiatorsfinale", "wandererstroupe"] as const;

function emptyResolution(): EquipmentEffectResolution {
  return { statContributions: [], hitBonuses: [], assumptions: [], effectBlockers: [], missingConditions: [], sourceRefs: [], verification: "provisional" };
}

function validateContext(context: EquipmentEffectContext): void {
  for (const key of ["hpFraction", "enemyHpFraction"] as const) {
    const value = context[key];
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1)) throw new Error(`${key} 必须为 0–1 的有限比例，不能推测缺失生命值。`);
  }
  if (context.enemyAuras?.some(element => !elementalTypes.includes(element))) throw new Error("敌人附着只能包含元素；不能把物理伤害当作附着。");
  if (context.weaponType !== undefined && !["sword", "claymore", "polearm", "bow", "catalyst"].includes(context.weaponType)) throw new Error("装备效果的武器类型无效。");
}

function addStat(result: EquipmentEffectResolution, id: string, label: string, sourceRef: string, property: EquipmentEffectStatContribution["property"], value: number): void {
  result.statContributions.push({ effectId: id, label, sourceRef, property, value });
}

/** Consumers must use this conjunction instead of applying tag bonuses to every hit. */
export function equipmentHitBonusApplies(bonus: EquipmentHitBonus, hit: { element: EquipmentEffectElement; attackTag?: EquipmentEffectAttackTag; weaponType?: EquipmentEffectWeaponType }): boolean {
  return (!bonus.elements || bonus.elements.includes(hit.element))
    && (!bonus.attackTags || (hit.attackTag !== undefined && bonus.attackTags.includes(hit.attackTag)))
    && (!bonus.weaponTypes || (hit.weaponType !== undefined && bonus.weaponTypes.includes(hit.weaponType)));
}

/** Explicit field mapping for a named passive; this is not a description-to-rule parser. */
export function resolveWeaponEffects(input: { weaponId: string; refinement: number; enabled: boolean; context?: EquipmentEffectContext; dataset?: EquipmentDataset }): EquipmentEffectResolution {
  const weapon = equipmentCatalog(input.dataset).weapons.find(entry => entry.id === input.weaponId);
  if (!weapon) throw new Error(`没有武器 ${input.weaponId} 的固定来源。`);
  const rank = weapon.refinements.find(entry => entry.rank === input.refinement);
  if (!Number.isInteger(input.refinement) || (!rank && (weapon.refinements.length > 0 || input.refinement !== 1))) throw new Error(`${weapon.name}没有精炼 ${input.refinement} 的来源记录。`);
  const context = input.context ?? {};
  validateContext(context);
  const result = emptyResolution();
  if (!weapon.effectName || !rank) return result;
  const label = `${weapon.name}·${weapon.effectName}`;
  const ref = `${equipmentDescriptionSource("weapons", weapon.slug, input.dataset)}#/r${input.refinement}`;
  result.sourceRefs.push(ref);
  if (!input.enabled) {
    result.assumptions.push(`${label}：用户明确停用武器被动。`);
    return result;
  }
  result.assumptions.push(`${label}：仅执行下述固定来源白名单条款；条件是本次计算瞬间的显式输入，不表示循环覆盖率。`);
  const id = `${weapon.id}:r${input.refinement}`;
  const percent = (index: number): number => {
    const value = rank.values[index];
    if (value === undefined || !/^\d+(?:\.\d+)?%$/.test(value)) throw new Error(`${label}的精炼字段 ${index} 不是来源中的精确百分比。`);
    return Number(value.slice(0, -1)) / 100;
  };
  const expectClause = (expected: string, entire = false): void => {
    if (entire ? rank.description !== expected : !rank.description.startsWith(expected)) throw new Error(`${label}来源文案已改变，必须重新审阅映射后才能执行。`);
  };
  const stat = (property: EquipmentEffectStatContribution["property"], index = 0): void => addStat(result, id, label, `${ref}.values.${index}`, property, percent(index));
  const hit = (value: number, filters: Pick<EquipmentHitBonus, "attackTags" | "elements" | "weaponTypes"> = {}, suffix = "damage"): void => {
    result.hitBonuses.push({ id: `${id}:${suffix}`, label, sourceRef: ref, value, ...filters });
  };
  const partial = (clause: string): void => { result.effectBlockers.push(`${label}：${clause}尚无可执行规则，未计入。`); };
  const missing = (clause: string): void => { const reason = `${label}：${clause}`; result.effectBlockers.push(reason); result.missingConditions.push(reason); };
  const v = rank.values;
  switch (weapon.slug) {
    case "harbingerofdawn": {
      expectClause(`生命值高于90%时，暴击率提升${v[0]}。`, true);
      result.sourceRefs.push(`${gcsimRoot}/internal/weapons/sword/harbinger/harbinger.go`);
      if (context.hpFraction === undefined) missing("缺少当前生命比例，不能判定 90% 门槛");
      else if (context.hpFraction === 0.9) missing("90% 等号边界存在来源冲突：目录文案为 >，固定 gcsim 为 >=；需游戏内验证");
      else {
        result.assumptions.push(`生命比例 ${context.hpFraction} ${context.hpFraction > 0.9 ? ">" : "<"} 0.9，黎明神剑条件${context.hpFraction > 0.9 ? "成立" : "不成立"}。`);
        if (context.hpFraction > 0.9) stat("FIGHT_PROP_CRITICAL");
      }
      break;
    }
    case "aquilafavonia":
      expectClause(`攻击力提高${v[0]}；`); stat("FIGHT_PROP_ATTACK_PERCENT"); partial("受伤后的治疗、额外伤害与 15 秒冷却"); break;
    case "wolfsgravestone":
      expectClause(`攻击力提高${v[0]}；`); stat("FIGHT_PROP_ATTACK_PERCENT"); partial("低血量目标命中后的团队攻击增益、持续时间和冷却"); break;
    case "skywardblade":
      expectClause(`暴击率提升${v[0]}；`); stat("FIGHT_PROP_CRITICAL"); partial("爆发后的移动速度、攻速、附加伤害与持续时间"); break;
    case "skywardharp":
      expectClause(`暴击伤害提高${v[0]}；`); stat("FIGHT_PROP_CRITICAL_HURT"); partial("概率物理追击及冷却"); break;
    case "skywardatlas":
      expectClause(`元素伤害加成提升${v[0]}；`); hit(percent(0), { elements: elementalTypes }); partial("高天流云的概率追击、持续时间和冷却"); break;
    case "skywardpride":
      expectClause(`造成的伤害提高${v[0]}；`); hit(percent(0)); partial("真空刃伤害、次数和持续时间"); break;
    case "whitetassel":
      expectClause(`普通攻击造成的伤害提升${v[0]}。`, true); hit(percent(0), { attackTags: ["normal"] }); break;
    case "thestringless":
      expectClause(`元素战技与元素爆发的伤害提高${v[0]}。`, true); hit(percent(0), { attackTags: ["skill", "burst"] }); break;
    case "rust":
      expectClause(`普通攻击造成的伤害提升${v[0]}，重击造成的伤害下降10%。`, true);
      result.sourceRefs.push(`${gcsimRoot}/internal/weapons/bow/rust/rust.go`);
      hit(percent(0), { attackTags: ["normal"] }, "normal"); hit(-0.1, { attackTags: ["charged"] }, "charged"); break;
    case "amosbow":
      expectClause(`普通攻击与重击造成的伤害提升${v[0]}；`); hit(percent(0), { attackTags: ["normal", "charged"] }); partial("箭矢飞行时间对应的逐层增伤"); break;
    case "theblacksword":
      expectClause(`普通攻击与重击的造成的伤害提升${v[0]}；`); hit(percent(0), { attackTags: ["normal", "charged"] }); partial("暴击治疗与 5 秒冷却"); break;
    case "coolsteel":
    case "lionsroar":
    case "dragonsbane":
    case "ravenbow": {
      const required: EquipmentEffectElement[] = weapon.slug === "coolsteel" ? ["hydro", "cryo"] : weapon.slug === "lionsroar" ? ["pyro", "electro"] : ["hydro", "pyro"];
      const words = weapon.slug === "coolsteel" ? "水元素或冰元素" : weapon.slug === "lionsroar" ? "火元素或雷元素" : "水元素或火元素";
      expectClause(`对处于${words}影响下的敌人，造成的伤害提高${v[0]}。`, true);
      if (context.enemyAuras === undefined) missing("缺少命中前敌人附着状态；不自动假定附着存在");
      else {
        const active = required.some(element => context.enemyAuras!.includes(element));
        result.assumptions.push(`命中前附着 [${context.enemyAuras.join(", ")}]，${label}条件${active ? "成立" : "不成立"}；不会由伤害元素反推附着。`);
        if (active) hit(percent(0));
      }
      break;
    }
    default: partial("该被动的属性、触发、层数、持续时间和冷却映射");
  }
  return result;
}

interface ArtifactTwoPieceRule {
  description: string;
  property?: EquipmentEffectStatContribution["property"];
  value: number;
  attackTags?: EquipmentEffectAttackTag[];
  conditionKey?: "nightsoulFrontlineActive";
  sourceRefs?: string[];
}

const atk18: ArtifactTwoPieceRule = { description: "攻击力提高18%。", property: "FIGHT_PROP_ATTACK_PERCENT", value: 0.18 };
const em80: ArtifactTwoPieceRule = { description: "元素精通提高80点。", property: "FIGHT_PROP_ELEMENT_MASTERY", value: 80 };
const er20: ArtifactTwoPieceRule = { description: "元素充能效率提高20%。", property: "FIGHT_PROP_CHARGE_EFFICIENCY", value: 0.2 };
const def30: ArtifactTwoPieceRule = { description: "防御力提高30%。", property: "FIGHT_PROP_DEFENSE_PERCENT", value: 0.3 };
const physical25: ArtifactTwoPieceRule = { description: "造成的物理伤害提高25%。", property: "FIGHT_PROP_PHYSICAL_ADD_HURT", value: 0.25 };
const hp20: ArtifactTwoPieceRule = { description: "生命值提升20%。", property: "FIGHT_PROP_HP_PERCENT", value: 0.2 };
const heal15: ArtifactTwoPieceRule = { description: "治疗加成提高15%。", property: "FIGHT_PROP_HEAL_ADD", value: 0.15 };
const normalCharged15: ArtifactTwoPieceRule = { description: "普通攻击与重击造成的伤害提高15%。", value: 0.15, attackTags: ["normal", "charged"] };
const skill20: ArtifactTwoPieceRule = { description: "元素战技造成的伤害提升20%。", value: 0.2, attackTags: ["skill"] };

/** Named, reviewed entries only. Identical prose on an unknown set grants no rule. */
export const artifactTwoPieceRules: Readonly<Record<string, ArtifactTwoPieceRule>> = {
  resolutionofsojourner: atk18, braveheart: atk18, gladiatorsfinale: atk18,
  shimenawasreminiscence: atk18, vermillionhereafter: atk18, echoesofanoffering: atk18,
  nighttimewhispersintheechoingwoods: atk18, fragmentofharmonicwhimsy: atk18, unfinishedreverie: atk18,
  adaycarvedfromrisingwinds: atk18, disenchantmentindeepshadow: atk18,
  scarletproof: { ...atk18, sourceRefs: [`${optimizerRoot}/ScarletProof/index.tsx`] },
  heartofthefurnace: { ...atk18, sourceRefs: [`${optimizerRoot}/HeartOfTheFurnace/index.tsx`] },
  defenderswill: def30, huskofopulentdreams: def30,
  instructor: em80, wandererstroupe: em80, gildeddreams: em80, flowerofparadiselost: em80,
  nightoftheskysunveiling: em80, aubadeofmorningstarandmoon: em80,
  theexile: er20, scholar: er20, emblemofseveredfate: er20, silkenmoonsserenade: er20, celestialgift: er20,
  bloodstainedchivalry: physical25, paleflame: physical25,
  tenacityofthemillelith: hp20, vourukashasglow: hp20,
  oceanhuedclam: heal15, songofdayspast: heal15,
  martialartist: normalCharged15, marechausseehunter: normalCharged15,
  gambler: skill20, goldentroupe: skill20,
  berserker: { description: "暴击率提高12%。", property: "FIGHT_PROP_CRITICAL", value: 0.12 },
  adventurer: { description: "生命值上限提高1000点。", property: "FIGHT_PROP_HP", value: 1000 },
  luckydog: { description: "防御力提高100点。", property: "FIGHT_PROP_DEFENSE", value: 100 },
  maidenbeloved: { description: "角色造成的治疗效果提升15%。", property: "FIGHT_PROP_HEAL_ADD", value: 0.15 },
  blizzardstrayer: { description: "获得15%冰元素伤害加成。", property: "FIGHT_PROP_ICE_ADD_HURT", value: 0.15 },
  finaleofthedeepgalleries: { description: "获得15%冰元素伤害加成。", property: "FIGHT_PROP_ICE_ADD_HURT", value: 0.15 },
  viridescentvenerer: { description: "获得15%风元素伤害加成。", property: "FIGHT_PROP_WIND_ADD_HURT", value: 0.15 },
  desertpavilionchronicle: { description: "获得15%风元素伤害加成。", property: "FIGHT_PROP_WIND_ADD_HURT", value: 0.15 },
  thunderingfury: { description: "获得15%雷元素伤害加成。", property: "FIGHT_PROP_ELEC_ADD_HURT", value: 0.15 },
  crimsonwitchofflames: { description: "获得15%火元素伤害加成。", property: "FIGHT_PROP_FIRE_ADD_HURT", value: 0.15 },
  archaicpetra: { description: "获得15%岩元素伤害加成。", property: "FIGHT_PROP_ROCK_ADD_HURT", value: 0.15 },
  heartofdepth: { description: "获得15%水元素伤害加成。", property: "FIGHT_PROP_WATER_ADD_HURT", value: 0.15 },
  nymphsdream: { description: "获得15%水元素伤害加成。", property: "FIGHT_PROP_WATER_ADD_HURT", value: 0.15 },
  deepwoodmemories: { description: "获得15%草元素伤害加成。", property: "FIGHT_PROP_GRASS_ADD_HURT", value: 0.15 },
  noblesseoblige: { description: "元素爆发造成的伤害提升20%。", value: 0.2, attackTags: ["burst"] },
  longnightsoath: { description: "下落攻击造成的伤害提升25%。", value: 0.25, attackTags: ["plunge"] },
  obsidiancodex: { description: "装备者处于夜魂加持状态，并且在场上时，造成的伤害提高15%。", value: 0.15, conditionKey: "nightsoulFrontlineActive", sourceRefs: [`${gcsimRoot}/internal/artifacts/obsidiancodex/obsidiancodex.go`] }
};

/** Source descriptions only: these wearer effects have no outgoing-damage execution path. */
export interface ArtifactNonDamagePieceDescription {
  pieces: 1 | 2;
  description: string;
  property: "self-elemental-resistance" | "incoming-healing-bonus" | "shield-strength" | "elemental-status-duration-reduction";
  value: number;
  recipient: "wearer";
  elements?: EquipmentEffectElement[];
  sourceRefs: string[];
  execution: "not-modeled" | "utility-replay";
  explanation: string;
}
const selfResistance = (description: string, value: number, elements: EquipmentEffectElement[], sheet: string): ArtifactNonDamagePieceDescription => ({ pieces: 2, description, property: "self-elemental-resistance", value, elements, recipient: "wearer", sourceRefs: [`${optimizerRoot}/${sheet}/index.tsx`], execution: sheet === "TinyMiracle" ? "utility-replay" : "not-modeled", explanation: sheet === "TinyMiracle" ? "这是装备者的自身抗性，已接独立圣遗物受击事件重放；此输出伤害配装解析器不执行玩家受击。" : "这是装备者受到伤害时的自身抗性，不是敌人抗性降低，也不增加其输出伤害；当前未执行受击生存公式。" });
const tiara = (element: EquipmentEffectElement, word: string): ArtifactNonDamagePieceDescription => ({ pieces: 1, description: `受到的${word}元素附着效果的持续时间减少40%。`, property: "elemental-status-duration-reduction", value: 0.4, elements: [element], recipient: "wearer", sourceRefs: [], execution: "not-modeled", explanation: "合法的一件套理之冠，作用于装备者所受元素附着的持续时间；不是40%抗性、敌方减抗或输出增伤。当前未执行角色受附着计时。" });
export const artifactNonDamagePieceDescriptions: Readonly<Record<string, ArtifactNonDamagePieceDescription>> = {
  tinymiracle: selfResistance("所有元素抗性提高20%。", 0.2, elementalTypes, "TinyMiracle"),
  thundersoother: selfResistance("雷元素抗性提高40%。", 0.4, ["electro"], "Thundersoother"),
  lavawalker: selfResistance("火元素抗性提高40%。", 0.4, ["pyro"], "Lavawalker"),
  travelingdoctor: { pieces: 2, description: "角色受到的治疗效果提高20%。", property: "incoming-healing-bonus", value: 0.2, recipient: "wearer", sourceRefs: [`${optimizerRoot}/TravelingDoctor/index.tsx`], execution: "utility-replay", explanation: "这是装备者的受治疗加成，已接独立圣遗物治疗事件重放；不进入输出伤害。" },
  retracingbolide: { pieces: 2, description: "护盾强效提高35%。", property: "shield-strength", value: 0.35, recipient: "wearer", sourceRefs: [`${optimizerRoot}/RetracingBolide/index.tsx`], execution: "not-modeled", explanation: "这是装备者的护盾强效，不是团队共享护盾基础值或输出增伤；当前未执行护盾承伤结算。" },
  prayersforillumination: tiara("pyro", "火"), prayersfordestiny: tiara("hydro", "水"),
  prayersforwisdom: tiara("electro", "雷"), prayerstospringtime: tiara("cryo", "冰")
};

export function resolveArtifactSetEffects(input: { setId: string; pieces: number; enabled: boolean; context?: EquipmentEffectContext; dataset?: EquipmentDataset }): EquipmentEffectResolution {
  const set = requireEquipmentArtifactSet(input.setId, input.dataset);
  if (!Number.isInteger(input.pieces) || input.pieces < 0 || input.pieces > 5) throw new Error("圣遗物套装件数必须为 0–5 的整数；应按不同装备槽计数。");
  const context = input.context ?? {};
  validateContext(context);
  const result = emptyResolution();
  const ref = equipmentDescriptionSource("artifacts", set.slug, input.dataset);
  result.sourceRefs.push(ref);
  if (!input.enabled) { result.assumptions.push(`${set.name}：用户明确停用套装效果。`); return result; }
  for (const effect of set.pieceEffects.filter(entry => entry.pieces <= input.pieces)) {
    const id = `${set.id}:${effect.pieces}pc`;
    const label = `${set.name} ${effect.pieces} 件套`;
    const sourceRef = `${ref}.${effect.pieces}pc`;
    const rule = effect.pieces === 2 ? artifactTwoPieceRules[set.slug] : undefined;
    const nonDamage = artifactNonDamagePieceDescriptions[set.slug];
    if (rule) {
      if (rule.description !== effect.description) throw new Error(`${label}来源文案已改变，必须重新审阅映射后才能执行。`);
      result.sourceRefs.push(...(rule.sourceRefs ?? []));
      if (rule.conditionKey) {
        const active = context[rule.conditionKey];
        if (active === undefined) {
          const reason = `${label}：缺少显式 ${rule.conditionKey}（装备者当前同时处于夜魂加持且在前台），不能推测条件。`;
          result.effectBlockers.push(reason); result.missingConditions.push(reason);
        } else {
          if (typeof active !== "boolean") throw new Error(`${rule.conditionKey}必须为显式布尔值。`);
          result.dynamicHitBonuses = [{ id, label, sourceRefs: [sourceRef, ...(rule.sourceRefs ?? [])], inputPolicy: "pre-conversion",
            expression: { kind: "multiply", terms: [{ kind: "variable", key: "nightsoulFrontlineActive" }, { kind: "variable", key: "damageBonus" }] },
            inputs: [{ key: "nightsoulFrontlineActive", value: Number(active), unit: "boolean", meaningKey: "当前处于夜魂加持且在前台", origin: "artifact-explicit-context" }, { key: "damageBonus", value: rule.value, unit: "ratio", meaningKey: "黑曜二件套伤害加成", origin: "artifact-source" }]
          }];
          result.assumptions.push(`${label}：显式输入夜魂加持且前台条件=${active}；只恢复当前条件，不模拟夜魂进入、消耗、退场或四件套6秒暴击窗口。`);
        }
      } else if (rule.property) addStat(result, id, label, sourceRef, rule.property, rule.value);
      else result.hitBonuses.push({ id, label, sourceRef, value: rule.value, ...(rule.attackTags ? { attackTags: rule.attackTags } : {}) });
    } else if (nonDamage?.pieces === effect.pieces) {
      if (nonDamage.description !== effect.description) throw new Error(`${label}来源文案已改变，必须重新审阅适用对象。`);
      result.sourceRefs.push(...nonDamage.sourceRefs);
      result.assumptions.push(`${label}：来源值=${nonDamage.value}，适用对象=装备者，属性=${nonDamage.property}${nonDamage.elements ? `，元素=${nonDamage.elements.join(",")}` : ""}。${nonDamage.explanation}`);
      result.effectBlockers.push(nonDamage.execution === "utility-replay"
        ? `${label}：玩家生存效果由独立圣遗物事件重放执行；在本输出伤害配装解析器中未计入可执行套装覆盖，该解析器不读取受击或治疗事件；不能据此否定独立生存重放的支持。来源文案：${effect.description}`
        : `${label}：仅保留来源说明，${nonDamage.property}机制尚未执行；未计入可执行套装覆盖。来源文案：${effect.description}`);
    } else if (effect.pieces === 2 && set.slug === "scrolloftheheroofcindercity") {
      result.sourceRefs.push(`${gcsimRoot}/internal/artifacts/scrolloftheheroofcindercity/scrolloftheheroofcindercity.go`);
      result.effectBlockers.push(`${label}：附近队友夜魂迸发事件触发后，装备者恢复6点能量；尚未接入夜魂迸发事件、受益者及能量上限结算，不把6点能量当作充能效率或伤害属性。来源文案：${effect.description}`);
    } else if (effect.pieces === 4 && (set.slug === "gladiatorsfinale" || set.slug === "wandererstroupe")) {
      const isGladiator = set.slug === "gladiatorsfinale";
      const expected = isGladiator ? "装备该圣遗物套装的角色为单手剑、双手剑、长柄武器角色时，角色普通攻击造成的伤害提高35%。" : "装备该圣遗物套装的角色为法器、弓箭角色时，角色重击造成的伤害提高35%。";
      if (effect.description !== expected) throw new Error(`${label}来源文案已改变，必须重新审阅映射后才能执行。`);
      const weaponTypes: EquipmentEffectWeaponType[] = isGladiator ? ["sword", "claymore", "polearm"] : ["catalyst", "bow"];
      if (!context.weaponType) result.effectBlockers.push(`${label}：缺少武器类型，无法确定套装增伤资格。`);
      else if (weaponTypes.includes(context.weaponType)) result.hitBonuses.push({ id, label, sourceRef, value: 0.35, attackTags: [isGladiator ? "normal" : "charged"], weaponTypes });
      else result.assumptions.push(`${label}：当前武器 ${context.weaponType} 不满足限定类型，不增加伤害。`);
    } else if (effect.pieces === 4 && ["tinymiracle", "adventurer", "luckydog", "travelingdoctor"].includes(set.slug)) {
      result.effectBlockers.push(`${label}：此条由独立圣遗物受击／治疗／探索事件重放执行；本输出伤害配装解析器不读取这些事件。来源文案：${effect.description}`);
    } else result.effectBlockers.push(`${label}：该条效果的条件或属性尚未映射，未计入；来源文案：${effect.description}`);
  }
  return result;
}
