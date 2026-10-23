# 妮可 C2 E 初击与精1尘光：公共入口验收

本块基于 `e5060cf`，接入公开 calculator schema、命座范围、角色条件控件、公式分派以及装备显式应用。保留 `nicole-skill` / `nicole-skill-hit` 原身份，旧档未含新 context 时不迁移、不重算原结果。生产发布继续暂停。

实际缺口是 C2 初击被通用命座门阻断，以及新装备先要求手填能由本次E证明的首次武器条件、旧装备保留零增伤。现在只有明确当前E路径时自动绑定源攻击取样、前台与武器窗口；未知路径在应用前给出具体缺项，不替换原面板。已有生成条款须与其旧来源/状态完整吻合，篡改或重复条款阻断，不覆盖证据。

8帧先造盾并采非转换攻击，后授E增攻及C2的300点；9帧攻击快照不包含新A1攻击，动态C2减抗却可由同击OnEnemyHit先于伤害读取而生效。未位移5米E命中已在10米C2范围内，不重复要求范围开关。这里只按固定社区源码执行，上游明确仍有盾/增攻/命中顺序TODO，不能宣称已游戏实测认证；低突破C2来源冲突仍阻断。

26项相关测试通过：角色及控件11、装备新输入/条款刷新10、公开registry/JSON/公式5。首次公共测试的显式ATK2000样例忘记把源配装基础暴击5%/50%改为预期50%/100%，已补齐该样例输入，原数值预期与容差未改。没有修改Golden或重跑完整套件。

浏览器 Chromium154 实际选择角色、C2、E10，缺项补填、矛盾条件阻断后恢复、导出重开、桌面/390px均通过，无pageerror。手动对照 `2600×2.4912×0.5×1.075×1.5=5222.178`。实际另选90级精1尘光、不装备圣遗物的来源构建，首次攻击样本自动为1703.3537657642514，独立期望3628.356635382116，页面3628.3566353821157；此裸装仅为接线测试，不是毕业预设或玩家配装。原手填2000未泄漏到新装备。武器条件在表单中可见，装备与伤害保存重开一致。

复现：

```sh
npx vitest run apps/web/src/nicole-skill-initial-integration.test.ts packages/sim-core/src/nicole-skill-initial.test.ts packages/sim-core/src/nicole-skill-initial-weapon-refresh.test.ts apps/web/src/calculator-nicole-skill-initial-controls.test.ts
node scripts/acceptance/nicole-initial-browser.mjs http://127.0.0.1:4205 /tmp/new-nicole-acceptance
```

证据 JSON 为同目录 `NICOLE-C2-INITIAL-20261023.json`；详细浏览器文件 `/tmp/GIDPS-specified-team-20261023/nicole-signature-browser/`，单元原始报告 `nicole-integration-weapon.json`（25通过/1样例失败）与 `nicole-public-final.json`（修正样例后5通过）。本块未跑新的原生120秒模拟。

尚未开放此单技能页的C1协同造影、完整Q日程、精1后续0.5秒刷新/回能；现有真实队伍逐帧结果另行保留，不用此单击结果冒充完整循环。
