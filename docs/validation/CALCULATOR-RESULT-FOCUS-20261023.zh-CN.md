# 技能结果优先、已填条件次级显示

实际浏览器截图发现，流浪者Q伤害三列前重复展示已回答的条件，占据结果首屏。本次将仍缺失的条件保持在结果前就地输入；全部回答后，伤害合计在前、条件在下方可折叠修改。没有克隆输入或改公式，保持原ID/事件/键入焦点；正在编辑的输入不自动折走。

实际浏览器用已保存的100级C6流浪者Q13、五击显式对照面板验收：清空C2资源使计算阻断且无残留总伤害；逐字符输入50保持焦点和值，恢复原期望64966.153846153844；折叠条件、保存为新副本后重开仍一致；导航按钮展开并聚焦原输入；资源改40后按C2倍率3→2.6独立比例变化，再改50恢复完全相同的三列伤害。桌面与390px无横向溢出、无pageerror。原输入文件未改，不运行native。

复现：

```sh
node scripts/acceptance/calculator-result-focus-browser.mjs http://127.0.0.1:4205 /tmp/GIDPS-specified-team-20261023/wanderer-durin-browser-final/wanderer-q-five.json /tmp/new-result-focus
```

原始证据 `/tmp/GIDPS-specified-team-20261023/calculator-result-focus/`；结果同目录JSON。此对照面板是算式验证，不是用户完整配装。全项目typecheck、web build退出0；未运行全量套件。本批未生产部署。
