# 月曜圣遗物与配装应用本地队伍（2026-09-28）

本文记录穹境示现之夜（15041）与纺月的夜歌（15042）四件套回调，以及从 `/builds` 将配装应用到现有本地 `/team` 角色的范围。来源细节来自缓存的固定 a7／b4 Go 源码及既有 b4 来源审计。所有效果仍为固定模拟来源行为，非游戏内验证；不改变生成覆盖分母或独立技能计算器范围。

## 固定来源行为

两套源码分别位于 a7 `internal/artifacts/nightoftheskysunveiling/nightoftheskysunveiling.go` 与 `internal/artifacts/silkenmoonsserenade/silkenmoonsserenade.go`，b4 对应包位于同路径。两个来源版本的文件不是字节相同：a7 文件相对 b4 只涉及 import 与 `AttackTagIsLunar` API 差异，本报告不将其称为 byte-identical。仓库内 b4 来源原文快照为 `packages/game-data/sources/artifact-additional-effects/gcsim/internal__artifacts__nightoftheskysunveiling__nightoftheskysunveiling.go.txt`、`.../internal__artifacts__silkenmoonsserenade__silkenmoonsserenade.go.txt`；既有审计保存 b4、Optimizer 与中文目录来源的证据边界，见[月曜圣遗物来源审计](cross-validation/lunar-artifact-bonus-source-audit.md)。

15041 穹境示现之夜：两件套给佩戴者 +80 EM。四件套初始化读取月兆，佩戴者的暴击率底值在月兆 0／初辉／满辉分别是 +0／+15／+30 个百分点。附近敌人触发月结晶、月感电或月绽放事件时，若佩戴者此刻在场，就给佩戴者添加同一 `gleaming-moon-intent-cr` StatMod，持续 240 帧；事件的 actor 不要求是佩戴者。该套另给全队一个同 key 的 `gleaming-moon-intent-reaction` ReactBonusMod：仅 `AttackTagIsLunar` 为真时，且队伍中该暴击率状态仍被 `StatModIsActive` 视为活动，才增加 +0.1 LunarReactBonus。

15042 纺月的夜歌：两件套给佩戴者 +20% ER。四件套月兆 0 时没有有效四件套 EM 增益；初辉／满辉的团队 EM 增益分别为 +60／+120。佩戴者造成的真实敌人伤害需由本人拥有，攻击元素属于火、水、雷、冰、风、岩、草之一；物理伤害不触发。触发后全队添加同名 `gleaming-moon-devotion-em` StatMod，持续 480 帧。该套另给全队同 key 的 `gleaming-moon-devotion-reaction` ReactBonusMod：仅 Lunar-tagged 攻击且队伍中该 EM 窗口被 `StatModIsActive` 判活动时，增加 +0.1 LunarReactBonus。

两套各自窗口内，同类 StatMod 使用固定 key；刷新覆盖旧值／期限，不增加并行层数。两个不同套装的团队 ReactBonus key 不同，因此若分别满足条件，两种月曜加成为两个 +0.1 分项。不要把它们写成普通 DMG Bonus，也不能只因构筑里选择了套装便静态加上。15041 的 CR 窗与 15042 的团队 EM 窗各自取自不同触发器和状态；月兆等级为配置输入，不由角色名猜测。

### 到期边界不能合并成一个判断

固定 Go 的 `CharWrapper.StatModIsActive` 通过 `modifier.FindCheckExpiry` 检查；该函数在 `expiry < frame` 时才返回不活动，所以 `frame == expiry` 的状态查询仍可能为真。与之不同，真正取 Stat 数值时，`Stats()` 在 `expiry <= frame` 时跳过并清理 StatMod，因此属性数值只在 `frame < expiry` 时进入 Stat 结果。两个回调中的 LunarReactBonus 使用 `StatModIsActive`，所以不要将该边界改写成“所有消费者都在 expiry 帧有效”或“所有消费者均严格大于 expiry”；分别记录查询与属性采样的实际语义，并保留同帧读取／清理顺序影响。

## 配装应用到本地队伍

原有 `/builds` → source-team 桥接继续使用：按选定来源形态交接武器、圣遗物套装及圣遗物五件词条。本轮新增的是另一条路径：将构筑应用到当前本地队伍中一个已存在、由用户明确选择的 actor，不创建新队伍，也不把角色面板传给 Go。

