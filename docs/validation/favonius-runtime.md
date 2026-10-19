# 西风暴击触发回能：条件参考实现

本增量在主团队模拟器的实际普通命中回调中接入西风武器。它不是独立的能量估算器：触发产物进入原有微粒队列、拾取与全队充能分配，并影响后续合法轮转的能量检查。来源状态为 `fixed-source-assumed`，不标作服务器实测或完整武器验证。

## 来源与适用范围

固定 gcsim 提交 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 的[共用西风实现](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/common/favonius.go)适用于剑、大剑、长柄、弓、法器五个注册入口。12 份原始文件及 SHA-256 保存在 [source-manifest.json](../cross-validation/favonius/source-manifest.json)，包括角色默认微粒延迟、微粒分配和角色卡肉状态延长代码。

- 持有者自己的实际敌人命中，实际伤害非零、实际暴击、持有者当时在场，且角色独立冷却结束，才抽样。
- 精炼等级为 `R`，触发概率 `p = 0.5 + 0.1 R`，冷却 `CD = 810 − 90 R` 帧。源码判断 `roll > p` 才失败，因此成功为 `roll ≤ p`；精炼 5 仍消耗一次随机数。
- 成功产生 3 个无元素微粒。拾取延迟来自显式 `particleDelayFrames`；来源角色默认值为 100 帧，不能采用武器代码 TODO 中旧有的 80 帧。
- **角色卡肉边界：** 来源 `AddStatus(..., true)` 让西风冷却受到角色卡肉延长。当前宿主没有角色卡肉时钟；此参考配置明确采用 `global-frame-assumes-no-character-hitlag`。目标卡肉不等同于角色卡肉，本增量没有虚构二者换算。
- 普通直接伤害采用真正的二元暴击结果。平均伤害模式被拒绝，支持随机暴击、全部暴击、全部不暴击；插件若把实际命中改成平均暴击也被拒绝。特殊月曜／星辉宿主尚未接入，配置组合被明确拒绝。
- 标准剧变伤害本来不能暴击，不生成西风尝试日志；日志覆盖配置持有者每次落地的普通直接伤害，包括零伤害、非暴击、后台与冷却中回调。

## 接口与结果

```ts
config.favoniusModel = {
  mode: "fixed-source-independent-stream-v1",
  actors: [{
    actorId: "a",
    weaponId: "favoniussword", // 其余为 favoniusgreatsword / favoniuslance / favoniuswarbow / favoniuscodex
    refinement: 5,
    particleDelayFrames: 100,
  }],
};
```

字段为显式装备声明，不按角色或显示名称猜测资格，也不自动重建武器基础面板。该配置仅为当前 1.53 可选扩展，未配置输入保持旧行为，旧版不能静默接受新增字段。

`favoniusLog` 记录每次回调的实际命中 ID、当时站场角色、二元暴击、伤害、触发条件、概率、抽样值和序号、冷却前后边界，以及成功产球的 `particleEventId`。`particleEvents` 保存生成与拾取帧；`energyLog` 保存每位角色实际拾取收益、充能效率、上限截断及溢出。事件源串为 `favonius:<weaponId>`，粒子实例为 `favonius:<actorId>:<damageEventId>`。

随机流为 `seed + "\0favonius-v1"` 的现有 FNV-1a32 / Mulberry32。它与暴击流、普攻回能流分离；gcsim 使用共享流，因此不宣称相同 seed 与 gcsim 拥有相同随机序列。开启此功能时强制保留实际命中审计，供完整上下文计算器重现及结果完整性检查。

配置、完整命中来源、执行动作、站场角色、实际暴击、每次随机抽样与角色冷却在 schemas 中重放。成功产物进入现有粒子来源与能量验证，不能仅靠一条伪造的触发日志获得能量。

随机预热导出携带 `randomness.favoniusPolicy`。同一连续轨迹保留随机流和冷却；有限窗口不重置二者。完整周期检查点尚未导出西风私有状态，因此明确拒绝据此证明确定性稳态。

## 聚焦验证

仅运行新增 `packages/sim-core/src/__tests__/favonius-runtime.test.ts` 的 3 个场景；不运行旧全集、性能测试或大型 Monte Carlo。实际命令、首次失败及针对失败场景的修复验证记录见本节后续结果。

首次命令：`npx vitest run packages/sim-core/src/__tests__/favonius-runtime.test.ts`。2026-09-24 00:53:12 HKT，2 通过、1 失败，Vitest 873 ms（测试 78 ms），退出 1。[原始日志](favonius-runtime-core.log) · [退出码](favonius-runtime-core.exit)。失败为另一条既有粒子来源验证仍将预期数量算作 0，拒绝新产生的 2 组西风微粒；运行时资格、R5 抽样及非暴击场景首遍通过。

修复后仅重跑失败场景：`npx vitest run packages/sim-core/src/__tests__/favonius-runtime.test.ts -t 'feeds real seeded critical callbacks'`。00:56:53 HKT，1 通过、2 跳过，905 ms（测试 123 ms），退出 0。[原始日志](favonius-runtime-core-energy-fix.log) · [退出码](favonius-runtime-core-energy-fix.exit)。修复补足独立粒子来源校验中的预期产物，没有放宽数量约束或直接相信触发日志。

实际合成场景为两人队伍、精炼 5、零起步、10 帧明确拾取延迟及随机暴击；面板 CR 为 0，每段额外 CR 分别为 0、1、1，冷却边界再命中一段 CR 1：

| 帧 | 观察结果 |
| --- | --- |
| 0 | 非暴击，不消耗西风随机数 |
| 1 | 暴击，抽样序号 0，触发；冷却到 361 帧 |
| 2 | 暴击但冷却中，不抽样 |
| 5 | 爆发请求因 0 / 6 能量被拒绝 |
| 11 | 3 个无元素微粒拾取；站场 A 得 6 能量，后台 B 得 4.8 |
| 12 | 爆发合法执行，A 消耗 6 能量 |
| 361 | 冷却边界暴击，抽样序号 1，再次触发 |
| 371 | 再次拾取；A 得 6，B 得 4.8 |

最终 A 粒子所得 12、消耗 6、剩余 6；B 所得及剩余 9.6。场景的 4 次实际命中均用捕获的完整输入回到共享公式核心，结果逐一相同。JSON 往返通过当前结果验证；篡改实际随机数被拒绝。相位检查点保留“西风私有状态未导出”的阻塞，不误报稳态。

另一个小型运行时场景覆盖零伤害、非暴击、后台门槛、每角色独立冷却、精炼 1 的概率失败，以及精炼 5 确实抽样。固定种子 `favonius-gates` 的前 3 次西风流抽样为 `0.2852213536389172`、`0.8333827441092581`、`0.9273596082348377`。精炼 1 的第一次成功在 720 帧到期；边界再次抽样失败，冷却不延长。

本轮没有运行外部 gcsim 可执行交叉对照，没有测量性能，也没有证明角色卡肉情况下的冷却等价。浏览器与统一构建由主任务记录，不在本文件假称已经执行。
