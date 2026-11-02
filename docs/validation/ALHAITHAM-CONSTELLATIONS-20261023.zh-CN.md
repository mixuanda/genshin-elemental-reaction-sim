# 艾尔海森C1–C3镜投射（2026-10-23）

原C1/C2/C3所选投射被公共及角色C0门整体拒绝。本批复用 `ALHAITHAM_MAX_IMPLEMENTED_CONSTELLATION=3`，保持三个旧skillId，新增C2实际阶段记账；角色提交ffaa5f7，合同见 `docs/alhaitham-c1-c3-integration.zh-CN.md`。

C1命中后减CD不改变本击。C3有效E等级直接查表，不再+3。C2每层50精通、最多4层、独立480帧寿命，镜溢出生成也能触发；有效层数不能由当前持镜数猜测。本入口只接受实际快照有效/已含层数，差额通过同一EM属性相位重建装备；触发基数与逐段命中A4依各自完整实际精通。精通变化时不回填晚期精通、不重复叠加C2。

非战斗导入面板补C2精通差额时，必须先提供并确认其他实际快照属性；不能只加精通并假定武器转攻击等属性已正确。复杂跨阶段EM敏感配装保持明确拒绝，列出具体规则与实际面板方向；不因覆盖数量输出假精确值。C2→C1遗留实际/已含层数>0或旧冻结快照均拒绝。

独立E10/90对90、ATK2000/EM300/10%抗：实际C2两层且未含，稳定EM400时每击非暴2133.7344；触发实际EM300、命中EM500时每击2122.848。C3有效E13向量1.428/2.856，100对90、基础EM300+C2两层100、明确实际ATK2000、CR50%/CD100%时，三镜期望11626.116923076923。均是明确测试条件，不是实装或毕业标准。

验证69/69：61项专属测试、原接线3项、合成导入2项与三角色入口3项。原数值/负例保留，旧低命座范围拒绝按新实现迁至C4及缺C2实际状态，新增C1等伤、C3有效E13、属性相位、差额去重/负差、导入未知、非法低命座声明、冻结/旧JSON保护。最初同一三入口验收0/3，现3/3。

浏览器1/1：100级C3合成Enka形状文件→E10+额外3得到13→三镜实际接触→C2两层/已含0→未确认其他实际面板仍阻断→明确确认后计算→保存重开。数值/100级/有效E13保持，逐击贡献守恒；390宽无溢出、无页面异常。未运行真实账号或Windows实机。

```sh
./node_modules/.bin/vitest run packages/sim-core/src/alhaitham-damage-formulas.test.ts apps/web/src/alhaitham-calculation-context.test.ts apps/web/src/alhaitham-constellation-context.test.ts apps/web/src/constellation-primary-entrypoints.test.ts
npm run test:e2e -- alhaitham-constellation-output.spec.ts
```

证据 `/tmp/GIDPS-constellation-primary-batch-20261023/` 的 `before.json`、`alhaitham-targeted.json`、`alhaitham-browser.log`、独立源码算式及截图/回执。26个固定原件身份、180向量位置和C2调用顺序审计在 `/tmp/GIDPS-role-alhaitham-cons-evidence-20261023/`。

未完成C4+、Q、完整镜生命周期、产球/冷却循环或120秒队伍。复杂跨阶段配装的手动面板切换仍需主线验证，不把“已给提示”当作该切换流程已通过。旧全量3196/79/1单独保留；不重复无关全量，不生产发布或重试拒绝，不新增账号权限或更改根许可。
