# 固定来源宿主：完整包名册、月曜桥接与属性贡献记录

更新：2026-09-25。本批继续同一固定来源宿主，未变更角色分类版本。当前 `.27` 仍为 **124 身份／1249 命中模板／710 条件完整动作／16 部分／0 分类阻塞**；正式 verified 和条件映射 team-ready 不晋升。前批运行数值及失败记录保留于[整类覆盖报告](broad-coverage-runtime-20260925.zh-CN.md)。本页分别记录生产实现、来源身份与实际验收；全量目标仍未完成。

## 固定来源可自动取得

`npm run source:prepare` 现在可以从固定 commit 自动取得原始源码，校验归档并逐文件匹配仓库内的完整 Git tree。已有缓存同样必须匹配固定身份，不跟随远端 HEAD，也不依赖先前手工准备的临时目录。首次执行记录为 exit0、墙钟 **8.634 秒**，见[日志](validation/source-portable-prepare.initial.log)及[退出码](validation/source-portable-prepare.initial.exit)。

| 身份 | 实际记录 |
| --- | --- |
| 原始仓库 | `genshinsim/gcsim` |
| 固定 revision | `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` |
| 下载地址 | [固定 commit 归档](https://codeload.github.com/genshinsim/gcsim/tar.gz/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541) |
| 下载字节数 | 56,440,121 |
| 归档 SHA256 | `334067728781541ccd4351fbe9851f7684f4f6c2d4dab79a1c3dd1e01318fd1a` |
| 完整 Git tree SHA256 | `15965fb70c98aba229279056e9dc98a4ce2c042919135b807e5cbcb1651f0ad7` |
| 匹配原始 blob | 4021 |

`source:build` 在暂存产物目录内生成 WASM、manifest 与名册 metadata，再登记对应产物哈希。名册和执行产物据此引用同一来源身份。下载、原始树匹配、补丁构建与游戏验证是不同步骤；固定原始文件匹配不能证明来源实现没有机制错误。未缓存的 Go 工具链及依赖仍可能需要网络。

## 所有注册包可在正常页面发现

`/source-simulation` 的名册以 `/source-host/manifest.json` 中真实 `registeredSourcePackages` 为分母，支持中文／配置键／目录／TODO 文本搜索、角色／武器／套装筛选及每页 12／24 项。选择一包即可查看固定 commit 的源文件，无需先建立完整队伍。原生输入、按钮与分页支持键盘；独立计算器仍保留自己的入口。

辅助 metadata 只在 repository、revision、注册文件路径及注册行均匹配时补充信息。角色目录名不直接当作 GCSL 键：生成器读取真实注册、catalog 字面量键和解析器 shortcuts，再给出配置片段。例如 `ayaka` 对应 `kamisatoayaka`，`archaic` 对应 `archaicpetra`。不能解析时显示原包名和“来源键待查”，不猜键或生成不可证明的片段。

| 静态名册口径 | 当前值 | 不能据此推断的结论 |
| --- | --- | --- |
| 注册来源包 | 401：117 角色／231 武器／53 套装 | 不是完整角色／装备 readiness |
| 有实际来源链的配置键 | 401 | 不是 401 个游戏验证定义 |
| 包含明确 TODO 标记的包 | 182 | 无标记不代表无缺口 |
| 独立源码标记位置 | 429 | 只扫描明确 TODO／FIXME／未实现标记，不是全部错误数 |
| 按包展开标记 | 493 | 共用旅行者实现会重复归属，不是 493 个独立问题 |

一次 metadata 提取读取并匹配 1599 份固定源码；该提取是来源整理，不记作新增测试。生成器位于 `packages/source-host/scripts/generate-source-inventory-metadata.mjs`，正常界面位于 `apps/web/src/source-host-inventory.ts`。片段内等级、天赋、命座与构筑值均为可编辑假设；只有用户明确选择才插入编辑器，不自动运行或声称推荐配装。

## 月曜共享伤害已进入真实运行

Go 继续执行原始动作、附着、资源、参与者窗口、回调及随机数；TS 共享特殊公式同步返回实际伤害。新增桥接保留来源实际调用顺序，不为了解释重复读取属性、调用反应增益闭包或抽取随机数。

- 月感电／月结晶反应分别传递每位实际参与者的取样、原生暴击抽样和贡献，然后验证稳定排序、权重与最终交付；先逐人暴击，再排序加权。
- 直接月感电、直接月绽放、直接月结晶读取真实缩放属性、专属增益／加算、精通、抗性与原生终端暴击，由同一特殊公式计算。尚未解决的来源 DEF 条件保持显式拒绝；不把普通增伤或增幅字段静默混入月伤。
- 月绽放触发本身记录为非伤害事件。草露／草原核状态继续由原生机制执行，不凭一个零值生成伤害应用。
- 独立捕获保留实际前置组件、来源与取样帧、目标、随机数及产物身份。编辑后复用原抽样作反事实计算，不能称作重新运行 Go 生命周期；完整 JSON 保留该区别。

新增可编辑月曜示例只提供明确的构筑与动作假设；实际反应分支仍由运行态产生。生产文件包括 `002-lunar-outgoing-boundary.patch`、Go 月曜边界、`source-host-special-formula.ts`、wire／capture 和正常来源页面。本批尚未把 **Stellar 星辉** 接入此来源宿主，亦未把全部装备／角色闭包解释为共享 AST。

## 通用属性贡献记录与共享解释

本批已实施通用 `Stats`／`Stat`／`NonExtraStat`／`SelectStat` 读取、真实 snapshot 与攻击增量的贡献记录：保存原始基础向量、原 modifier 返回值、执行顺序、筛选与到期分支、取样帧以及实际累计结果，再由共享 AST 重建数值加法。记录点包围原来那一次调用，不重复执行 `Amount()` 或读取 getter；目标专属攻击记录采用独立记录，避免污染其他目标的快照。

`resolveSourceHostRequest` 已把这些记录接入普通伤害、直接月伤、月反应贡献者及排名的可见 trace；排名同时携带每位实际贡献者的原快照记录。完整结果 JSON 导入重算也执行逐项加法、累计量及最终快照一致性校验。实际代码位于 `003-stat-provenance.patch`、Go 来源记录类型／收集器与 `source-host-stat-provenance.ts`。

这里的交付边界是**实际数值贡献**。任意 Go 闭包内部公式、跨角色读取关联、`ReactBonus` 各项贡献、目标抗性／防御各项修正、触发历史和完整生命周期仍未全部展开；snapshot 后处理或直接修改攻击字段只记录真实前后差值，不能反推一条不存在的被动公式。编辑最终属性后也不能声称旧贡献重新执行了来源闭包。设计依据见[属性贡献导出方案](source-host-stat-provenance-design.zh-CN.md)；其中比上述实际范围更广的 hook 仍是后续设计，不能因本文验收而算作已实现。

## 必要验收记录

| 项目 | 实际结果 | 原始记录 |
| --- | --- | --- |
| 固定源码自动取得与 4021 blob 匹配 | 首轮 PASS，exit0，8.634 秒 | [日志](validation/source-portable-prepare.initial.log)／[退出码](validation/source-portable-prepare.initial.exit) |
| 全包 metadata 提取 | 已生成；401 包／401 键；同一暂存产物身份；静态来源整理，不计新增测试 | [构建中的提取记录](validation/source-lunar-wasm-build.retry1.log) |
| `source:build` initial | exit1，3.865 秒。Go 编译和 metadata 生成已成功；旧依赖许可证文件继承0444，覆盖产物时 EACCES | [原失败](validation/source-lunar-wasm-build.initial.log)／[退出码](validation/source-lunar-wasm-build.initial.exit) |
| `source:build` retry1 | 生成输出复制前／后显式设0644后 exit0，2.752 秒；6 个实际链接依赖，缺失许可证列表为空 | [通过](validation/source-lunar-wasm-build.retry1.log)／[退出码](validation/source-lunar-wasm-build.retry1.exit) |
| 类型／生产构建 initial | exit1，2.418 秒。唯一错误为 enum-valued union 的负向缩窄；在已验证且排除经典分支处标注特殊请求类型 | [原失败](validation/source-lunar-app-build.initial.log)／[退出码](validation/source-lunar-app-build.initial.exit) |
| 类型／生产构建 retry1 | exit0，3.197 秒；630 模块，Vite 561ms；保留大 chunk 提示 | [通过](validation/source-lunar-app-build.retry1.log)／[退出码](validation/source-lunar-app-build.retry1.exit) |
| 唯一新增正常页面聚合 | 首次 PASS，exit0；用例2.8 秒／Playwright3.1 秒／墙钟3.651 秒 | [页面](validation/source-lunar-browser.initial.log)／[退出码](validation/source-lunar-browser.initial.exit) |

本批 WASM 为 **41,554,594 字节**，SHA256 `70c4f7c8087a1889b8a22f54d0911f7510a786c3b0fa98eefd4fe4fe33926f8f`。新页面实际加载并保存相同哈希，不仅检查 manifest 声明。

收尾仅静态读取 `packages/source-host/dist`、`apps/web/public/source-host` 和已构建网页中的三份WASM，字节数／SHA256均与上述manifest一致，读取工具exit0；`git diff --check`亦exit0。这两项不运行模拟、不增加测试计数。

唯一新页面先搜索 `ayaka` 并取得来源证实的 `kamisatoayaka` 片段，再执行可编辑月曜示例。实际观察 **3600 帧／60 秒、172 命中、261 次公式计算，总伤408385.34443141945**；月感电反应／直接、月结晶反应／直接、月绽放事件／直接六个分支都在真实队列中出现。命中索引11独立回放差0；编辑参与者EM后伤害 **3440.839616994448 → 3728.2198397710567**。完整 result JSON 导入重算与独立 editable JSON 导入均通过，`pageerrors=[]`。这些是该固定脚本、seed和明确构筑假设下的本地运行，不是游戏外部实测，也不代表六个分支的全部状态组合。

本批只新增这一条页面流程，累计 **38 单元文件／91 用例、26 页面**。未重复数据生成、旧角色矩阵、旧页面或大型随机。两次构建失败、定点修复及后续结果全部保留；历史 `.27` 数字与原验收记录不回填改写。

## 仍须完成

来源宿主仍为 provisional、解释 partial；包名册不改变机制可信等级。任意帧闭包 checkpoint／断点恢复与稳态、Stellar 来源公式、共享玩家入伤、全部属性闭包的内部推导仍有生产缺口。项目另有 16 部分动作、未齐的被动／命座／装备生命周期、空间／多目标和来源冲突；可取得固定源码的部分继续实施，不把“未完成”统一称作“缺资料”。真实 7.1.50 两身份 preview 保持隔离，未证明对应 7.2 V1，也不因本批来源宿主改动晋升正式数据。
