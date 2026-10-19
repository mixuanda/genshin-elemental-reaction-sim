# 夏洛蒂 C2 长按 E：一次固定来源外部实测

2026-09-24（香港）。仅调用既有外部 gcsim **1 次**，首次 exit 0，耗时 **0.01998474996071309 秒**。没有安装依赖、重建外部程序、修改生产代码或运行本地引擎。本样本实测确认：**长 E 初击不含 C2；前七次印记含单目标 10% 基础 ATK 加成；第八次印记恰在 C2 属性增益到期帧，已经不含加成。**

## 原始记录与运行条件

- [原始配置](charlotte-c2/hold-reference.gcsl)、[原始统计](charlotte-c2/hold-reference.result.json)、[原始 sample](charlotte-c2/hold-reference.sample.json)
- [命令、时间、exit、stdout/stderr、二进制及原始文件哈希](charlotte-c2/hold-reference.execution.json)
- [派生逐击参考 JSON：完整快照、未舍入 calc、状态、实际帧](charlotte-c2/hold-reference.reference.json)
- [18 个固定源码文件的 SHA256 清单](charlotte-c2/fixed-source.manifest.json)、[离线源码档（含 LICENSE）](charlotte-c2/fixed-source.json.gz)
- [提取脚本](charlotte-c2/extract-reference.py)：只读取已保存 JSON，不运行模拟器。

实际命令，cwd 为 `/Users/evan/Documents/gidps`：

```sh
/var/folders/3k/lmzjz_h51dn_5rdqvwffprph0000gn/T/gidps-gcsim-b4ae769-03yjl36g/gcsim_darwin_arm64 \
  -c docs/cross-validation/charlotte-c2/hold-reference.gcsl \
  -out docs/cross-validation/charlotte-c2/hold-reference.result.json \
  -sample docs/cross-validation/charlotte-c2/hold-reference.sample.json
```

输出 revision 为 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，`modified=false`。二进制 SHA256 为 `2332566a3c06ab1b50003024b1838ee3565d2969bd4a004a35a60f482cbc8449`。

| 原始文件 | SHA256 |
| --- | --- |
| config | `9740495e6ef5febebd8b8c735cd3b6bc3ff45f27a78d61db5af4326e2799fd34` |
| result | `5cd6669445c34fbcaec61f74ceb74963247f0090a4adec3664e043e410eab0bb` |
| sample | `f129b67dc69c4da7bf24256c9f3ea22d10a970b33939ac62a99838d8402aef74` |

夏洛蒂 **C2、Lv1/20、突破 0、天赋 1/1/1**；武器为二星口袋魔导书 `pocketgrimoire`，R1、Lv1/20，无副属性或被动。没有圣遗物或其他 ATK 增益，仅 `cr=-0.05` 抵消来源自动加入的基础 5% 暴击率。单个静止目标等级 90、各抗性 0.1、位置 (0,2)、半径 2。施放一次 `charlotte skill[hold=1]`，等待至 900 帧，观察窗口 15 秒。

配置明确 `hitlag=false`；固定 parser 将该值传至 `Settings.EnableHitlag`，simulation 再传入 core/combat 的卡肉门。result 的 protobuf false 字段按 `omitempty` 省略，sample 没有 `hitlag applied` 事件，提取 JSON 同时保留这几项证据。不是只在场景名称写“无卡肉”。

统计迭代 seed 为 `849260828163134525`，debug sample seed 为 `10792908797103459196`。两者是一次 CLI 生成的两个执行，不宣称相同 seed；所选伤害 CR=0，没有随机暴击差异。下面逐击来自 sample，总均值直接读取原始 result。

## 实际时序、快照与数值

外部全局起手帧为 **1**。`hold=1` 的实际命中偏移为 `1+111=112`，故初击在 **113**；源码注释中 `hold=1 gives 111f` 与实际加法相差一帧，记录以执行代码和 sample 为准。

| 组件 | 快照帧 | 伤害帧 | 基础 ATK（含武器） | ATK% | 实际 ATK | 倍率 | 伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 长 E 初击 | 1 | 113 | 47.44352 | 0 | 47.44352 | 1.392 | 20.629420712907212 |
| 印记 1 | 203 | 203 | 47.44352 | 0.1 | 52.187872000000006 | 0.406 | 6.618605812057733 |
| 印记 2 | 293 | 293 | 47.44352 | 0.1 | 52.187872000000006 | 0.406 | 6.618605812057733 |
| 印记 3 | 383 | 383 | 47.44352 | 0.1 | 52.187872000000006 | 0.406 | 6.618605812057733 |
| 印记 4 | 473 | 473 | 47.44352 | 0.1 | 52.187872000000006 | 0.406 | 6.618605812057733 |
| 印记 5 | 563 | 563 | 47.44352 | 0.1 | 52.187872000000006 | 0.406 | 6.618605812057733 |
| 印记 6 | 653 | 653 | 47.44352 | 0.1 | 52.187872000000006 | 0.406 | 6.618605812057733 |
| 印记 7 | 743 | 743 | 47.44352 | 0.1 | 52.187872000000006 | 0.406 | 6.618605812057733 |
| 印记 8 | 833 | 833 | 47.44352 | 0 | 47.44352 | 0.406 | 6.016914374597937 |

