import { MAX_INPUT_BYTES, containsSecrets } from "./input";
import { importPlayerJson } from "./normalize";
import type { ImportResult, ImportSnapshot } from "./model";

export interface PublicTransport {
  (url: string, init: RequestInit): Promise<Response>;
}
/** Public showcase only. Fixed origin, no cookies/authorization, no retries or durable cache. */
export async function fetchEnkaUid(uid: string, transport: PublicTransport = fetch, now = () => new Date().toISOString()): Promise<ImportResult> {
  if (!/^[1-9]\d{8,9}$/.test(uid)) return { ok: false, code: "invalid-input", message: "UID 必须为 9–10 位数字。" };
  try {
    const response = await transport(`https://enka.network/api/uid/${uid}/`, {
      credentials: "omit", redirect: "error", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) return { ok: false, code: "unavailable", message: response.status === 429 ? "展示柜服务限流，请稍后重试。旧数据保持。" : "展示柜不可用或不可见。旧数据保持。" };
    const reader = response.body?.getReader();
    if (!reader) return { ok: false, code: "invalid-input", message: "展示柜响应为空。旧数据保持。" };
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_INPUT_BYTES) { await reader.cancel(); return { ok: false, code: "invalid-input", message: "展示柜响应超出 2 MB 限制。旧数据保持。" }; }
      chunks.push(value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const c of chunks) { body.set(c, offset); offset += c.byteLength; }
    return importPlayerJson(new TextDecoder("utf-8", { fatal: true }).decode(body), { uid, viaUid: true, fetchedAt: now() });
  } catch { return { ok: false, code: "unavailable", message: "展示柜请求失败或超时。旧数据保持。" }; }
}

export interface AuthorizedEquipmentRequest {
  provider: "miyoushe" | "hoyolab";
  purpose: "read-owned-current-equipment";
  consent: "user-initiated";
}
export interface AuthorizedEquipmentAdapter {
  readonly mode: "credential-free-prototype";
  readonly capabilities: { realLogin: false; ownedCurrentEquipment: "fixture-only"; inventory: false; history: false; sessionStorage: false };
  readCurrentEquipment(request: AuthorizedEquipmentRequest): Promise<ImportResult>;
  disconnect(): Promise<void>;
}
/** Future host boundary: the host owns user consent, login UI, revocation and scoped reads.
 * Implementations must return sanitized equipment, never cookies/tokens/session handles.
 * This prototype has no credential parameter, login, account discovery, IO or persistence.
 */
export function createAuthorizedFixtureAdapter(fixtureText: string): AuthorizedEquipmentAdapter {
  const parsed = importPlayerJson(fixtureText, { fixture: true });
  let disconnected = false;
  return {
    mode: "credential-free-prototype",
    capabilities: { realLogin: false, ownedCurrentEquipment: "fixture-only", inventory: false, history: false, sessionStorage: false },
    async readCurrentEquipment(request) {
      if (disconnected) return { ok: false, code: "unavailable", message: "合成适配器已断开；需要重新主动发起。" };
      if (containsSecrets(request)) return { ok: false, code: "secret-input", message: "授权适配器请求含禁用凭据字段，已拒绝。" };
      if (!request || !["miyoushe", "hoyolab"].includes(request.provider) || request.purpose !== "read-owned-current-equipment" || request.consent !== "user-initiated") return { ok: false, code: "invalid-input", message: "需要用户主动发起的当前配装读取请求。" };
      if (!parsed.ok) return parsed;
      const result = structuredClone(parsed);
      return { ok: true, snapshot: {
        ...result.snapshot, source: { ...result.snapshot.source, kind: "authorized-fixture", scope: "fixture-owned-current-equipment" },
        notices: ["合成授权适配器演示：未连接米游社/HoYoLAB；不证明任何真实账号的角色覆盖率。", ...result.snapshot.notices]
      } };
    },
    async disconnect() { disconnected = true; /* No real session exists. */ }
  };
}

/** Atomic in-memory application. Failed, empty and partial previews cannot replace prior data.
 * This standalone workspace applies one source snapshot. Preview is never autosaved.
 */
export function applyPreview(previous: ImportSnapshot | null, preview: ImportResult): { applied: boolean; current: ImportSnapshot | null; message: string } {
  if (!preview.ok || preview.snapshot.builds.length === 0 || preview.snapshot.builds.some(b => b.completeness.state !== "complete")) return { applied: false, current: previous, message: "未应用：导入失败或配装仍有待确认字段，旧数据保持。" };
  // Each snapshot has one source provenance. Do not merge differently sourced rows under it.
  // Keep the old snapshot as a separate revision in the host when adding library persistence.
  return { applied: true, current: structuredClone(preview.snapshot), message: "已将完整预览应用到本页内存；未写入计算器或本地存储。" };
}
