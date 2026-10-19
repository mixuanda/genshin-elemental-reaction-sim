# 烟绯一次重击来源

固定实现：gcsim `b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541`。`raw/gcsim` 保存本项所用的 7 个原始文件；逐文件字节已与固定提交的 GitHub raw URL 比较相等。路径、SHA-256、Git blob SHA、大小与来源 URL 记录于 [来源清单](../../src/character-mappings/yanfei-charged-source-manifest.json)。上游来源及许可证以 [固定仓库](https://github.com/genshinsim/gcsim/tree/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541) 为准。

5 组 `charge[0..4]` 分别对应活动目录的 `combat1.param4..param8`，`burstBonus` 对应独立 Q 等级的 `combat3.param2`。每组 15 级，以十进制源数值逐项比较，共 90 个系数，最大绝对差为 0。该数据比较不等于测试套件运行、外部模拟器交叉结果或游戏实测。

主击与 A4 都为重击标签、火元素；A4 是满足突破、主击暴击、敌人目标、仍在场条件后的一次独立追加，倍率固定为 0.8。主击的暴击决定 A4 是否发生，不决定 A4 自己是否暴击。主击和 A4 的快照、反应与目标状态不能无条件共用。

当前状态保持 **source-backed-provisional**。`charge.go` 留有快照时点 TODO；Q 结束帧产印有 TODO；退场钩子删除 `yanfeiburst`，而 Q 注册的是 `yanfei-q`，因此这份固定源码不能认证正确退场生命周期。独立计算只接受明确条件，不据此推断完整轮转或多目标事件数。
