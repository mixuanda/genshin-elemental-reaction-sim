import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ACCOUNT_READ_LIMIT_MS, checkOfficialBrowserBinary, createTemporaryBrowserLifetime, inspectOfficialBrowserEnvironment, parseOfficialBrowserArguments, type OfficialBrowserOptions } from "../../../apps/player-import/official-browser-runtime.mjs";

const options = (args: string[] = ["--preflight", "--location=user-device"]): OfficialBrowserOptions => {
  const result = parseOfficialBrowserArguments(args);
  if (!result.ok) throw new Error("test-invalid-options");
  return result.options;
};
const interactive = { env: {}, inputIsTTY: true, promptIsTTY: true };

describe("cross-platform official browser preflight", () => {
  it("defaults to a zero-network plan with no guessed execution location or browser path", () => {
    expect(options([])).toEqual({ operation: "plan", provider: "miyoushe", location: null, executablePath: null, acknowledgedLocation: null });
    expect(inspectOfficialBrowserEnvironment(options([]), { ...interactive, platform: "win32" })).toMatchObject({ readyForLocalBrowserCheck: false, issues: ["execution-location-required"] });
  });

  it.each(["win32", "darwin"])("allows %s interactive desktop preflight without a Linux DISPLAY", platform => {
    const result = inspectOfficialBrowserEnvironment(options(), { ...interactive, platform });
    expect(result).toMatchObject({ platform, headless: false, readyForLocalBrowserCheck: true, visibilityConfirmed: false, issues: [] });
  });

  it("requires a Linux visible display and never treats its presence as confirmed visibility", () => {
    expect(inspectOfficialBrowserEnvironment(options(), { ...interactive, platform: "linux" }).issues).toContain("linux-visible-display-required");
    expect(inspectOfficialBrowserEnvironment(options(), { ...interactive, platform: "linux", env: { DISPLAY: ":99" } })).toMatchObject({ readyForLocalBrowserCheck: true, visibilityConfirmed: false });
  });

  it("requires interactive input and visible prompts even on Windows/macOS", () => {
    expect(inspectOfficialBrowserEnvironment(options(), { ...interactive, platform: "win32", inputIsTTY: false }).issues).toContain("interactive-terminal-required");
    expect(inspectOfficialBrowserEnvironment(options(), { ...interactive, platform: "darwin", promptIsTTY: false }).issues).toContain("interactive-terminal-required");
  });

  it("binds account acknowledgment to the explicitly chosen device/cloud location", () => {
    const mismatch = options(["--begin", "--location=user-device", "--acknowledge=temporary-cloud-account-read"]);
    expect(inspectOfficialBrowserEnvironment(mismatch, { ...interactive, platform: "win32" }).issues).toContain("explicit-account-scope-acknowledgment-required");
    for (const location of ["user-device", "cloud"] as const) {
      const matching = options(["--begin", `--location=${location}`, `--acknowledge=temporary-${location}-account-read`]);
      expect(inspectOfficialBrowserEnvironment(matching, { ...interactive, platform: "darwin" }).readyForLocalBrowserCheck).toBe(true);
    }
  });

  it("accepts one trusted local absolute binary path, including Windows spaces, without adding launch arguments", () => {
    const windows = options(["--preflight", "--location=user-device", "--executable-path=C:\\Program Files\\Chromium\\Application\\chrome.exe"]);
    expect(windows.executablePath).toBe("C:\\Program Files\\Chromium\\Application\\chrome.exe");
    expect(inspectOfficialBrowserEnvironment(windows, { ...interactive, platform: "win32" }).issues).toEqual([]);
    const mac = options(["--preflight", "--location=user-device", "--executable-path=/Applications/Chromium.app/Contents/MacOS/Chromium"]);
    expect(inspectOfficialBrowserEnvironment(mac, { ...interactive, platform: "darwin" }).issues).toEqual([]);
    for (const executable of ["chrome.exe", "https://example.invalid/chrome.exe", "\\\\server\\share\\chrome.exe"]) {
      const invalid = options(["--preflight", "--location=user-device", `--executable-path=${executable}`]);
      expect(inspectOfficialBrowserEnvironment(invalid, { ...interactive, platform: "win32" }).issues).toContain("local-absolute-browser-path-required");
    }
  });

  it("rejects ambiguous flags and any attempt to pass a profile, credentials, browser connection or arbitrary arguments", () => {
    for (const args of [["--begin", "--plan"], ["--location=cloud", "--location=user-device"], ["--provider=other"], ["--executable-path="], ["--user-data-dir=/tmp/existing"], ["--cookie=synthetic"], ["--connect-over-cdp=http://127.0.0.1:9222"], ["--args=--disable-web-security"]]) {
      expect(parseOfficialBrowserArguments(args)).toEqual({ ok: false, code: "invalid-options" });
    }
  });

  it("checks only the chosen file and reports missing, directory or non-executable paths without echoing them", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "gidps-browser-preflight-"));
    try {
      const file = path.join(directory, "not-browser"); writeFileSync(file, "synthetic executable fixture"); chmodSync(file, 0o600);
      expect(checkOfficialBrowserBinary(directory)).toEqual({ ok: false, code: "browser-binary-unavailable" });
      expect(checkOfficialBrowserBinary(path.join(directory, "missing"))).toEqual({ ok: false, code: "browser-binary-unavailable" });
      if (process.platform !== "win32") expect(checkOfficialBrowserBinary(file)).toEqual({ ok: false, code: "browser-binary-unavailable" });
      expect(checkOfficialBrowserBinary(process.execPath)).toEqual({ ok: true });
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});