`packages/sim-core/src/equipment-team-handoff.ts` 的 `applyEquipmentBuildToTeam(config, actorId, input, metadata?)` 返回 `{ config, enabled, unmapped }`。它仅接受本地 SimConfig 已有角色；核对角色元素，并以角色 slug／目录身份或已有 source ability binding 的角色身份、突破、命座与基础天赋进行匹配，不替换角色动作。整场固定来源动作契约会被拒绝。函数通过 `resolveEquipmentBuild` 生成未含条件效果快照的静态角色面板，并应用可准确表达的基础武器数值和无条件二件套；符合条件的被动／动态套装写入本地 `SimConfig` runtime model。已有 actor 的旧武器／圣遗物模型先被移除，队友模型保留；不能映射的前提写入 `unmapped`。该值供本地 TypeScript 队伍模拟器消费；本交接不把面板或这些 model 传给 Go／WASM。

`apps/web/src/build-workshop.ts` 提供 `#build-local-team-actor` 与 `#build-apply-local-team`；西风与宗室自身取样分支出现时要求填写对应选项。`apps/web/src/app.ts` 调用该适配器，再用本地 `controls.setConfig` 应用结果并跳转 `/team`；团队面板列出 `enabled` 与 `unmapped`。这段流程没有改动 GCSim／source-team adapter。独立技能计算器仍保留；未在适配器白名单中、缺少状态账本或前提未满足的机制不会静默启用。

本地四件套 `artifactBuffModel` 白名单为六项：教官（Instructor）、饰金之梦（Gilded Dreams）、乐园遗落之花（Flower of Paradise Lost）、谐律异想断章（Fragment of Harmonic Whimsy）、辰砂往生录（Vermillion Hereafter）与昔日宗室之仪（Noblesse Oblige）。教官／饰金／乐园需要普通 Aura 前提；断章需要生命之契模型；辰砂需要受击后玩家伤害模型；宗室需要用户明确选 0／1 帧自身取样。事件类接入包括流放者、学士、赌徒；烬城勇者绘卷二件套仅在已有夜魂迸发模型证明资格时接入。额外伤害类包括来歆余响四件套与昔时之歌，后者要求本地治疗／玩家伤害上下文。武器侧条件白名单包括静态可表达项、西风、祭礼、讨龙、真实命中叠层与有限追击 proc；缺少合法时间线、目标坐标、完整命中标签或输入延迟等条件时按 `unmapped` 说明，不视为已应用。

属性转换保留明确的表达边界：限定元素伤害只有在当前所有已声明命中都属于同一该元素时才可压成全局 `dmgBonus`；武器命中加成也只有在所有已声明命中适用同一非零值时才压缩写入。若命中标签、元素范围或适用条件不一致，记录为 `unmapped`。适配器清除被替换 actor 原有的 `weaponProcModel`、`artifactEventModel`、`artifactBuffModel`、`artifactDamageModel`、`stellarArtifactModel` 与 `moonlightArtifactModel` 记录，并保留其他 actor 的记录；同时将 `meta.verificationStatus` 设为 `user-supplied`。

## 实际文件范围与验证责任

- 共享公式／schema：`packages/reaction-formulas/src/moonlight-artifact-bonus.ts` 定义便携窗口 schema、来源和共享 `moonlightArtifactBonusStages`；`packages/schemas/src/moonlight-artifact-integrity.ts` 校验固定回调参数与普通伤害事件 backlink。
- callback/runtime：`packages/sim-core/src/moonlight-artifact-runtime.ts` 处理五类 Lunar 宿主共享的状态、窗口、日志与贡献者 bonus read；接入运行入口为 `lunar-charged-runtime.ts`、`lunar-crystallize-runtime.ts`、`lunar-bloom-runtime.ts`、`lunar-mixed-runtime.ts`、`lunar-mixed-v2-runtime.ts`。独立贡献者 calculation context 位于 `lunar-charged-calculation.ts`、`lunar-crystallize-calculation.ts`、`lunar-bloom-calculation.ts`。
- 产品面板／本地配装：`apps/web/src/lunar-simulation-panel.ts` 提供两套选择、月兆与静态二件套基线确认、callback/read trace 和 capture 复现；`packages/sim-core/src/equipment-team-handoff.ts`、`apps/web/src/build-workshop.ts`、`apps/web/src/app.ts` 负责现有本地 actor 的装备应用及 `enabled`／`unmapped` 展示。
- 本轮新增的聚焦核心测试是 `packages/sim-core/src/__tests__/moonlight-artifact-composition.test.ts` 与 `packages/sim-core/src/__tests__/equipment-team-handoff.test.ts`；两个页面流程为 `apps/web/e2e/moonlight-artifact-runtime.spec.ts` 与 `apps/web/e2e/equipment-team-handoff.spec.ts`。

