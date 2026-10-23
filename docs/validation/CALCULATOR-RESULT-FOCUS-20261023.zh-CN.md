# 技能结果优先、已填条件次级显示

实际浏览器截图发现，流浪者Q伤害三列前重复展示已回答的条件，占据结果首屏。本次将仍缺失的条件保持在结果前就地输入；全部回答后，伤害合计在前、条件在下方可折叠修改。没有克隆输入或改公式，保持原ID/事件/键入焦点；正在编辑的输入不自动折走。

实际浏览器用已保存的100级C6流浪者Q13、五击显式对照面板验收：清空C2资源使计算阻断且无残留总伤害；逐字符输入50保持焦点和值，恢复原期望64966.153846153844；折叠条件、保存为新副本后重开仍一致；导航按钮展开并聚焦原输入；资源改40后按C2倍率3→2.6独立比例变化，再改50恢复完全相同的三列伤害。桌面与390px无横向溢出、无pageerror。原输入文件未改，不运行native。

复现：

```sh
node scripts/acceptance/calculator-result-focus-browser.mjs http://127.0.0.1:4205 /tmp/GIDPS-specified-team-20261023/wanderer-durin-browser-final/wanderer-q-five.json /tmp/new-result-focus
```

原始证据 `/tmp/GIDPS-specified-team-20261023/calculator-result-focus/`；结果同目录JSON。此对照面板是算式验证，不是用户完整配装。全项目typecheck、web build退出0；未运行全量套件。本批未生产部署。

追加既有相关浏览器回归：逐字符数字与条件导航2项原样通过；两种宽度的旧用例要求已填条件常驻展开，按新UI增加“展开”操作后原断言继续成立。杜林旧用例用首个“白”选项误选本批新增白Q，已改为明确“转变·白化之是”E及“转变·黑度之否”E。只复查这3个失败用例，3/3通过；原独立伤害、C2已含份额、未知/假条件、黑E七项缺失和跨动作状态断言全部保留。原始2通过/3失败与适配3通过分别保存在existing-condition-playwright.json、existing-condition-adapted.json，不合并成一次运行或改写原失败记录。
