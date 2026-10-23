# 阿蕾奇诺红死之宴接入（2026-10-23）

新增C0七个独立火普攻命中入口，保留原有E/Q。普通倍率和生命之契附加基伤都读取独立有效普攻等级；没有改成总倍率或复制命中。原模块f7eb699，原始来源、完整15级向量、取样帧及精确API在 `docs/audits/arlecchino-primary-integration-20261023.md`。

每击输入实际扣契前的生命之契百分比；至少30%才开放此火普攻定义，未知/低于30%明确提示，不静默改物理。第四段24/35f两击分别选择、填写本击比例。装备重建自动补加无突破门的40%固有火伤；最终导入面板需确认是否已含，避免重复。附加基伤为空可证未含时自动记0，同槽外来来源保留并报告冲突。

独立例：NA10=0.938961，附伤系数2.38；ATK2000、命中前契150%、输入火伤0且固有未含、90对90/10%抗、暴击50%/暴伤100%。非暴5681.29086，期望8521.93629，暴击11362.58172。测试配置不是玩家实装或毕业线。

实际验证：

- 模块63项完整断言改用正式公共schema/计算/转换路径；增加3项接线验证，共66/66通过。
- 合法starter来源装备转换、严格JSON重开保持原数值；新状态不得静默改写旧转换身份。
- Chromium页面1/1通过：选择实际普攻、填150%、验证独立数值、低契负例、第四段分别输入150/138.75%、保存重开、390宽无横向溢出且无页面异常。第二个比例是明确测试输入，不是本页自动推演耗契。未在Windows实机运行。

```sh
./node_modules/.bin/vitest run packages/sim-core/src/arlecchino-damage-formulas.test.ts apps/web/src/arlecchino-calculation-context.test.ts
npm run test:e2e -- arlecchino-primary-output.spec.ts
```

证据 `/tmp/GIDPS-three-primary-batch2-20261023/arlecchino-targeted.json`、`arlecchino-browser.log`、`arlecchino-browser/**/arlecchino-proof.json`及截图；源码审计 `/tmp/GIDPS-role-arlecchino-evidence-20261023/`。

范围限制：C1+、血偿回收、契获取/连续消耗、连段、E冷却、Q治疗和120秒轮转不在本单击入口；不能把这些宣称完成。本批未执行全量回归，旧3196/79/1基线单独保留。只推送现有工作分支，不发布生产或重试被拒部署；未改根许可证或账号登录。
