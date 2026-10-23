# 阿蕾奇诺C1–C5所选普攻（2026-10-23）

修复当前C1–C5导入后红死之宴单击被公共命座门和角色核心双重拒绝的问题。角色提交5274890，公共门复用 `ARLECCHINO_MAX_IMPLEMENTED_CONSTELLATION=5`，七skillId、ctx和保存结构不变。

固定源码 `bondBonus()` 为 `(masque[有效普攻等级] + C1的1.0) * 扣契前比例 * 总ATK`。C1不是附伤整体翻倍，C3的有效普攻等级已包含+3，不能再次增加。C2吸收爆发、C4回能/冷却、C5爆发不追加到本次NA；C6实际暴击状态尚未实现，仍明确拒绝，不降级为C5。

独立90对90算例：ATK2000、契150%、40%固有火伤、10%抗、CR50%/CD100%。C1 NA10附伤基数10140，非暴7571.29086、期望11356.93629；C3有效NA13（普通系数1.1378、masque2.884+1）附伤11652，非暴8774.388、期望13161.582。均为明确测试配置。

验证91/91：角色86项保留原C0数字和负例，旧整体拒绝C1–C5断言迁至仍不支持C6，并增加C1七击/C3有效NA13严格值；原接线3项与新合成导入2项通过。槽冲突、40%火伤去重、30%边界、旧JSON和转换身份保护均保留。

真实浏览器1/1：100级C3合成Enka形状文件→预览选择最终面板→NA10+明确额外3=13→填写本击150%契/40%已含→三列结果→保存重开，等级/命座/有效天赋保持。敌人90时使用200/390防御乘区，期望13499.058461538461，未裁回90。无页面异常，390宽无溢出；未使用真实账号或Windows实机。

```sh
./node_modules/.bin/vitest run packages/sim-core/src/arlecchino-damage-formulas.test.ts apps/web/src/arlecchino-calculation-context.test.ts apps/web/src/arlecchino-constellation-context.test.ts
npm run test:e2e -- arlecchino-constellation-output.spec.ts
```

证据 `/tmp/GIDPS-constellation-primary-batch-20261023/arlecchino-targeted.json`、`arlecchino-browser.log`及浏览器目录截图/数值；16个原始源码身份审计及更多精确数值见 `docs/audits/arlecchino-constellations-20261023.md` 和 `/tmp/GIDPS-arlecchino-constellations-evidence-20261023/`。

范围是实际独立NA命中，不是新完成的契生命周期、C2额外事件、Q/能量/CD或120秒轮转。本批不跑无关全量，保留3196/79/1旧基线。只提交推送工作分支，生产拒绝断点未动；无新登录、凭据或根许可证变更。
