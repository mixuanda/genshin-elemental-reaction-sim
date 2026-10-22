# 在用户电脑测试官方登录与配装观察

这是未验证真实账号连通的原型。代码在云端编写和测试；本轮没有操作用户电脑，也没有启动真实登录。Windows/macOS 支持仅完成平台与生命周期修复、模拟单测，尚未在对应实体桌面运行。

## 前提和接收方

用户主动在自己的交互桌面和终端启动命令，不通过 SSH、后台服务或隐藏窗口运行。推荐 Node.js 24.x 或 26.x。当前 [Playwright 官方系统要求](https://playwright.dev/docs/intro#system-requirements)包括 Windows 11+、macOS 14+；Linux 需受支持系统及可见的 X11/XWayland DISPLAY。Windows/macOS 不使用 Linux DISPLAY 门控。安装依赖和 Chromium 需要正常下载网络，登录还需要正常访问所选官方站点。

`--location=user-device` 表示账号会话只在执行命令的这台电脑的新建临时浏览器内。登录信息由官方页面处理，不交给终端、聊天、GIDPS 云服务或独立工作台。普通账号会话的权限超出只读；原型仅观察限定的原神绑定角色及当前配装响应，不表示官方颁发只读授权。

最长 10 分钟，从本次临时浏览器流程开始计时；完成、取消、关闭检查/主窗口、终端关闭、已识别挑战/限频/登录失效和异常都会停止并释放。不会读取已有 profile/Cookie，不连接既有浏览器，不导出 storageState、认证响应、账号令牌、HAR、trace、截图或凭据文件。不会创建刷新或持久访问。关闭只表示释放本次临时宿主，不声称官方全局退出；释放失败明确报告 temporary-browser-release-unconfirmed。

## 安装和无账号预检

在此分支仓库根目录执行以下命令。Windows PowerShell、macOS 终端均可使用相同命令；不要省略 `--location`。

```sh
npm ci
npx playwright install chromium
node apps/player-import/official-browser-host.mjs --plan --location=user-device --provider=miyoushe
node apps/player-import/official-browser-host.mjs --preflight --location=user-device --provider=miyoushe
```

默认使用 Playwright 安装的 Chromium，不硬编码浏览器路径。[安装命令](https://playwright.dev/docs/browsers#install-browsers)只下载浏览器二进制，不建立账号授权。

`--plan` 不导入浏览器、不发网络请求。`--preflight` 检查终端、平台和浏览器文件，然后只打开本地 about:blank 检查窗口。看见“GIDPS 临时浏览器可见性检查”后，在原终端输入 `visible`；成功输出 accountLoginStarted=false 并关闭。它不访问任何官方登录页。看不见窗口则输入 `cancel`，不要继续；仅有环境变量不证明窗口对用户可见。

如果使用自己合法安装且可信的 Chromium/Chrome/Edge，可明确给出本机绝对可执行文件路径。不同版本的兼容性需由预检实际确认，[Playwright 不保证任意自选版本兼容](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-option-executable-path)。不能传已有用户数据目录、浏览器连接地址或任意启动参数。

Windows 示例（路径应换成实际存在的文件；整项参数必须加引号）：

```powershell
node apps/player-import/official-browser-host.mjs --preflight --location=user-device "--executable-path=C:\Program Files\Chromium\Application\chrome.exe"
```

macOS 示例：

```sh
node apps/player-import/official-browser-host.mjs --preflight --location=user-device "--executable-path=/Applications/Chromium.app/Contents/MacOS/Chromium"
```

## 由用户主动开始一次真实测试

先由父线程与用户确认以上接收方、普通账号会话范围、10 分钟期限及本次测试。下面是用户随后可自行运行的命令，本轮云任务没有执行它：

```sh
node apps/player-import/official-browser-host.mjs --begin --location=user-device --provider=miyoushe --acknowledge=temporary-user-device-account-read
```

HoYoLAB 海外账号把 `--provider=miyoushe` 换为 `--provider=hoyolab`。如果预检用了自选浏览器，开始时附带同一项 `--executable-path=...`。参数只是调用意图，不是提供方授权令牌。

命令先打开本地检查窗口并打印当前接收方；确认窗口可见且范围正确后，在原终端输入 `official-login`，这才打开以下正常官方页面：

- 国服：[米游社原神社区](https://www.miyoushe.com/ys/)；随后可打开[官方原神战绩](https://webstatic.mihoyo.com/app/community-game-records/?game_id=2)。
- 海外：[HoYoLAB](https://www.hoyolab.com/home)；随后可打开[官方原神战绩](https://act.hoyolab.com/app/community-game-records-sea/m.html?gid=2)。

用户只在正常官方 UI 登录或扫描其提供的二维码。原型不生成二维码，不复制固定设备头，不拦截认证响应，不主动重放账号 API 或签名。出现不能正常完成的验证就 `cancel`；已识别的风险/限频响应会停止，程序不解验证码、切代理或自动重试。

登录后在终端输入 `record` 打开官方战绩；输入 `roles` 查看观察到的本人绑定 UID/服务器，再输入对应数字序号明确选择。没有观察到绑定列表时不能手填 UID 冒充本人绑定。选择后只收集后续匹配的装备响应；可在官方页面刷新/打开自己角色详情，再输入 `finish` 尝试输出净化 GOOD JSON。`cancel`、Ctrl+C 或关闭临时主窗口均会停止。

成功只表示本次观察到的角色列表与详情一致，输出还是**部分字段**，不能当作全账号/完整可计算配装。等级 100 原样保留；角色突破、天赋基础/附加拆分、圣遗物词条与位置转换未核验的部分保持未知，原数字观察保留于 observations。用户可将配装 JSON 放进既有文件/文本导入入口预览；不转发登录数据。详细字段边界与源码来源见 [AUTHORIZATION.md](../../packages/player-import/AUTHORIZATION.md)。

## 常见停止结果

| 结果 | 含义与下一步 |
| --- | --- |
| execution-location-required | 补上明确的 user-device 或 cloud；不会猜测执行位置。 |
| interactive-terminal-required | 在用户可见的正常终端启动，不用管道输入或隐藏任务。 |
| linux-visible-display-required | Linux 没有可见 X11/XWayland 显示；Windows/macOS 不检查此变量。 |
| browser-binary-unavailable | 运行对应版本的 `npx playwright install chromium`，或明确指定存在的可信浏览器文件。 |
| visible-browser-launch-failed | 本机浏览器、系统依赖或交互桌面不满足；还没有打开官方页面，不自动切无头登录。 |
| no-observed-bound-role / partial-coverage | 官方 UI 尚未发出本原型识别的完整响应，未声称连通/全量；不能用展示柜或合成数据补齐。 |
| challenge-required / rate-limited / login-required | 停止并释放本次临时浏览器，按官方正常要求处理后另行决定重试；没有绕过。 |
| temporary-browser-release-unconfirmed | 代码没确认释放，不能说已退出官方账号；检查本次打开的临时窗口/进程。 |

`--location=cloud` 使用独立且匹配的 `--acknowledge=temporary-cloud-account-read`，会明确云宿主持有账号状态；不能套用用户电脑确认。当前云环境没有可见显示，本轮仍没有启动云端真实登录。
