/goal 指定流浪者四人队：图莱R5自然叠层与命中顺序

本项没有证明新的产品数值缺陷，不修改引擎、WASM、原结果或Golden。新增独立推导适用于本次真实页面按钮在 `5b43d993fb188e2baa8ce1829f011dbea8dbd9d3` 执行的单目标120秒轴；不是复用旧原生运行冒充新运行。新保存文件SHA256 `da061210ea6d43d1554e761f3428c84dfd9cf65be34f1e4f6e25e47ed1ff6d1e`，种子20261022，配置SHA256 `4fed915e08373c9a25cdb28ef7fe0a9c63f36f5cae39808aa2f581c2c4c93059`。完整机器结果见[JSON](wanderer-tulay-timeline-20261023.json)。

从已接受的E、实际执行切人和普通攻击标签的命中时间生成预期，不用原生日志返回的层数作为输入：R5每层9.6%普通攻击伤害，E后每60角色帧加1层，普通攻击伤害后加2层、18帧门限，至多10层，E重新计时、切出清除。获取新层的那一击不能回填新层；C6也按实际普通攻击标签判定。固定轴角色时钟7200，没有停钟；审计明确拒绝尚未证明的同帧未满层双回调先后和动作/命中冲突，不推广到任意轴。

240次普通攻击类伤害（120次原普攻、120次C6追加）与独立层数全部相等；112次其他伤害均未错误套入图莱普通攻击加成。独立产生35次实际叠层记录，帧和数值完全一致。240次命中取样的层数为：1层5次、3层10次、4层5次、6层5次、8层10次、9层10次、10层195次，因而有45次不是满层伤害。

首轮例子：E在F537；F597计时到1层，F638首普攻只吃9.6%，伤害后到3层；F657计时4层，F662命中后6层，F701命中后8层，F717计时9层，F730命中后10层。切人用实际执行的F1322，而非F1314的切换请求。

四个篡改负例全部拒绝：给首击倒灌刚取得的2层、计时延迟1帧、重复命中、给Q塞入96%普通攻击加成。未降低既有数值容差。审计最初遇到反应伤害没有进攻快照的正常`null`，已修正脚本按空快照读取，未改实际捕获。

固定来源为[原始武器实现](https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/weapons/catalyst/tulaytullahsremembrance/tulaytullahsremembrance.go)。对应实际patched执行树为 `/tmp/GIDPS-wanderer-c2-build-20261023/cache/build-ImmxbI/source`，其中武器文件SHA256 `c15c2113a635e8fe64e9d9d0a985349458b7d414dc20d09f7e2aaa929345c271`；实际WASM SHA256 `3e5fc685e2743552b4be8f14533f75794092d88b7236166e0ac38103bed5a53e`。原始pin与修改后源码身份分开，未替换构建输入。

只读复现命令，退出0：

```sh
python3 scripts/wanderer-tulay-timeline-audit.py \
  /tmp/GIDPS-team-closure-20261023/head-5b43-real-ui/run.result.json \
  --source /tmp/GIDPS-wanderer-c2-build-20261023/cache/build-ImmxbI/source \
  --output /tmp/tulay-new-receipt.json --negative-checks
```

命中调度、碰撞和游戏实际帧数不是本独立叠层计算的产物。Q55f、C6取样8f及变化几何继续保留需游戏帧证据的边界，不将本轴源规则一致称作官方游戏验证。
