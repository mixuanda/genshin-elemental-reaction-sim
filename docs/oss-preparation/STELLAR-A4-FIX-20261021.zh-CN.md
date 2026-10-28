# Stellar 那维莱特 A4 初始化修复（2026-10-21）

基线 `c0cb731`，独立云目录 `/workspace/GIDPS-cloud/latest`。本块修复 Stellar 原生来源宿主，不将 Classic 的验证结果当成 Stellar 的证据。

## 根因与改动

固定 a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd：neuvillette.Init 调用 a4()，后者立即读取 CurrentHPRatio；InitializeTeam 在角色/武器/圣遗物初始化之后才写入初始生命，最后 core.Init 才发出 OnInitialize。因此首次 A4 读取零生命，直到一次有效治疗或扣血才更新。

独立核对 a7 的 asc.go、neuvillette.go、player.go、core.go 以及涉及它们的原补丁，确认与已有共享 132 补丁的前提一致。Stellar build.mjs 现在显式加入 `../patches/132-neuvillette-initial-hp-a4.patch`，在 OnInitialize 采样；未改实际 heal/drain 回调，也未把生命或水伤硬编码为满值。

原 145 项补丁的文件名/哈希全部保留，新增后 146 项。新增补丁 SHA256：`452b8d17b5c3e5d185e58d358e9c49495c4ccfcedcfb7e57df6c4b8077d89a15`。静态目录提取器的 Go 缓存显式使用所选 cache-dir，避免落入用户目录。补上构建已生成的 public/go-build-info.txt，与 manifest 一致；原许可/版权未变。

## 构建来源与复现

- 官方 Go 1.27.1 linux-amd64：下载字节与 go.dev 官方完整发布清单、项目固定哈希均一致，SHA256 `63d339f0da5ab53635a56f2490a7984dfe12dfcff22ad749f63edaf590168445`。
- 原始 a7 源码包 SHA256 `c0484e23afda76d7b38bb4fb49c2592b4b7bdccc8d549eaf8a4848e37aa55165`，安全路径检查及 4283 个 Git blob 校验通过。
- 使用新导出的源码目录 `/workspace/GIDPS-cloud/source-build-cache/stellar-build-ZMUife/source`，应用全部补丁、桥接和天赋插桩后构建；Go 模块由固定 go.sum 和官方代理校验。静态 AST 目录提取使用已有固定 Go 1.25 辅助工具链，与 WASM 的 Go 1.27.1 区分。
- WASM 从 `95e33baf8dfdb7264cea14d9b339724de41311d906df93f8d4c1f4e0c8131256` 变为 `a16817836d46ca096f24cf31e70e614002d4d443eae06c64ba5fe0ee8bc62744`，新文件 71,853,672 bytes。manifest 的六个产物全部逐字节哈希/长度核对。

```sh
NODE_USE_ENV_PROXY=1 node packages/source-host/stellar-overlay/build.mjs \
  --cache-dir /workspace/GIDPS-cloud/source-build-cache \
  --output-dir /workspace/GIDPS-cloud/stellar-a4-fix-20261021/dist \
  --public-dir /workspace/GIDPS-cloud/stellar-a4-fix-20261021/public
```

NODE_USE_ENV_PROXY 使用当前云环境已有代理，不创建凭据。`upstream-a7-source.tar.gz` 保留原源码，`modified-stellar-source.tar.gz` 保留实际修改/插桩后源码；项目源码包包含全部补丁、桥接、TypeScript 接口、构建脚本和依赖锁文件。首次复现仍可能需要下载官方工具链及固定依赖。本轮完成一次源码重新导出构建，没有声称第二台机器或完全离线重建已验证。

## 修复前后真实验证

修复前五项浏览器用例全失败：满生命开局首次 A4 输入应为 1 却为 0；3000 HP 开局应约为 0.20414977734878162 却为 0；E→Q 满血伤害应有 0.3 水伤却为 0。完整原始捕获保留，旧 public 另存 previous-public.zip。

修复后 **5/5 浏览器用例通过**（Linux Chromium，2.6 分钟），包含八次独立 120 秒原生运行：

| 场景 | 实际验证 |
| --- | --- |
| 零/满初始能量 × 种子 12021/12022 | 四组，每组 22 次命中：8 次 E HP、8 次芒性刺 ATK、2 次 Q 初击、4 次瀑流；两次 Q 在 F3089/F6473 合法消耗 70→0；完整能量收支逐条重放一致，冷却间隔符合固定来源。 |
| 满生命/3000 HP × 两个种子 | 四组，每组两次 E→特殊重击，共 20 命中；满血组 10 次扣血/6 次治疗，低生命组 8 次扣血/6 次治疗，实际生命比例变化均有对应 A4 更新。 |

E→Q 总伤害：种子 12021 为 24402.05230057188，12022 为 22398.30230297729；本配置零/满能量因固定积累 E 后才 Q，两个开局在各自同种子下总伤害相同，不外推为任意轴相同。ER +100% 是明确输入，不称真实毕业配装。

全部 168 命中保存紧凑投影与原捕获 SHA256，在新增 **8/8 核心用例**逐击核查：固定 a7 T1 倍率（E HP 0.12864、刺 ATK 0.208、Q 初击 HP 0.222578、瀑流 HP 0.091055、特殊重击 HP 0.073186）、实际生命 A4、实际暴击及防御/抗性手算。40 次 E HP 命中另外送入独立单技能文档计算，匹配非暴击/暴击数值；已含 A4 时不重复水伤，缺实际生命状态必须阻断。

原生逐击 capture/replay 差值均为零。所有运行达到 F7200，**不是只检查结束帧**；动态场景两组实际技能循环后有显式等待，不宣称 120 秒全程持续攻击。无其他角色、反应或敌人伤害场景，不宣称全队/全机制完成。

初次把独立计算器直接导入 Playwright 遇到 JSON import attribute 的运行器加载限制，尚未执行测试即退出；日志保留为 browser-after.log。随后将独立计算放入支持该模块加载的 Vitest，以原浏览器捕获作对照，browser-after-run.log 才是最终五项浏览器结果。没有降低断言或绕过产品验证。

## 检查与剩余项

既有那维莱特核心 9/9、新增 Stellar 核心 8/8 通过；构建、类型检查、数据检查通过。完整回归使用原口径，仅排除 performance.test.ts，原会话 20924 已结束（退出码 1）：**2852 pass / 86 fail / 2938 tests / 379 files**，628.87 秒。相比 c0cb731 的 2844/86，新增 8 项全部通过，新增失败 0、删除测试 0、原失败转通过 0；浏览器修复前后变化单独统计为 0/5→5/0。剩余消费者 8、历史格式 45、Golden 24、EC 9，不称全绿。

证据目录 `/workspace/GIDPS-cloud/stellar-a4-fix-20261021`：native-build.log、build-comparison.json、official-toolchain-proof.json、source-review.json、browser-before.log、browser-before/、browser-after-run.log、browser-after/、stellar-parity.json、extract-fixture.py、public-artifact-check.json。

感电严格中间见证本块未修改，历史格式和身份未迁移。本块先闭合已确认的 Stellar 原生缺陷与完整回归，不把尚未实现的感电修复写成完成。没有 push、合并、部署、根许可证修改、新凭据或付费；没有 Windows 实机验证。
