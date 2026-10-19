# 固定来源角色动态修正与 7.1.50.2 部分预览

本记录覆盖固定来源 b4/a7 的三组角色动态向量公式，以及新的 Lunaris 7.1.50.2 局部预览快照。固定来源数值和 provider 原始字段都是 provisional；不代表游戏 verified，本轮不改变任何 verified 分母。

## 动态角色公式的三组接入

共享 AST 描述符按原生语义分为三组：A 组 39 条规则、41 个来源调用点；B 组 36 个 rule/slot，覆盖 34 类按角色与 modifier key 去重的回调；C 组 27 条规则、涉及 20 个来源文件，包括 12 个 Amount 读取点、15 个创建计算点和 15 个快照关联点。三组共 102 个动态 descriptor。各组的 b4/a7 Go patch 与 TS 规则 ID 对齐；该数量只统计本批动态规则，不等于全角色或全角色机制支持。

同帧动态值在原 Amount 回调处使用共享公式；创建型数值在原 buff 或 modifier 更新帧计算并写回原生向量，同时记录计算 ID，后续消费者关联该创建回执，不以消费帧状态重算。descriptor 可将真实来源 getter 的读值与 AST 状态叶绑定；未声明 getter 绑定的其他叶仍作为原生观测输入，不臆造额外读取。Go 保留触发条件、角色/目标门、到期、nil 返回及状态修改。例：A 组 Chevreuse A4 在创建帧真实读取 MaxHP 并计算 `min(maxHP / 1000 × 0.01, 0.4)`，后续队友消费同一快照；Bennett 爆发读取天赋表、命座和一次基础攻击力后创建攻击力快照。B 组同时覆盖同帧 Amount 与创建型效果；C 组 Varka A1 的一次创建读值由 Anemo 和转化元素的原生 modifier 通过明确的 consumer-slot 映射共用。

协调接入采用整向量保护：只有同一 Amount 回调中全部非零数值槽都被共享规则覆盖，才整体迁移该回调；若混有未解析数值，则整个向量保持原生 opaque，不做逐槽 fallback 或运行时静默回退。已有固定标量规则与动态描述符属于不同公式范围，不能据此合并宣称角色全覆盖。动态规则仅覆盖逐项审阅的向量；攻击标量、常量或其他非向量机制不会因同一角色已有 descriptor 而自动纳入。

本批 102 个规则接入共享公式 trace、捕获回放与原捕获 JSON 恢复，但尚未新增 character-modifier 专属参数编辑控件；现有独立计算器仍围绕主命中与圣遗物编辑流程。规则可追溯/恢复不等同每条角色修正都可独立编辑。

[`source-character-dynamic-coverage-20260928.json`](source-character-dynamic-coverage-20260928.json) 对两个已构建 Go 源树中 `character.StatMod`/`AttackMod`、返回 `[]float64` 的 Amount callbacks 做了语法清点：classic 共 302 个，其中共享桥接 192 个（固定 94、动态读取 58、动态创建消费 40），其余 110 个；stellar 共 326 个，已桥接 193 个（固定 95、动态读取 58、动态创建消费 40），其余 133 个。未桥接项按直接槽写入、返回本地/字段/索引向量及 nil-only 分类。该清点只统计语法形态，不表示未桥接项可自动迁移或已满足生命周期要求；共享 callback 数、规则描述符数与角色数口径不同，不可互换。

## 本轮构建与页面测量

classic 与 stellar source build 首轮通过，耗时 5.374 秒、6.160 秒。产物 SHA-256 分别为 `336f071a34874311cdeea043e7ef56b28457b7c267656fc0f374d155fc572370`（42,382,107 bytes）与 `94a6756787ff9ad68fff8979f46dff485f41eb652f9d232444d295c3b9bd8969`（63,681,387 bytes）。Web build 首轮因两处 E2E 类型窄化错误失败（2.699 秒）；修复后 retry 1 通过（3.719 秒、710 modules、Vite 857 毫秒）。

