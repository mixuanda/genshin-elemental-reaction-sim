# 127 岩造物归属私有实现审计

状态：实现已写入私有目录；仅完成人工静态审阅、Go 格式化及补丁适用性检查。未编译，未运行 native、WASM、模拟或测试；未写入主仓库，未提交。此文件不表示全量计算器或本能力已经运行验收。

## 交付与应用

- `127-constructs.patch`：对主仓库的独立补丁，包含两套 bridge、两套源补丁以及 TypeScript 规则与分析器。
- `classic-source.patch`、`stellar-source.patch`：分别针对固定已补丁源码的源变更；内容相同。主补丁已把它们放到对应 `patches/127-owned-constructs.patch`，构建器按现有排序自动加载。
- `repo-before/`、`repo-after/`：精确捕获的主仓库受影响文件与候选结果，仅供静态审阅。新文件不存在于 before 树。
- `classic-before/after/`、`stellar-before/after/`：固定源码目标文件前后版本；原固定源码目录始终只读。
- `manifest.json`：补丁 SHA-256、每个文件的前后 SHA-256、两套源码 refs 与哈希、原始 blob 记录。
- `source-comparison.md`：两套来源重复对照及准确原始行号。

应用时从 `/Users/evan/Documents/gidps` 对 `127-constructs.patch` 使用通常的 `git apply` 工作流即可。若此前已集成 126 或其他任务对公共文件的修改，保留双方新增 import/字段/分析分支，按本目录 before/after 树合并；不要用整文件覆盖替代合并。未修改任何现有 JSON 契约或任务规则注册表，127 契约独立于 126。

## 固定来源

