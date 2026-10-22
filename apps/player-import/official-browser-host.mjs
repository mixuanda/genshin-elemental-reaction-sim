#!/usr/bin/env node
import { createInterface } from "node:readline";
import { createOfficialEquipmentObserver, matchOfficialEquipmentResponse } from "../../packages/player-import/src/official-browser-observer.mjs";

// Default execution is a zero-network plan. No browser, provider requests,
// credentials, persistent profile, recording, or login is created by --plan.
const args = process.argv.slice(2);
const provider = args.find(arg => arg.startsWith("--provider="))?.slice("--provider=".length) ?? "miyoushe";
const begin = args.includes("--begin");
const allowed = new Set(["--plan", "--begin", "--provider=miyoushe", "--provider=hoyolab", "--acknowledge=temporary-cloud-account-read"]);
if (args.some(arg => !allowed.has(arg)) || !["miyoushe", "hoyolab"].includes(provider) || (begin && args.includes("--plan"))) {
  process.stderr.write("invalid-options\n"); process.exitCode = 2;
} else {
  const official = provider === "miyoushe" ? {
    login: "https://www.miyoushe.com/ys/", record: "https://webstatic.mihoyo.com/app/community-game-records/?game_id=2",
    dataOrigins: ["https://api-takumi.mihoyo.com", "https://passport-api.mihoyo.com", "https://api-takumi-record.mihoyo.com"],
  } : {
    login: "https://www.hoyolab.com/home", record: "https://act.hoyolab.com/app/community-game-records-sea/m.html?gid=2",
    dataOrigins: ["https://api-os-takumi.mihoyo.com", "https://api-account-os.hoyolab.com", "https://sg-public-api.hoyolab.com"],
  };
  const plan = {
    prototype: "passive-official-ui-observer", location: "current-cloud-host", provider, execution: begin ? "explicit-begin-requested" : "plan-only-zero-network",
    realLoginVerified: false, realEquipmentReadVerified: false, officialPages: official,
    recipients: ["提供方官方页面与其正常登录系统", "当前云宿主的新建临时浏览器与本次 CLI 内存"],
    accountAccess: "普通账号会话，权限超出只读；不是提供方颁发的只读 OAuth 范围。宿主仅被动观察限定的本人配装响应。",
    localRetentionLimitMs: 600_000, retentionIsProviderExpiry: false,
    persistence: "不读已有浏览器配置，不导出 Cookie/storageState，不写登录或配装文件，不建后台访问。完成、取消、异常、挑战、限频、到期即关闭临时上下文。",
    output: "用户选定官方绑定 UID/服务器后，仅当本次列表与详细响应一致，输出部分字段 GOOD JSON；圣遗物原观察另保留，不声称可完整计算。",
    visibility: { displayAvailable: Boolean(process.env.DISPLAY), supportedByThisPrototype: "可见的交互式官方页面；本云环境目前没有 DISPLAY。", cloudQr: "无头浏览器可加载页面，但二维码展示、用户可见交互和验证挑战通道尚未实现或验证；不会盲目开始登录。" },
    unresolved: ["真实账号尚未验证两区官方 UI 是否发出本原型识别的绑定/list/detail 响应。", "官方 UI 如只按需返回部分详细角色，需用户在官方页面打开缺少的角色；缺项返回 partial-coverage。", "官方当前字段/语义、完整已拥有覆盖、挑战行为及站点规则仍需获准真号验证。"],
    beginRequirements: ["父线程先向用户明确当前云宿主接收方、账号会话权限及 10 分钟上限，并协调本次真实操作。", "有用户可见、可正常完成登录及验证的官方 UI 通道。", "显式 --begin --acknowledge=temporary-cloud-account-read；此参数只表达调用意图，本身不证明用户授权。"],
  };
  if (!begin) process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  else if (!args.includes("--acknowledge=temporary-cloud-account-read")) { process.stderr.write("explicit-account-scope-acknowledgment-required\n"); process.exitCode = 2; }
  else if (!process.stdin.isTTY || !process.env.DISPLAY) { process.stderr.write("interactive-official-ui-unavailable: current cloud requires a reviewed visible login/QR and challenge channel; no browser or login started\n"); process.exitCode = 2; }
  else {
    // No real begin is exercised in automated checks. Only normal official UI
    // makes account requests; no API replay, device spoofing or signature code.
    let browser, context, timer, terminal;
    const observer = createOfficialEquipmentObserver({ provider });
    let stopped = false;
    const stop = async code => {
      if (stopped) return;
      stopped = true; clearTimeout(timer); observer.close(); terminal?.close();
      let released = true;
      try { await context?.close(); } catch { released = false; }
      try { await browser?.close(); } catch { released = false; }
      if (!released) process.stderr.write("temporary-browser-release-unconfirmed\n");
      if (code) process.stderr.write(`${code}\n`);
    };
    const interrupt = () => { void stop("cancelled"); };
    try {
      const { chromium } = await import("@playwright/test");
      browser = await chromium.launch({ headless: false, executablePath: "/usr/bin/chromium" });
      context = await browser.newContext({ acceptDownloads: false, serviceWorkers: "block" });
      timer = setTimeout(() => { void stop("local-deadline"); }, 600_000);
      const page = await context.newPage();
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
        if (stopped) return;
        const request = response.request(), url = response.url(), method = request.method();
        const target = matchOfficialEquipmentResponse(provider, url, method);
        if (!target) return; // Never inspect login responses, headers, or bodies.
        try {
          const length = Number(await response.headerValue("content-length"));
          if (length > 2_000_000) { await stop("response-limit"); return; }
          const result = observer.observe({ url, method, status: response.status(),
            requestBody: target === "roles" ? null : request.postData(), responseBody: await response.text() });
          if (!result.ok) await stop(result.code);
        } catch { if (!stopped) await stop("observation-failed"); }
      });
      process.once("SIGINT", interrupt); process.once("SIGTERM", interrupt);
      browser.on("disconnected", () => { void stop("browser-closed"); });
      terminal = createInterface({ input: process.stdin, output: process.stderr });
      terminal.on("close", () => { if (!stopped) void stop("cancelled"); });
      process.stderr.write("仅在官方可见页面登录。命令 roles 查看本次绑定列表；数字序号显式选择；record 打开官方战绩；finish 输出净化的部分字段；cancel 关闭。不要在终端输入密码或任何凭据。\n");
      await page.goto(official.login, { waitUntil: "domcontentloaded", timeout: 30_000 });
      for await (const raw of terminal) {
        if (stopped) break;
        const command = raw.trim();
        if (command === "cancel") { await stop("cancelled"); break; }
        if (command === "roles") {
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
    } catch { process.exitCode = 1; await stop("prototype-failed"); }
    finally { process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", interrupt); await stop(null); }
  }
}
