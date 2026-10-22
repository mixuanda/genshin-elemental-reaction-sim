import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createOfficialEquipmentObserver, matchOfficialEquipmentResponse, type ObserverProvider } from "./official-browser-observer.mjs";
import { importPlayerJson } from "./normalize";

const rolesUrl = "https://api-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie?game_biz=hk4e_cn";
const recordUrl = "https://api-takumi-record.mihoyo.com/game_record/app/genshin/api/character/";
const role = { uid: "123456789", server: "cn_gf01" };
const binding = (uid = role.uid, server = role.server) => ({ game_biz: "hk4e_cn", game_uid: uid, region: server });
const response = (list: unknown[], retcode = 0) => JSON.stringify({ retcode, data: { list } });
function detail(id = 10000002) {
  return { base: { id, level: 100, actived_constellation_num: 6 },
    weapon: { id: 11301, level: 90, promote_level: 6, affix_level: 5 },
    relics: [{ id: 71544, pos: 1, level: 20, rarity: 5, set: { id: 2140011 },
      main_property: { property_type: 2000, value: "4780" }, sub_property_list: [{ property_type: 20, value: "10.5%" }] }],
    skills: [{ skill_id: 10018, skill_type: 1, level: 13, is_unlock: true }] };
}
function prepared(options: { now?: () => number; maxDurationMs?: number } = {}) {
  const observer = createOfficialEquipmentObserver({ provider: "miyoushe", evidence: "synthetic-test", ...options });
  expect(observer.observe({ url: rolesUrl, method: "GET", status: 200, responseBody: response([binding()]) })).toEqual({ ok: true });
  expect(observer.selectRole(role)).toEqual({ ok: true });
  return observer;
}
function roster(observer: ReturnType<typeof prepared>, ids = [10000002]) {
  return observer.observe({ url: `${recordUrl}list`, method: "POST", status: 200,
    requestBody: JSON.stringify({ role_id: role.uid, server: role.server }), responseBody: response(ids.map(id => ({ id }))) });
}
function details(observer: ReturnType<typeof prepared>, rows = [detail()]) {
  return observer.observe({ url: `${recordUrl}detail`, method: "POST", status: 200,
    requestBody: JSON.stringify({ role_id: role.uid, server: role.server, character_ids: rows.map(row => row.base.id) }), responseBody: response(rows) });
}

