import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";

export const ACCOUNT_READ_LIMIT_MS = 600_000;

/** No browser import, network, profile discovery, or account operation. */
export function parseOfficialBrowserArguments(args) {
  const options = { operation: "plan", provider: "miyoushe", location: null, executablePath: null, acknowledgedLocation: null };
  const seen = new Set();
  for (const arg of args) {
    let key, value;
    if (["--plan", "--preflight", "--begin"].includes(arg)) { key = "operation"; value = arg.slice(2); }
    else if (arg.startsWith("--provider=")) { key = "provider"; value = arg.slice(11); if (!["miyoushe", "hoyolab"].includes(value)) return { ok: false, code: "invalid-options" }; }
    else if (arg.startsWith("--location=")) { key = "location"; value = arg.slice(11); if (!["user-device", "cloud"].includes(value)) return { ok: false, code: "invalid-options" }; }
    else if (arg.startsWith("--executable-path=")) { key = "executablePath"; value = arg.slice(18); if (!value || /[\r\n\0]/.test(value)) return { ok: false, code: "invalid-options" }; }
    else if (arg === "--acknowledge=temporary-user-device-account-read") { key = "acknowledgedLocation"; value = "user-device"; }
    else if (arg === "--acknowledge=temporary-cloud-account-read") { key = "acknowledgedLocation"; value = "cloud"; }
    else return { ok: false, code: "invalid-options" };
    if (seen.has(key)) return { ok: false, code: "invalid-options" };
    seen.add(key); options[key] = value;
  }
  return { ok: true, options };
}

export function inspectOfficialBrowserEnvironment(options, { platform = process.platform, env = process.env, inputIsTTY = Boolean(process.stdin.isTTY), promptIsTTY = Boolean(process.stderr.isTTY) } = {}) {
  const issues = [];
  if (options.location === null) issues.push("execution-location-required");
  if (!["win32", "darwin", "linux"].includes(platform)) issues.push("unsupported-platform");
  // Windows and macOS use their interactive desktop, not the Linux DISPLAY variable.
  if (platform === "linux" && !env.DISPLAY) issues.push("linux-visible-display-required");
  if (!inputIsTTY || !promptIsTTY) issues.push("interactive-terminal-required");
  if (options.operation === "begin" && options.acknowledgedLocation !== options.location) issues.push("explicit-account-scope-acknowledgment-required");
  if (options.executablePath !== null) {
    const valid = platform === "win32"
      ? /^[a-z]:[\\/]/i.test(options.executablePath) && path.win32.isAbsolute(options.executablePath)
      : path.posix.isAbsolute(options.executablePath);
    if (!valid || /[\r\n\0]/.test(options.executablePath)) issues.push("local-absolute-browser-path-required");
  }
  return { platform, headless: false, desktop: platform === "linux" ? "requires-visible-X11-or-XWayland-DISPLAY" : "requires-interactive-desktop",
    visibilityConfirmed: false, issues, readyForLocalBrowserCheck: issues.length === 0 };
}

/** Only the exact user-selected or Playwright-resolved binary is inspected.
 * No search of user profiles, browser account stores, or existing processes. */
export function checkOfficialBrowserBinary(executablePath, platform = process.platform) {
  try {
    if (!statSync(executablePath).isFile()) return { ok: false, code: "browser-binary-unavailable" };
    accessSync(executablePath, platform === "win32" ? constants.F_OK : constants.X_OK);
    return { ok: true };
  } catch { return { ok: false, code: "browser-binary-unavailable" }; }
}

/** A single temporary browser lifetime. Late resources are closed even when
 * cancellation/deadline wins a pending browser launch or context creation. */
export function createTemporaryBrowserLifetime({ onStop = () => {}, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let browser = null, context = null, stopped = false, releaseConfirmed = true, reason = null, closing = null;
  const release = async resource => {
    if (!resource) return;
    try { await resource.close(); } catch { releaseConfirmed = false; }
  };
  const stop = code => {
    if (stopped) return closing;
    stopped = true; reason = code; clearTimer(timer);
    // Assign the shared completion before any close callback can reenter stop.
    closing = Promise.resolve().then(async () => {
      try { onStop(code); } catch { releaseConfirmed = false; }
      const currentContext = context, currentBrowser = browser;
      context = null; browser = null;
      await release(currentContext); await release(currentBrowser);
      return { releaseConfirmed };
    });
    return closing;
  };
  const timer = setTimer(() => { void stop("local-deadline"); }, ACCOUNT_READ_LIMIT_MS);
  return {
    inspect: () => ({ stopped, reason, releaseConfirmed }),
    async attachBrowser(value) { if (stopped) { await release(value); return false; } browser = value; return true; },
    async attachContext(value) { if (stopped) { await release(value); return false; } context = value; return true; },
    stop,
  };
}
