# GIDPS 独立 Vercel 发布准备

应用基线 `7d3289b06735a24b81b71e64104345d4b8881264`。没有改用远端旧 main，也没有修改旧 gi-dps、Blackboard、用户电脑或根许可证。

## 已准备的具体产物

- 新目标：`gidps` / `prj_sJ9g9ekx86oTiizlxalayHtklnxo`，团队 `team_C7eBCyezgeOKwho1xfVLcnln`，域名 `gidps.mixuanda.top`。父线程已确认域名验证完成；本任务不操作 DNS/云端发布。
- 本地目录：`/workspace/GIDPS-cloud/vercel-stage-7d3289b/.vercel/output`，Build Output API v3，132 文件、197,914,550 字节，最大文件 71,853,672 字节。独立 `.vercel/project.json` 只链接新项目。
- 仅发布所需 JS/CSS、首页、两套原生执行器及许可/元数据、对应源码材料、公开 UID 查询函数；不包含 sourcemap、用户会话、个人配装 fixture、私有报告、浏览器 trace 或整仓 Git 内容。
- 生产 UID 查询不依赖 Vite：新增无会话、无凭据的 Node 24 GET 代理，固定 Enka 主机、10 秒超时、最多 32 条进程内缓存，遵守 TTL（含 0），错误不缓存，不转发 Cookie，不记录玩家响应。
- 既有计算限制保留，静态首页另提供非官方声明与明显的许可/对应源码入口。没有改变公式、角色机制或 WASM 字节。

`readiness.json` 保持 **publishReady=false**：技术目录已准备，发布授权/许可边界尚未全部完成，不假称已在线。

## 原生对应源码的实际验证

修复一个真实分发缺项：Classic manifest 引用 `source-files.json`，public 却缺文件。找到最后保留构建的真实文件，其 SHA-256 与 manifest 精确一致：`5464fa26238b5645d4db54f424b5f1a2476a25b52229315450d3cefef1d188fe`。复制该文件，没有凭空生成替代证明。

两套已有 `go-build-info.txt` 均真实存在并与清单一致，不能继续沿用旧审计的“缺 build-info”结论。

提供的源码材料包括实际选入原生程序的 Go 包及嵌入文件、原始许可、修改说明、所有桥接/补丁/插桩/构建脚本、共享 TS/UI/数据构建输入与锁文件，以及固定公开 Go 依赖源码；排除无关上游 UI、图片、字体与私有材料。

实际解包这些最小原生源码，用原有官方固定 Go 工具链、离线依赖及既有编译缓存重建：

| 执行器 | 工具链 | 实际 SHA-256 | 与原分发文件 |
|---|---|---|---|
| Classic | Go 1.25.0 | `8e159a65991824908ecfa1226ae18a18c87b1956f9458dc7257bd97b249322f6` | 逐字相同 |
| Stellar | Go 1.27.1 | `a16817836d46ca096f24cf31e70e614002d4d443eae06c64ba5fe0ee8bc62744` | 逐字相同 |

这是一次有缓存的离线最小源码重建，**不是无缓存/全新环境可复现声明**。没有把新重建文件替换进运行产物。完整哈希、源码材料清单和重建比较保留在证据目录。

## 必要测试

- UID 代理 3/3：非法输入及非 GET 拒绝；响应契约、缓存 TTL/边界、Cookie 不转发；零 TTL、404/429/503、网络错误处理。合成 transport，不冒称真实账号联网验证。
- 预构建目录 Chromium 烟测 1/1，4.7 秒：直接打开 calculator/results/source-simulation、静态文件不存在返回 404、UID 错误 JSON、manifest 不缓存、原文件打开不重算、Worker 运行真实来源诺艾尔配置，6 击帧 `[25,66,111,146,187,240]`，总伤 `105.67709476067012` 保持不变。
- 最终配置 HTTP 检查 8/8：根路由、许可页、计算器、缺失元数据补齐、两套 WASM MIME、缺资产/非法 UID。TypeScript 检查通过。
- 不重跑完整回归；旧实际全套基线仍为 2907 pass / 86 fail。Windows 实机及 Vercel 云上 Node 24 尚未测试。

## 准确的剩余发布条件

1. **待维护者决定，不是工具拒绝**：修改后的 Stellar 是 AGPL-3.0-or-later 程序，WASM 与共享 TS resolver 同步互调。源码文件已准备、许可/版权已保留，但这本身不能替代原创组合部分的授权决定。根 LICENSE 仍缺，没有擅自给原创代码整仓套 MIT/Apache/AGPL。建议维护者确认有权授权的紧密集成部分采用 AGPL 兼容授权及对应源码发布范围；如改为 Classic-only，需要另行明确范围和独立构建审计，当前没有隐藏/删除 Stellar。原游戏数据/文本及未知 preview provider 权利仍与软件代码许可分开，未作已全部清权承诺。
2. **父线程协调中**：没有调用 upload_file、create_deployment、promote 或改变保护设置。现有认证 Vercel connector 成功只读获取新项目和团队；本机没有 vercel CLI，且 connector 认证不能假定自动转交 CLI。未尝试部署写操作，所以不是“已被拒绝”或“未知是否执行”。

