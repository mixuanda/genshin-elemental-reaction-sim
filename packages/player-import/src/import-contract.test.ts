import { describe, expect, it, vi } from "vitest";
import good from "../fixtures/synthetic-good.json" with { type: "json" };
import enka from "../fixtures/synthetic-enka.json" with { type: "json" };
import { applyPreview, createAuthorizedFixtureAdapter, fetchEnkaUid } from "./adapters";
import { importPlayerJson, parseTalentNotation } from "./normalize";
import type { ImportResult } from "./model";

const json = (v: unknown) => JSON.stringify(v);
function success(result: ImportResult) { if (!result.ok) throw new Error("Expected successful fixture normalization"); return result.snapshot; }
const build = (v: unknown) => success(importPlayerJson(json(v))).builds[0]!;

describe("credential-free player equipment import contract (synthetic fixtures only)", () => {
  it("normalizes a complete GOOD snapshot without claiming a full account, inventory, history or computed panel", () => {
    const s = success(importPlayerJson(json(good), { now: "2026-10-21T16:30:00.000Z", fixture: true }));
    expect(s.source).toMatchObject({ kind: "good-file", scope: "file-equipped-subset", inventory: "not-imported", history: "not-imported", fetchedAt: null, snapshotAt: null, fixture: true });
    const b = s.builds[0]!;
    expect(b.completeness).toMatchObject({ state: "complete", issues: [] });
    expect(b.level.value).toBe(90);
    expect(b.constellation).toMatchObject({ state: "known", value: 0 });
    expect(b.talents.skill).toMatchObject({ base: { value: 10 }, bonus: { state: "not-exported", value: null }, effective: { state: "not-exported", value: null } });
    expect(b.panel.state).toBe("not-exported");
    expect(b.artifacts[0]!.main.amount.state).toBe("not-exported");
    expect(b.artifacts[0]!.substats[0]!.amount).toMatchObject({ state: "known", value: 0, unit: "flat" });
    expect(b.artifacts[0]!.substats[1]!.amount).toMatchObject({ value: 0.105, unit: "ratio" });
    expect(b.weapon.statsState).toBe("not-exported");
  });
  it("normalizes Enka levels, refinement and units and counts explicit talent bonus once", () => {
    const s = success(importPlayerJson(json(enka), { fetchedAt: "2026-10-21T16:31:00Z", viaUid: true, fixture: true }));
    expect(s.source).toMatchObject({ kind: "enka-uid", scope: "public-showcase", snapshotAt: null });
    const b = s.builds[0]!;
    expect(b.completeness.issues).toEqual([]);
    expect(b.level.path).toContain("4001.val");
    expect(b.weapon.refinement.value).toBe(5);
    expect(b.weapon.stats[1]!.amount.unit).toBe("ratio");
    expect(b.weapon.stats[1]!.amount.value).toBeCloseTo(0.352, 12);
    expect(b.artifacts[0]!.level).toMatchObject({ value: 20, note: expect.stringContaining("减 1") });
    expect(b.artifacts[0]!.main.amount.value).toBe(4780);
    expect(b.artifacts[2]!.main.amount.value).toBe(0.466);
    expect(b.talents.skill).toMatchObject({ base: { value: 10 }, bonus: { value: 3 }, effective: { value: 13 } });
    expect(b.talents.auto.effective.value).toBe(10);
    expect(b.panel.stats.find(s => s.key.value === "critRate_")!.amount.value).toBe(0.404);
    expect(b.panel.stats.find(s => s.key.value === "eleMas")!.amount.value).toBe(0);
    expect(b.panel.stats.find(s => s.key.value === "pyro_dmg_")!.amount).toMatchObject({ state: "missing", value: null });
  });
  it.each(["13 (10 +3)", "13（10+3）", "Lv.13 (10 +3)"])("retains base/effective notation once: %s", notation => {
    expect(parseTalentNotation(notation)).toMatchObject({ base: { value: 10 }, bonus: { value: 3 }, effective: { value: 13 } });
  });
  it.each(["13 (10 +6)", "14 (10 +3)", "0", "999", "13 garbage"])("rejects inconsistent talent notation: %s", notation => expect(parseTalentNotation(notation)).toBeNull());
  it("retains a bare displayed talent without inventing base or zero bonus", () => {
    expect(parseTalentNotation("13")).toMatchObject({ base: { state: "missing", value: null }, bonus: { state: "missing", value: null }, effective: { value: 13 }, accounting: "effective-only" });
    expect(parseTalentNotation("10")).toMatchObject({ bonus: { state: "missing", value: null }, effective: { value: 10 } });
  });
  it("keeps source paths aligned after GOOD empty substat placeholders", () => {
    const a = good.artifacts[0]!;
    const b = build({ ...good, artifacts: [{ ...a, substats: [{ key: "", value: 0 }, ...a.substats] }, ...good.artifacts.slice(1)] });
    expect(b.artifacts[0]!.main.key.path).toBe("artifacts[0].mainStatKey");
    expect(b.artifacts[0]!.substats[0]!.amount.path).toBe("artifacts[0].substats[1].value");
    expect(b.weapon.level.path).toBe("weapons[0].level");
  });
  it("exposes unknown Enka item, combat skill, bonus and panel property IDs", () => {
    const a = enka.avatarInfoList[0]!;
    const b = build({ ...enka, avatarInfoList: [{ ...a, skillLevelMap: { ...a.skillLevelMap, "999999": 10 }, proudSkillExtraLevelMap: { ...a.proudSkillExtraLevelMap, "999998": 3 }, fightPropMap: { ...a.fightPropMap, "999997": 0 }, equipList: a.equipList.map((item, i) => i === 1 ? { ...item, itemId: 999999, flat: { ...item.flat, setId: 15001 } } : item) }] });
    expect(b.artifacts[0]!.item.state).toBe("unknown-id");
    expect(b.artifacts[0]!.identity.state).toBe("known");
    expect(b.completeness.issues.map(i => i.path)).toEqual(expect.arrayContaining(["avatarInfoList[0].skillLevelMap.999999", "avatarInfoList[0].proudSkillExtraLevelMap.999998"]));
    expect(b.panel.stats.find(s => s.key.value === "enka-fight-prop:999997")).toMatchObject({ key: { state: "unknown-id" }, amount: { state: "unknown-id", value: 0, unit: "unknown" } });
  });
  it("blocks already effective Enka levels presented in the base-level map", () => {
    const a = enka.avatarInfoList[0]!;
    const b = build({ ...enka, avatarInfoList: [{ ...a, skillLevelMap: { ...a.skillLevelMap, "10018": 13 } }] });
    expect(b.talents.skill.base.state).toBe("invalid");
    expect(b.talents.skill.effective.value).toBeNull();
    expect(b.completeness.state).toBe("partial");
  });
  it("contains hostile object-shaped IDs and never invokes payload coercion methods", () => {
    const a = enka.avatarInfoList[0]!;
    const hostile = { toString: 1, valueOf: 2 };
    const b = build({ ...enka, avatarInfoList: [{ ...a, equipList: a.equipList.map((item, i) => i === 1 ? { ...item, itemId: hostile } : item) }] });
    expect(b.artifacts[0]!.item.state).toBe("invalid");
    expect(b.completeness.state).toBe("partial");
    expect(importPlayerJson(json({ ...enka, format: "GOOD", version: 99, characters: good.characters }))).toMatchObject({ ok: false, code: "unsupported-format" });
  });
  it("keeps missing GOOD progression and constellations unknown while accepting actual zero ascension/artifact level", () => {
    const c = good.characters[0]!;
    const { level: _level, constellation: _constellation, ...missing } = c;
    const b = build({ ...good, characters: [missing] });
    expect(b.level).toMatchObject({ state: "missing", value: null });
    expect(b.constellation).toMatchObject({ state: "missing", value: null });
    expect(b.completeness.state).toBe("partial");
    const zero = build({ ...good, characters: [{ ...c, level: 1, ascension: 0 }], artifacts: good.artifacts.map(a => ({ ...a, level: 0 })) });
    expect(zero.ascension).toMatchObject({ state: "known", value: 0 });
    expect(zero.artifacts[0]!.level.value).toBe(0);
  });
  it("uses documented Enka absent constellation C0 but does not guess missing talent bonus", () => {
    const { talentIdList: _c, proudSkillExtraLevelMap: _b, ...avatar } = enka.avatarInfoList[0]!;
    const b = build({ ...enka, avatarInfoList: [avatar] });
    expect(b.constellation).toMatchObject({ state: "known", value: 0 });
    expect(b.talents.skill.bonus).toMatchObject({ state: "missing", value: null });
    expect(b.talents.skill.effective.value).toBeNull();
    expect(b.completeness.state).toBe("partial");
  });
  it.each([null, [], "bad"])("rejects malformed bonus map instead of assuming zero: %s", value => {
    const b = build({ ...enka, avatarInfoList: [{ ...enka.avatarInfoList[0], proudSkillExtraLevelMap: value }] });
    expect(b.talents.skill.effective.value).toBeNull();
    expect(b.completeness.state).toBe("partial");
  });
  it("never falls back to showcase summary level or overrides authoritative empty val with ival", () => {
    const avatar = enka.avatarInfoList[0]!;
    const b = build({ ...enka, playerInfo: { showAvatarInfoList: [{ avatarId: 10000002, level: 90 }] }, avatarInfoList: [{ ...avatar, propMap: { ...avatar.propMap, "4001": { val: "", ival: "90" } } }] });
    expect(b.level).toMatchObject({ state: "invalid", value: null });
  });
  it("keeps ival-only Enka levels missing instead of treating the ignored property as evidence", () => {
    const avatar = enka.avatarInfoList[0]!;
    const b = build({ ...enka, avatarInfoList: [{ ...avatar, propMap: { ...avatar.propMap, "4001": { ival: "90" } } }] });
    expect(b.level).toMatchObject({ state: "missing", value: null, path: "avatarInfoList[0].propMap.4001.val" });
    expect(b.completeness.state).toBe("partial");
  });
  it("makes unknown character, weapon, set, slot and stat IDs visible", () => {
    const b = build({ ...good, characters: [{ ...good.characters[0], key: "UnmappedCharacter" }], weapons: [{ ...good.weapons[0], key: "UnmappedWeapon", location: "UnmappedCharacter" }], artifacts: good.artifacts.map(a => ({ ...a, location: "UnmappedCharacter", setKey: "UnmappedSet", substats: [{ key: "unmappedStat", value: 1 }] })) });
    expect(b.identity).toMatchObject({ state: "unknown-id", value: { id: "UnmappedCharacter" } });
    expect(b.weapon.identity.state).toBe("unknown-id");
    expect(b.artifacts[0]!.identity.state).toBe("unknown-id");
    expect(b.artifacts[0]!.substats[0]!.key.state).toBe("unknown-id");
    const withSlot = build({ ...good, artifacts: [...good.artifacts, { ...good.artifacts[0], slotKey: "unmappedSlot" }] });
    expect(withSlot.completeness.issues.some(i => i.state === "unknown-id")).toBe(true);
  });
  it("detects missing gear, duplicate slots, duplicate characters and malformed substats", () => {
    expect(build({ ...good, artifacts: [] }).completeness.state).toBe("partial");
    expect(build({ ...good, weapons: [] }).completeness.state).toBe("partial");
    expect(build({ ...good, artifacts: [...good.artifacts, good.artifacts[0]] }).completeness.state).toBe("partial");
    expect(build({ ...good, artifacts: good.artifacts.map(a => ({ ...a, substats: undefined })) }).completeness.state).toBe("partial");
    const duplicate = success(importPlayerJson(json({ ...good, characters: [good.characters[0], good.characters[0]] })));
    expect(applyPreview(null, { ok: true, snapshot: duplicate }).applied).toBe(false);
  });
  it.each(["Cookie", "stoken", "ltoken_v2", "cookie_token", "access_token", "Authorization", "sessionId", "password", "api_key"])("rejects nested session secret key %s without echoing it or logging payload", secretKey => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const r = importPlayerJson(json({ ...good, extra: [{ [secretKey]: "SYNTHETIC_SECRET_SENTINEL" }] }));
      expect(r).toMatchObject({ ok: false, code: "secret-input" });
      expect(json(r)).not.toContain("SYNTHETIC_SECRET_SENTINEL");
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
  it.each(["Cookie: SYNTHETIC_SECRET_SENTINEL", "stoken=SYNTHETIC_SECRET_SENTINEL", "Bearer SYNTHETIC_SECRET_SENTINEL", "eyJfake.eyJfake.fake"])("rejects secret-looking pasted values and malformed text: %s", value => {
    expect(importPlayerJson(value)).toMatchObject({ ok: false, code: "secret-input" });
    expect(importPlayerJson(json({ ...good, source: value }))).toMatchObject({ ok: false, code: "secret-input" });
  });
  it.each(["{bad", "null", "{}", json({ format: "GOOD", version: "3" }), json({ ...good, characters: [] }), json({ ...good, source: "x".repeat(2_000_001) })])("fails atomically without replacing previously complete data", text => {
    const previous = success(importPlayerJson(json(good)));
    const result = importPlayerJson(text);
    expect(result.ok).toBe(false);
    const applied = applyPreview(previous, result);
    expect(applied).toMatchObject({ applied: false });
    expect(applied.current).toBe(previous);
  });
  it("does not mutate caller payloads and only applies complete explicit previews by copy", () => {
    const before = json(good), previous = success(importPlayerJson(before));
    const partial = importPlayerJson(json({ ...good, artifacts: [] }));
    expect(applyPreview(previous, partial).current).toBe(previous);
    const next = applyPreview(null, { ok: true, snapshot: previous });
    expect(next.applied).toBe(true);
    expect(next.current).not.toBe(previous);
    expect(json(good)).toBe(before);
    expect(json(previous)).not.toContain('"raw"');
  });
  it("uses only fixed public endpoint with no credentials and validates UID before network IO", async () => {
    const transport = vi.fn(async () => new Response(json(enka)));
    const invalid = await fetchEnkaUid("https://not-an-endpoint.invalid", transport);
    expect(invalid.ok).toBe(false); expect(transport).not.toHaveBeenCalled();
    const result = await fetchEnkaUid("800000001", transport, () => "2026-10-21T16:30:00Z");
    expect(success(result).source).toMatchObject({ kind: "enka-uid", fetchedAt: "2026-10-21T16:30:00Z", snapshotAt: null });
    expect(transport).toHaveBeenCalledWith("https://enka.network/api/uid/800000001/", expect.objectContaining({ credentials: "omit", redirect: "error", headers: { Accept: "application/json" } }));
  });
  it.each([403, 404, 429, 500])("keeps upstream error body private for status %d", async status => {
    const result = await fetchEnkaUid("800000001", async () => new Response("SYNTHETIC_SECRET_SENTINEL", { status }));
    expect(result).toMatchObject({ ok: false, code: "unavailable" });
    expect(json(result)).not.toContain("SYNTHETIC_SECRET_SENTINEL");
  });
  it("handles network failure, oversized upstream and credential-looking upstream without data loss", async () => {
    expect((await fetchEnkaUid("800000001", async () => { throw new Error("SYNTHETIC_SECRET_SENTINEL"); })).ok).toBe(false);
    expect((await fetchEnkaUid("800000001", async () => new Response("x".repeat(2_000_001)))).ok).toBe(false);
    expect(await fetchEnkaUid("800000001", async () => new Response(json({ ...enka, stoken: "SYNTHETIC_SECRET_SENTINEL" })))).toMatchObject({ ok: false, code: "secret-input" });
  });
  it("exposes a no-login authorized prototype with no credential/session parameters or storage", async () => {
    const adapter = createAuthorizedFixtureAdapter(json(good));
    expect(adapter.capabilities).toEqual({ realLogin: false, ownedCurrentEquipment: "fixture-only", inventory: false, history: false, sessionStorage: false });
    const s = success(await adapter.readCurrentEquipment({ provider: "hoyolab", consent: "user-initiated", purpose: "read-owned-current-equipment" }));
    expect(s.source).toMatchObject({ kind: "authorized-fixture", scope: "fixture-owned-current-equipment", fixture: true });
    await adapter.disconnect();
    expect(await adapter.readCurrentEquipment({ provider: "hoyolab", consent: "user-initiated", purpose: "read-owned-current-equipment" })).toMatchObject({ ok: false, code: "unavailable" });
    const unsafe = createAuthorizedFixtureAdapter(json({ ...good, cookie: "SYNTHETIC_SECRET_SENTINEL" }));
    expect(await unsafe.readCurrentEquipment({ provider: "miyoushe", consent: "user-initiated", purpose: "read-owned-current-equipment" })).toMatchObject({ ok: false, code: "secret-input" });
  });
});
