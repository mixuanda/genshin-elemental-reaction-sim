# 流浪者独立 E 初击：命座范围修正

此前完整姿态的 C0 门槛同时阻塞了已发生的独立 E 初击。本次仅开放流浪者该动作的 `single-hit` 初击至 C0–C6；完整姿态仍限 C0，不新增空居普攻、重击、风矢或 C6 追击。

依据为仓库保留的 gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541` 源码（`packages/game-data/sources/idle-stance-casts/source.json.gz`）：

- `skill.go:27,40–61`：初击在第 2 帧快照/命中，队列未挂 C6 回调。`attack.go:106–115,159–168` 才挂该普攻回调。
- `asc.go:102–125,145–165` 与 `pkg/core/attack.go:36–77`：A1/C4 吸收先于初击快照，可能改变攻击/暴击。因此仍要求明确本次无吸收、输入面板未含未触发的吸收增益；未知或实际不满足均阻塞。
- `wanderer.go:27–28`：C5 提升 E、C3 提升 Q。有效 E13 直接使用，不再次加 3；`zz_wanderer.dm.go:180–197` 对应倍率为 2.023。

合成独立预期：Lv100/E13、ATK2000、暴击率50%/暴伤100%、敌人Lv90/抗性10%，无吸收、反应或其他增伤；期望伤害为 `2000 × 2.023 × 200/390 × 0.9 × 1.5 = 2801.076923076923`。这不是用户 UID 的实际面板或伤害记录。

聚焦 31/31 通过：C0–C6 单击数值、JSON/面板转换、吸收负例、完整 C1/C6 拒绝、其他动作不扩权、字段链接及既有生命周期回归。命令：

```sh
node node_modules/vitest/vitest.mjs run packages/sim-core/src/wanderer-initial-hit.test.ts apps/web/src/calculator-wanderer-requirements.test.ts apps/web/src/calculator-requirements.test.ts packages/sim-core/src/lifecycle-source-batch.test.ts
```

来源文件哈希复核及本地测试日志保存在 `/workspace/GIDPS-cloud/function-batch-20261022/wanderer-initial/`。本分支未执行应用构建、完整回归或部署；真实导入浏览器闭环及 UI 提示由集成分支验证。
