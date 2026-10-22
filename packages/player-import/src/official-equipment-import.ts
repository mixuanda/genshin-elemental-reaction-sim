import { catalog } from "./catalog";
import { readInput } from "./input";
import { resolveEquipmentDisplayStatLabel } from "./hutao-text";
import { assessImportedBuildCompleteness, importPlayerJson, normalizeObservedStat } from "./normalize";
import type { Field, ImportResult, Stat, Talent } from "./model";

type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const positiveId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const field = <T>(value: T | null, path: string, unit: Field<T>["unit"], state: Field<T>["state"] = value === null ? "missing" : "known", note = "本次纯配装观察直接提供；不补默认值"): Field<T> => ({ state, value, path, unit, note });
const keyFor = (kind: "character" | "weapon" | "artifact", id: unknown) => Object.entries(catalog.good[kind]).find(([, candidate]) => candidate === id)?.[0];
const slotNames: Record<string, string> = { "生之花": "flower", "死之羽": "plume", "时之沙": "sands", "空之杯": "goblet", "理之冠": "circlet", "Flower of Life": "flower", "Plume of Death": "plume", "Sands of Eon": "sands", "Goblet of Eonothem": "goblet", "Circlet of Logos": "circlet" };
const displayNames: Record<string, string> = { "生命值": "HP", "攻击力": "ATK", "基础攻击力": "Base ATK", "防御力": "DEF", "元素精通": "Elemental Mastery", "暴击率": "CRIT Rate", "暴击伤害": "CRIT DMG", "元素充能效率": "Energy Recharge", "治疗加成": "Healing Bonus", "受治疗加成": "Incoming Healing Bonus", "物理伤害加成": "Physical DMG Bonus", "火元素伤害加成": "Pyro DMG Bonus", "水元素伤害加成": "Hydro DMG Bonus", "冰元素伤害加成": "Cryo DMG Bonus", "雷元素伤害加成": "Electro DMG Bonus", "风元素伤害加成": "Anemo DMG Bonus", "岩元素伤害加成": "Geo DMG Bonus", "草元素伤害加成": "Dendro DMG Bonus" };

function observedStat(value: unknown, path: string): Stat {
  const source = row(value), text = typeof source.value === "string" ? source.value : "";
  const percent = text.endsWith("%"), name = typeof source.name === "string" ? source.name.replace(/\u00a0/g, " ") : "";
  const label = Object.hasOwn(displayNames, name) ? displayNames[name]! : name;
  const key = resolveEquipmentDisplayStatLabel(label, percent) ?? (positiveId(source.property_type) ? `chronicle-property:${source.property_type}` : undefined);
  const numeric = /^\d+(?:\.\d+)?%?$/.test(text) ? Number(percent ? text.slice(0, -1) : text) : undefined;
  const result = normalizeObservedStat(key, numeric, path, "display");
  result.key.path = `${path}.name`; result.amount.path = `${path}.value`;
  if (source.metadataMismatch === true) { result.key.state = "invalid"; result.key.note = "property_map 的编号与属性编号冲突"; }
  if (!positiveId(source.property_type)) { result.key.state = "missing"; result.key.note = "来源未给出属性编号"; }
  if (text && key && !key.startsWith("chronicle-property:") && key.endsWith("_") !== percent) { result.amount.state = "invalid"; result.amount.note = "属性名称与显式百分号不一致；不猜数字单位"; }
  if (text && numeric === undefined) { result.amount.state = "invalid"; result.amount.note = "显示数值或分隔符语义未核验，不猜小数/千位格式"; }
  return result;
}
function rewritePaths(value: unknown, replacements: [string, string][]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) { for (const child of value) rewritePaths(child, replacements); return; }
  const object = value as Row;
  if (typeof object.path === "string") for (const [from, to] of replacements) if (object.path === from || object.path.startsWith(`${from}.`)) { object.path = to + object.path.slice(from.length); break; }
  for (const child of Object.values(object)) rewritePaths(child, replacements);
}

/** Source-specific import adapter, no IO/formulas. Reuses the existing GOOD
 * validator, stat unit conversion, talent accounting and completeness contract.
 * Observed names/units are required; numeric property/position IDs are not guessed.
 */
