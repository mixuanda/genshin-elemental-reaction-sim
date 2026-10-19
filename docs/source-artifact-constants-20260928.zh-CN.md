# 固定来源普通圣遗物常量公式扩展（2026-09-28）

本轮新增24套普通圣遗物中可明确归属于既有 `StatMod.Amount`／`AttackMod.Amount` 回调的39个固定数值规则，接入共享 artifact-scalar 公式、捕获和中文公式标题展示。此前七套18条规则保留，当前 registry 共57条规则、涵盖31套；这些数字表示指定数值回调的规则清单，不表示31套所有二件/四件效果、触发状态或机制均已支持。

## 实际改动

- `packages/sim-core/src/source-host-artifact-constant-group-a.ts` 与 `source-host-artifact-constant-group-b.ts` 分两组声明39条规则：固定来源 artifact key、中文标题、属性槽、固定值、对应 modifier keys 与条件说明。
- `source-host-artifact-constant-formula.ts` 合并两组descriptor，检查重复 ID，构建常量规则 registry 与严格 ruleId schema，生成绑定固定源码链接的共享公式 trace。原有 `source-host-artifact-formula.ts` 调度器继续接受旧18条动态/常量规则，并将本组的标量请求委派到新增 registry；既有 capture/support 链路按来源 modifier key、getter、帧和返回值核验这次确实被使用的公式值。
- b4 Go 接入位于 `packages/source-host/patches/012-artifact-constants-a.patch`、`013-artifact-constants-b.patch`；a7 overlay build 注册并应用这两份 patch。bridge 仍在原生 `Amount` 返回处调用公式值，不替换原事件、目标条件、武器类型、标签、属性受益者或 modifier 生命周期。
- 新增 AttackMod 常量调用携带实际 targetKey，让目标相关 modifier gate 保持绑定到真实受击目标；StatMod 是角色属性 getter，不带伪造 target applicability。捕获不把 StatMod 项强行归属到敌方目标。
- 独立来源计算器使用 descriptor 的中文 title 作为条目标题，并把原 rule ID 放在可展开的“公式标识”处。固定常量没有编辑变量；它展示的是某条实际捕获回调的算式/说明，而不是模拟一整套圣遗物状态机。

对应 fixed-source 数值、gate、来源版本差异及排除项见[24套常量条款审计](cross-validation/artifact-constant-source-20260928.md)。在这24套中，b4/a7有22个条款文件逐文件相同；Blizzard 与 Viridescent 存在源码事件/API差异。共享值不抹平这些差异：原生版本 hook、a7星辉扩散增益和 Blizzard 特殊快照保留其各自来源路径，未并入本组常量。

## 覆盖边界

本组只搬运来源返回的固定 `StatMod.Amount`／`AttackMod.Amount` scalar。盾强度 bonus、独立 `HealBonusMod`、`ReactBonusMod`、`ResistMod`、能量/体力/冷却功能回调、海染砗磲随治疗累计的泡沫伤害，以及 Blizzard 的特殊反应暴击快照都未迁入这批常量规则；若固定来源已实现对应效果，仍由其原生实现负责；来源明确标为 unimplemented 的条款不会因为新增 registry 就变成已实现。例如审计标出的守护之心四件与部分套装二件 TODO，不能宣传为已支持。

固定返回值的共享展示不等于一整套效果或游戏数据已验证。本轮不新增游戏数据核验，也不改变数据覆盖或 verified 分母。旧 audit 对触发、门槛、状态刷新、受益者、标签 gate 和到期的限制继续适用。

## 已执行验证

- 核心聚焦测试首轮失败于测试 fixture 缺 `sourceCommit`，属于输入夹具问题，不是生产公式错误；修正 fixture 后 retry1 1项通过（墙钟0.710秒，Vitest测试约29ms）。两次日志与收据保留在 `docs/validation/source-artifact-constants-core-20260928.{json,log}`、`source-artifact-constants-core-retry1-20260928.{json,log}`。
- b4 与 a7 原生 WASM 构建首次均失败：Braveheart 回调缺少 `atk` 变量、Wanderer `Set.Init` patch 使用了不在作用域内的 `c`／`char`。窄修生产 patch 后，并在 retry 前为17个新增 AttackMod 请求补入实际 `targetKey`；b4 retry1 通过（5.717秒，WASM SHA-256 `ae8f0abcbdec9ad094bc01397b7cef10b5e1b447347fc1592db54c41ce503a94`，42,029,420字节），a7 retry1 通过（6.051秒，SHA-256 `828039ae6a350a616d866acad8c64fa3eba61e02b978ca987f3913f4fcc56b6c`，62,376,642字节）。首轮错误、修复前版本和 retry1 均保留于 `docs/validation/source-artifact-constants-wasm-{classic,stellar}[-retry1]-20260928.{json,log}`。
- Web build 首轮因 E2E fixture 中的 Set 被推断为字面量联合，`.has(string)` 入参类型不匹配而失败（2.456秒）；显式声明为 `Set<string>` 后 retry1 通过（3.507秒，685 modules、Vite 819ms）。两次记录见 `docs/validation/source-artifact-constants-web-build[-retry1]-20260928.{json,log}`。
- 聚合浏览器验收首轮通过1项（Playwright用例6.2秒、runner7.0秒、墙钟7.507秒；`pageErrors: []`）。两来源各执行12秒、四人队伍、单目标脚本；每 lane 捕获54条常量公式调用、7个rule ID、涉及4套；b4为108条总计算／41次命中应用，a7为95条总计算／41次命中应用。实际命中范围仅为冰风、教官、宗室、海染四套，不是39条全部规则或24套完整机制的页面验证。收据与原结果：`docs/validation/source-artifact-constants-e2e-20260928.json`、`docs/validation/source-artifact-constants-20260928.result.json`；compact 派生测量见 `docs/validation/source-artifact-constants-measurements-20260928.json`。
- Blizzard Cryo 普攻回调关联 application ID 10；实际目标 `targetKey` 与命中目标键一致。所选 Barbara 命中（index 14）实际连接海染两件治疗加成0.15、教官四件EM +120、宗室四件ATK +20%三项支持公式。原伤害224.642370074518；独立实验只把 scaling 从0.3784改为0.7568，计算结果449.284740149036，两来源结果一致。原 capture 重放差0；固定常量值一致；中文卡片没有伪造的状态输入；导出原 capture 未改变，编辑后的 JSON 导入恢复相同。
- a7 patch application 没有独立保存的 apply-check receipt，因此不单独声称或虚构该类收据；此处引用 WASM 构建与真实来源运行收据。

以上构建、核心与单条页面流程仍只证明所列来源输入及捕获结果。本范围仍只是共享常量数值回调，不是普通圣遗物全套机制、游戏验证或全项目目标完成。
