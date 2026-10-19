# 来源版本、循环轴与圣遗物回调组合

日期：2026-09-28。来源选择、草稿隔离、循环轴、特殊反应回调与候选差异已接入；必要的核心、集成构建及一条完整页面流程已执行。永久独立单技能计算器保持主入口。全量 goal 仍进行中，未提交、推送或部署。

## 来源名册、形态匹配与草稿隔离

来源队伍载入时，浏览器分别读取所选来源目录的 `manifest.json` 和 `inventory-metadata.json`，校验 repository、revision、注册来源路径及源行一致，再以 `kind + importPath` 联结登记和元数据。只有 key 状态为 `source-registration-and-parser-confirmed` 且存在配置键的记录会进入可选名册。装备交接按目录身份中的 `avatarId` 精确匹配来源 `sourceGameId`；武器及圣遗物套装按游戏目录 `itemId` 精确匹配来源 ID。多形态角色必须明确选择 configuration key，不能用模糊名称猜测。

来源选择是两套固定执行规则：classic `b4ae769…` 与 stellar `a7dc4bf…`。队伍草稿分别按来源保存在 `teamDrafts[hostVariant]`，浏览器持久化键也带来源后缀；导入草稿校验来源变体，已标记来源的草稿不会被另一执行器静默接收或改写 revision。Build Workshop 按所选来源刷新角色形态列表，并要求用户明确选择多形态选项后才允许加入队伍。两个清单中的注册与 parser 证据只表示来源包和配置键可识别，不表示包机制经过游戏验证；stellar manifest 的来源状态仍是 `source-assumed-provisional`，来源面板也明示尚未游戏验证。

Travelers 是一个具体的形态例子：目录角色的 avatar ID 匹配可能返回多个来源形态，必须选择其 configuration key。来源脚本将 Aether 与 Lumine 不同元素形态视作同一旅行者队伍身份，不能同时入队；但 source key 不同的单一形态可作为所选来源的成员。该规则是队伍配置身份约束，不是游戏机制验证。

## 装备和循环轴

从可编辑构筑转成队伍成员时，五件圣遗物的属性贡献被汇总为来源脚本的 `add stats` 项；套装件数则转换为固定来源登记中的套装 key 与件数。转换不把最终面板误当作属性增量。队伍成员仍由来源执行器解析角色、武器和套装效果；草稿字段也明确将五件圣遗物的属性贡献与来源端套装效果分开。

动作卡可按顺序编辑单个动作及动作重复，也可设整套动作执行一次、指定次数，或持续循环至观察窗结束。循环沿用前一轮结束时的真实能量、冷却和场上状态，不在轮间补能；观察窗可能截断末轮。固定观察时长不是轮转长度，重复运行也不等于建立了稳态。零动作或仅零帧等待的循环会被拒绝。

## 已有特殊组成专项证据

`packages/sim-core/src/__tests__/artifact-special-composition.test.ts` 的专项用例组合普通圣遗物回调和实时月曜贡献快照，并在模拟结果 JSON 往返后检查私有状态可保留。实际断言覆盖：

- 饰金在实际 reaction 回调处生效，并在同一角色的 Moondew 贡献者精通取样前改变 live EM；测试断言其相对基线恰好增加 50 EM，且月绽放伤害增加。
- 流放者记录真实 burst 激活与后续 exile tick。
- 来歆余响（`echoes-4pc`）在 enemy-hit 回调上记录普通攻击标签及随机结果。
- 混合月曜场景的饰金 reaction 日志包含真实 `lunarCharged` 与 `lunarCrystallize` 回调；这说明当前专项夹具中的这两种反应可到达普通圣遗物回调，不代表所有特殊反应或所有角色均已覆盖。
- 乐园四件套与当前月曜特殊场景组合时显式报错，避免把普通绽放反应加成套用到月曜直接伤害。

这组回调试验在本地模拟核心的显式夹具中执行。它验证代码路径、日志和可序列化结果，不是客户端实战观测或对来源包整体正确性的证明。

## 失败重试记录

该专项用例的修复过程有多轮失败，按日志保留：retry1 因冻结命中日志的事件优先级／序号字段必须成组出现而失败；retry2 的来歆余响 enemy-hit 顺序未通过受信结果完整性检查；retry3 的结晶碎片生成时精通被断言为固定 400，但收到 550；retry4 的混合反应期望为 `lunarCrystallize`，实际回调记录为 `crystallizeElectro`；retry5 的 `specialReactions` 字段尚未进入结果 schema。retry6 首次通过（1 文件／1 用例，exit 0），retry7 再次通过（1 文件／1 用例，Vitest 1.53 秒、测试 310 毫秒，exit 0）。失败没有通过删除完整性校验或压低数值期望来掩盖；当前证据应以 retry7 日志为最近一次通过记录。

证据：`docs/validation/artifact-special-composition-20260928.retry1.log` 至 `retry7.log` 与对应 JSON；最终日志 `artifact-special-composition-20260928.final.log` 仍记录失败，故报告采用明确的 retry7 通过证据，而不以文件名“final”推断最终状态。

## 候选快照离线比较