页面聚合首轮（3.457 秒）已执行并保存 classic 原生结果，通过 Raiden 等数值断言后，在 Itto 跨帧消费断言处因测试把来源 actor key `aratakiitto` 错按 `itto` 过滤而失败；修正一行 fixture 后 retry 1 通过，墙钟 7.267 秒、测试 5.9 秒、runner 6.8 秒，`pageErrors[]`。每 lane 执行一条 20 秒脚本：各 20 个命中应用、1054 条 calculation；五个动态 rule ID 共 59 次调用（Raiden A4 41、Bennett Q 13、Yoimiya A1 3/A4 1、Itto Q 1）。观测到 Yoimiya A4 创建 ID 70；Itto Q 创建 ID 80 在帧 385、429、462 的后续命中复用。Raiden A4 在帧 0 以真实非额外 ER 2.126268198 创建 ID 1。选中命中原始伤害 1804.3113722207872，两个来源的独立公式回放差值均为 0；两 lane 数值相同。收据：[classic 构建](validation/source-character-dynamic-classic-build-20260928.json)、[stellar 构建](validation/source-character-dynamic-stellar-build-20260928.json)、[Web retry 1](validation/source-character-dynamic-web-build-retry1-20260928.json)、[E2E 首轮](validation/source-character-dynamic-e2e-20260928.json)、[E2E retry 1](validation/source-character-dynamic-e2e-retry1-20260928.json)、[聚合结果](validation/source-character-dynamic-20260928.result.json)、[验证测量汇总](validation/source-character-dynamic-measurements-20260928.json)、[classic 原生结果](validation/source-character-dynamic-classic-20260928.result.json)、[stellar 原生结果](validation/source-character-dynamic-stellar-20260928.result.json)。

Classic 独立计算器 JSON 导出、导入后保留原捕获并重算通过。测试还重放了此前保存的护盾 incoming fixture：absorbed 5066.769647346，关联 Bolide/千岩共享支持计算，回放差值 0；这不是本轮新增 WASM 运行。preview 身份检查确认当前 snapshot `snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217`，页面可切换到 released 目录，active verified 仍为空。页面场景实际观测到 5 个本批动态 descriptor ID，其余 97 个未触发；选中公式回放和 JSON 恢复不等同任意状态重启或完整从头重执行。

[`source-character-dynamic-tracked-diff-check-20260928.json`](validation/source-character-dynamic-tracked-diff-check-20260928.json) 记录 `git diff --check` 通过（0.078 秒）；范围仅为 tracked 差异，不覆盖 untracked 文件，也不替代全库验证。

## Lunaris 7.1.50.2 局部预览快照

归档的 provider 观察版本为 `7.1.50.2`；原始采集经 hash 复核后形成局部候选，snapshot ID 为 `snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217`，label 为 `lunaris-7.1.50.2-preview-observed-20260928.partial-two-characters.1`。候选含米提亚（`character:10000136`）和瓦列里（`character:10000137`）两名角色、2 天赋集、13 个非空能力、2 命座集；武器和圣遗物套装均为 0。结构校验有效，但数值证据与机制证据均缺失，inventory 未知且可执行 readiness 为空。这是两角色局部快照，不是 7.1.50.2 完整角色或版本清单。

2026-09-28 的发行商页面索引观察仍指向正式版本 7.1（[德语新闻页](https://genshin.hoyoverse.com/de/news/detail/166383)、[西语新闻页](https://genshin.hoyoverse.com/m/es/news/detail/166383)的索引列出 2026-09-23 更新安排）；英文正文不可直接读取，链接仅支持页面索引观察，不代表已归档官方全文。观察记录见 [`observation.json`](../packages/game-data/sources/release-observation-20260928/observation.json)。Lunaris 的 `7.1.50.2` 未被证明等同 `7.2 V1`，授权许可仍未知。候选入库与预览仅更新了隔离 preview workspace：新 snapshot 当前被选中，旧 `7.1.50` preview 仍在清单中并已归档；现有 UI 没有直接切换历史 preview workspace 的功能，不能写成旧版仍可直接选择。released 目录保持 `snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34`，active verified 指针仍为空。provider 变更摘要是[原始 JSON diff](../packages/game-data/sources/lunaris-preview-7.1.50.2-20260928/revision-diff.json)，浮点表示变化不等同平衡改动；[摄入收据](../packages/game-data/sources/lunaris-preview-7.1.50.2-20260928/ingestion-receipt.json)没有完整命令 wall-time，因此不作性能声明。

详细快照 ID、自动更新状态和保留的历史说明分别见 [README 更新状态](../README.md#update-status) 与 [数据更新状态](update-status.md)。状态 JSON 已按最新官方页面索引观察刷新；摄入收据中的 provider 命令 wall-time 均为 null，不能由 wrapper 时间推断性能。不据此声称游戏 verified、完整预览、全量动态公式覆盖或任意 checkpoint 支持。
