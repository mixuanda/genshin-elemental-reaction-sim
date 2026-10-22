export const ACCOUNT_READ_LIMIT_MS: 600000;
export interface OfficialBrowserOptions {
  operation: "plan" | "preflight" | "begin";
  provider: "miyoushe" | "hoyolab";
  location: "user-device" | "cloud" | null;
  executablePath: string | null;
  acknowledgedLocation: "user-device" | "cloud" | null;
}
export function parseOfficialBrowserArguments(args: string[]): { ok: true; options: OfficialBrowserOptions } | { ok: false; code: string };
export function inspectOfficialBrowserEnvironment(options: OfficialBrowserOptions, environment?: {
  platform?: string; env?: Record<string, string | undefined>; inputIsTTY?: boolean; promptIsTTY?: boolean;
}): { platform: string; headless: false; desktop: string; visibilityConfirmed: false; issues: string[]; readyForLocalBrowserCheck: boolean };
export function checkOfficialBrowserBinary(executablePath: string, platform?: string): { ok: true } | { ok: false; code: string };
export function createTemporaryBrowserLifetime(options?: {
  onStop?: (code: string | null) => void;
  setTimer?: (callback: () => void, delay: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}): {
  inspect(): { stopped: boolean; reason: string | null; releaseConfirmed: boolean };
  attachBrowser(resource: { close(): Promise<unknown> }): Promise<boolean>;
  attachContext(resource: { close(): Promise<unknown> }): Promise<boolean>;
  stop(code: string | null): Promise<{ releaseConfirmed: boolean }>;
};
