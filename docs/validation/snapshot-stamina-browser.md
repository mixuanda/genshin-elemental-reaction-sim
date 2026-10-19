# 凝光历史快照与共享耐力：浏览器实测

日期：2026-09-24。使用 root 已构建的生产产物、Chromium、`http://127.0.0.1:4173`；未运行旧浏览器全集、旧单元测试或性能套件。仅新增 `apps/web/e2e/snapshot-stamina.spec.ts` 的两条流程。

## 实际执行与失败记录

1. `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/snapshot-stamina.spec.ts`：1 通过、1 失败，总 26.3 秒，exit 1。耐力流程首次通过（1.5 秒）；凝光完整十二击数值断言通过后，展示断言误把页面的 `1,000` 写成 `1000`。只修正测试中的千位分隔符。原始日志：[snapshot-stamina-e2e.log](snapshot-stamina-e2e.log)，[退出码](snapshot-stamina-e2e.exit)。
2. `GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/snapshot-stamina.spec.ts --last-failed`：只复验凝光，失败于默认 30 秒整条测试预算（用例 32.9 秒），没有数值断言失败。现有 Playwright trace 记录的十二段交互操作分别约 5056、5015、5089、5071 毫秒，均正常完成；缺少历史快照时的当前面板交互约 1.2 秒。这些计时包含 Playwright 对完整审计 DOM 的快照开销，不能视为用户实际输入延迟。该观察不是独立性能基准。当时只为这一条完整交互流程设置 60 秒预算，没有修改全局超时、生产代码或数值断言。原始日志：[snapshot-stamina-e2e-retry.log](snapshot-stamina-e2e-retry.log)，[退出码](snapshot-stamina-e2e-retry.exit)。
3. 相同 `--last-failed` 命令：仅凝光通过，用例 39.4 秒、总 40.4 秒，exit 0。已通过的耐力项未重跑。原始日志：[snapshot-stamina-e2e-retry2.log](snapshot-stamina-e2e-retry2.log)，[退出码](snapshot-stamina-e2e-retry2.exit)。

## 已验证范围与实际数值

- 凝光有璇玑屏十二枚 Q：缺历史 E 快照时仅六枚屏宝石被阻断，整体不输出假总计；单独选择本体宝石可计算。T1 Q 系数 0.8696，当前 ATK 2000、CR 0.5、CD 1；历史 ATK 1000、CR 0.2、CD 0.5、适用增伤 0.3；双方等级 90、敌等级 90、抗性 0.1。独立手算每枚本体非暴击 782.64、期望 1173.96；每枚屏宝石非暴击 508.716、期望 559.5876；总非暴击 7748.136、总期望 10401.2856，与页面审计 JSON 一致。
- 历史 A4 单独补 0.12，历史增伤从 0.3 变为有效 0.42；当前六枚数值保持原值。把历史输入改为已包含 A4 的 0.42 并声明已包含，三个总伤分支保持等价。完整十二击及选定单枚屏宝石分别导出／导入后，上下文、命中定义、选择范围、结果及执行轨迹一致。单屏宝石不读取后来改成 9999 的当前 ATK。清除历史快照重新阻断该屏宝石。
- 耐力 UI 显式启用共享池、初始 10，A 重击费用 10／延迟 6 帧，B 重击费用 10／延迟 3 帧。A 于 F0 起手、F6 扣至零；F8 切 B，B 于 F10 请求。严格模式 B 被 `INSUFFICIENT_STAMINA` 拒绝，A 伤害仍执行，F97 至 F180 共 84 次恢复使最终耐力为 35。
- 同一命令切为等待模式：F97 开始恢复，F120 累计 24 次恢复到 10，B 实际起手 F120、命中 F121。F123 先恢复至 11.25，再实际扣 10，最终 1.25；两次伤害总计 855。显示的耐力日志 JSON 与导出记录一致；完整记录重新导入后配置、选项、时间线、耐力日志及伤害事件一致。关闭模型并保存成功，模型和行动费用被清除。

上述是来源规则的合成条件流程验证，不是凝光游戏实测、璇玑屏命中率验证或真实角色耐力消耗认证。旧 Playwright 交互耗时包含追踪开销，未据此声称界面性能达标。后续已恢复默认 30 秒预算，并改为保留追踪操作／错误但不保存此文件的 DOM 快照；新检查见 [按需挂载浏览器记录](render-checkpoint-browser.md)。

计时更正：后续同输入、无 Playwright DOM 快照的单次 CPU 探针实测为修改前 83.556 ms、修改后 79.802 ms；不能把旧追踪中的约 5 秒描述为下降到约 80 ms。探针保留 CPU profiler 开销，不是重复性能基准。原始结果：[before](calculator-render-before.json)、[after](calculator-render-after.json)。