候选同步实现现在使用同步函数返回的 `snapshotId` 继续后续校验和差异比较，不依赖全局 active pointer；改后的完整候选采集流程并未在本轮实际运行，相关 pipeline 变更仅做了语法检查。`docs/validation/candidate-offline-diff-20260928.json` 记录的是此前已采集 unknown 候选的离线比较，并非 preview candidate：候选 snapshot 为 `snapshot-e647d8d95e3a15d45da0c1b6757a789efa386a9931ebdf8921027a7344fcdc72`，比较对象为当时活动快照 `snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34`。方法直接读取两份快照并调用 `diffSnapshots`，没有网络抓取、构建、候选覆盖或活动指针写入。结果报告 124 个角色、127 个天赋组和 255 个武器字段差异，无增删；圣遗物套装、命座组及字段评估没有差异。候选与活动快照的来源投影哈希相同，因此这批 `changed` 结果应作为待复核的快照字段差异，不可解释为上游新增内容、预览发布或游戏验证。

## 实际整合检查与测量

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| 候选脚本语法 | `node --check packages/game-data/scripts/sync-genshin-db-candidate.mjs`，exit 0，0.024s | [检查记录](validation/source-variant-checks-20260928.json) |
| 全类型／生产构建 | 首次4处 optional 类型错误，exit 1／2.502s；定点修正后 `npm run build` exit 0／3.526s，664模块，Vite 645ms | [首次](validation/source-variant-build-20260928.log)、[通过](validation/source-variant-build-20260928.retry1.log) |
| 唯一新增页面流程 | `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/source-variant-builder.spec.ts` 首轮 1/1 PASS，exit 0，Playwright 3.3s／墙钟3.798s | [原始输出](validation/source-variant-browser-20260928.log) |
| 特殊圣遗物组合 | 1文件／1聚合用例，窄修后通过；最终 retry7 exit 0／墙钟2.014s，Vitest 1.53s | [通过](validation/artifact-special-composition-20260928.retry7.log)，上述失败保留 |
| 已跟踪改动空白检查 | `git diff --check` exit 0／0.076s | [检查记录](validation/source-variant-checks-20260928.json) |

页面从配装页选奥黛塔，classic 无对应键时禁用入队；选择 stellar 后按 `odette` 入队，生成两次循环 E。classic 与 stellar 队伍各自保留；跨来源导入被拒绝并保留原队伍，原来源 JSON 恢复成功。持续循环生成 `while 1`，导回两次循环后脚本完全一致。旅行者多形态需要明确选择 `aethercryo` 后才能入队。页面没有 JS 未捕获错误。

本次仅实际运行一次 a7 来源 WASM，种子1、C0参考配装、180帧／3秒；来源日志实际 E 为第1、42帧，产生6次命中／6次共享计算。应用账本总伤 **59635.671334919745**（来源汇总 **59635.67133491975**，求和舍入差），首击 **2196.292190572865**；正常独立计算器恢复该击的页面差值为 **0**。这是固定假设与短观察窗的来源结果，不是角色强度推荐、完整稳态或官服验证。保存结果见[本次实际 JSON](validation/source-variant-builder-20260928.result.json)。WASM 身份仍为 a7 `b38c27d8fb828f4a09a0cee6a1af3c4a2993c98d8722cab3e429796e81820bad`，本轮没有重建 WASM。

首次类型错误的修正仅为可选增益值采用已有零贡献语义及显式夹具 timeline 非空类型标记；没有因此重跑已通过核心用例。未运行旧页面矩阵、全单元集、性能集、大型随机或重复候选下载。Vite 原有较大 chunk 提示仍存在。

## 当前边界与下一步

- a7 名册相对 b4 多7个角色形态键（5个非旅行者身份与2个已有旅行者冰形态）、10把武器、2套装；本轮将这些键接到可视化配装与队伍，不新增游戏身份或248两档参考预设。详见[固定名册对照](research/source-variant-inventory-20260928.md)。小毕业／大毕业依旧是可编辑参考假设，未宣称每种配队都已最优化。
- 普通命中的属性在其自身反应回调前取样；月曜贡献者在回调后按各增益激活时序取样，避免增益追溯修改触发它的普通命中。JSON 回放保留并核对真实事件顺序、接触及反应标记。
- 本地特殊宿主仍限制星辉与教官／饰金的组合、昔时之歌特殊命中消费、夜魂特殊伤害回调，以及普通乐园4件与月绽放／mixed-v2混用。已有专门月曜乐园路径保留；不能把普通40%与月曜10%条款混为一条。
- `.29`仍为124身份／1271模板／713静态条件完整／24部分／0分类阻塞；预览、正式与verified指针未变。6把缺可执行来源的武器、其他角色完整生命周期、来源闭包全部前置公式、任意checkpoint／随机稳态及独立游戏核验仍未完成。
- 候选比较现在输出 `diff-from-active.json` 与 manifest计数；正式发布身份须有证据，候选不自动晋升。远端工作流尚未执行，不能将本地离线diff与语法检查写成线上持续更新已验证。


## 主要代码与记录

- 来源名册、形态匹配、构筑转换、草稿循环与脚本生成：`apps/web/src/source-team-builder.ts`
- 来源版本选择、每版本内存草稿与执行入口：`apps/web/src/source-host-panel.ts`
- Build Workshop 的精确身份过滤及加入队伍：`apps/web/src/build-workshop.ts`
- 普通圣遗物 buff callback：`packages/sim-core/src/artifact-buff-runtime.ts`
- 特殊组成断言：`packages/sim-core/src/__tests__/artifact-special-composition.test.ts`
- 重试记录：`docs/validation/artifact-special-composition-20260928.retry1.log` 至 `retry7.log`
- 离线候选比较：`docs/validation/candidate-offline-diff-20260928.json`
