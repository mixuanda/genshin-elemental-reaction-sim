# 艾尔海森镜投射接入（2026-10-23）

新增C0一镜、二镜、三镜的一次投射入口，各保留1/2/3个真实普通技能命中，普通攻击/E突进等原入口不替换。模块601f442；固定源、完整向量与具体时序见 `docs/alhaitham-primary-integration.zh-CN.md`。

投射使用独立有效E等级。原生精通附加基数锁定在触发时；A4按各段命中时精通取样，0.1%/点、上限100%。明确精通不变后才共用当前面板；变化时提供触发精通和各段命中精通。镜数由所选一/二/三镜情景给出，不要求重复选择；本次投射资格和命中仍须明确。额外逐段增伤/反应编辑默认折叠，必要条件直接显示。

独立数值：E10 ATK系数1.2096、EM系数2.4192；ATK2000、触发EM300、90对90/10%抗、无其余增伤。每击基数2419.2+725.76=3144.96。命中EM300时单击非暴1839.8016，三击5519.4048；命中EM1000时单击2830.464，三击8491.392。原生精通基数仍725.76，不能由后来的1000精通回填。这是明确测试配置，不是玩家实装。

实际验证：

- 39项模块断言改用正式公共schema/计算/转换，保留原数值、条件和篡改负例；新增3项接线及3项三角色入口验收，共45/45通过。
- 合法starter配装转换、严格JSON往返、贡献守恒通过；镜数或历史身份改变明确拒绝。
- Chromium真实页面1/1：三镜选择→条件补齐→精通稳定与触发300/命中1000两情景→逐击合计→导出重开→390宽无溢出、无页面异常。未在Windows实机运行。
- 整批构建（含完整类型检查）、数据检查通过；另28项共享导入、JSON及上一批角色接线回归通过，没有新跑完整套件。

```sh
./node_modules/.bin/vitest run packages/sim-core/src/alhaitham-damage-formulas.test.ts apps/web/src/alhaitham-calculation-context.test.ts apps/web/src/second-parallel-role-entrypoints.test.ts
npm run test:e2e -- alhaitham-primary-output.spec.ts
npm run build
npm run data:check
```

原始日志、JSON及截图 `/tmp/GIDPS-three-primary-batch2-20261023/`：`alhaitham-targeted.json`、`alhaitham-browser.log`、`alhaitham-browser/**/alhaitham-proof.json`、`shared-regression.json`、`build.log`、`data-check.log`。26个原始来源文件及180个完整向量位置审计在 `/tmp/GIDPS-role-alhaitham-evidence-20261023/`。

固定60FPS来源：投射冷却96f；快照延后20/22/26f，三镜命中32/41/51f。一镜左右39/40f、二镜左右28/37或26/35f的几何分支保留在来源审计。此页计算明确发生的一次投射，未调度完整镜生命周期、Q、产球、反应所有权、C1+或120秒循环，不能据此标为完整队伍。

工作分支提交推送，不生产发布。旧全量3196通过/79失败/1跳过仍是独立历史基线，本批定向通过不是全量清零；米游社真实登录未新增或验证。
