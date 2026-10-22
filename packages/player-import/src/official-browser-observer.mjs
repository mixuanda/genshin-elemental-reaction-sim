import identities from "../../game-data/sources/build-import/identity-maps.json" with { type: "json" };
import { readInput } from "./input.ts";

// Passive observation only. These paths come from the pinned clients linked in
// AUTHORIZATION.md. This module never sends a request or accesses a browser.
const targets = {
  miyoushe: {
    roles: ["https://api-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie", "https://passport-api.mihoyo.com/binding/api/getUserGameRolesByCookieToken"],
    record: "https://api-takumi-record.mihoyo.com/game_record/app/genshin/api/", biz: "hk4e_cn",
  },
  hoyolab: {
    roles: ["https://api-os-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie", "https://api-account-os.hoyolab.com/binding/api/getUserGameRolesByCookieToken"],
    record: "https://sg-public-api.hoyolab.com/event/game_record/genshin/api/", biz: "hk4e_global",
  },
};
const characterKeys = new Map(Object.entries(identities.character).map(([key, id]) => [id, key]));
const weaponKeys = new Map(Object.entries(identities.weapon).map(([key, id]) => [id, key]));
const object = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const sameRole = (a, b) => a?.uid === b?.uid && a?.server === b?.server;
const error = code => ({ ok: false, code });

export function matchOfficialEquipmentResponse(provider, url, method) {
  const config = Object.hasOwn(targets, provider) ? targets[provider] : null;
  if (!config || typeof url !== "string" || url.length > 4096) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) return null;
    const endpoint = parsed.origin + parsed.pathname;
    if (method === "GET" && config.roles.includes(endpoint)) return "roles";
    if (method === "POST" && endpoint === `${config.record}character/list`) return "roster";
    if (method === "POST" && endpoint === `${config.record}character/detail`) return "details";
  } catch { /* Unrecognized targets are never inspected. */ }
  return null;
}

function observedNumber(source, key, min, max) {
  const value = source[key];
  if (value === undefined || value === null) return undefined;
  if (!integer(value, min, max)) throw new Error("invalid-data");
  return value;
}
function observedText(value, max = 80) {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : undefined;
}
function observedStat(raw, propertyMap, weapon = false) {
  if (raw === undefined || raw === null) return undefined;
  const value = object(raw);
  const id = observedNumber(value, "property_type", 1, 100_000), definition = object(propertyMap[String(id)]);
  const amount = weapon ? value.final : value.value;
  return { property_type: id, value: observedText(amount, 40),
    name: definition.property_type === id ? observedText(definition.name) : undefined,
    metadataMismatch: definition.property_type !== undefined && definition.property_type !== id ? true : undefined,
    ...(weapon ? { base: observedText(value.base, 40), add: observedText(value.add, 40) } : {}) };
}
function observeCharacter(raw, propertyMap) {
  const value = object(raw), base = object(value.base), weapon = object(value.weapon);
  if (!integer(base.id, 1, 1_000_000_000) || value.relics != null && (!Array.isArray(value.relics) || value.relics.length > 5) || value.skills != null && (!Array.isArray(value.skills) || value.skills.length > 30)) throw new Error("invalid-data");
  return {
    id: base.id, level: observedNumber(base, "level", 1, 100),
    constellation: observedNumber(base, "actived_constellation_num", 0, 6),
    weapon: {
      id: observedNumber(weapon, "id", 1, 1_000_000_000), level: observedNumber(weapon, "level", 1, 90),
      ascension: observedNumber(weapon, "promote_level", 0, 6), refinement: observedNumber(weapon, "affix_level", 1, 5),
      main: observedStat(weapon.main_property, propertyMap, true), sub: observedStat(weapon.sub_property, propertyMap, true),
    },
    // Retain source observations, without guessing numeric slot/stat identities
    // or whether displayed skill levels include constellation bonuses.
    relics: value.relics?.map(rawRelic => {
      const relic = object(rawRelic);
      if (relic.sub_property_list != null && (!Array.isArray(relic.sub_property_list) || relic.sub_property_list.length > 4)) throw new Error("invalid-data");
      return { id: observedNumber(relic, "id", 1, 1_000_000_000), pos: observedNumber(relic, "pos", 1, 5),
        posName: observedText(relic.pos_name),
        level: observedNumber(relic, "level", 0, 20), rarity: observedNumber(relic, "rarity", 1, 5),
        setId: observedNumber(object(relic.set), "id", 1, 1_000_000_000),
        main: observedStat(relic.main_property, propertyMap), substats: relic.sub_property_list?.map(stat => observedStat(stat, propertyMap)) };
    }),
    skills: value.skills?.map(rawSkill => {
      const skill = object(rawSkill);
      if (skill.is_unlock != null && typeof skill.is_unlock !== "boolean") throw new Error("invalid-data");
      return { id: observedNumber(skill, "skill_id", 1, 1_000_000_000), type: observedNumber(skill, "skill_type", 0, 100),
        displayedLevel: observedNumber(skill, "level", 0, 15), unlocked: skill.is_unlock };
    }),
  };
}

