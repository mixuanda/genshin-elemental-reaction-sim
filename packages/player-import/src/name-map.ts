import { catalog } from "./catalog";

type Kind = "character" | "weapon" | "artifact";
// Exact normalized aliases only. Collisions stay ambiguous; no substring/fuzzy matching.
const canonical = (text: string) => text.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[\s'’\-·.,:!?「」『』"“”]/gu, "");
const aliases: Record<Kind, Map<string, Set<number>>> = { character: new Map(), weapon: new Map(), artifact: new Map() };
function add(kind: Kind, name: string, id: number): void {
  const k = canonical(name), ids = aliases[kind].get(k) ?? new Set<number>();
  ids.add(id); aliases[kind].set(k, ids);
}
for (const kind of ["character", "weapon", "artifact"] as const) for (const [name, id] of Object.entries(catalog.good[kind])) add(kind, name, id);
for (const c of catalog.characters.values()) add("character", c.name, c.avatarId);
for (const w of catalog.weapons.values()) add("weapon", w.name, w.itemId);
for (const s of catalog.sets.values()) add("artifact", s.name, s.numericId);

export function resolveEquipmentName(kind: Kind, name: string): { id: number | null; goodKey: string | null; state: "known" | "unknown-id"; note: string } {
  const ids = aliases[kind].get(canonical(name));
  const id = ids?.size === 1 ? [...ids][0]! : null;
  const goodKey = id === null ? null : Object.entries(catalog.good[kind]).find(([, candidate]) => candidate === id)?.[0] ?? null;
  return { id, goodKey, state: id !== null && goodKey !== null ? "known" : "unknown-id", note: ids && ids.size > 1 ? "名称对应多个身份，拒绝猜测" : id === null ? "当前固定目录与名称别名未识别" : "中文目录名或 GOOD 英文键精确规范化匹配；不做模糊匹配" };
}
