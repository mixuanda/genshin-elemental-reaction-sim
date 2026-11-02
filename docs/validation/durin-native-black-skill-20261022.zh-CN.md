# 杜林黑 E：延迟任务错误共用第三段倍率

真实短调用确认 Classic 和 Stellar 都存在同一数值错误：杜林 C2、黑蚀 R1、有效 E10，输入 `skill; attack;`，第 49/54/59 帧三击全部读取 `skillBlack[2][9] = 1.16352`。固定天赋表对应三段应为 `1.30032 / 0.9576 / 1.16352`。这不是单纯的标签或旧测试预期差异。

原因是 `skillRecastBlack` 在循环外声明 `ai`，三个延迟闭包读取同一变量；循环完成后都看到最后一次写入。新增共享补丁 `134-durin-black-skill-capture.patch` 在每次循环体内复制 `ai`，使延迟命中保留对应倍率及天赋来源行。只在原循环开括号所在物理行加入 `ai := ai`，保留天赋读取位置 `skill.go:121:13`；格式化仍由已有 instrumenter 在记录位置之后完成。

修前、修后都使用相同合成输入及种子 1：

```gcsl
options iteration=1 duration=3;
durin char lvl=90/90 cons=2 talent=10,10,10;
durin add weapon="athameartis" refine=1 lvl=90/90;
target lvl=90 resist=0.1 radius=2 pos=0,2;
active durin;
durin skill;
durin attack;
```

该合成例三击伤害合计由 `1499.8847718766465` 修正为 `1470.1840833246338`；不是玩家配装或团队 DPS。修后天赋索引依次为 `[0,9] / [1,9] / [2,9]`，命中仍为 49/54/59 帧。

两版本均通过固定官方工具链重建：Classic Go1.25.0，Stellar Go1.27.1；原有补丁、固定上游来源及所有许可通知不变。Classic 的 663 个、Stellar 的 698 个天赋 readsite ID 和完整 instrumentation 元数据均保持一致，每版本 18 份 notice 哈希完全不变。

验证包括两份实际 WASM 的修后逐击倍率/来源索引/帧回归，以及 Chromium 中通过可见脚本控件运行真实 Worker、下载完整回执的两版本白 E／黑 E，共 4/4 通过。白 E 仍为 1.9008。新增永久回归为 `apps/web/e2e/durin-skill-native.spec.ts`，`tsc --noEmit` 通过。没有执行完整回归或部署。

完整修前/修后回执、构建日志、WASM 哈希、身份与通知比较、浏览器回执均保留于 `/workspace/GIDPS-cloud/function-batch-20261022/wanderer-team/`，主要索引是 `native-durin-before-after.json`、`native-after-provenance.json` 和 `durin-browser.json`。
