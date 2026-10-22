import { containsSecrets, MAX_INPUT_BYTES } from "./input";
import { importPlayerJson, parseTalentNotation } from "./normalize";
import { resolveEquipmentName } from "./name-map";
import { catalog } from "./catalog";
import { slots, type Field, type ImportResult, type PlayerBuild, type Slot, type Stat, type Talent } from "./model";

export interface TextImportOptions { now?: string; fixture?: boolean }
interface Line { text: string; number: number }
interface ParsedStat { key: string; label: string; amount: number | undefined; percent: boolean; expected: "flat" | "ratio" | "unknown"; path: string }
interface Profile { name: string; level?: number; rarity?: number; rank?: number; path: string }
interface ParsedArtifact { slot: Slot; name: string; rarity: number; level: number; main: ParsedStat; substats: ParsedStat[] | undefined; path: string }
interface CharacterText { character: Profile; talents: (Talent | null)[]; weapon: Profile | undefined; weaponStats: ParsedStat[]; panel: ParsedStat[]; artifacts: ParsedArtifact[] }
class TextFormatError extends Error { constructor(readonly code: "unsupported-format" | "invalid-input") { super("unsupported or invalid equipment text"); } }
const unsupported = (): never => { throw new TextFormatError("unsupported-format"); };
const invalid = (): never => { throw new TextFormatError("invalid-input"); };
const at = (line: Line) => `text.line:${line.number}`;
const f = <T>(value: T | null, path: string, unit: Field<T>["unit"], state: Field<T>["state"] = value === null ? "missing" : "known", note = "源文本显式提供；不补默认值"): Field<T> => ({ state, value, path, unit, note });
const artEmoji: Record<string, Slot> = { "🌷": "flower", "🪶": "plume", "⏳": "sands", "🍷": "goblet", "👑": "circlet" };
const labels: Record<string, string> = {
  "HP": "hp", "ATK": "atk", "DEF": "def", "Base ATK": "baseAtk", "Elemental Mastery": "eleMas",
  "CRIT Rate": "critRate_", "CRIT DMG": "critDMG_", "Healing Bonus": "heal_", "Incoming Healing Bonus": "incomingHeal_", "Energy Recharge": "enerRech_",
  "Physical DMG Bonus": "physical_dmg_", "Pyro DMG Bonus": "pyro_dmg_", "Hydro DMG Bonus": "hydro_dmg_", "Cryo DMG Bonus": "cryo_dmg_", "Electro DMG Bonus": "electro_dmg_", "Anemo DMG Bonus": "anemo_dmg_", "Geo DMG Bonus": "geo_dmg_", "Dendro DMG Bonus": "dendro_dmg_"
};

