# QA 与实测报告

更新：2026-09-23。本轮为武器逐击基数／限定暴击条款、安柏独立 E/Q、来源延迟扣能和召唤实体的本地增量。未提交、推送或部署。只执行新增行为、数据检查、统一构建及两个新浏览器流程；旧全集和性能矩阵没有重跑。

## 当前整合检查

| 检查 | 实际结果与范围 | 证据 |
| --- | --- | --- |
| `npm run data:status` | exit 0；120身份／695命中，408完整条件动作／146部分／18阻塞；194武器／958合法精炼，53二件套／44四件套 | [状态](../validation/equipment-actions-data-status.log)、[退出码](../validation/equipment-actions-data-status.exit) |
| `npm run data:check` | exit 0；历史目录复现、活动7.1投影、生成覆盖及来源哈希一致 | [检查](../validation/equipment-actions-data-check.log)、[退出码](../validation/equipment-actions-data-check.exit) |
| `npm run build` 首次 | exit 1；新增装备测试可选字段、弓法器标签参数可选类型、两处历史格式类型差集、安柏新测试可选hits共五处类型问题 | [首轮](../validation/equipment-actions-build.log)、[退出码](../validation/equipment-actions-build.exit) |
| 类型修正后 `npm run build` | exit 0；全工程TypeScript及生产构建通过，261模块，Vite339 ms | [构建](../validation/equipment-actions-build-rerun.log)、[退出码](../validation/equipment-actions-build-rerun.exit) |
| 两项新增浏览器首轮 | `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/equipment-actions.spec.ts`，1通过／1失败，32.5 s、exit 1；安柏通过，装备测试误选尚未映射的诺艾尔N1 | [首轮](../validation/equipment-actions-e2e.log)、[退出码](../validation/equipment-actions-e2e.exit) |
| 仅复验浏览器失败项 | 换为目录已存在的卡维N1／E来源动作，`--last-failed` 仅装备流程1/1通过，2.4 s、exit 0；本轮两项均已通过 | [复验](../validation/equipment-actions-e2e-rerun.log)、[退出码](../validation/equipment-actions-e2e-rerun.exit)、[完整记录](../validation/equipment-actions-e2e.md) |

类型修正仅收窄已知存在的字段，并将 `energyCostLog`／`summonLog` 加入当前版本相对旧格式的类型差集期望。未改旧wire、未放宽schema、未改变已通过的数值规则，也没有因此重复运行旧单元。

两个浏览器流程使用同一4173生产构建。安柏首轮1.7秒通过，完整19击数值、实际日志JSON、Q与兔命中恢复均通过。装备首轮在选择诺艾尔N1超时，尚未进入数值断言；她当前仅映射E，核心装备专项使用的是该来源配装加合成命中标签，不能据此假定普攻已在角色目录可用。测试改用已有卡维N1／E，赤角DEF×0.4、手填7.25、跨技能、final／JSON与重新配装去重，以及凯亚腐殖之剑限定CR／增伤断言保持不变。仅这一失败项复验通过（用例2.0秒），未改生产或重跑安柏。

## 本轮定向检查

各行是独立命令的真实结果，不合并冒充一次完整套件。首次失败和仅复验失败项均保留。

| 范围 | 实际结果与证据 |
| --- | --- |
| 14把武器／70精炼逐击条款 | `equipment-hit-effects.test.ts` 首次14通过／13失败，1.19 s；失败为弓法器手填期望缺空数组，测试遍历报错。补期望结构后仅筛选 `source-backed ranged`，13通过／14跳过，1.11 s；数值和生产代码未因此修改。验证41来源引用、标签、边界、真实配装及JSON／final；[实施记录](../weapon-hit-effects-implementation.md) |
| 共享逐击装备公式 | `calculator-equipment-hit-effects.test.ts` 1/1首次通过，225 ms；基数、CR/CD、来源输入、最终面板、撤旧保留手填量和非适用分支；[核心转录](../validation/equipment-hit-effects-core-20260923.md) |
| 真实狼牙缺失Q上下文 | `calculator-pending-equipment-effects.test.ts` 1/1首次通过，1.15 s；明确E层数可算，未知Q只阻塞相关命中，JSON／final不消除未知条件；同上记录 |
| 延迟扣能与实体 | `delayed-energy-summon.test.ts` 首次实体通过，能量用例最后的0.5秒测试输入被既有最短1秒schema拒绝。仅改截断夹具为1秒／末帧起手后复验能量用例，1通过／1跳过，807 ms；未改生产。见[运行时说明](../source-action-runtime-primitives.md)、[首次](../validation/delayed-energy-summon-tests.log)、[复验](../validation/delayed-energy-summon-energy-recheck.log) |
| 安柏来源动作及独立E/Q A1 | 首次3失败：来源契约actor声明顺序；第二次1通过／2失败：派生总量误用Python补偿求和及篡改夹具先被schema拒绝。保留精确数值断言并纠正夹具，最后只复验两失败及新增独立动作用例，3通过／1跳过，6.83 s；4项行为均有通过记录。见[完整证据](../cross-validation/action-library/amber-skill-burst-contract.md)、[首次](../validation/amber-source-skill-burst.log)、[第二次](../validation/amber-source-skill-burst-recheck.log)、[最后](../validation/amber-source-skill-burst-final.log) |

