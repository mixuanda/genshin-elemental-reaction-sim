# 同轴合法充能装备对照

候选只执行一次真实120秒：伊安珊与凯亚均完成6/6次Q；246击、总伤害798971.2144022143，DPS6658.093453351786。基线8b7b1a8的原文件未改，离线复核仍为208击/七次缺能跳Q。只改变已冻结的西风R5与逐件合法圣遗物；动作、角色/命座/基础天赋、seed20261023、目标、满能一次及其余request字段完全相同。额外Q会改变实际动作/RNG顺序，不能把DPS差单独归因于充能。

- 构建来源提交 `e49f9d353bf85b7a2d3e0bf8e66cf5befd400896`；request SHA256 `e9a3524c097cf110faad849a444680d27a032d633299a27f07bd0faa0cbb1413`。四份装备/验证/request/GCSL均锁字节与哈希，并重新执行合法配装解析和真实artifact-only导出。候选可选入口为 `GIDPS_IANSAN_120_CANDIDATE_REQUEST`；未设时保留原基线stats/set禁令，不接受任意外部stats。
- 官方WASM仍为 `237dd6b0c2ef45988a93f15fe1d2b7226c9a2b3ff8d1228b7a331fac9db1873c`。665次native basePanel读值独立核对：ER253.7068198% / 280.5331802%，两人raw CR100.28%→实际本击上限100%；角色突破、武器和五件词条各计一次。GO固定表用Decimal逐档重算，a7原始武器/等级曲线另算，未从实际回能金额反推系数。
- 130笔能量写、88个粒子公式、36次E/Q冷却复核通过。伊安珊70+420实际获得−420消耗=70；凯亚60+360−360=60。C1六次固定15共90全部实际保留，不乘ER。21次西风（伊安珊6、凯亚15）均连真实正伤暴击、本人前台、实际含卡肉CD、OnEnemyDamage listener、粒子task与两人实际写账。
- 六个Q前的原生phase私有字段 `pointsOverflow/c4Stacks/burstRestoreNS`均可见为0；到实际Q起手之间无夜魂资源变动。此结论只限定本无movement轴，未解决一般跨标示溢出返还规则。
- F207 Swift手算：基础ATK821.78432472；自身A1后的非额外ATK2347.4111580969043；F201 Q加攻633.8010126861642；最终ATK2981.2121707830684×1.6643×1.25×.5×.9×1.5=4186.376507110157，实际4186.376507110156（binary64差约9e−13）。Q有效13只加一次C5，Swift仍普攻10。

真实native已完整保存后，最初后处理在JSON.stringify整个回调数组时触发V8字符串上限，原失败日志完整保留。没有再次调用引擎；仅对同一份native逐式重放，闭合实际值并恢复result。572MB解释记录为 `run.formula-replay.ndjson`，明确标记为离线同请求重放，必须按行流式读取。原始native保留全部实际请求与数值。保存器现分条写实际回调，文件哈希也按流计算。

验收：候选前测/流式保存6/6；候选离线边界4/4；原9个基线断言保留，加暴击边界后10/10；离线恢复1/1。`critRoll <= critRate`修正遵循既有source-host-formula/source-host-capture及固定a7 enemy/damage.go契约，不是为CR1放宽；5%阈值下、相等、略上方及伪造略上方暴击负例均保留。未跑全回归或新的baseline模拟。

可导入结果：`/tmp/GIDPS-iansan-120-evidence-20261023/legal-recharge/run.result.json`；完整原始native、输入、锁、恢复日志、流式trace和独立账在同目录及父目录。精简哈希/数值索引见 [`iansan-120-kinich-recharge-20261023.json`](iansan-120-kinich-recharge-20261023.json)。同seed此120秒全Q不等于多seed稳定或稳态证明；非玩家库存/最优配装。未改公共引擎、UI、旧结果、Golden或生产。
