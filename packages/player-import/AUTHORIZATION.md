# 米游社 / HoYoLAB 当前配装导入

核对日期：2026-10-22。**找到成熟客户端采用的正常账号登录与本人配装读取路线；本轮仅在云端编写和测试原型，尚未操作用户电脑或执行真实登录/读取。** 没找到公开只读 OAuth 合同，不等于无法继续实现。当前交付包含可明确选择 user-device/cloud、默认零网络的宿主 CLI、可见空白窗口预检、响应观察器及已有导入器的部分字段接入。它不是已连通的账号服务。Windows/macOS 已完成参数/平台适配和模拟测试，尚未实机验证。

本分支复用 `73c7d1c119e605c62299881eba65b11b857eb89c` 的 `authorized-host.ts` 契约，未重新实现 GOOD / Enka / 文本解析。该旧契约仍是 fixture-only，不把新宿主结果塞进它来伪称真实授权成功。

## 已核实的正常客户端路线

| 环节 | 公开主来源与结论 | 尚未证实 |
| --- | --- | --- |
| 米游社扫码 | genshin.py 的 [login_with_qrcode](https://github.com/seriaati/genshin.py/blob/2d20ab1ad7e8af722d179a2cf0d79db5f8a9b213/genshin/client/components/auth/client.py#L289) 仅标记中国区；[子客户端](https://github.com/seriaati/genshin.py/blob/2d20ab1ad7e8af722d179a2cf0d79db5f8a9b213/genshin/client/components/auth/subclients/app.py#L232) 向官方 passport-api.miyoushe.com 创建/查询二维码，确认后取得账号会话。 | 不构成只读 OAuth；本项目没有调用。这套库的[设备头](https://github.com/seriaati/genshin.py/blob/2d20ab1ad7e8af722d179a2cf0d79db5f8a9b213/genshin/utility/auth.py#L79)含固定设备信息，本项目不复制，不冒充其客户端。 |
| 两区官方网页登录 | Starward 的[登录页面实现](https://github.com/Scighost/Starward/blob/df8ae07b5ad4c9c6cb70d288488ce8073ce01478/src/Starward/Features/GameRecord/LoginPage.xaml.cs#L25)在自身 WebView 打开 www.miyoushe.com 或 www.hoyolab.com，由官方页面完成登录。 | 不能套用国服 QR 到海外；当前官方 UI 的扫码与挑战状态未真号验证。 |
| 本人绑定 UID / 服务器 | genshin.py [get_game_accounts](https://github.com/seriaati/genshin.py/blob/2d20ab1ad7e8af722d179a2cf0d79db5f8a9b213/genshin/client/components/base.py#L499)读取当前登录用户的绑定角色；[账号模型](https://github.com/seriaati/genshin.py/blob/2d20ab1ad7e8af722d179a2cf0d79db5f8a9b213/genshin/models/hoyolab/record.py#L29)明确 game_biz / game_uid / region。 | 必须观察到绑定列表并由用户明确选择，不从 UID 前缀推服务器，不自动选择等级最高的账号。 |
| 当前配装 | genshin.py 的[角色读取](https://github.com/seriaati/genshin.py/blob/2d20ab1ad7e8af722d179a2cf0d79db5f8a9b213/genshin/client/components/chronicle/genshin.py#L78)先 POST character/list，再以返回 ID 调用 character/detail；[数据模型](https://github.com/seriaati/genshin.py/blob/2d20ab1ad7e8af722d179a2cf0d79db5f8a9b213/genshin/models/genshin/chronicle/characters.py#L192)含武器、relics、技能与面板。 | 本项目只被动观察官方 UI 自己的请求，不主动调用端点。官方 UI 是否当前发出相同路径/完整列表，需真实观察；不能以库支持声称云宿主已支持。 |

以上是开源客户端自身代码的主来源，**不是提供方授权第三方接入的合同**。两个源码仓库以完整提交固定。Starward [GameRecordService](https://github.com/Scighost/Starward/blob/df8ae07b5ad4c9c6cb70d288488ce8073ce01478/src/Starward/Features/GameRecord/GameRecordService.cs#L120)会把账号会话保存到数据库；这种持久方案不适合本任务，没有复用。旧 Snap.Hutao 原仓库本次访问 404，当前 hut.ao 页面声明与原开发者无关，未把该域名当成原项目证据。

## 实际接收方、范围和最小用户决定

候选流程：新建临时官方页面 → 用户在官方 UI 正常登录或扫码 → 观察官方返回的本人绑定列表 → 用户选 UID / 服务器 → 仅观察后续匹配的 list / detail → 预览 → 关闭临时上下文。无需把 Cookie、密码或浏览器会话交给聊天或 GIDPS 页面。

必须明确选择实际执行位置：`--location=user-device` 时，用户在自己的电脑主动运行，新建临时浏览器在该电脑持有普通账号会话，不把账号状态发给 GIDPS 云服务；`--location=cloud` 时，明确选定的云宿主会持有这次账号状态，不能套用用户电脑的确认。官方账号系统正常处理登录。普通会话的实际权限超出只读，不能包装成提供方授予的装备专用权限。宿主只观察选定原神角色的当前配装响应，不导出凭据、不建立刷新/长期访问，不发账号修改请求。官方 UI 正常流量由提供方控制。

选定宿主最长保留 10 分钟，完成一次输出、取消、关闭主窗口/终端、异常、已识别挑战/限频或本地到期即关闭上下文与浏览器；该时间是本地保留策略，**不是提供方会话到期时间**。取消或期限先于异步浏览器启动/上下文创建完成时，晚到资源也会释放。不读已有用户浏览器 profile，不保存 storageState、HAR、trace、截图或账号文件。关闭临时上下文只表示释放本次宿主，不能称为官方全局登出/撤权。若关闭失败，CLI 显示 temporary-browser-release-unconfirmed。

真实 begin 前由父线程协调明确以上接收方、范围和一次操作。CLI 的显式参数只表达调用意图，不代替用户授权，不是授权令牌。本轮没有请求真实账号权限，没有执行真实 begin，也没有登录操作被拒绝或结果不明。

## 可执行原型和当前云环境缺口

```sh
node apps/player-import/official-browser-host.mjs --plan --location=user-device --provider=miyoushe
node apps/player-import/official-browser-host.mjs --plan --location=cloud --provider=hoyolab
```

默认就是 `--plan`：无需浏览器依赖加载，零网络，输出固定页面、数据域、接收方、10 分钟上限、字段限制和交互前提。不指定位置的计划会标未选择；预检/开始必须显式指定，不默认为云。Windows/macOS 使用交互桌面，不检查 Linux DISPLAY；Linux 需要可见的 X11/XWayland DISPLAY。浏览器默认取 Playwright 安装的 Chromium，也可明确给出存在的可信本地绝对可执行文件路径，不再写死 `/usr/bin/chromium`。安装/用户电脑运行步骤见 [USER-DEVICE.md](../../apps/player-import/USER-DEVICE.md)。

`--preflight` 仅打开本地 about:blank 检查页，用户输入 visible 确认可见后立即关闭，不访问官方站点。真实 `--begin` 需要 TTY、可见交互桌面和与位置匹配的 `--acknowledge=temporary-user-device-account-read` 或 `--acknowledge=temporary-cloud-account-read`；仍先显示检查页，输入 official-login 后才打开官方页面。参数/环境变量不证明窗口可见，也不代替用户授权。

当前云有 Chromium，但 **DISPLAY 未配置，也没有 Xvfb**，仍缺可由用户正常操作的云官方窗口；本轮未创建真实登录浏览器。用户电脑方案不依赖这个云 DISPLAY 前提，必须由用户在自己的桌面主动预检和启动，不能把云测试当作用户电脑已验证。

无头 Chromium 可以渲染官方页面，理论上可把官方 UI 生成的二维码展示给用户；**本原型尚未实现经协调的临时可见传递与交互渠道**。官方登录按钮、二维码是否能在当前云正常出现、扫码后的风险验证如何由用户在官方 UI 完成，也尚未验证。不能以静态二维码图片或假成功替代这些步骤。这是云扫码下一项具体交付缺口，非“没有 OAuth 就停止”。

在具备经协调的选定宿主可见 UI 后，代码可以打开正常官方页面，只接受终端命令 official-login / roles / 数字序号 / record / finish / cancel，不接收凭据。观察器只解析固定 HTTPS origin/path 与正常方法的角色响应，不读取登录响应或任何 Cookie/header。国服和海外的数据路径分别固定于[客户端路由](https://github.com/seriaati/genshin.py/blob/2d20ab1ad7e8af722d179a2cf0d79db5f8a9b213/genshin/client/routes.py#L136)，不拼接自定义目标。官方 UI 使用其他路径就保持缺项，不盲加宽白名单或重放内部签名。

若官方 UI 按需返回详情，用户需在官方页面打开缺少的角色；未观察到本次完整列表或任一详情时返回 partial-coverage。即使列表与详情严格一致，也**只证明观察覆盖该列表**，不证明提供方列表代表全部已拥有角色，未验证前不会标全账号导入。

## 字段边界与既有导入器

观察器只输出既有 GOOD JSON，可直接交给现有文件/文本输入，不新增主计算器接线。它使用既有身份映射和输入限制；只映射来源明确的角色 ID/等级/命座、武器 ID/等级/promote_level/affix_level。等级 100 原样保留，不裁成 90；缺少值不补零。

本轮新增严格 observation 适配器：collector 保留同次 property_map 的明确属性名、圣遗物 pos_name 和武器 main/sub_property.final；现有 JSON/文件入口识别 observations.format 后复用原 GOOD、词条归一化与完整性校验。五槽圣遗物、主副词条、武器观测值和按固定 skill_id 匹配的显示天赋已可进入同一个 ImportSnapshot；仅观察当前 relics，不读取背包，不把武器观测叠入总面板。没有 property_map、名称/单位未知或 ID 未识别就保持未知/阻断，不猜数字编号。

角色突破和技能基础/附加拆分仍无模型证据，不从等级或命座推算；未支持格式也不猜。原始净化观察保留在 observations。预览明确为部分配装，不能假称已可完整计算。模型里武器 promote_level 表示突破、affix_level 表示精炼，二者不混用。合成输出显式 syntheticFixture=true，不作真号证明。逐字段来源、接入和现场缺口见 [OBSERVATION-FIELDS.md](OBSERVATION-FIELDS.md)。

提供方挑战码、限频和登录失效按固定客户端的[错误定义](https://github.com/seriaati/genshin.py/blob/2d20ab1ad7e8af722d179a2cf0d79db5f8a9b213/genshin/errors.py#L277)与[挑战码集合](https://github.com/seriaati/genshin.py/blob/2d20ab1ad7e8af722d179a2cf0d79db5f8a9b213/genshin/constants.py#L130)停止；不自动解验证码、刷新会话或切换代理。官方 UI 中未映射的挑战未承诺可自动检测，用户需要取消，本地上限仍生效。

## 验证

新增 focused tests 覆盖固定来源正反例、无绑定不可选、区服不推断、错 UID/服务器响应不混入、分批详情与缺项、Lv100 与未知值保留、挑战/限频/失效后清空、列表或账号变化、取消/本地期限、一次输出后清空，以及 CLI 默认零网络/开始前提拒绝。现有导入器用于验证输出，不另建解析器。真实 begin 分支没有执行，不把测试通过当登录成功。

前一阶段现有导入包 120/120、独立工作台 7/7 已通过；本次只运行新增 focused tests 与 standalone 类型检查，不重跑主应用完整回归，不部署。

跨平台修复本轮：观察器和宿主运行时 focused tests 共 28/28，通过 standalone 类型检查。新增覆盖 Windows/macOS 无 DISPLAY、Linux 显示缺项、TTY、位置与范围不匹配、本地绝对路径/空格、禁止已有 profile/CDP/任意启动参数、浏览器文件不可用、取消后晚到资源释放与释放失败。平台分支使用模拟环境；没有在云端或用户电脑执行真实 headful/登录。
