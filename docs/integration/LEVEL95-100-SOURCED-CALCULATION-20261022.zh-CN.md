# 95/100 级来源计算与保存重开交付（2026-10-22）

本批接续 `a1a53d3`，在同一独立分支 `cloud/level-100-20261022` 完成 95/100 级装备推导、导入值保留及保存重开后单技能计算。固定来源数值仍标为 `provisional`，不是官方逐角色基础属性认证。未修改原生宿主、反应表、成长表、旧晋升数据或伤害公式；未部署。

## 数值支持证据

当前正式目录固定于 genshin-db `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`。该版本自己的 `calcStatsCharacter` 明确接受等级 1–100，使用角色基础值乘对应等级曲线，再加普通晋升阶段加成；`getPromotionBonus` 在 80 级以上选择阶段 6，不另造阶段 7/8。武器仍受其自身最后晋升的 `maxlevel` 约束。[固定来源计算函数](https://github.com/theBowja/genshin-db/blob/49a6544a6c6ae36089cb42fa591fc46f01de8bcf/src/getdata.js)

已收录的角色曲线完整包含 1–100 级。例如五星角色 95 级的生命曲线是 9.195、攻击曲线是 10.184；100 级分别为 9.652 和 11.629。四星角色使用不同曲线。本批没有用生命曲线代替攻击曲线，没有在 90 与 100 之间插值，也没有新增任意数值。

并行数值核查已经用现有 Classic 和 Stellar WASM 分别实际执行 90/90、95/95、100/100；WASM 哈希与各自 manifest 匹配。流浪者的角色基础值如下，两宿主与本地固定目录推导一致：

| 等级 | 基础生命 | 角色基础攻击 | 基础防御 |
| --- | ---: | ---: | ---: |
| 90 | 10164.1058884 | 327.6743806 | 607.1579523 |
| 95 | 10524.918442 | 364.5354636 | 628.7111115 |
| 100 | 10886.5222512 | 401.3965466 | 650.3115364 |

两宿主记录在 100 级使用角色曲线索引 99、普通晋升索引 6；攻击者防御公式输入保留 100 级。Classic 修订为 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，Stellar 修订为 `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`。这是固定源码及数据的执行兼容性证据，不能替代游戏实测或官方数值表核验。

## 实现边界

- `EquipmentBuildInput.characterLevelCap?: 90 | 95 | 100` 显式保存已解锁上限；旧输入省略字段时继续使用原晋升边界，原 90 级结果和历史文档解释不变。
- `equipmentLevelRange(character, ascension, characterLevelCap)` 在普通突破 6、原来源上限 90 的角色上接受 95/100 上限。高等级上限要求角色等级至少 90。角色等级超过声明上限、突破未到 6、非法上限、武器 100 级都会拒绝。
- 高等级只是解除进度边界；仍逐项读取固定来源基础值、曲线和晋升加成。缺基础字段或缺该等级曲线，继续报错，不从其他工作区补值或默认零。
- Enka/GOOD 旧导入与新的规范化 handoff，只在实际观测等级为 95 或 100 时带入对应上限；不依据 C6、地区或角色版本猜资格，也不强制把 90 级角色改为 100。
- 配装编辑器提供“已解锁等级上限”选项，默认常规 90；导入、换武器、保存、刷新重开保留角色等级与声明上限。武器仍按自己的等级表限制。更换武器后，原 UI 要求重新明确“停用未实现效果”；浏览器按该可见步骤操作。
- 单技能装备 metadata 保存并校验该可选字段；显式上限低于等级或不符合普通突破条件时，计算文档也拒绝。没有更改普通伤害、防御、反应或暴击公式。

官方允许任意已达到 90 级的角色使用无主命星提升至 95/100，被提升角色本身不要求 C6；详细规则、官方匿名回执见[前批核查](./LEVEL95-100-INPUT-AUDIT-20261022.zh-CN.md)。

## 验证结果

修前新增高级等级核心用例 7/7 失败，均保存了原 90 上限阻断及未处理显式上限的实际结果。修后定向单元 34/34 通过，覆盖流浪者、珐露珊两种成长曲线、95/100 实际数值、旧 90 数值、缺源数据、非法上限、武器边界、两条导入与计算文档序列化。旧 90 级数值断言未删改、未放宽精度。旧“解锁条件尚未映射”的负面错误文本改为要求显式上限，拒绝断言仍保留。

真实 Chromium 2/2 完成合成 C0 GOOD 的 95/100 级“导入→编辑换武器→保存浏览器预设→刷新→重载→打开单技能→实际装备推导正伤害→导出计算文档”。导出保留角色等级、上限与对应等级的基础攻击；并非只检查输入框。

另用已保存的真实 Enka 响应做一次最终成功浏览器回放：流浪者 100 级及六项必要最终属性与上游逐项完全相等，计算文档是 `imported-final`，没有再加装备。界面先正确阻断未知吸收条件；显式选择“本次 E 无水火冰雷吸收”和“输入面板没有未触发吸收增益”后，单个 E 初击产生正伤害。该回放使用真实最终面板和明确的计算假设，不宣称观测到了真实战斗状态，也不证明完整空居或 C6 连段。原始配装不入代码、公开日志或浏览器 trace。

定向命令：

```sh
node scripts/check-workspace-resolution.mjs
node node_modules/vitest/vitest.mjs run packages/game-data/src/equipment-advanced-level.test.ts packages/game-data/src/equipment-build.test.ts packages/game-data/src/build-import.test.ts packages/player-import/src/core-handoff.test.ts
node --import ./scripts/register-json-modules.mjs ./node_modules/@playwright/test/cli.js test --config /workspace/GIDPS-cloud/level-audit-20261022/playwright.config.mjs equipment-level-preservation.spec.ts
```

本地证据：`/workspace/GIDPS-cloud/level-audit-20261022/advanced/`。原生回执由并行核查保存于 `/workspace/GIDPS-cloud/function-batch-20261022/wanderer-team/{classic,stellar}-level-basepanels.json`，本批未重复原生执行或新增 120 秒运行。真实面板回放仅在权限受限的 `advanced/private/` 保留无配装回执；没有账号登录、新凭据或新 UID 网络请求。

## 仍需主线完成

来源队伍转换应传 `equipmentLevelRange(character, input.ascension, input.characterLevelCap)` 的第三参数；当前队伍 UI/inventory 的 90 上限也需依据原生能力显式处理。本分支不修改父线程与 UI 线程拥有的 `calculator-ui.ts`、`source-team-builder.ts`。本地原生兼容和单技能闭环通过，不代表线上版本已经部署，也不代表四人 120 秒完整机制已验收；完整回归、主线整合和部署验证由父线程统一执行。