describe("passive official UI equipment observation", () => {
  it("recognizes only pinned provider endpoints and methods, and never inspects login responses", () => {
    expect(matchOfficialEquipmentResponse("miyoushe", rolesUrl, "GET")).toBe("roles");
    expect(matchOfficialEquipmentResponse("hoyolab", "https://api-account-os.hoyolab.com/binding/api/getUserGameRolesByCookieToken", "GET")).toBe("roles");
    for (const url of ["https://passport-api.miyoushe.com/account/ma-cn-passport/web/queryQRLoginStatus", `${recordUrl}list.evil`, `${recordUrl}list#x`, `${recordUrl}list`.replace("https:", "http:"), `${recordUrl}list`.replace("mihoyo.com", "mihoyo.com.invalid"), `${recordUrl}list`.replace("https://", "https://user:pass@")]) {
      expect(matchOfficialEquipmentResponse("miyoushe", url, "POST")).toBeNull();
    }
    expect(matchOfficialEquipmentResponse("hoyolab", `${recordUrl}list`, "POST")).toBeNull();
    expect(matchOfficialEquipmentResponse("miyoushe", `${recordUrl}list`, "GET")).toBeNull();
    expect(matchOfficialEquipmentResponse("example" as ObserverProvider, rolesUrl, "GET")).toBeNull();
  });

  it("requires an observed binding and explicit selection; does not infer a server from UID", () => {
    const observer = createOfficialEquipmentObserver({ provider: "miyoushe", evidence: "synthetic-test" });
    expect(observer.selectRole(role)).toEqual({ ok: false, code: "role-required" });
    observer.observe({ url: rolesUrl, method: "GET", status: 200,
      responseBody: response([binding(role.uid, "cn_qd01"), { game_biz: "hk4e_global", game_uid: "987654321", region: "os_asia" }]) });
    expect(observer.inspect().roles).toEqual([{ uid: role.uid, server: "cn_qd01" }]);
    expect(observer.selectRole(role)).toEqual({ ok: false, code: "role-required" });
    expect(observer.finish()).toEqual({ ok: false, code: "role-required" });
  });

  it("passes supported numeric fields to the existing importer without clipping 100 or inventing ascension/talents/artifact units", () => {
    const observer = prepared();
    expect(roster(observer)).toEqual({ ok: true });
    expect(details(observer)).toEqual({ ok: true });
    const result = observer.finish();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const good = JSON.parse(result.goodJson);
    expect(good.syntheticFixture).toBe(true);
    expect(good.observations.characters[0].skills).toEqual([{ id: 10018, type: 1, displayedLevel: 13, unlocked: true }]);
    expect(good.observations.characters[0].relics[0]).toMatchObject({ pos: 1, main: { property_type: 2000, value: "4780" }, substats: [{ property_type: 20, value: "10.5%" }] });
    expect(good.artifacts).toEqual([]);
    const imported = importPlayerJson(result.goodJson);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.snapshot.source).toMatchObject({ kind: "good-file", scope: "file-equipped-subset", fixture: true });
    const build = imported.snapshot.builds[0]!;
    expect(build.level).toMatchObject({ state: "known", value: 100 });
    expect(build.constellation.value).toBe(6);
    expect(build.ascension).toMatchObject({ state: "missing", value: null });
    expect(build.weapon).toMatchObject({ level: { value: 90 }, ascension: { value: 6 }, refinement: { value: 5 } });
    expect(build.talents.skill.base).toMatchObject({ state: "missing", value: null });
    expect(build.talents.skill.effective.value).toBeNull();
    expect(build.completeness.state).toBe("partial");
    expect(build.artifacts.every(artifact => artifact.main.amount.value === null)).toBe(true);
    expect(observer.inspect()).toMatchObject({ status: "closed", problem: "completed", roles: [], selected: null, rosterCount: 0, detailCount: 0, realLoginVerified: false });
    expect(observer.finish()).toEqual({ ok: false, code: "completed" });
  });

  it("ignores equipment for another UID/server and query/body disagreement", () => {
    const observer = prepared();
    for (const params of [{ role_id: "987654321", server: role.server }, { role_id: role.uid, server: "cn_qd01" }]) {
      expect(observer.observe({ url: `${recordUrl}list`, method: "POST", status: 200, requestBody: JSON.stringify(params), responseBody: response([{ id: 10000002 }]) })).toEqual({ ok: true, ignored: true });
    }
    expect(observer.observe({ url: `${recordUrl}list?server=cn_qd01`, method: "POST", status: 200,
      requestBody: JSON.stringify({ role_id: role.uid, server: role.server }), responseBody: response([{ id: 10000002 }]) })).toEqual({ ok: true, ignored: true });
    expect(observer.inspect()).toMatchObject({ rosterCount: 0, detailCount: 0 });
  });

  it("allows official per-character detail requests, but incomplete coverage cannot finish", () => {
    const observer = prepared();
    roster(observer, [10000002, 10000042]); details(observer);
    expect(observer.finish()).toEqual({ ok: false, code: "partial-coverage" });
    details(observer, [detail(10000042)]);
    expect(observer.finish().ok).toBe(true);
  });

  it.each([10035, 5003, 10041, 1034, 10101, -110, 10001])("stops on provider challenge/rate/login code %s and clears prior observations", retcode => {
    const observer = prepared(); roster(observer); details(observer);
    const result = observer.observe({ url: rolesUrl, method: "GET", status: 200, responseBody: response([], retcode) });
    expect(result.ok).toBe(false);
    expect(observer.inspect()).toMatchObject({ status: "closed", roles: [], selected: null, detailCount: 0, rosterCount: 0 });
    expect(observer.finish().ok).toBe(false);
  });

  it("drops unrecognized login material without parsing and rejects sensitive fields on accepted endpoints", () => {
    const observer = prepared();
    expect(observer.observe({ url: "https://passport-api.miyoushe.com/account/ma-cn-passport/web/queryQRLoginStatus", method: "POST", status: 200,
      responseBody: '{"cookie_token_v2":"synthetic-not-a-secret"}' })).toEqual({ ok: true, ignored: true });
    expect(observer.observe({ url: rolesUrl, method: "GET", status: 200,
      responseBody: '{"retcode":0,"data":{"list":[],"password":"synthetic-not-a-secret"}}' })).toEqual({ ok: false, code: "invalid-or-sensitive-data" });
    expect(JSON.stringify(observer.inspect())).not.toContain("synthetic-not-a-secret");
  });

  it("rejects inconsistent detail IDs, changed roster/binding and invalid observed numbers", () => {
    const observer = prepared();
    const raw = detail(); raw.base.level = 101;
    expect(details(observer, [raw])).toEqual({ ok: false, code: "invalid-data" });
    const changed = prepared(); roster(changed); details(changed);
    expect(roster(changed, [10000042])).toEqual({ ok: false, code: "roster-changed" });
    const switched = prepared(); roster(switched);
    expect(switched.observe({ url: rolesUrl, method: "GET", status: 200, responseBody: response([binding("987654321")]) })).toEqual({ ok: false, code: "role-changed" });
    const mismatch = prepared();
    expect(mismatch.observe({ url: `${recordUrl}detail`, method: "POST", status: 200,
      requestBody: JSON.stringify({ role_id: role.uid, server: role.server, character_ids: [10000042] }), responseBody: response([detail()]) })).toEqual({ ok: false, code: "invalid-data" });
  });

  it("honors the local deadline and explicit cancellation with no late data", () => {
    let now = 0;
    const observer = prepared({ now: () => now, maxDurationMs: 100 }); roster(observer); details(observer);
    now = 100;
    expect(observer.finish()).toEqual({ ok: false, code: "local-deadline" });
    expect(observer.inspect()).toMatchObject({ roles: [], selected: null, detailCount: 0, rosterCount: 0 });
    const cancelled = prepared(); cancelled.close();
    expect(roster(cancelled)).toEqual({ ok: false, code: "cancelled" });
    expect(() => createOfficialEquipmentObserver({ provider: "miyoushe", maxDurationMs: 600_001 })).toThrow("invalid-options");
    expect(() => createOfficialEquipmentObserver({ provider: "constructor" as ObserverProvider })).toThrow("invalid-options");
  });

  it("runs the default CLI plan without browser execution, and refuses begin before interactive prerequisites", () => {
    const cli = "apps/player-import/official-browser-host.mjs";
    const plan = JSON.parse(execFileSync(process.execPath, [cli, "--plan"], { encoding: "utf8" }));
    expect(plan).toMatchObject({ location: "current-cloud-host", execution: "plan-only-zero-network", realLoginVerified: false, localRetentionLimitMs: 600_000, retentionIsProviderExpiry: false });
    expect(plan.officialPages.dataOrigins).toContain("https://api-takumi-record.mihoyo.com");
    const missingScope = spawnSync(process.execPath, [cli, "--begin"], { encoding: "utf8" });
    expect(missingScope.status).toBe(2);
    expect(missingScope.stderr).toContain("explicit-account-scope-acknowledgment-required");
    // This cannot launch: no TTY; the current-cloud visibility check is first.
    const unavailable = spawnSync(process.execPath, [cli, "--begin", "--acknowledge=temporary-cloud-account-read"], { encoding: "utf8", env: { ...process.env, DISPLAY: "" } });
    expect(unavailable.status).toBe(2);
    expect(unavailable.stderr).toContain("no browser or login started");
    expect(unavailable.stdout).toBe("");
  });
});
