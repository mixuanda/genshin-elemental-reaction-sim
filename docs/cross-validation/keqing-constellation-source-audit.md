# 刻晴 Q：C4／C6 逐击条件的来源审计

本记录只确认固定实现中的属性、类别与快照时序，供独立技能计算器接入逐击条件使用；不把源码阅读称为游戏服务器验证，也不推断本次输入未提供的反应历史。

来源固定为 `genshinsim/gcsim@b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。新归档包含 **14 个原始文件**：MIT `LICENSE`、刻晴的 `asc/attack/burst/charge/cons/keqing/skill.go`、角色快照模板、核心攻击队列、角色属性／修饰符／卡肉处理、通用修饰符。2026-09-24 02:23:09 香港时间，逐个读取固定 commit 的 raw URL，与实际审读的本地字节比较，**14／14 相同，差异 0**。这项检查只确认来源字节一致性。

- [完整来源清单及逐文件 SHA-256](../../packages/game-data/sources/keqing-constellation/manifest.json)
- [不可变 JSON gzip 归档](../../packages/game-data/sources/keqing-constellation/source.json.gz)：43,191 字节原始文件内容，10,694 字节压缩归档；归档 SHA-256 为 `9cb8ad811199c9f27a9d2977f7dd9ee8b4fe6471b8b7557d581016228f843b98`。

## C6 类别与本次 Q

[初始化](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/keqing/keqing.go)设定每个 C6 类别 **6% 雷元素伤害加成**。[命座函数](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/keqing/cons.go)使用 `keqing-c6-<类别>` 独立键、480 帧持续时间；普通攻击、重击、E 初次施放与 Q 分别调用 `attack`、`charge`、`skill`、`burst`。固定源的 E 重放没有再次调用 `c6("skill")`，不能额外假设重放刷新。

[通用修饰符](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/modifier/modifier.go)按相同 key 替换，角色 `AddStatMod` 先把过期时间设为当前帧加持续帧数。因此同类再次触发是替换并刷新，不能把旧 Q 类别与本次 Q 类别算作两层；四个不同类别同时有效时共 24% 雷伤。

[Q 源码](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/keqing/burst.go)先注册十击，随后在本次施放函数内同步调用 `c6("burst")`。[QueueAttack](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/attack.go)对正的 `snapshotDelay` 只注册将来执行的快照任务，不在排队时立即冻结面板。故本次 Q 自己的 burst 类别在首击快照之前已刷新，十击均可读取此 6%。

实际快照／命中帧为 **56、82、93、104、115、126、137、148、159、197**。八连击循环是 `82 ≤ i < 162`、步长 11；源码注释的 162 是上界，不是最后一次实际连续斩击。56–197 帧均小于本次刷新后的 480 帧，未受额外状态删除影响时无需用户另填本 Q 类别。其他三个类别可能在 Q 中途到期，必须各击明确输入其有效状态，不能把施放起始层数复制成全段事实。

角色属性读取会排除 `Expiry <= 当前帧` 的修饰符，因此到期帧本身不再计入属性。C4／C6 均标记为受卡肉影响；归档的 `ApplyHitlag` 会延长尚有效的此类修饰符。480／600 帧是固定实现的基础持续时间，不能据此声称所有实战墙钟到期时间已经重现。

## C4 与输入边界

固定命座实现设定 **25% ATK、600 帧**，使用一个 `keqing-c4` 键；只有事件中的攻击者是刻晴才添加属性。它订阅超载、感电、月感电、超导、雷扩散、雷结晶、原激化、超激化、超绽放；除超绽放直接使用回调外，其余回调还要求事件首个参数是敌人。重复符合事件刷新同一加攻状态，不叠加多个 25%。这是攻击百分比属性，不能误作伤害加成区或总攻击力乘 1.25。

本审计没有补齐目标附着、ICD、反应事件前后顺序和已有反应历史，也没有执行外部整队模拟。因此不能从某击选择了反应，直接断言该击快照时 C4 已生效；计算器须接收各击实际状态及面板已含份额，并对缺少这些条件的输入保留限制。上述来源继续标为 `source-backed-provisional`，不提升当前发布数据的正式验证状态。

本子任务未运行单元测试、数据状态生成、构建、浏览器或性能检查；接线与必要验证由相应实现报告记录。
