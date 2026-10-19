# 固定来源 Go/WASM 机制宿主

2026-09-27：b4新增实际ReactBonus／抗防标量回执（patch004）与共享护盾前玩家入伤（patch005）。另有[独立a7星辉宿主](stellar-overlay/README.md)，其源码身份、AGPL许可和产物与b4分开，命中仍通过共享AST并进入独立计算器。

这是现有 TypeScript 模拟器之外的可选执行宿主。固定 gcsim 源负责动作、角色、装备、附着、队列、资源与回调；同一 Worker 中的 TS AST 同步返回实际使用的伤害。独立计算器与现有模拟器保持可用。

来源固定为 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`，机制状态为 **source-assumed / provisional**。源码注册数量不是游戏验证数量。源码 TODO、角色特有前置算术和未展开的属性转换均不因此变成 verified。

## 同步协议 `gidps-source-host-v1`

WASM 在 `Go.run` 初始化后同步注册：

```ts
gidpsSourceHostRun(
  JSON.stringify({ protocol: 'gidps-source-host-v1', config: gcsl, seed: '1' }),
  (requestJson: string) => JSON.stringify({
    protocol: 'gidps-source-host-v1', id: request.id, value: sharedAstValue
  })
): string
```

`config` 为完整 GCSL；观察时长在其 `options duration=...` 中声明。seed 是 uint64 十进制字符串，不经过 JS 浮点转换。resolver 必须同步，错误可返回 `{protocol,id,error}`；失败停止整场运行并返回 `{protocol,error}`，没有 Go 数值后备。

每条请求都含 `protocol,id,kind,frame,actorIndex,actorKey,ability,attackTag,attackTagName,element,sourceFrame,snapshotFrame,attackId,targetKey,damageCategory,componentIds,componentApplications,snapshotStats,snapshot,rawAttack,input`。数字均为未舍入值。`id` 是本次运行全序列 ID，`attackId` 标识实际排队攻击；同一攻击可命中多个 target。base 请求尚无排队攻击，`attackId/targetKey=0`，取样帧为实际读取帧。该协议不声称已有通用 cast/闭包身份。

- `kind: damage`：源已完成攻击修正与反应处理。input 包含 `scalingStat,scalingValue,scaling,baseDamageBonus,flatDamage,damageBonus,characterLevel,enemyLevel,defenseAdjustment,defenseIgnore,effectiveResistance,critRate,critDamage,isCrit,critRoll,hitWeakPoint,elementalMastery,amped,amplifyingMultiplier,amplifyingReaction,reactionBonus,groupMultiplier,elevation`。defenseAdjustment 使用源的带符号最终值。`damageCategory` 为 ordinary 或 transformative。Go 保持原随机读取位置与 `roll <= CR`；弱点短路时 `critRoll=null`，TS 不再抽样。
- `kind: transformative-base | additive-base`：input 包含 `characterLevel,elementalMastery,reactionBonus,levelBaseDamage,baseMultiplier`。TS 返回已含实际反应系数的抗性前量，Go 实际将该值存入原 FlatDmg 或加到主击。不是事后复算。`snapshot/snapshotStats=null`。
- `kind: lunar-contributor | lunar-ranked | lunar-delivery`：月感电／月结晶反应先按实际参与者快照和Go已经消耗的随机数求各自贡献，再验证来源稳定排序、排名权重与最终交付。TS返回值用于原生回调及实际HP应用；不重新抽样，不把平均贡献先排序。
- `kind: lunar-direct`：直接月感电／月绽放／月结晶读取真实缩放、专属增益／加算、精通、抗性及原生暴击判定，使用共享特殊公式。未解决的DEF条件和未支持普通增伤／增幅字段明确拒绝。
- `kind: lunar-bloom-event`：记录实际月绽放触发，本身不造成月伤；TS返回0，Go继续原草露／草原核状态处理，不凭这个0生成HP伤害应用。
- `componentApplications` 永远是数组，其 `{id,multiplier,amount}` 关联实际使用的TS组件；经典反应组件保留已含系数的返回量及倍率1，月反应排名记录实际权重。`componentIds` 保留本类请求的来源顺序。后续源攻击修正可能改变FlatDmg，不能假定组件一定等于最终FlatDmg，完整性由捕获层记录和说明。
- damage 的 snapshot 包含 `{charLevel,baseAtk,atkPct,flatAtk,baseDef,defPct,flatDef,baseHp,hpPct,flatHp,em,critRate,critDamage}`，有实际来源记录时另带 `statProvenance`；保留固定源完整26项 `snapshotStats`。它是源CR钳制之前的快照；input的CR是实际钳制之后的值。导出不额外调用Stats/ReactBonus。

成功原生结果含 `protocol,sourceCommit,config,seed,calculations,applications,result,logs,capabilities`。calculations 为 `{request,value}`；TS 包装层可附上自己实际执行的 trace。applications 为 `{id,calculationId,attackId,frame,targetKey,rawDamage,appliedDamage,hpBefore,hpAfter,isCrit,damageMode}`，在源实际 HP 处理之后、伤害 callbacks 之前追加。源 duration 模式仍会更新 HP，但统计返回 rawDamage；damage 模式击杀返回剩余 HP 限制的量，二者不可混为同一数字。

## 范围和差异

普通伤害、增幅、激化、经典剧变与三绽放，以及上述六月曜分支接TS；原源保留启用条件、附着、ICD、反应生成、参与者窗口、快照、资源与装备回调。月曜由真实运行态决定，不再一概拒绝其activation/tag；未支持字段仍明确停止，不静默使用原Go特殊公式。Stellar通过独立a7宿主执行。本b4路径的玩家受击已调用共享AST，结果能力字段为 `playerIncomingDamageSharedFormula:true`；Go继续原护盾与Drain，回执保留实际护盾前／后伤害和Drain返回量。

`stat-provenance-v1` 保存原 `Stats/Stat/NonExtraStat/SelectStat` 调用的基础向量、modifier返回量、顺序、筛选／到期分支和实际累计值，并把真正snapshot与AttackMod前后差值随请求传递。记录不重复调用getter、`Amount()`或RNG；普通伤害、直接月伤、月反应贡献者及排名的trace接入同一TS逐项加法解释，完整结果JSON重算也核对累计值与最终快照。直接修改只标实际前后差值，不反推闭包公式。

该记录不完成任意Go闭包内部公式、跨角色读取关联、私有状态及完整触发历史；基础向量也可能含用户提供的装备合计，不能虚构圣遗物分件来源。解释保持partial。独立编辑最终面板／贡献者属性后，原provenance作为历史证据保留；复用原生随机数只表示反事实计算，不等于重新执行Go被动与生命周期。

共享 TS 抗性公式在 75% 使用高抗分支；固定 Go 源有 `> 0.75` 边界分歧。本宿主以 TS 实际返回值为准，因此是有记录的来源修订，不能称与未修改 gcsim 数值完全一致。负值等当前共享公式不能保真处理的输入由 TS resolver 明确拒绝。

网页Worker记录实际加载WASM字节的SHA-256及大小，并随完整结果、单击捕获和独立编辑文档保存；旧记录缺少该身份时页面明确显示未保存。

完整捕获支持逐击数值重放、完整脚本与 seed 从头再运行。源任务、订阅及角色内部使用函数闭包，**不支持任意帧 JSON 恢复，也不据此声称建立稳态**。完整属性转换/任意装备回调的解释仍是 partial，而不是根据最终标量猜一条推导。

## 构建

见 [构建脚本说明](scripts/README.md)。新检出运行 `npm run source:build` 会准备固定提交的源码与工具链，不再依赖之前任务的临时源码目录。`npm run source:prepare` 可单独准备并核验源码。仓库内保留完整固定 Git tree，逐一校验 4,021 个 blob，创建独立副本，应用 patches 并复制 go/，仅构建一次。显式 `--source-dir` 输入仍支持；审计原件不被修改，Go 工具链安装在缓存目录，不修改全局安装。

纯计算 runner 保留上游 MIT、Go BSD 及实际链接依赖许可；不包含原 UI 的游戏图片或字体资源。产物及哈希在 dist/manifest.json，Web 使用 public/source-host/ 的同一产物。

构建同时从原始注册、catalog和parser生成 `inventory-metadata.json`，与WASM在同一暂存manifest中登记。正常来源页可搜索117角色／231武器／53套装共401包，显示固定源码、实际GCSL键和明确TODO；目录名不是配置键，metadata与manifest身份不符时不补猜。当前401键是来源链解析结果，429独立TODO位置／493按包展开项是静态标记，不是游戏验证或完整缺陷数。

2026-09-25本批WASM构建与类型／生产构建各经一次定点修复后通过；唯一新增正常页面首轮通过，60秒实际172击／261计算，全部六月曜分支出现，独立回放差0、编辑与完整JSON恢复一致。实际加载WASM为41,554,594字节、SHA256 `70c4f7c8087a1889b8a22f54d0911f7510a786c3b0fa98eefd4fe4fe33926f8f`；6个链接依赖许可证齐全。该单次保存输入域不替代所有角色机制验证，原失败、测量与当前边界见[本批报告](../../docs/source-host-lunar-provenance-20260925.zh-CN.md)。