GNU/AGPL 的对应源码要求包括修改后的程序及其必要接口/构建材料；紧密数据通信与控制流也是其对应源码定义的一部分。这里只陈述本地材料和条款依据，不把目录隔离当作已确定独立授权。[AGPL 原文](https://spdx.org/licenses/AGPL-3.0-or-later.html)。

## 目标设置与后续命令

### 后续澄清：根许可证不是既定的上线阻碍

上文“原创组合部分授权待定”是准备阶段的保守状态，不是 Vercel 拒绝、上游拒绝授权，或已证明某个 TS 文件无权发布。不能把根目录没有 LICENSE 等同于用户不能部署自己拥有的原创代码。当前 Classic/Stellar 各 18 份分发许可文件均存在且哈希一致；未发现某个链接依赖许可缺失。

确定受现有 AGPL 约束的是修改后的 Stellar 原生程序（包括应用到 a7 的补丁/桥接），不是仅凭同仓库/目录就自动覆盖一切。浏览器下载 WASM 本身涉及目标码分发，因此 AGPL 第 4–6 条的许可、修改说明和对应源码义务已相关，不能只讨论第 13 条服务端网络使用。源码下载可用也不能替代给予 covered work 所需的许可权利。此处无需为上游已经许可的程序申请一份新授权。

需要审慎判断组合边界的主要原创路径是 `apps/web/src/source-host-worker.ts`、`packages/sim-core/src/source-host-formula.ts`、`source-host-stellar-formula.ts`、`source-host-wire.ts`、`source-host-capture.ts` 及其实际公式依赖。它们目前没有单独 SPDX/公开许可声明；实际存在 WASM→同步 resolver→WASM 的控制流，但这只是组合判断的事实依据，不能据此冒称法院已确定整仓重许可。没有发现这些 TS 文件被特定第三方明确拒绝授权。

可以不新增根 LICENSE、不对独立原创组件统一重许可而发布符合现有第三方条款的程序。若现有公开上线授权已经包含履行 AGPL 对本次 covered work 的分发义务，剩下是把这个有限范围的发行声明/源码入口写准确，无需再要求选择一个根许可证。如果这一有限分发授权不在既有授权内，最小确认仅为：“本次 Stellar 修改程序及构成该程序的必要原创集成部分，允许按现有 AGPL 要求提供许可和对应源码；独立组件及游戏数据保持各自边界。”这不是选择整仓 MIT/Apache/AGPL。若要求其中所有原创集成部分仍保留一切复制/修改/再分发权利，不能仅凭提供源码下载就保证同时满足 AGPL。

准备产物仍是待父线程协调的草案；本段没有授予新许可、改变公开文件、调用部署或改变旧站。正式发布前需要把 `/legal/index.html`、源码清单及原生包内修改说明中的“待定”状态换成准确的实际发行声明，而不是仅翻转一个 readiness 布尔值。

框架保持 Other/null，预构建上传不依赖远端 Git main、远端 build command 或新环境变量。Node 函数指定 `nodejs24.x`，15 秒平台上限，程序自身 10 秒上游超时。默认部署保护不变。

待上述许可条件与父线程协调完成后，已有 CLI 认证可用时执行：

```sh
vercel deploy --prebuilt --archive=tgz --prod --skip-domain \
  --cwd /workspace/GIDPS-cloud/vercel-stage-7d3289b \
  --scope mixuandahotmailcoms-projects \
  --meta gidpsApplicationCommit=7d3289b06735a24b81b71e64104345d4b8881264
```

先检验同一个 production staging deployment，再由父线程 promote；不用 `--public` 暴露整仓、不切换旧域名、不禁用认证、不创建 token、不 push。Build Output API 与 `--prebuilt --archive=tgz` 为[官方支持路径](https://vercel.com/docs/cli/deploy#prebuilt)。内部压缩上传形式实测约 42 MB，低于文档 Hobby 100 MB 上传阈值；最终套餐/工具限制仍须按实际上传确认，不申请付费升级。

本轮不向用户交付 ZIP。测试与代码记录自留：`/workspace/GIDPS-cloud/vercel-readiness-20261022`；具体生成/本地检查命令见 `deployment/vercel/README.md`。