每个伤害都是冰元素、战技标签；CR=0、CD=0.5，通用／冰伤加成均为 0，无反应、减防或无视防御。首击使用施放时快照，印记在每次伤害时重新快照。sample 的前七个印记 snapshot 明确含 `charlotte-c2: [status: added, expiry_frame: 833, atk%: 0.10]`；第八个 snapshot 已无该字段，未舍入 calc 的 `atk_per` 也回到 0。

伤害乘区及代入为：

```text
M_DEF = (1+100) / [(1+100)+(90+100)] = 101/291 = 0.3470790378006873
M_RES = 1 - 0.1 = 0.9
ATK = 基础 ATK × (1 + ATK%) + 固定 ATK

初击：47.44352 × 1.392 × (101/291) × 0.9
    = 20.629420712907212
前七印记：47.44352 × (1+0.1) = 52.187872000000006 ATK
          52.187872000000006 × 0.406 × (101/291) × 0.9
        = 6.618605812057733／次
第八印记：47.44352 × 0.406 × (101/291) × 0.9
        = 6.016914374597937
```

C2 在此单目标输入下增加的是 **0.1×基础 ATK**，即 4.744352；不能一般化为所有配装的最终 ATK 乘 1.1。本例没有其他 ATK% 或固定 ATK，才恰好等效。按原始未舍入 calc 字段逐击复算，9 击最大算术绝对残差为 **0**；这只是算术复核，未执行本地 runtime 对照。

原始总伤害 mean 为 **72.97657577190927**。一初击加八印记均实际发生，第八次并未因印记到期而消失。

## 到期与回调顺序的来源依据

1. [skill.go:100–131](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/charlotte/skill.go#L100-L131)：长按参数的实际加法；`QueueAttack` 的 snapshot delay=0，回调注册顺序为**产球 → 添加印记 → C2**。
2. [enemy/attack.go:60–76](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/attack.go#L60-L76)：先计算并应用伤害，再按数组顺序调用攻击回调。C2 在初击结算后发生，不追溯修改其初始快照。
3. [cons.go:58–80](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/charlotte/cons.go#L58-L80)：命中敌人后计数，`ATKP=0.1×c2Hits`，最多三目标；`charlotte-c2` 是时长 `12×60` 的 **StatMod**。单目标本次实际添加于 **113**，expiry=**833**。印记没有挂这个回调，所以不会每跳刷新 C2。
4. [skill.go:179–199](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/charlotte/skill.go#L179-L199)：长按印记自身时长 `720+0.9×60=774`，实际 expiry=**887**，首次任务延迟 90 帧。
5. [skill.go:225–246](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/charlotte/skill.go#L225-L246)：每次有效印记以 `QueueAttack(..., 0, 0)` 当场重新快照、结算，再排 90 帧后的下一跳。
6. [character/stats.go:24–41](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/character/stats.go#L24-L41)：属性快照在 `StatMod.Expiry() <= 当前帧` 时排除该增益。因此第八跳 **833** 仍有印记、却已无 C2。这个谓词与一般 `StatusIsActive` 的严格 `<` 不同，不能混用武器冷却的到期语义。

初始伤害系数 1.392 与印记系数 0.406 来自固定 [zz_charlotte.dm.go:198–252](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/charlotte/zz_charlotte.dm.go#L198-L252)。[口袋魔导书实现](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/catalyst/pocket/pocket.go#L10-L13) 使用 `NewNoEffect()`；[A1/A4](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/charlotte/asc.go#L13-L43) 在突破 0 均锁定。C1 虽已解锁，但单独 E 无对应治疗事件；C4/C6 未解锁，C5 的战技等级提升也不适用。

## 本次边界

这是一名 C2 夏洛蒂、一次最短 `hold=1`、单目标、无其他增益与卡肉的固定来源对照。未执行多目标获得 20%／30% ATK、其他长按时长、重复 E 刷新、卡肉延长、外部增益变化、C4/C6 或当前游戏实机验证。源码明确注释长按命中盒为近似；本次固定目标确实被击中，不据此认证完整几何范围。没有失败的外部尝试，没有把本次样本扩大为全角色完成声明。