export function resolveEquipmentDisplayStatLabel(label: string, percent: boolean): string | null {
  let result = Object.hasOwn(labels, label) ? labels[label]! : null;
  if (result !== null && ["hp", "atk", "def"].includes(result) && percent) result += "_";
  return result;
}
function parseStat(text: string, path: string): ParsedStat {
  const match = text.match(/^([^:\[\]]{1,100}):\s*(\?|[-+]?\d+(?:\.\d+)?)\s*(%)?$/u);
  if (!match) return unsupported();
  const label = match[1]!.trim(), percent = match[3] === "%";
  const key = resolveEquipmentDisplayStatLabel(label, percent) ?? `hutao-stat:${label}`;
  const expected = key.startsWith("hutao-stat:") ? "unknown" : key.endsWith("_") ? "ratio" : "flat";
  const amount = match[2] === "?" ? undefined : Number(match[2]);
  if (amount !== undefined && !Number.isFinite(amount)) return invalid();
  return { key, label, amount, percent, expected, path };
}
function groups(line: Line): ParsedStat[] {
  const text = line.text, entries = [...text.matchAll(/\[([^\[\]]*)\]/gu)];
  if (!entries.length || text.replace(/\[[^\[\]]*\]/gu, "").trim()) return unsupported();
  return entries.map((entry, i) => parseStat(entry[1]!, `${at(line)}.stat[${i}]`));
}
function profile(line: Line, kind: "character" | "weapon"): { value: Profile; talentText: string | undefined } {
  const m = line.text.match(/^([^\[\]]{1,120}?)\s*\[([^\[\]]*)\](?:\s*\[([^\[\]]*)\])?$/u);
  if (!m || kind === "weapon" && m[3] !== undefined) return unsupported();
  const result: Profile = { name: m[1]!.trim(), path: at(line) };
  const seen = new Set<string>();
  for (const token of m[2]!.split(",").map(t => t.trim()).filter(Boolean)) {
    const part = token.match(/^(Lv\.|☆|C|R)\s*(\d+|\?)$/u);
    if (!part || kind === "character" && part[1] === "R" || kind === "weapon" && part[1] === "C") return unsupported();
    if (seen.has(part[1]!)) return invalid();
    seen.add(part[1]!);
    if (part[2] === "?") continue;
    const value = Number(part[2]);
    if (!Number.isSafeInteger(value)) return invalid();
    if (part[1] === "Lv.") result.level = value;
    else if (part[1] === "☆") result.rarity = value;
    else result.rank = value;
  }
  if (!seen.size) return unsupported();
  return { value: result, talentText: m[3] };
}
function parseBlock(lines: Line[]): CharacterText {
  const first = lines[0]; if (!first) return unsupported();
  const header = profile(first, "character"), talents: (Talent | null)[] = [];
  if (header.talentText !== undefined) {
    const parts = header.talentText.split(",").map(t => t.trim());
    if (parts.length > 3) return unsupported();
    for (const [i, part] of parts.entries()) {
      if (part === "?" || part === "") { talents.push(null); continue; }
      const talent = parseTalentNotation(part);
      if (!talent) return invalid();
      for (const [key, value] of Object.entries(talent)) if (typeof value === "object" && value !== null) (value as Field<number>).path = `${at(first)}.talent[${i}].${key}`;
      talents.push(talent);
    }
  }
  const result: CharacterText = { character: header.value, talents, weapon: undefined, weaponStats: [], panel: [], artifacts: [] };
  let phase: "before-weapon" | "weapon" | "panel" | "artifacts" = "before-weapon";
  let pending: ParsedArtifact | undefined;
  for (const line of lines.slice(1)) {
    if (/^-{3,}$/u.test(line.text)) { if (phase === "weapon") phase = "panel"; else if (phase === "panel") phase = "artifacts"; continue; }
    const art = line.text.match(/^(🌷|🪶|⏳|🍷|👑)\s+(.+?)\s+\[☆(\d)\s+\+(\d+)\s+([^\[\]]{1,120})\]$/u);
    if (art) {
      phase = "artifacts";
      pending = { slot: artEmoji[art[1]!]!, name: art[5]!.trim(), rarity: Number(art[3]), level: Number(art[4]), main: parseStat(art[2]!, `${at(line)}.main`), substats: undefined, path: at(line) };
      result.artifacts.push(pending); continue;
    }
    if (line.text.startsWith("[")) {
      const values = groups(line);
      if (phase === "artifacts") {
        if (!pending) return unsupported();
        pending.substats = [...(pending.substats ?? []), ...values];
      } else if (phase === "weapon") result.weaponStats.push(...values);
      else { phase = "panel"; result.panel.push(...values); }
      continue;
    }
    if (phase !== "before-weapon" || result.weapon) return unsupported();
    result.weapon = profile(line, "weapon").value; phase = "weapon";
  }
  return result;
}
function statValue(s: ParsedStat): Stat {
  const unknown = s.expected === "unknown";
  const valid = s.amount !== undefined && s.amount >= 0 && (unknown || (s.expected === "ratio") === s.percent);
  const state = s.amount === undefined ? "missing" : !valid ? "invalid" : unknown ? "unknown-id" : "known";
  return {
    key: f(s.key, `${s.path}.label`, "identity", unknown ? "unknown-id" : "known", unknown ? "未识别的词条标签；保留可见，不猜测身份" : `文本标签映射：${s.label}`),
    amount: f(s.amount === undefined ? null : s.expected === "ratio" && s.percent ? s.amount / 100 : s.amount, `${s.path}.value`, s.expected, state, s.amount === undefined ? "文本没有数值" : !valid ? "数值非负性或百分号单位不匹配" : unknown ? "未知身份，保留源数字，不转换为计算单位" : s.percent ? "文本百分数除以 100 为比例；只转换一次" : "源平铺数值原样保留")
  };
}
function rewritePaths(value: unknown, replacements: [string, string][]): void {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "path" && typeof child === "string") {
      const match = replacements.find(([prefix]) => child.startsWith(prefix));
      if (match) (value as Record<string, unknown>)[key] = match[1] + child.slice(match[0].length);
    } else rewritePaths(child, replacements);
  }
}
function textCompleteness(build: PlayerBuild, checks: { path: string; state: Field<unknown>["state"]; note: string }[]): PlayerBuild["completeness"] {
  const fields: Field<unknown>[] = [build.identity, build.level, build.ascension, build.constellation, build.weapon.identity, build.weapon.level, build.weapon.ascension, build.weapon.refinement];
  if (build.rarity) fields.push(build.rarity);
  if (build.weapon.rarity) fields.push(build.weapon.rarity);
  for (const t of Object.values(build.talents)) fields.push(t.base, t.bonus, t.effective);
  for (const a of build.artifacts) fields.push(a.identity, a.rarity, a.level, a.main.key, a.main.amount, a.substatsState, ...a.substats.flatMap(s => [s.key, s.amount]));
  fields.push(...build.weapon.stats.flatMap(s => [s.key, s.amount]));
  const issues = [...fields.filter(v => v.state !== "known").map(v => ({ path: v.path, state: v.state, note: v.note })), ...checks];
  return { state: issues.length ? "partial" : "complete", known: fields.filter(v => v.state === "known").length, required: fields.length + checks.length, issues };
}

