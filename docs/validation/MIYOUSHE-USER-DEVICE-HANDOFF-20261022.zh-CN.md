# 米游社原型：交给用户电脑验证

代码：独立分支 `cloud/miyoushe-import-20261022`，提交 `281f98b2f38ecc4519b7f85377a8b341d73ab2fc`；尚未接入／发布到生产计算器。本轮仅执行 `--plan`，成功退出 0，明确 `plan-only-zero-network`、`realLoginVerified=false`、`realEquipmentReadVerified=false`。没有打开真实登录或建立账号访问。

## 可执行入口

在用户可见的交互桌面／终端，使用此提交的独立检出。Node.js 24.x/26.x；使用 Playwright 支持的系统与其配套 Chromium。Windows/macOS 实体机仍未测试。

```sh
git clone --branch cloud/miyoushe-import-20261022 --single-branch https://github.com/mixuanda/genshin-elemental-reaction-sim.git GIDPS-player-import
cd GIDPS-player-import
git checkout 281f98b2f38ecc4519b7f85377a8b341d73ab2fc
npm ci
npx playwright install chromium
node apps/player-import/official-browser-host.mjs --plan --location=user-device --provider=miyoushe
node apps/player-import/official-browser-host.mjs --preflight --location=user-device --provider=miyoushe
```

`--plan` 不联网；`--preflight` 只打开本地空白可见性检查。用户看到窗口标题「GIDPS 临时浏览器可见性检查」后，在终端输入 `visible`；看不到则 `cancel`。这一步不访问账号，不应自动改成无头浏览器。

实际一次账号测试须由父线程明确安排接收方、账号范围与十分钟临时期限，之后用户自行执行以下入口；本云任务没有执行：

```sh
node apps/player-import/official-browser-host.mjs --begin --location=user-device --provider=miyoushe --acknowledge=temporary-user-device-account-read
```

界面必须对用户可见。程序先显示接收方／范围，用户在终端输入 `official-login` 才会进入正常官方页面：

| 区域 | 正常登录目的地 | 官方战绩目的地 |
| --- | --- | --- |
| 国服 `miyoushe` | https://www.miyoushe.com/ys/ | https://webstatic.mihoyo.com/app/community-game-records/?game_id=2 |
| 海外 `hoyolab` | https://www.hoyolab.com/home | https://act.hoyolab.com/app/community-game-records-sea/m.html?gid=2 |

海外将参数改为 `--provider=hoyolab`。用户仅在官方 UI 完成正常登录或扫描官方提供的二维码。随后终端 `record` → `roles` → 选择实际观察到的本人 UID／服务器序号；在官方页面打开自己的角色详情，`finish` 输出净化的部分配装 JSON。没有观察到绑定列表不能手填 UID 冒充本人绑定。`cancel`、Ctrl+C、关窗均停止。

## 接收方、秘密边界和未完成项

普通官方账号会话不是第三方只读 OAuth，权限本身超出只读；本原型仅被动观察限定的本人角色／当前已装备数据。会话只留在用户电脑本次新建的临时浏览器和 CLI 内存，最长十分钟。不读取已有浏览器 profile，不导出或转发 Cookie、密码、token、storageState、认证响应、HAR/trace/截图；不写凭据文件，不建立刷新或持久访问，不把账号状态交给 GIDPS 云服务。净化配装输出可由用户主动交给已有导入预览。观察到挑战、限流、过期等就停止，不绕过风控。

成功不代表全角色完整覆盖。原型尚须在真实官方 UI 核实绑定/list/detail响应；官方页面按需返回详情可能要求用户逐个打开。当前适配器保留95/100级、真实零、明确名称／单位的装备属性，缺角色突破和基础／附加天赋拆分仍保持未知，不能输出假完整计算。失败或不完整预览不覆盖旧完整快照。

本云环境 `--plan` 实测缺少可见桌面和交互 TTY；这只限制这里进行真人交互，不证明用户电脑不可用。未尝试 `--preflight` 或 `--begin`。真实账号步骤状态：**尚未执行，等待父线程安排用户电脑和本次具体授权；没有拒绝或未知已执行结果**。释放失败会明确输出 `temporary-browser-release-unconfirmed`，不声称官方全局退出。

完整操作文档：[独立分支 USER-DEVICE.md](https://github.com/mixuanda/genshin-elemental-reaction-sim/blob/281f98b2f38ecc4519b7f85377a8b341d73ab2fc/apps/player-import/USER-DEVICE.md)；字段边界：[OBSERVATION-FIELDS.md](https://github.com/mixuanda/genshin-elemental-reaction-sim/blob/281f98b2f38ecc4519b7f85377a8b341d73ab2fc/packages/player-import/OBSERVATION-FIELDS.md)。
