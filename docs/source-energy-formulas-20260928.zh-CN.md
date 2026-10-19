# 固定来源角色能量公式（2026-09-28）

## 实现范围

本轮通过通用 character-energy 公式族接入固定 b4／a7 Go 来源的四种角色能量操作：consume、flat-change、particle-amount、particle-apply。Go 保留调用者选择的角色、来源、时间点、事件条件及粒子分配；共享 AST 只按原生回调本次读到的数值计算结果。

公式分别保留原生边界：消耗为 max(energyBefore - amount, 0)，不应用能量上限或 ER；普通加减先按上限截断，再限制不低于0；粒子金额先依据元素判定每颗粒子3／2／1点，再乘前后台分配系数、实际 ER 和粒子数；粒子入账只按能量上限截断，不额外加下限。非粒子操作不乘 ER。

粒子金额使用原生单次 ER getter 的结果，并捕获对应 statRead 及其中实际消耗的圣遗物公式。来源没有对应加能操作时，不创建虚构的粒子金额或应用记录。energyApplications 记录真正赋值后的操作类型、操作前／后能量、上限、请求量、actor、source、frame 及前置金额计算 ID；单独的 particle-amount 是中间公式，不作为已入账应用。

四个固定装备事件值作为只读条款使用，不错误套用 ER：流放者四件 +2，学士四件 +3，烬城勇者绘卷二件 +6，追忆之注连四件 −15。原生触发条件与受能角色仍由 Go 决定。

## 独立捕获与编辑

source-host-energy-capture.ts 按实际 energyApplications 关联终端公式、粒子金额前置项和实际被消费的圣遗物支持公式，核对 operation／actor／source／frame、请求前能量／上限和实际赋值结果，并对捕获进行公式重放。编辑器允许修改操作前能量、能量上限、非固定操作金额；粒子操作还可编辑本次粒子数、已读取 ER、前后台状态和队伍人数。粒子元素和受能角色元素保留捕获值；固定装备数值只读。

独立页通过 JSON 导出和恢复计算；公式实验不会覆盖原捕获及原始 Go statRead，也不会重新执行事件、冷却、粒子生成、受能对象选择或属性 getter。正向请求的溢出、实际变化和能量边界会单独展示。完整来源重执行的字段比较器已加入 energyApplications，但本轮没有新做从头完整重执行，不据此声称完整复跑通过。

主要实现位于 packages/source-host/patches/020-character-energy.patch、packages/source-host/go/pkg/core/sourcehost/energy.go、packages/sim-core/src/source-host-energy-formula.ts、source-host-energy-capture.ts 和 apps/web/src/source-host-energy-calculator.ts。source-host-wire.ts 保存应用 schema，来源执行器导出原生应用清单。

## 固定来源 NoElement 差异

b4 的 NoElement.String() 是空字符串，a7 则是 "none"。原生 ReceiveParticle 先判断粒子元素是否与角色元素相同，再处理无元素分支；无元素颗粒的单颗基础值为2，同元素为3，其他异元素为1。首次页面聚合虽然 exit 0，但对照原生 enum 后发现旧 TS 将 a7 的 "none" 当成普通异元素，错误得到1。因此该结果不作为正确性验收。

首轮 E2E 耗时5.205秒，原始回执已另存为 source-energy-formulas-initial-*。公式现按固定 source commit 识别 NoElement，保留分支次序，并新增真实 Favonius 粒子基础值2的断言。修正后 retry1 通过（墙钟5.165秒，单用例3.8秒、runner4.7秒，errors 空）。

## 当前验证及边界

b4 WASM 构建通过，耗时5.655秒，SHA-256 33322624a69d87e0082e6fb555a0ec8057e49d1ad8e567d59067dde94f16bec1，42,177,680 bytes。a7 通过，耗时6.092秒，SHA-256 0565b6ad8f4485e80aa1dd3c4821273c7253ce0a2a49f944a92e2816681f7b21，62,766,449 bytes。收据见 docs/validation/source-energy-formulas-classic-build-20260928.json、source-energy-formulas-stellar-build-20260928.json。

Web build 首轮因新 spec 对窄联合类型做 kind narrowing 失败（2.598秒）；修正后 retry1 通过（3.670秒）。随后发现并修复 NoElement 枚举差异，增加真实粒子断言的 retry2 build 通过（3.695秒、696 modules、Vite 840ms）。对应收据为 source-energy-formulas-web-build-20260928.json、source-energy-formulas-web-build-retry1-20260928.json、source-energy-formulas-web-build-retry2-20260928.json。

两次原生运行、聚合结果与 compact measurements 分别存于 source-energy-formulas-classic-20260928.result.json、source-energy-formulas-stellar-20260928.result.json、source-energy-formulas-20260928.result.json 和 source-energy-formulas-measurements-20260928.json。b4、a7 各有59条计算和26条真实 energyApplications，operation 分布均为 flat-change13、consume1、particle-amount12、particle-apply12；四类固定装备条款 exile9、scholar2、scroll1、reminiscence1 均有实际触发。每lane有6条实际 ER 支持记录。同元素／异元素／无元素分支分别2／6／4次，前台／后台分支3／9次（这些分类维度不能彼此相加）。

选中 Sucrose 粒子事件的实读 ER 从1.2编辑到2.2：能量前值4、上限80，金额从14.399999999999999变为26.400000000000002，入账后能量从18.4变为30.400000000000002；b4／a7 原捕获重放差均为0，b4页面 JSON 导入显示30.4。两lane还同样观察到接近上限时的 overflow（before31.320203532800004、request9.675190812、after40、overflow0.9953943448000047），以及中性粒子后台 Barbara 金额4.32；a7原始粒子元素字段为 none、b4为空字符串，修正后能量相同。

本轮未执行独立核心单测，也没有重跑历史矩阵或新做从头完整重执行。护盾、治疗、抗性和冷却等其他公式通道不在本轮范围，预览／正式数据指针及 verified 分母不变；本实现不代表游戏机制全量或 steady 完成。