export function importOfficialEquipmentObservation(text: string, options: { now?: string; fixture?: boolean } = {}): ImportResult {
  const failure = (code: "invalid-input" | "unsupported-format" | "secret-input", message: string): ImportResult => ({ ok: false, code, message });
  const parsed = readInput(text);
  if (!parsed.ok) return failure(parsed.secret ? "secret-input" : "invalid-input", "需要受限的纯配装观察 JSON；旧数据保持。");
  try {
    const root = row(parsed.value), observation = row(root.observations), characters = list(observation.characters).map(row), roster = list(observation.rosterIds), role = row(observation.role);
    if (observation.format !== "gidps-official-ui-observation/1") return failure("unsupported-format", "不支持此官方页面配装观察版本。");
    if (!["miyoushe", "hoyolab"].includes(String(observation.provider)) || !["official-ui-unverified", "synthetic-test"].includes(String(observation.evidence)) || typeof role.uid !== "string" || !/^[1-9]\d{8,9}$/.test(role.uid) || typeof role.server !== "string" || !/^[a-z][a-z0-9_]{1,39}$/.test(role.server)) return failure("invalid-input", "配装观察的范围信息无效；旧数据保持。");
    if (!characters.length || characters.length > 500 || roster.length !== characters.length || roster.some(id => !positiveId(id)) || new Set(roster).size !== roster.length || new Set(characters.map(c => c.id)).size !== characters.length || characters.some(c => !positiveId(c.id) || !roster.includes(c.id))) return failure("invalid-input", "本次角色列表与详细观察覆盖不一致；旧数据保持。");
    if (characters.some(c => c.relics != null && (!Array.isArray(c.relics) || c.relics.length > 5) || c.skills != null && (!Array.isArray(c.skills) || c.skills.length > 30))) return failure("invalid-input", "当前装备或技能观察结构无效；旧数据保持。");
    const weapons: Row[] = [], artifacts: Row[] = [], replacements: [string, string][] = [];
    const canonical = characters.map((character, i) => {
      const path = `observations.characters[${i}]`, key = keyFor("character", character.id) ?? `chronicle-avatar:${character.id}`, weapon = row(character.weapon);
      replacements.push([`characters[${i}]`, path]);
      if (weapon.id != null) { replacements.push([`weapons[${weapons.length}]`, `${path}.weapon`]); weapons.push({ key: keyFor("weapon", weapon.id) ?? `chronicle-weapon:${weapon.id}`, location: key, level: weapon.level, ascension: weapon.ascension, refinement: weapon.refinement }); }
      for (const [j, raw] of list(character.relics).entries()) {
        const relic = row(raw), item = positiveId(relic.id) ? catalog.relics[String(relic.id)] : undefined;
        replacements.push([`artifacts[${artifacts.length}]`, `${path}.relics[${j}]`]);
        const main = observedStat(relic.main, `${path}.relics[${j}].main`);
        artifacts.push({ setKey: keyFor("artifact", item?.[0]) ?? `chronicle-relic:${relic.id}`, slotKey: typeof relic.posName === "string" && Object.hasOwn(slotNames, relic.posName) ? slotNames[relic.posName] : "unknown-position", location: key, rarity: relic.rarity, level: relic.level, mainStatKey: main.key.value,
          substats: Array.isArray(relic.substats) ? relic.substats.map((value, k) => { const stat = observedStat(value, `${path}.relics[${j}].substats[${k}]`); return { key: stat.key.value, value: row(value).value === undefined ? undefined : stat.amount.unit === "ratio" && stat.amount.value !== null ? stat.amount.value * 100 : stat.amount.value ?? undefined }; }) : undefined });
      }
      // No character breakthrough or base talents are declared by the pinned model.
      return { key, level: character.level, constellation: character.constellation };
    });
    const result = importPlayerJson(JSON.stringify({ format: "GOOD", version: 3, characters: canonical, weapons, artifacts }), { ...options, fixture: options.fixture === true || root.syntheticFixture === true || observation.evidence === "synthetic-test" });
    if (!result.ok) return result;
    for (const [i, build] of result.snapshot.builds.entries()) {
      const source = characters[i]!, path = `observations.characters[${i}]`, weapon = row(source.weapon), skills = list(source.skills).map(row);
      const checks: Field<unknown>[] = build.completeness.issues.filter(issue => /唯一|重复|不匹配|冲突|未知圣遗物位置/.test(issue.note)).map(issue => field(null, issue.path, "unknown", issue.state, issue.note));
      rewritePaths(build, replacements); rewritePaths(checks, replacements);
      build.identity.path = `${path}.id`; build.weapon.identity.path = `${path}.weapon.id`;
      build.ascension = field<number>(null, `${path}.ascension`, "level", "missing", "固定来源模型未声明角色突破；不从95/100级推算");
      const mappings = catalog.mappings.filter(mapping => mapping.avatarId === source.id && mapping.skillOrder.every(id => skills.some(skill => skill.id === id)));
      if (new Set(skills.map(skill => skill.id)).size !== skills.length) return failure("invalid-input", "技能 ID 重复；不选择任意一项，旧数据保持。");
      for (const [j, skill] of skills.entries()) if (mappings.length !== 1 || !mappings[0]!.skillOrder.includes(skill.id as number)) checks.push(field(skill.id ?? null, `${path}.skills[${j}].id`, "identity", "unknown-id", "此技能 ID 尚未匹配固定战斗天赋目录；未用于计算"));
      for (const [j, name] of (["auto", "skill", "burst"] as const).entries()) {
        const id = mappings.length === 1 ? mappings[0]!.skillOrder[j] : undefined, index = id === undefined ? -1 : skills.findIndex(skill => skill.id === id), skill = skills[index];
        const skillPath = index < 0 ? `${path}.skills[missing:${name}]` : `${path}.skills[${index}]`;
        const level = skill?.displayedLevel, valid = typeof level === "number" && Number.isInteger(level) && level >= 1 && level <= 15 && skill?.unlocked === true;
        const talent: Talent = { accounting: "effective-only", base: field<number>(null, `${skillPath}.base`, "level", "missing", "只观察到显示等级；不按命座反推基础"), bonus: field<number>(null, `${skillPath}.bonus`, "level", "missing", "来源未明确附加等级，不按命座加算"), effective: field(typeof level === "number" ? level : null, `${skillPath}.displayedLevel`, "level", level == null ? "missing" : valid ? "known" : "invalid", "仅显示等级；不保证基础/附加拆分，不重复增加命座等级") };
        build.talents[name] = talent;
      }
      build.weapon.stats = [weapon.main, weapon.sub].filter(value => value != null).map((value, j) => observedStat(value, `${path}.weapon.${j === 0 && weapon.main != null ? "main" : "sub"}`));
      build.weapon.statsState = build.weapon.stats.length ? "observed" : "missing";
      for (const artifact of build.artifacts) {
        const candidates = list(source.relics).map((value, index) => ({ value: row(value), index })).filter(({ value }) => typeof value.posName === "string" && slotNames[value.posName] === artifact.slot);
        if (candidates.length !== 1) continue;
        const { value: relic, index } = candidates[0]!, artifactPath = `${path}.relics[${index}]`, item = positiveId(relic.id) ? catalog.relics[String(relic.id)] : undefined;
        artifact.item = field(positiveId(relic.id) ? { id: `relic:${relic.id}`, name: item?.[1] ?? "未知 ID" } : null, `${artifactPath}.id`, "identity", relic.id == null ? "missing" : item ? "known" : "unknown-id", "物品 ID 仅由固定目录解析；未知时阻断相关计算");
        const main = observedStat(relic.main, `${artifactPath}.main`);
        artifact.identity.path = `${artifactPath}.id`;
        artifact.main.amount = main.amount;
        if (artifact.main.key.state === "known") artifact.main.key = main.key;
        else if (main.key.state !== "known") artifact.main.key = main.key;
        artifact.main.key.path = main.key.path;
        checks.push(artifact.item, artifact.main.amount);
        for (const [j, stat] of artifact.substats.entries()) {
          const normalized = observedStat(list(relic.substats)[j], `${artifactPath}.substats[${j}]`);
          stat.amount = normalized.amount;
          if (stat.key.state === "known" || normalized.key.state !== "known") stat.key = normalized.key;
          stat.key.path = normalized.key.path;
        }
      }
      checks.push(...Object.values(build.talents).flatMap(talent => [talent.bonus, talent.effective]));
      build.completeness = assessImportedBuildCompleteness(build, true, checks);
    }
    result.snapshot.source = { ...result.snapshot.source, kind: "official-ui-observation", uid: role.uid };
    result.snapshot.notices = ["本次纯配装观察：仅当前装备，不导入背包或历史；角色列表与详情一致也不证明全账号覆盖或真实登录成功。", "只凭本次 property_map 明确名称、显式百分号及 pos_name 映射，不猜数字位置/词条编号。", "基础天赋、附加等级和角色突破仍须来源明确；缺失保持未知，显示等级不重复加命座。"];
    return result;
  } catch { return failure("invalid-input", "配装观察结构无效；旧数据保持。"); }
}
