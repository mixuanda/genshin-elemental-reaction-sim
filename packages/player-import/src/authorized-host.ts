import type { AuthorizedEquipmentRequest } from "./adapters";
import { containsSecrets, readInput } from "./input";
import type { ImportSnapshot } from "./model";
import { importPlayerJson } from "./normalize";

export type EquipmentProvider = AuthorizedEquipmentRequest["provider"];
export interface BoundEquipmentRole {
  provider: EquipmentProvider;
  region: "cn" | "overseas";
  game: "genshin";
  uid: string;
  /** Supplied by the authenticated host's bound-role list, never inferred from UID. */
  server: string;
}
export type EquipmentProblemCode = "host-unavailable" | "invalid-request" | "secret-input" |
  "login-required" | "authorization-expired" | "permission-denied" | "challenge-required" |
  "rate-limited" | "no-bound-role" | "role-required" | "role-mismatch" | "partial-coverage" | "invalid-data" |
  "unavailable" | "cancelled" | "busy" | "disconnect-unconfirmed";
export interface EquipmentProblem { ok: false; code: EquipmentProblemCode; message: string }
type Result<T> = { ok: true; fixture: true; value: T } | EquipmentProblem;
export type HostProblemCode = "login-required" | "authorization-expired" | "permission-denied" |
  "challenge-required" | "rate-limited" | "unavailable";
type HostResult<T> = { ok: true; value: T } | { ok: false; code: HostProblemCode };

/** An injectable contract test port, NOT an implementation of provider login.
 * A future production host requires a separately reviewed, user-authorized login
 * boundary. No credential, login response, bearer handle or session ID crosses this port.
 */
export interface FixtureEquipmentHost {
  readonly mode: "fixture-only";
  inspectAccess(request: AuthorizedEquipmentRequest, signal: AbortSignal): Promise<HostResult<{
    roles: BoundEquipmentRole[];
    expiresAt: string;
  }>>;
  readCurrentEquipment(request: AuthorizedEquipmentRequest & { role: BoundEquipmentRole }, signal: AbortSignal): Promise<HostResult<{
    role: BoundEquipmentRole;
    /** Sanitized existing GOOD/Enka import shape, not an opaque provider response. */
    equipmentJson: string;
    ownedAvatarIds: number[];
    rosterComplete: boolean;
    fetchedAt: string;
  }>>;
  release(provider: EquipmentProvider): Promise<void>;
}

export interface OwnedEquipmentState {
  mode: "credential-free-host-contract";
  realLogin: false;
  status: "unavailable" | "idle" | "checking" | "login-required" | "select-role" |
    "reading" | "preview-ready" | "error" | "disconnecting" | "disconnected";
  provider: EquipmentProvider | null;
  roles: BoundEquipmentRole[];
  selectedRole: BoundEquipmentRole | null;
  expiresAt: string | null;
  preview: ImportSnapshot | null;
  previewCurrent: boolean;
  problem: EquipmentProblem | null;
}

const messages: Record<EquipmentProblemCode, string> = {
  "host-unavailable": "尚未配置获授权的账号读取宿主；当前不能登录或读取真实账号。",
  "invalid-request": "请选择提供方，并主动确认只读取当前角色配装。",
  "secret-input": "此入口不接收账户凭据；请移除后重试。",
  "login-required": "需要在提供方官方界面登录；当前适配器尚未实现真实登录。",
  "authorization-expired": "本次读取授权已过期，请重新确认。",
  "permission-denied": "没有当前角色配装的读取权限，请检查提供方授权。",
  "challenge-required": "提供方要求验证；请在官方界面完成后重新发起。",
  "rate-limited": "提供方限制请求频率，请稍后手动重试。",
  "no-bound-role": "未找到已绑定的原神角色，请在官方账号检查绑定。",
  "role-required": "请从本次确认的游戏角色列表中选择账号与区服。",
  "role-mismatch": "返回数据不属于所选账号与区服，未应用。",
  "partial-coverage": "角色列表或配装读取不完整，未标为全角色导入。",
  "invalid-data": "宿主返回的配装或角色信息不完整，未应用。",
  "unavailable": "读取失败，请稍后手动重试。",
  "cancelled": "读取已取消。",
  "busy": "正在断开，请完成后再发起读取。",
  "disconnect-unconfirmed": "本页数据已清除；宿主断开未确认，请在宿主检查。"
};
const failure = (code: EquipmentProblemCode): EquipmentProblem => ({ ok: false, code, message: messages[code] });
const hostCodes = new Set<string>(["login-required", "authorization-expired", "permission-denied", "challenge-required", "rate-limited", "unavailable"]);
const sameRole = (a: BoundEquipmentRole, b: BoundEquipmentRole) => a.provider === b.provider && a.region === b.region && a.game === b.game && a.uid === b.uid && a.server === b.server;
const validRole = (role: BoundEquipmentRole, provider: EquipmentProvider) => role?.provider === provider &&
  role.region === (provider === "miyoushe" ? "cn" : "overseas") && role.game === "genshin" &&
  typeof role.uid === "string" && /^[1-9]\d{8,9}$/.test(role.uid) &&
  typeof role.server === "string" && /^[a-z][a-z0-9_]{1,39}$/.test(role.server);
