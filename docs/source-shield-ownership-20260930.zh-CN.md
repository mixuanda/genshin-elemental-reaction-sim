# 固定来源护盾实例与白术 Q 归属（115）

## 范围

本批为原生护盾建立逐实例身份和生命周期回执，并先把白术 Q 的六次护盾创建接入既有有限技能、共享公式和页面路径。通用观察器覆盖原生 `ShieldHandler.Add` 安装的护盾实例；这表示护盾对象可被识别和追踪，不表示所有角色护盾都已建立来源合同。本批仅为白术 Q 建立新的有限技能归属合同；其他角色护盾获得通用实例／hook 观察，不因此取得技能归属合同或 verified 状态。

本批沿用第 114 批冻结的 classic／stellar 来源基线及 2026-09-30 已记录的数据刷新，不进行新的上游抓取。相关背景见[114 批报告](source-shared-delayed-events-20260930.zh-CN.md)和[当日数据证据刷新](data-evidence-refresh-20260930.json)。

## 基线与实现文件

测量基线为工作树 HEAD `84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5`，固定 classic／stellar 来源提交分别为 `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 与 `a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd`。9 月 30 日观察到官方索引 7.1；`activeVerified` 为空，当前 preview 为 7.1.50.2 partial，7.1.51 candidate 保持隔离，7.2 V1 来源映射未确认。本批复用当日既有证据，不重新抓取数据。

主要实现位于 `packages/source-host/go/pkg/core/sourcehost/shield_lifecycle.go`、`sourcehost_shield.go` 及 `packages/source-host/patches/115-shield-lifecycle.patch`、`115-baizhu-shield.patch`；TypeScript 身份与合同分析位于 `packages/sim-core/src/source-host-owned-shield-types.ts`、`source-host-owned-shield-analysis.ts`、`source-host-finite-cast.ts`、`source-host-action-collection.ts` 和 `source-host-wire.ts`；有限技能页面与浏览器案例在 `apps/web/src/source-host-action-calculator.ts`、`apps/web/e2e/source-shield-ownership.spec.ts`。

## 通用护盾实例与 hook 回执

每次真实 `Add` 都创建新的 simulation-local `shieldInstanceId`，即使同一个原生对象之后再次安装，也不复用实例身份。实例记录出生帧、原生过期帧、护盾类型／对象、初始与末次 HP、出生 HP 公式来源、创建来源及其替换关系；`SourceHostHPID` 等可变 HP 来源仍作为公式 provenance 单独记录，不充当对象身份。通用观察覆盖全部原生护盾对象；尚未审阅的自定义私有字段保持为覆盖缺口。

`OnOverwrite`、`OnDamage`、`OnExpire` 作为不同 hook cause 分别记录实例、调用帧、玩家攻击身份（受击时）、HP 前后及该 hook 实际排出的已标记攻击。记录包围原有 callback，不改变参数、顺序、返回值或原生事件。实例 ID 在原 `OnOverwrite` 完成后、`OnShielded` 发出前分配；重新安装同一原生对象也会获得新 ID。phase-state 导出保持不变，身份与 hook 仅进入独立回执。实现审计见[原生生命周期记录](validation/source-shield-lifecycle-native-20260930.json)。覆盖、破裂、到期三种终止原因独立标识：例如护盾被刷新替换时，原生 `Add` 运行旧盾 `OnOverwrite`，并不调用 `OnExpire` 或 `OnShieldBreak`。这使刷新前攻击、替换后的新护盾出生及终止回调可以归属到正确对象。

## 白术 Q 有限技能归属

白术 Q 的有限合同跟踪恰好六个原生任务：首盾任务在施放后 +81 帧执行，后续五个刷新任务分别在 +223、+369、+515、+661、+807 帧执行。六次任务各自创建一个新的 Q 护盾实例；五个刷新任务还执行原有治疗。任务中的出生计数事实从 0 记录，在真实护盾创建分支设为 1。

`summonSeamlessShield` 刷新时先读取当前 `BaizhuBurst` 护盾。若存在旧实例，先由旧实例拥有的 `refresh` hook 排出 Spiritvein，再由 `Add` 安装新盾。该攻击属于被替换的旧盾，不自动转记为触发刷新的 Q 任务所创建的新盾。每个出生实例携带独立的任务来源、shield instance ID、替换关系及实际终止原因。

C6 产生的护盾来自独立命中回调：`makeC6CB` 对每个回调闭包只在首次执行时创建一次新盾，并保留实际 callback 身份。Q 的任务创建与 C6 回调创建分别记录；即使某个 Q 刷新任务替换了 C6 护盾，旧盾的刷新攻击仍属于 C6 实例。既有 E 连击、C2 Splice 生产链、治疗／A4、粒子和下游反应继续沿各自已有路径处理，不纳入白术 Q 护盾出生事实。

本批仅新增白术 Q 的护盾归属合同。有限技能分析要求本次 Q 的六个实际出生任务全部完成；每个 Q 护盾实例都需取得被替换、破裂或实际到期终点；实例关联的 Spiritvein 攻击也需经过现有派发、目标命中与共享公式路径闭合。配置中的 152 帧寿命不替代原生到期 tick；若观察结束时仍有任务或护盾待处理，组件保持未闭合。C6 或其他盾交错时须保留独立实例和来源。

## 验收结果与证据边界

白术 Q 的固定来源合同与分支审阅见[白术护盾审计](validation/source-shield-ownership-baizhu-20260930.json)。当前实现把全局护盾实例／hook 观察接到现有公式重放和有限技能 UI，本批新增的护盾归属合同仅覆盖白术 Q。一般护盾的完整私有状态、其他角色的 E/Q 创建合同、护盾后续效果、所有 C6／治疗分支和完整角色生命周期仍不在本批闭合范围。来源执行、共享公式重放与游戏验证是不同层次；本批不声称任何游戏机制已 verified，也不改变正式／预览／active verified 数据指针或 master 全量完成状态。

classic／stellar 来源构建、talent registry、typecheck 与 Web build 均首次通过：classic 5.142 秒（45,153,000 B，SHA-256 `26c32b11d8caba6f9ec07703878fae184a16086bb901c767a7a654f6e48686e5`），stellar 5.196 秒（69,726,546 B，SHA-256 `6ed4ded5dc47ecf0ea611c80f359029e0a68e679584ae3eed6f9119edb46347f`）；registry 0.110 秒，typecheck 3.088 秒，Web build 1.222 秒（Vite 981 毫秒）。两 lane 编译后的 WASM 字节与 SHA 已留在各自构建 JSON。

一项浏览器案例首轮因测试从 application 记录查找 `actorKey`／`ability`，而这两字段实际位于 `calculation.request`，在身份断言处失败（6.560 秒）。测试字段读取修正后复用同一份归档原生捕获，第二次通过（9.502 秒；测试体 8.2 秒、runner 9.1 秒），无页面错误；没有第二次原生运行或全量套件。CLI 调用、构建产物和时间见[测量记录](validation/source-shield-ownership-measurements-20260930.json)，浏览器回执见[最终结果](validation/source-shield-ownership-team-20260930.result.json)。

唯一新增 native run 是 classic 白术 C6 配置；实际观察 1,149 帧，尽管配置声明 24 秒，故该总量不是固定 24 秒 DPS benchmark。共 13 个应用、总伤害 8,090.870325254429，其中白术 Q 合同纳入六个应用，七个无关应用明确排除。原生捕获共记录 8 个护盾实例及 15 个生命周期 hook。Q 实际完成六个出生任务，创建六个归属护盾实例（ID 1、4–8）；实例 2、3 是独立 C6 回调出生盾。白术 Q 归属的 11 个 hook 中有五次刷新、五次覆盖和一次到期；这份捕获没有受击破盾分支。六个归属 Spiritvein 应用小计 5,525.524907224306，逐击共享公式重放差值均为 0，六盾均有已观察终点，合同闭合。原始捕获 SHA-256 为 `5771c004ebfa5914f325aa97a55e90a0cfb2402bed2d7b3d353e76223ae5acd6`。

样本时间与来源关系为：Q 在第 1 帧开始，首个 Q 盾于第 82 帧生成；E 在第 105 帧执行，两个独立 C6 盾出生于第 118、131 帧。C2 Splice 的 C6 出生回执通过 callback ID 4 和父攻击 ID 2 精确关联；组件按该真实回调归属，不以可能触发事件的角色身份猜测盾的创建者，也不把被 Q 刷新的旧 C6 盾攻击归给 Q。浏览器中的组件编辑、JSON 导入／导出通过。两项离线缺证据探针分别移除 shield birth 和 hook 证据，均阻止合同闭合，未增加 native run。旧 calculator、worked examples 与 Enka 路径保留但本批未重跑。

通用观察器可给所有原生 `Add` 的盾编号并记录生命周期，不等于所有护盾机制已验证。仅白术 Q 是本批新增有限技能合同；Xinyan DoT 仍是来源审阅／计划候选，没有接入有限归属。受击破盾、其他角色完整护盾私有状态、外部状态归属与更多技能生命周期仍未覆盖。正式／预览指针稳定，`activeVerified` 仍为空，没有数据晋升；本批也未声称游戏 verified。finite contracts／producer plans 当前为 61／52，producer sites 为 65；master 全量目标仍开放。
