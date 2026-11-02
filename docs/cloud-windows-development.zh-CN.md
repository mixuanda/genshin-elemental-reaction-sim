# 云端开发与 Windows 浏览器

当前基线：`4a70bdfdd60eecc69a9e3e23ae540c77fd17dfbd`。云工作树 `/workspace/GIDPS-cloud/latest`，分支 `cloud/latest-4a70bdf`。
旧快照及 `cloud/recovery-20261019` 保留在原目录，未把旧候选补丁应用到此分支。

## 启动与验证

Node.js 24、npm，Windows PowerShell/macOS/Linux 均使用：

```text
npm ci
npm run dev:local
```

开发服务器固定监听 `127.0.0.1:4179`；端口被占用时明确退出，不悄悄换端口。打开 `/builds`、`/calculator` 或 `/source-simulation`。
在 Windows 本地执行时打开 `http://127.0.0.1:4179/builds`；在云端运行时，Windows 浏览器需打开云平台已有端口转发提供的 HTTPS 地址，不能直接访问云机 localhost。本次没有创建公网部署或配置新凭据。

生产构建和预览：

```text
npm run build
npm run preview
```

预览监听 `127.0.0.1:4173`。锁文件与依赖版本未改；本次云端 npm 安装使用 `--ignore-scripts --cache /workspace/GIDPS-cloud/npm-cache`，避开只读 home。

针对性 Chromium 浏览器验收，先构建，再运行：

```text
npm exec -- playwright install chromium
npm run test:e2e:cloud
```

测试命令使用 Node 设置 `GIDPS_PREBUILT` 并直接调用锁定的本地 Playwright，不依赖 Unix 的 `VAR=... command` 语法。在本次云环境，已有浏览器安装目录是 `/workspace/GIDPS-cloud/browsers`，执行时用 `PLAYWRIGHT_BROWSERS_PATH` 指向它（PowerShell 设置方法为 `$env:PLAYWRIGHT_BROWSERS_PATH = '路径'`）。

## WASM 与来源边界

新提交已包含 Classic/Stellar 两个 WASM。本次逐一校验字节大小及 SHA256 与提交内清单相符，并在浏览器执行 Classic 状态/冷却游标场景。不能仅以 WASM 存在认定游戏机制正确。
如修改 Go 桥接/补丁，需重新运行 `npm run source:prepare`、`npm run source:build` 和 `npm run source:build:stellar`。目前固定工具链只包含 macOS/Linux，Windows 原生 Go/WASM 重建尚未支持；建议继续在云 Linux 构建。
云脚本中的 Go 元数据步骤仍依赖可写缓存；可设置 `GOCACHE=/workspace/GIDPS-cloud/go-cache`。需要出站代理的环境可使用 Node 24 的 `NODE_USE_ENV_PROXY=1`，仅使用已有代理配置。

## 实际验证和局限

本次实际平台为 Linux Chromium，未声称 Windows、Chrome Windows 或 Edge Windows 实机通过。
通过测试覆盖两个界面的清单/WASM 加载失败、折叠诊断、原输入原种子重试、状态游标、冷却就绪、本机方案刷新恢复及清空动作顺序；Worker 单元测试另含取消后的异步诊断隔离、构造/发送错误、各执行阶段和终止后的重复消息。
远端带来的流浪者模板仍是可编辑输入样例：KQM 的定位/配装方向不能证明固定 9/6/1 等天赋等级和离散圣遗物样例就是最优毕业标准。其他角色保持明确的局部输入/通用占位，不新增猜测机制。
KQM 原文：[Wanderer Quick Guide](https://keqingmains.com/q/wanderer-quickguide/)、[Wanderer TCL](https://library.keqingmains.com/characters/anemo/wanderer)。
