export type ObserverProvider = "miyoushe" | "hoyolab";
export interface ObservedRole { uid: string; server: string }
export type ObservationResult = { ok: true; ignored?: boolean } | { ok: false; code: string };
export function matchOfficialEquipmentResponse(provider: ObserverProvider, url: string, method: string): "roles" | "roster" | "details" | null;
export function createOfficialEquipmentObserver(options: {
  provider: ObserverProvider;
  evidence?: "official-ui-unverified" | "synthetic-test";
  now?: () => number;
  maxDurationMs?: number;
}): {
  inspect(): { status: "closed" | "observing-equipment" | "select-role"; problem: string | null;
    roles: ObservedRole[]; selected: ObservedRole | null; rosterCount: number; detailCount: number;
    localDeadline: string; realLoginVerified: false };
  selectRole(role: ObservedRole): ObservationResult;
  observe(event: { url: string; method: string; requestBody?: string | null; status: number; responseBody: string }): ObservationResult;
  finish(): { ok: true; goodJson: string } | { ok: false; code: string };
  close(): void;
};