describe("one temporary browser lifetime", () => {
  const setup = () => {
    let deadline: (() => void) | undefined, delay = 0;
    const onStop = vi.fn(), clearTimer = vi.fn();
    const scope = createTemporaryBrowserLifetime({ onStop, setTimer: (callback, milliseconds) => { deadline = callback; delay = milliseconds; return 1; }, clearTimer });
    return { scope, onStop, clearTimer, deadline: () => deadline!(), delay: () => delay };
  };

  it("releases context before browser exactly once and exposes no account data", async () => {
    const { scope, onStop, clearTimer } = setup(), order: string[] = [];
    await scope.attachBrowser({ close: async () => { order.push("browser"); } });
    await scope.attachContext({ close: async () => { order.push("context"); } });
    const first = scope.stop("cancelled"), second = scope.stop("another-reason");
    expect(first).toBe(second);
    expect(await first).toEqual({ releaseConfirmed: true });
    expect(order).toEqual(["context", "browser"]);
    expect(onStop).toHaveBeenCalledOnce(); expect(clearTimer).toHaveBeenCalledOnce();
    expect(scope.inspect()).toEqual({ stopped: true, reason: "cancelled", releaseConfirmed: true });
  });

  it("stops after the fixed 10 minutes and closes a browser/context that arrives after cancellation", async () => {
    const { scope, deadline, delay } = setup();
    expect(delay()).toBe(ACCOUNT_READ_LIMIT_MS); expect(ACCOUNT_READ_LIMIT_MS).toBe(600_000);
    deadline(); await scope.stop(null);
    const lateBrowser = { close: vi.fn(async () => {}) }, lateContext = { close: vi.fn(async () => {}) };
    expect(await scope.attachBrowser(lateBrowser)).toBe(false);
    expect(await scope.attachContext(lateContext)).toBe(false);
    expect(lateBrowser.close).toHaveBeenCalledOnce(); expect(lateContext.close).toHaveBeenCalledOnce();
    expect(scope.inspect()).toMatchObject({ stopped: true, reason: "local-deadline" });
  });

  it("reports unconfirmed release while still attempting the other resource", async () => {
    const { scope } = setup(), closeBrowser = vi.fn(async () => {});
    await scope.attachBrowser({ close: closeBrowser });
    await scope.attachContext({ close: async () => { throw new Error("synthetic-close-failure"); } });
    expect(await scope.stop("challenge-required")).toEqual({ releaseConfirmed: false });
    expect(closeBrowser).toHaveBeenCalledOnce();
    expect(scope.inspect()).toEqual({ stopped: true, reason: "challenge-required", releaseConfirmed: false });
  });
});
