# 胡桃高命座实际单击（2026-10-23）

修复前，C3胡桃的开E重击同时被公共命座门与角色模块按C0/C1整体拒绝。本批将该明确单击扩展至C0–C6；八个旧skillId、原有低命座存档及转换身份保持兼容。角色提交11b07a7；详见 `packages/game-data/sources/hutao-primary/INTEGRATION.md`。

C2血梅香、C4队友增益及C5爆发不追加到所选NA/CA；C3使用已给出的独立有效E等级，不再+3。C6新增本击实际生效状态与面板是否已含100个百分点暴击率，按差额执行，再由公共核心clamp。低血量不证明C6实际触发/仍在持续，未知状态通过就地控件补填。

独立数值：NA10重击2.42565，已含C3加级的有效E13转换0.07153；ATK2000、施放最大HP30000、白字1000、HP49%且半血增伤稳定未含、90对90/10%抗、CR50%/CD100%。C3非暴6018.8166474975、期望9028.224971246249；C6实际生效且CR未含，clamp后期望12037.633294995。不是实际账号配装。

验证61/61：56项角色测试保留原33项数值/负例并扩高命座；旧单纯C2拒绝用例迁至C6缺实际状态拒绝，另补C3正向数值。原接线4项和新增100级C3合成Enka形状导入至计算测试通过。导入明确基础E10+额外3只得有效13，NA仍10；旧结果不会静默迁移或重算。

浏览器1/1：导入100级C3→独立E13火重击→C6未知拒绝→实际生效/失效对照→导出重开，100级/有效等级/数值均保持；390宽无溢出、无页面异常。该样例明确为合成文件，不是联网账号验证；没有Windows实机测试。

```sh
./node_modules/.bin/vitest run packages/sim-core/src/hutao-damage-formulas.test.ts apps/web/src/hutao-calculation-context.test.ts apps/web/src/hutao-constellation-context.test.ts
npm run test:e2e -- hutao-constellation-output.spec.ts
```

证据 `/tmp/GIDPS-constellation-primary-batch-20261023/hutao-targeted.json`、`hutao-browser.log`及浏览器目录截图/数值回执；原始20文件审计 `/tmp/GIDPS-hutao-constellations-evidence-20261023/`。

仍限明确发生的所选命中：未实现本入口的血梅香/Q联动、C6触发器/到期自动时间线、瞬间跨半血轮询、体力或120秒循环。保留旧全量3196/79/1基线；本批不重复全回归。提交推送工作分支，生产发布拒绝断点保持，不重试/换通道；未改登录权限或根许可。
