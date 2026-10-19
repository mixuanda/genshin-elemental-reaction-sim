# b4 / a7 角色行动能力与静态提取审计

本文件记录实现前的源码审计；随后完成的元数据与界面接入见[本轮实现报告](../source-actions-weapon-composition-20260928.zh-CN.md)。下文的“当前缺失”描述对应审计时状态。

审计日期：2026-09-28。目标是让队伍构筑器按所选固定来源提供合适的角色行动入口，而不是无条件给每个角色显示相同的十种动作。本文只读审计，不代表执行验证、游戏实测或每个角色机制已通过验证。

固定来源为 classic `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 和 stellar `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`。本机固定来源缓存位于 `/tmp/gidps-source-host-cache/upstream/<revision>/source/`；以下路径以该 `source/` 为根。两个版本都要独立提取，不能把 b4 结果复制给 a7。共用模板大体相同，但 a7 的 `internal/template/character/character.go`、`stam.go`、`pkg/core/player/exec.go` 等有改动：例如 a7 在跳跃中加入星辉涡旋增强跳跃及空中状态；动作队列还会发出 movement 参数事件。因此 revision 必须随 UI 记录的能力数据保存。

## 现有 UI 与 metadata 生成范围

`apps/web/src/source-team-builder.ts` 的 `SourceActionKind` 与动作按钮常量固定列出 `skill`、`burst`、`attack`、`charge`、`aim`、`dash`、`jump`、`low_plunge`、`high_plunge`、`wait`。这只是输入 schema，当前不表达某角色具体实现了哪些能力、参数或状态前提。

`packages/source-host/scripts/generate-source-inventory-metadata.mjs` 目前验证注册清单与源行、解析包内直接 Go 文件中的 `RegisterCharFunc` 及别名、收集包内显式 TODO，再沿同一 characters/weapons/artifacts 家族的 import 扩展实现文件。它产出的是包/key/目录 identity 证据；没有提取 Character 方法集、模板默认方法、帧或参数。它的家族限制也不会自然纳入 `internal/template/character`。Stellar 的 `packages/source-host/stellar-overlay/generate-inventory.mjs` 使用类似登记到配置键流程。新增行动能力元数据应作为另一层生成物，以同一固定 source tree 中的角色包、其同家族共享实现和角色模板为输入，而不能从现有 inventory 字段猜测。

## 动作名到源码方法及默认语义

全局动作分派定义于 `pkg/core/action/action.go` 与 `pkg/core/player/exec.go`。`aim` 分派到角色接口方法 `Aimed`（不是 `Aim`）；`charge` 到 `ChargeAttack`；`low_plunge` / `high_plunge` 分别到 `LowPlungeAttack` / `HighPlungeAttack`。`skill`、`burst`、`attack`、`dash`、`jump` 同名映射。`wait` 在 `pkg/simulation/run.go` 由模拟器处理成帧等待，不调用角色方法。

角色共同模板在 `internal/template/character/character.go`：嵌入式 `*template/character.Character` 提供 `Attack`、`Aimed`、`ChargeAttack`、`HighPlungeAttack`、`LowPlungeAttack`、`Skill`、`Burst` 默认实现；这些默认实现返回 `action … not implemented` 错误。因此，看到角色结构体嵌入该模板并不能说明按钮可用。须沿 Go 方法提升/覆盖关系解析最终有效方法；角色方法若只是委托 `c.Character.Method(p)`，仍须检查模板最终实现，不能把“存在同名方法”直接算作可执行。

`internal/template/character/stam.go` 提供通用 `Dash` 与 `Jump` 实现，并根据角色体型给出基础帧数。Dash 启动 dash lockout/CD 并延后扣耐力；Jump 通常使用体型帧数。带状态时 Jump 也能将角色置为空中状态，要求下一动作为 plunge。a7 在这份模板中增加星辉涡旋强化跳跃分支。因而 `dash`、`jump` 通常来自继承的真实模板能力，不同于上列默认报错的动作；角色仍可覆盖它们，而且运行帧/可接动作可受来源状态影响。

## 方法存在不等于当前可执行

`internal/template/character/ready.go` 的默认 `ActionReady` 会按动作类别检查：Burst 的满能量与冷却，Skill 冷却，Charge/Dash 耐力和 Dash lockout/CD。角色可在自己的 `.go` 文件覆盖该方法添加状态门控，或先做角色专属规则再委托模板。ReadyCheck 还先检查动画锁定；所以这是一项运行时条件，不是菜单动作的静态能力标记。

`internal/template/character/character.go` 的默认 `NextQueueItemIsValid` 对剑/长柄武器 Charge 要求当前普通攻击计数器非零（实现注释写的是大多数此类角色需先 N1）。角色可覆盖这个关系，例如结合姿态、普通攻击计数、状态或其他队列内容判断。它说明动作是否在这一帧/这一行动序列有效，应作为条件规则保留，不能据此在角色卡上永久隐藏 Charge。

`pkg/simulation/run.go` 的顺序是：Evaluator.NextAction 取出脚本下一条 action；排队后由 `NextQueueItemIsValid` 验证该队列项，再进入 `Player.ReadyCheck` 等待动画/资源条件，最后 `Exec` 将动作分发到角色方法。`NextAction()` 是轮转 DSL/evaluator 的“取下一条脚本指令”接口，不是角色能力探测器。`ActionReady` 与 NextAction 的联系仅是：对已经由脚本排出的动作做运行时准备检查；可用性 UI 不应尝试把该函数的当前状态当作静态动作清单。

## 何种源码信息适合批量提取

建议每个记录至少以 `{hostVariant, sourceRevision, characterKey, sourceGameId}` 为身份，能力值保留来源文件与行号，并采用多态结果而非一个布尔值：

- `method: "declared"`：有效方法最终解析为非模板默认错误的角色/共享方法。
- `method: "template-default"`：对应模板方法明确返回 `not implemented`。
- `method: "dynamic-or-unresolved"`：遇到状态分支、复杂提升/委托、动态方法替换或 extractor 不能静态确认。

只有确定结果才可用于静态隐藏不可用动作；条件实现应继续显示，并可提示“运行时视状态而定”。`wait` 应标为全局脚本动作，不属于角色 method。`dash`、`jump` 标明模板继承实现或角色覆盖。该数据不能提升为 verified/game-tested 字段。

### 可靠提取边界

1. 以 manifest 的 `registeredSourcePackages` 为角色集合基准，连接对应 metadata 的 `configurationKey` 与实际角色 import path；b4/a7 分开执行。来源名册登记只确定包边界，须保留其 pinned revision。
2. 对每个角色 package 解析全部 Go 文件，不限 `attack.go` / `skill.go` 等常见文件名；metadata 生成器本身会列 `implementationFiles`，且会跨同家族 import，例如旅行者共享包。另显式解析角色嵌入的模板类型与其模板方法；同名 override 可能分散在 `character.go`、`dash.go`、`plunge.go` 等组合文件。
3. 方法能力应通过 Go AST / 类型提升关系检查有效 receiver method：方法直接实现、条件分支实现、委托到包装字段、最终进入模板默认错误等须分开分类。不要用“目录中 grep 到方法名”或“没有 grep 命中”作为完整支持结论；平台/构建标签、同名 helper、方法别名、共享 receiver 和复合嵌入都需要解析。
4. 把 `ActionReady` 与 `NextQueueItemIsValid` 作为状态门控注释的来源。AST 可提取分支引用的 action kind、参数名、字段/tag 和显式错误类别；不能静态化 `Core`、队伍元素、能量、冷却、前台身份、空中状态、队友动作等运行时值。不要把缺少显式 `ActionReady` 覆盖当作始终可用。

### 普攻链长度

通用模板中的 `NormalHitNum`、`NormalCounter`、`AdvanceNormalIndex`、`NextNormalCounter` 分别是链长度字段、当前计数器、递增并按链长回绕、以及下一击索引。角色通常在 `NewChar` 中以常量/包变量设 `c.NormalHitNum`，攻击实现按 `c.NormalCounter` 选择 multiplier/帧/hitmark，结束时调用 `AdvanceNormalIndex()`；Charge/Skill/Burst 等也可能重置计数器。比如 `internal/characters/amber/amber.go` 设 `normalHitNum`，`attack.go` 将其定义为 5，并按计数器取 `attackFrames`、`attackHitmarks`。

批量提取应追踪对 `c.NormalHitNum` 的所有赋值与来源常量、数组长度/索引，并检查攻击方法中计数器重置、形态切换和按状态替换普攻链的分支。纯常量链可输出静态长度及证据；如在状态/天赋/武器/命座条件下改变链长，则输出条件分支表或 `dynamic`，不可只把最大数组长度当作当前循环长度。对数组/常量表达式不易静态折叠的值应标未知，不猜测。

### 参数键

动作方法签名统一接收 `map[string]int`，实际键在任意辅助函数中读取，不能只检查方法参数或推测“常见参数”。用 Go AST 在方法与其明确调用的同包 helper 闭包中提取 `p["literal"]`、comma-ok 访问及 `p` 传递；动态构造的键保留 unresolved。每个键应记录：直接/辅助方法来源、必需性、缺省值表达式、比较/枚举约束、只影响伤害/动作选择/时长等可静态观察到的信息。源码只读值但没有显式验证时，不能把读取就说成合法范围。

例：`internal/characters/amber/attack.go` 读 `travel`，缺省 10；`internal/characters/diona/skill.go` 读 `travel` 与 `hold`，且 hold 分支改变技能形态。UI 不应对所有角色显示同一套 parameter text box，亦不应将这些键误作所有动作的通用参数。

### 行动帧

`action.Info` 在 `pkg/core/action/action.go` 定义 `Frames(next Action)` 函数、`AnimationLength`、`CanQueueAfter`、动画 State 等不同字段。`Frames(next)` 表示当前动作根据下一动作确定的等待/取消帧；`CanQueueAfter` 是开始排队下一动作的门槛；`AnimationLength` 是动画结束长度。它们不是同义“动作帧数”。执行器的 `action.Info.CanUse(next)` 会依赖这些字段、hitlag 暂停或 normalized time。

AST 可以可靠采集静态整数/常量表达式、`Frames` 里的 switch case、`CanQueueAfter` 和 `AnimationLength` 表达式及其源码位置。若闭包读取 `NormalCounter`、`p`、当前状态、来源帧或对象字段，则标为条件表达式，不能直接渲染单个固定帧值。角色需要知道具体动作后继、前台/空中状态、动画锁定及卡肉时间时，只能运行时结果回答。来源日志中的实际动画/动作帧应继续作为运行记录，不由静态目录伪装成实测。

## 静态目录能回答与不能回答的问题

静态源码提取可为 UI 提供“此 pinned source revision 存在可调用实现”“继承自哪个模板”“需要什么参数键”“攻击链的静态常量或条件”和“帧函数的表达式类别”。来源解析器能否识别某 configuration key、角色包是否被 blank-import 注册，是另一个 package/key gate。

实际行动是否可执行仍由固定来源角色代码、`ActionReady`、`NextQueueItemIsValid`、动画状态、能量/冷却/耐力、姿态及队伍状态在执行时决定。包注册、Parser 识别和静态方法存在都不能证明该角色实现完整，更不能证明与游戏一致。最后一层必须保留来源执行器运行的实际 action log；只有独立游戏证据才能提高游戏验证状态。

## 核心源码参考

- Metadata 范围与方法：`packages/source-host/scripts/generate-source-inventory-metadata.mjs`、`packages/source-host/stellar-overlay/generate-inventory.mjs`。
- b4/a7 字符基类默认方法：`internal/template/character/character.go`、`internal/template/character/ready.go`、`internal/template/character/stam.go`、`internal/template/character/cooldown.go`。
- 通用分派和帧语义：`pkg/core/action/action.go`、`pkg/core/player/character/character.go`、`pkg/core/player/exec.go`、`pkg/simulation/run.go`。
- 具体组合文件例：`internal/characters/amber/amber.go` + `attack.go`、`internal/characters/diona/skill.go`、`internal/characters/ganyu/aimed.go`、角色目录中的 `charge.go` / `plunge.go` / `dash.go` / `jump.go`。
- 当前固定树清单与版本：`packages/source-host/scripts/pins.json`、`packages/source-host/stellar-overlay/pins.json`、`packages/source-host/sources/gcsim-b4ae769-tree.json`、`packages/source-host/stellar-overlay/source-tree.json.gz`。