const timestamp = (value: unknown) => typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;

export function equipmentProviderInfo(provider: EquipmentProvider) {
  if (provider === "miyoushe") return { provider, region: "cn" as const, communityUrl: "https://www.miyoushe.com/ys/" };
  if (provider === "hoyolab") return { provider, region: "overseas" as const, communityUrl: "https://www.hoyolab.com/" };
  return null;
}

/** In-memory orchestration around the existing import normalizer. With no host,
 * it fails closed. Its only implemented host mode and every output are fixtures.
 * No network, login, browser inspection, background retries or persistence occur here.
 */
export function createOwnedEquipmentController(options: { host?: FixtureEquipmentHost; now?: () => number } = {}) {
  const host = options.host?.mode === "fixture-only" ? options.host : undefined;
  const now = options.now ?? Date.now;
  const initial = (status: OwnedEquipmentState["status"]): OwnedEquipmentState => ({
    mode: "credential-free-host-contract", realLogin: false, status,
    provider: null, roles: [], selectedRole: null, expiresAt: null,
    preview: null, previewCurrent: false, problem: null
  });
  let state = initial(host ? "idle" : "unavailable");
  let generation = 0;
  let active: AbortController | null = null;
  const fail = (code: EquipmentProblemCode, clearAccess = false): EquipmentProblem => {
    const problem = failure(code);
    state.status = code === "login-required" ? "login-required" : "error";
    state.problem = problem;
    state.previewCurrent = false;
    if (clearAccess) { state.roles = []; state.selectedRole = null; state.expiresAt = null; }
    return problem;
  };
  const validateRequest = (request: AuthorizedEquipmentRequest): EquipmentProblemCode | null => {
    if (containsSecrets(request)) return "secret-input";
    return request && ["miyoushe", "hoyolab"].includes(request.provider) && request.purpose === "read-owned-current-equipment" && request.consent === "user-initiated" ? null : "invalid-request";
  };
  const begin = () => {
    active?.abort();
    const op = { generation: ++generation, controller: new AbortController() };
    active = op.controller;
    return op;
  };
  const stale = (op: ReturnType<typeof begin>) => op.generation !== generation || op.controller.signal.aborted;
  const end = (op: ReturnType<typeof begin>) => { if (op.generation === generation) active = null; };
  const invoke = <T>(op: ReturnType<typeof begin>, work: () => Promise<T>): Promise<T> => new Promise((resolve, reject) => {
    const signal = op.controller.signal;
    const abort = () => reject(new Error("cancelled"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { signal.removeEventListener("abort", abort); abort(); return; }
    Promise.resolve().then(() => { if (signal.aborted) throw new Error("cancelled"); return work(); })
      .then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
  const hostFailure = (code: HostProblemCode) => fail(hostCodes.has(code) ? code : "unavailable", ["login-required", "authorization-expired", "permission-denied", "challenge-required"].includes(code));

  return {
    getState: (): OwnedEquipmentState => structuredClone(state),
    async prepareRead(request: AuthorizedEquipmentRequest): Promise<Result<BoundEquipmentRole[]>> {
      if (state.status === "disconnecting") return failure("busy");
      const invalid = validateRequest(request);
      if (invalid) return fail(invalid);
      if (!host) return fail("host-unavailable");
      const op = begin();
      if (state.provider !== request.provider) state.preview = null;
      state.provider = request.provider; state.roles = []; state.selectedRole = null; state.expiresAt = null;
      state.status = "checking"; state.problem = null; state.previewCurrent = false;
      try {
        const reply = await invoke(op, () => host.inspectAccess({ provider: request.provider, purpose: request.purpose, consent: request.consent }, op.controller.signal));
        if (stale(op)) return failure("cancelled");
        if (containsSecrets(reply)) return fail("secret-input", true);
        if (!reply.ok) return hostFailure(reply.code);
        const { roles, expiresAt } = reply.value;
        if (!Array.isArray(roles) || roles.length > 100 || roles.some(role => !validRole(role, request.provider)) || new Set(roles.map(role => `${role.uid}/${role.server}`)).size !== roles.length || !Number.isFinite(timestamp(expiresAt))) return fail("invalid-data", true);
        if (!roles.length) return fail("no-bound-role", true);
        if (timestamp(expiresAt) <= now()) return fail("authorization-expired", true);
        state.roles = structuredClone(roles); state.expiresAt = expiresAt; state.status = "select-role";
        return { ok: true, fixture: true, value: structuredClone(roles) };
      } catch { return stale(op) ? failure("cancelled") : fail("unavailable", true); }
      finally { end(op); }
    },
    async readCurrentEquipment(request: AuthorizedEquipmentRequest & { role: BoundEquipmentRole }): Promise<Result<ImportSnapshot>> {
      if (state.status === "disconnecting") return failure("busy");
      const invalid = validateRequest(request);
      if (invalid) return fail(invalid);
      if (!host) return fail("host-unavailable");
      if (state.provider !== request.provider || !request.role || !validRole(request.role, request.provider) || !state.roles.some(role => sameRole(role, request.role))) return fail("role-required");
      if (state.expiresAt === null || timestamp(state.expiresAt) <= now()) return fail("authorization-expired", true);
      const role = structuredClone(state.roles.find(role => sameRole(role, request.role))!);
      const op = begin();
      state.selectedRole = role; state.status = "reading"; state.problem = null; state.previewCurrent = false;
      try {
        const reply = await invoke(op, () => host.readCurrentEquipment({ provider: request.provider, purpose: request.purpose, consent: request.consent, role: structuredClone(role) }, op.controller.signal));
        if (stale(op)) return failure("cancelled");
        if (containsSecrets(reply)) return fail("secret-input");
        if (!reply.ok) return hostFailure(reply.code);
        if (state.expiresAt === null || timestamp(state.expiresAt) <= now()) return fail("authorization-expired", true);
        const data = reply.value;
        if (!data.role || !sameRole(role, data.role)) return fail("role-mismatch");
        if (typeof data.equipmentJson !== "string" || !Number.isFinite(timestamp(data.fetchedAt))) return fail("invalid-data");
        const input = readInput(data.equipmentJson);
        if (!input.ok) return fail(input.secret ? "secret-input" : "invalid-data");
        const payload = input.value as { uid?: unknown } | null;
        if (payload && Object.hasOwn(payload, "uid") && payload.uid !== role.uid) return fail("role-mismatch");
        const normalized = importPlayerJson(data.equipmentJson, { fixture: true, uid: role.uid, now: new Date(now()).toISOString(), fetchedAt: data.fetchedAt });
        if (!normalized.ok) return fail(normalized.code === "secret-input" ? "secret-input" : "invalid-data");
        const roster = data.ownedAvatarIds;
        if (!Array.isArray(roster) || !roster.length || roster.length > 500 || roster.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(roster).size !== roster.length) return fail("invalid-data");
        const imported = normalized.snapshot.builds.map(build => {
          const id = build.identity.value?.id.match(/^(?:character:)?([1-9]\d*)$/)?.[1];
          return id === undefined ? NaN : Number(id);
        });
        if (imported.some(id => !Number.isSafeInteger(id)) || new Set(imported).size !== imported.length) return fail("invalid-data");
        if (data.rosterComplete !== true || roster.length !== imported.length || imported.some(id => !roster.includes(id))) return fail("partial-coverage");
        const snapshot = normalized.snapshot;
        snapshot.source = { ...snapshot.source, kind: "authorized-fixture", scope: "fixture-owned-current-equipment", fixture: true, uid: role.uid };
        snapshot.notices.unshift("合成宿主测试：未登录或读取真实账号；仅验证角色配装接入契约。");
        state.preview = structuredClone(snapshot); state.previewCurrent = true; state.status = "preview-ready";
        return { ok: true, fixture: true, value: structuredClone(snapshot) };
      } catch { return stale(op) ? failure("cancelled") : fail("unavailable"); }
      finally { end(op); }
    },
    cancel(): void {
      if (!active) return;
      ++generation; active.abort(); active = null;
      state.status = state.roles.length ? "select-role" : "idle";
      state.previewCurrent = false; state.problem = failure("cancelled");
    },
    async disconnect(): Promise<Result<void>> {
      if (state.status === "disconnecting") return failure("busy");
      const provider = state.provider;
      ++generation; active?.abort(); active = null;
      state = initial("disconnecting");
      try {
        if (host && provider !== null) await host.release(provider);
        state = initial("disconnected");
        return { ok: true, fixture: true, value: undefined };
      } catch {
        state = initial("disconnected"); state.problem = failure("disconnect-unconfirmed");
        return state.problem;
      }
    }
  };
}
