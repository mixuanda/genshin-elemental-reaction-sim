# 固定来源角色攻击倍率算式

本批把固定 b4／a7 源码中指定的 `AttackInfo.Mult` 运算接入共享公式记录。每项保留原生触发门、输入读取时序和写入方式（set／add）；法尔伽的队伍倍率与命座倍率仍在原位置创建并缓存，攻击消费时关联来源回执。规则、角色、operation、适用lane和具体写点见[注册表](source-character-multiplier-registry-20260928.json)：41个规则描述符、11名角色。规则数量不等于原生写点数量；条件分支会复用写点，缓存helper另计。

实现上，伤害请求用独立的 `multiplierCalculationId` 指向该次角色 Mult 计算，不与 `FlatDmg` 组件混用。set/add 的先前计算 ID 与 `valueSources` 通过来源依赖递归保留，`priorMultiplier` 保存操作前实际数值，捕获可还原原乘区与缓存生产／消费关系。普通伤害、月曜或星辉 direct 伤害只在最终scaling请求具备可精确解析的倍率来源链时挂接该链；不满足来源关系时显式保留解释缺口，不猜测关联。公式计算器可编辑本项参数与prior值并导入导出；这是formula-only实验，不重算之后的伤害或整队轮转。更广的剩余产品缺口见[实施清单](remaining-product-implementation-20260928.json)，该清单不是完成或验证收据。

## 本批实测

经典 b4 最终 WASM 为 43,090,050 bytes，SHA-256 `36b665b3d3c19ae08e81f100d0b9bf165bb3d9170be0755a9a4ce60042489daa`；星辉 a7 为 64,672,670 bytes，SHA-256 `a39b750c5c6c19dea9a8bf0aab228f66ba32bdd5b751c8a69719cfcf8c140dbc`。Web最终构建 3.728 秒、735 modules、Vite 852ms。单个聚合 Playwright 流程通过：墙钟6.017秒、用例4.6秒、runner5.5秒，页面错误数组为空。

页面每个lane各跑一条固定短轮转，均有7次伤害应用；classic做70次公式计算，stellar做71次。两lane实际观察5个规则ID：法尔伽A1倍率缓存、鹿野院平藏战技层数、鹿野院平藏满层追加、法尔伽战技普攻、娜维娅弹片。鹿野院平藏、法尔伽、娜维娅的选定伤害重放差均为0。鹿野院平藏先算倍率4.5504，再加1.1376得到5.688；公式实验把该单项改为5.837999999999999，原始capture不变且JSON恢复一致。法尔伽1.4缓存于frame 0，在frame 278消费；娜维娅本次5片命中倍率为4.737600011765957。

收据和紧凑测量见[验证摘要](validation/source-character-multiplier-measurements-20260928.json)；页面的完整逐次原始记录为[聚合结果](validation/source-character-multiplier-20260928.result.json)。

## 失败记录和范围边界

b4与a7的首次WASM构建均在049补丁应用阶段失败：该patch早于持久overlay文件复制步骤运行，目标 `pkg/enemy/sourcehost.go` 当时尚不存在；将该导出逻辑移入持久 overlay 后两版 retry1 分别6.077秒和6.580秒通过。Web首轮在TypeScript联合类型窄化处失败，retry1通过；首次页面运行进一步发现法尔伽 `consumerSlots` 缺少Physical来源回退，按固定来源的 `Physical -> PhyP19` 接回消费者后，第二次页面运行通过。首次失败及修正均保留在收据中。

E2E只覆盖注册表41条规则中的5条；其余36条没有本批原生页面样本。共享公式记录和单项公式编辑不等于完整角色机制、游戏验证或所有状态的端到端覆盖；数据指针和verified分母未改变。已有 `git diff --check` 收据记录0.057秒通过，只覆盖当时tracked差异，不包含untracked文件。
