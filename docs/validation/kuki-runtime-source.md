# 久岐忍真实 E 来源入口：实现与验证

本轮完成 `kuki-source-action.ts`、`source-action-library.ts` 注册及公开导出；通用周期实体、动态治疗 AST、实际生命状态、追加伤害快照、粒子概率和结果独立重放由并行运行时任务实现，其专项测试另行记录。没有改动独立伤害计算器入口或用模拟器取代它。

来源入口提供明确固定 Lv90/A6/T1/钝剑Lv1 的 C0／C2 示例，以及仅作切换接治疗的 Lv1 安柏。额外EM200、CR−5%是明确的合成参考输入；初始HP50%可以显式修改。实际 E 执行起手耗当前HP30%、最低20%最大HP；初击+11帧；草轮+23生成、每90帧实时治疗并排+2帧伤害，完整8／10次。治疗A1按久岐忍自身当时HP≤50%判断，目标为当时前台角色。E冷却907帧，切换取消50帧、切换耗1帧及成功后60帧全队切换冷却均按来源检查，合法等待和切换保留。

只在实际环击命中确认后按45%独立概率产一枚雷粒子，先锁12帧ICD，旅行100帧；初击没有粒子回调。随机粒子使用可重放的独立子流，不声称跨引擎共享seed的序列相同。来源定义、签名、面板、控件公开字段与适用边界见 `docs/cross-validation/action-library/kuki-source-contract.md`。

## 唯一外部运行

执行命令完整保存在 `docs/cross-validation/action-library/kuki-e-swaps.execution.json`；核心参数如下：

```sh
/var/folders/3k/lmzjz_h51dn_5rdqvwffprph0000gn/T/gidps-gcsim-b4ae769-03yjl36g/gcsim_darwin_arm64 -c docs/cross-validation/action-library/kuki-e-swaps.gcsl -out docs/cross-validation/action-library/kuki-e-swaps.result.json -sample docs/cross-validation/action-library/kuki-e-swaps.sample.json
```

仅一次CLI调用，首次退出码0，耗时约0.0224秒。CLI内部执行一次汇总迭代并单独生成一条调试sample；两个seed明确分开，不将其随机产球结果混合。固定二进制 SHA-256 和配置／结果／sample 的哈希保留在 execution JSON；30项来源文件的原始字节与哈希见 `kuki-source-parameters.json`。

独立数学与外部sample比较：9击总伤 `496.89815872204804`，逐击伤害最大绝对残差0；8次治疗原始量最大残差 `2.2737367544323206e-13`，治疗后HP最大残差 `1.8189894035458565e-12`。微小误差来自浮点运算顺序，未舍入来源面板。源日志的 `received amount` 含溢出治疗，本地比较采用实际HP差／有效治疗，而不是错误地将它全部加到HP。

## 两项必要本地测试

首轮命令：

```sh
npx vitest run packages/sim-core/src/__tests__/kuki-source-action.test.ts > docs/validation/kuki-runtime-source-tests.log 2>&1
command_result=$?
printf '%s\n' "$command_result" > docs/validation/kuki-runtime-source-tests.exit
cat docs/validation/kuki-runtime-source-tests.log
exit "$command_result"
```

2026-09-24 03:39:56 香港时间，退出码1，两项均在进入模拟前失败：新来源校验器将未启用的可选配置项 `undefined` 直接传入严格 canonical 编码器。只修改 `kuki-source-action.ts` 中这些可选字段的比较，未启用项明确编码为 `null`，没有修改通用运行时或放宽实际来源字段。

仅重跑同一文件的两个失败用例：

```sh
npx vitest run packages/sim-core/src/__tests__/kuki-source-action.test.ts > docs/validation/kuki-runtime-source-tests-rerun.log 2>&1
command_result=$?
printf '%s\n' "$command_result" > docs/validation/kuki-runtime-source-tests-rerun.exit
cat docs/validation/kuki-runtime-source-tests-rerun.log
exit "$command_result"
```

03:40:21，退出码0，2项全部通过；总耗时1.45秒，测试681毫秒。没有追加全套测试、构建或 `data:status`。

第一项逐行比对唯一外部sample：初击第12帧，8次环击第116至746帧；前三次治疗第114／204／294帧给安柏，后五次第384至744帧给久岐忍。前六次A1乘区1.15，后两次因久岐忍实际HP超过50%降为1；最终久岐忍HP `10216.632688826016`。逐击伤害按11位小数比较通过，治疗基础量、请求量、有效量、溢出和治疗后HP按9位小数比较通过。9个模拟命中全部捕获并由独立计算器恢复，差值均为0；E生命消耗没有误记为敌人伤害。

第二项执行C2明确来源时长，得到11次伤害／10次治疗、末击第926帧；初始HP21%的E准确消耗到20%下限。来源校验允许用户明确修改初HP、等待和合法切换；拒绝第12帧过早切换、未满60帧切换冷却和第907帧过早重放E；第908帧再次E通过合法输入校验。后者是输入时序检查，不冒称另做第二个外部C2或多E黄金样本。

## 范围仍保持明确

固定参考仅覆盖C0／C2的真实 E、等待与切换，不声称Q、普攻、其他配装、C4追加攻击、C6状态或完整角色轮转均已验证。动态最大HP、外部属性增益、移动、敌方伤害及其他反应不在这份固定来源身份内。上游E动态快照TODO和低突破初击A4门冲突仍存在；固定A6/固定面板不会消除这些限制。独立计算器的其他条件动作覆盖与本运行时来源入口分别保留。

UI和整合构建由主任务记录；本专项不将其计作已经执行。
