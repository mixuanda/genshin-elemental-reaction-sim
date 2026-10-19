# 诺艾尔条件计算与来源 Q→N 浏览器验收

新增文件 `apps/web/e2e/noelle-actions.spec.ts`，仅两条整合路径。另复验来源契约升级 v2 后唯一受影响的既有安柏 E/Q 场景，未重复旧装备流程。

1. 独立来源 E/N/Q 选择，历史非 Extra DEF 800 与当前 DEF 分开；Q1/Q10 转换分别320/576，C6额外系数后976。普通天赋保持独立，Q 激活时基础攻击转岩；已经包含转换的最终 ATK 不要求未知历史 DEF。核对 C2 重击15%、两段 Q 均为爆发标签，以及新配装、最终面板和 JSON 往返不重复角色或装备贡献。
2. 正常 Rotation 来源入口执行固定 Q→N1–N4；读取实际外部记录 `noelle-q-normal-external.measured.json` 比较行动帧、6次命中、攻击力、Q+8实扣能与历史防御转换。转换公式和随机回能可见流水与本次导出记录相同；实际 Q 与岩附魔 N 命中均以完整上下文恢复，逐节点轨迹一致。

来源边界：固定源码仍将 Q 快照时点与持续时间列为 TODO，界面必须明示 `fixed-source-assumed`，不提升为官方实测。外部 aggregate 总伤与重新求和的 sample 本身已记录约 `1.42e-14` 差异；模拟核心负责人已实际确认本地总伤与原始 aggregate、六段伤害与各原始 sample 数值均精确相等（见 `docs/fixtures/noelle-q-normal-reference.expected.json`），因此本次浏览器直接作精确比较，不用重新求和替代原始总伤。普攻回能使用本地独立随机流，只核对本次流水与导出，不比较与 gcsim 相同种子的随机抽样。

首轮使用统一固定生产构建（构建耗时336ms）与既有4173预览。实际命令：

```sh
GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/noelle-actions.spec.ts apps/web/e2e/equipment-actions.spec.ts --grep 'Noelle sourced|Amber sourced E and Q'
```

没有显式设置 `--workers`，实际2 workers；2通过、1失败，总耗时3.6s，退出码1。原始日志/退出码为 `noelle-actions-e2e.log`、`noelle-actions-e2e.exit`。

- 安柏 E/Q v2 通过（1.9s）：新身份为 `source-action-library:amber-expiry-eq-normal-energy-c0-t1-b4ae769-v2`；19段、原外部伤害、延迟扣能、实体/粒子及完整恢复断言保持。
- 诺艾尔 Q→N 通过（1.4s）：六段命中帧25/66/111/146/187/240与各原始伤害均精确相等，总伤105.67709476067012。起手1f取66.95325防御，按0.4转换26.7813固定攻击，计划981f失效；9f实际扣60能量。转换公式、独立随机回能流水及导出等值，Q/岩附魔N完整轨迹与capture恢复一致。
- 独立诺艾尔首轮失败（1.4s）：输入历史DEF800后填写Q等级1，再激活与追加，实际上下文仍为Q10，转换576而非320。只读Playwright轨迹确认等级输入调用执行但最终页面和audit仍为10。定位为新Noelle数值字段的blur/change全控件重绘会销毁下一输入目标；根代理修复为保留输入DOM，仅同步来源只读数值。未修改数值期望、添加等待或强制事件规避实际焦点问题。

修复后的统一生产构建通过（273模块，341ms）。只复验失败项：

```sh
GIDPS_PREBUILT=1 npx playwright test apps/web/e2e/noelle-actions.spec.ts apps/web/e2e/equipment-actions.spec.ts --grep 'Noelle sourced|Amber sourced E and Q' --last-failed
```

未显式设置 `--workers`，实际1 worker；1通过，总耗时4.1s（场景3.7s），退出码0。原始日志/退出码为 `noelle-actions-e2e-rerun.log`、`noelle-actions-e2e-rerun.exit`。原连续编辑操作通过，Q1/Q10/C6历史转换分别320/576/976，当前DEF变化不重采；already模式不重复转换，C2重击增伤0.15且两段Q不适用；赤角配装、最终面板、JSON与重新配装总伤完全相等。

累计新增诺艾尔两项与受影响安柏一项均通过。已通过的轮转和安柏流程没有重跑，未运行旧装备流程、其他套件或独立性能测量。