/** Strict small grammar derived from the publicly documented clipboard format, no client code. */
export function importPlayerText(text: string, options: TextImportOptions = {}): ImportResult {
  if (containsSecrets(text)) return { ok: false, code: "secret-input", message: "文本疑似包含会话秘密，已拒绝；请仅提供纯配装。" };
  if (new TextEncoder().encode(text).length > MAX_INPUT_BYTES) return { ok: false, code: "invalid-input", message: "文本超过 2 MB 限制。旧数据保持。" };
  try {
    let body = text.replace(/^\uFEFF/u, "");
    const first = body.search(/\S/u), last = body.search(/\s*$/u) - 1;
    if (first >= 0 && body[first] === "`" && body.slice(first, first + 3) !== "```" && body[last] === "`" && last > first) body = body.slice(0, first) + body.slice(first + 1, last) + body.slice(last + 1);
    const rawLines = body.split(/\r?\n/u);
    if (rawLines.length > 20_000 || rawLines.some(line => line.length > 4000)) return invalid();
    let fixture = options.fixture === true;
    const lines: Line[] = [];
    for (const [i, raw] of rawLines.entries()) {
      const cleaned = raw.trim().replace(/^\/\/\s?/u, "").trim();
      if (!cleaned) continue;
      if (cleaned === "GIDPS SYNTHETIC FIXTURE - NOT A PLAYER ACCOUNT") { fixture = true; continue; }
      lines.push({ text: cleaned, number: i + 1 });
    }
    // Accept only a complete Markdown text fence wrapper, not arbitrary embedded prose/code.
    if (lines[0]?.text === "```text" || lines[0]?.text === "```") {
      if (lines.at(-1)?.text !== "```") return unsupported();
      lines.shift(); lines.pop();
    }
    const blocks: Line[][] = []; let block: Line[] = [];
    for (const line of lines) {
      if (/^={3,}$/u.test(line.text)) { if (block.length) { blocks.push(block); block = []; } }
      else block.push(line);
    }
    if (block.length) blocks.push(block);
    if (!blocks.length || blocks.length > 500) return { ok: false, code: "empty-import", message: "文本中没有可预览角色，或数量超出限制。" };
    const parsed = blocks.map(parseBlock);
    const weapons: unknown[] = [], artifacts: unknown[] = [];
    const replacements: [string, string][] = [];
    const characters = parsed.map((p, i) => {
      replacements.push([`characters[${i}]`, p.character.path]);
      if (p.weapon) {
        replacements.push([`weapons[${weapons.length}]`, p.weapon.path]);
        weapons.push({ key: resolveEquipmentName("weapon", p.weapon.name).goodKey ?? p.weapon.name, location: `text-character-${i}`, level: p.weapon.level, refinement: p.weapon.rank });
      }
      for (const a of p.artifacts) {
        replacements.push([`artifacts[${artifacts.length}]`, a.path]);
        artifacts.push({ setKey: resolveEquipmentName("artifact", a.name).goodKey ?? a.name, slotKey: a.slot, location: `text-character-${i}`, rarity: a.rarity, level: a.level, mainStatKey: a.main.key, substats: a.substats?.map(s => ({ key: s.key, value: s.amount })) });
      }
      // GOOD association keys are replaced below with resolved character keys; no invented IDs reach output.
      return { key: resolveEquipmentName("character", p.character.name).goodKey ?? p.character.name, level: p.character.level, constellation: p.character.rank, talent: { auto: p.talents[0]?.base.value ?? undefined, skill: p.talents[1]?.base.value ?? undefined, burst: p.talents[2]?.base.value ?? undefined } };
    });
    for (const collection of [weapons, artifacts]) for (const item of collection as Record<string, unknown>[]) {
      const i = Number(String(item.location).slice("text-character-".length)); item.location = characters[i]!.key;
    }
    const jsonOptions = options.now === undefined ? { fixture } : { fixture, now: options.now };
    const result = importPlayerJson(JSON.stringify({ format: "GOOD", version: 3, source: "independent-hutao-text-adapter", characters, weapons, artifacts }), jsonOptions);
    if (!result.ok) return result;
    for (const [i, build] of result.snapshot.builds.entries()) {
      const p = parsed[i]!;
      const structuralChecks = build.completeness.issues.filter(issue => /唯一|重复|不匹配/u.test(issue.note));
      rewritePaths(build, replacements);
      build.rarity = p.character.rarity === undefined ? f<number>(null, `${p.character.path}.rarity`, "count") : f(p.character.rarity, `${p.character.path}.rarity`, "count", p.character.rarity >= 1 && p.character.rarity <= 5 ? "known" : "invalid");
      build.weapon.rarity = p.weapon?.rarity === undefined ? f<number>(null, `${p.weapon?.path ?? p.character.path}.weapon.rarity`, "count") : f(p.weapon.rarity, `${p.weapon.path}.rarity`, "count", p.weapon.rarity >= 1 && p.weapon.rarity <= 5 ? "known" : "invalid");
      const characterId = resolveEquipmentName("character", p.character.name).id, weaponId = p.weapon ? resolveEquipmentName("weapon", p.weapon.name).id : null;
      const characterRarity = characterId === null ? undefined : catalog.characters.get(characterId)?.rarity;
      const weaponRarity = weaponId === null ? undefined : catalog.weapons.get(weaponId)?.rarity;
      for (const [source, expected] of [[build.rarity, characterRarity], [build.weapon.rarity, weaponRarity]] as const) if (source.state === "known" && expected !== undefined && source.value !== expected) { source.state = "invalid"; source.note = "源文本星级与该目录身份冲突"; }
      build.ascension = f<number>(null, `${p.character.path}.ascension`, "level", "missing", "公开文本未导出角色突破；不从等级推算");
      build.weapon.ascension = f<number>(null, `${p.weapon?.path ?? p.character.path}.ascension`, "level", "missing", "公开文本未导出武器突破；不从等级推算");
      for (const [j, name] of (["auto", "skill", "burst"] as const).entries()) build.talents[name] = p.talents[j] ?? { base: f<number>(null, `${p.character.path}.talent[${j}]`, "level"), bonus: f<number>(null, `${p.character.path}.talent[${j}]`, "level"), effective: f<number>(null, `${p.character.path}.talent[${j}]`, "level"), accounting: "effective-only" };
      build.weapon.stats = p.weaponStats.map(statValue); build.weapon.statsState = p.weaponStats.length ? "observed" : "missing";
      const weaponKeys = new Set<string>();
      for (const s of build.weapon.stats) {
        if (s.key.value && weaponKeys.has(s.key.value)) structuralChecks.push({ path: s.key.path, state: "invalid", note: "重复武器词条；不任取最后一项" });
        if (s.key.value) weaponKeys.add(s.key.value);
      }
      for (const a of build.artifacts) {
        const source = p.artifacts.find(candidate => candidate.slot === a.slot);
        if (!source) { rewritePaths(a, [["artifacts[missing:", `${p.character.path}.artifacts[missing:`]]); continue; }
        a.item.note = "公开纯配装文本未导出 Enka 物品 ID；套装名称与位置单独映射";
        const main = statValue(source.main); a.main.amount = main.amount;
        a.main.key.path = main.key.path; a.main.key.note = a.main.key.state === "known" ? main.key.note : `${a.main.key.note}；${main.key.note}`;
        for (const [j, sub] of a.substats.entries()) {
          const sourceSub = source.substats?.[j]; if (!sourceSub) continue;
          const normalized = statValue(sourceSub); sub.amount = normalized.amount; sub.key.path = normalized.key.path; sub.key.note = sub.key.state === "known" ? normalized.key.note : `${sub.key.note}；${normalized.key.note}`;
        }
      }
      build.panel = { state: p.panel.length ? "observed" : "missing", accounting: "unverified-text-observation", stats: p.panel.map(statValue) };
      const panelKeys = new Set<string>();
      for (const s of build.panel.stats) {
        if (s.key.value && panelKeys.has(s.key.value)) structuralChecks.push({ path: s.key.path, state: "invalid", note: "重复面板字段；不任取最后一项" });
        if (s.key.value) panelKeys.add(s.key.value);
      }
      for (const key of ["hp", "atk", "def", "eleMas", "critRate_", "critDMG_", "enerRech_"]) if (!panelKeys.has(key)) build.panel.stats.push({ key: f(key, `${p.character.path}.panel.${key}`, "identity"), amount: f<number>(null, `${p.character.path}.panel.${key}`, key.endsWith("_") ? "ratio" : "flat", "missing", "源文本未提供此面板字段") });
      if (build.identity.state === "known") build.identity.note += "；源文本名称通过精确别名解析";
      build.completeness = textCompleteness(build, structuralChecks);
    }
    result.snapshot.source.kind = "hutao-text";
    result.snapshot.notices = ["纯配装文本只代表所贴角色当前装备；不证明已登录、全部账号、背包或历史。", "文本面板标签的游戏记账语义未经核验，不自动视为最终面板，也不与装备贡献叠加。", "公开格式不含角色/武器突破；保持未知。裸天赋只确认显示等级，括号明确拆分才确认基础与附加。", "只支持文档说明的英文标签、五个圣遗物图标与块结构；未知行不会被静默忽略。", "导入时间不是游戏快照时间。"];
    return result;
  } catch (error) {
    return { ok: false, code: error instanceof TextFormatError ? error.code : "invalid-input", message: "文本结构或数值不受支持；未保留或回显原文，旧数据保持。" };
  }
}
