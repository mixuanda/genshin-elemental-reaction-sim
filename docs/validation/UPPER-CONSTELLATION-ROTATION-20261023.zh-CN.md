# /goal 仆人C6、海森C4–C6与诺艾尔普通轴修复

基线`8b7d36227d92c4edd352c981dd2166e3aa3d2bac`；实际云端执行于2026-10-23，原工作树`/workspace/GIDPS-cloud/player-import-integration`、分支`cloud/player-import-integration-20261021`。三条角色／轮转工作线在独立工作树并行，根线程整合公共入口、数据清单和浏览器路径。未使用用户电脑。

## 实际用户行为与范围

| 修复 | 玩家现在能做什么 | 仍不包含什么 |
| --- | --- | --- |
| 仆人C6 | 100级、有效普攻13的红死之宴所选普攻可计算；就地明确本击C6是否生效、最终面板已含的暴率／暴伤份额，只补差一次。保存重开保留状态。 | 不把C6身份当实际激活，不自动生成Q伤害、C2吸收或整轮资源事件。C6窗口来源为20秒并受卡肉影响，独立单击不伪造计时历史。 |
| 艾尔海森C4–C6 | 投射按实际快照的自身C4草伤、C6溢镜双暴计算；C2触发／快照／命中精通继续分别处理。C5不额外提高E等级，C4队友精通不加给自身。 | 当前持镜数不能代替Q实际生成镜数或C6溢镜状态；未自动模拟Q、镜完整生命周期及增益刷新。缺实际状态或面板已含量时给就地选项，不能降级为低命座数值。 |
| 诺艾尔C6普通轴 | 未明确额外延长的Q编译为`extend=0`；动作行可填0–10秒，明确值能保存重开。 | 未自动实现击杀／后台延长生命周期；原生高级脚本默认协议、明确参数和旧结果保持原样。非零是本步假设，不代表已捕获触发事件。 |

角色机制分别见[仆人来源审计](../audits/arlecchino-c6-selected-normal-20261023.md)、[海森C4–C6契约](../alhaitham-c4-c6-integration.zh-CN.md)、[诺艾尔来源和120秒审计](NOELLE-C6-ORDINARY-ROTATION-20261023.zh-CN.md)。固定Classic／Stellar原始来源文件分别核对Git blob及SHA256；没有把本地插桩树当上游原件，也没有修改WASM或原许可。

## 独立数值与浏览器回执

100级角色对90级、10%抗性敌人，无反应；合成面板只用于确定性的导入契约，不冒充真实玩家响应。

- 仆人：ATK2000、扣除前生命之契150%、固有火伤已含于40%火伤、有效普攻13。未暴击`8999.372307692307`；C6实际激活且面板未含增益时CR由0.5到0.6、CD由1到1.7，暴击`24298.30523076923`、期望`18178.73206153846`。相同输入C6未激活保持基础双暴；已含份额不重复加入，部分已含量也分别核对。
- 海森：ATK2000，实际触发／快照／命中精通400，有效E13向量ATK1.428与EM2.856，A4加C4后伤害区1.7；三次连接投射未暴击合计`9411.61846153846`。C6实际激活、CR0.6/CD1.7时，期望`19011.469292307687`；逐击之和与总数一致。将这两项双暴已含标识改为已含并同步面板后，结果保持一致。
- 诺艾尔只额外执行一次Classic 120秒原生运行：110击，总伤`38168.12035863541`。独立逐击算术误差0，归属／总和守恒；正常卡肉使零额外延长Q在F1179到期，普攻16岩、92物理。满能开局只开一次Q，随后23次实际普攻回能各+1，结束能量23；未伪称可持续开Q。

三个独立Chromium流程均实际经过可见控件：仆人导入→条件→三列数值→保存重开；海森C4导入→实际快照→C6→已含量→逐击贡献→保存重开；诺艾尔普通轴打开→默认0→填写4→编译→保存重开。390像素宽无横向溢出，页面异常0。仆人／海森重开仍为100级及有效天赋13；这不是Windows实机或真实账号联网验收。

## 必要检查与失败记录

| 检查 | 实际结果 |
| --- | --- |
| 修复前公开单击断言 | 仆人2失败；海森2失败。原数值断言保留，按角色拆成两个独立测试文件。 |
| 修复前普通轴 | 默认零延长2失败，明确参数保留1通过。 |
| 仆人核心／上下文／公开入口 | 135/135通过。 |
| 海森核心／上下文／实际面板草稿／公开入口 | 93/93通过。 |
| 诺艾尔策略／编译／相关等级入口 | 30/30通过。 |
| 原生短边界 | Classic和Stellar分别4/4通过；未启用的长场景不计通过。 |
| 唯一Classic 120秒及离线篡改负例 | 1/1通过，保存捕获的伤害、附魔到期、参数、能量、CD五类篡改均拒绝；未再次运行长场景。 |
| 浏览器 | 三个不同用户流程通过；首次诺艾尔脚本忘记展开文件详情而超时，保留失败日志，修正可见操作后原业务断言通过。 |
| 类型、构建、数据 | 完整类型与构建通过；数据检查最初发现覆盖JSON过时，经现有生成器更新后通过，再构建前端通过。未放宽数据校验或数值容差。 |

角色工作线与根线程的测试集合有重叠，不相加成更高总数。没有重复全量回归，原完整回归仍是旧固定提交的3196通过／79失败／1跳过，当前局部通过不等于这些旧失败清零。未改历史Golden、旧身份或持久格式。

根线程可复现命令（从仓库根运行）：

```sh
./node_modules/.bin/vitest run packages/sim-core/src/arlecchino-damage-formulas.test.ts apps/web/src/arlecchino-calculation-context.test.ts apps/web/src/arlecchino-constellation-context.test.ts apps/web/src/arlecchino-c6-public-entrypoint.test.ts
./node_modules/.bin/vitest run packages/sim-core/src/alhaitham-damage-formulas.test.ts apps/web/src/alhaitham-calculation-context.test.ts apps/web/src/alhaitham-constellation-context.test.ts apps/web/src/alhaitham-final-panel-draft.test.ts apps/web/src/alhaitham-c4-plus-public-entrypoint.test.ts
./node_modules/.bin/vitest run packages/sim-core/src/__tests__/source-noelle-burst-policy.test.ts apps/web/src/source-team-noelle-c6.test.ts apps/web/src/source-team-level.test.ts
npm run data:check
npm run build
```

浏览器配置和全部原始日志在`/tmp/GIDPS-upper-constellation-rotation-20261023/`；运行中的本地Vite为`http://127.0.0.1:4205`。浏览器重现用`node --import ./scripts/register-json-modules.mjs ./node_modules/@playwright/test/cli.js test --config /tmp/GIDPS-upper-constellation-rotation-20261023/playwright.config.mjs`，不要把localhost当外部可访问链接。

## 剩余与发布状态

[全部需求缺口](REQUIREMENTS-ACCEPTANCE-GAPS-20261023.zh-CN.md)同步更新，仍缺全角色机制、配装候选真实重跑能量约束、部分短轴／难度预设与平均时序曲线；上述两个独立单击模块不是完整120秒队伍循环。米游社Windows专项由父线程另行负责，本批没有真实登录。

仅提交／推送到既有GIDPS工作分支，无main合并或生产操作。生产创建请求此前被自动审批拒绝，本批没有重试或换通道，因此这些新修复尚未上线。没有ZIP交付、用户账号秘密、新凭据、付费资源或根许可更改。