/** No claimed login state: success means bounded observations were collected.
 * The caller must already have a fresh, explicitly authorized official UI.
 * The local deadline is our retention policy, not a provider-issued expiry.
 */
export function createOfficialEquipmentObserver({ provider, evidence = "official-ui-unverified", now = Date.now, maxDurationMs = 600_000 }) {
  if (!Object.hasOwn(targets, provider) || !["official-ui-unverified", "synthetic-test"].includes(evidence) || !integer(maxDurationMs, 1, 600_000)) throw new Error("invalid-options");
  const deadline = now() + maxDurationMs;
  let roles = [], selected = null, roster = null, details = new Map(), closed = false, problem = null, accepted = 0;
  const clear = code => { roles = []; selected = null; roster = null; details.clear(); closed = true; problem = code; };
  const ready = () => {
    if (!closed && now() >= deadline) clear("local-deadline");
    return !closed;
  };
  return {
    inspect: () => {
      ready();
      return { status: closed ? "closed" : selected ? "observing-equipment" : "select-role", problem,
        roles: structuredClone(roles), selected: structuredClone(selected), rosterCount: roster?.length ?? 0,
        detailCount: details.size, localDeadline: new Date(deadline).toISOString(), realLoginVerified: false };
    },
    selectRole(role) {
      if (!ready()) return error(problem ?? "closed");
      const known = roles.find(candidate => sameRole(candidate, role));
      if (!known) return error("role-required");
      selected = structuredClone(known); roster = null; details.clear();
      return { ok: true };
    },
    observe({ url, method, requestBody = null, status, responseBody }) {
      if (!ready()) return error(problem ?? "closed");
      const target = matchOfficialEquipmentResponse(provider, url, method);
      if (!target) return { ok: true, ignored: true };
      if (++accepted > 500) { clear("observation-limit"); return error(problem); }
      if (status === 429) { clear("rate-limited"); return error(problem); }
      if (status !== 200) { clear("provider-failed"); return error(problem); }
      const parsed = typeof responseBody === "string" ? readInput(responseBody) : { ok: false };
      if (!parsed.ok) { clear("invalid-or-sensitive-data"); return error(problem); }
      const payload = object(parsed.value);
      if ([10035, 5003, 10041, 1034].includes(payload.retcode) || object(object(payload.data).gt_result).challenge) { clear("challenge-required"); return error(problem); }
      if ([-110, 1028, 10101, -500004].includes(payload.retcode)) { clear("rate-limited"); return error(problem); }
      if ([-100, 10001, 10103].includes(payload.retcode)) { clear("login-required"); return error(problem); }
      if (payload.retcode !== 0) { clear("provider-failed"); return error(problem); }
      const list = object(payload.data).list;
      if (!Array.isArray(list) || list.length > 500) { clear("invalid-data"); return error(problem); }
      try {
        if (target === "roles") {
          const next = list.filter(item => object(item).game_biz === targets[provider].biz).map(raw => {
            const role = object(raw), uid = typeof role.game_uid === "number" ? String(role.game_uid) : role.game_uid;
            if (typeof uid !== "string" || !/^[1-9]\d{8,9}$/.test(uid) || typeof role.region !== "string" || !/^[a-z][a-z0-9_]{1,39}$/.test(role.region)) throw new Error("invalid-data");
            return { uid, server: role.region };
          });
          if (next.length > 100 || new Set(next.map(role => `${role.uid}/${role.server}`)).size !== next.length) throw new Error("invalid-data");
          // Never switch an explicitly selected role after an account change.
          if (selected && !next.some(role => sameRole(role, selected))) { clear("role-changed"); return error(problem); }
          roles = next;
          return { ok: true };
        }
        if (!selected) return { ok: true, ignored: true };
        const body = typeof requestBody === "string" ? readInput(requestBody) : { ok: false };
        if (!body.ok) throw new Error("invalid-data");
        const params = object(body.value), query = new URL(url).searchParams;
        // Binding data and the actual official request must agree. No UID-prefix inference.
        if (String(params.role_id) !== selected.uid || params.server !== selected.server ||
          (query.has("role_id") && query.get("role_id") !== selected.uid) ||
          (query.has("server") && query.get("server") !== selected.server)) return { ok: true, ignored: true };
        if (target === "roster") {
          const ids = list.map(raw => object(raw).id);
          if (!ids.length || ids.some(id => !integer(id, 1, 1_000_000_000)) || new Set(ids).size !== ids.length) throw new Error("invalid-data");
          if (roster && (ids.length !== roster.length || ids.some(id => !roster.includes(id)))) { clear("roster-changed"); return error(problem); }
          roster = ids;
        } else {
          if (!Array.isArray(params.character_ids) || !params.character_ids.length || params.character_ids.length > 500 || new Set(params.character_ids).size !== params.character_ids.length) throw new Error("invalid-data");
          const propertyMap = object(object(payload.data).property_map);
          const observed = list.map(character => observeCharacter(character, propertyMap)), returned = observed.map(character => character.id);
          if (returned.length !== params.character_ids.length || new Set(returned).size !== returned.length || returned.some(id => !params.character_ids.includes(id))) throw new Error("invalid-data");
          for (const character of observed) details.set(character.id, character);
        }
        return { ok: true };
      } catch { clear("invalid-data"); return error(problem); }
    },
    finish() {
      if (!ready()) return error(problem ?? "closed");
      if (!selected) return error("role-required");
      if (!roster || roster.length !== details.size || roster.some(id => !details.has(id))) return error("partial-coverage");
      const observed = roster.map(id => details.get(id));
      const good = { format: "GOOD", version: 3, source: "GIDPS official UI observer; field mapping incomplete",
        syntheticFixture: evidence === "synthetic-test",
        characters: observed.map(character => ({ key: characterKeys.get(character.id) ?? `chronicle-avatar:${character.id}`,
          level: character.level, constellation: character.constellation })),
        weapons: observed.filter(character => character.weapon.id !== undefined).map(character => ({
          key: weaponKeys.get(character.weapon.id) ?? `chronicle-weapon:${character.weapon.id}`,
          location: characterKeys.get(character.id) ?? `chronicle-avatar:${character.id}`,
          level: character.weapon.level, ascension: character.weapon.ascension, refinement: character.weapon.refinement })),
        artifacts: [],
        observations: { format: "gidps-official-ui-observation/1", provider, role: selected, evidence, rosterIds: roster, characters: observed,
          limitations: ["角色突破未确认；不从等级推算。", "天赋仅保留显示等级与解锁状态，未确认基础/附加拆分。", "GIDPS 导入器只按明确的 property_map 名称、百分号和 pos_name 映射词条；缺少元数据或未支持的格式保持未知。", "角色覆盖校验仅比较本次官方列表与详细响应，不证明提供方列表覆盖全部已拥有角色。"] },
      };
      const result = JSON.stringify(good, null, 2);
      if (!readInput(result).ok) { clear("output-limit"); return error(problem); }
      clear("completed");
      return { ok: true, goodJson: result };
    },
    close() { clear("cancelled"); },
  };
}
