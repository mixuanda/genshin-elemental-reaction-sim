# 95/100 级输入保留与当前支持范围（2026-10-22）

本篇记录输入保留批次 `a1a53d3` 的历史验收。后续已补固定来源 95/100 级装备推导及保存重开计算，当前支持范围见 [来源计算交付](./LEVEL95-100-SOURCED-CALCULATION-20261022.zh-CN.md)。

本批基于 `4770eabf87e17672dea536073001c0e54c0d2de9`，独立分支 `cloud/level-100-20261022`。本地修复并验证了等级输入丢失；尚未部署，不宣称已经完成 100 级装备推导或队伍计算支持。

## 官方规则

官方「月之一」版本更新说明明确：任意已经达到 90 级的角色，都可以使用「无主的命星」提升等级与上限；90→95 消耗 1 个，95→100 再消耗 2 个，不需额外材料。获得该物品的途径涉及已满命五星角色的重复命星；被提升的角色自身不要求 C6，也没有根据角色所属地区划分资格的规则。[官方更新说明，2025-09-10](https://genshin.hoyoverse.com/en/news/detail/159349)

2026-10-22 重新通过官网的匿名公开内容接口读取该正文，返回 `retcode=0`。网页是客户端渲染页面，因此核验同时保留内容接口回执与 SHA-256，未登录、未发送 Cookie。该公告未提供 95/100 级逐角色基础属性表、成长公式或逐级反应系数；本批没有把社区曲线声明为官方已核数值。

## 已复现并修复的实现错误

1. `packages/game-data/src/build-import.ts` 的旧配装导入路径仍读取 `propMap[4001].ival`。合成 `val=100, ival=1` 实际得到等级 1；只有 `val=95/100` 而没有 `ival` 的有效输入被阻断；无效 `val` 却能借 `ival=90` 成功。现只读取 `val`，无效或缺少权威值时继续阻断。Enka 自己的接口文档将 `val` 定义为属性值，明确要求忽略 `ival`。[Enka API 文档](https://github.com/EnkaNetwork/API-docs/blob/master/docs/gi/api.md#propmap)
2. `apps/web/src/equipment-controls.ts` 的 `setInput` 把超出目录晋升上限的输入改成上限。浏览器通过 `/builds` 导入合成 C0 GOOD 配装，点击“编辑这套真实配装”后，95/100 都实际变成 90。现保留显式导入等级；普通突破 6、来源上限 90 的角色输入允许至 100。换武器也保留该等级。武器原有等级边界不扩大；新建参考配装默认仍为 90。

输入边界与数值来源覆盖独立：`resolveEquipmentBuild` 的晋升表检查没有放宽，95/100 级装备推导仍明确报出来源只覆盖 80–90，不能以降至 90 的输入继续计算。没有改基础属性、反应、伤害公式、曲线或晋升数据。

## 各路径现状

| 路径 | 当前行为 | 剩余缺口 |
| --- | --- | --- |
| Enka 展柜与新导入规范化 | `showcase.ts`、`player-import/normalize.ts` 已读取 `val` 并保留整数 1–100 | 继续按必要字段完整性判定，不因高等级猜测缺失面板 |
| 旧配装导入 | 本批统一读取权威 `val`，保留 95/100，拒绝仅 `ival` 或无效 `val` | 无等级读取回退 |
| 最终面板→单技能 | `calculator-import.ts` 直接保存导入等级；计算文档允许 1–100 | 是否可预览仍受该角色技能、天赋与效果覆盖影响 |
| 配装编辑器 | 本批保留 95/100，输入上限区分角色与武器 | 装备推导在已核来源上限处阻断 |
| 装备基础属性 | `equipment-build.ts` 按 `equipmentLevelRange` 检查晋升上限，后续逐级查表 | 常规晋升 6 的 `maxlevel=90`，尚未表示无主命星解锁 |
| 已收录成长表 | 当前正式工作区角色和武器曲线均有 1–100 共 100 项，包括 95、100 | 有表值不等于已证明角色新等级解锁后的完整基础属性公式；武器并未因此开放 100 级 |
| 参考配装/候选 | `character-build-presets.ts` 明确采用角色/武器 90 级作为可复现样例，候选继承该输入 | 不是全角色合法上限，也不能自动将所有角色改成 100 |
| 配装→来源队伍 | `source-team-builder.ts` 保留 `input.level`，但从旧晋升表生成 `levelCap=90`；编译检查 `level<=levelCap` | 95/100 会阻断；需要显式高级等级上限与来源能力映射 |
| 来源队伍 UI | 角色等级和突破上限控件仍为 90；来源 inventory 的 `maximumLevel` 也仍为 90 | 本批未修改父线程拥有的队伍 UI 或 metadata |
| 来源原生基础面板 | `source-host-base-panel.ts` 按原生公式回放，角色索引最大 99、武器索引最大 89 | 能表示角色 Lv.100；不等于所有上游入口已经可配置该等级 |
| 本地角色/敌人等级 | 角色 schema 1–100；本地敌人/目标 1–200；单技能敌人 1–999；来源队伍敌人控件 1–200 | 各入口范围不同，应按计算器能力处理，不能把敌人统一裁成角色上限 |
| 默认值 | 新单技能/来源队伍常用 90；旧本地敌人缺省 110；已存在显式值不会因这些默认值改为 90/110 | 默认样例条件不代表真实角色数据 |
| 反应等级表 | `reaction-formulas/src/profile.ts` 有 100 项，按实际等级取值；Lv.90=1446.8535、95=1561.468、100=1674.8092 | 来源标记仍为固定 gcsim 暂定数据，未独立官方验证 95/100 的新规则数值 |

正式数据身份：`snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34`，游戏版本 7.1，目录 `gi-7.1-released.genshin-db-49a6544a6c6a.inventory-20260923.2`。只读取公开目录与合成测试数据；没有在分支内保存或提交真实 UID、角色配装或账号响应。

## 修前与修后证据

- 修前单元测试：新增 9 例全部失败，旧有 3 例通过；记录实际读出 `ival=1`、错误接受无效 `val`。
- 修前 Chromium：2/2 失败，分别明确 `Expected 95/100, Received 90`。
- 修后单元：`build-import.test.ts` 与既有 `equipment-build.test.ts` 共 17/17 通过；没有删数值断言或放宽容差。
- 修后 Chromium：新增 `equipment-level-preservation.spec.ts` 2/2 通过，覆盖 C0 的 95/100 导入、编辑、换武器、应用及仍保留来源覆盖错误，过程中无页面异常。
- `scripts/check-workspace-resolution.mjs` 通过，内部包指向本独立 checkout。

测试命令：

```sh
node scripts/check-workspace-resolution.mjs
node node_modules/vitest/vitest.mjs run packages/game-data/src/build-import.test.ts packages/game-data/src/equipment-build.test.ts
node --import ./scripts/register-json-modules.mjs ./node_modules/@playwright/test/cli.js test --config /workspace/GIDPS-cloud/level-audit-20261022/playwright.config.mjs equipment-level-preservation.spec.ts
```

独立证据目录 `/workspace/GIDPS-cloud/level-audit-20261022/` 包含 baseline/final 单元与浏览器日志、匿名官方内容回执、公开数据覆盖回执和修前浏览器 trace。浏览器使用本地 Vite 开发服务器及系统 Chromium，不依赖线上部署或账号接口；没有执行完整回归、构建、部署或新增登录。

## 最小后续支持方案

1. 保留 95/100 的真实输入，区分“值是否合法”与“当前来源能否精确推导”，禁止静默裁 90。本批已完成。
2. 为角色高级等级显式表示 90/95/100 的已解锁上限。真实导入观测值可作为该角色已到该等级的证据；手动或候选条件应显式选择，不以 C6、角色地区或版本猜资格。
3. 与现有原生宿主协调，实际执行 95/95、100/100，核对基础成长、普通晋升加成、反应等级系数与攻击者等级防御系数；原生执行成功属于固定源码兼容证据，不能代替官方独立数值证明。确认后再更新来源 metadata/转换/UI，并补 120 秒及伤害归属回归。
4. 若仍不能验证完整装备推导，可优先使用字段完整的真实最终面板做单技能入口；不得把最终面板叠加装备，也不得宣称 UID 展柜等于全账户角色读取。
