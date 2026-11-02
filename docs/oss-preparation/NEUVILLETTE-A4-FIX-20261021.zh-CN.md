# 原生那维莱特 A4 初始化修复与重建证据

基于 `68c0787`，实际修复提交 `3dd89bd`。上一轮失败报告和捕获保留，旧文件未重算或覆盖。修复范围为 Classic b4 宿主，Stellar 二进制未重建，不能据此声称 Stellar 已修复。

## 根因和修复

固定上游 `InitializeTeam` 在角色 `Init()` 之后才设置开局 HP；那维莱特 A4 曾在 `Init()` 内立即取样，得到 0。`132-neuvillette-initial-hp-a4.patch` 把首次取样移至已有 `OnInitialize` 事件，发生于整个队伍初始化完成后。它仍调用原 `updateA4()`，没有假定满血或强加 30% 水伤。

原治疗与扣血回调保持不变，分别读取变化后的实际生命比例。原生实测确认两条路径正常更新。未触及全局 HP 初始化次序、其他角色公式或历史格式。

构建中另发现元数据提取器未继承私有 Go 缓存，试图写只读 `/home/agent/.cache/go-build`；现在使用所选构建缓存下的 `gopath/modules/go-build`。没有扩大文件权限。Node 初次直连下载失败，使用既有环境代理 `NODE_USE_ENV_PROXY=1` 后成功；没有新增凭据。

## 实测

- 原失败的 E→Q 测试原样保留并通过：零/满开局能量 × 种子 12021/12022，均运行 7200 帧。每次 22 个命中，Q 在 F3089、F6473 合法消耗 70→0。逐击手算与原生值相符，捕获重放差值为 0。
- 种子 12021 总伤害 `24402.05230057188`；12022 为 `22398.30230297729`。与上一轮预先保存的正确预期一致，没有调整断言适应旧错误结果。
- 动态生命：满血和 3000 HP 开局各 120 秒、各 20 命中。首次比例分别为 1 和 `0.20414977734878162`。两次 E→重击包含真实水滴治疗、重击扣血；满血用例 10 次扣血/6 次治疗，低血用例 8 次扣血/6 次治疗。按实际取样比例计算 A4，所有命中手算及捕获重放一致。
- 从上述真实捕获固定四个 E 命中作为小型回归向量，保存原捕获 SHA、WASM SHA、帧与计算 ID。独立 HP 计算器逐项匹配，并验证已含水伤去重：4/4 通过。
- 针对性核心回归 19/19 通过；上述向量另 4/4。浏览器本组 4/4，凯亚能量循环及班尼特/凯亚融化相邻回归 2/2。融化总伤害仍为 `8214.913630987197`。
- 原生构建、Web 构建、类型检查、数据检查通过。仅 Linux Chromium；未实测 Windows/Edge。

本轮没有重复完整 10 分钟单测。最后一次完整基线仍是上一轮 **2834 pass / 89 fail**：消费者 11、历史格式 45、Golden 24、EC 来源契约 9，不能把本轮针对性通过写成整个项目全绿。旧原生 A4 浏览器失败在本轮消除，新增两项动态浏览器测试和四项原生/独立对照测试。

## 来源、构建和历史兼容

官方 Go 1.25.0 Linux amd64，压缩包 59659213 字节，SHA-256 `2852af0cb20a13139b3448992e69b868e50ed0f8a1e5940ee1de9e19a123b613`。上游 b4 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 全部 4021 个 Git blob 校验通过。构建使用 `-mod=readonly -trimpath -buildvcs=false`、固定官方模块代理及校验数据库。

新 WASM 47066609 字节，SHA-256 `8e159a65991824908ecfa1226ae18a18c87b1956f9458dc7257bd97b249322f6`。两次独立源码导出/编译得到相同 WASM 哈希；第一次元数据阶段失败，第二次完整构建成功。没有将第一次失败标成成功构建。

倍率表和读取位置注册表重新生成后未变，旧注册身份保留；修改只影响新运行的首次 A4 取样，旧捕获仍携带其原状态。原有许可证、版权和第三方边界保留，未选择根许可证。公开目录中的 `go-build-info.txt` 已由本次实际构建补齐。

证据目录：`/workspace/GIDPS-cloud/neuvillette-a4-fix-20261021`。包含前后失败/成功日志、原始浏览器捕获、目标回归 JSON、旧公开产物备份、新 dist/manifest、重建哈希对照。单独源码包包含固定原始源码归档、实际已打补丁并插桩的完整 Go 树、以及对应项目 Git 源码快照（包括全部补丁、桥接、构建脚本和 TS 接口/公式）。编译器及 Go 模块仍按固定来源下载，不声称完全离线构建。

```sh
NODE_USE_ENV_PROXY=1 node packages/source-host/scripts/prepare-source.mjs --cache-dir /workspace/GIDPS-cloud/source-build-cache
NODE_USE_ENV_PROXY=1 node packages/source-host/scripts/prepare-toolchain.mjs --cache-dir /workspace/GIDPS-cloud/source-build-cache
NODE_USE_ENV_PROXY=1 node packages/source-host/scripts/build-source-host.mjs --cache-dir /workspace/GIDPS-cloud/source-build-cache --output-dir /workspace/GIDPS-cloud/neuvillette-a4-fix-20261021/dist --public-dir /workspace/GIDPS-cloud/neuvillette-a4-fix-20261021/public
```

构建在新目录完成并验证后才复制至本地项目公开资源；未 push、合并、生产部署或使用付费资源。