Moonlight ledger 的完整性校验可验证来源键、固定数值／持续帧、同名覆盖和普通伤害事件 backlink；它自身不单独证明所有 special delivery 的触发原因。special event 与其触发及贡献者窗口的关联由外层完整 capture 保存、导入后重跑并对照完整结果负责。两层职责不能合并成“base ledger 独立证明所有特殊事件”。

## 验收记录

- 初始核心聚合覆盖 Moonlight 与 equipment handoff 两个文件、两个用例：handoff 用例通过，Moonlight 用例失败。新团队 EM 窗口进入月结晶晶片后，既有 `crystallizeShardLog.0.sourceElementalMastery` 完整性核验未读取新增的真实 EM callback ledger，断言原 expected 400、实际 520。修复是补入 callback ledger 与它在受击／生成结果中的可核验接线，没有放宽断言。
- 接上真实账本后，Moonlight retry1 又因夹具预计刷新期限 550、而实际来源事件刷新为 562 失败；按实际事件时序修正期望后，retry2 专项用例通过（1 文件、1 测试；receipt 墙钟 2.21 秒，测试本体 382ms）。原始聚合及两次重试日志均保留；handoff 核心用例的首轮通过和 Moonlight 最终通过构成两个核心用例的已记录结果。
- 生产构建首轮失败（2.416 秒）：类型比较把已限定为 `user-supplied` 的状态与 `verified` 比较，另有不同 runtime model 的 actor 数组 union 类型不兼容。两处窄修后 retry1 构建通过，墙钟 3.450 秒；Vite 转换 675 modules、构建 807ms，typecheck 通过。
- 浏览器流程中的原始失败全部保留。最初启动失败（0.693 秒）是 Node 测试直接导入 `sim-core` 间接加载 `definitions.json` 时缺少 `type: json` import attribute，没有页面证据。修正测试导入后，browser retry1 的月曜流程通过（Playwright 2.2 秒），但装备流程因测试漏选 `effectsDisabled` 而失败；retry2 的装备 UI 操作和回放已到达，随后完整精度 trace 选择器同时匹配隐藏的共享检视器，属测试 scope 错误；将读取范围收窄到 `#calc-results` 后，retry3 装备页面通过（Playwright 1.0 秒、receipt 墙钟 2.313 秒）。没有为 retry3 重建生产 bundle，也没有因这两项测试夹具问题修改产品实现。
- 月曜 capture receipt：[moonlight-artifact-runtime-20260928.result.json](validation/moonlight-artifact-runtime-20260928.result.json)。遵循固定 a7 条款的本地 TypeScript 合成流程记录 8 callbacks、10 reads、5 个 special damage event、6 个 ordinary damage event；独立计算器重现 event damage `5947.4016604257395`，delta `0`。本轮没有重新编译或执行 WASM；这是该合成输入的逐值复现，不是 a7 Go 实测、来源效果完整性或游戏机制验证。
- 配装 capture receipt：[equipment-team-handoff-20260928.result.json](validation/equipment-team-handoff-20260928.result.json)。本地队伍两次命中分别为 frame 1／damage `1611.7910693920485` 与 frame 31／damage `1653.0613746609279`；后击独立计算器重现完全相同，delta `0`。角斗士四件套留在 `unmapped`，未静默启用。
- 最终本轮记录为两个核心用例各有通过记录、两个页面流程均通过；生产构建 675 modules／3.450 秒／Vite 807ms。Receipt：[聚合检查记录](validation/moonlight-equipment-checks-20260928.json)。初始失败及各次测试修复仍按各自日志保留。


通过任何有限固定样例都不等同于全角色／全部队伍机制完成、任意 checkpoint 可恢复、任意来源包注册项可执行或游戏 verified。现有候选与角色覆盖统计分母不变；只有本轮明确新增并按既有统计规则纳入的条目才可调整对应计数。
