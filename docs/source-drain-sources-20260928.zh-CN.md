# 固定来源 Drain 公式与扣血捕获

固定源码接线、两版原生构建、Web build 与限定页面 E2E 已通过；范围仍是有限来源场景，并不表示游戏机制已验证。

本轮为固定 gcsim b4 与 a7 来源中的 `DrainInfo.Amount` 及相关伤害/状态字段建立共享公式和独立算术编辑器。核心实现位于 [Drain source registry](../packages/sim-core/src/source-host-drain-source-formula.ts)、A/B 两组及 Dehya 专项公式；原生桥接与接线由 `067`–`070` patches 完成。完整静态清点见 [Drain registry](source-drain-source-registry-20260928.json)。

静态扫描记录每个 lane 19 个 Drain 规则与 19 个 Go 调用点，覆盖 13 个角色，其中 Dehya 占 6 条规则；另有 2 个角色 FlatDmg 规则接入 4 个 Dendro self-hit 调用点，这些不计入 19 条 Drain 规则。静态计数代表调用位置和规则 ID，不代表运行频次或完整角色机制支持。普通 Dendro 核心先保留原敌方命中，再记录玩家自伤的 `FlatDmg × 0.02`；Nilou 丰穰之核沿同一伤害顺序接入独立 FlatDmg 规则。

普通 incoming Drain 路径保留真实伤害来源 ID 到玩家扣血应用；静态审计覆盖了 14 个手写 `DrainInfo` literal、avatar 转发及 Dehya 手工路径，未发现来源 ID 漏接。Dehya 的手动受击路径依次保留转移量、赤鬃之血累积、减伤后 Drain amount、周期原始自伤、扣池以及 A1 折减；原生条件、队列、无敌帧和护盾仍决定实际是否发生。编辑器可从实际捕获的 Drain 应用及其前置来源构造独立算术草稿，编辑只重算保存状态上的公式，不写回游戏状态，也不重跑后续角色事件。

Dehya 直接角色受击的固定源码仍有 workaround/TODO 边界；本轮只记录源码路径与实际来源 ID，不据此判定其游戏表现正确。Furina 等规则读取的当前 HP/最大 HP 保持源码实际读取时点；来源规则、阈值和事件次序仍受原生门控控制。历史 `CurrentHP` 读数及上游伤害来源不完整的路径不会因公式可编辑而自动补成完整状态历史。角色条目数或静态 formula ID 数不能当成全角色机制完成。

## 本轮验证结果与边界

- classic 与 stellar 的 `source:build` 首轮均因 `070` helper 方法签名未与 Dehya 调用同步而失败；这是接线签名不一致，不是新公式算术失败。同步方法后，两版 retry1 均通过，收据分别为 [classic](validation/source-drain-sources-classicretry1-20260928.json)（4.049 秒）和 [stellar](validation/source-drain-sources-stellarretry1-20260928.json)（4.426 秒）。
- Web 首轮因 `source-host-drain-source-formula.ts` 中换行导致 TS1434 语法错误；retry1 再发现 `source-host-capture` 与 Drain capture 两处分支联合类型访问错误。随后 [webretry2](validation/source-drain-sources-webretry2-20260928.json) 通过：3.978 秒、769 modules、Vite 876 ms。
- [E2E](validation/source-drain-sources-e2efirst-20260928.json) 通过：20.704 秒墙钟、19.1 秒用例、20.2 秒 runner。两版各三个场景，共六次原生运行产生 55 个 Drain 应用（classic 27、stellar 28），所有 capture/replay 的最大差值均为 0。每 lane 有 9/19 个 character-drain 规则 ID 在原生场景出现；其中 Dehya A1 未观察。FlatDmg 侧只观察到 Nilou 丰穰之核规则，普通 Dendro core 规则未观察；不能把公式调用次数当成命中次数。

Dehya 场景每 lane 记录六次手工自伤与六次扣池，另有一次转移、池累积及减伤后 Drain 更新；一笔外伤由盾实际吸收 3,230.76948324，盾后剩余 3,269.23051676。首个观测到的手工自伤位于 frame 127，应用保留实际离场身份。Nilou 侧每 lane 实际产生 6 次 FlatDmg 公式调用，但只有 classic 1 次、stellar 2 次 Drain 自伤应用。普通场景中 Kuki 的生命比例到达 0.2 门槛，原生 receipt 记录当前 HP、MaxHP 和扣血值。胡桃来源 CurrentHP 从 18552.3066196 改为 18652.3066196 后，请求扣血由 5565.69198588 变为 5595.69198588；保存的结算 HP 上下文不变，写回比例由 0.7000000000000001 变为 0.6983829503999085。导出再导入恢复一致，原始捕获保持不变；相关实测可从[汇总结果](validation/source-drain-sources-measurements-20260928.result.json)、[原生场景记录](validation/source-drain-sources-classic-ordinary-20260928.result.json)和[页面编辑结果](validation/source-drain-sources-calculator-20260928.result.json)查看。

E2E 后仅将 source-host 面板文案从“没有玩家生命前后回执”改为引用新 Drain 记录中的扣血前 HP 与写回比例；随后 Vite bundle 单独通过 1.162 秒／885 ms、769 modules（[收据](validation/source-drain-sources-webcopy-20260928.json)）。这次纯文案构建没有重跑类型检查或 E2E，故页面测量反映文案更改之前的同一逻辑版本。

尚未由本轮页面验证的具体运行路径、固定源码 TODO、其他角色受击/扣血行为与更广泛事件历史仍属未完成范围。本轮 static registry 与限定场景重放不构成游戏验证，也不表示角色相关机制已全覆盖。

完整命令、失败收据、最终 WASM 身份、页面原始文件哈希与未观察规则见[测量摘要](validation/source-drain-sources-measurements-20260928.json)。正式／预览／verified 数据指针与上一批一致。其余动作覆盖、原生稳态闭合及外部版本／更新证据仍按[剩余清单](remaining-product-implementation-20260928.json)继续推进，最终 goal 保持 active。

收尾 `git diff --check` 通过（0.081 秒，仅 tracked 差异，不覆盖 untracked 文件）；没有追加核心测试或全量历史测试。
