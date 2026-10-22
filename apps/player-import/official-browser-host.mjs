#!/usr/bin/env node
import { createInterface } from "node:readline";
import { createOfficialEquipmentObserver, matchOfficialEquipmentResponse } from "../../packages/player-import/src/official-browser-observer.mjs";
import { ACCOUNT_READ_LIMIT_MS, checkOfficialBrowserBinary, createTemporaryBrowserLifetime, inspectOfficialBrowserEnvironment, parseOfficialBrowserArguments } from "./official-browser-runtime.mjs";

// Default execution is a zero-network plan. No browser, provider requests,
// credentials, persistent profile, recording, or login is created by --plan.
const parsed = parseOfficialBrowserArguments(process.argv.slice(2));
if (!parsed.ok) {
  process.stderr.write("invalid-options\n"); process.exitCode = 2;
} else {
  const options = parsed.options, { provider, location, operation } = options;
  const environment = inspectOfficialBrowserEnvironment(options);
  const hostName = location === "user-device" ? "用户主动运行此命令的电脑" : location === "cloud" ? "明确选定的云宿主" : "尚未选择执行位置；不会开始浏览器或登录";
  const official = provider === "miyoushe" ? {
    login: "https://www.miyoushe.com/ys/", record: "https://webstatic.mihoyo.com/app/community-game-records/?game_id=2",
    dataOrigins: ["https://api-takumi.mihoyo.com", "https://passport-api.mihoyo.com", "https://api-takumi-record.mihoyo.com"],
  } : {
    login: "https://www.hoyolab.com/home", record: "https://act.hoyolab.com/app/community-game-records-sea/m.html?gid=2",
    dataOrigins: ["https://api-os-takumi.mihoyo.com", "https://api-account-os.hoyolab.com", "https://sg-public-api.hoyolab.com"],
  };
  const plan = {
    prototype: "passive-official-ui-observer", location, provider, execution: operation === "plan" ? "plan-only-zero-network" : `${operation}-requested`,
    realLoginVerified: false, realEquipmentReadVerified: false, officialPages: official,
    recipients: ["提供方官方页面与其正常登录系统", `${hostName}的新建临时浏览器与本次 CLI 内存`,
      location === "user-device" ? "账号状态留在该电脑，不发送给 GIDPS 云服务。" : location === "cloud" ? "所选云宿主持有本次临时账号状态，不转发给 GIDPS 页面或其他应用。" : "尚未指定宿主；计划不会开始登录。"],
    accountAccess: "普通账号会话，权限超出只读；不是提供方颁发的只读 OAuth 范围。宿主仅被动观察限定的本人配装响应。",
    localRetentionLimitMs: ACCOUNT_READ_LIMIT_MS, retentionIsProviderExpiry: false,
    persistence: "不读已有浏览器配置，不导出 Cookie/storageState，不写登录或配装文件，不建后台访问。完成、取消、异常、挑战、限频、到期即关闭临时上下文。",
    output: "用户选定官方绑定 UID/服务器后，仅当本次列表与详细响应一致，输出部分字段 GOOD JSON；圣遗物原观察另保留，不声称可完整计算。",
    visibility: environment,
    browser: { source: options.executablePath === null ? "Playwright installed Chromium" : "explicit local executable path", executablePath: options.executablePath,
      installCommand: "npx playwright install chromium", check: "--preflight 只打开本地空白窗口，用户确认可见后立即释放；不访问官方页面。" },
    unresolved: ["真实账号尚未验证两区官方 UI 是否发出本原型识别的绑定/list/detail 响应。", "官方 UI 如只按需返回部分详细角色，需用户在官方页面打开缺少的角色；缺项返回 partial-coverage。", "官方当前字段/语义、完整已拥有覆盖、挑战行为及站点规则仍需获准真号验证。"],
    beginRequirements: ["显式 --location=user-device 或 --location=cloud，明确对应宿主、普通账号会话权限和 10 分钟上限。", "有交互终端和用户可见的正常桌面；Windows/macOS 不要求 DISPLAY，Linux 需要可见 X11/XWayland DISPLAY。", "先 --preflight 检查可信浏览器；真实 --begin 还需与位置匹配的 --acknowledge=temporary-<location>-account-read，随后在本机终端输入 official-login 才打开官方页面。此参数本身不证明用户授权。"],
  };
  if (operation === "plan") process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  else if (!environment.readyForLocalBrowserCheck) { process.stderr.write(`${environment.issues.join("\n")}\nno browser or login started\n`); process.exitCode = 2; }
  else {
    // No real begin is exercised in automated checks. Only normal official UI
    // makes account requests; no API replay, device spoofing or signature code.
    let browser, context, terminal;
    const observer = createOfficialEquipmentObserver({ provider });
    let officialStarted = false;
    const lifetime = createTemporaryBrowserLifetime({ onStop: code => { observer.close(); terminal?.close(); if (code) process.stderr.write(`${code}\n`); } });
    const stopped = () => lifetime.inspect().stopped;
    const stop = code => lifetime.stop(code);
    const interrupt = () => { void stop("cancelled"); };
    process.once("SIGINT", interrupt); process.once("SIGTERM", interrupt);
    try {
      let chromium;
      try { ({ chromium } = await import("@playwright/test")); }
      catch { throw new Error("playwright-package-unavailable"); }
      if (stopped()) throw new Error("cancelled");
      const binary = checkOfficialBrowserBinary(options.executablePath ?? chromium.executablePath());
      if (!binary.ok) throw new Error(binary.code);
      try { browser = await chromium.launch({ headless: false, ...(options.executablePath === null ? {} : { executablePath: options.executablePath }) }); }
      catch { throw new Error("visible-browser-launch-failed"); }
      if (!await lifetime.attachBrowser(browser)) throw new Error("cancelled");
      context = await browser.newContext({ acceptDownloads: false, serviceWorkers: "block" });
      if (!await lifetime.attachContext(context)) throw new Error("cancelled");
      const page = await context.newPage();
      if (stopped()) throw new Error("cancelled");
      context.on("close", () => { void stop("browser-context-closed"); });
      page.on("close", () => { void stop("browser-window-closed"); });
      if (page.isClosed()) throw new Error("cancelled");
      const allowedPage = url => {
        try { const parsed = new URL(url); return parsed.protocol === "https:" && !parsed.username && !parsed.password &&
          ["miyoushe.com", "mihoyo.com", "hoyolab.com", "hoyoverse.com"].some(domain => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)); }
        catch { return false; }
      };
      context.on("page", popup => popup.on("framenavigated", frame => {
        if (frame === popup.mainFrame() && frame.url() !== "about:blank" && !allowedPage(frame.url())) void stop("unexpected-official-navigation");
      }));
      page.on("framenavigated", frame => {
        if (frame === page.mainFrame() && frame.url() !== "about:blank" && !allowedPage(frame.url())) void stop("unexpected-official-navigation");
      });
      context.on("response", async response => {
        if (stopped() || !officialStarted) return;
        const request = response.request(), url = response.url(), method = request.method();
        const target = matchOfficialEquipmentResponse(provider, url, method);
        if (!target) return; // Never inspect login responses, headers, or bodies.
        try {
          const length = Number(await response.headerValue("content-length"));
          if (length > 2_000_000) { await stop("response-limit"); return; }
          const result = observer.observe({ url, method, status: response.status(),
            requestBody: target === "roles" ? null : request.postData(), responseBody: await response.text() });
          if (!result.ok) await stop(result.code);
        } catch { if (!stopped()) await stop("observation-failed"); }
      });
      browser.on("disconnected", () => { void stop("browser-closed"); });
      terminal = createInterface({ input: process.stdin, output: process.stderr });
      terminal.on("close", () => { if (!stopped()) void stop("cancelled"); });
      terminal.on("SIGINT", interrupt);
      await page.setContent("<!doctype html><title>GIDPS temporary browser check</title><h1>GIDPS 临时浏览器可见性检查</h1><p>本页在 about:blank，没有官方登录。确认此窗口可见后，回到原终端继续；关闭终端或输入 cancel 即释放。</p>");
      process.stderr.write(`${hostName}；临时浏览器已打开本地空白检查页。普通账号会话权限超出只读，最长 10 分钟。无需向 GIDPS 或终端提供 Cookie/密码。\n`);
      process.stderr.write(operation === "preflight" ? "如果你看见 GIDPS 临时浏览器检查窗口，输入 visible 完成并关闭；cancel 取消。不会打开官方页面。\n" : "如果你看见检查窗口且已确认上述接收范围，输入 official-login 才打开官方页面；cancel 取消。\n");
      for await (const raw of terminal) {
        if (stopped()) break;
        const command = raw.trim();
        if (command === "cancel") { await stop("cancelled"); break; }
        if (operation === "preflight") {
          if (command === "visible") { process.stdout.write(`${JSON.stringify({ preflight: "visible-browser-confirmed-by-operator", location, platform: environment.platform, accountLoginStarted: false })}\n`); await stop(null); break; }
          process.stderr.write("unsupported-command\n"); continue;
        }
        if (!officialStarted) {
          if (command === "official-login") {
            officialStarted = true;
            process.stderr.write("仅在官方可见页面正常登录。命令 roles 查看本次绑定列表；数字序号选择；record 打开官方战绩；finish 输出部分配装；cancel 关闭。不要在终端输入凭据。\n");
            await page.goto(official.login, { waitUntil: "domcontentloaded", timeout: 30_000 });
          } else process.stderr.write("official-login-or-cancel-required\n");
        } else if (command === "roles") {
          const state = observer.inspect();
          process.stderr.write(state.roles.length ? `${state.roles.map((role, index) => `${index + 1}: ${role.uid} / ${role.server}`).join("\n")}\n` : "no-observed-bound-role: open own official game record; no role is inferred\n");
        } else if (/^[1-9]\d{0,2}$/.test(command)) {
          const role = observer.inspect().roles[Number(command) - 1];
          process.stderr.write(role && observer.selectRole(role).ok ? "role-selected; only subsequent matching equipment responses are observed\n" : "role-required\n");
        } else if (command === "record") {
          await page.goto(official.record, { waitUntil: "domcontentloaded", timeout: 30_000 });
        } else if (command === "finish") {
          const result = observer.finish();
          if (result.ok) { process.stdout.write(`${result.goodJson}\n`); await stop(null); break; }
          process.stderr.write(`${result.code}\n`);
        } else process.stderr.write("unsupported-command\n");
      }
    } catch (cause) {
      const codes = ["playwright-package-unavailable", "browser-binary-unavailable", "visible-browser-launch-failed", "cancelled"];
      process.exitCode = 1; await stop(codes.includes(cause?.message) ? cause.message : "prototype-failed");
    }
    finally {
      process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", interrupt); await stop(null);
      if (!lifetime.inspect().releaseConfirmed) { process.stderr.write("temporary-browser-release-unconfirmed\n"); process.exitCode = 1; }
    }
  }
}