上述来源／核心专项在统一构建前分别执行。最后只修测试类型与参数类型后没有重复执行已通过行为。

## 新外部对照与数值

固定 gcsim 二进制实际执行一次，exit 0。Lv1／突破0／C0／天赋1／猎弓、无圣遗物及额外暴击率−0.05，最终ATK41.9434；单个等级90、火抗0.1、位置(0,2)、半径2的静止目标。输入、二进制与18份来源文件哈希、原始输出和条件见[安柏记录](../cross-validation/action-library/amber-skill-burst-contract.md)。

- E／Q于1／33帧起手；Q起手时能量仍40，92帧真正扣至0。
- Q共18击，117–225帧每次 **3.6790156042886593**。
- 兔于46帧生成并保存人物属性，530帧自然到期，531帧伤害 **16.141549944742266**。
- 531帧首次命中产生4火微粒，631帧入账 **12** 能量。
- 总伤 **82.36383082193812**，19次命中的帧、伤害及总量与外部原始结果精确相同，差值均 **0**；完整捕获、JSON、单击重现和独立角色E/Q数值相同。

派生fixture首次写入的82.36383082193814来自Python补偿求和，而非外部原始累计。已直接采用原始 `statistics.total_damage.mean` 的82.36383082193812，未改核心求和或放宽断言。

独立Q另验证高突破的暴击率 `.7 + .1`、共用面板不变、来源轨迹、最终面板／JSON相等；明确最终覆盖`.25`不重复加A1，相关突破未知才阻塞。此类来源条件计算不声称全部安柏命座、兔承伤或动态目标碰撞已完成。

## 历史验证与性能边界

[前轮完整QA](../history/qa-report-2026-09-23-before-equipment-actions.md)保留mixed-v2／奈芙尔／完整启动日志三项浏览器及其首次失败、定点复验；[再前混合增量](../history/qa-report-2026-09-23-before-dendro-increment.md)、[2167单元时点](../history/qa-report-2026-09-23-before-special-increment.md)、[9月22日检查](../history/qa-report-2026-09-22.md)和[干净基线](../baseline/checks.json)保持各自原始范围。本轮不冒充这些套件已重跑。

历史外部[反向蒸发](../cross-validation/gcsim-reverse-vaporize.comparison.md)3击总伤49.4586860166433与[安柏N5](../cross-validation/action-library/amber-local-comparison.md)5击29.521217804783504残差0。本轮新增的是上述E/Q对照，不将其推广为完整整队或官方验证。

[2026-09-23T06:42:28.209Z性能测量](../cross-validation/simulation-execution-benchmark.md)保持原代码时点：120秒／269事件、2预热／12计时，trace关闭中位30.500 ms／p95 33.336 ms，开启129.735／148.481 ms；随机关闭trace中位29.397 ms／34.01次每秒。本轮未重测，不宣称新代码全负载达到100 ms。

环境为Apple M5 Max、Darwin arm64、Node24.15.0、npm11.12.1、Vitest4.1.10、Playwright Chromium。生产构建仍提示大chunk与无效动态拆分，未提高阈值掩盖警告。没有独立lint脚本，未额外扩展安全或性能审计。

`git diff --check` 首次exit 2，发现新模拟代码一行空白尾部空格；仅删除该空格后复验exit 0、无输出，见[日志](../validation/equipment-actions-diff-check-rerun.log)与[退出码](../validation/equipment-actions-diff-check-rerun.exit)。[首次日志](../validation/equipment-actions-diff-check.log)保留原发现。该命令只检查Git已跟踪差异，不代表大量新文件已被完整静态审阅。发布校验脚本已纳入 `equipment-actions.spec.ts`；远端CI及必需检查尚未执行或配置。完整goal仍进行中，具体未完成范围见[已知限制](../known-limitations.md)。
