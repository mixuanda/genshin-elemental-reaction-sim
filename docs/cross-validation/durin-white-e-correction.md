# 杜林白 E：修复与固定来源相反的附着映射

修复日期：2026-09-22。此项修复有具体源码依据，区别于旧 golden 行为复现；它不宣称完整杜林机制或官服实测已验证。

## 独立来源核对

锁定提交 `genshinsim/gcsim@b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的 [skill.go 第 75–90 行](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/durin/skill.go#L75)明确为白色战技再施放指定 Pyro、Durability 25、ElementalArt ICD tag、Default ICD group。与本项目已有单位约定一致，25 durability 对应标称 1U 元素量，不能解释为未设字段/零附着。

[固定 ICD 表](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/attacks/icd_groups.dm.go#L69)给 Default 150 帧重置、应用序列 `[1,0,0,1,…]`。本次使用项目已经固定、版本化的 default profile，没有另造数值策略。

首次来源代理与修复代理分别下载相同固定文件，字节哈希一致。修复代理于 2026-09-22 14:40:32–33 UTC 下载：

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `internal/characters/durin/skill.go` | 4,729 | `14bded4b59a93b25f2ee7a49b7fa2bef2598054eddd411790ae7fd87120c256c` |
| `pkg/core/attacks/icd_groups.dm.go` | 15,409 | `799bdc59f64d365d2e898da92884a9a8e376aa35ac9004e01a664edad79522b4` |

完整 URL、commit、时间与哈希见 `durin-white-e-source.json`。此处验证的是本地映射与固定参考代码的一致性，没有运行完整上游 gcsim 二进制，也没有补充独立官服实测。

## 修改前后

原始 `84ff5cd` 的白 E 缺少 `application`，来源备注错误声称固定文件没设 Durability，因此 Cryo 初始附着不被消耗，错误地输出无反应伤害。原始 1,858 单元测试和 36 浏览器测试通过，却把此错误写进期望值。这说明旧测试通过不能代替检查引用来源。

本次同步修复：

- `packages/mechanics/src/characters/durin.ts`：白 E 显式 1U Pyro、fixed-gcsim-application-v1、`durin-elemental-art` tag、`default` group；更正来源说明并加入 Default ICD 证据。
- `packages/mechanics/src/characters/durin-audit.ts`：同样修复浏览器紧凑预设及披露，继续标注 partial / provisional。
- Durin mapping 由 `.7` 升至 `.8`，进入配置 dataVersion 与复现身份；历史 baseline 和旧归档证据未改写。
- `packages/mechanics/src/characters/durin.test.ts`：旧错误断言改为 Melt / 通过 ICD / Cryo 被消耗，新增独立手算与无初始 Aura 负例。
- `apps/web/e2e/simulator.spec.ts`：只修改对应白 E 测试块，验证显示 3,250、1U 火施加、消耗冰、融化和最终无残留 Aura。

初始状态、命中绝对帧 50、动作占用、固定回能 33、四粒子回能 12、最终能量 45 均保持原有受测规则。

## 独立算术与结果

该审计向量是明确的手工面板：最终 ATK 2,000，天赋十级倍率 1.9008，角色等级 90，敌人等级 110，抗性 10%，EM 0，无额外增伤、不暴击。这不是完整装备构筑重建。

```text
普通非暴击伤害
= 2000 × 1.9008 × (90 + 100) / [(90 + 100) + (110 + 100)] × (1 − 0.10)
= 3801.6 × 0.475 × 0.9
= 1625.184

存在可反应的初始冰附着时
= 1625.184 × 2
= 3250.368
```

修复后有冰场景由运行时元素施加/Aura 状态实际判定 Melt，未手工指定该命中的反应标签；无冰场景仍输出 1625.184，并施加火 Aura，不会凭空获得二倍倍率。数值回归使用 `toBeCloseTo(..., 10)`；期望表达式在测试中独立按定义计算，不从引擎输出抄录。

## 已执行检查

- 当前工作树专项：`npx vitest run packages/mechanics/src/characters/durin.test.ts packages/mechanics/src/compiler.test.ts packages/mechanics/src/index.test.ts`，退出 0，3 文件 / 35 测试全部通过，Vitest 报告 1.86s。
- 白 E 浏览器专项：`npm run test:e2e -- --grep "Durin white E"`，最终退出 0，Chromium 1/1，通过用时 4.2s（外层经过 4.543s）。测试实际验证网页数据、命中结果、Aura、动作状态、粒子和能量。
- 浏览器第一次执行因测试遗漏将“施加元素”单元格仍写为“无”而失败；实际输出正确为“火 1U”。修正该断言后通过，首次失败日志保留在 `durin-white-e-browser-attempt-1.log`，未隐藏失败。
- 并行集成期间一次 `npm run typecheck` 退出 1，错误仅为 `calculator-ui.ts` 对新增 special/blocked union 的 reasons 访问；已告知 UI 代理。这不是机制修复编译错误，最终全局类型和全量测试仍必须由集成验收重新执行。

为防止其他代理正在实施的界面变动影响此窄修复，浏览器测试使用原始提交的独立导出加上述四个修改文件，工作区依赖链接同样隔离；只把 Playwright 端口改为 4181、禁止复用既存服务器。隔离应用构建及类型检查随 Playwright webServer 启动通过。确切目录、四文件哈希、命令、退出码与日志在 `durin-white-e-checks.json`。这项浏览器结果证明窄修复，不能代替最终合并全部改动后的全量验收。
