# /goal 万叶 C0/C1 的 Q 直接伤害闭环

本批补齐独立初斩、单次风持续伤害、完整 Q 直接伤害三个入口。有效 Q 天赋独立于普攻/E；C2 及以上明确不支持本分支，不借用 C0 数值。原有 E 入口保留。

来源是固定 gcsim Classic `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，以 Stellar `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd` 对照。十个原始文件的 SHA-256/Git blob 已核验；三个 Q 倍率向量各 15 等级与当前目录一致。两个 revision 属于同一实现链，不能当成两份独立游戏机制验证。状态保持 provisional。源码副本保留各自 MIT / AGPL 与原 MIT 贡献通知，没有更改根许可证。

采用固定源相对施放的整数帧：持续伤害进攻快照 81f，初斩 82f，持续伤害在 140/257/374/491/608f。同帧元素转化附加先于风伤。吸收检查 81f 起每 18f 一次、至 369f；晚转化只生成之后的附加命中，不固定补成五次。完整分支须明确全部命中、领域未被替换及面板/目标稳定；未知状态有对应控件，不推断命中几何。

转化伤害使用其独立元素加成，不能复制风伤。A4 只使用 81f 前同元素扩散仍有效时的 NonExtraEM，并减去面板已含份额；本 Q 初斩后触发的 A4 不追溯进入 81f 快照。当前 EM 改大不会替代前序扩散证据。装备转换保留每击快照；吸收时点、天赋、前序 A4 或角色等级改变后，旧快照不能静默复用。

独立数值例：有效 Q10，ATK2000，CR50%，CD100%，风伤46.6%，90对90，敌抗10%，无反应，全部命中。转化火伤20%，若有前序 A4 则其 NonExtraEM800、面板未含。非暴击为 `ATK × [风倍率合计×(1+风伤) + 转化倍率合计×(1+火伤+A4)] × 0.5 × 0.9`；期望再乘1.5。

| 条件 | 非暴击合计 |
|---|---:|
| 无转化：初斩4.7232＋五次2.16 | 20481.31008 |
| 81f转火、五次0.648、前序A4=32% | 24913.63008 |
| 369f转火、三次0.648、同一前序A4 | 23140.70208 |

公式同槽覆盖和未声明复制命中原本可被接受；新增负例先复现11失败，再修复。现在拒绝 `baseDamageFormula` 覆盖、`groupMultiplier != 1`、染色 A4 槽的外来公式（含伪装前缀），保留证据和合法独立攻击力调整。集成后移除了测试中“未接线时删除上下文”的临时适配，数值和负向断言均保留，测试走正式计算与转换入口。

验证记录：

- `packages/sim-core/src/kazuha-burst-formulas.test.ts`、`apps/web/src/kazuha-calculation-context.test.ts`、`apps/web/src/parallel-role-entrypoints.test.ts` 合计62项通过。逐帧、归属、总和、JSON、真实合法装备转换和篡改拒绝均在其中。
- `apps/web/e2e/kazuha-primary-output.spec.ts` 在 Linux Chromium 通过。保留的公开面板缺额外天赋等级表，严格导入仍拒绝；测试明确手填10/10/10，来源标记未由展柜验证。Q早/晚转化、每击求和、保存重开及动作来回切换均与独立算式一致，没有装备叠加或浏览器异常。逐段高级设置默认收起且可展开。
- 整批最终 TypeScript、数据复现检查、Vite构建通过；构建仍有大于500kB的分块提示。没有重跑完整回归或无关120秒模拟。

云端证据目录 `/tmp/GIDPS-parallel-roles-evidence-20261023/`：`kazuha-wired-targeted.json`、`kazuha-browser-compact.log`、`batch-final-typecheck.log`、`batch-data-check.log`、`batch-build.log`；截图在 `browser-kazuha-compact/`。子模块源码证据在 `/tmp/GIDPS-role-kazuha-evidence-20261023/source-verification.json`。原始失败日志保留，私人玩家响应及核对数值未入仓库。

复现核心检查：

```sh
node node_modules/vitest/vitest.mjs run packages/sim-core/src/kazuha-burst-formulas.test.ts apps/web/src/kazuha-calculation-context.test.ts apps/web/src/parallel-role-entrypoints.test.ts
```

这不是完整反应/队伍循环验收：没有模拟扩散实体、附着/ICD、Q能量/CD、移动和领域碰撞；没有声明 Windows 实机通过。本批未发布，原有生产发布拒绝仍待具体确认。
