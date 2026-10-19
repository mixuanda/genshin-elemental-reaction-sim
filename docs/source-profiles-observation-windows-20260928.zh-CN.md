# 来源执行方案与连续观测窗口：实施与验证报告

日期：2026-09-28。本文记录固定来源构建、执行方案接线与批次观测的实现边界。来源包登记与固定源码执行不等于游戏内验证；以下结果不得称为实测游戏帧或已收敛 DPS。

## 执行方案与八项延迟

执行配置覆盖 `swap_delay`、`attack_delay`、`charge_delay`、`skill_delay`、`burst_delay`、`jump_delay`、`dash_delay`、`aim_delay`，单位均为来源模拟帧（60 帧/秒）。三类内置工具政策为：

| 方案 | swap | attack | charge | skill | burst | jump | dash | aim | 来源 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Ideal | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 工具提供的零输入延迟假设 |
| Practical | 8 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 精确对应 GCSim `frame_defaults=human` |
| Conservative | 12 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 工具提供的保守假设，不是游戏实测或社区标准 |
| Custom | 用户指定 | 用户指定 | 用户指定 | 用户指定 | 用户指定 | 用户指定 | 用户指定 | 用户指定 | 用户自定义值 |

Ideal 明确将八项都置零，覆盖固定来源解析默认 `swap=1`、其余七项为 0 的行为。没有保存方案的旧队伍草稿也按此理想假设加载，因而重新生成脚本时可能与旧默认切人延迟相差1帧；已保存的原始结果及脚本不改写。Practical 采用来源所写的 human preset 数值，但 human 名称和值不是游戏实测背书。Conservative 数字只是产品政策选值。编译器将各方案转换成八个明确 `*_delay=N` 配置项；草稿和结果脚本保存 `source-action-delay-v1`、档位和实际值。

上游 b4/a7 原逻辑只有 `swap_delay` 实际驱动 swap 动画。仓库本地 `packages/source-host/patches/009-execution-profile-delays.patch`（Stellar overlay 构建也显式应用该文件）将其他七项用于指定动作的施放前执行延迟：队列动作先经过来源 ReadyCheck；进入动作执行阶段后，等待配置帧数，再由来源执行动作；现有 GCSL `delay(n)` 仍与方案延迟相加。该 patch 明确说明其为 source-host 本地执行政策，并非上游 GCSim 行为。

倒计时使用原执行器的 `preActionDelay` 路径，保留卡肉暂停和倒计时结束后的就绪复查；切人沿用原动画，不重复加入七项路径。普通日志表显示 `profileDelay` 与包含显式 delay 的 `totalPreActionDelay`；动作实例卡显示实际排队、施放及下一输入窗口。两来源均声明 `executionProfileActionDelays` 能力及 `after-ready-check-before-exec` 阶段。没有新增凭空估算的冷却、命中或取消帧。源码审计见[八项原行为](research/source-execution-profiles-20260928.md)。

## 连续轨迹与窗口统计

`apps/web/src/source-host-batch.ts` 的批量运行会为每个候选配置/种子启动一次完整来源运行；预热与窗口只从这次运行的同一连续轨迹中切片。默认可比较实际完整轨迹前后半窗；预热模式要求完整运行覆盖「预热 + 两个等长测量窗」。界面文案明确说明预热只排除统计，不重置能量、冷却、实体或随机流，旋转脚本必须自行安排循环动作。

统计顺序是：先对每个随机种子内的后窗与前窗作配对差，再将这些 seed 内差值跨种子汇总；两个窗口不会被当成独立样本。若用户只导入既有轨迹并更改观测方式，重新分析只重切片已保存结果，不触发新的来源模拟。导出在两种窗口模式下分别写 `source-host-batch-v1`（前后半窗）或含 `observationPolicy` 的 `source-host-batch-v2`（预热与双窗口）；导入兼容这两个 schema。

来源帧从1开始：预热W帧、每窗L帧对应 `[1+W, 1+W+L)` 和 `[1+W+L, 1+W+2L)`。伤害按真实命中帧求和，DPS分母分别为L/60秒，预热及额外尾段不计入；轨迹不足两个完整窗时不输出该分析。能量边界取原始帧前状态，不把缺失边界替换为最后一个已知能量值。页面秒数可表示整数帧，支持保存的分数秒窗口。

同批要求精确脚本、执行器源码及WASM、动作政策、队伍与实际时长一致。逐种子配对差包含DPS、伤害、能量边界、得失能量、实际Q及失败次数；展示经验P05/P50/P95和Student-t均值差区间，小样本局限明确保留。主TypeScript模拟器已有的零能/满能启动和W/2W随机分析没有复制或重算为本轮新功能。

窗口差值、随机分布和均值置信区间只描述当前脚本、固定来源、输入 seed 与观测范围。它们不证明旋转达到稳态，不验证不同初始资源条件，也不代表最优配装。面板提示保留“没有实际 Q 请求则不判可行”、已评估网格范围和窗口外失败不计入目标统计等限制。

## 固定来源构建记录

