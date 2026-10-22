import { describe, expect, it, vi } from "vitest";
import good from "../fixtures/synthetic-good.json" with { type: "json" };
import enka from "../fixtures/synthetic-enka.json" with { type: "json" };
import { createOwnedEquipmentController, equipmentProviderInfo, type BoundEquipmentRole, type EquipmentProvider, type FixtureEquipmentHost, type HostProblemCode } from "./authorized-host";

const started = Date.parse("2026-10-22T00:00:00.000Z");
const expiresAt = "2026-10-22T00:10:00.000Z";
const fetchedAt = "2026-10-22T00:00:01.000Z";
const request = (provider: EquipmentProvider = "miyoushe") => ({ provider, purpose: "read-owned-current-equipment" as const, consent: "user-initiated" as const });
const role = (provider: EquipmentProvider = "miyoushe"): BoundEquipmentRole => ({
  provider, region: provider === "miyoushe" ? "cn" : "overseas", game: "genshin", uid: "900000003", server: provider === "miyoushe" ? "cn_gf01" : "os_asia"
});
const readValue = (provider: EquipmentProvider = "miyoushe") => ({
  role: role(provider), equipmentJson: JSON.stringify(good), ownedAvatarIds: [10000002], rosterComplete: true, fetchedAt
});
function fixtureHost(provider: EquipmentProvider = "miyoushe") {
  return {
    mode: "fixture-only" as const,
    inspectAccess: vi.fn<FixtureEquipmentHost["inspectAccess"]>().mockResolvedValue({ ok: true, value: { roles: [role(provider)], expiresAt } }),
    readCurrentEquipment: vi.fn<FixtureEquipmentHost["readCurrentEquipment"]>().mockResolvedValue({ ok: true, value: readValue(provider) }),
    release: vi.fn<FixtureEquipmentHost["release"]>().mockResolvedValue(undefined)
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe("credential-free owned-equipment host boundary (all successes are synthetic)", () => {
  it("defaults to unavailable, has no implicit live adapter, and performs no network IO", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected network"));
    try {
      const controller = createOwnedEquipmentController();
      expect(controller.getState()).toMatchObject({ realLogin: false, status: "unavailable", preview: null });
      expect(await controller.prepareRead(request())).toMatchObject({ ok: false, code: "host-unavailable" });
      expect(await controller.readCurrentEquipment({ ...request(), role: role() })).toMatchObject({ ok: false, code: "host-unavailable" });
      expect(fetch).not.toHaveBeenCalled();
      const host = fixtureHost();
      const unsupported = createOwnedEquipmentController({ host: { ...host, mode: "live" } as unknown as FixtureEquipmentHost });
      expect(await unsupported.prepareRead(request())).toMatchObject({ ok: false, code: "host-unavailable" });
      expect(host.inspectAccess).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });

  it.each(["miyoushe", "hoyolab"] as const)("keeps %s roles explicit and every success labeled fixture", async provider => {
    const host = fixtureHost(provider), controller = createOwnedEquipmentController({ host, now: () => started });
    expect(await controller.prepareRead(request(provider))).toMatchObject({ ok: true, fixture: true, value: [role(provider)] });
    expect(controller.getState()).toMatchObject({ status: "select-role", selectedRole: null, realLogin: false });
    expect(await controller.readCurrentEquipment({ ...request(provider), role: undefined as unknown as BoundEquipmentRole })).toMatchObject({ ok: false, code: "role-required" });
    expect(host.readCurrentEquipment).not.toHaveBeenCalled();
    const result = await controller.readCurrentEquipment({ ...request(provider), role: role(provider) });
    expect(result).toMatchObject({ ok: true, fixture: true, value: { source: { kind: "authorized-fixture", scope: "fixture-owned-current-equipment", fixture: true, uid: "900000003", inventory: "not-imported", history: "not-imported", snapshotAt: null } } });
    if (!result.ok) throw new Error("expected mock-only preview");
    expect(result.value.notices[0]).toContain("未登录或读取真实账号");
    expect(controller.getState()).toMatchObject({ status: "preview-ready", previewCurrent: true, realLogin: false });
    result.value.builds.length = 0;
    const state = controller.getState(); state.roles.length = 0;
    expect(controller.getState().preview?.builds).toHaveLength(1);
    expect(controller.getState().roles).toHaveLength(1);
    expect(host.readCurrentEquipment).toHaveBeenCalledTimes(1);
    expect(equipmentProviderInfo(provider)).toMatchObject({ provider, region: provider === "miyoushe" ? "cn" : "overseas" });
    expect(equipmentProviderInfo("unknown" as EquipmentProvider)).toBeNull();
  });

  it.each([
    { provider: "unknown" }, { purpose: "read-inventory" }, { consent: "background" },
    { cookie: "SYNTHETIC_SECRET_SENTINEL" }, { extra: { authorization: "SYNTHETIC_SECRET_SENTINEL" } }
  ])("rejects invalid scope or credential-shaped request before the host runs: %j", async patch => {
    const host = fixtureHost(), controller = createOwnedEquipmentController({ host, now: () => started });
    const result = await controller.prepareRead({ ...request(), ...patch } as Parameters<typeof controller.prepareRead>[0]);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("SYNTHETIC_SECRET_SENTINEL");
    expect(host.inspectAccess).not.toHaveBeenCalled();
  });

  it.each(["login-required", "authorization-expired", "permission-denied", "challenge-required", "rate-limited", "unavailable"] as const)("surfaces %s without retrying or choosing another provider", async code => {
    const host = fixtureHost(); host.inspectAccess.mockResolvedValue({ ok: false, code });
    const controller = createOwnedEquipmentController({ host, now: () => started });
    expect(await controller.prepareRead(request())).toMatchObject({ ok: false, code });
    expect(controller.getState()).toMatchObject({ status: code === "login-required" ? "login-required" : "error", roles: [], selectedRole: null, realLogin: false });
    expect(host.inspectAccess).toHaveBeenCalledTimes(1);
    expect(host.readCurrentEquipment).not.toHaveBeenCalled();
  });

  it.each([
    { roles: [role("hoyolab")] }, { roles: [role(), role()] },
    { roles: [{ ...role(), region: "overseas" }] }, { roles: [{ ...role(), server: "https://example.invalid" }] },
    { expiresAt: "not-a-time" }
  ])("rejects mixed, duplicate or invalid bound roles: %j", async patch => {
    const host = fixtureHost();
    host.inspectAccess.mockResolvedValue({ ok: true, value: { roles: [role()], expiresAt, ...patch } } as Awaited<ReturnType<FixtureEquipmentHost["inspectAccess"]>>);
    const controller = createOwnedEquipmentController({ host, now: () => started });
    expect(await controller.prepareRead(request())).toMatchObject({ ok: false, code: "invalid-data" });
    expect(controller.getState().roles).toEqual([]);
  });

  it("distinguishes no bound game role from unavailable access and does not infer server from UID", async () => {
    const host = fixtureHost("hoyolab");
    host.inspectAccess.mockResolvedValueOnce({ ok: true, value: { roles: [], expiresAt } });
    const controller = createOwnedEquipmentController({ host, now: () => started });
    expect(await controller.prepareRead(request("hoyolab"))).toMatchObject({ ok: false, code: "no-bound-role" });
    const explicitRole = { ...role("hoyolab"), uid: "100000003" };
    host.inspectAccess.mockResolvedValueOnce({ ok: true, value: { roles: [explicitRole], expiresAt } });
    expect(await controller.prepareRead(request("hoyolab"))).toMatchObject({ ok: true, value: [explicitRole] });
  });

  it("requires the exact selected bound UID and server before any equipment read", async () => {
    const host = fixtureHost(), controller = createOwnedEquipmentController({ host, now: () => started });
    await controller.prepareRead(request());
    for (const changed of [{ uid: "900000004" }, { server: "cn_qd01" }, { provider: "hoyolab" }]) {
      expect(await controller.readCurrentEquipment({ ...request(), role: { ...role(), ...changed } as BoundEquipmentRole })).toMatchObject({ ok: false, code: "role-required" });
    }
    expect(host.readCurrentEquipment).not.toHaveBeenCalled();
  });

  it("checks expiry before and after a delayed read instead of accepting stale authorization", async () => {
    let clock = started;
    const host = fixtureHost(), controller = createOwnedEquipmentController({ host, now: () => clock });
    await controller.prepareRead(request());
    clock += 600000;
    expect(await controller.readCurrentEquipment({ ...request(), role: role() })).toMatchObject({ ok: false, code: "authorization-expired" });
    expect(host.readCurrentEquipment).not.toHaveBeenCalled();
    clock = started; await controller.prepareRead(request());
    const late = deferred<Awaited<ReturnType<FixtureEquipmentHost["readCurrentEquipment"]>>>();
    host.readCurrentEquipment.mockReturnValue(late.promise);
    const pending = controller.readCurrentEquipment({ ...request(), role: role() });
    await Promise.resolve(); clock += 600000;
    late.resolve({ ok: true, value: readValue() });
    expect(await pending).toMatchObject({ ok: false, code: "authorization-expired" });
    expect(controller.getState()).toMatchObject({ preview: null, roles: [], previewCurrent: false });
  });

  it.each([
    { rosterComplete: false }, { ownedAvatarIds: [10000002, 10000015] }, { ownedAvatarIds: [10000015] }
  ])("requires exact roster coverage, not just a success flag or returned count: %j", async patch => {
    const host = fixtureHost(), controller = createOwnedEquipmentController({ host, now: () => started });
    await controller.prepareRead(request());
    host.readCurrentEquipment.mockResolvedValue({ ok: true, value: { ...readValue(), ...patch } });
    expect(await controller.readCurrentEquipment({ ...request(), role: role() })).toMatchObject({ ok: false, code: "partial-coverage" });
    expect(controller.getState().preview).toBeNull();
  });

  it.each([
    { name: "duplicate owned roster", patch: { ownedAvatarIds: [10000002, 10000002] } },
    { name: "malformed equipment JSON", patch: { equipmentJson: "{broken" } },
    { name: "invalid fetch time", patch: { fetchedAt: "bad-time" } },
    { name: "oversized equipment JSON", patch: { equipmentJson: "x".repeat(2_000_001) } }
  ])("rejects $name without replacing an earlier preview", async ({ patch }) => {
    const host = fixtureHost(), controller = createOwnedEquipmentController({ host, now: () => started });
    await controller.prepareRead(request());
    expect((await controller.readCurrentEquipment({ ...request(), role: role() })).ok).toBe(true);
    const before = controller.getState().preview;
    host.readCurrentEquipment.mockResolvedValue({ ok: true, value: { ...readValue(), ...patch } });
    expect(await controller.readCurrentEquipment({ ...request(), role: role() })).toMatchObject({ ok: false, code: "invalid-data" });
    expect(controller.getState()).toMatchObject({ preview: before, previewCurrent: false });
  });

  it("rejects a mismatched read role or payload UID and never re-labels it as the selected account", async () => {
    const host = fixtureHost(), controller = createOwnedEquipmentController({ host, now: () => started });
    await controller.prepareRead(request());
    host.readCurrentEquipment.mockResolvedValueOnce({ ok: true, value: { ...readValue(), role: { ...role(), uid: "900000004" } } });
    expect(await controller.readCurrentEquipment({ ...request(), role: role() })).toMatchObject({ ok: false, code: "role-mismatch" });
    host.readCurrentEquipment.mockResolvedValueOnce({ ok: true, value: { ...readValue(), equipmentJson: JSON.stringify({ ...enka, uid: "900000004" }) } });
    expect(await controller.readCurrentEquipment({ ...request(), role: role() })).toMatchObject({ ok: false, code: "role-mismatch" });
    expect(controller.getState().preview).toBeNull();
  });

  it("does not equate exact roster coverage with complete gear or a calculable panel", async () => {
    const host = fixtureHost(), controller = createOwnedEquipmentController({ host, now: () => started });
    host.readCurrentEquipment.mockResolvedValue({ ok: true, value: { ...readValue(), equipmentJson: JSON.stringify({ ...good, artifacts: [] }) } });
    await controller.prepareRead(request());
    const result = await controller.readCurrentEquipment({ ...request(), role: role() });
    expect(result).toMatchObject({ ok: true, fixture: true });
    if (!result.ok) throw new Error("expected incomplete fixture preview");
    expect(result.value.builds[0]!.completeness.state).toBe("partial");
    expect(result.value.builds[0]!.panel.state).toBe("not-exported");
  });

  it("contains rejected secret-shaped replies and thrown errors without exposing them", async () => {
    const host = fixtureHost(), controller = createOwnedEquipmentController({ host, now: () => started });
    host.inspectAccess.mockRejectedValueOnce(new Error("SYNTHETIC_SECRET_SENTINEL"));
    expect(JSON.stringify(await controller.prepareRead(request()))).not.toContain("SYNTHETIC_SECRET_SENTINEL");
    await controller.prepareRead(request());
    host.readCurrentEquipment.mockResolvedValueOnce({ ok: true, value: { ...readValue(), equipmentJson: JSON.stringify({ ...good, cookie: "SYNTHETIC_SECRET_SENTINEL" }) } });
    const rejected = await controller.readCurrentEquipment({ ...request(), role: role() });
    expect(rejected).toMatchObject({ ok: false, code: "secret-input" });
    expect(JSON.stringify(rejected)).not.toContain("SYNTHETIC_SECRET_SENTINEL");
    host.readCurrentEquipment.mockResolvedValueOnce({ ok: false, code: "unrecognized" as HostProblemCode });
    expect(await controller.readCurrentEquipment({ ...request(), role: role() })).toMatchObject({ ok: false, code: "unavailable" });
  });

  it("cancels even an uncooperative mock and ignores its late result", async () => {
    const host = fixtureHost(), controller = createOwnedEquipmentController({ host, now: () => started });
    await controller.prepareRead(request());
    const late = deferred<Awaited<ReturnType<FixtureEquipmentHost["readCurrentEquipment"]>>>();
    host.readCurrentEquipment.mockReturnValue(late.promise);
    const pending = controller.readCurrentEquipment({ ...request(), role: role() });
    await Promise.resolve();
    controller.cancel();
    expect(await pending).toMatchObject({ ok: false, code: "cancelled" });
    late.resolve({ ok: true, value: readValue() }); await Promise.resolve();
    expect(controller.getState()).toMatchObject({ status: "select-role", preview: null, previewCurrent: false });
  });

  it("disconnects locally before cleanup and cannot be resurrected by an in-flight read", async () => {
    const host = fixtureHost(), controller = createOwnedEquipmentController({ host, now: () => started });
    await controller.prepareRead(request());
    await controller.readCurrentEquipment({ ...request(), role: role() });
    const late = deferred<Awaited<ReturnType<FixtureEquipmentHost["readCurrentEquipment"]>>>();
    host.readCurrentEquipment.mockReturnValue(late.promise);
    const pending = controller.readCurrentEquipment({ ...request(), role: role() });
    await Promise.resolve();
    await controller.disconnect();
    expect(await pending).toMatchObject({ ok: false, code: "cancelled" });
    late.resolve({ ok: true, value: readValue() }); await Promise.resolve();
    expect(controller.getState()).toMatchObject({ status: "disconnected", roles: [], selectedRole: null, preview: null, expiresAt: null });
    expect(host.release).toHaveBeenCalledExactlyOnceWith("miyoushe");
  });

  it("reports cleanup uncertainty and blocks new preparation while disconnecting", async () => {
    const host = fixtureHost(), controller = createOwnedEquipmentController({ host, now: () => started });
    await controller.prepareRead(request());
    const release = deferred<void>(); host.release.mockReturnValueOnce(release.promise);
    const pending = controller.disconnect();
    expect(await controller.prepareRead(request())).toMatchObject({ ok: false, code: "busy" });
    expect(controller.getState().status).toBe("disconnecting");
    release.resolve(); expect((await pending).ok).toBe(true);
    await controller.prepareRead(request());
    host.release.mockRejectedValueOnce(new Error("SYNTHETIC_SECRET_SENTINEL"));
    const result = await controller.disconnect();
    expect(result).toMatchObject({ ok: false, code: "disconnect-unconfirmed" });
    expect(JSON.stringify(result)).not.toContain("SYNTHETIC_SECRET_SENTINEL");
    expect(controller.getState()).toMatchObject({ status: "disconnected", preview: null, roles: [] });
  });
});