Classic：`b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，`/Users/evan/Library/Caches/gidps-source-host/build-CHWLQf/source`。

Stellar：`a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`，`/Users/evan/Library/Caches/gidps-source-host/stellar-build-9hFTdx/source`。

需要区分两个哈希层次：`source-comparison.md` 和 manifest 的 `workingSourceSha256` 是已应用现有 bridge 补丁的固定源码文件；新契约中的 `sourceSha256` 是原始 source blob 的 SHA-256。后者来自现有 `dist/source-files.json`，并用 Stellar `source-tree.json.gz` 中相同 git blob SHA-1 和字节数确认两套原始文件相同。不能拿已补丁文件的 SHA-256 冒充 GitHub 原始源码哈希。

## 生命周期和对象身份

原生 handler 在 `NewConstruct` 中按类型替换最后一个匹配项，按三造物限制从头移除，随后发出 `OnConstructSpawned`；`Tick` 只在 expiry 与当前帧恰好相等时移除；`Destroy(key)` 先处理 limited 列表，若命中则返回，否则处理 unlimited。127 只在这些现有分支旁记录：`replaced`、`limit`、`expired`、`destroyed`。原生 OnDestruct 次数、顺序、清理和事件发出不变。

`OwnedEntity.kind="construct"` 使用 Go 原生 object 作为内部身份，`id` 是跨替换独立编号。已有 `targetKey` 字段仅携带原生 key，不能作为身份。固定源码的岩造物实现都为指针类型（Albedo、Zhongli、Ningguang、Itto、Geo Traveler skill/burst、LunarCrystallize），因此原生对象可直接作为 map key。所有造物均登记，只有已审阅的 Albedo/Zhongli 出生点取得 invocation/spawn producer 所属；其它造物 actorIndex=-1 且无 invocation，只作为共鸣位置上下文。

历史 object -> id 映射在移除后保留，使已经排队的任务能继续记录真实归属。不会拿后来同 key 的对象替代旧对象。

## 阿贝多 E

`skill.go:33-80`：初击仍由 Skill 方法排队，原生 +25 核心任务产生一个阳华对象，1800 帧寿命不变。新增观察指针不参与 gameplay 判断。

`skill.go:105-162`：沿用既有 `OnEnemyDamage` listener、所有门槛、120 帧 ICD、目标选取、1 帧伤害延迟、particle callback、C1/C2 逻辑。每次实际 listener 执行绑定当时仍存活的阳华 object；owned emit 和既有 event emit 双重登记同一个 QueueAttack 调用，不改 Origin。后续任意角色动作触发的刹那之花归属阳华出生的 E；触发动作自身不纳入。

分析器交叉验证 registration -> emission.listenerIds -> listener call -> object trigger；零／一攻击分支来自原生已经记录的 event fact。对象移除后在途 bloom 仍保留所属，最终伤害派发由现有 finite-cast 检查完成。缺失事件三表、回调/emit 不完整、对象尚未移除时保持 partial。

重要原生细节：Skill 在新阳华出生之前就更新角色共享 `skillSnapshot` 与 `skillArea`。旧阳华在这段时间内触发时原生会读这些新值。127 保留该读取方式，既不复刻 snapshot，也不按 object 替换为想象的独立快照。

`asc.go` 和 `cons.go` 已审阅：A1 改伤害，C4/C6 是增益周期任务，粒子/C1 回能/C2 层数不是额外 E 伤害机会，因此不把这些任务尚未结束等同于伤害链尚未结束。

## 钟离 E

`skill.go:37-105`：press 在 +24 创建石脊；hold 在 +48 仅在原生 count/max/createStele 条件成立时创建。把原生已计算的创建布尔值记录为 invocation fact；`hold_nostele` 和已有满柱时不会把旧柱归给本次 E。长按冲击与创建初击保留原排队路径。盾及减抗任务不改动。

`stele.go:14-88`：初击继续在创建对象前排队并属于出生任务；登记实际 stoneStele object 后，第一条原生共鸣任务绑定该 object。1860 帧寿命、120 帧首任务延迟不变。

`stele.go:91-143`：`Has(src)` 保留按原生 key 的精确判定，只把已经读取的布尔值旁录。每个实际匹配的 `s`，沿用 `ConstructsByType` 的原始 steles/others 顺序、半径比较及现有 `resonanceConstructs` 列表；观察适配器只把列表中的现存对象转换为 ID。每个主柱 tick 和其它造物共鸣带上其实际发出位置对象 ID，并由正在执行的原生任务所属石脊收集。

新的石脊仍会覆盖角色级 `c.steleSnapshot`。记录它的来源 object，允许旧柱任务使用新柱的原生共享快照；task owner 与 snapshot source 独立。共鸣对方造物仅是发出位置，其 E 不取得钟离共鸣伤害所有权。

每条后继任务绑定真实 parent producer 和 native parent task，仍以原生 Tasks.Add(...,120) 排队。终态要求对象实际移除、全链执行完、唯一 Has(src)==false 的终止检查、全部已发出根攻击派发完成。即使柱已移除，最后一个尚待运行的检查也不能被推测为已完成。

原生 key 是帧数，不是 object ID。若旧任务只因其它类型的同 key 造物而继续，或实际选中不同 object／多主柱，原生路径保留，分析器明确 partial。不会臆造一个主柱攻击来“修复”源码行为。

## 静态审阅发现与修正

1. 当 Has(src)==true 时仅凭空 selection/attack 数组可能遗漏整个主柱 tick；现在要求唯一主柱 selection，且该对象必须是所属 object，否则 partial。
2. 仅遍历现存 Albedo listener calls 可能遗漏整个 call 与 trigger；现在核对原生 event emission 清单与 registration/call/object 链及真实零／一分支。

所有新增 Go 文件已由本地 gofmt 格式化，语法解析成功。三份补丁均通过私有 before 树上的 `git apply --check`。这不是编译或运行验证。

## 尚待父任务统一验收

只在父任务集成并开展必要验证时覆盖代表性路径：Albedo 零触发／跨角色触发／重放替换与在途 bloom；Zhongli press、hold_nostele、满柱 hold、C1 双柱、更新共享快照、其它 limited/unlimited 造物共鸣、替换／limit／expiry／Destroy 和移除后仍 pending 的终止任务。127 未运行这些场景，也不声称任一原生结果已经得到验证。