以下数值来自两个 source execution profile 构建日志；两项均记录命令成功。WASM hash 是各来源产物标识，不能互换引用。

| Variant | 来源修订 | 构建命令 | 记录墙钟 | WASM bytes | SHA-256 |
|---|---|---|---:|---:|---|
| Classic | `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` | `node packages/source-host/scripts/build-source-host.mjs` | 3.232 s | 41,920,581 | `5eacb29bec79827710457c876c5075ac6f4dae9371c316095776541bc13fe3d0` |
| Stellar | `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd` | `node packages/source-host/stellar-overlay/build.mjs` | 3.645 s | 61,527,503 | `325459ac0aefb3fbf7e9173a8aa7f47ef2be53b02642a8009dd17ecc2de92eed` |

证据：[Classic 构建日志](validation/source-execution-profile-b4-build-20260928.log)、[Stellar 构建日志](validation/source-execution-profile-a7-build-20260928.log)。这些是 WASM 编译与打包时长，不是模拟运行时长或页面响应时间。

## 实际测量

页面均加载本轮Classic产物，其SHA-256与上表一致。只运行3条短来源轨迹：1条自定义方案、1个含2种子的批次；没有遍历角色矩阵。

自定义方案从实用档切换后将普攻延迟改为12帧，草稿导出/导入保留所有值。实际第1帧排队，回执记录 `profileDelay=12`、`totalPreActionDelay=12`，第13帧施放，第40帧开放下一输入窗口。来源能力记录该延迟为本地执行政策。[原始草稿](validation/source-execution-profile-20260928.draft.json)、[完整运行](validation/source-execution-profile-20260928.result.json)。

双种子使用同一6秒/360帧脚本，每条各6次伤害结算；预热60帧、每窗120帧，两个窗口均各含2击。下表为实际共享公式输出，保留小数是便于复现，不是游戏实测精度声明。

| 随机种子 | 前窗伤害 / DPS | 后窗伤害 / DPS | 配对DPS差（后减前） |
| --- | --- | --- | ---: |
| 1 | 463.6593905754817 / 231.82969528774086 | 855.8962489497078 / 427.9481244748539 | 196.11842918711304 |
| 2 | 655.4435038000493 / 327.7217519000246 | 1062.7442960383387 / 531.3721480191693 | 203.65039611914472 |

实际窗口为 `[61,181)`、`[181,301)`，各用完整2秒作分母。页面重新选择前后半窗后导出v1，全部原始runs与v2严格相同且未新增Worker；再导入v2恢复原窗口。两页未捕获页面错误均为空。此次脚本没有Q请求，不据此判定能量可行或稳态。[实际批次](validation/source-observation-windows-20260928.result.json)、[原始结果派生测量](validation/profiles-observation-measurements-20260928.json)。

## 必要检查与失败记录

| 检查 | 实际执行与结果 |
| --- | --- |
| 两来源WASM构建 | 各执行一次、exit0；时长及hash见上表。本轮a7没有新增页面运行，不将编译通过写成运行验证 |
| 新窗口核心聚合 | 初版由子代理执行1次、1用例通过/Vitest1.27s；之后补齐缺失能量边界返回null与类型修正，仅复验此聚合：1/1通过、exit0、Vitest1.27s/墙钟1.486s。两个运行不重复计为新增用例；[初版回执](validation/source-observation-policy-agent-20260928.txt)、[最终原始日志](validation/profiles-observation-core-20260928.log) |
| `npm run build` | 首次exit1/2.590s，方案helper回调中`profile.mode`未保持联合类型收窄；提取const后retry1 exit0/3.468s、668模块/Vite615ms。保留原有大chunk提示；[首次](validation/profiles-observation-build-20260928.log)、[通过](validation/profiles-observation-build-20260928.retry1.log) |
| 两个新增Playwright页面 | 首轮2/2通过、exit0、Playwright2.0s/墙钟2.245s；覆盖方案草稿和实际延迟、预热窗口及v1/v2复用，不重跑历史页；[原始日志](validation/profiles-observation-browser-20260928.log) |

全部主线程检查的命令、退出码和墙钟见[命令回执](validation/profiles-observation-checks-20260928.json)。最终`git diff --check` exit0/0.074s，HEAD仍为`84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5`；原工作树改动保留，没有提交、推送或部署。没有运行历史全单元集、全角色/装备矩阵、数据生成或大型Monte Carlo。

## 当前剩余范围

这批补齐来源执行方案和可配置观测统计，不完成来源Go/WASM的任意状态检查点、随机收敛证明或自动跨初态敏感度对照。延迟不会替代角色本身的动画与取消机制；七项本地延迟政策也不是对上游原有功能的认证。没有新增官服数值/机制独立验证；正式与预览指针、条件定义和verified计数不变。

独立单击/单技能计算器仍是主产品入口，无需构造队伍。124身份的248档参考配装与18配队起步模板仍保留，小毕业/大毕业是参考投入档，不意味着已经验证所有人物和配队的最优解。主提示的全部目标仍未完成，goal继续进行。
